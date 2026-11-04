export const COMPOSER_CONTRACT_VERSION = "nsars-composer.r1" as const;

export const PAGE_TYPE_REGISTRY = [
  {
    id: "PT_COMPOSITE",
    name: "Составная страница",
    shortName: "Составная",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Свободная страница из любых разрешённых блоков.",
  },
  {
    id: "PT_ALBUM",
    name: "Альбом",
    shortName: "Альбом",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Одна фотоистория: текст, фотографии, видео и развороты.",
  },
  {
    id: "PT_GALLERY",
    name: "Галерея альбомов",
    shortName: "Галерея",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Подборка самостоятельных альбомов и серий.",
  },
  {
    id: "PT_SPLASH",
    name: "Страница-заставка",
    shortName: "Заставка",
    shell: "FULLSCREEN",
    nodeKind: "CONTENT",
    description: "Полноэкранная фотография, видео или слайдер.",
  },
  {
    id: "PT_LANDING",
    name: "Лендинг",
    shortName: "Лендинг",
    shell: "HEADERLESS",
    nodeKind: "CONTENT",
    description: "Отдельный сценарий без общей шапки сайта.",
  },
  {
    id: "PT_BLOG",
    name: "Блог",
    shortName: "Блог",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Лента публикаций и редакционных материалов.",
  },
  {
    id: "PT_ANNOUNCEMENTS",
    name: "Анонсы съёмок",
    shortName: "Анонсы",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Датированные анонсы будущих проектов.",
  },
  {
    id: "PT_REVIEWS",
    name: "Страница отзывов",
    shortName: "Отзывы",
    shell: "SITE",
    nodeKind: "CONTENT",
    description: "Текстовые и видеоотзывы с проверенным источником.",
  },
  {
    id: "PT_MENU_GROUP",
    name: "Выпадающее меню",
    shortName: "Меню-группа",
    shell: "NONE",
    nodeKind: "NAVIGATION",
    description: "Группа пунктов навигации без собственной страницы.",
  },
  {
    id: "PT_LINK",
    name: "Ссылка",
    shortName: "Ссылка",
    shell: "NONE",
    nodeKind: "NAVIGATION",
    description: "Типизированная внутренняя или внешняя ссылка.",
  },
] as const;

export type PageTypeId = (typeof PAGE_TYPE_REGISTRY)[number]["id"];
export type ContentPageTypeId = Exclude<PageTypeId, "PT_MENU_GROUP" | "PT_LINK">;
export type PageShell = (typeof PAGE_TYPE_REGISTRY)[number]["shell"];

export type BlockFieldDefinition = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "list" | "media" | "number" | "select" | "toggle";
  help?: string;
  options?: readonly { value: string; label: string }[];
};

export type BlockDefinition = {
  type: BlockType;
  name: string;
  group: string;
  description: string;
  defaultData: Record<string, unknown>;
  fields: readonly BlockFieldDefinition[];
};

const text = (key: string, label: string, help?: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "text",
  help,
});
const textarea = (key: string, label: string, help?: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "textarea",
  help,
});
const list = (key: string, label: string, help?: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "list",
  help,
});
const media = (key: string, label: string, help?: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "media",
  help,
});
const toggle = (key: string, label: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "toggle",
});
const numberField = (key: string, label: string, help?: string): BlockFieldDefinition => ({
  key,
  label,
  kind: "number",
  help,
});
const select = (
  key: string,
  label: string,
  options: readonly { value: string; label: string }[],
): BlockFieldDefinition => ({ key, label, kind: "select", options });

export const BLOCK_REGISTRY = [
  {
    type: "F01",
    name: "Первый экран",
    group: "Основные",
    description: "Крупный заголовок, вводный текст и действие.",
    defaultData: {
      eyebrow: "МОСКВА / ДОМ ДЕТСКОЙ ФОТОГРАФИИ",
      title: "РЕБЁНОК — НЕ ДЕКОР",
      accent: "Он — автор своей истории.",
      body: "Собираем живую редакционную форму вокруг характера ребёнка.",
      actionLabel: "Обсудить проект",
      actionHref: "",
    },
    fields: [
      text("eyebrow", "Верхняя строка"),
      textarea("title", "Заголовок"),
      textarea("accent", "Акцент"),
      textarea("body", "Вводный текст"),
      text("actionLabel", "Текст кнопки"),
      text("actionHref", "Ссылка кнопки", "Внутренний путь, например /contacts/"),
    ],
  },
  {
    type: "F02",
    name: "Текст",
    group: "Основные",
    description: "Заголовок и свободный редакционный текст.",
    defaultData: {
      kicker: "ПОДХОД",
      title: "Ребёнок — не декорация. Он главный герой.",
      body: "Сначала замечаем характер. Затем соединяем портреты, друзей, события и детали в цельную историю.",
    },
    fields: [text("kicker", "Рубрика"), textarea("title", "Заголовок"), textarea("body", "Текст")],
  },
  {
    type: "F03",
    name: "Фотография",
    group: "Фото и видео",
    description: "Один кадр с подписью и управляемой композицией.",
    defaultData: { title: "Кадр серии", body: "", mediaIds: [] },
    fields: [textarea("title", "Заголовок"), textarea("body", "Подпись"), media("mediaIds", "Фотография")],
  },
  {
    type: "F04",
    name: "Фото + текст",
    group: "Фото и видео",
    description: "Две колонки с независимым порядком на мобильном.",
    defaultData: { title: "История одного кадра", body: "", mediaIds: [], reverse: false },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), media("mediaIds", "Фотография"), toggle("reverse", "Фотография справа")],
  },
  {
    type: "F05",
    name: "Галерея",
    group: "Фото и видео",
    description: "Серия фотографий с управляемым ритмом.",
    defaultData: { title: "Не лента красивых кадров. Цельные истории.", body: "Отбор важнее количества.", mediaIds: [], layout: "grid", lightbox: true },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), media("mediaIds", "Фотографии"), select("layout", "Раскладка", [{ value: "grid", label: "Сетка" }, { value: "masonry", label: "Разный ритм" }, { value: "strip", label: "Лента" }]), toggle("lightbox", "Открывать крупнее")],
  },
  {
    type: "F06",
    name: "Слайдер",
    group: "Фото и видео",
    description: "Последовательность кадров с ручным управлением.",
    defaultData: { title: "История меняется кадр за кадром", body: "", mediaIds: [], autoplay: false, intervalSeconds: 6 },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), media("mediaIds", "Слайды"), toggle("autoplay", "Автоматическая смена"), numberField("intervalSeconds", "Интервал, секунд")],
  },
  {
    type: "F07",
    name: "Видео",
    group: "Фото и видео",
    description: "Видео, постер и доступный резервный текст.",
    defaultData: { title: "Видеоистория", body: "", videoUrl: "", mediaIds: [] },
    fields: [textarea("title", "Заголовок"), textarea("body", "Описание / резервный текст"), text("videoUrl", "Ссылка на видео"), media("mediaIds", "Постер")],
  },
  {
    type: "F08",
    name: "Карточки",
    group: "История",
    description: "Направления, услуги или смысловые карточки.",
    defaultData: { title: "Три возраста — три разных разговора", items: ["Детский сад | Игра и открытие | /albums/kindergarten/", "4 класс | Своя компания | /albums/grade-4/", "Старшая школа | Право на свой голос | /albums/high-school/"] },
    fields: [textarea("title", "Заголовок"), list("items", "Карточки", "Одна строка: Заголовок | Текст | /ссылка/")],
  },
  {
    type: "F09",
    name: "Этапы / процесс",
    group: "История",
    description: "Последовательность действий с одной нумерацией.",
    defaultData: { title: "От первой встречи до готового альбома", items: ["Знакомимся | Слушаем задачу и характер класса", "Планируем | Собираем сценарий и ритм", "Снимаем | Оставляем место живому", "Выпускаем | Проверяем историю целиком"] },
    fields: [textarea("title", "Заголовок"), list("items", "Этапы", "Одна строка: Название | Пояснение")],
  },
  {
    type: "F10",
    name: "Числа",
    group: "История",
    description: "Показатели и короткие пояснения.",
    defaultData: { title: "Ритм проекта", items: ["01 | Общая идея", "04 | Главы истории", "∞ | Вариантов сборки"] },
    fields: [textarea("title", "Заголовок"), list("items", "Показатели", "Одна строка: Число | Подпись")],
  },
  {
    type: "F11",
    name: "Комплектации",
    group: "Предложение",
    description: "Сравнение составов без обязательной цены.",
    defaultData: { title: "Выбрать масштаб истории", items: ["XS | Компактная история |", "M | Больше глав и пространства |", "Premium | Индивидуальный масштаб |"] },
    fields: [textarea("title", "Заголовок"), list("items", "Варианты", "Одна строка: Название | Состав | Цена (если утверждена)")],
  },
  {
    type: "F12",
    name: "Отзывы",
    group: "Доверие",
    description: "Карточки отзывов с источником и датой.",
    defaultData: { title: "Что замечают после проекта", items: [] },
    fields: [textarea("title", "Заголовок"), list("items", "Отзывы", "Одна строка: Имя | Текст | Источник / дата")],
  },
  {
    type: "F13",
    name: "Вопросы и ответы",
    group: "Доверие",
    description: "Раскрывающиеся ответы и самостоятельный порядок вопросов.",
    defaultData: { title: "Что важно знать до съёмки", items: ["Как строится съёмочный день? | Сценарий зависит от возраста, места и состава группы.", "Можно ли учесть характер класса? | Да. С этого начинается вся визуальная логика проекта."] },
    fields: [textarea("title", "Заголовок"), list("items", "Вопросы", "Одна строка: Вопрос | Ответ")],
  },
  {
    type: "F14",
    name: "Призыв / баннер",
    group: "Действие",
    description: "Акцентный блок с одним понятным действием.",
    defaultData: { title: "Обсудим историю вашего класса", body: "Начнём с возраста, состава группы и того, что дети хотят сохранить.", actionLabel: "Обсудить проект", actionHref: "/contacts/" },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), text("actionLabel", "Текст кнопки"), text("actionHref", "Ссылка кнопки")],
  },
  {
    type: "F15",
    name: "Форма",
    group: "Действие",
    description: "Поля, согласие и честные состояния отправки.",
    defaultData: { title: "Расскажите о вашем классе", body: "", items: ["Имя", "Телефон или почта", "Возраст и класс"], submitLabel: "Отправить", formState: "DISABLED" },
    fields: [textarea("title", "Заголовок"), textarea("body", "Пояснение"), list("items", "Поля формы"), text("submitLabel", "Текст кнопки"), select("formState", "Состояние", [{ value: "DISABLED", label: "Отключена" }, { value: "READY", label: "Готова" }])],
  },
  {
    type: "F16",
    name: "Контакты",
    group: "Действие",
    description: "Контактная информация и маршрут разговора.",
    defaultData: { title: "Начнём с короткого разговора", body: "Москва", items: [] },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), list("items", "Контакты", "Одна строка: Подпись | Значение | ссылка")],
  },
  {
    type: "F17",
    name: "Файл",
    group: "Материалы",
    description: "Файл, метаданные и контролируемое скачивание.",
    defaultData: { title: "Материал проекта", body: "", mediaIds: [], downloadEnabled: false },
    fields: [textarea("title", "Название"), textarea("body", "Описание"), media("mediaIds", "Файл / изображение"), toggle("downloadEnabled", "Разрешить скачивание")],
  },
  {
    type: "F18",
    name: "Интерактивный макет страницы",
    group: "Особые",
    description: "Разворот и независимые фотоокна.",
    defaultData: { title: "Интерактивный макет страницы", body: "", backgroundMediaId: null, photoWindows: [], intervalSeconds: 6 },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), media("backgroundMediaId", "Фон разворота"), numberField("intervalSeconds", "Интервал, секунд")],
  },
  {
    type: "F19",
    name: "Спецвиджет",
    group: "Особые",
    description: "Только безопасные типизированные виджеты.",
    defaultData: { title: "Навигатор", body: "", widgetType: "AGE_NAVIGATOR" },
    fields: [textarea("title", "Заголовок"), textarea("body", "Текст"), select("widgetType", "Виджет", [{ value: "AGE_NAVIGATOR", label: "Навигатор по возрастам" }, { value: "ANCHOR_NAV", label: "Оглавление страницы" }, { value: "GALLERY_FILTER", label: "Фильтр галереи" }, { value: "BLOG_CATEGORIES", label: "Категории блога" }, { value: "REVIEWS_FILTER", label: "Фильтр отзывов" }])],
  },
  {
    type: "F20",
    name: "Структурный ряд",
    group: "Композиция",
    description: "Ряд из 1–4 самостоятельных колонок.",
    defaultData: {
      title: "",
      columns: 2,
      slots: [
        { slotId: "slot_1", label: "Колонка 1", blocks: [] },
        { slotId: "slot_2", label: "Колонка 2", blocks: [] },
      ],
    },
    fields: [textarea("title", "Заголовок"), numberField("columns", "Колонок, 1–4")],
  },
  {
    type: "F21",
    name: "Разделитель / пространство",
    group: "Композиция",
    description: "Линия, пространство или новая глава.",
    defaultData: { title: "Новая глава", body: "", dividerStyle: "chapter" },
    fields: [text("title", "Подпись"), textarea("body", "Пояснение"), select("dividerStyle", "Вид", [{ value: "chapter", label: "Новая глава" }, { value: "line", label: "Линия" }, { value: "space", label: "Пространство" }])],
  },
] as const;

export type BlockType = (typeof BLOCK_REGISTRY)[number]["type"];

export type ScopedVariant = {
  id: string;
  blockType: BlockType;
  name: string;
  description: string;
  pageTypes: readonly ContentPageTypeId[];
  defaultData: Record<string, unknown>;
};

export const SCOPED_VARIANTS: readonly ScopedVariant[] = [
  { id: "V_COMPOSITE_CHAPTER_NAV", blockType: "F19", name: "Оглавление составной страницы", description: "Навигация по самостоятельно собранным главам.", pageTypes: ["PT_COMPOSITE"], defaultData: { title: "Главы страницы", widgetType: "ANCHOR_NAV" } },
  { id: "V_COMPOSITE_EMBED", blockType: "F07", name: "Безопасная вставка видео", description: "Проверенная ссылка на разрешённый видеосервис с постером и fallback.", pageTypes: ["PT_COMPOSITE"], defaultData: { title: "Видео внутри страницы" } },
  { id: "V_ALBUM_INTRO", blockType: "F02", name: "Вступление к серии", description: "Текст до или после фотографий альбома.", pageTypes: ["PT_ALBUM"], defaultData: { kicker: "АЛЬБОМ", title: "История этой серии" } },
  { id: "V_ALBUM_MEDIA_STREAM", blockType: "F05", name: "Лента альбома", description: "Упорядоченная фотоистория.", pageTypes: ["PT_ALBUM"], defaultData: { title: "Серия альбома", layout: "strip" } },
  { id: "V_ALBUM_VIDEO", blockType: "F07", name: "Видео в альбоме", description: "Видео внутри фотоистории.", pageTypes: ["PT_ALBUM"], defaultData: { title: "Видеоистория серии" } },
  { id: "V_ALBUM_SPREAD", blockType: "F18", name: "Интерактивный разворот", description: "Разворот с независимыми фотоокнами.", pageTypes: ["PT_ALBUM"], defaultData: { title: "Рабочий разворот альбома" } },
  { id: "V_GALLERY_INTRO", blockType: "F02", name: "Вступление галереи", description: "Текст до списка альбомов.", pageTypes: ["PT_GALLERY"], defaultData: { kicker: "ГАЛЕРЕЯ", title: "Истории, собранные вместе" } },
  { id: "V_GALLERY_ALBUM_LIST", blockType: "F08", name: "Список альбомов", description: "Карточки самостоятельных альбомов.", pageTypes: ["PT_GALLERY"], defaultData: { title: "Выберите историю" } },
  { id: "V_GALLERY_FILTER", blockType: "F19", name: "Фильтр альбомов", description: "Фильтр по возрасту и формату.", pageTypes: ["PT_GALLERY"], defaultData: { title: "Найти свою историю", widgetType: "GALLERY_FILTER" } },
  { id: "V_SPLASH_PHOTO", blockType: "F01", name: "Фотозаставка", description: "Полноэкранный кадр с заголовком.", pageTypes: ["PT_SPLASH"], defaultData: { title: "ИСТОРИЯ НАЧИНАЕТСЯ С ОДНОГО КАДРА" } },
  { id: "V_SPLASH_VIDEO", blockType: "F07", name: "Видеозаставка", description: "Полноэкранное видео с постером.", pageTypes: ["PT_SPLASH"], defaultData: { title: "Видео на первом экране" } },
  { id: "V_SPLASH_SLIDER", blockType: "F06", name: "Слайдер-заставка", description: "Полноэкранная последовательность кадров.", pageTypes: ["PT_SPLASH"], defaultData: { title: "Несколько кадров одной истории" } },
  { id: "V_LANDING_HERO", blockType: "F01", name: "Обложка лендинга", description: "Первый экран без общей шапки.", pageTypes: ["PT_LANDING"], defaultData: { eyebrow: "МОСКВА / ОТДЕЛЬНЫЙ ПРОЕКТ", title: "СТРАНИЦА СО СВОИМ СЦЕНАРИЕМ" } },
  { id: "V_LANDING_ANCHOR_NAV", blockType: "F19", name: "Навигация по лендингу", description: "Переходы по главам одной страницы.", pageTypes: ["PT_LANDING"], defaultData: { title: "Разделы проекта", widgetType: "ANCHOR_NAV" } },
  { id: "V_BLOG_FEED", blockType: "F08", name: "Лента публикаций", description: "Карточки редакционных материалов.", pageTypes: ["PT_BLOG"], defaultData: { title: "Заметки Дома детской фотографии" } },
  { id: "V_BLOG_POST_CARD", blockType: "F04", name: "Карточка публикации", description: "Обложка и краткое вступление.", pageTypes: ["PT_BLOG"], defaultData: { title: "Название публикации" } },
  { id: "V_BLOG_CATEGORIES", blockType: "F19", name: "Категории блога", description: "Навигация по темам публикаций.", pageTypes: ["PT_BLOG"], defaultData: { title: "Темы", widgetType: "BLOG_CATEGORIES" } },
  { id: "V_ANNOUNCEMENTS_FEED", blockType: "F08", name: "Лента анонсов", description: "Датированные карточки будущих проектов.", pageTypes: ["PT_ANNOUNCEMENTS"], defaultData: { title: "Ближайшие съёмочные проекты" } },
  { id: "V_ANNOUNCEMENTS_CARD", blockType: "F04", name: "Карточка анонса", description: "Обложка, дата, место и статус.", pageTypes: ["PT_ANNOUNCEMENTS"], defaultData: { title: "Название анонса" } },
  { id: "V_ANNOUNCEMENTS_FORM", blockType: "F15", name: "Запись на анонс", description: "Форма интереса к выбранному проекту.", pageTypes: ["PT_ANNOUNCEMENTS"], defaultData: { title: "Узнать о проекте" } },
  { id: "V_REVIEWS_FEED", blockType: "F12", name: "Лента отзывов", description: "Проверенные текстовые отзывы.", pageTypes: ["PT_REVIEWS"], defaultData: { title: "Что замечают после проекта" } },
  { id: "V_REVIEWS_VIDEO", blockType: "F07", name: "Видеоотзыв", description: "Видео с постером, согласием и fallback.", pageTypes: ["PT_REVIEWS"], defaultData: { title: "Видеоотзыв" } },
  { id: "V_REVIEWS_FILTER", blockType: "F19", name: "Фильтр отзывов", description: "Фильтр по проекту и формату.", pageTypes: ["PT_REVIEWS"], defaultData: { title: "Отзывы по проектам", widgetType: "REVIEWS_FILTER" } },
];

export const blockDefinitionByType = Object.fromEntries(
  BLOCK_REGISTRY.map((definition) => [definition.type, definition]),
) as Record<BlockType, (typeof BLOCK_REGISTRY)[number]>;

export const pageTypeById = Object.fromEntries(
  PAGE_TYPE_REGISTRY.map((definition) => [definition.id, definition]),
) as Record<PageTypeId, (typeof PAGE_TYPE_REGISTRY)[number]>;

export const variantById = Object.fromEntries(
  SCOPED_VARIANTS.map((variant) => [variant.id, variant]),
) as Record<string, ScopedVariant>;

export function variantsForPageType(pageType: ContentPageTypeId) {
  return SCOPED_VARIANTS.filter((variant) => variant.pageTypes.includes(pageType));
}

export function isVariantAllowed(variantId: string | undefined, pageType: ContentPageTypeId) {
  if (!variantId) return true;
  const variant = variantById[variantId];
  return Boolean(variant?.pageTypes.includes(pageType));
}

export function createBlockId() {
  return `block_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createComposerBlock(
  type: BlockType,
  position: number,
  variantId?: string,
) {
  const definition = blockDefinitionByType[type];
  if (!definition) throw new Error(`Неизвестный блок ${type}.`);
  const variant = variantId ? variantById[variantId] : undefined;
  if (variant && variant.blockType !== type) {
    throw new Error(`Вариант ${variantId} не относится к блоку ${type}.`);
  }
  return {
    blockId: createBlockId(),
    type,
    variantId: variant?.id ?? null,
    schemaVersion: "1.0.0",
    position,
    hidden: false,
    data: structuredClone({ ...definition.defaultData, ...(variant?.defaultData ?? {}) }),
    layout: {
      width: "wide",
      align: "left",
      tone: type === "F14" ? "ink" : "paper",
      spacingTop: "l",
      spacingBottom: "l",
      fullBleed: type === "F01",
    },
    responsive: {
      hideDesktop: false,
      hideTablet: false,
      hideMobile: false,
      mobileAlign: "inherit",
    },
  };
}
