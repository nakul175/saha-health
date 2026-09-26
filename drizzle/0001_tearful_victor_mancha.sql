CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`account_code` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`active_org_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_account_code_unique` ON `accounts` (`account_code`);--> statement-breakpoint
CREATE TABLE `ai_results` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`visit_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_results_org_visit` ON `ai_results` (`org_id`,`visit_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`person_id` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`role` text NOT NULL,
	`action` text NOT NULL,
	`subject` text NOT NULL,
	`detail` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_org_person_time` ON `audit_events` (`org_id`,`person_id`,`at`);--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`actor_id` text NOT NULL,
	`key` text NOT NULL,
	`org_id` text NOT NULL,
	`hash` text NOT NULL,
	`result` text NOT NULL,
	`person_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`actor_id`, `key`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`account_code` text NOT NULL,
	`label` text NOT NULL,
	`role` text NOT NULL,
	`team_ids` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`accepted_by` text,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invitations_org_status` ON `invitations` (`org_id`,`status`);--> statement-breakpoint
CREATE TABLE `legacy_migrations` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`source_hash` text NOT NULL,
	`counts` text NOT NULL,
	`migrated_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`is_owner` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `accounts`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memberships_user_status` ON `memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`last_command` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`team_id` text NOT NULL,
	`assigned_to` text,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `patients_org_team` ON `patients` (`org_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `patients_org_assignee` ON `patients` (`org_id`,`assigned_to`);--> statement-breakpoint
CREATE TABLE `plans` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`visit_id` text NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plans_org_visit` ON `plans` (`org_id`,`visit_id`);--> statement-breakpoint
CREATE TABLE `record_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`person_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`data` text NOT NULL,
	`changes` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revisions_entity_version` ON `record_revisions` (`org_id`,`entity_type`,`entity_id`,`version`);--> statement-breakpoint
CREATE INDEX `revisions_org_person_time` ON `record_revisions` (`org_id`,`person_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`person_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `referrals_org_person` ON `referrals` (`org_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`visit_id` text NOT NULL,
	`person_id` text NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submissions_org_person` ON `submissions` (`org_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`org_id` text NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`org_id`, `team_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `accounts`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_org_name` ON `teams` (`org_id`,`name`);--> statement-breakpoint
CREATE TABLE `visits` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`person_id` text NOT NULL,
	`version` integer NOT NULL,
	`record_version` integer NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_org_person` ON `visits` (`org_id`,`person_id`);--> statement-breakpoint
CREATE TRIGGER record_revisions_no_update BEFORE UPDATE ON record_revisions BEGIN SELECT RAISE(ABORT, 'Record revisions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER record_revisions_no_delete BEFORE DELETE ON record_revisions BEGIN SELECT RAISE(ABORT, 'Record revisions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
