# Saha Health engineering guide

How to find things, name things, write code and ship a change in this repository, so that a new engineer (human or agent) can work safely from the written instructions alone. Read [README.md](../../README.md), [AGENTS.md](../../AGENTS.md) and [HANDOVER.md](../../HANDOVER.md) first; this guide is the "how". It contains no version numbers or test counts. Repository status lives in HANDOVER.md and the documents it links.

**Honest state of this repository.** It is the largest and least tidy of the six. Section 0 describes the target standard; sections 0.8 and 11 list exactly where this repository does not yet meet it (29 Markdown files at the root, a flat `tests/` folder of about 1,000 files, most source not yet formatted, HANDOVER.md without a clean status block). Do not "fix" those in passing: each needs its own pull request and its own evidence re-pointing (section 7).

## 0. The Products standard (identical in every Products repository)

This section is the same in all six repositories (saha-health, saha-education, saha-agriculture, aplyd-academy, impact-platform, sheet-happens-officer). The rest of this guide is specific to this repository. If the two ever disagree, this repository's own safety rules in AGENTS.md win.

### 0.1 Principles

1. **A human must be able to take over.** Anyone who can read English and knows the language of the repository should be productive on day one using only README.md, AGENTS.md, HANDOVER.md and this guide. If a fact is only in someone's head or a chat, it is missing; write it down.
2. **One place per fact.** Version, hosting state, test counts and open items are stated once, in the status block at the top of HANDOVER.md. Everything else links to it. Never copy a number into a second document.
3. **Small, reviewable, reversible.** One purpose per branch and pull request. Prefer deleting code to adding it. Nothing is merged without a green `verify` check and the owner's approval.
4. **Truth over polish.** Say what was and was not run. Never write "done", "passing" or "verified" for something that was not executed. Synthetic data is never described as real; a demo is never described as production.
5. **Server is the authority.** Permission, ownership and validation are decided on the server. The client only displays.
6. **Never destroy history.** Applied migrations, evidence, receipts and audit records are append-only. Corrections add a new record; they do not rewrite the old one.

### 0.2 Root of the repository

Exactly these markdown files may sit at the root: `README.md`, `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE` (some repositories omit one or two). Every other document lives under `docs/`. `CLAUDE.md` is a short pointer to AGENTS.md and HANDOVER.md. `AGENTS.md` holds the rules, commands and safety limits. `HANDOVER.md` starts with the status block.

```
docs/
  DOCUMENTATION-INDEX.md   generated; lists every document; never edit by hand
  current/                 live documents (this guide, architecture, contracts)
  history/                 superseded documents and old receipts; read-only
  governance/              policy bundle where the repository has one
```

A document that replaces another moves the old one to `docs/history/` in the same pull request. A new document is added to the index in the same pull request (`pnpm run docs:index`; CI runs `docs:index:check`).

### 0.3 Naming

| Thing | Rule | Example |
|---|---|---|
| Source files and folders | `kebab-case`, lower case, no spaces, no version suffix | `reading-review.ts`, `lib/education/` |
| React components | file `kebab-case.tsx`, component `PascalCase` | `reading-review-panel.tsx` exports `ReadingReviewPanel` |
| Functions and variables | `camelCase`, verbs for functions, nouns for values | `loadStudent`, `studentCount` |
| Types, classes | `PascalCase` | `StudentRecord` |
| Constants | `UPPER_SNAKE_CASE` only for true constants | `MAX_UPLOAD_BYTES` |
| Python | `snake_case` modules and functions, `PascalCase` classes | `audit_export.py` |
| Database tables and columns | `snake_case`, plural table names, no abbreviations | `reading_checks.student_id` |
| Migrations | next number, then topic, never edited once applied | `0041_add_reading_review.sql` |
| API routes | nouns, plural, kebab-case; HTTP verb carries the action | `POST /api/reading-checks` |
| Environment variables | `UPPER_SNAKE_CASE`, one prefix per app; listed in README | `EDUCATION_DEMO_LOGIN` |
| Branches | `<type>/<topic>-<yyyy-mm-dd>` with type one of `feat fix docs chore refactor deploy release qa ops handover` | `fix/reading-nonce-2026-10-09` |
| Commits | `type: imperative sentence` (72 characters or fewer), body explains why | `fix: reject a replayed nonce` |
| Pull requests | title like a commit; body states what changed, what was run, what was not run | |
| Documents | `UPPER-CASE.md` for governance and handover files; `Title-Case.md` or `kebab-case.md` as the repository already does, never both in one folder | |
| Dates | ISO `2026-10-09` in file names; "9 October 2026" in prose; never `October2026` | |

Never put a version, date or "final" in a source file name (`index-v2.ts`, `new-api-final.ts`). Version control is the version.

### 0.4 Writing code

1. **Format is not a discussion.** Prettier (config in `.prettierrc.json`, print width 110, single quotes, trailing commas, semicolons) formats everything; `pnpm run format` fixes it, `pnpm run format:check` is a CI gate. Python uses ruff format. Never hand-align, never reformat a file you are not otherwise changing.
2. **Lines under 110 characters; functions under about 40 lines; files under about 400 lines.** If a file grows past that, split it by responsibility, not alphabetically.
3. **Types are real.** TypeScript is `strict`. No `any`; use `unknown` and narrow, or a named type. No `@ts-ignore`; if unavoidable use `@ts-expect-error` with a reason. Python functions that cross a module boundary carry annotations.
4. **One definition per helper.** Before writing `json()`, `sameOrigin()`, `sha256()`, `now()`, `uniqueFailure()` or similar, search the repository (`rg "function name"`); if it exists, import it. A second copy is a defect. Shared helpers live in one place named in section 3 of this guide.
5. **Imports go one way.** Pages and routes import from `lib/`; `lib/` never imports from `app/`. No import cycles. Use the `@/` alias, not `../../..`.
6. **Names say what a thing is.** No `data`, `info`, `tmp`, `util`, `helper`, `manager`, `handle2`. A boolean reads as a question: `isExpired`, `hasConsent`.
7. **Comments explain why, never what.** No commented-out code; delete it (git remembers). A `TODO` carries an owner and a date or does not exist.
8. **Errors are handled or raised, never swallowed.** No empty `catch`. A user-visible error is plain language and says what to do next. A server error never leaks stack traces, SQL or secrets.
9. **Validate at the boundary.** Every request body, query and header is parsed by a schema before use; unknown fields are rejected.
10. **Dependencies are a liability.** Add one only with a reason in the pull request; pin exact versions; prefer the standard library.
11. **Secrets, real personal data, databases, build output and logs never enter git.** Use synthetic fixtures. `.env*` files stay local.
12. **Tests prove behaviour.** A bug fix lands with the test that fails without it. A test names the behaviour (`rejects a replayed nonce`), not the function. Do not edit a test to make it pass; fix the code or explain why the test was wrong.
13. **Lint is a ratchet.** The committed baseline (`.lint-baseline.json`) may only go down. A pull request that raises it is red. Fix warnings in files you touch.

### 0.5 Every change, start to finish

1. Start from current `origin/main`: `git fetch origin main && git switch -c <type>/<topic>-<date> origin/main`.
2. Read the files you will touch and the tests beside them. Search for an existing helper before writing one.
3. Make the smallest change that does the job. Update the documents it affects in the same pull request.
4. Run the gate (section 6 of this guide). Run it again after the last edit.
5. Commit with a clear subject. Push. Open a **draft** pull request that states what was changed, what was run (with results) and what was not run.
6. Wait for CI. Fix every red check, or say plainly why it is unrelated.
7. A person (or a reviewing agent with the full diff) approves and merges. Agents do not merge on their own authority.
8. After a merge to `main`, check the status block in HANDOVER.md still tells the truth; update it if not.

### 0.6 Do and don't (all repositories)

Do:
- Search before writing. Reuse before adding.
- Keep a change to one purpose; split unrelated fixes.
- State what you did not test.
- Use synthetic data; mark demo behaviour as demo.
- Put new documents under `docs/` and in the index.
- Update HANDOVER.md's status block when hosting, version, gates or open items change.

Don't:
- Don't force-push `main`; don't push to `main` at all in repositories that deploy from it.
- Don't merge without a green `verify` and the owner's approval; don't deploy, change hosting, send messages to real people or spend money without being told to.
- Don't add a root-level document, a second status statement, or a count copied from elsewhere.
- Don't commit screenshots, logs, audio, zips, dumps, generated mirrors or test output. Evidence is kept as manifests and hashes; the files live outside git.
- Don't edit an applied migration, a retained evidence file, a receipt or anything under `docs/history/` (except to move a document there).
- Don't weaken a check, raise the lint baseline, add `eslint-disable` or `any` to get a green build.
- Don't retry an uncertain mutation (a payment, a message, a deploy) blindly; find out what happened first.
- Don't claim "production", "accepted", "verified" or "passing" for anything that was not run and observed.

### 0.7 Handing over (when your session ends)

Before you stop: everything is committed and pushed on a branch with a draft pull request; the status block in HANDOVER.md is current; "Open items" lists what is unfinished and why, with the exact next command or file; no uncommitted work remains in the checkout. The next person, human or agent, should be able to continue from HANDOVER.md alone.

### 0.8 Exceptions in this repository

The standard above is the target. In this repository the following differ on purpose or are known debt:

- **Evidence is pinned by SHA-256.** `docs/verification/current-baseline.json` points at a manifest of hashes of runtime, migration, test and script files, and `scripts/check-documentation.py` re-hashes them (about 12,000 files). Changing any covered file, even whitespace, fails the documentation check until the baseline is re-pointed (section 7).
- **`AGENTS.md` is pinned.** The documentation check reports "Changed baseline file: AGENTS.md" if it is edited without re-pointing the baseline (section 7). That is why this guide is linked from `README.md` and `CLAUDE.md` and not from `AGENTS.md`.
- **Prettier is configured but not a gate.** `.prettierrc.json` and `.prettierignore` exist and `pnpm run format:check` is available, but about 400 source files do not pass and CI does not run it. Do not run `format` on the tree: it would change hundreds of pinned files. Format only files you create. Whole-tree formatting is a planned, separate, evidence-re-pointing pull request.
- **Root files.** 29 Markdown files sit at the root (`RELEASE-1.md` to `RELEASE-11.md`, `AGENT-API.md`, `MIS-API.md`, `OPERATIONS.md` and others). The standard allows eight. Moving them changes links across 347 documents in `docs/current` and is queued, not done. Do not add a thirtieth; new documents go under `docs/current/`.
- **No generated documentation index script.** `docs/DOCUMENTATION-INDEX.md` is maintained with `scripts/build-documentation.py` and checked by `scripts/check-documentation.py`; add a new document to the index by hand in the same pull request until a generator exists.
- **HANDOVER.md is a dated log.** It does not yet begin with a single status block. Treat `CLAUDE.md`'s paragraph and `docs/current/HOSTED-STAGING.md` as the current statements of hosting, and the top of HANDOVER.md as history.
- **Merging deploys the synthetic staging copy** unless `SAHA_DEPLOY_FREEZE` is `true`. Since 8 October 2026 that freeze is on and the synthetic copy runs on the shared droplet (see HOSTED-STAGING.md). Neither is a production site.
- **The `regressions` CI job is red on `main`.** It passes locally and fails on GitHub for a reason not yet found (section 8).
- **Functions longer than 40 lines and one-line route handlers exist.** Match the neighbouring style when editing; write new code to the standard.

## 1. What this repository is

A synthetic-data frontline-health platform (patients, households, caseloads, ASHA/ANM workflows, alerts, consent, audit, programme packs, offline phone shell, an Android wrapper, optional adapters for ABDM, EHR and AI providers). It is **not accepted for production or real patient use**; all formal acceptance cases remain pending. Authoritative contracts are current source plus `docs/current/`; `docs/history/` and `docs/reference/` describe the original target design and are not the runtime.

Stack: vinext (Next 16 API on Vite) for the app, a Cloudflare Worker (`worker/index.ts`) and D1 (SQLite) with Drizzle, run locally by `wrangler dev --local`. Node >= 22.13 (use Node 24 for the complete test and recovery workflow, because the fixtures and recovery tool use `node:sqlite`; see `docs/current/DEVELOPMENT-AND-CI.md`). Package manager: pnpm 11.25.0, installed by `npm run install:ci` (a wrapper script).

## 2. Finding your way around

| Path | What lives there |
|---|---|
| `app/` | Next app. `app/*-panel.tsx` are feature panels (one per feature); `app/api/<feature>/route.ts` are HTTP routes (about 80 folders); `app/app/` is the field-worker phone shell. |
| `lib/saha/` | All behaviour, about 225 modules. Pattern: `<feature>.ts` is the pure domain; `<feature>-server.ts` is the request/DB layer; `<feature>-execution.ts` or `-provider.ts` is an outbound adapter. `identity.ts` resolves who is calling. `core.ts` and `server.ts` hold shared server helpers. |
| `lib/utils.ts` | The one `cn()` class-name helper. |
| `db/schema.ts`, `db/index.ts` | Drizzle tables and connection. |
| `drizzle/` | Migrations `0000` to `0032`. Append-only. `drizzle/meta/` is generated. |
| `worker/index.ts` | Worker entry: routing, scheduled jobs, trust of the dispatcher's identity. |
| `components/ui/` | Vendored UI primitives. Do not edit. |
| `android/` | Android wrapper project (Gradle). |
| `tests/` | Flat folder of about 1,000 files (see section 5). `tests/evidence/` holds retained result files (about 14,000 tracked); `tests/fixtures/` synthetic inputs; `tests/support/` shared helpers; `tests/uat/` acceptance packs. |
| `scripts/` | Test runner (`test.mjs`, `test-catalogue.mjs`, `test-guard.mjs`), documentation build/check, baseline tooling, security gate, deploy helpers. |
| `deploy/` | Droplet kit (do not run). |
| `docs/current/` | Live implementation documents; `docs/governance/` policy; `docs/testing/`; `docs/verification/` baselines; `docs/history/`, `docs/reference/` read-only. |
| `requirements/` | Requirement registers read by `scripts/audit-requirements.mjs`. |

Where to look for a thing:

- Who may do what: `lib/saha/access.ts` and `docs/governance/ACCESS-CONTROL-MODEL.md`.
- Who is calling: `lib/saha/identity.ts` only. Never read identity headers anywhere else.
- A route: `app/api/<name>/route.ts`, then the `*-server.ts` it calls.
- A table: `db/schema.ts` and `docs/current/` data dictionary files.
- What a test proves: `docs/current/TESTING.md`; the suite list: `node scripts/test.mjs --list`.
- Why something exists: `docs/current/ARCHITECTURE-DECISIONS.md`, then the slice document named in the changelog.

## 3. Shared helpers (use these, do not copy them)

| Need | Use | Defined in |
|---|---|---|
| Caller identity | `principalFromHeaders`, `identityConfig` | `lib/saha/identity.ts` |
| Error response from a route | `error(...)` | `lib/saha/server.ts` |
| Timing and request measurement wrapper | `measured(request, name, fn)` | `lib/saha/monitoring.ts` |
| Class names in components | `cn()` | `lib/utils.ts` |
| Permission checks | `lib/saha/access.ts` | one module per concern |

Before writing any helper: `rg "export (async )?function <name>" lib app`. A second copy is a defect.

## 4. Writing a route (the one pattern)

```ts
import { measuredThing } from '@/lib/saha/<feature>-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return measured(request, '<feature>', async () => {
    try {
      return await <feature>Read(request);
    } catch (e) {
      return error(e);
    }
  });
}
```

`app/api/patients/route.ts` is the working example (written on fewer lines). The route holds no logic: identity, scope and validation happen in the `*-server.ts` function. State-changing work goes through the command layer so it is audited, revisioned and replay-safe; never write a record directly from a route.

## 5. Naming and layout, applied here

- New feature: `lib/saha/<feature>.ts` (pure), `lib/saha/<feature>-server.ts`, `app/api/<feature>/route.ts`, `app/<feature>-panel.tsx`, a migration if a table is needed, and tests.
- Test names: `tests/<feature>-contract.mjs` (unit), `tests/<feature>-smoke.mjs` or `-http.mjs` (integration over the built Worker), `-browser.mjs` (Playwright). `scripts/test-catalogue.mjs` classifies every file; `node scripts/test.mjs --check-catalogue` fails when a file is unclassified. Run it after adding a test.
- Existing names with `-original`, `-repair`, `-independent`, `-after`, `-extra` suffixes record review history; they are frozen evidence, not a pattern to copy. A new test is named for the behaviour it proves.
- Migrations: next number in `drizzle/`, additive, never edited. Update `db/schema.ts`, the data dictionary in `docs/current/` and the migration history in `docs/governance/MIGRATION-HISTORY.md` together.
- Imports use the `@/` alias; `lib/` never imports from `app/`.

## 6. The gate: what to run, in what order

Code change:

```
npm run install:ci          # pnpm install via scripts/install-pnpm.sh
node scripts/test.mjs --check-catalogue
npm run lint:baseline
npm run typecheck
npm run build
node scripts/security-gate.mjs
node scripts/test.mjs unit --fast --guard                   # unit layer
node scripts/test.mjs integration resilience --only <ids> --fast --guard   # the suites you touched
```

`npm test` runs the `pr` alias (static, unit, integration, resilience, smoke). Full layers: `test:ui`, `test:nfr`, `test:uat`, `test:full`, `test:regression`. Each suite runs as a child process; results are copied to `tests/reports/` and tracked `tests/*-result.json` files are restored afterwards. If a run leaves stray files, `node scripts/test.mjs --clean`.

Documentation-only change:

```
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
```

Record real results, with date and limits, in `VALIDATION.md`. Never promote an acceptance case because a related unit check passes.

## 7. Changing pinned files: the baseline procedure

Files under `worker/ app/ android/ lib/ db/ drizzle/ public/ scripts/ tests/ components/ hooks/ build/ vendor/ examples/` (except `tests/evidence/`) are covered by the current baseline manifest. After a change to any of them:

```
python3 scripts/update-baseline.py <slug> "<label>"
```

This writes a **new** manifest `docs/verification/application-<slug>-sha256.json` and re-points `docs/verification/current-baseline.json`. Earlier manifests are history and are never rewritten. Commit both. Then run the documentation check (section 6). The Prettier toolchain pull request (#171) is the worked example. Files in `docs/`, the root Markdown files and `tests/evidence/` are not covered by the manifest, so a documentation-only change needs no baseline step.

## 8. Known red check

The `regressions` job (workflow `engineering-checks`, step "App-first workflow and scope regressions") has failed on GitHub while the same selection passes locally (147 suites, 7,691 checks, guard passed). The cause is unknown because the job logs were not retrievable. It needs `SAHA_BROWSER_PACKAGE=@playwright/test` in the environment. Ordinary pull requests do not start this job. It runs on a non-documentation push to `main`, on the merge queue, when `engineering-checks` is started by hand, and on a pull request labeled `ci-full`. Next step for whoever picks it up: open the failing run in the GitHub Actions UI, read the first failing suite, and reproduce it locally with `node scripts/test.mjs integration smoke ui --only <that suite> --fast --guard`.

## 9. Every change, applied here

1. `git fetch origin main && git switch -c <type>/<topic>-<date> origin/main`.
2. Make the change with its test; update the implementation boundary, requirement assessment, next-delivery row and evidence together (AGENTS.md).
3. Run the gate (section 6), then the baseline step if covered files changed (section 7).
4. Commit, push, open a **draft** pull request into `main` stating what ran and what did not.
5. Wait for `checks`. The heavy jobs, including `regressions` (section 8), run on `main`, the merge queue, a manual run, and a pull request labeled `ci-full`. The sponsor approves merges.
6. Verify the resulting tree on GitHub matches your intent.

## 10. Do and don't, specific to this repository

Do:
- Keep authorisation on the server; owner authority does not override patient scope.
- Resolve identity only through `lib/saha/identity.ts`; never expose a worker that trusts public identity headers.
- Preserve confirmed records, revisions, audit, receipts and applied migrations; correct by appending evidence.
- Treat an uncertain outbound result as unknown, never as a reason to retry blindly.
- Use synthetic fixtures; keep providers off and recipients unreal.

Don't:
- Don't run `format` or `ruff`/`prettier --write` over the tree; don't touch `tests/evidence/`, `docs/history/` or `docs/reference/`.
- Don't claim acceptance, production readiness or a passed case that was not executed and observed.
- Don't commit databases, secrets, real patient data, build output or recovery artifacts.
- Don't add a root Markdown file or copy a version or count into a second document.
- Don't edit an applied migration.

## 11. Known debt (queued, not for drive-by fixing)

- Root Markdown consolidation into `docs/current/` with link repair.
- Moving about 1,000 flat test files into layer folders; the catalogue today infers the layer from the name.
- `VALIDATION.md` and HANDOVER.md are very long dated logs; a short status block and an archive split are planned.
- Wide, one-line route and library code; whole-tree formatting once the baseline can be re-pointed in one reviewed pull request.
- Evidence under `tests/evidence/` (about 14,000 files) is meant to live outside git as manifests plus a release archive.
- The `regressions` job (section 8).

## 12. Glossary

| Term | Meaning |
|---|---|
| Slice | One reviewable unit of work, numbered (for example 11a, 12a); each has a document in `docs/current/`. |
| Baseline | The SHA-256 manifest that `check-documentation.py` verifies (section 7). |
| Guard | `tests/regression-baseline.json` check that no suite's assertion count drops. |
| Pack / programme | A configured set of indicators, forms and rules installed per programme. |
| ASHA / ANM | Frontline community and auxiliary-nurse workers. |
| ABDM / ABHA | India's national digital health mission and health account number. |
| Sponsor / owner | The person who approves merges; not a role inside the app. |
| Synthetic | Invented data; the only kind this repository may hold. |
