# APL-62 — \[SAHA-039\] Additional programme packs

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-62](https://linear.app/aplyd-sandbox/issue/APL-62/saha-039-additional-programme-packs)  
Stable UUID: `9fc4597a-40e6-464e-8d73-c5e7a0d5666c`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:42.867Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `6540cfc298789287de0e97f5d92cea24177f61d7169105378c29c8074f4d2f0d`  
Source plus v4.2 refinement SHA-256: `15d93731644cb660084c1cf6980be8ec14ed8765e04c0f0d85d5f2ebbd3b0cb1`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a programme owner, I want later buyer-approved programme packs to reuse common identity and observations, so new programme workflows can be added through the existing configuration and review process.

**Scope boundary:** Each pack retains independent schedules, roles and destination rules. Adoption depends on workflow and integration readiness, and conflicting concepts require explicit separation or a reviewed mapping.

## Canonical scope and hierarchy

Scope ID: SAHA-039; type: functional. Original IDs: BR-PROG-08.
CWO references: None. Decision references: None recorded.
Primary epic: WP04; related work packages: WP04. Source original release(s): R2.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-08 — Additional programme packs

Priority: Should; original release: R2.

The platform shall support later packs for immunisation, child health, diabetes or other buyer-approved needs using the same configuration and review process. Their adoption is subject to workflow and integration readiness.

Acceptance: A new pack can reuse common identity and observations while defining independent schedules, role boundaries and destination rules.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-08-A — Additional programme packs acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-08.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-08. 2. Additional packs use the same schema with their own definitions and reviewed value sets; pack IDs remain stable across versions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A new pack can reuse common identity and observations while defining independent schedules, role boundaries and destination rules.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-08-B — Additional programme packs adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-08-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Install a new pack with a conflicting concept definition; validation requires explicit separation or reviewed mapping. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Install a new pack with a conflicting concept definition; validation requires explicit separation or reviewed mapping. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-PROG-08: source assessment "partial"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Clinically approved pack content and a clinical sign-off workflow; new programme categories with MIS/EHR/report routing; automated schedules and escalation from installed rules; translations; per-team adoption; cross-organisation publication and production rollout.
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

Source priorities: Should; release: R2. Source package inputs: WP03. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-PROG-08-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover later buyer-approved programme packs to reuse common identity and observations.
* Refusal/adverse: Run TC-BR-PROG-08-B; retained source adverse/recovery case: Install a new pack with a conflicting concept definition; validation requires explicit separation or reviewed mapping.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Install a new synthetic pack with a conflicting concept definition. Validate explicit separation or reviewed mapping before activation; existing packs keep their independent schedules and role boundaries.
* Authorization refinement: For programme owner performing “later buyer-approved programme packs to reuse common identity and observations”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.