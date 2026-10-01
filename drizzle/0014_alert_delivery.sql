CREATE TABLE `alert_occurrences` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`owner_role` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`escalated_at` text,
	`escalated_to` text,
	`escalation_reason` text,
	`escalation_recipients` integer,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_occurrence_open` ON `alert_occurrences` (`org_id`,`alert_id`,`scope_key`) WHERE `closed_at` IS NULL;--> statement-breakpoint
CREATE TABLE `alert_notifications` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`user_id` text NOT NULL,
	`level` integer NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`owner_role` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`count` integer,
	`detail` text,
	`delivered_at` text NOT NULL,
	`read_at` text,
	`cleared_at` text,
	`cleared_reason` text,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_notification_once` ON `alert_notifications` (`org_id`,`occurrence_id`,`user_id`,`level`);--> statement-breakpoint
CREATE INDEX `alert_notification_inbox` ON `alert_notifications` (`org_id`,`user_id`,`cleared_at`,`delivered_at`);
