# SAHA-121 evidence receipt

## Custody

- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Frozen contract SHA-256: `a8c40bc7c83d17a6ec273084471eee48ccc58ef5c01a7a1e2a22e46555178013`
- Source hashes: `source-hashes.json`
- Environment: owned local synthetic workspace; no external provider, production credential, patient record, hosting change or deployment.

## Results

| Check | Result | Receipt |
| --- | --- | --- |
| Focused schema, authorization, refusal, stale-version, review, digest, copy and invalidation contract | PASS, 25/25 | `contract-result.json`, `validation.log` |
| TypeScript typecheck | PASS | `validation.log` |
| Production build | PASS | `validation.log` |
| Full local API smoke | FAILED BEFORE TARGET | `api-smoke-inherited-failure.json` |
| TC-BR-OPS-08-A | NOT RUN | Formal QA with deployment operations remains pending. |
| TC-BR-OPS-08-B | NOT RUN | Formal QA with deployment operations remains pending. |

The failed full runner did not reach `expansionSmoke`. Its fresh local fixture stopped at the unchanged operations-suite prerequisite asserting at least one patient in the overview. The focused contract compiles the real Saha modules and exercises the real deployment and expansion functions, but it is not a substitute for the blocked HTTP integration path or formal source fixtures.

## Covered behavior

- strict manifest and strict digest-bound copy format;
- settings, named secret bindings, dependencies, training, tests, responsibilities and explicit local differences;
- refusal of added patient fields, sensitive setting keys, obvious embedded secret values and incomplete manifests;
- operations authorization, accountable-owner restriction, stale version refusal and named independent reviewer;
- all six evidence areas bound to exact proposal plus manifest;
- copied pack begins as draft with no evidence or review transfer;
- manifest changes invalidate evidence and review;
- UI, API build and export code compile at production settings.

## Remaining separate gates

Independent final source review, current-source CI, formal source-fixture execution, external approvals, merge and observed deployment are not claimed.
