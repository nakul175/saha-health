# SAHA-155 contextual Aplyd Academy learning — local coding completion

Date: 20 October 2026

## Scope

The native Linear APL-178 **Frozen scope and acceptance criteria — v1.0 (15 October 2026)** section is pinned byte-for-byte at `docs/current/saha-155/APL-178-FROZEN-V1.0.md`, SHA-256 `1f3d5b084620aceac527f9fac9b12d8ff517bc42d6f6bc6065ecfe5871c2ae44`. The native issue was read at updated time `2026-10-20T15:47:03.936Z`; the export ends immediately before its later **Historical delivery reconciliation checkpoint** section.

The project snapshot `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-178.md`, SHA-256 `22b9b679a53dc042772eaf0986420e08176580b7b406b4122a98c1cd77e15b06`, is retained separately as historical pre-freeze provenance. It does not contain the native frozen v1.0 section and is not represented as the current exact contract.

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
| Built Worker + local D1 HTTP | Current staged-source rerun: 18 passed, 0 failed, 0 skipped. Historical candidate receipt retained separately. | `tests/evidence/saha-155-contextual-academy/http-current.json` and `http.json` |
| Affected routine authority, organisation, recovery and browser suites | 4 suites; 638 passed, 0 failed, 0 skipped; regression guard passed | `tests/evidence/saha-155-contextual-academy/affected-summary.json` |
| TypeScript | `tsc --noEmit` passed | local execution on 20 October 2026 |
| Production build | `next build` passed and included `/api/contextual-academy` | local execution on 20 October 2026 |
| Test catalogue | Current integration catalogue: 1,147 suites and 100 component modules classified; check passed | local execution on 20 October 2026 |

The HTTP test uses synthetic identities/content and an actual locally built Worker with D1. It covers the positive path; anonymous, wrong-role, non-member, unassigned, extra-selector and duplicate-selector refusals; a native database trigger that changes membership after the audit but before the final guard; restored authority; invalid configuration; ordinary-task availability; and absence of Academy receipts/provider calls.

The current local smoke route sweep supplies the exact assigned person selector and executes this route as the assigned synthetic ASHA. The endpoint retains its fail-closed parameterless `400 Choose one assigned person` behavior; the adapter does not make the selector optional. The immutable historical `tests/smoke/local-smoke.mjs` remains byte-identical to parent; this current-source exercise lives only in the registered `tests/smoke/local-routine-current-smoke.mjs` adapter, and the route is declared in `docs/current/HTTP-ROUTES.csv`.

## Retained failure

The first affected-suite run exposed that adding learning to the existing routine response changed its frozen exact response shape: 393 checks passed and 3 failed. The failed approach was removed. Learning now uses a separate GET-only endpoint; the subsequent affected run passed 638/638. The retained failure receipt is `tests/evidence/saha-155-contextual-academy/initial-routine-shape-failure.json`.

## Limits and remaining gates

This is truthful local application-code completion for the approved SAHA-155 scope. It does not approve Academy content, enable an external Academy provider, establish formal domain/clinical acceptance, prove field usability, complete independent review, run GitHub CI, merge the branch or observe a deployment. Those gates remain separate. A real catalogue must be explicitly approved and configured before any learning item becomes available.

## CI repair verification

The historical final candidate removed the new React lint error, classified `/api/contextual-academy` in its then-current authorization matrix, preserved the immutable original matrix, preserved the original 389 guarded baseline digest, and registered only the two observed Academy minima. That historical candidate matrix passed 72/72. On the current integration parent, the registered matrix now binds the exact `personId` selector and proves the SAHA-155 role contract: assigned ASHA `200`, other ASHA `404`, owner/admin/supervisor/clinician/stranger `403`, anonymous `401`. This SAHA-155 check passed, but the aggregate current matrix is correctly retained as **HOLD (68 passed, 5 failed)** because of two later unclassified GET routes, two accumulated owner-control inventory mismatches, and two provider-assurance command-order findings within one pair of failed checks. Its regression guard passed. Exact-source GitHub CI and independent final-tree review remain pending.

## Current integration qualification — 21 October 2026

Against parent `dd13a744392eddf9ecd8b80283061600395c47f3`, the staged successor passed the contextual resolver/source contract 35/35, Worker/D1 HTTP 18/18, RoutineSaveStatus 20/20, grouped conflict/disagreement review 36/36, catalogue classification, TypeScript, and the production build. The guarded local smoke passed 40 checks with 3 documented skips; its current adapter retains the endpoint selector and uses the already assigned synthetic ASHA for the route sweep. The exact current authorization result, including the passing SAHA-155 row and all five retained aggregate failures, is `tests/evidence/saha-155-contextual-academy/authorisation-current.json`.

The first sandboxed attempts were stopped before application assertions by `listen EPERM 127.0.0.1`. The authorized localhost reruns then completed on the unchanged staged source and produced `http-current.json` and `smoke-current.json`. The failed environment attempts remain described in the custody receipt and are not counted as application failures.

## Current-parent successor refresh — 21 October 2026

The exact semantic successor was reapplied without conflict to integration parent `ea9d2e5cb98552f814da908e1a7c397af8af6f38`, preserving the later accumulated indicator-registry adapter and all other parent paths. Fresh current-parent qualification passed the contextual resolver/source contract 35/35, Worker/D1 HTTP 18/18, RoutineSaveStatus 20/20, grouped conflict/disagreement review 36/36, local smoke 40/40 with 3 documented skips, the four routine regressions 638/638, TypeScript, and the production build. The SAHA-155 authorization row again passed with assigned ASHA `200`, other ASHA `404`, owner/admin/supervisor/clinician/stranger `403`, and anonymous `401`; the aggregate matrix remains truthfully held at 68 passed / 5 unrelated failures.

The catalogue preflight is separately held by three inherited current-parent test files (`point-of-need-help-browser.mjs`, `point-of-need-help-component.mjs`, and `saha154-optional-assignment-uncertainty-browser.mjs`) that are not classified by the parent catalogue. Because the runner refuses to dispatch while that inherited catalogue condition exists, the exact registered smoke and authorization adapters were also executed directly on the staged current source. This retained parent limitation is not represented as a SAHA-155 pass and is not repaired or weakened by this successor.
