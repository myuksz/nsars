CREATE TABLE IF NOT EXISTS `content_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`source_manifest_sha256` text NOT NULL,
	`target_manifest_sha256` text NOT NULL,
	`status` text NOT NULL,
	`attempt_token` text NOT NULL,
	`actor` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`applied_at` text,
	CONSTRAINT "content_migrations_status_check" CHECK("content_migrations"."status" IN ('APPLYING', 'APPLIED'))
);
