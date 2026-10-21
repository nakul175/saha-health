# SAHA-119 local coding completion

## Frozen scope

- Story: SAHA-119 / APL-142 — Training and competency
- Requirement: BR-OPS-06
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-142.md`
- Contract SHA-256: `7bfd81999e08424370792c2521f098608054f61192004f5926e832fdb5f342ff`
- Source base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented behaviour

- Seven role-aware competency modules now cover privacy, patient matching, capture and correction, offline/receipt recovery, model limits, escalation/stop procedure, and real submission status.
- The application records pass or needs-practice assessments with evidence, requires the participant's own acknowledgement of the latest passing assessment, and invalidates stale evidence when pilot context, member role, or member version changes.
- Organisation owners can record a retained restricted or eligible activation review. Eligibility is refused until every role-required module has a current pass and personal acknowledgement.
- Readiness exposes a per-participant activation matrix without exposing other participants' detailed training records to ordinary participants.
- Rehearsal readiness, competency eligibility, and actual live activation remain separate. Even an eligible participant cannot enter live clinical rollout until the external acceptance and still-unbuilt integration gates are satisfied.
- Activation review history, actor authority, optimistic version control, limits, and audit events use the existing pilot command boundary.

## Verification

- Focused contract scenarios: 14 passed, 0 failed.
- Fresh built Worker and D1 HTTP scenarios: 39 passed, 0 failed.
- TypeScript check: passed.
- Production build: passed.
- Test catalogue: passed; 1,046 suites and 100 component modules classified.
- `git diff --check`: passed.

The focused tests cover positive, needs-practice, incomplete, non-owner, restricted, eligible, privacy-bounded, stale-authority, and separate-live-gate paths. Synthetic identities and a fresh local database were used.

## Retained limitations and separate gates

- The historical `tests/pilot-contract.mjs` driver still stops before assertions because its fixed transpilation list omits the inherited `installed-transition-authority.js` dependency. This pre-existing harness failure was retained and was not counted as a pass.
- Formal TC-BR-OPS-06-A and TC-BR-OPS-06-B execution remains Not run.
- Real workforce training, observed role performance, clinical/domain approval, and live cohort activation remain human and operational work.
- Independent review, exact-source CI, push, merge, and observed deployment remain pending and are not claimed by this local coding-completion record.
