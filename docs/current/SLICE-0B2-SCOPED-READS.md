# Development slice 0b-2 — viewer-scoped workspace reads

30 September 2026 (IST). Storage slice of the development-completion plan. Synthetic data only; formal acceptance unchanged; NFR-24 remains unverified.

## What changed

- **Reads follow access.** A workspace read (and the snapshot returned after a command) now loads only the patients the viewer may see, selected in SQL: the viewer's teams, only assigned patients for an ASHA, and patients under a current emergency-access grant for a clinician. Their visits, plans, AI results, submissions and referrals are loaded through the same selection. Households, caseload transfers, identity cases, rights requests and the recent-audit window, which the workspace snapshot does not show, are not loaded for it.
- **No change for whole-organisation viewers.** When a viewer belongs to every team and is not an ASHA, the plain organisation read is used, so owners and supervisors of single-team organisations read exactly as before.
- **Selection mirrors `access.ts`.** `viewerScope` in `lib/saha/store.ts` builds the predicate from the viewer's membership and team rows (one batched round trip) and uses the existing `(org_id, assigned_to)` and `(org_id, team_id)` indexes. The emergency-access branch is added only for clinicians.
- **Read-only.** A state read for one viewer carries `readOnlyFor` and `persist` refuses it. Commands still load either their patient partition or the whole organisation, as before.
- **Probe.** `tests/load-envelope.mjs` now also reads as an ASHA assigned 50 people at every size and accepts a release label.

## Evidence

- 27 contract assertions (`tests/scoped-read-contract.mjs`) against the real migrations: for seven viewers across two teams (owner, two ASHAs, supervisor, two clinicians, a supervisor of both teams) the scoped read returns exactly the patients, visits with plans and AI results, submissions and referrals that the full read plus `access.ts` shows; current, expired and closed emergency grants and an ASHA grant behave as `access.ts` does; admin and suspended members see nothing; the all-teams viewer uses the plain read; partitions ignore the viewer; a scoped state cannot be persisted.
- The full HTTP/D1 suite (1,231 assertions) passes unchanged with every workspace read and post-command snapshot scoped, including the slice 0b check that partition deltas equal fresh snapshots.
- Local read-only probe, same machine, previous code (slice 6b head) against this slice, median of three reads:

| People in organisation | ASHA read before | ASHA read after | Owner read before | Owner read after |
| ---: | ---: | ---: | ---: | ---: |
| 1,006 | 40 ms | 32 ms | 49 ms | 64 ms |
| 5,006 | 113 ms | 27 ms | 195 ms | 188 ms |
| 20,006 | 405 ms | 31 ms | 668 ms | 691 ms |
| 50,006 | 965 ms | 48 ms | 1,743 ms | 1,738 ms |

  The ASHA response was 42 KB for 50 people throughout. Reports: `tests/evidence/slice-0b2/load-envelope-before.json` and `load-envelope-after.json`.
- Browser check (headless Chromium, built Worker): owner and a newly joined ASHA loaded their workspaces and completed a caseload transfer and acknowledgement. No console errors.
- All suites: 1,231 HTTP/D1, 530 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-0b2/`.

## Limits

- A clinician or supervisor whose team holds most of the organisation still reads the whole team: 38 MB and about 1.7 seconds at 50,000 people in this probe. Paged lists and on-demand patient detail for large team scopes remain to be built.
- A clinician's read scans out-of-team patient rows for emergency-access grants with a string test before parsing JSON; this was not measured separately at scale.
- Local probe only; hosted D1 latency, Worker limits and concurrent sessions were not tested.
