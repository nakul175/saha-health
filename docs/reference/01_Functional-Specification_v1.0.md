# Original target design — 01_Functional-Specification_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/01_Functional-Specification_v1.0.docx)

Functional Specification

Detailed behaviour for the worker workspace, provider orchestration, programme exchange and administration.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 01 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Reading and scope

Read a journey to understand the user outcome, then the corresponding module and screen. Each FR below links to one business requirement and two test definitions. Quality requirements are expanded in the Test Strategy. API family references in the workbook indicate related operations, not a claim that every access or operational control is a standalone endpoint.

| Release | Functional scope | Boundary |
| --- | --- | --- |
| R1 | Maternal, TB and hypertension pilot; capture and reuse; two AI providers; two programme destinations; selected EHR or ABDM route | Only locally approved programme and capability combinations are enabled |
| R2 | Additional programmes, messaging and richer supervisory assistance where the BRD assigns later scope | Illustrative facility journeys do not automatically expand the R1 clinical deployment |

## Shared interaction rules

1. Select a person and encounter before entering sensitive content. The person strip remains visible through capture, review, AI and submission. Changing person suspends the current draft and invalidates any unsent action selection tied to it.

2. Capture creates draft facts. The worker reviews extracted numbers, dates, names, negation and source time. A missing answer remains an explicit absence reason. An AI-generated fact is never silently treated as a measurement.

3. Reuse considers meaning, time, unit, episode, provenance, freshness and purpose. Similar labels alone are insufficient. Programmes can share a fact while still requiring different declarations or actions.

4. Confirmation binds the actor to an exact encounter revision. Each planned disclosure shows its destination, purpose, selected data and unresolved prerequisites. The UI reports durable local saving, server acceptance and destination acceptance separately.

5. Urgent approved protocol actions remain accessible when optional AI fails. No model output alone closes a referral, issues a diagnosis or creates a clinical order outside the actor’s scope.

## Detailed user journeys

### J01 Multi programme home visit

Actor and screens ASHA worker · SCR01 SCR02 SCR03 SCR04 SCR05 SCR07

Source BR-UX-01 BR-DATA-01 BR-PROG-05 BR-INT-05

1. Open assigned household work and choose one person; the system verifies assignment and shows source freshness.

2. Confirm the person and start an encounter. Maternal, TB and hypertension packs contribute their eligible questions.

3. Capture the narrative once. The extractor returns draft fields with source spans; the worker corrects uncertain values.

4. The question assembler reuses eligible existing facts and asks only unresolved or genuinely distinct questions.

5. Run eligible AI support where permitted. Present the source facts, independent results and consolidated actions for review.

6. Confirm the encounter and authorised programme actions. Submit each destination separately and display its receipt.

7. Assign every open referral or rejected submission to a responsible person or monitored queue.

Exceptions A destination timeout leaves only that action uncertain. Patient ambiguity stops disclosure. Urgent approved protocol actions take precedence over forms.

Completion One confirmed encounter; separate accepted or unresolved destination states; no duplicate entry of an eligible shared fact.

### J02 Cough analysis within screening

Actor and screens Permitted worker and clinical reviewer · SCR03 SCR06 SCR05

Source BR-AI-02 BR-AI-06 BR-CLIN-03

1. Check that the patient, language, recording method and device are within the selected capability approval.

2. Explain the optional recording and record the required permission without blocking ordinary screening when declined.

3. Capture the signal using provider-approved instructions and confirm patient context.

4. Evaluate input quality, upload only permitted fields and create a version-pinned request with a deadline.

5. Validate the response and display result, limitations and quality state separately from diagnosis.

6. Apply the locally approved pathway and route any clinical decision to the appropriate reviewer.

Exceptions Unusable audio returns retry guidance. Provider failure and inability to assess never become a negative screen.

Completion Invocation and result or failure are traceable; any care decision records its human or approved protocol authority.

### J03 Offline capture and partial synchronisation

Actor and screens ASHA worker and sync service · SCR03 SCR09 SCR07

Source BR-OFF-02 BR-OFF-05 BR-INT-04

1. Obtain a signed scoped offline lease while online and cache the assigned records and approved protocols.

2. Capture the encounter into an encrypted local transaction. Show saved on device only after commit.

3. Queue dependent commands with stable IDs and explicit person and encounter dependencies.

4. On reconnection recheck lease, assignment, identity links, consent, versions and input freshness.

5. Accept valid local records and dispatch only eligible destination actions. Destination A accepts; B times out.

6. Reconcile B using its stable external reference; retry only when non-acceptance is established.

7. Return per-item receipts and conflicts to the device. Retain pending work until its server receipt is durable.

Exceptions Expired authority cancels pending optional uploads. Low storage preserves acknowledged records. Conflicts enter review.

Completion No duplicate destination action and no loss of acknowledged work; unresolved outcomes have owners.

### J04 Repair an incorrect patient link

Actor and screens Identity steward and programme owner · SCR17 SCR14 SCR07

Source BR-ID-08 BR-DATA-06 BR-SEC-08

1. Report the suspected mismatch and place affected future disclosures on hold.

2. Compare original identity sources with restricted access and confirm the correct person or preserve uncertainty.

3. Append a superseding link record with reason and reviewer; retain the original link history.

4. Use lineage to identify affected observations, model requests, plans and external submissions.

5. Invalidate pending approvals and generate destination-specific correction tasks.

6. Record external repair receipts or the remaining assisted correction obligation.

Exceptions A steward without external amendment authority routes to the programme owner. Existing accepted records are not silently reassigned.

Completion Identity history and all downstream impacts are visible; any incomplete external correction remains open.

### J05 Onboard and suspend a provider

Actor and screens Provider owner AI governance and clinical safety · SCR19 SCR20 SCR21

Source BR-AI-01 BR-AI-04 BR-AI-10

1. Register the provider and immutable manifest version in a synthetic test space.

2. Run schema, quality, correlation, retry and timeout contract tests.

3. Review hosting, retention, intended use, evidence and local clinical deployment scope.

4. Activate the approved version only for its named deployment and population.

5. Monitor errors, drift signals, cost and safety cases with defined escalation owners.

6. When a material issue occurs suspend new calls, assess running work and identify affected encounters.

7. Require corrective evidence and fresh review before a corrected version is activated.

Exceptions An API test alone does not enable live clinical use. An unapproved alternative provider cannot silently take over.

Completion Provider history, activation evidence, suspension scope and follow-up work are reproducible.

### J06 Review programme service gaps

Actor and screens Programme manager · SCR13 SCR12

Source BR-REP-02 BR-REP-03 BR-REP-04

1. Choose an approved metric definition, reporting period and permitted programme scope.

2. Resolve the cohort and distinguish people, encounters and accepted programme events.

3. Display source refresh times, exclusions, denominator and incomplete feeds.

4. Apply suppression and prevent disclosure through repeated filter differences.

5. Open person-level follow-up only when a separate permission permits it.

6. Assign operational review work with an owner and reason; retain the exact report version.

Exceptions Unavailable ground truth produces an unsupported answer. A report cannot automatically sanction workers or deny care.

Completion The same versioned inputs reproduce the report and any resulting assignments.

### J07 Withdraw permission before upload

Actor and screens Patient through authorised worker · SCR11 SCR09

Source BR-SEC-03 BR-OFF-04

1. Find the specific purpose and authority record used for a queued recording.

2. Record the verified withdrawal and its effective time.

3. Block local queued media immediately where the device knows of the withdrawal.

4. On reconnection invalidate server-side pending calls and propagate the changed authority state.

5. Dispose the recording under the approved retention policy or record an independent hold.

6. If already received externally, initiate and track the recipient restriction or disposal request.

Exceptions Disconnected copies cannot be claimed erased instantly. Withdrawal of optional AI use leaves the approved underlying care workflow available.

Completion No new unauthorised disclosure; downstream disposition status reflects actual evidence.

### J08 Multi AI clinical consultation and EHR update

Actor and screens Nurse and clinician · SCR10 SCR06 SCR07

Source BR-AI-09 BR-CLIN-05 BR-INT-21

1. Open the authorised EHR person context and reconcile it with the local encounter.

2. Record history and observations once with device associations and source times.

3. Invoke approved retinal and ECG capabilities separately using their required inputs.

4. Display the original traces or images, provider versions, limitations and independent outputs.

5. The clinician records their interpretation and signs the care plan and permitted orders.

6. Prepare and validate EHR writes; display business receipts and preserve any version conflict.

7. Prepare ABDM clinical artefacts only through the separately enabled HIP scope.

Exceptions Unsupported media requires recapture. Rejection of one EHR record does not reverse other accepted records.

Completion Signed clinical decision, EHR receipts and any ABDM publication state are independently traceable.

### J09 Consented ABDM retrieval and publication

Actor and screens Authorised facility clinician · SCR11 SCR10 SCR07

Source BR-INT-13 BR-INT-15 BR-INT-18 BR-INT-19

1. Verify deployment module role, facility identity and the patient ABHA linkage through approved flows.

2. Request the minimum record types and period required for the stated care purpose.

3. Track consent approval and verify artefact scope, expiry, provider and requester.

4. Receive and decrypt through the authorised exchange adapter, then validate the returned bundles.

5. Present source provenance and dates without overwriting local observations.

6. After care create the reviewed clinical document and make it available through the configured HIP pathway.

7. Retain request, consent, validation, acknowledgement and publication references in the restricted audit chain.

Exceptions Denied, expired or revoked consent stops new retrieval. Wrong-person or invalid bundles are quarantined.

Completion Every disclosure and receipt is tied to current authority; local care continues where permitted if exchange is unavailable.

### J10 Cross facility referral and diagnostic return

Actor and screens Referring worker and receiving clinician · SCR08 SCR10 SCR14

Source BR-CARE-03 BR-INT-12 BR-INT-20

1. Prepare a referral with verified identity, minimum necessary clinical context and an accountable owner.

2. Send through the destination supported route and record acknowledgement.

3. The receiving service records assessment, attendance and result in its own authoritative system.

4. Receive the result through the authorised EHR, ABDM or controlled document route.

5. Match the result to the correct person, referral and source version; quarantine mismatches.

6. Create the next task and close only with verified service outcome or coded unresolved disposition.

Exceptions A destination without structured referral support uses labelled assisted hand-off. Missing attendance or result leaves work open.

Completion Sent, received, scheduled, attended, resulted and closed states reflect distinct evidence.

### J11 Coordinated chronic care follow up

Actor and screens Worker clinician and patient · SCR01 SCR04 SCR08 SCR10

Source BR-PROG-04 BR-CARE-05 BR-INT-21

1. Identify compatible due tasks for a person in hypertension and diabetes care.

2. Read permitted history with dates and source systems visible.

3. Contact through the approved worker or patient channel respecting shared-phone preferences.

4. Ask the combined approved questions and record any new measurements with current timestamps.

5. Prepare appointments, medication-access tasks or clinical review requests for authorised confirmation.

6. Write each reviewed update through its supported destination and assign unresolved follow-up.

Exceptions An old EHR measurement cannot substitute for a required new observation. Concerning answers route to a qualified person.

Completion Each programme action and EHR update retains independent status and ownership.

### J12 Supervisor outreach planning

Actor and screens Block supervisor · SCR12 SCR13

Source BR-REP-06 BR-AG-11 BR-RULE-08

1. Select authorised operational measures and current worker availability.

2. Find overdue visits and unresolved referrals using governed definitions.

3. Remove duplicate people from compatible task groups while preserving separate care reasons.

4. Show missing sources, stale directory entries and uncertainty in the proposed allocation.

5. The supervisor reviews and confirms assignments within permitted scope.

6. Workers receive tasks and later record outcomes linked to the report and allocation version.

Exceptions ABDM HIU permission is not general population analytics authority. Small cohorts remain protected.

Completion Every proposed and confirmed assignment has a reason, owner and later outcome; no automated sanction occurs.

## Functional modules and requirements

### UX Encounter workspace

The workspace opens on assigned work. The worker selects a person before capture. A fixed patient strip shows local ID, age basis, active encounter and connection state. Voice and text populate reviewable fields. Confirmed values, unresolved fields, AI outputs and proposed actions remain separate.

Opening a second person suspends the first draft. Saving acknowledges durable local or server persistence explicitly. Confirmation presents one encounter bundle with destination and purpose per action. Deselecting an action keeps it pending; it never silently fills a mandatory answer.

A interrupted recording retains only committed chunks. A low-confidence name, negation, number or date is flagged for review. Screen readers receive textual status updates; colour alone never conveys success. Offline actions show their local state and cannot imply external acceptance.

#### FR UX 01 One task entry point

Trace BR-UX-01 · Must · R1 · WP03

Required outcome The worker shall start a visit, follow-up or screening from one workspace. Eligible programme activities and AI functions shall appear within that task without requiring the worker to select a vendor application.

Design rule The home screen groups tasks by person and encounter. Provider selection remains behind an eligible capability action.

Acceptance The approved multi-programme journey completes through one authenticated workspace with no separate AI login or manual transfer of patient details.

Adverse scenario Disable one programme destination while another remains available; the visit remains usable and displays the missing route.

Tests TC-BR-UX-01-A / TC-BR-UX-01-B

#### FR UX 02 Clear patient and visit context

Trace BR-UX-02 · Must · R1 · WP03

Required outcome The interface shall show the active person and visit throughout capture, model use and action review. Changing patients shall explicitly close or suspend the current context and clear uncommitted cross-person inputs.

Design rule Every patient-specific request carries person and encounter IDs validated against the active session context.

Acceptance Patient-switch tests cannot attach the prior person's recording, answer or AI result to the next person.

Adverse scenario Switch patients with an unsaved voice draft; the old draft must not appear in the new encounter.

Tests TC-BR-UX-02-A / TC-BR-UX-02-B

#### FR UX 03 Voice text and guided entry

Trace BR-UX-03 · Must · R1 · WP03

Required outcome Workers shall be able to speak, type or use structured questions for the same core workflow. Voice shall be optional; background listening shall be disabled. Users shall control recording, playback and deletion before submission.

Design rule Voice capture has visible start, stop, playback and discard actions; the same fields accept typed or guided input.

Acceptance A user completes each pilot journey without using a microphone and can review or correct a voice-derived value before confirmation.

Adverse scenario Deny microphone permission and complete the encounter with guided input.

Tests TC-BR-UX-03-A / TC-BR-UX-03-B

#### FR UX 04 Structured encounter summary

Trace BR-UX-04 · Must · R1 · WP03

Required outcome The workspace shall display confirmed facts, uncertain facts, missing information and proposed actions as separate readable elements. A conversational answer shall not be the only way to discover task status.

Design rule The summary has confirmed facts, unresolved facts, recommendations and external actions as four distinct groups.

Acceptance Usability participants can identify the next required step and each unresolved field without searching a transcript.

Adverse scenario Supply an uncertain date and an AI suggestion; neither may render as a confirmed observation.

Tests TC-BR-UX-04-A / TC-BR-UX-04-B

#### FR UX 05 Language and accessibility

Trace BR-UX-05 · Must · R1 · WP03

Required outcome The pilot shall support approved interface, speech and content languages, initially Hindi and English if suitable for the selected site. Critical content shall have reviewed translations. Numeric values, units and names shall survive language changes.

Design rule Language is a user preference; concepts and numeric values are language-neutral. Reviewed clinical strings have version IDs.

Acceptance The same encounter retains meaning across supported languages and passes the defined accessibility and language-specific task tests.

Adverse scenario Switch language after entering a decimal measurement; the value and unit remain identical.

Tests TC-BR-UX-05-A / TC-BR-UX-05-B

#### FR UX 06 Status that reflects reality

Trace BR-UX-06 · Must · R1 · WP03

Required outcome The application shall distinguish saved on device, saved on server, awaiting review, submitted, accepted, rejected and unresolved. A general completion tick shall never imply that every destination accepted a record.

Design rule Show one state per destination plus a separate encounter-save state. Completion derives from required actions.

Acceptance Simultaneous success in one programme and failure in another produces separate visible statuses and a specific recovery action.

Adverse scenario Accept destination A and reject B; no overall all-submitted status may appear.

Tests TC-BR-UX-06-A / TC-BR-UX-06-B

#### FR UX 07 Resume interrupted work

Trace BR-UX-07 · Must · R1 · WP03

Required outcome An interrupted visit shall reopen at its last durable state with captured data, outstanding questions and pending actions. Users shall not repeat a successfully recorded measurement solely because a screen or connection was lost.

Design rule Persist a draft revision after each committed field change and store the last completed workflow step.

Acceptance App restart, incoming call and network-loss scenarios retain every field previously shown as durably saved.

Adverse scenario Terminate the application after a successful local save and before sync; reopen the same draft revision.

Tests TC-BR-UX-07-A / TC-BR-UX-07-B

#### FR UX 08 Low literacy and field use

Trace BR-UX-08 · Should · R1 · WP03

Required outcome Common actions shall use short labels, clear touch targets and a small number of steps. Audio guidance shall be available only on demand to avoid disclosure in a shared setting. Progress shall not rely on colour alone.

Design rule Critical actions use short labels and text plus icon status. Optional audio guidance stops before private playback.

Acceptance Representative workers complete the principal tasks under the defined field usability protocol, including noisy and private-entry conditions.

Adverse scenario Use the flow with colour perception disabled and a shared-device privacy setting; status remains understandable.

Tests TC-BR-UX-08-A / TC-BR-UX-08-B

#### FR UX 09 Explainable action review

Trace BR-UX-09 · Must · R1 · WP03

Required outcome Before committing consequential actions, users shall see what will happen, the receiving organisation and the information involved in language suited to their role. Safe routine actions may be grouped by encounter under configured policy.

Design rule Approval review lists purpose, recipient and exact record revisions. The worker can exclude an optional action.

Acceptance A worker can exclude one proposed destination or edit one fact before confirming the remaining permitted action bundle.

Adverse scenario Change the recipient after approval; execution must require a fresh review.

Tests TC-BR-UX-09-A / TC-BR-UX-09-B

### ID Identity and caseload

Every login resolves a verified workforce principal and active deployment membership. Roles, programme assignments, facilities and patient relationships constrain requests. Household membership is a relationship record, never permission to view every member.

Search is limited to permitted records and returns possible matches with masked comparison fields. The worker confirms a match or creates a provisional local person. An external identifier link is a separate versioned record with issuer, verification evidence and dispute history.

Ambiguous matches cannot be auto-merged. Reassignment transfers open tasks with acknowledgement and revokes prior access. Recovery verifies workforce identity through the institution. It cannot use patient information or a shared household number as proof.

#### FR ID 01 Workforce lifecycle

Trace BR-ID-01 · Must · R1 · WP01

Required outcome The platform shall support invitation or approved import, identity verification, role assignment, activation, suspension, reassignment and removal. Every account shall belong to an accountable organisation; shared credentials shall not be the operating model.

Design rule Membership activation follows institutional verification; suspension increments a revocation version consumed by all services.

Acceptance A suspended user's online access and pending privileged actions are revoked within the NFR limit, with offline limits disclosed.

Adverse scenario Suspend a user with an active browser session and queued work; new online actions stop within the BRD limit.

Tests TC-BR-ID-01-A / TC-BR-ID-01-B

#### FR ID 02 Scoped permissions

Trace BR-ID-02 · Must · R1 · WP01

Required outcome Access shall be constrained by tenant, role, assignment, programme, facility or geography, purpose and action. The server shall enforce the effective permission set for reads, writes, searches, exports and tool calls.

Design rule Policy input includes tenant, active role, assignment, programme, facility, purpose, action and resource sensitivity.

Acceptance Negative tests cover each boundary and prove that hidden screens or manipulated requests cannot expand access.

Adverse scenario Guess a valid record ID outside the assigned caseload; deny access without revealing record content.

Tests TC-BR-ID-02-A / TC-BR-ID-02-B

#### FR ID 03 Authentication and recovery

Trace BR-ID-03 · Must · R1 · WP01

Required outcome Workers shall use an approved authentication method appropriate to devices and connectivity. Privileged roles require a second factor. Recovery and device replacement shall verify identity and revoke superseded credentials.

Design rule Use verified institutional authentication. Privileged users require MFA and recovery invalidates old sessions and devices.

Acceptance Recovery cannot be completed using patient data or a shared phone number alone; privileged access remains blocked without the required factor.

Adverse scenario Attempt recovery using only a known patient number; the request must fail.

Tests TC-BR-ID-03-A / TC-BR-ID-03-B

#### FR ID 04 Caseload assignment and transfer

Trace BR-ID-04 · Must · R1 · WP01

Required outcome Households, patients and tasks shall have effective assignment dates and responsible teams. Transfer shall preserve open work, restrict former access and identify unresolved responsibility gaps.

Design rule Assignment changes carry effective dates and an explicit list of transferred open tasks with receiving ownership.

Acceptance Transferring a worker's caseload moves eligible open tasks, records acknowledgement and prevents duplicate ownership or orphaned urgent tasks.

Adverse scenario Transfer a caseload with an unresolved urgent task; the task cannot become unassigned.

Tests TC-BR-ID-04-A / TC-BR-ID-04-B

#### FR ID 05 Patient matching with human resolution

Trace BR-ID-05 · Must · R1 · WP01

Required outcome The platform shall search permitted records using identifiers and selected demographics, present possible matches and support uncertain identities. A name or phone number alone shall not trigger an automatic merge.

Design rule Matching returns candidates with evidence and score only as assistance; a verified link needs an authorised person decision.

Acceptance Same-name, shared-phone, spelling-variant and twin cases remain distinct unless an authorised reviewer resolves the identity link.

Adverse scenario Create twins with the same address and shared phone; no automatic merge may occur.

Tests TC-BR-ID-05-A / TC-BR-ID-05-B

#### FR ID 06 Local registration without national identifier

Trace BR-ID-06 · Must · R1 · WP01

Required outcome A person shall be able to receive a local record and permitted workflow without an ABHA number, personal phone or biometric identifier. External identity linking shall be a separate authorised process.

Design rule Create a local UUID before external linking. Required local demographics permit explicit unknown where programme rules allow.

Acceptance A person lacking all three completes an eligible pilot encounter without a fabricated external identifier.

Adverse scenario Register a person with no ABHA or phone; allow local care capture without invented identifiers.

Tests TC-BR-ID-06-A / TC-BR-ID-06-B

#### FR ID 07 Household and proxy boundaries

Trace BR-ID-07 · Must · R1 · WP01

Required outcome Household relationships, caregivers and authorised representatives shall be recorded separately from account access. A family contact number shall not grant access to a member's private history or authorise disclosure.

Design rule Proxy relationship includes relationship type, authority scope and evidence; household membership does not populate access grants.

Acceptance A caregiver and household head can receive only the information permitted by the relevant relationship and authorisation rules.

Adverse scenario A household head requests another adult member private visit; deny without valid proxy authority.

Tests TC-BR-ID-07-A / TC-BR-ID-07-B

#### FR ID 08 Correctable identity links

Trace BR-ID-08 · Must · R1 · WP01

Required outcome External programme identifiers shall retain issuer, verification state and link history. Wrong matches, merges and transfers require a controlled correction process that preserves original references and downstream impact.

Design rule Link correction appends a superseding relationship and generates a downstream repair list from lineage records.

Acceptance An authorised correction unlinks the wrong identity, flags affected submissions and records which external changes remain unresolved.

Adverse scenario Correct an external link after accepted submissions; preserve original receipts and create repair tasks.

Tests TC-BR-ID-08-A / TC-BR-ID-08-B

#### FR ID 09 Service accounts and delegation

Trace BR-ID-09 · Must · R1 · WP01

Required outcome Connectors and automated tasks shall use individually managed service identities with limited scope, expiry and an accountable owner. A worker's session shall not become a reusable unrestricted credential for an agent.

Design rule Service identities have specific audiences and tools, rotated credentials and expiry; user tokens never become provider credentials.

Acceptance Revoking a connector credential stops its new calls without disabling unrelated connectors; audit identifies both initiating user and executing service.

Adverse scenario Use a revoked connector credential for another connector; both delegation and audience checks deny it.

Tests TC-BR-ID-09-A / TC-BR-ID-09-B

#### FR ID 10 Organisational federation

Trace BR-ID-10 · Should · R2 · WP01

Required outcome Where approved by the buyer, enterprise sign-in and authoritative workforce registries shall supply identity and role updates. Local emergency administration shall remain controlled and auditable.

Design rule Federated groups map through reviewed local role mappings; an external group cannot grant an unmapped clinical privilege.

Acceptance An upstream removal or scope change is reflected within the approved synchronisation window, including termination of incompatible sessions.

Adverse scenario Change an upstream group to an unrecognised role; local privileged access must not expand.

Tests TC-BR-ID-10-A / TC-BR-ID-10-B

### DATA Capture and reusable facts

A reusable fact is identified by person, concept, episode or encounter context, effective time, unit, source and verification. The question assembler joins equivalent programme needs but preserves distinct eligibility declarations. Reuse checks freshness and permitted purpose at each destination.

Extraction creates a draft observation. Confirmation creates an immutable revision with the reviewer. An amendment supersedes a revision; affected pending actions and recommendations return to review. A shared value never loses the original source or destination mapping version.

Unknown, refused, not asked and not applicable have explicit absence codes. Concurrent revisions yield a conflict record. The reviewer can retain both observations when they represent different times or meanings rather than force a false merge.

#### FR DATA 01 Shared question assembly

Trace BR-DATA-01 · Must · R1 · WP03

Required outcome The platform shall combine required questions from applicable programme packs and avoid asking an identical eligible fact twice in one encounter. It shall preserve separate questions where programme meanings differ.

Design rule Question equivalence requires the same semantic concept, person, episode, time window, unit and permitted purpose.

Acceptance The approved three-programme fixture asks each shared concept once and retains every distinct mandatory programme-specific question.

Adverse scenario Give two similarly named fields with different reporting periods; they remain separate questions.

Tests TC-BR-DATA-01-A / TC-BR-DATA-01-B

#### FR DATA 02 Source and timing for every fact

Trace BR-DATA-02 · Must · R1 · WP03

Required outcome Reusable observations shall retain person, concept, value, unit, time, source, author and verification state. Unknown, not asked, refused and not applicable shall be separate responses.

Design rule Each observation includes effective_at, recorded_at, source_type, verification, author and either value or absent_reason.

Acceptance Each destination field can be traced to the confirmed source fact or a documented transformation; missing data is never converted to a negative finding.

Adverse scenario Send both a value and a refusal code; reject the contradictory observation.

Tests TC-BR-DATA-02-A / TC-BR-DATA-02-B

#### FR DATA 03 Speech extraction as a draft

Trace BR-DATA-03 · Must · R1 · WP03

Required outcome Speech and free text may populate draft fields, but uncertain negations, numbers, medicines, dates and identities shall be surfaced for correction. Derived values shall not be presented as direct measurements.

Design rule Extraction stores original segment references and draft confidence markers; confirmation is an explicit separate command.

Acceptance A test set containing negation, mixed language, background speakers and ambiguous quantities produces reviewable fields and no unconfirmed authoritative write.

Adverse scenario Transcribe a negated symptom and an ambiguous number; neither can silently become a confirmed positive fact.

Tests TC-BR-DATA-03-A / TC-BR-DATA-03-B

#### FR DATA 04 Freshness and relevance

Trace BR-DATA-04 · Must · R1 · WP03

Required outcome Each programme or capability shall specify which prior inputs can be reused and their allowed age. The workspace shall distinguish a historical value from a new observation and request remeasurement where the approved rule requires it.

Design rule Freshness is evaluated from effective time against the active pack requirement, not server receipt time.

Acceptance An expired measurement is excluded from a time-sensitive model call even if it is the latest value available.

Adverse scenario Upload an old measurement today; it must remain historical and cannot satisfy a new-measurement requirement.

Tests TC-BR-DATA-04-A / TC-BR-DATA-04-B

#### FR DATA 05 Validation without fabrication

Trace BR-DATA-05 · Must · R1 · WP03

Required outcome Range, unit, logical and cross-field checks shall flag implausible or incomplete inputs. A worker may record an unusual confirmed measurement with a reason where policy permits, but cannot silently bypass a mandatory validation.

Design rule Validation returns field paths and reason codes. Permitted outlier overrides require a scoped reviewer and reason.

Acceptance Invalid units block submission; a permitted override retains the original value, reason and reviewer identity.

Adverse scenario Submit an unsupported unit or impossible date; block submission without coercing the value.

Tests TC-BR-DATA-05-A / TC-BR-DATA-05-B

#### FR DATA 06 Traceable amendments

Trace BR-DATA-06 · Must · R1 · WP03

Required outcome Confirmed records shall be corrected by amendment with actor, time and reason. Existing accepted submissions shall be identified for downstream correction; prior versions remain available under the retention policy.

Design rule Amendment records supersedes_id and reason. Lineage locates dependent plans, model results and submissions.

Acceptance Correcting a key fact reveals all dependent AI results and submissions, marks invalidated outputs and creates the necessary reconciliation tasks.

Adverse scenario Amend a fact used in a pending order; invalidate approval and require re-evaluation.

Tests TC-BR-DATA-06-A / TC-BR-DATA-06-B

#### FR DATA 07 Concurrent edits

Trace BR-DATA-07 · Must · R1 · WP03

Required outcome Conflicting edits from workers, devices or external sources shall be detectable. Clinically meaningful conflicts shall require authorised resolution rather than silent overwrite.

Design rule Compare expected record version before commit. Store both candidate revisions and a conflict object on collision.

Acceptance Two offline edits to the same observation produce a visible conflict with both versions, and no unsafe destination update is committed before resolution.

Adverse scenario Sync two devices with contradictory edits; no silent overwrite may occur.

Tests TC-BR-DATA-07-A / TC-BR-DATA-07-B

#### FR DATA 08 Documents and media

Trace BR-DATA-08 · Must · R1 · WP03

Required outcome Attachments shall be linked to a person and encounter, checked for supported type and quality, and governed by purpose and retention. Extraction from an image or document shall remain distinguishable from a verified clinical entry.

Design rule Media progresses through uploaded, scanned, quality_checked and available. Extracted fields preserve source offsets.

Acceptance A low-quality image cannot silently generate confirmed values; deleting an unsubmitted recording removes the associated draft references.

Adverse scenario Attach a wrong-person or unscanned document; prevent provider invocation and authoritative write.

Tests TC-BR-DATA-08-A / TC-BR-DATA-08-B

#### FR DATA 09 Authoritative field mapping

Trace BR-DATA-09 · Must · R1 · WP03

Required outcome Each connector shall use a reviewed mapping from common facts to destination definitions, codes and units. Mapping versions shall be recorded with submissions and effective dates.

Design rule Mapping packages contain source field, target field, transformation, unit and null semantics plus conformance fixtures.

Acceptance A mapping change passes owner-approved fixtures and does not reinterpret earlier accepted records without a documented migration.

Adverse scenario Remove a target mandatory field in a new mapping; activation must fail and queued work stay on a compatible version.

Tests TC-BR-DATA-09-A / TC-BR-DATA-09-B

#### FR DATA 10 Selective permitted reuse

Trace BR-DATA-10 · Must · R1 · WP03

Required outcome Data reuse shall be evaluated per destination and purpose. One valid use shall not authorise sharing with every connected programme or vendor.

Design rule Each action creates a field allowlist from the approved destination and purpose; a source fact can have several permitted uses.

Acceptance A fact approved for one task is excluded from another provider's payload when that second use lacks the required permission.

Adverse scenario Reuse a permitted clinical fact for an unapproved provider purpose; omit it and block an invalid payload.

Tests TC-BR-DATA-10-A / TC-BR-DATA-10-B

#### FR DATA 11 Controlled migration

Trace BR-DATA-11 · Should · R2 · WP03

Required outcome Legacy imports shall support dry runs, data-quality reports, duplicate review and source lineage. A bulk import shall not automatically create programme enrolment or change a clinician's recorded decision.

Design rule Migration runs produce source totals, parsed totals, rejected rows, duplicate candidates and reversible import batch IDs.

Acceptance A migration sample reconciles source counts, rejects, merges and accepted records, with a reversible process for failed batches.

Adverse scenario Repeat a batch containing duplicate people; report candidates without creating duplicate official enrolments.

Tests TC-BR-DATA-11-A / TC-BR-DATA-11-B

#### FR DATA 12 Measurement of actual reuse

Trace BR-DATA-12 · Must · R1 · WP03

Required outcome The platform shall count opportunities for reuse, successful reuse, repeated questions and reasons reuse was blocked. Metrics shall exclude facts that are genuinely different in meaning or time.

Design rule Reuse opportunities are logged before question display, with reasons for reuse, recapture or blocked reuse.

Acceptance Auditors can reproduce a sample reuse calculation from event records and separate avoidable re-entry from clinically required recapture.

Adverse scenario Count clinically new measurements as duplicate-entry savings; the metric must exclude them.

Tests TC-BR-DATA-12-A / TC-BR-DATA-12-B

### PROG Programme configuration and due work

Programme packs contain a versioned question catalogue, episode model, eligibility rules, schedules, role boundaries, escalation routes, destination mappings and indicators. A deployment activates a reviewed version for a defined population and effective date.

Maternal care tracks a pregnancy episode and outcomes. TB screening records symptoms and permitted screening support separately from diagnosis and official registration. Hypertension follow-up records measurements and reported treatment; only an authorised clinician can issue a clinical order.

An unavailable pack stays inactive. Missing required dates remain unknown. A protocol update retains historical decisions and identifies affected open cases. A programme enrolment remains pending until the authoritative programme supplies acceptance.

#### FR PROG 01 Versioned programme packs

Trace BR-PROG-01 · Must · R1 · WP04

Required outcome Each pack shall define population, eligibility, questions, mandatory evidence, authorised roles, workflow states, escalation, destination mappings and indicators. Activation requires named business and clinical approvals where applicable.

Design rule Activation requires valid schemas, approved mappings, effective dates and named programme and clinical approvals.

Acceptance An incomplete or unapproved pack cannot be activated, and each completed encounter records the pack version used.

Adverse scenario Activate a pack with an unsigned escalation rule; it must remain unavailable.

Tests TC-BR-PROG-01-A / TC-BR-PROG-01-B

#### FR PROG 02 Maternal health workflow

Trace BR-PROG-02 · Must · R1 · WP04

Required outcome The maternal pack shall support pregnancy episode confirmation, permitted visit history, due activities, approved symptom questions, missed visits, counselling and referral or supervisor review. It shall handle unknown dates and pregnancy outcomes without assuming an ongoing pregnancy.

Design rule Maternal records use an episode identifier and outcome state; unknown dates are stored as unknown with task follow-up.

Acceptance Approved normal, uncertain, overdue, escalated and closed-episode scenarios follow the correct workflow and preserve episode identity.

Adverse scenario Record a completed pregnancy outcome; suppress future tasks for the closed episode without erasing history.

Tests TC-BR-PROG-02-A / TC-BR-PROG-02-B

#### FR PROG 03 TB screening workflow

Trace BR-PROG-03 · Must · R1 · WP04

Required outcome The TB pack shall support authorised symptom screening, relevant history, optional eligible AI assistance, referral preparation and follow-up of testing or care milestones. Screening output shall remain separate from confirmed diagnosis and official programme registration.

Design rule TB screening and programme registration are separate workflows with separate confirmation and receipt states.

Acceptance A low-risk AI output cannot suppress a referral required by the approved symptom protocol, and an unresolved result remains visible for follow-up.

Adverse scenario Return a low-risk model output while the approved symptom rule escalates; retain the escalation.

Tests TC-BR-PROG-03-A / TC-BR-PROG-03-B

#### FR PROG 04 Hypertension follow up workflow

Trace BR-PROG-04 · Must · R1 · WP04

Required outcome The hypertension pack shall support protocol-authorised measurements, medication history as reported, adherence discussion, scheduled review and escalation. Prescription changes and clinical orders require a qualified authorised user.

Design rule Measurements include device or observer, time, unit and context. Reported medicines are not signed prescriptions.

Acceptance Worker tests cannot issue or amend a prescription, and measurements retain unit, time, context and source.

Adverse scenario A frontline worker attempts a medication order; reject the command and retain the report as history.

Tests TC-BR-PROG-04-A / TC-BR-PROG-04-B

#### FR PROG 05 Cross programme scheduling

Trace BR-PROG-05 · Must · R1 · WP04

Required outcome The platform shall combine due activities into a person or household visit plan where timing and privacy permit, while retaining each programme's completion criteria and owner.

Design rule Scheduling joins compatible tasks into a visit plan while preserving programme due dates and completion conditions.

Acceptance One visit completes eligible shared tasks, leaves incomplete activities open and does not duplicate a referral merely because two packs identify it.

Adverse scenario Combine two tasks with incompatible timing or privacy constraints; they must not be silently treated as one.

Tests TC-BR-PROG-05-A / TC-BR-PROG-05-B

#### FR PROG 06 Eligibility and enrolment distinction

Trace BR-PROG-06 · Must · R1 · WP04

Required outcome The platform may identify eligibility and prepare enrolment, but official enrolment shall require the destination's acceptance and any programme-specific authorisation.

Design rule Enrolment stores eligibility_assessment and external_registration independently; only a verified receipt confirms the latter.

Acceptance A person whose external enrolment is rejected remains locally visible with a clear rejection reason and no false enrolled status.

Adverse scenario Reject external enrolment; the local record remains visible as not externally enrolled.

Tests TC-BR-PROG-06-A / TC-BR-PROG-06-B

#### FR PROG 07 Protocol change and case continuity

Trace BR-PROG-07 · Must · R1 · WP04

Required outcome Pack changes shall have an effective date, affected population, change summary and transition rule for open cases. Historical actions shall retain the rules in force when they occurred.

Design rule Pack migration computes affected open cases and applies an approved transition plan at an effective timestamp.

Acceptance Updating a referral rule identifies affected open work and requires reviewed migration rather than silently rewriting past decisions.

Adverse scenario Load a new rule version during an open visit; do not silently reinterpret already approved actions.

Tests TC-BR-PROG-07-A / TC-BR-PROG-07-B

#### FR PROG 08 Additional programme packs

Trace BR-PROG-08 · Should · R2 · WP04

Required outcome The platform shall support later packs for immunisation, child health, diabetes or other buyer-approved needs using the same configuration and review process. Their adoption is subject to workflow and integration readiness.

Design rule Additional packs use the same schema with their own definitions and reviewed value sets; pack IDs remain stable across versions.

Acceptance A new pack can reuse common identity and observations while defining independent schedules, role boundaries and destination rules.

Adverse scenario Install a new pack with a conflicting concept definition; validation requires explicit separation or reviewed mapping.

Tests TC-BR-PROG-08-A / TC-BR-PROG-08-B

### AG Bounded agent execution

The agent produces a typed plan against a registered tool catalogue. Each step names its purpose, input revisions, capability or connector version, authority class, dependencies and expected result. A separate policy service authorises every execution.

The planner may retrieve permitted context, ask missing questions, prepare drafts and invoke approved tools. Consequential actions bind approval to the exact plan snapshot and input versions. Checkpoints persist before and after side effects; execution resumes only unfinished work.

Injected instructions in notes or tool output are data. Unsupported actions are rejected. Limits cover time, steps, tokens, retries and cost. Provider disagreement creates a review item with separate outputs; no combined clinical score is invented.

#### FR AG 01 Bounded task planning

Trace BR-AG-01 · Must · R1 · WP05

Required outcome The agent shall plan within an approved task catalogue and the user's current authority. It shall state what it can complete, what information is missing and which steps require human action.

Design rule Plan nodes are typed tool calls with dependencies, limits and authority class. Free text cannot create a new action type.

Acceptance An out-of-scope request receives a clear limitation or referral to the correct role and does not trigger an improvised external action.

Adverse scenario Ask the agent to pay benefits or issue an out-of-scope prescription; no tool action is created.

Tests TC-BR-AG-01-A / TC-BR-AG-01-B

#### FR AG 02 Context restricted to the task

Trace BR-AG-02 · Must · R1 · WP05

Required outcome The agent shall retrieve only the records and fields needed for the current purpose. Session memory shall be separated by tenant, person and encounter; patient details shall not become unrestricted global memory.

Design rule Retrieve only authorised fields referenced by the current task; cache keys include tenant, person, purpose and policy version.

Acceptance A cross-patient prompt cannot retrieve another person's information without a separately authorised task and permission check.

Adverse scenario Inject another patient ID through a prompt; retrieval is denied before a model receives content.

Tests TC-BR-AG-02-A / TC-BR-AG-02-B

#### FR AG 03 Eligibility before tool selection

Trace BR-AG-03 · Must · R1 · WP05

Required outcome Tool selection shall first apply jurisdiction, role, intended use, population, input quality, evidence status, consent or other authorisation, language and connectivity constraints. Cost and speed can rank only eligible tools.

Design rule The eligibility filter precedes cost or latency ranking and records excluded tools with machine-readable reasons.

Acceptance A cheaper or available tool with an incompatible approved use is never substituted into the workflow.

Adverse scenario Choose a cheaper model outside its approved age or language scope; the router must exclude it.

Tests TC-BR-AG-03-A / TC-BR-AG-03-B

#### FR AG 04 Approved execution paths

Trace BR-AG-04 · Must · R1 · WP05

Required outcome The agent shall use a defined tool catalogue with validated inputs and outputs. Retrieved text, documents and model responses shall be treated as content, not as authority to grant access or change execution policy.

Design rule Tool arguments validate against closed schemas; executable action names are resolved only from the trusted registry.

Acceptance Instructions embedded in a patient note or provider output cannot activate a new tool, reveal credentials or bypass a confirmation.

Adverse scenario Embed a tool instruction inside an EHR note; it cannot alter the tool catalogue or permissions.

Tests TC-BR-AG-04-A / TC-BR-AG-04-B

#### FR AG 05 Human authority at action boundaries

Trace BR-AG-05 · Must · R1 · WP05

Required outcome The platform shall distinguish draft preparation, routine authorised recording and consequential clinical or external actions. Actions shall require the confirmation and professional authority defined in Section 21.

Design rule Approval hashes bind actor, resource versions, action, recipient, purpose and capability versions; the executor checks them.

Acceptance The agent cannot make itself the approving actor, and expired approvals cannot be reused for changed data or a different destination.

Adverse scenario Replay an approval after changing a clinical fact; reject as stale.

Tests TC-BR-AG-05-A / TC-BR-AG-05-B

#### FR AG 06 Durable progress and recovery

Trace BR-AG-06 · Must · R1 · WP05

Required outcome The agent shall retain the state of each step, its outcome and dependencies so an interrupted task can resume without duplicating completed external actions.

Design rule Persist a checkpoint and action identity for each step. Resume reads receipts before selecting pending steps.

Acceptance A failure after one destination accepts a record does not repeat that submission; the user sees and can recover only unfinished steps.

Adverse scenario Crash after destination acceptance but before UI update; recovery must reconcile rather than submit twice.

Tests TC-BR-AG-06-A / TC-BR-AG-06-B

#### FR AG 07 Limits and cancellation

Trace BR-AG-07 · Must · R1 · WP05

Required outcome Every task shall have limits on time, tool calls, retries and spend. Users shall be able to stop pending activity. Cancelling cannot falsely reverse an action already accepted elsewhere.

Design rule Enforce max_steps, deadline and budget in the executor independently of model output; cancellation records residual work.

Acceptance A looping provider interaction stops at the configured limit and reports which actions completed, were cancelled or remain unresolved.

Adverse scenario Force a recursive tool loop; stop at the configured bound with a visible incomplete state.

Tests TC-BR-AG-07-A / TC-BR-AG-07-B

#### FR AG 08 Conflicting outputs

Trace BR-AG-08 · Must · R1 · WP05

Required outcome Contradictory or incomparable model outputs shall be shown as such and routed according to approved policy. The agent shall not average risk scores, invent a consensus or suppress a qualifying warning unless a validated composition explicitly permits it.

Design rule Store each model result separately. A conflict policy creates a human review task for incompatible outputs.

Acceptance A designed model-disagreement case produces a review task with both original outputs and no fabricated combined diagnosis.

Adverse scenario Return opposite risk outputs; no fabricated average or consensus diagnosis may appear.

Tests TC-BR-AG-08-A / TC-BR-AG-08-B

#### FR AG 09 Evidence behind explanations

Trace BR-AG-09 · Must · R1 · WP05

Required outcome Explanations shall identify the relevant recorded facts, protocol or model and any material uncertainty. They shall not claim certainty from model confidence or supply unsupported clinical advice.

Design rule Recommendation records contain source fact IDs and rule or model version references; unsupported text is excluded.

Acceptance Reviewers can trace each consequential recommendation to its underlying rule or approved output; unsupported answers are withheld or escalated.

Adverse scenario Request an explanation that is unsupported by the record; show uncertainty or route for review.

Tests TC-BR-AG-09-A / TC-BR-AG-09-B

#### FR AG 10 Clinical workflow continuity without an LLM

Trace BR-AG-10 · Must · R1 · WP05

Required outcome Loss of the language model shall not prevent structured capture, access to valid cached protocols, a local draft referral or visibility of urgent tasks. The interface shall make unavailable functions explicit.

Design rule Structured capture, cached approved guidance and draft referrals operate without a model dependency.

Acceptance A simulated LLM outage leaves the core non-generative encounter workflow usable without substituting invented AI results.

Adverse scenario Disable the LLM service during a visit; approved non-generative functions remain available.

Tests TC-BR-AG-10-A / TC-BR-AG-10-B

#### FR AG 11 Programme manager analysis

Trace BR-AG-11 · Should · R2 · WP05

Required outcome Authorised managers may request questions over approved datasets and metric definitions. The agent shall disclose the cohort, time period, data freshness, filters and method, and enforce the same restrictions as standard reporting.

Design rule Natural language reporting resolves to approved metric IDs and filters, then applies the same report policy checks.

Acceptance A natural-language count matches the governed report and cannot expose restricted patient lists through a reformulated query.

Adverse scenario Ask for a hidden patient list through an aggregate question; reject the disclosure.

Tests TC-BR-AG-11-A / TC-BR-AG-11-B

#### FR AG 12 Change control for the agent

Trace BR-AG-12 · Must · R1 · WP05

Required outcome Material changes to prompts, tool descriptions, routing rules, model versions and knowledge sources shall be versioned and tested against the release suite. Production learning from user interactions shall not silently change behaviour.

Design rule Agent release manifests pin prompts, tools, safety tests, model release IDs and rollback compatibility.

Acceptance Operators can identify the exact configuration behind an encounter and restore a previously approved configuration after a regression.

Adverse scenario Change a prompt or model alias without release review; production activation must fail.

Tests TC-BR-AG-12-A / TC-BR-AG-12-B

### AI Provider registry and invocation

Each provider capability has a immutable version manifest containing intended use, excluded populations, input schema, output schema, evidence references, hosting, retention, approved deployment scopes, contract limits and an operational contact.

Registration is followed by contract validation, privacy review, clinical review where applicable and deployment activation. Invocation checks eligibility, reserves an approved budget, sends a minimal payload and validates the returned result. Version and input hash remain attached to the result.

Poor signal quality, unsupported use, timeout and inability to assess remain distinct. A suspended version rejects new calls and flags open work. Provider self-service is limited to its synthetic test space. Undeclared release changes pause the affected capability.

#### FR AI 01 Capability registration

Trace BR-AI-01 · Must · R1 · WP05

Required outcome Every capability shall have an accountable provider, a stable identity, version, purpose, input and output definitions, deployment scope, evidence, operating limits and a support contact. Clinical and administrative capabilities shall be clearly distinguished.

Design rule A manifest version is immutable and owned by one verified provider; missing evidence keeps its activation state incomplete.

Acceptance Registration cannot reach an active state while mandatory manifest fields or accountable ownership are missing.

Adverse scenario Register a capability without input schema or accountable owner; reject activation.

Tests TC-BR-AI-01-A / TC-BR-AI-01-B

#### FR AI 02 Intended use and excluded use

Trace BR-AI-02 · Must · R1 · WP05

Required outcome Each capability shall specify authorised users, populations, age range where relevant, settings, languages, devices, required input quality and excluded uses. Eligibility shall be machine-checkable where possible and explicitly reviewable elsewhere.

Design rule Eligibility predicates cover role, age basis, population, language, device, geography, quality and required history.

Acceptance A capability approved for adults cannot run on a child case unless that use has separate approval.

Adverse scenario Invoke an adult-only model for a child or unknown age when age is required; return unsupported-case.

Tests TC-BR-AI-02-A / TC-BR-AI-02-B

#### FR AI 03 Evidence and deployment authorisation

Trace BR-AI-03 · Must · R1 · WP05

Required outcome Evidence records shall identify model version, evaluation context, limitations and review decisions. Regulatory status and local deployment authorisation shall be recorded separately from technical integration and sandbox evaluation.

Design rule Evidence and approval are distinct records tied to provider version, population, study setting and deployment scope.

Acceptance A technically successful API test cannot activate a clinical capability without the required documented evidence and deployment approvals.

Adverse scenario Provide only an API success log as evidence; clinical activation remains blocked.

Tests TC-BR-AI-03-A / TC-BR-AI-03-B

#### FR AI 04 Capability lifecycle

Trace BR-AI-04 · Must · R1 · WP05

Required outcome The lifecycle shall cover registered, technically verified, under review, approved for a scope, active, suspended, retired and replaced. Activation shall be deployment-specific and allow trial or shadow status without exposing unapproved results to care.

Design rule Lifecycle transitions require scoped roles; registration and deployment approval are independent permissions.

Acceptance A provider cannot self-activate; suspension blocks new invocations and identifies in-progress work requiring cancellation or review.

Adverse scenario Provider owner tries to activate their own version in a live tenant; deny the transition.

Tests TC-BR-AI-04-A / TC-BR-AI-04-B

#### FR AI 05 Contract validation

Trace BR-AI-05 · Must · R1 · WP05

Required outcome Adapters shall validate required inputs, accepted types, ranges, units, response states and result semantics. Binary media requirements and large or asynchronous responses shall be documented.

Design rule Validate request and response against pinned schemas, request correlation, media format and result semantics.

Acceptance Malformed or unsupported responses are quarantined with an actionable error and cannot be presented as a valid clinical result.

Adverse scenario Return a success response missing mandatory result fields; quarantine it as invalid response.

Tests TC-BR-AI-05-A / TC-BR-AI-05-B

#### FR AI 06 Input quality and inability to assess

Trace BR-AI-06 · Must · R1 · WP05

Required outcome The workflow shall check signal quality and record insufficient-input, unsupported-case, unavailable and unable-to-assess states separately from a low-risk or negative result.

Design rule Capture quality failures carry retry guidance from approved provider instructions and do not yield clinical risk values.

Acceptance A noisy cough recording produces a quality failure or valid retry instruction, never an implied negative screen.

Adverse scenario Send unusable cough audio; no negative screening label may be generated.

Tests TC-BR-AI-06-A / TC-BR-AI-06-B

#### FR AI 07 Version pinning

Trace BR-AI-07 · Must · R1 · WP05

Required outcome Production invocations shall bind to an approved provider and model version or an equivalently controlled provider release identifier. Undisclosed provider updates shall be treated as contract violations requiring review.

Design rule Each invocation stores manifest version, provider release ID, input hash and adapter version; mutable aliases are not accepted alone.

Acceptance A provider version change triggers quarantine or controlled reapproval and cannot silently replace a validated version.

Adverse scenario Provider changes its reported version mid-session; hold affected results for review.

Tests TC-BR-AI-07-A / TC-BR-AI-07-B

#### FR AI 08 Least data provider invocation

Trace BR-AI-08 · Must · R1 · WP05

Required outcome Each call shall include only the fields and media needed for the approved purpose. Provider retention, training use, subprocessors and hosting region shall be recorded and compatible with the deployment agreement.

Design rule Build payloads from manifest-required fields intersected with purpose permissions; log references rather than raw payloads.

Acceptance Payload inspection confirms excluded identifiers are absent and a provider with incompatible retention terms is blocked.

Adverse scenario Inspect a call whose model needs audio only; unnecessary name or ABHA fields must be absent.

Tests TC-BR-AI-08-A / TC-BR-AI-08-B

#### FR AI 09 Multi provider result history

Trace BR-AI-09 · Must · R1 · WP05

Required outcome The platform shall retain provider attribution and original output for each invocation. Replacing a provider shall not overwrite historical results or obscure the version used for an earlier decision.

Design rule Results are immutable references with provider attribution. Switching a provider creates a new invocation, never rewrites history.

Acceptance An encounter spanning a provider change shows both results independently with their input timestamps and review states.

Adverse scenario Replace an active model and view an old encounter; the original provider and output remain visible.

Tests TC-BR-AI-09-A / TC-BR-AI-09-B

#### FR AI 10 Monitoring and safety suspension

Trace BR-AI-10 · Must · R1 · WP05

Required outcome Monitoring shall cover availability, latency, input-quality failures, unsupported cases, usage, incidents and reviewed outcome measures where suitable ground truth exists. Clinical degradation shall trigger the approved investigation and suspension process.

Design rule Suspension sets an effective timestamp, prevents new admissions and emits tasks for affected pending or recent encounters.

Acceptance Operators can suspend a named version, identify affected encounters and assign follow-up without disabling unrelated safe capabilities.

Adverse scenario Suspend a provider while requests are queued; no new provider call may leave the broker.

Tests TC-BR-AI-10-A / TC-BR-AI-10-B

#### FR AI 11 Provider self service in a controlled environment

Trace BR-AI-11 · Should · R2 · WP05

Required outcome Providers may maintain documentation, credentials for testing and proposed versions in an isolated environment using approved synthetic data. They shall not publish directly to production or inspect unrestricted patient payloads.

Design rule Provider workspaces allow manifest drafts and synthetic fixtures only; live activation stays in deployment governance.

Acceptance Provider test access remains limited to its own capability and synthetic environment; production activation follows the standard review path.

Adverse scenario A provider account attempts to read a real encounter or another vendor manifest draft; deny access.

Tests TC-BR-AI-11-A / TC-BR-AI-11-B

#### FR AI 12 Cost and contractual limits

Trace BR-AI-12 · Must · R1 · WP05

Required outcome Usage shall be metered by provider, capability, deployment and task, with budget limits and alerts. Financial incentives shall not override clinical eligibility or conceal a recommended provider substitution.

Design rule Budget admission reserves the maximum approved call cost and settles actual charges or releases unused reservation.

Acceptance Reaching a cost limit results in a visible controlled fallback and does not silently select an unapproved model.

Adverse scenario Submit simultaneous calls beyond the remaining budget; only admissible calls reserve funds.

Tests TC-BR-AI-12-A / TC-BR-AI-12-B

### CLIN Clinical guidance and oversight

Clinical pathways use approved deterministic rules or explicitly approved clinical model outputs. A knowledge entry records publisher, source version, local reviewer, effective dates and intended scope. The language model can explain a rule but cannot change its threshold.

Protocol-triggered escalation is available even when AI or the network fails. Clinical review shows observations, source evidence, model limitations and conflicts. A clinician records their decision separately and gives a reason when overriding a suggestion.

A safety report creates an incident, affected-record search and accountable investigation. A model evaluation score is not deployment authority. Combined use of individually accepted capabilities requires its own workflow assessment.

#### FR CLIN 01 Approved source library

Trace BR-CLIN-01 · Must · R1 · WP06

Required outcome Clinical content shall come from approved, versioned sources with publisher, effective date, local applicability and reviewer. Retrieval shall favour content approved for the current programme and user role.

Design rule Knowledge entries require source, version, applicability, reviewer and expiry. Retrieval filters by active local approval.

Acceptance Superseded or unapproved guidance cannot be offered as current advice, and each displayed recommendation links to its source.

Adverse scenario Request an expired protocol entry; it cannot be presented as current care guidance.

Tests TC-BR-CLIN-01-A / TC-BR-CLIN-01-B

#### FR CLIN 02 Controlled clinical logic

Trace BR-CLIN-02 · Must · R1 · WP06

Required outcome Eligibility, warning signs, thresholds, contraindications and referral logic shall be represented through approved rules or explicitly approved clinical capabilities. The language model may explain them but may not rewrite them during a visit.

Design rule The protocol engine evaluates reviewed decision tables; the LLM receives the decision and evidence for explanation only.

Acceptance Rephrasing a prompt does not change a protocol's decision for the same confirmed facts.

Adverse scenario Paraphrase identical confirmed facts; deterministic pathway action must remain unchanged.

Tests TC-BR-CLIN-02-A / TC-BR-CLIN-02-B

#### FR CLIN 03 Escalation without model dependence

Trace BR-CLIN-03 · Must · R1 · WP06

Required outcome When an approved protocol identifies a need for urgent escalation, the application shall show the locally approved action and contacts immediately. A pending AI call shall not delay that action.

Design rule Urgent protocol actions have a local route and contact record; provider waits cannot delay their display.

Acceptance An urgent synthetic scenario follows the configured escalation path when cloud AI and external MIS services are unavailable.

Adverse scenario Drop network and AI access during an urgent fixture; the approved escalation still appears.

Tests TC-BR-CLIN-03-A / TC-BR-CLIN-03-B

#### FR CLIN 04 Scope of practice

Trace BR-CLIN-04 · Must · R1 · WP06

Required outcome Advice and available actions shall reflect the user's verified authority. A worker may record observations and prepare referrals only within the approved scope; medical decisions requiring a clinician shall be routed accordingly.

Design rule Clinical command policy uses verified credentials and locally approved scope, not role label alone.

Acceptance User role changes modify available clinical actions, and server-side tests reject unauthorised orders.

Adverse scenario Give a generic supervisor role to an unqualified person; clinical order permissions remain absent.

Tests TC-BR-CLIN-04-A / TC-BR-CLIN-04-B

#### FR CLIN 05 Review and override

Trace BR-CLIN-05 · Must · R1 · WP06

Required outcome An authorised reviewer shall be able to accept, reject or override a suggestion with a reason. Overrides shall preserve the original evidence and shall feed quality review without automatically retraining a model.

Design rule Reviews capture accepted or rejected recommendation, reason, clinician identity and exact evidence snapshot.

Acceptance The record distinguishes the model recommendation from the human decision and identifies the responsible professional.

Adverse scenario Record an override without a reason when policy requires one; block sign-off.

Tests TC-BR-CLIN-05-A / TC-BR-CLIN-05-B

#### FR CLIN 06 Model specific quality requirements

Trace BR-CLIN-06 · Must · R1 · WP06

Required outcome Each clinical capability shall have a separate acceptance plan appropriate to its task, population and intended use, including relevant subgroup performance and uncertainty. There shall be no generic platform-wide clinical accuracy percentage.

Design rule Every capability has its own performance thresholds and evaluation population; administrative extraction scores are separate.

Acceptance Clinical activation requires a signed capability-specific evidence review; administrative usability results cannot substitute for clinical validation.

Adverse scenario Use speech transcription accuracy as approval for a diagnostic model; reject the evidence linkage.

Tests TC-BR-CLIN-06-A / TC-BR-CLIN-06-B

#### FR CLIN 07 Composition safety

Trace BR-CLIN-07 · Must · R1 · WP06

Required outcome When several tools feed a single recommendation, the combined workflow shall be evaluated for interactions, missing inputs and disagreement. Individual model approvals shall not be treated as approval of every possible combination.

Design rule Composition review evaluates joint workflow hazards, missing input handling and disagreement rules.

Acceptance The activated workflow has a reviewed composition and tested conflict scenarios; unapproved combinations are unavailable.

Adverse scenario Combine two individually approved models without approved composition; no joint recommendation may activate.

Tests TC-BR-CLIN-07-A / TC-BR-CLIN-07-B

#### FR CLIN 08 Harm reporting and review

Trace BR-CLIN-08 · Must · R1 · WP06

Required outcome Users shall be able to flag misleading advice, wrong-patient results, missed escalation and potential harm from the current encounter. Reports shall reach a named clinical owner with evidence and action tracking.

Design rule Safety case intake is available from the encounter and creates containment and follow-up assignments.

Acceptance A safety report creates a visible case, preserves relevant versions and can initiate a capability hold and affected-case review.

Adverse scenario File a harm report while the provider is down; preserve the report and show an accountable owner.

Tests TC-BR-CLIN-08-A / TC-BR-CLIN-08-B

### INT Programme ABDM and EHR exchange

A connector capability profile declares resources, searches, read and write operations, identity rules, supported versions, receipt semantics and reconciliation routes. Each destination action is prepared separately from the shared encounter and retains its own status.

An outbound adapter validates the authorised payload, maps terminology, records the mapping version and submits with stable logical identity. An external receipt establishes acceptance. Timeouts enter an uncertain state and are reconciled before another write.

ABDM scope is explicitly enabled per role and environment. HIU retrieval requires valid authority and the applicable consent artefact. HIP publication preserves care-context linkage and provider provenance. Unsupported EHR operations are hidden or shown as a labelled assisted hand-off.

#### FR INT 01 Integration readiness contract

Trace BR-INT-01 · Must · R1 · WP07

Required outcome Each connector shall record the system owner, permitted read and write operations, identity method, data contract, authorisation, test environment, support contact and operational limits. Unknown capabilities shall remain explicitly unverified.

Design rule Connector activation requires owner agreement, allowed operations, exact environment, receipt examples and support contact.

Acceptance A connector cannot be labelled live until the receiving owner has accepted its tested scope and production access is enabled.

Adverse scenario Label a connector live using only a test endpoint; readiness status must remain test-only.

Tests TC-BR-INT-01-A / TC-BR-INT-01-B

#### FR INT 02 Independent read and write permissions

Trace BR-INT-02 · Must · R1 · WP07

Required outcome Read access, creation, update, deletion, status lookup and aggregation shall be separately configurable. Permission to retrieve a record shall not imply permission to modify it or register a patient.

Design rule The operation allowlist independently grants search, read, create, amend, delete, export and status lookup.

Acceptance A read-only connector exposes no active write path and clearly states when programme updates require a separate process.

Adverse scenario Use a read-only connector to submit an encounter; block before network dispatch.

Tests TC-BR-INT-02-A / TC-BR-INT-02-B

#### FR INT 03 Confirmed submission receipts

Trace BR-INT-03 · Must · R1 · WP07

Required outcome Every attempted external write shall retain destination, submitted version, time, initiating authority, status and receipt or error. Acceptance shall require the destination's meaningful acknowledgement, not merely a successful HTTP transport response.

Design rule Acceptance requires a verified destination business receipt linked to payload revision and action ID.

Acceptance A response containing a business rejection is shown as rejected even when the network request technically succeeded.

Adverse scenario Return HTTP 200 with a business rejection; record rejected rather than accepted.

Tests TC-BR-INT-03-A / TC-BR-INT-03-B

#### FR INT 04 Duplicate prevention and uncertain outcomes

Trace BR-INT-04 · Must · R1 · WP07

Required outcome Retries shall use stable submission identity and destination-supported duplicate controls. Where acceptance is uncertain, the platform shall reconcile before resubmitting or route the case for review.

Design rule Use a persistent logical action ID and destination idempotency mechanism; uncertain outcomes enter reconciliation.

Acceptance A timeout after external acceptance does not create a second patient or activity; an unverifiable outcome remains visibly unresolved.

Adverse scenario Simulate acceptance followed by a network timeout; retry cannot create a duplicate event.

Tests TC-BR-INT-04-A / TC-BR-INT-04-B

#### FR INT 05 Partial completion across systems

Trace BR-INT-05 · Must · R1 · WP07

Required outcome The platform shall track each destination independently and support recovery from partial success. It shall not promise an atomic transaction across unrelated MIS systems or automatically delete valid records to simulate rollback.

Design rule Each external action has its own receipt and retry policy; successful actions remain accepted during another failure.

Acceptance If one of two writes succeeds, the success receipt is preserved and only the failed or uncertain destination is retried.

Adverse scenario Destination A succeeds and B fails; recovery must not undo or resend A.

Tests TC-BR-INT-05-A / TC-BR-INT-05-B

#### FR INT 06 Inbound changes and reconciliation

Trace BR-INT-06 · Must · R1 · WP07

Required outcome Approved inbound updates shall identify source, version and effective time. Conflicts with local work shall enter a review process, and outstanding receipts shall be reconciled on a schedule appropriate to the connector.

Design rule Inbound updates retain source version and effective time; conflicts produce a review record against local pending changes.

Acceptance An external status change does not silently discard an unsynchronised local correction, and the responsible reviewer sees both.

Adverse scenario Receive an older external update after a local correction; do not overwrite the new revision.

Tests TC-BR-INT-06-A / TC-BR-INT-06-B

#### FR INT 07 Schema and mapping change control

Trace BR-INT-07 · Must · R1 · WP07

Required outcome External form, code or API changes shall trigger compatibility checks and owner review. Failed validation shall pause affected submissions while preserving queued data and unaffected workflows.

Design rule Schema upgrades validate fixtures and pending payload compatibility before activation; incompatible work pauses visibly.

Acceptance A removed mandatory destination field causes a controlled connector exception, not silent data loss or guessed replacement values.

Adverse scenario Remove a required field upstream; never invent its value to keep submissions flowing.

Tests TC-BR-INT-07-A / TC-BR-INT-07-B

#### FR INT 08 Limited integration alternatives

Trace BR-INT-08 · Must · R1 · WP07

Required outcome Where approved APIs are unavailable, owner-authorised file exchange or assisted submission may be supported and labelled as such. Credentials, access controls or usage restrictions shall not be bypassed to simulate connectivity.

Design rule File exports and assisted hand-offs retain a local action ID and prepared state until external acceptance evidence exists.

Acceptance Exported files carry reconciliation identifiers; a prepared export is never reported as accepted until acceptance evidence is recorded.

Adverse scenario Generate a CSV successfully; it cannot be reported as accepted by the programme.

Tests TC-BR-INT-08-A / TC-BR-INT-08-B

#### FR INT 09 Per destination data minimisation

Trace BR-INT-09 · Must · R1 · WP07

Required outcome Each connector shall send only authorised fields needed by its contract. Person-level operational data shall not be sent to an aggregate-reporting system merely because both are labelled health MIS.

Design rule Per-destination allowlists distinguish aggregate measures from person-level transactions and remove unrelated fields.

Acceptance Payload fixtures and production audits verify field allowlists and distinguish person records from aggregate measures.

Adverse scenario Send person identifiers to an aggregate-only endpoint; validation must reject the payload.

Tests TC-BR-INT-09-A / TC-BR-INT-09-B

#### FR INT 10 Standards based exchange

Trace BR-INT-10 · Must · R1 · WP07

Required outcome Where an ecosystem requires a published standard or implementation guide, the connector shall use a pinned agreed version and pass its conformance checks. ABDM exchange shall follow the applicable onboarding flows and the current agreed ABDM FHIR profiles [S1, S2, S8, S9].

Design rule Connector manifests pin the receiving system profile, terminology release and validator configuration.

Acceptance Standards validation and owner acceptance are recorded separately; valid FHIR content alone does not mark the connector production-ready.

Adverse scenario Validate generic FHIR against a destination requiring a local profile; generic success cannot pass the connector gate.

Tests TC-BR-INT-10-A / TC-BR-INT-10-B

#### FR INT 11 Canonical exchange representation

Trace BR-INT-11 · Must · R1 · WP07

Required outcome The platform shall maintain a canonical representation for person, encounter, observation, condition, service request, care plan, medication, diagnostic result, document and provenance. Source payloads and destination payloads shall remain traceable to this representation without erasing material differences.

Design rule Canonical entities map to destination records through explicit versioned transformations with provenance links.

Acceptance A single confirmed blood-pressure observation can be mapped to two approved destinations, and the audit shows the original source, canonical value, units, mapping version and each destination payload.

Adverse scenario Map one observation into two destinations; values, units and lineage must reconcile to the same source revision.

Tests TC-BR-INT-11-A / TC-BR-INT-11-B

#### FR INT 12 Source and destination provenance

Trace BR-INT-12 · Must · R1 · WP07

Required outcome Every imported or exported clinical element shall retain source system, source identifier, author or device where known, effective time, receipt time, transformation version and confidence or verification state. A transformed record shall not be represented as if the platform originally measured it.

Design rule Source identifiers, author, effective time, original status and transformation versions survive import and export.

Acceptance An imported laboratory result and an ASHA-recorded observation remain distinguishable after display, export and reconciliation.

Adverse scenario Import a laboratory result; it must not appear as a measurement originally taken by the ASHA.

Tests TC-BR-INT-12-A / TC-BR-INT-12-B

#### FR INT 13 ABDM participation scope

Trace BR-INT-13 · Must · R1 · WP07

Required outcome Each deployment shall explicitly approve the ABDM modules and roles it uses, including any ABHA, Scan and Share, HIP, HIU, consented exchange or NHCX capability. Permission for one module or role shall not imply another.

Design rule ABDM module roles are flags on a verified connector deployment; enabling ABHA does not enable HIP or HIU.

Acceptance Administration and test evidence identify the enabled ABDM role, environment, facility, client credentials, approved operations and responsible owner; all other operations are unavailable.

Adverse scenario Attempt HIU retrieval using an ABHA-only configuration; deny the operation.

Tests TC-BR-INT-13-A / TC-BR-INT-13-B

#### FR INT 14 ABHA identity and record linking

Trace BR-INT-14 · Must · R1 · WP07

Required outcome ABHA creation, verification, demographic matching and record linking shall use authorised flows and explicit user confirmation where required. The platform shall support care for a person without ABHA when the approved workflow permits and shall not merge people solely because names, phones or demographic fields are similar.

Design rule ABHA verification and record-linking follow the onboarded flow with explicit user confirmation where required.

Acceptance Tests cover verified ABHA linkage, declined linkage, absent ABHA, duplicate candidates, demographic mismatch and later correction without wrong-person disclosure.

Adverse scenario Present a mismatched ABHA or duplicate demographic candidate; retain local care and block wrong-person linkage.

Tests TC-BR-INT-14-A / TC-BR-INT-14-B

#### FR INT 15 ABDM consent enforcement

Trace BR-INT-15 · Must · R1 · WP07

Required outcome For ABDM exchanges that require a consent artefact, the platform shall enforce the named HIU and HIP, purpose, health information types, date range, expiry and status. Revocation, expiry or mismatch shall stop new retrieval or disclosure and create an auditable outcome.

Design rule Validate consent requester, provider, purpose, data types, period, frequency, expiry and current status before retrieval.

Acceptance Requests outside the approved purpose, date range, data type or validity period are blocked even when the calling user can otherwise view the local patient record.

Adverse scenario Revoke consent after preparing an exchange and before dispatch; no new disclosure may occur.

Tests TC-BR-INT-15-A / TC-BR-INT-15-B

#### FR INT 16 Facility and professional attribution

Trace BR-INT-16 · Must · R1 · WP07

Required outcome Where the ABDM or EHR workflow requires organisation, facility or practitioner attribution, the platform shall use verified HFR, HPR or destination identifiers and the active role. It shall not invent identifiers or reuse a professional identity across an unapproved facility context.

Design rule Facility and professional identifiers include registry source, verification state and deployment association.

Acceptance A consultation bundle fails validation or enters review when the configured facility or practitioner attribution is absent, expired or inconsistent with the encounter.

Adverse scenario Build a document with an expired or unrelated practitioner identity; reject or route for correction.

Tests TC-BR-INT-16-A / TC-BR-INT-16-B

#### FR INT 17 ABDM FHIR conformance and version control

Trace BR-INT-17 · Must · R1 · WP07

Required outcome ABDM clinical artefacts shall conform to the pinned NRCeS FHIR implementation package agreed for the deployment. The validator, profile set, terminology content and mapping shall be versioned together; upgrades require regression testing and owner approval [S2].

Design rule FHIR package hash, profile URL, terminology and validator version are retained with each validation result.

Acceptance Every outbound test bundle passes the pinned validator; a deliberate profile violation is rejected with a specific error and no external submission.

Adverse scenario Send an invalid cardinality or code fixture; outbound exchange remains blocked.

Tests TC-BR-INT-17-A / TC-BR-INT-17-B

#### FR INT 18 Health Information Provider operation

Trace BR-INT-18 · Must · R1 · WP07

Required outcome When operating as or through a HIP, the platform shall create eligible records, preserve care-context linkage, respond only through authorised exchange, encrypt and transmit the required payload, and retain the ABDM acknowledgement and failure state.

Design rule HIP publication registers eligible local records and care contexts, then fulfils only verified authorised requests.

Acceptance A consented request retrieves only the authorised records and produces traceable request, encryption, transfer, acknowledgement and error evidence without exposing unrelated records.

Adverse scenario Request an unrelated care context; HIP adapter must return no unauthorised record.

Tests TC-BR-INT-18-A / TC-BR-INT-18-B

#### FR INT 19 Health Information User operation

Trace BR-INT-19 · Must · R1 · WP07

Required outcome When operating as or through an HIU, the platform shall request the minimum health information needed for the approved purpose, track consent and data-flow states, validate received bundles, preserve external provenance and prevent silent overwriting of local records.

Design rule HIU retrieval tracks consent and data-flow transactions, decrypts through the authorised boundary and validates each bundle.

Acceptance A received record is shown with its source and effective date, while invalid, duplicate or conflicting content enters the configured reconciliation path.

Adverse scenario Receive an invalid or wrong-person bundle; quarantine it and preserve local records unchanged.

Tests TC-BR-INT-19-A / TC-BR-INT-19-B

#### FR INT 20 EHR connector capability profile

Trace BR-INT-20 · Must · R1 · WP07

Required outcome Every EHR or HMIS connector shall publish a capability profile covering supported resources or documents, search keys, read and write operations, authentication, patient matching, terminology, versioning, latency, idempotency, receipts, amendments, deletion restrictions and support ownership.

Design rule Connector profiles declare resource types, search keys, operations, amendments, pagination, limits and receipt semantics.

Acceptance The platform enables only operations declared in the active profile and blocks configuration that assumes unsupported search, update or acknowledgement behaviour.

Adverse scenario Configure an EHR search or write absent from the profile; no action should be exposed.

Tests TC-BR-INT-20-A / TC-BR-INT-20-B

#### FR INT 21 EHR writeback and conflict handling

Trace BR-INT-21 · Must · R1 · WP07

Required outcome The platform shall preserve the EHR as authority for its accepted records and shall use destination-supported identifiers, conditional updates, versions or reconciliation before writeback. Conflicting updates shall not be resolved through last-write-wins unless the destination owner explicitly approves that rule for the record type.

Design rule External version checks or reconciliation protect EHR writes; conflicts never default to last-write-wins.

Acceptance Concurrent-update tests preserve both versions, prevent silent loss and route unresolved conflicts to the named operational owner.

Adverse scenario Change an EHR record concurrently; retain both versions and require resolution before writeback.

Tests TC-BR-INT-21-A / TC-BR-INT-21-B

#### FR INT 22 Legacy and document exchange

Trace BR-INT-22 · Should · R1 · WP07

Required outcome Where FHIR is unavailable, the platform may use authorised HL7 v2, CDA, REST, SOAP, file or document exchange. The connector shall label the resulting limitations, preserve the original artefact and avoid presenting batch preparation or document extraction as real-time structured acceptance.

Design rule Legacy adapters declare batch latency, source artefacts, acknowledgements and manual review obligations.

Acceptance A batch or document connector identifies its delay, source document, extracted fields, reviewer and destination receipt; unsupported writeback remains unavailable.

Adverse scenario Import an unreviewed PDF extraction; it cannot become an authoritative structured record automatically.

Tests TC-BR-INT-22-A / TC-BR-INT-22-B

#### FR INT 23 Terminology and mapping governance

Trace BR-INT-23 · Must · R1 · WP07

Required outcome Clinical codes, local programme values, units and mapping tables shall be versioned, reviewed and tested for the specific source and destination. Unmapped, deprecated or ambiguous concepts shall not be silently replaced with the nearest available code.

Design rule Unmapped terminology has an explicit state and blocks destinations requiring a code until reviewed mapping exists.

Acceptance A terminology change produces an impact report and blocks affected submissions until the mapping is approved or the value is explicitly represented as unmapped.

Adverse scenario Use a deprecated or ambiguous code; do not silently substitute a nearest code.

Tests TC-BR-INT-23-A / TC-BR-INT-23-B

#### FR INT 24 Conformance and production claims

Trace BR-INT-24 · Must · R1 · WP07

Required outcome The platform shall distinguish syntactic validation, sandbox success, security review, partner certification, production onboarding and live operational acceptance. Marketing, administration and status screens shall not collapse these states into a single compliant label.

Design rule Expose conformance, sandbox, security review, onboarding and live acceptance as separate evidence fields.

Acceptance A sandbox-passing connector cannot be labelled production-live until credentials, owner approval, end-to-end transaction evidence and support responsibility are recorded.

Adverse scenario Pass all local schema tests with no production credentials; the interface must still show production unavailable.

Tests TC-BR-INT-24-A / TC-BR-INT-24-B

### OFF Offline operation and recovery

The Android reference client stores an encrypted, scoped caseload and outbox. A signed lease identifies the user, deployment, device, allowed records, actions, policy version and expiry. The default proposed lease is 24 hours; extension to 72 hours requires deployment approval.

Writes use a local transaction and are shown as saved only after commit. A sync session uploads identities, encounter revisions and dependent actions in causal order. The server rechecks current authority, versions, consent, model state and input freshness before execution.

Storage pressure stops new media before deleting pending work. Lease expiry locks private cached data. Uncertain external outcomes do not cause blind retries. After a reboot with untrusted time, renewed online verification is required before private data is unlocked.

#### FR OFF 01 Defined offline capability

Trace BR-OFF-01 · Must · R1 · WP08

Required outcome Previously authorised users shall be able to access a limited encrypted caseload, capture encounters, review valid cached guidance and prepare tasks during outages. Functions needing remote information or models shall show their unavailable or pending state.

Design rule Offline availability is a manifest of cached records, protocols and commands under a signed device lease.

Acceptance The core offline visit test completes without network access; no cloud model is falsely shown as having run.

Adverse scenario Invoke a cloud-only AI tool offline; display unavailable or pending, never a fabricated result.

Tests TC-BR-OFF-01-A / TC-BR-OFF-01-B

#### FR OFF 02 Durable local capture

Trace BR-OFF-02 · Must · R1 · WP08

Required outcome The application shall acknowledge a save only after local persistence succeeds. Insufficient storage, database failure or encryption failure shall be shown before the worker believes a record has been saved.

Design rule Draft and queue mutations commit atomically to encrypted storage before the saved indicator appears.

Acceptance Forced restart and low-storage tests preserve acknowledged data or clearly report that saving did not complete.

Adverse scenario Crash the app during commit; either the full mutation survives or no save acknowledgement is shown.

Tests TC-BR-OFF-02-A / TC-BR-OFF-02-B

#### FR OFF 03 Controlled offline authority

Trace BR-OFF-03 · Must · R1 · WP08

Required outcome Offline access shall use a time-bounded grant with scoped data and actions. Default proposal: a 24-hour grant after online verification; extending it up to 72 hours requires deployment approval. New privileged grants and remote disclosures remain online-only.

Design rule Lease checks use signed server time plus monotonic elapsed time; clock rollback or untrusted reboot requires online verification.

Acceptance Expired grants lock cached patient records. Operators understand that revocation cannot reach a disconnected device before reconnection or local expiry.

Adverse scenario Move the device clock backwards after lease expiry; private records remain locked.

Tests TC-BR-OFF-03-A / TC-BR-OFF-03-B

#### FR OFF 04 Pending media and AI work

Trace BR-OFF-04 · Must · R1 · WP08

Required outcome Recordings and images shall be queued with purpose, quality state and retention rules. On reconnection the platform shall recheck eligibility and authorisation before sending media to a provider.

Design rule Pending media carries its purpose, consent reference, capability version and expiry; all are rechecked before upload.

Acceptance An offline request is cancelled or routed for review when its permission expires or its capability is suspended before upload.

Adverse scenario Withdraw optional media permission while offline; reconnect must cancel the upload.

Tests TC-BR-OFF-04-A / TC-BR-OFF-04-B

#### FR OFF 05 Safe synchronisation ordering

Trace BR-OFF-05 · Must · R1 · WP08

Required outcome Dependent records shall synchronise in a valid order, preserving identities and stable submission identifiers. The application shall recover from intermittent connectivity without replaying successful actions.

Design rule Sync envelopes include command ID, dependencies, base version and local sequence; per-item results return independently.

Acceptance A new local person, encounter and referral synchronise without orphan records across repeated connection loss and restoration.

Adverse scenario Send a referral before its new person dependency; server returns dependency pending without orphan records.

Tests TC-BR-OFF-05-A / TC-BR-OFF-05-B

#### FR OFF 06 Revalidation of delayed actions

Trace BR-OFF-06 · Must · R1 · WP08

Required outcome Queued actions shall be revalidated against current assignment, permissions, patient linkage, protocol and input freshness before execution. A delayed clinical action shall not proceed solely because it was once drafted.

Design rule Delayed commands recheck active assignment, patient link, clinical freshness, pack version and recipient permission.

Acceptance A material rule or data change places the action into review with an explanation instead of silently executing the old plan.

Adverse scenario Queue an action then transfer the worker or retire the pack; require review or deny execution.

Tests TC-BR-OFF-06-A / TC-BR-OFF-06-B

#### FR OFF 07 Shared and lost devices

Trace BR-OFF-07 · Must · R1 · WP08

Required outcome The application shall isolate local user data, hide sensitive notifications, support quick locking and allow remote revocation when connectivity returns. Local encryption and grant expiry shall protect offline data where remote wiping cannot be guaranteed.

Design rule Device switching clears decrypted memory and locks the cache. Remote revocation is enforced on next contact or lease expiry.

Acceptance A second user cannot view the first user's cached records, and a reported lost device loses server access on its next contact.

Adverse scenario Sign in as another user on the same phone; no prior user records or notification content may leak.

Tests TC-BR-OFF-07-A / TC-BR-OFF-07-B

#### FR OFF 08 Offline workflow capacity

Trace BR-OFF-08 · Must · R1 · WP08

Required outcome The approved device profile shall support at least 200 structured encounters and the media allowance defined in Section 23 without silent eviction of unsynchronised work. Users shall see storage and pending upload status.

Design rule Capacity reserves space for structured records before new media. Pending work is never evicted for cache refresh.

Acceptance A capacity test reaches the agreed limit, warns before exhaustion and preserves every acknowledged record.

Adverse scenario Reach the media quota during a 200-encounter queue; preserve existing acknowledged work and show actionable capacity status.

Tests TC-BR-OFF-08-A / TC-BR-OFF-08-B

### CARE Referrals follow up and communication

Every referral and follow-up has an owner, reason, due date where applicable, destination and evidence-backed state. Service directory entries have a verified contact, capability, geography, hours and last verification time.

The action planner consolidates equivalent tasks while retaining programme reasons and individual completion criteria. A receiving service acknowledgement differs from appointment, attendance and completed care. A verified outcome or coded unresolved disposition closes the task.

Shared-phone preferences restrict disclosed content. Failed delivery creates work rather than a success mark. Overdue cases escalate by the approved programme rule. Automatic denial of care or worker sanctions is outside agent authority.

#### FR CARE 01 Action ownership

Trace BR-CARE-01 · Must · R1 · WP09

Required outcome Every referral, follow-up and exception shall have an accountable person or team, a due time where appropriate, a reason and a current state. Unassigned work shall enter a monitored queue.

Design rule Task creation requires an owner or a monitored assignment queue with a service-level escalation rule.

Acceptance No active urgent task can exist without a visible responsible queue or assignee.

Adverse scenario Remove a task owner during transfer; the task must enter a visible responsible queue.

Tests TC-BR-CARE-01-A / TC-BR-CARE-01-B

#### FR CARE 02 Service directory

Trace BR-CARE-02 · Must · R1 · WP09

Required outcome Referral destinations shall come from an approved directory containing service capability, location, contact route, operating constraints and verification date. The agent shall not invent a facility or claim unverified availability.

Design rule Directory entries require last_verified_at and supported services; expired availability is labelled and escalated.

Acceptance A stale or unavailable service listing is labelled and routes the worker to an approved alternative or supervisor.

Adverse scenario Select a stale or unavailable referral facility; the agent cannot invent a replacement service.

Tests TC-BR-CARE-02-A / TC-BR-CARE-02-B

#### FR CARE 03 Referral lifecycle

Trace BR-CARE-03 · Must · R1 · WP09

Required outcome The platform shall distinguish proposed, authorised, sent, received, scheduled, attended, completed, declined, cancelled and unknown outcomes where supported. A booked appointment or sent message shall not equal completed care.

Design rule Referral transitions attach evidence_type, evidence_ref and verifying actor; closure needs outcome or coded unresolved disposition.

Acceptance Completion requires a defined evidence source and actor; unsupported closure attempts are rejected.

Adverse scenario Mark a sent message as completed care; reject the transition.

Tests TC-BR-CARE-03-A / TC-BR-CARE-03-B

#### FR CARE 04 Due work and escalation

Trace BR-CARE-04 · Must · R1 · WP09

Required outcome Workers and supervisors shall receive prioritised task lists based on approved urgency and due dates. Missed tasks shall escalate under programme rules while retaining the reason for delay and service constraints.

Design rule Due-work calculations record schedule version and timezone; escalation retains prior owner and reason for delay.

Acceptance An overdue case enters the correct supervisor queue and remains visible until completion or a documented resolution.

Adverse scenario A late incoming result resolves a task after escalation; reconcile ownership without duplicate follow-up.

Tests TC-BR-CARE-04-A / TC-BR-CARE-04-B

#### FR CARE 05 Unified action plan

Trace BR-CARE-05 · Must · R1 · WP09

Required outcome Actions arising from multiple programmes shall be consolidated where clinically and operationally appropriate, retaining individual reasons and dependencies. Duplicate reminders shall be suppressed without hiding genuinely different work.

Design rule Deduplication joins only equivalent person, purpose, destination and time-window tasks and retains both programme links.

Acceptance Two packs generating the same approved referral create one referral with both source links and appropriate programme completion states.

Adverse scenario Two programmes need genuinely different follow-ups; do not collapse them into one task.

Tests TC-BR-CARE-05-A / TC-BR-CARE-05-B

#### FR CARE 06 Safe communication preferences

Trace BR-CARE-06 · Must · R1 · WP09

Required outcome Contact method, language, timing and disclosure preferences shall be recorded. Shared phone ownership shall be treated explicitly; sensitive content shall not be placed in notifications or message previews by default.

Design rule Communication preferences are per person, purpose and channel, with shared-phone disclosure limits.

Acceptance A patient requesting private contact receives no revealing automated message through a household contact number.

Adverse scenario Request private follow-up on a shared household number; prevent revealing notifications.

Tests TC-BR-CARE-06-A / TC-BR-CARE-06-B

#### FR CARE 07 External messaging and scheduling

Trace BR-CARE-07 · Should · R2 · WP09

Required outcome Approved SMS, IVR, messaging or appointment services may be integrated with authorisation, delivery evidence, opt-out handling and escalation. Channels require separate readiness checks and shall not expose provider credentials to the agent.

Design rule Channel adapters record delivery and opt-out status separately from patient acknowledgement or service completion.

Acceptance Delivery failure creates a retry or follow-up task and is not reported as patient acknowledgement.

Adverse scenario A messaging provider reports failure; leave follow-up unresolved and create recovery work.

Tests TC-BR-CARE-07-A / TC-BR-CARE-07-B

#### FR CARE 08 Worker activity evidence

Trace BR-CARE-08 · Must · R1 · WP09

Required outcome The system shall generate a reviewable record of verified worker activities for programme reporting or incentive support. It shall distinguish performed, claimed, verified and submitted activity and avoid promising payment.

Design rule Activity evidence distinguishes performed, verified, claimed and submitted; corrections invalidate derived claims.

Acceptance Correcting or cancelling an activity updates derived claims and leaves the original evidence and review history traceable.

Adverse scenario Cancel an activity after incentive evidence is prepared; retain history and mark the evidence stale.

Tests TC-BR-CARE-08-A / TC-BR-CARE-08-B

### REP Supervisor reporting and measures

Reports read a governed operational projection with metric versions, source freshness, scope and suppression rules. Person counts, encounters, referrals and accepted programme events have separate definitions and denominators.

Filters are constrained by the same policy as record views. Exports preserve report version, period, filter hash and generation time. Natural-language requests in R2 resolve to an approved metric query and show the interpretation before any consequential allocation.

Missing sources produce incomplete-data labels. Small cells and repeated differencing queries are restricted. A manager must hold separate person-level permission to open a follow-up list. Charts cannot imply that increased referrals prove better outcomes.

#### FR REP 01 Operational exception queues

Trace BR-REP-01 · Must · R1 · WP10

Required outcome Supervisors shall see overdue work, identity conflicts, rejected submissions, unresolved clinical reviews and synchronisation problems within their scope. Queues shall identify owner, age and recovery action.

Design rule Exceptions are indexed by owner, type, age, state and permitted person reference with direct recovery actions.

Acceptance Each seeded failure is discoverable and assignable without searching individual worker transcripts.

Adverse scenario Create a failed submission with no assigned handler; it must appear in the monitored integration queue.

Tests TC-BR-REP-01-A / TC-BR-REP-01-B

#### FR REP 02 Governed indicator definitions

Trace BR-REP-02 · Must · R1 · WP10

Required outcome Each indicator shall define numerator, denominator, exclusions, period, source, update cadence and owner. Changes shall be versioned; historical reports shall remain reproducible.

Design rule Metric definitions version numerator, denominator, exclusions, source grain, cutoff and suppression.

Acceptance A reviewer can recalculate sample indicators from authorised records and distinguish visits, unique people and accepted programme submissions.

Adverse scenario Recalculate a past report after a metric change; the original version must remain reproducible.

Tests TC-BR-REP-02-A / TC-BR-REP-02-B

#### FR REP 03 Data freshness and completeness

Trace BR-REP-03 · Must · R1 · WP10

Required outcome Reports shall disclose late arrivals, missing sources, external outages and refresh times. A partially synchronised period shall not look equivalent to a complete reporting period.

Design rule Each report shows source refresh time and incomplete feeds; delayed records revise a new report version.

Acceptance Disconnecting one source produces a visible completeness warning and an explicit affected denominator.

Adverse scenario Disconnect one feed; the dashboard must not display a falsely complete period.

Tests TC-BR-REP-03-A / TC-BR-REP-03-B

#### FR REP 04 Privacy preserving aggregation

Trace BR-REP-04 · Must · R1 · WP10

Required outcome Reports shall enforce audience-specific aggregation and small-cell controls. Patient-level drilldown and exports shall require an approved purpose and separate access.

Design rule Aggregate policy combines minimum cohort rules, protected dimensions and query-history controls against differencing.

Acceptance Combining filters cannot reveal a suppressed small group or bypass person-level access restrictions.

Adverse scenario Vary filters to reconstruct a suppressed patient; the system must deny the revealing query sequence.

Tests TC-BR-REP-04-A / TC-BR-REP-04-B

#### FR REP 05 Reconciled exports

Trace BR-REP-05 · Must · R1 · WP10

Required outcome Exports shall identify report definition, period, filters, generation time and user, with protected access and expiry where appropriate. Official reporting shall pass a review and submission state distinct from a draft export.

Design rule Exports contain metric definition version, scope, date window and row count, with expiring authorised download.

Acceptance An exported report reconciles to the displayed governed measure and cannot be downloaded by an unauthorised role.

Adverse scenario Alter a filter after export approval; require new review and block the old download request.

Tests TC-BR-REP-05-A / TC-BR-REP-05-B

#### FR REP 06 Population prioritisation

Trace BR-REP-06 · Should · R2 · WP10

Required outcome Approved risk or gap-analysis tools may identify populations needing review. Such results shall identify data limitations and support human planning rather than automatically denying service or ranking worker pay.

Design rule Prioritisation returns reasons and uncertainty for human allocation; neither payment nor eligibility is automatically changed.

Acceptance Supervisors can inspect selection criteria and override an allocation with a reason; uncertainty remains visible.

Adverse scenario Request worker penalties from an AI ranking; no sanction action is available.

Tests TC-BR-REP-06-A / TC-BR-REP-06-B

#### FR REP 07 Product performance metrics

Trace BR-REP-07 · Must · R1 · WP10

Required outcome The platform shall measure reuse, task completion, corrections, provider usage, sync failures and support burden without storing raw sensitive content in general analytics.

Design rule Operational metrics use event references and redacted counters; patient content never becomes general product telemetry.

Acceptance Product dashboards can support the Section 6 evaluation and contain no unnecessary patient identifiers or recording content.

Adverse scenario Inspect crash and usage events after a sensitive encounter; no raw transcript or clinical payload may be present.

Tests TC-BR-REP-07-A / TC-BR-REP-07-B

### OPS Configuration support and continuity

Deployment configuration versions the organisation, roles, packs, languages, providers, connector contracts, hosting policy and operating limits. Publishing requires validation and designated review; a rollback restores a compatible prior configuration without erasing history.

Operations receive redacted health checks, queue ages, failure counts, budget alerts and support tickets. Access to a patient record is a separate time-bound support grant with purpose, consent or other authority and a recorded approver.

Environment separation is enforced by credentials, keys, namespaces and network routes. Training uses synthetic identities. Exit exports include authorised records and unresolved work with a handover owner; termination does not strand accepted local records.

#### FR OPS 01 Deployment configuration

Trace BR-OPS-01 · Must · R1 · WP11

Required outcome Administrators shall configure organisation, geography, facilities, roles, programmes, languages, provider eligibility and operational limits. Changes shall be scoped to the deployment and validated before activation.

Design rule Configuration is tenant-scoped and versioned; validate referenced roles, packs, capabilities and connector profiles before publish.

Acceptance Updating one tenant's configuration cannot change another tenant's behaviour or data visibility.

Adverse scenario Change tenant A configuration and inspect tenant B; no state or access change may occur.

Tests TC-BR-OPS-01-A / TC-BR-OPS-01-B

#### FR OPS 02 Separation of environments

Trace BR-OPS-02 · Must · R1 · WP11

Required outcome Development, demonstration, training and production environments shall have separate identities, data and credentials. Synthetic data shall be clearly identifiable and blocked from production programme submissions.

Design rule Production credentials and routes are unavailable in test environments; fixtures carry synthetic mode on every record.

Acceptance A demonstration record cannot reach a live MIS, and a training account cannot access real patient records.

Adverse scenario Submit a training identity through a live connector; block at policy and adapter boundaries.

Tests TC-BR-OPS-02-A / TC-BR-OPS-02-B

#### FR OPS 03 Controlled publishing and rollback

Trace BR-OPS-03 · Must · R1 · WP11

Required outcome Programme packs, language content, knowledge sources, model versions and mappings shall use review, approval, publication and rollback states. Sensitive changes require independent approval and an impact summary.

Design rule Publish creates an immutable manifest and independent approval for sensitive changes; rollback checks schema compatibility.

Acceptance A failed change is reversible to an approved version while preserving the history of work completed under the changed version.

Adverse scenario Rollback after a schema change that makes old config incompatible; require an explicit compatible migration.

Tests TC-BR-OPS-03-A / TC-BR-OPS-03-B

#### FR OPS 04 Operational monitoring

Trace BR-OPS-04 · Must · R1 · WP11

Required outcome Operators shall monitor platform health, connector failures, pending queues, model availability, permission anomalies and costs. Alerts shall identify severity, affected scope, accountable owner and required response.

Design rule Alert rules cover service, queue, provider, policy and cost failures and route to an accountable team.

Acceptance An induced provider outage and a stalled writeback queue reach the correct support owner within the agreed alert target.

Adverse scenario Stall an outbound queue without process failure; a queue-age alert must still fire.

Tests TC-BR-OPS-04-A / TC-BR-OPS-04-B

#### FR OPS 05 Support without unnecessary disclosure

Trace BR-OPS-05 · Must · R1 · WP11

Required outcome Users shall raise a support case from a failed task using redacted diagnostics. Access to additional patient content shall be limited to authorised support personnel, purpose and duration.

Design rule Support tickets expose redacted diagnostics first. Clinical content requires a separate scoped expiring grant.

Acceptance A routine support agent can diagnose a sync failure without unrestricted patient access; exceptional access is logged and expires.

Adverse scenario Open a ticket as general support staff; no patient record is visible by default.

Tests TC-BR-OPS-05-A / TC-BR-OPS-05-B

#### FR OPS 06 Training and competency

Trace BR-OPS-06 · Must · R1 · WP11

Required outcome Training shall cover patient matching, correction, offline states, model limits, escalation and real submission status. Users shall practise in a safe environment and demonstrate core competencies before live activation.

Design rule Activation records completed role-specific training and a competency assessment in the synthetic environment.

Acceptance Activation records show training completion and role-specific competency evidence for the pilot cohort.

Adverse scenario A worker fails patient-matching competency; live account activation remains restricted.

Tests TC-BR-OPS-06-A / TC-BR-OPS-06-B

#### FR OPS 07 Data exit and continuity

Trace BR-OPS-07 · Must · R1 · WP11

Required outcome The buyer shall be able to export its authorised operational records, configuration and audit evidence in documented formats under the agreement. Provider or platform termination shall include queue disposition and care-task handover.

Design rule Exit exports preserve IDs, provenance, record versions and open tasks; verify counts with the receiving operator.

Acceptance An exit rehearsal produces a usable export, a list of unresolved external actions and a named owner for open patient tasks.

Adverse scenario Terminate a provider while work is queued; no accepted local records or outstanding care tasks are lost.

Tests TC-BR-OPS-07-A / TC-BR-OPS-07-B

#### FR OPS 08 Repeatable deployment packaging

Trace BR-OPS-08 · Should · R2 · WP11

Required outcome A deployment pack shall record approved settings, dependencies, training, tests and operating responsibilities. Country-specific rules shall be configurable without duplicating the entire product.

Design rule A deployment manifest packages reviewed config and references secrets by name rather than embedding them.

Acceptance A second deployment can be assembled from the pack with explicit local differences and no copied production patient data.

Adverse scenario Copy a deployment pack; it must contain no live patient data or reusable production secret.

Tests TC-BR-OPS-08-A / TC-BR-OPS-08-B

### SEC Privacy security and audit

Each data flow records purpose, accountable organisation, processing basis, recipients, location, retention and allowed actions. Policy combines active role, tenant, patient relationship, programme, facility, purpose, authority validity and resource sensitivity.

Consent is versioned and scoped. Withdrawal blocks future disclosure, invalidates queued actions and creates downstream disposition work. Append-only audit records material access, changes, approvals and disclosures without copying raw clinical content into logs.

Normal administrators cannot browse care records. Emergency access is available only to a specifically authorised role, with minimum scope, short expiry and retrospective review. Retention and legal holds are record-class policies; deletion status reflects backup and recipient limitations.

#### FR SEC 01 Purpose and lawful authority

Trace BR-SEC-01 · Must · R1 · WP02

Required outcome Every material data flow shall record its purpose, responsible organisation, applicable authority or processing basis, recipient and retention rule. Consent-based flows shall carry the required consent; other authorised flows shall record their distinct basis.

Design rule Authority records distinguish consent-based flows from other approved processing bases and specify allowed purpose and recipients.

Acceptance A new provider or connector cannot activate without an approved data-flow record, and a user clicking confirm cannot override an absent processing basis.

Adverse scenario Activate a new data flow with no documented basis; policy must block it.

Tests TC-BR-SEC-01-A / TC-BR-SEC-01-B

#### FR SEC 02 Understandable notice and consent

Trace BR-SEC-02 · Must · R1 · WP02

Required outcome Where consent is required, the workflow shall present a reviewed notice in an appropriate language and record scope, notice version, person or authorised representative, decision, time and expiry. Optional use shall be distinguishable from essential service steps.

Design rule Notices have language and version, and record the actor, relationship, decision, time and purpose.

Acceptance Declining an optional AI recording leaves the approved non-AI care workflow available and prevents that media from being sent.

Adverse scenario Decline optional AI consent; the approved ordinary care workflow remains available.

Tests TC-BR-SEC-02-A / TC-BR-SEC-02-B

#### FR SEC 03 Withdrawal and downstream effects

Trace BR-SEC-03 · Must · R1 · WP02

Required outcome Withdrawal, expiry or change of authorisation shall stop future affected processing and identify queued, cached and externally held data requiring action. Retention obligations and completed lawful transactions shall be handled under the approved policy.

Design rule Revocation invalidates pending disclosures immediately online and schedules device and recipient disposition actions.

Acceptance Revocation blocks a queued provider upload and produces a traceable disposition record; the system does not claim to erase an external record without evidence.

Adverse scenario Withdraw after a provider already received data; show downstream action pending rather than claiming instantaneous erasure.

Tests TC-BR-SEC-03-A / TC-BR-SEC-03-B

#### FR SEC 04 Sensitive data and proxy handling

Trace BR-SEC-04 · Must · R1 · WP02

Required outcome The system shall support additional restrictions for sensitive programme information, children, adolescents and proxy relationships as defined for the jurisdiction and care context. Relationship, authority and expiry shall be recorded separately.

Design rule Sensitive data classes and proxy rules are evaluated before views, exports, notifications and model payload construction.

Acceptance A household member cannot infer restricted information through summaries, notifications, shared schedules or access to another member's encounter.

Adverse scenario A proxy for one purpose attempts unrelated confidential history; deny access.

Tests TC-BR-SEC-04-A / TC-BR-SEC-04-B

#### FR SEC 05 Encryption and secrets

Trace BR-SEC-05 · Must · R1 · WP02

Required outcome Sensitive data shall be protected in transit and at rest, including local caches, backups and media. Secrets shall be managed outside client code, prompts, logs and configuration exports, with ownership and rotation procedures.

Design rule TLS, envelope encryption and secret references protect data; key rotation and access are audited separately.

Acceptance Security review finds no usable provider keys in the client bundle or agent context, and local data is unreadable outside the authorised application.

Adverse scenario Inspect mobile bundle, logs and model context; no provider secret or plaintext database key may exist.

Tests TC-BR-SEC-05-A / TC-BR-SEC-05-B

#### FR SEC 06 Tenant and record isolation

Trace BR-SEC-06 · Must · R1 · WP02

Required outcome Isolation shall apply to transactional records, searches, indexes, retrieval stores, reports, file links, backups and asynchronous tasks. High-privilege operations shall require explicit scoped authority.

Design rule Every object query and attachment token enforces tenant and record policy; database RLS supplies a second tenant boundary.

Acceptance Cross-tenant adversarial tests and wrong-record reference tests result in denial with no content disclosure.

Adverse scenario Reuse another tenant object key or export URL; deny with no content disclosure.

Tests TC-BR-SEC-06-A / TC-BR-SEC-06-B

#### FR SEC 07 Safe logs and analytics

Trace BR-SEC-07 · Must · R1 · WP02

Required outcome Application logs, crash reports, support exports and usage analytics shall minimise or redact identifiers and clinical content. Necessary sensitive diagnostic records shall have separate access and retention.

Design rule A structured logging allowlist excludes clinical values, credentials, raw prompts and recording bytes.

Acceptance A representative end-to-end test leaves no raw recording, credential or complete patient narrative in general operational telemetry.

Adverse scenario Trigger validation errors with sensitive input; logs show reason and correlation only.

Tests TC-BR-SEC-07-A / TC-BR-SEC-07-B

#### FR SEC 08 Audit evidence

Trace BR-SEC-08 · Must · R1 · WP02

Required outcome The platform shall record material reads, writes, approvals, AI calls, exports, configuration changes and privileged access with actor, authority, affected object, time, outcome and version. Ordinary users shall not be able to alter audit history.

Design rule A material command commits its audit record atomically; durable read-access audit precedes sensitive data return.

Acceptance An auditor reconstructs a selected encounter and submission from evidence without relying on the chat transcript or provider recollection.

Adverse scenario Make audit storage unavailable for a sensitive action; deny or retain a durable queued record per approved policy.

Tests TC-BR-SEC-08-A / TC-BR-SEC-08-B

#### FR SEC 09 Controlled retention and disposal

Trace BR-SEC-09 · Must · R1 · WP02

Required outcome Retention shall be specified by record class, purpose, location and jurisdiction, including transcripts, raw audio, model outputs, local caches, audit and backups. Legal holds and clinical record duties shall override routine disposal only through recorded policy.

Design rule Retention jobs require record class, schedule, legal-hold checks and evidence of actual disposal at each storage tier.

Acceptance Test data expires according to its configured schedule, while held records remain protected and identifiable; backup restoration does not silently revive deleted operational data.

Adverse scenario Restore a backup containing expired records; reapply tombstones before records become available.

Tests TC-BR-SEC-09-A / TC-BR-SEC-09-B

#### FR SEC 10 Rights and correction workflow

Trace BR-SEC-10 · Must · R1 · WP02

Required outcome The deployment shall provide a route for access, correction, grievances and applicable deletion or restriction requests. Identity verification shall be proportionate, and downstream dependencies shall be tracked.

Design rule Rights cases verify requester identity, track affected custodians and deadlines, and record evidence-backed resolution.

Acceptance A test request reaches the responsible organisation, has a due date under its approved policy and closes only with an evidence-backed outcome.

Adverse scenario Submit a deletion request for another adult without authority; no record deletion is permitted.

Tests TC-BR-SEC-10-A / TC-BR-SEC-10-B

#### FR SEC 11 Emergency and support access

Trace BR-SEC-11 · Must · R1 · WP02

Required outcome Any exceptional access shall have a defined eligible role, reason, time limit, minimum scope and retrospective review. It shall not create permanent access or bypass clinical authority.

Design rule Exceptional access requires an approved role, purpose, scope, expiry and independent retrospective review.

Acceptance A break-glass event is visible to the designated reviewer and automatically expires; an ordinary worker cannot invoke it unless specifically authorised.

Adverse scenario Attempt break-glass as an ordinary worker; deny without granting persistent privilege.

Tests TC-BR-SEC-11-A / TC-BR-SEC-11-B

#### FR SEC 12 Provider and supply chain assurance

Trace BR-SEC-12 · Must · R1 · WP02

Required outcome Providers and critical dependencies shall disclose security controls, subprocessors, incident contacts and material changes. The product shall maintain a dependency inventory and a process for vulnerable or unsupported components.

Design rule Provider onboarding records dependencies, subprocessors, update obligations and vulnerability response ownership.

Acceptance An unresolved critical vulnerability affecting the deployment blocks release or disables the affected component until the approved remedy is implemented.

Adverse scenario A critical exploitable dependency finding remains unresolved; block affected live release.

Tests TC-BR-SEC-12-A / TC-BR-SEC-12-B

#### FR SEC 13 Incident response

Trace BR-SEC-13 · Must · R1 · WP02

Required outcome Security and privacy incidents shall have triage, containment, evidence preservation, impact assessment and notification responsibilities. The relevant legal and contractual notification windows shall be maintained per deployment rather than hard-coded as a universal rule.

Design rule Incident records retain timeline, containment, affected scope and jurisdiction-specific notification decisions.

Acceptance A tabletop exercise demonstrates who acts, what access is revoked, how affected records are found and how notification decisions are documented.

Adverse scenario Run an incident exercise with partial evidence; closure cannot claim notification or recovery without evidence.

Tests TC-BR-SEC-13-A / TC-BR-SEC-13-B

#### FR SEC 14 Hosting and cross border controls

Trace BR-SEC-14 · Must · R1 · WP02

Required outcome Approved data locations and transfer restrictions shall apply to primary storage, AI providers, backups, analytics and support access. Region selection shall be enforced across the processing chain.

Design rule Routing policy constrains provider, storage, backup and support regions before any transfer.

Acceptance A model endpoint or support route outside the deployment's permitted locations is rejected before personal data is transferred.

Adverse scenario Point an otherwise approved adapter to an unapproved region; reject the transfer.

Tests TC-BR-SEC-14-A / TC-BR-SEC-14-B

### RULE Cross workflow action rules

Commands share invariants for verified patient context, exact approval binding, current permission checks, stable action identity and evidence-based completion. Clinical observations, model suggestions and human decisions remain distinct record types.

A change in facts, destination, purpose, protocol or provider version invalidates a prior approval. Cancellation stops pending work and records any accepted external action that requires a separate correction. Training and shadow outputs cannot enter live care actions.

Missing answers remain missing. Model scores retain their intended meaning and cannot be averaged without approved interpretation. The system cannot independently deny services, sanction benefits or impose worker consequences.

#### FR RULE 01 No invented facts

Trace BR-RULE-01 · Must · R1 · WP02

Required outcome The platform shall never fill an unanswered clinical or programme field with an assumed answer. It may calculate a derived value only where the formula and required inputs are approved and the result is labelled as derived.

Design rule Observation validation requires a real captured value or explicit missingness; model-derived values carry derivation references.

Acceptance Missing, refused and uncertain inputs remain distinguishable across local records, model calls and outgoing submissions.

Adverse scenario Complete a mandatory form by inventing a missing answer; the platform must refuse the fabricated value.

Tests TC-BR-RULE-01-A / TC-BR-RULE-01-B

#### FR RULE 02 Patient confirmation before commitment

Trace BR-RULE-02 · Must · R1 · WP02

Required outcome The workflow shall require a positive person-context check before confirming an encounter or sending a patient-specific external action. Ambiguous identity shall restrict action to the allowed provisional workflow.

Design rule Consequential commands require a recently confirmed patient context tied to the encounter revision.

Acceptance A deliberately ambiguous match cannot create an authoritative programme update until the identity requirement is resolved.

Adverse scenario Submit from a stale patient tab after a switch; reject the context mismatch.

Tests TC-BR-RULE-02-A / TC-BR-RULE-02-B

#### FR RULE 03 Review depends on unchanged evidence

Trace BR-RULE-03 · Must · R1 · WP02

Required outcome An approval shall be bound to the material facts, intended action, destination and relevant versions reviewed. Material changes shall invalidate it and require an appropriate new review.

Design rule Approval includes hashes of facts, action, recipient, purpose, rules and model versions.

Acceptance Editing a measurement after referral approval prevents silent use of the previous approval for a changed recommendation.

Adverse scenario Reuse approval after changing one bound input; reject and return to review.

Tests TC-BR-RULE-03-A / TC-BR-RULE-03-B

#### FR RULE 04 Honest completion and cancellation

Trace BR-RULE-04 · Must · R1 · WP02

Required outcome Local completion, external acceptance and service completion shall be distinct. Cancelling a local task shall not falsely cancel an accepted external transaction; a separate authorised correction or cancellation request is required.

Design rule Local task cancellation records remaining external obligations; it never rewrites destination receipts.

Acceptance Cancellation after submission reports the actual destination state and generates any remaining reversal task.

Adverse scenario Cancel after external acceptance; the accepted receipt remains and a correction task is created.

Tests TC-BR-RULE-04-A / TC-BR-RULE-04-B

#### FR RULE 05 No false model equivalence

Trace BR-RULE-05 · Must · R1 · WP02

Required outcome Provider outputs shall retain their meaning and intended use. Confidence scores from different models shall not be treated as directly comparable without an approved interpretation and evaluation.

Design rule Result displays preserve provider-specific scales and calibration notes; unsupported score comparisons are disallowed.

Acceptance A multi-model result screen avoids a fabricated common score and presents the required review path for disagreement.

Adverse scenario Average two unrelated risk scores in a plan; validation rejects the invented combined metric.

Tests TC-BR-RULE-05-A / TC-BR-RULE-05-B

#### FR RULE 06 Rechecks at execution time

Trace BR-RULE-06 · Must · R1 · WP02

Required outcome Permission, person linkage, capability status and relevant authorisation shall be checked immediately before an external action, even if planning occurred earlier.

Design rule Execution performs current policy and authority checks even when the planning-stage checks passed.

Acceptance Revoking a worker's role between drafting and execution blocks the pending action and preserves it for authorised reassignment.

Adverse scenario Revoke access between plan approval and worker dispatch; the side effect must not occur.

Tests TC-BR-RULE-06-A / TC-BR-RULE-06-B

#### FR RULE 07 No experimental output in care

Trace BR-RULE-07 · Must · R1 · WP02

Required outcome Training, synthetic, shadow or unapproved model results shall be segregated from the operational care record and shall not influence user-visible clinical action lists.

Design rule Environment and output-use labels travel with every model result; live action builders reject test or shadow results.

Acceptance An experimental high-risk result cannot trigger a live referral or patient notification outside an explicitly authorised evaluation protocol.

Adverse scenario Attach a shadow result to a real care order; reject the source association.

Tests TC-BR-RULE-07-A / TC-BR-RULE-07-B

#### FR RULE 08 No silent adverse allocation

Trace BR-RULE-08 · Must · R1 · WP02

Required outcome The agent shall not independently deny services, sanction benefits, determine worker incentives or impose employment consequences. Any later support for such decisions requires a separately approved scope and review process.

Design rule The action catalogue excludes autonomous benefits, sanctions and employment decisions.

Acceptance Requests for an automatic denial or sanction produce no operational transaction and identify the required authority.

Adverse scenario Ask the agent to deny a service based on attendance history; no such command can execute.

Tests TC-BR-RULE-08-A / TC-BR-RULE-08-B

## Screen contracts

The companion HTML is a synthetic interaction prototype. These screen contracts define required fields and actions; production role policy is enforced by the server, independently of what is visible on a screen.

### SCR01 Assigned work

User and purpose Frontline worker — Due visits and local sync state

Fields Person, task reason, due date, location label, offline lease

Actions Open person; filter due work; lock session

Boundary and errors No patient data before authentication; cached list restricted to valid lease

### SCR02 Person and identity

User and purpose Worker and identity steward — Confirm the correct person before a visit

Fields Local ID, verified external links, age basis, household relationship

Actions Confirm match; create provisional person; request link correction

Boundary and errors No automatic name or phone merge; uncertain identity blocks disclosure

### SCR03 Encounter capture

User and purpose Frontline worker — Capture facts once

Fields Episode, observations, units, effective time, source, missingness

Actions Type; start and stop voice; save draft

Boundary and errors Numeric and identity ambiguities remain drafts; local save has explicit status

### SCR04 Shared questions

User and purpose Frontline worker — Resolve remaining programme needs

Fields Question, programme reasons, prior value, freshness, absence reason

Actions Reuse valid fact; record new fact; mark unknown or refused

Boundary and errors Separate questions retained when concepts or relevant time differ

### SCR05 Review and actions

User and purpose Worker or clinician — Confirm facts and proposed actions

Fields Patient strip, facts, uncertainties, recipients, purpose, action checklist

Actions Confirm encounter; approve permitted actions; defer action

Boundary and errors Approval snapshot invalidated by material changes; clinical orders require authority

### SCR06 AI request and result

User and purpose Worker or clinician — Track eligible AI work

Fields Provider and model version, input quality, request state, output and limits

Actions Record media; run; cancel pending call; request review

Boundary and errors No eligible model shows unavailable; timeout never becomes negative result

### SCR07 Submission receipts

User and purpose Worker and integration operator — See each destination outcome

Fields Destination, record version, pending or accepted state, receipt, error

Actions Inspect receipt; reconcile uncertain result; correct rejected input

Boundary and errors No global green check while a required destination remains unresolved

### SCR08 Referral detail

User and purpose Worker clinician or supervisor — Track care through verified outcome

Fields Reason, owner, destination, due date, timeline, supporting record links

Actions Send; reassign; record receiving evidence; close with reason

Boundary and errors Appointment and message delivery are not completed care

### SCR09 Offline queue

User and purpose Frontline worker — Recover delayed work

Fields Local save time, dependency, lease status, pending item, conflict

Actions Sync; resolve conflict; cancel queued optional media

Boundary and errors Cancellation cannot undo a prior external acceptance

### SCR10 Clinical consultation

User and purpose Clinician and nurse — Review multi-provider results and EHR context

Fields Encounter, source observations, AI results, orders, care plan

Actions Record decision; authorise order; prepare EHR write

Boundary and errors External source dates and provenance remain visible; unsupported writes unavailable

### SCR11 Consent and health exchange

User and purpose Worker or clinician with exchange authority — Request only authorised health information

Fields ABHA link state, requester, purpose, types, date range, expiry

Actions Request consent; view status; retrieve eligible records

Boundary and errors Denied expired revoked and mismatched authority block retrieval

### SCR12 Supervisor exceptions

User and purpose Supervisor — Resolve overdue work and failures

Fields Age of issue, owner, reason, source freshness, permitted person reference

Actions Assign; escalate; inspect permitted evidence

Boundary and errors No clinical access derived solely from supervisor title

### SCR13 Programme measures

User and purpose Programme manager — Inspect reproducible indicators

Fields Period, cohort, filters, denominator, completeness, suppression

Actions Run approved report; request scoped export

Boundary and errors Small cells suppressed; person drilldown requires separate grant

### SCR14 Record conflict

User and purpose Authorised reviewer — Resolve concurrent or mismatched records

Fields Original sources, effective times, revisions, destination state

Actions Retain both; select correction; create repair tasks

Boundary and errors No silent last-write-wins for clinical facts

### SCR15 Export and audit

User and purpose Auditor or scoped manager — Reconstruct activity or export authorised records

Fields Purpose, scope, filters, expiry, version, download status

Actions Request export; inspect event chain

Boundary and errors Downloads expire; no raw media in general operational logs

### SCR16 Users and assignments

User and purpose Deployment administrator — Manage verified staff and scope

Fields Principal, active role, facilities, programmes, assignment dates

Actions Invite; suspend; transfer caseload

Boundary and errors Role changes cannot self-grant clinical authority

### SCR17 Identity corrections

User and purpose Identity steward — Repair wrong links

Fields Source identifiers, evidence, impacted records and submissions

Actions Approve link revision; assign downstream repairs

Boundary and errors No destructive merge; accepted external records need external correction

### SCR18 Programme pack versions

User and purpose Programme owner — Publish reviewed workflow configuration

Fields Version, scope, questions, schedules, approvals, impact report

Actions Validate; review; activate; retire

Boundary and errors Clinical configuration needs named clinical review before live use

### SCR19 AI capability registry

User and purpose AI governance owner — Control versioned provider capabilities

Fields Manifest, evidence, intended use, population, costs and activation

Actions Register; validate; review; activate; suspend

Boundary and errors Provider cannot approve its own live activation

### SCR20 Connector operations

User and purpose Integration operator — Manage supported external operations

Fields Capability profile, environment, mapping version, receipts and queue ages

Actions Test contract; reconcile; pause; rotate secret reference

Boundary and errors Secrets hidden; sandbox pass and production readiness are separate states

### SCR21 Safety and privacy case

User and purpose Clinical safety or privacy lead — Investigate harm and restricted data use

Fields Incident, minimal affected references, severity, containment, owner

Actions Contain; assign; document action; review closure

Boundary and errors Urgent clinical escalation remains available during investigation

### SCR22 Support and release

User and purpose Operations owner — Operate an approved deployment

Fields Release manifest, service health, support cases, grants, restore evidence

Actions Create ticket; approve limited support; release or roll back

Boundary and errors Support grants expire; configuration rollback preserves clinical history

## Completion and exception ownership

A visit can be confirmed while one destination remains unresolved. The worker sees which work is complete and which action is assigned for repair. An integration queue owns technical reconciliation; a named programme owner handles business rejection; the clinical route owns urgent care. Completing data entry never implies that care has been received.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
