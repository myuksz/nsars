import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { createPage, duplicatePage, getAdminPageOptions } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeAdmin(request.headers);
    return Response.json(
      { ok: true, pages: await getAdminPageOptions() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.title !== "string" || typeof body.slug !== "string") {
      throw new TypeError("title and slug are required");
    }
    if (body.action !== "create" && body.action !== "duplicate") {
      throw new TypeError("action must be create or duplicate");
    }
    const createBlank = body.action === "create";
    const snapshot = createBlank
      ? await createPage(body.title, body.slug, body.pageType, actor.auditId)
      : typeof body.sourcePageId === "string"
        ? await duplicatePage(body.sourcePageId, body.title, body.slug, actor.auditId)
        : (() => { throw new TypeError("sourcePageId is required for duplicate"); })();
    return Response.json(
      {
        ok: true,
        snapshot,
        pages: await getAdminPageOptions(),
        notice: createBlank
          ? "Создана пустая скрытая страница. Добавьте любые нужные блоки."
          : "Скрытая страница создана из текущей.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
