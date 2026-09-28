# Next delivery

The next planned engineering batch is R12. R11 still has open live-provider and clinical follow-through. Five future batches remain planned, R12–R16; this is not a guarantee of production completion. Preserve the exact [176-requirement ledger](../REQUIREMENTS-TRACEABILITY.md) and [remaining release plan](../REMAINING-RELEASES.md).

## First coding slice

Start R12 with a partner onboarding and acceptance dossier around the existing MIS and EHR adapters. Do not replace the tested receipt/checkpoint code or invent a new universal connector. The slice should make one destination's contract, mapping version, test results, responsible owner and unresolved acceptance explicit, then repeat independently for the second programme destination and selected EHR route.

This is a proposed implementation slice derived from the existing R12 plan, not an approved partner contract or a new commitment to a vendor.

1. Select exact R12 requirement rows from `requirements/assessment.tsv`. Preserve their source text and acceptance criteria. Record which clauses this slice addresses and which remain open.
2. Review `MIS-API.md`, `EHR-ABDM.md`, `lib/saha/mis*.ts`, `lib/saha/ehr*.ts`, the execution/checkpoint tests and the corresponding UI panels. Extend their current gates and version model.
3. Define a version-bound dossier for contract, field semantics, units/missingness, endpoint/environment, credentials binding name, receipt lookup, correction protocol, ownership and evidence. Store references, never secrets or real patient payloads.
4. Locally exercise acceptance, rejection, uncertain write, receipt-only lookup, proven absence then same-key retry, stale mapping, revoked permission, concurrent approval, interrupted final save and linked correction. Preserve earlier accepted receipts.
5. Use approved sandbox credentials only after the system owner supplies the exact contract and authorization. Keep live acceptance blocked when that evidence is unavailable. Mock transport is not partner acceptance.
6. Update the ledger, current contracts, release notes and qualification with exact results. Publish the batch on a new branch and draft PR from the latest release. Deploy only as part of an authorized Site task.

## External inputs still required

| Work | Required input | Completion evidence |
| --- | --- | --- |
| R11 provider follow-through | Approved provider terms, secret binding, intended use, clinical owners and representative annotated data | Live contract results; language/population-specific evaluation; independent clinical decision |
| R12 programme and EHR integration | Two independent programme owners and selected EHR owner; sandbox endpoints, mappings, receipt and correction contracts | Separate accepted/rejected/uncertain/correction evidence per destination and named partner acceptance |
| R13 ABDM | Authorized module/role onboarding, exact profiles and sandbox credentials | ABHA, HIP/HIU and scoped consent/exchange evidence; identity reconciliation |
| R14 field and messaging | Authorized channel/templates, device matrix, reviewed translations, household/proxy decisions | Real opt-out recovery, disconnected device and speech tests, relationship authority |
| R15 production controls | Custody/retention policies, qualified reviewers, representative workload and hosted recovery scope | Independent security/accessibility review, measured load/soak and authorized restore/cutover |
| R16 field acceptance | Approved study scope, trained participants, accountable reviewers and baseline | Outcomes including failures/exclusions, remediation and signed requirement decisions |

Do not close an older gap merely because a later engineering release exists. Identity, consent, sensitive-data segmentation, programme semantics and scale risks cut across these batches. See each row's remaining-work statement.
