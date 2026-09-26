# Release 1 acceptance map — v0.2

Scope agreed: accounts, organisations, teams, assignments, permissions, structured database, record revisions, identity correction, audit history and preservation of existing sandbox records.

| Acceptance item | Implementation | Evidence |
| --- | --- | --- |
| Different accounts collaborate in one organisation | `accounts`, `memberships`, `team_members`; account-bound invitations | Separate owner, ASHA, clinician, supervisor, administrator and outsider identities in HTTP tests |
| No unauthorised patient access | Server membership and assignment checks; scoped snapshots, history, audit, export and command receipt replay | Cross-org/team denial, no admin PHI, supervisor write denial, suspension and reassignment tests |
| No silent overwrite | Expected versions plus guarded atomic organisation commit | Two writers against one draft: one save succeeds and one conflicts; winner persists; UI comparison and explicit merge |
| Retained record revisions | `record_revisions`, before/after values, author identity and reason | Draft history, correction provenance and database update/delete rejection tests |
| Identity correction | Versioned demographic correction; invalidate pending plans | Original/new identity values visible in history; stale correction fails |
| Confirmed facts preserved | Linked amendment draft and superseded source; wrong-patient marking | Original facts/outputs/receipts retained, inappropriate further use/export denied |
| Membership administration | Role/team/owner changes, suspension, last-owner rule | Unauthorised role changes and last-owner removal rejected; revoked default selection recovers to an active organisation |
| Existing records survive upgrade | First-open atomic migration; retained source; hash/count ledger | Legacy patient/visit/AI/referral/submission/audit/receipt preservation, repeat migration, forced failure rollback and retry |
| Auditable actions | Actor ID + display name, scope, reason, time; append-only audit table | Scoped audit and pagination; immutable database constraints |
| Existing product journey continues | Shared visit -> review -> approve -> simulated programme receipts; optional reviewed assistance | Regression tests for partial success, no resend during receipt lookup, AI withdrawal/review, FHIR example and CSRF |

Release verification is for synthetic use. Actual staff onboarding requires the owner to share the Site with intended accounts before their organisation invitations can be accepted. Existing Site access is unchanged.

No live AI/MIS/EHR/ABDM connection, clinical safety assessment, privacy/legal compliance approval, load/penetration test, independent audit integrity proof or production backup restoration has been accepted through this release. Those remain explicit gates in later releases.
