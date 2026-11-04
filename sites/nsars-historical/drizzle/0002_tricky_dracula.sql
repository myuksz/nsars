CREATE TABLE `active_navigation` (
	`menu_id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`switched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`switched_by` text NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `navigation_state`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revision_id`) REFERENCES `navigation_revisions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `navigation_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`revision_no` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_sha256` text NOT NULL,
	`source_draft_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `navigation_state`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_revisions_menu_revision_unique` ON `navigation_revisions` (`menu_id`,`revision_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_revisions_menu_draft_unique` ON `navigation_revisions` (`menu_id`,`source_draft_version`);--> statement-breakpoint
CREATE TABLE `navigation_state` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_json` text NOT NULL,
	`draft_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_settings` (
	`page_id` text PRIMARY KEY NOT NULL,
	`public_visible` integer DEFAULT false NOT NULL,
	`system_page` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 1000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
