# O-2 matched workspace audit/write diagnostics

5 October 2026. O-2 remains open. No production audit/metrics policy or regression threshold changed.

Following the bounded no-inspector controls, two temporary detached diagnostic builds from `0df447cc` ran the actual authenticated workspace route. Each performed 100 warm-up requests and two rounds of 200 at concurrency four, followed by twenty seconds without requests. All 1,000 responses returned 200, retained clinician role and six assigned synthetic patients, and had a constant 16,642-byte body. Authentication, patient scope, response minimisation, schema, read queries and framework route remained unchanged. These are unreplicated short controls on a shared development machine, so small RSS differences cannot identify a causal regression.

The first diagnostic omitted only `recordWorkspaceLoad`'s call into durable access-audit persistence; it retained the summary computation, all metrics and other request work. The second additionally replaced the metric batch RPC with a resolved array of the same prepared statements, retaining statement construction, current-account lookup, tracing headers and console output. It did not disable every database write: account refresh and initial fixture creation still occurred. Static diagnostic-only patches are saved as evidence, not executable application configuration.

| Actual workspace build | Warm RSS MiB | After 400 more requests | After 20s idle | Durable viewWorkspace / metric count |
| --- | ---: | ---: | ---: | --- |
| Unmodified application, earlier matched workload | 182.97 | 361.78 | 361.77 | Normal audited route |
| Access-audit persistence omitted | 158.20 | 286.36 | 286.36 | 0 / 500 |
| Access-audit and metric persistence omitted | 156.95 | 294.81 | 294.81 | 0 / 0 |

SQL verified the expected absence/presence of audit/metric rows and exactly six patients with zero visits. There was no automatic recovery during the measured idle period. Physical footprint after idle was 211.8 MiB and 217.6 MiB respectively, versus 285.0 MiB in the unmodified run. The dirty App-Specific Tag 16 regions were 152.0 and 159.0 MiB versus 218.1 MiB; these OS names do not identify a retaining object or a JS/native allocation stack.

Audit persistence contributes substantial additional transient work, but omitting it leaves significant growth. Omitting metric persistence does not provide a monotonic benefit in these runs. Combined with the smaller inline read/D1 control and the earlier stable post-collection reachable classes, the remaining investigation is allocation/collection cadence across the full read/framework/database workload, not evidence that a single audit ledger object is retained. Disabling security audit, shipping forced collection or relaxing a threshold would be invalid fixes. No fix or plateau is claimed.

The temporary source modifications were restored and their generated diagnostic `dist/` deleted after the processes stopped. Only results, passive OS summaries, static patches, this document and a safe generic runner are committed. The runner never disables policy; it checks the already-built local source. `scripts/diagnose-memory-workspace-variant.mjs` is a manual diagnostic outside `tests/`, not a release-gate/catalogue suite. Default expected audit and metric counts are 500; zero expectations are explicitly supplied only for an isolated diagnostic build. The reusable wrapper is syntax checked; the two measured runs used the same helper/workload before that wrapper was made generic.

Next, use native allocation stacks or a matched framework/read-path diagnostic to find which full-route allocations remain live between collections. Runtime-version comparison is a separate controlled experiment. Repeated source rows or a relaxed memory threshold cannot substitute for that evidence. Hosted isolate limits, patient/ledger scale, physical Android and formal acceptance remain unqualified.

Evidence: `tests/evidence/memory-write-controls/`. See `MEMORY-NO-INSPECTOR-CONTROLS.md` and `MEMORY-PROFILING.md` for prior controls and their limits.
