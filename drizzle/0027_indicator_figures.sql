-- Protected immutable population-based figures and reviewed reissues; no patient text or measurements.
CREATE TABLE indicator_figures (org_id TEXT NOT NULL REFERENCES organisations(id),id TEXT NOT NULL,parent_id TEXT,author_id TEXT NOT NULL,author_version INTEGER NOT NULL,created_at TEXT NOT NULL,digest TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(org_id,id));
CREATE TABLE indicator_figure_units (org_id TEXT NOT NULL,figure_id TEXT NOT NULL,person_id TEXT NOT NULL,person_version INTEGER NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(org_id,figure_id,person_id),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TABLE indicator_figure_events (org_id TEXT NOT NULL,figure_id TEXT NOT NULL,id TEXT NOT NULL,sequence INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('prepared','approved','rejected','published')),actor_id TEXT NOT NULL,member_version INTEGER NOT NULL,role TEXT NOT NULL,at TEXT NOT NULL,reason TEXT NOT NULL,review_id TEXT,PRIMARY KEY(org_id,id),UNIQUE(org_id,figure_id,sequence),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE TABLE indicator_figure_receipts (org_id TEXT NOT NULL,actor_id TEXT NOT NULL,key TEXT NOT NULL,body_hash TEXT NOT NULL,figure_id TEXT NOT NULL,result TEXT NOT NULL CHECK(json_valid(result)),PRIMARY KEY(actor_id,key),FOREIGN KEY(org_id,figure_id) REFERENCES indicator_figures(org_id,id));
CREATE INDEX indicator_figures_created ON indicator_figures(org_id,created_at);
CREATE TRIGGER indicator_figures_no_update BEFORE UPDATE ON indicator_figures BEGIN SELECT RAISE(ABORT,'Immutable figure'); END;
CREATE TRIGGER indicator_figures_no_delete BEFORE DELETE ON indicator_figures BEGIN SELECT RAISE(ABORT,'Immutable figure'); END;
CREATE TRIGGER indicator_figure_units_no_update BEFORE UPDATE ON indicator_figure_units BEGIN SELECT RAISE(ABORT,'Immutable figure material'); END;
CREATE TRIGGER indicator_figure_units_no_delete BEFORE DELETE ON indicator_figure_units BEGIN SELECT RAISE(ABORT,'Immutable figure material'); END;
CREATE TRIGGER indicator_figure_events_no_update BEFORE UPDATE ON indicator_figure_events BEGIN SELECT RAISE(ABORT,'Immutable figure history'); END;
CREATE TRIGGER indicator_figure_events_no_delete BEFORE DELETE ON indicator_figure_events BEGIN SELECT RAISE(ABORT,'Immutable figure history'); END;
CREATE TRIGGER indicator_figure_receipts_no_update BEFORE UPDATE ON indicator_figure_receipts BEGIN SELECT RAISE(ABORT,'Immutable figure receipt'); END;
CREATE TRIGGER indicator_figure_receipts_no_delete BEFORE DELETE ON indicator_figure_receipts BEGIN SELECT RAISE(ABORT,'Immutable figure receipt'); END;
