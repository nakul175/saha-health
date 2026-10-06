# BRD v1.2 proposal: ASHA field-fit delta

Status: **proposal for sponsor decision, not adopted.** The adopted requirement set is still BRD v1.1 (176 requirements, `requirements/brd-v1.1.json`); nothing here changes `requirements/assessment.tsv`, the traceability files or the 0 of 364 acceptance count. Written 7 October 2026.

Basis: the secondary-research report "ASHA field reality and Saha fit" and its deck (22 numbered implications). Every statement about what an ASHA does or is paid for rests on that report's cited sources, not on a field visit. **No ASHA has been interviewed.** Rows tagged *needs field validation* must not be built as final until the field visits (below) confirm them.

Target state or district: **not chosen.** Rates, the HBNC visit schedule, the register set and the state app landscape differ by state, so this slice carries them as owner-supplied policy and builds no state default.

## Mapping of the 22 implications

Legend: *Amend* changes an existing v1.1 requirement; *New* proposes an ID that v1.1 does not have. "Built" refers to slice 14a only.

| # | Implication (short) | v1.1 requirements touched | Proposal | Evidence tag | Built in 14a |
|---|---|---|---|---|---|
| 1 | MCP card as the integration record | BR-PROG-02, BR-DATA-02 | New BR-PROG-09 | Evidenced | No |
| 2 | LMP/EDD, birth and delivery dates, generated due list | BR-PROG-02, BR-PROG-05, BR-CARE-04, BR-ID-06 | Amend BR-PROG-02/05; New BR-DATA-13 (dates on person record) | Evidenced | Rule layer only: `lib/saha/mch-schedule.ts` due list. The person-record fields, migration and screens are not built |
| 3 | Payable event is the verified composite, not the visit | BR-CARE-08 | Amend BR-CARE-08; New BR-CARE-09 | Evidenced | Rule layer only: `evaluateComposite` |
| 4 | Newborn and young-child packs from official HBNC/HBYC forms | BR-PROG-08, BR-PROG-01 | Amend BR-PROG-08 | Evidenced; needs field validation (which HBNC schedule) | Visit windows are policy data; no pack |
| 5 | Encode the ANC content she is paid to check, within scope of practice | BR-PROG-02, BR-CLIN-04 | Amend BR-PROG-02 | Evidenced | No |
| 6 | Offline-first including first open, full caseload on device | BR-OFF-01, BR-OFF-02, NFR-11 | Amend BR-OFF-01 | Evidenced | No. Today the offline notebook holds prepared visits only |
| 7 | No session or lock behaviour may discard a draft | BR-UX-07, NFR-04, BR-ID-03 | Amend BR-UX-07 | Evidenced; needs field validation (acceptable interval) | No |
| 8 | Voice-first in the state language, not Hindi only | BR-UX-03, BR-UX-05, NFR-15 | Amend BR-UX-05/NFR-15 | Evidenced direction; needs field validation | No |
| 9 | Export the register and claim formats she is audited against | BR-REP-05, BR-INT-22 | New BR-REP-08 | Evidenced; needs field validation (formats) | No |
| 10 | Real incentive ledger with rate tables and claim status | BR-CARE-08 | New BR-CARE-10 | Evidenced | Amount is a required policy field with no default; ledger not built |
| 11 | Claim loop closes in a stated period, or Saha does not touch claims | BR-CARE-08, BR-INT-04 | Amend BR-CARE-08 | Evidenced; needs field validation (district chain) | No |
| 12 | "No location" as a hard requirement | BR-SEC-01, BR-SEC-07 | New BR-SEC-15 | Evidenced | No new code; stated as a rule the schedule module respects (no location input) |
| 13 | Feeder to RCH 2.0/ANMOL, U-WIN, Ni-kshay, ABHA, state claim portals | BR-INT-01, BR-INT-08, BR-INT-14 | Amend BR-INT-08 | Evidenced; needs field validation (write paths) | No |
| 14 | 2025 register set (line lists by age band, family folder, vital events, NCD enumeration) as records | BR-PROG-01, BR-ID-07 | New BR-DATA-14 | Evidenced | No |
| 15 | Deliver her own due and overdue alerts | BR-CARE-04, BR-CARE-06 | Amend BR-CARE-04 (today alerts go to supervisors) | Evidenced; needs field validation (channel) | The due list is computed; delivery is not built |
| 16 | Device and data reality as requirements | NFR-02, NFR-11, BR-OFF-08 | New NFR-29 | Evidenced; needs field validation | No |
| 17 | Net-time requirement and baseline | NFR-14, BR-REP-07 | Amend NFR-14 | Needs field validation | No |
| 18 | Evaluation targets of 5 to 15 point process gains, not mortality | BR-REP-07, NFR-17 | Amend BR-REP-07 | Evidenced | No |
| 19 | Direct referral and transport scope with the state | BR-CARE-02, BR-CARE-03 | Decision, no new ID | Needs field validation | No |
| 20 | Household proxy and disclosure rules checked against courtyard practice | BR-ID-07, BR-SEC-04, BR-CARE-06 | Validation task | Needs field validation | No |
| 21 | Do not duplicate AWW growth monitoring; HBYC as cross-worker check | BR-PROG-08, BR-DATA-04 | Amend BR-PROG-08 | Evidenced | No |
| 22 | Facilitator and ANM verification in-app replaces signature and photocopy | BR-CARE-08, BR-ID-02 | Amend BR-CARE-08 | Evidenced burden; needs field validation (ANM acceptance) | `Verification` input is required for a payable result; the role model is not built |

## What slice 14a delivers, and what it does not

Delivered: `lib/saha/mch-schedule.ts` (pure functions, no storage, no clock, no location, no messaging) and `tests/mch-schedule-contract.mjs` (31 checks, synthetic policy only).

- `dueList` turns LMP or EDD, birth date or date of birth into ordered due, overdue and upcoming items. A window whose anchor date is unknown is reported as a missing anchor and is never guessed.
- `evaluateComposite` returns `awaiting_day`, `incomplete`, `awaiting_verification` or `payable`. Evidence completed after the closing day does not count and is listed. Nothing is reported payable without a named verifier and role.
- The schedule, the required evidence and the amount are a `SchedulePolicy` supplied by the owner. There is deliberately no built-in rate or window: the report found the rates vary by state and year, and the existing placeholder schedule is synthetic.

Not delivered: person-record fields and migration, any screen, any route, the offline notebook change, delivery of alerts to the ASHA, the incentive ledger, the register exports, newborn and child packs. Until those exist, the rule layer does not change what an ASHA or supervisor sees in Saha, and no requirement moves from its v1.1 assessment.

## Decisions needed from the sponsor

1. Choose the target state and district, so a `SchedulePolicy` can be written from that state's orders rather than the national summary.
2. Approve or reject the proposed new IDs (BR-PROG-09, BR-DATA-13, BR-DATA-14, BR-CARE-09, BR-CARE-10, BR-REP-08, BR-SEC-15, NFR-29). Adoption would make a v1.2 requirement set and would need `requirements/` regenerated and the 176 count revised; that is a separate reviewed change.
3. Whether the next slice is the person-record dates (needs an additive D1 migration, which must not alter 0001 to 0032) or the incentive ledger.

## Field validation before final build

The report's own list of items that cannot be settled from desk sources applies. At minimum: shadow 3 ASHAs for a full day each, with one facilitator and one ANM interviewed; time documentation per record; photograph the registers and formats actually used (with consent, no patient identities); confirm the HBNC schedule, the claim chain and payment lag, who holds the phone, and the language the voice input must handle. A field-visit guide has not yet been written.

## Honest status

This is a proposal plus a tested rule layer. It is not clinically reviewed, not independently reviewed by a person, and not accepted. Formal acceptance remains 0 of 364.
