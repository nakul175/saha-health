# B26 — opt-in work-burden samples

2026-10-05. Synthetic software evidence only. This bounded batch contributes to BR-DATA-12 and BR-REP-07. It does **not** complete the BRD's total documentation-time, completed-visit, support-ticket, baseline or pilot acceptance clauses.

An owner can enable or disable count-only sampling from Operations → Service & incidents → Work-burden samples. It is disabled in legacy/default configuration. `opsWorkBurden` uses the current operations version, owner authority, ordinary command receipt and immutable configuration audit. Maintenance permits opt-out and configuration/reporting without enabling clinical operations. A saved configuration receipt remains readable only through the existing current owner replay checks.

## Event and persistence contract

`POST /api/work-burden`, JSON only, same-origin, current organisation header, maximum 512 bytes:

```json
{"key":"UUID event key","code":"capture-30s"}
```

Early refusals drain only a bounded body to keep reused connections clean, without writing request metrics. Unknown keys, arbitrary codes, patient/visit/ticket identifiers, text, durations, errors and URLs are refused. Public identity is never supplied by this payload. The actor comes from the trusted identity provider and must have a current active ASHA/clinician membership. The server checks configuration and membership before the request and rechecks current role, membership version and exact enabled configuration version in the transaction. A positive withdrawal after the write withholds the acknowledgement. Disabled configuration validates the fixed request but writes no counter, receipt or event.

| Codes | Meaning / provenance |
| --- | --- |
| `capture-30s`, `capture-2m`, `capture-5m`, `capture-15m`, `capture-over15m` | Client-reported active-time band for a successfully saved common-fact capture session: ≤30 s, (30 s, 2 min], (2, 5 min], (5, 15 min], >15 min. |
| `help-request`, `assisted-completion` | Explicit human self-report, exposed to care users in capture and eligible care operators in Operations. No ticket or intervention proof is inferred. |
| `client-sync-unknown` | Reserved fixed self-reported uncertainty code. The existing field notebook does not emit it in this batch. |
| `server-sync-success` | A parsed `syncFieldVisit` completed the existing authorised command/response preparation. Does not prove receipt delivery to the device. |
| `server-sync-replay` | An authorised saved sync receipt was checked. One per command key; **not** proof that a prior transport failed or recovered. |
| `server-sync-conflict`, `server-sync-refused`, `server-sync-invalid` | Fixed 409, 403/404, or domain 422 outcome from an already parsed sync command, while current human care membership and opt-in remain valid. These describe response outcomes, not necessarily absence of a durable clinical receipt. Malformed command parsing, missing membership and raw exception errors are not counted. |

The client endpoint accepts only the first three client categories. Server categories are produced only by the existing parsed sync boundary; clients cannot forge them. Automated outcome recording is best effort and independent of the clinical transaction. Its failure cannot change an already saved clinical response into an error, move a clinical revision, repeat a clinical mutation or create permission to retry one.

`persistBurdenCounter` is a narrow store helper. It atomically appends a namespaced `command_receipts` row with null person ID, a chained `workBurdenCounter` audit event, and one aggregate count. Audit insertion failure rolls back the receipt and count. The current initiating membership envelope is included in the protected audit; general counters contain no actor IDs. No clinical or organisation revision moves. Six simultaneous identical requests were tested against actual local D1: one write and five acknowledgements of the existing event. An event key bound to another code or organisation refuses rather than recounting. Current route membership and enabled configuration are required on retries.

Aggregate storage reuses `request_metrics` with route `burden:<fixed-code>`, numeric status 0, UTC Monday week bucket and zero `total_ms`/`max_ms`. The aggregate report returns at most 32 categories for one week. Request latency, request totals, error alerts and 30-day request pruning exclude this namespace. Burden history and protected receipts remain durable under existing export/restore and audit policies; there is no new migration. This batch does not introduce anonymous third-party analytics.

## Governed report and denominator

`GET /api/work-burden?week=YYYY-MM-DD` accepts one UTC Monday within the previous year. Owners/current administrators can read organisation-wide count-only information. It durably audits every report before returning data and then verifies current operator role/owner status again. Audit failure or permission withdrawal withholds the result. A normal care member, other organisation member or anonymous caller cannot read it.

The denominator is **distinct durable human care-active actors in that UTC week**, not registered accounts, current roster size or every reader. Eligible local patient events are `startVisit`, `saveVisit`, `confirmVisit`, `syncFieldVisit` and `saveProgrammeAnswers`; the recorded role must be ASHA/clinician and the immutable v1 command-authority envelope must record the same active member role. Only events after the organisation's bootstrap/migration baseline qualify. Administrative actions, provider/system events, reads, help telemetry itself, fixture import actions and untracked earlier/imported audit history cannot contribute. SQL counts the full bounded time window rather than the recent 250-row workspace sample. Suspending a worker later does not remove their already recorded weekly contribution.

Help requests and assisted-completion counts per 100 care-active actors return null when the denominator is zero or that counter has no observed samples. Missing samples never become a numerical zero. They remain self-reported ratios with possibly incomplete participation. They are not support tickets per all pilot workers, staff rankings or a verified support burden measure. A worker may report help without a qualifying patient event; counts and denominator intentionally use different definitions and the report states them. Absence of counters does not establish zero burden.

## App capture and uncertain metadata

The online `/app` uses a monotonic clock, foreground/focus guards, a 30-second inactivity cutoff and one-second sampling. Only common-fact field input starts active capture; programme questions and the rest of the visit workflow are excluded. A successful existing clinical draft save closes that sample; failed clinical saves do not emit a saved-capture sample. No facts, field names, patient/visit IDs or raw duration leave through the metadata endpoint. Hidden/unfocused intervals, idle time, a visit/account/organisation change and reload do not turn into measured active time.

A failed metadata request retains its fixed code and UUID in memory. The user may explicitly retry that same metadata event. It never retries the clinical save. If an earlier event is pending, another saved capture sample is omitted with a notice rather than replacing the unknown event. Positive access denial clears the pending event. Reload, account/organisation change or leaving this visit can lose an unflushed sample; this limitation is explicit. The pending event is not stored in plaintext browser storage.

## Deferred field outbox contract

A06 owns the shared encrypted notebook/device privacy code during this batch. No field vault, service worker, lease or offline clinical authority code was modified here. The follow-up must store an optional bounded `burdenEvents` queue **inside** the existing account-bound encrypted notebook, containing only UUID, fixed client code and originating organisation. Flush only after positive current signed-in actor/organisation care membership and enabled policy. Keep the same event and key after genuine transport uncertainty; positive withdrawal stops flushing; successful count receipt removes it; lock/account change must preserve encryption and never send someone else's queue. Reuse the existing guarded encrypted vault revision protocol. Do not derive a clinical retry from a counter receipt, and do not store clinical pending bodies, patient IDs, ticket text or raw errors in this queue. Compatibility with old notebook schema and device grant privacy controls needs independent testing before claiming offline coverage.

True transport recovery requires linking an observed uncertain sync attempt to its unchanged clinical operation key and a later authorised saved clinical receipt. This batch deliberately reports client uncertainty and receipt checks separately. Real support tickets require an approved source and privacy-safe verified linkage; the fixed help buttons do not provide it.

## Evidence and remaining acceptance

Dedicated evidence lives under `tests/evidence/work-burden/`:

- `contract.json`: 19 assertions groups for active-time bands, idle/hidden exclusion, resets, strict configuration, owner scope and immutable toggles.
- `http.json`: 32 actual built Worker/local D1 assertion groups, including default-disabled no event writes, strict payload/origin/role, six-way stable-key dedup, audit-fault rollback, unchanged revisions, historical care denominator after suspension, post-audit operator withdrawal, report audit failure, actual field preparation/sync/receipt lookup, independent counter failure preserving the clinical receipt, fixed conflict dedup, opt-out and intact audit chain.
- `browser.json` and `phone-report.png`: 12 real Chromium checks at 390 px. Owner enables through Operations; common facts save without default telemetry; a foreground saved session emits only a fixed band/key; aborting its metadata request preserves the clinical save; explicit exact-key retry records once; fixed help self-report appears in the governed report. No physical-device or hosted acceptance.

Required integrator registration: `work-burden-contract.mjs` is automatically a unit suite; `work-burden-http.mjs` and `work-burden-browser.mjs` need explicit integration catalogue entries. The latter uses the established Wrangler browser harness and bundled approved Chromium. Shared generated requirement/docs/catalogue changes remain the integrator's responsibility.

The broad compatibility run examined 148 unit suites: 142 passed (8474 recognised assertions); three local socket/process suites were refused by the sandbox, the new fixed telemetry status required the reviewed safe-log entry, and two untouched capacity fixtures lacked the A05 prepared question descriptors. Approved affected reruns passed 40 checks across four suites; the exact already-delivered `fbe00c52` capacity fixture updates passed 45 checks across the remaining two suites. The original broad report and both rerun reports are retained. This is combined affected verification, not a claim that the original broad invocation was all green. Those parent fixture/tooling changes were temporary in this checkout and are not part of this feature commit. Type check, production build and whitespace checks passed. The new tests print structured passed/failed counts for subsequent catalogue runs.

Remaining software/pilot interfaces are explicit: encrypted field outbox; proved same-key sync recovery linkage; verified real ticket/assisted-intervention linkage; complete recording/correction/reconciliation time per comparable **completed visit**, including paper/external MIS coverage; representative baseline and 6–8-week pilot observations with programme/complexity/worker/connectivity exclusions; distributions and sponsor acceptance; full cost per completed visit. Existing reuse, worker activity and correction views remain separate measures. This batch does not promote either BRD row or Section 6 acceptance to complete.
