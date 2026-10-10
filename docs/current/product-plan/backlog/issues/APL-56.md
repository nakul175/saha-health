# APL-56 — \[SAHA-033\] Maternal health workflow

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-56](https://linear.app/aplyd-sandbox/issue/APL-56/saha-033-maternal-health-workflow)  
Stable UUID: `ee6ba20a-affe-446e-aaee-41572eddbfaa`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:10.532Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `c59deab67d7e1f8fd57a7ea559357ba08da4bab7e129d2dfa02b58e7e1b07514`  
Source plus v4.2 refinement SHA-256: `a5ddf825a10f361d2b204f0c7890505ced3129e77e9c0c5da4b9c7029f217869`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want an approved maternal workflow tied to the correct pregnancy episode, so I can track permitted history, due activities, symptoms, missed visits, counselling and referral or supervisor review.

**Scope boundary:** Unknown dates and pregnancy outcomes must not imply an ongoing pregnancy. Closed episodes suppress future episode tasks without erasing history; clinical pathways follow the approved protocol.

## Canonical scope and hierarchy

Scope ID: SAHA-033; type: functional. Original IDs: BR-PROG-02.
CWO references: CWO-032. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-02 — Maternal health workflow

Priority: Must; original release: R1.

The maternal pack shall support pregnancy episode confirmation, permitted visit history, due activities, approved symptom questions, missed visits, counselling and referral or supervisor review. It shall handle unknown dates and pregnancy outcomes without assuming an ongoing pregnancy.

Acceptance: Approved normal, uncertain, overdue, escalated and closed-episode scenarios follow the correct workflow and preserve episode identity.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-02-A — Maternal health workflow acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-02. 2. Maternal records use an episode identifier and outcome state; unknown dates are stored as unknown with task follow-up. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Approved normal, uncertain, overdue, escalated and closed-episode scenarios follow the correct workflow and preserve episode identity.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-02-B — Maternal health workflow adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Record a completed pregnancy outcome; suppress future tasks for the closed episode without erasing history. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Record a completed pregnancy outcome; suppress future tasks for the closed episode without erasing history. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-02: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved maternal symptoms, escalation, missed-visit/outcome logic and clinical scenario evidence.
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

* Positive: Run TC-BR-PROG-02-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover an approved maternal workflow tied to the correct pregnancy episode.
* Refusal/adverse: Run TC-BR-PROG-02-B; retained source adverse/recovery case: Record a completed pregnancy outcome; suppress future tasks for the closed episode without erasing history.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Record a pregnancy outcome or an uncertain date during an interrupted episode update. Preserve episode identity/history and suppress only tasks governed by the approved closed-episode rule.
* Authorization refinement: For frontline worker performing “an approved maternal workflow tied to the correct pregnancy episode”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.