# Hosted synthetic staging

1 October 2026 (IST). At the sponsor's instruction, Saha is hosted on Cloudflare so the team can open it in a browser. The hosted copy uses synthetic records only. It is not accepted for production or real patient use, and none of the 176 formal acceptances changes because it is online.

## What runs where

- **Application:** one Cloudflare Worker named in `deploy/cloudflare-staging.json` (`saha-staging`), served only at its `workers.dev` address. Preview addresses are off.
- **Database:** one Cloudflare D1 database (`saha-staging`, location hint Asia-Pacific). The database is created by the first deploy and migrated with the repository's own SQL files (`drizzle/`); D1 records which files it has applied.
- **Sign-in:** Cloudflare Access in front of the Worker. People sign in with a one-time code sent to an allowed email address. The Worker trusts only the signed Access token (slice 0c, `SAHA_IDENTITY_PROVIDER=cloudflare-access`) and ignores the Sites identity headers, so the address cannot be entered with forged headers. Inside the application, the usual organisation membership, roles and patient scope still apply.
- **Environment:** `synthetic` (slice 6n). Synthetic fixtures and demonstration connectors are seeded, the banner says synthetic, and live provider, programme and EHR calls are off (`SAHA_EXTERNAL_APIS_ENABLED=false`, no connections).

## How it is updated

Every merge into `main` runs `.github/workflows/deploy-staging.yml`: documentation integrity, install, type check, build and the supply-chain gate, then the database is found (or created), new migrations are applied, the Worker is deployed and `scripts/cloudflare-staging.mjs check` confirms that the address does not answer without sign-in. The full HTTP, contract and restore suites run on pull requests, not again at deploy time. The workflow can also be started by hand (workflow_dispatch). Without the `CLOUDFLARE_API_TOKEN` repository secret it deploys nothing.

To undo a bad deploy, revert the change on `main`; the next run deploys the reverted code. Applied database migrations are not reversed (repository rule: applied migrations are preserved).

## Freezing the site for a demonstration

Every merge into `main` redeploys the site, so a merge on the day of a demonstration would change what is shown. Since 2 October 2026 (slice 9c) the repository variable `SAHA_DEPLOY_FREEZE` stops that: while it is `true`, a merge runs the workflow, which deploys nothing and says so in a notice. A run started by hand from the Actions tab (workflow_dispatch) still deploys, from the branch or tag chosen when it is started; tag the commit to show (for example `demo-2026-10-06`) and start the run from that tag. Set the variable back to `false`, or delete it, to resume deploying on merge. The variable is kept in the repository settings (Settings → Secrets and variables → Actions → Variables), not in Git.

## Scheduled job (Cron Trigger)

Since slice 10a the hosted configuration carries a Cloudflare Cron Trigger. `scripts/cloudflare-staging.mjs configure` writes `triggers.crons` into the generated Worker configuration from `scheduledCron` in `deploy/cloudflare-staging.json` (`*/5 * * * *`, every five minutes, UTC); the next deploy registers it. Each run calls the Worker's `scheduled` handler (`worker/index.ts`), which, per organisation and within bounded work, applies due scheduled caseload transfers, marks provider and destination requests past their time limit as needing review and evaluates operational alerts, all through the normal commit with audit events naming `Saha scheduled job` (details and limits: [slice 10a](SLICE-10A-SCHEDULED-TRIGGER.md)). It never calls a provider, a programme destination or an EHR, never sends a message and never retries or resends; it does nothing in a `misconfigured` environment.

- **See it:** the Worker log (Cloudflare dashboard, Workers & Pages, the Worker, Logs) has one `saha_scheduled` line per run with counts only; an organisation's audit trail shows the `scheduledAlertEvaluation`, `caseloadAutoApply` and `scheduledTimeoutReview` events; operators see the last recorded evaluation in `operations.scheduledJob` of `GET /api/operations`.
- **Turn it off:** set `"scheduledCron": ""` in `deploy/cloudflare-staging.json` and merge (or start the workflow by hand); the next deploy removes the trigger. Setting it back restores it. Any other value must be a five-field cron expression.
- **Cost and plan:** a Cron Trigger is available on the Free plan, but Cloudflare's limits page (read 2 October 2026) gives a scheduled invocation 10 ms of CPU and 50 subrequests (D1 queries included) on Free, against 30 seconds and 1,000 D1 queries on Paid. Loading an organisation takes more than that, so the job needs the Workers Paid plan to do its work; on Free it will stop early or be cut off (harmless: each commit is atomic and the next run finds the same work). Which plan the account is on was not checked. Runs add database reads on every five-minute run for each organisation visited (up to 20), and a handful of writes only when something changed or an hour has passed.
- **Not yet seen on Cloudflare:** the trigger has been exercised locally (wrangler's scheduled-test support) and in contract tests, not on the hosted Worker; confirm the first scheduled runs in the log after the deploy that carries it. If the deployment token cannot set the schedule, the deploy step will fail at `wrangler deploy` with an authentication error; add the Workers Scripts edit permission.
- **Demonstration:** the freeze above stops deploys, not the trigger; a frozen site keeps running the job it was last deployed with.

## Status

Live since 2 October 2026 at `https://saha-staging.nakul17.workers.dev`. The first deploy (workflow run 36967401955, started by hand after the `CLOUDFLARE_API_TOKEN` secret was added) passed every step, and the address answered only "Sign-in required" before Access was configured. The same day Cloudflare Access was turned on for all traffic to the Worker (team domain `aged-pond-c865.cloudflareaccess.com`), with one reusable allow policy listing named email addresses, a one-time code sent by email and a 24-hour session. Who may sign in is kept in the Cloudflare policy, not in Git. `deploy/cloudflare-staging.json` records the account ID, team domain and audience tag (identifiers, not secrets).

## Fails closed until sign-in is set up

`deploy/cloudflare-staging.json` holds the Access team domain and audience tag. Until both are filled in, the deployed Worker shows only "Sign-in required" and refuses every API call with 503 ("Sign-in is not configured for this deployment"). The deploy check accepts that state only while the two values are empty; once they are set it requires a Cloudflare Access redirect on both the page and the API.

## Cost

Expected to be nothing at this scale. Cloudflare's Workers pricing page (read 1 October 2026) gives the free plan 100,000 Worker requests a day and, for D1, 5 million rows read and 100,000 rows written a day with 5 GB of storage. Cloudflare Access is understood to be free for a small number of users on the Zero Trust free plan; that figure was not confirmed from Cloudflare's own page, so check the account's plan before inviting more than a handful of people. Saha stores organisation state as JSON rows, so writes, not requests, are the limit to watch.

## Limits

- Synthetic data only. Do not enter real patient information; the build is not accepted for it.
- One Worker and one D1 database with no backup schedule of its own; recovery relies on D1's built-in restore, which has not been exercised. The encrypted restore drill (`scripts/recovery.mjs`) is tested locally, not against the hosted database.
- The deploy job does not rerun the full test suites; it relies on the pull-request checks.
- No uptime monitoring, alerting or incident rota (NFR-01 stays unverified). The scheduled job evaluates alerts in-app only; nothing reaches people outside Saha.
- Access policies (who may sign in) are kept in the Cloudflare dashboard, not in this repository.
