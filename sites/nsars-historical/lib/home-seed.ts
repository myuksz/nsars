import type { BlockStyle, PageDocument } from "./page-contract";
import { createMediaBlock, reindexBlocks } from "./page-contract.ts";

function style(
  theme: BlockStyle["theme"],
  overrides: Partial<BlockStyle> = {},
): BlockStyle {
  return {
    theme,
    background: null,
    surface: "none",
    contentWidth: "standard",
    spacingTop: "l",
    spacingBottom: "l",
    fullBleed: false,
    visible: true,
    responsiveOverrides: {},
    ...overrides,
  };
}

export const HOME_SEED: PageDocument = {
  pageId: "page_home",
  route: "/",
  title: "Дом детской фотографии Арсюткиной Наталии",
  status: "DRAFT",
  taxonomies: {
    age: "none",
    visualLine: "none",
    package: "none",
    contentType: "home",
    lifecycle: "owner_content_r5_2",
  },
  blocks: reindexBlocks([
    {
      blockId: "home_hero",
      type: "nsars.hero",
      schemaVersion: "1.0.0",
      position: 0,
      data: {
        eyebrow: "ДОМ ДЕТСКОЙ ФОТОГРАФИИ / МОСКВА",
        title: "РЕБЁНОК — НЕ ДЕКОР",
        accent: "Он — автор своей истории.",
        body:
          "Создаём в Москве живые детские и школьные фотопроекты вокруг характера ребёнка — внимательно, смело и без готовых масок.",
        primaryCta: {
          label: "Узнать наш подход",
          href: "/about/",
          state: "enabled",
        },
        secondaryCta: null,
        visualMode: "editorial_shapes",
      },
      style: style("paper", {
        fullBleed: true,
        contentWidth: "wide",
        spacingTop: "m",
        spacingBottom: "xl",
      }),
    },
    {
      blockId: "home_manifesto",
      type: "nsars.rich_text",
      schemaVersion: "1.0.0",
      position: 1,
      data: {
        kicker: "ПОДХОД",
        heading: "Не просим ребёнка сыграть удобную роль.",
        body: [
          "Сначала наблюдаем: что увлекает, как звучит голос, где появляется смелость и что хочется оставить за кадром.",
          "Затем строим визуальный ритм — не вокруг шаблона, а вокруг конкретной детской интонации.",
        ],
        alignment: "split",
      },
      style: style("ink", {
        fullBleed: true,
        contentWidth: "wide",
        spacingTop: "xl",
        spacingBottom: "xl",
      }),
    },
    {
      blockId: "home_process",
      type: "nsars.process",
      schemaVersion: "1.0.0",
      position: 2,
      data: {
        heading: "История собирается по главам",
        steps: [
          {
            number: "01",
            title: "Слушаем",
            body: "Знакомимся с характером, интересами и границами будущего героя.",
          },
          {
            number: "02",
            title: "Проектируем",
            body: "Находим ритм, среду и графический язык именно этой истории.",
          },
          {
            number: "03",
            title: "Снимаем",
            body: "Оставляем место движению, паузам и неожиданным поворотам.",
          },
          {
            number: "04",
            title: "Редактируем",
            body: "Собираем цельное повествование, где важен каждый разворот.",
          },
        ],
      },
      style: style("paper", {
        contentWidth: "wide",
        spacingTop: "xl",
        spacingBottom: "xl",
      }),
    },
    createMediaBlock("nsars.mixed_slider", "page_home_media_1", 0),
    createMediaBlock("nsars.smart_gallery", "page_home_media_2", 0),
    {
      blockId: "home_related",
      type: "nsars.related",
      schemaVersion: "1.0.0",
      position: 3,
      data: {
        heading: "Три возраста — три разных языка",
        items: [
          {
            eyebrow: "ДЕТСКИЙ САД",
            title: "Игра и открытие",
            body: "Мир, который ещё можно придумать целиком.",
            href: "/albums/kindergarten/",
          },
          {
            eyebrow: "4 КЛАСС",
            title: "Своя компания",
            body: "Дружба, юмор и первый общий маршрут.",
            href: "/albums/grade-4/",
          },
          {
            eyebrow: "СТАРШАЯ ШКОЛА",
            title: "Право на свой голос",
            body: "Портрет без чужого сценария.",
            href: "/albums/high-school/",
          },
        ],
      },
      style: style("petrol", {
        fullBleed: true,
        contentWidth: "wide",
        spacingTop: "xl",
        spacingBottom: "xl",
      }),
    },
    {
      blockId: "home_footer",
      type: "nsars.footer",
      schemaVersion: "1.0.0",
      position: 4,
      data: {
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
          "Предрелизная версия. Публичные каналы связи будут подключены после проверки.",
      },
      style: style("ink", {
        fullBleed: true,
        contentWidth: "wide",
        spacingTop: "l",
        spacingBottom: "l",
      }),
    },
  ]),
  seo: {
    title: "Дом детской фотографии Арсюткиной Наталии — Москва",
    description:
      "Детские и школьные фотопроекты в Москве, собранные вокруг характера и собственной истории ребёнка.",
    indexing: "NOINDEX",
    canonical: null,
  },
};

export const HOME_PUBLISHED_SEED: PageDocument = {
  ...HOME_SEED,
  status: "PUBLISHED",
};
