ALTER TABLE `audit_events` ADD `seq` integer;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `prev_hash` text;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `audit_org_seq` ON `audit_events` (`org_id`,`seq`);