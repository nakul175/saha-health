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
