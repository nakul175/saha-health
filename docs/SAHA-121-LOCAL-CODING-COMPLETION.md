# SAHA-121 local coding completion

## Frozen contract

- Story: SAHA-121 / APL-144, Repeatable deployment packaging
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-144.md`
- Contract SHA-256: `a8c40bc7c83d17a6ec273084471eee48ccc58ef5c01a7a1e2a22e46555178013`
- Source base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented local behavior

An authorised operations owner can add a strict deployment manifest to a location expansion proposal. The manifest records reviewed settings, secret binding names, dependencies, training, tests, operating responsibilities and explicit local differences. Settings reject sensitive or patient-oriented keys and obvious embedded bearer tokens, private keys and provider-secret formats. Secret bindings contain a binding name rather than a reusable credential.

The deployment manifest participates in evidence and review hashes. Adding or changing it invalidates earlier evidence and independent review. A reviewed deployment pack can be exported only after all six expansion evidence areas and the named independent review are current. The export is digest-bound, records a durable audit before delivery and rechecks the exporter, accountable owner, reviewer, proposal version, manifest and review if the audit commit races with another change.

A copied pack imports as a new draft with newly selected local owners. Evidence, review and approval state never transfer. The strict import rejects added patient fields and a mismatched digest. No command installs, hosts or activates the copied deployment.

The controlled-expansion interface exposes the manifest, readiness counts, reviewed-pack download and configuration-only import. It continues to state that the workflow does not open a deployment.

## Verification

- Focused synthetic contract: 25/25 passed.
- TypeScript typecheck: passed.
- Production build: passed.
- Full API smoke was attempted on a newly migrated local D1 fixture. It stopped before the expansion suite at the inherited operations assertion `overview.report.patients > 0` in `tests/operations-smoke.mjs:7`; therefore no full API-pass claim is made.
- Formal source cases TC-BR-OPS-08-A and TC-BR-OPS-08-B remain Not run.

## Boundaries and pending gates

This is local coding evidence, not formal acceptance. It uses synthetic configuration only and does not contain real patient records, production credentials or reusable secret values. It creates no provider, database, hosting service or deployment and sends nothing externally.

Independent final source review, final-head CI, formal QA/deployment-operations execution of the source fixtures, required buyer/jurisdiction/security/domain approvals, merge and observed deployment remain separate pending gates.
