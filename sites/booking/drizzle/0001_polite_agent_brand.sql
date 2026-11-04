CREATE TABLE `booking_notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`email_state` text DEFAULT 'waiting' NOT NULL,
	`telegram_state` text DEFAULT 'waiting' NOT NULL,
	`busy` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `email` text;