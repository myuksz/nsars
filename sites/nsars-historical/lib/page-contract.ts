export const SLICE_BLOCK_TYPES = [
  "nsars.hero",
  "nsars.rich_text",
  "nsars.process",
  "nsars.related",
  "nsars.smart_gallery",
  "nsars.mixed_slider",
  "nsars.interactive_page_layout",
  "nsars.footer",
] as const;

export type SliceBlockType = (typeof SLICE_BLOCK_TYPES)[number];
export type PageStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
export type Theme = "paper" | "ink" | "petrol" | "ochre" | "red" | "cobalt";

export type BlockStyle = {
  theme: Theme;
  background: string | null;
  surface: "none" | "paper" | "ink" | "tint";
  contentWidth: "narrow" | "standard" | "wide";
  spacingTop: "none" | "s" | "m" | "l" | "xl";
  spacingBottom: "none" | "s" | "m" | "l" | "xl";
  fullBleed: boolean;
  visible: boolean;
  responsiveOverrides: Record<string, unknown>;
};

export type CtaData = {
  label: string;
  href: string | null;
  state: "enabled" | "disabled";
};

export type HeroData = {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  primaryCta: CtaData;
  secondaryCta: CtaData | null;
  visualMode: "editorial_shapes";
};

export type RichTextData = {
  kicker: string;
  heading: string;
  body: string[];
  alignment: "left" | "split";
};

export type ProcessData = {
  heading: string;
  steps: Array<{ number: string; title: string; body: string }>;
};

export type RelatedData = {
  heading: string;
  items: Array<{ eyebrow: string; title: string; body: string; href: string }>;
};

export type SmartGalleryData = {
  heading: string;
  body: string;
  mediaIds: string[];
  layout: "grid" | "masonry" | "strip";
  density: "calm" | "standard" | "dense";
  lightbox: boolean;
};

export type MixedSliderData = {
  heading: string;
  body: string;
  mediaIds: string[];
  framePolicy: "adaptive" | "landscape" | "portrait";
  captions: boolean;
  controls: "arrows_dots" | "arrows" | "dots";
  intervalSeconds: number;
};

export type QuadPoint = { x: number; y: number };

export type PhotoWindow = {
  windowId: string;
  label: string;
  mediaIds: string[];
  quad: [QuadPoint, QuadPoint, QuadPoint, QuadPoint];
};

export type InteractivePageLayoutData = {
  heading: string;
  body: string;
  backgroundMediaId: string | null;
  photoWindows: PhotoWindow[];
  intervalSeconds: number;
  accessibleName: string;
};

export type FooterData = {
  brand: string;
  navigation: Array<{ label: string; href: string }>;
  legalStatus: string;
};

export type SliceBlock = {
  blockId: string;
  type: SliceBlockType;
  schemaVersion: string;
  position: number;
  data:
    | HeroData
    | RichTextData
    | ProcessData
    | RelatedData
    | SmartGalleryData
    | MixedSliderData
    | InteractivePageLayoutData
    | FooterData;
  style: BlockStyle;
};

export type PageDocument = {
  pageId: string;
  route: string;
  title: string;
  status: PageStatus;
  taxonomies?: {
    age: "none" | "kindergarten" | "grade4" | "highschool";
    visualLine: "none" | "AIR" | "BASE" | "NIGHT";
    package: "none" | "XS" | "M" | "PREMIUM";
    contentType: string;
    lifecycle: string;
  };
  blocks: SliceBlock[];
  seo: {
    title: string;
    description: string;
    indexing: "INDEX" | "NOINDEX";
    canonical: string | null;
  };
};

export type ValidationResult =
  | { ok: true; value: PageDocument }
  | { ok: false; errors: string[] };

export const PAGE_ROUTE_CONTRACT = {
  page_home: "/",
  page_kindergarten: "/albums/kindergarten/",
  page_grade4: "/albums/grade-4/",
  page_highschool: "/albums/high-school/",
  page_gallery: "/gallery/",
  page_prices: "/prices/",
  page_about: "/about/",
  page_contacts: "/contacts/",
  page_legal: "/legal/",
} as const;

export type PublicPageId = keyof typeof PAGE_ROUTE_CONTRACT;

const RESERVED_PUBLIC_SEGMENTS = new Set([
  "admin",
  "api",
  "preview",
  "qa-responsive",
  "robots.txt",
  "sitemap.xml",
  "_next",
]);

const RAW_FIELD_NAMES = new Set([
  "html",
  "css",
  "js",
  "script",
  "classname",
  "dangerouslysetinnerhtml",
]);
const FORBIDDEN_DATA_FIELDS = new Set([
  "video",
  "sourceurl",
  "price",
  "prices",
  "geography",
  "review",
  "reviews",
  "recipient",
  "email",
  "phone",
]);
const THEMES = new Set(["paper", "ink", "petrol", "ochre", "red", "cobalt"]);
const SPACING = new Set(["none", "s", "m", "l", "xl"]);
const WIDTHS = new Set(["narrow", "standard", "wide"]);
const SURFACES = new Set(["none", "paper", "ink", "tint"]);
const STATUSES = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);
const ALLOWED_TYPES = new Set<string>(SLICE_BLOCK_TYPES);

const blockFields: Record<SliceBlockType, readonly string[]> = {
  "nsars.hero": [
    "eyebrow",
    "title",
    "accent",
    "body",
    "primaryCta",
    "secondaryCta",
    "visualMode",
  ],
  "nsars.rich_text": ["kicker", "heading", "body", "alignment"],
  "nsars.process": ["heading", "steps"],
  "nsars.related": ["heading", "items"],
  "nsars.smart_gallery": [
    "heading",
    "body",
    "mediaIds",
    "layout",
    "density",
    "lightbox",
  ],
  "nsars.mixed_slider": [
    "heading",
    "body",
    "mediaIds",
    "framePolicy",
    "captions",
    "controls",
    "intervalSeconds",
  ],
  "nsars.interactive_page_layout": [
    "heading",
    "body",
    "backgroundMediaId",
    "photoWindows",
    "intervalSeconds",
    "accessibleName",
  ],
  "nsars.footer": ["brand", "navigation", "legalStatus"],
};

export function validatePageDocument(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["Документ страницы должен быть объектом."] };
  }

  rejectDangerousKeys(input, "$", errors);
  exactKeys(
    input,
    ["pageId", "route", "title", "status", "taxonomies", "blocks", "seo"],
    "$",
    errors,
    ["taxonomies"],
  );

  requireString(input.pageId, "$.pageId", errors, 1, 80);
  if (
    typeof input.pageId === "string" &&
    !/^page_[a-z0-9_]+$/.test(input.pageId)
  ) {
    errors.push("$.pageId: допустим формат page_[a-z0-9_].");
  }
  requireString(input.route, "$.route", errors, 1, 120);
  if (typeof input.route === "string" && !isSafeInternalHref(input.route)) {
    errors.push("$.route: допустим только внутренний путь.");
  }
  requireString(input.title, "$.title", errors, 1, 120);
  if (!STATUSES.has(String(input.status))) {
    errors.push("$.status: недопустимый статус.");
  }

  if (!Array.isArray(input.blocks)) {
    errors.push("$.blocks: ожидается массив.");
  } else {
    if (input.blocks.length < 5 || input.blocks.length > 24) {
      errors.push("$.blocks: требуется от 5 до 24 блоков.");
    }
    const typeCounts = new Map<string, number>();
    const ids = new Set<string>();
    input.blocks.forEach((block, index) =>
      validateBlock(block, index, typeCounts, ids, errors),
    );
    for (const required of [
      "nsars.hero",
      "nsars.rich_text",
      "nsars.process",
      "nsars.related",
      "nsars.footer",
    ]) {
      if (typeCounts.get(required) !== 1) {
        errors.push(`$.blocks: требуется ровно один блок ${required}.`);
      }
    }
    if (
      isRecord(input.blocks[0]) &&
      input.blocks[0].type !== "nsars.hero"
    ) {
      errors.push("$.blocks: обложка должна оставаться первым блоком.");
    }
    const last = input.blocks[input.blocks.length - 1];
    if (isRecord(last) && last.type !== "nsars.footer") {
      errors.push("$.blocks: подвал должен оставаться последним блоком.");
    }
  }

  validateSeo(input.seo, errors);
  if (input.taxonomies !== undefined) {
    validateTaxonomies(input.taxonomies, errors);
  }
  const expectedRoute =
    typeof input.pageId === "string"
      ? PAGE_ROUTE_CONTRACT[input.pageId as PublicPageId]
      : undefined;
  if (expectedRoute && input.route !== expectedRoute) {
    errors.push(`$.route: для ${input.pageId} требуется маршрут ${expectedRoute}.`);
  } else if (
    !expectedRoute &&
    typeof input.route === "string" &&
    !isSafePublicRoute(input.route)
  ) {
    errors.push("$.route: нужен уникальный публичный путь из латинских букв, цифр и дефисов.");
  }
  if (isRecord(input.seo) && input.seo.indexing !== "NOINDEX") {
    errors.push("$.seo.indexing: до размещения обязателен NOINDEX.");
  }
  if (isRecord(input.seo) && input.seo.canonical !== null) {
    errors.push("$.seo.canonical: до размещения должен быть null.");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: input as unknown as PageDocument };
}

function validateBlock(
  input: unknown,
  index: number,
  typeCounts: Map<string, number>,
  ids: Set<string>,
  errors: string[],
) {
  const path = `$.blocks[${index}]`;
  if (!isRecord(input)) {
    errors.push(`${path}: блок должен быть объектом.`);
    return;
  }
  exactKeys(
    input,
    ["blockId", "type", "schemaVersion", "position", "data", "style"],
    path,
    errors,
  );
  requireString(input.blockId, `${path}.blockId`, errors, 1, 80);
  requireString(input.schemaVersion, `${path}.schemaVersion`, errors, 1, 24);
  if (
    typeof input.position !== "number" ||
    !Number.isInteger(input.position) ||
    input.position !== index
  ) {
    errors.push(
      `${path}.position: позиции должны быть последовательными от нуля.`,
    );
  }
  if (typeof input.blockId === "string") {
    if (ids.has(input.blockId)) {
      errors.push(`${path}.blockId: идентификатор должен быть уникальным.`);
    }
    ids.add(input.blockId);
  }
  if (typeof input.type !== "string" || !ALLOWED_TYPES.has(input.type)) {
    errors.push(`${path}.type: блок не разрешён в первом срезе.`);
    return;
  }
  typeCounts.set(input.type, (typeCounts.get(input.type) ?? 0) + 1);
  validateStyle(input.style, `${path}.style`, errors);
  validateBlockData(
    input.type as SliceBlockType,
    input.data,
    `${path}.data`,
    errors,
  );
}

function validateBlockData(
  type: SliceBlockType,
  input: unknown,
  path: string,
  errors: string[],
) {
  if (!isRecord(input)) {
    errors.push(`${path}: данные блока должны быть объектом.`);
    return;
  }
  exactKeys(input, blockFields[type], path, errors);
  switch (type) {
    case "nsars.hero":
      requireStrings(
        input,
        ["eyebrow", "title", "accent", "body"],
        path,
        errors,
      );
      if (input.visualMode !== "editorial_shapes") {
        errors.push(
          `${path}.visualMode: разрешён только editorial_shapes.`,
        );
      }
      validateCta(input.primaryCta, `${path}.primaryCta`, errors);
      if (input.secondaryCta !== null) {
        validateCta(input.secondaryCta, `${path}.secondaryCta`, errors);
      }
      break;
    case "nsars.rich_text":
      requireStrings(input, ["kicker", "heading"], path, errors);
      if (
        !Array.isArray(input.body) ||
        input.body.length < 1 ||
        input.body.some(
          (item) => typeof item !== "string" || !item.trim(),
        )
      ) {
        errors.push(`${path}.body: требуется непустой массив абзацев.`);
      }
      if (!new Set(["left", "split"]).has(String(input.alignment))) {
        errors.push(`${path}.alignment: недопустимое выравнивание.`);
      }
      break;
    case "nsars.process":
      requireString(input.heading, `${path}.heading`, errors, 1, 160);
      validateObjectList(
        input.steps,
        ["number", "title", "body"],
        `${path}.steps`,
        errors,
      );
      break;
    case "nsars.related":
      requireString(input.heading, `${path}.heading`, errors, 1, 160);
      validateObjectList(
        input.items,
        ["eyebrow", "title", "body", "href"],
        `${path}.items`,
        errors,
        true,
      );
      break;
    case "nsars.smart_gallery":
      requireStrings(input, ["heading", "body"], path, errors);
      validateMediaIds(input.mediaIds, `${path}.mediaIds`, errors);
      if (!new Set(["grid", "masonry", "strip"]).has(String(input.layout))) {
        errors.push(`${path}.layout: недопустимая раскладка.`);
      }
      if (!new Set(["calm", "standard", "dense"]).has(String(input.density))) {
        errors.push(`${path}.density: недопустимая плотность.`);
      }
      if (typeof input.lightbox !== "boolean") {
        errors.push(`${path}.lightbox: ожидается логическое значение.`);
      }
      break;
    case "nsars.mixed_slider":
      requireStrings(input, ["heading", "body"], path, errors);
      validateMediaIds(input.mediaIds, `${path}.mediaIds`, errors);
      if (
        !new Set(["adaptive", "landscape", "portrait"]).has(
          String(input.framePolicy),
        )
      ) {
        errors.push(`${path}.framePolicy: недопустимый режим кадра.`);
      }
      if (!new Set(["arrows_dots", "arrows", "dots"]).has(String(input.controls))) {
        errors.push(`${path}.controls: недопустимый набор управления.`);
      }
      if (typeof input.captions !== "boolean") {
        errors.push(`${path}.captions: ожидается логическое значение.`);
      }
      validateInterval(input.intervalSeconds, `${path}.intervalSeconds`, errors);
      break;
    case "nsars.interactive_page_layout":
      requireStrings(input, ["heading", "body", "accessibleName"], path, errors);
      validateOptionalMediaId(
        input.backgroundMediaId,
        `${path}.backgroundMediaId`,
        errors,
      );
      validateInterval(input.intervalSeconds, `${path}.intervalSeconds`, errors);
      validatePhotoWindows(input.photoWindows, `${path}.photoWindows`, errors);
      break;
    case "nsars.footer":
      requireStrings(input, ["brand", "legalStatus"], path, errors);
      if (!Array.isArray(input.navigation) || input.navigation.length < 1) {
        errors.push(`${path}.navigation: требуется хотя бы один пункт.`);
      } else {
        input.navigation.forEach((item, itemIndex) => {
          const itemPath = `${path}.navigation[${itemIndex}]`;
          if (!isRecord(item)) {
            errors.push(`${itemPath}: ожидается объект.`);
            return;
          }
          exactKeys(item, ["label", "href"], itemPath, errors);
          requireStrings(item, ["label", "href"], itemPath, errors);
          if (
            typeof item.href === "string" &&
            !isSafeInternalHref(item.href)
          ) {
            errors.push(
              `${itemPath}.href: допустима только внутренняя ссылка.`,
            );
          }
        });
      }
      break;
  }
}

function validateMediaIds(input: unknown, path: string, errors: string[]) {
  if (!Array.isArray(input) || input.length > 60) {
    errors.push(`${path}: ожидается массив до 60 файлов.`);
    return;
  }
  const unique = new Set<string>();
  input.forEach((item, index) => {
    if (typeof item !== "string" || !/^media_[a-z0-9_]{8,80}$/i.test(item)) {
      errors.push(`${path}[${index}]: некорректный Media_ID.`);
      return;
    }
    if (unique.has(item)) errors.push(`${path}[${index}]: Media_ID повторяется.`);
    unique.add(item);
  });
}

function validateOptionalMediaId(
  input: unknown,
  path: string,
  errors: string[],
) {
  if (input === null) return;
  if (typeof input !== "string" || !/^media_[a-z0-9_]{8,80}$/i.test(input)) {
    errors.push(`${path}: ожидается корректный Media_ID или null.`);
  }
}

function validateInterval(input: unknown, path: string, errors: string[]) {
  if (
    typeof input !== "number" ||
    !Number.isInteger(input) ||
    (input !== 0 && (input < 3 || input > 30))
  ) {
    errors.push(`${path}: допустимо 0 либо целое число от 3 до 30 секунд.`);
  }
}

function validatePhotoWindows(input: unknown, path: string, errors: string[]) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 4) {
    errors.push(`${path}: требуется от 1 до 4 фотозон.`);
    return;
  }
  const ids = new Set<string>();
  input.forEach((windowValue, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(windowValue)) {
      errors.push(`${itemPath}: ожидается объект фотозоны.`);
      return;
    }
    exactKeys(windowValue, ["windowId", "label", "mediaIds", "quad"], itemPath, errors);
    requireString(windowValue.windowId, `${itemPath}.windowId`, errors, 1, 80);
    if (
      typeof windowValue.windowId === "string" &&
      !/^window_[a-z0-9_]+$/i.test(windowValue.windowId)
    ) {
      errors.push(`${itemPath}.windowId: допустим формат window_[a-z0-9_].`);
    }
    if (typeof windowValue.windowId === "string") {
      if (ids.has(windowValue.windowId)) {
        errors.push(`${itemPath}.windowId: идентификатор повторяется.`);
      }
      ids.add(windowValue.windowId);
    }
    requireString(windowValue.label, `${itemPath}.label`, errors, 1, 80);
    validateMediaIds(windowValue.mediaIds, `${itemPath}.mediaIds`, errors);
    validateQuad(windowValue.quad, `${itemPath}.quad`, errors);
  });
}

function validateQuad(input: unknown, path: string, errors: string[]) {
  if (!Array.isArray(input) || input.length !== 4) {
    errors.push(`${path}: требуется четыре точки.`);
    return;
  }
  const points: QuadPoint[] = [];
  input.forEach((point, index) => {
    const pointPath = `${path}[${index}]`;
    if (!isRecord(point)) {
      errors.push(`${pointPath}: ожидается объект точки.`);
      return;
    }
    exactKeys(point, ["x", "y"], pointPath, errors);
    const x = point.x;
    const y = point.y;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      x > 1 ||
      y < 0 ||
      y > 1
    ) {
      errors.push(`${pointPath}: координаты должны быть в диапазоне 0–1.`);
      return;
    }
    points.push({ x, y });
  });
  if (points.length !== 4) return;
  const area = Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
  if (area < 0.001) errors.push(`${path}: площадь фотозоны слишком мала.`);
  const crosses = points.map((point, index) => {
    const next = points[(index + 1) % 4];
    const after = points[(index + 2) % 4];
    return (next.x - point.x) * (after.y - next.y) -
      (next.y - point.y) * (after.x - next.x);
  });
  const positive = crosses.some((value) => value > 0.000001);
  const negative = crosses.some((value) => value < -0.000001);
  if (positive && negative) errors.push(`${path}: точки образуют самопересекающуюся зону.`);
}

function validateObjectList(
  input: unknown,
  fields: readonly string[],
  path: string,
  errors: string[],
  checkHref = false,
) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8) {
    errors.push(`${path}: требуется от 1 до 8 элементов.`);
    return;
  }
  input.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${itemPath}: ожидается объект.`);
      return;
    }
    exactKeys(item, fields, itemPath, errors);
    requireStrings(item, fields, itemPath, errors);
    if (
      checkHref &&
      typeof item.href === "string" &&
      !isSafeInternalHref(item.href)
    ) {
      errors.push(`${itemPath}.href: допустима только внутренняя ссылка.`);
    }
  });
}

function validateCta(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path}: ожидается объект CTA.`);
    return;
  }
  exactKeys(input, ["label", "href", "state"], path, errors);
  requireString(input.label, `${path}.label`, errors, 1, 80);
  if (
    input.href !== null &&
    (typeof input.href !== "string" || !isSafeInternalHref(input.href))
  ) {
    errors.push(
      `${path}.href: допустима только внутренняя ссылка или null.`,
    );
  }
  if (!new Set(["enabled", "disabled"]).has(String(input.state))) {
    errors.push(`${path}.state: недопустимое состояние.`);
  }
  if (input.state === "disabled" && input.href !== null) {
    errors.push(`${path}: у отключённого CTA href должен быть null.`);
  }
}

function validateStyle(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path}: стиль должен быть объектом.`);
    return;
  }
  exactKeys(
    input,
    [
      "theme",
      "background",
      "surface",
      "contentWidth",
      "spacingTop",
      "spacingBottom",
      "fullBleed",
      "visible",
      "responsiveOverrides",
    ],
    path,
    errors,
  );
  if (!THEMES.has(String(input.theme))) {
    errors.push(`${path}.theme: неизвестная тема.`);
  }
  if (input.background !== null && typeof input.background !== "string") {
    errors.push(`${path}.background: ожидается строка или null.`);
  }
  if (!SURFACES.has(String(input.surface))) {
    errors.push(`${path}.surface: неизвестная поверхность.`);
  }
  if (!WIDTHS.has(String(input.contentWidth))) {
    errors.push(`${path}.contentWidth: неизвестная ширина.`);
  }
  if (
    !SPACING.has(String(input.spacingTop)) ||
    !SPACING.has(String(input.spacingBottom))
  ) {
    errors.push(`${path}: недопустимый интервал.`);
  }
  if (
    typeof input.fullBleed !== "boolean" ||
    typeof input.visible !== "boolean"
  ) {
    errors.push(`${path}: fullBleed и visible должны быть логическими.`);
  }
  if (!isRecord(input.responsiveOverrides)) {
    errors.push(`${path}.responsiveOverrides: ожидается объект.`);
  }
}

function validateSeo(input: unknown, errors: string[]) {
  const path = "$.seo";
  if (!isRecord(input)) {
    errors.push(`${path}: ожидается объект.`);
    return;
  }
  exactKeys(
    input,
    ["title", "description", "indexing", "canonical"],
    path,
    errors,
  );
  requireString(input.title, `${path}.title`, errors, 1, 70);
  requireString(input.description, `${path}.description`, errors, 1, 180);
  if (!new Set(["INDEX", "NOINDEX"]).has(String(input.indexing))) {
    errors.push(`${path}.indexing: недопустимое значение.`);
  }
  if (input.canonical !== null && typeof input.canonical !== "string") {
    errors.push(`${path}.canonical: ожидается строка или null.`);
  }
}

function validateTaxonomies(input: unknown, errors: string[]) {
  const path = "$.taxonomies";
  if (!isRecord(input)) {
    errors.push(`${path}: ожидается объект.`);
    return;
  }
  exactKeys(
    input,
    ["age", "visualLine", "package", "contentType", "lifecycle"],
    path,
    errors,
  );
  if (
    !new Set(["none", "kindergarten", "grade4", "highschool"]).has(
      String(input.age),
    )
  ) {
    errors.push(`${path}.age: недопустимо.`);
  }
  if (
    !new Set(["none", "AIR", "BASE", "NIGHT"]).has(
      String(input.visualLine),
    )
  ) {
    errors.push(`${path}.visualLine: недопустимо.`);
  }
  if (
    !new Set(["none", "XS", "M", "PREMIUM"]).has(
      String(input.package),
    )
  ) {
    errors.push(`${path}.package: недопустимо.`);
  }
  requireStrings(input, ["contentType", "lifecycle"], path, errors);
}

function rejectDangerousKeys(
  value: unknown,
  path: string,
  errors: string[],
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectDangerousKeys(item, `${path}[${index}]`, errors),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      RAW_FIELD_NAMES.has(normalized) ||
      FORBIDDEN_DATA_FIELDS.has(normalized)
    ) {
      errors.push(`${path}.${key}: поле запрещено в первом срезе.`);
    }
    rejectDangerousKeys(child, `${path}.${key}`, errors);
  }
}

function exactKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
  optional: readonly string[] = [],
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!allowedSet.has(key)) errors.push(`${path}.${key}: неизвестное поле.`);
  }
  const optionalSet = new Set(optional);
  for (const key of allowed) {
    if (!optionalSet.has(key) && !(key in input)) {
      errors.push(`${path}.${key}: обязательное поле отсутствует.`);
    }
  }
}

function requireStrings(
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  errors: string[],
) {
  keys.forEach((key) =>
    requireString(input[key], `${path}.${key}`, errors, 1, 600),
  );
}

function requireString(
  value: unknown,
  path: string,
  errors: string[],
  min: number,
  max: number,
) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  ) {
    errors.push(`${path}: требуется строка длиной ${min}–${max}.`);
  }
}

function isSafeInternalHref(value: string) {
  return (
    (value.startsWith("/") && !value.startsWith("//")) ||
    value.startsWith("#")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function clonePageDocument(value: PageDocument): PageDocument {
  return JSON.parse(JSON.stringify(value)) as PageDocument;
}

export function normalizePublicRoute(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.endsWith("/") ? withoutQuery : `${withoutQuery}/`;
}

export function isPublicPageId(value: string): value is PublicPageId {
  return Object.hasOwn(PAGE_ROUTE_CONTRACT, value);
}

export function isValidPageId(value: string): boolean {
  return /^page_[a-z0-9_]{1,80}$/.test(value);
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function routeFromSlugInput(value: string): string | null {
  const slug = normalizeSlug(value);
  if (!slug || RESERVED_PUBLIC_SEGMENTS.has(slug)) return null;
  return `/${slug}/`;
}

export function isSafePublicRoute(value: string): boolean {
  if (value === "/") return false;
  const route = normalizePublicRoute(value);
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(route)) return false;
  const first = route.split("/").filter(Boolean)[0];
  return Boolean(first && !RESERVED_PUBLIC_SEGMENTS.has(first));
}

export type MediaBlockType =
  | "nsars.smart_gallery"
  | "nsars.mixed_slider"
  | "nsars.interactive_page_layout";

export function createMediaBlock(
  type: MediaBlockType,
  blockId: string,
  position: number,
): SliceBlock {
  const common = {
    blockId,
    type,
    schemaVersion: "1.2.0",
    position,
    style: {
      theme: "paper" as Theme,
      background: null,
      surface: "none" as const,
      contentWidth: "wide" as const,
      spacingTop: "l" as const,
      spacingBottom: "l" as const,
      fullBleed: false,
      visible: false,
      responsiveOverrides: {},
    },
  };
  if (type === "nsars.smart_gallery") {
    return {
      ...common,
      type,
      data: {
        heading: "Галерея",
        body: "Добавьте фотографии из медиатеки и включите блок после проверки прав.",
        mediaIds: [],
        layout: "grid",
        density: "standard",
        lightbox: true,
      },
    };
  }
  if (type === "nsars.mixed_slider") {
    return {
      ...common,
      type,
      data: {
        heading: "Фотосерия",
        body: "Горизонтальные и вертикальные кадры меняются без скачков страницы.",
        mediaIds: [],
        framePolicy: "adaptive",
        captions: true,
        controls: "arrows_dots",
        intervalSeconds: 0,
      },
    };
  }
  return {
    ...common,
    type,
    data: {
      heading: "Макет страницы",
      body: "Загрузите изображение макета и настройте до четырёх фотозон четырьмя точками.",
      backgroundMediaId: null,
      photoWindows: [
        {
          windowId: `window_${blockId.replace(/[^a-z0-9_]/gi, "_")}_1`,
          label: "Фотозона 1",
          mediaIds: [],
          quad: [
            { x: 0.08, y: 0.12 },
            { x: 0.48, y: 0.12 },
            { x: 0.48, y: 0.72 },
            { x: 0.08, y: 0.72 },
          ],
        },
      ],
      intervalSeconds: 5,
      accessibleName: "Интерактивный макет страницы альбома",
    },
  };
}

export function reindexBlocks(blocks: SliceBlock[]): SliceBlock[] {
  return blocks.map((block, position) => ({ ...block, position }));
}

export function collectMediaIds(document: PageDocument): string[] {
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (!block.style.visible) continue;
    if (block.type === "nsars.smart_gallery") {
      (block.data as SmartGalleryData).mediaIds.forEach((id) => ids.add(id));
    } else if (block.type === "nsars.mixed_slider") {
      (block.data as MixedSliderData).mediaIds.forEach((id) => ids.add(id));
    } else if (block.type === "nsars.interactive_page_layout") {
      const data = block.data as InteractivePageLayoutData;
      if (data.backgroundMediaId) ids.add(data.backgroundMediaId);
      data.photoWindows.forEach((windowValue) =>
        windowValue.mediaIds.forEach((id) => ids.add(id)),
      );
    }
  }
  return [...ids];
}
