CREATE TABLE `notification_messages` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`tier` integer NOT NULL,
	`rung` integer NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`reason` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`count` integer,
	`subject` text,
	`body` text NOT NULL,
	`link` text NOT NULL,
	`address` text NOT NULL,
	`status` text NOT NULL,
	`receipt` text NOT NULL,
	`due_at` text NOT NULL,
	`sent_at` text NOT NULL,
	`audit_id` text NOT NULL,
	`config_version` integer NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_message_once` ON `notification_messages` (`org_id`,`occurrence_id`,`tier`,`user_id`);--> statement-breakpoint
CREATE INDEX `notification_message_log` ON `notification_messages` (`org_id`,`sent_at`);