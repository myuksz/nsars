"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, MediaCard } from "@/components/admin-media-card";
import type { MediaItem, MediaMetadataUpdate } from "@/lib/media-contract";

type MediaPayload = {
  media?: MediaItem[];
  notice?: string;
  error?: string;
  details?: string[];
};

export function AdminMediaManager({
  initialMedia,
  actorLabel,
}: {
  initialMedia: MediaItem[];
  actorLabel: string;
}) {
  const [media, setMedia] = useState(initialMedia);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Медиатека открыта отдельно от страниц.");
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy("upload");
    setError(null);
    try {
      const response = await fetch("/api/admin/media/", {
        method: "POST",
        body: new FormData(form),
      });
      const payload = (await response.json()) as MediaPayload;
      if (!response.ok || !payload.media) throw payloadError(payload, "Файл не загружен.");
      setMedia(payload.media);
      setNotice(payload.notice ?? "Файл загружен.");
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Неизвестная ошибка.");
    } finally {
      setBusy(null);
    }
  }

  async function save(id: string, metadata: MediaMetadataUpdate) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/media/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, metadata }),
      });
      const payload = (await response.json()) as MediaPayload;
      if (!response.ok || !payload.media) throw payloadError(payload, "Файл не сохранён.");
      setMedia(payload.media);
      setNotice(payload.notice ?? "Метаданные сохранены.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Неизвестная ошибка.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">NS—ARS / РЕДАКЦИЯ</p>
          <h1>Медиатека</h1>
        </div>
        <div className="admin-top-actions">
          <span className="admin-actor">{actorLabel}</span>
          <Link href="/admin/pages/page_home/">Страницы</Link>
          <Link href="/admin/menu/">Меню сайта</Link>
          <form className="admin-logout-form" action="/api/admin/auth/logout/" method="post">
            <button className="admin-logout-button" type="submit">Выйти</button>
          </form>
        </div>
      </header>
      <nav className="admin-global-tabs" aria-label="Разделы конструктора">
        <Link href="/admin/pages/page_home/">Страницы</Link>
        <Link href="/admin/menu/">Меню сайта</Link>
        <Link className="is-current" href="/admin/media/" aria-current="page">Медиатека</Link>
      </nav>
      <main className="admin-standalone">
        <section className="editor-section">
          <header><h2>Загрузка</h2></header>
          <form className="editor-fields media-upload-form" onSubmit={upload}>
            <Field label="Изображение JPG, PNG или WebP — до 20 МБ">
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
            </Field>
            <Field label="Альтернативный текст — что изображено">
              <input name="alt" required maxLength={220} />
            </Field>
            <Field label="Подпись — необязательно">
              <input name="caption" maxLength={300} />
            </Field>
            <button className="admin-secondary" type="submit" disabled={busy !== null}>
              {busy === "upload" ? "Загружаю…" : "Загрузить в черновик"}
            </button>
            <p className="field-help">Новый файл закрыт от публичного сайта до проверки прав, копии и готовности.</p>
          </form>
        </section>
        <div className="admin-message" aria-live="polite">
          {error ? <p className="is-error">{error}</p> : <p>{notice}</p>}
        </div>
        {media.length === 0 ? (
          <p className="field-help">Медиатека пока пуста.</p>
        ) : (
          <div className="media-library-grid standalone-media-grid">
            {media.map((item) => (
              <MediaCard
                key={`${item.id}-${item.version}`}
                item={item}
                busy={busy === item.id}
                onSave={(metadata) => save(item.id, metadata)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function payloadError(payload: MediaPayload, fallback: string) {
  return new Error(
    [payload.error, ...(payload.details ?? [])].filter(Boolean).join(" ") || fallback,
  );
}
