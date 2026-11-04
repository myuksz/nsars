CREATE TABLE `booking_days` (
	`date` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`category` text,
	`request_id` text,
	`note` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booking_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`details` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booking_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
