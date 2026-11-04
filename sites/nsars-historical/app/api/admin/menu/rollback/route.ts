import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { rollbackNavigation } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.targetRevisionId !== "string") {
      throw new TypeError("targetRevisionId is required");
    }
    const snapshot = await rollbackNavigation(body.targetRevisionId, actor.auditId);
    return Response.json(
      { ok: true, snapshot, notice: "Активная ревизия меню переключена." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
