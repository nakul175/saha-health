# Current API inventory

Generated from source: **52 HTTP method/route pairs** and **201 command schema discriminators**. Discriminators are not distinct HTTP endpoints or claims that all contexts may execute them. Server authority, state and configuration gates remain decisive. The original 74 proposed REST operations and 16 event types remain target design.

| Method | Route | Handler |
| --- | --- | --- |
| GET | `/api/abdm` | [app/api/abdm/route.ts](../../app/api/abdm/route.ts) |
| GET | `/api/action-plan` | [app/api/action-plan/route.ts](../../app/api/action-plan/route.ts) |
| GET | `/api/aggregate-reports` | [app/api/aggregate-reports/route.ts](../../app/api/aggregate-reports/route.ts) |
| GET | `/api/alerts` | [app/api/alerts/route.ts](../../app/api/alerts/route.ts) |
| GET | `/api/audit/chain` | [app/api/audit/chain/route.ts](../../app/api/audit/chain/route.ts) |
| GET | `/api/audit` | [app/api/audit/route.ts](../../app/api/audit/route.ts) |
| GET | `/api/caseload` | [app/api/caseload/route.ts](../../app/api/caseload/route.ts) |
| POST | `/api/commands` | [app/api/commands/route.ts](../../app/api/commands/route.ts) |
| GET | `/api/continuity` | [app/api/continuity/route.ts](../../app/api/continuity/route.ts) |
| GET | `/api/data-exit` | [app/api/data-exit/route.ts](../../app/api/data-exit/route.ts) |
| GET | `/api/delegations` | [app/api/delegations/route.ts](../../app/api/delegations/route.ts) |
| GET | `/api/environment` | [app/api/environment/route.ts](../../app/api/environment/route.ts) |
| GET | `/api/exceptional` | [app/api/exceptional/route.ts](../../app/api/exceptional/route.ts) |
| GET | `/api/exceptions` | [app/api/exceptions/route.ts](../../app/api/exceptions/route.ts) |
| GET | `/api/expansion` | [app/api/expansion/route.ts](../../app/api/expansion/route.ts) |
| GET | `/api/fhir/[id]` | [app/api/fhir/[id]/route.ts](../../app/api/fhir/[id]/route.ts) |
| GET | `/api/fixture-migration` | [app/api/fixture-migration/route.ts](../../app/api/fixture-migration/route.ts) |
| GET | `/api/governance` | [app/api/governance/route.ts](../../app/api/governance/route.ts) |
| GET | `/api/history` | [app/api/history/route.ts](../../app/api/history/route.ts) |
| GET | `/api/household` | [app/api/household/route.ts](../../app/api/household/route.ts) |
| POST | `/api/identifier-search` | [app/api/identifier-search/route.ts](../../app/api/identifier-search/route.ts) |
| GET | `/api/identity-cases` | [app/api/identity-cases/route.ts](../../app/api/identity-cases/route.ts) |
| POST | `/api/import-rejections` | [app/api/import-rejections/route.ts](../../app/api/import-rejections/route.ts) |
| GET | `/api/incentive-claims` | [app/api/incentive-claims/route.ts](../../app/api/incentive-claims/route.ts) |
| GET | `/api/indicators` | [app/api/indicators/route.ts](../../app/api/indicators/route.ts) |
| POST | `/api/indicators` | [app/api/indicators/route.ts](../../app/api/indicators/route.ts) |
| GET | `/api/media/[id]` | [app/api/media/[id]/route.ts](../../app/api/media/[id]/route.ts) |
| DELETE | `/api/media/[id]` | [app/api/media/[id]/route.ts](../../app/api/media/[id]/route.ts) |
| POST | `/api/media` | [app/api/media/route.ts](../../app/api/media/route.ts) |
| POST | `/api/mis/callback` | [app/api/mis/callback/route.ts](../../app/api/mis/callback/route.ts) |
| GET | `/api/operations` | [app/api/operations/route.ts](../../app/api/operations/route.ts) |
| GET | `/api/outreach` | [app/api/outreach/route.ts](../../app/api/outreach/route.ts) |
| GET | `/api/pack-installations` | [app/api/pack-installations/route.ts](../../app/api/pack-installations/route.ts) |
| POST | `/api/patient-import` | [app/api/patient-import/route.ts](../../app/api/patient-import/route.ts) |
| POST | `/api/patient-matches` | [app/api/patient-matches/route.ts](../../app/api/patient-matches/route.ts) |
| GET | `/api/patients/detail` | [app/api/patients/detail/route.ts](../../app/api/patients/detail/route.ts) |
| GET | `/api/patients` | [app/api/patients/route.ts](../../app/api/patients/route.ts) |
| POST | `/api/patients` | [app/api/patients/route.ts](../../app/api/patients/route.ts) |
| GET | `/api/pilot` | [app/api/pilot/route.ts](../../app/api/pilot/route.ts) |
| GET | `/api/programme-migration` | [app/api/programme-migration/route.ts](../../app/api/programme-migration/route.ts) |
| GET | `/api/provider-sandbox` | [app/api/provider-sandbox/route.ts](../../app/api/provider-sandbox/route.ts) |
| POST | `/api/record-import` | [app/api/record-import/route.ts](../../app/api/record-import/route.ts) |
| POST | `/api/record-opened` | [app/api/record-opened/route.ts](../../app/api/record-opened/route.ts) |
| GET | `/api/referral-escalations` | [app/api/referral-escalations/route.ts](../../app/api/referral-escalations/route.ts) |
| GET | `/api/referral-requests` | [app/api/referral-requests/route.ts](../../app/api/referral-requests/route.ts) |
| GET | `/api/retention` | [app/api/retention/route.ts](../../app/api/retention/route.ts) |
| GET | `/api/rights` | [app/api/rights/route.ts](../../app/api/rights/route.ts) |
| POST | `/api/roster` | [app/api/roster/route.ts](../../app/api/roster/route.ts) |
| GET | `/api/trace` | [app/api/trace/route.ts](../../app/api/trace/route.ts) |
| GET | `/api/worker-activity` | [app/api/worker-activity/route.ts](../../app/api/worker-activity/route.ts) |
| GET | `/api/worklists` | [app/api/worklists/route.ts](../../app/api/worklists/route.ts) |
| GET | `/api/workspace` | [app/api/workspace/route.ts](../../app/api/workspace/route.ts) |

See the [command catalogue](COMMAND-CATALOGUE.csv) for every discriminator and schema location. [API and integrations](04_API-and-Integration-Specification_v1.1.md) explains identity, request, retry and external boundaries. The handler source supplies exact query/export behavior; this inventory is not a generated OpenAPI guarantee.
