# SAHA-109 local coding completion — reporting freshness and completeness

Date: 20 October 2026 IST

Story: SAHA-109 / APL-132 / BR-REP-03

Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-132.md`

Frozen contract SHA-256: `11acf15a1b2a791ba9cf191a447e401a823defa60b6eb8b170d5d83679dfd178`

Implementation base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Local coding-complete assessment

No application-code gap is identified for the frozen SAHA-109 outcome on the report surfaces released by this source: indicator reports, the scoped operational report and CSV export, and aggregate destination reports. Each surface now carries the governed reporting calendar, expected-source state, refresh time, privacy-banded arrival freshness, incomplete source periods, and affected operands beside the figures. The disclosure always says that the clinical denominator is unknown unless clinical evidence establishes it; operator declarations and observed activity cannot infer it.

This is a local engineering assessment. It does not pass TC-BR-REP-03-A, TC-BR-REP-03-B or TC-J06, change the native Linear state, establish clinical/source-owner acceptance, activate a provider, run exact-source CI, merge, or prove deployment.

## Implemented behavior

- Completeness evaluation accepts an explicit authorised team cohort. Calendar details outside that cohort are excluded, and the server checks current reporting and patient scope for every selected team.
- Operational JSON and its reconciled CSV include the same bounded completeness disclosure: source status, configured refresh/lateness policy, evidence digest and protected basis, affected denominator operands, affected source periods and privacy-banded freshness.
- Aggregate destination payloads use `saha-aggregate-v2`. The completeness disclosure is inside the signed payload digest and the scoped aggregate history view, and the UI renders it beside each report.
- Approval is invalidated when source evidence, arrivals, calendar configuration or reporting scope changes before send. The report closes without an external attempt or receipt.
- Existing `saha-aggregate-v1` saved envelopes remain readable and verifiable; a legacy report without pinned completeness cannot be newly sent through the current production checkpoint.
- The disclosure excludes patient identifiers, operator identifiers, evidence hashes and raw source rows. Protected reconstruction remains server-side through `evidenceBasis`; the public disclosure is bounded by strict envelope schemas and existing payload limits.
- Existing reporting-purpose checks, destination authorization, independent aggregate approval, suppression/minimisation checks, audit-before-send and idempotent checkpoint behavior remain in force.

## Synthetic evidence

`tests/reporting-completeness-all-reports-http.mjs` runs an actual local Worker and D1 database with synthetic identities and a demonstration aggregate-only destination. It proves 30 checks across:

- an independently reviewed and released source calendar;
- two version-pinned source declarations, including a configured denominator source;
- operational JSON and CSV completeness/freshness disclosure;
- patient-free bounded disclosure;
- a signed aggregate payload and scoped history view carrying the same evidence digest;
- a later source outage changing the report to incomplete and naming the affected denominator and period;
- cancellation after approval with zero external attempts and no receipt.

Machine-readable result: `tests/evidence/reporting-completeness-all-reports/http.json`.

## Verification run on this source

| Check | Result |
|---|---:|
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `node tests/reporting-completeness-all-reports-http.mjs` | 30/30 pass |
| `node tests/reporting-completeness-repaired-contract.mjs` | 51/51 pass |
| `node tests/reporting-completeness-repaired-http.mjs` | 97/97 pass |
| `node tests/provider-specialised-envelope-contract.mjs` | 41/41 pass |
| `node tests/aggregate-delivery-contract.mjs` | 12/12 pass |
| `node tests/aggregate-checkpoint-population-contract.mjs` | 4/4 pass |
| `node tests/aggregate-export-current-sixth-review-fixes-contract.mjs` | 42/42 pass |

The earlier standalone `operational-privacy-export-current-contract.mjs` invocation did not reach its assertions because that test's fixed transpile list omits the pre-existing `installed-transition-authority` dependency imported by `programmes.ts`. This harness failure is retained and is not counted as a product pass or a SAHA-109 regression.

## Separate delivery gates

| Gate | Status |
|---|---|
| Frozen scope inspected | complete for local implementation |
| Application coding | complete locally; no identified SAHA-109 application-code gap |
| Focused synthetic engineering tests | pass as listed above |
| Independent source review | pending |
| Exact-source CI | not run |
| Formal QA / programme manager acceptance | pending; catalogue cases remain Not run |
| Clinical/source-owner acceptance | pending |
| Merge | not performed |
| Observed deployment | not performed |
