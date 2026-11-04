import { assertSameOrigin } from "@/lib/admin-auth";
import { closeAdminSession } from "@/lib/admin-session";
import { getRuntimeBindings } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookie = await closeAdminSession(request.headers, getRuntimeBindings());
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/login/",
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, {
      status: 303,
      headers: { Location: "/admin/login/", "Cache-Control": "no-store" },
    });
  }
}
