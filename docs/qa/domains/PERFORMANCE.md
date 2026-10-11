# Performance validation
Derive budgets from user journeys, traffic expectations, SLOs and contracts. Record endpoint/journey, percentile, latency boundary (client or server), error definition, throughput/concurrency, data volume, network/device, warm/cold state and dependencies. Do not invent a universal p95 target.

Plan baseline, load, stress, spike and soak tests proportional to risk. Use representative distributions, pacing and arrival model; measure queueing, saturation, resource use, dependency limits, tail latency and errors. Include AI token/cost budgets if applicable. Run only in authorized isolated environments with stop conditions and budget caps.

A gate specifies sample/window, target, tolerated error rate, capacity and degradation rule in advance. Report achieved offered/completed load and percentiles with counts; averaging latency hides tail failures. Note environment differences, warm-up, missing telemetry and confidence limitations. Load generators can bottleneck; verify that they did not invalidate the run. Re-test material changes and compare equivalent conditions.
