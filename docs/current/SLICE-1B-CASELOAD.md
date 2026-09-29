# Development slice 1b — workforce lifecycle and caseload transfer

30 September 2026 (IST). Second functional slice of the development-completion plan. Synthetic data only; formal acceptance unchanged. Identity merge and unmerge, originally grouped with this slice, moved to slice 1c.

## What changed

- **Bulk caseload transfer.** `caseloadTransfer` moves the patients a steward selected from one worker to another active care worker in the same team, together with every open follow-up, referral, outreach item and message follow-up for those patients. Active field packages for those patients are revoked and unapproved external-sharing plans are blocked, as for a single-patient reassignment. Up to 200 patients per transfer. Stewards are team supervisors, or owners with a clinical role, acting within their own teams.
- **Effective dates.** A transfer applies immediately or at a scheduled time up to 60 days ahead. `caseloadApply` applies a due transfer; `caseloadCancel` cancels a scheduled one with a reason. At application every patient is re-checked; a patient whose assignment changed after scheduling is skipped and listed, not moved. A patient can be in only one scheduled transfer. No background job applies scheduled transfers.
- **Acknowledgement.** `caseloadAcknowledge` lets only the receiving worker acknowledge an applied transfer. It records the acknowledgement on each patient's handover and reports patients that have already moved again.
- **Responsibility gaps.** `GET /api/caseload` returns, for stewards, workload by worker (patients, open items, urgent items) and gaps among visible patients: open work with no assigned worker, an assignee who is suspended or removed, an assignee no longer in the patient's team, and open items owned by someone other than the assigned worker. Urgent means overdue or due within two days. Workers see only transfers addressed to them.
- **Member removal.** `removeMember` (owners only, never self) ends a membership once the member has no assigned patients, no open items and no scheduled transfer. The membership keeps its row and history with status `removed`, no teams and no owner flag. A removed membership cannot be edited back to active; returning needs a new invitation, which starts with no caseload.
- **Suspension.** Suspension still takes effect on the next request. A suspended worker's caseload shows as a gap and a steward can transfer it without the suspended worker.
- **Storage.** Migration `0008_caseload_transfers.sql` adds `caseload_transfers`. Transfers are organisation-level and use the organisation-wide commit guard; patient partitions never load them.
- **Workspace.** The Care handover page now opens with "Caseloads and handovers" for stewards (workload table, gaps, transfer dialog with patient selection, scheduling, apply and cancel) and "Caseload handed over to you" for receiving workers. The member edit dialog gains a removal section.

## Evidence

- 83 new HTTP/D1 assertions (`tests/caseload-smoke.mjs`, counting every request status and state check): views and previews by role; refusals for workers, admins, clinicians, ineligible recipients, duplicate or stale selections and past effective times; an immediate transfer with follow-up ownership and handover tagging; acknowledgement by the receiver only; a scheduled transfer with overlap refusal, early-apply refusal and application after the effective time; cancellation; a suspension gap; removal blocked by caseload, then allowed after transfer; removed membership not editable; return by new invitation with no prior caseload; stored transfer states and audit events.
- 30 contract assertions (`tests/caseload-contract.mjs`) cover urgency, authority, recipient eligibility, stale selections, immediate and scheduled application, skipped patients, overlap, cancellation, acknowledgement, removal preconditions and gap classification.
- Browser check (headless Chromium, built Worker, two synthetic accounts): the owner transferred two of five patients to a newly joined ASHA from the Care handover page; the transfer showed as awaiting acknowledgement; the ASHA acknowledged it from her Care handover page and her per-patient handover exceptions cleared.
- All suites: 1,084 HTTP/D1, 440 contract/checkpoint and 21 restore assertions (the restore drill covers 27 SQLite tables including caseload transfers). Reports in `tests/evidence/slice-1b/`.

## Limits

- Stewards must apply scheduled transfers themselves at or after the effective time; there is no scheduler, reminder or field-device acceptance of a handover.
- Transfers move patients individually. Transfer by household or by locality, and caseload balancing suggestions, are not built.
- Removal is local to Saha. There is no upstream workforce directory, federation or de-provisioning feed (BR-ID-10), and removal does not revoke the person's access to the Site itself.
- The two-day urgency window is a local default, not an approved programme rule.
