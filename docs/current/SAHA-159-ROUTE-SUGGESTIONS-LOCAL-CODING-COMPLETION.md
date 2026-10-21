# SAHA-159 worker-controlled route suggestions — local coding evidence

Date: 20 October 2026

Scope: local coding and synthetic verification only
Frozen contract: [SAHA-159 acceptance contract](SAHA-159-ACCEPTANCE-CONTRACT.md)

## Implemented behavior

- A current ASHA selects up to 25 current assigned tasks. The server rechecks role, active membership, direct assignment, team and policy scope before saving.
- The local `due-locality-local-v1` strategy orders only by due date, the existing locality label and a stable identifier. Stored suggestions keep task identifiers and source record versions, not names, coordinates or provider payloads.
- Suggestions are separate operations metadata. No patient assignment, status, visit, completion, entitlement, payment or sanction field is changed.
- The My work screen exposes ordinary assigned work separately from the suggestion and provides create, inspect, move up/down, replace and decline controls. Ignoring it has no side effect.
- Reorder requires the exact same tasks. Override may select different currently assigned tasks. All changes require the current suggestion version and current worker membership version.
- A moved, completed, deleted, version-changed or newly restricted task becomes an unavailable placeholder that omits patient and locality fields. A missing locality label makes the suggestion unavailable and retains the ordinary work list.
- `GET /api/route-suggestions` records a scoped access audit before returning current assigned work. Command mutations use the normal idempotent command receipt, current-authority replay guard, persistence CAS and audit paths.
- The feature contains no external transport, map/navigation integration, coordinate field or background tracking. The response explicitly reports the disabled provider/tracking boundary.

## Synthetic checks

`node scripts/test.mjs unit --only tests/route-suggestions-contract.mjs` passes 31 checks covering:

- positive create, deterministic local ordering, inspect, reorder, override and decline;
- unchanged patient assignment/completion state and explicit no-provider result;
- ASHA-only authorization, unassigned/completed/unknown task refusal and malformed input;
- stale suggestion version, changed membership version and changed ownership refusal;
- restricted details withheld for moved, missing and stale tasks;
- missing-locality and empty-work fallback to the ordinary work list;
- exact idempotency-receipt replay after the original mutation;
- source boundary checks for no transport, coordinates, navigation or tracking; and
- presence of the worker-control UI actions.

On the historical isolated candidate, `npm run typecheck`, `npm run lint:baseline`, `npm run build` and `npm run test:catalogue` passed. Those candidate observations do not override the current integration qualification below. The production build includes `/api/route-suggestions`.

After independent review found that the first read implementation could return a pre-audit view if an assignment changed while the access audit was recorded, the handler was repaired to reload current state and recompute role, assignment and policy scope after that await. The immutable failed receipt is retained at `tests/evidence/saha-159-route-suggestions/post-audit-race-before.json`.

`smoke/route-suggestions-worker` now exercises the actual built Worker and D1. Its 8 checks cover the assigned-ASHA read, command persistence, access and mutation audit, exact replay without duplicate mutation, restart durability, post-audit assignment withdrawal with no restricted disclosure, stale-version refusal and changed-membership replay refusal. `unit/route-suggestions-contract` and this Worker/D1 suite are registered at observed regression minima 31 and 8; the guarded final run passes 39/39 with both baselines evaluated. Baseline registration and guarded evidence are retained under `tests/evidence/saha-159-route-suggestions/`.

## Current integration qualification — 21 October 2026

On exact integration parent `3e1de3661217f3b634aa2904d668d0e1877013f5`, the focused contract passes 31/31 and the built synthetic Worker/D1 smoke passes 8/8. The current authorization matrix now classifies `GET /api/route-suggestions`; its SAHA-159 row passes for both current ASHAs and refuses owner, administrator, supervisor, clinician, stranger and anonymous access as specified. The aggregate matrix remains HOLD at 70 passed / 5 failed: seven earlier GET routes remain unclassified (`/api/configuration-publications`, `/api/deployment-configuration`, `/api/due-work`, `/api/prioritisation`, `/api/report-exports`, `/api/rights/package`, and `/api/support-cases`), two earlier owner-control groups remain inconsistent, and the inherited provider-assurance ordering returns 423 before role refusal for EHR/MIS activation. These retained failures are not SAHA-159 pass claims. Typecheck and production build pass. The CI baseline guard proves the exact set union of the immutable original 389 suites and 74 current additions, with no lowered minimum. The inherited hosting-control contract passes 51/51. The inherited SAHA-158 event-geotag, Worker/D1, authorization, visit-import and data-exit contracts remain passing after the semantic union. `python3 scripts/build-documentation.py --check` passes after regenerating all affected authoritative current documents from this exact staged source. The test catalogue separately remains HOLD on three previously integrated unclassified test filenames (`tests/point-of-need-help-browser.mjs`, `tests/point-of-need-help-component.mjs`, and `tests/saha154-optional-assignment-uncertainty-browser.mjs`); no test or minimum was removed.

## Evidence and limits

The code paths are `lib/saha/route-suggestions.ts`, `lib/saha/route-suggestions-server.ts`, `app/api/route-suggestions/route.ts`, `app/route-suggestions-panel.tsx`, the platform schema/server dispatch integration, and `tests/route-suggestions-contract.mjs`.

This is local coding evidence. The repaired final tree requires a different reviewer; current-head CI has not yet completed, the branch is not merged, and no staging or production deployment has been observed. Representative ASHA usability, approved real routing semantics and formal CWO/domain acceptance remain separate gates. No provider or tracking capability is activated.
