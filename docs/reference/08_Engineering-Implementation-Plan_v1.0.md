# Original target design — 08_Engineering-Implementation-Plan_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/08_Engineering-Implementation-Plan_v1.0.docx)

Engineering Implementation Plan

Dependency-based work packages and a traceable backlog for moving from specification to an authorised pilot.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 08 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Delivery basis

The backlog contains 176 requirement-linked engineering items grouped into 11 work packages. Estimates, named assignees and dates are intentionally uncommitted until the team, partner access and target deployment are known. The source BRD release and priority labels remain authoritative. Do not convert this documentation baseline into a production readiness claim.

| Package | Owner | Depends on | Build outcome |
| --- | --- | --- | --- |
| WP01 Identity and assignments | Platform lead | None | Verified workforce login, role context, caseload and identity correction |
| WP02 Policy audit and invariants | Security lead | WP01 | Purpose-bound policy, audit atomicity, approval binding and environment isolation |
| WP03 Encounter and shared data | Workflow lead | WP01 WP02 | Local person and encounter model, draft capture, typed observations and revisions |
| WP04 Programme configuration | Programme lead | WP03 | Versioned questions, schedules, approved clinical rule interface and mappings |
| WP05 Agent and AI broker | AI engineering lead | WP02 WP03 WP04 | Typed bounded plans, model manifests, request lifecycle and budget accounting |
| WP06 Clinical oversight | Clinical safety lead | WP02 WP04 | Review, escalation, composition controls and safety case handling |
| WP07 External exchange | Integration lead | WP02 WP03 WP04 | MIS and EHR adapters, ABDM role paths, receipts and reconciliation |
| WP08 Offline client and sync | Mobile lead | WP01 WP02 WP03 | Encrypted storage, signed lease, durable queue and ordered sync recovery |
| WP09 Care coordination | Care workflow lead | WP03 WP04 WP06 WP07 | Referrals, directory, tasks, assignment and evidence-backed outcomes |
| WP10 Operational measures | Data lead | WP03 WP07 WP09 | Versioned report definitions, projections, privacy controls and exports |
| WP11 Release and support | Operations lead | WP02 WP05 WP07 WP08 WP09 WP10 | Release configuration, training, monitoring, backup, incident and exit processes |

## Increment sequence

### Increment 1 Identity and safe records

Dependency WP01 WP02 WP03

Deliverable Login, assigned synthetic person, draft observation, review and confirmed revision; audit and outbox atomicity

Review demonstration Demonstrate wrong-person denial, idempotent retry and a concurrent amendment

### Increment 2 Programme reuse

Dependency WP04 with WP03

Deliverable Versioned maternal, TB and hypertension packs, reusable facts and unresolved questions

Review demonstration Complete J01 without duplicate eligible entry and without inventing missing facts

### Increment 3 Bounded AI

Dependency WP05 WP06

Deliverable Typed plan, eligible provider manifests, two adapter simulators and review states

Review demonstration Demonstrate refusal, bad quality, disagreement, stale approval and suspension

### Increment 4 Destination exchange

Dependency WP07 with WP02

Deliverable Two programme adapters, separate receipts, selected EHR or ABDM route

Review demonstration Prove accepted-but-timeout reconciliation and business correction

### Increment 5 Field continuity

Dependency WP08 WP09

Deliverable Encrypted Android cache, signed lease, sync conflicts and owned referrals

Review demonstration Recover interrupted capture and sync while urgent approved care remains available

### Increment 6 Operations and pilot

Dependency WP10 WP11

Deliverable Governed measures, support, training, release manifest and restoration

Review demonstration Execute G4 and G5 evidence package before real deployment

## Repository and ownership proposal

| Area | Content | Primary reviewer |
| --- | --- | --- |
| clients/android | Capture, local transaction store, key handling, offline sync and accessibility | Mobile and security |
| clients/admin | Supervisor, registry, connector, evidence and support screens | Product and operations |
| server/domain | Typed entities, commands, policy guards and revision rules | Backend and clinical informatics |
| server/workers | AI dispatch, destination exchange, reconciliation, exports and projections | Integration and reliability |
| contracts | Internal OpenAPI, events, manifests, mappings and version tests | API and informatics owners |
| infrastructure | Environment, identity, secrets, backup, telemetry and deployment manifests | Security and operations |
| validation | Synthetic fixtures, contract tests, failure injection and release evidence references | QA and clinical safety |

## Definition of ready

A backlog item is ready when its source requirement, intended actor, screen or interface, input/output contract, denial paths, state changes, dependency and acceptance evidence are understood. For partner work, the approved contract and environment access must exist; otherwise build only a clearly identified simulator and keep the external dependency open. Clinical content needs a named clinical owner before implementation of thresholds or recommendations.

## Definition of done

1. Code implements the requirement and its adverse path, with no hidden expansion of data access or clinical scope.

2. A reviewer verifies state guards, schema and compatibility. Sensitive changes receive the required independent clinical or security review.

3. Applicable tests run on a identified build and environment; evidence and defects are linked to the workbook row. Source requirement and design trace remain intact.

4. User copy, accessibility, localisation and offline/error states are reviewed where relevant. Telemetry and runbook actions are ready.

5. Migration, rollout and rollback are tested to the extent required by the change. No unresolved critical safety, disclosure or data-loss defect remains.

6. Product owner accepts the result. Release-gate status is updated only when the associated external and operational prerequisites are also met.

## Dependency and decision management

The critical path runs through deployment authority, actual programme forms, system-owner API access, clinical capability evidence and a working referral network. Discover these in parallel with foundational engineering. Delayed provider or EHR access should not block synthetic identity and transaction tests, but must block claims of full integration completion.

| Decision | Proposed baseline | Owner | Closure gate |
| --- | --- | --- | --- |
| D01 Buyer and deployment authority | One state or implementation organisation | Sponsor | G1 |
| D02 Pilot location and cohort | One district and 100 to 200 workers | Operations | G1 |
| D03 Programme selection | Maternal health TB hypertension | Programme owners | G1 |
| D04 Two live destinations | Candidate systems only | Integration owner | G2 |
| D05 AI providers and clinical use | Two providers with at least one eligible health capability | AI governance | G3 |
| D06 Clinical authority | Qualified clinical lead and referral network | Buyer | G1 |
| D07 Languages | Hindi and English subject to local suitability | Operations | G1 |
| D08 Processing basis | Per purpose organisation recipient | Privacy lead | G2 |
| D09 Hosting locations | Buyer-approved processing regions | Security lead | G4 |
| D10 Device and authentication | Supported Android with individual accounts | Operations | G4 |
| D11 Offline limits | 24 hour lease and 500 MB media allowance | Privacy and operations | G4 |
| D12 Retention | Per record class and applicable obligation | Privacy lead | G4 |
| D13 Work to retire | Duplicate forms and application steps | Sponsor | G5 |
| D14 Model evidence thresholds | Per capability and intended local use | Clinical safety | G3 |
| D15 Success measures | BRD proposed targets | Product and MEL | G5 |
| D16 Pricing and charges | Deployment recurring and usage charges | Sponsor | Commercial scale |
| D17 Evaluation sandbox relationship | Versioned evidence import only | AI governance | G3 |
| D18 Patient messaging | Later scope | Product and privacy | R2 |
| D19 ABDM role and module | Select explicit ABHA HIP HIU modules | ABDM owner | G2 |
| D20 Reference EHR | One owner-authorised system | Buyer and integration | G2 |
| D21 Exchange standards | Pin compatible packages and terminology | Clinical informatics | G2 |

## Planning and cost model

Estimate each work package after a short implementation spike and partner contract review. Separate build effort, recurring platform cost, provider usage, integration maintenance, field support and independent evaluation. Track calls per completed encounter, media bytes, retry amplification, reconciliation workload and support minutes. Costs should be reported per confirmed encounter and per completed intended workflow, with failed attempts included.

The sponsor must name which existing duplicate activities can be retired. Without permission to stop or reconcile the old process, a new application can increase worker burden despite technically correct integration. D13 is therefore a pilot readiness dependency, not a post-launch optimisation.

## Change control

A change request states the user problem, affected BRD IDs, scope, data flow, clinical impact, contract version, migration and test evidence. Update the BRD only through its owner. Preserve stable IDs and add a supersession record for changed requirements. Re-baseline dependent FSD, API, workbook and release evidence together; never quietly edit one artefact into conflict with the others.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
