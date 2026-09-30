# Development slice 3h — clinician action on field referral requests

30 September 2026 (IST). Builds on slices 3g and 2c. Synthetic data only; formal acceptance unchanged.

## What changed

- **Command.** `decideReferralRequest` (visit id, `refer` or `decline`, an optional facility when referring, and a reason of 5–1,000 characters) acts on the referral request stored on a visit by a field registration (slice 3g).
- **Refer in one step.** "Refer" creates the referral through the existing `createReferral` path (a draft referral for tracking, with the request's facility unless the clinician changes it, and the clinician's reason). The referral then follows the slice 4a lifecycle: owner, due date, urgency and dated events. No facility is contacted.
- **Decline with a reason.** "Decline" records the decision and creates no referral.
- **Who and when.** Only a clinician may decide, on a confirmed, current visit, once per request. The same patient guards as a direct referral apply (unresolved identity, merged record, emergency access scope, restriction). The role check is repeated when an idempotent request is replayed. The decision (referred or declined, by whom, when, the reason and the referral id) is kept on the request next to the original request; the visit's version is not changed, so a prepared programme plan stays valid. An audit line names the request and, when referring, the new referral; the referral's own audit line is attributed to the clinician.
- **Visit screen.** A "Field referral request" panel shows the request, who captured it and when. For a clinician on a confirmed visit it offers the facility (editable), a reason and "Create referral" or "Decline request"; otherwise it says what is needed. After a decision it shows the outcome.

## Evidence

- 24 HTTP/D1 assertions (`tests/referral-request-smoke.mjs`): a request on a draft visit refused; an ASHA refused; a short reason and a facility on a decline refused; a clinician's referral with a changed facility creates one draft referral linked to the visit and person, the decision records the referral id and the clinician, the request is kept, both audit lines are the clinician's; replay with the same key returns the same referral and creates no second one; a second decision refused; a declined request creates no referral; a visit without a request and an unknown visit refused.
- Browser check (headless Chromium, built Worker): a clinician opened a confirmed visit from a field registration, changed the facility, gave a reason and created the referral; the panel showed the outcome and the server held one draft referral with the chosen facility, linked from the decision. No console errors. `tests/evidence/slice-3h/referral-request-browser.json`.
- All suites: 1,602 HTTP/D1, 953 contract/checkpoint and 21 restore assertions.

## Limits

- There is no queue of open referral requests; a clinician sees a request only on the visit. Requests are not counted by the operations alerts or the escalation queue.
- The direct "Prepare referral" action is unchanged and remains open to ASHA workers on confirmed visits; the clinician-only rule applies to field requests only. No approved scope-of-practice policy decides which referrals need a clinician.
- A declined request cannot be reopened; a clinician can still prepare a referral directly.
- The command is not in the patient-scoped command list, so it commits under the organisation-wide guard.
