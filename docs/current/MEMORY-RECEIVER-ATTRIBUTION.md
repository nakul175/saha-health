# O-2: receiver attribution and matched runtime comparison

5 October 2026. Source `e89cf6b7`, macOS arm64, Node 24.19.0, Miniflare 4.20260515.0. O-2 remains open. No application, audit, identity, compatibility date, lockfile, dependency or memory threshold changed. No safe runtime upgrade or application fix is established by this batch.

## Where the native request graphs accumulate

The unchanged built workspace served six assigned synthetic patients with normal trusted identity, read audits and request metrics. A no-inspector reference completed 500 requests with RSS 182.1 MiB after warm-up, 350.9 MiB after the final load and no material twenty-second idle recovery. SQL verified exactly 500 workspace audit events and a workspace metric count of 500.

Two additional fresh processes each served 500 requests, exposing a loopback inspector solely for diagnostic attribution. After the load, snapshots were taken one isolate at a time; each snapshot induces collection. Passive `heap --addresses=workerd::DeleteQueue --noContent` scans counted native request-graph proxies before and after each snapshot. Only aggregate counts and safe class summaries were exported, never raw snapshots or native addresses. Snapshotting is not a fix or a plateau test.

| Collection step | User-first process: remaining DeleteQueue count | D1-first process: remaining count |
| --- | ---: | ---: |
| Before any snapshot | 3,212 | 3,164 |
| User isolate only, collected first | 2,850 | — |
| Actual D1 storage receiver | 832 | 1,198 |
| D1 proxy receiver | 832 | 1,198 |
| User isolate, collected after both D1 receivers | — | 838 |
| Assets router | 227 | 227 |
| Assets RPC proxy | 116 | 116 |
| Core entry | 1 | 1 |

The D1 storage isolate reclaimed 2,018 proxies after the user snapshot and 1,966 when collected first. This replicated order comparison identifies the local D1 receiver as the principal owner of these accumulated native graph proxies; it does not attribute every resident byte to them. Collecting the D1 proxy reduced RSS without changing the proxy count, so DeleteQueue alone does not describe all allocations. After all isolate snapshots, RSS remained 258.5/258.9 MiB, versus 355.2/351.0 MiB before collection. All three actual workspace runs retained their complete durable audit/metric counts; both attribution processes ended with one proxy.

A separate 100-request process used Apple's `MallocStackLogging=lite`, with no inspector or snapshots. Five sampled live DeleteQueue allocations yielded symbolized native creation stacks through `IoContext::IoContext`, `WorkerService::startSubrequest` and `Fetcher::getClientWithTracing`; tracing/microtask execution appears in these paths. All samples were 384-byte allocations. Only native symbol frames with addresses redacted were saved. These are allocation sites, not a reverse ownership graph or proof that a particular trace object is the retaining root. The [Apple allocation guidance](https://developer.apple.com/videos/play/wwdc2022/10106/) explicitly distinguishes allocation logging from memory ownership analysis.

The [exact pinned runtime source](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/io/io-context.c%2B%2B) installs a promise-context tag holding an opaque executor with an added DeleteQueue reference. The measured creation sites and receiver-specific reclamation support investigating that native-wrapper/collection lifecycle. [Upstream issue 6894](https://github.com/cloudflare/workerd/issues/6894), still open when checked, describes analogous receiver-isolate behavior. This is a grounded comparison, not proof that its single proposed cause explains all Saha allocations. A complete retaining path through the opaque native/V8 ownership boundary is still missing.

## A newer runtime did not repair the symptom

The candidate was exactly `@cloudflare/workerd-darwin-arm64@1.20260930.1`, downloaded into a temporary folder; its npm tarball SHA-512 integrity was verified and binary SHA-256 recorded. The [September 30 release](https://github.com/cloudflare/workerd/releases/tag/v1.20260930.1) includes a V8 update and heap diagnostics. The pinned Miniflare's [official runtime implementation](https://github.com/cloudflare/workers-sdk/blob/miniflare@4.20260515.0/packages/miniflare/src/runtime/index.ts) explicitly selects `MINIFLARE_WORKERD_PATH`; the experiment used that override without editing installed packages or production dependencies.

Each fresh arm used the same bundle hash, compatibility date `2026-05-15`, flags, framework, Miniflare, six-patient fixture, trusted identity and actual route. Each completed 100 warm-up plus four rounds of 1,000 loads at concurrency four, with no inspector, snapshots, forced collection or heap flags. Passive native scans were applied equally after each round. Processes were never restarted within an arm. SQL verified 4,100 workspace audit rows and metric counts in each database.

| Phase | Pinned May 15 RSS MiB / proxy count | Candidate Sep 30 RSS MiB / proxy count |
| --- | ---: | ---: |
| Warm 100 | 182.2 / 2,107 | 208.6 / 2,209 |
| Total 1,100 | 447.2 / 7,912 | 664.6 / 23,640 |
| Total 2,100 | 506.0 / 8,602 | 764.6 / 44,843 |
| Total 3,100 | 534.0 / 7,765 | 835.8 / 43,194 |
| Total 4,100 | 572.1 / 11,387 | 851.8 / 45,696 |
| Idle twenty seconds | 572.1 / 11,387 | 851.8 / 45,696 |

Both arms showed some natural graph reclamation, but neither a sustained plateau nor idle reclamation. Growth per load in the four rounds was 271.28/60.256/28.656/39.072 KiB for the pinned runtime and 466.944/102.384/72.896/16.416 KiB for the candidate. The three post-first-round means exceed the existing 10 KiB plateau criterion. A separate candidate 500-request smoke also retained all audits/metrics, but does not add a second sustained comparison.

The candidate accepted the unchanged application/configuration under this bounded experiment; that is not qualification of the full supported Wrangler/Miniflare dependency set, security behavior, all routes or hosted isolates. It finished substantially higher, so there is no basis to ship it as the O-2 repair. One sustained pair on a shared development machine cannot rank every release or establish statistical significance. The application source and published runtime remain unchanged.

## Evidence and remaining work

Manual harnesses: `scripts/diagnose-memory-receivers.mjs` (fixed user-first/D1-first attribution), `scripts/diagnose-memory-runtime-comparison.mjs` (explicit temporary candidate path), and `scripts/diagnose-memory-native-stacks.mjs` (bounded symbol-only creation stacks). Evidence is under `tests/evidence/memory-receiver-attribution/`. All processes completed and stopped. The initial comparison-runner export-path mistake occurred before any Worker workload and is retained separately; selecting the documented default binary export repaired the harness without changing checks.

Validation: 10,300 successful actual workspace loads across reference, candidate smoke, two attribution runs, sustained arms and stack run; exact durable counts verified for all except the separately bounded stack-only run. Three harness syntax checks, source build and whitespace check pass. Manual diagnostics are outside the release test catalogue and do not change acceptance status.

Next isolate the opaque executor/async-context wrapper retaining boundary or a verified upstream accounting fix using runtime-level ownership tooling. Application-side batching can reduce allocation pressure but cannot by itself certify release of receiver garbage. No audit omission, forced collection, memory-limit increase, process recycling or reduced scope is an acceptable application repair. Hosted isolate limits, representative patient/ledger scales and formal acceptance remain pending.
