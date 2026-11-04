CREATE TABLE `booking_backup_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`saved_revision` integer DEFAULT 0 NOT NULL,
	`remote_sha` text DEFAULT '' NOT NULL,
	`last_success` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_id` text DEFAULT '' NOT NULL,
	`next_try` integer DEFAULT 0 NOT NULL,
	`manual_hold` integer DEFAULT 0 NOT NULL
);
