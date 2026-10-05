# Current data dictionary

Generated from `db/schema.ts`: **52 application tables** and **402 declared SQL columns**. The local recovery report includes one additional D1 metadata table. The [CSV](DATA-DICTIONARY.csv) lists columns and source locations; constraints remain authoritative in schema and applied SQL.

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
| `audit_events` | `auditEvents` | 13 |
| `command_receipts` | `commandReceipts` | 11 |
| `legacy_migrations` | `legacyMigrations` | 6 |
| `operations` | `operations` | 2 |
| `request_metrics` | `requestMetrics` | 7 |
| `alert_occurrences` | `alertOccurrences` | 13 |
| `alert_notifications` | `alertNotifications` | 16 |
| `notification_messages` | `notificationMessages` | 23 |
| `pilot` | `pilot` | 2 |
| `outreach` | `outreach` | 2 |
| `expansions` | `expansions` | 2 |
| `governance` | `governance` | 2 |
| `households` | `households` | 5 |
| `caseload_transfers` | `caseloadTransfers` | 7 |
| `identity_cases` | `identityCases` | 8 |
| `rights_requests` | `rightsRequests` | 8 |
| `retention` | `retention` | 2 |
| `media` | `media` | 11 |
| `scheduled_cursor` | `scheduledCursor` | 3 |
| `abha_review_reservations` | `abhaReviewReservations` | 7 |
| `availability_samples` | `availabilitySamples` | 9 |
| `device_work_grants` | `deviceWorkGrants` | 13 |
| `device_work_events` | `deviceWorkEvents` | 9 |
| `device_registration_grants` | `deviceRegistrationGrants` | 13 |
| `device_registration_receipts` | `deviceRegistrationReceipts` | 6 |
| `device_match_copies` | `deviceMatchCopies` | 8 |
| `device_registration_wire_receipts` | `deviceRegistrationWireReceipts` | 7 |
| `work_burden_samples` | `workBurdenSamples` | 16 |
| `work_support_events` | `workSupportEvents` | 14 |
| `offline_open_reports` | `offlineOpenReports` | 12 |
| `offline_open_subjects` | `offlineOpenSubjects` | 6 |
| `clinical_source_documents` | `clinicalSourceDocuments` | 8 |
| `indicator_figures` | `indicatorFigures` | 8 |
| `indicator_figure_units` | `indicatorFigureUnits` | 5 |
| `indicator_figure_events` | `indicatorFigureEvents` | 11 |
| `indicator_figure_receipts` | `indicatorFigureReceipts` | 6 |
| `indicator_figure_disclosures` | `indicatorFigureDisclosures` | 6 |

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
