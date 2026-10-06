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
