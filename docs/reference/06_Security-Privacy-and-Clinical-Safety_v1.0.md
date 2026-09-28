# Original target design — 06_Security-Privacy-and-Clinical-Safety_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/06_Security-Privacy-and-Clinical-Safety_v1.0.docx)

Security Privacy and Clinical Safety

Authority boundaries, data controls and accountable handling of technical and clinical risks.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 06 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Policy decision model

Permit an action only when verified identity, active membership, role, tenant, person relationship, programme or facility, purpose, current processing authority, resource sensitivity and action class all match. Deny by default. The planner, provider result, browser state and household relationship cannot grant access. A consent record is necessary for the flows that require it, but does not override institutional authority, professional scope or external system permission.

| Role | Permitted work | Additional restriction |
| --- | --- | --- |
| ASHA or frontline worker | Assigned capture, review, permitted AI and referral preparation | No unsupported diagnosis or clinical ordering |
| Clinician | Clinical review and decisions within verified scope | Clinical credential and patient relationship required |
| Supervisor | Assigned caseload oversight and follow-up | Aggregate access does not imply every person record |
| Programme owner | Approved programme configuration and measures | Clinical content requires clinical review |
| AI governance | Evidence and capability activation workflow | No default access to raw patient data |
| Integration operator | Connector health, mapping and reconciliation | Use redacted metadata unless a scoped case permits data |
| Deployment administrator | Membership and controlled configuration | Cannot self-grant unrestricted patient access |
| Auditor and privacy lead | Purpose-limited accountability evidence | Record content only where separately justified |
| Support | Redacted tickets and diagnostics | Time-bound approved access for a named case |

The workbook Access Matrix provides 20 actions across 10 roles. “Conditional” means the full policy predicate must pass; it is not blanket permission. Administrative and clinical approvals must be separated where a change affects safety or disclosure. Emergency access, if a buyer permits it, requires a separately designed lawful policy and evidence; no generic bypass is enabled in this baseline.

## Data flow and processing record

| Flow | Minimum data | Required decision |
| --- | --- | --- |
| Device to platform | Assigned person context and captured facts | Buyer authority, notice, device and workforce controls |
| Platform to AI provider | Only approved capability inputs | Purpose, recipient, retention, location and intended use |
| Platform to programme MIS | Mapped required fields and approved action | System owner write authority and data-sharing basis |
| ABDM health information exchange | Scoped clinical documents and identifiers | Enabled role and applicable consent/data-transfer flow |
| Direct EHR access | Supported operation and selected record scope | Owner permission, identity match and resource capability |
| Report or export | Governed aggregate or approved person list | Scope, suppression, recipient, retention and expiry |

Maintain a deployment-specific processing register and determine applicable Indian privacy, health, professional and institutional obligations with the responsible owners before real data. This pack specifies controls and evidence; it does not assert legal compliance or a blanket ABDM certification. A source change or deployment in another jurisdiction triggers renewed review of the affected flows.

## Security control baseline

1. Use individual workforce accounts, verified institutional enrollment, short-lived sessions and stronger authentication for privileged roles. Revoke sessions and assignments on role change. Recovery must verify the worker independently of patient data.

2. Encrypt data in transit and at rest with controlled keys. Scope credentials per environment and connector. Rotate and revoke secrets through the selected vault; never place them in prompts, mobile builds or programme packs.

3. Apply policy at every read, mutation, export, object ticket and background action. Enforce tenant isolation in service queries and database RLS; test cross-tenant and cross-person denial.

4. Separate synthetic, test and production credentials and network routes. Providers receive only approved fields. Prevent production data from entering demonstration fixtures or model training without separately approved authority.

5. Audit decisions and external disclosures with restricted evidence references. Redact payloads from logs, traces, crash reports and support tickets. Monitor privileged access and retention exceptions.

6. Scan and constrain uploaded media, validate output schemas, authenticate callbacks and limit outbound network destinations. Treat retrieved content as data and deny attempts to request extra tools or secrets.

7. Test backup restoration, key recovery, device loss, incident handling and exit exports. A successful backup job alone does not prove recoverability.

## Threat register

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| TH01 | Wrong tenant or person reference | Server-derived scope, patient binding and RLS | Cross-tenant and wrong-person negative tests |
| TH02 | Prompt injection in note or provider response | Closed tools, independent policy and output validation | Malicious content cannot trigger unapproved action |
| TH03 | Lost device or clock rollback | Encrypted cache, short lease, trusted time and lock | Offline expiry and reboot recovery tests |
| TH04 | Replayed callback or command | Authenticated correlation, timestamp and deduplication | Same logical result has one state and charge effect |
| TH05 | Stale approval or consent | Exact snapshot hash and dispatch-time policy | Changed inputs or revoked authority block transmission |
| TH06 | Privileged misuse or support extraction | Least privilege, separation, temporary grant and audit | Grant expiry and scope enforcement demonstrated |
| TH07 | Secret or patient data in telemetry | Redaction, restricted sinks and sampling review | Canary sensitive strings absent from logs |
| TH08 | Report inference or repeated differencing | Suppression and query policy | Small-cell and repeated-filter tests |
| TH09 | Malicious media or arbitrary URL fetch | Upload constraints, approved storage references, network policy | Unsupported type and external URL rejected |
| TH10 | Vendor or schema change | Pinned version, drift detection and suspension | Undeclared change cannot silently enter clinical use |

## Clinical hazard register

| ID | Hazard and consequence | Control | Accountable role |
| --- | --- | --- | --- |
| HZ01 | Record attached to wrong person — Potential incorrect care or disclosure | Stop ambiguous matching; verify person before capture and every action; steward repairs affected records | Clinical and identity owners |
| HZ02 | Extraction reverses negation or changes number — Potential missed or inappropriate escalation | Review source spans and critical values; distinguish draft from confirmed; test local languages | Clinical and language owners |
| HZ03 | AI failure interpreted as reassuring result — Potential delayed care | Distinct unable-to-assess and transport states; approved pathway continues without AI | Clinical safety |
| HZ04 | Model used outside intended population — Unreliable guidance | Manifest eligibility, quality checks and deployment scope; reject unknown eligibility | AI governance |
| HZ05 | Multiple AI outputs combined without evidence — Misleading composite recommendation | Preserve independent outputs; human review of conflict; approve composition separately | Clinical safety |
| HZ06 | Stale fact reused after clinical change — Wrong next action | Time and episode rules; provenance; invalidation after correction | Programme clinical owner |
| HZ07 | Urgent care blocked by software or connectivity — Delayed escalation | Locally approved offline protocol and human contact route; forms cannot gate urgent action | Deployment clinical owner |
| HZ08 | Referral marked complete on message delivery — Missed care hidden from follow-up | Separate receipt, attendance and outcome; verified completion evidence | Care network owner |
| HZ09 | Duplicate accepted programme or EHR action — Contradictory or repeated downstream work | Stable logical identity and uncertain-write reconciliation | Integration owner |
| HZ10 | Outdated protocol or hidden provider release — Invalid guidance | Versioned pack and model; impact assessment; controlled activation and rollback | Programme and AI owners |

The register identifies potential severity; likelihood and residual risk require deployment evidence and qualified review. Assign detection, containment and follow-up owners before activation. No clinical performance threshold, referral cutoff or patient advice is invented by these documents. All such values come from approved programme protocols and capability evidence.

## Safety lifecycle and incident response

1. Before activation, assess intended use, user competence, clinical pathway, input quality, population, failure modes and human factors. Record approved limitations and escalation instructions.

2. Monitor unable-to-assess rates, workflow overrides, missing follow-up, safety complaints and model version changes. Investigate outcome differences without assuming causality from aggregate usage.

3. For suspected serious harm, preserve evidence, provide the existing clinical escalation route, suspend affected optional automation and identify exposed records. Do not hide uncertainty or erase accepted actions.

4. Separate care response from technical investigation. Notify responsible organisational and clinical owners through the approved incident plan and applicable obligations.

5. Release a fix only after regression, affected-case disposition, communication and independent closure approval. Preserve the incident and residual-risk decision in the release evidence.

## Privacy and consent change

Revocation stops new optional disclosure and cancels queued work that no longer has a valid basis. In-flight transmissions may already have reached a recipient; record actual state and use the agreed recipient process. Revocation does not imply automatic deletion of all historical clinical records. Retention, correction, access requests and holds follow the approved custody policy and applicable obligations.

## Required approval evidence

G3 requires provider and workflow clinical evidence; G4 requires security, isolation, offline custody, backup and incident evidence; G2 requires owner-authorised integrations and the selected ABDM scope. Record named approvers, document versions, unresolved limitations and expiry or review dates. A successful technical test never substitutes for clinical or data-use approval.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

S02 NRCeS ABDM FHIR guide https://nrces.in/ndhm/fhir/r4/ — Published guide retrieved 26 September 2026 shows version 6.5.0 on FHIR R4; pin deployment package at onboarding

S05 ABDM Sandbox https://sandbox.abdm.gov.in/ — External onboarding dependency; actual API and callback versions require official account-specific confirmation

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
