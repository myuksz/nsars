import { AdminAccessError } from "./admin-auth";
import { RepositoryError } from "./site-store";

export function apiError(error: unknown): Response {
  if (error instanceof AdminAccessError) {
    return Response.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof RepositoryError) {
    const status =
      error.code === "CONFLICT"
        ? 409
        : error.code === "NOT_FOUND"
          ? 404
          : error.code === "INVALID_DOCUMENT"
            ? 422
            : 503;
    return Response.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status },
    );
  }
  if (error instanceof TypeError) {
    return Response.json(
      { ok: false, error: "Некорректный формат запроса.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  return Response.json(
    {
      ok: false,
      error: "Операция остановлена без изменения данных.",
      code: "UNEXPECTED_ERROR",
    },
    { status: 500 },
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Ожидается JSON-запрос.",
    );
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 200_000) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Запрос превышает допустимый размер.",
    );
  }
  try {
    return await request.json();
  } catch {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Тело запроса не является корректным JSON.",
    );
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
