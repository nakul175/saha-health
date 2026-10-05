# Atomic ABHA review reservations

5 October 2026 (IST). Synthetic local mock ABDM only. Formal acceptance unchanged.

## Behaviour

The ABHA link handler validates current role, patient scope/version, module approval and already-linked state before reserving a lookup. Migration `0018_abha_review_reservations` adds a dedicated protection table. A guarded D1 insert admits at most three pending or refused distinct probes per requester and organisation in a rolling 24-hour window, including historical out-of-scope steward reviews. The count and insertion are one SQL statement inside a D1 batch; simultaneous requests cannot all pass a separate count check.

The table stores organisation/member ids, SHA-256 command-key/payload/probe fingerprints, a timestamp and an optional audit-event UUID. It stores no raw ABHA number, patient/holding-record id, contact detail or raw command key. No new logging or telemetry is added. It is explicitly excluded from organisation data export as server protection state; full database recovery still retains it. The export manifest names migration 0018.

A pending or previously refused attempt, and a repeat of the same probe under another command key, returns the ordinary `LINK_REFUSED` response without another lookup. Reusing a retained command key for changed input returns 409. Existing successful command receipts continue to use the existing replay/reauthorisation path. Successful links and non-conflict validation failures release their reservation. If a lookup finds a holder outside care scope, the reservation remains even when its steward audit fails. A successful audit is associated by its opaque event UUID to avoid counting its reservation twice; the brief interval before association is conservative. Steward audit events stay append-only and restricted to the holding record.

Expired reservations are removed lazily only for the requesting organisation/member. A process interrupted after reservation conservatively consumes a slot for up to 24 hours; no uncertain lookup is automatically repeated. The quota is not a real ABDM service limit or an approval for real patient use.

## Evidence

`tests/atomic-abha-review-contract.mjs` runs the real migrations and guarded SQL against a local Miniflare D1 binding. Fourteen checks passed: a 32-request concurrent burst admits exactly three lookups; concurrent same-key retries admit one; repeated probes, changed payloads, release, audit failure, rolling expiry, actor/organisation isolation, historical rollout, audit/reservation association, historical deduplication and fingerprint privacy. It also checks the server reserve-before-lookup order and preserved prelookup validation.

Focused regression: ABDM mock contract 14 checks; eighth-review fixes contract 18 checks; data-exit contract 39 checks including a 1,000-person export/reimport with intact audit chain; safe-logs contract 13 checks. TypeScript `--noEmit` and `git diff --check` passed. Evidence lives in `tests/evidence/atomic-abha-review/`.

Limits: no hosted D1 or real ABDM measurement, no end-to-end HTTP test in this batch, no independently reviewed security or formal requirement acceptance. The integrator must run the built Worker regression, including `eighthReviewSmoke`, and update generated implementation/requirement/validation documents without promoting acceptance.
