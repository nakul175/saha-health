# SAHA-133 local coding completion — provider and supply-chain assurance

## Frozen contract

- Canonical story: SAHA-133 / APL-156, Provider and supply-chain assurance.
- Contract path: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-156.md` in the project mirror (read-only).
- Contract SHA-256: `a4a1809eef9d3dca1f8d9edfde98d7249ff87914cedd20d87eaf547f326e528c`.
- Original requirement retained: BR-SEC-12.
- Scope retained: provider and critical-dependency disclosure, vulnerable or unsupported component workflow, release or component hold for an unresolved exploitable critical vulnerability, and no provider activation from supplier review.

## Implemented local behaviour

- Owners can create and revise a versioned provider or dependency inventory record with its exact release, accountable owner, security controls, subprocessors, incident contact, update obligation, support horizon, material-change disclosure and optional component binding. Every replaced inventory revision remains available as immutable history.
- Provider records require an explicit subprocessor disclosure. “None” must be recorded as an explicit disclosure rather than inferred from an empty field.
- Owners can record version-checked findings with severity, exploitability, deployment/component scope and the remedy that must be implemented.
- An open exploitable critical deployment finding blocks activation across the organisation, including the actual deployment-configuration activate and rollback commands. A component-scoped finding blocks activation/binding for that component while allowing unaffected components to follow their existing controls.
- `supportUntil` is inclusive through that UTC calendar date. From the next UTC date, an unsupported deployment or component creates a fail-closed activation hold until an owner records a reviewed supported revision.
- Generic integration, frontline-provider and anaemia-provider activation require a complete provider inventory bound to the exact post-activation agreement/integration release. The stored active release, Operations display and dispatch gate use that same release identity. Suspension remains available.
- Every live provider dispatch re-reads assurance before and after its audit checkpoint. Missing/incomplete exact-release inventory, expired support, or an unresolved high/critical deployment or component finding refuses contact even when the provider was already active; a finding introduced during the audit race also refuses contact.
- Configuration publication findings bind the exact configuration kind, key and manifest hash. A finding on one retained manifest does not disable another manifest for the same configuration key.
- Suspending an already active affected integration remains available while a finding is open.
- A finding reporter cannot verify their own remedy. A different active organisation owner must record implemented findings and an evidence reference before the hold clears.
- Stale operations or item versions fail without inventory mutation. Every accepted inventory, finding and remedy event writes an accountable audit entry.
- The Operations screen now displays the inventory, retained revisions, disclosures, support status, findings and release-block status; exposes usable add/edit/material-change workflows; and offers exact current integration, independent-provider and configuration-manifest bindings. The screen explicitly states that the inventory does not activate providers.

## Local verification

- `node tests/supply-chain-assurance-contract.mjs`: **45/45 passed**. Covers positive inventory/provider disclosure, invalid input, ordinary-worker refusal, provider subprocessor refusal, immutable inventory history, mandatory material-change review, actual generic activation and exact post-activation release identity, generic/frontline/anaemia exact-release activation, missing/stale/duplicate inventory refusal, deployment-configuration activate/rollback holds, inclusive UTC support dates and expired-support holds, exact configuration-manifest binding, global and record-version races, component holds, unaffected-component behaviour, self-approval refusal, independent remedy closure, immutable duplicate resolution, Operations release display, actual server gate ordering and audit evidence.
- `node tests/service-dispatch-contract.mjs`: **109/109 passed**. Covers the real execution boundary, exact active-release inventory, expired support, unresolved high and critical component findings, and a finding introduced during the audit race with zero dispatch.
- `node tests/frontline-provider-contract.mjs`: **109/109 passed** across the actual checkpoint/persistence/dispatch/review paths with explicit exact-release assurance fixtures.
- `node tests/anaemia-provider-contract.mjs`: **58/58 passed** across the actual checkpoint/persistence/dispatch/review paths with explicit exact-release assurance fixtures.
- `node tests/deployment-configuration-contract.mjs`: **34/34 passed**.
- `node tests/configuration-publication-contract.mjs`: **23/23 passed**.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed; production client/server/RSC/SSR bundles completed.
- Existing `tests/operations-contract.mjs` could not start in this accumulated checkout because its fixed temporary transpilation list omits the already imported `data-flow-authority.js`. The failure is retained and is not counted as a pass. The production build and this story's all-module transpiled contract include the current module graph.

## Gate status

- Local application code gap against the frozen SAHA-133 scope: none identified after the checks above.
- Local coding completion and focused synthetic testing: complete for this isolated story candidate.
- Independent source review: pending.
- Exact-source CI, formal TC-BR-SEC-12-A/B execution, privacy/security-owner acceptance, merge and observed deployment: pending and not inferred.
- No provider was activated, no external request was sent, and no real person, secret, paid service, database or hosting configuration was used.
