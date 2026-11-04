CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`name` text NOT NULL,
	`original_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`aspect_ratio` text NOT NULL,
	`alt` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`fit_mode` text DEFAULT 'cover' NOT NULL,
	`focal_x` integer DEFAULT 5000 NOT NULL,
	`focal_y` integer DEFAULT 5000 NOT NULL,
	`rights_status` text DEFAULT 'NOT_GRANTED' NOT NULL,
	`rights_scope` text DEFAULT '' NOT NULL,
	`lifecycle` text DEFAULT 'DRAFT' NOT NULL,
	`recovery_status` text DEFAULT 'PENDING_INDEPENDENT_COPY' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_sha_unique` ON `media_items` (`sha256`);--> statement-breakpoint
CREATE INDEX `media_items_created_idx` ON `media_items` (`created_at`);--> statement-breakpoint
CREATE INDEX `media_items_public_gate_idx` ON `media_items` (`lifecycle`,`rights_status`);