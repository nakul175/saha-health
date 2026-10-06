-- Bounded immutable synthetic acquisition cache. No external clinical/licensing authority is inferred.
CREATE TABLE clinical_source_documents (org_id TEXT NOT NULL,id TEXT NOT NULL,entry_id TEXT NOT NULL,manifest_hash TEXT NOT NULL,reference TEXT NOT NULL CHECK(json_valid(reference)),content TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(org_id,id),FOREIGN KEY(org_id) REFERENCES organisations(id));
CREATE TRIGGER clinical_source_documents_no_update BEFORE UPDATE ON clinical_source_documents BEGIN SELECT RAISE(ABORT,'Immutable acquired source'); END;
CREATE TRIGGER clinical_source_documents_no_delete BEFORE DELETE ON clinical_source_documents BEGIN SELECT RAISE(ABORT,'Immutable acquired source'); END;
