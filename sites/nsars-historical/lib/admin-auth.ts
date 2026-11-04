const SESSION_EMAIL_HEADER = "x-nsars-admin-email";
const SESSION_MODE_HEADER = "x-nsars-admin-mode";

export type AdminActor = {
  email: string;
  auditId: string;
  mode: "PASSWORD_SESSION";
};

export class AdminAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    public readonly code:
      | "SIGN_IN_REQUIRED"
      | "ADMIN_NOT_ALLOWED"
      | "ADMIN_NOT_CONFIGURED"
      | "FORBIDDEN_HOST"
      | "ORIGIN_REJECTED",
    message: string,
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export function authorizeAdmin(requestHeaders: Headers): AdminActor {
  const hostname = normalizedHostname(requestHeaders.get("host"));
  if (
    hostname === "ns-ars-production.ru" ||
    hostname.endsWith(".ns-ars-production.ru")
  ) {
    throw new AdminAccessError(
      403,
      "FORBIDDEN_HOST",
      "Этот хост не входит в контур NS-ARS.",
    );
  }

  const sessionEmail = requestHeaders
    .get(SESSION_EMAIL_HEADER)
    ?.trim()
    .toLowerCase();
  if (
    sessionEmail &&
    requestHeaders.get(SESSION_MODE_HEADER) === "PASSWORD_SESSION"
  ) {
    return {
      email: sessionEmail,
      auditId: sessionEmail,
      mode: "PASSWORD_SESSION",
    };
  }

  throw new AdminAccessError(
    401,
    "SIGN_IN_REQUIRED",
    "Для доступа к конструктору войдите с электронной почтой и паролем сайта.",
  );
}

export function adminReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/";
  }
  let url: URL;
  try {
    url = new URL(value, "https://ns-ars.ru");
  } catch {
    return "/admin/";
  }
  if (url.origin !== "https://ns-ars.ru") return "/admin/";
  const allowed = ["/admin", "/preview", "/qa-responsive"].some(
    (prefix) =>
      url.pathname === prefix ||
      url.pathname === `${prefix}/` ||
      url.pathname.startsWith(`${prefix}/`),
  );
  return allowed ? `${url.pathname}${url.search}` : "/admin/";
}

export function adminLoginPath(next: string) {
  return `/admin/login/?next=${encodeURIComponent(adminReturnPath(next))}`;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    throw new AdminAccessError(
      403,
      "ORIGIN_REJECTED",
      "Запрос на изменение должен быть отправлен из интерфейса этого сайта.",
    );
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new AdminAccessError(
      403,
      "ORIGIN_REJECTED",
      "Некорректный источник запроса.",
    );
  }
  if (originHost !== host.toLowerCase()) {
    throw new AdminAccessError(
      403,
      "ORIGIN_REJECTED",
      "Межсайтовый запрос отклонён.",
    );
  }
}

function normalizedHostname(host: string | null) {
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end).toLowerCase() : "";
  }
  return host.split(":", 1)[0].toLowerCase();
}
