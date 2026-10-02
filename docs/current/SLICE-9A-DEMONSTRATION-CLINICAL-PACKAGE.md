# Development slice 9a — demonstration clinical package

2 October 2026 (IST). The sponsor plans a presenter-led demonstration of Saha to a government health audience. In a new synthetic organisation the visit's clinical review said "No current reviewed protocol covers this person" even for a blood pressure of 150/112 mmHg in pregnancy, because no organisation starts with a reviewed protocol. This slice gives a new synthetic organisation a small demonstration clinical package, so that a danger sign can be shown being flagged and routed to a referral service. Synthetic data only; nothing here is clinically approved; formal acceptance unchanged.

## What changed

- `lib/saha/demonstration.ts` installs two sources, three services and two protocols by running the ordinary governance commands (`applyGovernance`). Two synthetic fixture clinicians are added to the organisation: one authors every entry and is its clinical owner, a different one reviews it, and the organisation owner activates it. No governance check is skipped or changed: author and reviewer must still differ, the clinical owner must cover the team, and every protocol depends on active sources and services.
- **Sources** (real public documents, cited for demonstration rules only; checked on 2 October 2026):
  - MoHFW, *Guidelines for antenatal care and skilled attendance at birth by ANMs and LHVs* (Maternal Health Division, 2005), <https://nhmmeghalaya.nic.in/guidelines/gfac.pdf>: a BP of more than 140/90 mmHg is rechecked after an hour and, if still high, the woman is referred to the medical officer; a diastolic BP above 110 mmHg is a danger sign needing immediate referral to the CHC/FRU.
  - NTEP, *Diagnostic algorithm for TB disease*, <https://www.ntep.in/node/1743/CP-diagnostic-algorithm-tb-disease-ntep>: persons with cough of more than 2 weeks are presumptive pulmonary TB and are referred for evaluation.
- **Services** (synthetic, unverified): Rampur PHC medical officer, Kheda CHC / First Referral Unit, Kheda TB testing centre.
- **Protocols**, each titled "(demonstration, not clinically approved)":
  - Antenatal blood pressure (Maternal care, ages 15–49, ASHA and clinician): systolic 140 or above, or diastolic 90 or above → review, refer to the PHC medical officer; diastolic above 110 (111 or above) → urgent review, refer to the CHC/FRU immediately.
  - Presumptive TB (TB screening, ages 15–120): cough for more than 2 weeks (15 days or more) → review, refer to the TB testing centre.
- A new home organisation receives the package automatically in the `synthetic` environment only. An owner can install it into an existing synthetic organisation with the command `installDemonstrationPackage`; it is refused for anyone but an owner, outside `synthetic` (training, staging, production, misconfigured) and when already installed. `SAHA_DEMONSTRATION_PACKAGE=manual` turns automatic installation off; the HTTP suite uses it because its shared organisation was written for an empty governance register.
- Fixture clinicians have user ids beginning `fixture:` and account rows with `.invalid` addresses (memberships reference accounts). No one can sign in as them: the Sites identity layer refuses principals whose id begins `fixture:`, and Cloudflare Access ids always begin `access:`. They cannot be edited as members, are not managed by roster sync, cannot receive a caseload and cannot hold delegated authority.
- The clinical review panel lists urgent findings first, with a one-line count naming the referral service.

## Evidence

- `tests/demonstration-contract.mjs` (52 checks): the package installs with every entry active and no open issues; author and reviewer differ; nothing installs in training, staging, production or a misconfigured deployment; the command is owner-only and refuses a second installation; the protocol preview gives the urgent finding for diastolic 112 and the TB finding for a 16-day cough, and nothing for 120/80.
- `tests/demonstration-smoke.mjs` (HTTP): see `VALIDATION.md`.
- Browser check of the ASHA view: see `VALIDATION.md` and `tests/evidence/slice-9a/`.

## Limits

- Not clinically approved. The fixture "review" is recorded by a synthetic clinician so the workflow can be shown; no clinician has reviewed this content. The 2005 text says "more than 140/90"; the rule fires at 140/90 or above, the common reading. The ANM guideline describes ANM actions; the demonstration applies it to the ASHA view to show routing, which a real deployment would set from its own approved protocol.
- Two programmes only (maternal blood pressure, cough duration). Hypertension follow-up and child growth have no demonstration rules.
- Existing synthetic organisations get the package only through the owner command.
- Not independently reviewed.
