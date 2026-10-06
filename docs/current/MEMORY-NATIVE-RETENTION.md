# O-2: passive native request-graph evidence

O-2 remains open. This batch identifies native runtime allocations accumulating alongside RSS, without an inspector or forced collection. It does not establish a plateau, attribute bytes to an isolate, or prove that all Saha memory growth has an upstream cause.

## Exact runtime and upstream research

The installed packages and `pnpm-lock.yaml` agree: workerd **1.20260515.1**, Miniflare **4.20260515.0**, Wrangler **4.92.0**. No dependency, compatibility date, production source, audit policy, or regression threshold changed.

[Upstream issue 6894](https://github.com/cloudflare/workerd/issues/6894) remains open as checked on 2026-10-05, with no linked fix. Its independent two-worker reproduction describes native request graphs retained in receiver isolates whose small JS heaps do not trigger collection. It uses `DeleteQueue` allocation counts as a proxy and reports reclamation after receiver-isolate snapshots. This is relevant to Miniflare's cross-worker D1 traffic, but its July runtime and workload differ from Saha.

[Issue 6824](https://github.com/cloudflare/workerd/issues/6824) is also open and concerns standalone collection scheduling under sustained load. It is a report, not proof that Saha has precisely the same failure mode. The newer [merged Miniflare PR 14702](https://github.com/cloudflare/workers-sdk/pull/14702) adds a V8 flag configuration interface; it does not fix retention. Neither raising memory limits nor changing collection flags is proposed here. The [recent workerd release list](https://github.com/cloudflare/workerd/releases) and [September 30 release](https://github.com/cloudflare/workerd/releases/tag/v1.20260930.1) include heap debug support and a V8 update; no verified standalone natural-collection fix was identified. This was a targeted search, not an exhaustive audit of every intervening commit.

The [exact pinned io-context source](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/io/io-context.c%2B%2B) creates a `DeleteQueue` per context and holds a reference through an opaque promise-context executor (lines 137–151 and 1427–1432). It also creates opaque async trace scopes (978–1014). This grounds the proxy in the current runtime. It does not establish which reference retains each observed allocation.

`node:v8` is unsuitable for no-inspector isolate measurement: an actual pinned-runtime HTTP request with 10,000 live synthetic objects returned all-zero heap counters and an empty space list. Evidence is `counter-smoke.json`; the [upstream module](https://raw.githubusercontent.com/cloudflare/workerd/main/src/node/v8.ts) explicitly implements these counters as placeholders.

## Measured current-runtime result

`scripts/diagnose-memory-native-retention.mjs` is a manual macOS diagnostic outside the test catalogue. It ran exactly as committed against the built checkout at c2b918b7. Each fresh owned process received 500 requests, concurrency 4: 100 warm, cumulative 250, cumulative 500, then 20 seconds idle. All **1,000 requests returned HTTP 200**. The app retained its normal authentication, response, D1, access-audit and metric behavior; the inline control made 23 D1 read queries per request against fixed synthetic rows, without application code.

The native tool was first verified on a one-request owned process. Each subsequent scan used `heap --addresses=workerd::DeleteQueue --noContent`. Only aggregate counts, allocation sizes, and tool summaries are saved; no addresses or memory content are committed. Scans took 0.6–0.8 seconds and RSS before/after each scan matched. Native scans still pause a process and can change timing.

| Phase | App RSS MiB | App DeleteQueue count | D1 control RSS MiB | D1 control count |
|---|---:|---:|---:|---:|
| Warm 100 | 183.13 | 2,290 | 90.70 | 1,069 |
| Total 250 | 290.86 | 5,619 | 105.73 | 1,484 |
| Total 500 | 363.94 | 4,136 | 121.94 | 2,009 |
| Idle 20 seconds | 363.92 | 4,136 | 121.91 | 2,009 |

The app count **falls from 5,619 to 4,136 while RSS rises**. Natural reclamation therefore occurs in this run; a claim that collection never happens is unsupported. Thousands of native request-graph proxies remain after completed requests and idle, including in the D1-only control. Their own allocation bytes are only 1.26 MiB and 0.61 MiB respectively: these are proxies for related graphs, not an explanation of the full RSS delta. Total malloc-node counts also rose (app 213,459→371,447, D1 97,332→129,068).

Together with the earlier all-isolate post-snapshot stable reachable heaps, the result narrows investigation toward runtime/native request graph lifecycle and collection cadence. It does not exclude application retention, distinguish garbage from live references in every class, or assign graphs to individual isolates. Isolate-owned retaining paths or a verified upstream fix plus a matched uninstrumented acceptance run are still required before closing O-2. No large repeat or upgrade was performed merely to claim completion.

Evidence: `tests/evidence/memory-native-retention/result.json` and `counter-smoke.json`. Validation: completed real diagnostic, one-request counter smoke, runner syntax check, and whitespace check. Production code was unchanged; prior unsafe write-control variants remain restored and their generated bundles removed.
