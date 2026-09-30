# Development slice 7a — ABDM-shaped workflows against a local mock gateway

30 September 2026 (IST). First part of slice 7 of the development-completion plan. Synthetic data only; formal acceptance unchanged. **Nothing in this slice talks to ABDM.** The workflows are shaped on ABDM concepts so that the product, its permissions and its records are ready for sandbox onboarding; they are not validated against the ABDM sandbox or specification.

## What changed

- **Module readiness (BR-INT-13).** `abdmConfigure` (owners) records the environment, the ABHA, HIP and HIU modules, a facility identifier and an approval reference for each enabled module on the organisation's ABDM connection record. Only the `mock` environment is accepted; sandbox and production are refused with a message that onboarding happens outside Saha. ABHA and HIU commands are refused unless their module is enabled with a recorded approval.
- **ABHA workflows (BR-INT-14).** `abhaLink` links a 14-digit ABHA number (and optional ABHA address) after a mock one-time-code check (`123456`); `abhaDecline` records that the person declines ABHA and care continues; `abhaUnlink` removes a wrong link with a reason and revokes that patient's open consent artefacts. One ABHA number can be linked to only one current record; a second attempt is refused and points to identity review. History is kept on the record. Care roles with patient access only.
- **Consent artefacts (BR-INT-15).** `abdmConsentRequest` (clinicians) asks for health information with a purpose, health-information types, a record date range and an expiry within a year; it needs a linked ABHA. `abdmConsentDecide` lets an owner act as the **mock consent manager** (in a real deployment the patient decides in their ABDM app). `abdmConsentRevoke` revokes. A granted artefact past its expiry reads as expired. `consentAllows` refuses a fetch unless the artefact is granted and current, the ABHA link is unchanged, and the purpose, type and record date all fall inside it; `GET /api/abdm` exposes this check.
- **Codes.** Purpose codes (CAREMGT, BTG, PUBHLTH, HPAYMT, DSRCH, PATRQT) and health-information types (OPConsultation, Prescription, DiagnosticReport, DischargeSummary, ImmunizationRecord, HealthDocumentRecord, WellnessRecord) follow the list in the [CoronaSafe ABDM implementer's guide](https://docs.coronasafe.network/abdm-documentation/implementers-guide/building-hiu). They have not been checked against the current [ABDM sandbox documentation](https://sandboxcms.abdm.gov.in/uploads/M3_Dcoument_03_03_2025_faf0c9aecb.pdf).
- **Masking.** Workspace snapshots and the ABDM view show ABHA numbers as `NN-XXXX-XXXX-NNNN`; audit text never contains the full number. The stored record and its revisions keep the full number for the care team's audit trail.
- **Workspace.** The Connections page gains the mock gateway configuration for owners; the patient page gains "ABHA & consent" (link, decline, unlink, request, mock grant or deny, revoke, check a fetch). The ABDM readiness panel and the operations gate now say "mock only" instead of "blocked".

## Evidence

- 34 new HTTP/D1 assertions (`tests/abdm-smoke.mjs`): module required before linking; configuration refused to a clinician, for production and without approvals; supervisor, wrong-code and malformed-number refusals; masked link result and snapshot; duplicate ABHA refused; decline; consent request refused to an ASHA; mock decision refused to a non-owner; allowed and refused checks by type and date; admin, out-of-scope and bad-date view refusals; revocation; unlink with history.
- 14 contract assertions (`tests/abdm-contract.mjs`) cover configuration rules, normalisation and masking, duplicate and relink rules, consent validation, every refusal reason of `consentAllows`, expiry, revocation on unlink, relinking, a changed ABHA invalidating a grant, decline and redaction without changing the stored record.
- Browser check (headless Chromium, built Worker, synthetic owner): enabled ABHA and HIU on the mock gateway, linked an ABHA, requested and mock-granted consent, and checked a fetch as allowed. No console errors. (A first run found the configuration step's navigation button ambiguous in the test script; the step order was otherwise unchanged.)
- All suites: 1,423 HTTP/D1, 594 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-7a/`.

## Limits

- No ABDM gateway, sandbox, credentials, callbacks, cryptography or FHIR bundle exchange. HIP publication and encrypted transfer (BR-INT-18), HIU data flow and received-record review (BR-INT-19) and the NRCeS profile validator (BR-INT-17) are not built.
- The mock one-time code and the owner acting as consent manager exist only to exercise the workflow; neither is an identity or consent proof.
- ABHA numbers are format-checked only (14 digits); no checksum or issuer verification.

## Correction — 30 September 2026 (slice 6r)

ABHA numbers were masked in snapshots only. Patient history (`GET /api/history`) served stored revisions with the full ABHA number in revision data (`abha.number`, ABHA history, consent artefacts, care contexts) and in field changes. Slice 6r redacts history on read with the same masking; stored revisions are unchanged. Found by a third independent review of code already merged into `main` without independent human review; the original text above is kept. See [slice 6r](SLICE-6R-MAIN-REVIEW-FIXES.md).
