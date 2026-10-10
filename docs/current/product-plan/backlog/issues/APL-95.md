# APL-95 — \[SAHA-072\] Integration readiness and declared connector capabilities

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-95](https://linear.app/aplyd-sandbox/issue/APL-95/saha-072-integration-readiness-and-declared-connector-capabilities)  
Stable UUID: `01a44e58-7df3-49a0-9120-8c08f6456563`  
Hierarchy kind: `functional_story`  
Native parent: [APL-19](APL-19.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:19:10.369Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `f87709e58da77bafb620eec644a9a302ed49d11bab7a6e3c0569b8dc4fffc5c9`  
Source plus v4.2 refinement SHA-256: `44cfdc104c1ae399dadf80dc8f9a762ece4a87307d13b2294ca134a9fa23a994`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an integration owner, I need to declare each connector's verified capabilities and readiness evidence, so that only receiving-owner-accepted operations can be exposed as live.

Bounded scope: Record owner, exact environment, authentication, matching, resources, versions, receipts, amendments, operational limits and support; unknown or unsupported behaviour remains unavailable.

## Canonical scope and hierarchy

Scope ID: SAHA-072; type: functional. Original IDs: BR-INT-01, BR-INT-20.
CWO references: CWO-015. Decision references: None recorded.
Primary epic: WP07; related work packages: WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-INT-01 — Integration readiness contract

Priority: Must; original release: R1.

Each connector shall record the system owner, permitted read and write operations, identity method, data contract, authorisation, test environment, support contact and operational limits. Unknown capabilities shall remain explicitly unverified.

Acceptance: A connector cannot be labelled live until the receiving owner has accepted its tested scope and production access is enabled.

### BR-INT-20 — EHR connector capability profile

Priority: Must; original release: R1.

Every EHR or HMIS connector shall publish a capability profile covering supported resources or documents, search keys, read and write operations, authentication, patient matching, terminology, versioning, latency, idempotency, receipts, amendments, deletion restrictions and support ownership.

Acceptance: The platform enables only operations declared in the active profile and blocks configuration that assumes unsupported search, update or acknowledgement behaviour.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-INT-01-A — Integration readiness contract acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-01. 2. Connector activation requires owner agreement, allowed operations, exact environment, receipt examples and support contact. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A connector cannot be labelled live until the receiving owner has accepted its tested scope and production access is enabled.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-01-B — Integration readiness contract adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Label a connector live using only a test endpoint; readiness status must remain test-only. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Label a connector live using only a test endpoint; readiness status must remain test-only. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-20-A — EHR connector capability profile acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-20.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-20. 2. Connector profiles declare resource types, search keys, operations, amendments, pagination, limits and receipt semantics. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: The platform enables only operations declared in the active profile and blocks configuration that assumes unsupported search, update or acknowledgement behaviour.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-20-B — EHR connector capability profile adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-20-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Configure an EHR search or write absent from the profile; no action should be exposed. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Configure an EHR search or write absent from the profile; no action should be exposed. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J10 — Cross facility referral and diagnostic return

Type: End to end; source role: Product QA and programme owner; fixture: FX-J10.
Preconditions: Synthetic environment; role Referring worker and receiving clinician; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Prepare a referral with verified identity, minimum necessary clinical context and an accountable owner.
2\. Send through the destination supported route and record acknowledgement.
3\. The receiving service records assessment, attendance and result in its own authoritative system.
4\. Receive the result through the authorised EHR, ABDM or controlled document route.
5\. Match the result to the correct person, referral and source version; quarantine mismatches.
6\. Create the next task and close only with verified service outcome or coded unresolved disposition.
Inject exception: A destination without structured referral support uses labelled assisted hand-off. Missing attendance or result leaves work open.
Expected: Sent, received, scheduled, attended, resulted and closed states reflect distinct evidence.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-INT-01: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Receiving-owner contracts, complete supported operations and live acceptance.
BR-INT-20: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Reference-partner profile covering all declared search/update/version/receipt/support behaviour.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Prefer a self-contained current synthetic journey before partner-dependent exchange; receiving-owner contracts and real conformance cannot be assumed.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 6–14 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-INT-01-A, TC-BR-INT-20-A, TC-J10 using the source-named fixture, actor, preconditions and exact Expected oracle; cover declare each connector's verified capabilities and readiness evidence.
* Refusal/adverse: Run TC-BR-INT-01-B, TC-BR-INT-20-B; retained source adverse/recovery case: Label a connector live using only a test endpoint; readiness status must remain test-only. | Configure an EHR search or write absent from the profile; no action should be exposed.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Request EHR search/update/acknowledgement not declared in the connector profile. Keep the operation unavailable; a test endpoint cannot change test-only readiness to live.
* Authorization refinement: For integration owner performing “declare each connector's verified capabilities and readiness evidence”: Remove the required destination-specific write/disclosure authority or expire its consent/purpose between preparation and dispatch; no protected payload may leave and read authority must not grant write authority.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.