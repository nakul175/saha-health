# Development slice 0b-3 — paged patient lists and on-demand patient detail

30 September 2026 (IST). Storage slice of the development-completion plan, stacked on the round-2 integration. Synthetic data only; formal acceptance unchanged; NFR-24 remains unverified. No migration.

## What changed

- **Paging is requested by the client and decided by the server.** The workspace sends `x-saha-patients: paged` on its workspace read and on every command. The server pages only when the viewer is not an ASHA and the viewer's permitted scope is larger than 500 people (`PAGED_THRESHOLD` in `lib/saha/patient-directory.ts`). The count uses the slice 0b-2 scope predicate, so owners, supervisors and clinicians are counted over their own teams (and a clinician's current emergency grants); owner authority does not widen it. Below the threshold, for ASHAs, and for any client that does not send the header (the field notebook, API clients and every existing test), the read is exactly as before.
- **A paged workspace holds only opened patients.** The snapshot then carries `patientPaging: {total, threshold, window}` and its people, visits, submissions and referrals are limited to the patients the client names in `x-saha-patient-window` (at most 50 ids), after the server keeps only those inside the viewer's scope. Organisation-level fields are unchanged. The read uses a new windowed mode of `readState` (exact ids, possibly none, read-only, not a command partition).
- **`GET /api/patients`** returns one page of the viewer's permitted patients (default 50, at most 100) ordered by name then id with a keyset cursor, searchable by name, village or record id and filterable by programme. Scope is the same SQL predicate as the scoped workspace read and every row is checked again with `access.ts`. Rows carry summary fields only (name, age, sex, village, programmes, task, due, status, team, assignee, merged and emergency-access flags); the first page also returns the filtered total.
- **`GET /api/patients/detail?personId=`** returns the patient partition snapshot for one permitted patient in the same shape as a slice 0b command delta (`{delta, partition}`); the workspace merges it with `mergeDelta`. An unknown id and an out-of-scope id return the same 404.
- **Workspace.** In paged mode the People page shows a server-paged directory (search, programme filter, Load more) and opening a row loads that record on demand; it then stays in the window, so later command answers keep it current. Operations links and `/?patient=` deep links load the record the same way. My work shows a notice that it covers only opened records and points to People and to the action plan and exception queue, which are computed on the server over the whole scope. `mergeDelta` keeps `patientPaging` and adds merged patients to the window.
- **Probe.** `tests/load-envelope.mjs` with `SAHA_LOAD_SUPERVISOR=1` also measures a supervisor of the whole team: full workspace, paged workspace (empty and with 10 opened), first list page, a search and one detail.

## Evidence

- 53 contract assertions (`tests/patient-directory-contract.mjs`) against the real migrations, in-memory SQLite: for nine viewers across two teams (owner, two ASHAs, supervisors of one and both teams, clinicians of each team, an administrator and a suspended clinician), walking the list in pages of three returns exactly the patients the full read plus `access.ts` shows, in name then id order with duplicate names, including a clinician's current emergency grant (flagged) and not an expired, closed or ASHA grant; search by name, village and id and the programme filter stay inside scope; nobody is paged at or below 500 people; after 500 more people in one team, that team's owner, clinician and the all-teams supervisor are paged with exact totals and only in-scope window ids, while ASHAs, the other team's viewers, the administrator and the suspended member are not; a 509-person walk in pages of 100 is complete and unique; the windowed read holds exactly the named patients or none, is read-only and cannot be persisted; header, cursor, limit and id parsing; `mergeDelta` keeps paging, extends and trims the window, and adds nothing to an unpaged snapshot.
- 94 HTTP/D1 assertions (`tests/patient-directory-smoke.mjs`), in a separate synthetic organisation with 560 people in team A and 40 in team B: a paging supervisor, clinician and owner of team A receive `patientPaging` and no patient records, while the same supervisor without the header receives all 560 and never team B; the ASHA keeps her 20; a window keeps only the in-scope id and returns its visit; more than 50 or malformed window ids are refused; the list walks 12 pages to 560 unique team-A people in name order; search by name, village and id, out-of-scope names, the programme filter, the ASHA's list, the administrator's empty list, a non-member (403) and bad cursor or search input (400); detail for a permitted patient in delta shape, the same 404 for an out-of-scope and an unknown id, 404 for the administrator and for an ASHA's unassigned patient; a clinician's emergency grant on a team-B patient appears in that clinician's list and detail only; a command from a paging client answers with a paged snapshot holding the window and the new visit, and a delta request still answers with the partition.
- Local read-only probe, same machine and same run, supervisor of the whole team (`SAHA_LOAD_SUPERVISOR=1`, median of three reads). "Full" is the unchanged read that clients without the header still receive:

| People in organisation | Full workspace | Paged workspace | Paged, 10 opened | First list page | Search (50 rows) | One patient detail |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,006 | 57 ms, 791 KB | 35 ms, 5 KB | 36 ms, 13 KB | 30 ms, 16 KB | 29 ms (11 rows) | 27 ms, 5 KB |
| 5,006 | 192 ms, 3.9 MB | 36 ms, 5 KB | 32 ms, 14 KB | 29 ms, 16 KB | 48 ms | 25 ms, 6 KB |
| 20,006 | 749 ms, 15.4 MB | 39 ms, 5 KB | 31 ms, 14 KB | 27 ms, 16 KB | 73 ms | 22 ms, 6 KB |
| 50,006 | 1,905 ms, 38.6 MB | 34 ms, 5 KB | 33 ms, 15 KB | 38 ms, 16 KB | 149 ms | 18 ms, 6 KB |

  Search time grows with the scope because it scans the scoped rows (see Limits). The ASHA read stayed at 31–42 ms and 43 KB. Report: `tests/evidence/slice-0b3/load-envelope-0b3.json`.
- Browser check (headless Chromium, built Worker, synthetic owner with 606 people in scope): the workspace read was 4.5 KB; My work showed the paged notice; People showed 50 rows, 100 after Load more, and one row for a search; opening it loaded the record (4.8 KB detail) with its banner; starting a visit from it answered 200 and kept the record open; axe-core found no violations in the directory; no console errors. `tests/evidence/slice-0b3/0b3-browser-check.json`.
- All suites: see `VALIDATION.md` and `tests/evidence/slice-0b3/`.

## Limits

- Browser-computed views in paged mode (My work statistics and follow-up list, Submissions, the referral tracker, AI tools lists, activity counts by patient) cover only opened records. Server-computed queues (action plan, exception queue, referral escalations, alerts, worker activity, indicators) are unaffected. Moving those views to server pages is not done.
- The threshold is a fixed constant, not configuration, and was chosen from this local probe, not from a device or hosted measurement.
- Search is a case-insensitive substring match on name, village and record id over the scoped rows; there is no index on names or villages, so a search scans the viewer's scope. Name order is binary (SQLite default), not locale-aware.
- The window is limited to 50 opened records per session; older ones fall out of the workspace and are loaded again when reopened.
- Commands still load their patient partition or the whole organisation as before; only reads and command answers are paged. Organisation-wide commands in large organisations (slice 0a) are unchanged.
- Local probe only: hosted D1 latency, Worker CPU and memory limits, concurrent sessions and reference devices were not tested. NFR-24 stays unverified.

## Follow-up (same day, after slice 3j)

- Found on review, not by a test: a command sent with a malformed `x-saha-patient-window` header (more than 50 or invalid ids) was applied and committed, and only the snapshot built afterwards refused the header with 400, so the client was told the command failed. The header is now checked before the command runs (`command` in `lib/saha/server.ts`), and the workspace only sends ids in the accepted form. The patient-directory smoke now sends a command with 51 window ids and checks the 400 and that no visit was started.

## Correction — 30 September 2026 (slice 6q)

A second independent review found that this slice put patient names in URLs: the next-page cursor was `JSON.stringify([name, id])` and the panel sent the cursor and the search text `q` as GET query parameters, against the slice 6l safe-logs rule. Slice 6q makes the cursor opaque and name-free (`after:<patient id>`, resolved inside the viewer's scope on the server), moves search text to a POST body (`POST /api/patients`; GET refuses `q`), and extends the 6l static check. See [SLICE-6Q-SECOND-REVIEW-FIXES.md](SLICE-6Q-SECOND-REVIEW-FIXES.md). The text above is kept as written.

## Follow-up — 1 October 2026 (slice 0b-4)

The first limit above is closed for My work (statistics, visit list and follow-ups), the referral tracker and Submissions: in a paged workspace they are now built on the server over the whole scope (`GET /api/worklists`), with the same order and counts as the unpaged workspace, and the My work notice about opened records is replaced. AI tools lists and activity counts by patient still cover only opened records. See [SLICE-0B4-SERVER-WORKLISTS.md](SLICE-0B4-SERVER-WORKLISTS.md). The text above is kept as written.

## Correction — 1 October 2026 (slice 6w)

The opened-patient window returned full records on every workspace read without an access event for records not opened through `/api/patients/detail`. Slice 6w records a `viewPatientRecord` access for such window records (once per viewer and patient in 12 hours) before they are returned. Found by a fifth independent review (an agent that did not write the code) of round-1 slices 0b-4, 4e, 6s and 6t; the original text above is kept. See [slice 6w](SLICE-6W-FIFTH-REVIEW-FIXES.md).
