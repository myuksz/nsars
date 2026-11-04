import { headers } from "next/headers";
import type { Metadata } from "next";
import { AccessPanel } from "@/components/access-panel";
import { PageRenderer } from "@/components/composer-page-renderer";
import {
  AdminAccessError,
  adminLoginPath,
  authorizeAdmin,
} from "@/lib/admin-auth";
import { isValidPageId } from "@/lib/page-contract";
import { collectComposerMediaIds } from "@/lib/composer-contract";
import {
  getAdminSnapshot,
  getDraftNavigationPreview,
  RepositoryError,
} from "@/lib/site-store";
import { getMediaItemsByIds } from "@/lib/media-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Предпросмотр черновика — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const rawPage = (await searchParams).page;
  const requestedPage = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const pageId = requestedPage && isValidPageId(requestedPage)
    ? requestedPage
    : "page_home";
  const result = await loadPreview(pageId);
  if (result.ok) {
    return (
      <PageRenderer
        document={result.snapshot.draft}
        mode="preview"
        mediaItems={result.media}
        navigation={result.navigation}
        contentSource={`D1_DRAFT_V${result.snapshot.draftVersion}`}
      />
    );
  }
  return (
    <AccessPanel
      title={result.title}
      message={result.message}
      signInHref={result.signInHref}
    />
  );
}

async function loadPreview(pageId: string) {
  try {
    authorizeAdmin(new Headers(await headers()));
    const [snapshot, navigation] = await Promise.all([
      getAdminSnapshot(pageId),
      getDraftNavigationPreview(),
    ]);
    const media = await getMediaItemsByIds(collectComposerMediaIds(snapshot.draft));
    return { ok: true as const, snapshot, media, navigation };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return {
        ok: false as const,
        title: error.status === 401 ? "Требуется вход" : "Доступ закрыт",
        message: error.message,
        signInHref:
          error.status === 401 ? adminLoginPath("/preview") : undefined,
      };
    }
    const message =
      error instanceof RepositoryError
        ? error.message
        : "Предпросмотр временно недоступен.";
    return {
      ok: false as const,
      title: "Предпросмотр остановлен",
      message,
      signInHref: undefined,
    };
  }
}
