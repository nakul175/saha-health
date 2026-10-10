# APL-31 — \[SAHA-008\] Low literacy and field use

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-31](https://linear.app/aplyd-sandbox/issue/APL-31/saha-008-low-literacy-and-field-use)  
Stable UUID: `a14f31e4-6b7d-4ebf-93d8-ec45914fbd41`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:38.077Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `dbc9f7ac51b80bcafadd2a3c90f0f119a4fdddc26b6cb5aaf8480998b474fe5a`  
Source plus v4.2 refinement SHA-256: `14490501898cd37648edd0c45968938b895d52f40f8f002869c8a8c06350a3b4`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want short labels, clear touch targets and understandable progress in common field workflows, so I can complete principal tasks under noisy, low-literacy and private-entry conditions.

**Scope boundary:** Audio guidance is on demand, and status cannot rely on colour alone. Representative worker evaluation under the defined field protocol remains part of acceptance.

## Canonical scope and hierarchy

Scope ID: SAHA-008; type: functional. Original IDs: BR-UX-08.
CWO references: CWO-023,CWO-030. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-08 — Low literacy and field use

Priority: Should; original release: R1.

Common actions shall use short labels, clear touch targets and a small number of steps. Audio guidance shall be available only on demand to avoid disclosure in a shared setting. Progress shall not rely on colour alone.

Acceptance: Representative workers complete the principal tasks under the defined field usability protocol, including noisy and private-entry conditions.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-UX-08-A — Low literacy and field use acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-08.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-08. 2. Critical actions use short labels and text plus icon status. Optional audio guidance stops before private playback. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Representative workers complete the principal tasks under the defined field usability protocol, including noisy and private-entry conditions.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-08-B — Low literacy and field use adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-08-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Use the flow with colour perception disabled and a shared-device privacy setting; status remains understandable. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Use the flow with colour perception disabled and a shared-device privacy setting; status remains understandable. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-08: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: On-demand audio guidance and representative low-literacy field evaluation.
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

Source priorities: Should; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-UX-08-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover short labels, clear touch targets and understandable progress in common field workflows.
* Refusal/adverse: Run TC-BR-UX-08-B; retained source adverse/recovery case: Use the flow with colour perception disabled and a shared-device privacy setting; status remains understandable.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Interrupt audio guidance and use the flow in a noisy/shared-device condition. Keep concise visual instructions, non-colour status and private-entry recovery available without automatic audio playback.
* Authorization refinement: For frontline worker performing “short labels, clear touch targets and understandable progress in common field workflows”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.