# APL-38 — \[SAHA-015\] Local registration without national identifier

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-38](https://linear.app/aplyd-sandbox/issue/APL-38/saha-015-local-registration-without-national-identifier)  
Stable UUID: `36ea59c2-bef9-4425-a574-6262520bb5ea`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:12:25.654Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `374c46c9ba193e21e0de7402af6d9bd171b461056a7ff4d7bef5dc31392a12e7`  
Source plus v4.2 refinement SHA-256: `7d94f13e0c15a04cb3ad303ab3917ddddd3d1d3f26df37a8355c88f31b2012e9`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a worker registering a person, I want a local record and eligible workflow even when ABHA, a personal phone and biometric identifiers are absent, so lack of an external identifier does not force fabricated data.

**Scope boundary:** External identity linking remains a separate authorised process, and programme rules determine which unknown local demographics are permitted.

## Canonical scope and hierarchy

Scope ID: SAHA-015; type: functional. Original IDs: BR-ID-06.
CWO references: None. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-06 — Local registration without national identifier

Priority: Must; original release: R1.

A person shall be able to receive a local record and permitted workflow without an ABHA number, personal phone or biometric identifier. External identity linking shall be a separate authorised process.

Acceptance: A person lacking all three completes an eligible pilot encounter without a fabricated external identifier.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-ID-06-A — Local registration without national identifier acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-06. 2. Create a local UUID before external linking. Required local demographics permit explicit unknown where programme rules allow. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A person lacking all three completes an eligible pilot encounter without a fabricated external identifier.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-06-B — Local registration without national identifier adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Register a person with no ABHA or phone; allow local care capture without invented identifiers. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Register a person with no ABHA or phone; allow local care capture without invented identifiers. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-06: source assessment "implemented-local"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Pilot acceptance with the approved local identity process.
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

* Positive: Run TC-BR-ID-06-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover a local record and eligible workflow even when ABHA, a personal phone and biometric identifiers are absent.
* Refusal/adverse: Run TC-BR-ID-06-B; retained source adverse/recovery case: Register a person with no ABHA or phone; allow local care capture without invented identifiers.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Make external identity-linking unavailable for a locally eligible person. Preserve local registration and capture with explicit unknown fields rather than inventing ABHA, phone or biometrics.
* Authorization refinement: For worker registering a person performing “a local record and eligible workflow even when ABHA, a personal phone and biometric identifiers are absent”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.