# Development slice 4a — referral lifecycle, reasoned delay and escalation

30 September 2026 (IST). First part of slice 4 of the development-completion plan. Synthetic data only; formal acceptance unchanged. The urgency windows are local defaults, not an approved clinical policy.

## What changed

- **Lifecycle.** Referrals now move through draft, sent, accepted by facility (`received`), appointment scheduled, attended, completed, declined, did not attend, cancelled and outcome unknown. `lib/saha/referral-rules.ts` holds the allowed transitions; completed, declined and cancelled are closed and their evidence is immutable. The R11 path sent → received → completed still works. A scheduled event must carry the appointment time. Every event keeps the existing dated evidence, source and reference rules.
- **Urgency.** `assignReferral` accepts routine, urgent or emergency (routine when not given).
- **Reasoned delay.** `referralDelay` lets the referral owner, or a supervisor or owner of the patient's team, move the due date later (up to 180 days ahead) with a constraint (patient unavailable, facility capacity, transport, awaiting results, other) and a reason. Each delay is kept on the referral and audited. It runs under the patient-scoped commit guard.
- **Escalation.** An open referral is escalated when it has no owner with active care access, is overdue by more than 0 days (emergency), 1 day (urgent) or 7 days (routine), has had an unknown outcome or missed appointment for 2 days, or is an emergency not yet accepted. Shorter lapses are shown as "watch". `GET /api/referral-escalations` lists these, escalated first, then by urgency and days overdue: stewards see their teams' referrals, care workers the ones they own. Escalation is computed on read; nothing is sent to anyone.
- **Open work.** Closed referrals (completed, declined, cancelled) no longer count as open work in caseloads, handovers, merges, households or the operations backlog.
- **Workspace.** Referral cards show the state label, urgency, appointment and escalation reasons, offer only the allowed next events, and gain a delay form. The Care handover page lists referral escalations.

## Evidence

- 53 new HTTP/D1 assertions (`tests/referral-smoke.mjs`): out-of-order event refused; urgent referral escalated when ten days overdue and hidden from an ASHA who does not own it; admin refused; delay refused to a worker and for an earlier date, then accepted and clearing the escalation; appointment time required for, and only for, scheduling; the full path sent → accepted → scheduled → did not attend → rescheduled → attended → completed; closed referrals refusing delay and further events; an emergency referral escalated until sent, then declined, leaving the queue and the patient's open work.
- 10 contract assertions (`tests/referral-contract.mjs`) cover the transition table, every escalation rule and window, delay authority and limits, and queue ordering and scope.
- Existing contract harnesses that compile modules now importing the shared rules (continuity, field, household, operations, outreach, pilot, EHR execution, caseload, merge, indicators) list the new file; their assertions are unchanged and pass.
- Browser check (headless Chromium, built Worker, synthetic owner): the escalation list showed an overdue urgent referral; the referral card recorded "Sent" with evidence using the new event picker. No console errors.
- All suites: 1,338 HTTP/D1, 560 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-4a/`.

## Limits

- No facility integration: every event is recorded by staff with a reference; nothing is verified by the facility.
- Escalation is a list, not a notification. There is no on-call rota, paging or automatic reassignment.
- Urgency windows are local defaults. A multi-programme referral with several source links (BR-CARE-05) is not built.
