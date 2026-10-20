# SAHA-154 optional assignment — local coding completion candidate

20 October 2026. Exact base `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. Synthetic data only. No provider, real rate, claim approval, payment, settlement, merge or deployment is involved.

## Contract custody and boundary

The local planning snapshot is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-177.md`, SHA-256 `7daa9f2e7aea4c364228da611911bed1dd528c60cbdd33664000867e89a3fcc5`. It identifies SAHA-154 / APL-177 and CWO-014. That snapshot also says the originating CWO narrative and approved item-level acceptance contract are absent, the proposed scenarios are not approved or frozen, and source reconciliation or an explicit source-bound product/domain decision is required before Ready.

This implementation therefore qualifies only as a local application candidate against the described proposed positive, refusal, authorization and recovery scenarios. It does not freeze or amend product acceptance and cannot satisfy formal, domain or clinical approval.

## Implemented behavior

- An active owner can offer one bounded optional assignment to an active ASHA who currently belongs to the named team. The invitation stores a title, summary, evidence prompt and future due date; it stores no amount, rate, provider, bank detail or payment promise.
- The invited ASHA alone can accept or decline. Declining or ignoring an invitation leaves routine people, visits, submissions, outreach, care access, incentive schedules and incentive claims unchanged.
- After acceptance the worker can submit evidence, append a corrected revision and withdraw the active revision. Earlier revisions remain as inactive history. The owner can cancel an open assignment without deleting the worker's choice or evidence history.
- Every transition is server-authorized against the current account and team membership, version checked, audited without free-text or patient content, bounded by the existing operations-state limit and protected by the existing idempotency receipt mechanism. Wrong-scope actors receive no assignment detail; stale writes fail with `409`; replay does not duplicate the transition.
- The existing synthetic incentive-claims panel now presents the invitation, explicit choice and evidence flow separately from routine work, claims and payment. The notice says that the assignment does not promise or trigger payment.

## Verification

- `node tests/saha154-optional-assignment-contract.mjs`: **46 passed, 0 failed**. This covers owner-only offer, target/team/due/input refusal, worker scoping, current-authority loss, accept/decline, stale-version races, evidence append/correction/withdrawal, cancellation, preserved routine state and zero claims/schedules.
- `SAHA_TEST_PORT=8874 node scripts/test.mjs integration --only integration/run-api-smoke --fast --guard --report tests/reports/saha154-api-summary.json`: **5,047 passed, 0 failed**, minimum guard passed. The actual built Worker/local-D1 flow includes two independent concurrent acceptance writes with statuses `200` and `409`, idempotent replay, wrong-worker refusal, correction, withdrawal and cancellation.
- `npm run typecheck` and `npm run build`: passed. The build emitted only the inherited chunk-size advisory.
- `npm run lint:baseline`: passed at the existing **1,392 errors / 632 warnings** baseline. Focused ESLint is not claimed green: it exposed existing file debt; three newly introduced `any` annotations were removed before the baseline pass.
- `node scripts/test.mjs --check-catalogue`: passed with **1,044 suites / 100 components**, every smoke imported.
- `node scripts/audit-requirements.mjs --check` and documentation generation/checks: passed after the evidence mapping update.

The first local integration attempt was blocked before execution by `listen EPERM 127.0.0.1`; that failure is retained. The permitted fresh-runtime execution above passed, restored the tracked fixture state and disposed the runtime. Port `8874` was free afterward.

The inherited `tests/incentive-claims-contract.mjs` direct runner also remains red before assertions because its historical transpile inventory omits `installed-transition-authority.js`. Historical test evidence was preserved rather than rewriting that pinned file. The SAHA-154-owned `tests/saha154-optional-assignment-contract.mjs` carries the complete current dependency inventory and passes 46 checks; the fresh Worker/D1 suite independently exercises the installed current source.

## Truthful completion statement

No identified application-code gap remains against the proposed local scenario described in the available APL-177 snapshot. Local coding and synthetic testing can be recorded complete for that limited candidate. Whole-story frozen acceptance cannot be claimed until the missing CWO-014 narrative is reconciled or a responsible product/domain owner adopts a reviewed, versioned source-bound contract.

Separate pending gates are source reconciliation, independent source review, exact-source CI, product/domain/formal approval, merge, and exact observed deployment. Real eligibility rules, incentive rates, claim approval and payment settlement remain intentionally outside this implementation.
