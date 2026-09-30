# Security privacy and clinical safety

The current controls support synthetic engineering use. The complete ten-threat and ten-hazard target catalogue is retained in the [original specification](../reference/06_Security-Privacy-and-Clinical-Safety_v1.0.md). This edition records implemented mitigations and residual gaps; it is not a compliance assessment or an approved clinical safety case.

## Current access model

| Membership | Patient scope | Authority limit |
| --- | --- | --- |
| ASHA | Directly assigned patients in current teams | Capture and bounded reviewed care actions; no independent clinical credential claim |
| Clinician | Patients in current teams | Care and designated clinical review; membership does not verify professional credentials |
| Supervisor | Patients in current teams | Oversight, assignment and reconciliation; no clinical fact writes |
| Administrator | No patient-record scope | Permitted configuration and operational metadata; no clinical export |
| Owner flag | Still determined by the membership role and teams | Organisation/membership/configuration control; no universal patient access |

The target roles for programme owner, AI governance, integration operator, auditor/privacy and support are not all separate current membership roles. Workflow-specific reviewer/owner checks do not implement the entire target entitlement model.

## Threats and current mitigations

| Threat | Implemented control | Residual work |
| --- | --- | --- |
| Forged identity or tenant | Sites dispatcher identity; active server membership and team/patient checks | Independently qualify hosting boundary and workforce lifecycle; do not expose trusted headers publicly |
| Stale authority or replay | Current access recheck on replay, version-bound commands, organisation CAS | Representative concurrency and provider in-flight withdrawal acceptance |
| Wrong patient or silent overwrite | Scoped matching, provisional gate, positive check, linked corrections, immutable revisions | Household/proxy, downstream repair and field usability |
| Prompt injection or unsupported AI output | Closed task/schema, lexical source validation, evidence review, selected apply, governed capability | Representative adversarial/clinical evaluation; lexical validation is not semantic proof |
| Secret or excess data disclosure | Server secret bindings, origin grants, scoped inputs and identifier checks | Independent minimization/security review and approved provider terms |
| Duplicate external action | Durable checkpoint, stable logical key, receipt hash checks and uncertain lookup | Real partner semantics, hosted callbacks and acceptance |
| Lost field device | Encrypted browser storage, lock and signed bounded grants | Native keystore, physical device recovery and offline revocation limits |
| Audit or recovery loss | Append-only triggers, retained revisions, encrypted local snapshot/digests | Privileged operator controls, independent tamper evidence, hosted retention and recovery |
| Report disclosure | Scoped aggregates and safe CSV formatting | Small-cell suppression, rights/retention and purpose-specific access |
| Unsafe production assumption | Synthetic markers, gated connections, explicit acceptance records | Independent clinical/security/field approvals |

## Clinical safety rules

Missing or stale observations remain unknown. Unable-to-assess, unsupported language, transport failure and a clinical finding are distinct outcomes. The rules-only parser and tiny evaluation corpus cannot support diagnostic claims. R11 does not seed a production clinical protocol.

Capability and protocol use binds approved immutable content, intended context, source/service dependencies, current reviewer/owner authority and expiry. Clinical review of a worker-originated protocol uses that worker's context. Directory drafts retain the service revision snapshot; the software does not verify that a facility was contacted.

A concern or possible harm requires the established care escalation route, a named clinical owner and a restricted evidence record. Hold the implicated capability when appropriate, preserve inputs/outputs/versions and assign follow-up. A local safety-case resolution is a recorded decision, not proof of causation or professional acceptance. See [runbooks](09_Operational-Runbooks_v1.1.md) and [data governance](DATA-GOVERNANCE.md).
