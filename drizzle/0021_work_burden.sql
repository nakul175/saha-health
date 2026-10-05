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
