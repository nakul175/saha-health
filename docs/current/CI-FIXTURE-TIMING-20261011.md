# Composite-report fixture timing repair — 11 October 2026

Independent technical prerequisite for the current encounter user-story qualification; not a new patient feature or completed parent story. User authorized coding with Delivery System v1.0 on 11 October after the previous coding window expired. Base main: `7668a03d97c1ae62174f09e65ccd5a5717120be6`.

## Frozen task contract

Repair `tests/composite-authority-repair-http.mjs` release scheduling only. Hosted run38113283184, job114393085400 aborted this suite with HTTP422: “Choose an effective time at or after this server check.” The fixture used clientNow+100ms. That is setup for authorization/privacy tests, not a declared performance acceptance target. Exact server/transport timing was not measured.

1. Preserve the server rejection of past effective times and all application/clinical behavior: no app/lib/worker/migration changes.
2. Retain all seven expression lifecycle setups and original86 assertions/minimum; no quarantines, relaxed statuses, retries or guard changes.
3. Deliberately wait250ms before each release request, exceeding the previous100ms setup window. Schedule5000ms ahead, then wait until that exact deadline plus20ms before report assertions. A response taking longer than the headroom fails normally; no repeated release writes.
4. Execute the suite against a fresh built local Worker and synthetic D1, with the original regression guard; retain failures and source/environment identity.
5. Publish the isolated task with exact-head CI and genuine independent review before qualified merge. Merge, observed synthetic staging, full story acceptance and production release are distinct. Existing frozen story gates remain held.

Risk: test-only setup change, engineering C1; no identity, permission, data, API or clinical policy delta. The loopback environment is isolated to this checkout. Existing dependencies are reused from the prior installed checkout without modifying their files. No new hosting/provider/spend/secrets.

## Evidence and adoption boundary

Delivery bundle master SHA: `8732cefe6224c202acb7ec3e8d1c64b351686205d70160f5cbcf34307810d375`;381file integrity passes. Native connection/adoption tools were invoked in proposal/dry-run modes only: missing accountable owners and approved bindings remain unresolved; no enforced assembly-line or independent approval is claimed. Existing repository router/checks remain authoritative.

Fresh application build passes. First sandbox test cannot start its loopback listener (`EPERM`); retained as an environment failure. Authorized loopback-capable execution passes86/86 with original guard and zero quarantine. The old100ms window with the same250ms delay reproduces HTTP422; source and raw outputs are retained in `ci-fixture-timing-20261011/`. Hosted original failure and exact final test evidence must remain separate. Existing176 requirement assessments,364 formal test cases and all parent statuses are unchanged.

## Historical source custody correction

First documentation check correctly refuses changing a test source pinned by an immutable earlier evidence manifest, and refuses hand-editing generated DELIVERY-CONTROL. That failed log is retained. The original test and evidence remain byte-exact; a named current driver carries the timing repair, writes a separate report, and owns the same guarded suite ID. Only baseline file metadata changes; minimum86 and every other baseline entry remain unchanged. The frozen criteria above now apply to the current driver while the historical original remains a direct-only witness. No checker weakening or historical hash rewrite. New current-driver execution is required; the prior86-pass run remains a superseded fixture-only observation.

Final current-driver local run:86passed/0failed/0skipped, original minimum86/zero quarantine, actual synthetic Worker+D1. Build and TypeScript pass. Task https://github.com/nakul175/saha-health/issues/196. Source/runner evidence in [current run](ci-fixture-timing-20261011/current-driver-run.json). Exact-head hosted CI, independent review and merge remain pending.

Additional verification: test-runner contract27/27 with original guard; documentation integrity1782source pins and176requirements pass; catalogue classifies all966suites (one added historical witness, unchanged primary guarded suite); TypeScript passes. These are different denominators and do not mark formal user-story acceptance.

Hosted documentation run38125148637 on3e186ba8 passes initial integrity/requirements/catalogue but fails UAT generation at8/1: COVERAGE.md missing the new unlinked driver. Actual log retained. Regenerated with the existing generator, no checker/oracle edits; all three UAT tooling suites now63/0 under original guards. This is register/tooling validation, not364formal case execution or user acceptance. New head CI must qualify afresh.
