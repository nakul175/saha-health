# O-2 completed receiver lifetimes: bounded controls

5 October 2026. Source `f3cdbdc27d02b73d485637b40dcb6ddb620906bf`. O-2/B35 remains open. No application, scope, identity, audit, receipt, migration, dependency, runtime or production configuration changed. These are manual diagnostics, not release qualification.

The earlier 10,300 successful workspace requests, receiver-isolate snapshots, native reverse references and two-runtime experiment are retained unchanged. They establish collectable receiver-side native graphs as a grounded investigation target; they do not establish a bounded plateau, complete native accounting or a deployable fix. The September runtime arm was worse in that experiment and is not proposed as an upgrade.

## New question and controls

Does residency require returned patient-like data, many SQL statements, or SQLite itself? `scripts/diagnose-memory-d1-lifetimes.mjs` uses fresh pinned Miniflare/workerd processes, 100 warm-up requests then two rounds of 250 at concurrency four, followed by ten seconds idle. No inspector, heap scans, snapshots, forced collection, malloc tracing, runtime overrides, restarts within an arm or per-request writes. Every HTTP body is fully consumed and its fixed count checked. Each D1 call is awaited and its successful results checked. The D1 fixture remains exactly 250 rows/113,750 text bytes after each arm. The local allocation arm builds, serializes and parses the same 250-row content each request, then returns only its count. The service arm performs 23 awaited service-binding fetches per request and consumes each `ok` response; it has no SQL, D1, framework or application.

All arms use the current production compatibility date `2026-05-15` and flags `nodejs_compat`, `global_fetch_strictly_public`. The environment manifest records Node24.19.0, Miniflare4.20260515.0, actual workerd binary version/SHA256, macOS arm64 and the successful fresh build. Data is synthetic fixed text. No external host receives a request; the synthetic service URL is resolved by its local binding.

| First pass, 600 requests each | Warm RSS KiB | After600 | Idle10s | Warm-to600 growth |
| --- | ---: | ---: | ---: | ---: |
| Local250-row JSON allocation, noD1 | 50,800 | 57,344 | 57,392 | 6,544 |
| One empty statement in one D1 batch | 78,112 | 100,624 | 100,592 | 22,512 |
| 23 empty statements in one D1 batch | 83,488 | 108,528 | 108,496 | 25,040 |
| 23 statements in one batch, first returns250rows | 85,248 | 116,816 | 116,784 | 31,568 |
| 23 separate awaited empty D1 calls | 121,088 | 212,688 | 212,672 | 91,600 |

A fresh reverse-order repeat preserves the distinction: 23 separate empty calls grew123,456→211,648KiB (idle211,584); 23 empty statements in one batch grew81,904→108,144 (idle108,112). The additional no-SQL two-Worker service arm grew71,792→152,160KiB (idle unchanged). Its600 requests completed13,800 fully consumed receiver subrequests. Across both invocations4,800 requests succeeded with the expected bodies, without retry. All owned processes were disposed after measurement; there is no in-arm restart.

This is a controlled counterexample to explanations requiring returned clinical data, per-request audit writes, the application framework, SQLite, or an application patient cache. It supports request/receiver-context volume as a material contributor. It does not prove that all application residency has the same root, that objects remain semantically reachable, or that a specific opaque native field is responsible. Different isolate topology and response work prevent byte-for-byte comparison of the local, D1 and service arms. RSS is process residency, not hosted isolate live memory. These short shared-machine controls do not establish a linear long-term slope or plateau.

## Current application reference

The freshly built unchanged current source also ran the existing authenticated workspace diagnostic: 500/500 HTTP200, clinician identity, six assigned synthetic patients, constant17,012-byte response; SQL verified exactly500 durable `viewWorkspace` rows and500 workspace metric counts, six patients and zero visits. Cold/warm/300/500 RSS was78,976/186,864/313,280/361,328KiB; idle20s361,312. A passive OS summary followed the idle window. This verifies the current workload retains the earlier symptom with actual security/audit work intact; it is not a directly matched performance comparison to the older16,642-byte response. Combined new diagnostics total5,300 successful requests, including this500-load application reference. No threshold has been changed.

Targeted source inspection found `readState` already executes its material table queries in a single awaited D1 batch; its maps/results are function-local. The server accesses the Cloudflare runtime binding rather than storing patient snapshots in a module cache. The inspected identity module holds a JWKS cache keyed by trusted configured team domain, not returned patient rows; its keys and claim checks remain intact. Vinext's request-context ALS/cache structures remain a separate framework inspection boundary, but their presence cannot explain the new no-framework/no-D1 service witness. Static inspection is not a whole-application retaining-root proof.

## Safe action and runtime boundary

Keep batched reads and their transaction/scope semantics. Replacing a batch with23 separate `.all()` calls increases context work in both repeats and would weaken snapshot semantics; it is not a repair. Suppressing security audit, changing authority checks, caching stale patient state, adding artificial heap pressure, forcing GC or restarting workers would hide or alter the problem and is not proposed.

Pinned Miniflare's runtime launch arguments and option types were inspected. Its generated Cap'nProto `Config.v8Flags` field is not evidence of a supported public Miniflare memory-control option. The installed pinned package has no `MINIFLARE_WORKERD_V8_FLAGS` handling. No safe production memory/GC setting was established. The later [SDK flags PR](https://github.com/cloudflare/workers-sdk/pull/14702) explicitly describes a mitigation lever rather than an underlying fix; it is not justification to silently replace dependencies or claim native receiver collection is repaired.

The open upstream [receiver-subrequest report](https://github.com/cloudflare/workerd/issues/6894) describes uncollected native receiver wrappers and suggests accounting/collection changes. That report is analogous evidence, not a confirmed causal diagnosis for every Saha allocation. The existing [standalone collection report](https://github.com/cloudflare/workerd/issues/6824) also remains open. Rechecked official pages5October; no resolution claim is made.

The next concrete investigation is collector-aware tracing of completed receiver `IoContext` promise-context/trace wrappers and their external-memory accounting, using a symbol-rich compatible runtime build or an upstream instrumented fix in a separate explicit local experiment. Compare natural collection under this small service-only reproducer first, then the current audited workspace; preserve lifetime completion, exact durable counts and no forced collection. The prior shipped-binary type lookup lacked usable private class layout, so guessed offsets are inappropriate. No upstream message or issue was sent. No application source fix is warranted by these measurements alone; bounded per-organisation/request memory, hosted load/denominators, sustained recovery, Android and formal acceptance remain unqualified.

Evidence: `tests/evidence/memory-d1-lifetimes/` (first pass, reverse-order/service pass, current application, environment and integrity manifest). Run commands and results are pinned in the manifest. New driver syntax-check and fresh application build pass; no full regression run is claimed for this diagnostic-only batch.
