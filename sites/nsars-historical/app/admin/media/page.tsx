import { headers } from "next/headers";
import type { Metadata } from "next";
import { AccessPanel } from "@/components/access-panel";
import { AdminMediaManager } from "@/components/admin-media-manager";
import {
  AdminAccessError,
  adminLoginPath,
  authorizeAdmin,
} from "@/lib/admin-auth";
import { listMediaItems } from "@/lib/media-store";
import { RepositoryError } from "@/lib/site-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Медиатека — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminMediaPage() {
  const result = await loadMedia();
  if (result.ok) {
    return (
      <AdminMediaManager
        initialMedia={result.media}
        actorLabel={result.actorLabel}
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

async function loadMedia() {
  try {
    const actor = authorizeAdmin(new Headers(await headers()));
    return {
      ok: true as const,
      media: await listMediaItems(),
      actorLabel: actor.email,
    };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return {
        ok: false as const,
        title: error.status === 401 ? "Требуется вход" : "Доступ закрыт",
        message: error.message,
        signInHref: error.status === 401 ? adminLoginPath("/admin/media/") : undefined,
      };
    }
    return {
      ok: false as const,
      title: "Медиатека остановлена",
      message: error instanceof RepositoryError ? error.message : "Хранилище временно недоступно.",
      signInHref: undefined,
    };
  }
}
