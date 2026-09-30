# Development and CI

Use this guide with [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md). A clean clone should use the latest handover/release branch, not assume the older GitHub main contains R11.

## Environment

`package.json` requires Node >=22.13 and pins pnpm 11.25.0. Use Node 24 for the complete test/recovery workflow because the fixtures and recovery tool use `node:sqlite`, backup and filesystem glob APIs. Keep `pnpm-lock.yaml`. A clean clone defaults to the portable execution profile; managed Sites workspaces use a checkout-local profile. Do not commit that local profile or invent a replacement.

From the repository root:

```sh
npm run install:ci
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

`npm run dev` starts the portable development application on port 5173 when no managed profile is selected. Managed Sites previews use their existing supervisor. Development fallback identity is explicitly synthetic. A production worker depends on the trusted Sites dispatcher and must not be publicly exposed with user-supplied identity headers.

External APIs default to disabled in [.env.example](../../.env.example). Do not copy secrets into Git or a documentation file. Configuration, a secure server secret binding and approved current capability/partner grants are separate requirements; an environment toggle alone does not activate a live workflow.

## Local database and application checks

Build before the HTTP suite. Apply the six migrations in order to **disposable local test state**, using the built Worker config and its DB binding. The current test harness expects `.wrangler/test-state`; reserve that directory for synthetic fixtures. Never point these commands at a hosted database or real records.

The initialization below refuses an existing test-state directory. For an existing test database, inspect its schema and apply only new migration files; do not rerun the entire sequence or delete it blindly. The built config does not set Wrangler's migration directory, so use the repository's actual Drizzle SQL files explicitly.

```sh
(
  set -e
  test ! -e .wrangler/test-state
  for migration in drizzle/[0-9][0-9][0-9][0-9]_*.sql; do
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/test-state --file "$migration"
  done
)
node tests/run-api-smoke.mjs
node tests/recovery-drill.mjs
```

The API runner copies the built Worker to a temporary directory and isolates its registry. Ports 8787 and 8788 must be available for API and restore checks respectively. Fixture constructors use synthetic accounts and local dispatcher-model headers. Recovery runs after successful API checks and needs the populated synthetic database. Review the resulting reports; do not claim these commands were run merely because this guide contains them.

The [execution register](EXECUTION-REGISTER.csv) lists individual contract scripts. Run affected suites directly with Node. The HTTP suite imports its component smoke modules; do not double-count those as separate runs. The load result is a bounded reporting smoke, not another assertion suite.

## Documentation maintenance

```sh
node scripts/audit-requirements.mjs --check
python3 scripts/check-documentation.py
git diff --check
```

`scripts/build-documentation.py` generates inventories, baseline transcriptions, workbook CSV exports, catalogue and execution registers. It does not change runtime behavior or mark acceptance passed. Run it after intentional source/evidence changes, review the diff, then update prose and verification baselines deliberately. The R11 baseline manifest is immutable historical evidence; a later release should add a new baseline instead of relabelling this one.

## CI boundary

No complete hosted product CI qualification is established by this documentation batch. The reproducible commands and documentation checker are committed, but a future CI job must provision a disposable environment, install the pinned dependencies, build, apply migrations, run suites and retain safe reports. Do not connect CI to a real patient database or live partner by default. Until that job is actually configured and run, label it planned rather than green.

For a documentation-only change, hashes and integrity checks are sufficient when runtime files remain unchanged. For code changes, run TypeScript/build and the tests needed for the changed invariants, then record actual execution with its limits. GitHub publication is separate from authorized Sites deployment.
