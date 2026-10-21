# SAHA-107 — operational exception queues

20 October 2026. Local application implementation for APL-130 / BR-REP-01, based on `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. Synthetic evidence only; the two formal catalogue cases remain **Not run**.

## Implemented boundary

- The scoped Operations queue retains overdue referrals and follow-ups, rejected/uncertain submissions, unresolved protocol and safety reviews, EHR uncertainty, provisional identities, unsynchronised expired field grants, ABDM review, emergency-access review, correction work and other retained recovery rows.
- Open identity merge proposals are explicit `identity-conflict` rows. Only a clinician or supervisor with normal current access to both records can see or receive that work. Ownership and emergency access do not widen the two-record identity scope.
- Redacted fixed-code device reports from the existing append-only `device_work_events` evidence are joined as `device-diagnostic` rows. A supervisor sees reports only for active workers in a shared team; operations members see organisation diagnostics without patient data. Raw device errors, patient identifiers and notebook content are never accepted or shown.
- Every visible row can be assigned from Operations. The command binds the queue-rules version, exact item id and `since` value, and expected assignment version. The server recomputes current visibility, rejects resolved/stale/out-of-scope work and checks the assignee's current role and scope before one atomic organisation update and audit event. Assignment changes only accountability; it never retries, sends, merges, decides a review or changes clinical records.
- Patient recovery work requires current patient coverage for the assignee. Identity conflicts require normal access to both records; destination failures require operations authority; device diagnostics require an operations member or a responsible supervisor. Receipt replay rechecks current patient/device scope.
- Offline or not-yet-attributed fixed-code device failures enter a bounded metadata-only browser outbox with a stable operation id. Reconnect under a trusted notebook organisation drains the same event idempotently. A storage failure that also prevents localStorage retains only current-tab evidence and is not described as durable.
- The existing demonstration notification channel creates one opaque occurrence per visible exception item. The occurrence key digests the internal item id; simulator messages contain only the exception kind and a count of one. No live recipient or provider is activated.

## Evidence

- `tests/exception-assignment-contract.mjs` / `tests/exception-assignment-contract-result.json`: 15 application-contract checks for all five named failure classes, identity and device scope, positive assignment, assignee authority, stale-row and stale-version races, resolved work and no-side-effect refusals.
- Retained contracts: exception queue 8, referral request queue 21, correction tasks 13, adapter operations 14 and EHR resolution 13.
- `tests/device-work-contract.mjs`: 54 checks, including bounded no-organisation/offline diagnostic retention, stable retry and later drain without private content.
- `tests/notification-sources-contract.mjs`: 19 notification-source checks, including opaque per-item source construction.
- `tests/exceptions-smoke.mjs`: the shared HTTP/D1 suite exercises fixed-code device report → scoped queue read → accountable assignment, ordinary patient-row assignment/readback and stale assignment refusal.
- The exact final source passed the local integration runner: `integration/run-api-smoke` **5,030 passed, 0 failed**. This is local engineering evidence, not CI or formal acceptance.
- TypeScript and production build pass locally. The production build retains the repository's existing large-chunk warning.

## Acceptance boundary

The application code covers the original BR-REP-01 functional classes and assignment path with synthetic positive, refusal, error and race evidence. Formal `TC-BR-REP-01-A` and `TC-BR-REP-01-B` remain Not run because this engineering batch does not use the controlled `FX-REP-01` / `FX-REP-01-NEG` execution and is not QA acceptance. Physical-device loss, a failure that cannot persist even fixed local metadata, real notification providers, clinical/domain approval, CI, merge and observed deployment remain separate gates. Device-only work cannot be visible to a server while disconnected; the product retains a redacted event locally and reports it after trusted reconnection instead of claiming impossible live discovery.
