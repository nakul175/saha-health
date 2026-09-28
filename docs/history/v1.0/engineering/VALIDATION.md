# Validation evidence

Pack baseline: v1.0, BRD v1.1. Checks performed on synthetic reference assets only.

| Category | Executed result | Evidence file |
|---|---|---|
| Reference invariants | 36 tests passed | reference_test_results.json |
| Contract and traceability linter | 327 checks passed | contract_check_results.json |
| Prototype state and markup | 37 checks passed | wireframe_state_results.json |
| Workbook recalculation and input changes | 12 checks passed | workbook_check_results.json |
| Exported workbook | 13 sheets, 380 formulas, zero cached error cells | workbook_export_results.json |
| DOCX rendering | 10 files, 144 pages, zero page-boundary issues; visual review completed | document_check_results.json |

The reference tests exercise wrong tenant/person, revoked or expired authority, changed approval snapshots, fact reuse, field minimisation, idempotency, uncertain writes, independent destination outcomes, duplicate events, sync dependencies and capability eligibility. They do not implement or verify a production policy engine.

The contract linter checks internal references, operation identity, bearer requirements, idempotency headers, path parameters, 98 shape examples, closed command inputs, event envelopes, source/test links and the presence of foundation RLS statements. Counting DDL statements does not establish SQL syntax, deployment grants or database isolation.

Workbook input-change checks marked one test Passed, verified a missing-evidence alert, supplied a temporary evidence link, verified the alert cleared, and restored the original Not run state. Release gates remained open. All application execution fields are restored to the stated baseline.

The wireframe checks execute the actual embedded JavaScript with a minimal DOM stub. They cover generated views, partial success, reconciliation, preserving accepted receipts when offline, authority withdrawal and patient switching. Chromium was unavailable and the installation download was invalid, so real browser rendering, keyboard/accessibility behaviour and responsive visual QA remain unverified.

## Not executed

- The 364 application test definitions; all remain Not run.
- Live MIS, EHR, ABDM or AI-provider interactions and onboarding.
- Clinical performance, local-language field evaluation or user study.
- Native PostgreSQL execution, production RLS roles, migration, restore or load tests.
- An independent full OpenAPI 3.1 / JSON Schema validator or selected ABDM FHIR profile validator.
- Security assessment, device encryption, session revocation, infrastructure recovery or production support drills.

Passing these reference checks does not accept G2, G3, G4 or any other release gate.
