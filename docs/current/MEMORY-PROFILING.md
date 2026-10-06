# O-2 local workerd memory investigation

5 October 2026 (IST), source `eb5136ac`, macOS arm64, Node 24.19.0, Miniflare 4.20260515.0 / workerd 1.20260515.1. O-2 remains open. No production code or regression/plateau threshold changed.

The new diagnostic starts the same built Worker and migrations directly in Miniflare. A matched reference has no inspector. A second run exposes a loopback inspector, enumerates all 11 actual isolates, measures their V8/embedder heap usage, and summarizes reachable object classes from snapshots. It also measures only its own workerd descendant's RSS and captures that same process's macOS VM summary. Raw snapshots and patient values are not exported; evidence contains aggregate classes/counts/bytes only. It does not enable the inspector Network domain or use Wrangler's request-data proxy.

Both runs performed 100 warm-up loads and two rounds of 1,000 workspace loads at concurrency four, plus the initial load. All 4,202 responses returned 200. Reference RSS was 184.2, 451.7 and 526.4 MiB after warm-up and each round. This confirms the existing symptom under the current integration.

| Instrumented phase | Own process RSS, MiB | Sum of isolate JS used heap, MiB |
| --- | ---: | ---: |
| Warm, before snapshots | 184.9 | 50.1 |
| Warm, after all-isolate snapshots | 220.7 | 16.3 |
| After 1,000 more loads | 521.8 | 116.6 |
| After 2,000 more loads | 603.9 | 106.8 |
| After final all-isolate snapshots | 340.2 | 16.6 |

Across the two snapshot sets, aggregate node count fell from 1,640,146 to 1,634,732; snapshot self-bytes changed from 19,672,504 to 20,076,820. User-isolate self-bytes changed from 11,546,064 to 11,939,004, principally code/string warm-up, while ordinary Object, Array and closure counts stayed unchanged. Its native `CppgcShim` count stayed at 45. The actual D1 object's self-bytes changed from 212,048 to 211,708; the D1 proxy increased by 9,364 bytes. These observations do not identify a patient-record JavaScript retention leak responsible for hundreds of MiB of RSS.

Snapshotting triggers collection ([Chrome heap snapshot documentation](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)). It reduced used JS heap by about 90 MiB and process RSS by about 264 MiB after the final load. The remaining difference is not an exact native-byte calculation: RSS includes other runtime/native/allocator/mapped regions, and snapshotting itself allocates memory. The same process's `vmmap` reported a final physical footprint of 62.6 MiB against a 385.9 MiB peak. Physical footprint and RSS are distinct OS measures. Explicit `HeapProfiler.collectGarbage` commands failed to acknowledge within ten seconds on every target and did not produce an immediate observed collection; this is recorded as failure to acknowledge, never as successful GC. Actual snapshot commands succeeded on all targets.

The evidence supports collectable request allocation and collection cadence, plus runtime/native resident regions, as the principal local symptom. It does not prove a particular native allocation stack. [Upstream workerd issue 6824](https://github.com/cloudflare/workerd/issues/6824) reports a similar standalone-runtime unified-GC cadence problem; that report is a hypothesis for comparison, not a diagnosis established for Saha. [Cloudflare's profiling guidance](https://developers.cloudflare.com/workers/observability/dev-tools/memory-usage/) also distinguishes local reproduction and application heap inspection.

The durable ledger grew as designed. Both isolated databases contained exactly 2,101 `viewWorkspace` audit rows and six patients, with no visits. Logical audit text was 535 bytes per load, excluding numeric fields, indices and SQLite overhead. Reference on-disk state grew by approximately 1.08 KiB per load over the two measured rounds, including database/WAL files. That durable growth is different from retained application heap. This fixture does not qualify large-patient or connector-ledger scale.

## Reproduction and next action

Build the source, then run `tests/nfr/memory-profile.mjs` and `tests/nfr/memory-profile-ledger.mjs`. The diagnostic restricts loads to 100–3,000 per round and rounds to 1–5; defaults are the measured two rounds of 1,000. Use isolated ports when other suites run. Evidence: `tests/evidence/memory-profile/result.json`, `ledger-analysis.json`, and `vmmap-summary.txt`. The existing no-inspector `tests/nfr/memory-growth.mjs` remains the regression and plateau check. The unchanged process-ownership sampler passed its six actual-child-process checks, and the explicit inspector binding was verified at `127.0.0.1`.

Next, compare a newer supported workerd/Miniflare runtime in an isolated dependency experiment and repeat the same no-inspector workload and all-isolate snapshot measurements. If high private memory persists after collection, capture native allocation stacks; if reachable class counts grow, capture retaining paths for those classes. Repeat representative patient/ledger scales and hosted isolate qualification separately before closing O-2. Forced GC, process recycling, an inspector or a relaxed threshold must not be shipped as an application fix from this evidence.

Limits: one synthetic identity, one route, six patients, short bounded local run; profiler/snapshots alter allocation and GC cadence. No hosted load, external provider, Android memory qualification or formal acceptance claim.
