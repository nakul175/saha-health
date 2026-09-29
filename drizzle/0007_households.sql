CREATE TABLE `households` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`team_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `households_org_team` ON `households` (`org_id`,`team_id`);