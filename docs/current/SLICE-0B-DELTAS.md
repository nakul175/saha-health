# Development slice 0b — partition delta responses

30 September 2026 (IST). Second foundation slice. Synthetic data only; no acceptance status changes.

## What changed

- A command request may carry `x-saha-response: delta`. When the command was loaded as a patient partition (slice 0a), the server answers `{result, delta, partition}` instead of rebuilding the whole permitted organisation snapshot. `delta` carries complete organisation-level fields (membership, teams, connections, readiness, audit page, maintenance) and only the named patients' people, visits, submissions and referrals.
- `lib/saha/delta.ts` merges a delta into the snapshot the client already holds. Patient collections now have an explicit order in every read (people, submissions and referrals by id; visits by creation time then id) so a merged snapshot and a freshly loaded one are identical.
- The workspace UI requests deltas for every command and merges them; it still accepts a full snapshot from uncertified commands and receipt replays. The field notebook and the HTTP test suite keep the full-snapshot contract.

## Evidence

- 27 new HTTP/D1 assertions (`tests/delta-smoke.mjs`) run eight certified commands in sequence (start, save, confirm, referral, consent, prepare, approve and execute a programme plan) and check after each that merging the delta into the previous full snapshot equals a fresh full snapshot. An uncertified command still returns the full snapshot.
- All earlier suites pass unchanged: see `tests/evidence/slice-0b/manifest.json` for the counts and digests.
- Browser check (headless Chromium against the built Worker, synthetic owner): opened a patient, started a visit, saved notes, reloaded and saw the saved notes, recorded weight, confirmed with the patient check. Every command answered with a delta; the confirmed record, weight, notes and next actions displayed correctly; no console errors.
- Load probe with deltas: see `tests/evidence/slice-0b/load-envelope-result.json`.

## Limits

- The initial workspace read still returns every permitted patient (0.8 MB at 1,000 people, 77 MB at 100,000 for a whole-organisation scope). Frontline workers see only their assigned patients, but supervisors and clinicians see whole teams. Paged patient lists and on-demand patient detail remain to be built; the delta merge is the building block for them.
- Uncertified commands still rebuild the whole snapshot.
- Local evidence only; hosted limits untested.
