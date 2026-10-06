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
