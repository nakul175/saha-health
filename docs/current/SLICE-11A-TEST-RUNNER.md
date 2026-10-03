# Development slice 11a — unified test runner, suite catalogue, regression guard and tiered CI

3 October 2026 (IST). Test tooling only: no file under `lib/`, `app/` or `worker/` changed, and no requirement changes status (all 176 BRD acceptance criteria remain pending). Synthetic data only. Built and run by an agent; not independently reviewed.

Before this slice there were about 190 test files and one way to run them: a hand-maintained list of 105 contract names in `.github/workflows/ci.yml`, a separate command for the HTTP/D1 suite, and a handful of scripts that were run by hand. Nothing stopped a new suite from being left out of CI, a suite from quietly checking less, or a stray `tests/*-result.json` from breaking the documentation check. This slice adds one runner, one catalogue that classifies every test file, a regression guard, and a second, rarely run CI workflow. It is the foundation the round-11 smoke, UI, non-functional and UAT suites plug into: they are found by directory and need no change to the runner.

## What was added

| File | Purpose |
| --- | --- |
| `scripts/test.mjs` | The runner: `node scripts/test.mjs <layer or alias ...> [options]`. |
| `scripts/test-catalogue.mjs` | Classifies every runnable test file into exactly one layer; the rules and the consistency check. |
| `scripts/test-guard.mjs` | Result parsing, pass/fail decision, regression guard and baseline update (pure functions). |
| `tests/test-runner-contract.mjs` | 25 checks of the three modules above, including the real runner on throw-away git repositories. |
| `tests/regression-baseline.json` | Minimum passed-assertion count for each of 109 suites, taken from a real run (below). |
| `tests/quarantine.json` | Suites excused from the guard, each with a reason and a date. Empty. |
| `.github/workflows/regression.yml` | The heavy tiers (UI, non-functional, regression), manual and weekly. |
| `.github/workflows/ci.yml` | Edited: the contract loop is now the runner; catalogue check, smoke step and report upload added. |
| `package.json` | `scripts` only: `test`, `test:static`, `test:unit`, `test:integration`, `test:resilience`, `test:smoke`, `test:ui`, `test:nfr`, `test:uat`, `test:full`, `test:regression`, `test:catalogue`. |
| `tests/recovery-drill.mjs` | One change: the restored Worker's port is `SAHA_RESTORE_PORT` (default 8788, as before), so the drill no longer collides with another process on 8788. |

## Layers

Each suite is one file run as a child process (`node <file>`), except the UI layer, which may be one Playwright configuration. A suite exits non-zero when it fails and writes a JSON result. The suite id is `<layer>/<file name without extension>`, for example `unit/alerts-contract`.

| Layer | Which files | Needs | In `pr` |
| --- | --- | --- | --- |
| `static` | Four commands, not files: the catalogue check, `tsc --noEmit`, `python3 scripts/check-documentation.py`, `node scripts/audit-requirements.mjs --check`. | nothing built | yes |
| `unit` | `tests/*-contract.mjs`, `tests/*-client.mjs`, `tests/field-shell.mjs`, `tests/ehr-execution.mjs`, `tests/mis-delivery.mjs`. They transpile `lib/saha/*.ts` and check with `node:assert`. 106 suites. | nothing built | yes |
| `integration` | `tests/run-api-smoke.mjs`: the HTTP and D1 suite against the built Worker (4,599 assertions). Its entry module `tests/api-smoke.mjs` and the 80 `tests/*-smoke.mjs` modules are components, listed but never run on their own. Also `tests/scheduled-local-check.mjs` (below). | `dist/`, a fresh local D1 state, one port | the HTTP suite only |
| `resilience` | `tests/recovery-drill.mjs`: encrypted backup and restore (21 checks). | `dist/`, and the database the HTTP suite populated | yes |
| `smoke` | `tests/smoke/*.mjs` | `dist/` | yes |
| `ui` | `tests/ui/playwright.config.{mjs,js,ts}` (its `*.spec.*` files are components) and any `tests/ui/*.mjs` | `dist/`; Playwright for a configuration | no |
| `nfr` | `tests/nfr/*.mjs` | `dist/` | no |
| `uat` | `tests/uat/*.mjs` generators | nothing built | no |
| `manual` | `tests/a11y-audit.mjs`, `tests/load-envelope.mjs`, `tests/adapter-overhead-bench.mjs`: run on purpose, never by default | see `--list` | no |

Aliases: `pr` = `static unit integration resilience smoke`; `full` = every layer except `manual`; `regression` = `full` plus the regression guard. With no argument the runner runs `pr`. `pr` runs only the suites marked pr-tier; naming a layer (or `full`) runs all of that layer.

`tests/scheduled-local-check.mjs` is classified `integration`, not `unit`: it starts the built Worker with wrangler's scheduled-test support on a local D1 and needs `dist/` and a port. It was never part of CI (slice 10a said so), so it is marked an extended-tier suite: `integration`, `full` and `regression` run it (about one minute), `pr` does not. `tests/api-smoke.mjs` and `tests/database-fixtures.mjs` are support, not suites. A helper placed in a `lib/`, `fixtures/`, `helpers/`, `support/`, `utils/`, `pages/` or `data/` folder, or named with a leading underscore, is support too.

## The catalogue and its check

`node scripts/test.mjs --check-catalogue` (also `npm run test:catalogue`; about 0.1 s) lists every `.mjs`, `.js`, `.cjs`, `.ts`, `.mts`, `.cts` and `.tsx` file under `tests/` (not `tests/evidence/` or `tests/reports/`), applies the rules in `scripts/test-catalogue.mjs` in order, and fails with the file name when:

- a test file matches no rule (a new `tests/foo.mjs`, or a file in a layer folder that is not directly inside it);
- a `tests/*-smoke.mjs` module is not imported by `tests/api-smoke.mjs`, so it would never run, or `tests/api-smoke.mjs` imports one that does not exist;
- a named suite (`recovery-drill`, `run-api-smoke`, the three manual ones) is missing, or `tests/ui` holds Playwright specs but no configuration.

A run refuses to start (exit code 2) on an inconsistent catalogue. `node scripts/test.mjs --list` prints the suites; `--list --json` and every run also write `tests/reports/catalogue.json`.

Requirement ids: for each test file the catalogue lists the requirements that cite it in `requirements/evidence-map.json`, resolved the way `scripts/audit-requirements.mjs` does (the requirement's own key, else its group key such as `BR-UX`). The HTTP suite carries the ids of its entry module and its 80 components. Counts on this tree:

| Layer | Suites | Component modules | Suites citing no requirement |
| --- | --- | --- | --- |
| unit | 106 | 0 | 19 (including the new runner suite) |
| integration | 2 | 80 | 0 |
| resilience | 1 | 0 | 0 |
| manual | 3 | 0 | 1 (`load-envelope`) |
| smoke, ui, nfr, uat | 0 | 0 | not present on this branch |

So 92 of 112 suites cite at least one requirement and 20 cite none. Of the 80 component modules, 66 are cited and 14 cite none (`abdm-transfer`, `delta`, `demonstration`, `exceptional`, `field`, `media`, `member-names`, `merge`, `mis`, `partition`, `referral`, `retention`, `reuse` and `rights` smoke modules). **26 of the 176 requirements are cited by no test file at all**: BR-ID-10, BR-DATA-12, BR-AI-03, BR-CLIN-01, 02, 03, 06, 07, BR-INT-13, 15, 18, 19, BR-CARE-02, BR-SEC-01, 02, 04, 05, 06, 12, 13, 14, and NFR-01, 02, 08, 14, 27. The map is context, not proof: it cites whole groups for some requirements and says nothing about what a cited test asserts, so a citation is not coverage and the absence of one is not proof of no test. It is the honest starting list for what the round-11 suites should address next.

## Running

```sh
npm run build                                   # once; dist/ is needed by every layer except static, unit and uat
node scripts/test.mjs pr                        # same as: npm test
node scripts/test.mjs unit                      # about 2.5 minutes
node scripts/test.mjs integration resilience    # builds the D1 state, runs the HTTP suite, then the restore drill
node scripts/test.mjs full --fast               # --fast skips the build when dist/ exists
node scripts/test.mjs regression                # full plus the regression guard
node scripts/test.mjs --only unit/alerts-contract
SAHA_TEST_PORT=8800 node scripts/test.mjs integration resilience   # ports: 8800 for the Worker, 8801 for the restored Worker
```

The UI layer finds Playwright (it is not a project dependency) in `SAHA_PLAYWRIGHT_MODULES/node_modules`, `tests/ui/node_modules` or `node_modules`, runs `playwright test --config tests/ui/playwright.config.<ext> --reporter=list,json` and reads the JSON reporter's `stats`; without Playwright the UI suite is `blocked` with that reason. The manual layer is run by naming it (`node scripts/test.mjs manual`, or `--only manual/load-envelope`); `a11y-audit` is blocked until `SAHA_A11Y_MODULES`, `SAHA_A11Y_CHROMIUM` and `SAHA_A11Y_ORIGIN` are set, and starts no Worker of its own.

Options: `--fast`, `--guard`, `--only <suite id or file>` (repeatable), `--skip <layer>`, `--report <file>` (also writes the summary there), `--timeout <minutes>` per suite, `--list [--json]`, `--check-catalogue`, `--update-baseline [--reason "<why>"]`, `--clean`. Exit code 0 when everything passed, 1 when a suite, a static step or the guard failed, 2 for a usage error or an inconsistent catalogue.

What a run does:

1. Runs the layers in the order above, one suite at a time, each as a child process in its own process group, with a time limit (10 minutes for a unit suite, 40 for the HTTP suite, `--timeout <minutes>` to change it). On a timeout or Ctrl-C the whole group is stopped, so a Worker the suite started does not outlive it; nothing outside that group is touched. A suite that needs `dist/` waits for the build, which runs once (`npm run build`), or is skipped under `--fast` when `dist/server/wrangler.json` exists. If the build fails the dependent suites are reported `blocked`, not skipped.
2. For `integration`, builds the local D1 state exactly as CI does (`tests/lib/worker.mjs` `freshDatabase`: `.wrangler/test-state` removed, then every `drizzle/NNNN_*.sql` applied with `wrangler d1 execute`). For `resilience` it checks that this state holds the HTTP suite's data and reports `blocked` with the reason when it does not, rather than running the drill against an empty database. If `SAHA_TEST_PORT` is set and `SAHA_RESTORE_PORT` is not, the restore port is `SAHA_TEST_PORT + 1`.
3. Finds the suite's result: the file it names in its own source (`tests/<name>-result.json`, `tests/latest-result.json` for the HTTP suite, `tests/recovery-result.json` for the drill), else a file under `tests/reports/` written during the run (preferring one named after the suite), else the last JSON line it printed. It reads `passed`, `failed` and `skipped` (or Playwright's `stats`) and copies the file to `tests/reports/results/<id>.json`. The full output of every suite is in `tests/reports/logs/<id>.log`; the last 25 lines of a failing one are printed.
4. Decides the status. `failed`: non-zero exit, a timeout, a reported failure, or a suite that reports counts with nothing passed and nothing skipped (a suite that checks nothing is not a pass). `skipped`: every check skipped. `blocked`: a prerequisite is missing. A suite with no count at all that exits 0 passes but is "uncounted".
5. Restores the checkout (see below), writes `tests/reports/summary.json` (and `summary-<layers>.json`), and prints one table per layer with suites, passed, failed, skipped and time. A layer whose directory does not exist, or that has no suites, is reported `not present` and is not a failure.

**Restoring the tree.** `HANDOVER.md` explains why: a contract writes `tests/<name>-result.json`, untracked ones and changed tracked ones break the documentation check ("R11 assertion total differs"). After each layer and at the end the runner runs `git checkout` on every tracked `tests/*-result.json` and `tests/evidence/*` file that changed during the run, and on `tests/ehr-synthetic-document.json`, and deletes every untracked `tests/*-result.json`. Files that were already modified before the run started are left alone, so CI's earlier steps keep their evidence. A run printed "Restored 18 tracked file(s) and deleted 92 untracked result file(s)". Besides the result files, two suites rewrite tracked, baseline-pinned files on every run, which the runner restores: `tests/ehr-contract.mjs` rewrites `tests/ehr-synthetic-document.json` with fresh timestamps and UUIDs, and `tests/scheduled-local-check.mjs` rewrites `tests/evidence/slice-10a/scheduled-local-check.json`. The HTTP suite rewrites the tracked `tests/latest-result.json` and `tests/operations-load-result.json`. Any other tracked file under `tests/` that changed during a run is reported and not touched, because it may be your own edit. `--clean` does the restoring on its own.

## Regression guard

`tests/regression-baseline.json` records, for each suite, the layer, the file and `minPassed`: the number of passed assertions in a real run. It was written from the run below. Run with `--guard` (always on for `regression`) the runner fails when:

- a suite reports fewer passed assertions than its `minPassed`;
- a suite in the baseline no longer exists in the catalogue (a deleted or renamed file);
- a baselined suite that was due to run in this invocation reported nothing, was blocked, or reported no count.

Suites that this invocation was not due to run (another layer, or an extended-tier suite under `pr`) are not checked. Suites that are in the catalogue and not yet in the baseline are listed as new and never fail. A skipped check is not a passed one, so a suite that starts skipping what it used to check drops below its baseline.

`tests/quarantine.json` excuses a suite from the guard: `{ "suites": { "smoke/local": { "reason": "...", "date": "2026-10-03" } } }`. An entry without a reason or an ISO date is itself a failure; one older than 30 days prints a review warning. A quarantine excuses a drop, a missing count or a missing suite. It does not excuse a suite that fails: that still fails the run.

**The baseline changes only on purpose.** `node scripts/test.mjs <layers> --update-baseline` runs the layers, and if every guarded suite passed, sets each one's `minPassed` to what it just reported. `node scripts/test.mjs --update-baseline` with no layer does the same from the last `tests/reports/summary.json` without running anything. It refuses while any guarded suite failed. Raising or adding is free. Lowering a count or removing a suite is refused unless you pass `--reason "<why>"`, and the reason and the lowered counts are appended to the `log` in the file. It prints what it raised, lowered and removed; review that diff and commit it with the change that justifies it. Suites outside the run keep their entry unless they have left the catalogue. `manual` suites and all-skipped suites are never baselined.

What the guard does not do: it counts assertions, not their strength. A suite can keep its count and weaken what it checks, and it cannot tell a deleted assertion from a deleted bug.

## CI tiers

GitHub Actions minutes are limited, and #116 trimmed the pull-request workflow, so the pull-request tier keeps the same steps and the heavy tiers are off the pull-request path.

**`ci.yml` (pull requests and by hand; docs-only pull requests still skip it).** Unchanged: documentation and requirements integrity before install, install, type check, build, supply-chain gate, the disposable local database, the HTTP and database suite, the encrypted restore drill, artifact upload. Changed:

- New step "Test catalogue": `node scripts/test.mjs --check-catalogue`, before install.
- The "Contract suites" loop is replaced by "Unit suites": `node scripts/test.mjs unit --guard`. The loop named 105 suites; the catalogue finds the same 105 plus the new runner suite, so nothing was being left out today. From now on a new `*-contract.mjs` or `*-client.mjs` runs without anyone editing the workflow.
- New step "Smoke suites": `node scripts/test.mjs smoke --fast`, after the restore drill (which needs the database the HTTP suite populated). It says "not present" until `tests/smoke/` exists.
- The evidence artifact also uploads `tests/reports/`, because the runner restores the root `tests/*-result.json` files; their copies are in `tests/reports/results/`.

**`regression.yml` (new; manual and Mondays 02:30 UTC; pull requests never start it).** Documentation, requirements and catalogue checks before install, install, build, then (only if `tests/ui/package.json` exists) `npm install` there and `npx playwright install --with-deps chromium`, then `node scripts/test.mjs "$TIER" --skip static --fast`, where `TIER` is the manual input (`regression` by default, or `full`, `ui`, `nfr`, `smoke`, `uat`) and `regression` for the schedule. It uploads `tests/reports/` always, and has a 90-minute limit and no cancel-in-progress. Scheduled workflows run only from the default branch, so the weekly run starts once this reaches `main`. `deploy-staging.yml` is untouched.

### Estimated minutes per run

Method: the baseline is measured. Step durations come from GitHub's job records for the last successful pull-request run (`engineering-checks`, run 37086079126, 3 October 2026, job 9 min 3 s from first to last step, workflow 9 min 43 s with queueing): documentation 2 s, install 53 s, type check 22 s, build 16 s, supply-chain gate 5 s, disposable local database 24 s, HTTP and database suite 241 s, contract suites 166 s, restore drill 4 s. Four earlier runs of the same job took 5 min 27 s to 7 min 23 s; the job grows with each round. Local runs (below) show the runner adds nothing measurable to a suite (128 ms over 105 suites). Anything that cannot be measured yet is marked as an assumption. GitHub bills each job rounded up to a whole minute.

| Run | Estimate | Basis |
| --- | --- | --- |
| Pull request today (this branch) | about 9 min 10 s of job time, billed 10 min | measured baseline, plus 0.1 s catalogue check, plus about 5 s for the new runner suite; the runner itself adds under a second |
| Pull request once smoke suites exist | about 9 min + 0.7 to 1 min per smoke suite | assumption: a smoke suite pays the 24 s migration cost measured above, about 5 to 10 s Worker start, then its checks. Three suites, about 11.5 to 12.5 min. The smoke suites are not on this branch, so this is a budget to hold the slice to, not a measurement |
| Weekly `regression` (this branch) | about 10 to 11 min | measured parts: install 53 s, build 16 s, unit 2.9 min, HTTP suite 4 min plus 24 s of state, scheduled-local-check about 1 min (measured locally), drill 4 s, setup about 10 s |
| Weekly `regression` with all layers | about 15 to 25 min | adds the smoke estimate above, Chromium install (assumption 1 to 2 min), and the UI and non-functional suites, whose durations are unknown; bounded by the 90-minute limit |
| Per month | about 40 to 125 min | 4 to 5 scheduled runs of 10 to 25 min; manual runs extra |

Recommendation, not done here: each smoke suite pays about 24 s to migrate a fresh D1 state. `freshDatabase` in `tests/lib/worker.mjs` could migrate once per process tree and copy that directory for each suite, which would cut roughly 20 s per suite; it needs its own check that a copied D1 directory behaves like a freshly migrated one.

## Results

All on this branch, 3 October 2026, Node 22.22.2, a 2-core machine shared with three other agents, through the shared heavy-job queue (so durations include contention and are not CI times). Synthetic data only. Ports 8800 to 8804.

| Run | Result |
| --- | --- |
| `node scripts/test.mjs --check-catalogue` | passed; 112 suites, 80 components, 4 support files; 0.1 s |
| `node scripts/test.mjs static` | catalogue passed; type check passed (19.7 s cold, 3.9 s warm); requirements audit passed (0.06 s); **documentation check failed**: "Changed baseline file" for `.gitignore`, `package.json` and `tests/recovery-drill.mjs` (below) |
| `node scripts/test.mjs unit` (first run, 105 suites) | 7,162 passed, 0 failed, 2 min 16 s |
| `node scripts/test.mjs integration resilience --fast` (first run) | `run-api-smoke` 4,599 passed in 3 min 22 s; `scheduled-local-check` 8 passed in 1 min 3 s; `recovery-drill` 21 passed in 4.9 s; 4,628 total, 4 min 56 s |
| `node scripts/test.mjs static unit integration resilience --fast --update-baseline` (second run, produced the baseline) | unit 106 suites, 7,186 passed, 2 min 21 s; integration 2 suites, 4,607 passed, 4 min 12 s (4,599 in 3 min 11 s, 8 in 1 min 1 s); resilience 21 passed, 4.6 s; 11,814 passed, 0 failed, 0 skipped in 7 min 6 s; the static documentation step failed as above |
| `node scripts/test.mjs unit integration resilience --fast --guard` (third run) | unit 106 suites, 7,186 passed, 2 min 46 s; integration 4,607 passed, 4 min 31 s (4,599 in 3 min 32 s, 8 in 59 s); resilience 21 passed, 4.0 s; 11,814 passed, 0 failed, 0 skipped in 7 min 48 s; **regression guard passed, 109 baselined suites checked**, none excused |
| The same selection plus `static`, `--guard` and `--update-baseline` on the final source (fourth run; its summary and the catalogue are kept in `tests/evidence/slice-11a/`) | unit 106 suites, 7,187 passed, 2 min 53 s; integration 4,607 passed, 4 min 50 s (4,599 in 3 min 51 s, 8 in 59 s); resilience 21 passed, 4.2 s; **11,815 passed, 0 failed, 0 skipped** in 8 min 20 s; guard passed (109 checked); the baseline moved by one (`unit/test-runner-contract` 24 to 25, the new timeout check); the static documentation step failed as above |
| `node tests/test-runner-contract.mjs` | 25 passed, about 6 s |

The runs agree on every count (7,162 plus the runner suite's 24 or 25 for unit, 4,599, 8 and 21), which is what the guard relies on. After every run `git status` showed only this slice's files.

The self-test was also tried against three deliberate breaks. Changing the guard to tolerate a drop of one assertion made 2 of its checks fail; disabling the restore step made the end-to-end check fail; making the runner stop only the suite and not its process group made the timeout check fail (the Worker-like grandchild stayed alive). All three breaks were then reverted.

**The documentation check fails on this branch, and that is expected.** `scripts/check-documentation.py` pins the hash of `package.json` and `tests/recovery-drill.mjs`, both of which this slice changes on purpose, and `.gitignore`, which the foundation commit already changed. The integrator refreshes the baseline (`scripts/update-baseline.py`) after merging, as for every round. Nothing else in the documentation check failed, and the requirements audit passes.

## What it proves and what it does not

Proves: every runnable test file under `tests/` is in exactly one layer; the CI loop and the catalogue name the same 105 unit suites; a suite that is renamed, deleted or left unimported is caught; each layer's results, counts and exit codes are collected in one place; the tree is left as it was found; the guard catches a count that falls, a suite that vanishes and a suite that stops reporting.

Does not prove:

- **Nothing here ran on GitHub.** `ci.yml` and `regression.yml` parse as YAML and use steps already present in `ci.yml`; neither workflow has run. The cost estimates are estimates.
- **Playwright was not run.** The UI path (find the binary, set `PLAYWRIGHT_JSON_OUTPUT_NAME`, read `stats`) is tested with a stand-in executable, including the blocked and the failing case. A real Playwright run, and the `tests/ui/package.json` install step, are untested. There is no `tests/smoke`, `tests/ui`, `tests/nfr` or `tests/uat` directory on this branch, so those layers report "not present"; discovery of new suites is tested on fixture directories only.
- The guard protects counts, not assertion quality (above). Counts are as each suite counts them (a contract counts `check()` calls, the HTTP suite counts requests and checks), so they are comparable over time for one suite and not between suites.
- Result files are attributed by suite when it names its own file or a file named after it. The last-resort rule (any file written during the run) assumes one runner per worktree at a time, which the heavy-job queue already enforces here.
- The catalogue's requirement ids come from a coarse evidence map. They show which requirements point at a test, not what it proves. No acceptance case is promoted.

## Adding a suite

Put it where its layer says (`tests/smoke/<name>.mjs`, `tests/nfr/`, `tests/uat/`, `tests/ui/`), write the result with `tests/lib/report.mjs` to `tests/reports/<name>-result.json` (never to the root of `tests/`), and exit non-zero on failure. Run `node scripts/test.mjs --check-catalogue`, then `node scripts/test.mjs <layer> --update-baseline` and commit the new baseline entry. A new `*-smoke.mjs` HTTP module must be imported by `tests/api-smoke.mjs`; a new `*-contract.mjs` needs nothing.
