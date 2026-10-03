# Development slice r09 — programme and purpose dimensions in the access policy

3 October 2026 (UTC). Builds on the scoped-permission core (team, role, assignment; `lib/saha/access.ts`), the owner-managed versioned operation settings for adapters (slice 7e), and the delegation pattern (slice 1e). Synthetic data only; formal acceptance unchanged. One owner command is added (`setAccessPurpose`, with `revokeAccessPurpose`); one scoped read route is added (`GET /api/purpose-scope`). No patient command and no migration.

## What changed

- **Purpose-limited access grants.** An organisation owner can attach an optional **programme** and/or **purpose** tag to a member's access, narrowing the access the member already holds through team, role and assignment. The grant is stored in the organisation operations document (`operations.purposeGrants`), versioned, audited, and revoked by appending (never deleted), so it is additive: it only ever narrows existing access and never widens it. Code: `lib/saha/purpose-scope.ts`.
- **The scope check honours the tag, defaulting to current behaviour when absent.** `lib/saha/access.ts` gains `allowedFor(member, person, grants, purpose?)`, which returns exactly `allowed(member, person)` when no grant is set. With a grant, it applies two orthogonal dimensions:
  - **Programme** narrows record-level access: the member may only see and act on people recorded in that programme (checked against `person.programmes`). As built, the slice applied this only through `allowedFor` and the `?check` query; the integration of #144 (review finding) wired it into the workspace scope gate (`store.ts` `scope`, through `programmeAllows`), so it now narrows the workspace snapshot and every command that resolves the patient through `core.person()`.
  - **Purpose** narrows data-flow authorisation: a flow carrying a purpose is permitted only when the grant names it. It is evaluated with a purpose context (`care-coordination`, `programme-delivery`, `ai-assistance`, `reporting`, `household-sharing`), so a purpose-only grant leaves the member's normal record scope unchanged.
  - `purposeGrantFor` and `programmeScopeOf` expose the effective restriction for screens and checkpoints.
- **Owners only, versioned, audited.** `setAccessPurpose` names the member, the setting version (0 when none), an optional programme, a set of purposes, and a reason. Only an owner may send it (checked on the server, and again on replay). A stale revoke is refused (409), as is a grant that names neither a programme nor a purpose, one that would narrow an owner, administrator, provider or the sender, or a second active grant for the same member (409). Each change writes a `setAccessPurpose`/`revokeAccessPurpose` audit event. *Decision:* a grant does not touch membership or team records; it is a layer on top, so nothing already shared is recalled and no approval is invalidated.
- **Read path.** `GET /api/purpose-scope` (`lib/saha/purpose-scope-server.ts`, `app/api/purpose-scope/route.ts`) returns the vocabulary and the grants the viewer may see (owners see all, a member sees their own, administrators and providers see none), plus the members an owner can narrow. The optional `?check=1&member=<id>&person=<id>&purpose=<id>` query answers whether that member may see that person for that purpose, using the same `allowedFor` check that data-flow checkpoints will apply. The grant list is deliberately absent from the operations allow-list (`OPERATOR_FIELDS`), so it is not leaked through `GET /api/operations`.

## Evidence

- 10 contract checks (`tests/purpose-scope-contract.mjs`), run against the real transpiled modules: the scope check equals `allowed` with no grant; the programme tag narrows record scope and `programmeScopeOf` reports it; the purpose tag narrows data flows only (a plain read is untouched, a wrong purpose is refused); programme and purpose intersect and revoked grants no longer narrow; an out-of-scope member stays out (never widens); owner-only apply and replay checks; schema refusals (no dimension, duplicate purpose, unknown/self/owner/admin/provider target); a valid grant is versioned and audited; revoke is versioned, audited, additive and restores the default; the view is scoped to the viewer; no credential binding names appear in the stored setting.

## Limits

- As built, the **purpose** check was exposed only through `allowedFor` and the `?check` query, and the **programme** tag (after the integration of #144) did not reach the SQL pre-filter, the auxiliary read routes or the direct `normallyAllowed` checks. Slice 13a ([access scope everywhere](SLICE-13A-ACCESS-SCOPE.md)) closes both: purposes are checked at each data-flow checkpoint (`COMMAND_PURPOSE` and the route checks), and the programme tag reaches every check and the SQL pre-filter. No already-prepared payload is re-checked when a grant changes.
- The purpose vocabulary is an access-policy label over the flows this release already has; it is illustrative and not clinically approved, and it is not a per-destination mapping (that stays with slice 7e's operation permissions).
- A `General care` programme tag is a weak restriction, because every person is recorded in `General care`.
- BR-ID-02 and BR-DATA-10 stay partial: the unified purpose-specific policy across every channel is not yet enforced at every data-flow checkpoint, and none of this is accepted for production.

## Shared-file edits for the integrator

- `lib/saha/access.ts` — added `allowedFor`, `purposeGrantFor`, `programmeScopeOf` (new exports only; `allowed`/`normallyAllowed`/`exceptionalGrant` unchanged).
- Integration of #144: `lib/saha/access.ts` adds `programmeAllows`, and `lib/saha/store.ts` `scope` applies it (with no grant stored, the result is unchanged).
- `lib/saha/operations.ts` — added optional `purposeGrants?: PurposeGrant[]` to `Operations` (no effect on the allow-list or existing rows).
- `lib/saha/platform.ts` — added `...purposeScopeSchema.options` to the command schema.
- `lib/saha/server.ts` — added `applyPurposeScope`/`authorizePurposeScope` to the dispatch and replay chains.
- `lib/saha/monitoring.ts` — added `'purpose-scope'` to the `measured` route name union.

All changes are additive and gated: with no grant stored, every check and every command path behaves exactly as before this slice.
