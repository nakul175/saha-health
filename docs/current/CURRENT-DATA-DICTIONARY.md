# Current data dictionary

Generated from `db/schema.ts`: **27 application tables** and **155 declared SQL columns**. The local recovery report includes one additional D1 metadata table. The [CSV](DATA-DICTIONARY.csv) lists columns and source locations; constraints remain authoritative in schema and applied SQL.

| Table | Declaration | SQL columns |
| --- | --- | ---: |
| `workspaces` | `workspaces` | 4 |
| `accounts` | `accounts` | 6 |
| `organisations` | `organisations` | 6 |
| `teams` | `teams` | 4 |
| `memberships` | `memberships` | 7 |
| `team_members` | `teamMembers` | 3 |
| `invitations` | `invitations` | 12 |
| `patients` | `patients` | 8 |
| `visits` | `visits` | 7 |
| `integrations` | `integrations` | 6 |
| `plans` | `plans` | 5 |
| `ai_results` | `aiResults` | 4 |
| `submissions` | `submissions` | 6 |
| `referrals` | `referrals` | 4 |
| `record_revisions` | `recordRevisions` | 13 |
| `audit_events` | `auditEvents` | 10 |
| `command_receipts` | `commandReceipts` | 7 |
| `legacy_migrations` | `legacyMigrations` | 6 |
| `operations` | `operations` | 2 |
| `request_metrics` | `requestMetrics` | 7 |
| `pilot` | `pilot` | 2 |
| `outreach` | `outreach` | 2 |
| `expansions` | `expansions` | 2 |
| `governance` | `governance` | 2 |
| `households` | `households` | 5 |
| `caseload_transfers` | `caseloadTransfers` | 7 |
| `identity_cases` | `identityCases` | 8 |

## JSON document owners

| Document | Source |
| --- | --- |
| Person, visit, facts, plan, submission, referral, membership and organisation | [types.ts](../../lib/saha/types.ts) |
| Programme episodes, follow-ups and capture | [programmes.ts](../../lib/saha/programmes.ts) |
| Agent requests/results | [agent.ts](../../lib/saha/agent.ts) |
| External delivery and exchange | [mis.ts](../../lib/saha/mis.ts), [ehr.ts](../../lib/saha/ehr.ts) |
| Identity review and handover | [continuity.ts](../../lib/saha/continuity.ts) |
| Field grant | [field.ts](../../lib/saha/field.ts) |
| Governance and evaluation | [governance.ts](../../lib/saha/governance.ts), [evaluation.ts](../../lib/saha/evaluation.ts) |
| Operations, pilot, outreach and expansion | [operations.ts](../../lib/saha/operations.ts), [pilot.ts](../../lib/saha/pilot.ts), [outreach.ts](../../lib/saha/outreach.ts), [expansion.ts](../../lib/saha/expansion.ts) |

This physical dictionary does not imply all proposed normalized clinical entities or nested JSON properties are SQL columns. See [Data model](05_Data-Model-Specification_v1.1.md) for relationships, migrations and storage limits.
