CREATE TABLE `disposals` (
	`org_id` text NOT NULL,
	`seq` integer NOT NULL,
	`id` text NOT NULL,
	`batch_id` text NOT NULL,
	`record_class` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`person_id` text,
	`team_id` text,
	`disposed_at` text NOT NULL,
	`rule` text NOT NULL,
	`authority` text NOT NULL,
	`content_sha256` text NOT NULL,
	`prev_hash` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`org_id`, `seq`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disposals_record` ON `disposals` (`org_id`,`table_name`,`record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `disposals_entry` ON `disposals` (`org_id`,`id`);--> statement-breakpoint
CREATE INDEX `disposals_person` ON `disposals` (`org_id`,`person_id`);--> statement-breakpoint
CREATE TRIGGER disposals_no_update BEFORE UPDATE ON disposals BEGIN SELECT RAISE(ABORT, 'The disposal register is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER disposals_no_delete BEFORE DELETE ON disposals BEGIN SELECT RAISE(ABORT, 'The disposal register is append-only'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS record_revisions_no_update;
--> statement-breakpoint
CREATE TRIGGER record_revisions_no_update BEFORE UPDATE ON record_revisions WHEN NOT (NEW.id IS OLD.id AND NEW.org_id IS OLD.org_id AND NEW.person_id IS OLD.person_id AND NEW.entity_type IS OLD.entity_type AND NEW.entity_id IS OLD.entity_id AND NEW.version IS OLD.version AND NEW.actor_id IS OLD.actor_id AND NEW.actor_name IS OLD.actor_name AND NEW.action IS OLD.action AND NEW.created_at IS OLD.created_at AND NEW.changes = '[]' AND json_valid(NEW.data) AND json_extract(NEW.data, '$.disposed') = 1 AND EXISTS (SELECT 1 FROM disposals d WHERE d.org_id = OLD.org_id AND d.table_name = 'record_revisions' AND d.record_id = OLD.person_id AND d.id = json_extract(NEW.data, '$.entry'))) BEGIN SELECT RAISE(ABORT, 'Record revisions are append-only'); END;
