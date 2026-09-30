CREATE TABLE `caseload_transfers` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`team_id` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `caseload_transfers_org_state` ON `caseload_transfers` (`org_id`,`state`);