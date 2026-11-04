import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import {
  getAdminNavigationSnapshot,
  saveNavigationDraft,
} from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeAdmin(request.headers);
    return Response.json(
      { ok: true, snapshot: await getAdminNavigationSnapshot() },
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
    const snapshot = await saveNavigationDraft(
      body.document,
      Number(body.expectedDraftVersion),
      actor.auditId,
    );
    return Response.json(
      { ok: true, snapshot, notice: "Черновик меню сохранён." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
