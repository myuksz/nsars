import assert from "node:assert/strict";
import test from "node:test";
import { HOME_SEED } from "../lib/home-seed.ts";
import { SITE_SEEDS } from "../lib/site-seeds.ts";
import {
  clonePageDocument,
  collectMediaIds,
  createMediaBlock,
  PAGE_ROUTE_CONTRACT,
  reindexBlocks,
  routeFromSlugInput,
  stableStringify,
  validatePageDocument,
} from "../lib/page-contract.ts";
import { validateMediaMetadataUpdate } from "../lib/media-contract.ts";
import {
  DEFAULT_NAVIGATION,
  validateNavigationDocument,
} from "../lib/navigation-contract.ts";

const EXPECTED_HERO_COPY = {
  page_home: ["РЕБЁНОК — НЕ ДЕКОР", "Он — автор своей истории."],
  page_kindergarten: ["МИР ЕЩЁ МОЖНО ПРИДУМАТЬ", "Игра задаёт ритм."],
  page_grade4: ["ЕЩЁ ДЕТИ. УЖЕ ХАРАКТЕР.", "Компания становится сюжетом."],
  page_highschool: ["ПРАВО НА СВОЙ ГОЛОС", "Без чужого сценария."],
  page_gallery: ["НЕ БЕСКОНЕЧНАЯ ЛЕНТА", "Отбор важнее количества."],
  page_prices: ["ФОРМАТ — ЭТО РИТМ ИСТОРИИ", "Цена появится только после сверки."],
  page_about: [
    "НАТАЛИЯ АРСЮТКИНА: СМОТРЕТЬ. СЛУШАТЬ. РЕДАКТИРОВАТЬ.",
    "Сначала человек — потом форма.",
  ],
  page_contacts: ["РАЗГОВОР НАЧИНАЕТСЯ С КОНТЕКСТА", "Канал связи ещё не открыт."],
  page_legal: ["ПРАВИЛА — ЧАСТЬ ПРОЕКТА", "Непроверенный текст не публикуется."],
};

test("the Home seed satisfies the extensible CMS contract", () => {
  const result = validatePageDocument(HOME_SEED);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"));
  assert.equal(HOME_SEED.blocks[0].type, "nsars.hero");
  assert.equal(HOME_SEED.blocks.at(-1).type, "nsars.footer");
  assert.equal(
    HOME_SEED.blocks.filter((block) => block.style.visible).length,
    5,
    "empty media slots stay hidden until configured",
  );
});

test("all nine registered public pages satisfy the shared CMS contract", () => {
  assert.equal(SITE_SEEDS.length, 9);
  const routes = new Set();
  const ids = new Set();
  for (const page of SITE_SEEDS) {
    const result = validatePageDocument(page);
    assert.equal(result.ok, true, result.ok ? page.pageId : result.errors.join("\n"));
    assert.equal(routes.has(page.route), false, `duplicate route ${page.route}`);
    assert.equal(ids.has(page.pageId), false, `duplicate page id ${page.pageId}`);
    routes.add(page.route);
    ids.add(page.pageId);
  }
});

test("every synthetic navigation target resolves through the route registry", () => {
  const registeredRoutes = new Set(Object.values(PAGE_ROUTE_CONTRACT));
  const discoveredRoutes = new Set();

  for (const page of SITE_SEEDS) {
    for (const block of page.blocks) {
      const items =
        block.type === "nsars.related"
          ? block.data.items
          : block.type === "nsars.footer"
            ? block.data.navigation
            : [];
      for (const item of items) {
        assert.equal(
          registeredRoutes.has(item.href),
          true,
          `${page.pageId} links to unregistered route ${item.href}`,
        );
        discoveredRoutes.add(item.href);
      }
    }
  }

  assert.deepEqual(
    [...discoveredRoutes].sort(),
    [...registeredRoutes].sort(),
    "all registered routes must be reachable from synthetic navigation",
  );
});

test("Moscow copy contains no Penza, price or contact payload", () => {
  const publicPayload = stableStringify(SITE_SEEDS);
  assert.match(publicPayload, /Москва/i);
  assert.doesNotMatch(publicPayload, /\+7\d|₽|t\.me|vk\.com|Пенза|ns-ars-production\.ru/i);
  assert.doesNotMatch(publicPayload, /https?:\/\//i);
  assert.doesNotMatch(publicPayload, /PLACEHOLDER|MISSING|КОНЦЕПТ|\/workspace|\/root|file:\/\/\//i);
});

test("all nine pages carry explicit Moscow copy and safe internal hero actions", () => {
  const registeredRoutes = new Set(Object.values(PAGE_ROUTE_CONTRACT));

  for (const page of SITE_SEEDS) {
    const hero = page.blocks.find((block) => block.type === "nsars.hero");
    assert.ok(hero, `${page.pageId} needs a hero`);
    assert.match(hero.data.eyebrow, /МОСКВА/i, `${page.pageId} hero must name Moscow`);
    assert.match(page.seo.title, /Москва/i, `${page.pageId} SEO title must name Moscow`);
    assert.match(page.seo.description, /Москв/i, `${page.pageId} SEO description must name Moscow`);
    assert.equal(hero.data.primaryCta.state, "enabled", `${page.pageId} hero action must be enabled`);
    assert.equal(
      registeredRoutes.has(hero.data.primaryCta.href),
      true,
      `${page.pageId} hero action must use a registered internal route`,
    );
    assert.doesNotMatch(hero.data.primaryCta.label, /подключается после проверки/i);
  }
});

test("the Moscow copy pack preserves the approved hero headlines and accents", () => {
  for (const page of SITE_SEEDS) {
    const hero = page.blocks.find((block) => block.type === "nsars.hero");
    assert.deepEqual(
      [hero.data.title, hero.data.accent],
      EXPECTED_HERO_COPY[page.pageId],
      `${page.pageId} approved hero copy changed`,
    );
  }
});

test("visitor copy omits internal release wording", () => {
  const publicPayload = stableStringify(SITE_SEEDS);
  assert.doesNotMatch(
    publicPayload,
    /Канал связи подключается после проверки|маршрута доставки|производственной сверки|Статус визуального архива/i,
  );
});

test("direction-choice links lead to the overview instead of choosing an age", () => {
  const gallery = SITE_SEEDS.find((page) => page.pageId === "page_gallery");
  const about = SITE_SEEDS.find((page) => page.pageId === "page_about");
  const contacts = SITE_SEEDS.find((page) => page.pageId === "page_contacts");
  const legal = SITE_SEEDS.find((page) => page.pageId === "page_legal");
  const galleryHero = gallery.blocks.find((block) => block.type === "nsars.hero");
  const aboutHero = about.blocks.find((block) => block.type === "nsars.hero");
  const contactsRelated = contacts.blocks.find((block) => block.type === "nsars.related");

  assert.equal(galleryHero.data.primaryCta.href, "/");
  assert.equal(aboutHero.data.primaryCta.href, "/");
  assert.equal(contactsRelated.data.items[0].href, "/");
  assert.equal(legal.title, "Правовая информация");
});

test("stable JSON is order-independent for hashes", () => {
  assert.equal(stableStringify({ z: 1, a: { y: 2, x: 3 } }), stableStringify({ a: { x: 3, y: 2 }, z: 1 }));
});

test("unknown blocks and raw-code fields are rejected", () => {
  const unknown = clonePageDocument(HOME_SEED);
  unknown.blocks[0].type = "nsars.not_registered";
  assert.equal(validatePageDocument(unknown).ok, false);

  const raw = clonePageDocument(HOME_SEED);
  raw.blocks[0].data = { ...raw.blocks[0].data, html: "<b>no</b>" };
  const result = validatePageDocument(raw);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /запрещено|неизвестное поле/i);
});

test("media blocks remain structured and only visible dependencies are collected", () => {
  const document = clonePageDocument(HOME_SEED);
  const block = createMediaBlock("nsars.smart_gallery", "block_gallery_test", 0);
  block.data.mediaIds = ["media_12345678"];
  document.blocks = reindexBlocks([
    ...document.blocks.slice(0, -2),
    block,
    ...document.blocks.slice(-2),
  ]);
  assert.equal(validatePageDocument(document).ok, true);
  assert.deepEqual(collectMediaIds(document), []);
  block.style.visible = true;
  assert.deepEqual(collectMediaIds(document), ["media_12345678"]);
});

test("interactive photo windows reject degenerate geometry", () => {
  const document = clonePageDocument(HOME_SEED);
  const block = createMediaBlock(
    "nsars.interactive_page_layout",
    "block_layout_test",
    0,
  );
  block.data.photoWindows[0].quad = [
    { x: 0.1, y: 0.1 },
    { x: 0.2, y: 0.2 },
    { x: 0.3, y: 0.3 },
    { x: 0.4, y: 0.4 },
  ];
  document.blocks = reindexBlocks([
    ...document.blocks.slice(0, -2),
    block,
    ...document.blocks.slice(-2),
  ]);
  const result = validatePageDocument(document);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /площадь/i);
});

test("external targets and early indexing are rejected", () => {
  const external = clonePageDocument(HOME_SEED);
  const related = external.blocks.find((block) => block.type === "nsars.related");
  related.data.items[0].href = "https://example.com";
  assert.equal(validatePageDocument(external).ok, false);

  const indexed = clonePageDocument(HOME_SEED);
  indexed.seo.indexing = "INDEX";
  assert.equal(validatePageDocument(indexed).ok, false);
});

test("real media, contact and price-shaped fields are rejected recursively", () => {
  for (const key of ["media", "email", "price"]) {
    const document = clonePageDocument(HOME_SEED);
    document.blocks[1].data = { ...document.blocks[1].data, [key]: "synthetic" };
    const result = validatePageDocument(document);
    assert.equal(result.ok, false, `${key} should fail`);
    assert.match(result.errors.join("\n"), /запрещено|неизвестное поле/i);
  }
});

test("media release metadata enforces rights, recovery and READY together", () => {
  const base = {
    alt: "Ребёнок рассматривает альбом за столом",
    caption: "",
    fitMode: "cover",
    focalX: 0.5,
    focalY: 0.5,
    rightsStatus: "NOT_GRANTED",
    rightsScope: "",
    lifecycle: "DRAFT",
    recoveryStatus: "PENDING_INDEPENDENT_COPY",
  };
  assert.deepEqual(validateMediaMetadataUpdate(base), base);
  assert.throws(
    () => validateMediaMetadataUpdate({ ...base, lifecycle: "READY" }),
    /права|READY/i,
  );
  assert.doesNotThrow(() =>
    validateMediaMetadataUpdate({
      ...base,
      rightsStatus: "APPROVED",
      rightsScope: "Разрешение владельца зафиксировано в реестре.",
      lifecycle: "READY",
      recoveryStatus: "VERIFIED_INDEPENDENT_COPY",
    }),
  );
});

test("custom pages use safe unique-looking public routes", () => {
  assert.equal(routeFromSlugInput("  New School Story  "), "/new-school-story/");
  assert.equal(routeFromSlugInput("admin"), null);
  assert.equal(routeFromSlugInput("api"), null);
  assert.equal(routeFromSlugInput("кириллица"), null);

  const custom = clonePageDocument(HOME_SEED);
  custom.pageId = "page_custom_1234567890abcdef";
  custom.route = "/new-school-story/";
  custom.title = "Новая история";
  custom.status = "DRAFT";
  assert.equal(validatePageDocument(custom).ok, true);
});

test("typed menu targets only registered pages", () => {
  const known = new Set(SITE_SEEDS.map((page) => page.pageId));
  assert.equal(validateNavigationDocument(DEFAULT_NAVIGATION, known).ok, true);
  const broken = structuredClone(DEFAULT_NAVIGATION);
  broken.items[0].targetPageId = "page_custom_absent";
  const result = validateNavigationDocument(broken, known);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /страница отсутствует/i);
});
