# Development slice 1d — workforce roster reconciliation

30 September 2026 (IST). Fourth identity slice of the development-completion plan. Synthetic data only; formal acceptance unchanged. This is manual reconciliation against a roster file an institution provides, not federation with an identity provider.

## What changed

- **Preview.** `POST /api/roster` (owners) takes up to 100 rows of account code, name, role, teams (by name or id) and active or left, plus whether the roster is complete. It returns, for each person, invite, update, suspend, no change or conflict, with row errors (duplicates, unknown teams, a care role without a team) and a hash of the exact preview.
- **Apply exactly the preview.** `rosterApply` recomputes the preview and refuses if the hash differs, so a roster or membership change between preview and apply cannot slip through. It creates account-bound invitations (72-hour expiry; only token hashes are stored in the invitations table), updates roles and teams, and suspends members listed as left or, for a complete roster, missing. Each change and a summary are audited.
- **Safety rules.** Roster sync never removes a membership, never reactivates a local suspension (reported as a conflict), never changes the owner's own membership, never changes anyone's owner flag and never suspends an owner (reported as a conflict). A partial roster never suspends unlisted members.
- **Workspace.** The Organisation page gains "Roster sync" for owners: paste lines, preview, give a reason, apply, and copy the invitation codes.

## Evidence

- 25 new HTTP/D1 assertions (`tests/roster-smoke.mjs`): supervisor refusal; invalid role, over-long roster and unknown team handling; a preview with one invite, one update and one suspension; refusals for a supervisor and a stale hash; apply; the invited account joining with the returned code; the suspended member refused; team change stored; reapplying the same preview refused; a second preview showing no changes.
- 13 contract assertions (`tests/roster-contract.mjs`) cover every classification, the self, owner, suspended, removed and pending-invitation rules, complete versus partial rosters, row errors, authority, stale hash, refused applies changing nothing, token-hash-only storage, audit and idempotent re-preview.
- Browser check (headless Chromium, built Worker, two synthetic accounts): pasted one line, previewed, applied and received one invitation code. No console errors.
- All suites: 1,389 HTTP/D1, 580 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-1d/`.

## Limits

- Account codes still come from each worker's own account; Saha does not create accounts or verify identity with the institution.
- There is no scheduled or automatic feed from an HR or identity system, and no SCIM or single sign-on federation (BR-ID-10 remains mostly open).
- Invitation codes still have to be delivered to each person outside Saha. Like single invitations, the apply result (including codes) is kept in the command receipt so an identical retry returns the same codes.
