# Data model specification

The physical application schema is [db/schema.ts](../../db/schema.ts), with six ordered migrations in `drizzle/`. The generated [current dictionary](CURRENT-DATA-DICTIONARY.md) and [field CSV](DATA-DICTIONARY.csv) enumerate its 24 application tables and declared columns. The [original data model](../reference/05_Data-Model-Specification_v1.0.md) remains a 26-entity PostgreSQL target blueprint.

| Storage group | Tables | Meaning |
| --- | --- | --- |
| Identity and organisation | accounts, organisations, teams, memberships, team_members, invitations | Stable account identity, current membership, team assignments and account-bound invitations |
| Care and configuration | patients, visits, integrations, plans, ai_results, submissions, referrals | Indexed identity/state columns plus domain JSON and immutable action evidence |
| Evidence and retry | record_revisions, audit_events, command_receipts, legacy_migrations | Append-only revisions/audit, actor-key receipts and first-open backfill ledger |
| Operations and readiness | operations, request_metrics, pilot, outreach, expansions, governance | Organisation-keyed workflow/configuration aggregates and bounded request metrics |
| Retained source | workspaces | Preserved v0.1 aggregate; not the active store after migration |

## Relationships and versioning

Organisation IDs fence application records. Membership is keyed by organisation and account; team membership combines organisation, team and account. Patient and visit identities are organisation-scoped. Visits reference their patient and retain a version/recordVersion plus JSON document. Revision uniqueness binds organisation, entity type, entity ID and version. Receipt uniqueness is actor plus key; stored organisation and payload hash are rechecked on replay.

Do not infer that every domain relationship has a SQL foreign key. Several relationships and workflow constraints live in domain policy and serialized JSON. The source declaration is authoritative for actual SQL constraints. Broader reference-model field names are not valid migration instructions.

`lib/saha/types.ts` defines the core JSON shape; programme, field, agent, MIS, EHR, continuity, governance, pilot and outreach modules own their nested contracts. Preserve unknown historical evidence through supported version migration. A data dictionary of SQL columns does not flatten every nested JSON property; the companion source map names each owner.

## Migration and recovery

Migrations 0000–0005 and their snapshots are immutable. Generate a new delta through the existing Drizzle workflow and inspect it. Apply in order on an isolated synthetic database before any hosted migration. Test populated upgrade, legacy first-open backfill, rollback of failed guarded writes and subsequent receipt reads; an empty-schema create alone is insufficient.

The first-open migration retains legacy source bytes, revision/hash/count metadata and baseline evidence. Old sandbox persona approvals are blocked. Do not delete the legacy table or resume an old writer against it.

The R11 local encrypted restore checked all 25 SQLite tables, including D1 metadata, with schema and per-table digests. That table count differs from the 24 application declarations by design. The tool does not export a hosted D1 instance, restore device-only drafts, reconcile later external writes or establish production backup retention.

See [data governance](DATA-GOVERNANCE.md), [operations](../../OPERATIONS.md) and [LLD](03_Low-Level-Design_v1.1.md).
