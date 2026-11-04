import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const contentMigrations = sqliteTable(
  "content_migrations",
  {
    id: text("id").primaryKey(),
    checksum: text("checksum").notNull(),
    sourceManifestSha256: text("source_manifest_sha256").notNull(),
    targetManifestSha256: text("target_manifest_sha256").notNull(),
    status: text("status").notNull(),
    attemptToken: text("attempt_token").notNull(),
    actor: text("actor").notNull(),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    appliedAt: text("applied_at"),
  },
  (table) => [
    check(
      "content_migrations_status_check",
      sql`${table.status} IN ('APPLYING', 'APPLIED')`,
    ),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    route: text("route").notNull(),
    title: text("title").notNull(),
    draftJson: text("draft_json").notNull(),
    draftVersion: integer("draft_version").notNull().default(1),
    lastPublishedDraftVersion: integer("last_published_draft_version")
      .notNull()
      .default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [uniqueIndex("pages_route_unique").on(table.route)],
);

export const pageSettings = sqliteTable("page_settings", {
  pageId: text("page_id")
    .primaryKey()
    .references(() => pages.id, { onDelete: "cascade" }),
  publicVisible: integer("public_visible", { mode: "boolean" })
    .notNull()
    .default(false),
  systemPage: integer("system_page", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(1000),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
});

export const publishedRevisions = sqliteTable(
  "published_revisions",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    revisionNo: integer("revision_no").notNull(),
    payloadJson: text("payload_json").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    sourceDraftVersion: integer("source_draft_version").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    uniqueIndex("published_revisions_page_revision_unique").on(
      table.pageId,
      table.revisionNo,
    ),
    uniqueIndex("published_revisions_page_draft_unique").on(
      table.pageId,
      table.sourceDraftVersion,
    ),
    index("published_revisions_page_created_idx").on(
      table.pageId,
      table.createdAt,
    ),
  ],
);

export const activeReleases = sqliteTable("active_releases", {
  pageId: text("page_id")
    .primaryKey()
    .references(() => pages.id, { onDelete: "cascade" }),
  revisionId: text("revision_id")
    .notNull()
    .references(() => publishedRevisions.id, { onDelete: "restrict" }),
  switchedAt: text("switched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  switchedBy: text("switched_by").notNull(),
});

export const navigationState = sqliteTable("navigation_state", {
  id: text("id").primaryKey(),
  draftJson: text("draft_json").notNull(),
  draftVersion: integer("draft_version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
});

export const navigationRevisions = sqliteTable(
  "navigation_revisions",
  {
    id: text("id").primaryKey(),
    menuId: text("menu_id")
      .notNull()
      .references(() => navigationState.id, { onDelete: "cascade" }),
    revisionNo: integer("revision_no").notNull(),
    payloadJson: text("payload_json").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    sourceDraftVersion: integer("source_draft_version").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    uniqueIndex("navigation_revisions_menu_revision_unique").on(
      table.menuId,
      table.revisionNo,
    ),
    uniqueIndex("navigation_revisions_menu_draft_unique").on(
      table.menuId,
      table.sourceDraftVersion,
    ),
  ],
);

export const activeNavigation = sqliteTable("active_navigation", {
  menuId: text("menu_id")
    .primaryKey()
    .references(() => navigationState.id, { onDelete: "cascade" }),
  revisionId: text("revision_id")
    .notNull()
    .references(() => navigationRevisions.id, { onDelete: "restrict" }),
  switchedAt: text("switched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  switchedBy: text("switched_by").notNull(),
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(),
    entityId: text("entity_id").notNull(),
    actor: text("actor").notNull(),
    detailJson: text("detail_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_events_entity_created_idx").on(
      table.entityId,
      table.createdAt,
    ),
  ],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: integer("expires_at").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_unique").on(table.tokenHash),
    index("admin_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const adminAuthState = sqliteTable("admin_auth_state", {
  identityHash: text("identity_hash").primaryKey(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until"),
  updatedAt: integer("updated_at").notNull(),
});

export const adminAuthEvents = sqliteTable(
  "admin_auth_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(),
    identityHash: text("identity_hash").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("admin_auth_events_created_idx").on(table.createdAt)],
);

export const mediaItems = sqliteTable(
  "media_items",
  {
    id: text("id").primaryKey(),
    mediaType: text("media_type").notNull(),
    name: text("name").notNull(),
    originalKey: text("original_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    alt: text("alt").notNull(),
    caption: text("caption").notNull().default(""),
    fitMode: text("fit_mode").notNull().default("cover"),
    focalX: integer("focal_x").notNull().default(5000),
    focalY: integer("focal_y").notNull().default(5000),
    rightsStatus: text("rights_status").notNull().default("NOT_GRANTED"),
    rightsScope: text("rights_scope").notNull().default(""),
    lifecycle: text("lifecycle").notNull().default("DRAFT"),
    recoveryStatus: text("recovery_status")
      .notNull()
      .default("PENDING_INDEPENDENT_COPY"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdBy: text("created_by").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    uniqueIndex("media_items_sha_unique").on(table.sha256),
    index("media_items_created_idx").on(table.createdAt),
    index("media_items_public_gate_idx").on(
      table.lifecycle,
      table.rightsStatus,
    ),
  ],
);
