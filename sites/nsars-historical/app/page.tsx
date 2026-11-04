import type { Metadata } from "next";
import { PageRenderer } from "@/components/composer-page-renderer";
import { getPublicHome } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { page } = await getPublicHome();
  return {
    title: page.seo.title,
    description: page.seo.description,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function Home() {
  const result = await getPublicHome();
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
