# SAHA-127 tenant and record isolation — local coding completion

- Date: 20 October 2026
- Canonical issue: APL-150
- Requirement: BR-SEC-06
- Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
Frozen contract SHA-256: `35e27874ac0f51260b00b48316388872b6880f027f18639576af30655b319523`

## Implemented boundary

An explicitly supplied organisation ID is now treated as authority input at the common tenant resolver. The server verifies a current active membership before it can resolve a patient target, search, report, export or traffic-triggered background path in that tenant. Missing, foreign and revoked memberships receive the same refusal, preventing the organisation header from becoming a tenant-existence oracle. Existing route-specific role, assignment, purpose, record-scope and final authority checks remain in force.

The focused synthetic Worker/D1 exercise covers:

- authorised search, patient partition retrieval, FHIR download, media retrieval and data archive;
- foreign-tenant refusal before workspace, patient list/detail, work-list, FHIR, media, operations and archive work, with no tenant marker in the response;
- identical missing-tenant and foreign-tenant refusal;
- a user authorised in two tenants reusing tenant A patient, visit and media IDs in tenant B;
- search result/count isolation, wrong-record transaction refusal with byte-equivalent tenant-B state, and archive exclusion;
- immediate suspension refusal;
- database joins proving visit and media lineage stays inside the patient tenant; and
- membership withdrawal while an archive is being prepared, which withholds the prepared bytes.

No clinical policy, provider, schema, migration, hosting configuration or external recipient was added. The fixture uses only synthetic local identities and records.

## Evidence

| Check | Result |
| --- | --- |
| `node tests/tenant-record-isolation-http.mjs` | 44 passed, 0 failed; actual built Worker and fresh local D1 |
| `npm run typecheck` | pass |
| `npm run build` | pass; the existing bundle-size warning remains |
| `SAHA_TEST_PORT=18951 node tests/nfr/authorisation-matrix.mjs` | 59 passed, 1 failed; 512 role cells; grid `0d3bb4dbddbb8de5` |

The single broad-matrix failure is retained. Its route catalogue does not classify 17 newer GET routes already recorded in `docs/current/HTTP-ROUTES.csv`. All exercised foreign-organisation, suspension, command and refusal checks passed. The product guard and the catalogue expectation were not weakened to obtain a green result. Exact details are in `tests/evidence/tenant-record-isolation/authorisation-matrix-boundary.json`.

## Truthful status

Within the current application boundary, no identified application-code gap remains for early explicit-tenant resolution or the existing downstream transaction, search, retrieval, media, report and export record controls exercised here. This supports a **local coding-complete** status for SAHA-127; it is not formal acceptance.

BR-SEC-06 remains `partial`. The source formal cases TC-BR-SEC-06-A and TC-BR-SEC-06-B were not run. Independent adversarial assessment of hosted backup/restore, future indexes and retrieval stores, hosted media/file-link delivery, and independently scheduled/asynchronous infrastructure remains required. Independent source review, exact-source CI, merge and observed deployment also remain pending.

## Evidence files

- `tests/tenant-record-isolation-http.mjs`
- `tests/evidence/tenant-record-isolation/http.json`
- `tests/evidence/tenant-record-isolation/authorisation-matrix-boundary.json`
- `lib/saha/server.ts`
