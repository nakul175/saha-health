# APL-32 — \[SAHA-009\] Explainable action review

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-32](https://linear.app/aplyd-sandbox/issue/APL-32/saha-009-explainable-action-review)  
Stable UUID: `fda5fdeb-9f51-4d06-b59b-63f4dd27bc44`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:13:37.284Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `721e08525ee23dc8a5ead92f024007b8163ee158b7fc4940a27c34addb1af1c7`  
Source plus v4.2 refinement SHA-256: `72dc7d7178e3360cd8f5e0b72f1ed8b7593b3f87fd0c9cc62f84e190f452787e`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want to review a consequential action's purpose, receiving organisation and information before committing it, so I can edit a fact or exclude a destination and confirm only permitted actions.

**Scope boundary:** Grouping routine actions follows configured policy. A changed recipient must require fresh review rather than silently reusing a previous approval.

## Canonical scope and hierarchy

Scope ID: SAHA-009; type: functional. Original IDs: BR-UX-09.
CWO references: CWO-007. Decision references: DEC-08.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-09 — Explainable action review

Priority: Must; original release: R1.

Before committing consequential actions, users shall see what will happen, the receiving organisation and the information involved in language suited to their role. Safe routine actions may be grouped by encounter under configured policy.

Acceptance: A worker can exclude one proposed destination or edit one fact before confirming the remaining permitted action bundle.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-UX-09-A — Explainable action review acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-09.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-09. 2. Approval review lists purpose, recipient and exact record revisions. The worker can exclude an optional action. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A worker can exclude one proposed destination or edit one fact before confirming the remaining permitted action bundle.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-09-B — Explainable action review adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-09-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Change the recipient after approval; execution must require a fresh review. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Change the recipient after approval; execution must require a fresh review. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-09: source assessment "implemented-local"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Partner-specific payload comprehension and recipient exclusion acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D06 / <issue id="6984cd43-72e8-497c-b9bd-947968776004" href="https://linear.app/aplyd-sandbox/issue/APL-10/d06-open-or-prepare-bounded-tasks-conversationally">APL-10</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-UX-09-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover review a consequential action's purpose, receiving organisation and information before committing it.
* Refusal/adverse: Run TC-BR-UX-09-B; retained source adverse/recovery case: Change the recipient after approval; execution must require a fresh review.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Change one fact or recipient while the action-review screen is open. Invalidate the affected previous confirmation and return to a review of the actual remaining permitted bundle.
* Authorization refinement: For frontline worker performing “review a consequential action's purpose, receiving organisation and information before committing it”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.