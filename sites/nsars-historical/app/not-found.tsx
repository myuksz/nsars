import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section aria-labelledby="not-found-title">
        <p className="section-index">404 / МАРШРУТ НЕ НАЙДЕН</p>
        <h1 id="not-found-title">ЭТА СТРАНИЦА ВЫШЛА ИЗ КАДРА</h1>
        <p>
          Вернитесь на главную или выберите одно из возрастных направлений.
        </p>
        <div>
          <Link className="editorial-button" href="/">На главную</Link>
          <Link className="editorial-button is-outline" href="/albums/kindergarten/">
            Направления
          </Link>
        </div>
      </section>
      <div className="not-found-art" aria-hidden="true">404</div>
    </main>
  );
}
