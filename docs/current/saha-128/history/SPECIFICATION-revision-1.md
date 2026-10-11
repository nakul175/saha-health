# SAHA-128: runtime request-metric label protection

Frozen engineering specification revision 1 — 11 October 2026.

Owning story: [SAHA-128 / APL-151](https://linear.app/aplyd-sandbox/issue/APL-151/saha-128-safe-logs-and-analytics). Owning existing engineering task: [ENG-BR-SEC-07 / APL-764](https://linear.app/aplyd-sandbox/issue/APL-764/eng-br-sec-07-safe-logs-and-analytics). Protected original requirement: BR-SEC-07; original cases TC-BR-SEC-07-A and TC-BR-SEC-07-B remain unchanged and formally Not run. Apply shared SAHA-READY-1.0 and SAHA-DONE-1.0 at this bounded synthetic task scope.

## Inspection and scope

Base is freshly observed GitHub main `7668a03d97c1ae62174f09e65ccd5a5717120be6`. `lib/saha/monitoring.ts` already uses a TypeScript union of fixed labels rather than request paths. Its authenticated metrics row stores the tenant key, hour, route, numeric status and durations; its general console event has only event, random request ID, route, status and duration. No existing HTTP caller was found supplying a request URL as its label. This work must not claim a reproduced current HTTP URL leak.

The local gap is that the TypeScript union disappears at runtime: calling the real writer with a string outside that union currently stores and logs it. Add an explicit runtime allowlist so this monitoring boundary cannot accept a URL, record identifier, credential, clinical narrative, raw prompt or recording marker as a label. This is defense at an existing telemetry boundary, not a new user-facing screen or new diagnostic store.

The worker/support reviewer outcome is stable useful route/status/timing metadata without variable sensitive content in labels. Known callers retain their exact labels. Unknown values become one fixed `unclassified` label, preserving visibility that an unexpected call happened without preserving the supplied text.

## Frozen criteria

| ID | Observable result |
| --- | --- |
| M1 | Every label in the original main union keeps its exact value in the actual monitoring console envelope and metrics bind. The list has no removed or reinterpreted label. |
| M2 | Unknown, URL-shaped, query-shaped, record-ID-shaped, narrative, credential, recording and deliberately huge labels become exactly `unclassified` in console and metrics. Empty, null and non-string values also use that fixed label without calling their custom coercion. |
| M3 | Status, duration, count/upsert and existing 30-day pruning behavior retain their current semantics. The action runs exactly once and returns the exact original response, including refused/error status and content. No retry or new clinical side effect is introduced. |
| M4 | The existing trusted identity resolution, active-membership SQL guard and tenant resolution remain unchanged. Anonymous, reserved identity, unselected-provider headers and misconfigured identity produce no authenticated metrics row. General metadata remains free of actor/tenant/record IDs and credentials. |
| M5 | Metric storage failures retain the fixed error message, preserve the original response and expose no caught raw message, binding or input. Unread-body draining/cancellation and privacy/correlation response headers remain intact. |
| M6 | Original safe-log checks, required type/build/catalogue/guard/lint/security/documentation checks and affected regressions pass on the published candidate; all original regression IDs, minima and protected criteria remain unchanged. Retain actual failing before evidence. Separate review and final-head CI remain delivery gates. |

## Scenarios and verification boundaries

Run the actual production `measured()` function and actual identity module, transpiled without rewriting their logic. A Node contract may use explicit controlled DB/environment/log collectors; label it as a module test, not an HTTP, handset or hosted test. Check positive known labels, adversarial runtime labels, unchanged 403/409/422/503 responses, anonymous and invalid identity, storage failure, action failure, original response/body and no extra command/audit side effects. Exercise native workerd/D1 separately if its runtime lane is granted; retain true scope, raw results, source hashes and failures.

All fixtures are synthetic and use disposable local output/state. No clinical policy, provider, patient database, migration, hosted access, service activation or real recipient is introduced. Existing patient-authority/audit writers are not changed. Known larger anaemia body-drain allowance remains attached to the original known label.

## Dependencies and completion limits

WP01 is inspected through existing trusted identity and active-membership guards; an absent native `blockedBy` relation does not prove whole-epic completion. This task is independent of the unmerged D03 source and does not close its gate or authorise D04 deployment.

This task can qualify only runtime application-label protection. Hosting-level path logs, crash-report configuration/retention, and any necessary sensitive-diagnostic store and policy remain outside the local implementation and prevent whole-story acceptance. Actual live telemetry, external privacy authority, merge, observed deployed SHA, human/formal acceptance and measured user benefit are separate. No whole SAHA-128 Done or deployed-story count follows from this task.

Forecast: one bounded engineering batch plus relevant checks and separate review, conditional on inherited main failures and existing access. This is a recommendation, not a capacity/date commitment.

Do not weaken criteria to obtain a pass. A change to this specification needs an explicit new revision and re-review; elapsed time or filled fields cannot close any gate.
