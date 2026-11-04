import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- Published media is already sanitized and gated by the app-owned media route. */
import type { CSSProperties, ReactNode } from "react";
import {
  composerShell,
  type ComposerBlock,
  type ComposerPageDocument,
} from "@/lib/composer-contract";
import type { MediaItem } from "@/lib/media-contract";
import type { PublicNavigation } from "@/lib/navigation-contract";

type PageRendererProps = {
  document: ComposerPageDocument;
  mode?: "published" | "preview";
  contentSource?: string;
  mediaItems?: MediaItem[];
  navigation: PublicNavigation;
};

export type RenderableMedia = Pick<
  MediaItem,
  "id" | "alt" | "caption" | "width" | "height" | "fitMode" | "focalX" | "focalY"
>;

export function PageRenderer({
  document,
  mode = "published",
  mediaItems = [],
  navigation,
}: PageRendererProps) {
  const shell = composerShell(document);
  const safeMedia = projectRenderableMedia(mediaItems, mode);
  const visibleBlocks = document.blocks.filter((block) => !block.hidden);
  const showSiteChrome = shell === "SITE";
  const heroStartsDocument = visibleBlocks[0]?.type === "F01";

  return (
    <div
      className={`site-shell composer-site composer-shell-${shell.toLowerCase()} page-${document.pageId.replace("page_", "")}`}
      id="top"
      data-page-id={document.pageId}
      data-page-type={document.pageType}
      data-render-mode={mode}
    >
      <a className="skip-link" href="#main-content">К содержанию</a>
      {mode === "preview" ? (
        <div className="preview-ribbon" role="status">
          <strong>Предпросмотр черновика</strong>
          <span>Эта версия не опубликована.</span>
          <Link href={`/admin/pages/${encodeURIComponent(document.pageId)}/`}>Вернуться в конструктор</Link>
        </div>
      ) : null}
      {showSiteChrome ? (
        <>
          <header className="masthead" aria-label="Шапка сайта">
            <Link className="masthead-home" href="/" aria-label="Дом детской фотографии, главная">Дом детской фотографии</Link>
            <nav className="masthead-nav" aria-label="Основные разделы">
              {navigation.primary.map((item) => (
                <GlobalLink href={item.href} currentRoute={document.route} key={item.itemId}>{item.label}</GlobalLink>
              ))}
            </nav>
          </header>
          {navigation.age.length ? (
            <nav className="age-nav" aria-label="Возрастные направления">
              <span>ВЫБРАТЬ ВОЗРАСТ</span>
              {navigation.age.map((item) => (
                <GlobalLink href={item.href} currentRoute={document.route} key={item.itemId}>{item.label}</GlobalLink>
              ))}
            </nav>
          ) : null}
        </>
      ) : null}
      <main id="main-content" className="composer-public-canvas">
        {!heroStartsDocument ? <h1 className="sr-only">{document.title}</h1> : null}
        {visibleBlocks.length ? visibleBlocks.map((block, index) => (
          <ComposerBlockView key={block.blockId} block={block} mediaItems={safeMedia} mode={mode} pageId={document.pageId} pageBlocks={visibleBlocks} primaryHeading={heroStartsDocument && index === 0} />
        )) : <section className="composer-empty-page" aria-label="Пустая страница" />}
      </main>
      {showSiteChrome ? <SiteFooter navigation={navigation.footer} /> : null}
    </div>
  );
}

export function ComposerBlockView({
  block,
  mediaItems,
  mode,
  pageId = "page_custom",
  editor = false,
  primaryHeading = false,
  pageBlocks = [],
}: {
  block: ComposerBlock;
  mediaItems: RenderableMedia[];
  mode: "published" | "preview";
  pageId?: string;
  editor?: boolean;
  primaryHeading?: boolean;
  pageBlocks?: ComposerBlock[];
}) {
  const classes = [
    "composer-block",
    `composer-block-${block.type.toLowerCase()}`,
    `composer-width-${block.layout.width}`,
    `composer-align-${block.layout.align}`,
    `composer-tone-${block.layout.tone}`,
    `composer-space-top-${block.layout.spacingTop}`,
    `composer-space-bottom-${block.layout.spacingBottom}`,
    block.layout.fullBleed ? "composer-full-bleed" : "",
    block.responsive.hideDesktop ? "composer-hide-desktop" : "",
    block.responsive.hideTablet ? "composer-hide-tablet" : "",
    block.responsive.hideMobile ? "composer-hide-mobile" : "",
    `composer-mobile-align-${block.responsive.mobileAlign}`,
  ].filter(Boolean).join(" ");
  return (
    <section id={`section-${block.blockId}`} className={classes} data-block-type={block.type} data-block-id={editor ? block.blockId : undefined}>
      <div className="composer-block-inner">
        <BlockContent block={block} mediaItems={mediaItems} mode={mode} pageId={pageId} pageBlocks={pageBlocks} editor={editor} primaryHeading={primaryHeading} />
      </div>
    </section>
  );
}

function BlockContent({ block, mediaItems, mode, pageId, pageBlocks, editor, primaryHeading }: {
  block: ComposerBlock;
  mediaItems: RenderableMedia[];
  mode: "published" | "preview";
  pageId: string;
  pageBlocks: ComposerBlock[];
  editor: boolean;
  primaryHeading: boolean;
}) {
  const data = block.data;
  const title = stringValue(data.title);
  const body = stringValue(data.body);
  switch (block.type) {
    case "F01":
      const HeroHeading = primaryHeading ? "h1" : "h2";
      return (
        <div className="hero composer-hero">
          <div className="hero-copy">
            <p className="eyebrow">{stringValue(data.eyebrow)}</p>
            <HeroHeading>{title}</HeroHeading>
            {stringValue(data.accent) ? <p className="hero-accent">{stringValue(data.accent)}</p> : null}
            {body ? <p className="hero-body">{body}</p> : null}
            <ActionLink href={stringValue(data.actionHref)} label={stringValue(data.actionLabel)} editor={editor} />
          </div>
          <EditorialArt label={title || pageId} />
        </div>
      );
    case "F02":
      return (
        <div className="manifesto composer-text-block">
          <div>{stringValue(data.kicker) ? <p className="section-index">{stringValue(data.kicker)}</p> : null}{title ? <h2>{title}</h2> : null}</div>
          <div className="manifesto-copy">{paragraphs(body).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        </div>
      );
    case "F03":
      return <SingleImage title={title} body={body} items={resolveMedia(data.mediaIds, mediaItems)} mode={mode} />;
    case "F04":
      return <div className={`composer-split ${Boolean(data.reverse) ? "is-reversed" : ""}`}><MediaFigure item={resolveMedia(data.mediaIds, mediaItems)[0]} mode={mode} /><div className="composer-copy"><BlockHeading title={title} body={body} /></div></div>;
    case "F05":
      return <div className="media-section smart-gallery"><BlockHeading title={title} body={body} /><div className={`gallery-grid gallery-${safeToken(data.layout, "grid")}`}>{resolveMedia(data.mediaIds, mediaItems).map((item) => <MediaFigure key={item.id} item={item} mode={mode} link={Boolean(data.lightbox) && !editor} />)}</div></div>;
    case "F06":
      return <div className="media-section composer-slider"><BlockHeading title={title} body={body} /><div className="composer-slider-track" role="list" aria-label={title || "Фотосерия"}>{resolveMedia(data.mediaIds, mediaItems).map((item) => <div role="listitem" key={item.id}><MediaFigure item={item} mode={mode} /></div>)}</div></div>;
    case "F07":
      return <div className="composer-video"><MediaFigure item={resolveMedia(data.mediaIds, mediaItems)[0]} mode={mode} /><div className="composer-copy"><BlockHeading title={title} body={body} /><ExternalVideoLink value={stringValue(data.videoUrl)} editor={editor} /></div></div>;
    case "F08":
      return <CardGrid title={title} items={stringList(data.items)} editor={editor} />;
    case "F09":
      return <ProcessList title={title} items={stringList(data.items)} />;
    case "F10":
      return <MetricGrid title={title} items={stringList(data.items)} />;
    case "F11":
      return <PackageGrid title={title} items={stringList(data.items)} />;
    case "F12":
      return <Reviews title={title} items={stringList(data.items)} />;
    case "F13":
      return <Faq title={title} items={stringList(data.items)} />;
    case "F14":
      return <div className="composer-banner"><BlockHeading title={title} body={body} /><ActionLink href={stringValue(data.actionHref)} label={stringValue(data.actionLabel)} editor={editor} /></div>;
    case "F15":
      return <HonestForm title={title} body={body} fields={stringList(data.items)} submitLabel={stringValue(data.submitLabel)} />;
    case "F16":
      return <Contacts title={title} body={body} items={stringList(data.items)} editor={editor} />;
    case "F17":
      return <FileBlock title={title} body={body} item={resolveMedia(data.mediaIds, mediaItems)[0]} enabled={Boolean(data.downloadEnabled)} mode={mode} editor={editor} />;
    case "F18":
      return <SpreadLayout title={title} body={body} data={data} mediaItems={mediaItems} mode={mode} />;
    case "F19":
      return <TypedWidget title={title} body={body} widgetType={stringValue(data.widgetType)} currentBlockId={block.blockId} pageBlocks={pageBlocks} editor={editor} mode={mode} />;
    case "F20":
      return <StructuralRow title={title} data={data} mediaItems={mediaItems} mode={mode} pageId={pageId} pageBlocks={pageBlocks} editor={editor} />;
    case "F21":
      return <Divider title={title} body={body} styleName={stringValue(data.dividerStyle)} />;
    default:
      return null;
  }
}

function BlockHeading({ title, body }: { title: string; body: string }) {
  if (!title && !body) return null;
  return <header className="composer-heading">{title ? <h2>{title}</h2> : null}{body ? <p>{body}</p> : null}</header>;
}

function SingleImage({ title, body, items, mode }: { title: string; body: string; items: RenderableMedia[]; mode: "published" | "preview" }) {
  return <div className="composer-single-image"><BlockHeading title={title} body={body} /><MediaFigure item={items[0]} mode={mode} /></div>;
}

function MediaFigure({ item, mode, link = false }: { item?: RenderableMedia; mode: "published" | "preview"; link?: boolean }) {
  if (!item) return mode === "published" ? null : <div className="composer-media-placeholder" aria-label="Место для фотографии"><span>ФОТОГРАФИЯ</span></div>;
  const image = <img src={mediaSource(item.id, mode)} alt={item.alt} width={item.width} height={item.height} loading="lazy" style={{ objectFit: item.fitMode, objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }} />;
  return <figure>{link ? <a href={mediaSource(item.id, mode)} target="_blank" rel="noreferrer">{image}</a> : image}{item.caption ? <figcaption>{item.caption}</figcaption> : null}</figure>;
}

function CardGrid({ title, items, editor }: { title: string; items: string[]; editor: boolean }) {
  return <div className="directions composer-cards"><BlockHeading title={title} body="" /><div className="direction-grid">{items.map((value, index) => { const [cardTitle, cardBody, href] = splitItem(value); const linked = safeInternalHref(href) && !editor; const content = <><span>{String(index + 1).padStart(2, "0")}</span><h3>{cardTitle}</h3><p>{cardBody}</p>{linked ? <i aria-hidden="true">↗</i> : null}</>; return linked ? <Link className={`direction-card card-${(index % 3) + 1}`} href={href} key={index}>{content}</Link> : <article className={`direction-card card-${(index % 3) + 1}`} key={index}>{content}</article>; })}</div></div>;
}

function ProcessList({ title, items }: { title: string; items: string[] }) {
  return <div className="process composer-process"><div className="section-heading-row"><p className="section-index">ПРОЦЕСС</p><h2>{title}</h2></div><ol className="process-grid">{items.map((value, index) => { const [itemTitle, itemBody] = splitItem(value); return <li key={index}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><h3>{itemTitle}</h3><p>{itemBody}</p></li>; })}</ol></div>;
}

function MetricGrid({ title, items }: { title: string; items: string[] }) {
  return <div className="composer-metrics"><BlockHeading title={title} body="" /><div>{items.map((value, index) => { const [number, label] = splitItem(value); return <article key={index}><strong>{number}</strong><span>{label}</span></article>; })}</div></div>;
}

function PackageGrid({ title, items }: { title: string; items: string[] }) {
  return <div className="composer-packages"><BlockHeading title={title} body="" /><div>{items.map((value, index) => { const [name, detail, price] = splitItem(value); return <article key={index}><p className="section-index">ВАРИАНТ {String(index + 1).padStart(2, "0")}</p><h3>{name}</h3><p>{detail}</p>{price ? <strong>{price}</strong> : null}</article>; })}</div></div>;
}

function Reviews({ title, items }: { title: string; items: string[] }) {
  return <div className="composer-reviews"><BlockHeading title={title} body="" /><div>{items.map((value, index) => { const [name, quote, source] = splitItem(value); return <figure key={index}><blockquote>{quote}</blockquote><figcaption><strong>{name}</strong>{source ? ` · ${source}` : ""}</figcaption></figure>; })}</div></div>;
}

function Faq({ title, items }: { title: string; items: string[] }) {
  return <div className="composer-faq"><BlockHeading title={title} body="" />{items.map((value, index) => { const [question, answer] = splitItem(value); return <details key={index}><summary>{question}</summary><p>{answer}</p></details>; })}</div>;
}

function HonestForm({ title, body, fields, submitLabel }: { title: string; body: string; fields: string[]; submitLabel: string }) {
  return <div className="composer-form-block"><BlockHeading title={title} body={body} /><form aria-label={title || "Форма"}>{fields.map((label, index) => <label key={index}><span>{label}</span><input type="text" disabled aria-disabled="true" /></label>)}<button type="button" disabled>{submitLabel || "Отправить"}</button><p className="composer-form-status">Форма будет включена только после проверки получателя и правил обработки данных.</p></form></div>;
}

function Contacts({ title, body, items, editor }: { title: string; body: string; items: string[]; editor: boolean }) {
  return <div className="composer-contacts"><BlockHeading title={title} body={body} /><div>{items.map((value, index) => { const [label, display, href] = splitItem(value); return <article key={index}><span>{label}</span>{safeContactHref(href) && !editor ? <a href={href}>{display}</a> : <strong>{display}</strong>}</article>; })}</div></div>;
}

function FileBlock({ title, body, item, enabled, mode, editor }: { title: string; body: string; item?: RenderableMedia; enabled: boolean; mode: "published" | "preview"; editor: boolean }) {
  return <div className="composer-file"><BlockHeading title={title} body={body} />{item && enabled && !editor ? <a className="editorial-button" href={mediaSource(item.id, mode)} download>Скачать материал</a> : <p>Скачивание не открыто.</p>}</div>;
}

function SpreadLayout({ title, body, data, mediaItems, mode }: { title: string; body: string; data: Record<string, unknown>; mediaItems: RenderableMedia[]; mode: "published" | "preview" }) {
  const backgroundId = typeof data.backgroundMediaId === "string" ? data.backgroundMediaId : "";
  const background = mediaItems.find((item) => item.id === backgroundId);
  const windows = Array.isArray(data.photoWindows) ? data.photoWindows.filter(isRecord).slice(0, 4) : [];
  return <div className="composer-spread"><BlockHeading title={title} body={body} /><div className="composer-spread-stage">{background ? <MediaFigure item={background} mode={mode} /> : mode === "preview" ? <div className="composer-media-placeholder"><span>МАКЕТ РАЗВОРОТА</span></div> : null}{windows.map((windowValue, index) => { const media = resolveMedia(windowValue.mediaIds, mediaItems)[0]; return <div className="composer-photo-window" style={quadStyle(windowValue.quad)} key={String(windowValue.windowId ?? index)}><MediaFigure item={media} mode={mode} /></div>; })}</div></div>;
}

function TypedWidget({ title, body, widgetType, currentBlockId, pageBlocks, editor, mode }: { title: string; body: string; widgetType: string; currentBlockId: string; pageBlocks: ComposerBlock[]; editor: boolean; mode: "published" | "preview" }) {
  const links = widgetLinks(widgetType, currentBlockId, pageBlocks);
  if (!links.length && mode === "published") return null;
  return <div className="composer-widget"><BlockHeading title={title} body={body} />{links.length ? <nav aria-label={title || "Навигатор"}>{links.map(([label, href]) => editor ? <span key={href}>{label}</span> : <Link href={href} key={href}>{label}</Link>)}</nav> : <p className="composer-widget-state">Модуль «{widgetLabel(widgetType)}» настраивается.</p>}</div>;
}

function StructuralRow({ title, data, mediaItems, mode, pageId, pageBlocks, editor }: { title: string; data: Record<string, unknown>; mediaItems: RenderableMedia[]; mode: "published" | "preview"; pageId: string; pageBlocks: ComposerBlock[]; editor: boolean }) {
  const safeColumns = Math.min(4, Math.max(1, Math.round(numberValue(data.columns, 2))));
  const slots = Array.isArray(data.slots) ? data.slots.filter(isRecord).slice(0, safeColumns) : [];
  return <div className="composer-row"><BlockHeading title={title} body="" /><div style={{ "--composer-columns": safeColumns } as CSSProperties}>{slots.map((slot, index) => { const blocks = Array.isArray(slot.blocks) ? slot.blocks.filter(isComposerBlock).filter((child) => !child.hidden) : []; return <article key={String(slot.slotId ?? index)}><p className="section-index">{String(slot.label ?? `Колонка ${index + 1}`)}</p>{blocks.map((child) => <ComposerBlockView key={child.blockId} block={child} mediaItems={mediaItems} mode={mode} pageId={pageId} pageBlocks={pageBlocks} editor={editor} />)}</article>; })}</div></div>;
}

function Divider({ title, body, styleName }: { title: string; body: string; styleName: string }) {
  return <div className={`composer-divider composer-divider-${safeToken(styleName, "chapter")}`}>{title ? <h2>{title}</h2> : null}{body ? <p>{body}</p> : null}</div>;
}

function ActionLink({ href, label, editor }: { href: string; label: string; editor: boolean }) {
  if (!label) return null;
  return safeInternalHref(href) && !editor ? <Link className="editorial-button" href={href}>{label}</Link> : <span className="editorial-button is-disabled" aria-disabled="true">{label}</span>;
}

function ExternalVideoLink({ value, editor }: { value: string; editor: boolean }) {
  if (!safeVideoHref(value)) return value ? <p className="composer-video-status">Ссылка на видео требует разрешённого источника.</p> : null;
  return editor ? <span className="editorial-button is-disabled">Открыть видео</span> : <a className="editorial-button" href={value} target="_blank" rel="noreferrer">Открыть видео</a>;
}

function EditorialArt({ label }: { label: string }) {
  const words = label.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 3);
  return <div className="hero-art" aria-hidden="true"><div className="art-frame art-frame-one"><span className="art-sun" /><span className="art-line" /><span className="art-cutout" /></div><div className="art-frame art-frame-two"><span className="art-grid" /><span className="art-dot" /><span className="art-type">{words.map((word) => <span key={word}>{word}<br /></span>)}</span></div><span className="scribble">*</span></div>;
}

function SiteFooter({ navigation }: { navigation: PublicNavigation["footer"] }) {
  return <footer className="site-footer"><p className="footer-brand">NS—ARS / ДОМ ДЕТСКОЙ ФОТОГРАФИИ АРСЮТКИНОЙ НАТАЛИИ</p><nav aria-label="Навигация в подвале">{navigation.map((item) => <Link href={item.href} key={item.itemId}>{item.label}</Link>)}</nav><p className="footer-year">© {new Date().getUTCFullYear()}</p></footer>;
}

function GlobalLink({ href, currentRoute, children }: { href: string; currentRoute: string; children: ReactNode }) {
  return <Link href={href} aria-current={href === currentRoute ? "page" : undefined}>{children}</Link>;
}

export function projectRenderableMedia(items: MediaItem[], mode: "published" | "preview"): RenderableMedia[] {
  return items.flatMap((item) => {
    if (mode === "published" && (item.lifecycle !== "READY" || item.rightsStatus !== "APPROVED" || item.recoveryStatus !== "VERIFIED_INDEPENDENT_COPY")) return [];
    return [{ id: item.id, alt: item.alt, caption: item.caption, width: item.width, height: item.height, fitMode: item.fitMode, focalX: item.focalX, focalY: item.focalY }];
  });
}

function resolveMedia(value: unknown, mediaItems: RenderableMedia[]): RenderableMedia[] {
  const ids = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];
  const byId = new Map(mediaItems.map((item) => [item.id, item]));
  return ids.flatMap((id) => { const item = byId.get(id); return item ? [item] : []; });
}

function mediaSource(id: string, mode: "published" | "preview") {
  return `/api/media/${encodeURIComponent(id)}/${mode === "preview" ? "?preview=1" : ""}`;
}

function paragraphs(value: string) { return value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean); }
function splitItem(value: string) { return value.split("|").map((item) => item.trim()); }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function numberValue(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function safeToken(value: unknown, fallback: string) { return typeof value === "string" && /^[a-z0-9_-]+$/i.test(value) ? value : fallback; }
function safeInternalHref(value: string) { return Boolean(value) && (value.startsWith("#") || (/^\/(?![\\/])/.test(value) && !/[\u0000-\u001f\u007f\\]/.test(value))); }
function safeContactHref(value: string) { return safeInternalHref(value) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value) || /^tel:\+?[0-9() -]{7,24}$/.test(value); }
function safeVideoHref(value: string) { try { const url = new URL(value); return url.protocol === "https:" && ["youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "vkvideo.ru", "www.vkvideo.ru"].includes(url.hostname); } catch { return false; } }
function widgetLinks(widgetType: string, currentBlockId: string, pageBlocks: ComposerBlock[]): Array<[string, string]> {
  if (widgetType === "AGE_NAVIGATOR") {
    return [
      ["Детский сад", "/albums/kindergarten/"],
      ["4 класс", "/albums/grade-4/"],
      ["Старшая школа", "/albums/high-school/"],
    ];
  }
  const acceptedTypes = widgetType === "GALLERY_FILTER"
    ? new Set(["F05"])
    : widgetType === "REVIEWS_FILTER"
      ? new Set(["F12"])
      : null;
  return pageBlocks.flatMap((block) => {
    if (block.blockId === currentBlockId || block.hidden || block.type === "F19") return [];
    if (acceptedTypes && !acceptedTypes.has(block.type)) return [];
    const label = stringValue(block.data.title).trim();
    return label ? [[label, `#section-${block.blockId}`] as [string, string]] : [];
  });
}
function widgetLabel(value: string) { return ({ ANCHOR_NAV: "оглавление", GALLERY_FILTER: "фильтр галереи", BLOG_CATEGORIES: "категории блога", REVIEWS_FILTER: "фильтр отзывов" } as Record<string, string>)[value] ?? "виджет"; }

function quadStyle(value: unknown): CSSProperties {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isRecord)) return {};
  const points = value.map((point) => ({ x: clamp(Number(point.x)), y: clamp(Number(point.y)) }));
  const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
  const left = Math.min(...xs); const top = Math.min(...ys);
  const width = Math.max(0.08, Math.max(...xs) - left); const height = Math.max(0.08, Math.max(...ys) - top);
  const polygon = points.map((point) => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`).join(", ");
  return { left: `${left * 100}%`, top: `${top * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`, clipPath: `polygon(${polygon})` };
}

function clamp(value: number) { return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isComposerBlock(value: unknown): value is ComposerBlock { return isRecord(value) && typeof value.blockId === "string" && typeof value.type === "string" && isRecord(value.data) && isRecord(value.layout) && isRecord(value.responsive); }
