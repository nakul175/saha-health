# Data protection impact assessment (DPIA)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: before any real-data pilot, a new provider or recipient, or a change in the data categories.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** Structured on GDPR Article 35 as a framework; DPDP Act 2023 duties for significant data fiduciaries (including impact assessment) are not assessed here. This is a **pre-assessment of a synthetic system**: the DPIA conclusion is that real data must not be processed until the open items below are closed.

## 1. Description of processing

See the [record of processing](PRIVACY-RECORD-OF-PROCESSING.md). Large-scale processing of health data of women and children by frontline workers, possibly offline on personal devices, with optional AI assistance and sharing to government programme systems.

## 2. Necessity and proportionality

Purpose limitation is supported by programme/purpose-narrowed access, minimised AI inputs (direct identifiers excluded structurally; free-text screening is limited, not de-identification) and aggregate-only report destinations ([AI governance](../../AI-GOVERNANCE.md), [slice 7g](../current/SLICE-7G-AGGREGATE-DELIVERY.md)). Lawful basis, patient notice and consent design: TBD (owner: Nakul Jain; counsel not consulted).

## 3. Risks and existing measures

| Risk to individuals | Measures in software | Residual |
| --- | --- | --- |
| Unauthorised access to health records | Server-side scope, break-glass review, read audit that fails closed | No independent test; droplet sign-in weak ([threat model](THREAT-MODEL.md)) |
| Wrong-person records and harmful actions | Provisional identity gate, positive patient check, linked corrections | Field usability untested |
| Disclosure to AI vendor | Off by default; reviewed capability; minimisation; `store:false` | Vendor terms unverified; retention not guaranteed zero |
| Re-identification from small groups | Scoped aggregates | Small-cell suppression incomplete |
| Loss of records | Append-only revisions, snapshot tool | No scheduled backup ([Backup and DR](BACKUP-AND-DR.md)) |
| Inability to exercise rights | Rights-request workflow | Not a complete rights or deletion service; no deletion across backups |
| Unlawful retention | Owner-set schedule, holds, counts only | Nothing is deleted; no disposal action ([retention](RETENTION-SCHEDULE.md)) |

## 4. Consultation and sign-off

Data subjects, clinical owner, custodian, security reviewer: none consulted. Approval: TBD (owner: Nakul Jain). Outcome: **not approved for real data.**
