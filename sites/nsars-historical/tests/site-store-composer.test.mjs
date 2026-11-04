import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createFakeD1 } from "./fake-d1.mjs";
import { createComposerPageBlock } from "../lib/composer-contract.ts";

const database = createFakeD1();
globalThis.__NSARS_TEST_ENV = { DB: database };
const {
  RepositoryError,
  createPage,
  publishPageDraft,
  rollbackPage,
  savePageDraft,
  setPagePublicVisibility,
} = await import("../lib/site-store.ts");

after(() => {
  database.close();
  delete globalThis.__NSARS_TEST_ENV;
});

test("blank creation, idempotent publishing and concurrent rollback are safe", async () => {
  const created = await createPage(
    "Тестовая история",
    "test-story",
    "PT_COMPOSITE",
    "owner@example.test",
  );
  assert.equal(created.draft.blocks.length, 0);
  assert.equal(created.publicVisible, false);
  await assert.rejects(
    publishPageDraft(created.draft.pageId, created.draftVersion, "owner@example.test"),
    (error) => error instanceof RepositoryError && error.code === "INVALID_DOCUMENT",
  );

  const firstDraft = structuredClone(created.draft);
  firstDraft.blocks = [createComposerPageBlock("F02", 0)];
  const savedFirst = await savePageDraft(
    firstDraft,
    created.draftVersion,
    "owner@example.test",
  );
  const firstPublication = await publishPageDraft(
    savedFirst.draft.pageId,
    savedFirst.draftVersion,
    "owner@example.test",
  );
  assert.equal(firstPublication.revisions.length, 1);
  const firstRevisionId = firstPublication.activeRevisionId;
  assert.ok(firstRevisionId);

  const repeated = await publishPageDraft(
    savedFirst.draft.pageId,
    savedFirst.draftVersion,
    "owner@example.test",
  );
  assert.equal(repeated.revisions.length, 1);
  assert.equal(repeated.activeRevisionId, firstRevisionId);

  const visible = await setPagePublicVisibility(
    savedFirst.draft.pageId,
    true,
    "owner@example.test",
  );
  assert.equal(visible.publicVisible, true);

  const secondDraft = structuredClone(savedFirst.draft);
  secondDraft.blocks[0].data.body = "Вторая опубликованная версия";
  const savedSecond = await savePageDraft(
    secondDraft,
    savedFirst.draftVersion,
    "owner@example.test",
  );
  const secondPublication = await publishPageDraft(
    savedSecond.draft.pageId,
    savedSecond.draftVersion,
    "owner@example.test",
  );
  assert.equal(secondPublication.revisions.length, 2);
  const secondRevisionId = secondPublication.activeRevisionId;
  assert.ok(secondRevisionId);
  assert.notEqual(secondRevisionId, firstRevisionId);

  const rolledBack = await rollbackPage(
    savedSecond.draft.pageId,
    firstRevisionId,
    secondRevisionId,
    "owner@example.test",
  );
  assert.equal(rolledBack.activeRevisionId, firstRevisionId);
  await assert.rejects(
    rollbackPage(
      savedSecond.draft.pageId,
      secondRevisionId,
      secondRevisionId,
      "owner@example.test",
    ),
    (error) => error instanceof RepositoryError && error.code === "CONFLICT",
  );
});
