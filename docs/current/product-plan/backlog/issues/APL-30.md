# APL-30 — \[SAHA-007\] Resume interrupted work

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-30](https://linear.app/aplyd-sandbox/issue/APL-30/saha-007-resume-interrupted-work)  
Stable UUID: `2279d36f-e262-4b7a-966e-95da73cbf2d3`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:33.406Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `27eb768cc6b1f35323d9a698ba28292202da86f26db7d123b7721e52f575021c`  
Source plus v4.2 refinement SHA-256: `1fca9594de22a15ffb165b311e22ea29fe66ee147d5ad17fb0fd8231495c430a`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want interrupted visits to reopen at their last durable state, so I can continue captured fields, unanswered questions and pending actions without repeating successfully recorded measurements.

**Scope boundary:** App restarts, incoming calls and connection loss must retain every field previously acknowledged as durably saved. Read-only reopening in D02 does not qualify the full interruption or offline persistence contract.

## Canonical scope and hierarchy

Scope ID: SAHA-007; type: functional. Original IDs: BR-UX-07.
CWO references: CWO-002,CWO-005. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-07 — Resume interrupted work

Priority: Must; original release: R1.

An interrupted visit shall reopen at its last durable state with captured data, outstanding questions and pending actions. Users shall not repeat a successfully recorded measurement solely because a screen or connection was lost.

Acceptance: App restart, incoming call and network-loss scenarios retain every field previously shown as durably saved.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-UX-07-A — Resume interrupted work acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-07. 2. Persist a draft revision after each committed field change and store the last completed workflow step. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: App restart, incoming call and network-loss scenarios retain every field previously shown as durably saved.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-07-B — Resume interrupted work adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Terminate the application after a successful local save and before sync; reopen the same draft revision. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Terminate the application after a successful local save and before sync; reopen the same draft revision. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-07: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Physical-device crash, incoming-call, eviction and network-loss acceptance; broader offline caseload and native Android qualification remain.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D02 / <issue id="adfe4945-bb19-47a6-a87d-a2f8c80962fe" href="https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today">APL-6</issue>, D04 / <issue id="97b6a5ad-d077-4b8c-b510-aa32e06d2f48" href="https://linear.app/aplyd-sandbox/issue/APL-8/d04-retain-routine-work-through-offline-interruption">APL-8</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

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

* Positive: Run TC-BR-UX-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover interrupted visits to reopen at their last durable state.
* Refusal/adverse: Run TC-BR-UX-07-B; retained source adverse/recovery case: Terminate the application after a successful local save and before sync; reopen the same draft revision.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Kill the app immediately after its durable-save acknowledgement, then reopen. Compare every acknowledged field and pending question with the same draft revision; disclose genuinely unsaved inputs.
* Authorization refinement: For frontline worker performing “interrupted visits to reopen at their last durable state”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.