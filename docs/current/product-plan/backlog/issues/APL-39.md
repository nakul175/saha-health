# APL-39 — \[SAHA-016\] Household and proxy boundaries

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-39](https://linear.app/aplyd-sandbox/issue/APL-39/saha-016-household-and-proxy-boundaries)  
Stable UUID: `45c143de-7edd-46ce-9af6-8eb632e9b00d`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:12:29.413Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `d163ea1dfadb477d26eb6694026e76f74250a7512c4a580099bbfb1212795a42`  
Source plus v4.2 refinement SHA-256: `5398e2e9862ddc995b2adf8fba5700a82909eb426c6277d262228e2841ed1738`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised record user, I want household relationships and representative authority recorded separately from account access, so each caregiver or household contact receives only information permitted for that relationship.

**Scope boundary:** A family contact number or household membership must not grant access to another member's private history or authorise disclosure.

## Canonical scope and hierarchy

Scope ID: SAHA-016; type: functional. Original IDs: BR-ID-07.
CWO references: None. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-07 — Household and proxy boundaries

Priority: Must; original release: R1.

Household relationships, caregivers and authorised representatives shall be recorded separately from account access. A family contact number shall not grant access to a member's private history or authorise disclosure.

Acceptance: A caregiver and household head can receive only the information permitted by the relevant relationship and authorisation rules.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-ID-07-A — Household and proxy boundaries acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-07. 2. Proxy relationship includes relationship type, authority scope and evidence; household membership does not populate access grants. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A caregiver and household head can receive only the information permitted by the relevant relationship and authorisation rules.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-07-B — Household and proxy boundaries adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. A household head requests another adult member private visit; deny without valid proxy authority. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: A household head requests another adult member private visit; deny without valid proxy authority. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-07: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Household relationships and purpose-limited, expiring proxy authority.
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

Source priorities: Must; release: R1. Source package inputs: none recorded. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover household relationships and representative authority recorded separately from account access.
* Refusal/adverse: Run TC-BR-ID-07-B; retained source adverse/recovery case: A household head requests another adult member private visit; deny without valid proxy authority.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Expire a proxy grant while a household view is open. Stop further protected disclosure and retain the relationship history; membership/contact information cannot substitute for current proxy authority.
* Authorization refinement: For authorised record user performing “household relationships and representative authority recorded separately from account access”: Use a revoked/wrong-tenant or no-longer-assigned identity and a guessed object ID; current server role, tenant, assignment, delegation and purpose must deny the protected read/action before content or side effects.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.