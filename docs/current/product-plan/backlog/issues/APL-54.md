# APL-54 — \[SAHA-031\] Measurement of actual reuse

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-54](https://linear.app/aplyd-sandbox/issue/APL-54/saha-031-measurement-of-actual-reuse)  
Stable UUID: `ad1740ee-6681-4c5d-b36e-e1b3f28e2615`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:00.007Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `385e54553e523fe650f1d08870b95c5f212f11a3207745b0e5f3d5a573730b84`  
Source plus v4.2 refinement SHA-256: `ee55a27b9ee1332b645ef00a1fd559bd6c74558908b09bee79b8e5c38e56a9bf`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an auditor, I want reuse opportunities, actual reuse, repeated questions and blocked-reuse reasons recorded, so I can reproduce a sample calculation and distinguish avoidable re-entry from clinically required recapture.

**Scope boundary:** Metrics exclude facts that differ in meaning or time. A required new measurement is not a duplicate-entry saving.

## Canonical scope and hierarchy

Scope ID: SAHA-031; type: functional. Original IDs: BR-DATA-12.
CWO references: CWO-030. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-12 — Measurement of actual reuse

Priority: Must; original release: R1.

The platform shall count opportunities for reuse, successful reuse, repeated questions and reasons reuse was blocked. Metrics shall exclude facts that are genuinely different in meaning or time.

Acceptance: Auditors can reproduce a sample reuse calculation from event records and separate avoidable re-entry from clinically required recapture.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-12-A — Measurement of actual reuse acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-12.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-12. 2. Reuse opportunities are logged before question display, with reasons for reuse, recapture or blocked reuse. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Auditors can reproduce a sample reuse calculation from event records and separate avoidable re-entry from clinically required recapture.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-12-B — Measurement of actual reuse adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-12-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Count clinically new measurements as duplicate-entry savings; the metric must exclude them. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Count clinically new measurements as duplicate-entry savings; the metric must exclude them. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-12: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Baseline comparability, real transport recovery and external support workflows beyond the bounded internal helper implementation, validation against observed field practice and real pilot time savings remain unproven.
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

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-12-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover reuse opportunities, actual reuse, repeated questions and blocked-reuse reasons recorded.
* Refusal/adverse: Run TC-BR-DATA-12-B; retained source adverse/recovery case: Count clinically new measurements as duplicate-entry savings; the metric must exclude them.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Replay reuse events and add a clinically required recapture. Reproduce the denominator and exclude the new measurement from duplicate-entry savings rather than inflating benefit.
* Authorization refinement: For auditor performing “reuse opportunities, actual reuse, repeated questions and blocked-reuse reasons recorded”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.