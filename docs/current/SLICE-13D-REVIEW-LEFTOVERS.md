# Development slice 13d — review leftovers

4 October 2026 (IST). At the sponsor's request ("fix all"), this slice fixes the medium and lower findings that earlier agent reviews left open: those of the round-10 combined review ([slice 10k](SLICE-10K-COMBINED-REVIEW-FIXES.md)), and those of reviews 9 and 10 listed under [slice 6ae](SLICE-6AE-HELD-TRANSFER-ATOMICITY.md). Two stay open (see Limits). Synthetic data only; formal acceptance unchanged.

## What changed

Round-10 combined review:

- **M2 — the scheduled rotation no longer skips organisations.** The job stores where its rotation stopped (new table `scheduled_cursor`, migration 0016: one row per job, the last organisation reached and when). The next run continues after it, whatever stopped the previous run (its statement or time bound), and wraps round. It pages by organisation id after the cursor, so there is no longer a window of the first 1,000 organisations. A run that reaches none reports `stoppedBy: organisations`. The cursor holds an organisation id only; it is not part of an organisation's data export.
- **M3 — the household view is read-audited.** Showing a household (with member names and, since slice 10f, their open follow-up and referral titles) records one `viewHousehold` access event per member shown, before anything is returned; if the events cannot be written the read is refused (503), as for every audited read.
- **L1 — the scheduled job's records no longer make a person's command conflict.** The alert evaluation record and the audit-chain verification record were organisation-wide commits, so a command prepared just before one got a 409. They are now written like the indicator ledger (`store.persistScheduledRecord`): one targeted compare-and-set write of that key with its chained audit event, taking the batch token without moving either revision. Nothing is written in maintenance or when another run recorded first. Ordinary operations writes keep these keys as stored, so a command built on an older read cannot roll them back.
- **L3 — automated identities are reserved.** `system` and ids beginning `system:` (the scheduled job, the caseload scheduler, the notification simulator) are refused as sign-in identities, as `fixture:` ids already were.
- **L4 — one environment.** The notification simulator and alert delivery take the environment from their caller (the scheduled job passes the one its handler received) instead of reading it separately.
- **L5 — disputes stop assistant runs.** An open dispute on a confirmed visit stops preparing or running an assistant on it, as it already stopped sending it.
- **L6 — the operations document has an overall bound** (1 MB, beside the caps on each collection in it; the indicator differencing ledger in the same row has its own writer and bound and is not counted). A change that would take it past the bound, and grow it, is refused (413); a change that shrinks it never is.

Reviews 9 and 10:

- **Refused indicator queries are recorded and limited.** A refused or partly withheld indicator query tells its viewer something about a small group: that a combination with their earlier queries would reveal one, or that the filtered cohort has fewer than 5 people. Each such query is now recorded (`viewAggregate`, subject `indicator refusal`, with which filters were set but never their values; a partly withheld result was already recorded with its withheld count), and a viewer may have at most 20 in 24 hours; after that their indicator queries are refused (429) until the oldest leave the window. The catalogue stays readable.
- **Correction tasks no longer reveal release volume.** The indicator-releases correction task, part of the patient's record that the whole care team reads, says only whether figures were released since confirmation, not how many or which. A supervisor or owner sees the releases in Indicators.
- **The aggregate send checkpoint screens the sender's population.** The state read inside the checkpoint was unscoped (every person unassigned), so the population screen saw nobody and passed whatever had been sent since approval. The sender's scope is applied first; a sender no longer active is refused.
- **A due transfer during maintenance** no longer makes each request read the whole organisation only to stop: the indexed due-transfer question also checks maintenance.
- **Corrections are not late arrivals.** The indicator freshness report leaves out correction visits (`amendsVisitId`); their effect on released figures is reported by the correction's own task.
- **The field notebook's idle lock** is extended only by a sync step that synced, not by refused ones.

## Tests

- `tests/scheduled-job-contract.mjs` (35 checks): after a run stopped early by its statement bound, the cursor moves only past the organisation reached and the next run continues after it; after the last organisation the rotation wraps to the first, and every organisation not visited is counted as not reached; the evaluation record does not move the revision, a command prepared just before it commits and keeps it; nothing is written when another run recorded first or in maintenance (breaking the kept-keys rule or the maintenance guard fails it).
- New `tests/aggregate-checkpoint-population-contract.mjs` (4 checks): two reports each safe alone, approved together; the first is sent while the second is between its re-screen and its checkpoint; the second is refused at the checkpoint with nothing sent. Removing the scope line makes it send.
- New `tests/operations-bound-contract.mjs` (5 checks) against the real `rowsForState`.
- `tests/identity-contract.mjs` (19), `tests/send-gate-contract.mjs` (29), `tests/indicator-freshness-contract.mjs` (10), `tests/field-registration-client.mjs` (66), `tests/correction-tasks-contract.mjs` and `tests/r26-correction-propagation-contract.mjs` updated or extended; `tests/data-exit-contract.mjs` follows migration 0016; `tests/safe-logs-contract.mjs` lists the cursor's fixed log message.
- HTTP: `tests/household-visit-smoke.mjs` checks the `viewHousehold` events; new `tests/review-leftovers-smoke.mjs` (run by `tests/api-smoke.mjs`) checks over HTTP that a refused query is recorded with filter names only, that after 20 refused queries in a day the next query is refused with 429, and that the indicator catalogue stays readable.

## Limits

- **Open: the ABHA review throttle can be raced** (review 10, medium-low). Parallel link requests by one requester can each pass the three-a-day check before any review event is written, so a burst learns more than three answers. A bound that holds under races needs the decision and the record in one atomic step (a reservation before the lookup); not built.
- **Open: ledger byte use and population-check cost** (review 9). The differencing ledger and the population check are bounded but not measured at scale.
- The rotation cursor is written after the run; if that write fails, the next run starts from the previous cursor (logged with a fixed message), so an organisation may be visited twice, never skipped.
- The refusal limit counts audit events; parallel refused queries can pass it together, as with the ABHA throttle.
- Built and reviewed by one agent; no independent review.
