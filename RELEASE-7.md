# Release 7 / v0.8 — Operations and recovery

27 September 2026 UTC. Private synthetic engineering release. **Not an accepted pilot candidate.**

## Implemented

- Operations workspace with 7/30/90-day supervisor reporting; current care-team scope enforced on the server. Administrators do not receive patient aggregates.
- Independent counts for visit confirmation, outstanding follow-ups/referrals, unresolved programme/EHR receipts and programme workload. Destination simulations remain labelled.
- Audited aggregate CSVs with formula escaping and technical support exports excluding clinical records, identities, credentials, endpoints and incident free text.
- Agent adoption and known-token usage with explicit missing-data coverage and configurable cost assumptions; no invoice or time-saving claims.
- Durable privacy-safe hourly request metrics, error counts, mean/max latency and request references in platform logs.
- Versioned incident ownership, triage, evidence-required resolution and immutable closed incidents.
- Owner maintenance control: pauses new clinical writes and external requests while retaining receipt lookup, safety controls and in-flight result evidence.
- Encrypted local database backup/restore tooling, full table/schema verification, non-overwrite restore, append-only history checks and restored built-Worker acceptance drill.
- Bounded streaming request bodies, separate operational/support permissions, source and database recovery runbooks, and visible unresolved pilot gates.

## Evidence

Automated evidence is recorded in `tests/latest-result.json`, `tests/operations-contract-result.json`, `tests/recovery-result.json`, `tests/operations-load-result.json` and the retained agent/MIS/EHR/field result files. These are individual assertions and bounded local tests, not independent clinical validation or production capacity.

See [VALIDATION.md](VALIDATION.md) for final counts and browser evidence. See [OPERATIONS.md](OPERATIONS.md) for exact metric definitions, permissions, operational boundaries, API and recovery procedures.

## Not accepted / external dependencies

- No live MIS/EHR/model acceptance; no implemented ABHA/HIP/HIU exchange or ABDM conformance claim.
- No hosted backup scheduler, retained production backup, infrastructure restore/cutover, accepted RPO/RTO, off-site alerting or rota.
- No independent penetration assessment, full accessibility audit, representative production load/soak or physical-device acceptance.
- Prior field disconnection/speech and clinical content validation gates remain open.
- Whole-organisation reconstruction and organisation-level write serialization remain scale limits. This is not a production-readiness declaration.

## Compatibility

One additive migration creates `operations` and `request_metrics`. Existing patient, visit, receipt, history, programme and field records are retained. No dependency change. Do not deploy old source as an operational rollback because it bypasses the new maintenance guard. Use a reviewed compatible forward fix and isolated restore/reconciliation procedures.
