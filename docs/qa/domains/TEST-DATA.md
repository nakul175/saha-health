# Test data and environment management
Default to synthetic or approved de-identified data. Do not copy production records into fixtures, issue trackers or prompts without explicit existing authorization and controls. De-identification requires validation of re-identification risk; replacing names alone is insufficient.

Maintain dataset ID/version/hash, purpose, schema, provenance, classification, allowed environments, access owner, retention/expiry, consent/licensing if relevant, generator seed, expected labels/oracles and cleanup instructions. Cover empty, minimal/maximal, malformed, multilingual, permission/tenant, time-zone/date-boundary and realistic volume cases.

Isolate tenants/users per run; reset state deterministically; inject controllable time and random seeds where possible. Never embed live credentials. Stub external side effects in routine tests and distinguish sandbox from real integration. Verify fixture cleanup and prevent test accounts/data leaking into production.

Environment record: code/artifact, infrastructure/config version, dependency versions, feature flags, secrets references (not values), network, hardware/browser, isolation and differences from production. Unknown environment drift makes comparison limited or blocked. AI datasets require held-out separation and provenance controls from AI-ML-EVALUATION.md.
