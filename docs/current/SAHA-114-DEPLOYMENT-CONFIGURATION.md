# SAHA-114 deployment configuration — local coding record

Date: 20 October 2026. Source scope: APL-137 / BR-OPS-01. This record covers synthetic local application code only. It does not mark the original formal cases accepted, activate a provider, change hosting, merge source, or establish production readiness.

## Implemented behaviour

- `GET /api/deployment-configuration` returns one explicitly selected tenant's configuration history, safe reference choices and current counts to a current owner or administrator. It omits patient rows and provider credentials, obtains the patient total through a count-only query, records the material read, binds the response to the signed-in actor and refuses ambiguous URL instructions.
- `/deployment-configuration` lets an owner stage an exact versioned configuration for organisation, localities, facilities, roles, programmes, languages, provider eligibility and bounded operational limits.
- Staging validates every reference against the selected organisation, requires all roles/languages/programmes already in use, requires an eligibility decision for every current connection, and refuses a limit below current use.
- A different current owner or administrator must approve or reject the exact source-bound revision. The proposer cannot review it. Review refuses after organisation, member, geography/facility, installed-pack or connection context changes.
- A current owner other than the reviewer activates the exact approved revision. Activation rechecks reviewer authority, every setting and the source hash. A previously active revision is retained as superseded; a previously active revision can be restored only when it still validates against current references.
- Active settings constrain invite/member roles, online and field registration programmes and patient capacity, member language, connection capacity, provider activation eligibility and facility/locality assignment. Static authorization and eligibility checks are re-evaluated on saved-command replay. Capacity limits apply only to fresh mutations, so replay never re-executes or rejects a previously committed mutation after capacity is reached. Tenant state is stored only inside that organisation's operations document.
- Every successful stage, review, activation and restore appends an audit event. Refusals occur before persistence, so no partial configuration publication is reported as active.

## Actual local verification

- `node tests/deployment-configuration-contract.mjs`: **34 passed, 0 failed**. Covers positive lifecycle, independent review, self-review refusal, stale versions, transaction revision stability, reference and reviewer-authority races, malformed or incomplete dimensions, active limit/refusal paths, capacity-safe saved-command replay, safe read projection and a second tenant remaining unchanged.
- `node node_modules/typescript/bin/tsc --noEmit`: **passed**.
- `npm run build`: **passed**; the build includes `/deployment-configuration` and `/api/deployment-configuration`.
- Evidence: `tests/evidence/saha-114-deployment-configuration/result.json`.

## Limits and remaining gates

The tests use synthetic in-memory tenants and the production compiler. Formal TC-BR-OPS-01-A and TC-BR-OPS-01-B remain Not run. Exact-source CI, separate review, protected merge and observed hosted behaviour remain pending. Provider eligibility is an internal allow/refuse setting and never creates credentials, changes a partner contract, or activates a provider. Hindi remains the existing unreviewed draft language. Operational maxima are deployment safety bounds, not claimed capacity evidence or approved operating policy.
