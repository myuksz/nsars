import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { getAdminSnapshot, savePageDraft } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeAdmin(request.headers);
    const pageId = new URL(request.url).searchParams.get("pageId") ?? "page_home";
    const snapshot = await getAdminSnapshot(pageId);
    return Response.json(
      { ok: true, snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body)) throw new TypeError("Body must be an object");
    const snapshot = await savePageDraft(
      body.document,
      Number(body.expectedDraftVersion),
      actor.auditId,
    );
    return Response.json(
      { ok: true, snapshot, notice: "Черновик сохранён в D1." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
