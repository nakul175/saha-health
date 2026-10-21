# SAHA-158 — purpose-limited event geotags with a no-GPS path

Status: current-parent local integration successor, 21 October 2026. Parent `774d2a044665d152e48ff8b3c1e56ed4d2cb3cd7`; original reviewed candidate `0366685d0d9c0936f474a62d74773c02ba497e9f` (feature delta `da7a0ab6037e10d1a050e7cf76f2002b97ceca63`). This is synthetic/local engineering evidence. It is not formal privacy, clinical, field, merge, deployment or real-use acceptance.

## Frozen local contract

The human sponsor explicitly approved the source-bound proposed criteria recorded for APL-181 / CWO-029 on 20 October 2026. The pinned planning source is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-181.md`, SHA-256 `2f567c5d359a4c8ef077ebe3fae3f498cc09d0a992569543932f4c9c0dd27708`. The exact native APL-181 description captured for this successor is `docs/verification/saha-158-apl-181-native-contract-20261021.json`, description SHA-256 `201c806850964dd8e85fba5edf9578e26e75945353d3f244cc204b4fb9d7a5be`. The native contract and the local planning snapshot are retained as distinct authorities. The local approval record also requires eligible events, declared purpose and authority, explicit permission, configured precision and provenance, minimisation, access and retention controls, stale/wrong-event recovery, a usable no-GPS route and no continuous/background tracking.

Named privacy, clinical and deployment approval remains pending. The code does not infer a lawful basis, allowed purpose, precision or retention period. An organisation owner must configure and activate each of those values.

## Implemented boundary

- The current supported event kind is a Saha visit. The location record is stored on that exact visit and person; imported, voided, superseded, wrong-person, stale-version and out-of-scope visits are refused.
- An owner uses a dedicated organisation control to record a versioned draft or active policy with the eligible event kind, purpose list, coordinate precision, physical-retention period and authority reference.
- A current ASHA or clinician with patient scope can request one browser location reading for one event. The server requires explicit `granted` permission, rejects stale/future readings and rounds latitude/longitude to the configured precision before storage.
- Declined, denied or unavailable location uses the same workflow with a required reason and stores no coordinates. Routine capture remains available.
- Each record retains purpose, permission outcome, provenance, policy version, authority reference, actor, event, person, recorded time and expiry. After expiry, the event, workspace, revision-history and data-exit projections withhold coordinates and coordinate-bearing change values. A separate owner-governed retention cleanup physically removes all due event-location records from current visits and stored visit revisions in the same guarded D1 transaction while preserving revision identity, version, actor, reason, time and append-only enforcement. Count-only audit evidence remains.
- Reads are patient-scoped and audited. After the audit await, the server reloads state and repeats current member, person, assignment and visit checks before disclosure. The UI binds the original signed-in account and organisation to writes.
- A request whose acknowledgement is lost remains visibly unresolved. The UI retains the exact original event selection, body and idempotency key and offers only an exact replay until the server returns an authoritative receipt or accepted-with-access-changed outcome.
- The client calls `getCurrentPosition` only after the worker selects **Use location once**. There is no `watchPosition`, background worker, polling, provider dispatch or mapping-provider activation.

The implementation supports no continuous route, route optimisation, payment, incentive or eligibility decision. SAHA-159 owns route suggestions separately.

## Validation

- `node tests/event-geotag-contract.mjs` — 66 checks passed: policy ownership/versioning and owner UI, purpose and event eligibility, explicit permission, precision/provenance, assignment scope, stale/wrong-person refusal, no-GPS behavior, governed physical expiry, exact-request recovery, UI single-capture/no-background constraints, and current-versus-expired revision redaction.
- `node tests/smoke/event-geotag-worker.mjs` — 10 actual built local Worker/D1 checks passed: positive and no-GPS persistence, lost-ack exact replay, strict refusal paths, post-audit patient-scope race refusal, revision-history expiry redaction, transactional physical cleanup of every bare and dotted sensitive location-change field from current and revision storage, preservation of unrelated revision changes and revision metadata, and restored append-only enforcement.
- `node tests/command-authority-contract.mjs` — 14 checks passed.
- `node tests/visit-import-contract.mjs` — 54 checks passed after classifying the current event-geotag and support-case visit commands as blocked on imported visits.
- `node tests/data-exit-contract.mjs` — 46 checks passed, including current-versus-expired visit revision redaction before archive release and the existing 1,000-person export/re-import integrity exercise.
- `node tests/nfr/authorisation-matrix-current.mjs` — the SAHA-158 route classification and role checks passed in the actual Worker/D1 matrix. The aggregate current matrix remains 69/74 because five inherited assertions outside this story still fail (two current route classifications, two owner-control group expectations, and two activation-precondition status-order expectations grouped into the fifth reported failure). These failures are retained and are not represented as a clean aggregate pass.
- `pnpm typecheck` — passed.
- `pnpm build` — passed and included `/event-geotag`, `/event-geotag-policy` and `/api/event-geotags`.
- `node tests/device-work-purge-failure-browser.mjs` — retained inherited failure: `page.waitForResponse` timed out after 30 seconds. This is not a SAHA-158 pass and remains an independent programme hold.

Current-parent independent review, exact-source CI, merge and observed staging deployment remain separate gates. Earlier review and QA receipts apply to the old candidate only and do not approve this semantic successor.
