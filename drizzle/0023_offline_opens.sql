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
