import {
  BLOCK_REGISTRY,
  COMPOSER_CONTRACT_VERSION,
  PAGE_TYPE_REGISTRY,
  blockDefinitionByType,
  createComposerBlock,
  isVariantAllowed,
  pageTypeById,
  variantById,
  type BlockFieldDefinition,
  type BlockType,
  type ContentPageTypeId,
} from "./composer-registry.ts";
import {
  validatePageDocument as validateLegacyPageDocument,
  type BlockStyle as LegacyBlockStyle,
  type InteractivePageLayoutData as LegacyInteractivePageLayoutData,
  type PageDocument as LegacyPageDocument,
  type SliceBlock as LegacySliceBlock,
} from "./page-contract.ts";

export type ComposerPageStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
export type ComposerTone = "paper" | "ink" | "petrol" | "ochre" | "red" | "cobalt";
export type ComposerSpacing = "none" | "s" | "m" | "l" | "xl";

export type ComposerBlockLayout = {
  width: "narrow" | "standard" | "wide" | "full";
  align: "left" | "center" | "right";
  tone: ComposerTone;
  spacingTop: ComposerSpacing;
  spacingBottom: ComposerSpacing;
  fullBleed: boolean;
};

export type ComposerResponsive = {
  hideDesktop: boolean;
  hideTablet: boolean;
  hideMobile: boolean;
  mobileAlign: "inherit" | "left" | "center" | "right";
};

export type ComposerBlock = {
  blockId: string;
  type: BlockType;
  variantId: string | null;
  schemaVersion: string;
  position: number;
  hidden: boolean;
  data: Record<string, unknown>;
  layout: ComposerBlockLayout;
  responsive: ComposerResponsive;
};

export type ComposerSeo = {
  title: string;
  description: string;
  indexing: "INDEX" | "NOINDEX";
  canonical: string | null;
};

export type ComposerPageDocument = {
  contractVersion: typeof COMPOSER_CONTRACT_VERSION;
  pageId: string;
  route: string;
  title: string;
  status: ComposerPageStatus;
  pageType: ContentPageTypeId;
  blocks: ComposerBlock[];
  quarantinedBlocks: ComposerBlock[];
  seo: ComposerSeo;
};

export type ComposerValidationResult =
  | { ok: true; value: ComposerPageDocument }
  | { ok: false; errors: string[] };

const CONTENT_PAGE_TYPES = new Set<ContentPageTypeId>(
  PAGE_TYPE_REGISTRY.filter((entry) => entry.nodeKind === "CONTENT").map(
    (entry) => entry.id as ContentPageTypeId,
  ),
);
const BLOCK_TYPES = new Set<BlockType>(BLOCK_REGISTRY.map((entry) => entry.type));
const STATUSES = new Set<ComposerPageStatus>([
  "DRAFT",
  "REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);
const WIDTHS = new Set(["narrow", "standard", "wide", "full"]);
const ALIGNS = new Set(["left", "center", "right"]);
const TONES = new Set(["paper", "ink", "petrol", "ochre", "red", "cobalt"]);
const SPACINGS = new Set(["none", "s", "m", "l", "xl"]);
const MOBILE_ALIGNS = new Set(["inherit", "left", "center", "right"]);
const RESERVED_PUBLIC_SEGMENTS = new Set([
  "admin",
  "api",
  "preview",
  "qa-responsive",
  "robots.txt",
  "sitemap.xml",
  "_next",
]);
const DANGEROUS_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "html",
  "css",
  "js",
  "script",
  "dangerouslysetinnerhtml",
]);

export function validateComposerPageDocument(input: unknown): ComposerValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["Документ страницы должен быть объектом."] };
  }
  rejectDangerousKeys(input, "$", errors);
  exactKeys(
    input,
    [
      "contractVersion",
      "pageId",
      "route",
      "title",
      "status",
      "pageType",
      "blocks",
      "quarantinedBlocks",
      "seo",
    ],
    "$",
    errors,
  );
  if (input.contractVersion !== COMPOSER_CONTRACT_VERSION) {
    errors.push(`$.contractVersion: требуется ${COMPOSER_CONTRACT_VERSION}.`);
  }
  requireString(input.pageId, "$.pageId", errors, 1, 90);
  if (typeof input.pageId === "string" && !/^page_[a-z0-9_]{1,80}$/.test(input.pageId)) {
    errors.push("$.pageId: допустим формат page_[a-z0-9_].");
  }
  requireString(input.route, "$.route", errors, 1, 240);
  if (typeof input.route === "string" && !isSafeComposerRoute(input.route)) {
    errors.push("$.route: нужен безопасный внутренний публичный путь.");
  }
  requireString(input.title, "$.title", errors, 1, 120);
  if (!STATUSES.has(input.status as ComposerPageStatus)) {
    errors.push("$.status: недопустимый статус.");
  }
  if (!CONTENT_PAGE_TYPES.has(input.pageType as ContentPageTypeId)) {
    errors.push("$.pageType: недопустимый тип страницы.");
  }

  const blockIds = new Set<string>();

  validateBlockList(
    input.blocks,
    "$.blocks",
    input.pageType as ContentPageTypeId,
    true,
    blockIds,
    errors,
  );
  validateBlockList(
    input.quarantinedBlocks,
    "$.quarantinedBlocks",
    input.pageType as ContentPageTypeId,
    false,
    blockIds,
    errors,
    false,
  );
  if (blockIds.size > 500) {
    errors.push("$.blocks: вместе с вложенными и карантинными допускается не более 500 блоков.");
  }
  validateSeo(input.seo, errors);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: input as unknown as ComposerPageDocument };
}

function validateBlockList(
  input: unknown,
  path: string,
  pageType: ContentPageTypeId,
  enforceVariantScope: boolean,
  ids: Set<string>,
  errors: string[],
  requireSequential = true,
  allowStructural = true,
) {
  if (!Array.isArray(input)) {
    errors.push(`${path}: ожидается массив.`);
    return;
  }
  if (input.length > 500) {
    errors.push(`${path}: допускается не более 500 блоков.`);
  }
  input.forEach((block, index) => {
    const blockPath = `${path}[${index}]`;
    if (!isRecord(block)) {
      errors.push(`${blockPath}: блок должен быть объектом.`);
      return;
    }
    exactKeys(
      block,
      [
        "blockId",
        "type",
        "variantId",
        "schemaVersion",
        "position",
        "hidden",
        "data",
        "layout",
        "responsive",
      ],
      blockPath,
      errors,
    );
    requireString(block.blockId, `${blockPath}.blockId`, errors, 1, 100);
    if (typeof block.blockId === "string") {
      if (!/^block_[a-z0-9_]{4,90}$/i.test(block.blockId)) {
        errors.push(`${blockPath}.blockId: некорректный идентификатор блока.`);
      }
      if (ids.has(block.blockId)) {
        errors.push(`${blockPath}.blockId: идентификатор должен быть уникальным.`);
      }
      ids.add(block.blockId);
    }
    const type = block.type as BlockType;
    if (!BLOCK_TYPES.has(type)) {
      errors.push(`${blockPath}.type: неизвестное семейство блока.`);
      return;
    }
    if (
      !Number.isInteger(block.position) ||
      Number(block.position) < 0 ||
      (requireSequential && block.position !== index)
    ) {
      errors.push(`${blockPath}.position: позиции должны идти от нуля без пропусков.`);
    }
    requireString(block.schemaVersion, `${blockPath}.schemaVersion`, errors, 1, 24);
    if (typeof block.hidden !== "boolean") {
      errors.push(`${blockPath}.hidden: требуется логическое значение.`);
    }
    if (!allowStructural && type === "F20") {
      errors.push(`${blockPath}.type: структурный ряд нельзя вкладывать в другой структурный ряд.`);
    }
    if (block.variantId !== null && typeof block.variantId !== "string") {
      errors.push(`${blockPath}.variantId: требуется строка или null.`);
    } else if (typeof block.variantId === "string") {
      const variant = variantById[block.variantId];
      if (!variant) {
        errors.push(`${blockPath}.variantId: неизвестный вариант блока.`);
      } else if (variant.blockType !== type) {
        errors.push(`${blockPath}.variantId: вариант относится к другому семейству блока.`);
      } else if (enforceVariantScope && !isVariantAllowed(block.variantId, pageType)) {
        errors.push(`${blockPath}.variantId: вариант недоступен для этого типа страницы.`);
      }
    }
    validateBlockData(
      type,
      block.data,
      `${blockPath}.data`,
      pageType,
      enforceVariantScope,
      ids,
      errors,
    );
    validateLayout(block.layout, `${blockPath}.layout`, errors);
    validateResponsive(block.responsive, `${blockPath}.responsive`, errors);
  });
}

function validateBlockData(
  type: BlockType,
  input: unknown,
  path: string,
  pageType: ContentPageTypeId,
  enforceVariantScope: boolean,
  ids: Set<string>,
  errors: string[],
) {
  if (!isRecord(input)) {
    errors.push(`${path}: данные блока должны быть объектом.`);
    return;
  }
  const definition = blockDefinitionByType[type];
  const allowed = new Set([
    ...Object.keys(definition.defaultData),
    ...definition.fields.map((field) => field.key),
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: поле не поддерживается этим блоком.`);
  }
  if (JSON.stringify(input).length > 120_000) {
    errors.push(`${path}: данные блока превышают допустимый размер.`);
  }
  for (const field of definition.fields) {
    validateField(field, input[field.key], `${path}.${field.key}`, errors);
  }
  if (type === "F18") validatePhotoWindows(input.photoWindows, `${path}.photoWindows`, errors);
  if (type === "F20") {
    validateStructuralSlots(
      input,
      path,
      pageType,
      enforceVariantScope,
      ids,
      errors,
    );
  }
  validateBlockUrls(type, input, path, errors);
  validateJsonValue(input, path, 0, errors);
}

function validatePhotoWindows(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.length > 4) {
    errors.push(`${path}: допускается массив до четырёх фотоокон.`);
    return;
  }
  const ids = new Set<string>();
  value.forEach((windowValue, index) => {
    const windowPath = `${path}[${index}]`;
    if (!isRecord(windowValue)) {
      errors.push(`${windowPath}: фотоокно должно быть объектом.`);
      return;
    }
    exactKeys(windowValue, ["windowId", "label", "mediaIds", "quad"], windowPath, errors);
    requireString(windowValue.windowId, `${windowPath}.windowId`, errors, 1, 100);
    requireString(windowValue.label, `${windowPath}.label`, errors, 1, 160);
    if (typeof windowValue.windowId === "string") {
      if (ids.has(windowValue.windowId)) errors.push(`${windowPath}.windowId: идентификатор должен быть уникальным.`);
      ids.add(windowValue.windowId);
    }
    const mediaIds = windowValue.mediaIds;
    if (!Array.isArray(mediaIds) || mediaIds.length > 200 || mediaIds.some((item) => typeof item !== "string" || !/^media_[a-z0-9_]{8,80}$/i.test(item))) {
      errors.push(`${windowPath}.mediaIds: требуется список Media_ID.`);
    }
    if (!Array.isArray(windowValue.quad) || windowValue.quad.length !== 4) {
      errors.push(`${windowPath}.quad: нужны четыре точки.`);
      return;
    }
    const points = windowValue.quad.flatMap((point) => {
      if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number" || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        errors.push(`${windowPath}.quad: координаты должны быть числами от 0 до 1.`);
        return [];
      }
      return [{ x: point.x, y: point.y }];
    });
    if (points.length === 4 && polygonArea(points) < 0.002) {
      errors.push(`${windowPath}.quad: фотоокно не должно вырождаться в линию.`);
    }
  });
}

function validateStructuralSlots(
  input: Record<string, unknown>,
  path: string,
  pageType: ContentPageTypeId,
  enforceVariantScope: boolean,
  ids: Set<string>,
  errors: string[],
) {
  const columns = input.columns;
  if (!Number.isInteger(columns) || Number(columns) < 1 || Number(columns) > 4) {
    errors.push(`${path}.columns: требуется целое число от 1 до 4.`);
  }
  if (!Array.isArray(input.slots) || input.slots.length !== columns) {
    errors.push(`${path}.slots: число колонок и слотов должно совпадать.`);
    return;
  }
  const slotIds = new Set<string>();
  input.slots.forEach((slot, index) => {
    const slotPath = `${path}.slots[${index}]`;
    if (!isRecord(slot)) {
      errors.push(`${slotPath}: слот должен быть объектом.`);
      return;
    }
    exactKeys(slot, ["slotId", "label", "blocks"], slotPath, errors);
    requireString(slot.slotId, `${slotPath}.slotId`, errors, 1, 100);
    requireString(slot.label, `${slotPath}.label`, errors, 1, 160);
    if (typeof slot.slotId === "string") {
      if (slotIds.has(slot.slotId)) errors.push(`${slotPath}.slotId: идентификатор должен быть уникальным.`);
      slotIds.add(slot.slotId);
    }
    validateBlockList(
      slot.blocks,
      `${slotPath}.blocks`,
      pageType,
      enforceVariantScope,
      ids,
      errors,
      true,
      false,
    );
  });
}

function validateBlockUrls(
  type: BlockType,
  input: Record<string, unknown>,
  path: string,
  errors: string[],
) {
  if ((type === "F01" || type === "F14") && typeof input.actionHref === "string" && input.actionHref && !isSafeInternalComposerHref(input.actionHref)) {
    errors.push(`${path}.actionHref: допустима только безопасная внутренняя ссылка.`);
  }
  if (type === "F07" && typeof input.videoUrl === "string" && input.videoUrl && !isAllowedVideoHref(input.videoUrl)) {
    errors.push(`${path}.videoUrl: разрешены только HTTPS-ссылки YouTube, Vimeo или VK Видео.`);
  }
  if (type === "F08" && Array.isArray(input.items)) {
    input.items.forEach((value, index) => {
      if (typeof value !== "string") return;
      const href = value.split("|")[2]?.trim() ?? "";
      if (href && !isSafeInternalComposerHref(href)) errors.push(`${path}.items[${index}]: ссылка должна быть внутренней.`);
    });
  }
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function validateField(
  field: BlockFieldDefinition,
  value: unknown,
  path: string,
  errors: string[],
) {
  if (field.kind === "text" || field.kind === "textarea") {
    if (typeof value !== "string" || value.length > (field.kind === "text" ? 600 : 20_000)) {
      errors.push(`${path}: требуется текст допустимой длины.`);
    }
    return;
  }
  if (field.kind === "toggle") {
    if (typeof value !== "boolean") errors.push(`${path}: требуется логическое значение.`);
    return;
  }
  if (field.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 100_000) {
      errors.push(`${path}: требуется допустимое число.`);
    }
    return;
  }
  if (field.kind === "select") {
    const values = new Set(field.options?.map((option) => option.value) ?? []);
    if (typeof value !== "string" || !values.has(value)) {
      errors.push(`${path}: выбрано недопустимое значение.`);
    }
    return;
  }
  if (field.kind === "list") {
    if (
      !Array.isArray(value) ||
      value.length > 100 ||
      value.some((item) => typeof item !== "string" || item.length > 2_000)
    ) {
      errors.push(`${path}: требуется массив до 100 текстовых строк.`);
    }
    return;
  }
  if (field.kind === "media") {
    const validMediaId = (item: unknown) =>
      typeof item === "string" && /^media_[a-z0-9_]{8,80}$/i.test(item);
    if (
      value !== null &&
      !validMediaId(value) &&
      (!Array.isArray(value) || value.length > 200 || value.some((item) => !validMediaId(item)))
    ) {
      errors.push(`${path}: требуется Media_ID, список Media_ID или null.`);
    }
  }
}

function validateLayout(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path}: настройки компоновки должны быть объектом.`);
    return;
  }
  exactKeys(
    input,
    ["width", "align", "tone", "spacingTop", "spacingBottom", "fullBleed"],
    path,
    errors,
  );
  if (!WIDTHS.has(String(input.width))) errors.push(`${path}.width: недопустимая ширина.`);
  if (!ALIGNS.has(String(input.align))) errors.push(`${path}.align: недопустимое выравнивание.`);
  if (!TONES.has(String(input.tone))) errors.push(`${path}.tone: недопустимая палитра.`);
  if (!SPACINGS.has(String(input.spacingTop))) errors.push(`${path}.spacingTop: недопустимый отступ.`);
  if (!SPACINGS.has(String(input.spacingBottom))) errors.push(`${path}.spacingBottom: недопустимый отступ.`);
  if (typeof input.fullBleed !== "boolean") errors.push(`${path}.fullBleed: требуется логическое значение.`);
}

function validateResponsive(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path}: адаптивные настройки должны быть объектом.`);
    return;
  }
  exactKeys(
    input,
    ["hideDesktop", "hideTablet", "hideMobile", "mobileAlign"],
    path,
    errors,
  );
  for (const key of ["hideDesktop", "hideTablet", "hideMobile"] as const) {
    if (typeof input[key] !== "boolean") errors.push(`${path}.${key}: требуется логическое значение.`);
  }
  if (!MOBILE_ALIGNS.has(String(input.mobileAlign))) {
    errors.push(`${path}.mobileAlign: недопустимое выравнивание.`);
  }
}

function validateSeo(input: unknown, errors: string[]) {
  if (!isRecord(input)) {
    errors.push("$.seo: настройки SEO должны быть объектом.");
    return;
  }
  exactKeys(input, ["title", "description", "indexing", "canonical"], "$.seo", errors);
  requireString(input.title, "$.seo.title", errors, 1, 120);
  if (typeof input.description !== "string" || input.description.length > 400) {
    errors.push("$.seo.description: требуется текст до 400 символов.");
  }
  if (input.indexing !== "INDEX" && input.indexing !== "NOINDEX") {
    errors.push("$.seo.indexing: требуется INDEX или NOINDEX.");
  }
  if (
    input.canonical !== null &&
    (typeof input.canonical !== "string" ||
      !/^https:\/\/ns-ars\.ru(?:\/|$)/.test(input.canonical))
  ) {
    errors.push("$.seo.canonical: допустим только адрес на ns-ars.ru или null.");
  }
}

export function migratePageDocument(input: unknown): ComposerPageDocument {
  if (isRecord(input) && input.contractVersion === COMPOSER_CONTRACT_VERSION) {
    const validation = validateComposerPageDocument(input);
    if (!validation.ok) throw new Error(validation.errors.join("\n"));
    return validation.value;
  }
  const legacy = validateLegacyPageDocument(input);
  if (!legacy.ok) throw new Error(legacy.errors.join("\n"));
  const migrated: ComposerPageDocument = {
    contractVersion: COMPOSER_CONTRACT_VERSION,
    pageId: legacy.value.pageId,
    route: legacy.value.route,
    title: legacy.value.title,
    status: legacy.value.status,
    pageType: inferPageType(legacy.value),
    blocks: legacy.value.blocks.flatMap((block, index) => migrateLegacyBlock(block, index)),
    quarantinedBlocks: [],
    seo: { ...legacy.value.seo },
  };
  migrated.blocks = reindexComposerBlocks(migrated.blocks);
  const validation = validateComposerPageDocument(migrated);
  if (!validation.ok) throw new Error(validation.errors.join("\n"));
  return validation.value;
}

function migrateLegacyBlock(block: LegacySliceBlock, position: number): ComposerBlock[] {
  const style = block.style as LegacyBlockStyle;
  const common: Omit<ComposerBlock, "type" | "data"> = {
    blockId: legacyBlockId(block.blockId),
    variantId: null,
    schemaVersion: "1.0.0",
    position,
    hidden: !style.visible,
    layout: {
      width: style.fullBleed ? "full" : style.contentWidth,
      align: "left" as const,
      tone: style.theme,
      spacingTop: style.spacingTop,
      spacingBottom: style.spacingBottom,
      fullBleed: style.fullBleed,
    },
    responsive: {
      hideDesktop: false,
      hideTablet: false,
      hideMobile: false,
      mobileAlign: "inherit" as const,
    },
  };
  if (block.type === "nsars.hero") {
    const data = block.data as LegacyPageDocument["blocks"][number]["data"] & Record<string, unknown>;
    const primary = isRecord(data.primaryCta) ? data.primaryCta : {};
    return [{ ...common, type: "F01", data: {
      eyebrow: textValue(data.eyebrow),
      title: textValue(data.title),
      accent: textValue(data.accent),
      body: textValue(data.body),
      actionLabel: textValue(primary.label),
      actionHref: textValue(primary.href),
    } }];
  }
  if (block.type === "nsars.rich_text") {
    const data = block.data as Record<string, unknown>;
    return [{ ...common, type: "F02", data: {
      kicker: textValue(data.kicker),
      title: textValue(data.heading),
      body: Array.isArray(data.body) ? data.body.map(textValue).join("\n\n") : textValue(data.body),
    } }];
  }
  if (block.type === "nsars.process") {
    const data = block.data as Record<string, unknown>;
    const items = Array.isArray(data.steps)
      ? data.steps.flatMap((item) => isRecord(item)
        ? [`${textValue(item.title)} | ${textValue(item.body)}`]
        : [])
      : [];
    return [{ ...common, type: "F09", data: { title: textValue(data.heading), items } }];
  }
  if (block.type === "nsars.related") {
    const data = block.data as Record<string, unknown>;
    const items = Array.isArray(data.items)
      ? data.items.flatMap((item) => isRecord(item)
        ? [`${textValue(item.title)} | ${textValue(item.body)} | ${textValue(item.href)}`]
        : [])
      : [];
    return [{ ...common, type: "F08", data: { title: textValue(data.heading), items } }];
  }
  if (block.type === "nsars.smart_gallery") {
    const data = block.data as Record<string, unknown>;
    return [{ ...common, type: "F05", data: {
      title: textValue(data.heading), body: textValue(data.body),
      mediaIds: stringArray(data.mediaIds), layout: textValue(data.layout) || "grid",
      lightbox: Boolean(data.lightbox),
    } }];
  }
  if (block.type === "nsars.mixed_slider") {
    const data = block.data as Record<string, unknown>;
    return [{ ...common, type: "F06", data: {
      title: textValue(data.heading), body: textValue(data.body),
      mediaIds: stringArray(data.mediaIds), autoplay: Number(data.intervalSeconds) > 0,
      intervalSeconds: Number(data.intervalSeconds) || 6,
    } }];
  }
  if (block.type === "nsars.interactive_page_layout") {
    const data = block.data as LegacyInteractivePageLayoutData;
    return [{ ...common, type: "F18", data: {
      title: data.heading,
      body: data.body,
      backgroundMediaId: data.backgroundMediaId,
      photoWindows: structuredClone(data.photoWindows),
      intervalSeconds: data.intervalSeconds,
    } }];
  }
  return [];
}

export function createBlankComposerPage(
  pageId: string,
  route: string,
  title: string,
  pageType: ContentPageTypeId,
): ComposerPageDocument {
  return {
    contractVersion: COMPOSER_CONTRACT_VERSION,
    pageId,
    route,
    title,
    status: "DRAFT",
    pageType,
    blocks: [],
    quarantinedBlocks: [],
    seo: {
      title: `${title} — Дом детской фотографии`.slice(0, 120),
      description: "",
      indexing: "NOINDEX",
      canonical: null,
    },
  };
}

export function isContentPageType(value: unknown): value is ContentPageTypeId {
  return CONTENT_PAGE_TYPES.has(value as ContentPageTypeId);
}

export function changeComposerPageType(
  document: ComposerPageDocument,
  nextPageType: ContentPageTypeId,
): ComposerPageDocument {
  if (!CONTENT_PAGE_TYPES.has(nextPageType)) throw new Error("Недопустимый тип страницы.");
  const next = cloneComposerPageDocument(document);
  const kept: ComposerBlock[] = [];
  const quarantined = [...next.quarantinedBlocks];
  for (const [index, block] of next.blocks.entries()) {
    if (!blockIsCompatibleWithPageType(block, nextPageType)) {
      quarantined.push({ ...block, position: index });
    } else {
      kept.push(block);
    }
  }
  const restored: ComposerBlock[] = [];
  const stillQuarantined: ComposerBlock[] = [];
  for (const block of quarantined) {
    if (blockIsCompatibleWithPageType(block, nextPageType)) {
      restored.push(block);
    } else {
      stillQuarantined.push(block);
    }
  }
  next.pageType = nextPageType;
  const restoredInPlace = [...kept];
  for (const block of restored.sort((left, right) => left.position - right.position)) {
    restoredInPlace.splice(Math.min(block.position, restoredInPlace.length), 0, block);
  }
  next.blocks = reindexComposerBlocks(restoredInPlace);
  next.quarantinedBlocks = stillQuarantined;
  return next;
}

export function createComposerPageBlock(
  type: BlockType,
  position: number,
  variantId?: string,
): ComposerBlock {
  return createComposerBlock(type, position, variantId) as ComposerBlock;
}

export function reindexComposerBlocks(blocks: ComposerBlock[]): ComposerBlock[] {
  return blocks.map((block, position) => ({ ...block, position }));
}

export function cloneComposerPageDocument(value: ComposerPageDocument): ComposerPageDocument {
  return structuredClone(value);
}

export function collectComposerMediaIds(document: ComposerPageDocument): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown, key = "") => {
    if (isComposerBlockValue(value)) {
      visitBlock(value);
      return;
    }
    if (typeof value === "string" && (key.toLowerCase().includes("mediaid") || key === "mediaIds")) {
      if (/^media_[a-z0-9_]{8,80}$/i.test(value)) ids.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, key));
      return;
    }
    if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, entry]) => visit(entry, childKey));
    }
  };
  const visitBlock = (block: ComposerBlock) => {
    if (block.hidden) return;
    visit(block.data);
  };
  document.blocks.forEach(visitBlock);
  return [...ids];
}

export function hasVisibleComposerContent(document: ComposerPageDocument) {
  return document.blocks.some((block) => !block.hidden);
}

export function composerShell(document: ComposerPageDocument) {
  return pageTypeById[document.pageType].shell;
}

export function isSafeComposerRoute(value: string): boolean {
  if (value === "/") return true;
  if (/[\\\u0000-\u001f\u007f?#]/.test(value) || value.startsWith("//")) return false;
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(value)) return false;
  const first = value.split("/").filter(Boolean)[0];
  return Boolean(first && !RESERVED_PUBLIC_SEGMENTS.has(first));
}

function isSafeInternalComposerHref(value: string) {
  return (
    /^#[a-z][a-z0-9_-]*$/i.test(value) ||
    (/^\/(?![\\/])/.test(value) && !/[\\\u0000-\u001f\u007f]/.test(value))
  );
}

function isAllowedVideoHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "vimeo.com",
      "www.vimeo.com",
      "vkvideo.ru",
      "www.vkvideo.ru",
    ].includes(url.hostname);
  } catch {
    return false;
  }
}

function blockIsCompatibleWithPageType(
  block: ComposerBlock,
  pageType: ContentPageTypeId,
): boolean {
  if (block.variantId && !isVariantAllowed(block.variantId, pageType)) {
    return false;
  }
  if (block.type !== "F20" || !Array.isArray(block.data.slots)) return true;
  return block.data.slots.every((slot) => {
    if (!isRecord(slot) || !Array.isArray(slot.blocks)) return false;
    return slot.blocks.every(
      (child) => isComposerBlockValue(child) && blockIsCompatibleWithPageType(child, pageType),
    );
  });
}

function isComposerBlockValue(value: unknown): value is ComposerBlock {
  return (
    isRecord(value) &&
    typeof value.blockId === "string" &&
    BLOCK_TYPES.has(value.type as BlockType) &&
    typeof value.hidden === "boolean" &&
    isRecord(value.data)
  );
}

export function routeFromComposerSlugInput(value: string): string | null {
  const segments = value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, ""),
    );
  if (!segments.length || segments.some((segment) => !segment)) return null;
  const route = `/${segments.join("/")}/`;
  return isSafeComposerRoute(route) ? route : null;
}

function inferPageType(document: LegacyPageDocument): ContentPageTypeId {
  if (document.route.startsWith("/albums/")) return "PT_ALBUM";
  if (document.route === "/gallery/") return "PT_GALLERY";
  return "PT_COMPOSITE";
}

function legacyBlockId(value: string) {
  return `block_${value.replace(/[^a-z0-9_]/gi, "_").slice(0, 84)}`;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function validateJsonValue(value: unknown, path: string, depth: number, errors: string[]) {
  if (depth > 8) {
    errors.push(`${path}: превышена допустимая глубина данных.`);
    return;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path}: число должно быть конечным.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 500) errors.push(`${path}: массив слишком велик.`);
    value.forEach((entry, index) => validateJsonValue(entry, `${path}[${index}]`, depth + 1, errors));
    return;
  }
  if (isRecord(value)) {
    rejectDangerousKeys(value, path, errors);
    Object.entries(value).forEach(([key, entry]) =>
      validateJsonValue(entry, `${path}.${key}`, depth + 1, errors),
    );
    return;
  }
  errors.push(`${path}: неподдерживаемый тип значения.`);
}

function rejectDangerousKeys(value: unknown, path: string, errors: string[]) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectDangerousKeys(entry, `${path}[${index}]`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key.toLowerCase())) errors.push(`${path}.${key}: поле запрещено.`);
    rejectDangerousKeys(entry, `${path}.${key}`, errors);
  }
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
) {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!set.has(key)) errors.push(`${path}.${key}: неизвестное поле.`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: поле обязательно.`);
  }
}

function requireString(
  value: unknown,
  path: string,
  errors: string[],
  min: number,
  max: number,
) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    errors.push(`${path}: требуется строка длиной ${min}–${max}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
