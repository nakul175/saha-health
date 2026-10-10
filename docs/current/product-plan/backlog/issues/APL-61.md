# APL-61 — \[SAHA-038\] Protocol change and case continuity

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-61](https://linear.app/aplyd-sandbox/issue/APL-61/saha-038-protocol-change-and-case-continuity)  
Stable UUID: `b062a662-441d-4d29-9c0c-f3699035cf7e`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:38.364Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `f96c36d164ca009c06d228ff4ae879809555caac860ac5cefed5dae547d77db0`  
Source plus v4.2 refinement SHA-256: `80badc1a3e5ca8516d91b56e333bf0ee00ba9ab809bee933602b37fe5fea0ce4`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a programme owner, I want pack changes to identify their effective date, affected population and transition for open cases, so updated protocols do not silently rewrite historical decisions.

**Scope boundary:** Open work follows a reviewed migration, and historical actions retain the rule version in force. Loading a new rule during a visit cannot silently reinterpret already approved actions.

## Canonical scope and hierarchy

Scope ID: SAHA-038; type: functional. Original IDs: BR-PROG-07.
CWO references: None. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-07 — Protocol change and case continuity

Priority: Must; original release: R1.

Pack changes shall have an effective date, affected population, change summary and transition rule for open cases. Historical actions shall retain the rules in force when they occurred.

Acceptance: Updating a referral rule identifies affected open work and requires reviewed migration rather than silently rewriting past decisions.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-07-A — Protocol change and case continuity acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-07. 2. Pack migration computes affected open cases and applies an approved transition plan at an effective timestamp. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Updating a referral rule identifies affected open work and requires reviewed migration rather than silently rewriting past decisions.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-07-B — Protocol change and case continuity adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Load a new rule version during an open visit; do not silently reinterpret already approved actions. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Load a new rule version during an open visit; do not silently reinterpret already approved actions. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-07: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved pack versions with their own clinical review, per-team adoption, answer migration and schedule recomputation, a reviewed reverse path, and coordinated version changes across installed packs (installation is BR-PROG-08).
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

* Positive: Run TC-BR-PROG-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover pack changes to identify their effective date, affected population and transition for open cases.
* Refusal/adverse: Run TC-BR-PROG-07-B; retained source adverse/recovery case: Load a new rule version during an open visit; do not silently reinterpret already approved actions.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Load a new protocol while an open case has approved pending actions. Identify affected work and preserve historical rule versions until the reviewed transition/migration is authorised.
* Authorization refinement: For programme owner performing “pack changes to identify their effective date, affected population and transition for open cases”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.