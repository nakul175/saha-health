# Development slice feat/r13 — managed service identities for connectors and agents (BR-ID-09)

3 October 2026 (IST). Adds a service-identity concept that is distinct from human principals, managed by an organisation owner, with a named owner, an expiry and a single connector/agent scope. Synthetic data only; no acceptance status changes (BR-ID-09 stays partial).

## What changed

- **Service identity concept.** `lib/saha/identity.ts` adds `ServiceIdentity` and `ServiceIdentityScope` alongside the human `Principal`, plus `serviceIdentityIsValid`. A service identity is a machine credential — it is never resolved from a sign-in header and never signs in. Resolution of human principals (`sitesPrincipal`, `accessPrincipal`, `principalFromHeaders`) is unchanged.
- **Owner lifecycle.** `lib/saha/service-identity.ts` adds two owner-only commands, folded into the operations document:
  - `serviceIdentityCreate` (name, kind `connector`/`agent`, `targetId`, `ownerId`, `expiresAt`): refuses a past expiry, a missing/suspended connection, a kind/target mismatch (a connector identity must name a programme/EHR/ABDM connection, an agent identity an AI provider), a non-owner or inactive named owner, a duplicate name, a stale version and the 100-identity bound.
  - `serviceIdentityRevoke`: marks the identity revoked (revokedAt/revokedBy), refused for non-owners, unknown ids and a second revocation.
- **External-call gate.** `requireServiceIdentity` (and its non-throwing form `validServiceIdentity`) is the single reference point external-call paths must use: it refuses a missing (404), revoked (403), expired (403) or out-of-scope (403, wrong kind or different connector/agent) identity, so a worker's session cannot stand in for a machine credential. Enforcement is fail-closed.
- **Wiring.** `lib/saha/operations.ts` spreads `serviceIdentitySchema.options` into the operations discriminated union (so the commands are accepted by the platform schema unchanged) and `applyOperations` delegates those two command types to `applyServiceIdentity`. The `Operations` document gains an optional `serviceIdentities` field. No change to `platform.ts` or `server.ts` dispatch was needed.

## Evidence

- 10 service-identity contract assertions (`tests/service-identity-contract.mjs`), run in a clean worktree: schema acceptance and refusal; owner-only create/revoke; creation records owner/scope/expiry; scope and target checks (unknown, suspended, wrong kind, past expiry, non-owner named owner, duplicate, stale version); the external-call gate (valid pass, missing, wrong kind, wrong target, expired, revoked); the boolean mirror and the identity predicate; revocation stopping references without touching the other identity; the 100-identity bound; `applyOperations` delegation.
- `node node_modules/typescript/bin/tsc --noEmit` passes clean (exit 0) on the feat/r13 source.
- Report and manifest in `tests/evidence/slice-r13/`.

## Limits

- **No credential material.** R13 manages the service-identity *record* (owner, scope, expiry, revocation) only. The underlying server secret/credential rotation and *independent* revocation are R14, so the acceptance line "revoking a connector credential stops its new calls without disabling unrelated connectors" remains open at the credential layer; R13 stops the identity's references at the gate.
- **Gate call sites.** The `requireServiceIdentity` gate is provided and enforced where a command references a service identity, but the connector/agent execution paths (`mis-execution`, `ehr-execution`, `agent-execution`, `aggregate-execution`, `externalCall`) do not yet opt a connection into a service identity, because the `Integration` record carries no `serviceIdentityId` field yet. Wiring the gate into those fetch call sites is a follow-up (one additive field plus a single gate call per path), left to the integrator/R14.
- **Maintenance.** Service-identity commands are not in `maintenanceAllows`, so they are refused while an organisation is paused for maintenance (fail closed). A revoke-during-maintenance path can be added later.
- No read route or UI screen was added; the `operations` view still returns only its existing allow-listed fields, so service identities are not broadly exposed.
