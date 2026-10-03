# Development slice 11d — non-functional tests: security, performance, memory and bounded load

3 October 2026 (IST). Round 11, built by one agent from the round's base commit (`daa1e40b`, slice 11a in progress). Five suites under `tests/nfr/` that run the built Worker locally with synthetic data, and a defect they found in the sign-in code. No person has reviewed this slice. These suites are executable evidence for some non-functional requirements; they are not acceptance runs. **No formal acceptance case (TC-*) is promoted by this slice**; all 176 stay pending.

## Findings

**Security.** The authorisation matrix found no authorisation defect. Every invariant held on every run: 336 requests (42 GET requests × 8 principals), then the same grid again with an identical hash (`1c7a27c900fa4ff0`), on the pre-fix and the final build. Section "Authorisation matrix" below lists what was and was not asserted.

**D-1 — the Cloudflare Access sign-in cannot work on Cloudflare Workers (found by the identity suite, fixed in one line, four related calls left).** `lib/saha/identity.ts` fetched the Access signing keys with `redirect: 'error'`. The Workers runtime (workerd, here run in Miniflare) refuses that mode with `TypeError: Invalid redirect value, must be one of "follow" or "manual"`. The error was caught and turned into "no principal", so every properly signed Access token was refused 401 and nobody could sign in under `SAHA_IDENTITY_PROVIDER=cloudflare-access`. It failed closed, so it is an availability defect, not a leak. It was invisible to the unit contract (`tests/identity-contract.mjs` injects a `fetch` that accepts the option) and to `wrangler dev` (the key endpoint is unreachable there either way); it shows only when a signed token meets a local key endpoint inside the real runtime. Before the change, 7 of the identity suite's checks failed with 401 and the key endpoint was never called (the run of 03:03 UTC); after it, a properly signed token is accepted, a new key id is accepted after one key refresh, and every wrong token is still refused.
- **Fix in this slice (one line, its own commit so it can be reviewed or dropped on its own):** `lib/saha/identity.ts` now passes `redirect: 'manual'`. A redirect then comes back as an unfollowed 3xx, which the next line (`if (!response.ok) throw`) refuses, so a redirect is still never followed or trusted. `tests/identity-contract.mjs` still passes (18 checks).
- **Not fixed, open:** the same option is passed by four other Worker-side calls: `lib/saha/mis.ts` (programme delivery requests), `agent-provider.ts` (AI provider), `ehr-provider.ts` (EHR retrieval) and `server.ts` (`externalCall`). Each would throw before sending once its provider is enabled. Providers are off, so nothing is affected today. Their contract tests (`tests/mis-contract.mjs`, `agent-contract.mjs`, `ehr-contract.mjs`) assert `redirect: 'error'` on an injected `fetch`, so changing the four needs those tests changed too; that is more than a one-line change and is left for a fix slice. The identity suite carries a check named `OPEN FINDING D-1` that **fails** while any of them remains, so the suite is expected to report one failed check until then. How each of those four calls handles the thrown error (for example whether an MIS send is then recorded as an uncertain outcome) was not exercised.

**O-1 — a read can be refused under contention (availability, fails closed, not a security defect).** Under eight concurrent clients on one organisation a read was sometimes answered `503 Saha could not record this access in the audit log, so it was stopped: nothing was shown or sent. Try again.` The message is the documented fail-closed refusal of slice 6t: reads record an audit event in the organisation's hash chain first, and a write that loses the chain race six times gives up (`CHAIN_ATTEMPTS`, `lib/saha/store.ts`). It happened in 2 of 8 burst runs, once each, in about 290 reads (load-burst results below). The reason was not captured when it happened: the suite now records the Worker's log of failed audit writes, and none occurred in the later runs, so exhaustion of the six chain attempts is the likely cause but is not confirmed. Nothing was shown in a refused read and a retry succeeded every time. It matters for NFR-10 (fail closed is required) and for the field experience (a busy organisation sees occasional "try again" on reads, and writes that give up after six chain attempts answer 409). The suite splits the "no 5xx" invariant accordingly: any other 5xx fails; this refusal is counted, must carry no patient data, must succeed on retry, and must stay at or below 5 % of reads.

**O-2 — Worker memory grew for every workspace load measured and no run showed it settle (not a pass, not proven a leak).** The local Worker's resident memory went from about 199 MB to about 583 MB over 3,000 loads and to 726 MB over 8,000 (results in the memory section below). The growth is anonymous memory (heap and native allocations), not the local database or mapped files. Growth per load fell after the first thousand loads (about 250 KB, then roughly 20 to 100 KB, with some rounds near zero and one of 103 KB), which is also what a heap growing in steps looks like, so a leak is neither shown nor ruled out. Whether the hosted Worker would stay under Cloudflare's 128 MB isolate limit was not measured.

**O-4 — a workspace load got slower as the organisation's audit log grew.** In every memory run the time for 1,000 loads rose round by round, from 21.5 s to 37.4 s over 8,000 loads (+74 %), while the local database grew by about 0.9 KB per load (each load records one audit event). Whether the cost is in the load itself or in the larger heap was not investigated.

**O-3 — smaller observations, not asserted.** The FHIR download (`app/api/fhir/[id]/route.ts`) sends `Cache-Control: no-store` and an attachment disposition but no `X-Content-Type-Options: nosniff`; the JSON helper and the other download routes found by reading the source set it (the suite asserts `no-store` on every API response, not `nosniff`). Some routes validate the request body before identity, so a malformed anonymous body gets 422 rather than 401 (a well-formed anonymous request gets 401); `POST /api/mis/callback` answers an unsigned anonymous call 422 because it authenticates by signature, not by sign-in. Command responses carry the whole updated workspace snapshot (about 310–350 KB for the owner at 209 patients, `bytes` in the performance table), which matters on a field network (NFR-02) and was not measured for an ASHA. `GET /api/data-exit` returned 2.25 MB at 209 patients, so it grows with the organisation.

## The suites

| Suite | File | What it runs | Ports |
|---|---|---|---|
| Authorisation matrix | `tests/nfr/authorisation-matrix.mjs` | built Worker under `wrangler dev` | 8831 (`SAHA_TEST_PORT`) |
| Identity hardening | `tests/nfr/identity-hardening.mjs` | `wrangler dev` (Sites and Access providers) and Miniflare with a local key endpoint | 8832 and 8833 (`SAHA_TEST_PORT`, `SAHA_TEST_PORT2`) |
| Performance budgets | `tests/nfr/performance-budgets.mjs` | `wrangler dev` | 8831 |
| Memory growth | `tests/nfr/memory-growth.mjs` | Miniflare, no inspector | 8834 |
| Load burst | `tests/nfr/load-burst.mjs` | `wrangler dev` | 8832 |

Helpers added for them, all under `tests/lib/`: `nfr-world.mjs` builds the seeded organisation (owner, admin, supervisor, two ASHAs, a clinician, a stranger with their own organisation); `miniflare.mjs` starts the built bundle (`dist/server`) in Miniflare with the Worker running ahead of the static assets, an optional outbound service, process-memory readers and `startInline` for probing the runtime itself. They use the slice 11a harness (`tests/lib/worker.mjs`, `tests/lib/report.mjs`) unchanged. Reports go to `tests/reports/<suite>-result.json` (not tracked). Run one suite at a time; they build real databases under `.wrangler/`.

### Authorisation matrix

**Tests.** One organisation, seven principals plus anonymous. Every GET route in `docs/current/HTTP-ROUTES.csv` (40 routes; 42 requests because `/api/rights` and `/api/governance` are asked with and without a patient or visit) is requested as every principal, with the parameters the route readers document (the suite fails on an unclassified route, so a new route cannot slip past). It then sends the non-GET routes anonymously, a record-opened, name-search, patient-match and media (upload, read, delete) round for the roles in and out of scope, and 27 commands across patient, organisation, owner-only, import and identity families as every role. It prints the route × role matrix and the command × role matrix (see Results).

**Invariants asserted** (each one a check): (i) no 5xx for any principal; (ii) anonymous gets 401 on every API route (the signature-authenticated MIS callback must refuse with a 4xx); (iii) the stranger gets 403 on every route when it names this organisation and no response carries the organisation's id, name, patients, visits, media or members; (iv) ASHA 1 asking for ASHA 2's patient, visit or media gets 403 or 404, and on every route neither ASHA ever receives the other's names or ids; (v) the admin never receives a patient name and gets 403 or 404 on every route that names a patient, visit or media item; (vi) no response carries an invitation token or its stored hash (searched by value for every principal); (vii) every API response is `Cache-Control: no-store`; (viii) suspending a member stops every GET route and commands on the next request, and access returns on reactivation. Controls make the refusals mean something: the owner gets 2xx everywhere, and ASHA 2 gets 200 on every route that names ASHA 2's patient, so ASHA 1's refusal is a scope refusal, not a malformed request. Also asserted: the code-defined refusal reason for each command (for example "Only organisation owners can manage membership and teams"), that a stranger cannot reuse the owner's idempotency key, and that an `x-saha-organisation` header naming another organisation never lends authority.

**Proves.** On this build, the implemented read routes and the sampled commands enforce organisation, role and assignment scope on the server for these seven principals, and a body-level search for synthetic names finds nothing outside scope. The grid is reproducible: the status grid has a hash and it was identical on every run.

**Does not prove.** Anything about the roles not in the world (provider, delegates, emergency access, a supervisor with delegation); purpose, programme, facility or geography boundaries beyond team and assignment; all 211 command names (27 are sent) or the POST routes beyond those listed; hidden-screen or client-side behaviour; backups, indexes, retrieval stores and asynchronous tasks (BR-SEC-06 names them); that the roles' grants in the grid (the supervisor reading visit media, for example) are what the role catalogue intends: the grid records them and the controls assert the owner and the patient's own ASHA, but a reviewer has to read the supervisor, clinician and admin columns against the design. A leak of an unnamed derived value (a count, a village) would not be found by the name and id search. It is not an independent security assessment.

### Identity hardening

**Tests.** Part A, default provider (Sites headers): a principal id beginning `fixture:` cannot sign in even when it is a real demonstration fixture member (workspace, patient list and a command, 401), the bare prefix and made-up prefixed ids are refused while an id that only contains the prefix is ordinary, partial or empty identity headers are refused, a stray Access token is not an identity. Part B, `SAHA_IDENTITY_PROVIDER=cloudflare-access` with team and audience configured, on `wrangler dev`: Sites headers are ignored, and a missing, empty, malformed (seven shapes) or unverifiable `Cf-Access-Jwt-Assertion` is refused. Part C, the same provider in Miniflare with a local key endpoint standing in for Cloudflare (an outbound service serving a locally generated RSA key): a properly signed token is accepted and authorises a command (positive controls), keys are cached, and every wrong token is refused 401 with no workspace data: wrong key, tampered payload, `alg: none`, HS256 confusion, expired, not yet valid, wrong audience, wrong issuer, missing or empty subject, missing or malformed email, missing expiry, unknown key id; the token is honoured only in `Cf-Access-Jwt-Assertion` (not Authorization or the `CF_Authorization` cookie); a valid token with Sites headers naming someone else signs in as the token's subject; a token whose subject starts `fixture:` becomes `access:fixture:…`, which is no fixture member; key rotation is accepted after one refresh; a failing key endpoint refuses unknown keys while a cached key still verifies; refused requests create no account. Part D, a misconfigured provider (no team or audience, a team outside `cloudflareaccess.com`, an unknown provider name) answers 503 to valid Sites headers and to a signed token, never falling back. Plus the runtime premise and source guard of D-1.

**Proves.** The real `lib/saha/identity.ts`, inside the built Worker and the real runtime, trusts only the selected provider and verifies signature, key id, algorithm, issuer, audience, expiry and claims, and fails closed. It found D-1.

**Does not prove.** A real Cloudflare Access application, its identity providers, second factors for privileged roles (BR-ID-03) or federation (BR-ID-10); the real key endpoint (the local one serves one key); hosted behaviour; session lifetime beyond the token's expiry; that only `fixture:` is reserved (open finding L3 of slice 10k: ids such as `system` are not refused). The positive path is only as real as the stand-in key endpoint.

### Performance budgets

**Tests.** About 200 seeded patients (imported through the controlled import in batches of 100, plus nine from the world) and 33 confirmed visits; 30 sequential requests (after 3 warm-up requests) for each main GET route as the owner and, for the workspace, as ASHA, supervisor and admin; and for each common command: create person, start visit, save visit, confirm visit, create referral, an idempotent replay, a 100-row import dry run and a name search. p50, p95 and maximum are recorded for each. Budgets: reads p95 ≤ 1,500 ms, commands p95 ≤ 2,500 ms, owner workspace ≤ 4 MB. Every request must succeed. The workspace response size is recorded in raw and gzipped bytes.

**Proves.** On a local Worker with a local D1, the measured routes and commands are far inside the budgets (see Results) and none failed.

**Does not prove.** The numbers come from a local `wrangler dev` Worker (workerd) with a local D1 on a 2-core machine shared with other jobs. They are **not Cloudflare numbers** and say nothing about production latency, cold starts, D1 round trips from the edge or concurrent users. The budgets are deliberately generous and only guard against a large regression; they are not service levels. p95 of 30 samples is the second-slowest request, a noisy statistic on a shared machine (the owner workspace p95 was 89 ms in one run and 45 ms in the next). NFR-02 is not shown: it needs the reference Android device, the reference network, at least 1,000 timings and failed-request and slow-outlier reporting; this suite times the server only.

### Memory growth

**Tests.** The built Worker in Miniflare with no inspector (the local `wrangler dev` keeps request data for its inspector and grows about 270 KB per load, slice 10k, which would hide the Worker's own behaviour). Rounds of 1,000 owner workspace loads at concurrency 4 after 100 warm-up loads; after each round the resident memory of this instance's workerd processes (found by parent process id, never by name) is read from `/proc` as the median of three samples, split into anonymous memory, file-backed memory and the local database's size on disk. The suite reports the growth per load by round and says "levels off" only if the last round grew by 10 KB per load or less. It fails only if the last round grows by more than 150 KB per load, so a large new leak is caught.

**Proves.** The growth per load, how it splits, and that 3,000 loads all succeed.

**Does not prove.** Cloudflare's 128 MB isolate limit has not been measured and a local workerd process is not a Cloudflare isolate. RSS is noisy and V8 collects garbage when it needs to, so a growing resident size is not by itself a leak; equally, a suite that ends without a failure cannot prove there is none. One identity, one route, a six-patient organisation. The 150 KB per load threshold is a catch for a large leak, not a statement that lower growth is acceptable: the measured growth was below it and still unsettled.

### Load burst

**Tests.** Eight concurrent clients (two owners, two clinicians, two ASHAs, a supervisor, an admin), each making 50 mixed slots: reads of the workspace, patient and work lists, audit, operations and alerts; registrations; visit lifecycles (start, save, confirm); Idempotency-Key replays (the same key and body must return the first result with `replayed: true`; the same key with a changed body must be 409); and races (the same key sent twice at once must create one person). A 409 is retried up to six times with the same key.

**Invariants asserted.** No unhandled 5xx (a 503 is allowed only as the documented audit fail-closed refusal of a read, see O-1); the Worker logs no unexpected failure; every replay and race behaves as above; no lost command (every registration the clients were told succeeded exists); no duplicated command; no phantom command (a registration that was never acknowledged is absent); final counts equal the initial counts plus what the clients were told (patients and confirmed visits); the supervisor and clinician see the same patients as the owner, and the admin sees none; the Worker still serves a workspace and a new command afterwards.

**Proves.** On one local Worker instance and one local D1, a burst of eight clients on one organisation loses and duplicates nothing and leaves a consistent state, and idempotent replay holds under concurrency.

**Does not prove.** Capacity, sustained load, many Worker instances or the Cloudflare edge; D1 behaviour under load (a local SQLite is not Cloudflare D1); latency under load (recorded with ceilings that only catch a hang). It is not NFR-05's 10,000-event soak on connector fixtures (slice 7d). The workload registers new patients at a rate that makes organisation-wide commits frequent, which is why many writes need a retry.

## Requirement mapping

None of these promotes an assessment or a formal case; the "related cases" are the A (acceptance) and B (adverse condition) cases of `docs/current/TEST-CATALOGUE.csv` (designed in `docs/reference/07_Test-Strategy_v1.0.md`), all still **Not run**. Requirement statements are those of `requirements/brd-v1.1.json`; the assessments in `requirements/assessment.tsv` are unchanged.

| Requirement | Suite | What the suite adds | What it does not show | Related cases |
|---|---|---|---|---|
| BR-ID-02 Scoped permissions | authorisation matrix | negative tests across every GET route and 27 commands for seven principals; manipulated requests (another patient's id, another organisation's header, a reused idempotency key) do not widen access | purpose, programme, facility and geography scopes; hidden-screen manipulation; every command; delegation and provider roles | TC-BR-ID-02-A, -B |
| BR-SEC-06 Tenant and record isolation | authorisation matrix | cross-tenant and wrong-record reference tests on routes, search, patient matching and media return denial with no content found | backups, indexes, retrieval stores and asynchronous tasks; adversarial testing by someone independent | TC-BR-SEC-06-A, -B |
| BR-ID-03 Authentication and recovery | identity hardening | the Access token verifier in the real runtime; fixture ids cannot sign in; no fallback between providers | second factor, recovery and device replacement; the real Access application and key endpoint | TC-BR-ID-03-A, -B |
| NFR-02 Responsive field interface | performance budgets | server-side p50 and p95 for the main routes and commands, response sizes | the reference device and network, 1,000 or more timings, slow-outlier reporting under R1 load, any browser timing | TC-NFR-02-A, -B |
| NFR-05 Duplicate-safe execution | load burst | replay and race behaviour of Saha's own command path under concurrency | connector fixtures and the 10,000-event soak (slice 7d); hosted D1 | TC-NFR-05-A, -B |
| NFR-08 Security release posture | authorisation matrix, identity hardening | repeatable local negative tests; they found D-1 | independent assessment (the requirement); mobile storage, secrets, file access, agent tool abuse | TC-NFR-08-A, -B |
| NFR-09 Online revocation | authorisation matrix (check viii) | suspension stops every GET route and commands on the next request; the measured delay is in Results | background jobs, other devices and sessions, hosted behaviour, the offline window (the residual window the requirement says to record) | TC-NFR-09-A, -B |
| NFR-10 Audit completeness and timing | load burst | audited reads fail closed under contention and nothing is shown (O-1) | audit-store failure on every designated action, recovery order and clock skew, hosted D1 faults | TC-NFR-10-A, -B |
| NFR-24 Scale readiness | performance budgets, memory growth | local numbers at about 200 patients and the memory behaviour | scale: 209 patients in one organisation say nothing about 10,000 workers and 5 million records; the requirement is a separate R2 capacity and cost review on a production-like topology | TC-NFR-24-A, -B |

BR-SEC-08 (audit evidence) is touched only by the O-1 behaviour; the suites do not reconstruct an encounter from the audit log. NFR-28 (interoperability performance) is not covered here.

## Running

```
npm run build                                   # the suites run the built bundle in dist/
node tests/nfr/authorisation-matrix.mjs
node tests/nfr/identity-hardening.mjs
node tests/nfr/performance-budgets.mjs
node tests/nfr/memory-growth.mjs
node tests/nfr/load-burst.mjs
```

Each exits non-zero on a failed check and writes `tests/reports/<suite>-result.json`. On the shared build machine every one runs through the heavy queue (`bash /tmp/claude-0/par/heavy.sh c node tests/nfr/<suite>.mjs`). Environment: `SAHA_TEST_PORT` and `SAHA_TEST_PORT2` change the ports; `SAHA_NFR_PEOPLE` (default 200) sets the seeded patients for the performance suite; `SAHA_NFR_LOADS` (default 1000), `SAHA_NFR_ROUNDS` (default 3) and `SAHA_NFR_CONCURRENCY` (default 4) shape the memory suite. Memory needs `/proc` (Linux) and otherwise reports a skip with that reason. The identity suite is expected to report one failed check (`OPEN FINDING D-1`) until the four remaining `redirect: 'error'` calls are changed.

## Results

Real runs of 3 October 2026 (the reports carry UTC timestamps, 02:58 to 03:35), one suite at a time through the heavy queue (lane c) on the shared 2-core build machine, on the build of the final tree (`npm run build` at 03:13, after the one-line identity change). "Suite time" is the suite's own duration from its report; "wall" is the whole `time` of the queued command, which includes starting the Worker and waiting for the queue's lock, so it is longer and varies with what other agents were running.

| Suite | Result on the final build | Suite time | Wall under the queue |
|---|---|---|---|
| Authorisation matrix, run 1 | 51 passed, 0 failed, 0 skipped | 46 s | 2m14.004s |
| Authorisation matrix, run 2 | 51 passed, 0 failed, 0 skipped; grid hash identical to run 1 | 45 s | 1m26.669s |
| Identity hardening | 28 passed, 1 failed, 0 skipped; the one failure is `OPEN FINDING D-1`, on purpose | 54 s | 1m52.000s |
| Performance budgets | 145 passed (94 assertions and 51 recorded measurements without a budget), 0 failed, 0 skipped | 85 s | 2m6.920s |
| Memory growth, 3 rounds | 14 passed (4 assertions), 0 failed, 0 skipped; growth does not level off (see below) | 95 s | 1m35.593s |
| Load burst (three runs on the final script) | 15 passed, 0 failed, 0 skipped in each | 41 s, 41 s, 42 s | 2m13.208s, 5m1.566s, 2m21.974s |

Earlier runs of the same suites are reported where they matter (findings, stability); every run is listed below or in the findings. Counts of "passed" include measurements recorded without a budget, because the shared report library counts each as a passing check; the number of real assertions is given next to them where it matters.

### Results: authorisation matrix

Four runs, all 51 passed, 0 failed, 0 skipped, with the same grid hash `1c7a27c900fa4ff0` (336 requests = 42 requests × 8 principals): two on the build before the identity change (02:59 and 03:04 UTC, suite time 57 s and 62 s) and two on the final build (03:17 and 03:19). Delay from an acknowledged suspension to the first denied request (NFR-09 allows 5 minutes): 34, 14, 15 and 21 ms, because membership is read on every request; the budget in the suite is 300,000 ms.

GET route × role, status codes (final run 1; `anon` is no sign-in, `strngr` is the other organisation's member who sends this organisation's id):

```
request                                anon  owner  admin  super  asha1  asha2   clin strngr
/api/abdm?personId=<id>                 401    200    403    200    403    200    200    403
/api/action-plan?personId=<id>          401    200    403    200    403    200    200    403
/api/aggregate-reports                  401    200    403    200    403    403    403    403
/api/alerts                             401    200    200    200    200    200    200    403
/api/audit/chain                        401    200    200    403    403    403    403    403
/api/audit                              401    200    200    200    200    200    200    403
/api/caseload                           401    200    403    200    200    200    200    403
/api/continuity                         401    200    403    200    200    200    200    403
/api/data-exit                          401    200    403    403    403    403    403    403
/api/delegations                        401    200    200    200    200    200    200    403
/api/environment                        401    200    403    403    403    403    403    403
/api/exceptional                        401    200    403    200    200    200    200    403
/api/exceptions                         401    200    200    200    403    403    403    403
/api/expansion                          401    200    200    403    403    403    403    403
/api/fhir/<id>?organisationId=<org>     401    200    403    200    403    200    200    403
/api/fixture-migration                  401    200    403    403    403    403    403    403
/api/governance                         401    200    200    200    200    200    200    403
/api/governance?visitId=<id>            401    200    403    200    403    200    200    403
/api/history?personId=<id>              401    200    403    200    403    200    200    403
/api/household?personId=<id>            401    200    403    200    403    200    200    403
/api/identity-cases?personId=<id>       401    200    403    200    403    200    200    403
/api/incentive-claims                   401    200    403    200    200    200    403    403
/api/indicators                         401    200    403    200    403    403    403    403
/api/media/<id>?organisationId=<org>    401    200    403    200    403    200    200    403
/api/notification-channel               401    200    403    403    403    403    403    403
/api/operations                         401    200    200    200    403    403    403    403
/api/outreach                           401    200    200    200    200    200    200    403
/api/pack-installations                 401    200    403    403    403    403    200    403
/api/patients/detail?personId=<id>      401    200    404    200    404    200    200    403
/api/patients                           401    200    200    200    200    200    200    403
/api/pilot                              401    200    200    200    200    200    200    403
/api/programme-migration                401    200    403    403    403    403    200    403
/api/provider-sandbox                   401    200    200    200    200    200    200    403
/api/referral-escalations               401    200    403    200    200    200    200    403
/api/referral-requests                  401    200    403    200    403    403    200    403
/api/retention                          401    200    403    403    403    403    403    403
/api/rights                             401    200    403    200    200    200    200    403
/api/rights?personId=<id>               401    200    403    200    403    200    200    403
/api/trace?visit=<id>                   401    200    404    200    404    200    200    403
/api/worker-activity                    401    200    403    200    403    403    403    403
/api/worklists                          401    200    200    200    200    200    200    403
/api/workspace                          401    200    200    200    200    200    200    403
grid hash 1c7a27c900fa4ff0 (42 requests x 8 principals = 336)
```

Reading the grid: ASHA 1 is refused (403) on every route that names ASHA 2's patient, visit or media item, and ASHA 2 is served (200) on them. The admin is refused on every route that names a patient and gets 404 on the patient detail and trace routes, and the stranger is refused 403 on every route. The supervisor, clinician and admin columns were not asserted route by route against the role catalogue.

POST, DELETE and the anonymous requests (every one 401 except the signature-authenticated MIS callback, which refuses an unsigned call with 422):

```
POST   /api/commands               401  {"error":"Sign in to use your workspace."}
POST   /api/identifier-search      401  {"error":"Sign in to use your workspace."}
POST   /api/import-rejections      401  {"error":"Sign in to use your workspace."}
POST   /api/indicators             401  {"error":"Sign in to use your workspace."}
DELETE /api/media/[id]             401  {"error":"Sign in to use your workspace."}
POST   /api/media                  401  {"error":"Sign in to use your workspace."}
POST   /api/mis/callback           422  {"error":"Invalid callback contract."}
POST   /api/patient-import         401  {"error":"Sign in to use your workspace."}
POST   /api/patient-matches        401  {"error":"Sign in to use your workspace."}
POST   /api/patients               401  {"error":"Sign in to use your workspace."}
POST   /api/record-import          401  {"error":"Sign in to use your workspace."}
POST   /api/record-opened          401  {"error":"Sign in to use your workspace."}
POST   /api/roster                 401  {"error":"Sign in to use your workspace."}
POST   /api/workforce-import       401  {"error":"Sign in to use your workspace."}
```

Commands by role (status; the refusal text for each role is asserted, the owner's 404, 409 and 422 on the owner-only commands are validation or state answers because the suite does not build their configuration):

```
command                                         owner  admin  super  asha1  asha2   clin strngr
startVisit                                        200    403    403    403    200    200    403
setConsent                                        200    403    403    403    200    200    403
correctIdentity                                   200    403    403    403    200    200    403
createPerson                                      200    403    403    200    200    200    403
assignPatient                                     200    403    200    403    403    403    403
createReferral                                    200    403    403    403    200    200    403
createTeam                                        200    403    403    403    403    403    403
createInvite                                      200    403    403    403    403    403    403
revokeInvite                                      200    403    403    403    403    403    403
updateMember                                      200    403    403    403    403    403    403
renameOrganisation                                200    403    403    403    403    403    403
removeMember                                      200    403    403    403    403    403    403
opsRates                                          200    403    403    403    403    403    403
opsMaintenance                                    200    403    403    403    403    403    403
opsBudget                                         404    403    403    403    403    403    403
opsInvoiceReconcile                               422    403    403    403    403    403    403
configureEhr                                      422    403    403    403    403    403    403
probeEhr                                          422    403    403    403    403    403    403
activateEhr                                       422    403    403    403    403    403    403
setEhrLookupPolicy                                422    403    403    403    403    403    403
activateMis                                       422    403    403    403    403    403    403
testMis                                           422    403    403    403    403    403    403
setAdapterOperations                              422    403    403    403    403    403    403
enableAgentContract                               409    403    403    403    403    403    403
patientImportApply                                409    403    409    403    403    403    403
joinOrganisation (unknown token)                  404    404    404    404    404    404    404
switchOrganisation (to this organisation)         200    200    200    200    200    200    403
```

### Results: identity hardening

Final run (03:17 UTC): 28 passed, 1 failed, 0 skipped, suite time 54 s. The failure is `OPEN FINDING D-1` (the four remaining `redirect: 'error'` calls), and it is the only one. The run before it (27 passed, 2 failed) also failed a check that expected no accounts other than the sign-ins, which wrongly counted the demonstration fixture accounts the organisation creates; that check was corrected. Before the one-line change, in the run at 03:03 UTC, 7 Part C checks failed with 401: a properly signed token was refused, the key endpoint was never called, and a probe of the runtime itself showed the `TypeError` for redirect mode `error`. (The first Miniflare run, at 02:56 UTC, failed 17 checks for a different reason: the test's Miniflare helper let the static-assets router answer `/api/*` with 404; that was a test bug and was fixed.)

### Results: performance budgets

Final run (03:21 UTC): 145 passed, 0 failed, 0 skipped; two runs in all (the first at 02:58 UTC also 145 passed). Seeding: seeded 209 patients and 33 confirmed visits in 7329 ms; workspace as owner: 293027 bytes (25546 gzip), 209 people, 33 visits; workspace as asha1: 129557 bytes (11821 gzip), 31 people, 31 visits; workspace as admin: 39904 bytes (9455 gzip), 0 people, 0 visits. Budgets: reads p95 ≤ 1,500 ms, commands p95 ≤ 2,500 ms, owner workspace ≤ 4 MB; the slowest p95 anywhere was 159 ms (`/api/data-exit`, 2.25 MB), against 400 ms for the same route in the first run, so this machine's noise is of the same size as the differences between routes. Local `wrangler dev` Worker and local D1, 30 sequential requests per row after 3 warm-up requests, 2-core machine shared with other jobs: **not Cloudflare numbers and not service levels**. The `bytes` column is the largest response body in bytes.

```
measurement                                              p50    p95    max   bytes
GET /api/workspace as owner                               36     45     60   274871
GET /api/workspace as asha1                               26     45     65   115505
GET /api/workspace as supervisor                          37     57     62   273181
GET /api/workspace as admin                               24     29     34    20698
GET /api/patients as owner                                18     28     60    15025
GET /api/patients as asha1                                17     33     49     9826
GET /api/patients/detail?personId=<id> as owner           22     52     65    46198
GET /api/worklists?view=work as owner                     17     27     66    12086
GET /api/worklists?view=work as asha1                     16     67     69     7702
GET /api/worklists?view=followups as owner                17     21     26       68
GET /api/worklists?view=submissions as owner              18     28     56       82
GET /api/worklists?view=referrals as owner                18     22     25       58
GET /api/history?personId=<id> as owner                   26     33     38    15276
GET /api/action-plan?personId=<id> as owner               15     25     39     1222
GET /api/household?personId=<id> as owner                 14     20     74       18
GET /api/rights?personId=<id> as owner                    13     25     27      651
GET /api/identity-cases?personId=<id> as owner            13     17     21      367
GET /api/trace?visit=<id> as owner                        23     31     37      446
GET /api/governance?visitId=<id> as owner                 21     30     31    14234
GET /api/fhir/<id>?organisationId=<org> as asha1          22     27     31     4172
GET /api/audit as owner                                   22     28     28    45231
GET /api/audit/chain as owner                             46     76     77      367
GET /api/operations as owner                              28     33     41     6253
GET /api/indicators as owner                              23     85    100    19663
GET /api/caseload as owner                                21     32     35     2105
GET /api/continuity as owner                              21     26     31    25760
GET /api/referral-requests as owner                       20     32     37      244
GET /api/referral-escalations as owner                    21     26     33      280
GET /api/exceptions as owner                              21     32     33      236
GET /api/outreach as owner                                20     33     35    48830
GET /api/pilot as owner                                   20     28     38     5120
GET /api/delegations as owner                             20     25     30      882
GET /api/alerts as owner                                  13     58     83      420
GET /api/aggregate-reports as owner                       23     30     33     1306
GET /api/incentive-claims as owner                        20     23     24     1586
GET /api/worker-activity as owner                         23     30     76    10316
GET /api/provider-sandbox as owner                        21     25     32      425
GET /api/data-exit as owner                              139    159    198  2250162
POST createPerson (owner)                                 69    120    181   308390
POST startVisit (owner)                                   53     69     72   317134
POST saveVisit (owner)                                    56     79    125   332871
POST confirmVisit (owner)                                 55     98    104   339356
POST createReferral (owner)                               57     77     91   350978
POST replay of a saved command (same Idempotency-Key)     45     70     92   351106
POST /api/patient-import dry run, 100 rows (owner)        43     55     63     6700
POST /api/patients search by name (owner)                 18     22     89    15086
```

Workspace response size for the owner at 209 patients and 33 visits: 293,027 bytes raw, 25,546 bytes gzipped (an ASHA with 31 people: 129,557 raw; the admin, no patients: 39,904).

### Results: memory growth

Growth of the Worker's resident memory per workspace load, by round of 1,000 loads (after 100 warm-up loads), in KB per load. In every run the growth is anonymous memory (heap and native allocations): file-backed growth was 0.0 to 0.7 KB per load, and the local database grew by about 0.9 KB per load (5.4 MB to 7.2 MB over three rounds, 11.5 MB over eight), so the audit rows each load writes are not what grows the process.

| Run | KB per load by round | RSS MB (after warm-up to end) | Seconds per 1,000 loads (round 1 to last) |
|---|---|---|---|
| 3 rounds, 4 clients (final script, 03:33) | 271.28, 68.5, 54.21 | 198.3 to 583.1 | 20.8 to 25.3 |
| 3 rounds, 4 clients (first script, 03:23) | 248.22, 80.37, 67.73 | 198.8 to 585.9 | 21.6 to 25.6 |
| 3 rounds, 1 client (03:31) | 226.94, 95.77, 37.45 | 189.7 to 541.4 | 22.2 to 26.9 |
| 3 rounds, 1 client (03:35) | 239.14, 93.51, 14.01 | 189.6 to 528.1 | 22.7 to 27.1 |
| 8 rounds, 4 clients (03:28) | 251.26, 76.04, 67.51, 24.23, -4.29, 14.1, 8.25, 103.18 | 198.6 to 726.2 | 21.5 to 37.4 |

(An earlier run of the first script, before the memory split was added, measured 246.6, 97.6 and 60.6 KB per load from 192.6 to 587.9 MB.) Reading it: the first thousand loads grow the process by about 230 to 270 KB per load; then growth falls, and in the eight-round run rounds 4 to 7 grew 24, -4, 14 and 8 KB per load before round 8 grew 103 KB per load (625 to 726 MB). That is the shape of a heap that grows in steps, but this slice **cannot say it levels off**: no run showed a settled plateau, the last round of the longest run was the second-largest, and total growth over 8,000 loads was 527 MB (199 to 726 MB). The suite's verdict in every run was that growth was slowing but had not levelled off. The 128 MB isolate limit of Cloudflare Workers was not measured and a local workerd process is not an isolate, so this says nothing yet about the hosted Worker; a Worker that kept even 50 KB per request would reach 128 MB after a few thousand requests in one isolate, if the same growth applied there, which was not tested. The threshold the suite enforces (150 KB per load in the last round) was not exceeded in any run, and a single round can exceed it by a heap step (round 8 reached 103). A quick scan of module-level maps in `lib/saha` found only constant tables, the Access key cache and a per-organisation alert map; the cause was not investigated.

The time for 1,000 loads rose steadily with the number of loads in every run (21.5 s in round 1 to 37.4 s in round 8, +74 %, while the audit table grew by about 0.9 KB per load): a workspace load gets slower as the organisation's audit log accumulates, or as the heap grows; the cause was not investigated.

### Results: load burst

Eight runs in all as the suite and the findings changed. The first (02:56 UTC) stopped a client at the audit refusal described in the findings (507 calls, statuses 200: 421, 409: 85, 503: 1; 11 passed, 2 failed). The seven below followed; the last three (a, b, c) ran the final script. Statuses are for the whole burst; `409` are conflicts the clients retried with the same Idempotency-Key.

| Run | Result | HTTP calls | Statuses | p50 / p95 / max ms | Reads refused for audit (of reads) | Writes still 409 after six attempts |
|---|---|---|---|---|---|---|
| 1 (03:15) | 14 passed, 0 failed (one registration was not acknowledged; that script version did not record its status, and the suite checked it is absent from the final state) | 565 | {200: 453, 409: 111, 503: 1} | 199 / 344 / 465 | 1 of 298 | not counted |
| 2 (03:18) | 13 passed, 1 failed (a `saveVisit` stayed 409 after six attempts and the old script stopped the client) | 536 | {200: 438, 409: 98} | 178 / 335 / 482 | 0 of 290 | not counted |
| 3 (03:20) | 14 passed, 0 failed | 545 | {200: 454, 409: 91} | 184 / 338 / 414 | 0 of 298 | not counted |
| 4 (03:22) | 14 passed, 0 failed | 551 | {200: 454, 409: 97} | 191 / 341 / 497 | 0 of 298 | not counted |
| a (03:24) | 15 passed, 0 failed | 551 | {200: 454, 409: 97} | 175 / 317 / 404 | 0 of 298 | 0 |
| b (03:29) | 15 passed, 0 failed | 552 | {200: 454, 409: 98} | 178 / 343 / 460 | 0 of 298 | 0 |
| c (03:31) | 15 passed, 0 failed | 565 | {200: 454, 409: 111} | 190 / 316 / 425 | 0 of 298 | 0 |

In all eight runs, including the two that stopped a client early, the data checks held: the acknowledged registrations (57 to 60) all exist exactly once in the final state, no unacknowledged registration exists, replays returned the first result with `replayed: true`, a changed body under the same key was 409, racing pairs created one person, final patient and confirmed-visit counts matched what the clients were told, and the Worker was healthy afterwards. A read was refused for audit in 2 of 8 runs (the 02:56 run and run 1; 1 of about 290 reads each time). A write ended without success after six attempts in 2 of the first 5 runs (run 1, one registration; run 2, one `saveVisit`) and in none of the three runs on the final script, which counts them. Nothing in these runs says what rate a different workload or a hosted D1 would see.


## Limits

- One agent built the slice; no person has reviewed it. Any suite is only as good as its assertions: the matrix and identity suites assert specific refusals and absences, the performance and memory suites assert generous ceilings, and a recorded measurement without a budget is recorded as passing (the shared report library counts it as a passed check), so the pass counts below include those: the counts of real assertions are given beside them.
- Local runs only. Nothing was run against the hosted staging Worker, Cloudflare D1 or a real Access application, and no identity header was sent to the hosted site.
- Synthetic data throughout; the suites create their own organisations and delete nothing.
