import type { Metadata } from "next";
import Link from "next/link";
import { adminReturnPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Вход в конструктор — NS-ARS",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const rawError = Array.isArray(query.error) ? query.error[0] : query.error;
  const next = adminReturnPath(rawNext);
  const error = loginErrorMessage(rawError);

  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="login-title">
        <p className="admin-kicker">NS—ARS / КОНСТРУКТОР</p>
        <h1 id="login-title">Вход</h1>
        <p>Используйте вашу электронную почту и пароль от конструктора сайта.</p>
        <form className="admin-login-form" action="/api/admin/auth/login/" method="post">
          <input type="hidden" name="next" value={next} />
          <label className="admin-field">
            <span>Электронная почта</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              maxLength={254}
            />
          </label>
          <label className="admin-field">
            <span>Пароль</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          {error ? <p className="admin-login-error" role="alert">{error}</p> : null}
          <button className="admin-primary" type="submit">Войти</button>
        </form>
        <Link className="admin-text-link" href="/">На главную</Link>
      </section>
    </main>
  );
}

function loginErrorMessage(code: string | undefined) {
  if (code === "locked") {
    return "Вход временно заблокирован после нескольких неудачных попыток. Повторите позже.";
  }
  if (code === "unavailable") {
    return "Система входа временно недоступна. Повторите позже.";
  }
  if (code === "rejected") return "Неверный логин или пароль.";
  return null;
}
