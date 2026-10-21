CREATE TABLE retention_disposal_jobs (
 org_id TEXT NOT NULL REFERENCES organisations(id), id TEXT NOT NULL,
 tombstone_id TEXT NOT NULL, record_class TEXT NOT NULL, record_id TEXT NOT NULL,
 person_id TEXT NOT NULL, object_key TEXT NOT NULL, object_version TEXT NOT NULL,
 etag TEXT NOT NULL, state TEXT NOT NULL CONSTRAINT retention_disposal_state CHECK(state IN ('pending','reserved','completed','blocked')),
 attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT, last_error TEXT,
 reservation_token TEXT, reserved_at TEXT, reserved_by TEXT, request_key TEXT, request_hash TEXT,
 outcome TEXT, created_at TEXT NOT NULL, completed_at TEXT,
 PRIMARY KEY(org_id,id), UNIQUE(org_id,tombstone_id), UNIQUE(object_key), UNIQUE(reserved_by,request_key)
);
--> statement-breakpoint
CREATE INDEX retention_disposal_pending ON retention_disposal_jobs(org_id,state,created_at);
--> statement-breakpoint
CREATE TRIGGER retention_disposal_identity_immutable BEFORE UPDATE ON retention_disposal_jobs WHEN
 NEW.org_id IS NOT OLD.org_id OR NEW.id IS NOT OLD.id OR NEW.tombstone_id IS NOT OLD.tombstone_id OR
 NEW.record_class IS NOT OLD.record_class OR NEW.record_id IS NOT OLD.record_id OR NEW.person_id IS NOT OLD.person_id OR
 NEW.object_key IS NOT OLD.object_key OR NEW.object_version IS NOT OLD.object_version OR NEW.etag IS NOT OLD.etag OR
 NEW.created_at IS NOT OLD.created_at OR OLD.state IN ('completed','blocked') OR
 NEW.state NOT IN ('pending','reserved','completed','blocked') OR NEW.attempts<OLD.attempts OR
 (OLD.reservation_token IS NOT NULL AND (NEW.reservation_token IS NOT OLD.reservation_token OR NEW.reserved_at IS NOT OLD.reserved_at OR NEW.reserved_by IS NOT OLD.reserved_by OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash)) OR
 (NEW.state='reserved' AND (NEW.reservation_token IS NULL OR NEW.reserved_at IS NULL OR NEW.reserved_by IS NULL OR NEW.request_key IS NULL OR NEW.request_hash IS NULL)) OR
 (NEW.state='completed' AND (NEW.completed_at IS NULL OR NEW.last_error IS NOT NULL))
 BEGIN SELECT RAISE(ABORT,'retention disposal identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER retention_disposal_no_delete BEFORE DELETE ON retention_disposal_jobs BEGIN SELECT RAISE(ABORT,'retention disposal evidence is retained'); END;
--> statement-breakpoint
CREATE TABLE retention_disposal_events (
 org_id TEXT NOT NULL, id TEXT NOT NULL, job_id TEXT NOT NULL, reservation_token TEXT NOT NULL,
 phase TEXT NOT NULL CONSTRAINT retention_disposal_phase CHECK(phase IN ('reserved','outcome')),
 outcome TEXT NOT NULL, actor_id TEXT NOT NULL, at TEXT NOT NULL,
 object_key TEXT NOT NULL, object_version TEXT NOT NULL, etag TEXT NOT NULL,
 PRIMARY KEY(org_id,id), FOREIGN KEY(org_id,job_id) REFERENCES retention_disposal_jobs(org_id,id)
);
--> statement-breakpoint
CREATE INDEX retention_disposal_events_job ON retention_disposal_events(org_id,job_id,at,id);
--> statement-breakpoint
CREATE TRIGGER retention_disposal_event_immutable BEFORE UPDATE ON retention_disposal_events BEGIN SELECT RAISE(ABORT,'retention disposal events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER retention_disposal_event_no_delete BEFORE DELETE ON retention_disposal_events BEGIN SELECT RAISE(ABORT,'retention disposal events are retained'); END;
