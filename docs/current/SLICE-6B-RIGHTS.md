# Development slice 6b — rights and grievance requests

30 September 2026 (IST). Second part of slice 6. Synthetic data only; formal acceptance unchanged. No legal review has been done; the kinds, due period and outcomes are local defaults for an organisation to replace with its approved policy.

## What changed

- **Intake.** `rightsCreate` records a request against one patient: access to records, correction, restriction of processing, deletion or grievance; how it was received (in person, phone, written); who asked (the patient, or a representative who must hold a current proxy grant recorded on the patient in slice 1); what identity check was done; and what was asked. Any care-team member with access to the patient can record one. It is due 30 days after receipt and owned by whoever recorded it. At most 10 open requests per patient.
- **Destinations.** For correction, restriction and deletion requests, every programme destination holding an accepted or uncertain submission and every EHR that received an accepted or uncertain publication becomes an item. `rightsItemResolve` records each as notified or not required, with a note. A request cannot be closed as fulfilled or partly fulfilled while an item is open.
- **Assignment and closure.** `rightsAssign` (supervisor or owner of the patient's team) names an owner with care access. `rightsClose` (the owner, or a supervisor or owner of the team) records fulfilled, partly fulfilled, refused or withdrawn, the response given and an evidence reference; closing after the due date is recorded as late.
- **Restriction.** Closing a restriction request as fulfilled puts a processing restriction on the patient: plan preparation and approval, external sharing, programme sending, EHR publishing, reminders and optional AI are refused until `rightsRestrictionLift` lifts it with a reason. Recording care continues.
- **Deletion.** Saha does not delete clinical records. A deletion request is answered and closed with what can and cannot be removed; retention and disposal (BR-SEC-09) are not built.
- **Storage and reads.** Migration `0010_rights_requests.sql` adds `rights_requests`. `GET /api/rights?personId=` loads one patient; `GET /api/rights` lists open requests in the viewer's scope, earliest due first.
- **Workspace.** A "Rights requests" dialog on the patient page records and works requests; the Care handover page lists open requests with overdue counts; a notice marks restricted patients.

## Evidence

- 46 new HTTP/D1 assertions (`tests/rights-smoke.mjs`): admin and out-of-scope refusals; representative requests needing a current proxy grant; due date; per-patient and queue views by role; assignment rules; closure by the owner, stale version and double closure; a fulfilled restriction blocking plan preparation and AI with a restriction message, lifting refused to a worker and allowed to the owner, and plans no longer blocked by it; stored request states and audit events.
- 17 contract assertions (`tests/rights-contract.mjs`) cover eligibility, revoked and missing proxy grants, destination items from accepted and uncertain outputs only, assignment to eligible owners only, the open-destination closure rule, late closure, restriction guard coverage, lifting rules, views and the per-patient cap.
- Browser check (headless Chromium, built Worker, synthetic owner): recorded a restriction request, closed it as fulfilled, and the patient page showed the restriction notice. No console errors.
- All suites: 1,231 HTTP/D1, 503 contract/checkpoint and 21 restore assertions (29 SQLite tables). Reports in `tests/evidence/slice-6b/`.

## Limits

- No verified requester portal, notification or letter templates; staff record requests received elsewhere.
- Access requests are fulfilled outside Saha (the existing record views and export); there is no packaged copy-of-record export.
- Due period, kinds and outcomes are not jurisdiction-reviewed. Grievance escalation and appeal are not modelled.
- Restriction pauses the listed actions only; it does not yet stop field packages or reports that include the patient.
