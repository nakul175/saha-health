# Retention schedule

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: an approved retention policy, a deletion capability, or a change to automatic purges.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** The software lets an organisation owner record retention periods but **deletes nothing**; the repository rule is to preserve confirmed records, revisions, audit and receipts, and disposal needs an approved policy first ([slice 6c](../current/SLICE-6C-RETENTION.md)). There is no institution-approved schedule: TBD (owner: Nakul Jain).

| Data class | Retention behaviour in the software today | Proposed approved period |
| --- | --- | --- |
| Patient records (from last registration or visit activity) | Owner records 1 to 50 years, versioned; review shows eligible counts only | TBD |
| Programme receipts (from last update) | Same | TBD |
| Audit events | Same; append-only chain, never deleted | TBD |
| Outreach messages (from creation) | Same | TBD |
| Closed rights requests (from closure) | Same | TBD |
| Field packages (from creation) | Same | TBD |
| Legal / organisation holds | Per-patient or organisation hold blocks eligibility; one current hold per patient | n/a |
| Hourly request metrics | Old buckets deleted on later traffic after 30 days; dormant organisations not covered ([Data governance](../current/DATA-GOVERNANCE.md)) | 30 days (implemented, incomplete) |
| Invitations | Single-use, expire after 72 hours | 72 hours |
| Backups / snapshots | No schedule or retention rule | TBD |
| Hosting logs (Caddy, journald, Cloudflare) | Separate operator controls; not documented | TBD |
| Exit export | Owner-generated archive with checksums ([slice 6m](../current/SLICE-6M-DATA-EXIT.md)) | Handled by recipient |

Erasing from backups and restored copies is not designed: a restore can revive deleted or revoked state ([runbooks](../current/09_Operational-Runbooks_v1.1.md)).
