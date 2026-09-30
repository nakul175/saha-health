# Development slice 6a — exceptional (break-glass) access

30 September 2026 (IST). First part of slice 6 of the development-completion plan, taken early because it is self-contained. Synthetic data only; formal acceptance unchanged.

## What changed

- **Opening.** `exceptionalOpen` lets an active clinician open access to one patient outside their normal care scope, by the record reference shown on the patient's record (the full reference or its first eight characters), for 15 minutes to 4 hours, with a reason of at least 20 characters. It is refused if the clinician already has normal or emergency access, if the record was merged, or if the reference matches no record or more than one. A clinician can hold at most 3 open grants and open at most 10 in 24 hours.
- **What it permits.** While access is exceptional only, the clinician can read the record and its history and record urgent care: start, save and confirm visits, create referrals, record a clinical concern or protocol check, save programme answers and schedule a follow-up. Everything else that names the patient is refused, including plans and external sharing, programme sending, EHR linking and publishing, FHIR export, consent and contact preferences, identity correction, merges, assignment, households and proxies, reminders and AI runs. Grants are personal and end at the stated time or when the clinician closes them.
- **Review.** `exceptionalReview` records "appropriate" or "inappropriate" with a note. The reviewer must be a supervisor or an owner with patient access in the patient's team, must not be the clinician who used the grant, and can review only after the grant has ended. Each grant is reviewed once.
- **Audit.** Opening, closing and review are audit events on the patient's record. The grant history is kept on the patient record and in its revisions.
- **Access model.** `lib/saha/access.ts` now separates normal scope (`normallyAllowed`) from a current grant (`exceptionalGrant`). Checks that decide whether someone may own work for a patient (outreach and protocol owners) use normal scope only.
- **Workspace.** The Care handover page gains an "Emergency access" section: clinicians open and close grants; supervisors and owners see grants awaiting review. A notice on the patient page states the time limit and the restrictions.

## Evidence

- 47 new HTTP/D1 assertions (`tests/exceptional-smoke.mjs`): no access before the grant; refusals for ASHA, supervisor, admin, an owner with normal access, unknown references, short reasons and over-long durations; grant and duplicate refusal; the patient appears in the clinician's workspace; a visit and history read succeed; consent, assignment, identity, household and FHIR export are refused; views by role; review refused while open, from another team, by the grantee and twice; closure by the grantee only; access removed after closure; stored audit events and the kept visit draft.
- 19 contract assertions (`tests/exceptional-contract.mjs`) cover reference resolution and ambiguity, eligibility, schema limits, expiry, personal grants, permitted and refused actions, the three-grant and daily caps, closure and review rules, and the review views.
- Browser check (headless Chromium, built Worker, two synthetic accounts): a clinician opened emergency access by record reference from the Care handover page, saw the patient with the restriction notice, closed the access; the owner then recorded an "appropriate" review. No console errors.
- All suites: 1,185 HTTP/D1, 486 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-6a/`.

## Limits

- Reads during emergency access are not individually logged; the grant window, reason and actions taken are. General material-read audit (BR-SEC-08) is not built.
- The organisation activity log still filters patient events by normal team scope, so the clinician does not see the patient's activity there during the grant.
- There is no separate break-glass role, second-factor step-up, notification to the patient's team when access opens, or support-staff access path.
- The limits (4 hours, 3 open grants, 10 a day) are local defaults, not approved policy.
