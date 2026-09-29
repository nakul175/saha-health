CREATE TABLE `identity_cases` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`survivor_id` text NOT NULL,
	`duplicate_id` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `identity_cases_survivor` ON `identity_cases` (`org_id`,`survivor_id`);--> statement-breakpoint
CREATE INDEX `identity_cases_duplicate` ON `identity_cases` (`org_id`,`duplicate_id`);