# Development slice 1c — controlled identity merge and unmerge

30 September 2026 (IST). Third functional slice of the development-completion plan. Synthetic data only; formal acceptance unchanged.

## What changed

- **Link, not move.** A merge marks the duplicate record as merged into a surviving record. The duplicate keeps its visits, programme receipts, referrals, revisions and audit; nothing is copied, moved or deleted. The survivor lists the records merged into it.
- **Two stewards.** `identityMergePropose` records the survivor, the duplicate, an evidence reference and a reason. `identityMergeDecide` approves or rejects; the reviewer must be a different identity steward (clinician or supervisor) with access to both records. Approval is refused if either record's name, age, sex or locality changed after the proposal, if either is already merged, if the duplicate already has records merged into it, if another proposal is open for either record, or if the two records hold active links to different external identities in the same system.
- **At approval.** Pending plan approvals on the duplicate are invalidated, active field packages revoked and unsent reminders cancelled. Anything the software must not repair itself becomes an item in the case's impact queue: programme submissions that may reference the duplicate identity, active EHR links, open referrals, open follow-ups, active episodes, household membership and current proxy grants. Receipts and accepted submissions are never rewritten.
- **Merged records are read-only for new care.** Starting or saving visits, plans, referrals, enrolment, follow-ups, consent, EHR linking and publishing, programme sending, reminders, identity correction, reassignment and household or proxy changes are refused on a merged record. Reconciling uncertain external work, closing open work and revoking links or leases stay possible so the queue can be worked down. Merged records are no longer offered as registration matches.
- **Impact queue.** `identityImpactResolve` records who resolved each item and how. Resolved items keep their resolution through an unmerge.
- **Unmerge.** `identityUnmerge` makes both records active again and queues for review every visit, submission and referral created on the survivor while the records were merged. The merged state stays in the revision history.
- **Storage and reads.** Migration `0009_identity_cases.sql` adds `identity_cases`. `GET /api/identity-cases?personId=` loads only the person and the records named in their cases, and names a counterpart only when the viewer may see it.
- **Workspace.** An "Identity & merges" dialog on the patient page proposes, reviews, works the impact queue and reverses merges. A notice marks merged records and survivors; the visit-start buttons are disabled on a merged record.

## Evidence

- 54 new HTTP/D1 assertions (`tests/merge-smoke.mjs`): role refusals for proposal, review, resolution and unmerge; self-review refused; stale version; approval with idempotent replay; merged-record refusals for visits, follow-ups and identity correction while the survivor still accepts a visit; merged records excluded from matching; impact items and their resolution; unmerge with a post-merge review item; a rejected second proposal; stored case states, audit events and revisions.
- 27 contract assertions (`tests/merge-contract.mjs`) cover authority, external-identity conflicts, snapshot changes, invalidation counts, the exact impact item kinds, untouched receipts and completed plans, refused and permitted actions on a merged record, chain prevention, scoped views, unmerge review items and rejection.
- Browser check (headless Chromium, built Worker, two synthetic clinicians): one proposed a merge from the patient page, the other approved it from the same dialog, and the duplicate's page showed the read-only notice. No console errors.
- All suites: 1,138 HTTP/D1, 467 contract/checkpoint and 21 restore assertions (the restore drill covers 28 SQLite tables including identity cases). Reports in `tests/evidence/slice-1c/`.

## Limits

- There are no programme identity crosswalks or issuer identifiers yet; the impact queue tells a person what to correct but does not send corrections to destinations.
- Identity stewards are clinicians and supervisors with access to both records. There is no separate steward role or restricted-source comparison view.
- Proxy grants that name a merged record as the proxy, and caseload or household views, do not follow the merge automatically.
- Merge and unmerge use the organisation-wide commit guard.
