# Data-subject request procedure

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: an approved policy, a first real request, or a change to the rights workflow.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** Frameworks referenced only: DPDP Act 2023 (rights of access, correction, erasure, grievance redressal) and GDPR Chapter III. Legal deadlines and interpretation are not stated here; support staff must not invent them ([Support guide](../current/SUPPORT-GUIDE.md)).

Since all data is synthetic, this procedure has never been used for a real person.

## What the software provides ([slice 6b](../current/SLICE-6B-RIGHTS.md))

- Intake of a request against one patient: access, correction, restriction, deletion or grievance; how received; who asked (patient, or a representative holding a current proxy grant); identity check done. Any care-team member with access can record one.
- Default due date 30 days after receipt (a local default for the organisation to replace), an owner assigned by a supervisor or owner, and closure as fulfilled, partly fulfilled, refused or withdrawn with the response and an evidence reference; late closure is recorded as late.
- For correction, restriction and deletion, each programme destination or EHR holding an accepted or uncertain copy becomes an item to mark notified or not required; the request cannot close as fulfilled while an item is open.
- A fulfilled restriction blocks plan preparation, external sharing, sending, publishing, reminders and optional AI for that patient.
- Consent withdrawal stops or holds dependent work and lists what already left Saha ([slice 6o](../current/SLICE-6O-CONSENT-WITHDRAWAL.md)).
- Organisation data export for exit ([slice 6m](../current/SLICE-6M-DATA-EXIT.md)).

## Steps

1. Receive the request through the custody owner; route it to the in-app rights workflow.
2. Verify identity or proxy authority; record the check.
3. Assign an owner; do not reveal records outside the requester's entitlement.
4. Perform the action. Corrections append evidence and keep history; copies already sent are not recalled automatically.
5. Notify downstream destinations and record each.
6. Close with the response and evidence; keep the record.

## Limits

No automated erasure: deletion requests cannot remove confirmed records, revisions or audit under current rules, and nothing deletes backups. Statutory timelines, identity-verification standard, fee policy and escalation to a regulator or grievance officer: TBD (owner: Nakul Jain).
