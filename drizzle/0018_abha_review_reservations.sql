CREATE TABLE `abha_review_reservations` (
 `org_id` text NOT NULL,
 `user_id` text NOT NULL,
 `attempt_hash` text NOT NULL,
 `payload_hash` text NOT NULL,
 `probe_hash` text NOT NULL,
 `at` text NOT NULL,
 `review_event_id` text,
 PRIMARY KEY (`org_id`,`user_id`,`attempt_hash`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `abha_review_probe` ON `abha_review_reservations` (`org_id`,`user_id`,`probe_hash`);--> statement-breakpoint
CREATE INDEX `abha_review_time` ON `abha_review_reservations` (`org_id`,`user_id`,`at`);
