# SAHA-158 — purpose-limited event geotags with a no-GPS path

Status: local coding candidate, 20 October 2026. This is synthetic/local engineering evidence. It is not formal privacy, clinical, field, merge, deployment or real-use acceptance.

## Frozen local contract

The human sponsor explicitly approved the source-bound proposed criteria recorded for APL-181 / CWO-029 on 20 October 2026. The pinned planning source is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-181.md`, SHA-256 `2f567c5d359a4c8ef077ebe3fae3f498cc09d0a992569543932f4c9c0dd27708`. The local approval record also requires eligible events, declared purpose and authority, explicit permission, configured precision and provenance, minimisation, access and retention controls, stale/wrong-event recovery, a usable no-GPS route and no continuous/background tracking.

Named privacy, clinical and deployment approval remains pending. The code does not infer a lawful basis, allowed purpose, precision or retention period. An organisation owner must configure and activate each of those values.

## Implemented boundary

- The current supported event kind is a Saha visit. The location record is stored on that exact visit and person; imported, voided, superseded, wrong-person, stale-version and out-of-scope visits are refused.
- An owner uses a dedicated organisation control to record a versioned draft or active policy with the eligible event kind, purpose list, coordinate precision, physical-retention period and authority reference.
- A current ASHA or clinician with patient scope can request one browser location reading for one event. The server requires explicit `granted` permission, rejects stale/future readings and rounds latitude/longitude to the configured precision before storage.
- Declined, denied or unavailable location uses the same workflow with a required reason and stores no coordinates. Routine capture remains available.
- Each record retains purpose, permission outcome, provenance, policy version, authority reference, actor, event, person, recorded time and expiry. After expiry the read projection withholds latitude, longitude and accuracy. A separate owner-governed retention cleanup physically removes all due event-location records without requiring a later geotag write, while count-only audit evidence remains.
- Reads are patient-scoped and audited. After the audit await, the server reloads state and repeats current member, person, assignment and visit checks before disclosure. The UI binds the original signed-in account and organisation to writes.
- A request whose acknowledgement is lost remains visibly unresolved. The UI retains the exact original event selection, body and idempotency key and offers only an exact replay until the server returns an authoritative receipt or accepted-with-access-changed outcome.
- The client calls `getCurrentPosition` only after the worker selects **Use location once**. There is no `watchPosition`, background worker, polling, provider dispatch or mapping-provider activation.

The implementation supports no continuous route, route optimisation, payment, incentive or eligibility decision. SAHA-159 owns route suggestions separately.

## Validation

- `node tests/event-geotag-contract.mjs` — 60 checks passed: policy ownership/versioning and owner UI, purpose and event eligibility, explicit permission, precision/provenance, assignment scope, stale/wrong-person refusal, no-GPS behavior, governed physical expiry, exact-request recovery and UI single-capture/no-background constraints.
- `node tests/smoke/event-geotag-worker.mjs` — 8 actual built local Worker/D1 checks passed: positive and no-GPS persistence, lost-ack exact replay, strict refusal paths, post-audit patient-scope race refusal and physical retention cleanup without a later geotag write.
- `node tests/command-authority-contract.mjs` — 14 checks passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed and included `/event-geotag`, `/event-geotag-policy` and `/api/event-geotags`.
- `pnpm lint:baseline` — passed the inherited error baseline; new feature files pass ESLint directly. The repository warning count remains above its older warning reference and is not represented as a clean whole-repository lint result.

Exact-source CI, independent review, merge and observed staging deployment remain separate gates.
