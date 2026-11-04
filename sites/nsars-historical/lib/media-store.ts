import {
  inspectImageFile,
  safeMediaFilename,
  validateMediaMetadataUpdate,
  type ImageMimeType,
  type MediaItem,
} from "./media-contract";
import {
  getRuntimeBindings,
  RepositoryError,
} from "./site-store";
import {
  collectComposerMediaIds,
  migratePageDocument,
} from "./composer-contract";

type MediaRow = {
  id: string;
  media_type: string;
  name: string;
  original_key: string;
  mime_type: string;
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

const mediaSchemaReady = new WeakMap<object, Promise<void>>();

export async function listMediaItems(): Promise<MediaItem[]> {
  const database = requireDatabase();
  await ensureMediaSchema(database);
  const result = await database
    .prepare(`${mediaSelect} ORDER BY created_at DESC, id DESC LIMIT 500`)
    .all<MediaRow>();
  return result.results.map(toMediaItem);
}

export async function getMediaItemsByIds(ids: string[]): Promise<MediaItem[]> {
  if (ids.length === 0) return [];
  const database = requireDatabase();
  await ensureMediaSchema(database);
  const unique = [...new Set(ids)].slice(0, 200);
  const placeholders = unique.map((_, index) => `?${index + 1}`).join(",");
  const result = await database
    .prepare(`${mediaSelect} WHERE id IN (${placeholders})`)
    .bind(...unique)
    .all<MediaRow>();
  const byId = new Map(result.results.map((row) => [row.id, toMediaItem(row)]));
  return unique.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export async function uploadImage(
  file: File,
  alt: string,
  caption: string,
  actor: string,
): Promise<MediaItem> {
  const database = requireDatabase();
  const bucket = requireBucket();
  await ensureMediaSchema(database);
  const inspected = await inspectImageFile(file).catch((error) => {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      error instanceof Error ? error.message : "Изображение не прошло проверку.",
      error && typeof error === "object" && "details" in error
        ? ((error as { details?: string[] }).details ?? [])
        : [],
    );
  });
  const cleanAlt = requiredText(alt, "Альтернативный текст", 1, 220);
  const cleanCaption = requiredText(caption, "Подпись", 0, 300);
  const duplicate = await database
    .prepare("SELECT id FROM media_items WHERE sha256 = ?1 LIMIT 1")
    .bind(inspected.sha256)
    .first<{ id: string }>();
  if (duplicate) {
    throw new RepositoryError(
      "CONFLICT",
      "Этот файл уже есть в медиатеке.",
      [duplicate.id],
    );
  }

  const id = `media_${crypto.randomUUID().replaceAll("-", "")}`;
  const originalKey = `media/original/${id}/v1`;
  const name = safeMediaFilename(file.name);
  await bucket.put(originalKey, inspected.bytes, {
    httpMetadata: { contentType: inspected.mimeType },
    customMetadata: {
      mediaId: id,
      sha256: inspected.sha256,
      originalName: name,
    },
  });
  try {
    await database.batch([
      database
      .prepare(
        `INSERT INTO media_items
          (id, media_type, name, original_key, mime_type, byte_size, sha256,
           width, height, aspect_ratio, alt, caption, fit_mode, focal_x, focal_y,
           rights_status, rights_scope, lifecycle, recovery_status, version,
           created_by, updated_by)
         VALUES (?1, 'image', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                 'cover', 5000, 5000, 'NOT_GRANTED', '', 'DRAFT',
                 'PENDING_INDEPENDENT_COPY', 1, ?12, ?12)`,
      )
      .bind(
        id,
        name,
        originalKey,
        inspected.mimeType,
        file.size,
        inspected.sha256,
        inspected.width,
        inspected.height,
        inspected.aspectRatio,
        cleanAlt,
        cleanCaption,
        actor,
      ),
      database
        .prepare(
          `INSERT INTO audit_events (action, entity_id, actor, detail_json)
           VALUES ('MEDIA_UPLOADED', ?1, ?2, ?3)`,
        )
        .bind(
          id,
          actor,
          JSON.stringify({
            sha256: inspected.sha256,
            mimeType: inspected.mimeType,
            byteSize: file.size,
            width: inspected.width,
            height: inspected.height,
          }),
        ),
    ]);
  } catch (error) {
    await bucket.delete(originalKey).catch(() => undefined);
    throw new RepositoryError(
      "DATABASE_ERROR",
      "Метаданные файла не были сохранены; загрузка отменена.",
      [error instanceof Error ? error.message : String(error)],
    );
  }
  return readMediaItem(database, id);
}

export async function updateMediaItem(
  id: string,
  input: unknown,
  actor: string,
): Promise<MediaItem> {
  assertMediaId(id);
  const update = (() => {
    try {
      return validateMediaMetadataUpdate(input);
    } catch (error) {
      throw new RepositoryError(
        "INVALID_DOCUMENT",
        error instanceof Error ? error.message : "Метаданные не прошли проверку.",
        error && typeof error === "object" && "details" in error
          ? ((error as { details?: string[] }).details ?? [])
          : [],
      );
    }
  })();
  const database = requireDatabase();
  await ensureMediaSchema(database);
  const results = await database.batch([
    database.prepare(
      `UPDATE media_items
          SET alt = ?1,
              caption = ?2,
              fit_mode = ?3,
              focal_x = ?4,
              focal_y = ?5,
              rights_status = ?6,
              rights_scope = ?7,
              lifecycle = ?8,
              recovery_status = ?9,
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = ?10
        WHERE id = ?11`,
    )
    .bind(
      update.alt,
      update.caption,
      update.fitMode,
      Math.round(update.focalX * 10_000),
      Math.round(update.focalY * 10_000),
      update.rightsStatus,
      update.rightsScope,
      update.lifecycle,
      update.recoveryStatus,
      actor,
      id,
    ),
    database
      .prepare(
        `INSERT INTO audit_events (action, entity_id, actor, detail_json)
         SELECT 'MEDIA_METADATA_UPDATED', ?1, ?2, ?3
          WHERE EXISTS (SELECT 1 FROM media_items WHERE id = ?1)`,
      )
      .bind(
        id,
        actor,
        JSON.stringify({
          rightsStatus: update.rightsStatus,
          lifecycle: update.lifecycle,
          recoveryStatus: update.recoveryStatus,
        }),
      ),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new RepositoryError("NOT_FOUND", "Файл медиатеки не найден.");
  }
  return readMediaItem(database, id);
}

export async function getMediaObject(
  id: string,
  allowDraft: boolean,
): Promise<{ item: MediaItem; object: R2ObjectBody }> {
  assertMediaId(id);
  const database = requireDatabase();
  const bucket = requireBucket();
  await ensureMediaSchema(database);
  const row = await database
    .prepare(`${mediaSelect} WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<MediaRow>();
  if (!row) throw new RepositoryError("NOT_FOUND", "Файл не найден.");
  const item = toMediaItem(row);
  const publicReady =
    item.lifecycle === "READY" &&
    item.rightsStatus === "APPROVED" &&
    item.recoveryStatus === "VERIFIED_INDEPENDENT_COPY";
  if (!allowDraft && !publicReady) {
    throw new RepositoryError("NOT_FOUND", "Файл не опубликован.");
  }
  if (!allowDraft && !(await isReferencedByVisibleRelease(database, id))) {
    throw new RepositoryError("NOT_FOUND", "Файл не используется опубликованной страницей.");
  }
  const object = await bucket.get(row.original_key);
  if (!object) throw new RepositoryError("NOT_FOUND", "Объект файла недоступен.");
  return { item, object };
}

async function isReferencedByVisibleRelease(database: D1Database, id: string) {
  const candidates = await database
    .prepare(
      `SELECT pr.payload_json
         FROM active_releases ar
         JOIN published_revisions pr ON pr.id = ar.revision_id
         JOIN page_settings ps ON ps.page_id = ar.page_id
        WHERE ps.public_visible = 1
          AND pr.payload_json LIKE ?1
        LIMIT 200`,
    )
    .bind(`%${id}%`)
    .all<{ payload_json: string }>();
  return candidates.results.some((row) => {
    try {
      const document = migratePageDocument(JSON.parse(row.payload_json));
      return collectComposerMediaIds(document).includes(id);
    } catch {
      return false;
    }
  });
}

function requireDatabase(): D1Database {
  const database = getRuntimeBindings().DB;
  if (!database) {
    throw new RepositoryError(
      "DATABASE_UNAVAILABLE",
      "Хранилище D1 недоступно.",
    );
  }
  return database;
}

function requireBucket(): R2Bucket {
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) {
    throw new RepositoryError(
      "DATABASE_UNAVAILABLE",
      "Хранилище R2 недоступно.",
    );
  }
  return bucket;
}

async function ensureMediaSchema(database: D1Database) {
  const key = database as unknown as object;
  let pending = mediaSchemaReady.get(key);
  if (!pending) {
    pending = database
      .batch(mediaSchemaStatements.map((statement) => database.prepare(statement)))
      .then(() => undefined)
      .catch((error) => {
        mediaSchemaReady.delete(key);
        throw error;
      });
    mediaSchemaReady.set(key, pending);
  }
  await pending;
}

async function readMediaItem(database: D1Database, id: string) {
  const row = await database
    .prepare(`${mediaSelect} WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<MediaRow>();
  if (!row) throw new RepositoryError("NOT_FOUND", "Файл медиатеки не найден.");
  return toMediaItem(row);
}

function toMediaItem(row: MediaRow): MediaItem {
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

function assertMediaId(value: string) {
  if (!/^media_[a-z0-9_]{8,80}$/i.test(value)) {
    throw new RepositoryError("NOT_FOUND", "Некорректный Media_ID.");
  }
}

function requiredText(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (value.trim().length < minimum || value.length > maximum) {
    throw new RepositoryError(
      "INVALID_DOCUMENT",
      `${label}: требуется строка длиной ${minimum}–${maximum}.`,
    );
  }
  return value.trim();
}

const mediaSelect = `SELECT id, media_type, name, original_key, mime_type,
  byte_size, sha256, width, height, aspect_ratio, alt, caption, fit_mode,
  focal_x, focal_y, rights_status, rights_scope, lifecycle, recovery_status,
  version, created_at, created_by, updated_at, updated_by FROM media_items`;

const mediaSchemaStatements = [
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
