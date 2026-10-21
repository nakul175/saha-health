# SAHA-117 / APL-140 local coding completion

## Frozen scope

- Story: **Operational monitoring and actionable traces**
- Frozen requirements: **BR-OPS-04** and **NFR-18**
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-140.md`
- Contract SHA-256: `5499cec72d7c62b1e8e20f4bb4e733a29ff1b9b817d1267aa77daf84de659954`
- Base source: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

This record covers local application coding only. It does not mark the formal catalogue cases run, approve an alert target or escalation ladder, activate a provider, prove five-minute hosted delivery, merge source, or prove deployment.

## Application behavior completed

1. A redacted operational projection counts outbound work stalled for at least five minutes across programme, EHR, aggregate-report and model checkpoints. It reports only category counts and oldest age.
2. Operators receive actionable in-app alert families for stalled queues, unresolved connectors, unavailable or blocked model tasks, recent permission refusals and a disabled request-metrics collector. Existing platform error, provider-usage, budget and invoice alert families remain intact. Each alert carries severity, owner and a safe next action.
3. `SAHA_TELEMETRY_ENABLED=false` actually disables request-metric writes, and operator views/alert delivery expose the collector gap as unknown service health rather than a healthy result.
4. HTTP programme, EHR, agent, frontline, anaemia and legacy AI requests carry `X-Saha-Trace-Id`. The value is an existing opaque operation/request key, not clinical content.
5. Programme, EHR, agent and aggregate checkpoints bind the exact outbound trace id into their durable trace reference before persistence. Trace API v1.2 returns that id beside the internal command receipt id, preserving older unlinked steps without rewriting them.
6. Existing current-authority checks, before-send checkpoints, no-automatic-retry behavior, receipt lookup and redacted trace scope remain in place. Added behavior is count-only and does not widen patient access.

## Local verification

The exact final-source validation log is at `tests/evidence/saha-117-operational-monitoring/validation.log`.

- SAHA-117 focused operational signals: **14/14**
- Operational alert rules and acknowledgement authorization: **28/28**
- Redacted trace contract: **27/27**
- In-app alert delivery, ownership and escalation: **23/23**
- Scheduled-job alert evaluation: **37/37**
- Frontline provider checkpoint/authorization suite: **109/109**
- Anaemia provider checkpoint/authorization suite: **58/58**
- EHR request/header and privacy suites: **95/95 + 87/87**
- Total selected assertions: **478/478**
- TypeScript typecheck: **pass**
- Production build: **pass**

## Gates deliberately still separate

- Formal `TC-BR-OPS-04-A/B` and `TC-NFR-18-A/B`: not run.
- Hosted detection-to-delivery timing within five minutes: not measured.
- Cloudflare paid scheduled trigger and deployment configuration: not changed.
- Approved real SMS/email recipient, provider and escalation ladder: not supplied or activated.
- Live connector/provider outage and receipt evidence: not produced.
- Abrupt loss of the application database/metrics store cannot durably record its own failure; this slice covers explicit collector disablement and surfaces that configured gap.
- Historical steps recorded before trace linking remain labelled `not linked`.
- Independent review, CI on a published head, merge and observed deployment remain pending.
