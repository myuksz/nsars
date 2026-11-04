import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const SESSION_COOKIE = "nsars_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_SECONDS = 60;
const MAX_PASSWORD_CHARACTERS = 200;
const MAX_PASSWORD_BYTES = 800;
const TRUSTED_EMAIL_HEADER = "x-nsars-admin-email";
const TRUSTED_MODE_HEADER = "x-nsars-admin-mode";

export type AdminRuntimeBindings = {
  DB?: D1Database;
  NSARS_ADMIN_EMAIL?: string;
  NSARS_ADMIN_PASSWORD_SALT_HEX?: string;
  NSARS_ADMIN_PASSWORD_HASH_HEX?: string;
};

type SessionRow = {
  email: string;
  expires_at: number;
  user_agent_hash: string;
};

type AuthStateRow = {
  failed_attempts: number;
  locked_until: number | null;
};

export class AdminLoginError extends Error {
  constructor(
    public readonly status: 401 | 423 | 503,
    public readonly code:
      | "LOGIN_REJECTED"
      | "LOGIN_LOCKED"
      | "ADMIN_NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
    this.name = "AdminLoginError";
  }
}

export async function authenticateAdmin(
  emailInput: unknown,
  passwordInput: unknown,
  requestHeaders: Headers,
  bindings: AdminRuntimeBindings,
) {
  const email = normalizeEmail(emailInput);
  const password = normalizePassword(passwordInput);
  if (!email || password === null) {
    throw new AdminLoginError(
      401,
      "LOGIN_REJECTED",
      "Неверный логин или пароль.",
    );
  }

  const database = requireDatabase(bindings);
  const config = requireAccountConfig(bindings);
  await ensureAuthSchema(database);

  const identityHash = sha256(email || "invalid-identity");
  const throttleHash = requestThrottleHash(requestHeaders);
  const userAgentHash = sha256(requestHeaders.get("user-agent") ?? "");
  const now = Math.floor(Date.now() / 1000);
  const state = await database
    .prepare(
      `SELECT failed_attempts, locked_until
         FROM admin_auth_state
        WHERE identity_hash = ?1`,
    )
    .bind(throttleHash)
    .first<AuthStateRow>();

  if (state?.locked_until && state.locked_until > now) {
    await recordAuthEvent(
      database,
      "LOGIN_LOCKED",
      identityHash,
      userAgentHash,
      now,
    );
    throw new AdminLoginError(
      423,
      "LOGIN_LOCKED",
      "Вход временно заблокирован после нескольких неудачных попыток.",
    );
  }

  const derived = await passwordDigest(password, config.salt);
  const emailMatches = constantTimeTextEqual(email, config.email);
  const passwordMatches = timingSafeEqual(derived, config.passwordHash);

  if (!emailMatches || !passwordMatches) {
    const previousAttempts =
      state?.locked_until && state.locked_until <= now
        ? 0
        : (state?.failed_attempts ?? 0);
    const failedAttempts = previousAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_SECONDS : null;
    await database.batch([
      database
        .prepare(
          `INSERT INTO admin_auth_state
             (identity_hash, failed_attempts, locked_until, updated_at)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(identity_hash) DO UPDATE SET
             failed_attempts = excluded.failed_attempts,
             locked_until = excluded.locked_until,
             updated_at = excluded.updated_at`,
        )
        .bind(throttleHash, failedAttempts, lockedUntil, now),
      database
        .prepare(
          `INSERT INTO admin_auth_events
             (action, identity_hash, user_agent_hash, created_at)
           VALUES ('LOGIN_REJECTED', ?1, ?2, ?3)`,
        )
        .bind(identityHash, userAgentHash, now),
    ]);
    throw new AdminLoginError(
      401,
      "LOGIN_REJECTED",
      "Неверный логин или пароль.",
    );
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = now + SESSION_SECONDS;
  await database.batch([
    database
      .prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?1`)
      .bind(now),
    database
      .prepare(
        `INSERT INTO admin_sessions
           (id, token_hash, email, expires_at, user_agent_hash, created_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
      )
      .bind(
        sessionId,
        tokenHash,
        config.email,
        expiresAt,
        userAgentHash,
        now,
      ),
    database
      .prepare(
        `INSERT INTO admin_auth_state
           (identity_hash, failed_attempts, locked_until, updated_at)
         VALUES (?1, 0, NULL, ?2)
         ON CONFLICT(identity_hash) DO UPDATE SET
           failed_attempts = 0,
           locked_until = NULL,
           updated_at = excluded.updated_at`,
      )
      .bind(throttleHash, now),
    database
      .prepare(
        `INSERT INTO admin_auth_events
           (action, identity_hash, user_agent_hash, created_at)
         VALUES ('LOGIN_SUCCEEDED', ?1, ?2, ?3)`,
      )
      .bind(identityHash, userAgentHash, now),
  ]);

  return {
    email: config.email,
    cookie: sessionCookie(token, SESSION_SECONDS),
  };
}

export async function requestWithAdminSession(
  request: Request,
  bindings: AdminRuntimeBindings,
) {
  const headers = cleanTrustedHeaders(request.headers);
  const token = readCookie(headers.get("cookie"), SESSION_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !bindings.DB) {
    return new Request(request, { headers });
  }

  const database = bindings.DB;
  await ensureAuthSchema(database);
  const tokenHash = sha256(token);
  const row = await database
    .prepare(
      `SELECT email, expires_at, user_agent_hash
         FROM admin_sessions
        WHERE token_hash = ?1`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
  const now = Math.floor(Date.now() / 1000);
  const userAgentHash = sha256(headers.get("user-agent") ?? "");

  if (
    !row ||
    row.expires_at <= now ||
    !constantTimeTextEqual(row.user_agent_hash, userAgentHash)
  ) {
    if (row) {
      await database
        .prepare(`DELETE FROM admin_sessions WHERE token_hash = ?1`)
        .bind(tokenHash)
        .run();
    }
    return new Request(request, { headers });
  }

  headers.set(TRUSTED_EMAIL_HEADER, row.email);
  headers.set(TRUSTED_MODE_HEADER, "PASSWORD_SESSION");
  await database
    .prepare(
      `UPDATE admin_sessions
          SET last_seen_at = ?1
        WHERE token_hash = ?2`,
    )
    .bind(now, tokenHash)
    .run();
  return new Request(request, { headers });
}

export function requestWithoutTrustedAdminHeaders(request: Request) {
  return new Request(request, { headers: cleanTrustedHeaders(request.headers) });
}

export async function closeAdminSession(
  requestHeaders: Headers,
  bindings: AdminRuntimeBindings,
) {
  const token = readCookie(requestHeaders.get("cookie"), SESSION_COOKIE);
  if (token && /^[a-f0-9]{64}$/.test(token) && bindings.DB) {
    await ensureAuthSchema(bindings.DB);
    await bindings.DB
      .prepare(`DELETE FROM admin_sessions WHERE token_hash = ?1`)
      .bind(sha256(token))
      .run();
  }
  return expiredSessionCookie();
}

function cleanTrustedHeaders(input: Headers) {
  const headers = new Headers(input);
  for (const name of [...headers.keys()]) {
    const normalized = name.toLowerCase();
    if (
      normalized === TRUSTED_EMAIL_HEADER ||
      normalized === TRUSTED_MODE_HEADER ||
      normalized.startsWith("oai-authenticated-user-")
    ) {
      headers.delete(name);
    }
  }
  return headers;
}

function requireDatabase(bindings: AdminRuntimeBindings) {
  if (!bindings.DB) {
    throw new AdminLoginError(
      503,
      "ADMIN_NOT_CONFIGURED",
      "Система входа временно недоступна.",
    );
  }
  return bindings.DB;
}

function requireAccountConfig(bindings: AdminRuntimeBindings) {
  const email = normalizeEmail(bindings.NSARS_ADMIN_EMAIL);
  const saltHex = bindings.NSARS_ADMIN_PASSWORD_SALT_HEX?.trim() ?? "";
  const passwordHashHex =
    bindings.NSARS_ADMIN_PASSWORD_HASH_HEX?.trim() ?? "";
  if (
    !email ||
    !/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(saltHex) ||
    !/^[a-f0-9]{128}$/i.test(passwordHashHex)
  ) {
    throw new AdminLoginError(
      503,
      "ADMIN_NOT_CONFIGURED",
      "Система входа ещё не настроена.",
    );
  }
  return {
    email,
    salt: Buffer.from(saltHex, "hex"),
    passwordHash: Buffer.from(passwordHashHex, "hex"),
  };
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 ? email : "";
}

function normalizePassword(value: unknown) {
  if (typeof value !== "string") return null;
  if (
    value.length === 0 ||
    value.length > MAX_PASSWORD_CHARACTERS ||
    Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES
  ) {
    return null;
  }
  return value;
}

function requestThrottleHash(headers: Headers) {
  const connectingIp = headers.get("cf-connecting-ip")?.trim().slice(0, 128);
  const source = connectingIp
    ? `ip:${connectingIp}`
    : `ua:${(headers.get("user-agent") ?? "unknown").slice(0, 512)}`;
  return sha256(`admin-login-source:${source}`);
}

async function passwordDigest(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function constantTimeTextEqual(left: string, right: string) {
  const leftHash = Buffer.from(sha256(left), "hex");
  const rightHash = Buffer.from(sha256(right), "hex");
  return timingSafeEqual(leftHash, rightHash);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function recordAuthEvent(
  database: D1Database,
  action: string,
  identityHash: string,
  userAgentHash: string,
  createdAt: number,
) {
  await database
    .prepare(
      `INSERT INTO admin_auth_events
         (action, identity_hash, user_agent_hash, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(action, identityHash, userAgentHash, createdAt)
    .run();
}

const authSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    user_agent_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx
    ON admin_sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_auth_state (
    identity_hash TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_auth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    identity_hash TEXT NOT NULL,
    user_agent_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS admin_auth_events_created_idx
    ON admin_auth_events(created_at)`,
] as const;

const authSchemaReady = new WeakMap<object, Promise<void>>();

async function ensureAuthSchema(database: D1Database) {
  const key = database as unknown as object;
  let pending = authSchemaReady.get(key);
  if (!pending) {
    pending = database
      .batch(authSchemaStatements.map((statement) => database.prepare(statement)))
      .then(() => undefined)
      .catch((error) => {
        authSchemaReady.delete(key);
        throw error;
      });
    authSchemaReady.set(key, pending);
  }
  await pending;
}
