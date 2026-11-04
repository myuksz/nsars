import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageRenderer } from "@/components/composer-page-renderer";
import { getPublicPageByRoute } from "@/lib/site-store";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const route = routeFromSlug((await params).slug);
  const result = await getPublicPageByRoute(route);
  if (!result) {
    return {
      title: "Страница не найдена — NS-ARS",
      robots: { index: false, follow: false, nocache: true },
    };
  }
  return {
    title: result.page.seo.title,
    description: result.page.seo.description,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PublicRoute({ params }: RouteProps) {
  const route = routeFromSlug((await params).slug);
  const result = await getPublicPageByRoute(route);
  if (!result) notFound();
  return (
    <PageRenderer
      document={result.page}
      mode="published"
      mediaItems={result.mediaItems}
      navigation={result.navigation}
      contentSource={result.source}
    />
  );
}

function routeFromSlug(slug: string[]) {
  return `/${slug.join("/")}/`;
}
