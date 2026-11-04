import { headers } from "next/headers";
import type { Metadata } from "next";
import { AccessPanel } from "@/components/access-panel";
import { ComposerEditor } from "@/components/composer-editor";
import {
  AdminAccessError,
  adminLoginPath,
  authorizeAdmin,
} from "@/lib/admin-auth";
import { isValidPageId } from "@/lib/page-contract";
import {
  getAdminPageOptions,
  getAdminSnapshot,
  RepositoryError,
} from "@/lib/site-store";
import { listMediaItems } from "@/lib/media-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Редактор страниц — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPageEditor({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const pageId = (await params).pageId;
  const result = await loadAdmin(isValidPageId(pageId) ? pageId : "page_home");
  if (result.ok) {
    return (
      <ComposerEditor
        key={result.snapshot.draft.pageId}
        initialSnapshot={result.snapshot}
        initialMedia={result.media}
        actorLabel={result.actorLabel}
        pageOptions={result.pageOptions}
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

async function loadAdmin(pageId: string) {
  try {
    const actor = authorizeAdmin(new Headers(await headers()));
    const [snapshot, media, pageOptions] = await Promise.all([
      getAdminSnapshot(pageId),
      listMediaItems(),
      getAdminPageOptions(),
    ]);
    return {
      ok: true as const,
      actorLabel: actor.email,
      snapshot,
      media,
      pageOptions,
    };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return {
        ok: false as const,
        title: error.status === 401 ? "Требуется вход" : "Доступ закрыт",
        message: error.message,
        signInHref:
          error.status === 401
            ? adminLoginPath(`/admin/pages/${encodeURIComponent(pageId)}/`)
            : undefined,
      };
    }
    return {
      ok: false as const,
      title: "Редактор остановлен",
      message:
        error instanceof RepositoryError
          ? error.message
          : "Хранилище редактора временно недоступно.",
      signInHref: undefined,
    };
  }
}
