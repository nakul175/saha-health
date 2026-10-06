-- Original figure material and command receipts remain unchanged. Durable per-viewer edition protection.
CREATE TABLE indicator_figure_disclosures (org_id TEXT NOT NULL,actor_id TEXT NOT NULL,figure_id TEXT NOT NULL,release_hash TEXT NOT NULL,released TEXT NOT NULL CHECK(json_valid(released)),at TEXT NOT NULL,PRIMARY KEY(org_id,actor_id,figure_id,release_hash),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TRIGGER indicator_figure_disclosures_no_update BEFORE UPDATE ON indicator_figure_disclosures BEGIN SELECT RAISE(ABORT,'Immutable figure disclosure'); END;
CREATE TRIGGER indicator_figure_disclosures_no_delete BEFORE DELETE ON indicator_figure_disclosures BEGIN SELECT RAISE(ABORT,'Immutable figure disclosure'); END;
