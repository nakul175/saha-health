# APL-58 — \[SAHA-035\] Hypertension follow-up workflow

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-58](https://linear.app/aplyd-sandbox/issue/APL-58/saha-035-hypertension-follow-up-workflow)  
Stable UUID: `e1a39324-9da2-42a6-b773-79778dc21c3f`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:21.635Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `282ddfb98762f55173f31093b1ba8a5fae374064a85af0e302ab229ed7f6af2a`  
Source plus v4.2 refinement SHA-256: `96b9079e750be6936e73935b45bb507683c4f7f74ddf47c81a185ba73cf08ea8`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want an approved hypertension follow-up workflow with measurement context, reported medicines, adherence discussion and scheduled review, so I can capture follow-up and route escalation correctly.

**Scope boundary:** Preserve measurement unit, time, context and source. Reported medication history is not a prescription; issuing or amending clinical orders requires a qualified authorised user.

## Canonical scope and hierarchy

Scope ID: SAHA-035; type: functional. Original IDs: BR-PROG-04.
CWO references: None. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-04 — Hypertension follow-up workflow

Priority: Must; original release: R1.

The hypertension pack shall support protocol-authorised measurements, medication history as reported, adherence discussion, scheduled review and escalation. Prescription changes and clinical orders require a qualified authorised user.

Acceptance: Worker tests cannot issue or amend a prescription, and measurements retain unit, time, context and source.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-04-A — Hypertension follow-up workflow acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-04. 2. Measurements include device or observer, time, unit and context. Reported medicines are not signed prescriptions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Worker tests cannot issue or amend a prescription, and measurements retain unit, time, context and source.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-04-B — Hypertension follow-up workflow adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. A frontline worker attempts a medication order; reject the command and retain the report as history. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: A frontline worker attempts a medication order; reject the command and retain the report as history. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J11 — Coordinated chronic care follow up

Type: End to end; source role: Product QA and programme owner; fixture: FX-J11.
Preconditions: Synthetic environment; role Worker clinician and patient; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Identify compatible due tasks for a person in hypertension and diabetes care.
2\. Read permitted history with dates and source systems visible.
3\. Contact through the approved worker or patient channel respecting shared-phone preferences.
4\. Ask the combined approved questions and record any new measurements with current timestamps.
5\. Prepare appointments, medication-access tasks or clinical review requests for authorised confirmation.
6\. Write each reviewed update through its supported destination and assign unresolved follow-up.
Inject exception: An old EHR measurement cannot substitute for a required new observation. Concerning answers route to a qualified person.
Expected: Each programme action and EHR update retains independent status and ownership.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-04: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved measurement/adherence context, schedules, escalation and independent clinical evidence.
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

* Positive: Run TC-BR-PROG-04-A, TC-J11 using the source-named fixture, actor, preconditions and exact Expected oracle; cover an approved hypertension follow-up workflow with measurement context, reported medicines, adherence discussion and scheduled review.
* Refusal/adverse: Run TC-BR-PROG-04-B; retained source adverse/recovery case: A frontline worker attempts a medication order; reject the command and retain the report as history.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Enter an unsupported blood-pressure unit or attempt a medication order as a frontline worker. Preserve reported history/context and reject unqualified prescribing under the existing role rules.
* Authorization refinement: For frontline worker performing “an approved hypertension follow-up workflow with measurement context, reported medicines, adherence discussion and scheduled review”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.