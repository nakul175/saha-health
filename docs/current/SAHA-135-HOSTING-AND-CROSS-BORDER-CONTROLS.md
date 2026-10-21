# SAHA-135 — Hosting and cross-border controls

Date: 20 October 2026
Canonical story: SAHA-135 / APL-158
Requirement: BR-SEC-14
Frozen contract SHA-256: `0787b5e90c8ca7c7f427f19e3ba7e0eb6995631148c82b8f667740a0bda920b1`
Exact qualified-integration parent: `f3c536f6725721bd371c5ef71c38807e2181eafe`

## Local application behavior

An organisation owner can record a versioned deployment policy at `/hosting-controls`. The policy does not supply or infer a country, jurisdiction, provider, agreement, or legal basis. The owner must enter:

- the approved deployment locations;
- one or more exact routes covering primary storage, providers, backups, analytics and support;
- each route's target, purpose, direction, location and deployment-authority reference; and
- whether the version is a draft or active, with a reason.

Once a policy exists, it is fail closed. A draft refuses application-state persistence and configured external processing. Activation binds the primary-storage, backup, analytics and support routes to the server's explicit deployment-location configuration; a missing or mismatched deployed location refuses activation. The shared persistence boundary reads the current runtime primary-storage location and checks it against the versioned route on entry and again immediately before every application-state D1 batch, including batches with imported-evidence side rows. It never substitutes the location captured when the policy was activated. Private media performs the same live-location check before custody work, after its audit/fresh-state boundary, after custody storage, after object staging and again through central persistence. A runtime location change therefore refuses the next custody, object or D1 side effect. Support diagnostics, aggregate-indicator CSV exports and the operations clinical CSV export check their configured locations before release and again after fresh-state audit/authority checkpoints. Registered HTTP adapters record deployment location as part of versioned configuration. Independent frontline and anaemia routes record a separate actual provider location on their versioned hosting route. External dispatch resolves the exact target, purpose and direction location, then rechecks it after the access audit. A changed policy, target, purpose, direction, actual location or owner authority prevents persistence, export or provider transport.

The backup route is bound at activation to the declared backup deployment location. This release has no backup transfer job or backup transport path; therefore it creates no provider request that could bypass the guard. Any future backup executor must use the same exact-route assertion before transfer and again after its audit checkpoint.

The pre-dispatch access audit retains the hosting policy version, route identifier, matched location and owner authority reference, without personal payload data. Old policy versions remain in bounded history. No endpoint location is inferred from a hostname and no jurisdiction or legal basis is supplied by the product.

The owner-only `GET /api/hosting-controls` exposes policy metadata and the explicit unconfigured state. Policy changes use the existing authenticated, idempotent `/api/commands` path. Current purpose grants, patient scope, service identity, consent/version and connector checks remain separate conjunctive gates; a hosting route never grants those authorities.

## Validation performed

- `node tests/hosting-controls-contract.mjs` — **51/51 passed**. Covers owner authorization, active deployment binding for storage/backup/analytics/support, executable shared primary-storage and analytics assertions, explicit activation, draft refusal, live runtime-location mismatch and change refusal with no normal/imported-evidence/media side effect, media/persistence boundary wiring, provider actual-location refusal, duplicate/invalid input, stale-version races, replay-safe versioning, audit evidence and UI fields. Synthetic only; no provider contacted.
- `node tests/service-dispatch-contract.mjs` — **115/115 passed**. Existing execution-boundary authority and audit-window race coverage remained green; independent provider positive and actual-location race/refusal paths now execute beside registered-adapter location checks and retained policy/route/location/authority audit evidence.
- `node tests/supply-chain-assurance-contract.mjs` — **45/45 passed**; `node tests/incident-response-contract.mjs` — **24/24 passed**.
- Relevant persistence/provider suites passed: media **5/5**, object media **22/22**, imported evidence **26/26**, frontline provider **109/109**, anaemia provider **58/58**.
- `node tests/report-export-contract.mjs` — harness stopped before assertions because its temporary compiler omitted the existing `data-flow-authority.js` dependency required by `mis.js`; retained as a test-harness failure, not a product pass.
- `node tests/environment-contract.mjs` — **29/29 passed** on the current parent. The older missing `installed-transition-authority.js` harness failure is no longer present.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `npm run build` — passed; `/api/hosting-controls` and `/hosting-controls` are present in the built route catalogue.
- `npm run test:catalogue` — **inherited current-parent HOLD retained**: three later tests are unclassified (`point-of-need-help-browser.mjs`, `point-of-need-help-component.mjs`, and `saha154-optional-assignment-uncertainty-browser.mjs`). No catalogue pass is claimed for this successor.
- `node scripts/audit-requirements.mjs --check` — **inherited current-parent HOLD retained**: generated traceability currently differs at the programme-wide implemented/partial counts and accumulated narrative. No regeneration is included in this story successor.
- `node scripts/test.mjs uat --fast` — **not run because the inherited catalogue guard failed first** on those same three unclassified later tests. The formal catalogue cases remain **Not run**.
- `node tests/nfr/authorisation-matrix-current.mjs` — the owner-only hosting-control route remained green in the actual Worker/D1 matrix; the aggregate current matrix is **68/73**, with five inherited assertions outside SAHA-135 failing. Those failures are retained and no clean aggregate authorization pass is claimed.
- Accumulated successors remained intact: SAHA-155 contextual Academy contract **35/35** and actual Worker/D1 HTTP **18/18**; SAHA-156 point-of-need help contract **30/30**, actual component **16/16**, and actual Worker/D1/Chromium journey **11/11**. The current indicator, reuse and report-export privacy registration adapters also passed.
- `npm run lint:baseline` — passed at the unchanged 1,392-error baseline. Existing warnings remain repository debt; this change adds no lint error.
- The historical candidate documentation check referenced `application-saha135-hosting-controls-r3-sha256.json`; that manifest is unavailable in this accumulated successor, so no successor documentation-integrity pass is claimed from it. Exact successor custody is recorded separately.

The exact staged successor custody receipt is `docs/verification/integration-saha135-hosting-controls-20261021-receipt.json`; its source review is recorded there, and the current factual evidence/custody correction remains staged for independent verification.

## Limits and gates still pending

This is local coding evidence, not a legal or privacy determination. The owner-approved location vocabulary, actual processor/subprocessor inventory, contracts, backup topology, analytics route and support-access route remain deployment inputs. No provider, credential, hosting setting, database, backup or external transfer was created or activated.

Independent verification of the staged factual custody correction, exact-source CI, named privacy/security-owner review, formal execution of TC-BR-SEC-14-A and TC-BR-SEC-14-B, merge, observed deployment and live route inspection remain pending. The formal catalogue cases remain **Not run**.
