import Link from "next/link";
import type {
  FooterData,
  HeroData,
  InteractivePageLayoutData,
  MixedSliderData,
  PageDocument,
  ProcessData,
  RelatedData,
  RichTextData,
  SliceBlock,
  SmartGalleryData,
} from "@/lib/page-contract";
import type { MediaItem } from "@/lib/media-contract";
import type { PublicNavigation } from "@/lib/navigation-contract";
import { InteractivePageLayout, MixedSlider } from "@/components/media-blocks";

type PageRendererProps = {
  document: PageDocument;
  mode?: "published" | "preview";
  contentSource?: string;
  mediaItems?: MediaItem[];
  navigation: PublicNavigation;
};

export function PageRenderer({
  document,
  mode = "published",
  contentSource = "unknown",
  mediaItems = [],
  navigation,
}: PageRendererProps) {
  const contentBlocks = document.blocks.filter(
    (block) => block.style.visible && block.type !== "nsars.footer",
  );
  const footer = document.blocks.find(
    (block) => block.style.visible && block.type === "nsars.footer",
  );

  return (
    <div
      className={`site-shell page-${document.pageId.replace("page_", "")}`}
      id="top"
      data-page-id={document.pageId}
      data-render-mode={mode}
      data-content-source={contentSource}
    >
      <a className="skip-link" href="#main-content">
        К содержанию
      </a>
      {mode === "preview" ? (
        <div className="preview-ribbon" role="status">
          <strong>Предпросмотр черновика</strong>
          <span>Эта версия не опубликована.</span>
          <Link href={`/admin/pages/${encodeURIComponent(document.pageId)}/`}>
            Вернуться в редактор
          </Link>
        </div>
      ) : null}
      <header className="masthead" aria-label="Шапка сайта">
        <Link className="masthead-home" href="/" aria-label="Дом детской фотографии, главная">
          Дом детской фотографии
        </Link>
        <nav className="masthead-nav" aria-label="Основные разделы">
          {navigation.primary.map((item) => (
            <GlobalLink href={item.href} currentRoute={document.route} key={item.itemId}>
              {item.label}
            </GlobalLink>
          ))}
        </nav>
      </header>
      <nav className="age-nav" aria-label="Возрастные направления">
        <span>ВЫБРАТЬ ВОЗРАСТ</span>
        {navigation.age.map((item) => (
          <GlobalLink href={item.href} currentRoute={document.route} key={item.itemId}>
            {item.label}
          </GlobalLink>
        ))}
      </nav>
      <main id="main-content">
        {contentBlocks.map((block) => (
          <Block
            key={block.blockId}
            block={block}
            pageId={document.pageId}
            mediaItems={mediaItems}
            mode={mode}
          />
        ))}
      </main>
      {footer ? <Footer block={footer} navigation={navigation.footer} /> : null}
    </div>
  );
}

function Block({
  block,
  pageId,
  mediaItems,
  mode,
}: {
  block: SliceBlock;
  pageId: string;
  mediaItems: MediaItem[];
  mode: "published" | "preview";
}) {
  switch (block.type) {
    case "nsars.hero":
      return <Hero data={block.data as HeroData} pageId={pageId} />;
    case "nsars.rich_text":
      return <RichText data={block.data as RichTextData} />;
    case "nsars.process":
      return <Process data={block.data as ProcessData} />;
    case "nsars.related":
      return <Related data={block.data as RelatedData} />;
    case "nsars.smart_gallery":
      return (
        <SmartGallery
          data={block.data as SmartGalleryData}
          mediaItems={mediaItems}
          mode={mode}
        />
      );
    case "nsars.mixed_slider":
      return (
        <MixedSlider
          data={block.data as MixedSliderData}
          mediaItems={mediaItems}
          mode={mode}
        />
      );
    case "nsars.interactive_page_layout":
      return (
        <InteractivePageLayout
          data={block.data as InteractivePageLayoutData}
          mediaItems={mediaItems}
          mode={mode}
        />
      );
    default:
      return null;
  }
}

function SmartGallery({
  data,
  mediaItems,
  mode,
}: {
  data: SmartGalleryData;
  mediaItems: MediaItem[];
  mode: "published" | "preview";
}) {
  const items = resolveMedia(data.mediaIds, mediaItems, mode);
  if (items.length === 0) return null;
  return (
    <section className="media-section smart-gallery" aria-labelledby="gallery-title">
      <MediaHeading heading={data.heading} body={data.body} />
      <div className={`gallery-grid gallery-${data.layout} density-${data.density}`}>
        {items.map((item) => {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSource(item.id, mode)}
              alt={item.alt}
              width={item.width}
              height={item.height}
              loading="lazy"
              style={{
                objectFit: item.fitMode,
                objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
              }}
            />
          );
          return (
            <figure key={item.id}>
              {data.lightbox ? (
                <a
                  className="gallery-lightbox-link"
                  href={mediaSource(item.id, mode)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Открыть крупнее: ${item.alt}`}
                >
                  {image}
                </a>
              ) : image}
              {item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function MediaHeading({ heading, body }: { heading: string; body: string }) {
  return (
    <header className="media-heading">
      <p className="section-index">ФОТО / МАТЕРИАЛЫ</p>
      <div>
        <h2 id="gallery-title">{heading}</h2>
        <p>{body}</p>
      </div>
    </header>
  );
}

function resolveMedia(
  ids: string[],
  mediaItems: MediaItem[],
  mode: "published" | "preview",
) {
  const byId = new Map(mediaItems.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    if (
      mode === "published" &&
      (item.lifecycle !== "READY" ||
        item.rightsStatus !== "APPROVED" ||
        item.recoveryStatus !== "VERIFIED_INDEPENDENT_COPY")
    ) {
      return [];
    }
    return [item];
  });
}

function mediaSource(id: string, mode: "published" | "preview") {
  return `/api/media/${encodeURIComponent(id)}/${mode === "preview" ? "?preview=1" : ""}`;
}

function Hero({ data, pageId }: { data: HeroData; pageId: string }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{data.eyebrow}</p>
        <h1 id="hero-title">{data.title}</h1>
        <p className="hero-accent">{data.accent}</p>
        <p className="hero-body">{data.body}</p>
        {data.primaryCta.state === "enabled" && data.primaryCta.href ? (
          <Link className="editorial-button" href={data.primaryCta.href}>
            {data.primaryCta.label}
          </Link>
        ) : (
          <button
            className="editorial-button is-disabled"
            type="button"
            disabled
          >
            {data.primaryCta.label}
          </button>
        )}
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="art-frame art-frame-one">
          <span className="art-sun" />
          <span className="art-line" />
          <span className="art-cutout" />
        </div>
        <div className="art-frame art-frame-two">
          <span className="art-grid" />
          <span className="art-dot" />
          <span className="art-type">{artLabel(pageId).map((line) => <span key={line}>{line}<br /></span>)}</span>
        </div>
        <span className="scribble">*</span>
      </div>
    </section>
  );
}

function RichText({ data }: { data: RichTextData }) {
  return (
    <section className="manifesto" id="approach" aria-labelledby="approach-title">
      <div>
        <p className="section-index">{cleanSectionLabel(data.kicker)}</p>
        <h2 id="approach-title">{data.heading}</h2>
      </div>
      <div className="manifesto-copy">
        {data.body.map((paragraph, index) => (
          <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

function Process({ data }: { data: ProcessData }) {
  return (
    <section className="process" id="process" aria-labelledby="process-title">
      <div className="section-heading-row">
        <p className="section-index">ПРОЦЕСС</p>
        <h2 id="process-title">{data.heading}</h2>
      </div>
      <ol className="process-grid">
        {data.steps.map((step) => (
          <li key={step.number}>
            <span className="step-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Related({ data }: { data: RelatedData }) {
  return (
    <section
      className="directions"
      id="directions"
      aria-labelledby="directions-title"
    >
      <div className="directions-heading">
        <p className="section-index">ДАЛЬШЕ</p>
        <h2 id="directions-title">{data.heading}</h2>
      </div>
      <div className="direction-grid">
        {data.items.map((item, index) => (
          <Link className={`direction-card card-${index + 1}`} href={item.href} key={item.title}>
            <span>{item.eyebrow}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <i aria-hidden="true">↗</i>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Footer({
  block,
  navigation,
}: {
  block: SliceBlock;
  navigation: PublicNavigation["footer"];
}) {
  const data = block.data as FooterData;
  return (
    <footer className="site-footer">
      <p className="footer-brand">{data.brand}</p>
      <nav aria-label="Навигация в подвале">
        {navigation.map((item) => (
          <Link href={item.href} key={item.itemId}>{item.label}</Link>
        ))}
      </nav>
      <p className="footer-status">{data.legalStatus}</p>
      <p className="footer-year">© {new Date().getUTCFullYear()}</p>
    </footer>
  );
}

function cleanSectionLabel(value: string) {
  return value.replace(/^\s*\d{1,2}\s*\/\s*/, "");
}

function GlobalLink({
  href,
  currentRoute,
  children,
}: {
  href: string;
  currentRoute: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-current={href === currentRoute ? "page" : undefined}>
      {children}
    </Link>
  );
}

function artLabel(pageId: string) {
  const labels: Record<string, string[]> = {
    page_home: ["ЖИВАЯ", "ИСТОРИЯ"],
    page_kindergarten: ["ИГРА", "И ОТКРЫТИЕ"],
    page_grade4: ["СВОЯ", "КОМПАНИЯ"],
    page_highschool: ["СВОЙ", "ГОЛОС"],
    page_gallery: ["РИТМ", "ОТБОРА"],
    page_prices: ["МАСШТАБ", "ИСТОРИИ"],
    page_about: ["СНАЧАЛА", "ЧЕЛОВЕК"],
    page_contacts: ["СНАЧАЛА", "КОНТЕКСТ"],
    page_legal: ["ТОЧНЫЕ", "ОСНОВАНИЯ"],
  };
  return labels[pageId] ?? ["НОВАЯ", "ИСТОРИЯ"];
}
