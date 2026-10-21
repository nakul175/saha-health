# SAHA-124 — withdrawal and downstream effects: local coding completion

20 October 2026. Synthetic local evidence only. Formal acceptance, independent review, CI, merge and observed deployment remain separate and pending.

## Frozen contract and boundary

- Story: SAHA-124 / APL-147, **Withdrawal and downstream effects**.
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-147.md`, SHA-256 `404899ad00426964f586d459ec8c85d1d5c1acf89493378c9c5bc63a2e516cbc`.
- Requirement: BR-SEC-03; CWO refusal: CWO-006-RJ03.
- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`.
- Scope remains synthetic. This change sends no request to a real recipient and does not activate a provider, ABDM consent manager or hosted environment.

## Application behavior completed locally

The existing consent engine already stops unsent programme submissions, prepared EHR publications, mock ABDM grants, pending AI work and reminders; it preserves completed deliveries, receipts, consent history, audit and record revisions. This change closes the identified local follow-through gap for a copy that may already be external:

- Each `in-flight` or `already-sent` programme submission, EHR publication, non-local AI request or reminder can hold an append-only destination-disposition trail.
- A current ASHA or clinician in normal patient scope can append a `request-recorded`, `restriction-confirmed`, `erasure-confirmed`, `retention-confirmed`, `not-found` or `failed` observation with a 3–200 character evidence reference and a 10–1,000 character note.
- Anonymous callers, supervisors/administrators with read or operational authority, other-team care workers, stale patient versions, unknown withdrawal items, stopped/kept items and malformed evidence are refused before mutation.
- Patient-version compare-and-swap prevents two operators from silently overwriting one another. Every accepted update appends a patient revision and a patient-linked audit event with trusted server identity.
- The source delivery and receipt remain unchanged. Even an `erasure-confirmed` entry is displayed and audited as an externally reported result with evidence; Saha does not claim that its command erased a recipient copy.
- The patient consent dialog displays every recorded request/outcome and lets a scoped care user add the next observation. The patient notice stays open for uncertain or already-sent copies until a terminal reported disposition is recorded.
- The per-item 20-entry limit fails closed. Existing history is retained and the response directs the operator to a separately governed review; no earlier evidence is discarded to make room.
- The command is a certified patient-partition operation and remains available during maintenance because it reconciles already external work rather than starting new processing.

## Executed engineering evidence

| Check | Actual result |
| --- | --- |
| `node tests/withdrawal-disposition-contract.mjs` | **30 passed, 0 failed**. Covers the preserved withdrawal behavior plus authority, malformed input, wrong/stopped item, append-only request and result, stale-version race, unchanged accepted delivery and retained audit. Evidence: `tests/evidence/withdrawal-disposition/contract.json`. |
| `SAHA_TEST_PORT=18948 node tests/withdrawal-disposition-http.mjs` | **38 passed, 0 failed** against a built Worker and fresh local D1. Evidence: `tests/evidence/withdrawal-disposition/http.json`. |
| `npm run typecheck` | **Pass**. |
| `npm run build` | **Pass**; production client, server, RSC and Worker output built. |
| `node scripts/test-catalogue.mjs --check` | **Pass**. |

The first direct invocation of `tests/api-smoke.mjs` was invalid because that file is a component loaded by its wrapper. After a fresh D1 and the correct wrapper, the broad suite reached an inherited operations assertion and stopped before the consent component: `operations-smoke.mjs` expected a positive patient count. That failure is retained; it does not replace the focused fresh-Worker evidence above and is not reported as green.

## Separate pending gates

- TC-BR-SEC-03-A, TC-BR-SEC-03-B and TC-J07 remain **Not run** formal acceptance cases.
- A real recipient adapter, real ABDM consent manager, approved completed-transaction retention policy, physical-device/hosted privacy validation and a wider deployed copy inventory remain outside this local implementation and need their named owners and environments.
- Independent source review, exact-source CI, merge and observed deployment have not occurred in this local coding record.

Within the current application boundary and supported local/synthetic adapters, no identified application-code gap remains for recording withdrawal, blocking future affected processing, preserving completed transactions, and tracking downstream disposition without an unsupported erasure claim. This is a local coding-complete statement only.
