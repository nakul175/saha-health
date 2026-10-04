# Development slice 13f — fixes from the review of slices 13a–13e

4 October 2026 (IST). Before the "fix all" branches were offered for merge, a separate agent reviewed slices 13a–13e (commit 5505e37d against `main` 7fba6fb5). It had not seen the work. It found seven defects: one high, three medium and three low. This slice fixes all seven. Synthetic data only; formal acceptance unchanged.

## Findings and fixes

1. **High — the cross-site gate could be bypassed by percent-encoding the path** (13a, `lib/saha/cross-site.ts`).
   - The gate tested the raw path for `/api/`, but the router decodes each segment, so a cross-site `GET /%61pi/workspace` reached the workspace read.
   - The decision no longer depends on how the path is spelled. A request another site starts is refused unless it is a plain page navigation (GET or HEAD with `Sec-Fetch-Mode: navigate`) to a path that, once decoded and with dot segments resolved (`routePath`), is not under `/api/`. That includes requests that are not marked as navigations, and paths that cannot be decoded.
   - Exempt server-to-server endpoints match only when written exactly as listed.
2. **Medium — a corrected visit was counted twice in shadow and drift reports** (13c).
   - A confirmed correction is itself eligible for the shadow, so it got its own result while the original was also recompared against it.
   - When the same shadow already holds a result for the visit the chain now ends in, the recomputed original is left out (`currentFields(s, r, shadow)`).
3. **Medium — the indicator refusal limit could lock a manager out of ordinary use** (13d).
   - It counted every withheld result, including those withheld because a definition sets its own higher minimum cohort.
   - Only refusals that protect against differencing now count:
     - a whole refusal;
     - a cohort below 5;
     - results withheld because they would combine with the viewer's recent queries. These are now recorded as their own `indicator refusal` event.
   - The limit message no longer suggests repeating the same filters. It says the catalogue stays available and that a supervisor or owner can help.
4. **Medium — CSV exports bypassed the refusal limit** (13d). A CSV export with results withheld for differencing records the same refusal event as a view, so it counts.
5. **Low — the scheduled rotation cursor could skip organisations or stop moving** (13d).
   - The cursor now moves only to the end of the rotation's processed prefix, in rotation order. Before, an organisation that was due and processed first could move it past members the run had not reached.
   - An organisation in maintenance is no longer queued first as due. Its transfers wait, so it would otherwise lead every queue.
6. **Low — receiving workers and assignees were not checked against the facility, locality and programme policy** (13a). A patient the receiver could not see would drop out of every caseload.
   - `assignPatient` refuses such an assignment (422).
   - A caseload transfer leaves such a patient where they are, with a reason.
7. **Low — the operations document bound could block safety actions once full** (13d). These are never refused by the bound:
   - pausing for maintenance;
   - revoking a purpose grant or a delegation;
   - recording an aggregate send's outcome or lookup.

The reviewer found these areas sound:
- the SQL pre-filter against the JavaScript policy;
- the policy binding;
- the purpose checks;
- the frontline receipt checks and sandboxed reader;
- `persistScheduledRecord`;
- the other 13d changes;
- the 13e indexes and backoff.

## Tests

- `tests/access-scope-contract.mjs`: 13 more cross-site cases, including encoded, upper-case, doubled-slash and dot-segment paths, an undecodable path, an encoded exempt path, a cross-site POST navigation, and cross-site requests to pages that are not navigations. Also `routePath` itself.
- `tests/access-scope-smoke.mjs` (HTTP):
  - encoded API paths are refused cross-site with no patient data;
  - the same encoded path from Saha itself is not refused by the gate;
  - a cross-site link to the workspace still works;
  - an assignment outside the receiver's facility is refused.
- `tests/shadow-recompute-contract.mjs`: a fourth check. With the correction's own result in the shadow, the corrected visit counts once in the shadow and drift reports.
- `tests/scheduled-job-contract.mjs` (37 checks):
  - a due organisation processed first leaves the cursor before the rotation member it did not reach, and the next run reaches that member;
  - an organisation in maintenance is not queued first.
- `tests/operations-bound-contract.mjs` (6 checks): safety actions grow a full document; other actions are still bounded.
- `tests/review-leftovers-smoke.mjs` (HTTP): a definition with its own minimum cohort of 50 withholds its result without counting as a refusal.

## Limits

- The navigation rule relies on `Sec-Fetch-Mode`, which current browsers send. A browser that sends `Sec-Fetch-Site` without it has every cross-site request to Saha refused, links included; one that sends neither header is judged by `Origin` alone, as before.
- Partly withheld results are recorded and counted, but there is no HTTP test that produces a partial differencing withhold. The HTTP checks cover the whole refusal, the cohort refusal and the definition minimum; the partial path rests on code review and type checking.
- The ABHA review throttle race (review 10) and O-2 memory growth remain open, as recorded in slices 13d and 13e.
- These fixes were written by the agent that built 13a–13e, after a separate agent's review. No person has reviewed them.
