# O-2 bounded runtime and database controls

5 October 2026. O-2 remains open. No production code, dependency, audit policy, process recycling or regression/plateau threshold was changed.

After the earlier all-isolate profile showed stable reachable classes after snapshot-induced collection, these controls narrow which request work amplifies local resident memory without attaching an inspector. Each fresh process handled 100 warm-up requests and two rounds of 200 at concurrency four, followed by twenty seconds with no requests, sampled every five seconds. Every one of 2,000 requests returned 200. Samples identify only the diagnostic's own workerd descendant by process ancestry. No snapshots, explicit collection, hosted traffic or patient data were used.

Built application source: `0df447cc`; macOS arm64, Node 24.19.0, Miniflare 4.20260515.0/workerd 1.20260515.1. The inline cases use the same installed runtime and compatibility configuration; they have fewer isolates and less work than the framework/application case, so their byte-per-request figures are not interchangeable.

| Fresh process / request work | Warm RSS MiB | After 400 more requests | After 20s idle |
| --- | ---: | ---: | ---: |
| Inline `Response('ok')` | 43.47 | 53.50 | 53.55 |
| Inline 1,000 transient Request/header constructors, no network | 60.55 | 67.56 | 67.61 |
| Inline D1 batch of 23 read queries, 250 fixed synthetic text rows | 87.44 | 118.69 | 118.66 |
| Actual authenticated Saha workspace, six synthetic patients, actual chained read audit/metrics | 182.97 | 361.78 | 361.77 |

The D1 control has no Saha/framework code, no per-request database writes and a fixed table. The request-constructor fixture deliberately creates a request-scoped array, returns only its length, and retains no application reference. Neither control grows to the application's magnitude under this bounded workload. Natural twenty-second idle does not reclaim the final resident size in any case. These observations do not reproduce a universal request-wrapper leak, do not prove that the application retains objects, and do not establish a plateau.

The passive OS VM summary after application idle reports 285.0 MiB physical footprint (291.4 MiB peak), 218.1 MiB dirty in App-Specific Tag 16 regions, and 87.7 MiB malloc-zone dirty bytes with 68.2 MiB allocated. The fixed D1 control's physical footprint is 72.6 MiB. VM category names do not identify JS/C++ retaining paths; RSS and physical footprint measure different things and cannot be subtracted to calculate native heap. The prior snapshots changed collection cadence and cannot count as a fix for these no-inspector observations.

[Upstream workerd issue 6824](https://github.com/cloudflare/workerd/issues/6824), checked 5 October, is an open third-party report describing standalone collection cadence under a larger allocation workload. It is a comparison hypothesis, not a Cloudflare-confirmed diagnosis of Saha. Its idle recovery was not observed in this shorter bounded experiment; this does not falsify its larger stress reproducer. [Cloudflare's memory profiling guidance](https://developers.cloudflare.com/workers/observability/dev-tools/memory-usage/) describes local heap inspection separately from production isolate limits.

The useful next comparison is the same actual Saha route with only the access-audit persistence suppressed in an isolated diagnostic build, preserving authentication, patient scope, response minimisation and all other request work. A second matched diagnostic can separate metric writes. These variants must never be published, deployed or used as an application fix. That will distinguish audit-chain/write allocation from read/D1 bridging and framework execution before changing dependencies or clinical code. Retained-object/native-stack profiling remains necessary if live allocation continues to grow.

Evidence: `tests/evidence/memory-controls/result.json` and four passive VM summaries. Reusable manual harness: `scripts/diagnose-memory-controls.mjs` (requires a normal build and Node in PATH; fixed 500 requests per case; local synthetic storage; no release-gate classification). It reuses the existing process sampler/Miniflare harness. The final reusable wrapper is syntax checked; the measured cases were executed individually with the same helpers and fixtures. It is outside `tests/` and needs no test-catalogue entry. The existing no-inspector memory-growth regression and its thresholds remain unchanged. Hosted isolate limits, larger populations, physical Android and formal acceptance remain unqualified.
