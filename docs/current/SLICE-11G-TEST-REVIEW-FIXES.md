# Development slice 11g — fixes from the review of the round-11 test code

3 October 2026 (IST). A separate agent that wrote none of it reviewed the round-11 testing ecosystem (slices 11a–11f) for checks that cannot fail, misleading reports, flakiness, safety and CI correctness. It found two high, seven medium and eight low findings. This slice fixes both high findings and most of the rest. Synthetic data only; formal acceptance unchanged.

## Fixed

- **H1 — the regression guard covered none of the new layers.** The baseline held only the unit, integration and resilience suites, so a smoke, UI, non-functional or UAT suite could lose checks or vanish without the guard noticing. The baseline now holds all 120 suites (recorded from a green run in 11f), and pull-request CI runs every suite it starts with `--guard`, not only the unit suites.
- **H2 — documentation-only pull requests skipped every check.** `ci.yml` ignores Markdown and `docs/` to save minutes, which also skipped the documentation integrity check, the UAT register validator (the file where formal results will be recorded) and the drift checks of the generated UAT pack and coverage map. A new short workflow, `docs-checks.yml`, runs exactly those on such pull requests: no build, no Worker.
- **M1 — identity hardening could pass for the wrong reason.** Its misconfigured-provider section accepted any 503, and a request reaching the unmigrated database is also a 503. It now requires the configuration refusal text.
- **M2 — measurements without a budget counted as passed checks.** They are now recorded but not counted; only a measurement with a budget is a check. The performance, memory and load suites' counts fell accordingly (see Results), which is the honest number.
- **M3 — flaky UI tests were invisible.** A test that passed only on its retry was added to the passed count. It now counts as failed and is named flaky. The runner keeps the UI suite's own reporter, so `tests/reports/ui-result.json` (accessibility findings, browser messages) is written under the runner too.
- **M4 — the deploy token was visible to the hosted smoke step.** That step now runs with `CLOUDFLARE_API_TOKEN` cleared. (The token is still a job-level variable for the other steps; narrowing it further is left to a deploy-workflow change.)
- **M6 — the local smoke turned an owner 4xx into a skip.** A route that needs no parameters and answers the owner with a 4xx is now a failure. The 90-second target is kept as a measurement with a 180-second budget, so a loaded runner does not fail a functional smoke.
- **M7 — CI built the HTTP suite's database the unreliable way.** Pull-request CI now runs the HTTP suite and restore drill through the runner, which migrates in one call.
- **L1** an always-true assertion in the phone journey removed; **L4** the shared harness escalates a stuck Worker to SIGKILL after 10 s and refuses a port that is still busy instead of continuing silently.

## Left open

- **M5 — the hosted smoke cannot see a broken Worker without a service token.** Anonymous requests are answered by Cloudflare Access and never reach the Worker; the app refuses service tokens (they carry no email). A health check that reaches the Worker needs a design decision.
- **Most valuable missing test (review):** an upgrade test that applies the previous migrations, seeds data, runs `wrangler d1 migrations apply` (the deploy command) and then the smoke. Every merge applies migrations to the persistent staging database and nothing tests that path.
- L2 (the harness self-checks pass on any failure), L3 (`--list --json` output cut at 64 KB), L5 (a run restores tracked evidence files at layer boundaries), L6 (a suite that exits 0 with no report counts as passed unless baselined; now all are baselined), L7 (screenshot tolerance of 2% may let a small label change through), L8 (parallel runs can mix reports), and the deploy job running no test suites of its own.

## Results

See the round-11 review section of `VALIDATION.md` and `tests/evidence/slice-11g/`.
