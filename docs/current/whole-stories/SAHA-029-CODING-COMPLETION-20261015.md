# SAHA-029 coding completion — selective permitted reuse

Recorded: 15 October 2026  
Source: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`  
Linear story: `SAHA-029` / `APL-52`  
Requirement: `BR-DATA-10`

## Decision

The code needed for the frozen SAHA-029 behaviour is complete in the current local source. This is an engineering assessment (`implemented-local`), not formal acceptance, a domain-policy approval, a merge performed by this record, or an observed deployment.

## Frozen behaviour and evidence

| Frozen behaviour | Implementation | Executable evidence | Result on the recorded source |
| --- | --- | --- | --- |
| Evaluate reuse independently for each destination and purpose. | `lib/saha/selective-reuse.ts`, `lib/saha/purpose-scope.ts` | `tests/selective-reuse-contract.mjs`; `tests/smoke/selective-reuse-browser.mjs` | Passed |
| Include only fields mapped for the approved destination and purpose. | `lib/saha/selective-reuse.ts` | Same contract and browser suites | Passed |
| Withhold a fact when the second provider purpose has no permission. | `lib/saha/selective-reuse.ts`, `lib/saha/selective-reuse-read-guard.ts` | Positive, refusal and read-guard assertions in both suites | Passed |
| Block an invalid reduced payload rather than silently sending it. | `lib/saha/selective-reuse.ts`, `lib/saha/service-dispatch.ts` | Required-field, invalid-mapping and dispatch assertions | Passed |
| Recheck authority and mapping validity at the final send boundary. | `lib/saha/mis-execution.ts`, `lib/saha/service-dispatch.ts`, `lib/saha/mis.ts` | Permission-withdrawal-after-queue browser path | Passed |
| If permission changes after preparation, send nothing and preserve accountable recovery state. | Same dispatch path | Actual `sendSubmission` refusal, unchanged queued submission, zero external egress, audit/receipt assertions | Passed |
| Expose a read-only review without creating an encounter or clinical write. | `app/selective-reuse/screen.tsx`, `lib/saha/selective-reuse-read-guard.ts` | Browser navigation, role/scope refusal and protected-value clearing assertions | Passed |

## Fresh verification

| Command | Result |
| --- | --- |
| `node tests/selective-reuse-contract.mjs` | 44 passed, 0 failed |
| `npm run build` | Passed |
| `node tests/smoke/selective-reuse-browser.mjs` | 60 passed, 0 failed, 0 skipped |

The browser suite used an owned synthetic local runtime. The first browser attempt was made before the production build existed and failed without exercising the story; the build was then created and the unchanged suite passed. Generated local reports are not formal UAT records.

## Gates that remain separate

- The purpose vocabulary and per-destination reuse policy still require accountable domain approval.
- Formal cases `TC-BR-DATA-10-A` and `TC-BR-DATA-10-B` remain `Not run`; no frontline-worker or programme-data-owner verdict is invented.
- Exact-source CI for a published completion change remains pending.
- No hosting check was performed, so no deployed SHA or live journey is claimed.

These open gates prevent whole-story acceptance and deployment claims. They do not represent missing application code for the frozen behaviour above.
