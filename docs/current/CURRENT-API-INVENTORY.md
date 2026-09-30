# Current API inventory

Generated from source: **27 HTTP method/route pairs** and **146 command schema discriminators**. Discriminators are not distinct HTTP endpoints or claims that all contexts may execute them. Server authority, state and configuration gates remain decisive. The original 74 proposed REST operations and 16 event types remain target design.

| Method | Route | Handler |
| --- | --- | --- |
| GET | `/api/abdm` | [app/api/abdm/route.ts](../../app/api/abdm/route.ts) |
| GET | `/api/audit/chain` | [app/api/audit/chain/route.ts](../../app/api/audit/chain/route.ts) |
| GET | `/api/audit` | [app/api/audit/route.ts](../../app/api/audit/route.ts) |
| GET | `/api/caseload` | [app/api/caseload/route.ts](../../app/api/caseload/route.ts) |
| POST | `/api/commands` | [app/api/commands/route.ts](../../app/api/commands/route.ts) |
| GET | `/api/continuity` | [app/api/continuity/route.ts](../../app/api/continuity/route.ts) |
| GET | `/api/exceptional` | [app/api/exceptional/route.ts](../../app/api/exceptional/route.ts) |
| GET | `/api/expansion` | [app/api/expansion/route.ts](../../app/api/expansion/route.ts) |
| GET | `/api/fhir/[id]` | [app/api/fhir/[id]/route.ts](../../app/api/fhir/[id]/route.ts) |
| GET | `/api/governance` | [app/api/governance/route.ts](../../app/api/governance/route.ts) |
| GET | `/api/history` | [app/api/history/route.ts](../../app/api/history/route.ts) |
| GET | `/api/household` | [app/api/household/route.ts](../../app/api/household/route.ts) |
| GET | `/api/identity-cases` | [app/api/identity-cases/route.ts](../../app/api/identity-cases/route.ts) |
| GET | `/api/indicators` | [app/api/indicators/route.ts](../../app/api/indicators/route.ts) |
| GET | `/api/media/[id]` | [app/api/media/[id]/route.ts](../../app/api/media/[id]/route.ts) |
| DELETE | `/api/media/[id]` | [app/api/media/[id]/route.ts](../../app/api/media/[id]/route.ts) |
| POST | `/api/media` | [app/api/media/route.ts](../../app/api/media/route.ts) |
| POST | `/api/mis/callback` | [app/api/mis/callback/route.ts](../../app/api/mis/callback/route.ts) |
| GET | `/api/operations` | [app/api/operations/route.ts](../../app/api/operations/route.ts) |
| GET | `/api/outreach` | [app/api/outreach/route.ts](../../app/api/outreach/route.ts) |
| POST | `/api/patient-matches` | [app/api/patient-matches/route.ts](../../app/api/patient-matches/route.ts) |
| GET | `/api/pilot` | [app/api/pilot/route.ts](../../app/api/pilot/route.ts) |
| GET | `/api/referral-escalations` | [app/api/referral-escalations/route.ts](../../app/api/referral-escalations/route.ts) |
| GET | `/api/retention` | [app/api/retention/route.ts](../../app/api/retention/route.ts) |
| GET | `/api/rights` | [app/api/rights/route.ts](../../app/api/rights/route.ts) |
| POST | `/api/roster` | [app/api/roster/route.ts](../../app/api/roster/route.ts) |
| GET | `/api/workspace` | [app/api/workspace/route.ts](../../app/api/workspace/route.ts) |

See the [command catalogue](COMMAND-CATALOGUE.csv) for every discriminator and schema location. [API and integrations](04_API-and-Integration-Specification_v1.1.md) explains identity, request, retry and external boundaries. The handler source supplies exact query/export behavior; this inventory is not a generated OpenAPI guarantee.
