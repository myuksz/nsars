import Link from "next/link";

export function AccessPanel({
  title,
  message,
  signInHref,
}: {
  title: string;
  message: string;
  signInHref?: string;
}) {
  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="access-title">
        <p className="admin-kicker">NS—ARS / ЗАКРЫТЫЙ КОНТУР</p>
        <h1 id="access-title">{title}</h1>
        <p>{message}</p>
        {signInHref ? (
          <a className="admin-primary" href={signInHref}>Войти в конструктор</a>
        ) : null}
        <Link className="admin-text-link" href="/">На главную</Link>
      </section>
    </main>
  );
}
