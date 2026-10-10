# Current coding environment 10 October 2026

Use [the selected engineering baseline](engineering-handoff/CURRENT-ENGINEERING-BASELINE.md) and [test plan](engineering-handoff/TEST-AND-RECOVERY-PLAN.md) with this reproduction guide. The current synthetic host is documented as health.aplyd.org on the existing DigitalOcean droplet behind Caddy; automatic Cloudflare staging deployment is frozen. This is a source/documentation statement, not a fresh live-service observation. Inspect the actual updater and configuration before any authorised release; a Cloudflare freeze does not freeze a separate DigitalOcean updater.

Documentation-only changes skip engineering CI under its current paths-ignore rule; the separate documentation-checks workflow normally applies to a docs pull request. Run the required documentation checks locally for this preparation. A docs preservation commit may explicitly skip hosted CI, with that skip retained as a limit; it cannot become a required application-CI pass or release approval. New manual CI/provider/cloud spending still needs the repository's actual financial permission; this preparation does not start those actions.

# Development and CI

Use this guide with [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md). A clean clone should branch from GitHub `main`, which has contained R11 and development slices 0a–3f, and the later slices and review fixes 3g–6r (#36–#70), since 30 September 2026, and the overnight slices and review fixes 0b-4 to 6ae (#74–#99) and the demonstration slices 9a–9c (#101–#103) since 2 October 2026, and the round-10 slices 10a–10k (#105–#115) since 3 October 2026. Start with [HANDOVER.md](../../HANDOVER.md). Test layers, commands and CI tiers are in [Testing Saha](TESTING.md).

## Environment

`package.json` requires Node >=22.13 and pins pnpm 11.25.0. Use Node 24 for the complete test/recovery workflow because the fixtures and recovery tool use `node:sqlite`, backup and filesystem glob APIs. Keep `pnpm-lock.yaml`. A clean clone defaults to the portable execution profile; managed Sites workspaces use a checkout-local profile. Do not commit that local profile or invent a replacement.

From the repository root:

```sh
npm run install:ci
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

`npm run dev` starts the portable development application on port 5173 when no managed profile is selected. Managed Sites previews use their existing supervisor. Development fallback identity is explicitly synthetic. The current trusted provider is selected by `lib/saha/identity.ts`; Sites and Cloudflare Access have different verification paths. Never expose a production service using the development identity or user-supplied identity headers.

External APIs default to disabled in [.env.example](../../.env.example). Do not copy secrets into Git or a documentation file. Configuration, a secure server secret binding and approved current capability/partner grants are separate requirements; an environment toggle alone does not activate a live workflow.

## Local database and application checks

Build before the HTTP suite. Apply every migration file in `drizzle/` in order (33 in the inspected 10 October baseline; enumerate fresh source rather than assuming this count) to **disposable local test state**, using the built Worker config and its DB binding. The current test harness expects `.wrangler/test-state`; reserve that directory for synthetic fixtures. Never point these commands at a hosted database or real records.

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

The API runner copies the built Worker to a temporary directory and isolates its registry. Since slice 10k it restarts the local Worker three times on the same D1 state during the suite, because the local development runtime's memory grows with every request. Ports 8787 and 8788 must be available for API and restore checks respectively. Fixture constructors use synthetic accounts and local dispatcher-model headers. Recovery runs after successful API checks and needs the populated synthetic database. Review the resulting reports; do not claim these commands were run merely because this guide contains them.

The accessibility audit (`tests/a11y-audit.mjs`, slices 6e, 6f and 6x) runs outside CI because Playwright and axe-core are not project dependencies. Install them in a separate directory and start a built Worker with fresh local synthetic state on a free port. Then run `SAHA_A11Y_MODULES=<that directory> SAHA_A11Y_CHROMIUM=<chromium executable> SAHA_A11Y_ORIGIN=http://127.0.0.1:<port> node tests/a11y-audit.mjs`. It creates synthetic accounts and records on that Worker, so never point it at hosted staging. See [slice 6x](SLICE-6X-POPULATED-ACCESSIBILITY.md) for what it checks.

The [execution register](EXECUTION-REGISTER.csv) lists individual contract scripts. Run affected suites directly with Node. The HTTP suite imports its component smoke modules; do not double-count those as separate runs. The load result is a bounded reporting smoke, not another assertion suite.

## Documentation maintenance

```sh
node scripts/audit-requirements.mjs --check
python3 scripts/check-documentation.py
git diff --check
```

`scripts/build-documentation.py` generates inventories, baseline transcriptions, workbook CSV exports, catalogue and execution registers. It does not change runtime behavior or mark acceptance passed. Run it after intentional source/evidence changes, review the diff, then update prose and verification baselines deliberately. The R11 baseline manifest is immutable historical evidence; a later release should add a new baseline instead of relabelling this one.

## Identity provider (slice 0c)

`lib/saha/identity.ts` chooses one trusted provider per deployment with `SAHA_IDENTITY_PROVIDER`. `sites-chatgpt` (default) keeps the R11 Sites headers and account IDs. `cloudflare-access` trusts only a verified `Cf-Access-Jwt-Assertion` (RS256, team keys, issuer, audience, expiry) and namespaces account IDs as `access:<subject>`; it needs `SAHA_ACCESS_TEAM_DOMAIN` and `SAHA_ACCESS_AUD`. A misconfigured provider returns 503 rather than falling back. Moving an existing deployment between providers creates new account IDs, so members must be re-invited; no identity migration tool exists yet.

## Supply-chain gate (slice 0c)

After a build, `node scripts/security-gate.mjs` writes a CycloneDX SBOM of production dependencies (`dist/sbom.cdx.json`) and runs `pnpm audit`. It fails on any critical advisory and on any high advisory whose package appears in `dist/`; high advisories confined to development or build tooling are listed as accepted in `dist/security-gate.json`. The bundle check is a text search of the built output, not a reachability analysis. The gate fails closed when the audit service is unreachable.

## Hosted synthetic staging

Since 1 October 2026, at the sponsor's instruction, `.github/workflows/deploy-staging.yml` deploys every merge into `main` to a Cloudflare Worker with a D1 database behind Cloudflare Access, in the synthetic environment with external APIs off. `scripts/cloudflare-staging.mjs` rewrites the built Worker configuration (Access identity only, `workers.dev` only, no preview addresses) and checks after each deploy that the address does not answer without sign-in; `tests/cloudflare-staging-contract.mjs` covers the configuration rules. See [Hosted synthetic staging](HOSTED-STAGING.md). Merging into `main` therefore publishes to this synthetic host; it is not a production Site. While the repository variable `SAHA_DEPLOY_FREEZE` is `true`, a merge skips the deploy job before a runner starts. A hand-started run still deploys. A newer push deploy cancels an older push deploy that is still running; a hand-started run is a separate queue, so a merge does not cancel it.

## CI boundary

`.github/workflows/ci.yml` (slice 0c) runs documentation integrity, install, type check, build, the supply-chain gate, the HTTP/D1 suite, contract suites and the restore drill on pull requests and when started by hand, with synthetic data only. It does not run on a push to `main`. A pull request that changes only Markdown, or only files under `docs/`, does not start the suite. Any other changed path still runs it, including the documentation checks. For a docs-only change, run the documentation commands locally, or start the workflow by hand. A new push to the same pull request cancels the in-progress run. The workflow had not run on GitHub when it was first committed. Do not connect CI to a real patient database or live partner.

For a documentation-only change, hashes and integrity checks are sufficient when runtime files remain unchanged. For code changes, run TypeScript/build and the tests needed for the changed invariants, then record actual execution with its limits. GitHub publication is separate from authorized Sites deployment.
