# SAHA-115 — environment separation: local application completion

20 October 2026. This record covers application code only. It does not provision or inspect real identity tenants, databases, secret stores, providers or hosting, and it does not claim formal acceptance, merge or deployment.

## Frozen scope

- Canonical story: `SAHA-115` / `APL-138`, **Separation of environments**.
- Original requirement: `BR-OPS-02`.
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-138.md` in the parent project mirror.
- Contract SHA-256: `d115d0f8b8f0062b22498801dc7231c4d71b79c7e04bf1bfbfd3de5afc1e3427`.
- Base source: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`.

The original acceptance remains unchanged: a demonstration record cannot reach a live MIS, and a training account cannot access real patient records. Separate physical deployments and the named formal scenarios remain deployment and acceptance work.

## Application behavior completed

- Every staging and production live-call decision now requires three opaque deployment bindings: `SAHA_IDENTITY_NAMESPACE`, `SAHA_DATA_NAMESPACE` and `SAHA_CREDENTIAL_NAMESPACE`. Each must carry the declared environment prefix. The owner report shows only status and the environment name; it never returns a namespace suffix or a credential value.
- A training state read fails closed before patient material is scoped or returned when any patient record is not explicitly marked `synthetic: true`. Registrations created inside synthetic or training retain that mark. Existing fixture and destination guards remain in place.
- MIS plans, probes, submissions and corrections carry `synthetic`, `training`, `staging` or `production` from the current deployment. Transport adds `X-Saha-Environment`. If an approved body was prepared under a different environment, dispatch refuses before transport I/O.
- FHIR examples and publication documents carry an environment tag (`urn:saha:environment`), a matching title/note and an `X-Saha-Environment` header. A stale prepared document is refused before provider I/O. Downloads use the same environment in the filename and header.
- Legacy HTTP AI requests retain the declared environment through minimisation and transport. Invalid environment labels fail closed.
- Configuration is server-owned. No API for an ordinary worker to change namespaces, routes or secrets was added. No provider or hosting setting was changed.

## Focused verification

| Check | Result |
| --- | --- |
| `node tests/environment-separation-contract.mjs` | 17 passed, 0 failed; positive namespace and outbound labels, training refusal, invalid configuration, stale-label race, no-I/O refusals and no-secret report checks |
| Original `tests/environment-contract.mjs` | retained byte-for-byte as historical slice-6n evidence; no result is claimed for the changed application source |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed; production build completed |

The direct `tests/agent-minimisation-contract.mjs` command remains an inherited harness failure before assertions: its fixed local transpile list does not emit `installed-transition-authority.js`, which `programmes.js` imports on the current base. The new recursive focused contract executes the changed legacy minimisation function and passes. No assertion was removed or reclassified.

## Remaining gates

- provision and independently inspect separate identity tenants, data stores and credential stores for training, staging and production;
- execute `TC-BR-OPS-02-A` and `TC-BR-OPS-02-B` with deployment operations and the frozen fixtures;
- independent code review, exact-source CI, merge and observed deployment;
- formal human/domain approval of the environment design and operating procedure.

Within the bounded local application scope, no identified application-code gap remains. `BR-OPS-02` correctly stays `partial` until its physical and formal gates are complete.
