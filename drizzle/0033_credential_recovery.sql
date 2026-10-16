CREATE TABLE credential_recoveries (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(user_id),
  recovery_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('revoked-pending-activation','active')),
  revoked_before INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE credential_recovery_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES accounts(user_id),
  recovery_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('superseded-credentials-revoked','replacement-credential-activated')),
  at TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(recovery_id,action)
);
CREATE INDEX credential_recovery_events_user_at ON credential_recovery_events(user_id,at);
