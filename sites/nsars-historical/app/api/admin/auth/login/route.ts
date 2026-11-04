import { getRuntimeBindings } from "@/lib/site-store";
import {
  AdminLoginError,
  authenticateAdmin,
} from "@/lib/admin-session";
import { adminReturnPath, assertSameOrigin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const MAX_LOGIN_BODY_BYTES = 4096;

export async function POST(request: Request) {
  let next = "/admin/";
  try {
    assertSameOrigin(request);
    const form = await readLoginForm(request);
    next = adminReturnPath(form.get("next"));
    const result = await authenticateAdmin(
      form.get("email"),
      form.get("password"),
      request.headers,
      getRuntimeBindings(),
    );
    return redirectResponse(next, result.cookie);
  } catch (error) {
    const code =
      error instanceof AdminLoginError
        ? error.code === "LOGIN_LOCKED"
          ? "locked"
          : error.code === "ADMIN_NOT_CONFIGURED"
            ? "unavailable"
            : "rejected"
        : "unavailable";
    const location = `/admin/login/?error=${code}&next=${encodeURIComponent(next)}`;
    return redirectResponse(location);
  }
}

async function readLoginForm(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !contentType.startsWith("application/x-www-form-urlencoded") ||
    (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) ||
    !request.body
  ) {
    throw rejectedLogin();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel();
      throw rejectedLogin();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw rejectedLogin();
  }
  return new URLSearchParams(body);
}

function rejectedLogin() {
  return new AdminLoginError(401, "LOGIN_REJECTED", "Неверный формат входа.");
}

function redirectResponse(location: string, cookie?: string) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
