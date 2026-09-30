CREATE TABLE `operations` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `request_metrics` (
	`org_id` text NOT NULL,
	`bucket` text NOT NULL,
	`route` text NOT NULL,
	`status` integer NOT NULL,
	`count` integer NOT NULL,
	`total_ms` integer NOT NULL,
	`max_ms` integer NOT NULL,
	PRIMARY KEY(`org_id`, `bucket`, `route`, `status`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
