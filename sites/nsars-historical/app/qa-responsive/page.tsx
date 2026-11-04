import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessPanel } from "@/components/access-panel";
import {
  AdminAccessError,
  adminLoginPath,
  authorizeAdmin,
} from "@/lib/admin-auth";
import { PAGE_ROUTE_CONTRACT } from "@/lib/page-contract";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Responsive QA — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

const viewports = [320, 360, 390, 768, 1024, 1440] as const;
const pages = [
  { label: "Главная", route: PAGE_ROUTE_CONTRACT.page_home },
  { label: "Детский сад", route: PAGE_ROUTE_CONTRACT.page_kindergarten },
  { label: "4 класс", route: PAGE_ROUTE_CONTRACT.page_grade4 },
  { label: "Старшая школа", route: PAGE_ROUTE_CONTRACT.page_highschool },
  { label: "Работы", route: PAGE_ROUTE_CONTRACT.page_gallery },
  { label: "Комплектации", route: PAGE_ROUTE_CONTRACT.page_prices },
  { label: "О нас", route: PAGE_ROUTE_CONTRACT.page_about },
  { label: "Контакты", route: PAGE_ROUTE_CONTRACT.page_contacts },
  { label: "Правовая информация", route: PAGE_ROUTE_CONTRACT.page_legal },
] as const;

export default async function ResponsiveQaPage({
  searchParams,
}: {
  searchParams: Promise<{
    route?: string | string[];
    surface?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawRoute = query.route;
  const requestedRoute = Array.isArray(rawRoute) ? rawRoute[0] : rawRoute;
  const rawSurface = query.surface;
  const requestedSurface = Array.isArray(rawSurface) ? rawSurface[0] : rawSurface;
  const selectedPage = requestedSurface === "admin"
    ? { label: "Конструктор страниц", route: "/admin/pages/page_home/" }
    : pages.find((page) => page.route === requestedRoute) ?? pages[0];
  const access = await loadAccess();
  if (!access.ok) {
    return (
      <AccessPanel
        title={access.title}
        message={access.message}
        signInHref={access.signInHref}
      />
    );
  }
  return (
    <main className="responsive-qa">
      <header>
        <p className="admin-kicker">NS—ARS / INTERNAL QA</p>
        <h1>Матрица адаптивности</h1>
        <p>
          Каждая рамка — самостоятельный viewport выбранной страницы. Этот
          маршрут закрыт авторизацией и не входит в публичную карту сайта.
        </p>
      </header>
      <nav className="responsive-qa-pages" aria-label="Страницы QA">
        {pages.map((page) => (
          <Link
            href={`/qa-responsive/?route=${encodeURIComponent(page.route)}`}
            aria-current={page.route === selectedPage.route ? "page" : undefined}
            key={page.route}
          >
            {page.label}
          </Link>
        ))}
        <Link
          href="/qa-responsive/?surface=admin"
          aria-current={requestedSurface === "admin" ? "page" : undefined}
        >
          Конструктор страниц
        </Link>
      </nav>
      <div className="responsive-qa-list">
        {viewports.map((width) => (
          <section key={width} aria-labelledby={`viewport-${width}`}>
            <h2 id={`viewport-${width}`}>
              {selectedPage.label} · {width} px
            </h2>
            <div className="responsive-qa-scroll">
              <iframe
                title={`${selectedPage.label} — ${width} px`}
                src={`${selectedPage.route}?qa_frame=1&viewport=${width}`}
                style={{ width, height: width <= 390 ? 780 : 900 }}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

async function loadAccess() {
  try {
    authorizeAdmin(new Headers(await headers()));
    return { ok: true as const };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return {
        ok: false as const,
        title: error.status === 401 ? "Требуется вход" : "Доступ закрыт",
        message: error.message,
        signInHref:
          error.status === 401
            ? adminLoginPath("/qa-responsive/")
            : undefined,
      };
    }
    return {
      ok: false as const,
      title: "QA-стенд недоступен",
      message: "Внутренний responsive-контур не запущен.",
      signInHref: undefined,
    };
  }
}
