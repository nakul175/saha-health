# APL-42 — \[SAHA-019\] Organisational federation

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-42](https://linear.app/aplyd-sandbox/issue/APL-42/saha-019-organisational-federation)  
Stable UUID: `e691b34c-b168-400a-a301-ecfdc372a443`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:13:43.261Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `c90d6215f8d4c0737aacc1649b90d7fd115e2085a66e657aff5e5ad61b95e86f`  
Source plus v4.2 refinement SHA-256: `0dd5112e82f78ed1b37e95e8a4dc6e4c027cfcb4b680a696c814cc686581db23`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a deployment administrator, I want buyer-approved enterprise identity and workforce registry changes reflected in local access, so upstream removals or scope changes terminate incompatible sessions within the approved synchronisation window.

**Scope boundary:** Federated groups use reviewed local role mappings and cannot grant an unmapped clinical privilege. Emergency local administration stays controlled and auditable.

## Canonical scope and hierarchy

Scope ID: SAHA-019; type: functional. Original IDs: BR-ID-10.
CWO references: CWO-011. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R2.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-10 — Organisational federation

Priority: Should; original release: R2.

Where approved by the buyer, enterprise sign-in and authoritative workforce registries shall supply identity and role updates. Local emergency administration shall remain controlled and auditable.

Acceptance: An upstream removal or scope change is reflected within the approved synchronisation window, including termination of incompatible sessions.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-ID-10-A — Organisational federation acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-10.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-10. 2. Federated groups map through reviewed local role mappings; an external group cannot grant an unmapped clinical privilege. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An upstream removal or scope change is reflected within the approved synchronisation window, including termination of incompatible sessions.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-10-B — Organisational federation adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-10-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Change an upstream group to an unrecognised role; local privileged access must not expand. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Change an upstream group to an unrecognised role; local privileged access must not expand. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-10: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Buyer-approved federation or identity-provider sync, automatic upstream removal feed and controlled emergency administration.
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

Source priorities: Should; release: R2. Source package inputs: none recorded. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-10-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover buyer-approved enterprise identity and workforce registry changes reflected in local access.
* Refusal/adverse: Run TC-BR-ID-10-B; retained source adverse/recovery case: Change an upstream group to an unrecognised role; local privileged access must not expand.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Interrupt an upstream workforce feed or receive an unrecognised group mapping. Surface stale synchronisation and deny new unmapped privilege; retain the approved sync-window boundary.
* Authorization refinement: For deployment administrator performing “buyer-approved enterprise identity and workforce registry changes reflected in local access”: Use a revoked/wrong-tenant or no-longer-assigned identity and a guessed object ID; current server role, tenant, assignment, delegation and purpose must deny the protected read/action before content or side effects.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.