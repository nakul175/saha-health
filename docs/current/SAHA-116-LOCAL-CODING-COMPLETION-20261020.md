# SAHA-116 local coding completion — 2026-10-20

## Custody

- Story: SAHA-116 / APL-139 — Versioned configuration publication and rollback
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-139.md`
- Contract SHA-256: `63116b082bb102982244c3e99225d58f5e60cd160bee89178a3fa6485d568277`
- Base commit: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Original requirements retained: BR-OPS-03 and NFR-19
- Fixture and formal cases retained: FX-OPS-03, FX-OPS-03-NEG, FX-NFR-19, FX-NFR-19-NEG; all remain formally **Not run**.

## Application behavior implemented

- Owners can stage immutable, monotonically versioned manifests for programme packs, language content, knowledge sources, model versions and mappings. Each manifest binds the configuration kind/key, release and schema versions, content SHA-256, documented source, change summary and impact summary.
- A different current owner, administrator or clinician must approve the exact manifest. Self-review, ordinary-worker access, stale actor authority and stale registry attestations fail closed.
- Owners can publish only the exact independently approved manifest. Earlier publication periods and all version histories remain retained; work is never rewritten to claim a later version.
- Rollback is a separate prepare, independent-review and execute flow. It binds current and target manifests, impact, reason and proposer authority. A schema-incompatible rollback requires an explicit migration bound to both schema versions, its content hash and evidence reference.
- Registry attestations detect undocumented stored-state drift and block subsequent release operations. Bounded idempotent commands, exact receipt replay/recovery, organisation scoping, CSRF checks and audit entries are retained.
- The Operations interface exposes role-specific staging, review, publication and rollback actions without presenting a proposer with a self-review action or a reviewer with an owner-only execution action.

## Verification performed against this source

- `node tests/configuration-publication-contract.mjs`: **23/23 passed**. Covers all five kinds, immutable manifests, independent review, supersession, compatible-migration rollback, retained history, changed authority, stale state and drift refusal.
- `node tests/configuration-publication-http.mjs`: **29/29 passed** against an owned synthetic Worker and fresh D1 database. Covers owner staging, ordinary-worker read/write refusal, exact replay and receipt recovery, self-review refusal, independent publication and rollback review, supersession, rollback, stale-race refusal and stored readback.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run build`: passed; `/api/configuration-publications` is present in the production route manifest.
- `git diff --check`: passed.

The inherited direct `tests/operations-contract.mjs`, `tests/pack-installation-contract.mjs` and `tests/programme-migration-contract.mjs` harnesses were also attempted during implementation. They stop before assertions because their fixed transpile list omits the already-existing `installed-transition-authority.js` dependency. This unrelated pre-existing harness failure is retained and is not represented as a pass. The focused contract and fresh Worker/D1 integration above execute the new behavior directly.

## Remaining gates

This record supports **local coding complete** and **locally tested** only. Independent source review, formal QA execution of the four frozen cases, deployment-operations acceptance, any required domain/human approval, exact-source CI, merge, and observed deployment remain pending and separate. No provider, real patient, external send, new database/hosting service, destructive migration, clinical policy, approval, merge or deployment was created or claimed.
