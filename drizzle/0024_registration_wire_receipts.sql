-- Actual authenticated wire digest; parsed command receipt hashes and prior migrations are unchanged.
CREATE TABLE device_registration_wire_receipts (
 org_id TEXT NOT NULL, actor_id TEXT NOT NULL, receipt_key TEXT NOT NULL, wire_hash TEXT NOT NULL,
 registration_id TEXT NOT NULL, person_id TEXT NOT NULL, body_hash TEXT NOT NULL,
 PRIMARY KEY(org_id,actor_id,receipt_key,wire_hash), FOREIGN KEY(org_id) REFERENCES organisations(id)
);
CREATE TRIGGER device_registration_wire_receipts_no_update BEFORE UPDATE ON device_registration_wire_receipts BEGIN SELECT RAISE(ABORT,'Immutable registration wire receipt'); END;
CREATE TRIGGER device_registration_wire_receipts_no_delete BEFORE DELETE ON device_registration_wire_receipts BEGIN SELECT RAISE(ABORT,'Immutable registration wire receipt'); END;
