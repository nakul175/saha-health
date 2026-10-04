# Development slice 14e — field device reports, removal of device copies and withdrawal notices to destinations

4 October 2026 (IST). Remaining-work rows R73 ("Device-side sync failures reported to the server; offline device copies removed on consent withdrawal") and R91 ("Destination notification of withdrawal with recorded outcomes", merged into R73 by the generous grouping); BR-REP-01 and BR-SEC-03, with BR-OFF-07. Built on slices 3a–3k (field notebook), 1b (field packages revoked on transfer), 6b (processing restriction), 6i (exception queue) and 6o (consent withdrawal). Synthetic data only; formal acceptance unchanged. Migration `0020_field_device`.

## What changed

### 1. The field notebook reports its sync failures

- The notebook counts its own failed sync steps on the device: the step (loading the workspace, a registration, a visit draft, a photo or voice note), an error class (for example `network`, `conflict`, `invalid`, `unconfirmed`, `grant-expired`, `device-copy-damaged`), the field grant id when there is one, a count, and the first and last time. Nothing else: no patient name, no record content, no free text.
- When the notebook is next online (after "Load online workspace" and at the end of every "Sync all") it sends the counts with its version (`POST /api/field-device`, kind `sync-failures`, at most 20 entries, counts up to 10,000, times within the last 30 days).
  - The server checks that each grant belongs to the reporting worker, resolves it to the patient itself (for scope), stores one row per entry in `field_sync_reports` and writes one audit event per report. The event is written like an access-audit commit, so a report never makes a teammate's command conflict.
  - Only ASHAs and clinicians report; a worker adds at most 200 rows a day (429 beyond, and the notebook keeps its counts).
  - A report keeps its key until Saha answers, so a lost answer is resent with the same key and stored once. A refused report is dropped so it never blocks the notebook.
- Supervisors (their teams' workers and their care scope) and owners and administrators (the organisation) see the reports on the Operations page, in a new "Field devices" panel, with the recovery action for each error class. A report for a grant that is still open is also a row in the exception queue, owned by the worker.

### 2. Copies on a worker's device are removed when authority ends

- A copy a field grant put on a worker's device is **due for removal** when:
  - the grant was revoked (`revokeFieldLease`; the order is stored on the grant). Revoking now also works on a grant that already ended (synced, or replaced by a handover), for example for a lost device;
  - the worker no longer has access to the patient: care transferred, team or membership changed, member suspended, emergency access ended;
  - the record was merged into another record;
  - processing is restricted under a rights request (slice 6b) and the grant can no longer sync (synced, revoked or expired). An open, current grant may still sync first, because recording care continues under a restriction. While a restriction is in force, `prepareFieldVisit` is refused: no new copy goes to a device.
- The last three are computed from the current record on every read (`removalDue` in `lib/saha/field.ts`), so every transfer, merge, suspension and restriction path is covered without changing those paths.
- When the notebook contacts Saha it asks for its orders (`GET /api/field-device`). It gets only its own worker's grants, with patient ids and no names. It removes the drafts the orders name, their queued photos and voice notes, and synced registration copies of those patients. A person-wide order (access ended, record merged) covers every copy of that patient in that organisation, including drafts of grants no longer on the record.
- It then confirms each removal with a receipt (`POST /api/field-device`, kind `removal-receipt`): counts only — drafts, of which not synced, media items, registration copies — and its version.
  - The server stores the first receipt on each grant it covers, and on the field registration. It writes one audit event, which says when unsynced observations were discarded. The grant can no longer sync.
  - The receipt is replayed by its key. A receipt for anything not due is refused (409) and nothing is recorded.
  - A worker whose access ended can still confirm removal of their own copies; nothing about the record is returned to them.
- The notebook tells the worker what was removed and why, and keeps a 7-day log of counts. When unsynced drafts were removed it asks the worker to tell their supervisor what they held, because they cannot be recovered.
- Grants that expired while their copy is still awaiting removal stay on the record (at most 50 per patient), so the order still reaches the notebook and the pending removal stays visible.
- The "Field devices" panel lists copies awaiting removal and copies removed in the last 30 days: grant, worker, patient (only where the viewer's care scope includes them), reason, due since and the receipt. Copies awaiting removal are also exception-queue rows.
- **A device that never contacts Saha again keeps its encrypted copy.** Its grants stay "awaiting the device" and are listed as pending; Saha cannot erase a disconnected browser.

### 3. Consent withdrawals list device copies and notify destinations

- **Device copies are listed.** Withdrawing AI or sharing permission now lists each open field grant in the withdrawal's downstream record (kind `field-copy`, disposition kept). A grant binds the permission version, so that copy cannot sync until the worker compares it and renews the grant. It holds care observations only and the device neither shares it nor sends it for AI, so it is kept, not removed.
- **One notice per destination.** Withdrawing the sharing permission creates a notice (`lib/saha/withdrawal-notices.ts`) for each destination that holds or may hold the person's records:
  - a programme destination with an accepted, sending or uncertain submission;
  - an EHR connection with an accepted, running or uncertain publication;
  - the mock ABDM gateway when consents were revoked, care contexts are linked or records were delivered.
  The notice carries the destination's delivery keys and receipts, the withdrawal time and the permission version. No record content and no name.
- **Each notice follows the destination's own path:**
  - *Demonstration programme destinations.* A care worker with normal access sends the stored message, quoting the notice version they reviewed. The maternal register acknowledges with its own receipt (`SIM-N-…`). The community MIS stores the notice but loses its response, so the notice is uncertain and only a receipt lookup resolves it (gated by the destination's `lookup` operation). It is never sent a second time, and an uncertain notice cannot be closed by hand.
  - *Mock ABDM gateway.* The revocation is recorded with the mock consent manager when the gateway's `delete` operation is permitted, as `abdmConsentRevoke` does; no ABDM service is contacted in this release. Otherwise the notice is manual.
  - *HTTP programme connections and EHR connections.* This release has no consent-withdrawal message for them. The notice is manual: a care worker tells the destination through its own process and records how, with a reference and a note.
  - Any notice not yet sent, or manual, can be closed as not required, with a reference and a reason.
- **Later withdrawals.** A later withdrawal brings an open notice up to date instead of adding a second one. Its version moves, so an earlier review no longer sends. A closed or uncertain notice stays, and a new one covers the destination.
- **Where notices are shown.**
  - The patient's record tools show "Withdrawal notices" with each notice's state, holdings, receipt or recorded outcome, and the actions (English only).
  - Open notices are exception-queue rows; an uncertain one is high severity.
- **Commands.** `sendWithdrawalNotice`, `lookupWithdrawalNotice` and `recordWithdrawalNotice` are certified patient commands: they load and commit one patient. They need an ASHA or clinician with normal access to the patient. Supervisors, administrators, owners outside the team and emergency-only access are refused; the patient-scope check also runs on a replay.
- **Not guarded on purpose.** A notice sends no record content, so a processing restriction, a purpose grant or the destination's create, update or delete setting does not stop it. Telling a destination about a withdrawal must not depend on them.

### Seam for slice 14c (draft PR #155)

- Slice 14c adds withdrawal (void) of accepted submissions and EHR publications through prepare, approve, execute and lookup, with a checkpointed external request (`lib/saha/withdrawal-execution.ts`). This slice does not duplicate that execution: it makes no external request, and its simulator answers in process.
- `noticePath` in `lib/saha/withdrawal-notices.ts` is the one switch. When 14c is merged, HTTP programme connections and EHR connections should send this notice through 14c's execution as a further operation, instead of the manual path:
  - for programme connections, `saha-mis-v1` operation `consent-withdrawn`, the payload this slice already builds;
  - for EHR connections, a notice document like 14c's withdrawal notice, with a consent reason;
  - in both cases gated by the destination's operation setting.
- A consent notice is not a void: the destination keeps its copy under its own retention rules and is told that nothing more will be sent. 14c's withdrawal binds the sharing-permission version, so a withdrawal prepared before a consent withdrawal must be prepared again, which is consistent.

### Other changes

- Exception queue rules 1.4.0 add the kinds `field-copy-removal`, `field-sync-failure` and `withdrawal-notice`. The in-app "exception items" notification counts the rows computed from the record; sync failure rows need the stored reports and appear only in the queue itself.
- Data exit exports `field_sync_reports` (33 tables with member accounts, was 32) without the server-resolved patient id; `SCHEMA_MIGRATION` is `0020_field_device`.
- Route: `GET` and `POST /api/field-device` (two method handlers). Four certified patient commands (`confirmFieldRemoval` is route-only).

## Tests

- `tests/field-device-contract.mjs` (99 checks; the real modules, every `lib/saha` module transpiled, in-memory state):
  - when a copy is due: a current grant (not due), care transferred (the ASHA's copies due, the team clinician's not), a suspended member, a restriction (an open current grant not due, a synced or expired one due), a lifted restriction, a merge and an unmerge, a stored order and its confirmation;
  - revocation orders removal, a second order and an order after a confirmed removal refused, an ended grant given an order, another worker refused; preparing refused while restricted; expired grants awaiting removal kept and bounded at 50;
  - removal orders: only the worker's own grants, grant-wide and person-wide orders with the registration copy, no names;
  - receipts: schema refusals (extra field, unsynced above drafts, a lease id that is not a uuid); refusals for an unknown patient, a grant not ordered, a registration not ordered, another worker and an empty receipt, with nothing recorded; the first receipt stored, a second counted without replacing it; the audit text; an open grant revoked once its copy is gone;
  - sync failure reports: ten schema refusals (free text, unknown class or step, bounds, version format); another worker's or an unknown grant; the time window; rows with the server-resolved patient and no name;
  - the Operations view: refused for an ASHA and a clinician; the team supervisor, the other team's supervisor and an administrator each see only their rows, the administrator without patients;
  - exception rows (rules 1.4.0) with and without reports;
  - an AI withdrawal lists the device copy and the grant then cannot sync; a sharing withdrawal with nothing shared creates no notice;
  - notices: one per destination with the right path and state, holdings of this person only, the payload without content or names; refusals for a supervisor, an administrator, a clinician and an owner outside the team, an unassigned ASHA, a stale version, an extra field, an unknown notice, a manual destination and recording "told" for a simulator; the maternal register's receipt, a second send refused; the community MIS uncertain, a second send and closing by hand refused, the lookup's receipt with one attempt, a second lookup refused; manual notices recorded with reference and note, schema refusals, a second outcome refused; exception rows open and cleared; later withdrawals updating an open notice (its version moves, the old version refused) and adding new ones; the gateway manual when its delete operation is withdrawn; a lookup refused when the lookup operation is withdrawn; the certified commands.
  - Two deliberate mutations (the access rule removed; a second send of an uncertain notice allowed) each failed the suite.
- `tests/field-device-client.mjs` (26 checks; `public/field/app.js` in Node with real Web Crypto and injected storage and network):
  - the failure tally by step, class and grant, counted rather than repeated, with no names;
  - the report kept with its key after a 503 and resent unchanged, cleared on success, dropped when refused, held for its own organisation;
  - a grant order removing that draft and its sealed photo only; a person-wide order removing every copy of the patient in that organisation and the registration copy, not another organisation's;
  - receipts with their counts, kept after a 503 and resent with the same key, none for a confirmed order with nothing on the device;
  - Sync all contacting each organisation and saying what was removed; a failed contact changing nothing;
  - every report and receipt valid for the server's schemas.
  - Removing the media sweep (a deliberate mutation) failed the suite.
- `tests/field-device-smoke.mjs` (123 HTTP/D1 assertions, in its own organisation):
  - reports stored with one chained audit event and replayed by key; another worker's grant, a supervisor, an administrator, a stranger, an extra field, free text, a bad key, a cross-site request and a wrong content type refused, with nothing stored;
  - the exception row for an open grant;
  - revocation, the worker's order and no order for another worker; the Operations view for a supervisor (patient named) and an administrator (no patient), recorded as a read;
  - the receipt, its replay, a reused key with another body, refusals, the stored receipt and audit event, and the queue row cleared;
  - a care handover making the old worker's copies due without a stored order, the old worker refused a sync and still confirming removal;
  - a restriction refusing a new grant, an open grant not due, then due once revoked;
  - notices to both demonstration simulators after a sharing withdrawal: refusals for a supervisor, an administrator, a stranger, an unassigned ASHA and a stale version; the maternal register's receipt and its replay; the community MIS uncertain, then looked up; exception rows; the audit events.
- Browser check (a one-off Playwright script with the bundled Chromium against a built local Worker; not a repository suite; 14 steps; `tests/evidence/slice-14e/browser-check.json`):
  - the field notebook in a real browser prepared a draft;
  - after the grant was revoked online, its sync was refused and counted;
  - "Load online workspace" removed the draft and showed what was removed, and the server held the receipt and the report;
  - the owner's Field devices panel showed both;
  - the Withdrawal notices dialog sent to the maternal register (acknowledged), sent to the community MIS (unknown, only a lookup offered) and looked it up;
  - axe found no serious or critical violations in the panel or the dialog. The one console error was the 409 of the sync the check provoked on purpose.
- Existing tests changed:
  - 93 module lists in older contract suites gain `field-device` and `withdrawal-notices`, because `consent.ts` and `exceptions.ts` import them.
  - Eight suites expect exception rules 1.4.0 (were 1.3.0).
  - `tests/data-exit-contract.mjs` expects 33 tables (was 32).
  - `tests/field-registration-client.mjs` leaves the new device contact out of its call order.
  - `tests/nfr/authorisation-matrix.mjs` classifies `GET /api/field-device` (bare and `?view=operations`).
  - `tests/regression-baseline.json`: the two new unit suites added; the HTTP suite raised from 4,758 to 4,881.
- All suites (4 October 2026, built Worker, Node 22.22.2, Linux container shared with other agents, ports 8850–8853), recorded in [VALIDATION.md](../../VALIDATION.md):
  - unit 132 suites, 8,169 checks;
  - HTTP/D1 4,881 and the scheduled check 8;
  - restore drill 21;
  - smoke 36 passed, 1 skipped;
  - security 80 (authorisation matrix 51, identity hardening 29).
- The first full HTTP run stopped in the new module: the test used a stale patient version after the receipt (a route, so the test's workspace was not refreshed). The test now reloads the workspace; the run above is the rerun. Reports are in `tests/evidence/slice-14e/`.

## Limits

- **No permission for device copies as such.** Saha's permissions are AI, sharing and contact. A person who asks for their record not to be carried on worker devices is recorded as a processing-restriction request (slice 6b). When fulfilled, it stops new field grants and orders removal of copies that can no longer sync. It also pauses sharing, AI and reminders, as before; there is no narrower "devices only" decision.
- **Removal reaches only a notebook that contacts Saha.**
  - A device that never reconnects keeps its encrypted copy until the notebook is deleted on it, and stays pending.
  - A suspended or removed worker cannot sign in, so their notebook cannot fetch orders.
  - Saha does not register devices. A receipt means one notebook of that worker confirmed; another browser of the same worker removes its copy when it contacts Saha, while orders stay in force.
- **Unsynced observations under an order are discarded.** That happens when access ended, the grant was revoked or the record was merged. The receipt counts them, the audit event and panel say so, and the worker is asked to tell their supervisor. Their content cannot be recovered. A grant under a processing restriction may still sync first.
- **Sync failure reports are counts only.** They are sent when the notebook is next online; failures on a device that never reconnects are never reported. The device clock sets the times. There is no assignment of a report from the queue, and no notification of individual reports.
- **Notices are real only for the demonstration simulators.** The `consent-withdrawn` message is Saha's proposal, not a partner specification. HTTP programme connections and EHR connections get manual notices until the slice 14c seam is used. ABDM is the local mock, and linked care contexts cannot be unlinked.
- **What is not notified.** AI providers that received a request are not notified; external AI is disabled in this build. Contact withdrawal has no destination beyond the reminder simulator.
- **Grants from before this slice.** Copies that are already due, for example after an earlier care handover, appear as pending as soon as this build runs, until each worker's notebook contacts Saha.
- **Maintenance.** Reports and receipts are accepted during maintenance (`/api/field-device` does not check it). The notice commands are not among the commands allowed during maintenance, so a lookup waits until the organisation resumes. `maintenanceAllows` is changed by slice 14c and was left alone to avoid a conflict.
- **Language.** The record-tools panel and the Operations panel are English only. The notebook's new messages have draft Hindi beside the English, not reviewed by a native speaker.
- **Review.** Built by one agent; no independent review. No person has reviewed the code or the tests.
