# Record of processing activities

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a new data category, purpose, recipient, provider, hosting location or the first real-data decision.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** Structured as a GDPR Article 30 style record and mapped to India's Digital Personal Data Protection Act, 2023 (DPDP Act) concepts as *frameworks only*; neither is applied as a legal finding. Today every deployment holds **synthetic data only**; the entries describe what the software would process if real data were ever authorised, which this repository does not authorise ([Data governance](../current/DATA-GOVERNANCE.md)).

| Field | Entry |
| --- | --- |
| Controller / fiduciary | TBD (owner: Nakul Jain). The institution that would deploy Saha is the intended custodian ([Data governance](../current/DATA-GOVERNANCE.md)); none is established |
| Processor / sub-processors | Hosting: DigitalOcean (droplet, Bangalore) and Cloudflare (Worker, D1, Access; frozen); GitHub (source only); optional AI/MIS/EHR/ABDM partners, all off in synthetic deployments. Contracts: TBD |
| Contact | nakul.jain@aplyd.com. DPO or grievance officer: TBD |
| Purposes | Maternal and child health care-record workspace for community health workers: registration, visits, referrals, follow-up, programme reporting, reviewed AI-assisted extraction (off by default) ([README](../../README.md)) |
| Data subjects | Patients and household members (including proxies), care workers and organisation members |
| Data categories | Identity and contact data; household/proxy relations; clinical observations with source, date and units; visit notes; photos and voice notes (media); ABHA and programme identifiers; consent and contact preferences; rights requests; member accounts and roles; audit events; request metrics ([Data dictionary](../current/CURRENT-DATA-DICTIONARY.md)). Special-category/health data is central |
| Recipients | Same-organisation members within scope; programme MIS and EHR destinations after reviewed submission; an AI provider only when enabled and a capability is reviewed; none in synthetic mode |
| International transfers | Droplet in India (Bangalore). Cloudflare edge/D1 location hint Asia-Pacific. Transfers to AI providers would occur only if enabled: TBD |
| Retention | [Retention schedule](RETENTION-SCHEDULE.md) |
| Security measures | [Access-control model](ACCESS-CONTROL-MODEL.md), [threat model](THREAT-MODEL.md), [secrets register](SECRETS-REGISTER.md), audit chain, encrypted field notebook and snapshots |
| Legal basis / consent | Not established. Local consent toggles are not a statutory consent artefact or ABDM consent flow ([Data governance](../current/DATA-GOVERNANCE.md)) |
| Rights handling | [Data-subject request procedure](DATA-SUBJECT-REQUESTS.md) |
| DPIA | [DPIA](DPIA.md) |
