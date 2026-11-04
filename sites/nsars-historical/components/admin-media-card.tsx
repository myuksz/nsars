"use client";

import { useState, type ReactNode } from "react";
import type { MediaItem, MediaMetadataUpdate } from "@/lib/media-contract";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}

export function MediaCard({ item, busy, onSave }: {
  item: MediaItem;
  busy: boolean;
  onSave: (metadata: MediaMetadataUpdate) => void;
}) {
  const [draft, setDraft] = useState<MediaMetadataUpdate>({
    alt: item.alt,
    caption: item.caption,
    fitMode: item.fitMode,
    focalX: item.focalX,
    focalY: item.focalY,
    rightsStatus: item.rightsStatus,
    rightsScope: item.rightsScope,
    lifecycle: item.lifecycle,
    recoveryStatus: item.recoveryStatus,
  });
  return (
    <article className="media-card">
      <div className="media-card-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${encodeURIComponent(item.id)}/?preview=1`} alt="" style={{ objectFit: draft.fitMode, objectPosition: `${draft.focalX * 100}% ${draft.focalY * 100}%` }} />
      </div>
      <div className="media-card-meta"><strong>{item.name}</strong><span>{item.width}×{item.height} · {(item.byteSize / 1_000_000).toFixed(2)} МБ</span><code>{item.id}</code></div>
      <Field label="Альтернативный текст"><input value={draft.alt} maxLength={220} onChange={(event) => setDraft({ ...draft, alt: event.target.value })} /></Field>
      <Field label="Подпись"><input value={draft.caption} maxLength={300} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} /></Field>
      <div className="field-grid">
        <Field label="Кадрирование"><select value={draft.fitMode} onChange={(event) => setDraft({ ...draft, fitMode: event.target.value as MediaMetadataUpdate["fitMode"] })}><option value="cover">Заполнять</option><option value="contain">Показывать целиком</option></select></Field>
        <Field label="Фокус X, %"><input type="range" min={0} max={100} value={Math.round(draft.focalX * 100)} onChange={(event) => setDraft({ ...draft, focalX: Number(event.target.value) / 100 })} /></Field>
        <Field label="Фокус Y, %"><input type="range" min={0} max={100} value={Math.round(draft.focalY * 100)} onChange={(event) => setDraft({ ...draft, focalY: Number(event.target.value) / 100 })} /></Field>
      </div>
      <Field label="Статус прав"><select value={draft.rightsStatus} onChange={(event) => { const rightsStatus = event.target.value as MediaMetadataUpdate["rightsStatus"]; setDraft({ ...draft, rightsStatus, lifecycle: rightsStatus === "REVOKED" ? "ARCHIVED" : draft.lifecycle === "READY" && rightsStatus !== "APPROVED" ? "DRAFT" : draft.lifecycle }); }}><option value="NOT_GRANTED">Не подтверждены</option><option value="APPROVED">Подтверждены</option><option value="REVOKED">Отозваны</option></select></Field>
      <Field label="Основание и объём прав"><textarea rows={3} value={draft.rightsScope} maxLength={500} onChange={(event) => setDraft({ ...draft, rightsScope: event.target.value })} /></Field>
      <div className="field-grid">
        <Field label="Независимая копия"><select value={draft.recoveryStatus} onChange={(event) => { const recoveryStatus = event.target.value as MediaMetadataUpdate["recoveryStatus"]; setDraft({ ...draft, recoveryStatus, lifecycle: recoveryStatus === "PENDING_INDEPENDENT_COPY" && draft.lifecycle === "READY" ? "DRAFT" : draft.lifecycle }); }}><option value="PENDING_INDEPENDENT_COPY">Не проверена</option><option value="VERIFIED_INDEPENDENT_COPY">Проверена</option></select></Field>
        <Field label="Готовность"><select value={draft.lifecycle} onChange={(event) => setDraft({ ...draft, lifecycle: event.target.value as MediaMetadataUpdate["lifecycle"] })}><option value="DRAFT">Черновик</option><option value="READY">Готов к публикации</option><option value="ARCHIVED">Архив</option></select></Field>
      </div>
      <button type="button" className="admin-secondary" disabled={busy} onClick={() => onSave(draft)}>{busy ? "Сохраняю…" : "Сохранить файл"}</button>
      <p className="field-help">Публикация доступна только для связки: права подтверждены + копия проверена + READY.</p>
    </article>
  );
}
