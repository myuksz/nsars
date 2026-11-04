"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  InteractivePageLayoutData,
  MixedSliderData,
  PhotoWindow,
} from "@/lib/page-contract";
import type { MediaItem } from "@/lib/media-contract";

type RenderMode = "published" | "preview";

export function MixedSlider({
  data,
  mediaItems,
  mode,
}: {
  data: MixedSliderData;
  mediaItems: MediaItem[];
  mode: RenderMode;
}) {
  const items = useMemo(
    () => resolveMedia(data.mediaIds, mediaItems, mode),
    [data.mediaIds, mediaItems, mode],
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  function goTo(index: number) {
    const safe = (index + items.length) % items.length;
    const target = trackRef.current?.children.item(safe) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActive(safe);
  }

  useEffect(() => {
    if (data.intervalSeconds < 3 || paused || items.length < 2) return;
    const timer = window.setInterval(
      () => setActive((current) => {
        const next = (current + 1) % items.length;
        const target = trackRef.current?.children.item(next) as HTMLElement | null;
        target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        return next;
      }),
      data.intervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [data.intervalSeconds, items.length, paused]);

  if (items.length === 0) return null;
  const showArrows = data.controls.includes("arrows");
  const showDots = data.controls.includes("dots");
  return (
    <section
      className={`media-section mixed-slider frame-${data.framePolicy}`}
      aria-roledescription="карусель"
      aria-label={data.heading}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <header className="media-heading">
        <p className="section-index">ФОТО / СЕРИЯ</p>
        <div>
          <h2>{data.heading}</h2>
          <p>{data.body}</p>
        </div>
      </header>
      <div className="slider-stage">
        {showArrows && items.length > 1 ? (
          <button type="button" className="slider-arrow is-prev" onClick={() => goTo(active - 1)} aria-label="Предыдущий кадр">←</button>
        ) : null}
        <div className="slider-track" ref={trackRef}>
          {items.map((item, index) => (
            <figure key={item.id} aria-label={`${index + 1} из ${items.length}`}>
              <div className="slider-frame">
                <img
                  src={mediaSource(item.id, mode)}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  style={imageStyle(item)}
                />
              </div>
              {data.captions && item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
        {showArrows && items.length > 1 ? (
          <button type="button" className="slider-arrow is-next" onClick={() => goTo(active + 1)} aria-label="Следующий кадр">→</button>
        ) : null}
      </div>
      {showDots && items.length > 1 ? (
        <div className="slider-dots" aria-label="Выбор кадра">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={index === active ? "is-active" : ""}
              aria-label={`Кадр ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function InteractivePageLayout({
  data,
  mediaItems,
  mode,
}: {
  data: InteractivePageLayoutData;
  mediaItems: MediaItem[];
  mode: RenderMode;
}) {
  const background = data.backgroundMediaId
    ? resolveMedia([data.backgroundMediaId], mediaItems, mode)[0]
    : undefined;
  if (!background) return null;
  const windows = data.photoWindows
    .map((windowValue) => ({
      windowValue,
      items: resolveMedia(windowValue.mediaIds, mediaItems, mode),
    }))
    .filter((entry) => entry.items.length > 0);
  if (windows.length === 0) return null;
  return (
    <section className="media-section interactive-layout" aria-labelledby="layout-title">
      <header className="media-heading">
        <p className="section-index">ФОТО / МАКЕТ</p>
        <div>
          <h2 id="layout-title">{data.heading}</h2>
          <p>{data.body}</p>
        </div>
      </header>
      <figure className="layout-stage" aria-label={data.accessibleName}>
        <img
          className="layout-background"
          src={mediaSource(background.id, mode)}
          alt=""
          width={background.width}
          height={background.height}
          loading="lazy"
        />
        <div className="layout-overlays" aria-hidden="true">
          {windows.map(({ windowValue, items }) => (
            <RotatingWindow
              key={windowValue.windowId}
              windowValue={windowValue}
              items={items}
              intervalSeconds={data.intervalSeconds}
              mode={mode}
            />
          ))}
        </div>
        <figcaption className="sr-only">
          {windows.map(({ windowValue, items }) => `${windowValue.label}: ${items.map((item) => item.alt).join("; ")}`).join(". ")}
        </figcaption>
      </figure>
    </section>
  );
}

function RotatingWindow({
  windowValue,
  items,
  intervalSeconds,
  mode,
}: {
  windowValue: PhotoWindow;
  items: MediaItem[];
  intervalSeconds: number;
  mode: RenderMode;
}) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (items.length < 2 || intervalSeconds < 3) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % items.length),
      intervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [intervalSeconds, items.length]);
  const item = items[active] ?? items[0];
  return (
    <div className="layout-window" style={quadStyle(windowValue)}>
      <img src={mediaSource(item.id, mode)} alt="" style={imageStyle(item)} />
    </div>
  );
}

function quadStyle(windowValue: PhotoWindow): CSSProperties {
  const xs = windowValue.quad.map((point) => point.x);
  const ys = windowValue.quad.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const polygon = windowValue.quad
    .map((point) => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`)
    .join(", ");
  return {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    clipPath: `polygon(${polygon})`,
  };
}

function resolveMedia(ids: string[], mediaItems: MediaItem[], mode: RenderMode) {
  const byId = new Map(mediaItems.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    if (
      mode === "published" &&
      (item.lifecycle !== "READY" ||
        item.rightsStatus !== "APPROVED" ||
        item.recoveryStatus !== "VERIFIED_INDEPENDENT_COPY")
    ) return [];
    return [item];
  });
}

function imageStyle(item: MediaItem): CSSProperties {
  return {
    objectFit: item.fitMode,
    objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
  };
}

function mediaSource(id: string, mode: RenderMode) {
  return `/api/media/${encodeURIComponent(id)}/${mode === "preview" ? "?preview=1" : ""}`;
}
