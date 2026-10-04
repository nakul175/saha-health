CREATE TABLE `limit_slots` (
	`org_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`slot_key` text NOT NULL,
	`state` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`org_id`, `actor_id`, `kind`, `slot_key`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Slice 14a: carry the last day's counted events into the new reservations, so applying this migration does not reset either limit.
INSERT OR IGNORE INTO `limit_slots` (`org_id`,`actor_id`,`kind`,`slot_key`,`state`,`at`) SELECT `org_id`,`actor_id`,'abhaReview',`person_id`,'used',max(`at`) FROM `audit_events` WHERE `action`='abhaLinkReview' AND `person_id` IS NOT NULL AND `actor_id` IS NOT NULL AND `at`>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') AND `org_id` IN (SELECT `id` FROM `organisations`) GROUP BY `org_id`,`actor_id`,`person_id`;--> statement-breakpoint
INSERT OR IGNORE INTO `limit_slots` (`org_id`,`actor_id`,`kind`,`slot_key`,`state`,`at`) SELECT `org_id`,`actor_id`,'indicatorRefusal','event:'||`id`,'used',`at` FROM `audit_events` WHERE `action`='viewAggregate' AND `subject`='indicator refusal' AND `actor_id` IS NOT NULL AND `at`>strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') AND `org_id` IN (SELECT `id` FROM `organisations`);
