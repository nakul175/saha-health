# O-2: native reverse-reference boundary

5 October 2026. This follow-up preserves the evidence-only `fbf1e5cc` batch. Production source, identity, scope, audit, migrations, dependencies and runtime flags remain unchanged. O-2 remains open; no runtime workaround is shipped.

## Bounded actual request lifetime controls

`scripts/diagnose-memory-native-owners.mjs` runs two fresh local processes with the pinned Miniflare/workerd and unchanged compatibility configuration. Each performs 500 requests at concurrency four, with no inspector, snapshots, forced collection or malloc logging. Three fixed samples spread across the address-ordered live DeleteQueue allocations are inspected using Apple's `leaks --traceTree=<address> --noContent --nostacks`. Sample ordering does not establish allocation age or isolate identity. Only sanitized type/root descriptions are retained; addresses and allocation content are not exported.

The first process runs the normal authenticated Saha workspace with six assigned synthetic patients. Every response is fully consumed by the client. The second runs an inline Worker with no Saha/framework modules and no module-held request array or cache. Its request-local array submits an actual D1 batch of 23 fixed reads, returning 250 synthetic text rows in its first query and no rows in the others. The awaited D1 SDK call completes before the response returns; the outside client consumes the complete response. Fixture insertion is setup-only; no per-request database write or expanding table is present. This matches the actual D1 batch transport/response lifetime, not the application's complete query mix, payload or isolate count.

| Final repeated observation | Workspace | Fully consumed D1 control |
| --- | ---: | ---: |
| Successful responses | 500 | 500 |
| Native DeleteQueue proxies | 3,156 | 2,007 |
| Whole owned-process RSS, MiB | 354.2 | 112.9 |
| Durable workspace read audits | 500 | Not applicable |
| Durable workspace metric count | 500 | Not applicable |

The earlier symbol-filtered run also completed 500+500 requests (3,201/2,004 proxies). It is preserved as `initial-symbol-only-traces.json`. The repeat retains the complete sanitized hierarchy instead of selected symbols and verifies the application's durable rows. Neither run claims a plateau or statistical ranking.

## References beyond creation stacks

The complete traces contain direct native paths from DeleteQueue into opaque `ThenCatchPair` promise callbacks associated with `IoContext::awaitJs`, `IoOwn<SpanParent>` trace wrappers, request Fetcher/ExecutionContext objects, and managed memory regions. App-Specific Tag 16 pages appear in all six sampled trees; `cppgc::internal::NormalPageSpace` appears in three. The same wrapper/page patterns occur in the database-only control, so they do not require an application-level retained patient array, Saha audit write, or framework cache.

These are conservative reverse references, not a complete garbage-collector liveness graph. Some branches point far inside a large native heap page or through runtime/allocator tables; treating those tables as process roots can make collectable page objects appear live. The prior receiver-specific snapshot experiment reclaimed almost all proxies, consistent with this distinction. No sampled trace directly named `IoCrossContextExecutor`; the executor remains a source-grounded candidate, not a newly measured exact owner.

The [pinned Wrappable definition](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/jsg/wrappable.h) describes JS wrappers retaining C++ objects until collection and the separate strong-reference/CppgcShim mechanism. The [pinned Fetcher definition](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/api/http.h) distinguishes request-bound I/O clients from cross-context factories. Together with the actual wrapper/page references and [receiver attribution](MEMORY-RECEIVER-ATTRIBUTION.md), this places the next retaining-boundary investigation inside the native/V8 wrapper lifecycle and external-memory accounting. It does not establish a specific missing accounting call or rule out every application allocation. Apple's [heap analysis guidance](https://developer.apple.com/videos/play/wwdc2024/10173/) explains the limits of native type/reference discovery.

## Precise local upstream boundary and next work

The inline control is an executable reproduction outside application/framework code: build the current source for the unchanged configuration, then run the manual script with Node in PATH. It starts its own synthetic fixed database and local-only service, consumes every response, and reports both actual application and reduced D1 cases. There is no external endpoint or provider activation. Its accumulating request wrappers remain a local runtime/SDK receiver-lifetime issue candidate. The prior temporary September 30 binary comparison did not fix memory, so no upgrade is recommended from this evidence.

A next decisive runtime investigation needs collector-aware ownership/strong-reference counts for the identified opaque callback/trace wrappers, including their receiver isolate and external-memory accounting after request completion. Generic native roots cannot distinguish collector-managed garbage from genuinely reachable objects. Application-side source review should continue only where a retained module reference or uncompleted body/promise is grounded; the current reduced reproduction excludes those Saha mechanisms as necessary causes of this proxy accumulation. Disabling read audits, lowering workload, restarting processes, forcing collection or tuning heap limits remains unacceptable as a software fix.

Evidence: `tests/evidence/memory-native-ownership/`. Validation: two completed 500+500 actual request studies, actual audit/metric counts in the final workspace run, bounded no-content reverse scans, runner syntax and whitespace checks. No source rebuild was needed after the prior unchanged-source successful build. Raw dumps, databases and generated bundles are excluded from git; all child runtimes stopped. Hosted isolate qualification and representative production scale remain pending.
