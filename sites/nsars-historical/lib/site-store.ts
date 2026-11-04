import { env } from "cloudflare:workers";
import {
  isValidPageId,
  normalizePublicRoute,
  stableStringify,
} from "./page-contract";
import {
  cloneComposerPageDocument,
  collectComposerMediaIds,
  createBlankComposerPage,
  hasVisibleComposerContent,
  isContentPageType,
  migratePageDocument,
  reindexComposerBlocks,
  routeFromComposerSlugInput,
  validateComposerPageDocument,
  type ComposerBlock,
  type ComposerPageDocument,
} from "./composer-contract";
import type { ContentPageTypeId } from "./composer-registry";
import {
  DEFAULT_NAVIGATION,
  NAVIGATION_PLACEMENTS,
  type NavigationDocument,
  type PublicNavigation,
  validateNavigationDocument,
} from "./navigation-contract";
import type { ImageMimeType, MediaItem } from "./media-contract";
import {
  applyMoscowCopyMigration,
  CONTENT_MIGRATION_SCHEMA_STATEMENT,
  ContentMigrationError,
} from "./content-migrations";
import { SITE_SEEDS } from "./site-seeds";

const SEED_ACTOR = "system:owner-content-seed-r6";
const MAIN_MENU_ID = "menu_main";

type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  NSARS_ADMIN_EMAIL?: string;
  NSARS_ADMIN_PASSWORD_SALT_HEX?: string;
  NSARS_ADMIN_PASSWORD_HASH_HEX?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{
          response(): Response;
        }>;
      };
    };
  };
};

type PageRow = {
  id: string;
  route: string;
  title: string;
  draft_json: string;
  draft_version: number;
  last_published_draft_version: number;
  updated_at: string;
  updated_by: string;
};

type PageOptionRow = {
  id: string;
  route: string;
  title: string;
  draft_json: string;
  public_visible: number;
  system_page: number;
  sort_order: number;
  has_published: number;
};

type NavigationRow = {
  id: string;
  draft_json: string;
  draft_version: number;
  updated_at: string;
  updated_by: string;
};

type MediaRow = {
  id: string;
  mime_type: string;
  name: string;
  byte_size: number;
  sha256: string;
  width: number;
  height: number;
  aspect_ratio: string;
  alt: string;
  caption: string;
  fit_mode: string;
  focal_x: number;
  focal_y: number;
  rights_status: string;
  rights_scope: string;
  lifecycle: string;
  recovery_status: string;
  version: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type RevisionSummary = {
  id: string;
  revisionNo: number;
  payloadSha256: string;
  sourceDraftVersion: number;
  createdAt: string;
  createdBy: string;
  active: boolean;
};

export type AdminSnapshot = {
  draft: ComposerPageDocument;
  draftVersion: number;
  updatedAt: string;
  updatedBy: string;
  activeRevisionId: string | null;
  publicVisible: boolean;
  revisions: RevisionSummary[];
};

export type AdminPageOption = {
  pageId: string;
  route: string;
  label: string;
  publicVisible: boolean;
  hasPublished: boolean;
  systemPage: boolean;
  pageType: ContentPageTypeId;
  status: ComposerPageDocument["status"];
  blockCount: number;
};

export type NavigationSnapshot = {
  draft: NavigationDocument;
  draftVersion: number;
  updatedAt: string;
  updatedBy: string;
  activeRevisionId: string | null;
  revisions: RevisionSummary[];
};

export type PublicPageResult = {
  page: ComposerPageDocument;
  mediaItems: MediaItem[];
  navigation: PublicNavigation;
  revisionId: string;
  source: "D1_ACTIVE_RELEASE";
};

export class RepositoryError extends Error {
  constructor(
    public readonly code:
      | "DATABASE_UNAVAILABLE"
      | "CONFLICT"
      | "NOT_FOUND"
      | "INVALID_DOCUMENT"
      | "DATABASE_ERROR",
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

const schemaReady = new WeakMap<object, Promise<void>>();

export function getRuntimeBindings(): RuntimeBindings {
  return env as unknown as RuntimeBindings;
}

export async function getAdminPageOptions(): Promise<AdminPageOption[]> {
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const result = await database
    .prepare(
      `SELECT p.id, p.route, p.title, p.draft_json,
              ps.public_visible, ps.system_page, ps.sort_order,
              CASE WHEN ar.revision_id IS NULL THEN 0 ELSE 1 END AS has_published
         FROM pages p
         JOIN page_settings ps ON ps.page_id = p.id
         LEFT JOIN active_releases ar ON ar.page_id = p.id
        ORDER BY ps.sort_order, p.id`,
    )
    .all<PageOptionRow>();
  return result.results.map((row) => {
    const document = parseDocument(row.draft_json);
    return {
      pageId: row.id,
      route: row.route,
      label: row.title,
      publicVisible: Boolean(row.public_visible),
      hasPublished: Boolean(row.has_published),
      systemPage: Boolean(row.system_page),
      pageType: document.pageType,
      status: document.status,
      blockCount: document.blocks.length,
    };
  });
}

export async function getPublicHome(): Promise<PublicPageResult> {
  const result = await getPublicPageByRoute("/");
  if (!result) throw new RepositoryError("NOT_FOUND", "Главная страница не найдена.");
  return result;
}

export async function getPublicPageByRoute(
  inputRoute: string,
): Promise<PublicPageResult | null> {
  const route = normalizePublicRoute(inputRoute);
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const row = await database
    .prepare(
      `SELECT pr.id AS revision_id, pr.payload_json
         FROM active_releases ar
         JOIN published_revisions pr ON pr.id = ar.revision_id
         JOIN pages p ON p.id = ar.page_id
         JOIN page_settings ps ON ps.page_id = p.id
        WHERE p.route = ?1 AND ps.public_visible = 1
        LIMIT 1`,
    )
    .bind(route)
    .first<{ revision_id: string; payload_json: string }>();
  if (!row) return null;
  const page = parseDocument(row.payload_json);
  return {
    page,
    mediaItems: await readMediaItems(database, collectComposerMediaIds(page)),
    navigation: await readPublicNavigation(database),
    revisionId: row.revision_id,
    source: "D1_ACTIVE_RELEASE",
  };
}

export async function getAdminSnapshot(pageId: string): Promise<AdminSnapshot> {
  if (!isValidPageId(pageId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор страницы.");
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  return readSnapshot(database, pageId);
}

export async function getPublicSitemapRoutes(): Promise<string[]> {
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const result = await database
    .prepare(
      `SELECT p.route
         FROM pages p
         JOIN page_settings ps ON ps.page_id = p.id
         JOIN active_releases ar ON ar.page_id = p.id
        WHERE ps.public_visible = 1
        ORDER BY ps.sort_order, p.route`,
    )
    .all<{ route: string }>();
  return result.results.map((row) => row.route);
}

export async function savePageDraft(
  document: unknown,
  expectedDraftVersion: number,
  actor: string,
): Promise<AdminSnapshot> {
  const validation = validateComposerPageDocument(document);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Черновик не соответствует контракту страницы.",
      validation.errors,
    );
  }
  if (validation.value.status !== "DRAFT") {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Редактируемый документ должен иметь статус DRAFT.",
    );
  }
  const pageId = validation.value.pageId;
  assertExpectedVersion(expectedDraftVersion);

  const database = requireDatabase();
  await ensureSiteSeed(database);
  const current = await readPageRow(database, pageId);
  if (current.route !== validation.value.route) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Адрес существующей страницы нельзя изменить через редактирование содержимого.",
    );
  }
  if (current.draft_version !== expectedDraftVersion) {
    throw new RepositoryError(
      "CONFLICT",
      `Черновик уже изменён: текущая версия ${current.draft_version}.`,
    );
  }

  const nextVersion = expectedDraftVersion + 1;
  const payloadJson = stableStringify(validation.value);
  const detail = stableStringify({
    fromDraftVersion: expectedDraftVersion,
    toDraftVersion: nextVersion,
  });
  const results = await database.batch([
    database
      .prepare(
        `UPDATE pages
            SET title = ?1,
                draft_json = ?2,
                draft_version = ?3,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = ?4
          WHERE id = ?5 AND draft_version = ?6`,
      )
      .bind(
        validation.value.title,
        payloadJson,
        nextVersion,
        actor,
        pageId,
        expectedDraftVersion,
      ),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         SELECT 'DRAFT_SAVED', ?1, ?2, ?3
          WHERE EXISTS (
            SELECT 1 FROM pages
             WHERE id = ?1 AND draft_version = ?4 AND updated_by = ?2
          )`,
      )
      .bind(pageId, actor, detail, nextVersion),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new RepositoryError(
      "CONFLICT",
      "Версия черновика изменилась во время сохранения.",
    );
  }
  return readSnapshot(database, pageId);
}

export async function publishPageDraft(
  pageId: string,
  expectedDraftVersion: number,
  actor: string,
): Promise<AdminSnapshot> {
  if (!isValidPageId(pageId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор страницы.");
  }
  assertExpectedVersion(expectedDraftVersion);
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const current = await readPageRow(database, pageId);
  if (current.draft_version !== expectedDraftVersion) {
    throw new RepositoryError(
      "CONFLICT",
      `Публикация остановлена: актуальная версия черновика ${current.draft_version}.`,
    );
  }
  const draft = parseDocument(current.draft_json);
  if (!hasVisibleComposerContent(draft)) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Публикация пустой или полностью скрытой страницы остановлена. Добавьте и покажите хотя бы один блок.",
    );
  }
  await assertMediaDependenciesPublishable(database, draft);
  const published: ComposerPageDocument = { ...draft, status: "PUBLISHED" };
  const validation = validateComposerPageDocument(published);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Публикация не прошла серверную валидацию.",
      validation.errors,
    );
  }
  const existing = await database
    .prepare(
      `SELECT id, revision_no FROM published_revisions
        WHERE page_id = ?1 AND source_draft_version = ?2
        LIMIT 1`,
    )
    .bind(pageId, expectedDraftVersion)
    .first<{ id: string; revision_no: number }>();
  if (existing) {
    const detail = stableStringify({
      revisionId: existing.id,
      revisionNo: existing.revision_no,
      sourceDraftVersion: expectedDraftVersion,
      idempotent: true,
    });
    await database.batch([
      database
        .prepare(
          `INSERT INTO active_releases (page_id, revision_id, switched_at, switched_by)
           VALUES (?1, ?2, CURRENT_TIMESTAMP, ?3)
           ON CONFLICT(page_id) DO UPDATE SET
             revision_id = excluded.revision_id,
             switched_at = CURRENT_TIMESTAMP,
             switched_by = excluded.switched_by`,
        )
        .bind(pageId, existing.id, actor),
      database
        .prepare(
          `UPDATE pages SET last_published_draft_version = ?1
            WHERE id = ?2 AND draft_version = ?1`,
        )
        .bind(expectedDraftVersion, pageId),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           VALUES ('REVISION_REACTIVATED', ?1, ?2, ?3)`,
        )
        .bind(pageId, actor, detail),
    ]);
    return readSnapshot(database, pageId);
  }
  const nextRevision = await database
    .prepare(
      `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_revision
         FROM published_revisions WHERE page_id = ?1`,
    )
    .bind(pageId)
    .first<{ next_revision: number }>();
  const revisionNo = Number(nextRevision?.next_revision ?? 1);
  const revisionId = `rev_${pageId}_${expectedDraftVersion}_${crypto
    .randomUUID()
    .replaceAll("-", "")}`;
  const payloadJson = stableStringify(validation.value);
  const payloadSha256 = await sha256(payloadJson);
  const detail = stableStringify({
    revisionId,
    revisionNo,
    sourceDraftVersion: expectedDraftVersion,
    payloadSha256,
  });

  try {
    await database.batch([
      database
        .prepare(
          `INSERT INTO published_revisions
            (id, page_id, revision_no, payload_json, payload_sha256, source_draft_version, created_by)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(
          revisionId,
          pageId,
          revisionNo,
          payloadJson,
          payloadSha256,
          expectedDraftVersion,
          actor,
        ),
      database
        .prepare(
          `INSERT INTO active_releases (page_id, revision_id, switched_at, switched_by)
           VALUES (?1, ?2, CURRENT_TIMESTAMP, ?3)
           ON CONFLICT(page_id) DO UPDATE SET
             revision_id = excluded.revision_id,
             switched_at = CURRENT_TIMESTAMP,
             switched_by = excluded.switched_by`,
        )
        .bind(pageId, revisionId, actor),
      database
        .prepare(
          `UPDATE pages SET last_published_draft_version = ?1
            WHERE id = ?2 AND draft_version = ?1`,
        )
        .bind(expectedDraftVersion, pageId),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           VALUES ('REVISION_PUBLISHED', ?1, ?2, ?3)`,
        )
        .bind(pageId, actor, detail),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) {
      throw new RepositoryError(
        "CONFLICT",
        "Параллельная публикация уже создала ревизию. Обновите состояние.",
      );
    }
    throw toDatabaseError(error);
  }
  return readSnapshot(database, pageId);
}

export async function rollbackPage(
  pageId: string,
  targetRevisionId: string,
  expectedActiveRevisionId: string,
  actor: string,
): Promise<AdminSnapshot> {
  if (!isValidPageId(pageId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор страницы.");
  }
  if (!/^rev_[a-z0-9_]+$/i.test(targetRevisionId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор ревизии.");
  }
  if (!/^rev_[a-z0-9_]+$/i.test(expectedActiveRevisionId)) {
    throw new RepositoryError("CONFLICT", "Активная ревизия изменилась. Обновите страницу.");
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const target = await database
    .prepare(
      `SELECT id, revision_no FROM published_revisions
        WHERE id = ?1 AND page_id = ?2 LIMIT 1`,
    )
    .bind(targetRevisionId, pageId)
    .first<{ id: string; revision_no: number }>();
  if (!target) {
    throw new RepositoryError("NOT_FOUND", "Ревизия для отката не найдена.");
  }
  const active = await database
    .prepare(`SELECT revision_id FROM active_releases WHERE page_id = ?1`)
    .bind(pageId)
    .first<{ revision_id: string }>();
  if (active?.revision_id === targetRevisionId) {
    throw new RepositoryError("CONFLICT", "Эта ревизия уже активна.");
  }
  if (active?.revision_id !== expectedActiveRevisionId) {
    throw new RepositoryError(
      "CONFLICT",
      "Активная ревизия изменилась. Обновите страницу перед откатом.",
    );
  }
  const detail = stableStringify({
    fromRevisionId: active?.revision_id ?? null,
    toRevisionId: targetRevisionId,
    targetRevisionNo: target.revision_no,
  });
  const results = await database.batch([
    database
      .prepare(
        `UPDATE active_releases
            SET revision_id = ?1,
                switched_at = CURRENT_TIMESTAMP,
                switched_by = ?2
          WHERE page_id = ?3 AND revision_id = ?4`,
      )
      .bind(targetRevisionId, actor, pageId, expectedActiveRevisionId),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         SELECT 'REVISION_ROLLBACK', ?1, ?2, ?3
          WHERE changes() = 1`,
      )
      .bind(pageId, actor, detail),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new RepositoryError(
      "CONFLICT",
      "Активная ревизия изменилась во время отката. Обновите страницу.",
    );
  }
  return readSnapshot(database, pageId);
}

export async function createPage(
  title: string,
  slugInput: string,
  pageType: unknown,
  actor: string,
): Promise<AdminSnapshot> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Название новой страницы должно содержать 1–120 символов.",
    );
  }
  if (!isContentPageType(pageType)) {
    throw new RepositoryError("INVALID_DOCUMENT", "Выберите допустимый тип страницы.");
  }
  const route = routeFromComposerSlugInput(slugInput);
  if (!route) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Адрес должен состоять из латинских сегментов, цифр и дефисов.",
    );
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const exists = await database
    .prepare(`SELECT id FROM pages WHERE route = ?1 LIMIT 1`)
    .bind(route)
    .first<{ id: string }>();
  if (exists) throw new RepositoryError("CONFLICT", "Страница с таким адресом уже существует.");

  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const pageId = `page_custom_${token}`;
  const document = createBlankComposerPage(pageId, route, cleanTitle, pageType);
  const validation = validateComposerPageDocument(document);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Пустая страница не прошла серверную проверку.",
      validation.errors,
    );
  }
  const nextOrder = await database
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM page_settings`)
    .first<{ next_order: number }>();
  const detail = stableStringify({
    route,
    pageType,
    publicVisible: false,
    initialBlockCount: 0,
  });
  try {
    await database.batch([
      database
        .prepare(
          `INSERT INTO pages
            (id, route, title, draft_json, draft_version,
             last_published_draft_version, updated_by)
           VALUES (?1, ?2, ?3, ?4, 1, 0, ?5)`,
        )
        .bind(pageId, route, cleanTitle, stableStringify(validation.value), actor),
      database
        .prepare(
          `INSERT INTO page_settings
            (page_id, public_visible, system_page, sort_order, created_by)
           VALUES (?1, 0, 0, ?2, ?3)`,
        )
        .bind(pageId, Number(nextOrder?.next_order ?? 1000), actor),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           VALUES ('PAGE_CREATED_HIDDEN', ?1, ?2, ?3)`,
        )
        .bind(pageId, actor, detail),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) {
      throw new RepositoryError("CONFLICT", "Страница с таким адресом уже создана.");
    }
    throw toDatabaseError(error);
  }
  return readSnapshot(database, pageId);
}

export async function duplicatePage(
  sourcePageId: string,
  title: string,
  slugInput: string,
  actor: string,
): Promise<AdminSnapshot> {
  if (!isValidPageId(sourcePageId)) {
    throw new RepositoryError("NOT_FOUND", "Исходная страница не найдена.");
  }
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Название новой страницы должно содержать 1–120 символов.",
    );
  }
  const route = routeFromComposerSlugInput(slugInput);
  if (!route) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Адрес должен содержать латинские буквы, цифры и дефисы и не быть системным.",
    );
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const exists = await database
    .prepare(`SELECT id FROM pages WHERE route = ?1 LIMIT 1`)
    .bind(route)
    .first<{ id: string }>();
  if (exists) {
    throw new RepositoryError("CONFLICT", "Страница с таким адресом уже существует.");
  }
  const source = await readPageRow(database, sourcePageId);
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const pageId = `page_custom_${token}`;
  const sourceDocument = parseDocument(source.draft_json);
  const document = cloneForNewPage(sourceDocument, pageId, route, cleanTitle, token);
  const validation = validateComposerPageDocument(document);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Новая страница не прошла проверку.",
      validation.errors,
    );
  }
  const nextOrder = await database
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM page_settings`)
    .first<{ next_order: number }>();
  const detail = stableStringify({ sourcePageId, route, publicVisible: false });
  await database.batch([
    database
      .prepare(
        `INSERT INTO pages
          (id, route, title, draft_json, draft_version,
           last_published_draft_version, updated_by)
         VALUES (?1, ?2, ?3, ?4, 1, 0, ?5)`,
      )
      .bind(pageId, route, cleanTitle, stableStringify(validation.value), actor),
    database
      .prepare(
        `INSERT INTO page_settings
          (page_id, public_visible, system_page, sort_order, created_by)
         VALUES (?1, 0, 0, ?2, ?3)`,
      )
      .bind(pageId, Number(nextOrder?.next_order ?? 1000), actor),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         VALUES ('PAGE_DUPLICATED_HIDDEN', ?1, ?2, ?3)`,
      )
      .bind(pageId, actor, detail),
  ]);
  return readSnapshot(database, pageId);
}

export async function setPagePublicVisibility(
  pageId: string,
  visible: boolean,
  actor: string,
): Promise<AdminSnapshot> {
  if (!isValidPageId(pageId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор страницы.");
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  await readPageRow(database, pageId);
  if (visible) {
    const active = await database
      .prepare(
        `SELECT ar.revision_id, pr.payload_json
           FROM active_releases ar
           JOIN published_revisions pr ON pr.id = ar.revision_id
          WHERE ar.page_id = ?1
          LIMIT 1`,
      )
      .bind(pageId)
      .first<{ revision_id: string; payload_json: string }>();
    if (!active) {
      throw new RepositoryError(
        "CONFLICT",
        "Сначала опубликуйте ревизию страницы, затем включите публичную видимость.",
      );
    }
    if (!hasVisibleComposerContent(parseDocument(active.payload_json))) {
      throw new RepositoryError(
        "CONFLICT",
        "Нельзя открыть пустую или полностью скрытую опубликованную страницу.",
      );
    }
  }
  const current = await database
    .prepare(`SELECT public_visible FROM page_settings WHERE page_id = ?1 LIMIT 1`)
    .bind(pageId)
    .first<{ public_visible: number }>();
  if (!current) throw new RepositoryError("NOT_FOUND", "Настройки страницы не найдены.");
  if (Boolean(current.public_visible) === visible) {
    throw new RepositoryError("CONFLICT", "Публичная видимость уже имеет это состояние.");
  }
  await database.batch([
    database
      .prepare(`UPDATE page_settings SET public_visible = ?1 WHERE page_id = ?2`)
      .bind(visible ? 1 : 0, pageId),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         VALUES ('PAGE_VISIBILITY_CHANGED', ?1, ?2, ?3)`,
      )
      .bind(pageId, actor, stableStringify({ publicVisible: visible })),
  ]);
  return readSnapshot(database, pageId);
}

export async function getAdminNavigationSnapshot(): Promise<NavigationSnapshot> {
  const database = requireDatabase();
  await ensureSiteSeed(database);
  return readNavigationSnapshot(database);
}

export async function getDraftNavigationPreview(): Promise<PublicNavigation> {
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const row = await readNavigationRow(database);
  const knownPageIds = await readKnownPageIds(database);
  const document = parseNavigationDocument(row.draft_json, knownPageIds);
  const pages = await database
    .prepare(`SELECT id, route FROM pages`)
    .all<{ id: string; route: string }>();
  const routes = new Map(pages.results.map((page) => [page.id, page.route]));
  const result = emptyPublicNavigation();
  for (const placement of NAVIGATION_PLACEMENTS) {
    result[placement] = document.items
      .filter((item) => item.enabled && item.placement === placement)
      .sort((a, b) => a.position - b.position)
      .flatMap((item) => {
        const href = routes.get(item.targetPageId);
        return href
          ? [{
              itemId: item.itemId,
              label: item.label,
              targetPageId: item.targetPageId,
              href,
            }]
          : [];
      });
  }
  return result;
}

export async function saveNavigationDraft(
  document: unknown,
  expectedDraftVersion: number,
  actor: string,
): Promise<NavigationSnapshot> {
  assertExpectedVersion(expectedDraftVersion);
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const knownPageIds = await readKnownPageIds(database);
  const validation = validateNavigationDocument(document, knownPageIds);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Меню не соответствует контракту.",
      validation.errors,
    );
  }
  const current = await readNavigationRow(database);
  if (current.draft_version !== expectedDraftVersion) {
    throw new RepositoryError(
      "CONFLICT",
      `Меню уже изменено: текущая версия ${current.draft_version}.`,
    );
  }
  const nextVersion = expectedDraftVersion + 1;
  const payloadJson = stableStringify(validation.value);
  const detail = stableStringify({
    fromDraftVersion: expectedDraftVersion,
    toDraftVersion: nextVersion,
  });
  const results = await database.batch([
    database
      .prepare(
        `UPDATE navigation_state
            SET draft_json = ?1, draft_version = ?2,
                updated_at = CURRENT_TIMESTAMP, updated_by = ?3
          WHERE id = ?4 AND draft_version = ?5`,
      )
      .bind(payloadJson, nextVersion, actor, MAIN_MENU_ID, expectedDraftVersion),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         SELECT 'NAVIGATION_DRAFT_SAVED', ?1, ?2, ?3
          WHERE EXISTS (
            SELECT 1 FROM navigation_state
             WHERE id = ?1 AND draft_version = ?4 AND updated_by = ?2
          )`,
      )
      .bind(MAIN_MENU_ID, actor, detail, nextVersion),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new RepositoryError("CONFLICT", "Версия меню изменилась во время сохранения.");
  }
  return readNavigationSnapshot(database);
}

export async function publishNavigationDraft(
  expectedDraftVersion: number,
  actor: string,
): Promise<NavigationSnapshot> {
  assertExpectedVersion(expectedDraftVersion);
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const current = await readNavigationRow(database);
  if (current.draft_version !== expectedDraftVersion) {
    throw new RepositoryError(
      "CONFLICT",
      `Публикация остановлена: актуальная версия меню ${current.draft_version}.`,
    );
  }
  const existing = await database
    .prepare(
      `SELECT id FROM navigation_revisions
        WHERE menu_id = ?1 AND source_draft_version = ?2 LIMIT 1`,
    )
    .bind(MAIN_MENU_ID, expectedDraftVersion)
    .first<{ id: string }>();
  if (existing) throw new RepositoryError("CONFLICT", "Эта версия меню уже опубликована.");
  const knownPageIds = await readKnownPageIds(database);
  const document = parseNavigationDocument(current.draft_json, knownPageIds);
  const nextRevision = await database
    .prepare(
      `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_revision
         FROM navigation_revisions WHERE menu_id = ?1`,
    )
    .bind(MAIN_MENU_ID)
    .first<{ next_revision: number }>();
  const revisionNo = Number(nextRevision?.next_revision ?? 1);
  const revisionId = `navrev_${expectedDraftVersion}_${crypto.randomUUID().replaceAll("-", "")}`;
  const payloadJson = stableStringify(document);
  const payloadSha256 = await sha256(payloadJson);
  const detail = stableStringify({ revisionId, revisionNo, expectedDraftVersion, payloadSha256 });
  await database.batch([
    database
      .prepare(
        `INSERT INTO navigation_revisions
          (id, menu_id, revision_no, payload_json, payload_sha256,
           source_draft_version, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        revisionId,
        MAIN_MENU_ID,
        revisionNo,
        payloadJson,
        payloadSha256,
        expectedDraftVersion,
        actor,
      ),
    database
      .prepare(
        `INSERT INTO active_navigation (menu_id, revision_id, switched_at, switched_by)
         VALUES (?1, ?2, CURRENT_TIMESTAMP, ?3)
         ON CONFLICT(menu_id) DO UPDATE SET
           revision_id = excluded.revision_id,
           switched_at = CURRENT_TIMESTAMP,
           switched_by = excluded.switched_by`,
      )
      .bind(MAIN_MENU_ID, revisionId, actor),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         VALUES ('NAVIGATION_REVISION_PUBLISHED', ?1, ?2, ?3)`,
      )
      .bind(MAIN_MENU_ID, actor, detail),
  ]);
  return readNavigationSnapshot(database);
}

export async function rollbackNavigation(
  targetRevisionId: string,
  actor: string,
): Promise<NavigationSnapshot> {
  if (!/^navrev_[a-z0-9_]+$/i.test(targetRevisionId)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный идентификатор ревизии меню.");
  }
  const database = requireDatabase();
  await ensureSiteSeed(database);
  const target = await database
    .prepare(
      `SELECT id, revision_no FROM navigation_revisions
        WHERE id = ?1 AND menu_id = ?2 LIMIT 1`,
    )
    .bind(targetRevisionId, MAIN_MENU_ID)
    .first<{ id: string; revision_no: number }>();
  if (!target) throw new RepositoryError("NOT_FOUND", "Ревизия меню не найдена.");
  const active = await database
    .prepare(`SELECT revision_id FROM active_navigation WHERE menu_id = ?1 LIMIT 1`)
    .bind(MAIN_MENU_ID)
    .first<{ revision_id: string }>();
  if (active?.revision_id === targetRevisionId) {
    throw new RepositoryError("CONFLICT", "Эта ревизия меню уже активна.");
  }
  await database.batch([
    database
      .prepare(
        `UPDATE active_navigation
            SET revision_id = ?1, switched_at = CURRENT_TIMESTAMP, switched_by = ?2
          WHERE menu_id = ?3`,
      )
      .bind(targetRevisionId, actor, MAIN_MENU_ID),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         VALUES ('NAVIGATION_ROLLBACK', ?1, ?2, ?3)`,
      )
      .bind(
        MAIN_MENU_ID,
        actor,
        stableStringify({
          fromRevisionId: active?.revision_id ?? null,
          toRevisionId: targetRevisionId,
          targetRevisionNo: target.revision_no,
        }),
      ),
  ]);
  return readNavigationSnapshot(database);
}

function requireDatabase(): D1Database {
  const database = getRuntimeBindings().DB;
  if (!database) {
    throw new RepositoryError(
      "DATABASE_UNAVAILABLE",
      "Хранилище D1 недоступно. Изменения не были сохранены.",
    );
  }
  return database;
}

function assertExpectedVersion(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RepositoryError("CONFLICT", "Некорректная ожидаемая версия черновика.");
  }
}

async function ensureSiteSeed(database: D1Database) {
  const databaseKey = database as unknown as object;
  let pending = schemaReady.get(databaseKey);
  if (!pending) {
    pending = initialize(database).catch((error) => {
      schemaReady.delete(databaseKey);
      throw error;
    });
    schemaReady.set(databaseKey, pending);
  }
  await pending;
}

async function initialize(database: D1Database) {
  await database.batch(
    schemaStatements.map((statement) => database.prepare(statement)),
  );
  const seeds = await Promise.all(
    SITE_SEEDS.map(async (seed) => {
      const composerSeed = migratePageDocument(seed);
      const draftJson = stableStringify(composerSeed);
      const published: ComposerPageDocument = {
        ...cloneComposerPageDocument(composerSeed),
        status: "PUBLISHED",
      };
      const publishedJson = stableStringify(published);
      return {
        seed: composerSeed,
        draftJson,
        publishedJson,
        publishedSha: await sha256(publishedJson),
        revisionId: seedRevisionId(seed.pageId),
      };
    }),
  );
  const statements: D1PreparedStatement[] = [];
  for (const [seedIndex, item] of seeds.entries()) {
    statements.push(
      database
        .prepare(
          `INSERT OR IGNORE INTO pages
            (id, route, title, draft_json, draft_version, last_published_draft_version, updated_by)
           VALUES (?1, ?2, ?3, ?4, 1, 1, ?5)`,
        )
        .bind(
          item.seed.pageId,
          item.seed.route,
          item.seed.title,
          item.draftJson,
          SEED_ACTOR,
        ),
      database
        .prepare(
          `INSERT OR IGNORE INTO page_settings
            (page_id, public_visible, system_page, sort_order, created_by)
           VALUES (?1, 1, 1, ?2, ?3)`,
        )
        .bind(item.seed.pageId, seedIndex, SEED_ACTOR),
      database
        .prepare(
          `INSERT OR IGNORE INTO published_revisions
            (id, page_id, revision_no, payload_json, payload_sha256, source_draft_version, created_by)
           VALUES (?1, ?2, 1, ?3, ?4, 1, ?5)`,
        )
        .bind(
          item.revisionId,
          item.seed.pageId,
          item.publishedJson,
          item.publishedSha,
          SEED_ACTOR,
        ),
      database
        .prepare(
          `INSERT OR IGNORE INTO active_releases
            (page_id, revision_id, switched_by)
           VALUES (?1, ?2, ?3)`,
        )
        .bind(item.seed.pageId, item.revisionId, SEED_ACTOR),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           SELECT 'OWNER_CONTENT_SEED_CREATED', ?1, ?2, ?3
            WHERE NOT EXISTS (
              SELECT 1 FROM audit_events
               WHERE action = 'OWNER_CONTENT_SEED_CREATED' AND entity_id = ?1
            )`,
        )
        .bind(
          item.seed.pageId,
          SEED_ACTOR,
          stableStringify({
            revisionId: item.revisionId,
            payloadSha: item.publishedSha,
          }),
      ),
    );
  }
  const navigationJson = stableStringify(DEFAULT_NAVIGATION);
  const navigationSha = await sha256(navigationJson);
  const navigationRevisionId = "navrev_seed_001";
  statements.push(
    database
      .prepare(
        `INSERT OR IGNORE INTO navigation_state
          (id, draft_json, draft_version, updated_by)
         VALUES (?1, ?2, 1, ?3)`,
      )
      .bind(MAIN_MENU_ID, navigationJson, SEED_ACTOR),
    database
      .prepare(
        `INSERT OR IGNORE INTO navigation_revisions
          (id, menu_id, revision_no, payload_json, payload_sha256,
           source_draft_version, created_by)
         VALUES (?1, ?2, 1, ?3, ?4, 1, ?5)`,
      )
      .bind(
        navigationRevisionId,
        MAIN_MENU_ID,
        navigationJson,
        navigationSha,
        SEED_ACTOR,
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO active_navigation
          (menu_id, revision_id, switched_by)
         VALUES (?1, ?2, ?3)`,
      )
      .bind(MAIN_MENU_ID, navigationRevisionId, SEED_ACTOR),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         SELECT 'NAVIGATION_SEED_CREATED', ?1, ?2, ?3
          WHERE NOT EXISTS (
            SELECT 1 FROM audit_events
             WHERE action = 'NAVIGATION_SEED_CREATED' AND entity_id = ?1
          )`,
      )
      .bind(
        MAIN_MENU_ID,
        SEED_ACTOR,
        stableStringify({ navigationRevisionId, payloadSha256: navigationSha }),
      ),
  );
  await database.batch(statements);
  try {
    await applyMoscowCopyMigration(database);
  } catch (error) {
    if (!(error instanceof ContentMigrationError)) throw error;
    console.error("MOSCOW_COPY_MIGRATION_SKIPPED", error.message);
  }
}

async function readPageRow(
  database: D1Database,
  pageId: string,
): Promise<PageRow> {
  const row = await database
    .prepare(
      `SELECT id, route, title, draft_json, draft_version,
              last_published_draft_version, updated_at, updated_by
         FROM pages WHERE id = ?1 LIMIT 1`,
    )
    .bind(pageId)
    .first<PageRow>();
  if (!row) throw new RepositoryError("NOT_FOUND", "Страница не найдена.");
  return row;
}

async function readSnapshot(
  database: D1Database,
  pageId: string,
): Promise<AdminSnapshot> {
  const row = await readPageRow(database, pageId);
  const active = await database
    .prepare(`SELECT revision_id FROM active_releases WHERE page_id = ?1`)
    .bind(pageId)
    .first<{ revision_id: string }>();
  const settings = await database
    .prepare(`SELECT public_visible FROM page_settings WHERE page_id = ?1 LIMIT 1`)
    .bind(pageId)
    .first<{ public_visible: number }>();
  const result = await database
    .prepare(
      `SELECT id, revision_no, payload_sha256, source_draft_version,
              created_at, created_by
         FROM published_revisions
        WHERE page_id = ?1
        ORDER BY revision_no DESC
        LIMIT 30`,
    )
    .bind(pageId)
    .all<{
      id: string;
      revision_no: number;
      payload_sha256: string;
      source_draft_version: number;
      created_at: string;
      created_by: string;
    }>();
  return {
    draft: parseDocument(row.draft_json),
    draftVersion: Number(row.draft_version),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    activeRevisionId: active?.revision_id ?? null,
    publicVisible: Boolean(settings?.public_visible),
    revisions: result.results.map((revision) => ({
      id: revision.id,
      revisionNo: Number(revision.revision_no),
      payloadSha256: revision.payload_sha256,
      sourceDraftVersion: Number(revision.source_draft_version),
      createdAt: revision.created_at,
      createdBy: revision.created_by,
      active: revision.id === active?.revision_id,
    })),
  };
}

async function readKnownPageIds(database: D1Database): Promise<Set<string>> {
  const result = await database.prepare(`SELECT id FROM pages`).all<{ id: string }>();
  return new Set(result.results.map((row) => row.id));
}

async function readNavigationRow(database: D1Database): Promise<NavigationRow> {
  const row = await database
    .prepare(
      `SELECT id, draft_json, draft_version, updated_at, updated_by
         FROM navigation_state WHERE id = ?1 LIMIT 1`,
    )
    .bind(MAIN_MENU_ID)
    .first<NavigationRow>();
  if (!row) throw new RepositoryError("NOT_FOUND", "Меню не найдено.");
  return row;
}

async function readNavigationSnapshot(
  database: D1Database,
): Promise<NavigationSnapshot> {
  const row = await readNavigationRow(database);
  const active = await database
    .prepare(`SELECT revision_id FROM active_navigation WHERE menu_id = ?1 LIMIT 1`)
    .bind(MAIN_MENU_ID)
    .first<{ revision_id: string }>();
  const revisions = await database
    .prepare(
      `SELECT id, revision_no, payload_sha256, source_draft_version,
              created_at, created_by
         FROM navigation_revisions
        WHERE menu_id = ?1
        ORDER BY revision_no DESC
        LIMIT 30`,
    )
    .bind(MAIN_MENU_ID)
    .all<{
      id: string;
      revision_no: number;
      payload_sha256: string;
      source_draft_version: number;
      created_at: string;
      created_by: string;
    }>();
  const knownPageIds = await readKnownPageIds(database);
  const parsed = parseNavigationDocument(row.draft_json, knownPageIds);
  return {
    draft: parsed,
    draftVersion: Number(row.draft_version),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    activeRevisionId: active?.revision_id ?? null,
    revisions: revisions.results.map((revision) => ({
      id: revision.id,
      revisionNo: Number(revision.revision_no),
      payloadSha256: revision.payload_sha256,
      sourceDraftVersion: Number(revision.source_draft_version),
      createdAt: revision.created_at,
      createdBy: revision.created_by,
      active: revision.id === active?.revision_id,
    })),
  };
}

async function readPublicNavigation(database: D1Database): Promise<PublicNavigation> {
  const active = await database
    .prepare(
      `SELECT nr.payload_json
         FROM active_navigation an
         JOIN navigation_revisions nr ON nr.id = an.revision_id
        WHERE an.menu_id = ?1 LIMIT 1`,
    )
    .bind(MAIN_MENU_ID)
    .first<{ payload_json: string }>();
  if (!active) {
    throw new RepositoryError(
      "DATABASE_ERROR",
      "Активная версия навигации не найдена.",
    );
  }
  const knownPageIds = await readKnownPageIds(database);
  const document = parseNavigationDocument(active.payload_json, knownPageIds);
  const pageRows = await database
    .prepare(
      `SELECT p.id, p.route
         FROM pages p
         JOIN page_settings ps ON ps.page_id = p.id
         JOIN active_releases ar ON ar.page_id = p.id
        WHERE ps.public_visible = 1`,
    )
    .all<{ id: string; route: string }>();
  const routes = new Map(pageRows.results.map((row) => [row.id, row.route]));
  const result = emptyPublicNavigation();
  for (const placement of NAVIGATION_PLACEMENTS) {
    result[placement] = document.items
      .filter((item) => item.enabled && item.placement === placement)
      .sort((a, b) => a.position - b.position)
      .flatMap((item) => {
        const href = routes.get(item.targetPageId);
        return href
          ? [{
              itemId: item.itemId,
              label: item.label,
              targetPageId: item.targetPageId,
              href,
            }]
          : [];
      });
  }
  return result;
}

function emptyPublicNavigation(): PublicNavigation {
  return { primary: [], age: [], footer: [] };
}

function parseNavigationDocument(
  payloadJson: string,
  knownPageIds?: ReadonlySet<string>,
): NavigationDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new RepositoryError("INVALID_DOCUMENT", "Сохранённое меню повреждено.");
  }
  const validation = validateNavigationDocument(parsed, knownPageIds);
  if (!validation.ok) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Сохранённое меню не соответствует контракту.",
      validation.errors,
    );
  }
  return validation.value;
}

function cloneForNewPage(
  source: ComposerPageDocument,
  pageId: string,
  route: string,
  title: string,
  token: string,
): ComposerPageDocument {
  const document = cloneComposerPageDocument(source);
  document.pageId = pageId;
  document.route = route;
  document.title = title;
  document.status = "DRAFT";
  document.seo = {
    ...document.seo,
    title: `${title} — Дом детской фотографии`.slice(0, 70),
    indexing: "NOINDEX",
    canonical: null,
  };
  document.blocks = reindexComposerBlocks(
    document.blocks.map((block, index) => cloneComposerBlock(block, token, index)),
  );
  document.quarantinedBlocks = document.quarantinedBlocks.map((block, index) => {
    const cloned = cloneComposerBlock(block, `${token}_q`, index);
    return { ...cloned, position: block.position };
  });
  return document;
}

function cloneComposerBlock(
  block: ComposerBlock,
  token: string,
  index: number,
): ComposerBlock {
  const data = structuredClone(block.data);
  if (Array.isArray(data.photoWindows)) {
    data.photoWindows = data.photoWindows.map((windowValue, windowIndex) =>
      typeof windowValue === "object" && windowValue !== null
        ? { ...windowValue, windowId: `window_${token}_${index}_${windowIndex}` }
        : windowValue,
    );
  }
  if (block.type === "F20" && Array.isArray(data.slots)) {
    data.slots = data.slots.map((slotValue, slotIndex) => {
      if (typeof slotValue !== "object" || slotValue === null || Array.isArray(slotValue)) {
        return slotValue;
      }
      const nestedToken = `${token}_${index}_${slotIndex}`;
      const slotBlocks: unknown[] = Array.isArray(slotValue.blocks)
        ? slotValue.blocks
        : [];
      const nestedBlocks = slotBlocks.length
        ? slotBlocks
            .filter(isStoredComposerBlock)
            .map((nestedBlock: ComposerBlock, nestedIndex: number) =>
              cloneComposerBlock(nestedBlock, nestedToken, nestedIndex),
            )
        : [];
      return {
        ...slotValue,
        slotId: `slot_${nestedToken}`,
        blocks: reindexComposerBlocks(nestedBlocks),
      };
    });
  }
  return {
    ...block,
    blockId: `block_${token}_${index}`,
    position: index,
    data,
  };
}

function isStoredComposerBlock(value: unknown): value is ComposerBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Partial<ComposerBlock>).blockId === "string" &&
    typeof (value as Partial<ComposerBlock>).type === "string" &&
    typeof (value as Partial<ComposerBlock>).hidden === "boolean"
  );
}

async function readMediaItems(
  database: D1Database,
  ids: string[],
): Promise<MediaItem[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)].slice(0, 200);
  const placeholders = unique.map((_, index) => `?${index + 1}`).join(",");
  const result = await database
    .prepare(
      `SELECT id, mime_type, name, byte_size, sha256, width, height,
              aspect_ratio, alt, caption, fit_mode, focal_x, focal_y,
              rights_status, rights_scope, lifecycle, recovery_status,
              version, created_at, created_by, updated_at, updated_by
         FROM media_items WHERE id IN (${placeholders})`,
    )
    .bind(...unique)
    .all<MediaRow>();
  const byId = new Map(result.results.map((row) => [row.id, mediaItemFromRow(row)]));
  return unique.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

async function assertMediaDependenciesPublishable(
  database: D1Database,
  document: ComposerPageDocument,
) {
  const ids = collectComposerMediaIds(document);
  if (ids.length === 0) return;
  const items = await readMediaItems(database, ids);
  const byId = new Map(items.map((item) => [item.id, item]));
  const blocked = ids.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [`${id}: файл отсутствует в медиатеке.`];
    const reasons: string[] = [];
    if (item.rightsStatus !== "APPROVED") reasons.push("права не подтверждены");
    if (item.lifecycle !== "READY") reasons.push("файл не готов к выпуску");
    if (item.recoveryStatus !== "VERIFIED_INDEPENDENT_COPY") {
      reasons.push("нет проверенной независимой копии");
    }
    return reasons.length ? [`${id}: ${reasons.join(", ")}.`] : [];
  });
  if (blocked.length) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Публикация остановлена медиашлюзом.",
      blocked,
    );
  }
}

function mediaItemFromRow(row: MediaRow): MediaItem {
  return {
    id: row.id,
    mediaType: "image",
    name: row.name,
    mimeType: row.mime_type as ImageMimeType,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    width: Number(row.width),
    height: Number(row.height),
    aspectRatio: row.aspect_ratio,
    alt: row.alt,
    caption: row.caption,
    fitMode: row.fit_mode as MediaItem["fitMode"],
    focalX: Number(row.focal_x) / 10_000,
    focalY: Number(row.focal_y) / 10_000,
    rightsStatus: row.rights_status as MediaItem["rightsStatus"],
    rightsScope: row.rights_scope,
    lifecycle: row.lifecycle as MediaItem["lifecycle"],
    recoveryStatus: row.recovery_status as MediaItem["recoveryStatus"],
    version: Number(row.version),
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function parseDocument(payloadJson: string): ComposerPageDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new RepositoryError("INVALID_DOCUMENT", "Сохранённый JSON повреждён.");
  }
  try {
    return migratePageDocument(parsed);
  } catch (error) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      "Сохранённая страница не соответствует контракту.",
      [error instanceof Error ? error.message : String(error)],
    );
  }
}

function seedRevisionId(pageId: string) {
  return `rev_${pageId}_seed_001`;
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

function toDatabaseError(error: unknown) {
  if (error instanceof RepositoryError) return error;
  return new RepositoryError(
    "DATABASE_ERROR",
    "Операция хранилища не завершена; данные не опубликованы.",
    [error instanceof Error ? error.message : String(error)],
  );
}

const schemaStatements = [
  CONTENT_MIGRATION_SCHEMA_STATEMENT,
  `CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY NOT NULL,
    route TEXT NOT NULL,
    title TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    draft_version INTEGER DEFAULT 1 NOT NULL,
    last_published_draft_version INTEGER DEFAULT 0 NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pages_route_unique ON pages (route)`,
  `CREATE TABLE IF NOT EXISTS page_settings (
    page_id TEXT PRIMARY KEY NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    public_visible INTEGER DEFAULT 0 NOT NULL,
    system_page INTEGER DEFAULT 0 NOT NULL,
    sort_order INTEGER DEFAULT 1000 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS published_revisions (
    id TEXT PRIMARY KEY NOT NULL,
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL,
    source_draft_version INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS published_revisions_page_revision_unique
    ON published_revisions (page_id, revision_no)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS published_revisions_page_draft_unique
    ON published_revisions (page_id, source_draft_version)`,
  `CREATE INDEX IF NOT EXISTS published_revisions_page_created_idx
    ON published_revisions (page_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY NOT NULL,
    media_type TEXT NOT NULL,
    name TEXT NOT NULL,
    original_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    aspect_ratio TEXT NOT NULL,
    alt TEXT NOT NULL,
    caption TEXT DEFAULT '' NOT NULL,
    fit_mode TEXT DEFAULT 'cover' NOT NULL,
    focal_x INTEGER DEFAULT 5000 NOT NULL,
    focal_y INTEGER DEFAULT 5000 NOT NULL,
    rights_status TEXT DEFAULT 'NOT_GRANTED' NOT NULL,
    rights_scope TEXT DEFAULT '' NOT NULL,
    lifecycle TEXT DEFAULT 'DRAFT' NOT NULL,
    recovery_status TEXT DEFAULT 'PENDING_INDEPENDENT_COPY' NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS media_items_sha_unique ON media_items (sha256)`,
  `CREATE INDEX IF NOT EXISTS media_items_created_idx ON media_items (created_at)`,
  `CREATE INDEX IF NOT EXISTS media_items_public_gate_idx
    ON media_items (lifecycle, rights_status)`,
  `CREATE TABLE IF NOT EXISTS active_releases (
    page_id TEXT PRIMARY KEY NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    revision_id TEXT NOT NULL REFERENCES published_revisions(id) ON DELETE RESTRICT,
    switched_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    switched_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS navigation_state (
    id TEXT PRIMARY KEY NOT NULL,
    draft_json TEXT NOT NULL,
    draft_version INTEGER DEFAULT 1 NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS navigation_revisions (
    id TEXT PRIMARY KEY NOT NULL,
    menu_id TEXT NOT NULL REFERENCES navigation_state(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL,
    source_draft_version INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS navigation_revisions_menu_revision_unique
    ON navigation_revisions (menu_id, revision_no)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS navigation_revisions_menu_draft_unique
    ON navigation_revisions (menu_id, source_draft_version)`,
  `CREATE TABLE IF NOT EXISTS active_navigation (
    menu_id TEXT PRIMARY KEY NOT NULL REFERENCES navigation_state(id) ON DELETE CASCADE,
    revision_id TEXT NOT NULL REFERENCES navigation_revisions(id) ON DELETE RESTRICT,
    switched_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    switched_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    action TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS audit_events_entity_created_idx
    ON audit_events (entity_id, created_at)`,
] as const;
