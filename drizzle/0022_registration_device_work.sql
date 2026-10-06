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
