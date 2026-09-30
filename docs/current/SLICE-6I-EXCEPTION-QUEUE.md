# Development slice 6i — item-level exception queue

30 September 2026 (IST). Builds on slices 6g and 4b. Synthetic data only; formal acceptance unchanged.

## What changed

- **Queue.** `lib/saha/exceptions.ts` (rules 1.0.0) lists each exception as its own row, computed on every read from the records that hold it: programme submissions whose outcome is unknown, retryable or rejected (a rejection drops out once a later submission to the same destination exists for that visit); EHR publications that are uncertain or still running after 10 minutes; referrals escalated under the slice 4a rules; overdue programme follow-ups; identities kept provisional at registration; field grants that expired without a sync; received ABDM records awaiting review; the latest protocol evaluation of a visit with findings and no clinician decision; open clinical safety cases; and emergency access that ended without the team's review.
- **Each row** gives the patient, what is wrong, since when and for how many days, who owns it (a named person when one has current access, otherwise the responsible team role), the recovery action, and a link that opens the patient, and the visit when there is one. Rows are ordered by severity, then oldest first.
- **Scope.** Supervisors see rows for patients in their teams. Owners see their teams' rows, and delivery rows (submissions and EHR publications) for other patients without patient details or links. Administrators see only those redacted delivery rows. Care workers and members without reporting access are refused, as on the Operations page.
- **Route and screen.** `GET /api/exceptions`. The Operations page gains an Exception queue section above the tabs, with a filter per kind. A row link opens the record inside the workspace; the same link, `/?patient=<id>&visit=<id>`, opens the record when loaded directly, and is cleared from the address bar afterwards. A link to a record outside the viewer's workspace shows a notice and opens nothing.

## Evidence

- 7 contract checks (`tests/exceptions-contract.mjs`): all ten kinds found and resolved, reviewed, fresh, accepted, superseded and other-team items excluded; severity then age ordering; row content, owners, recovery text and link format; administrator rows limited to delivery kinds with no patient names anywhere in the response; an owner's redacted row for a patient outside their teams; a second team's supervisor seeing only that team; refusals for an ASHA, a clinician and a suspended supervisor.
- 25 HTTP/D1 assertions (`tests/exceptions-smoke.mjs`): an overdue urgent referral and an overdue follow-up listed for the supervisor with patient, age, owner, recovery action and links; administrator rows without patient details; refusals for an ASHA, a clinician and a stranger; both rows cleared after a reasoned referral delay and completion of the follow-up.
- While building this slice, the slice 4b HTTP checks for the administrator were found to pass because an earlier module leaves the administrator suspended. The action-plan module now reactivates the administrator first (2 more assertions); its refusals still hold, now for the role.
- Browser check (headless Chromium, built Worker, synthetic owner): the queue listed an overdue referral with owner and recovery action; the kind filter worked; the row link opened the patient's visit; a direct link opened the same record and was cleared from the address bar; a link to an unknown record opened nothing and showed a notice. No console errors. `tests/evidence/slice-6i/browser-exception-queue.json`.
- All suites: see [VALIDATION.md](../../VALIDATION.md). Reports in `tests/evidence/slice-6i/`.

## Limits

- Rows cannot be assigned from the queue. Follow-ups and referrals are assigned from the patient's action plan (slice 4b); other kinds through their own screens.
- Sync problems are those the server knows about (expired, unsynced grants). Failures that stay on a device are not reported.
- Nothing is pushed to anyone; the queue is seen when someone opens Operations. Links reach the patient and visit, not a trace of provider calls and destination receipts.
