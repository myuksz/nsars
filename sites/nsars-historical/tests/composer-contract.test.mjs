import assert from "node:assert/strict";
import test from "node:test";
import { SITE_SEEDS } from "../lib/site-seeds.ts";
import {
  changeComposerPageType,
  collectComposerMediaIds,
  composerShell,
  createBlankComposerPage,
  createComposerPageBlock,
  hasVisibleComposerContent,
  migratePageDocument,
  reindexComposerBlocks,
  routeFromComposerSlugInput,
  validateComposerPageDocument,
} from "../lib/composer-contract.ts";
import {
  BLOCK_REGISTRY,
  COMPOSER_CONTRACT_VERSION,
  PAGE_TYPE_REGISTRY,
  SCOPED_VARIANTS,
  blockDefinitionByType,
  pageTypeById,
  variantById,
} from "../lib/composer-registry.ts";

test("composer registry exposes ten page nodes and all 21 block families", () => {
  assert.equal(PAGE_TYPE_REGISTRY.length, 10);
  assert.equal(PAGE_TYPE_REGISTRY.filter((entry) => entry.nodeKind === "CONTENT").length, 8);
  assert.deepEqual(
    BLOCK_REGISTRY.map((entry) => entry.type),
    Array.from({ length: 21 }, (_, index) => `F${String(index + 1).padStart(2, "0")}`),
  );
  assert.equal(new Set(BLOCK_REGISTRY.map((entry) => entry.type)).size, 21);
  for (const definition of BLOCK_REGISTRY) {
    assert.equal(blockDefinitionByType[definition.type], definition);
  }
  for (const pageType of PAGE_TYPE_REGISTRY) {
    assert.equal(pageTypeById[pageType.id], pageType);
  }
  for (const variant of SCOPED_VARIANTS) {
    assert.equal(variantById[variant.id], variant);
    assert.ok(blockDefinitionByType[variant.blockType]);
    assert.ok(variant.pageTypes.every((pageType) => pageTypeById[pageType]?.nodeKind === "CONTENT"));
  }
});

test("all legacy Moscow copy records migrate to valid composer documents", () => {
  assert.equal(SITE_SEEDS.length, 9);
  for (const source of SITE_SEEDS) {
    const document = migratePageDocument(source);
    const validation = validateComposerPageDocument(document);
    assert.equal(validation.ok, true, validation.ok ? source.pageId : validation.errors.join("\n"));
    assert.equal(document.contractVersion, COMPOSER_CONTRACT_VERSION);
    assert.equal(document.pageId, source.pageId);
    assert.equal(document.route, source.route);
    assert.equal(document.title, source.title);
    assert.equal(document.status, source.status);
    assert.equal(
      document.pageType,
      source.route.startsWith("/albums/")
        ? "PT_ALBUM"
        : source.route === "/gallery/"
          ? "PT_GALLERY"
          : "PT_COMPOSITE",
    );
    assert.deepEqual(document.blocks.map((block) => block.position), document.blocks.map((_, index) => index));
    assert.ok(document.blocks.every((block) => /^F\d{2}$/.test(block.type)));
  }
});

test("an empty draft and every independently inserted family validate", () => {
  const empty = createBlankComposerPage("page_custom_12345678", "/custom/", "Пустая", "PT_COMPOSITE");
  assert.equal(validateComposerPageDocument(empty).ok, true);
  assert.equal(hasVisibleComposerContent(empty), false);

  for (const definition of BLOCK_REGISTRY) {
    const document = createBlankComposerPage(
      `page_custom_${definition.type.toLowerCase()}_1234`,
      `/custom-${definition.type.toLowerCase()}/`,
      definition.name,
      "PT_COMPOSITE",
    );
    document.blocks = [createComposerPageBlock(definition.type, 0)];
    const validation = validateComposerPageDocument(document);
    assert.equal(validation.ok, true, validation.ok ? definition.type : validation.errors.join("\n"));
    assert.equal(hasVisibleComposerContent(document), true);
  }
});

test("page-specific blocks are quarantined and restored, including inside F20", () => {
  const document = createBlankComposerPage("page_custom_album_1234", "/album-test/", "Альбом", "PT_ALBUM");
  const row = createComposerPageBlock("F20", 0);
  const nested = createComposerPageBlock("F02", 0, "V_ALBUM_INTRO");
  row.data.slots[0].blocks = [nested];
  document.blocks = [row];
  assert.equal(validateComposerPageDocument(document).ok, true);

  const blog = changeComposerPageType(document, "PT_BLOG");
  assert.equal(blog.blocks.length, 0);
  assert.equal(blog.quarantinedBlocks.length, 1);
  assert.equal(validateComposerPageDocument(blog).ok, true);

  const restored = changeComposerPageType(blog, "PT_ALBUM");
  assert.equal(restored.blocks.length, 1);
  assert.equal(restored.blocks[0].blockId, row.blockId);
  assert.equal(restored.quarantinedBlocks.length, 0);
  assert.equal(validateComposerPageDocument(restored).ok, true);
});

test("F20 enforces one nesting level and globally unique block ids", () => {
  const document = createBlankComposerPage("page_custom_row_1234", "/row-test/", "Ряд", "PT_COMPOSITE");
  const row = createComposerPageBlock("F20", 0);
  const nested = createComposerPageBlock("F02", 0);
  row.data.slots[0].blocks = [nested];
  document.blocks = [row];
  assert.equal(validateComposerPageDocument(document).ok, true);

  const nestedRow = structuredClone(document);
  nestedRow.blocks[0].data.slots[0].blocks = [createComposerPageBlock("F20", 0)];
  assert.equal(validateComposerPageDocument(nestedRow).ok, false);

  const duplicateId = structuredClone(document);
  duplicateId.blocks[0].data.slots[0].blocks[0].blockId = duplicateId.blocks[0].blockId;
  assert.equal(validateComposerPageDocument(duplicateId).ok, false);

  const wrongColumns = structuredClone(document);
  wrongColumns.blocks[0].data.columns = 1;
  assert.equal(validateComposerPageDocument(wrongColumns).ok, false);
});

test("hidden nested media is excluded from publication dependencies", () => {
  const document = createBlankComposerPage("page_custom_media_1234", "/media-test/", "Медиа", "PT_COMPOSITE");
  const row = createComposerPageBlock("F20", 0);
  const nested = createComposerPageBlock("F03", 0);
  nested.data.mediaIds = ["media_12345678"];
  nested.hidden = true;
  row.data.slots[0].blocks = reindexComposerBlocks([nested]);
  document.blocks = [row];
  assert.deepEqual(collectComposerMediaIds(document), []);
  row.data.slots[0].blocks[0].hidden = false;
  assert.deepEqual(collectComposerMediaIds(document), ["media_12345678"]);
});

test("composer routes and page shells are explicit and safe", () => {
  assert.equal(routeFromComposerSlugInput("Projects / New Story"), "/projects/new-story/");
  assert.equal(routeFromComposerSlugInput("admin"), null);
  assert.equal(routeFromComposerSlugInput("api/foo"), null);
  assert.equal(routeFromComposerSlugInput("кириллица"), null);
  assert.equal(composerShell(createBlankComposerPage("page_custom_a123", "/a/", "A", "PT_COMPOSITE")), "SITE");
  assert.equal(composerShell(createBlankComposerPage("page_custom_b123", "/b/", "B", "PT_SPLASH")), "FULLSCREEN");
  assert.equal(composerShell(createBlankComposerPage("page_custom_c123", "/c/", "C", "PT_LANDING")), "HEADERLESS");
});
