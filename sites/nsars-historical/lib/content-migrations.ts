import {
  cloneComposerPageDocument,
  hasVisibleComposerContent,
  migratePageDocument,
  validateComposerPageDocument,
  type ComposerPageDocument,
} from "./composer-contract";
import { stableStringify } from "./page-contract";
import { SITE_SEEDS } from "./site-seeds";

export const MOSCOW_COPY_MIGRATION_ID = "owner_copy_moscow_20260830_001";
export const MOSCOW_COPY_MIGRATION_ACTOR =
  "system:content-migration:owner-copy-moscow-20260830-001";

const SOURCE_ACTOR = "system:owner-content-seed-r5.2";
const CURRENT_SEED_ACTOR = "system:owner-content-seed-r6";

export type MoscowCopySourceManifest = readonly (readonly [
  pageId: string,
  route: string,
  publishedSha256: string,
])[];

export const MOSCOW_COPY_SOURCE_MANIFEST: MoscowCopySourceManifest = [
  ["page_home", "/", "2f85f73d955a5782837669e1ad74279653af912c141cd32b87728e7c959b3f79"],
  ["page_kindergarten", "/albums/kindergarten/", "cd7d40c568d5a559c8ef8f8d618b14c10fb00c877a267eacc10f89e9178e030a"],
  ["page_grade4", "/albums/grade-4/", "9954cfec220e4b88441f7ac99770b2de83ce260530afe5c6d7f3c25e4a4e95c0"],
  ["page_highschool", "/albums/high-school/", "70ae8ec96b9b631e011b44885465d3b5123e0de08e59521966ea314a81dd8185"],
  ["page_gallery", "/gallery/", "253c43ddbb9f71247689e2da529b5f8eddca2ff05932113e9130dcd028a515d3"],
  ["page_prices", "/prices/", "d9c6492a39bc2b061b84b198d2bee12e7f45481e881cd5a229a5e75ae26ebaf9"],
  ["page_about", "/about/", "997daa88e15f73d882df0ccbe28dc331d13dddb18ebabae823daedc449a4d58a"],
  ["page_contacts", "/contacts/", "ead8a1e726e836cf2192d31fab7e0844cc14b55fe1171b42cafcc3ffb44a7ea0"],
  ["page_legal", "/legal/", "78a4fbd93135ba62bd688155fa6099acb31b76099f1e86d4df48487b74fa8c06"],
] as const;

type MigrationLedgerRow = {
  checksum: string;
  source_manifest_sha256: string;
  target_manifest_sha256: string;
  status: string;
};

type ExistingPageRow = {
  id: string;
  route: string;
  draft_json: string;
  draft_version: number;
  last_published_draft_version: number;
  updated_by: string;
  system_page: number;
  revision_id: string | null;
  switched_by: string | null;
  revision_no: number | null;
  source_draft_version: number | null;
  payload_json: string | null;
  payload_sha256: string | null;
  created_by: string | null;
  revision_count: number;
};

type TargetPage = {
  pageId: string;
  route: string;
  title: string;
  draftJson: string;
  publishedJson: string;
  publishedSha256: string;
  revisionId: string;
};

export type MoscowCopyMigrationResult =
  | "NOT_APPLICABLE_EMPTY_DATABASE"
  | "TARGET_ALREADY_PRESENT"
  | "APPLIED"
  | "ALREADY_APPLIED";

export class ContentMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentMigrationError";
  }
}

export const CONTENT_MIGRATION_SCHEMA_STATEMENT = `CREATE TABLE IF NOT EXISTS content_migrations (
  id TEXT PRIMARY KEY NOT NULL,
  checksum TEXT NOT NULL,
  source_manifest_sha256 TEXT NOT NULL,
  target_manifest_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('APPLYING', 'APPLIED')),
  attempt_token TEXT NOT NULL,
  actor TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  applied_at TEXT
)`;

export async function applyMoscowCopyMigration(
  database: D1Database,
  sourceManifest: MoscowCopySourceManifest = MOSCOW_COPY_SOURCE_MANIFEST,
): Promise<MoscowCopyMigrationResult> {
  const targets = await buildTargets(sourceManifest);
  const sourceManifestSha256 = await sha256(
    stableStringify(sourceManifest),
  );
  const targetManifestSha256 = await sha256(
    stableStringify(
      targets.map((target) => ({
        pageId: target.pageId,
        route: target.route,
        revisionId: target.revisionId,
        publishedSha256: target.publishedSha256,
      })),
    ),
  );
  const checksum = await sha256(
    stableStringify({
      migrationId: MOSCOW_COPY_MIGRATION_ID,
      sourceManifestSha256,
      targetManifestSha256,
    }),
  );

  const existingLedger = await readLedger(database);
  if (existingLedger) {
    assertMatchingLedger(
      existingLedger,
      checksum,
      sourceManifestSha256,
      targetManifestSha256,
    );
    return "ALREADY_APPLIED";
  }

  const existing = await readExistingPages(database, sourceManifest);
  if (existing.length === 0) return "NOT_APPLICABLE_EMPTY_DATABASE";
  if (isExactTargetSeed(existing, targets)) return "TARGET_ALREADY_PRESENT";
  await assertExactSource(existing, sourceManifest);

  const attemptToken = crypto.randomUUID().replaceAll("-", "");
  const claim = database
    .prepare(buildClaimSql(sourceManifest))
    .bind(
      MOSCOW_COPY_MIGRATION_ID,
      checksum,
      sourceManifestSha256,
      targetManifestSha256,
      attemptToken,
      MOSCOW_COPY_MIGRATION_ACTOR,
    );
  const statements: D1PreparedStatement[] = [claim];

  for (const target of targets) {
    statements.push(
      database
        .prepare(
          `UPDATE pages
              SET title = ?1,
                  draft_json = ?2,
                  draft_version = 2,
                  last_published_draft_version = 2,
                  updated_at = CURRENT_TIMESTAMP,
                  updated_by = ?3
            WHERE id = ?4
              AND route = ?5
              AND draft_version = 1
              AND last_published_draft_version = 1
              AND updated_by = ?6
              AND EXISTS (
                SELECT 1 FROM content_migrations
                 WHERE id = ?7 AND attempt_token = ?8 AND status = 'APPLYING'
              )`,
        )
        .bind(
          target.title,
          target.draftJson,
          MOSCOW_COPY_MIGRATION_ACTOR,
          target.pageId,
          target.route,
          SOURCE_ACTOR,
          MOSCOW_COPY_MIGRATION_ID,
          attemptToken,
        ),
      database
        .prepare(
          `INSERT INTO published_revisions
            (id, page_id, revision_no, payload_json, payload_sha256,
             source_draft_version, created_by)
           SELECT ?1, ?2, 2, ?3, ?4, 2, ?5
            WHERE EXISTS (
              SELECT 1 FROM content_migrations
               WHERE id = ?6 AND attempt_token = ?7 AND status = 'APPLYING'
            )`,
        )
        .bind(
          target.revisionId,
          target.pageId,
          target.publishedJson,
          target.publishedSha256,
          MOSCOW_COPY_MIGRATION_ACTOR,
          MOSCOW_COPY_MIGRATION_ID,
          attemptToken,
        ),
      database
        .prepare(
          `UPDATE active_releases
              SET revision_id = ?1,
                  switched_at = CURRENT_TIMESTAMP,
                  switched_by = ?2
            WHERE page_id = ?3
              AND revision_id = ?4
              AND switched_by = ?5
              AND EXISTS (
                SELECT 1 FROM content_migrations
                 WHERE id = ?6 AND attempt_token = ?7 AND status = 'APPLYING'
              )`,
        )
        .bind(
          target.revisionId,
          MOSCOW_COPY_MIGRATION_ACTOR,
          target.pageId,
          seedRevisionId(target.pageId),
          SOURCE_ACTOR,
          MOSCOW_COPY_MIGRATION_ID,
          attemptToken,
        ),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           SELECT 'OWNER_COPY_MOSCOW_MIGRATED', ?1, ?2, ?3
            WHERE EXISTS (
              SELECT 1 FROM content_migrations
               WHERE id = ?4 AND attempt_token = ?5 AND status = 'APPLYING'
            )`,
        )
        .bind(
          target.pageId,
          MOSCOW_COPY_MIGRATION_ACTOR,
          stableStringify({
            fromRevisionId: seedRevisionId(target.pageId),
            toRevisionId: target.revisionId,
            sourceDraftVersion: 1,
            targetDraftVersion: 2,
            payloadSha256: target.publishedSha256,
          }),
          MOSCOW_COPY_MIGRATION_ID,
          attemptToken,
        ),
    );
  }

  statements.push(
    database
      .prepare(buildFinalizeSql(targets))
      .bind(
        MOSCOW_COPY_MIGRATION_ID,
        attemptToken,
        MOSCOW_COPY_MIGRATION_ACTOR,
      ),
  );

  try {
    const results = await database.batch(statements);
    const claimChanged = Number(results[0]?.meta?.changes ?? 0);
    if (claimChanged === 1) {
      const finalized = Number(results.at(-1)?.meta?.changes ?? 0);
      if (finalized !== 1) {
        throw new ContentMigrationError(
          "Миграция московских текстов не подтвердила итоговое состояние.",
        );
      }
      return "APPLIED";
    }
  } catch (error) {
    throw new ContentMigrationError(
      `Миграция московских текстов отменена целиком: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const concurrentLedger = await readLedger(database);
  if (concurrentLedger?.status === "APPLIED") {
    assertMatchingLedger(
      concurrentLedger,
      checksum,
      sourceManifestSha256,
      targetManifestSha256,
    );
    return "ALREADY_APPLIED";
  }
  throw new ContentMigrationError(
    "Исходное состояние страниц изменилось до начала миграции; записи не выполнялись.",
  );
}

async function buildTargets(
  sourceManifest: MoscowCopySourceManifest,
): Promise<TargetPage[]> {
  if (SITE_SEEDS.length !== sourceManifest.length) {
    throw new ContentMigrationError("Набор московских страниц не содержит ровно девять записей.");
  }
  const expectedIds = new Set(
    sourceManifest.map(([pageId]) => pageId),
  );
  return Promise.all(
    SITE_SEEDS.map(async (seed) => {
      if (
        !expectedIds.has(
          seed.pageId,
        )
      ) {
        throw new ContentMigrationError(`Неожиданная страница в целевом наборе: ${seed.pageId}.`);
      }
      const draft = migratePageDocument(seed);
      const draftValidation = validateComposerPageDocument(draft);
      if (!draftValidation.ok || draftValidation.value.status !== "DRAFT") {
        throw new ContentMigrationError(`Некорректный московский черновик: ${seed.pageId}.`);
      }
      if (!hasVisibleComposerContent(draftValidation.value)) {
        throw new ContentMigrationError(`Московская страница пуста: ${seed.pageId}.`);
      }
      const published: ComposerPageDocument = {
        ...cloneComposerPageDocument(draftValidation.value),
        status: "PUBLISHED",
      };
      const publishedValidation = validateComposerPageDocument(published);
      if (!publishedValidation.ok) {
        throw new ContentMigrationError(`Некорректная московская публикация: ${seed.pageId}.`);
      }
      const draftJson = stableStringify(draftValidation.value);
      const publishedJson = stableStringify(publishedValidation.value);
      return {
        pageId: seed.pageId,
        route: seed.route,
        title: seed.title,
        draftJson,
        publishedJson,
        publishedSha256: await sha256(publishedJson),
        revisionId: targetRevisionId(seed.pageId),
      };
    }),
  );
}

async function readLedger(database: D1Database): Promise<MigrationLedgerRow | null> {
  return database
    .prepare(
      `SELECT checksum, source_manifest_sha256, target_manifest_sha256, status
         FROM content_migrations WHERE id = ?1 LIMIT 1`,
    )
    .bind(MOSCOW_COPY_MIGRATION_ID)
    .first<MigrationLedgerRow>();
}

async function readExistingPages(
  database: D1Database,
  sourceManifest: MoscowCopySourceManifest,
): Promise<ExistingPageRow[]> {
  const ids = sourceManifest.map(([pageId]) => sqlString(pageId)).join(", ");
  const result = await database
    .prepare(
      `SELECT p.id, p.route, p.draft_json, p.draft_version,
              p.last_published_draft_version, p.updated_by,
              ps.system_page, ar.revision_id, ar.switched_by,
              pr.revision_no, pr.source_draft_version, pr.payload_json,
              pr.payload_sha256, pr.created_by,
              (SELECT COUNT(*) FROM published_revisions counted
                WHERE counted.page_id = p.id) AS revision_count
         FROM pages p
         LEFT JOIN page_settings ps ON ps.page_id = p.id
         LEFT JOIN active_releases ar ON ar.page_id = p.id
         LEFT JOIN published_revisions pr ON pr.id = ar.revision_id
        WHERE p.id IN (${ids})
        ORDER BY p.id`,
    )
    .all<ExistingPageRow>();
  return result.results;
}

async function assertExactSource(
  rows: ExistingPageRow[],
  sourceManifest: MoscowCopySourceManifest,
) {
  if (rows.length !== sourceManifest.length) {
    throw new ContentMigrationError(
      "Найден неполный набор исходных страниц; автоматическая миграция запрещена.",
    );
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [pageId, route, publishedSha256] of sourceManifest) {
    const row = byId.get(pageId);
    let draftIsRecognized = false;
    let draftMatchesPublished = false;
    let payloadHashMatches = false;
    try {
      const draft = migratePageDocument(JSON.parse(row?.draft_json ?? "null"));
      const published = migratePageDocument(JSON.parse(row?.payload_json ?? "null"));
      draftIsRecognized =
        draft.pageId === pageId && draft.route === route && draft.status === "DRAFT";
      draftMatchesPublished =
        stableStringify({ ...draft, status: "PUBLISHED" }) ===
        stableStringify(published);
      payloadHashMatches =
        (await sha256(row?.payload_json ?? "")) === publishedSha256;
    } catch {
      draftIsRecognized = false;
      draftMatchesPublished = false;
      payloadHashMatches = false;
    }
    const exact =
      row?.route === route &&
      Number(row.draft_version) === 1 &&
      Number(row.last_published_draft_version) === 1 &&
      row.updated_by === SOURCE_ACTOR &&
      Number(row.system_page) === 1 &&
      row.revision_id === seedRevisionId(pageId) &&
      row.switched_by === SOURCE_ACTOR &&
      Number(row.revision_no) === 1 &&
      Number(row.source_draft_version) === 1 &&
      row.payload_sha256 === publishedSha256 &&
      row.created_by === SOURCE_ACTOR &&
      Number(row.revision_count) === 1 &&
      draftIsRecognized &&
      draftMatchesPublished &&
      payloadHashMatches;
    if (!exact) {
      throw new ContentMigrationError(
        `Страница ${pageId} отличается от подтверждённого нетронутого источника; весь пакет остановлен.`,
      );
    }
  }
}

function isExactTargetSeed(rows: ExistingPageRow[], targets: TargetPage[]) {
  if (rows.length !== targets.length) return false;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return targets.every((target) => {
    const row = byId.get(target.pageId);
    return Boolean(
      row &&
        row.route === target.route &&
        row.draft_json === target.draftJson &&
        Number(row.draft_version) === 1 &&
        Number(row.last_published_draft_version) === 1 &&
        row.updated_by === CURRENT_SEED_ACTOR &&
        Number(row.system_page) === 1 &&
        row.revision_id === seedRevisionId(target.pageId) &&
        row.switched_by === CURRENT_SEED_ACTOR &&
        Number(row.revision_no) === 1 &&
        Number(row.source_draft_version) === 1 &&
        row.payload_json === target.publishedJson &&
        row.payload_sha256 === target.publishedSha256 &&
        row.created_by === CURRENT_SEED_ACTOR &&
        Number(row.revision_count) === 1,
    );
  });
}

function buildClaimSql(sourceManifest: MoscowCopySourceManifest) {
  return `WITH expected(page_id, route, published_sha256) AS (
    VALUES ${sourceManifest.map(
      ([pageId, route, sha]) =>
        `(${sqlString(pageId)}, ${sqlString(route)}, ${sqlString(sha)})`,
    ).join(", ")}
  )
  INSERT INTO content_migrations
    (id, checksum, source_manifest_sha256, target_manifest_sha256,
     status, attempt_token, actor)
  SELECT ?1, ?2, ?3, ?4, 'APPLYING', ?5, ?6
   WHERE NOT EXISTS (SELECT 1 FROM content_migrations WHERE id = ?1)
     AND (SELECT COUNT(*)
            FROM expected e
            JOIN pages p ON p.id = e.page_id
            JOIN page_settings ps ON ps.page_id = p.id
            JOIN active_releases ar ON ar.page_id = p.id
            JOIN published_revisions pr ON pr.id = ar.revision_id
           WHERE p.route = e.route
             AND p.draft_version = 1
             AND p.last_published_draft_version = 1
             AND p.updated_by = ${sqlString(SOURCE_ACTOR)}
             AND ps.system_page = 1
             AND ar.revision_id = 'rev_' || e.page_id || '_seed_001'
             AND ar.switched_by = ${sqlString(SOURCE_ACTOR)}
             AND pr.revision_no = 1
             AND pr.source_draft_version = 1
             AND pr.payload_sha256 = e.published_sha256
             AND pr.created_by = ${sqlString(SOURCE_ACTOR)}
             AND json_valid(p.draft_json) = 1
             AND json_extract(p.draft_json, '$.pageId') = e.page_id
             AND json_extract(p.draft_json, '$.route') = e.route
             AND json_extract(p.draft_json, '$.status') = 'DRAFT'
             AND (SELECT COUNT(*) FROM published_revisions counted
                   WHERE counted.page_id = e.page_id) = 1) = ${sourceManifest.length}`;
}

function buildFinalizeSql(targets: TargetPage[]) {
  const expected = targets
    .map(
      (target) =>
        `(${sqlString(target.pageId)}, ${sqlString(target.route)}, ${sqlString(target.revisionId)}, ${sqlString(target.publishedSha256)})`,
    )
    .join(", ");
  return `WITH expected(page_id, route, revision_id, published_sha256) AS (
    VALUES ${expected}
  )
  UPDATE content_migrations
     SET status = CASE WHEN (
       SELECT COUNT(*)
         FROM expected e
         JOIN pages p ON p.id = e.page_id
         JOIN active_releases ar ON ar.page_id = e.page_id
         JOIN published_revisions pr ON pr.id = e.revision_id
        WHERE p.route = e.route
          AND p.draft_version = 2
          AND p.last_published_draft_version = 2
          AND p.updated_by = ?3
          AND ar.revision_id = e.revision_id
          AND ar.switched_by = ?3
          AND pr.page_id = e.page_id
          AND pr.revision_no = 2
          AND pr.source_draft_version = 2
          AND pr.payload_sha256 = e.published_sha256
          AND pr.created_by = ?3
          AND (SELECT COUNT(*) FROM published_revisions counted
                WHERE counted.page_id = e.page_id) = 2
     ) = ${targets.length} THEN 'APPLIED' ELSE 'INVALID' END,
         applied_at = CURRENT_TIMESTAMP
   WHERE id = ?1 AND attempt_token = ?2 AND status = 'APPLYING'`;
}

function assertMatchingLedger(
  ledger: MigrationLedgerRow,
  checksum: string,
  sourceManifestSha256: string,
  targetManifestSha256: string,
) {
  if (
    ledger.status !== "APPLIED" ||
    ledger.checksum !== checksum ||
    ledger.source_manifest_sha256 !== sourceManifestSha256 ||
    ledger.target_manifest_sha256 !== targetManifestSha256
  ) {
    throw new ContentMigrationError(
      "Запись миграции существует, но её статус или контрольная сумма не совпадают.",
    );
  }
}

function seedRevisionId(pageId: string) {
  return `rev_${pageId}_seed_001`;
}

function targetRevisionId(pageId: string) {
  return `rev_${pageId}_moscow_002`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
