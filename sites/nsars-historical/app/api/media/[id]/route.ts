import { apiError } from "@/lib/api-response";
import { authorizeAdmin } from "@/lib/admin-auth";
import { getMediaObject } from "@/lib/media-store";
import { getRuntimeBindings, RepositoryError } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    if (preview) authorizeAdmin(request.headers);
    const { item, object } = await getMediaObject((await params).id, preview);
    if (!preview) {
      const images = getRuntimeBindings().IMAGES;
      if (!images) {
        throw new RepositoryError(
          "DATABASE_UNAVAILABLE",
          "Безопасная выдача изображения временно недоступна.",
        );
      }
      const transformed = await images
        .input(object.body)
        .transform({})
        .output({ format: "image/webp", quality: 90 });
      const imageResponse = await transformed.response();
      return new Response(imageResponse.body, {
        status: imageResponse.status,
        headers: {
          "Content-Type": imageResponse.headers.get("content-type") ?? "image/webp",
          "Cache-Control": "public, max-age=3600, must-revalidate",
          ETag: `"${item.id}-v${item.version}"`,
          "Content-Disposition": "inline",
          "Cross-Origin-Resource-Policy": "same-origin",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": item.mimeType,
        "Content-Length": String(item.byteSize),
        "Cache-Control": "private, no-store",
        ETag: `"${item.sha256}"`,
        "Content-Disposition": "inline",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
