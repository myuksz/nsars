import { apiError } from "@/lib/api-response";
import { authorizeAdmin } from "@/lib/admin-auth";
import { getAdminSnapshot } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeAdmin(request.headers);
    const pageId = new URL(request.url).searchParams.get("pageId") ?? "page_home";
    const snapshot = await getAdminSnapshot(pageId);
    return Response.json(
      {
        ok: true,
        activeRevisionId: snapshot.activeRevisionId,
        revisions: snapshot.revisions,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
