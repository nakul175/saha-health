# Slice 11b — smoke tests (local and hosted)

3 October 2026 (IST). Synthetic data only; formal acceptance unchanged. Not independently reviewed. Built, run and documented by an agent without human review, like the slices before it. Part of round 11, the testing ecosystem; it adds tests and one test helper and changes no application code.

The repository had about a hundred unit-level suites and one large HTTP/D1 suite (`tests/run-api-smoke.mjs`, whose modules are called "smoke" but are integration tests, 4,599 assertions, several minutes). It had no quick answer to "is this build alive and are the main paths intact?" and no check of the deployed site beyond the one-line Access redirect in the deploy workflow. This slice adds both.

## What was added

| File | What it is |
| --- | --- |
| `tests/smoke/local-smoke.mjs` | Local smoke: one built Worker, one fresh migrated local D1, 28 checks plus 1 reported skip, 6.7–6.9 s end to end on an idle machine |
| `tests/smoke/hosted-smoke.mjs` | Post-deploy smoke of the hosted synthetic staging site: 11 checks without credentials (10 anonymous checks and the 20-second budget), 4 more when an Access service token is supplied, a one-line verdict, and a `--self-test` mode that proves the checks pass on a good site and fail on bad ones |
| `tests/lib/migrate.mjs` | `migrateOnce(state)`: applies all migrations to a fresh local D1 in one wrangler call (see "A defect in the shared harness") |
| `docs/current/SLICE-11B-SMOKE.md` | This document |

Reports are written to `tests/reports/smoke-local-result.json`, `tests/reports/smoke-hosted-result.json` and `tests/reports/smoke-hosted-selftest-result.json` (plus one JSON per self-test scenario). `tests/reports/` is not tracked.

## How to run

```sh
npm run build                                              # once; the local smoke and the self-test need dist/, the hosted smoke does not
SAHA_TEST_PORT=8811 node tests/smoke/local-smoke.mjs       # about 7 s when the machine is idle
node tests/smoke/hosted-smoke.mjs                          # anonymous tier; base URL SAHA_HOSTED_URL, default https://saha-staging.nakul17.workers.dev
CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... node tests/smoke/hosted-smoke.mjs     # adds the service-token tier
SAHA_TEST_PORT=8811 node tests/smoke/hosted-smoke.mjs --self-test                         # local; ports SAHA_TEST_PORT+1 to +3
```

- Exit codes of the hosted smoke: 0 pass, 1 fail, 2 **not executed** (the site could not be reached from this machine). The last line it prints is the verdict, for example `HOSTED SMOKE PASS https://saha-staging.nakul17.workers.dev: 11 passed, 0 failed, 4 skipped in 3.1 s; service-token tier skipped (no credentials)` (the number is illustrative: it has not been produced by a real run). It needs no build. Its probes run in parallel with 8-second timeouts, so it is designed to finish well inside its 20-second budget (which is itself one of its checks); that has not been measured against the real site.
- `SAHA_SMOKE_VARS='{"SAHA_DEMONSTRATION_PACKAGE":"manual"}'` passes extra Worker variables to the local smoke. The suite expects the default (none); the variable exists so the checks can be shown to notice a different configuration (below).
- Use the repository's queue on this shared machine: `bash /tmp/claude-0/par/heavy.sh b …`.

## Local smoke: what it checks

The built configuration (`dist/server/wrangler.json`) has `"vars": {}`. `SAHA_ENVIRONMENT` is therefore unset, which `lib/saha/environment.ts` reads as `synthetic` (source `default`, with a warning check in `/api/environment`), and `SAHA_DEMONSTRATION_PACKAGE` is unset, which `lib/saha/demonstration.ts` reads as automatic installation. The suite relies on both defaults; it does not set them. (The big HTTP suite runs with the package set to `manual`, so the automatic installation through the real store was covered only by a contract test and the browser check until now.)

| Area | Checks (each asserts status code and content) |
| --- | --- |
| Anonymous | `GET /api/workspace` 401 with a sign-in message; `POST /api/commands` 401; a reserved `fixture:` identity 401; the page `/` answers 307 to `/signin-with-chatgpt` and not the application |
| Shell and environment | A signed-in `GET /` is HTML with the title, `no-store` and the footer notice "Synthetic demonstration · not for patient care"; the workspace and `/api/environment` agree on `synthetic`, label "Synthetic development and demonstration environment", fixtures on, live services off |
| New owner | A home organisation (`org_` id, "Rampur care organisation"), owner membership, `default` team, six named synthetic people; the demonstration package installed itself: 7 governance entries (2 protocols, 3 services, 2 sources), all active, usable, no issues, install audited |
| Invitations and scope | The owner invites an ASHA and a supervisor by account code, both join the same organisation with the right role and status; an invitation cannot be reused and another account cannot use it (403); the ASHA sees 0 people, then exactly `p_meena` after assignment; the ASHA is refused (403) a visit and the history of an unassigned person |
| The visit | Start (draft, version 1); save 152/114, weeks 24, weight 57.5 and the other facts, read back exactly (version 2); the clinical review returns one protocol, no unknowns, and exactly one `urgent_review` finding, `diastolic-above-110`, whose action says "danger sign: refer to the CHC/FRU immediately", whose service is "Kheda CHC / First Referral Unit (synthetic)" and which cites its sources; confirmation needs the patient check (none 422, stale 409), then the visit is `confirmed`; the plan for `mis_maternal` and `mis_community` is `proposed` with a payload hash and cannot run before approval (409) or be approved with another hash (409); approve and run: `mis_maternal` is `accepted` with a receipt matching `SIM-…`, `mis_community` is the deliberate `uncertain` case with no receipt and "do not resend", both `demo` mode with one attempt; running the plan again sends nothing more; the owner's audit shows all seven actions under the ASHA's role |
| Supervisor | Reads `/api/operations` (aggregate report of 6 patients, owner-only detail `operations` and `telemetry` withheld) and sees the `destination-uncertain` alert the visit just raised; `/api/alerts` answers; refused (403, "owner" in the message) `createTeam`, `createInvite` and `installDemonstrationPackage`, as is the ASHA, and nothing was created; cannot start a visit |
| Stranger | Refused (403) the owner's workspace, patients, governance, operations, FHIR export of the visit and a command; their own home organisation is separate (different id, six people, no visits or submissions) |
| Every GET route | The 40 GET routes of `docs/current/HTTP-ROUTES.csv` all answer an anonymous caller 401 and the owner 200 (none 5xx), each with the query it needs; the sweep records route, path, status and time in the report |
| Server-side | The Worker's request log has no 5xx event and no unhandled workspace error; the whole run, Worker start included, finished within 90 s |

Skipped and listed in the report: `GET /api/media/[id]` — it needs the id of an uploaded media file and this run uploads none (it answers 404 for an unknown id, not a 5xx). A new GET route that answers 4xx without a parameter recipe is reported as skipped with its status, not silently passed; one that answers 5xx fails.

## Hosted smoke: what it checks

It sends only anonymous or forged requests unless a service token is given, never the real dispatcher identity of anyone, and sends the dispatcher-model headers only to prove they are refused.

| Tier | Check |
| --- | --- |
| Gate | The answer must come from the Cloudflare edge (`cf-ray` or `server: cloudflare`). A refusal by this machine's own egress gateway, a DNS or connection failure or a timeout is **NOT EXECUTED** (exit 2) with the reason and a `curl` classification, never a pass and never a failure of the app |
| Anonymous | TLS: the certificate verifies for the host, TLS 1.2 or 1.3, at least 7 days left |
| Anonymous | `GET /`, `GET /api/workspace` and an anonymous `POST /api/commands` are held by Cloudflare Access: a redirect (or for the command a redirect, 401 or 403) whose `Location` host is exactly `accessTeamDomain` from `deploy/cloudflare-staging.json`, with no application content in the body |
| Anonymous | Refusals grant no cross-origin access: no `Access-Control-Allow-Origin` on the anonymous answers, including one to a foreign `Origin` |
| Anonymous | Forged dispatcher identity headers (`oai-authenticated-user-id`, `-email`, `-full-name`, `-encoding`) are refused on the page, `/api/workspace` and a command (the command is the harmless unknown type `__smoke_not_a_command`, 422 if it were ever processed) |
| Anonymous | A garbage `Cf-Access-Jwt-Assertion` (with the forged headers), a well-formed but unsigned one that claims a valid email, audience and issuer, a garbage `CF_Authorization` cookie and a made-up service token are all refused |
| Anonymous | Plain `http://` does not serve the application (redirects to https, or does not answer) |
| Service token | Access admits the token (the answer comes from the Worker, not an Access redirect or 403) and the app's answer is recorded exactly; the app's own headers `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; the page is HTML with `no-store` and shows the synthetic notice (identity accepted) or "Sign-in required" (refused), never data; if the app accepts the identity, `environment` is `synthetic` and external services are off |

Without the token the four service-token checks are reported as skipped with the reason (a token the sponsor must create in Cloudflare Zero Trust, with a Service Auth policy on the Saha application).

### Security headers: what the app sets

Read from the code (`lib/saha/server.ts` `json()`, `lib/saha/media-server.ts`, the page's own response): the app sets `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` on every JSON answer, `no-store, must-revalidate` on the page, and `Content-Security-Policy: default-src 'none'; sandbox` on uploaded media. It sets **no** `Strict-Transport-Security`, `Content-Security-Policy` (for pages), `X-Frame-Options` or `Referrer-Policy`; Cloudflare may add some in front, which this suite cannot see without a token and does not assert. Only the two the app sets are asserted, and only on answers the app itself gave.

### What a service token gets: an expected refusal

`lib/saha/identity.ts` accepts a Cloudflare Access JWT only if it carries a string `sub` that is not empty **and** a string `email` containing `@`. Cloudflare's documentation for the application token ([developers.cloudflare.com, "Application token"](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/), read 3 October 2026) says a service-token JWT has no `email` claim and an empty-string `sub`, with the token's client ID in `common_name`. So even a valid service token that Access admits is refused by the app with 401 "Sign in to use your workspace.", and the page shows "Sign-in required". The suite reports exactly that (`serviceTokenOutcome` in the report: "Access admitted the token and the app refused the identity with 401 …") and does not count it as a failure of the deploy: it is how the app is built. Consequences for the integrator:

- A service token proves that **Access** is admitting automation and that the Worker is reachable and answering behind it; it cannot prove anything about the workspace, because the app will not let a service identity in. A hosted smoke of the signed-in paths would need either an app change (a deliberate decision about non-human identities: not made here) or a person.
- If the app ever does accept the service identity, the same checks then assert the workspace shape, the headers and that the deployment is synthetic with external services off. Note the side effect: the first accepted `GET /api/workspace` for a new identity creates a synthetic home organisation for it in the hosted database.
- The `kid` parameter of the Access login redirect is recorded in the report (`accessRedirect`), not asserted: that it equals `accessAud` was not confirmed from Cloudflare's documentation, and a wrong assumption must not fail a deploy.

## What the hosted smoke did from this machine: not executed

From this sandbox the hosted site cannot be reached. Both Node `fetch` and `curl` were tried on 3 October 2026:

- Node `fetch("https://saha-staging.nakul17.workers.dev/")` returns **403** with `x-deny-reason: host_not_allowed` and the body "Host not in allowlist: saha-staging.nakul17.workers.dev. Add this host to your network egress settings to allow access." That is this machine's egress gateway, not Cloudflare and not the app (no `cf-ray`, no `server: cloudflare`).
- `curl` through the configured HTTPS proxy fails with `CONNECT tunnel failed, response 403` (exit 56), and the proxy's status endpoint records `connect_rejected … saha-staging.nakul17.workers.dev:443`. `curl --noproxy '*'` returns the same gateway answer as Node.
- Setting `NODE_USE_ENV_PROXY=1` for Node does not help ("Request was cancelled").

A naive smoke would have seen a 403 and might have read it as "the site refuses anonymous visitors". The gate catches it and reports **NOT EXECUTED** (exit 2). Nothing about the hosted site is therefore claimed from a real run; every hosted check below is exercised only against stand-ins until someone runs it from a machine that can reach `workers.dev` (the deploy workflow's runner can) or the host is added to the egress allowlist, which is the sponsor's setting.

## Proof that the hosted checks can fail (self-test)

`--self-test` puts a small stand-in for Cloudflare's edge (a local HTTP server written for the test, not Cloudflare) in front of the real built Worker and runs the hosted checks against it in several shapes. Results are in "Results".

| Scenario | Expected, and asserted |
| --- | --- |
| The deployed shape: Access stand-in in front of a Worker in `cloudflare-access` mode | Every anonymous check passes; the service-token tier is skipped with a reason |
| The same with a service token | Access admits it, the real app refuses it with 401, the outcome is recorded, and the run has no failure |
| A service token Access does not admit | Fails, and the message says the token was not admitted |
| Access missing, app still in `cloudflare-access` mode | The three "held by Access" checks fail, but forged dispatcher headers, garbage and unsigned JWTs, the cookie and the fake token are still refused by the app (defence in depth) |
| **The dangerous mistake:** the default Sites identity provider (trusts dispatcher headers) exposed with no Access in front | The suite FAILS, naming the forged-header check ("the response carries application content: 200 {schemaVersion…") and the garbage-JWT check, which carries the same forged headers |
| An app that accepts the service identity (canned answer) | Workspace shape, headers, page and the synthetic-environment check all run and pass |
| A closed port | NOT EXECUTED, exit 2, `curl` exit 7, never a pass |
| An egress gateway's 403 `host_not_allowed` | NOT EXECUTED, never read as "refused" |

## A defect in the shared harness (not in the application)

`tests/lib/worker.mjs` `startWorker({ fresh: true })` applies the 16 migrations with one wrangler process per file. On this 2-core shared machine, in six trials of that path, four failed: two stopped at `0006_patient_concurrency.sql` with `no such table: organisations` (a migration written by the previous process was not visible to the next), and two finished without any error but the Worker then answered 503 "The workspace is unavailable" to every request (the one inspected had 27 tables, against the 34 of a complete schema). The harness discards wrangler's output, so the cause is invisible. The path also costs about 20 s. `tests/lib/migrate.mjs` applies one concatenated SQL file in a single wrangler call (about 2 s; 5 of 5 trials clean on the same machine, 34 tables) and keeps wrangler's error text if it ever fails. The smoke suites use it and start the Worker with `startWorker({ fresh: false, state })`. The integrator should make `freshDatabase` do the same, so other suites (UI, non-functional) do not inherit the flake. This was seen on one machine under load with a handful of trials; the cause was not isolated further than "separate processes" and may not occur on a faster runner.

## Sensitivity: the local checks fail when the build is wrong

Run on 3 October 2026 with `SAHA_SMOKE_VARS` (same build; first on an earlier version of the suite, then again on the final one with the same counts):

- `{"SAHA_DEMONSTRATION_PACKAGE":"manual"}` (package not installed): 19 pass, 9 fail, 1 skipped; the failures include "the demonstration clinical package installed itself" (0 entries), the clinical review, the confirmation and every later step that needs a protocol ("No current protocol covers this person and care role"), the audit and supervisor checks, and the GET sweep.
- `{"SAHA_ENVIRONMENT":"training"}`: 18 pass, 10 fail, 1 skipped, the first failure being "the deployment is synthetic". Both runs exit 1.

## Results

All on 3 October 2026, commit of this slice on top of base `daa1e40b` (slice 11a), built with `npm run build` on the same day, Node 22.22.2, through the shared queue on a 2-core machine that other agents were also using.

**Local smoke** (`node tests/smoke/local-smoke.mjs`, port 8811)

| Run | Passed | Failed | Skipped | Total time | Of which migration / Worker start |
| --- | --- | --- | --- | --- | --- |
| 1 | 28 | 0 | 1 (`GET /api/media/[id]`) | 6.9 s | 1.6 s / 1.7 s |
| 2 | 28 | 0 | 1 | 6.7 s | 1.5 s / 1.7 s |
| 3 | 28 | 0 | 1 | 6.8 s | 1.5 s / 1.7 s |
| 4 (last, after the final edit of the suite) | 28 | 0 | 1 | 6.9 s | not recorded |
| earlier build of the same suite, 3 runs | 28 | 0 | 1 | 8.6, 9.3, 8.7 s | 1.9–2.2 s / 2.1–2.4 s |

Seven of seven runs passed with identical results; the sweep of the 40 GET routes (route, path, status, milliseconds) is in each report. The brief expected about 25 s for a migrated Worker start; it is about 3.5 s here because the migrations are applied in one call. On a slower or busier runner expect more; the suite's own 90-second check is the limit.

**Hosted smoke against the real site** (`node tests/smoke/hosted-smoke.mjs`): seven timed runs (and two earlier manual ones), every one **NOT EXECUTED**, exit code 2, 0.4–0.5 s: the egress gateway of this machine answered 403 `host_not_allowed` (above). No check ran against `saha-staging.nakul17.workers.dev`; there is no hosted pass or fail to report. The service-token tier was not run either: no credentials exist and none were created.

**Hosted smoke self-test** (`--self-test`, stand-in edge in front of the built Worker, ports 8812 to 8814)

| Run | Self-test checks passed | Failed | Total time |
| --- | --- | --- | --- |
| 1 | 8 | 0 | 7.1 s |
| 2 | 8 | 0 | 7.2 s |
| 3 | 8 | 0 | 7.2 s |
| 4 | 8 | 0 | 7.0 s |
| 5 (last, after the final edit of the suite) | 8 | 0 | 7.1 s |

The eight self-test checks are the scenarios in the table above. Per scenario, the hosted checks gave: deployed shape without a token 9 passed, 0 failed, 6 skipped; with a service token 12 passed, 0 failed, 3 skipped; token Access does not admit 9 passed, 3 failed; Access missing but app in `cloudflare-access` mode 7 passed, 2 failed (the two "held by Access" checks); dispatcher identity exposed 4 passed, 5 failed (the forged-header, garbage-JWT and Access checks); accepted-identity branch 13 passed, 0 failed; unreachable and gateway denial NOT EXECUTED.

**Failures on the way (defects in my own test code, fixed before the runs above):** the stand-in edge reused a closed keep-alive connection between scenarios ("other side closed"; fixed with `Connection: close`); and the first leak detector treated the title, then `schemaVersion`, as application data, but even the app's own "Sign-in required" page carries both (the second in the platform's artifact metadata inside the page's data), so it flagged a clean page. The detector now looks for JSON workspace keys in JSON and the workspace shell's footer text in HTML. A probe on a Worker in `cloudflare-access` mode confirmed that an anonymous or forged-header page request gets the 200 "Sign-in required" page with `Cache-Control: no-store, must-revalidate`, and `/api/workspace` gets 401 with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

**Documentation checks:** `node scripts/audit-requirements.mjs --check` passes. `python3 scripts/check-documentation.py` reports one line, "Changed baseline file: .gitignore", which comes from the base commit of slice 11a (it added `/tests/reports/` to `.gitignore`), not from this slice.

## What this proves and what it does not

Proves, for the commit it ran on:

- The built Worker starts on a fresh migrated database and the paths a new organisation takes work end to end, with the response contents asserted, not just status codes: sign-in refusal, home organisation and automatic demonstration package, invitations, assignment scope, a visit from first save through the urgent danger-sign finding, patient check, approved plan, simulated destinations and receipts, supervisor reach, cross-organisation refusal, and no 5xx or unhandled error across every GET route.
- Both suites can fail: the local suite fails under two altered configurations, and the hosted suite's self-test fails on a site that trusts forged dispatcher identity.

Does not prove:

- Any of the 176 formal acceptance criteria, any of the 364 test cases in `TEST-CATALOGUE.csv` (all remain "Not run"), clinical correctness (the demonstration protocols are not clinically approved) or readiness for real patient use.
- Anything about the hosted site. The hosted smoke was **not executed** against it. When it is, it will show only that the front door is closed and forged identities are refused; the app's signed-in behaviour on Cloudflare is not reachable by it, because the app refuses a service token.
- That the Access redirect has the exact shape the checks assume (a 3xx to `/cdn-cgi/access/…` on the team domain for the page and the API is what the deploy workflow's own check already requires; a 401 or 403 is accepted for the command and for forged requests). The first real run may need a one-line adjustment; it would then say what Access actually returned.
- Behaviour in a browser, accessibility, performance or load (other slices of round 11), or the scheduled job and providers (off).

## Not verified, and notes for the integrator

- Wire the hosted smoke after the deploy step with the hosted URL (`SAHA_HOSTED_URL`) and treat exit 2 as "could not check", not as a pass. Without the two repository secrets the service-token tier is skipped; with them it records what the app returns for the token (expected 401). The secrets are named `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`; nothing in this slice reads or stores them anywhere else, and the suite never prints them.
- The hosted smoke's fast path is about 15 requests in parallel to one host; it is safe to run on every deploy.
- `tests/lib/worker.mjs` should adopt `migrateOnce` (above).
- The documentation index and test strategy are not updated here (shared documents belong to the integrator).
