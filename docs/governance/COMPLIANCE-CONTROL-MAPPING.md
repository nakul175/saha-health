# Compliance control mapping

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change to any mapped control, or a decision to pursue an actual compliance programme.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** This maps existing controls and documents to *themes* of the frameworks named by the owner (India's DPDP Act 2023, GDPR Articles 30 and 35, WCAG 2.2). It is an index for a future assessor, not an assessment. "Evidence" means a document or test exists; it does not mean the control works in production or satisfies a legal duty.

| Framework theme | Saha control | Evidence | State |
| --- | --- | --- | --- |
| DPDP: notice and consent | Local consent toggles, withdrawal handling | [Slice 6o](../current/SLICE-6O-CONSENT-WITHDRAWAL.md); [Data governance](../current/DATA-GOVERNANCE.md) | Not a statutory consent artefact; no patient notice |
| DPDP: purpose limitation / data minimisation | Purpose and programme narrowing; AI input minimisation | [R09](../current/SLICE-R09-PURPOSE-SCOPE.md), [AI model card](AI-MODEL-CARD.md) | Partial |
| DPDP: rights of data principals; grievance | Rights and grievance workflow | [DSR procedure](DATA-SUBJECT-REQUESTS.md), [slice 6b](../current/SLICE-6B-RIGHTS.md) | Partial; no erasure |
| DPDP: security safeguards | Server-side scope, audit chain, encrypted field notebook and snapshots | [Access model](ACCESS-CONTROL-MODEL.md), [threat model](THREAT-MODEL.md) | Partial; no independent test |
| DPDP: breach notification | Incident register, process | [Incident process](INCIDENT-PROCESS.md) | Notification duty and timing undefined |
| DPDP: retention / erasure when purpose ends | Owner-set schedule, holds | [Retention schedule](RETENTION-SCHEDULE.md) | Nothing is deleted |
| DPDP: children's data | None specific | none | Not assessed (child patients are in scope of the product) |
| DPDP: significant data fiduciary duties | None | none | Not assessed |
| GDPR Art. 30 record of processing | Record of processing | [Record](PRIVACY-RECORD-OF-PROCESSING.md) | Draft, many TBD |
| GDPR Art. 35 DPIA | Pre-assessment | [DPIA](DPIA.md) | Draft; not approved |
| GDPR Art. 32 security of processing | As security rows above | [Secure development](SECURE-DEVELOPMENT-EVIDENCE.md) | Partial |
| GDPR Art. 15-22 rights | As rights row | [DSR procedure](DATA-SUBJECT-REQUESTS.md) | Partial |
| GDPR Art. 28 / DPDP processor duties | Hosting and AI vendors | [Third-party inventory](THIRD-PARTY-INVENTORY.md) | No contracts recorded |
| WCAG 2.2 AA | Automated axe audits | [Accessibility statement](ACCESSIBILITY-STATEMENT.md) | Partial; conformance not claimed |
| Audit logging and integrity | Append-only hash chain, signed checkpoints, read audit | [Slice 6j](../current/SLICE-6J-AUDIT-CHAIN.md), [R06](../current/SLICE-R06-AUDIT-CHECKPOINT-SIGNING.md) | Local evidence only |
| Business continuity | Snapshot tool, drill | [Backup and DR](BACKUP-AND-DR.md) | No real-host test |
| Clinical safety management | Safety cases, held capabilities | [06 spec](../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md), [AI-GOVERNANCE](../../AI-GOVERNANCE.md) | Not a clinical safety case approval |
| ABDM / health-data ecosystem rules | Mock workflows only | [ABDM slices 7a, 7b](../current/SLICE-7A-ABDM-MOCK.md); [EHR-ABDM.md](../../EHR-ABDM.md) | Not integrated; no ABDM compliance |

Other regimes (ISO 27001, SOC 2, HIPAA, India health-sector rules, medical-device regulation) have not been considered: TBD (owner: Nakul Jain). The formal acceptance register has 176 requirements, all pending ([Pilot and release acceptance](../current/10_Pilot-and-Release-Acceptance_v1.1.md)).
