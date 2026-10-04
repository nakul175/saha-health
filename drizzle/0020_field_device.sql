CREATE TABLE `field_sync_reports` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`actor_id` text NOT NULL,
	`person_id` text,
	`lease_id` text,
	`step` text NOT NULL,
	`error_class` text NOT NULL,
	`count` integer NOT NULL,
	`first_at` text NOT NULL,
	`last_at` text NOT NULL,
	`app_version` text NOT NULL,
	`report_key` text NOT NULL,
	`received_at` text NOT NULL,
	`audit_id` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `field_sync_reports_received` ON `field_sync_reports` (`org_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `field_sync_reports_actor` ON `field_sync_reports` (`org_id`,`actor_id`,`received_at`);