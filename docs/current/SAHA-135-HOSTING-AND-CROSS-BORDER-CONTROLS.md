# SAHA-135 — Hosting and cross-border controls

Date: 20 October 2026
Canonical story: SAHA-135 / APL-158
Requirement: BR-SEC-14
Frozen contract SHA-256: `0787b5e90c8ca7c7f427f19e3ba7e0eb6995631148c82b8f667740a0bda920b1`
Exact implementation base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Local application behavior

An organisation owner can record a versioned deployment policy at `/hosting-controls`. The policy does not supply or infer a country, jurisdiction, provider, agreement, or legal basis. The owner must enter:

- the approved deployment locations;
- one or more exact routes covering primary storage, providers, backups, analytics and support;
- each route's target, purpose, direction, location and deployment-authority reference; and
- whether the version is a draft or active, with a reason.

Once a policy exists, it is fail closed. A draft refuses configured external processing. Activation binds the primary-storage, backup, analytics and support routes to the server's explicit deployment-location configuration; a missing or mismatched deployed location refuses activation. Every authenticated command against an active policy checks the actual primary-storage location before execution, including organisation joins. Support diagnostics and aggregate-indicator CSV exports check their actual configured locations both before release and after their fresh-state audit/authority checkpoint. Each registered HTTP adapter records its deployment location as part of its versioned configuration. External service dispatch requires that actual adapter location to match the exact enabled provider route, checks the prepared policy against fresh state before the access-audit checkpoint, and checks it again afterward. A changed policy, target, purpose, direction, adapter location or owner authority therefore prevents persistence, export or provider transport.

The backup route is bound at activation to the declared backup deployment location. This release has no backup transfer job or backup transport path; therefore it creates no provider request that could bypass the guard. Any future backup executor must use the same exact-route assertion before transfer and again after its audit checkpoint.

The pre-dispatch access audit retains the hosting policy version, route identifier, matched location and owner authority reference, without personal payload data. Old policy versions remain in bounded history. No endpoint location is inferred from a hostname and no jurisdiction or legal basis is supplied by the product.

The owner-only `GET /api/hosting-controls` exposes policy metadata and the explicit unconfigured state. Policy changes use the existing authenticated, idempotent `/api/commands` path. Current purpose grants, patient scope, service identity, consent/version and connector checks remain separate conjunctive gates; a hosting route never grants those authorities.

## Validation performed

- `node tests/hosting-controls-contract.mjs` — **36/36 passed**. Covers owner authorization, active deployment binding for storage/backup/analytics/support, exact assertions for all five processing areas, primary-storage command wiring, support and analytics export wiring and final-response revocation races, actual adapter-location mismatch, wrong policy location/target/purpose/direction refusal, draft refusal, duplicate/invalid input, stale-version race refusal, replay-safe versioning, audit evidence and UI fields. Synthetic only; no provider contacted.
- `node tests/service-dispatch-contract.mjs` — **104/104 passed**. Existing execution-boundary authority and audit-window race coverage remained green; the new checks cover an otherwise approved adapter repointed to an unapproved location and retained policy/route/location/authority audit evidence.
- `node tests/environment-contract.mjs` — **inherited harness failure retained**: the base harness omits `installed-transition-authority.js` while transpiling `programmes.ts`; execution stops before environment assertions. This test file was unchanged by SAHA-135.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `npm run build` — passed; `/api/hosting-controls` and `/hosting-controls` are present in the built route catalogue.
- `npm run test:catalogue` — passed: 1,045 suites, 100 component modules, 49 support files.
- `node scripts/audit-requirements.mjs --check` — passed after the requirement evidence was updated.
- `node scripts/test.mjs uat --fast` — **63/63 passed** after the generated UAT pack was refreshed. BR-SEC-14 is now runnable as `implemented-local`; the catalogue cases remain formally **Not run** until named execution and review occur.
- `node scripts/test.mjs nfr --only nfr/authorisation-matrix --fast --guard --report tests/reports/native-authorization-current-summary.json` — **71/71 passed**. The new owner-only GET route is exercised across all eight synthetic principals, including denial and disclosure checks.
- `npm run lint:baseline` — passed at the unchanged 1,392-error baseline. Existing warnings remain repository debt; this change adds no lint error.
- `python3 scripts/check-documentation.py` with the bundled current Python runtime — passed against `application-saha135-hosting-controls-r3-sha256.json`: 2,077 current source files pinned, 176 requirements and 364 formal cases preserved, 38 generated documents verified. This is integrity evidence, not product execution or formal acceptance.

Exact current-source custody is in `tests/evidence/saha-135-hosting-controls/manifest.json`.

## Limits and gates still pending

This is local coding evidence, not a legal or privacy determination. The owner-approved location vocabulary, actual processor/subprocessor inventory, contracts, backup topology, analytics route and support-access route remain deployment inputs. No provider, credential, hosting setting, database, backup or external transfer was created or activated.

Independent source review, exact-source CI, named privacy/security-owner review, formal execution of TC-BR-SEC-14-A and TC-BR-SEC-14-B, merge, observed deployment and live route inspection remain pending. The formal catalogue cases remain **Not run**.
