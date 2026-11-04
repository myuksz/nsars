import { getPublicSitemapRoutes } from "@/lib/site-store";

export async function GET() {
  const routes = await getPublicSitemapRoutes();
  const urls = routes.map(
    (route) => `  <url><loc>https://ns-ars.ru${route}</loc></url>`,
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
