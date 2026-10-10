# APL-65 — \[SAHA-042\] Eligibility before tool selection

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-65](https://linear.app/aplyd-sandbox/issue/APL-65/saha-042-eligibility-before-tool-selection)  
Stable UUID: `a65e3e3e-e16a-4ba8-af54-e724d10e4e76`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:57.982Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `71b68e24da260f3be0512c2a821107362f16655d8966a9e7b8cc03805356ee0f`  
Source plus v4.2 refinement SHA-256: `0d12a8b6f07fc3141fb1d2f3d2276da7e21bce86d28c7382119807336396a3f4`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised capability user, I want tool eligibility checked before price or speed ranking, so only tools approved for the jurisdiction, role, intended use, population, language, quality, permission and connectivity context are selected.

**Scope boundary:** A cheaper or available incompatible capability must not be substituted. Eligibility exclusions retain reasons under the declared routing contract.

## Canonical scope and hierarchy

Scope ID: SAHA-042; type: functional. Original IDs: BR-AG-03.
CWO references: CWO-019. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-03 — Eligibility before tool selection

Priority: Must; original release: R1.

Tool selection shall first apply jurisdiction, role, intended use, population, input quality, evidence status, consent or other authorisation, language and connectivity constraints. Cost and speed can rank only eligible tools.

Acceptance: A cheaper or available tool with an incompatible approved use is never substituted into the workflow.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AG-03-A — Eligibility before tool selection acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-03. 2. The eligibility filter precedes cost or latency ranking and records excluded tools with machine-readable reasons. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A cheaper or available tool with an incompatible approved use is never substituted into the workflow.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-03-B — Eligibility before tool selection adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Choose a cheaper model outside its approved age or language scope; the router must exclude it. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Choose a cheaper model outside its approved age or language scope; the router must exclude it. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-03: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Jurisdiction, broader population/clinical scope, professional verification and quality eligibility acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Core visual capture correctness and authority take precedence over optional assistance; provider activation/evaluation evidence is a separate dependency.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AG-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover tool eligibility checked before price or speed ranking.
* Refusal/adverse: Run TC-BR-AG-03-B; retained source adverse/recovery case: Choose a cheaper model outside its approved age or language scope; the router must exclude it.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Make the cheapest tool incompatible with age, language or connectivity. Exclude it before ranking and retain eligibility reasons; availability/cost cannot substitute for approved intended use.
* Authorization refinement: For authorised capability user performing “tool eligibility checked before price or speed ranking”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.