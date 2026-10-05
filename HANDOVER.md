# Handover to the next coding agent

3 October 2026 (IST). Written for whichever agent continues Saha next (GPT/Codex, Cursor, Claude or a person). It is self-contained: read it, then [AGENTS.md](AGENTS.md), then follow the links. Nothing here changes the status of any requirement.

## Active app-first programme (5 October 2026)

The sponsor requested the Android-first ASHA app and matching browser demonstration, then completion of remaining buildable software using ten workstreams. Four agents can run concurrently, so workstreams run in batches. The canonical checkout is on `app-first/integration-20261005`, starting from GitHub main `2adfbde1369b854d71962918bad3b81fdac746fe` (13a–13f are already merged). The initial integrated batch is pushed as draft PR [#161](https://github.com/nakul175/saha-health/pull/161); do not merge main without the sponsor.

Authenticated `/app` shares existing server commands and permission checks. The Android project uses the trusted HTTPS browser origin; encrypted field storage remains browser-owned. APK/lint is pending explicit approval to accept Google's Android SDK licence for temporary tools; never accept by elapsed time. Browser phone journeys pass, but physical Android/field checks are pending. Atomic ABHA review reservations prevent the prior concurrent throttle race. R27 reconciliation and R77 synthetic reminder opt-out are integrated locally, with independent review in progress. See [next delivery](docs/NEXT-DELIVERY.md) and dated [validation](VALIDATION.md).

The current source has 69 HTTP method/route handlers, 57 certified per-patient commands and 19 migrations (`0000`–`0018`); the older source-size statement below is historical. All 176 formal acceptance criteria stay pending. Extended local workerd memory testing returned 200 for 8,101 requests, but did not satisfy the plateau criterion; O-2 remains open. Review caught browser Back and stale organisation-response gaps; fixes are integrated with 105 combined workflow/browser checks. Remaining feature sizing is an active workstream, not an inferred percentage from partial requirement counts.

## Independent-provider feature (3 October 2026)

The current feature adds an independent Anaemia Screen service adapter, not clinical AI approval. The runnable private Sites demonstration and provider console have separate deployments/databases. It was integrated with `main` in pull request #126 at the sponsor's instruction on 3 October 2026. On the hosted staging Worker the service stays disabled after the merge: `scripts/cloudflare-staging.mjs` sets `SAHA_EXTERNAL_APIS_ENABLED` to `false` and sets no `SAHA_ANAEMIA_*` value, and `connection()` in `lib/saha/anaemia.ts` refuses unless all of them are set for the approved origin. The staging environment is named `synthetic`, so a signed-in owner with a care role can still open the synthetic screening example there (it adds one synthetic example person and visit to that organisation); no image leaves Saha. See [demonstration and ownership](docs/current/INDEPENDENT-ANAEMIA-PROVIDER.md).

The hosted service-to-service diagnostic also passed eight checks against the actual independent provider model and quality refusal, without patient context.

Feature validation: 4,620 HTTP/D1, 7,227 contract/client with coverage of all 107 final CI suites, 21 quiescent local restore and 8 jsdom component checks. Provider Worker/model checks are separate. Evidence: `tests/evidence/independent-anaemia-provider/`; all formal acceptances remain pending. The default environment template keeps the image service disabled; only the owner-private Sites demo holds its server secrets. Read `VALIDATION.md` for exact limits.


## Where things stand

- **Source:** GitHub `nakul175/saha-health`, branch `main`. Round 10 (slices 10a–10k, pull requests #105–#115) was merged on 3 October 2026 IST at the sponsor's instruction, on top of #116 (CI minutes and a deterministic restore check). Later on 3 October the sponsor's "merge all" added slice 12a (voice input, #146), the hosted sign-in record (#128) and the 15 parallel R-slices (#144, covering #129–#143), then the eight frontline provider apps (#145, disabled on hosted staging). Every pull request since #1 was merged without independent human review; agent reviews found defects that later slices fixed, and some findings remain open (below).
- **Product:** a synthetic health workspace for ASHA workers, supervisors, clinicians and programme leads. Cloudflare Worker with D1 (SQLite), Vinext/React front end, TypeScript throughout. One organisation's state is loaded per request; mutations go through `POST /api/commands` with server-side authorisation.
- **Size:** 59 HTTP method/route handlers (five from the anaemia-provider demonstration, #126), 56 certified per-patient commands, 16 migrations (`drizzle/0000`–`0015`).
- **Acceptance:** all 176 BRD v1.1 acceptance criteria are pending. Audited counts: 14 implemented-local, 151 partial, 2 not-built, 9 unverified. `main` is not accepted for production or real patient use.
- **Hosted copy:** `https://saha-staging.nakul17.workers.dev`, synthetic data only, behind Cloudflare Access (email one-time code, named addresses only). Round 10 deployed on 3 October 2026 (workflow run 37086154679, success). See [hosted synthetic staging](docs/current/HOSTED-STAGING.md).

## Read in this order

1. [AGENTS.md](AGENTS.md) — repository rules for every agent.
2. [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) — what is built and its limits.
3. [docs/NEXT-DELIVERY.md](docs/NEXT-DELIVERY.md) — every slice delivered so far, one row each, with links to slice documents in `docs/current/SLICE-*.md`.
4. [VALIDATION.md](VALIDATION.md) — dated evidence for every slice, integration and merge. Read the last ten sections.
5. [docs/current/DEVELOPMENT-AND-CI.md](docs/current/DEVELOPMENT-AND-CI.md) — setup and test commands.
6. [docs/current/REMAINING-WORK-ESTIMATE.md](docs/current/REMAINING-WORK-ESTIMATE.md) and [remaining-work/remaining-slices.tsv](docs/current/remaining-work/remaining-slices.tsv) — what is left and who can close it.

## Rules that are not negotiable

These come from the sponsor and from earlier reviews; [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) carry the same rules.

- Authorisation stays on the server. Owner authority never overrides patient scope. Identity comes from the trusted provider (`lib/saha/identity.ts`): Sites headers by default, a verified Cloudflare Access token on the hosted copy. Never accept identity from public headers directly. Principals whose id starts with `fixture:` must never sign in.
- Preserve confirmed records, revisions, audit events, receipts, applied migrations and legacy source. Corrections append evidence. An uncertain external result never authorises a blind retry.
- Synthetic data only. Do not turn on providers, message real recipients, or add secrets, real patient data, databases or build output to Git.
- Work on a branch and open a pull request into `main`. Never force-push `main`. Merging into `main` deploys the hosted copy automatically unless the repository variable `SAHA_DEPLOY_FREEZE` is `true`; merge only when the sponsor says so.
- For code changes, run the affected checks and record the real results with their dates and limits in `VALIDATION.md`. Do not mark an acceptance case passed because a related unit check passes. Update the implementation boundary, requirement assessment (`requirements/assessment.tsv`), next-delivery row and evidence together.

## Verifying a change

Since round 11 the test layers, commands and CI tiers are in [Testing Saha](docs/current/TESTING.md): `npm test` runs the pull-request tier, `npm run test:regression` runs everything. The manual sequence below is what `npm test` does.

Node 22.13 or newer (Node 24 for the full restore workflow), pnpm 11.25.0. From the repository root:

```sh
npm run install:ci
node node_modules/typescript/bin/tsc --noEmit
npm run build
# fresh local D1 for the HTTP suite (refuses an existing directory)
test ! -e .wrangler/test-state && for m in drizzle/[0-9][0-9][0-9][0-9]_*.sql; do node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/test-state --file "$m"; done
node tests/run-api-smoke.mjs            # HTTP/D1 suite, a few minutes
for f in tests/*-contract.mjs; do node "$f" || echo "FAIL $f"; done
node tests/recovery-drill.mjs           # encrypted restore, 21 checks
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
```

Totals on the round-10 source (before #116 was merged in): 4,599 HTTP/D1, 7,162 contract (4,108 of them the 10j message-catalogue checks) and 21 restore checks; reports in `tests/evidence/slice-integration-13/`. CI (`.github/workflows/ci.yml`) runs the same on pull requests that change code; docs-only pull requests skip it since #116.

Things that will trip you:

- **Documentation is generated and checked.** After changing source or evidence run, in this order: `node scripts/audit-requirements.mjs`, `python3 scripts/build-documentation.py`, then `python3 scripts/update-baseline.py <name> "<label>"` (a new `docs/verification/application-<name>-sha256.json`; set its `previous` to the prior baseline), then the two checks above. Historical baselines are never edited.
- **Test result files.** Running a contract writes `tests/<name>-result.json`. Untracked ones must be deleted and tracked ones restored before the documentation build, or the check fails with "R11 assertion total differs". Fresh results belong in `tests/evidence/<slice>/` with a manifest.
- **The local Worker's memory grows with every request** under `wrangler dev` (about 270 KB per workspace load; about 40 KB in Miniflare with no inspector). The HTTP runner restarts the Worker three times on the same D1 state (slice 10k). If you add many HTTP checks and the Worker dies with "JavaScript heap out of memory", add another `await globalThis.sahaRecycleWorker?.()` in `tests/api-smoke.mjs`. Memory on Cloudflare (128 MB isolate limit) has not been measured.
- **Shared prose counts.** `docs/IMPLEMENTATION.md` states the route count, the slices that added routes and the patient-command count in one paragraph; keep it exact when you add a route or a per-patient command (`lib/saha/partition.ts`).
- **Completeness checks between features.** Some contracts fail when a new command is not classified, for example every command that names a visit must be listed in `lib/saha/imported-visits.ts` as blocked or allowed on an imported visit, and the Operations view returns only an allow-list of the operations record (`OPERATOR_FIELDS` in `lib/saha/operations-server.ts`). New records in the operations document need their own scoped route.

## How the last rounds were built

Each round ran several agents in parallel, each on its own branch from the same `main` commit, each passing its own full suite. An integrator then merged the branches one after another into a stack (`int-…` branches) with merge commits, resolved conflicts by keeping both sides, rebuilt generated files and the baseline after every merge, ran the combined suite, had a separate agent review the combined diff, fixed high findings in a final slice, and opened one pull request per step. The helper scripts lived outside the repository; the procedure above is all they did. Conflicts to expect: `.github/workflows/ci.yml` (the contract loop line), `lib/saha/server.ts` and `platform.ts` dispatch lists, `lib/saha/types.ts`, `tests/api-smoke.mjs`, the docs listed above, and JSON lists in `requirements/evidence-map.json` (check for doubled or missing commas).

## Open defects and risks

- **Round-11 test findings:** hosted sign-in never worked after Access went live (fixed in slice 0c-1, pull request #118; the sponsor confirmed sign-in in a browser on 3 October 2026, 13:06 IST, after the deploy of #126). Open: O-1 reads occasionally refused with 503 under concurrency when their audit event cannot be written (fails closed); O-2 Worker memory grew from about 199 MB to 583 MB over 3,000 workspace loads without levelling off (a Cloudflare isolate allows 128 MB; not measured on Cloudflare); O-4 workspace loads slowed 74% over 8,000 loads. See [slice 11f](docs/current/SLICE-11F-TESTING-INTEGRATION.md). Slice 13e (on a branch) adds two audit indexes, which keep load time flat as the log grows (O-4), and a randomised backoff on chain retries, which removed the refused reads in a contention model (O-1). O-2 was measured again and is unchanged; it remains open ([slice 13e](docs/current/SLICE-13E-PERFORMANCE.md)).

- **Round-10 review (slice 10k):** M2 the scheduled job's rotation can skip organisations when a run stops early, and never reaches organisations beyond the first 1,000 (needs a stored cursor); M3 the household visit plan route returns names and follow-up titles without a read-audit event; L1 the scheduled evaluation record is an organisation-wide commit that can cause 409s; L3 only `fixture:` is a reserved identity prefix; L4 the job and the notification simulator read the environment from two places; L5 the dispute send gate does not cover assistant runs; L6 the operations document has no overall size bound. Details: [slice 10k](docs/current/SLICE-10K-COMBINED-REVIEW-FIXES.md). All seven are addressed by slice 13d, on a branch ([review leftovers](docs/current/SLICE-13D-REVIEW-LEFTOVERS.md)). An agent review of the "fix all" slices 13a–13e found one high and six lower defects, all fixed in slice 13f, on a branch ([review fixes](docs/current/SLICE-13F-REVIEW-FIXES.md)).
- **15 parallel R-slices (#144):** an agent review of the integration found three high defects, fixed before the merge (an identifier correction sent without approval or patient scope; a reassignment that skipped the patient-scope check; CI red), and four medium ones, of which three were fixed (R26 tasks closed as recomputed with nothing recomputed; the FHIR rule set accepting Provenance under its old version; R09's programme tag not reaching the workspace scope gate). Still open after the merge: R08 and R09 scope did not reach the SQL pre-filter, the auxiliary read routes or the direct `normallyAllowed` checks, and R09's purpose tag stopped no data flow (both addressed by slice 13a, on a branch); `recompareShadow` had no caller (addressed by slice 13c, on a branch). See `VALIDATION.md`, integration of #144.
- **Earlier reviews:** the medium and lower findings listed under slice 6ae in `VALIDATION.md` are addressed by slice 13d (on a branch) except two that remain open: the ABHA review throttle can be raced by parallel requests, and the ledger byte use and population-check cost are not measured at scale.
- **Voice input (slice 12a):** on phones, speech becomes text only through the browser's speech service, which sends the audio to the browser maker (Google on Android); on-device browser speech exists only in desktop Chrome 139+. An owner must allow it per organisation, and the server refuses that outside the synthetic and training environments. Using it with real patients needs a data-protection decision. Recognition quality has not been tested with a real recognizer. See [slice 12a](docs/current/SLICE-12A-VOICE-INPUT.md).
- **Scheduled job on the hosted copy:** the Cron Trigger (every five minutes) was deployed with round 10, but no scheduled run has been confirmed in the Worker log, and on the Workers Free plan a scheduled run gets 10 ms of CPU, which is less than loading one organisation. Confirm in the Cloudflare dashboard and ask the sponsor about the Paid plan before relying on it.
- **Content that is not approved:** the demonstration clinical rules (slice 9a) cite MoHFW and NTEP guidance but no clinician has approved them; the Hindi workspace (10j) is a draft translation not reviewed by a native speaker; programme systems are simulators.
- **Never tested:** real phones in the field, real partner systems, ABDM sandbox, hosted backup and restore, uptime monitoring.

## Suggested next work

1. Investigate O-2 (Worker memory growth; unchanged by slice 13e) with heap snapshots of the local Worker, and measure memory on the hosted Worker.
2. Review and merge slice 13d (round-10 M2, M3, L1, L3–L6 and the review 9 and 10 leftovers); then make the ABHA review throttle atomic (a reservation before the lookup).
3. Confirm the scheduled job on the hosted Worker (log lines `saha_scheduled`) and measure the hosted Worker's memory under repeated workspace loads.
4. Continue the proposed slices in `remaining-slices.tsv`. By name, round 10 covered R01, R02, R07, R10, R16 (without the ABHA checksum: no official specification was found), R20, R31 and R36; 10c (incentive claims) and 10j (Hindi workspace) have no single matching row. R03, R06, R08, R09, R13, R17, R21, R23, R24, R26, R33, R37, R42, R74 and R96 were built in parallel and merged in #144 (each partial; see its slice document). Candidates still open include R27 and the remaining wiring named under the #144 risks above.
5. Run the UAT pack with named testers (docs/testing/uat/) and ask for an independent human review before any use beyond synthetic demonstrations.

## Only the sponsor can do

Approve clinical content, provide partner and provider credentials, choose the Cloudflare plan, manage who may sign in (Cloudflare Zero Trust, Access policy), set or clear `SAHA_DEPLOY_FREEZE` before a demonstration, keep GitHub Actions minutes available, and decide what is merged.

## Outside the repository

Cloudflare account settings, Access policy and the `CLOUDFLARE_API_TOKEN` secret are in the Cloudflare dashboard and GitHub settings. A presenter run-of-show for the government demonstration and a narrated training video (recorded on synthetic data, 2 October 2026) were shared with the sponsor outside Git.

## Eight independent frontline apps (3 October 2026)

The owner-private Sites demonstration now has eight independent speech/OCR workflow providers and Saha integration. Read [scope and evidence](docs/current/FRONTLINE-EIGHT-APPS.md). Merged into `main` on 3 October 2026 at the sponsor's instruction (#145), after an agent review whose medium findings M1 and M3 were fixed; the runtime CDN import of the inference libraries without an integrity check remained open after the merge (slice 13b, on a branch, isolates it in a sandboxed frame and checks receipts against what was sent). Four method/route handlers added; no certified command or migration. Synthetic-only; clinical use disabled; hosted staging cannot reach the providers.
