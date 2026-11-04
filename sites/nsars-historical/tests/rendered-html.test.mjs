import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createFakeD1 } from "./fake-d1.mjs";

const database = createFakeD1();
const runtime = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  DB: database,
};
globalThis.__NSARS_TEST_ENV = runtime;

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const context = {
  waitUntil() {},
  passThroughOnException() {},
};
after(() => {
  database.close();
  delete globalThis.__NSARS_TEST_ENV;
});
const publicRoutes = [
  "/",
  "/albums/kindergarten/",
  "/albums/grade-4/",
  "/albums/high-school/",
  "/gallery/",
  "/prices/",
  "/about/",
  "/contacts/",
  "/legal/",
];

test("renders the Russian synthetic Home without a database fallback claim", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    runtime,
    context,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /lang="ru"/i);
  assert.match(html, /РЕБЁНОК/);
  assert.match(html, /Дом детской фотографии/);
  assert.doesNotMatch(html, /\/workspace|\/root|file:\/\/\//i);
});

test("adds the pre-release security and indexing boundary", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    runtime,
    context,
  );
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("keeps the responsive frame exception local and blocks the forbidden host", async () => {
  const localFrame = await worker.fetch(
    new Request("http://localhost/?qa_frame=1", {
      headers: { accept: "text/html" },
    }),
    runtime,
    context,
  );
  assert.match(
    localFrame.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'self'/,
  );
  assert.equal(localFrame.headers.get("x-frame-options"), "SAMEORIGIN");

  const productionFrame = await worker.fetch(
    new Request("https://ns-ars.ru/?qa_frame=1", {
      headers: { accept: "text/html" },
    }),
    runtime,
    context,
  );
  assert.match(
    productionFrame.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );
  assert.equal(productionFrame.headers.get("x-frame-options"), "DENY");

  for (const hostname of [
    "ns-ars-production.ru",
    "www.ns-ars-production.ru",
  ]) {
    const forbidden = await worker.fetch(
      new Request(`https://${hostname}/`),
      runtime,
      context,
    );
    assert.equal(forbidden.status, 421, hostname);
  }
});

test("rejects the disabled brief without reading or storing its body", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/brief/", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: "this-body-must-not-be-parsed",
    }),
    runtime,
    context,
  );
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.code, "BRIEF_DISABLED_PRE_RELEASE");
});

test("keeps anonymous admin APIs closed", async () => {
  for (const [route, method] of [
    ["/api/admin/page/", "GET"],
    ["/api/admin/pages/", "GET"],
    ["/api/admin/menu/", "GET"],
    ["/api/admin/visibility/", "POST"],
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${route}`, {
        method,
        headers: { accept: "application/json" },
      }),
      runtime,
      context,
    );
    assert.equal(response.status, 401, route);
    const payload = await response.json();
    assert.equal(payload.code, "SIGN_IN_REQUIRED", route);
  }
});

test("rejects spoofed internal admin headers", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/admin/page/", {
      headers: {
        accept: "application/json",
        "x-nsars-admin-email": "spoofed@example.test",
        "x-nsars-admin-mode": "PASSWORD_SESSION",
        "oai-authenticated-user-email": "owner@example.test",
      },
    }),
    runtime,
    context,
  );
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.code, "SIGN_IN_REQUIRED");
});

test("renders the site-owned login without ChatGPT authorization", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/admin/login/?next=%2Fadmin%2Fmenu%2F", {
      headers: { accept: "text/html" },
    }),
    runtime,
    context,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Используйте вашу электронную почту и пароль/);
  assert.match(html, /action="\/api\/admin\/auth\/login\/?"/);
  assert.match(html, /name="next" value="\/admin\/menu\/"/);
  assert.match(html, /autocomplete="username"/i);
  assert.match(html, /autocomplete="current-password"/i);
  assert.doesNotMatch(html, /ChatGPT|oai-authenticated-user/i);
});

test("removes the common header mark and decorative section numbering", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    runtime,
    context,
  );
  const html = await response.text();
  assert.doesNotMatch(html, /class="brand-mark"/i);
  assert.doesNotMatch(html, /class="hero-index"/i);
  assert.doesNotMatch(html, />\s*0[123]\s*\/\s*(ПОДХОД|ПРОЦЕСС|ДАЛЬШЕ)\s*</i);
  for (const number of ["01", "02", "03", "04"]) {
    assert.match(html, new RegExp(`class="step-number"[^>]*>${number}<`));
  }
});

test("renders every registered public route and a custom 404", async () => {
  const routes = [
    ["/albums/kindergarten/", /МИР ЕЩЁ МОЖНО ПРИДУМАТЬ/],
    ["/albums/grade-4/", /ЕЩЁ ДЕТИ/],
    ["/albums/high-school/", /ПРАВО НА СВОЙ ГОЛОС/],
    ["/gallery/", /НЕ БЕСКОНЕЧНАЯ ЛЕНТА/],
    ["/prices/", /ФОРМАТ — ЭТО РИТМ ИСТОРИИ/],
    ["/about/", /СМОТРЕТЬ\. СЛУШАТЬ\. РЕДАКТИРОВАТЬ\./],
    ["/contacts/", /РАЗГОВОР НАЧИНАЕТСЯ С КОНТЕКСТА/],
    ["/legal/", /ПРАВИЛА — ЧАСТЬ ПРОЕКТА/],
  ];
  for (const [route, expected] of routes) {
    const response = await worker.fetch(
      new Request(`http://localhost${route}`, { headers: { accept: "text/html" } }),
      runtime,
      context,
    );
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), expected, route);
  }

  const missing = await worker.fetch(
    new Request("http://localhost/no-such-page/", { headers: { accept: "text/html" } }),
    runtime,
    context,
  );
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /ЭТА СТРАНИЦА ВЫШЛА ИЗ КАДРА/);
});

test("emits all public routes in the noindex sitemap", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/sitemap.xml/"),
    runtime,
    context,
  );
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.equal((xml.match(/<url>/g) ?? []).length, 9);
  assert.match(xml, /https:\/\/ns-ars\.ru\/contacts\//);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("keeps robots closed and points only to the canonical future origin", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/robots.txt"),
    runtime,
    context,
  );
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Disallow:\s*\//i);
  assert.match(body, /Sitemap:\s*https:\/\/ns-ars\.ru\/sitemap\.xml\//i);
  assert.doesNotMatch(body, /ns-ars-production\.ru/i);
});

test("renders structurally sound public navigation with no broken internal target", async () => {
  const registered = new Set(publicRoutes);
  const discovered = new Set();

  for (const route of publicRoutes) {
    const response = await worker.fetch(
      new Request(`http://localhost${route}`, {
        headers: { accept: "text/html" },
      }),
      runtime,
      context,
    );
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${route} h1 count`);
    assert.match(html, /data-page-type="PT_(?:COMPOSITE|ALBUM|GALLERY)"/i, route);
    assert.match(html, /data-block-type="F01"/i, route);
    assert.doesNotMatch(html, /data-block-type="nsars\./i, route);
    assert.match(html, /class="skip-link" href="#main-content"/i, route);
    assert.match(html, /aria-label="Основные разделы"/i, route);

    const anchors = [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/gi)];
    for (const match of anchors) {
      const href = match[1];
      if (href.startsWith("#")) continue;
      assert.equal(href.startsWith("/"), true, `${route} external target ${href}`);
      const pathname = new URL(href, "http://localhost").pathname;
      assert.equal(registered.has(pathname), true, `${route} broken target ${href}`);
      discovered.add(pathname);
    }
  }

  assert.deepEqual([...discovered].sort(), [...registered].sort());
});
