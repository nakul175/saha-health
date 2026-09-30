# Development slice 6c — retention schedules, holds and eligibility review

30 September 2026 (IST). Third part of slice 6. Synthetic data only; formal acceptance unchanged. Nothing is deleted: the repository rules require confirmed records, revisions, audit and receipts to be preserved, and restore-safe disposal needs an approved policy first.

## What changed

- **Schedules.** `retentionPolicySet` (owners) records how many years (1–50) to keep each record class: patient records (from last registration or visit activity), programme receipts (from last update), audit events (from the event), outreach messages (from creation), closed rights requests (from closure) and field packages (from creation). Each save is a new numbered version with its basis; earlier versions are kept.
- **Holds.** `retentionHoldPlace` puts a hold on one patient (the owner needs care access to that patient) or on the whole organisation, with a reason and reference; `retentionHoldRelease` releases it with a reason. One current hold per patient and one organisation hold at a time.
- **Review.** `GET /api/retention` (owners) shows, per class, how many records exist, how many are past the schedule, how many of those are held and how many would be eligible. A patient hold covers that patient's linked records; an organisation hold makes nothing eligible. Counts only; no record list and no disposal action.
- **Storage.** Migration `0011_retention.sql` adds a one-row-per-organisation `retention` table.
- **Workspace.** The Organisation page gains "Retention and holds" for owners.

## Evidence

- 27 new HTTP/D1 assertions (`tests/retention-smoke.mjs`): owner-only review and changes; invalid year and short basis refused; an old synthetic audit event counted as eligible; patient and organisation holds, duplicates refused, organisation hold zeroing eligibility, release rules; patient, visit and submission counts unchanged and revisions never reduced; audit events for every change.
- 11 contract assertions (`tests/retention-contract.mjs`) cover authority, schema limits, the no-schedule state, per-class dating including recent visit activity keeping a patient, closed-only rights requests, patient and organisation holds, release, versioning and that no in-memory record is removed.
- Browser check (headless Chromium, built Worker, synthetic owner): saved an eight-year schedule for all classes and placed an organisation hold from the Organisation page. No console errors.
- All suites: 1,258 HTTP/D1, 541 contract/checkpoint and 21 restore assertions (30 SQLite tables). Reports in `tests/evidence/slice-6c/`.

## Limits

- No disposal, tombstones or restore-safe deletion. Backups and exports are outside the review.
- Record classes and triggers are fixed defaults, not an approved records schedule. Revisions, visits, plans and AI results follow their patient record rather than having their own schedules.
- The review loads the whole organisation for owners; it is a periodic governance check, not a routine screen.
