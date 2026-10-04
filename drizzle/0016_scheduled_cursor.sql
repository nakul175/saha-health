CREATE TABLE `scheduled_cursor` (
	`job` text PRIMARY KEY NOT NULL,
	`last_org` text NOT NULL,
	`updated_at` text NOT NULL
);
