# Development slice 4c — worker activity evidence for supervisors

30 September 2026 (IST). Stacked on slice 1e. Synthetic data only; formal acceptance unchanged. No migration and no new tracking.

## What changed

- **A per-worker summary derived from existing records** (`lib/saha/worker-activity.ts`, `GET /api/worker-activity?days=7|30|90`). For each worker with activity on patients currently in the teams the viewer supervises, it counts and lists:
  - **performed** — visits the worker confirmed after their positive patient check, still current (the confirmation's `patientCheck.by`);
  - **claimed** — outreach items the worker recorded as completed;
  - **verified** — claims whose linked visit is a current confirmed visit of the same patient. This is evidence matching by Saha, not a supervisor audit, and is labelled so;
  - **submitted** — performed visits a programme destination accepted, with the receipt; performed visits with an unresolved delivery and those not submitted, rejected or cancelled are counted separately.
- **Corrections stay traceable.** A visit later marked wrong-patient or corrected by amendment leaves the counts but stays in the worker's list with who changed it, when and why (from the record revision every correction writes), and whether the correction was confirmed and now counts in its place. A claim whose evidence visit is corrected or voided becomes "not verified" and says why. Nothing is recomputed into or out of history: the summary is derived on each read from the current records.
- **Scope and limits of use.** Supervisors, owners with a care role and slice 1e supervision delegates see their supervised teams; ASHAs, clinicians without a delegation and administrators are refused. Patients are those currently in the teams (current assignments, not historical membership). Every response and the panel carry the notice that this is evidence for supervision and programme review, not a payment claim, incentive calculation or performance rating. No location, village or device data is used or returned.
- **Care handover page.** "Worker activity evidence" shows the notice, the definitions, the scope and a table per worker (performed, claimed, verified, submitted, unresolved, corrected or wrong patient) with an expandable list of up to 100 recent items per worker, each with its status, submission state and trace. It appears only for viewers the server allows.

## Evidence

- 12 contract checks (`tests/worker-activity-contract.mjs`): refusal for an ASHA, an administrator, a clinician without a delegation and a suspended supervisor, and for an unsupported period; supervised teams for a supervisor, an owner and a supervision delegate, and none after the delegation ends; another team's workers and patients absent; exact counts for a worker across performed, submitted, unresolved, not submitted, corrected, wrong-patient, claimed, verified and unverified; drafts and out-of-period visits excluded; outreach claims matched, unmatched after a wrong-patient mark and without a linked visit; correction traces with the reviser's name and reason, and the visit's own reason when no revision is supplied; 7, 30 and 90-day periods; the acceptance case (marking an evidenced visit wrong-patient lowers performed, submitted and verified and keeps the trace); the 100-item bound; notice, definitions and no location fields.
- 44 HTTP/D1 assertions, requests and checks (`tests/worker-activity-smoke.mjs`): a supervisor plans an outreach round; an ASHA confirms three visits and sends one to the demo programme register; the owner marks one wrong-patient and amends another; the ASHA records the outreach item completed with the first visit. The supervisor's summary shows the first visit performed and accepted with its receipt, the second wrong-patient with the owner's name and reason, the third corrected with a draft correction, the claim verified, and no locality text; the owner also sees the worker; the ASHA, administrator, clinician and a stranger are refused and an unsupported period returns 422. Marking the first visit wrong-patient then lowers performed, submitted and verified by one and makes the claim unverified with the new reason.
- Browser check (headless Chromium, built Worker, synthetic owner with a care role): after one confirmed visit and one marked wrong-patient, the Care handover page showed the notice, definitions and the owner's row (1 performed, 1 corrected or wrong patient) with both items and the wrong-patient reason; axe-core found no violations in the panel; no console errors. The accessibility audit (25 screens) reports none. `tests/evidence/slice-4c/`.

## Limits

- Derived on read, not a stored or signed claim: there is no claim submission, buyer reporting, claim reconciliation, approval workflow or export of this summary.
- "Verified" means matched to a current confirmed visit; no supervisor spot-check, counter-signature or beneficiary confirmation exists.
- Attribution uses who confirmed a visit and who recorded an outreach outcome. Visits confirmed by one worker for another, follow-ups, referrals and field-notebook drafts are not activity items. Activity on patients since moved to another team follows the patient.
- Correction details come from record revisions of the last `days + 1` days; an older correction shows the visit's own reason without the reviser's name.
- BR-CARE-08 stays partial.
