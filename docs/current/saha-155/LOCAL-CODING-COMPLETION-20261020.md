# SAHA-155 contextual Aplyd Academy learning — local coding completion

Date: 20 October 2026

## Scope

The user approved the proposed APL-178 / CWO-021 criteria as the frozen product scope. The exact contract is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-178.md` in the project workspace, SHA-256 `22b9b679a53dc042772eaf0986420e08176580b7b406b4122a98c1cd77e15b06`.

An assigned ASHA may see optional, source-bound Aplyd Academy material inside an already-authorised routine-visit task. The existing selected person, visit draft and task controls remain in place. Learning adds no login, completion record or care gate. Missing, irrelevant or invalid content becomes a non-blocking unavailable state. No patient or visit detail is sent to Academy.

## Implemented boundary

- `lib/saha/contextual-academy.ts` strictly validates a bounded, versioned catalogue in `SAHA_ACADEMY_CONTEXT_CATALOGUE`. It accepts only a `routine-visit` item for an ASHA, only the `aplyd-academy` source kind, and verifies a SHA-256 binding across the complete item and source edition.
- The shipped default has no catalogue and therefore displays a safe unavailable state. No Academy content, provider, policy or external service was invented or enabled.
- `GET /api/contextual-academy?personId=…` authenticates the actor, loads exactly one selected person, requires an active ASHA role and exact current assignment, writes a durable access audit without content or person detail, and rechecks assignment after all awaited work immediately before disclosure.
- The routine screen fetches learning only after its existing actor/person/organisation binding is established. It checks the returned actor binding, clears protected routine content if authority changes, and otherwise leaves the care task usable when learning cannot be supplied.
- The inline panel opens and closes an optional item without navigation, persistence, a provider call or completion inference. The existing guided capture remains mounted.

## Actual local validation

| Gate | Result | Evidence |
| --- | --- | --- |
| Resolver and source-integration contract | 35 passed, 0 failed, 0 skipped | `tests/evidence/saha-155-contextual-academy/contract.json` |
| Built Worker + local D1 HTTP | 18 passed, 0 failed, 0 skipped | `tests/evidence/saha-155-contextual-academy/http.json` |
| Affected routine authority, organisation, recovery and browser suites | 4 suites; 638 passed, 0 failed, 0 skipped; regression guard passed | `tests/evidence/saha-155-contextual-academy/affected-summary.json` |
| TypeScript | `tsc --noEmit` passed | local execution on 20 October 2026 |
| Production build | `next build` passed and included `/api/contextual-academy` | local execution on 20 October 2026 |
| Test catalogue | 1,046 suites and 100 component modules classified; check passed | local execution on 20 October 2026 |

The HTTP test uses synthetic identities/content and an actual locally built Worker with D1. It covers the positive path; anonymous, wrong-role, non-member, unassigned, extra-selector and duplicate-selector refusals; a native database trigger that changes membership after the audit but before the final guard; restored authority; invalid configuration; ordinary-task availability; and absence of Academy receipts/provider calls.

## Retained failure

The first affected-suite run exposed that adding learning to the existing routine response changed its frozen exact response shape: 393 checks passed and 3 failed. The failed approach was removed. Learning now uses a separate GET-only endpoint; the subsequent affected run passed 638/638. The retained failure receipt is `tests/evidence/saha-155-contextual-academy/initial-routine-shape-failure.json`.

## Limits and remaining gates

This is truthful local application-code completion for the approved SAHA-155 scope. It does not approve Academy content, enable an external Academy provider, establish formal domain/clinical acceptance, prove field usability, complete independent review, run GitHub CI, merge the branch or observe a deployment. Those gates remain separate. A real catalogue must be explicitly approved and configured before any learning item becomes available.

## CI repair verification

The final candidate removes the new React lint error, classifies `/api/contextual-academy` in the current authorization matrix, preserves the immutable original matrix, preserves the original 389 guarded baseline digest, and registers only the two observed Academy minima. The repaired current matrix passed 72/72 with its regression guard; exact-source GitHub CI and independent final-tree review remain pending.
