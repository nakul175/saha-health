# Original target design — 10_Pilot-and-Release-Acceptance_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/10_Pilot-and-Release-Acceptance_v1.0.docx)

Pilot and Release Acceptance

Pilot setup, measurement, review gates and evidence required for controlled expansion.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 10 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Pilot hypothesis and population

The pilot tests whether workers can complete approved cross-programme tasks with less repeated entry, while maintaining data quality, accountable care and reliable exchange. The proposed starting deployment is one district with 100 to 200 workers, maternal/TB/hypertension workflows, two real programme destinations, two approved AI providers and a selected owner-authorised EHR or ABDM route. These are planning defaults until D01 to D06 close.

The buyer must have authority to retire or reconcile duplicate steps. Confirm device conditions, languages, network availability, patient context and referral services through observed work. Exclude unsupported capability populations from the affected optional AI use while preserving ordinary care. Report exclusions explicitly so favourable results cannot be explained by silently removing hard cases.

## Preparation and phases

1. Baseline observation: document current tasks, forms, duplicate fields, timing, failed submissions, care follow-up and worker effort. Agree definitions and sampling before seeing pilot results.

2. Synthetic rehearsal: complete the core and adverse journeys with workers and supervisors using clearly labelled records. Fix language, review, identity and partial-success misunderstandings.

3. Authorised limited live cohort: activate only approved packs, provider versions and connector operations. Monitor every uncertain external outcome and urgent workflow exception.

4. Expanded pilot cohort: increase participation only after the limited cohort’s safety, custody and support evidence is accepted. Keep a rollback and support path.

5. Pilot evaluation: analyse paired or otherwise appropriate baseline comparisons, missing data, adoption, safety, cost and exceptions. Separate product contribution from changes in staffing, workload or programme policy.

## Measurement dictionary

| Measure | Definition | Method and caution |
| --- | --- | --- |
| Repeated entry | Number of times an already eligible confirmed fact is manually entered again / eligible reuse opportunities | Observe matched tasks and inspect mapped fields; exclude genuinely different time or attestation needs |
| Worker task time | Median and upper-percentile active time per comparable completed task | Define start/end; separate waiting, travel and interrupted work; preserve incomplete tasks |
| Destination completion | Actions with verified business acceptance / authorised intended actions | Report queued, rejected and uncertain separately; break down by destination |
| Data quality | Confirmed records with material correction or mismatch / reviewed records | Independent sampled review; identity and clinical errors reported separately |
| AI usability | Eligible invocations returning usable validated output / eligible attempted invocations | Include unable-to-assess, timeout and unsupported-input reasons; no implied diagnostic accuracy |
| Referral follow-through | Referrals with verified service outcome / referrals due for outcome | Separate receipt, appointment, attendance and care completion |
| Adoption | Workers completing the intended workflow / workers with eligible assigned work | Avoid login count as sole adoption measure; disclose training and assisted usage |
| Reliability | Lost acknowledged records, duplicate external effects and unresolved queue age | Use receipts, recovery evidence and independent reconciliation |
| Cost | Total provider, platform and support cost / completed intended workflows | Include failed calls, rework and integration maintenance; state allocation method |
| Safety and privacy | Incidents, near misses, inappropriate access and unreviewed guidance | Review severity and exposure, not only event counts; avoid treating low reporting as proof of safety |

Use the BRD’s proposed numerical success thresholds as review inputs, then agree denominators and observation windows before G5. Do not invent sample-size precision or causal effects from a small operational cohort. Clinical diagnostic performance, where relevant, needs a separate qualified evaluation design and sufficient representative evidence.

## Release gates

### G0 Business baseline

Accountable role Sponsor and product owner

Criteria BRD scope and proposed measures accepted

Evidence BRD review record

Initial status Not started

### G1 Workflow readiness

Accountable role Programme and clinical owners

Criteria Actual forms, role scope, languages and escalation routes validated

Evidence Observed journey maps and approved pack definitions

Initial status Not started

### G2 Integration readiness

Accountable role System owners and integration lead

Criteria Two real programme destinations plus selected EHR or ABDM route; exact ABDM scope tested

Evidence Owner-approved receipts, permissions and reconciliation evidence

Initial status Blocked external dependencies

### G3 AI readiness

Accountable role AI governance and clinical lead

Criteria Two providers; approved evidence and deployment scope for every live capability

Evidence Version manifests, clinical review and data-use agreement

Initial status Blocked external dependencies

### G4 Production controls

Accountable role Security engineering and operations

Criteria Identity isolation audit offline backup restore and incident tests pass

Evidence Independent assessment and executed test evidence

Initial status Not started

### G5 Pilot readiness

Accountable role Deployment owner

Criteria Trained cohort, devices, support, baseline and patient-facing material ready

Evidence Site checklist and role competency records

Initial status Not started

### G6 Pilot exit

Accountable role Sponsor buyer and clinical owner

Criteria BRD outcomes reported with failures and exclusions; costs and safety reviewed

Evidence Pilot analysis and unresolved issue disposition

Initial status Not started

### G7 Expansion approval

Accountable role Buyer and jurisdiction owners

Criteria New population, scale and jurisdiction evidence accepted

Evidence Deployment-specific expansion decision

Initial status Not started

## Go and no go decision

A go decision requires signed evidence for the in-scope gates, mandatory requirements tested on the candidate build, all critical clinical/security/data-integrity defects resolved, trained users and staffed support. A limited experiment with missing integrations or providers must have explicit reduced scope and cannot be described as the full R1 product. Unknown or unavailable results remain unknown rather than pass.

| Situation | Required action |
| --- | --- |
| Wrong-person action, material disclosure or credible serious clinical safety concern | Pause affected workflow; activate the relevant incident runbook and clinical route |
| Uncertain writes beyond owned recovery capacity | Pause affected destination dispatch; reconcile and restore capacity before resuming |
| Loss of acknowledged work or failed restore | Stop expansion and resolve integrity/recovery gate |
| Provider version or programme rule changes | Reassess affected evidence and activation approval |
| Insufficient baseline or poor adoption | Extend or redesign measurement; do not claim benefit from incomplete evidence |
| Successful outcomes with unresolved jurisdiction or scale dependencies | Approve only the tested scope; reopen G7 for expansion |

## Acceptance record template

| Field | Required entry |
| --- | --- |
| Release and scope | Build, configuration, programme, provider, mapping and external contract versions |
| Population and sites | Actual cohort, eligibility, exclusions, languages and devices |
| Evidence | Requirement/test report, partner receipts, clinical review, security and restore results |
| Outcomes | Baseline comparison with denominators, missingness, costs and exceptions |
| Residual issues | Owner, containment, due date and explicit acceptance rationale |
| Decision | Go, limited continuation, pause or no go; scope and review date |
| Approvals | Named sponsor, product, programme, clinical, privacy/security, integration and operations approvers |

## Handover and expansion

Handover includes trained support, operational dashboards, runbooks, current approvals, unresolved tasks and a custody/exit plan. Expansion to another district, programme, population, EHR or model version requires a new capability and workflow review proportionate to the change. Reuse the platform and contracts, while verifying the new external authority, semantics and clinical scope.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
