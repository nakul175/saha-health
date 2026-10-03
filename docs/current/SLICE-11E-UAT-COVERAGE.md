# Test slice 11e — UAT pack, formal execution register and functional coverage map

3 October 2026 (IST). Round 11 of the testing ecosystem. This slice adds the material a named person needs to run user acceptance testing on the synthetic hosted staging Worker, a register that only accepts results a reviewer could stand behind, and a map of which requirements have which kinds of test evidence. It adds no application behaviour and changes no shared document. Synthetic data only; formal acceptance is unchanged: all 176 BRD acceptance criteria remain pending and all 364 catalogue cases still say Not run.

## Read this first

- **Nothing in this slice is a test result.** The scripts are instructions for people. No case has been executed, by anyone, so formal execution is 0 of 364 catalogue cases. The register is blank on purpose.
- **The coverage numbers are weak evidence about the evidence.** They are computed from `requirements/evidence-map.json`, which lists files related to a requirement. A cited file is context, not acceptance. 75 of 176 requirements have no entry of their own and inherit the list of their area, and 33 of 191 test files on disk are cited by no requirement. "No automated test cited" therefore overstates the gap, and a requirement that cites a broad suite looks better covered than it may be.
- **The catalogue steps are generic.** Every Functional case reads "load the fixture, apply the design statement, capture results". The scripts do not invent click paths. They quote the design statement, name the screens the evidence map and navigation tie to the requirement (only where the requirement has an entry of its own), and tell the tester to try the statement using only what the screens offer. Where the build offers nothing to try, the step says so.
- **Several choices are builder judgements, not facts.** The default-Blocked list (12 items) and the role assigned to each case (area default plus about 55 exceptions, each with a stated basis) were chosen by an agent from the catalogue and the assessment. The organisation owner should review both before testers start.
- **Nothing was run against the hosted Worker.** Screens and navigation come from the code (`lib/saha/navigation.ts`, `seed.ts`), the hosted-staging document and the administrator guide. A person walking the scripts will find places where they are wrong or stale; the plan says how to record that.
- **No person has reviewed this slice.**

## What was added

| File | Purpose |
| --- | --- |
| `tests/uat/generate-uat-pack.mjs` | Writes `docs/testing/uat/`: the plan, five role scripts, the end-to-end script and, if missing, a blank register |
| `tests/uat/check-uat-register.mjs` | Validates the register against the strategy-07 rules; a runnable suite with `layer: 'uat'` |
| `tests/uat/coverage-map.mjs` | Writes `docs/testing/COVERAGE.md` and `docs/testing/coverage.csv` |
| `tests/lib/uat-data.mjs` | Shared loaders for the catalogue, assessment, evidence map and register; CSV tools; layer classification; register validation rules |
| `tests/lib/uat-selection.mjs` | Case selection, role assignment, default-Blocked list, navigation and seed readers |
| `docs/testing/uat/UAT-PLAN.md` | Purpose, scope, entry and exit criteria, roles and sign-in, environment, how to record a result, severity, sign-off, method |
| `docs/testing/uat/UAT-OWNER.md`, `UAT-ASHA.md`, `UAT-SUPERVISOR.md`, `UAT-CLINICIAN.md`, `UAT-ADMIN.md` | One script per role (53, 44, 13, 29 and 7 cases) |
| `docs/testing/uat/UAT-END-TO-END.md` | The 12 journeys TC-J01 to TC-J12 |
| `docs/testing/uat/uat-results.csv` | Blank register, 158 rows, columns `caseId, build, environment, executor, executedAt, result, actualResult, evidence, defect, reviewer, reviewedAt` |
| `docs/testing/COVERAGE.md`, `docs/testing/coverage.csv` | The map: summary, by area, gap lists, then every requirement |

Generated files start with a "generated, do not edit" header. They carry no timestamps or commit hashes, so regenerating from unchanged inputs gives byte-identical files.

## The UAT pack

- **Selection.** Functional cases whose requirement is implemented-local (14) or partial (132), plus all 12 End to end cases: 158 cases. The two Functional cases on not-built requirements (TC-BR-CLIN-06-A, TC-BR-CLIN-07-A) are left out, with the reason printed in the plan. Negative or recovery and Performance or control cases are not in the pack: they need fixtures, fault injection or load that a person on the hosted site cannot create, and no reset exists on hosted staging.
- **Each case** carries the TC id, title, requirement id and assessment status, role and the basis for the role, where to start, preconditions, numbered tester actions, the expected result (the design statement), what the build does today and a "Known gaps" line (both quoted from the assessment's `current` and `remaining` text), and the Result, Notes and Defect fields.
- **Default Blocked.** 12 items are marked "Not testable in current build" with the assessment's own words: 9 Functional cases (BR-ID-03, BR-ID-09, BR-ID-10, BR-PROG-06, BR-INT-16, BR-INT-22, BR-SEC-05, BR-SEC-09, BR-SEC-14) and steps in three journeys (J02 steps 3 to 5 and J08 steps 3 and 4 on clinical generation, J10 step 3 on facility-verified outcomes). The generator verifies each quote as a substring of the assessment and throws if the assessment changes, so a stale reason cannot survive a regeneration. Cases that are only part built stay runnable. A tester who finds one of the Blocked items actually works records that as a result, with evidence.
- **Formal rule.** A result is formal only when a named person executes the case and a different named person reviews it, with build, actual result and evidence. The plan states this; the validator enforces it.

## The register validator

`node tests/uat/check-uat-register.mjs [path]` reads the register (default `docs/testing/uat/uat-results.csv`) and fails on any of these:

- the file is missing or the header is not exactly the eleven columns;
- a `caseId` is not in `docs/current/TEST-CATALOGUE.csv`, or appears twice, or a scripted case has no row;
- `result` is anything other than empty, `Not run`, `Pass`, `Fail` or `Blocked` (so "Passed", "pass", "N/A" and "Partial" fail);
- a Pass lacks executor, executedAt, actualResult, build (7 to 40 hex characters), environment or evidence, or lacks a reviewer who is a different person from the executor, or has reviewedAt earlier than executedAt;
- a Fail lacks executor, executedAt, actualResult, build, environment or a defect id;
- a Blocked lacks executor, executedAt or actualResult;
- a Not run row carries an executor, evidence, defect, reviewer or date; a row with data and an empty result is an error;
- an executor or reviewer is a placeholder or a tool or AI name (a person must be named), or the reviewer equals the executor after case and whitespace are normalised.

It has 44 checks. About 25 are self-tests that craft a bad register in memory and require the rule to fire (each Pass field removed in turn, reviewer equals executor in other spellings, an AI tool as executor, review before execution, Fail without defect, unknown and duplicate ids, near-miss result words). The blank register passes; a crafted bad register exits 1.

**Limit.** The validator checks the shape of a record. It cannot tell whether the named people are real, whether they are independent, or whether the evidence text says what the executor says it does. The evidence field is free text or a path or link; the reviewer opens it.

## The coverage map

For each of the 176 requirements: assessment status, the test files its evidence-map entry cites (counted by layer), the catalogue cases that name it (counted by type), how many are formally executed, and three gap flags. Resolution of a requirement's entry is the same rule `scripts/audit-requirements.mjs` uses: its own entry, else its area's. The `evidenceEntry` column says which. The layer of a file comes from its path (`tests/smoke/**`, `tests/ui/**`, `tests/nfr/**`; `tests/*-smoke.mjs` are integration tests despite the name; other `tests/*.mjs` are unit), with a short override list for the recovery drill, accessibility audit, load envelope, adapter-overhead bench and scheduled local check. "Formally executed" counts only register rows that pass the validator as a Pass or Fail with a different reviewer; a catalogue status other than Not run is reported but never counted.

### Numbers at this commit

Read with the caveats above.

| Measure | Value |
| --- | --- |
| Requirements by assessment status | 14 implemented-local, 151 partial, 2 not-built, 9 unverified (176) |
| Formally executed catalogue cases | 0 of 364 |
| Requirements with no automated test cited | 26 (15%): BR-ID-10, BR-DATA-12, BR-AI-03, BR-CLIN-01/02/03/06/07, BR-INT-13/15/18/19, BR-CARE-02, BR-SEC-01/02/04/05/06/12/13/14, NFR-01/02/08/14/27 |
| Requirements citing tests in one layer only | 55 (31%); by area BR-INT 15, NFR 15, BR-UX 7, BR-OFF 7 |
| Requirements with no UAT case | 30 (17%): the 28 NFR requirements and BR-CLIN-06 and BR-CLIN-07 |
| Layers cited (requirements) | unit 128, integration 113, resilience 2, ui 2, nfr 1, smoke 0 |
| Layer combinations | unit + integration 94, unit only 33, none 26, integration only 18, resilience 2, nfr 1, ui 1, unit + integration + ui 1 |
| Requirements on an area-level list, not their own entry | 75 of 176 |
| Test files on disk cited by no requirement | 33 of 191 (for example the ABDM contract and transfer tests, `continuity-contract`, `delta-smoke`) |
| Files under `tests/smoke/`, `tests/ui/`, `tests/nfr/` at this commit | 0 (other round-11 slices add them) |

Three things to take from the table. First, the weakest evidence sits in security (8 of 14 BR-SEC requirements cite no test), clinical (5 of 8) and interoperability (15 of 24 in one layer only, 4 with none). Second, the evidence map cites almost nothing above unit and integration level: ui is cited by 2 requirements, nfr by 1, resilience by 2 and smoke by none, partly because the round-11 slices that add those layers are not merged and cited yet. Third, 4 of the 26 "no test cited" requirements (BR-INT-13, 15, 18, 19) do have ABDM tests on disk; the map is what is missing.

## What this slice proves

- The pack, the register, the validator and the map regenerate from the committed sources deterministically, and `--check` detects drift.
- Every UAT case traces to a catalogue id, a requirement and an assessment status; every "Known gaps" and every Blocked reason is quoted from the assessment and checked at generation time.
- The validator rejects each malformed or self-reviewed result it is meant to, and accepts the blank register.
- The coverage map is reproducible and its gap lists are exact with respect to the evidence map and the files on disk.

## What it does not prove

- That any requirement works. No case was executed.
- That any scripted action matches the hosted site's screens today.
- That the role assigned to a case is the right tester, or that the 12 Blocked items are the right 12.
- That a cited test checks what its requirement asks, or that a test file passes today.
- That the people named in a future register are independent, qualified or who they say they are.
- Anything about the 28 NFR requirements, or about Negative and Performance cases, from the UAT side: none is scripted.

## How to run

```
node tests/uat/generate-uat-pack.mjs            # rewrite plan and scripts; create the register only if missing
node tests/uat/generate-uat-pack.mjs --check    # fail if committed files differ from regenerated output
node tests/uat/coverage-map.mjs                 # rewrite COVERAGE.md and coverage.csv
node tests/uat/coverage-map.mjs --check         # fail if committed files differ
node tests/uat/check-uat-register.mjs [path]    # validate the register; exit 1 on any violation
```

All three use only Node and files in the repository: no Worker, no network, no browser. Reports go to `tests/reports/` (git-ignored): `uat-pack-result.json`, `coverage-map-result.json`, `uat-register-result.json`.

The register is never overwritten by the generator, because it holds results. To start a blank one, delete the file and regenerate. Only `check-uat-register.mjs` is a suite in the runner's sense; the two generators are tools (they are well behaved under a runner but their `--check` mode is the useful one).

**To execute UAT:** follow `UAT-PLAN.md` entry criteria (a build on synthetic staging, a named executor and a different named reviewer, an Access-approved email address for each), run a script, fill one register row per case (build, environment, executor, executedAt, result, actualResult, evidence, defect), have the reviewer fill reviewer and reviewedAt, then run the validator and regenerate the map. Do not use the local identity headers or any test-reset command against the hosted site.

## Results

Run on 3 October 2026 in `/home/claude/wt-e` (Node 22.22.2) at the base of branch `slice-11e-uat-coverage`. No Worker was started.

| Command | Result | Time |
| --- | --- | --- |
| `node tests/uat/generate-uat-pack.mjs --check` | 10 passed, 0 failed, 0 skipped; 158 cases (OWNER 53, ASHA 44, SUPERVISOR 13, CLINICIAN 29, ADMIN 7, END_TO_END 12), 2 excluded, 7 documents | 0.8 s |
| `node tests/uat/coverage-map.mjs --check` | 9 passed, 0 failed, 0 skipped; 176 requirements, 0 of 364 formally executed | 0.7 s |
| `node tests/uat/check-uat-register.mjs` | 44 passed, 0 failed, 0 skipped on the blank register (158 rows, all empty) | 0.6 s |
| Determinism: both generators run twice, the second time from another working directory, `diff -r docs/testing` | identical | |
| `node tests/uat/check-uat-register.mjs <crafted bad register>` | exit 1, 6 checks failed as intended | |
| `python3 scripts/check-documentation.py` | **fails with one error, "Changed baseline file: .gitignore"**. Not caused by this slice: it fails identically at the round's base commit `daa1e40b`, where slice 11a added three report-directory lines to `.gitignore`, a file whose digest is recorded in the baseline manifest under `docs/verification/`. This slice changes no tracked file. The integrator owns the manifest | under 1 s |
| `node scripts/audit-requirements.mjs --check` | passes: 176 source IDs, assessments, evidence paths and generated records verified; acceptance remains pending | under 1 s |

No application defect was found. No file under `lib/`, `app/` or `worker/` was touched.

## Limits

- **No execution, no review.** The slice builds the means to run UAT and records none. One agent built it; no person has reviewed it.
- **Role and Blocked judgements** are listed above and live in `tests/lib/uat-selection.mjs` (`ROLE_BY_REQUIREMENT`, `BLOCKED_REQUIREMENTS`, `BLOCKED_JOURNEY_STEPS`), each with a basis or a quote. They are easy to change; change them there and regenerate.
- **Hosted staging is moving.** Every merge into `main` redeploys it unless `SAHA_DEPLOY_FREEZE` is set, so a script and the build it was run against can drift. The register's `build` column is mandatory for that reason; fix the build before a UAT round (freeze deploys) and record it.
- **Staging holds synthetic data and cannot be reset.** Original catalogue fixtures (FX-…) cannot be loaded there, so cases that depend on a particular fixture can only be tried on whatever the first sign-in seeds (six synthetic people). Expected results that depend on a specific fixture will not match exactly; the script says so per case.
- **The coverage map reads files, not assertions or outcomes.** It does not run any test. It cannot see tests that exist but are not cited, and counts every layer as one file regardless of size.
- **Static inputs.** The assessment audit date is 30 September 2026 (`requirements/audit-meta.json`); the map and the Known gaps lines are only as current as `requirements/assessment.tsv`.

## For the integrator

- `requirements/evidence-map.json` should cite the 33 orphaned test files and the new round-11 suites (smoke, ui, nfr) where they test a requirement; this slice does not edit it. Re-run `node tests/uat/coverage-map.mjs` afterwards and commit the regenerated map.
- Add `tests/uat/check-uat-register.mjs` to the runner as a suite (layer `uat`). Add `generate-uat-pack.mjs --check` and `coverage-map.mjs --check` as drift checks in CI if the sponsor wants the generated files kept current; each takes under a second.
- The documentation index, `NEXT-DELIVERY.md` and `VALIDATION.md` are not updated here. `docs/testing/` is a new directory outside `docs/current/`; the index owner decides where it is listed.
