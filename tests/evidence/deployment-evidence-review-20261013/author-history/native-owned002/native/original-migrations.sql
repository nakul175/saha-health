CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL
);

;
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

;
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

;
CREATE TABLE `pilot` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);

;
CREATE TABLE `expansions` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outreach` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);

;
CREATE TABLE `governance` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);

;
ALTER TABLE `organisations` ADD `patient_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `patients` ADD `rev` integer DEFAULT 0 NOT NULL;
;
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
;
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
;
CREATE TABLE `identity_cases` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`survivor_id` text NOT NULL,
	`duplicate_id` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `identity_cases_survivor` ON `identity_cases` (`org_id`,`survivor_id`);--> statement-breakpoint
CREATE INDEX `identity_cases_duplicate` ON `identity_cases` (`org_id`,`duplicate_id`);
;
CREATE TABLE `rights_requests` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`person_id` text NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rights_requests_person` ON `rights_requests` (`org_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `rights_requests_open` ON `rights_requests` (`org_id`,`state`,`due_at`);
;
CREATE TABLE `retention` (
	`org_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);

;
CREATE TABLE `media` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`person_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`purpose` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	`data` text NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_org_visit` ON `media` (`org_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `media_org_person` ON `media` (`org_id`,`person_id`);
;
ALTER TABLE `audit_events` ADD `seq` integer;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `prev_hash` text;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `audit_org_seq` ON `audit_events` (`org_id`,`seq`);
;
CREATE TABLE `alert_occurrences` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`owner_role` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`escalated_at` text,
	`escalated_to` text,
	`escalation_reason` text,
	`escalation_recipients` integer,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_occurrence_open` ON `alert_occurrences` (`org_id`,`alert_id`,`scope_key`) WHERE `closed_at` IS NULL;--> statement-breakpoint
CREATE TABLE `alert_notifications` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`user_id` text NOT NULL,
	`level` integer NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`owner_role` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`count` integer,
	`detail` text,
	`delivered_at` text NOT NULL,
	`read_at` text,
	`cleared_at` text,
	`cleared_reason` text,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_notification_once` ON `alert_notifications` (`org_id`,`occurrence_id`,`user_id`,`level`);--> statement-breakpoint
CREATE INDEX `alert_notification_inbox` ON `alert_notifications` (`org_id`,`user_id`,`cleared_at`,`delivered_at`);

;
CREATE TABLE `notification_messages` (
	`org_id` text NOT NULL,
	`id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`alert_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`tier` integer NOT NULL,
	`rung` integer NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`reason` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`count` integer,
	`subject` text,
	`body` text NOT NULL,
	`link` text NOT NULL,
	`address` text NOT NULL,
	`status` text NOT NULL,
	`receipt` text NOT NULL,
	`due_at` text NOT NULL,
	`sent_at` text NOT NULL,
	`audit_id` text NOT NULL,
	`config_version` integer NOT NULL,
	PRIMARY KEY(`org_id`, `id`),
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_message_once` ON `notification_messages` (`org_id`,`occurrence_id`,`tier`,`user_id`);--> statement-breakpoint
CREATE INDEX `notification_message_log` ON `notification_messages` (`org_id`,`sent_at`);
;
CREATE TABLE `scheduled_cursor` (
	`job` text PRIMARY KEY NOT NULL,
	`last_org` text NOT NULL,
	`updated_at` text NOT NULL
);

;
CREATE INDEX `audit_org_time` ON `audit_events` (`org_id`,`at`);--> statement-breakpoint
CREATE INDEX `audit_org_actor_action_time` ON `audit_events` (`org_id`,`actor_id`,`action`,`at`);
;
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

;
CREATE TABLE availability_samples (
 org_id TEXT NOT NULL,
 slot INTEGER NOT NULL CHECK(slot>=0 AND slot%300000=0),
 source TEXT NOT NULL CHECK(source IN ('scheduler','manual-http')),
 config_version INTEGER NOT NULL CHECK(config_version>0),
 core TEXT NOT NULL CHECK(core IN ('healthy','failed')),
 workflow TEXT NOT NULL CHECK(workflow IN ('healthy','dependency-unavailable','not-configured','maintenance')),
 latency_ms INTEGER NOT NULL CHECK(latency_ms>=0 AND latency_ms<=60000),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(org_id,slot,source)
);--> statement-breakpoint
CREATE TRIGGER availability_samples_immutable_update BEFORE UPDATE ON availability_samples BEGIN SELECT RAISE(ABORT,'Availability history is immutable'); END;--> statement-breakpoint
CREATE TRIGGER availability_samples_immutable_delete BEFORE DELETE ON availability_samples BEGIN SELECT RAISE(ABORT,'Availability history is immutable'); END;

;
-- Metadata only: no clinical payload, device fingerprint or diagnostic free text.
CREATE TABLE device_work_grants (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, lease_id TEXT NOT NULL,
 package_hash TEXT NOT NULL, person_id TEXT NOT NULL, visit_id TEXT NOT NULL, member_version INTEGER NOT NULL,
 consent_version INTEGER NOT NULL, identity_hash TEXT NOT NULL, issued_at TEXT NOT NULL,
 original_role TEXT CHECK(original_role IS NULL OR original_role IN ('asha','clinician')), visit_version INTEGER NOT NULL, expires_at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,lease_id),
 FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TABLE device_work_events (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('report','instruction','ack')),
 lease_id TEXT, package_hash TEXT, input_hash TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data) AND length(data)<=2048), at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,id),
 FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE INDEX device_work_events_actor_time ON device_work_events(org_id,actor_id,at);

;
-- Existing receipts gain trusted operational provenance; earlier/imported rows
-- remain NULL, and neither clinical results nor idempotency hashes are changed.
ALTER TABLE command_receipts ADD COLUMN command_type TEXT;
ALTER TABLE command_receipts ADD COLUMN mutation_subject_id TEXT;
ALTER TABLE command_receipts ADD COLUMN mutation_event_id TEXT;
ALTER TABLE command_receipts ADD COLUMN mutation_context TEXT CHECK(mutation_context IS NULL OR json_valid(mutation_context));
CREATE TABLE work_burden_samples (
 org_id TEXT NOT NULL REFERENCES organisations(id), actor_id TEXT NOT NULL, id TEXT NOT NULL,
 person_id TEXT NOT NULL, visit_id TEXT NOT NULL, receipt_key TEXT NOT NULL, session_id TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('capture','correction','reconciliation')),
 phase TEXT NOT NULL CHECK(phase IN ('start','segment','complete')),
 active_seconds INTEGER NOT NULL CHECK(active_seconds BETWEEN 0 AND 86400),
 complete INTEGER NOT NULL CHECK(complete IN (0,1)),
 input_hash TEXT NOT NULL, member_version INTEGER NOT NULL,
 provenance TEXT NOT NULL CHECK(provenance='client-active-v1'),
 context TEXT NOT NULL CHECK(json_valid(context) AND length(context)<=8192),
 at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,id), UNIQUE(org_id,actor_id,receipt_key,stage,phase)
);
CREATE INDEX work_burden_samples_visit ON work_burden_samples(org_id,visit_id,at);
CREATE INDEX work_burden_samples_time ON work_burden_samples(org_id,at);
CREATE TABLE work_support_events (
 org_id TEXT NOT NULL REFERENCES organisations(id), actor_id TEXT NOT NULL, id TEXT NOT NULL,
 request_id TEXT NOT NULL, person_id TEXT NOT NULL, visit_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('request','assign','attest','ack')),
 category TEXT NOT NULL CHECK(category IN ('capture','sync-recovery','correction','reconciliation')),
 requester_id TEXT NOT NULL, helper_id TEXT,
 sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 100),
 input_hash TEXT NOT NULL, member_version INTEGER NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,id), UNIQUE(org_id,request_id,sequence)
);
CREATE INDEX work_support_events_request ON work_support_events(org_id,request_id,sequence);
CREATE INDEX work_support_events_time ON work_support_events(org_id,at);

;
-- Immutable original accepted registration ownership; no raw registration/match facts.
CREATE TABLE device_registration_grants (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, registration_id TEXT NOT NULL, person_id TEXT NOT NULL,
 receipt_key TEXT NOT NULL, body_hash TEXT NOT NULL, member_version INTEGER, consent_version INTEGER,
 identity_hash TEXT, original_role TEXT, person_version INTEGER, issued_at TEXT NOT NULL, legacy INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(org_id,actor_id,registration_id), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TABLE device_registration_receipts (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, receipt_key TEXT NOT NULL, registration_id TEXT NOT NULL,
 body_hash TEXT NOT NULL, person_id TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,receipt_key), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TABLE device_match_copies (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, id TEXT NOT NULL, member_version INTEGER NOT NULL,
 query_hash TEXT NOT NULL, original_role TEXT NOT NULL, candidate_versions TEXT NOT NULL CHECK(json_valid(candidate_versions)), issued_at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,id), FOREIGN KEY(org_id) REFERENCES organisations(id)
);

;
-- Historical client reports; never evidence of a new authorized material read.
CREATE TABLE offline_open_reports (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, id TEXT NOT NULL,
 input_hash TEXT NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL CHECK(json_valid(reference)), surface TEXT NOT NULL,
 presentation TEXT NOT NULL, count INTEGER NOT NULL CHECK(count IN (0,1)),
 claimed_at TEXT NOT NULL, received_at TEXT NOT NULL, provenance TEXT NOT NULL CHECK(json_valid(provenance)),
 PRIMARY KEY(actor_id,id), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TABLE offline_open_subjects (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, report_id TEXT NOT NULL,
 person_id TEXT NOT NULL, visit_id TEXT, provenance TEXT NOT NULL CHECK(json_valid(provenance)),
 PRIMARY KEY(actor_id,report_id,person_id), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE INDEX offline_open_subjects_patient ON offline_open_subjects(org_id,person_id);
-- Corrections/correlations append separate records; reported history is immutable.
CREATE TRIGGER offline_open_report_no_update BEFORE UPDATE ON offline_open_reports BEGIN SELECT RAISE(ABORT,'Offline presentation history is immutable'); END;
CREATE TRIGGER offline_open_report_no_delete BEFORE DELETE ON offline_open_reports BEGIN SELECT RAISE(ABORT,'Offline presentation history is immutable'); END;
CREATE TRIGGER offline_open_subject_no_update BEFORE UPDATE ON offline_open_subjects BEGIN SELECT RAISE(ABORT,'Offline subject provenance is immutable'); END;
CREATE TRIGGER offline_open_subject_no_delete BEFORE DELETE ON offline_open_subjects BEGIN SELECT RAISE(ABORT,'Offline subject provenance is immutable'); END;

;
-- Actual authenticated wire digest; parsed command receipt hashes and prior migrations are unchanged.
CREATE TABLE device_registration_wire_receipts (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, receipt_key TEXT NOT NULL, wire_hash TEXT NOT NULL,
 registration_id TEXT NOT NULL, person_id TEXT NOT NULL, body_hash TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,receipt_key,wire_hash), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TRIGGER device_registration_wire_receipts_no_update BEFORE UPDATE ON device_registration_wire_receipts BEGIN SELECT RAISE(ABORT,'Immutable registration wire receipt'); END;
CREATE TRIGGER device_registration_wire_receipts_no_delete BEFORE DELETE ON device_registration_wire_receipts BEGIN SELECT RAISE(ABORT,'Immutable registration wire receipt'); END;

;
-- Bounded immutable synthetic acquisition cache. No external clinical/licensing authority is inferred.
CREATE TABLE clinical_source_documents (org_id TEXT NOT NULL,id TEXT NOT NULL,entry_id TEXT NOT NULL,manifest_hash TEXT NOT NULL,reference TEXT NOT NULL CHECK(json_valid(reference)),content TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(org_id,id),FOREIGN KEY(org_id) REFERENCES organisations(id));
CREATE TRIGGER clinical_source_documents_no_update BEFORE UPDATE ON clinical_source_documents BEGIN SELECT RAISE(ABORT,'Immutable acquired source'); END;
CREATE TRIGGER clinical_source_documents_no_delete BEFORE DELETE ON clinical_source_documents BEGIN SELECT RAISE(ABORT,'Immutable acquired source'); END;

;
-- Replace the receipt-only uniqueness constraint without rewriting ledger history.
-- Apply the complete migration atomically through the D1 migration transaction.
-- There are no application-created immutable triggers on this table; all column
-- checks, primary key, organisation FK and indexes are retained.
CREATE TABLE work_burden_samples_v2 (
 org_id TEXT NOT NULL REFERENCES organisations(id), actor_id TEXT NOT NULL, id TEXT NOT NULL,
 person_id TEXT NOT NULL, visit_id TEXT NOT NULL, receipt_key TEXT NOT NULL, session_id TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('capture','correction','reconciliation')),
 phase TEXT NOT NULL CHECK(phase IN ('start','segment','complete')),
 active_seconds INTEGER NOT NULL CHECK(active_seconds BETWEEN 0 AND 86400),
 complete INTEGER NOT NULL CHECK(complete IN (0,1)),
 input_hash TEXT NOT NULL, member_version INTEGER NOT NULL,
 provenance TEXT NOT NULL CHECK(provenance='client-active-v1'),
 context TEXT NOT NULL CHECK(json_valid(context) AND length(context)<=8192),
 at TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,id), UNIQUE(org_id,actor_id,receipt_key,stage,phase,session_id)
);
INSERT INTO work_burden_samples_v2 (org_id,actor_id,id,person_id,visit_id,receipt_key,session_id,stage,phase,active_seconds,complete,input_hash,member_version,provenance,context,at) SELECT org_id,actor_id,id,person_id,visit_id,receipt_key,session_id,stage,phase,active_seconds,complete,input_hash,member_version,provenance,context,at FROM work_burden_samples;
DROP TABLE work_burden_samples;
ALTER TABLE work_burden_samples_v2 RENAME TO work_burden_samples;
CREATE INDEX work_burden_samples_visit ON work_burden_samples(org_id,visit_id,at);
CREATE INDEX work_burden_samples_time ON work_burden_samples(org_id,at);
CREATE UNIQUE INDEX work_burden_samples_origin_once ON work_burden_samples(org_id,actor_id,receipt_key,stage) WHERE phase='start';

;
-- Protected immutable population-based figures and reviewed reissues; no patient text or measurements.
CREATE TABLE indicator_figures (org_id TEXT NOT NULL REFERENCES organisations(id),id TEXT NOT NULL,parent_id TEXT,author_id TEXT NOT NULL,author_version INTEGER NOT NULL,created_at TEXT NOT NULL,digest TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(org_id,id));
CREATE TABLE indicator_figure_units (org_id TEXT NOT NULL,figure_id TEXT NOT NULL,person_id TEXT NOT NULL,person_version INTEGER NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(org_id,figure_id,person_id),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TABLE indicator_figure_events (org_id TEXT NOT NULL,figure_id TEXT NOT NULL,id TEXT NOT NULL,sequence INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('prepared','approved','rejected','published')),actor_id TEXT NOT NULL,member_version INTEGER NOT NULL,role TEXT NOT NULL,at TEXT NOT NULL,reason TEXT NOT NULL,review_id TEXT,PRIMARY KEY(org_id,id),UNIQUE(org_id,figure_id,sequence),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TABLE indicator_figure_receipts (org_id TEXT NOT NULL,actor_id TEXT NOT NULL,key TEXT NOT NULL,body_hash TEXT NOT NULL,figure_id TEXT NOT NULL,result TEXT NOT NULL CHECK(json_valid(result)),PRIMARY KEY(actor_id,key),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE INDEX indicator_figures_created ON indicator_figures(org_id,created_at);
CREATE TRIGGER indicator_figures_no_update BEFORE UPDATE ON indicator_figures BEGIN SELECT RAISE(ABORT,'Immutable figure'); END;
CREATE TRIGGER indicator_figures_no_delete BEFORE DELETE ON indicator_figures BEGIN SELECT RAISE(ABORT,'Immutable figure'); END;
CREATE TRIGGER indicator_figure_units_no_update BEFORE UPDATE ON indicator_figure_units BEGIN SELECT RAISE(ABORT,'Immutable figure material'); END;
CREATE TRIGGER indicator_figure_units_no_delete BEFORE DELETE ON indicator_figure_units BEGIN SELECT RAISE(ABORT,'Immutable figure material'); END;
CREATE TRIGGER indicator_figure_events_no_update BEFORE UPDATE ON indicator_figure_events BEGIN SELECT RAISE(ABORT,'Immutable figure history'); END;
CREATE TRIGGER indicator_figure_events_no_delete BEFORE DELETE ON indicator_figure_events BEGIN SELECT RAISE(ABORT,'Immutable figure history'); END;
CREATE TRIGGER indicator_figure_receipts_no_update BEFORE UPDATE ON indicator_figure_receipts BEGIN SELECT RAISE(ABORT,'Immutable figure receipt'); END;
CREATE TRIGGER indicator_figure_receipts_no_delete BEFORE DELETE ON indicator_figure_receipts BEGIN SELECT RAISE(ABORT,'Immutable figure receipt'); END;

;
-- Original figure material and command receipts remain unchanged. Durable per-viewer edition protection.
CREATE TABLE indicator_figure_disclosures (org_id TEXT NOT NULL,actor_id TEXT NOT NULL,figure_id TEXT NOT NULL,release_hash TEXT NOT NULL,released TEXT NOT NULL CHECK(json_valid(released)),at TEXT NOT NULL,PRIMARY KEY(org_id,actor_id,figure_id,release_hash),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TRIGGER indicator_figure_disclosures_no_update BEFORE UPDATE ON indicator_figure_disclosures BEGIN SELECT RAISE(ABORT,'Immutable figure disclosure'); END;
CREATE TRIGGER indicator_figure_disclosures_no_delete BEFORE DELETE ON indicator_figure_disclosures BEGIN SELECT RAISE(ABORT,'Immutable figure disclosure'); END;

;
ALTER TABLE media ADD COLUMN storage_ref TEXT;
--> statement-breakpoint
CREATE TABLE media_custody (
 org_id TEXT NOT NULL REFERENCES organisations(id), id TEXT NOT NULL,
 actor_id TEXT NOT NULL, request_key TEXT NOT NULL, input_hash TEXT NOT NULL,
 person_id TEXT NOT NULL, visit_id TEXT NOT NULL, object_key TEXT NOT NULL,
 state TEXT NOT NULL CONSTRAINT media_custody_state CHECK(state IN ('staged','quarantined','linked','removed')),
 size INTEGER NOT NULL, sha256 TEXT NOT NULL, mime TEXT NOT NULL,
 object_version TEXT, etag TEXT, created_at TEXT NOT NULL,
 PRIMARY KEY(org_id,id)
);
--> statement-breakpoint
CREATE INDEX media_custody_pending ON media_custody(org_id,actor_id,state);

--> statement-breakpoint
CREATE UNIQUE INDEX media_custody_request ON media_custody(org_id,actor_id,request_key);
--> statement-breakpoint
CREATE UNIQUE INDEX media_custody_key ON media_custody(object_key);
--> statement-breakpoint
CREATE TRIGGER media_custody_no_delete BEFORE DELETE ON media_custody BEGIN SELECT RAISE(ABORT,'media custody is retained'); END;
--> statement-breakpoint
CREATE TRIGGER media_custody_original_immutable BEFORE UPDATE ON media_custody WHEN
 NEW.org_id IS NOT OLD.org_id OR NEW.id IS NOT OLD.id OR NEW.actor_id IS NOT OLD.actor_id OR NEW.request_key IS NOT OLD.request_key OR NEW.input_hash IS NOT OLD.input_hash OR NEW.person_id IS NOT OLD.person_id OR NEW.visit_id IS NOT OLD.visit_id OR NEW.object_key IS NOT OLD.object_key OR NEW.size IS NOT OLD.size OR NEW.sha256 IS NOT OLD.sha256 OR NEW.mime IS NOT OLD.mime OR NEW.created_at IS NOT OLD.created_at OR
 (OLD.object_version IS NOT NULL AND (NEW.object_version IS NOT OLD.object_version OR NEW.etag IS NOT OLD.etag)) OR
 (OLD.state='removed' AND NEW.state!='removed') OR (OLD.state='linked' AND NEW.state NOT IN ('linked','removed')) OR (OLD.state IN ('staged','quarantined') AND NEW.state NOT IN ('staged','quarantined','linked')) OR
 (NEW.state IN ('linked','removed') AND (NEW.object_version IS NULL OR NEW.etag IS NULL))
 BEGIN SELECT RAISE(ABORT,'original media custody is immutable'); END;

;
CREATE TABLE reporting_calendars(org_id TEXT NOT NULL REFERENCES organisations(id),id TEXT NOT NULL,version INTEGER NOT NULL,author_id TEXT NOT NULL,author_version INTEGER NOT NULL,created_at TEXT NOT NULL,digest TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(org_id,id,version));
CREATE TABLE reporting_calendar_events(org_id TEXT NOT NULL,calendar_id TEXT NOT NULL,calendar_version INTEGER NOT NULL,id TEXT NOT NULL,sequence INTEGER NOT NULL,kind TEXT NOT NULL,actor_id TEXT NOT NULL,member_version INTEGER NOT NULL,role TEXT NOT NULL,at TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(org_id,id),UNIQUE(org_id,calendar_id,calendar_version,sequence),FOREIGN KEY(org_id,calendar_id,calendar_version) REFERENCES reporting_calendars(org_id,id,version));
CREATE TABLE reporting_coverage(org_id TEXT NOT NULL,calendar_id TEXT NOT NULL,calendar_version INTEGER NOT NULL,team_id TEXT NOT NULL,source_id TEXT NOT NULL,period_id TEXT NOT NULL,version INTEGER NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(org_id,id),UNIQUE(org_id,calendar_id,calendar_version,team_id,source_id,period_id,version),FOREIGN KEY(org_id,calendar_id,calendar_version) REFERENCES reporting_calendars(org_id,id,version));
CREATE TABLE reporting_completeness_snapshots(org_id TEXT NOT NULL,id TEXT NOT NULL,figure_id TEXT,created_at TEXT NOT NULL,digest TEXT NOT NULL,basis TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(org_id,id),UNIQUE(org_id,figure_id));
CREATE TABLE reporting_completeness_receipts(org_id TEXT NOT NULL,actor_id TEXT NOT NULL,key TEXT NOT NULL,body_hash TEXT NOT NULL,calendar_id TEXT NOT NULL,calendar_version INTEGER NOT NULL,result TEXT NOT NULL,PRIMARY KEY(actor_id,key),FOREIGN KEY(org_id,calendar_id,calendar_version) REFERENCES reporting_calendars(org_id,id,version));
CREATE TRIGGER reporting_calendars_immutable BEFORE UPDATE ON reporting_calendars BEGIN SELECT RAISE(ABORT,'immutable calendar'); END;
CREATE TRIGGER reporting_calendar_events_immutable BEFORE UPDATE ON reporting_calendar_events BEGIN SELECT RAISE(ABORT,'immutable calendar history'); END;
CREATE TRIGGER reporting_coverage_immutable BEFORE UPDATE ON reporting_coverage BEGIN SELECT RAISE(ABORT,'immutable coverage evidence'); END;
CREATE TRIGGER reporting_completeness_snapshots_immutable BEFORE UPDATE ON reporting_completeness_snapshots BEGIN SELECT RAISE(ABORT,'immutable completeness snapshot'); END;
CREATE TRIGGER reporting_calendars_retained BEFORE DELETE ON reporting_calendars BEGIN SELECT RAISE(ABORT,'retained calendar'); END;
CREATE TRIGGER reporting_calendar_events_retained BEFORE DELETE ON reporting_calendar_events BEGIN SELECT RAISE(ABORT,'retained calendar history'); END;
CREATE TRIGGER reporting_coverage_retained BEFORE DELETE ON reporting_coverage BEGIN SELECT RAISE(ABORT,'retained coverage evidence'); END;
CREATE TRIGGER reporting_completeness_snapshots_retained BEFORE DELETE ON reporting_completeness_snapshots BEGIN SELECT RAISE(ABORT,'retained completeness snapshot'); END;

;
-- Append-only source-backed execution events. Current protected patient work remains in patient partitions.
CREATE TABLE installed_pack_work_events (
 org_id TEXT NOT NULL REFERENCES organisations(id),
 id TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 person_id TEXT,
 actor_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 at TEXT NOT NULL,
 data TEXT NOT NULL,
 PRIMARY KEY(org_id,id)
);
--> statement-breakpoint
CREATE INDEX installed_pack_work_person ON installed_pack_work_events(org_id,person_id,entity_id);

;
CREATE TABLE installed_pack_transition_events (
 org_id TEXT NOT NULL, id TEXT NOT NULL, transition_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL,
 PRIMARY KEY (org_id,id)
);
CREATE INDEX installed_pack_transition_history ON installed_pack_transition_events(org_id,transition_id);
