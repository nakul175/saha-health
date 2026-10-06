# EHR probe audit ordering and configured connection eligibility

5 October 2026. Bounded B04/R66/NFR-10 fix; true R05/NFR-01 synthetic availability reporting is separate and remains open.

## Findings and changes

The unbound EHR capability probe requested partner metadata before its durable audit event. The newer domain callback also required an active target for a probe, although owner configuration suspends the connection and activation requires that probe to pass. This prevented the initial configure → probe → activate path. Retained service bindings similarly prevented diagnosing an owner-reconfigured, suspended EHR/MIS connection.

`ehr-probe.ts` now checks current owner, operating state, exact configured version and dedicated server grant, then persists the original command receipt and a chained pre-request audit before metadata transport. An audit-store failure rolls back the checkpoint and sends no request. Technical results are saved in a separate audited result commit. The probe never activates the connection, approves patient exchange or transmits patient data. Original-key replay returns the durable testing checkpoint; the fresh workspace carries any subsequently stored technical result. An interrupted test does not cause automatic metadata contact.

Probe-only dispatch permits configured suspended HTTP EHR/MIS targets, including retained explicit bindings. It requires current owner authority, original/current exact configuration version and activation state, and repeats service identity kind/target/accountable owner/expiry/revocation checks before and after its audit. Fresh maintenance still refuses a probe. Create/bind management and every clinical send stay active-only. Receipt lookup policy is unchanged. Provider activation remains its existing separate owner command; no provider was activated externally.

## Validation and limits

`tests/ehr-probe-contract.mjs` runs actual migrations, store persistence, audit chain, dispatch, configuration, probe and activation validators on a SQLite-backed D1 shim, with injected metadata-only transport. Its 20 checks cover initial EHR and MIS lifecycles, retained-bound reconfiguration, unbound audit-trigger failure with no request/receipt, maintenance, active-only management, and identity revocation, expiry, target, kind, configuration, owner and maintenance mutations at both reservation and service-audit boundaries. This proves local software behavior; it does not claim actual hosted D1 or partner acceptance.

Affected regression checks pass: EHR 33, MIS 16, adapter operations 14, EHR resolution 13, send gate 29, access audit 35, dispatch 100. Build and TypeScript pass. Six explicit module-copy harnesses include the new dependency, including the adapter benchmark and replay soak. The extended replay soak had incomplete historical scope fixtures (missing worker teams/patient team IDs); these now express their intended synthetic care scope. All original eight invariants pass across 1,507 timeout/replay events, with zero blind resends, duplicate accepted records, repeated EHR POSTs or duplicate stored documents.

Evidence is under `tests/evidence/ehr-probe-audit/`. Providers-disabled HTTP smoke tests and hosted acceptance belong to the lead's integration validation. Emergency audit-outage read design and other NFR-10 acceptance remain open. No shared assessment or generated catalogue was changed.
