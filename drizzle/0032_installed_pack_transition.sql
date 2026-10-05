CREATE TABLE installed_pack_transition_events (
 org_id TEXT NOT NULL, id TEXT NOT NULL, transition_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL,
 PRIMARY KEY (org_id,id)
);
CREATE INDEX installed_pack_transition_history ON installed_pack_transition_events(org_id,transition_id);
