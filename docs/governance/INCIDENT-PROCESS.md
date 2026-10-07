# Incident process

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a real incident, a change to the Operations incident register, or the introduction of an on-call rota.

Scope: operational and security incidents on the synthetic deployments. Clinical-safety concerns follow the established care escalation route first; technical support must not delay it ([Support guide](../current/SUPPORT-GUIDE.md)). Nothing here is certified or independently reviewed.

## Roles

| Role | Who today |
| --- | --- |
| Incident owner and decision maker | Nakul Jain (sole named owner); backup: TBD (owner: Nakul Jain) |
| In-app incident register | Organisation owners and administrators ([Operations](../../OPERATIONS.md), Incident handling) |
| Security reports | nakul.jain@aplyd.com ([SECURITY.md](../../SECURITY.md)) |

## Steps

1. **Detect and record.** Open an incident in the in-app register (Operations): concise title or safe case reference, severity, active operations owner. No patient details or secrets in the text. The register holds at most 100 incidents and has no attachments.
2. **Contain.** An organisation owner may pause the organisation for maintenance, with a reason (new capture, confirmation, field sync, model requests and new MIS/EHR sends are then refused; reads, receipt lookups, revocations and cancellations continue). Maintenance is not a distributed cancellation guarantee.
3. **Preserve.** Keep original logical keys, receipts, audit and revisions. Look up uncertain receipts before any retry; never regenerate a key to bypass one ([runbooks](../current/09_Operational-Runbooks_v1.1.md)).
4. **Investigate.** Use redacted support diagnostics (Operations, `format=support`) and, on the droplet, `journalctl -u saha-health` and `deploy-status.json` ([deploy/README.md](../../deploy/README.md)). Sending diagnostics outside the organisation needs separate authority.
5. **Recover.** Prefer a compatible forward fix; rollback is a revert on `main`. A source revert is not a database rollback and applied migrations are not reversed. See [Backup and DR](BACKUP-AND-DR.md).
6. **Resolve.** Record findings and an evidence reference; resolved records are immutable. Open a linked follow-up for further work.
7. **Learn.** Write a blameless postmortem with the [template](POSTMORTEM-TEMPLATE.md) for any critical incident, data exposure, or loss/uncertainty of a confirmed record. Store it in `docs/postmortems/` (create on first use) via draft PR.

## Severity (proposed)

| Level | Examples |
| --- | --- |
| Critical | Suspected exposure of data across organisations or patients; loss of confirmed records or audit; duplicate external action |
| High | Hosted copy down; sign-in broken; a failed migration |
| Normal | Degraded feature, single-user problem |

Response-time targets: TBD (owner: Nakul Jain). Breach notification duties to regulators or people: TBD (owner: Nakul Jain; counsel not consulted).

## Known gaps

No paging, no rota, no external uptime probe ([SLOs and alerts](SLO-AND-ALERTS.md)). No postmortem has been written yet.
