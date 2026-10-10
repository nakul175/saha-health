# APL-71 — \[SAHA-048\] Evidence behind explanations

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-71](https://linear.app/aplyd-sandbox/issue/APL-71/saha-048-evidence-behind-explanations)  
Stable UUID: `6709b883-f331-4d88-b0cb-15b63ab00f3f`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:30.823Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `4d72386a72064c89b95f2c70a00f8c90da18ce8d6d65ec966cf819bc1bf510b7`  
Source plus v4.2 refinement SHA-256: `2f642ae079666a9a14134176404a8baa8cfcc157f867f7959a7e0c788570f350`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised reviewer, I want consequential explanations linked to recorded facts, protocol or approved model output and uncertainty, so I can check their evidence before acting.

**Scope boundary:** Model confidence is not certainty. Unsupported clinical answers are withheld or escalated through the existing approved path.

## Canonical scope and hierarchy

Scope ID: SAHA-048; type: functional. Original IDs: BR-AG-09.
CWO references: CWO-017. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-09 — Evidence behind explanations

Priority: Must; original release: R1.

Explanations shall identify the relevant recorded facts, protocol or model and any material uncertainty. They shall not claim certainty from model confidence or supply unsupported clinical advice.

Acceptance: Reviewers can trace each consequential recommendation to its underlying rule or approved output; unsupported answers are withheld or escalated.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AG-09-A — Evidence behind explanations acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-09.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-09. 2. Recommendation records contain source fact IDs and rule or model version references; unsupported text is excluded. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Reviewers can trace each consequential recommendation to its underlying rule or approved output; unsupported answers are withheld or escalated.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-09-B — Evidence behind explanations adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-09-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Request an explanation that is unsupported by the record; show uncertainty or route for review. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Request an explanation that is unsupported by the record; show uncertainty or route for review. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-09: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Verified/licensed clinical source content and consequential recommendation acceptance on representative scenarios.
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

* Positive: Run TC-BR-AG-09-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover consequential explanations linked to recorded facts, protocol or approved model output and uncertainty.
* Refusal/adverse: Run TC-BR-AG-09-B; retained source adverse/recovery case: Request an explanation that is unsupported by the record; show uncertainty or route for review.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Request an explanation unsupported by a source fact/rule/result. Withhold the unsupported statement or use the approved review path, retaining uncertainty rather than fabricating supporting evidence.
* Authorization refinement: For authorised reviewer performing “consequential explanations linked to recorded facts, protocol or approved model output and uncertainty”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.