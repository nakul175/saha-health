# Original target design — 07_Test-Strategy_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/07_Test-Strategy_v1.0.docx)

Test Strategy

Verification plan linking the BRD to functional, adverse-condition, quality and journey tests.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 07 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Test baseline and status

The catalogue contains 364 test definitions: two per each of the 176 BRD requirements, plus 12 end-to-end journeys. All application test definitions start as Not run. A fixture recipe is a setup instruction, not an executed test or a real clinical dataset. Reference checks supplied with the pack validate selected document, schema and in-memory invariants only; their execution evidence is kept separately in engineering/VALIDATION.md.

| Layer | Purpose | Evidence |
| --- | --- | --- |
| Contract and unit | Validate schema, transition and policy boundaries | Pinned input, result, assertion and build version |
| Component | Exercise database transaction, outbox, sync and provider worker | Actual persistence and failure injection traces |
| Integration | Prove each authorised partner operation and receipt | Owner-approved environment and external transaction evidence |
| End to end | Follow role, person, data and action through a journey | UI/API observations and independent state checks |
| Clinical and usability | Assess intended use, language, review and escalation | Approved evaluation protocol and accountable review |
| Operational and nonfunctional | Measure load, security, offline custody, restore and support | Declared workload, raw samples, quantiles and recovery evidence |

## Quality requirement methods

### NFR 01 Core availability

Source target The central platform shall target 99.5 percent monthly availability for core authenticated record and workflow services. Report planned maintenance and upstream outages separately; publish a second end-to-end measure including dependencies.

Measurement Measure successful authenticated core probes and real requests over a calendar month; publish planned maintenance and dependency failures separately.

Failure challenge Inject an upstream outage; do not omit it from the end-to-end availability view.

Acceptance Synthetic probes, error logs and incident records reconcile to a monthly report with transparent exclusions.

Trace TC-NFR-01-A / TC-NFR-01-B

### NFR 02 Responsive field interface

Source target On the reference device, local field saves shall complete within 500 ms at the 95th percentile and cached patient or task screens within 2 seconds. Connected core screens shall target 3 seconds at the 95th percentile under the reference network.

Measurement Run the BRD reference device and network profile; collect at least 1000 timings per tested path and report median p95 p99 and errors.

Failure challenge Repeat at degraded bandwidth and latency; do not apply reference-network targets to a different test silently.

Acceptance Instrument representative tasks under R1 load and report failed requests and slow outliers, not just averages.

Trace TC-NFR-02-A / TC-NFR-02-B

### NFR 03 Visible AI progress

Source target An online AI task shall acknowledge its state within 2 seconds and display progress or an honest pending state. Each capability shall have an approved completion deadline; a default interactive deadline of 30 seconds is proposed, with longer asynchronous tasks clearly identified.

Measurement Time acknowledgement and progress updates for synchronous and long-running AI calls; measure provider latency separately.

Failure challenge Delay a provider beyond its deadline; show timeout or pending state without fabricated completion.

Acceptance Timeout and delayed-provider tests show usable status and preserve the underlying encounter workflow.

Trace TC-NFR-03-A / TC-NFR-03-B

### NFR 04 No loss of acknowledged local work

Source target Acknowledged local saves shall survive application crash, routine restart and temporary power loss on supported devices. No record may be marked saved before durable persistence. Device destruction remains outside this guarantee until synchronisation.

Measurement Inject process kills router restart storage-full and power-loss simulations around acknowledged local commits.

Failure challenge Destroy unsynchronised device storage; report the excluded failure and recovery limit explicitly.

Acceptance Fault injection recovers all acknowledged records and identifies any unacknowledged inputs as unsaved.

Trace TC-NFR-04-A / TC-NFR-04-B

### NFR 05 Duplicate safe execution

Source target Repeated delivery, retries and replay of the same logical action shall not create duplicate business events where the connector contract supports idempotency or reconciliation. Unsupported cases shall remain unresolved instead of being blindly retried.

Measurement Replay at least 10000 action deliveries with timeouts before and after external acceptance and compare destination counts.

Failure challenge Use a destination without deduplication or status lookup; require unresolved review rather than blind retry.

Acceptance At least 10000 replay and timeout test events produce no duplicate accepted activity in the supported connector fixtures.

Trace TC-NFR-05-A / TC-NFR-05-B

### NFR 06 Server recovery

Source target The proposed server recovery point objective is at most 15 minutes and recovery time objective at most 4 hours. The accepted architecture may improve these limits. Locally queued work shall reconcile after recovery rather than being discarded.

Measurement Restore database and object references from a timed backup checkpoint; measure actual data loss and recovery elapsed time.

Failure challenge Lose the newest backup and repeat; disclose any RPO or RTO breach.

Acceptance A documented restore exercise measures actual recovery, integrity and replay of affected outstanding work.

Trace TC-NFR-06-A / TC-NFR-06-B

### NFR 07 Data integrity

Source target Confirmed records shall retain referential integrity, valid units and complete version history through capture, sync, amendment and export. Checks shall detect orphan identities, missing receipts and invalid state transitions.

Measurement Run referential, version and receipt reconciliation across migration and failure fixtures and count orphaned records.

Failure challenge Inject a missing person dependency and orphan media key; quarantine without silent data loss.

Acceptance Release reconciliation covers every generated record in the migration and failure test corpus, with zero unexplained loss.

Trace TC-NFR-07-A / TC-NFR-07-B

### NFR 08 Security release posture

Source target Production shall have no unresolved critical or high-severity exploitable findings within the agreed security assessment scope. Findings must be remediated or the affected capability removed before launch.

Measurement Run independent security assessment and verify all applicable critical or high exploitable findings closed or feature removed.

Failure challenge Leave one release-blocking finding open; the release gate must fail.

Acceptance Independent review covers access control, mobile storage, APIs, secrets, file access, agent tool abuse and tenant isolation.

Trace TC-NFR-08-A / TC-NFR-08-B

### NFR 09 Online revocation

Source target Role removal or account suspension shall stop new online access and actions within 5 minutes. A disconnected device is constrained by its offline grant and local lock policy; it cannot be promised immediate remote revocation.

Measurement Suspend sessions and service accounts during active requests and queues; timestamp last allowed action and first denial.

Failure challenge Keep an offline device disconnected; report residual access until lease expiry rather than claiming immediate revocation.

Acceptance Session, background job and reconnect tests enforce the limit and record the residual offline window.

Trace TC-NFR-09-A / TC-NFR-09-B

### NFR 10 Audit completeness and timing

Source target All mandatory audit events shall be durable before or atomically with the consequential action where feasible. If durable audit cannot be established, external writes and privileged changes shall stop. Local capture may continue with its local audit queue.

Measurement Correlate all tested material commands with durable audit records and verify a crash cannot commit only one side.

Failure challenge Force audit write failure at commit; block the consequential action.

Acceptance Audit-store failure blocks the designated actions, while recovery preserves event order and detects clock skew.

Trace TC-NFR-10-A / TC-NFR-10-B

### NFR 11 Offline capacity and controlled storage

Source target The reference device shall retain 200 structured unsynchronised encounters plus 100 media items of up to 4 MB each within a proposed 500 MB data allowance. Capability-approved media formats take precedence; larger media require a separately accepted profile.

Measurement Store 200 unsynced structured encounters and 100 media items up to 4 MB each within the 500 MB reference allowance.

Failure challenge Approach capacity with oversized media; prevent new capture and preserve pending work.

Acceptance Capacity, low-storage and restart tests show warnings and no silent deletion of unsynchronised data.

Trace TC-NFR-11-A / TC-NFR-11-B

### NFR 12 Synchronisation recovery

Source target On stable reconnection, 95 percent of eligible structured records in a 200-record queue shall reach the platform within 5 minutes under reference network conditions. Media and external destination acceptance have separate measures.

Measurement Sync a 200-record structured queue under the BRD reference network and time the 95th percentile eligible arrival.

Failure challenge Add an authorisation rejection; report it separately rather than miscount it as successful sync.

Acceptance Queue tests measure completion, rejected records, permission rechecks and remaining unresolved items.

Trace TC-NFR-12-A / TC-NFR-12-B

### NFR 13 Accessibility

Source target Web workflows shall target WCAG 2.2 AA; mobile workflows shall implement corresponding applicable principles and native accessibility support [S6]. Essential tasks shall support readable scaling, labelled controls, focus navigation and non-colour status cues.

Measurement Combine automated accessibility scans with keyboard screen-reader scaling and non-colour task testing.

Failure challenge Complete a core flow with no pointer and large text; any blocked action fails accessibility acceptance.

Acceptance Automated assessment plus manual assistive-technology and representative-user testing covers all core journeys.

Trace TC-NFR-13-A / TC-NFR-13-B

### NFR 14 Usability and training burden

Source target At least 90 percent of representative participants shall complete core tasks without facilitator intervention after standard training. Record errors, recovery time and programme understanding, not only task speed.

Measurement Evaluate at least 20 representative frontline workers and 5 supervisors on unassisted core tasks after standard training.

Failure challenge Include error recovery and device-unfamiliar participants; disclose subgroup failure rather than aggregate it away.

Acceptance Proposed evaluation includes at least 20 representative frontline users and 5 supervisors, with results disaggregated by language and device familiarity.

Trace TC-NFR-14-A / TC-NFR-14-B

### NFR 15 Language quality

Source target Critical UI, counselling and escalation content shall receive qualified human review in each supported language. Numeric extraction, negation and clinical terms require task-specific evaluation; aggregate speech word error rate alone is insufficient.

Measurement Use reviewed language fixtures for clinical negation units dates names and mixed-language speech.

Failure challenge Translate a safety-critical string incorrectly; block that language workflow until corrected.

Acceptance Reviewers accept the language corpus, and all safety-critical benchmark cases meet the approved pass criteria.

Trace TC-NFR-15-A / TC-NFR-15-B

### NFR 16 AI extraction quality

Source target The proposed administrative extraction target is at least 95 percent precision and recall for required nonclinical fields on a representative annotated corpus. Critical clinical fields require confirmation regardless of extraction score; clinical model targets remain capability-specific.

Measurement Measure precision and recall on an independently annotated representative administrative extraction set; report missingness and corrections.

Failure challenge Run ambiguous clinical fields; require confirmation regardless of extraction confidence.

Acceptance Report field-level errors, language and noise subgroups, missingness and correction burden against a versioned test set.

Trace TC-NFR-16-A / TC-NFR-16-B

### NFR 17 Clinical and agent safety evaluation

Source target The release suite shall include all approved critical scenarios for escalation, role boundaries, wrong-patient context, unsupported use and adversarial instructions. All release-blocking cases must pass; passing the suite is not proof of zero clinical risk.

Measurement Execute approved wrong-patient, role-boundary, emergency, unsupported-use and prompt-injection scenarios.

Failure challenge Retain one release-blocking safety failure; production gate remains closed.

Acceptance Named reviewers sign the results and link every unresolved lower-severity issue to an owner and disposition.

Trace TC-NFR-17-A / TC-NFR-17-B

### NFR 18 Operational observability

Source target Major platform, queue or connector failures shall generate an actionable alert within 5 minutes of detection criteria being met. Traces shall link a user task to provider calls and destination receipts without exposing unnecessary clinical content.

Measurement Seed provider failure queue stall and permission error events and time delivery to the correct accountable alert queue.

Failure challenge Disable one telemetry collector; surface the observability gap rather than report healthy service.

Acceptance Induced failures reach the correct queue and permit reconstruction using redacted diagnostic data.

Trace TC-NFR-18-A / TC-NFR-18-B

### NFR 19 Maintainable configuration

Source target Common content, language, indicator and workflow changes shall follow versioned configuration paths where possible. They shall not require ad hoc database edits or undocumented production scripts.

Measurement Publish and roll back a real versioned configuration change through the release workflow.

Failure challenge Apply an undocumented direct database change; flag drift and block release attestation.

Acceptance A programme change is reviewed, tested, deployed and rolled back through the documented operating process.

Trace TC-NFR-19-A / TC-NFR-19-B

### NFR 20 Integration conformance

Source target Every live connector and provider adapter shall pass the agreed contract suite, including invalid data, permissions, timeout, duplicate requests and incompatible versions. External conformance requirements shall be version-pinned where applicable.

Measurement Run owner-agreed positive and negative connector contracts with pinned schemas and exact external environment evidence.

Failure challenge Pass local mocks only; live integration conformance remains unverified.

Acceptance Test results are linked to the exact deployed connector, mapping and provider versions.

Trace TC-NFR-20-A / TC-NFR-20-B

### NFR 21 Cost transparency

Source target At least 99 percent of billable AI and communication events shall be attributable to a tenant, capability and task or explicit system activity. Budget alerts and hard limits shall use the defined safety-aware fallback.

Measurement Reconcile usage events against provider invoices or test billing records by tenant capability and task.

Failure challenge Introduce a duplicate charge or missing attribution; report the discrepancy.

Acceptance Usage records reconcile with provider invoices or test billing evidence; unexplained variance is investigated.

Trace TC-NFR-21-A / TC-NFR-21-B

### NFR 22 Data portability and export integrity

Source target Authorised structured records shall be exportable with identifiers, relationships, units, provenance and version metadata. Export format documentation shall enable an independent party to interpret the data.

Measurement Export and reimport 1000 synthetic persons with relationships units provenance and revision history; reconcile counts and references.

Failure challenge Omit one relationship or unit code; fail integrity acceptance.

Acceptance A 1000-person test export is re-imported into a validation environment with complete record counts and relationships.

Trace TC-NFR-22-A / TC-NFR-22-B

### NFR 23 Disaster and downtime readiness

Source target Operations shall have tested procedures for platform outage, lost device, unavailable model, destination failure and clinical service disruption. Emergency care guidance shall remain available through the approved local contingency process.

Measurement Run a tabletop plus technical outage exercise including lost device failed provider and clinical downtime path.

Failure challenge Simulate an unavailable referral service; preserve the local approved escalation route and unresolved owner.

Acceptance Tabletop and technical exercises record actual recovery actions, communication ownership and unresolved gaps.

Trace TC-NFR-23-A / TC-NFR-23-B

### NFR 24 Scale readiness

Source target Before expanding to a proposed 10000 workers and 5 million person records, the product shall pass a separate capacity and operating-cost review. R1 performance evidence shall not be presented as proof of national-scale readiness.

Measurement Run a separately provisioned R2 load test for proposed 10000 workers and 5 million persons; report infrastructure and costs.

Failure challenge Extrapolate R1 latency without an R2 run; do not mark scale readiness passed.

Acceptance R2 load, isolation, storage, support and cost tests are run against the agreed production-like topology and volume.

Trace TC-NFR-24-A / TC-NFR-24-B

### NFR 25 Clinical exchange validation

Source target One hundred percent of outbound structured clinical exchange payloads shall pass the pinned schema, profile, terminology and business-rule checks before submission. Validation warnings that are accepted by policy shall remain visible and versioned.

Measurement Validate every supported outbound artefact against the pinned profile terminology and business-rule suite.

Failure challenge Inject invalid code reference cardinality signature and bundle structure cases; all must be blocked.

Acceptance Verification: The release corpus covers every supported artefact and includes invalid cardinality, code, reference, unit, signature and bundle cases.

Trace TC-NFR-25-A / TC-NFR-25-B

### NFR 26 Consent and exchange traceability

Source target Every ABDM or direct EHR exchange shall be traceable from user purpose and authority through request, transformation, disclosure or receipt, acknowledgement and final state without placing raw clinical payloads in general application logs.

Measurement Reconstruct each release-test exchange from purpose and authority through request validation receipt and final status.

Failure challenge Remove a consent or source reference; fail traceability without logging raw payloads to repair the gap.

Acceptance Verification: Audit reconstruction succeeds for all release exchanges, while log inspection confirms that secrets, tokens and unnecessary clinical content are absent.

Trace TC-NFR-26-A / TC-NFR-26-B

### NFR 27 Connector upgrade compatibility

Source target A connector or FHIR package upgrade shall pass regression tests for existing mappings, queued actions, receipts, amendments and historical display before activation. In-flight work shall finish on its compatible version or enter controlled review.

Measurement Upgrade adapter and FHIR packages with old queued actions historical results and amendment fixtures present.

Failure challenge Introduce a breaking schema change; incompatible work pauses without reinterpretation.

Acceptance Verification: A simulated breaking version change does not corrupt queued work or silently reinterpret historical records.

Trace TC-NFR-27-A / TC-NFR-27-B

### NFR 28 Interoperability performance

Source target Under the R1 workload, canonical transformation and local validation shall add no more than 500 ms at the 95th percentile for structured records, excluding external network and destination processing time. Batch and document workflows shall have separately declared targets.

Measurement Measure local canonical transformation and validation p95 under the R1 workload, excluding network and destination processing.

Failure challenge Add external latency to the local measurement or hide a slow adapter; fail the measurement-method review.

Acceptance Verification: Instrumented tests report transformation, validation, queue and external latency separately for each connector type.

Trace TC-NFR-28-A / TC-NFR-28-B

## Functional and journey execution

Use the Test Catalogue sheet as the controlled execution record. Every row has source ID, design ID, fixture, preconditions, steps, expected result, status, owner, evidence and defect. Replace a fixture recipe with a versioned executable fixture before running the corresponding application test. Where an expected result requires a destination receipt or clinical assessment, a local mock cannot satisfy that part of acceptance.

| Journey | Primary risk exercised | Execution scope |
| --- | --- | --- |
| J01 Multi programme home visit | One confirmed encounter; separate accepted or unresolved destination states; no duplicate entry of an eligible shared fact. | Deployment-approved scope; J12 follows R2 |
| J02 Cough analysis within screening | Invocation and result or failure are traceable; any care decision records its human or approved protocol authority. | Deployment-approved scope; J12 follows R2 |
| J03 Offline capture and partial synchronisation | No duplicate destination action and no loss of acknowledged work; unresolved outcomes have owners. | Deployment-approved scope; J12 follows R2 |
| J04 Repair an incorrect patient link | Identity history and all downstream impacts are visible; any incomplete external correction remains open. | Deployment-approved scope; J12 follows R2 |
| J05 Onboard and suspend a provider | Provider history, activation evidence, suspension scope and follow-up work are reproducible. | Deployment-approved scope; J12 follows R2 |
| J06 Review programme service gaps | The same versioned inputs reproduce the report and any resulting assignments. | Deployment-approved scope; J12 follows R2 |
| J07 Withdraw permission before upload | No new unauthorised disclosure; downstream disposition status reflects actual evidence. | Deployment-approved scope; J12 follows R2 |
| J08 Multi AI clinical consultation and EHR update | Signed clinical decision, EHR receipts and any ABDM publication state are independently traceable. | Deployment-approved scope; J12 follows R2 |
| J09 Consented ABDM retrieval and publication | Every disclosure and receipt is tied to current authority; local care continues where permitted if exchange is unavailable. | Deployment-approved scope; J12 follows R2 |
| J10 Cross facility referral and diagnostic return | Sent, received, scheduled, attended, resulted and closed states reflect distinct evidence. | Deployment-approved scope; J12 follows R2 |
| J11 Coordinated chronic care follow up | Each programme action and EHR update retains independent status and ownership. | Deployment-approved scope; J12 follows R2 |
| J12 Supervisor outreach planning | Every proposed and confirmed assignment has a reason, owner and later outcome; no automated sanction occurs. | Deployment-approved scope; J12 follows R2 |

## Test data design

1. Create two isolated synthetic tenants and roles with overlapping visible names but distinct IDs. Include an unassigned person, provisional identity, disputed identifier and shared household phone.

2. Use deterministic synthetic dates, measurements, recording placeholders and provider outputs. Do not imply these values or mock outcomes are clinical evidence. Label every fixture environment.

3. Build paired normal and adverse variants: wrong person, revoked authority, stale observation, changed pack, duplicate callback, accepted-but-timed-out destination, provider suspension and lost device.

4. For language extraction, obtain an approved representative evaluation set with appropriate authority; include negation, dialect, numbers, dates and code-switching. Synthetic prompts alone cannot establish field performance.

5. Keep media and clinical evaluation data under the approved access and retention controls. Record provenance, split policy and leakage prevention for any model evaluation.

## Failure injection matrix

| Fault | Injection point | Required invariant |
| --- | --- | --- |
| Crash after local commit | Before client response | Retry returns durable draft without duplicate |
| Crash before external response | After destination may accept | Reconcile before resending |
| Concurrent observation amendment | After plan approval | Changed snapshot blocks execution |
| Consent withdrawal | Between queueing and dispatch | No new disclosure without a current valid basis |
| Duplicate callback | Before and after final result | One selected result and one settlement |
| Partial sync dependency | Parent rejected; child pending | Child cannot bind to wrong or missing record |
| Outbox redelivery | Consumer commit acknowledgement lost | Projection does not double count |
| Expired device lease | Disconnected device with changed time | Private data locks and stale actions remain blocked |
| Backup restore | Isolated recovery environment | Custody, audit, receipt and outbox consistency restored |

## Entry and exit criteria

Entry requires a versioned build, approved test scope, reproducible fixtures, named test owners and a resettable environment. Exit requires evidence for each mandatory in-scope requirement, no unresolved critical safety or isolation defect, verified uncertain-write recovery, reviewed NFR results and explicit disposition of every failure or blocked test. Should requirements require a recorded product decision; a blank status cannot be interpreted as a pass.

A journey can demonstrate orchestration with simulators before partner access exists. G2 and G3 remain blocked until actual integration and capability evidence is accepted. A narrower field pilot must be named and approved as a reduced-scope experiment; it does not pass the full R1 release gate.

## Defect and evidence management

Defects record affected requirement, build, environment, reproducible inputs, actual result, severity, safety impact, containment and owner. Evidence links must point to access-controlled immutable or versioned records. Redact patient content from general issue trackers. On a retest, retain failed evidence and append the new result rather than replace history. Release reviewers inspect both status totals and unresolved high-impact cases.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
