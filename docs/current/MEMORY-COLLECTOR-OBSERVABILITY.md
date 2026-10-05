# O-2: pinned passive collector observation boundary

6 October 2026. Diagnostic-only source `0de84078e727be6276f3f05c640f486cd1470fab`. O-2 remains open. No application, dependency, authority, audit, data, workload threshold or production runtime configuration repair is delivered. Original d241 lifetime evidence, 10,300-request studies and four same-D1 API suite recycle policy remain unchanged. Recycling is not a memory fix.

The next experiment attempted to observe natural collector activity without an inspector, snapshots, forced collection or heap flags. The exact installed workerd CLI exposes `--perfetto-trace=<path>=<categories>`. A temporary local executable shim forwards to the same SHA-pinned binary and only adds that official passive trace option in a diagnostic arm. It does not substitute a newer runtime. Fresh processes are used between arms; no restart occurs within an arm.

## Matched bounded D1 observations

The unchanged compatibility date/flags and fixed reduced D1 fixture are used in both arms. Each request awaits one batch of 23 statements, checks every successful result and returns the fixed first-query row count; the client fully consumes the body. There are 250 synthetic rows/113,750 text bytes and no per-request database writes. Each fresh process handles 100 warm-up plus two rounds of 250 at concurrency four, then ten seconds idle. Both arms pass all 600 requests, without retry, with the fixed table conserved.

| Arm | Warm RSS KiB | After 600 | Idle 10 seconds |
| --- | ---: | ---: | ---: |
| Same binary, no trace | 86,528 | 118,544 | 118,592 |
| Passive narrow collector categories | 86,944 | 119,376 | 119,456 |

The single pair reproduces residency growth outside Saha/framework code. Its short shared-host magnitude is not a statistical comparison or plateau. The trace arm's similar RSS does not establish a safe production tracing setting or prove all application growth shares this cause. Exact UTC/monotonic phase times, owned PIDs, process path, binary hash/version, Node/V8 version, compatibility settings, bundle hash and launch shim are retained in the result.

## Instrumentation cannot currently certify GC activity

The narrow V8/GC-category trace contains 17 session metadata packets and zero TrackEvents. This is an observability failure, **not evidence that no collection occurred**. A separately retained 600-request all-category validation emits 60,780 TrackEvents, but the fixed trace buffer loses its initial interned event-name dictionary. The decoder cannot safely attribute 30,389 named begin/instant events; slice ends legitimately omit names. That output is not a collector count.

A separate three-request instrumentation-only smoke retains its dictionary: all 33,926 TrackEvents resolve as named begins/instants or unnamed ends. It decodes 28 static runtime/request operation names, including creation and completion/proxying paths. No collector marker is present. These counts include fixture setup, so they are not three-request allocation attribution or a reduced-load memory qualification. The corresponding RSS is deliberately not used as an application performance result.

Pinned [Perfetto registration](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/util/perfetto-tracing.h) declares the `workerd` category; its [session implementation](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/util/perfetto-tracing.c%2B%2B) configures a one-MiB buffer. [WorkerdPlatform](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/server/v8-platform-impl.h) forwards the inner V8 tracing controller, while [V8 setup](https://raw.githubusercontent.com/cloudflare/workerd/v1.20260515.1/src/workerd/jsg/setup.c%2B%2B) constructs the default controller. No actual GC-event bridge or complete collector accounting is established by the exposed CLI in this pinned experiment. Official source provenance and SHA hashes are retained; this is a narrower supported observation limit, not proof of a missing GC call or complete platform diagnosis.

Because the instrumentation gate failed, an additional app trace arm was deliberately not run and no artificial heap pressure, snapshots, custom GC settings, collector requests or runtime upgrade were substituted. Earlier actual audited workspace/receiver proofs remain the application reference; these D1 controls cannot certify production per-organisation/request memory.

## Retained false starts and next decisive work

The all-category rerun initially reused its fixture table and failed before sending any workload. The failed log/result remain. The reusable driver now explicitly resets only its diagnostic synthetic fixture during setup. The initial decoder incorrectly counted nameless slice ends as unresolved names; its first output is retained, and the corrected decoder counts only event types requiring a name. The attempted system-Python bytecode cache write was denied; syntax was subsequently verified through in-memory compilation, without changing cache permissions.

The next useful collector-aware experiment requires an explicitly instrumented compatible symbol-rich runtime, not a production flag workaround: observe existing GC prologue/epilogue callbacks and completed receiver contexts, recording fixed collector type/isolate identity, before/after used/external heap accounting and native-wrapper counts. Run the same reduced fixed D1/service controls first, then the unchanged audited Saha route, with no forced collection and matched uninstrumented arms. Such a build is a separate upstream-boundary experiment requiring compatibility/security review; it is not proposed for deployment. A concrete application retention fix still requires a demonstrated retained application reference or unfinished lifetime. Neither passive trace output nor RSS proves that reference.

Evidence: `tests/evidence/memory-collector-next/manifest.json`; drivers `scripts/diagnose-memory-collector-next.mjs` and `scripts/decode-memory-collector-trace.py`. Total successful synthetic HTTP requests: 1,803 (1,200 matched pair, 600 broad instrumentation arm, three instrumentation smoke); one setup-only failure. Raw local trace binaries, SQLite databases and generated bundles are excluded. No patient facts, raw memory content, real provider traffic or upstream messages are delivered. Fresh unchanged application build and driver syntax checks pass; this is not a release gate/full regression/hosted memory acceptance.
