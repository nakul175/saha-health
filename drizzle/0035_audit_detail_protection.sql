CREATE TABLE audit_detail_protections (
 org_id TEXT NOT NULL REFERENCES organisations(id), event_id TEXT NOT NULL,
 key_id TEXT NOT NULL, key_version TEXT NOT NULL, algorithm TEXT NOT NULL,
 token_digest TEXT NOT NULL, lifecycle_token_digest TEXT NOT NULL,
 eligible_at TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(org_id,event_id), UNIQUE(key_id,key_version),
 FOREIGN KEY(org_id,event_id) REFERENCES audit_events(org_id,id)
);
--> statement-breakpoint
CREATE TRIGGER audit_detail_protection_immutable BEFORE UPDATE ON audit_detail_protections BEGIN SELECT RAISE(ABORT,'audit detail protection metadata is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_detail_protection_no_delete BEFORE DELETE ON audit_detail_protections BEGIN SELECT RAISE(ABORT,'audit detail protection metadata is retained'); END;
--> statement-breakpoint
CREATE TABLE audit_detail_key_events (
 org_id TEXT NOT NULL, id TEXT NOT NULL, event_id TEXT NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('sealed','destroy-attempt','outcome')),
 outcome TEXT NOT NULL, key_id TEXT NOT NULL, key_version TEXT NOT NULL,
 lifecycle_token_digest TEXT NOT NULL, at TEXT NOT NULL, receipt TEXT,
 PRIMARY KEY(org_id,id),
 FOREIGN KEY(org_id,event_id) REFERENCES audit_detail_protections(org_id,event_id)
);
--> statement-breakpoint
CREATE INDEX audit_detail_key_events_event ON audit_detail_key_events(org_id,event_id,at,id);
--> statement-breakpoint
CREATE TRIGGER audit_detail_key_event_immutable BEFORE UPDATE ON audit_detail_key_events BEGIN SELECT RAISE(ABORT,'audit detail key events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_detail_key_event_no_delete BEFORE DELETE ON audit_detail_key_events BEGIN SELECT RAISE(ABORT,'audit detail key events are retained'); END;
