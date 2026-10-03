# Testing Saha

3 October 2026 (IST), round 11. How Saha is tested, what each kind of test proves and does not prove, how to run it, and when it runs on GitHub. Every layer below runs against a local built Worker with synthetic data unless it says otherwise. None of it changes the status of any of the 176 BRD acceptance criteria: acceptance needs named people (see UAT).

## The layers

| Layer | What it checks | Where | Size and local time (3 Oct 2026) | Runs on GitHub |
| --- | --- | --- | --- | --- |
| Static | Type check, documentation and requirement integrity, test catalogue completeness | `scripts/check-documentation.py`, `scripts/audit-requirements.mjs`, `scripts/test.mjs --check-catalogue` | 4 checks, about 20 s | Every pull request |
| Unit | One module at a time: `lib/saha/*.ts` transpiled and checked with `node:assert`, with injected transports, clocks and storage | `tests/*-contract.mjs`, `tests/*-client.mjs` and three named suites | 106 suites, 7,193 assertions, about 2 min | Every pull request |
| Integration | The built Worker over HTTP with a real local D1: commands, authorisation, revisions, audit, receipts, imports, every feature slice | `tests/run-api-smoke.mjs` (80 modules `tests/*-smoke.mjs`; despite the name they are integration tests) and `tests/scheduled-local-check.mjs` | 4,599 + 8 assertions, about 4 min | Every pull request (the scheduled check weekly) |
| Resilience | Encrypted backup, restore into a fresh database, restarted Worker reads | `tests/recovery-drill.mjs` | 21 checks, 4 s | Every pull request |
| Smoke | "Is this build alive and are the main paths intact": sign-in model, home organisation and clinical package, invite and join, a visit with a danger sign through to receipts, role refusals, every GET route without a 5xx | `tests/smoke/local-smoke.mjs` | 28 checks (1 skipped), 7 s plus Worker start | Every pull request |
| Smoke, hosted | After each deploy: the site is held by Cloudflare Access, forged identity headers and unsigned tokens do not get in, TLS and response headers; with an Access service token, how the app answers it | `tests/smoke/hosted-smoke.mjs` (its `--self-test` proves the checks against a local stand-in) | 8 self-test checks, 7 s | After every deploy (`deploy-staging.yml`); self-test on every pull request |
| UI (end to end) | Real browser journeys per role: owner setup and invitations, the ASHA visit with a danger sign through receipts, supervisor and ASHA menus, governance, phone width, Hindi, refusals; no uncaught page or console errors | `tests/ui/*.spec.mjs` with `tests/ui/playwright.config.mjs` (Playwright 1.56.1, Chromium, desktop and 390x844) | 17 tests, about 2 min | Weekly and on demand (`regression.yml`) |
| UI, screenshots | Eight stable screens compared with committed baselines (dynamic text masked, 2% tolerance) | `tests/ui/baselines/` | 8 images | Weekly and on demand |
| UI, accessibility | axe (serious and critical) on 25 screens reached by the journeys | inside the UI specs | 25 screens, 0 violations | Weekly and on demand |
| Non-functional, security | Authorisation matrix: every GET route by every role (anonymous, stranger, owner, admin, supervisor, two ASHAs, clinician), cross-patient and cross-organisation requests, admin never sees patient names, revocation on the next request. Identity hardening: Cloudflare Access tokens in the real runtime, forged, malformed, wrongly signed, `fixture:` principals | `tests/nfr/authorisation-matrix.mjs`, `tests/nfr/identity-hardening.mjs` | 51 and 29 checks, about 35 s | Every pull request |
| Non-functional, performance | p50/p95 of the main routes and commands at about 200 patients, response sizes, generous budgets that only catch large regressions | `tests/nfr/performance-budgets.mjs` | 94 checks plus recorded measurements, 1 min | Weekly and on demand |
| Non-functional, memory and load | Worker memory growth per workspace load without an inspector (Miniflare); eight concurrent clients with idempotent replays, no lost or duplicated commands | `tests/nfr/memory-growth.mjs`, `tests/nfr/load-burst.mjs` | 4 and 13 checks plus recorded measurements, about 1.5 min | Weekly and on demand |
| Functional coverage | For each of the 176 requirements: the test files that cite it, by layer; the acceptance catalogue cases by type and how many were formally executed; gap flags | `tests/uat/coverage-map.mjs` → `docs/testing/COVERAGE.md`, `coverage.csv` | 176 rows | Drift check on every pull request |
| UAT | People, not code: role scripts built from the 364-case acceptance catalogue, run on the hosted site, recorded in a register a validator checks | `docs/testing/uat/` (plan, six scripts, `uat-results.csv`), `tests/uat/generate-uat-pack.mjs`, `tests/uat/check-uat-register.mjs` | 158 cases, 0 executed | Register validated on every pull request |
| Regression | Every layer above together, plus a guard: a suite that disappears or reports fewer passed assertions than its baseline fails the run unless it is quarantined with a reason | `scripts/test.mjs regression`, `tests/regression-baseline.json`, `tests/quarantine.json` | 120 suites guarded, about 12 min locally | Weekly (Mondays 02:30 UTC) and on demand; the guard also runs on every suite pull-request CI starts |

Manual suites, run on purpose: `tests/a11y-audit.mjs` (66 screens), `tests/load-envelope.mjs`, `tests/adapter-overhead-bench.mjs`.

## Running tests

```sh
npm run install:ci && npm run build
npm test                         # the pull-request tier: static, unit, integration, resilience, smoke
npm run test:ui                  # browser journeys (Chromium must be installed: npx playwright install chromium)
npm run test:nfr                 # security, performance, memory, load
npm run test:uat                 # UAT register and generated-document drift checks
npm run test:regression          # everything, then the regression guard
node scripts/test.mjs --list     # every suite with its layer and tier
node scripts/test.mjs nfr --only nfr/authorisation-matrix   # one suite
```

Results go to `tests/reports/` (not tracked): one JSON report per suite, `summary.json` for the run and a log per suite in `tests/reports/logs/`. The runner restores tracked result files afterwards, because stray result files break the documentation check. Set `SAHA_TEST_PORT` when another Worker uses port 8787. Evidence for a slice is copied to `tests/evidence/<slice>/` with a manifest.

## When tests run on GitHub

- **Pull requests** (`ci.yml`): static, unit, integration, resilience, smoke (local and the hosted self-test), the two security suites and the UAT checks, all through `scripts/test.mjs` with the regression guard. About 12 minutes, of which about 3 are new in round 11 (estimate from the 9-minute job measured before this round).
- **Documentation-only pull requests** (`docs-checks.yml`): `ci.yml` skips them to save minutes, so this short job runs the documentation and requirement checks, the test catalogue check, the UAT register validator and the drift checks of the generated UAT pack and coverage map. No build, no Worker.
- **After every deploy** (`deploy-staging.yml`): the hosted smoke against the live site. A failed check fails the deploy job; an unreachable site is a warning.
- **Weekly and on demand** (`regression.yml`, Actions tab, "Run workflow"): every layer including UI, performance, memory and load, then the regression guard; reports are uploaded as an artifact. About 15–20 minutes.

GitHub Actions minutes are limited on this account, which is why the browser and performance suites are weekly, not per pull request.

## Adding or changing a test

- Put it where its layer lives: `tests/<name>-contract.mjs` for a unit suite, a module imported by `tests/api-smoke.mjs` for integration, `tests/smoke/`, `tests/ui/*.spec.mjs`, `tests/nfr/` or `tests/uat/`. Helpers go in a `lib/` or `support/` folder. `node scripts/test.mjs --check-catalogue` fails if a file is unclassified or an integration module is not imported, so nothing is silently left out.
- New suites use `tests/lib/worker.mjs` (a fresh local Worker and database, synthetic identities) and `tests/lib/report.mjs` (one result format).
- Write the failing test before the fix, and make sure the test can fail: several suites include checks that deliberately break the system or the harness and expect a failure.
- A measurement (`measure()`) counts as a check only when it has a budget; without one it is recorded, not counted. A UI test that passes only on its retry counts as failed and is named flaky in `tests/reports/ui-result.json`.
- When a suite's count changes on purpose, update the baseline deliberately: `node scripts/test.mjs <layers> --update-baseline --reason "..."` after a green run. A flaky suite goes in `tests/quarantine.json` with a reason and date, never silently.
- Cite a new suite in `requirements/evidence-map.json` for the requirements it gives evidence about, then regenerate the coverage map (`node tests/uat/coverage-map.mjs`). A citation is context, not acceptance.

## User acceptance testing

UAT is done by people on the hosted synthetic site, following [the UAT plan](../testing/uat/UAT-PLAN.md). Freeze deploys first (`SAHA_DEPLOY_FREEZE=true`) so the build does not change during a round, record the build in the register, and have a different named person review each result. `node tests/uat/check-uat-register.mjs` rejects a Pass without executor, date, build, evidence and an independent reviewer, and a Fail without a defect. Negative, recovery and performance catalogue cases are not in the UAT pack, because a tester on the hosted site cannot create the faults or load they need; they belong to the automated layers.

## What the tests found in round 11

- **Hosted sign-in has never worked** since Access went live on 2 October: the Worker fetched Access's signing keys with a redirect mode the Workers runtime rejects, so every signed-in person got 401. Found by the identity suite; fixed in slice 0c-1 (#118). The same option in the provider and partner calls is fixed in slice 11f.
- **Open:** reads occasionally refused with 503 under concurrency when their audit event cannot be written (fails closed); Worker memory grew from about 199 MB to 583 MB over 3,000 loads without levelling off (a Cloudflare isolate allows 128 MB; not measured on Cloudflare); workspace loads slowed by 74% over 8,000 loads. Details in [slice 11d](SLICE-11D-NON-FUNCTIONAL.md) and [slice 11f](SLICE-11F-TESTING-INTEGRATION.md).

## Limits

- Everything automated runs locally on synthetic data; local timings are from a shared 2-core machine and say nothing about Cloudflare latency or capacity.
- The regression guard counts passed assertions; it cannot tell a weak test from a strong one. One agent reviewed the test code (slice 11g fixed what it found); no person has.
- The hosted smoke cannot see a broken Worker without an Access service token, and the app refuses service tokens; there is no test yet of applying new migrations to a populated database with the deploy command. Both are listed in [slice 11g](SLICE-11G-TEST-REVIEW-FIXES.md).
- Screenshot baselines were rendered on one container's fonts and may need regenerating on GitHub's runner (`npx playwright test -c tests/ui/playwright.config.mjs --update-snapshots`).
- The coverage map shows citations, not proof; 72 requirements inherit their area's citations, and some test files cite no requirement.
- Formal execution of the acceptance catalogue is 0 of 364. Until people run the UAT pack, the automated layers are engineering evidence only.
