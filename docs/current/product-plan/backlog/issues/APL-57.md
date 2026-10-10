# APL-57 — \[SAHA-034\] TB screening workflow

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-57](https://linear.app/aplyd-sandbox/issue/APL-57/saha-034-tb-screening-workflow)  
Stable UUID: `0655327c-38f2-4829-8547-40d7d9b88fa2`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:15.954Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `4642c4000aa1f282cf2deeb110d09bfab989f2c69dc1f9159d92e2644d314189`  
Source plus v4.2 refinement SHA-256: `4ab984665c43d92294d73f8938c26310c3e78dfff7108991ca515a7d93d9383d`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want an authorised TB screening and follow-up workflow, so symptom history, referral preparation and unresolved testing or care milestones remain visible.

**Scope boundary:** Optional AI screening is distinct from confirmed diagnosis and official registration. A low-risk AI result cannot suppress referral required by the approved symptom protocol.

## Canonical scope and hierarchy

Scope ID: SAHA-034; type: functional. Original IDs: BR-PROG-03.
CWO references: None. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-03 — TB screening workflow

Priority: Must; original release: R1.

The TB pack shall support authorised symptom screening, relevant history, optional eligible AI assistance, referral preparation and follow-up of testing or care milestones. Screening output shall remain separate from confirmed diagnosis and official programme registration.

Acceptance: A low-risk AI output cannot suppress a referral required by the approved symptom protocol, and an unresolved result remains visible for follow-up.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-03-A — TB screening workflow acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-03. 2. TB screening and programme registration are separate workflows with separate confirmation and receipt states. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A low-risk AI output cannot suppress a referral required by the approved symptom protocol, and an unresolved result remains visible for follow-up.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-03-B — TB screening workflow adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Return a low-risk model output while the approved symptom rule escalates; retain the escalation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Return a low-risk model output while the approved symptom rule escalates; retain the escalation. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-03: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved TB protocol, tested urgent referral paths and non-suppressible clinical escalation.
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

* Positive: Run TC-BR-PROG-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover an authorised TB screening and follow-up workflow.
* Refusal/adverse: Run TC-BR-PROG-03-B; retained source adverse/recovery case: Return a low-risk model output while the approved symptom rule escalates; retain the escalation.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return a low-risk AI result while the approved symptom rule requires escalation, then make the provider unavailable. Retain the protocol-required referral and explicit unresolved testing milestone.
* Authorization refinement: For frontline worker performing “an authorised TB screening and follow-up workflow”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.