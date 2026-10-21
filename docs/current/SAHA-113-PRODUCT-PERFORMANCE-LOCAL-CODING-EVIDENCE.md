# SAHA-113 product performance — local coding evidence

This record covers **SAHA-113 / APL-136 / BR-REP-07** only. It is local engineering evidence, not formal QA, clinical or product approval, merge evidence, deployment evidence, or observed pilot benefit.

## Frozen inputs

- Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-136.md`
- Contract file SHA-256: `b8439961ee64b8685d8a12e68ab503d0688e26e0b33ca8f720d4e1c32d5c2017`
- Original description SHA-256 retained by the contract: `e1998618e15644de204283af949143328a163e2b818f7189650c0315429f9662`
- Source plus v4.2 refinement SHA-256 retained by the contract: `afebec3785b3a13b0b37ede26d1b474d54df55006118ec911b07e222a617784d`

## Implemented application behavior

- The existing protected Operations response now contains a versioned product-performance projection for a product evaluator with current reporting purpose and authority.
- The projection compares the selected UTC window with the immediately preceding equal window for reuse, task completion, corrections, provider use, sync outcomes, support burden, completed timing samples, requests and server errors.
- Reuse, completion, correction and provider counts are computed only from the current authorised Saha records. Imported, voided and superseded visits are excluded where applicable.
- Sync and self-reported burden accept fixed count codes only. Durable assistance workflow requests/acknowledgements and completed timing samples are counted separately so heterogeneous sources are not double-counted.
- Rates are null unless the denominator is at least five. A current cohort under five is withheld.
- Organisation-wide operational counters are released only when the evaluator's current reporting authority covers every current assigned person. Restricted or partial scope receives a refusal-safe withheld result.
- Existing aggregate disclosure controls remain authoritative: if the protected care report is withheld, product performance is also withheld.
- A second state and counter read after the audit refuses stale authority, source or metric inputs with `409`; the existing bounded pre-audit retry remains intact.
- The Operations UI shows only aggregate current/baseline values and explicit coverage/denominator limitations. Because request telemetry is pruned after 30 days, its comparison is exposed only for the 7-day selection; longer selections say unavailable. The response carries no patient id, name, recording, transcript, clinical note, URL, header or exception text.

## Verification on the exact local source

| Check | Result |
|---|---:|
| `node scripts/test.mjs unit --only unit/product-performance-contract --fast` | 7 passed, 0 failed |
| `node scripts/test.mjs unit --only unit/operations-pre-alert-recovery-contract --fast` | 61 passed, 0 failed |
| `node scripts/test.mjs integration --only integration/run-api-smoke --fast --timeout 25` | 5,020 passed, 0 failed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `node scripts/test.mjs --check-catalogue` | passed |

The first sandboxed integration attempt could not bind `127.0.0.1` (`EPERM`) before a test ran. The same repository command was then run with approved local-port access and passed 5,020 checks. A direct legacy `tests/operations-contract.mjs` invocation also stops before assertions because its pre-existing fixed transpile list omits `installed-transition-authority.js`; the current protected whole-function operations recovery contract and the full HTTP suite passed.

## Remaining separate gates

- Formal `TC-BR-REP-07-A` and `TC-BR-REP-07-B` remain **Not run**.
- Independent source review and required product/domain approval remain pending.
- Comparable observed baseline and pilot evaluation remain pending.
- Real uncertain transport-to-receipt recovery and external help-desk/ticket linkage remain pending.
- CI on a published exact-source revision, merge, and observed deployment remain pending.

With those gates kept separate, no identified local application-code gap remains against the frozen product-performance behavior. This record supports a truthful **local coding-complete candidate** status only.
