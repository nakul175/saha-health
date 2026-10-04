# Development slice 6ae — automatic transfers are all-or-nothing

2 October 2026 (IST). Fix for the one high-severity finding of a tenth independent review (a separate agent that did not write the code) of the round-6 slices 6ab, 1f, 6ac and 3k. Synthetic data only; formal acceptance unchanged.

## What the reviewer found

Slice 1f applies a due scheduled caseload transfer automatically. `applyDueTransfers` (`lib/saha/caseload.ts`) caught a refusal thrown part-way through `applyTransfer`, marked the transfer held and committed the state. Patients already reassigned before the refusal stayed with the receiving worker, with their open work and an assignment entry naming the transfer, while the audit said "Assignments are unchanged". A steward's later apply then failed, and the receiving worker could not acknowledge the move. The reviewer reproduced it with two patients, the second of which already had the maximum 100 assignment-history entries.

## Fix

Each due transfer is now applied to a copy of the organisation state. The copy replaces the live state only if the whole transfer succeeds; a refusal part-way through leaves every patient, follow-up and history entry exactly as before and holds the transfer with the reason. A manual apply was not affected: a refused command is never committed.

## Evidence

- `tests/tenth-review-fixes-contract.mjs` (12 checks, in the CI contract loop): the reviewer's case is held with every patient record byte-for-byte unchanged and no automatic-apply audit event; an applicable transfer is still applied whole with its audit event. On the base (`096f363`) the test fails at the unchanged-records assertion (`tests/evidence/slice-6ae/base-failure.txt`).
- Full suite on the combined source: see the overnight final integration section in `VALIDATION.md`.

## Limits

- Copying the organisation state costs one structured clone per due transfer at application time.
- The other findings of the tenth review are not fixed: the aggregate checkpoint population check builds an empty population from unscoped state (medium); the ABHA review throttle can be raced by parallel requests (medium-low); a due transfer during maintenance makes each request read the full state (low-medium); corrections count as late arrivals in 6ac freshness (low); the field notebook idle timer resets on refused sync steps (low). They are listed in `docs/NEXT-DELIVERY.md` follow-ups through this slice document. Slice 13d ([review leftovers](SLICE-13D-REVIEW-LEFTOVERS.md), on a branch) fixes all of them except the ABHA throttle race.
- Not independently reviewed.
