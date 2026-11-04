import { HOME_SEED } from "./home-seed.ts";
import type {
  BlockStyle,
  MediaBlockType,
  PageDocument,
  PublicPageId,
  Theme,
} from "./page-contract";
import { createMediaBlock, reindexBlocks } from "./page-contract.ts";

type SeedConfig = {
  pageId: PublicPageId;
  route: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  contentType: string;
  visualLine?: "none" | "AIR" | "BASE" | "NIGHT";
  age?: "none" | "kindergarten" | "grade4" | "highschool";
  palette: [Theme, Theme, Theme];
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    body: string;
    actionLabel: string;
    actionHref: string;
  };
  manifesto: {
    kicker: string;
    heading: string;
    body: string[];
  };
  processHeading: string;
  steps: Array<{ number: string; title: string; body: string }>;
  relatedHeading: string;
  related: Array<{ eyebrow: string; title: string; body: string; href: string }>;
  mediaSlots?: MediaBlockType[];
};

const footer = {
  brand: "NS—ARS / ДОМ ДЕТСКОЙ ФОТОГРАФИИ АРСЮТКИНОЙ НАТАЛИИ",
  navigation: [
    { label: "Главная", href: "/" },
    { label: "Работы", href: "/gallery/" },
    { label: "Комплектации", href: "/prices/" },
    { label: "О нас", href: "/about/" },
    { label: "Контакты", href: "/contacts/" },
    { label: "Правовая информация", href: "/legal/" },
  ],
  legalStatus:
    "Предрелизная версия. Реквизиты, форма и правовые тексты подключаются только после проверки.",
};

function style(
  theme: Theme,
  overrides: Partial<BlockStyle> = {},
): BlockStyle {
  return {
    theme,
    background: null,
    surface: "none",
    contentWidth: "wide",
    spacingTop: "xl",
    spacingBottom: "xl",
    fullBleed: true,
    visible: true,
    responsiveOverrides: {},
    ...overrides,
  };
}

function makePage(config: SeedConfig): PageDocument {
  return {
    pageId: config.pageId,
    route: config.route,
    title: config.title,
    status: "DRAFT",
    taxonomies: {
      age: config.age ?? "none",
      visualLine: config.visualLine ?? "none",
      package: "none",
      contentType: config.contentType,
      lifecycle: "owner_content_r5_2",
    },
    blocks: reindexBlocks([
      {
        blockId: `${config.pageId}_hero`,
        type: "nsars.hero",
        schemaVersion: "1.0.0",
        position: 0,
        data: {
          eyebrow: config.hero.eyebrow,
          title: config.hero.title,
          accent: config.hero.accent,
          body: config.hero.body,
          primaryCta: {
            label: config.hero.actionLabel,
            href: config.hero.actionHref,
            state: "enabled",
          },
          secondaryCta: null,
          visualMode: "editorial_shapes",
        },
        style: style(config.palette[0]),
      },
      {
        blockId: `${config.pageId}_manifesto`,
        type: "nsars.rich_text",
        schemaVersion: "1.0.0",
        position: 1,
        data: {
          ...config.manifesto,
          alignment: "split",
        },
        style: style(config.palette[1]),
      },
      {
        blockId: `${config.pageId}_process`,
        type: "nsars.process",
        schemaVersion: "1.0.0",
        position: 2,
        data: {
          heading: config.processHeading,
          steps: config.steps,
        },
        style: style("paper"),
      },
      ...(config.mediaSlots ?? []).map((type, index) =>
        createMediaBlock(type, `${config.pageId}_media_${index + 1}`, 0),
      ),
      {
        blockId: `${config.pageId}_related`,
        type: "nsars.related",
        schemaVersion: "1.0.0",
        position: 3,
        data: {
          heading: config.relatedHeading,
          items: config.related,
        },
        style: style(config.palette[2]),
      },
      {
        blockId: `${config.pageId}_footer`,
        type: "nsars.footer",
        schemaVersion: "1.0.0",
        position: 4,
        data: footer,
        style: style("ink", { spacingTop: "l", spacingBottom: "l" }),
      },
    ]),
    seo: {
      title: config.seoTitle,
      description: config.seoDescription,
      indexing: "NOINDEX",
      canonical: null,
    },
  };
}

const kindergarten = makePage({
  pageId: "page_kindergarten",
  route: "/albums/kindergarten/",
  title: "Детский сад",
  seoTitle: "Фотопроект для детского сада — Москва | Дом детской фотографии",
  seoDescription:
    "Фотопроекты для детского сада в Москве: игра, движение и право ребёнка оставаться собой.",
  contentType: "direction",
  age: "kindergarten",
  visualLine: "AIR",
  mediaSlots: ["nsars.mixed_slider", "nsars.interactive_page_layout"],
  palette: ["ochre", "ink", "red"],
  hero: {
    eyebrow: "ДЕТСКИЙ САД / МОСКВА",
    title: "МИР ЕЩЁ МОЖНО ПРИДУМАТЬ",
    accent: "Игра задаёт ритм.",
    body:
      "Для этого возраста важны движение, любопытство и свободная смена ролей — без взрослой серьёзности и готовых масок.",
    actionLabel: "Узнать наш подход",
    actionHref: "/about/",
  },
  manifesto: {
    kicker: "ВОЗРАСТ",
    heading: "Меньше сценария. Больше открытия.",
    body: [
      "Визуальный язык начинается с наблюдения: как ребёнок входит в пространство, что выбирает и когда забывает о камере.",
      "Цвет, предмет и графика поддерживают игру, но не подменяют самого героя.",
    ],
  },
  processHeading: "Из чего складывается язык игры",
  steps: [
    { number: "01", title: "Движение", body: "Живой ритм вместо неподвижной постановки." },
    { number: "02", title: "Предмет", body: "Один понятный импульс, который можно присвоить и переиграть." },
    { number: "03", title: "Пауза", body: "Место для тихого портрета и собственной интонации." },
    { number: "04", title: "Группа", body: "Общая история без потери отдельных характеров." },
  ],
  relatedHeading: "Продолжить маршрут",
  related: [
    { eyebrow: "СЛЕДУЮЩИЙ ВОЗРАСТ", title: "4 класс", body: "Энергия компании и заметный характер.", href: "/albums/grade-4/" },
    { eyebrow: "РЕДАКЦИОННЫЙ ОТБОР", title: "Работы", body: "Цельные серии с характером и внутренним ритмом.", href: "/gallery/" },
    { eyebrow: "ПЕРВЫЙ ШАГ", title: "Контакты", body: "Что подготовить до первого разговора.", href: "/contacts/" },
  ],
});

const grade4 = makePage({
  pageId: "page_grade4",
  route: "/albums/grade-4/",
  title: "4 класс",
  seoTitle: "Фотопроект для 4 класса — Москва | Дом детской фотографии",
  seoDescription:
    "Фотопроекты для 4 класса в Москве: дружба, движение, юмор и индивидуальность.",
  contentType: "direction",
  age: "grade4",
  visualLine: "BASE",
  mediaSlots: ["nsars.mixed_slider", "nsars.interactive_page_layout"],
  palette: ["cobalt", "ink", "ochre"],
  hero: {
    eyebrow: "4 КЛАСС / МОСКВА",
    title: "ЕЩЁ ДЕТИ. УЖЕ ХАРАКТЕР.",
    accent: "Компания становится сюжетом.",
    body:
      "В этом возрасте рядом живут игра, самоирония и первые самостоятельные решения — визуальный ритм должен выдержать всё сразу.",
    actionLabel: "Узнать наш подход",
    actionHref: "/about/",
  },
  manifesto: {
    kicker: "ПЕРЕХОД",
    heading: "Не сглаживать разницу между героями.",
    body: [
      "Общая история работает, когда каждый узнаёт в ней себя, друзей и характер своей компании.",
      "Графика держит темп, а портреты оставляют достаточно воздуха для индивидуальности.",
    ],
  },
  processHeading: "Четыре слоя общей истории",
  steps: [
    { number: "01", title: "Портрет", body: "Спокойная точка, где герой остаётся один на один с кадром." },
    { number: "02", title: "Дуэт", body: "Дружба проявляется в жестах, дистанции и общем юморе." },
    { number: "03", title: "Команда", body: "Движение и связи внутри класса становятся композицией." },
    { number: "04", title: "Деталь", body: "Маленькие признаки времени собирают память точнее декора." },
  ],
  relatedHeading: "Соседние направления",
  related: [
    { eyebrow: "МЛАДШЕ", title: "Детский сад", body: "Игра и открытие без взрослого сценария.", href: "/albums/kindergarten/" },
    { eyebrow: "СТАРШЕ", title: "Старшая школа", body: "Право на собственный визуальный голос.", href: "/albums/high-school/" },
    { eyebrow: "ФОРМАТ", title: "Комплектации", body: "Из чего складывается объём общей истории.", href: "/prices/" },
  ],
});

const highschool = makePage({
  pageId: "page_highschool",
  route: "/albums/high-school/",
  title: "Старшая школа",
  seoTitle: "Фотопроект для старшей школы — Москва | Дом детской фотографии",
  seoDescription:
    "Фотопроекты для 9–11 классов в Москве: самостоятельность, честный портрет и собственный голос.",
  contentType: "direction",
  age: "highschool",
  visualLine: "NIGHT",
  mediaSlots: ["nsars.mixed_slider", "nsars.interactive_page_layout"],
  palette: ["ink", "red", "cobalt"],
  hero: {
    eyebrow: "9–11 КЛАССЫ / МОСКВА",
    title: "ПРАВО НА СВОЙ ГОЛОС",
    accent: "Без чужого сценария.",
    body:
      "Старшеклассник уже сам выбирает дистанцию, образ и степень открытости. Редакционный язык должен это уважать.",
    actionLabel: "Узнать наш подход",
    actionHref: "/about/",
  },
  manifesto: {
    kicker: "САМОСТОЯТЕЛЬНОСТЬ",
    heading: "Портрет не обязан объяснять всё.",
    body: [
      "В кадре может остаться пауза, прямой взгляд, движение или отказ от привычной школьной роли.",
      "Типографика и цвет работают жёстче, но не перекрикивают героя.",
    ],
  },
  processHeading: "Редакционный ритм старшей школы",
  steps: [
    { number: "01", title: "Выбор", body: "Герой понимает задачу и сохраняет право на границы." },
    { number: "02", title: "Серия", body: "Один портрет дополняется движением, деталями и связями." },
    { number: "03", title: "Контраст", body: "Тишина и энергия чередуются, не превращаясь в шаблон." },
    { number: "04", title: "Редактура", body: "Финальный порядок создаёт историю, а не каталог." },
  ],
  relatedHeading: "Дальше по сайту",
  related: [
    { eyebrow: "ВИЗУАЛЬНЫЙ АРХИВ", title: "Работы", body: "Почему отбор важнее бесконечной ленты.", href: "/gallery/" },
    { eyebrow: "СТРУКТУРА", title: "Комплектации", body: "Что влияет на масштаб и глубину истории.", href: "/prices/" },
    { eyebrow: "ПОДХОД", title: "О нас", body: "Наблюдение, съёмка и редактура как единый процесс.", href: "/about/" },
  ],
});

const gallery = makePage({
  pageId: "page_gallery",
  route: "/gallery/",
  title: "Работы",
  seoTitle: "Работы — Дом детской фотографии, Москва",
  seoDescription:
    "Редакционный отбор детских и школьных фотопроектов Дома детской фотографии в Москве.",
  contentType: "works",
  mediaSlots: ["nsars.smart_gallery", "nsars.mixed_slider"],
  palette: ["red", "ink", "cobalt"],
  hero: {
    eyebrow: "РАБОТЫ / МОСКВА",
    title: "НЕ БЕСКОНЕЧНАЯ ЛЕНТА",
    accent: "Отбор важнее количества.",
    body:
      "Здесь будут появляться только цельные серии: портреты, движение, детали и отношения внутри группы — без случайного набора кадров.",
    actionLabel: "Выбрать возраст",
    actionHref: "/",
  },
  manifesto: {
    kicker: "КРИТЕРИЙ",
    heading: "Работа должна держать историю без пояснений.",
    body: [
      "В отбор входят не все удачные кадры, а серии с ясным характером, внутренним ритмом и уважением к герою.",
      "Каждая серия проходит отдельную редактуру, чтобы сохранить характер героя и цельность рассказа.",
    ],
  },
  processHeading: "Как рождается серия",
  steps: [
    { number: "01", title: "Наблюдение", body: "Сначала замечаем характер, связи и естественный ритм группы." },
    { number: "02", title: "Серия", body: "Портрет, движение и детали работают как части одной истории." },
    { number: "03", title: "Отбор", body: "Убираем повторы и всё, что не помогает рассказу." },
    { number: "04", title: "Цельность", body: "Финальный порядок удерживает интонацию от первого кадра до последнего." },
  ],
  relatedHeading: "Выбрать возрастной язык",
  related: [
    { eyebrow: "ДЕТСКИЙ САД", title: "Игра", body: "Движение, предмет и открытие.", href: "/albums/kindergarten/" },
    { eyebrow: "4 КЛАСС", title: "Компания", body: "Дружба, темп и индивидуальность.", href: "/albums/grade-4/" },
    { eyebrow: "СТАРШАЯ ШКОЛА", title: "Голос", body: "Самостоятельность и честный портрет.", href: "/albums/high-school/" },
  ],
});

const prices = makePage({
  pageId: "page_prices",
  route: "/prices/",
  title: "Комплектации",
  seoTitle: "Комплектации — Дом детской фотографии, Москва",
  seoDescription:
    "Принципы комплектации детских и школьных фотопроектов в Москве без неподтверждённых цен и условий.",
  contentType: "packages",
  palette: ["ochre", "ink", "petrol"],
  hero: {
    eyebrow: "КОМПЛЕКТАЦИИ / МОСКВА",
    title: "ФОРМАТ — ЭТО РИТМ ИСТОРИИ",
    accent: "Цена появится только после сверки.",
    body:
      "Комплектация зависит от возраста, состава группы и глубины общей истории. Точные условия определяются только для конкретного проекта.",
    actionLabel: "Подготовиться к разговору",
    actionHref: "/contacts/",
  },
  manifesto: {
    kicker: "ПРОЗРАЧНОСТЬ",
    heading: "Никаких цифр, которые могут измениться после разговора.",
    body: [
      "Один состав должен быть понятен всем: детям, родителям и команде проекта. Поэтому объём, этапы и результат определяются для конкретной истории.",
      "Выбор начинается не с названия пакета, а с того, сколько героев, сцен и самостоятельных глав нужно сохранить.",
    ],
  },
  processHeading: "Что определяет комплектацию",
  steps: [
    { number: "01", title: "Герои", body: "Состав группы и роль индивидуальных историй." },
    { number: "02", title: "Ритм", body: "Соотношение портретов, общих сцен и деталей." },
    { number: "03", title: "Редактура", body: "Количество самостоятельных глав и глубина согласования." },
    { number: "04", title: "Формат", body: "Итоговая форма следует за содержанием проекта." },
  ],
  relatedHeading: "Три масштаба истории",
  related: [
    { eyebrow: "XS", title: "Компактная история", body: "Сфокусированный рассказ с ясным ритмом.", href: "/contacts/" },
    { eyebrow: "M", title: "История группы", body: "Баланс индивидуальных портретов и общей линии.", href: "/contacts/" },
    { eyebrow: "PREMIUM", title: "Расширенная редакция", body: "Больше пространства для глав, деталей и вариативности.", href: "/contacts/" },
  ],
});

const about = makePage({
  pageId: "page_about",
  route: "/about/",
  title: "О нас",
  seoTitle: "О нас — Дом детской фотографии, Москва",
  seoDescription:
    "Подход Наталии Арсюткиной к детским и школьным фотопроектам в Москве: наблюдение, уважение к герою и цельная история.",
  contentType: "about",
  palette: ["petrol", "ink", "red"],
  hero: {
    eyebrow: "О НАС / МОСКВА",
    title: "НАТАЛИЯ АРСЮТКИНА: СМОТРЕТЬ. СЛУШАТЬ. РЕДАКТИРОВАТЬ.",
    accent: "Сначала человек — потом форма.",
    body:
      "Наталия — основной фотограф и автор бренда. Дом детской фотографии строит визуальную систему вокруг характера ребёнка, а не вокруг готового декора.",
    actionLabel: "Посмотреть направления",
    actionHref: "/",
  },
  manifesto: {
    kicker: "ПОЗИЦИЯ",
    heading: "Не обещать естественность. Создавать для неё условия.",
    body: [
      "Внимание к границам, темпу и интересам героя начинается до кадра и продолжается в отборе.",
      "Съёмка, дизайн и редактура рассматриваются как одна работа — так история не распадается на случайные страницы.",
    ],
  },
  processHeading: "Четыре редакционных вопроса",
  steps: [
    { number: "01", title: "Кто герой?", body: "Не возраст вообще, а конкретная интонация и характер." },
    { number: "02", title: "Что важно?", body: "Связи, детали и события, которые узнаются без подписи." },
    { number: "03", title: "Что убрать?", body: "Всё, что перетягивает внимание с ребёнка на декор." },
    { number: "04", title: "Что останется?", body: "Цельная история, к которой можно вернуться спустя время." },
  ],
  relatedHeading: "Посмотреть систему в действии",
  related: [
    { eyebrow: "МЕТОД", title: "Работы", body: "Цельные серии вместо случайного набора кадров.", href: "/gallery/" },
    { eyebrow: "МАСШТАБ", title: "Комплектации", body: "Как масштаб истории связан с её содержанием.", href: "/prices/" },
    { eyebrow: "ДИАЛОГ", title: "Контакты", body: "Что поможет начать предметный разговор.", href: "/contacts/" },
  ],
});

const contacts = makePage({
  pageId: "page_contacts",
  route: "/contacts/",
  title: "Контакты",
  seoTitle: "Контакты — Дом детской фотографии, Москва",
  seoDescription:
    "Как подготовиться к первому разговору о детском или школьном фотопроекте в Москве.",
  contentType: "contacts",
  palette: ["cobalt", "ink", "ochre"],
  hero: {
    eyebrow: "КОНТАКТЫ / МОСКВА",
    title: "РАЗГОВОР НАЧИНАЕТСЯ С КОНТЕКСТА",
    accent: "Канал связи ещё не открыт.",
    body:
      "Чтобы разговор сразу был предметным, достаточно обозначить возраст, примерный состав группы и желаемую интонацию проекта. Подтверждённый канал связи будет добавлен отдельно.",
    actionLabel: "Посмотреть наш подход",
    actionHref: "/about/",
  },
  manifesto: {
    kicker: "БЕЗОПАСНОСТЬ",
    heading: "Берём только то, что действительно нужно для разговора.",
    body: [
      "До появления подтверждённого канала сайт не просит оставлять персональные данные.",
      "Когда связь будет подключена, форма должна объяснять цель обращения и запрашивать только необходимое.",
    ],
  },
  processHeading: "Что пригодится для первого разговора",
  steps: [
    { number: "01", title: "Возраст", body: "Возрастная группа помогает выбрать правильный визуальный язык." },
    { number: "02", title: "Группа", body: "Примерный состав показывает масштаб общей истории." },
    { number: "03", title: "Интонация", body: "Спокойная, игровая или более редакционная подача." },
    { number: "04", title: "Границы", body: "Что важно учесть и чего точно не должно быть." },
  ],
  relatedHeading: "С чего начать знакомство",
  related: [
    { eyebrow: "ВОЗРАСТ", title: "Направления", body: "Выберите язык конкретного возраста.", href: "/" },
    { eyebrow: "ПОДХОД", title: "О нас", body: "Как принимаются редакционные решения.", href: "/about/" },
    { eyebrow: "ПРАВИЛА", title: "Правовая информация", body: "Принципы работы с данными и изображениями.", href: "/legal/" },
  ],
});

const legal = makePage({
  pageId: "page_legal",
  route: "/legal/",
  title: "Правовая информация",
  seoTitle: "Правовая информация — Дом детской фотографии, Москва",
  seoDescription:
    "Правовая информация проекта Дома детской фотографии в Москве: заказ, обработка данных и публикация изображений.",
  contentType: "legal_status",
  palette: ["ink", "red", "petrol"],
  hero: {
    eyebrow: "ПРАВОВАЯ ИНФОРМАЦИЯ / МОСКВА",
    title: "ПРАВИЛА — ЧАСТЬ ПРОЕКТА",
    accent: "Непроверенный текст не публикуется.",
    body:
      "В этом разделе будут собраны проверенные документы о заказе, обработке данных и публикации изображений. Неподтверждённые версии не используются.",
    actionLabel: "Вернуться к работам",
    actionHref: "/gallery/",
  },
  manifesto: {
    kicker: "ПРИНЦИП",
    heading: "Красивый интерфейс не заменяет точные основания.",
    body: [
      "Все документы должны соответствовать реальному процессу работы и быть понятны без профессионального перевода.",
      "До завершения проверки здесь не размещаются реквизиты, условия и тексты согласий.",
    ],
  },
  processHeading: "Какие документы появятся в разделе",
  steps: [
    { number: "01", title: "Договор", body: "Условия конкретного заказа и порядок согласования." },
    { number: "02", title: "Данные", body: "Цель обработки, состав сведений и сроки хранения." },
    { number: "03", title: "Согласия", body: "Отдельные решения о съёмке и публичном показе." },
    { number: "04", title: "Изображения", body: "Условия использования конкретных фотографий." },
  ],
  relatedHeading: "Связанные разделы",
  related: [
    { eyebrow: "ДАННЫЕ", title: "Контакты", body: "Как начнётся разговор о проекте.", href: "/contacts/" },
    { eyebrow: "ИЗОБРАЖЕНИЯ", title: "Работы", body: "Как устроен редакционный отбор.", href: "/gallery/" },
    { eyebrow: "УСЛОВИЯ", title: "Комплектации", body: "Как выбирать масштаб истории.", href: "/prices/" },
  ],
});

export const SITE_SEEDS: readonly PageDocument[] = [
  HOME_SEED,
  kindergarten,
  grade4,
  highschool,
  gallery,
  prices,
  about,
  contacts,
  legal,
];

export const SITE_PAGE_OPTIONS = SITE_SEEDS.map((page) => ({
  pageId: page.pageId as PublicPageId,
  route: page.route,
  label: page.title,
}));

export function seedForPage(pageId: string) {
  return SITE_SEEDS.find((page) => page.pageId === pageId);
}

export function seedForRoute(route: string) {
  return SITE_SEEDS.find((page) => page.route === route);
}
