# SAHA-154 optional assignment — local coding completion

20 October 2026. Exact base `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. Synthetic data only. No provider, real rate, claim approval, payment, settlement, merge or deployment is involved.

## Contract custody and boundary

The local planning snapshot is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-177.md`, SHA-256 `7daa9f2e7aea4c364228da611911bed1dd528c60cbdd33664000867e89a3fcc5`. It identifies SAHA-154 / APL-177 and CWO-014. That snapshot says the originating CWO narrative is absent and permits an explicit source-bound product/domain decision to adopt its proposed criteria.

On 20 October 2026 the product sponsor explicitly approved those proposed criteria in the delivery chat. [SAHA-154 approved local acceptance contract](SAHA-154-ACCEPTANCE-CONTRACT.md) binds that decision to the exact snapshot and freezes the local positive, refusal, authorization, recovery, evidence/claim separation, and no-payment-activation boundaries. The approval does not recover the unavailable original narrative or satisfy independent review, formal, clinical, CI, merge, or deployment gates.

## Implemented behavior

- An active owner can offer one bounded optional assignment to an active ASHA who currently belongs to the named team. The invitation stores a title, summary, evidence prompt and future due date; it stores no amount, rate, provider, bank detail or payment promise.
- The invited ASHA alone can accept or decline. Declining or ignoring an invitation leaves routine people, visits, submissions, outreach, care access, incentive schedules and incentive claims unchanged.
- After acceptance the worker can submit evidence, append a corrected revision and withdraw the active revision. Earlier revisions remain as inactive history. The owner can cancel an open assignment without deleting the worker's choice or evidence history.
- Every transition is server-authorized against the current account and team membership, version checked, audited without free-text or patient content, bounded by the existing operations-state limit and protected by the existing idempotency receipt mechanism. Wrong-scope actors receive no assignment detail; stale writes fail with `409`; replay does not duplicate the transition.
- The existing synthetic incentive-claims panel now presents the invitation, explicit choice and evidence flow separately from routine work, claims and payment. The notice says that the assignment does not promise or trigger payment.
- If an optional-assignment response is unavailable, the panel retains the exact operation key and body bound to the initiating account and organisation. It visibly labels that row as `outcome unconfirmed`, blocks another assignment transition while routine work stays usable, and permits only an exact replay under current authority. If the recovery refresh is unavailable, displayed values are explicitly labelled `last confirmed` rather than current.

## Verification

- `node tests/saha154-optional-assignment-contract.mjs`: **47 passed, 0 failed**. This covers owner-only offer, target/team/due/input refusal, worker scoping, current-authority loss, accept/decline, stale-version races, evidence append/correction/withdrawal, cancellation, projected storage-bound refusal with no mutation, preserved routine state and zero claims/schedules.
- `node scripts/test.mjs integration --only integration/saha154-optional-assignment-uncertainty-browser --fast --guard`: **9 passed, 0 failed**, minimum guard passed. The phone UI uses the actual built Worker/local D1 to commit a cancellation while losing its response, retain and replay the exact key/body, show unresolved and unavailable labels, keep routine refresh usable, and prove one durable transition with no duplicate history event.
- `SAHA_TEST_PORT=8874 node scripts/test.mjs integration --only integration/run-api-smoke --fast --guard --report tests/reports/saha154-api-summary.json`: **5,047 passed, 0 failed**, minimum guard passed. The actual built Worker/local-D1 flow includes two independent concurrent acceptance writes with statuses `200` and `409`, idempotent replay, wrong-worker refusal, correction, withdrawal and cancellation.
- `npm run typecheck` and `npm run build`: passed. The build emitted only the inherited chunk-size advisory.
- `npm run lint:baseline`: passed at **1,392 errors**, equal to the governed error baseline. It reported **632 warnings** against a recorded 618-warning reference; warnings are reported but are not the enforced error gate. Focused ESLint is not claimed green: it exposed existing file debt; newly introduced `any` annotations were removed before the baseline pass.
- `node scripts/test.mjs --check-catalogue`: passed with **1,046 suites / 100 components**, every smoke imported.
- `node scripts/audit-requirements.mjs --check` and documentation generation/checks: passed after the evidence mapping update.

The first local integration attempt was blocked before execution by `listen EPERM 127.0.0.1`; that failure is retained. The permitted fresh-runtime execution above passed, restored the tracked fixture state and disposed the runtime. Port `8874` was free afterward.

The inherited `tests/incentive-claims-contract.mjs` direct runner also remains red before assertions because its historical transpile inventory omits `installed-transition-authority.js`. Historical test evidence was preserved rather than rewriting that pinned file. The SAHA-154-owned `tests/saha154-optional-assignment-contract.mjs` carries the complete current dependency inventory and passes 47 checks; the fresh Worker/D1 suite independently exercises the installed current source.

## Truthful completion statement

No identified application-code gap remains against the approved source-bound local contract. Local coding and synthetic testing are complete for SAHA-154.

Separate pending gates are independent source review, exact-source CI, formal and real-use domain approval, merge, and exact observed deployment. Real programme eligibility policy, incentive rates, claim approval, provider activation, and payment settlement remain intentionally outside this implementation.
