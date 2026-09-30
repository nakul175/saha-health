CREATE TABLE `rights_requests` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`person_id` text NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rights_requests_person` ON `rights_requests` (`org_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `rights_requests_open` ON `rights_requests` (`org_id`,`state`,`due_at`);