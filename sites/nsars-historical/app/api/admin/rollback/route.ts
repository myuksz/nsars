import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { rollbackPage } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (
      !isRecord(body) ||
      typeof body.pageId !== "string" ||
      typeof body.targetRevisionId !== "string" ||
      typeof body.expectedActiveRevisionId !== "string"
    ) {
      throw new TypeError("pageId, targetRevisionId and expectedActiveRevisionId are required");
    }
    const snapshot = await rollbackPage(
      body.pageId,
      body.targetRevisionId,
      body.expectedActiveRevisionId,
      actor.auditId,
    );
    return Response.json(
      {
        ok: true,
        snapshot,
        notice: "Активный указатель переключён; опубликованные ревизии не изменялись.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
