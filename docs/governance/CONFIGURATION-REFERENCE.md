# Configuration reference

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: any new `SAHA_*`/provider variable in `lib/`, `deploy/` or the workflows, or a change to `.env.example`.

Names and meanings only; **no values**. The committed template is [.env.example](../../.env.example) (do not copy real values into it; it is hashed in the historical verification baselines, so this page supplements it rather than editing it). Names below were found by searching `lib/`, `app/`, `worker/`, `deploy/`, `scripts/` and `.github/` on 2026-10-08. Secret-valued names are also in the [secrets register](SECRETS-REGISTER.md).

## Application (Worker bindings / runtime environment)

| Name | In `.env.example`? | Meaning | Default when unset |
| --- | --- | --- | --- |
| `SAHA_ENVIRONMENT` | no | `synthetic`, `training`, `staging` or `production`; other values are treated as misconfigured and refuse fixtures and live calls ([Administrator guide](../current/ADMINISTRATOR-GUIDE.md)) | `synthetic` |
| `SAHA_EXTERNAL_APIS_ENABLED` | yes | Master switch for live provider calls; a toggle alone does not activate a workflow | off (`false`) |
| `SAHA_ALLOWED_ORIGINS` | yes | Comma-separated origins of approved HTTP AI providers | none |
| `SAHA_PROVIDER_API_KEY`, `OPENAI_API_KEY` | yes | Secrets for AI providers | none |
| `SAHA_MIS_CONNECTIONS`, `SAHA_EHR_CONNECTIONS` | yes | JSON arrays of exactly scoped connection grants | `[]` |
| `SAHA_MIS_PARTNER_KEY`, `SAHA_MIS_PARTNER_CALLBACK_KEY`, `SAHA_EHR_PARTNER_KEY` | yes | Partner secrets | none |
| `SAHA_IDENTITY_PROVIDER` | yes | `sites-chatgpt` or `cloudflare-access` | `sites-chatgpt` |
| `SAHA_ACCESS_TEAM_DOMAIN`, `SAHA_ACCESS_AUD` | yes | Required with `cloudflare-access`; must match the Access application | none |
| `SAHA_DEMONSTRATION_PACKAGE` | yes | `manual` turns off automatic installation of the demonstration clinical package | automatic in synthetic |
| `SAHA_ANAEMIA_DEMO_ENABLED`, `SAHA_ANAEMIA_DEMO_BOOTSTRAP`, `SAHA_ANAEMIA_ORIGIN`, `SAHA_ANAEMIA_API_KEY`, `SAHA_ANAEMIA_DISPATCH_TOKEN` | yes | Independent anaemia provider demo (private demo only) | disabled |
| `SAHA_FRONTLINE_DEMO_ENABLED`, `SAHA_FRONTLINE_PROVIDERS_JSON` | yes | Frontline provider apps demo | disabled |
| `SAHA_REMINDER_MOCK_CALLBACK_ENABLED`, `SAHA_REMINDER_MOCK_CALLBACK_GRANTS`, `SAHA_REMINDER_MOCK_CALLBACK_KEY` | yes | Mock reminder STOP callbacks only | disabled |
| `SAHA_AUDIT_SIGNING_KEY` | no | Secret for signed audit checkpoints; without it only unsigned checkpoints are issued (503 on signed) | none |
| `SAHA_MEDIA_STORAGE` | no | Empty/`d1` stores media in D1; `r2-private-v1` needs an R2 `BUCKET` binding | `d1` |
| `SAHA_CLINICAL_SOURCE_FETCH_ENABLED`, `SAHA_CLINICAL_SOURCE_ORIGINS`, `SAHA_CLINICAL_SOURCE_FETCH_TIMEOUT_MS` | no | Approved-origin clinical source retrieval; must be `true` to enable; comma-separated origins; timeout ms | disabled; 10000 |
| `DB` (D1 binding) | n/a | The database | required |

`lib/saha/environment.ts` reports an owner configuration check; misconfiguration fails closed.

## Droplet provisioning (`deploy/provision.sh`)

| Name | Meaning |
| --- | --- |
| `SAHA_HOST` | Public host name, for example `health.<ip-dashed>.sslip.io` or a custom domain (required) |
| `SAHA_FIRST_USER` | Email of the first person allowed to sign in (required) |
| `SAHA_GIT_TOKEN` | Optional read-only GitHub token; if unset a deploy key is generated |

## Cloudflare deploy (frozen)

`deploy/cloudflare-staging.json` (account, worker, team domain, audience tag, `scheduledCron`; identifiers, not secrets); `SAHA_D1_DATABASE_ID` (set by the deploy script); repository variable `SAHA_DEPLOY_FREEZE` (`true` stops merge deploys); Actions secrets `CLOUDFLARE_API_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`.

## Tests and tooling

`SAHA_TEST_PORT`, `SAHA_RESTORE_PORT`, `SAHA_HOSTED_URL`, `SAHA_A11Y_MODULES`, `SAHA_A11Y_CHROMIUM`, `SAHA_A11Y_ORIGIN`, `SAHA_CHROMIUM`, `SAHA_PLAYWRIGHT_MODULES`, `SAHA_LEGACY_WORK` and the `SAHA_MEMORY_*` diagnostics are used only by test and diagnostic scripts; see [Testing Saha](../current/TESTING.md).

## Gap

`.env.example` lacks the five "no" rows above. Adding them needs a baseline refresh: TBD (owner: Nakul Jain).
