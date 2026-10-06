CREATE TABLE availability_samples (
 org_id TEXT NOT NULL,
 slot INTEGER NOT NULL CHECK(slot>=0 AND slot%300000=0),
 source TEXT NOT NULL CHECK(source IN ('scheduler','manual-http')),
 config_version INTEGER NOT NULL CHECK(config_version>0),
 core TEXT NOT NULL CHECK(core IN ('healthy','failed')),
 workflow TEXT NOT NULL CHECK(workflow IN ('healthy','dependency-unavailable','not-configured','maintenance')),
 latency_ms INTEGER NOT NULL CHECK(latency_ms>=0 AND latency_ms<=60000),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(org_id,slot,source)
);--> statement-breakpoint
CREATE TRIGGER availability_samples_immutable_update BEFORE UPDATE ON availability_samples BEGIN SELECT RAISE(ABORT,'Availability history is immutable'); END;--> statement-breakpoint
CREATE TRIGGER availability_samples_immutable_delete BEFORE DELETE ON availability_samples BEGIN SELECT RAISE(ABORT,'Availability history is immutable'); END;
