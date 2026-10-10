# APL-60 — \[SAHA-037\] Eligibility and enrolment distinction

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-60](https://linear.app/aplyd-sandbox/issue/APL-60/saha-037-eligibility-and-enrolment-distinction)  
Stable UUID: `7fd0278d-eb54-4afa-87d1-0943985a16a3`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:32.016Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `35221c1e9f29812d738d35bc9f96ca944ab9c79afb62dc42fa965500915d777f`  
Source plus v4.2 refinement SHA-256: `57c3dde993b337f80cea4e9ec29a404cf78bb0fa5c571986d6bb21811240ea80`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want programme eligibility and prepared enrolment distinguished from official registration, so I can see the actual destination acceptance or rejection and any next action.

**Scope boundary:** Official enrolment requires destination acceptance and programme-specific authority. Rejection keeps the person locally visible without a false enrolled status.

## Canonical scope and hierarchy

Scope ID: SAHA-037; type: functional. Original IDs: BR-PROG-06.
CWO references: None. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-06 — Eligibility and enrolment distinction

Priority: Must; original release: R1.

The platform may identify eligibility and prepare enrolment, but official enrolment shall require the destination's acceptance and any programme-specific authorisation.

Acceptance: A person whose external enrolment is rejected remains locally visible with a clear rejection reason and no false enrolled status.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-06-A — Eligibility and enrolment distinction acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-06. 2. Enrolment stores eligibility_assessment and external_registration independently; only a verified receipt confirms the latter. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A person whose external enrolment is rejected remains locally visible with a clear rejection reason and no false enrolled status.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-06-B — Eligibility and enrolment distinction adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Reject external enrolment; the local record remains visible as not externally enrolled. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Reject external enrolment; the local record remains visible as not externally enrolled. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-06: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Destination-authorised enrolment request/rejection/acceptance lifecycle.
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

* Positive: Run TC-BR-PROG-06-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover programme eligibility and prepared enrolment distinguished from official registration.
* Refusal/adverse: Run TC-BR-PROG-06-B; retained source adverse/recovery case: Reject external enrolment; the local record remains visible as not externally enrolled.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return an external enrolment business rejection after a successful network response. Keep the person locally visible, show the rejection and avoid a false official-registration state.
* Authorization refinement: For frontline worker performing “programme eligibility and prepared enrolment distinguished from official registration”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.