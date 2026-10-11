# Testing links: Linear, Playwright and k6

11 October 2026. Additive reporting tooling, isolated from application development. No paid test-management service, new credential, provider or hosted runtime is introduced.

## Ownership and process

Linear owns product stories, tasks, scenarios, defects and readable execution summaries. GitHub owns runner source and durable raw evidence. Playwright runs browser checks; k6 runs explicitly approved synthetic workloads. Existing application unit/backend runners stay intact. This tool does not replace or relax their gates.

Flow: Linear story and criteria → explicit scenario/test linkage → real runner on pinned source and environment → immutable native report and attachments → linked report and Linear execution record → failure/fix/retest, or separate review/required UAT → qualified merge → observed hosting/live verification → story completion.

The canonical registry is [scenario-links.json](../../scripts/testing-links/scenario-links.json), bound to the [Linear scenario register](https://linear.app/aplyd-sandbox/document/saha-deduplicated-test-scenario-register-7159549fc966). Its 459 entries retain 364 formal-case identities and 95 proposed contracts. Owning task links are context, not proven executed coverage. An unannotated test is explicitly unmapped. Unknown scenario IDs fail reporting. None of the 459 entries is automatically marked automated, passed or accepted.

## Actual connection

- [Playwright reporter](../../scripts/testing-links/playwright-reporter.mjs): use a `scenario` test annotation containing an exact registry ID. Record all attempts, actual result, expected status, retries, errors, attachments, owner/task links and immutable run identity. A pass on retry is flaky and fails this reporting gate; earlier failures remain.
- [k6 importer](../../scripts/testing-links/import-k6.mjs): imports real `handleSummary` JSON and explicit scenario metadata. Retains native metrics and exact threshold expressions/outcomes. Missing counts, zero execution, missing thresholds or unknown IDs cannot generate a pass.
- [Linear summary generator](../../scripts/testing-links/linear-summary.mjs): turns a linked JSON report into a readable run entry. The existing authorized Linear connector publishes it and verifies readback; the generator does not secretly save it or request a new API key. Deduplicate publication by run ID.
- [Bounded integration runner](../../scripts/testing-links/run-bridge.mjs): runs actual browser reporting, unknown-ID refusal, adapter/retry guards and 20 local k6 requests. Its two canonical IDs indicate scenario context only. This artificial reporting fixture does not execute or pass either full product case.

```sh
node scripts/testing-links/run-bridge.mjs /absolute/path/to/NEW-evidence /absolute/path/to/k6
```

Requires the existing pinned Playwright dependencies/Chromium and free k6 v2.3.0. For an existing application Playwright config, add the reporter with explicit `metadata` and new `output` paths. Metadata requires a unique run ID, exact 40-character tested SHA, environment and scope. For actual k6 application runs, retain the original workload, authenticated synthetic setup, scenarios, budgets and thresholds; do not substitute this 20-request transport demonstration for the existing 400-slot or reference performance gates.

## GitHub evidence and publication

[Opt-in workflow](../../.github/workflows/testing-links.yml) uploads the raw bridge reports, traces, logs and generated summaries as `linked-testing-evidence`. It is manual-only, never deploys and uses existing Actions infrastructure. It does not weaken mandatory CI. No hosted execution or automatic Linear webhook is claimed. Until GitHub account startup is resolved and the workflow actually runs, hosted artifact links remain absent. The agent may run locally and publish observed summaries through the existing connector.

Each Linear run records: run ID; tool/version; tested commit and source binding; environment; start/end; original case and task IDs; execution scope; separate case/assertion/request/threshold counts; pass/fail/skipped/flaky/incomplete outcomes; raw evidence location/hash; defects; and review/acceptance boundary. Running a test never changes a story or parent status automatically. Human UAT and domain approval remain separately required where applicable.

## Verified local reporting qualification

Final actual runtime code: `a71cac36` (full SHA in the retained receipt). Local integration observed: one Playwright case passed; 20 k6 checks passed across 20 requests with two VUs; both k6 thresholds passed. Eleven k6 adapter boundaries and five reporter boundaries passed. The deliberate unknown-ID browser control exited 1 and reported `invalid_mapping`; it is a successful refusal control, not a product failure. All outputs are labelled `bridge_smoke_not_product_acceptance`.

Original source catalogue, formal case statuses and regression minima are unchanged. No full application NFR, UAT, final engineering CI, story delivery, merge or hosting is granted. Raw bridge evidence and source hashes are in [testing-links evidence](testing-links-evidence/manifest.json). Browser trace archives remain in the local run output until the opt-in hosted workflow uploads them.
