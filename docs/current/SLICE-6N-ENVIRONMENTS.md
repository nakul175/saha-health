# Development slice 6n — environment separation and configuration check

30 September 2026 (IST). Builds on slice 6m. Synthetic data only; nothing was deployed and no real Site configuration was changed. Formal acceptance unchanged.

## What changed

- **Declared environment.** A deployment declares `SAHA_ENVIRONMENT` as `synthetic`, `training`, `staging` or `production` (`lib/saha/environment.ts`). Unset means `synthetic`, which keeps the behaviour of earlier releases for this repository's sandbox; any other value is treated as `misconfigured` and fails closed.
- **Policy.**

  | Environment | Synthetic fixtures | Live provider calls | Demonstration connectors | Fixture records to destinations |
  | --- | --- | --- | --- | --- |
  | synthetic | seeded | when `SAHA_EXTERNAL_APIS_ENABLED=true` (unchanged) | yes | yes |
  | training | seeded | never | yes | no |
  | staging | none | when the switch is on and the deployment check has no errors | no | no |
  | production | none | when the switch is on and the deployment check has no errors | no | no |
  | misconfigured | none | never | no | no |

- **Live calls.** Every provider path already refuses when its runtime's `SAHA_EXTERNAL_APIS_ENABLED` is not `true`. `runtime()` in `lib/saha/server.ts` now returns the configuration with that switch forced off whenever the policy withholds live calls, so the MIS send, probe, lookup and signed callback, the EHR paths, the AI agent and legacy provider calls, evaluations and the readiness displays all follow the policy without changes to their own code. `rawRuntime()` is used only for reporting.
- **Production is refused in this build.** Programme messages, probes and FHIR documents carry a fixed `synthetic` label (`lib/saha/mis.ts`, `lib/saha/mis-execution.ts`, `lib/saha/fhir-document.ts`). The deployment check reports this as an error in production (a warning in staging), so live calls from production are refused until the labels follow the environment.
- **Fixtures.** A new account's home organisation receives the six synthetic people only in synthetic and training, and each is now marked `synthetic: true`. In staging, production and a misconfigured deployment it starts empty and without the demonstration MIS and AI simulators; the unconfigured EHR and ABDM placeholders remain. New organisations follow the same rule for demonstration connectors. Existing records are not changed.
- **Command guards.** Outside synthetic and training, activating a demonstration connector and executing a plan that includes one are refused (suspending one stays possible). Outside synthetic, a plan, programme send or EHR publication for a record marked as a synthetic fixture is refused, so a demonstration record cannot reach a destination if a synthetic database is ever carried into another environment. A plan whose recipients are all demonstration connectors is not a destination, so training practice with fixtures still works (follow-up after slice 2d).
- **Configuration check.** `GET /api/environment` (owners only) returns the environment, its source (configured, default or invalid), the policy, whether live calls are allowed and why, and checks for the environment setting, sign-in configuration, the external switch, the AI origin allowlist, the programme and EHR grant lists, outbound labels, and each of the organisation's HTTP connections (endpoint, credential binding set or missing, grant or allowlist entry), plus demonstration connectors still active and synthetic fixture records present outside synthetic. It reports names and states only: secret values are never read into the report. Only this organisation's grants are examined.
- **Screen.** The banner under the top bar and the top-bar pill now show the declared environment, with an amber banner for production and a misconfigured deployment. Organisation & team gains an owner-only "Environment and configuration" panel that runs the check.
- Operations report and support exports, the audit-chain export header and the slice 6m data export now record the declared environment instead of a fixed `synthetic`.

## Evidence

- 26 contract checks (25 in the slice, 1 in the follow-up; `tests/environment-contract.mjs`): environment parsing and fail-closed values; live policy for every environment with the switch off and on, including staging refused for an unsafe origin, a broken sign-in configuration and an unreadable grant list, and production refused for outbound labels; the effective runtime turns the switch off without altering the raw configuration, after which the real `misCredential` (send and callback) and `ehrCredential` refuse in training, production and a misconfigured deployment while synthetic and staging still return the granted credential; fixtures by environment; a new account's home organisation created through the real store and migrations with six marked fixture people in synthetic and by default, and none (and no demonstration connectors) in production; the command guards for demonstration connectors and synthetic fixture records, and their absence in synthetic; a fixture record's plan to demonstration connectors allowed in training and refused in production; five configuration reports that contain none of four distinctive secret values, with credential, grant and allowlist problems named per connection.
- 22 HTTP/D1 assertions (`tests/environment-smoke.mjs`, default synthetic Worker): ASHA, clinician, supervisor, administrator and non-member refused; the owner's snapshot and report show the synthetic environment from its default source, live calls refused because the switch is off, and each HTTP connection named with its binding; a new account's home organisation has six marked fixture people and working demonstration connectors.
- Local Worker check (built Worker served four times with `--var SAHA_ENVIRONMENT:<value> --var SAHA_EXTERNAL_APIS_ENABLED:true`, fresh local database each time, headless Chromium): production gave an empty home organisation and a new organisation with no demonstration connectors, live calls refused for the outbound-label error, the amber production banner and a PRODUCTION pill; training gave six marked fixture people and live calls refused; staging gave no fixtures and live calls allowed; `Prod` gave a misconfigured deployment with no fixtures and live calls refused. axe-core found no violations in the banner or the panel; no console errors. `tests/evidence/slice-6n/environment-local-workers.json`.
- All suites: see [VALIDATION.md](../../VALIDATION.md). Reports in `tests/evidence/slice-6n/`.

## Limits

- Separation is by declaration. Separate identities, databases and credentials per environment are deployment work; this slice makes the environment explicit and enforces what follows from it inside the application. Nothing stops an operator declaring the wrong environment.
- Records are not marked synthetic by the environment they were created in; only seeded fixtures carry the mark. Everything in a synthetic database is synthetic by that deployment's declaration.
- Live calls from production stay refused until outbound payloads carry the environment instead of the fixed synthetic label.
- The configuration check is read-only and runs on request. It is not a gate on configuration changes (BR-OPS-01's validation before activation), is not audited, and does not check hosting, backups or data residency.
- A misconfigured deployment still serves the application for synthetic work; it only refuses fixtures and live calls. BR-OPS-01 and BR-OPS-02 stay partial.
