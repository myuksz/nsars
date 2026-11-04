import { apiError, isRecord, readJsonBody } from "@/lib/api-response";
import { assertSameOrigin, authorizeAdmin } from "@/lib/admin-auth";
import { setPagePublicVisibility } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = authorizeAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    if (
      !isRecord(body) ||
      typeof body.pageId !== "string" ||
      typeof body.visible !== "boolean"
    ) {
      throw new TypeError("pageId and visible are required");
    }
    const snapshot = await setPagePublicVisibility(
      body.pageId,
      body.visible,
      actor.auditId,
    );
    return Response.json(
      {
        ok: true,
        snapshot,
        notice: snapshot.publicVisible
          ? "Страница включена в публичный контур."
          : "Страница скрыта с публичного сайта.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
