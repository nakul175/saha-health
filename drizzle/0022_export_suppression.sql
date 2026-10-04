CREATE TABLE `held_exports` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`downloaded_at` text,
	`sha256` text NOT NULL,
	`bytes` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `held_exports_org_user` ON `held_exports` (`org_id`,`user_id`,`created_at`);
