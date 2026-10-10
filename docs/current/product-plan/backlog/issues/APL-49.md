# APL-49 — \[SAHA-026\] Concurrent edits

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-49](https://linear.app/aplyd-sandbox/issue/APL-49/saha-026-concurrent-edits)  
Stable UUID: `85b1d6ec-4c8a-4d30-8abb-57cbe235d59f`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:19.792Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `a4417f44670ba418756aac437894a5c7233140ec65ae46b43242febfa8211f3e`  
Source plus v4.2 refinement SHA-256: `e5a8a4b51d2d593145f2b2a1a557ca684573f91610455904a05cb22666796b58`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised record user, I want conflicting edits from people, devices or external sources shown with both versions, so clinically meaningful differences receive authorised resolution.

**Scope boundary:** No silent overwrite or unsafe destination update is allowed before resolution. The declared offline two-device collision scenario remains part of acceptance.

## Canonical scope and hierarchy

Scope ID: SAHA-026; type: functional. Original IDs: BR-DATA-07.
CWO references: None. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-07 — Concurrent edits

Priority: Must; original release: R1.

Conflicting edits from workers, devices or external sources shall be detectable. Clinically meaningful conflicts shall require authorised resolution rather than silent overwrite.

Acceptance: Two offline edits to the same observation produce a visible conflict with both versions, and no unsafe destination update is committed before resolution.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-07-A — Concurrent edits acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-07. 2. Compare expected record version before commit. Store both candidate revisions and a conflict object on collision. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Two offline edits to the same observation produce a visible conflict with both versions, and no unsafe destination update is committed before resolution.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-07-B — Concurrent edits adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Sync two devices with contradictory edits; no silent overwrite may occur. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Sync two devices with contradictory edits; no silent overwrite may occur. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-07: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative concurrent offline edits and partner-origin clinical conflict resolution.
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

* Positive: Run TC-BR-DATA-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover conflicting edits from people, devices or external sources shown with both versions.
* Refusal/adverse: Run TC-BR-DATA-07-B; retained source adverse/recovery case: Sync two devices with contradictory edits; no silent overwrite may occur.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Reconnect two devices with contradictory edits to the same observation. Show both versions and block an unsafe destination update until the existing authorised resolution completes.
* Authorization refinement: For authorised record user performing “conflicting edits from people, devices or external sources shown with both versions”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.