import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createFakeD1 } from "./fake-d1.mjs";
import {
  applyMoscowCopyMigration,
  MOSCOW_COPY_MIGRATION_ID,
} from "../lib/content-migrations.ts";

const SOURCE_ACTOR = "system:owner-content-seed-r5.2";

async function createInitializedDatabase() {
  const database = createFakeD1();
  globalThis.__NSARS_TEST_ENV = { DB: database };
  const { getAdminPageOptions } = await import("../lib/site-store.ts");
  const pages = await getAdminPageOptions();
  assert.equal(pages.length, 9);
  return database;
}

async function sourceManifestForCurrentPayload(database) {
  const rows = await database
    .prepare(
      `SELECT p.id, p.route, pr.payload_json
         FROM pages p
         JOIN active_releases ar ON ar.page_id = p.id
         JOIN published_revisions pr ON pr.id = ar.revision_id
        ORDER BY p.id`,
    )
    .all();
  return rows.results.map((row) => [
    row.id,
    row.route,
    createHash("sha256").update(row.payload_json).digest("hex"),
  ]);
}

async function markAsUntouchedLegacySource(database, sourceManifest) {
  for (const [pageId, , publishedSha256] of sourceManifest) {
    await database
      .prepare(
        `UPDATE pages
            SET draft_version = 1,
                last_published_draft_version = 1,
                updated_by = ?1
          WHERE id = ?2`,
      )
      .bind(SOURCE_ACTOR, pageId)
      .run();
    await database
      .prepare(
        `UPDATE published_revisions
            SET payload_sha256 = ?1,
                created_by = ?2
          WHERE id = ?3`,
      )
      .bind(publishedSha256, SOURCE_ACTOR, `rev_${pageId}_seed_001`)
      .run();
    await database
      .prepare(
        `UPDATE active_releases
            SET switched_by = ?1
          WHERE page_id = ?2`,
      )
      .bind(SOURCE_ACTOR, pageId)
      .run();
  }
}

test("the Moscow copy migration appends revision 2 atomically and is idempotent", async () => {
  const database = await createInitializedDatabase();
  try {
    const sourceManifest = await sourceManifestForCurrentPayload(database);
    await markAsUntouchedLegacySource(database, sourceManifest);

    assert.equal(
      await applyMoscowCopyMigration(database, sourceManifest),
      "APPLIED",
    );
    assert.equal(
      await applyMoscowCopyMigration(database, sourceManifest),
      "ALREADY_APPLIED",
    );

    const ledger = await database
      .prepare(
        `SELECT status FROM content_migrations WHERE id = ?1 LIMIT 1`,
      )
      .bind(MOSCOW_COPY_MIGRATION_ID)
      .first();
    assert.equal(ledger?.status, "APPLIED");

    const migrated = await database
      .prepare(
        `SELECT p.id, p.draft_version, p.last_published_draft_version,
                p.updated_by, ar.revision_id, pr.revision_no,
                pr.source_draft_version, pr.created_by,
                (SELECT COUNT(*) FROM published_revisions counted
                  WHERE counted.page_id = p.id) AS revision_count
           FROM pages p
           JOIN active_releases ar ON ar.page_id = p.id
           JOIN published_revisions pr ON pr.id = ar.revision_id
          ORDER BY p.id`,
      )
      .all();
    assert.equal(migrated.results.length, 9);
    for (const row of migrated.results) {
      assert.equal(Number(row.draft_version), 2);
      assert.equal(Number(row.last_published_draft_version), 2);
      assert.match(String(row.updated_by), /owner-copy-moscow/);
      assert.equal(row.revision_id, `rev_${row.id}_moscow_002`);
      assert.equal(Number(row.revision_no), 2);
      assert.equal(Number(row.source_draft_version), 2);
      assert.match(String(row.created_by), /owner-copy-moscow/);
      assert.equal(Number(row.revision_count), 2);
    }

    const auditCount = await database
      .prepare(
        `SELECT COUNT(*) AS count FROM audit_events
          WHERE action = 'OWNER_COPY_MOSCOW_MIGRATED'`,
      )
      .first("count");
    assert.equal(Number(auditCount), 9);
  } finally {
    database.close();
    delete globalThis.__NSARS_TEST_ENV;
  }
});

test("the Moscow copy migration refuses a drifted page without partial writes", async () => {
  const database = await createInitializedDatabase();
  try {
    const sourceManifest = await sourceManifestForCurrentPayload(database);
    await markAsUntouchedLegacySource(database, sourceManifest);
    await database
      .prepare(
        `UPDATE pages
            SET draft_version = 2,
                updated_by = 'owner@example.test'
          WHERE id = 'page_about'`,
      )
      .run();

    await assert.rejects(
      applyMoscowCopyMigration(database, sourceManifest),
      /отличается от подтверждённого нетронутого источника/i,
    );

    const ledgerCount = await database
      .prepare(`SELECT COUNT(*) AS count FROM content_migrations`)
      .first("count");
    const revisionCount = await database
      .prepare(`SELECT COUNT(*) AS count FROM published_revisions`)
      .first("count");
    assert.equal(Number(ledgerCount), 0);
    assert.equal(Number(revisionCount), 9);
  } finally {
    database.close();
    delete globalThis.__NSARS_TEST_ENV;
  }
});

test("the Moscow copy migration recomputes source hashes before writing", async () => {
  const database = await createInitializedDatabase();
  try {
    const sourceManifest = await sourceManifestForCurrentPayload(database);
    await markAsUntouchedLegacySource(database, sourceManifest);

    const page = await database
      .prepare(`SELECT draft_json FROM pages WHERE id = 'page_about'`)
      .first();
    const revision = await database
      .prepare(
        `SELECT payload_json FROM published_revisions
          WHERE id = 'rev_page_about_seed_001'`,
      )
      .first();
    const changedDraft = { ...JSON.parse(page.draft_json), title: "Чужой черновик" };
    const changedPublished = {
      ...JSON.parse(revision.payload_json),
      title: "Чужой черновик",
    };
    await database
      .prepare(`UPDATE pages SET draft_json = ?1 WHERE id = 'page_about'`)
      .bind(JSON.stringify(changedDraft))
      .run();
    await database
      .prepare(
        `UPDATE published_revisions SET payload_json = ?1
          WHERE id = 'rev_page_about_seed_001'`,
      )
      .bind(JSON.stringify(changedPublished))
      .run();

    await assert.rejects(
      applyMoscowCopyMigration(database, sourceManifest),
      /отличается от подтверждённого нетронутого источника/i,
    );
    assert.equal(
      Number(
        await database
          .prepare(`SELECT COUNT(*) AS count FROM content_migrations`)
          .first("count"),
      ),
      0,
    );
  } finally {
    database.close();
    delete globalThis.__NSARS_TEST_ENV;
  }
});

test("the Moscow copy migration rejects a mismatched applied ledger", async () => {
  const database = await createInitializedDatabase();
  try {
    const sourceManifest = await sourceManifestForCurrentPayload(database);
    await markAsUntouchedLegacySource(database, sourceManifest);
    assert.equal(
      await applyMoscowCopyMigration(database, sourceManifest),
      "APPLIED",
    );
    await database
      .prepare(
        `UPDATE content_migrations SET checksum = 'tampered'
          WHERE id = ?1`,
      )
      .bind(MOSCOW_COPY_MIGRATION_ID)
      .run();

    await assert.rejects(
      applyMoscowCopyMigration(database, sourceManifest),
      /контрольная сумма не совпадают/i,
    );
  } finally {
    database.close();
    delete globalThis.__NSARS_TEST_ENV;
  }
});
