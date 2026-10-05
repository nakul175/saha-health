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
