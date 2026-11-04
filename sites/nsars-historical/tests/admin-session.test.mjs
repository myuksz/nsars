import assert from "node:assert/strict";
import { promisify } from "node:util";
import { scrypt } from "node:crypto";
import test from "node:test";
import {
  AdminLoginError,
  authenticateAdmin,
  closeAdminSession,
  requestWithAdminSession,
  requestWithoutTrustedAdminHeaders,
} from "../lib/admin-session.ts";
import { createFakeD1 } from "./fake-d1.mjs";

const email = "owner@example.test";
const password = "direct-site-password";
const saltHex = "11".repeat(16);
const passwordHashHex = Buffer.from(
  await promisify(scrypt)(password, Buffer.from(saltHex, "hex"), 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }),
).toString("hex");

function bindings(database) {
  return {
    DB: database,
    NSARS_ADMIN_EMAIL: email,
    NSARS_ADMIN_PASSWORD_SALT_HEX: saltHex,
    NSARS_ADMIN_PASSWORD_HASH_HEX: passwordHashHex,
  };
}

function headers(ip = "203.0.113.10", userAgent = "NSARS test browser") {
  return new Headers({
    "cf-connecting-ip": ip,
    "user-agent": userAgent,
  });
}

test("malformed and oversized passwords are rejected before storage is required", async () => {
  for (const value of [null, "", "x".repeat(201), "🙂".repeat(201)]) {
    await assert.rejects(
      authenticateAdmin(email, value, headers(), {}),
      (error) => error instanceof AdminLoginError && error.code === "LOGIN_REJECTED",
    );
  }
});

test("valid direct credentials create a protected session and logout revokes it", async () => {
  const database = createFakeD1();
  try {
    const result = await authenticateAdmin(email, password, headers(), bindings(database));
    assert.equal(result.email, email);
    assert.match(
      result.cookie,
      /^nsars_admin_session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/,
    );

    const cookie = result.cookie.split(";", 1)[0];
    const authenticated = await requestWithAdminSession(
      new Request("https://ns-ars.ru/admin/", {
        headers: {
          ...Object.fromEntries(headers()),
          cookie,
          "oai-authenticated-user-email": "forged@example.test",
          "x-nsars-admin-email": "forged@example.test",
          "x-nsars-admin-mode": "PASSWORD_SESSION",
        },
      }),
      bindings(database),
    );
    assert.equal(authenticated.headers.get("x-nsars-admin-email"), email);
    assert.equal(authenticated.headers.get("x-nsars-admin-mode"), "PASSWORD_SESSION");
    assert.equal(authenticated.headers.get("oai-authenticated-user-email"), null);

    const expired = await closeAdminSession(authenticated.headers, bindings(database));
    assert.match(expired, /Max-Age=0/);
    const revoked = await requestWithAdminSession(
      new Request("https://ns-ars.ru/admin/", {
        headers: { ...Object.fromEntries(headers()), cookie },
      }),
      bindings(database),
    );
    assert.equal(revoked.headers.get("x-nsars-admin-email"), null);
  } finally {
    database.close();
  }
});

test("session is bound to the browser user agent", async () => {
  const database = createFakeD1();
  try {
    const result = await authenticateAdmin(email, password, headers(), bindings(database));
    const cookie = result.cookie.split(";", 1)[0];
    const request = new Request("https://ns-ars.ru/admin/", {
      headers: { ...Object.fromEntries(headers(undefined, "Different browser")), cookie },
    });
    const rejected = await requestWithAdminSession(request, bindings(database));
    assert.equal(rejected.headers.get("x-nsars-admin-email"), null);
  } finally {
    database.close();
  }
});

test("login throttling is source-specific and does not lock the owner globally", async () => {
  const database = createFakeD1();
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        authenticateAdmin(email, "wrong-password", headers("203.0.113.20"), bindings(database)),
        (error) => error instanceof AdminLoginError && error.code === "LOGIN_REJECTED",
      );
    }
    await assert.rejects(
      authenticateAdmin(email, password, headers("203.0.113.20"), bindings(database)),
      (error) => error instanceof AdminLoginError && error.code === "LOGIN_LOCKED",
    );
    const otherSource = await authenticateAdmin(
      email,
      password,
      headers("203.0.113.21"),
      bindings(database),
    );
    assert.match(otherSource.cookie, /HttpOnly; Secure; SameSite=Strict/);
  } finally {
    database.close();
  }
});

test("anonymous requests lose every trusted or OAI identity header", () => {
  const clean = requestWithoutTrustedAdminHeaders(
    new Request("https://ns-ars.ru/api/admin/page/", {
      headers: {
        "x-nsars-admin-email": "forged@example.test",
        "x-nsars-admin-mode": "PASSWORD_SESSION",
        "oai-authenticated-user-email": "forged@example.test",
        "oai-authenticated-user-full-name": "Forged",
      },
    }),
  );
  assert.equal(clean.headers.get("x-nsars-admin-email"), null);
  assert.equal(clean.headers.get("x-nsars-admin-mode"), null);
  assert.equal(clean.headers.get("oai-authenticated-user-email"), null);
  assert.equal(clean.headers.get("oai-authenticated-user-full-name"), null);
});
