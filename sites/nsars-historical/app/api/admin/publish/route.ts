import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { publishPageDraft } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.pageId !== "string") {
      throw new TypeError("Body must include pageId");
    }
    const snapshot = await publishPageDraft(
      body.pageId,
      Number(body.expectedDraftVersion),
      actor.auditId,
    );
    return Response.json(
      {
        ok: true,
        snapshot,
        notice: "Создана неизменяемая ревизия и переключена активная версия.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
