# Data model specification

## Current source reconciliation — 10 October 2026

This supplement records inspected main `7668a03d97c1ae62174f09e65ccd5a5717120be6` for the
11 October coding handoff. The earlier edition's 24-table/six-migration figures below are retained historical
statements, not current schema or upgrade instructions. Read [the current engineering baseline](engineering-handoff/CURRENT-ENGINEERING-BASELINE.md)
and the source-derived [inventory](../verification/generated-inventory.json) for the pinned checkpoint.

Current declarations are [db/schema.ts](../../db/schema.ts), the [generated physical dictionary](CURRENT-DATA-DICTIONARY.md)
and [column CSV](DATA-DICTIONARY.csv). There are 33 ordered SQL migration files, `0000` through `0032`, at this source
checkpoint. Source inventory describes declarations/files; this documentation pass did not apply them, inspect a
hosted database or establish populated upgrade/recovery success. D1 metadata is separate from application table
declarations. Nested JSON properties are not automatically SQL columns or new normalized entities.

| Storage concern | Current source to inspect | Important boundary |
| --- | --- | --- |
| Identity, organisations, workforce and assignment | `accounts`, `organisations`, `memberships`, `team_members`, `patients`; [schema](../../db/schema.ts), [store](../../lib/saha/store.ts), [access policy](../../lib/saha/access.ts) | Provider principal and current membership drive permission; organisation/person references fence data. |
| Visit and programme capture | `visits`, `plans`, `ai_results`, `submissions`, `referrals`; [types](../../lib/saha/types.ts), [programmes](../../lib/saha/programmes.ts) | Indexed relational fields plus versioned domain JSON; confirmation, correction and external outcome retain distinct evidence. |
| Revisions, audit and replay | `record_revisions`, `audit_events`, `command_receipts`; [store](../../lib/saha/store.ts), [server](../../lib/saha/server.ts) | Preserve append-only historical evidence, exact operation identity and current-authority replay; do not rewrite a receipt or revision. |
| Prepared device work and registration | `device_work_grants`, `device_work_events`, registration/copy/receipt tables; [field](../../lib/saha/field.ts), [field registration](../../lib/saha/field-registration.ts), [field client](../../public/field/) | Server grant/receipt records and client ciphertext have different custody. Source does not establish physical-device, key-recovery or approved production-lease policy. |
| Reporting, released evidence and operational tracking | Reporting calendar/coverage/snapshot/receipt tables, indicator figure tables, media custody, work burden and support tables; [physical dictionary](CURRENT-DATA-DICTIONARY.md) | Inspect each owning module's current privacy/export contract; hashes or a general export permission do not authorise protected body reconstruction. |
| Installed programme work and transitions | `installed_pack_work_events`, `installed_pack_transition_events`; [physical dictionary](CURRENT-DATA-DICTIONARY.md) | Versioned execution/adoption evidence is not clinical approval or an external programme receipt. |

### Schema and migration rules for the next coding slice

Use the actual SQL and Drizzle declaration for keys, constraints, indexes and types; the dictionary is navigation,
not an alternative executable schema. Some relationships are enforced by domain policy and JSON contracts, so do
not infer a SQL foreign key merely from a domain reference. Certified patient guards and organisation guards use
the existing write-set classification; any change must preserve revision/audit/receipt atomicity.

The D03 manual presentation candidate needs no new patient store or schema migration. If a later bounded task
requires a delta, append a new migration after the actual current maximum, inspect populated upgrade behavior and
current source pins, and qualify recovery separately. Never edit applied SQL or migration snapshots. The original
PostgreSQL foundation SQL and 26-entity blueprint remain read-only design references, not instructions for this D1
application. Roll-forward/recovery must preserve legacy source, historical records and uncertain external outcomes.

## Retained R11 model and recovery description

The remainder retains the original edition for provenance. Its migration range, table counts and R11 restore
figures apply only to that earlier checkpoint; they must not be reported as current execution or host evidence.

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
