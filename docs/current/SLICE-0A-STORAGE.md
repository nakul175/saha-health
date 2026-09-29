# Development slice 0a — patient-partitioned storage

30 September 2026 (IST). First slice of the development-completion plan agreed with the sponsor on 30 September: finish buildable product work before partner access arrives, starting with the storage foundation. Synthetic data only. No formal requirement acceptance changes.

## Why

A local load probe (`tests/load-envelope.mjs`, results in `tests/load-envelope-r11-baseline.json`) measured the R11 storage model against the BRD R1 planning envelope (BRD v1.1 section 23: 200 workers, 100 concurrent users, 100,000 people, 50 requests/second).

| People in one organisation | Workspace read | One write | 50 simultaneous writes on different people |
| --- | --- | --- | --- |
| 1,006 | 67 ms, 773 KB | 138 ms | 3 accepted, 47 rejected (409) |
| 5,006 | 177 ms, 3.9 MB | 568 ms | 3 accepted, 47 rejected; at 50 req/s 568 of 750 requests timed out |
| 20,006 | 664 ms, 15 MB | 3.7 s | not run |
| 100,006 | 3.5 s, 77 MB | 80.9 s | not run |

Three causes: every write was serialised by one organisation revision; every request loaded the whole organisation; and the state diff used linear searches inside loops, so one write grew faster than the organisation.

## What changed

- **Linear diffing and reading.** `rowsForState` and `readState` use indexed maps instead of repeated `find`/`filter`. A one-person change in a 20,000-person state diffs in about 70 ms in the storage contract.
- **Patient partitions.** `lib/saha/partition.ts` lists 39 commands certified to decide only from organisation-level state and the patient they name. For these, the server resolves the patient (from `personId`, or the `visitId`, `referralId` or `submissionId` in this organisation) and loads organisation-level state plus only that patient's records.
- **Two commit guards.** Migration `0006_patient_concurrency.sql` adds `organisations.patient_revision` and `patients.rev`.
  - A patient-scoped commit requires the organisation revision unchanged and every touched patient's `rev` unchanged; it increments those `rev` values and `patient_revision`, not the organisation revision.
  - Every other commit is organisation-wide: it requires both the organisation revision and `patient_revision` unchanged and increments both. This keeps the pre-0a guarantee that a command which read the whole organisation never commits over a change it did not see.
  - A certified command falls back to the organisation-wide guard when it changes any organisation-level row (teams, members, connections, governance, outreach, operations, pilot, expansions), the organisation name, or a patient it did not load.
- **Unchanged guarantees.** Membership, role and permission changes still invalidate in-flight patient writes (they move the organisation revision). Idempotency receipts, append-only revisions and audit, scope checks and the transaction-token dependent-write pattern are unchanged. `Person.version`, which binds approvals, is not used for concurrency.

Commands not certified (registration matching, EHR linking, agent preparation and execution, outreach, reports, governance and all organisation administration) keep the organisation-wide load and guard. Certifying more commands requires checking that the handler reads nothing from other patients.

## Evidence

| Check | Result |
| --- | --- |
| Retained R11 suites | 902 HTTP/D1, 361 contract/checkpoint and 21 restore assertions pass unchanged |
| New HTTP/D1 assertions (`tests/partition-smoke.mjs`) | 21 pass: parallel starts on four patients all commit without moving the organisation revision; one of three same-version saves commits; different-patient saves commit together; identical concurrent commands commit once; scope refusal and unknown references unchanged; revisions and audit recorded |
| Storage contract (`tests/storage-contract.mjs`) | 19 pass on an in-memory SQLite database with the real migrations: partition reads, guard selection, stale same-patient refusal with no partial writes, organisation change invalidating a patient write, organisation-wide write refused after a patient commit, uncertified commands kept organisation-wide, linear diff at 20,000 people |
| Load probe at 1,006 people | 10 of 10 and 50 of 50 simultaneous writes on different people accepted (R11: 2 and 3); no conflicts in the sustained phase (R11: 208) |

Reports are stored under `tests/evidence/slice-0a/` with a digest manifest. One of two full-suite runs hit the transient local Worker restart already recorded in R11 (a 503 at a pre-existing toggle step); the rerun passed without retries or relaxed expectations.

## Limits

- Throughput at 50 requests/second did not improve (5.9 req/s at 1,006 people) because workspace reads and every command response still build the whole permitted organisation snapshot. Slice 0b replaces that with paged lists, per-patient detail and scoped command responses.
- Organisation-wide commands now conflict with concurrent patient writes as they did before, but patient writes no longer conflict with each other; busy organisations may see more retries on administrative actions.
- Local probe only. Hosted D1 latency, Worker memory and CPU limits, multi-account sessions and the 30-minute duration were not tested. NFR-24 (scale readiness) remains unverified.
