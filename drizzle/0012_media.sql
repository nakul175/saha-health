CREATE TABLE `media` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`person_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`purpose` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_org_visit` ON `media` (`org_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `media_org_person` ON `media` (`org_id`,`person_id`);