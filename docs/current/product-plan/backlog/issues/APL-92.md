# APL-92 — \[SAHA-069\] Model-specific quality requirements

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-92](https://linear.app/aplyd-sandbox/issue/APL-92/saha-069-model-specific-quality-requirements)  
Stable UUID: `d19fc5db-cfad-4ffe-9bca-cc3bf7414888`  
Hierarchy kind: `functional_story`  
Native parent: [APL-18](APL-18.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:18:37.234Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `95ee743c3c9d3fdfae2718c82fa6901e0e216951f2438537a7ef4440a98d2486`  
Source plus v4.2 refinement SHA-256: `4c27edcb27b54bd9954ef210b53091d0296f6bee9aa2c2ef9473f606db8b2f09`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a clinical safety lead, I need to review a capability-specific acceptance plan for its intended task, population, subgroups and uncertainty, so that clinical activation has the required signed evidence review.

Bounded scope: Administrative usability or transcription scores cannot substitute for clinical validation; do not create a generic platform-wide accuracy target.

## Canonical scope and hierarchy

Scope ID: SAHA-069; type: functional. Original IDs: BR-CLIN-06.
CWO references: None. Decision references: None recorded.
Primary epic: WP06; related work packages: WP06. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-CLIN-06 — Model-specific quality requirements

Priority: Must; original release: R1.

Each clinical capability shall have a separate acceptance plan appropriate to its task, population and intended use, including relevant subgroup performance and uncertainty. There shall be no generic platform-wide clinical accuracy percentage.

Acceptance: Clinical activation requires a signed capability-specific evidence review; administrative usability results cannot substitute for clinical validation.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-CLIN-06-A — Model-specific quality requirements acceptance

Type: Functional; source role: QA with Clinical safety lead and clinician; fixture: FX-CLIN-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-CLIN-06. 2. Every capability has its own performance thresholds and evaluation population; administrative extraction scores are separate. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Clinical activation requires a signed capability-specific evidence review; administrative usability results cannot substitute for clinical validation.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-CLIN-06-B — Model-specific quality requirements adverse condition

Type: Negative or recovery; source role: QA with Clinical safety lead and clinician; fixture: FX-CLIN-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Use speech transcription accuracy as approval for a diagnostic model; reject the evidence linkage. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Use speech transcription accuracy as approval for a diagnostic model; reject the evidence linkage. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-CLIN-06: source assessment "not-built"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Capability-specific study plan, subgroup review, uncertainty and signed authorisation.
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

* Positive: Run TC-BR-CLIN-06-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover review a capability-specific acceptance plan for its intended task, population, subgroups and uncertainty.
* Refusal/adverse: Run TC-BR-CLIN-06-B; retained source adverse/recovery case: Use speech transcription accuracy as approval for a diagnostic model; reject the evidence linkage.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Evaluate a diagnostic model using an administrative speech score. Reject the evidence linkage; missing signed capability-specific clinical review remains a blocker rather than an assumed accuracy pass.
* Authorization refinement: For clinical safety lead performing “review a capability-specific acceptance plan for its intended task, population, subgroups and uncertainty”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.