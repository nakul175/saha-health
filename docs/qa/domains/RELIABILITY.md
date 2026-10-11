# Reliability, recovery and operational testing
Identify availability and correctness SLOs, recovery-time and recovery-point objectives, critical dependencies and data invariants. Define budgets from actual business impact. A short successful test cannot prove long-term uptime.

Cases: dependency outage/timeouts, retries with backoff and limits, circuit breaking, duplicate delivery/idempotency, partial failure, concurrency, process restart, queue backlog, network partitions, degraded mode, offline/resume, migration compatibility, rollback and restoration. Assert no silent data loss, corruption or unauthorized side effects.

Exercise backup restoration and measure actual data recovered and elapsed recovery against declared RPO/RTO. A successful backup job does not prove restoration. Verify migrations on representative synthetic volumes and rehearse forward/rollback/compensation procedures. Test alerts with safe fault injection; verify routing and actionable runbooks.

Chaos/fault experiments require authorized targets, bounded blast radius, stop conditions and recovery owner. Record environment limits. Tie rollout health and incidents to deployed version; investigate error-budget burn and update tests after incidents.
