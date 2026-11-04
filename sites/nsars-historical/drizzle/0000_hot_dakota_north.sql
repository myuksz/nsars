CREATE TABLE `active_releases` (
	`page_id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`switched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`switched_by` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revision_id`) REFERENCES `published_revisions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`actor` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_created_idx` ON `audit_events` (`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`title` text NOT NULL,
	`draft_json` text NOT NULL,
	`draft_version` integer DEFAULT 1 NOT NULL,
	`last_published_draft_version` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_route_unique` ON `pages` (`route`);--> statement-breakpoint
CREATE TABLE `published_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`revision_no` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_sha256` text NOT NULL,
	`source_draft_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `published_revisions_page_revision_unique` ON `published_revisions` (`page_id`,`revision_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `published_revisions_page_draft_unique` ON `published_revisions` (`page_id`,`source_draft_version`);--> statement-breakpoint
CREATE INDEX `published_revisions_page_created_idx` ON `published_revisions` (`page_id`,`created_at`);