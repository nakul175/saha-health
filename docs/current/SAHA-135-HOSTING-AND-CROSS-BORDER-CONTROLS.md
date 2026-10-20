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

Once a policy exists, it is fail closed. A draft refuses configured external processing. An active policy permits only an exact enabled route whose location remains on the policy's approved-location list. External service dispatch checks the prepared policy against fresh state before the access-audit checkpoint and again after it. A changed policy, target, purpose, direction, location or owner authority therefore prevents the request before the transport is invoked. Old policy versions remain in bounded history; audit records append the actor, version, state and reason without personal payload data.

The owner-only `GET /api/hosting-controls` exposes policy metadata and the explicit unconfigured state. Policy changes use the existing authenticated, idempotent `/api/commands` path. Current purpose grants, patient scope, service identity, consent/version and connector checks remain separate conjunctive gates; a hosting route never grants those authorities.

## Validation performed

- `node tests/hosting-controls-contract.mjs` — **25/25 passed**. Covers owner authorization, valid activation, all five processing areas, wrong location/target/purpose/direction refusal, draft refusal, duplicate/invalid input, stale-version race refusal, replay-safe versioning, audit evidence and UI fields. Synthetic only; no provider contacted.
- `node tests/service-dispatch-contract.mjs` — **103/103 passed**. Existing execution-boundary authority and audit-window race coverage remained green with hosting checks wired into the shared dispatch boundary.
- `node tests/environment-contract.mjs` — **inherited harness failure retained**: the base harness omits `installed-transition-authority.js` while transpiling `programmes.ts`; execution stops before environment assertions. This test file was unchanged by SAHA-135.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `npm run build` — passed; `/api/hosting-controls` and `/hosting-controls` are present in the built route catalogue.
- `npm run test:catalogue` — passed: 1,045 suites, 100 component modules, 49 support files.
- `node scripts/audit-requirements.mjs --check` — passed after the requirement evidence was updated.
- `npm run lint:baseline` — passed at the unchanged 1,392-error baseline. Existing warnings remain repository debt; this change adds no lint error.

Exact current-source custody is in `tests/evidence/saha-135-hosting-controls/manifest.json`.

## Limits and gates still pending

This is local coding evidence, not a legal or privacy determination. The owner-approved location vocabulary, actual processor/subprocessor inventory, contracts, backup topology, analytics route and support-access route remain deployment inputs. No provider, credential, hosting setting, database, backup or external transfer was created or activated.

Independent source review, exact-source CI, named privacy/security-owner review, formal execution of TC-BR-SEC-14-A and TC-BR-SEC-14-B, merge, observed deployment and live route inspection remain pending. The formal catalogue cases remain **Not run**.
