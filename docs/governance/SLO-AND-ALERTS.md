# Service-level objectives and alert catalogue

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a measured availability or recovery result, a change to alert rules, or a decision on a monitoring tool.

**Status: proposed targets, not measured.** No uptime monitoring, external alerting, paging or incident rota exists ([Hosted staging, Limits](../current/HOSTED-STAGING.md); [Operations](../../OPERATIONS.md)). The hosted copies are synthetic and have no commitment to anyone.

## Proposed SLOs

The targets come from the original requirements, as recorded in the [requirement register](../../requirements/traceability.csv). They are not commitments for the synthetic staging copy.

| SLO | Proposed target | Source | Measured today |
| --- | --- | --- | --- |
| Core availability | 99.5% monthly, planned maintenance and upstream outages reported separately | NFR-01 | No. Opt-in local synthetic sampler only ([Synthetic availability](../current/SYNTHETIC-AVAILABILITY.md)) |
| Recovery point / time | RPO at most 15 minutes, RTO at most 4 hours | NFR-06 | No. Local drill only ([Backup and DR](BACKUP-AND-DR.md)) |
| Connected screen latency | p95 at most 3 s on the reference network | NFR-02 | No reference-device measurement |
| Role removal takes effect | Within 5 minutes online | NFR-09 | No production measurement |
| Uncertain external writes | Zero duplicate accepted partner activity | NFR-05 | Local soak only ([slice 7d](../current/SLICE-7D-REPLAY-SOAK.md)) |

Error budget and burn-rate policy: TBD (owner: Nakul Jain).

## Alert catalogue (what exists)

Alerts are computed in the application from data the viewer may already see ([slice 6g](../current/SLICE-6G-ALERTS.md), delivery in [slice 6v](../current/SLICE-6V-ALERT-DELIVERY.md)). They appear in the Operations view and in-app notifications. Nothing reaches people outside Saha: no email, SMS, Slack or pager.

| Alert (rules 1.0.0) | Severity | Owner role |
| --- | --- | --- |
| Programme submission or EHR publication without a final receipt | high | operations |
| Referral past due date | high | supervisor |
| Follow-up past due; open referral without a due date | normal | supervisor |
| Provider call without reported usage | normal | operations |
| 24-hour server error rate above 5% over at least 20 requests | critical | operations |
| Unresolved critical incident / other unresolved incident | critical / normal | operations |
| Organisation paused for maintenance | high | operations |

## Gaps

- No external uptime probe, so a wholly unavailable Worker or droplet raises no alert (the in-app counter cannot see it).
- No alerting on deploy-status, disk, memory or the droplet update timer; `deploy-status.json` must be read by hand ([deploy/README.md](../../deploy/README.md)).
- No on-call rota or escalation path: TBD (owner: Nakul Jain).
- Dashboards: none.
