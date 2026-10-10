# APL-89 — \[SAHA-066\] Escalation without model dependence

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-89](https://linear.app/aplyd-sandbox/issue/APL-89/saha-066-escalation-without-model-dependence)  
Stable UUID: `e4b01cbe-13a2-426e-b700-236049f70a19`  
Hierarchy kind: `functional_story`  
Native parent: [APL-18](APL-18.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:18:17.335Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `b422704cb637f055e3bac39d540d9f22d4f47ae47b979540477b17c39c71e016`  
Source plus v4.2 refinement SHA-256: `0f39dceb816acb765caa766f9e2a867ac2462471edf902965e4a9174836a9595`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted care worker, I need to see the locally approved urgent action and contacts immediately when the approved protocol requires escalation, so that a pending AI call or unavailable external service cannot delay the escalation path.

Bounded scope: Qualify the configured urgent route when cloud AI and MIS dependencies are unavailable; the escalation policy and contacts must already be approved.

## Canonical scope and hierarchy

Scope ID: SAHA-066; type: functional. Original IDs: BR-CLIN-03.
CWO references: None. Decision references: None recorded.
Primary epic: WP06; related work packages: WP06. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-CLIN-03 — Escalation without model dependence

Priority: Must; original release: R1.

When an approved protocol identifies a need for urgent escalation, the application shall show the locally approved action and contacts immediately. A pending AI call shall not delay that action.

Acceptance: An urgent synthetic scenario follows the configured escalation path when cloud AI and external MIS services are unavailable.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-CLIN-03-A — Escalation without model dependence acceptance

Type: Functional; source role: QA with Clinical safety lead and clinician; fixture: FX-CLIN-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-CLIN-03. 2. Urgent protocol actions have a local route and contact record; provider waits cannot delay their display. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An urgent synthetic scenario follows the configured escalation path when cloud AI and external MIS services are unavailable.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-CLIN-03-B — Escalation without model dependence adverse condition

Type: Negative or recovery; source role: QA with Clinical safety lead and clinician; fixture: FX-CLIN-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Drop network and AI access during an urgent fixture; the approved escalation still appears. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Drop network and AI access during an urgent fixture; the approved escalation still appears. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J02 — Cough analysis within screening

Type: End to end; source role: Product QA and programme owner; fixture: FX-J02.
Preconditions: Synthetic environment; role Permitted worker and clinical reviewer; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Check that the patient, language, recording method and device are within the selected capability approval.
2\. Explain the optional recording and record the required permission without blocking ordinary screening when declined.
3\. Capture the signal using provider-approved instructions and confirm patient context.
4\. Evaluate input quality, upload only permitted fields and create a version-pinned request with a deadline.
5\. Validate the response and display result, limitations and quality state separately from diagnosis.
6\. Apply the locally approved pathway and route any clinical decision to the appropriate reviewer.
Inject exception: Unusable audio returns retry guidance. Provider failure and inability to assess never become a negative screen.
Expected: Invocation and result or failure are traceable; any care decision records its human or approved protocol authority.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-CLIN-03: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved escalation pathways, response operations and verified offline clinical availability.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP02, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-CLIN-03-A, TC-J02 using the source-named fixture, actor, preconditions and exact Expected oracle; cover see the locally approved urgent action and contacts immediately when the approved protocol requires escalation.
* Refusal/adverse: Run TC-BR-CLIN-03-B; retained source adverse/recovery case: Drop network and AI access during an urgent fixture; the approved escalation still appears.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Drop network, cloud AI and MIS during an approved urgent synthetic fixture. Keep the configured escalation path and accountable task visible; invent no emergency advice or alternative service.
* Authorization refinement: For permitted care worker performing “see the locally approved urgent action and contacts immediately when the approved protocol requires escalation”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.