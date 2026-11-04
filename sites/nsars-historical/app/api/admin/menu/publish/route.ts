import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { publishNavigationDraft } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body)) throw new TypeError("Body must be an object");
    const snapshot = await publishNavigationDraft(
      Number(body.expectedDraftVersion),
      actor.auditId,
    );
    return Response.json(
      { ok: true, snapshot, notice: "Создана и включена новая ревизия меню." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
