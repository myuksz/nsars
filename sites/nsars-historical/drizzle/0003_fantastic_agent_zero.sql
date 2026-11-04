CREATE TABLE IF NOT EXISTS `admin_auth_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`identity_hash` text NOT NULL,
	`user_agent_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_auth_events_created_idx` ON `admin_auth_events` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_auth_state` (
	`identity_hash` text PRIMARY KEY NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_sessions_token_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_sessions_expiry_idx` ON `admin_sessions` (`expires_at`);
