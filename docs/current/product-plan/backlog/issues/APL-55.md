# APL-55 — \[SAHA-032\] Versioned programme packs

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-55](https://linear.app/aplyd-sandbox/issue/APL-55/saha-032-versioned-programme-packs)  
Stable UUID: `b3d3024d-0fb6-49cc-bc8e-4720793a510b`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:05.278Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `3db5813a72bd9e3af60c41ad8b193f1a2b33e9c4d11042883990cb9a1691234e`  
Source plus v4.2 refinement SHA-256: `53a205ab8cfba6fa701903ed9a3ed71173dbc0db68402f4d170c4a04c37fa52b`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a programme owner, I want programme packs to define eligibility, questions, evidence, roles, workflow states, escalation, mappings and indicators as versioned configurations, so completed encounters identify the approved rules used.

**Scope boundary:** Incomplete or unapproved packs cannot activate. Named business and clinical approvals apply where required by the existing programme process.

## Canonical scope and hierarchy

Scope ID: SAHA-032; type: functional. Original IDs: BR-PROG-01.
CWO references: None. Decision references: DEC-08.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-01 — Versioned programme packs

Priority: Must; original release: R1.

Each pack shall define population, eligibility, questions, mandatory evidence, authorised roles, workflow states, escalation, destination mappings and indicators. Activation requires named business and clinical approvals where applicable.

Acceptance: An incomplete or unapproved pack cannot be activated, and each completed encounter records the pack version used.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-01-A — Versioned programme packs acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-01. 2. Activation requires valid schemas, approved mappings, effective dates and named programme and clinical approvals. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An incomplete or unapproved pack cannot be activated, and each completed encounter records the pack version used.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-01-B — Versioned programme packs adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Activate a pack with an unsigned escalation rule; it must remain unavailable. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Activate a pack with an unsigned escalation rule; it must remain unavailable. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-01: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Integrate complete governed manifests with programme questions, indicators and approved clinical protocols.
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

Source priorities: Must; release: R1. Source package inputs: WP03. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-PROG-01-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover programme packs to define eligibility, questions, evidence, roles, workflow states, escalation, mappings and indicators as versioned configurations.
* Refusal/adverse: Run TC-BR-PROG-01-B; retained source adverse/recovery case: Activate a pack with an unsigned escalation rule; it must remain unavailable.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Attempt pack activation with a missing question, mapping or unsigned existing escalation rule. Keep that version inactive and report actionable configuration errors; completed encounters retain their pack version.
* Authorization refinement: For programme owner performing “programme packs to define eligibility, questions, evidence, roles, workflow states, escalation, mappings and indicators as versioned configurations”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.