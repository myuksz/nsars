import { headers } from "next/headers";
import type { Metadata } from "next";
import { AccessPanel } from "@/components/access-panel";
import { AdminMenuEditor } from "@/components/admin-menu-editor";
import {
  AdminAccessError,
  adminLoginPath,
  authorizeAdmin,
} from "@/lib/admin-auth";
import {
  getAdminNavigationSnapshot,
  getAdminPageOptions,
  RepositoryError,
} from "@/lib/site-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Меню сайта — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminMenuPage() {
  const result = await loadMenu();
  if (result.ok) {
    return (
      <AdminMenuEditor
        initialSnapshot={result.snapshot}
        pageOptions={result.pageOptions}
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

async function loadMenu() {
  try {
    const actor = authorizeAdmin(new Headers(await headers()));
    const [snapshot, pageOptions] = await Promise.all([
      getAdminNavigationSnapshot(),
      getAdminPageOptions(),
    ]);
    return { ok: true as const, snapshot, pageOptions, actorLabel: actor.email };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return {
        ok: false as const,
        title: error.status === 401 ? "Требуется вход" : "Доступ закрыт",
        message: error.message,
        signInHref: error.status === 401 ? adminLoginPath("/admin/menu/") : undefined,
      };
    }
    return {
      ok: false as const,
      title: "Редактор меню остановлен",
      message: error instanceof RepositoryError ? error.message : "Хранилище временно недоступно.",
      signInHref: undefined,
    };
  }
}
