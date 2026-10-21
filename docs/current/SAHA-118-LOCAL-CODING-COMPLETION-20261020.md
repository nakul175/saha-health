# SAHA-118 local coding completion — 20 October 2026

## Frozen contract

- Story: SAHA-118 / APL-141, “Support without unnecessary disclosure”
- Requirement: BR-OPS-05
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-141.md`
- Contract SHA-256: `1941cb3cff8a11062e7d4735bb8b39e46dda1364e8b8789e48080543a0f04130`
- Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

The source contract remains authoritative. Its formal cases TC-BR-OPS-05-A and TC-BR-OPS-05-B remain **Not run**. This record covers local application coding and synthetic engineering checks only.

## Implemented outcome

A current ASHA or clinician can open a support case from one of four fixed failed tasks on a current visit. The case stores fixed failure and version metadata. The routine administrator support queue returns that metadata without patient identifiers, names, locations, clinical facts, or visit identifiers.

Patient content follows a separate server-authorized flow:

1. A current administrator support agent records a purpose of at least 20 characters, one or more fixed field groups, and a duration from 15 to 120 minutes.
2. A distinct current owner with ordinary scope over the person approves or denies the request.
3. An approved support read returns only the named field groups. Every read first commits a patient-linked chained audit event and rechecks the grant, support membership, case, person, visit and record versions before returning.
4. Expiry, revocation, changed authority, changed record state or an audit-write failure refuses the read. Resolving a case revokes active access.

The queue, request, decision, revoke and resolution paths use existing command receipts and organisation compare-and-swap persistence. No database, provider, policy, destination, real record or external send was added.

## Local evidence

`tests/support-case-http.mjs` runs against the built Worker and a fresh local D1 database with synthetic identities and data. Its 24 assertions cover task-linked case creation, redacted diagnostics, routine-support zero-patient scope, default and unbounded-scope refusal, request replay, self-approval refusal, distinct scoped-owner approval, expiry, fail-closed audit storage, field-limited disclosure, patient-linked audit, revocation, stale and concurrent writes, redacted resolution, unchanged clinical records and an intact audit chain.

Evidence: `tests/evidence/saha-118-support-case/http.json` and `tests/evidence/saha-118-support-case/completion.json`.

The first integration run stopped when an idempotent administrator grant-request replay entered the ordinary patient accessor and returned 403. That failed result was retained in the completion record. The replay path now reauthorizes the support command through the support-case policy while keeping the administrator patient workspace empty; the final suite passes.

Additional checks:

- `npm run typecheck` — passed.
- `npm run build` — passed; `/api/support-cases` appears in the production route output.
- `node scripts/test.mjs --check-catalogue` — passed.
- Documentation and requirements checks — recorded in completion evidence.

## Separate pending gates

- Independent source review: pending.
- Exact-source CI: pending.
- Formal TC-BR-OPS-05-A/B execution and Deployment operations acceptance: pending.
- Human/domain/privacy acceptance: pending.
- Merge: pending.
- Observed staging/production deployment: pending.

The local coding-complete claim means no application-code gap was identified against this frozen story after the listed checks. It is not a formal acceptance, merge, deployment or observed-hosting claim.
