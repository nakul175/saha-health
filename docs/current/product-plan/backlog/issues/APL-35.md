# APL-35 — \[SAHA-012\] Authentication and recovery

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-35](https://linear.app/aplyd-sandbox/issue/APL-35/saha-012-authentication-and-recovery)  
Stable UUID: `858ebcfd-9f6a-4eb3-ade9-1f7ca90508dd`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:12:11.126Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `77c79eefb5f554b0a4f91d7ca74f415adc8d8a7cb8d92569b402161f1dc2e88e`  
Source plus v4.2 refinement SHA-256: `d9afa031d9f12ce74fc2f358f7c797fcbd99d1debeb3fd7b8bb7230937ff47bc`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a worker, I want an approved sign-in and identity-verified recovery path, so I can regain access after device replacement while superseded credentials are revoked.

**Scope boundary:** Privileged access requires its second factor. Patient information or a shared phone number alone cannot establish recovery authority.

## Canonical scope and hierarchy

Scope ID: SAHA-012; type: functional. Original IDs: BR-ID-03.
CWO references: CWO-011,CWO-027,CWO-031. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-03 — Authentication and recovery

Priority: Must; original release: R1.

Workers shall use an approved authentication method appropriate to devices and connectivity. Privileged roles require a second factor. Recovery and device replacement shall verify identity and revoke superseded credentials.

Acceptance: Recovery cannot be completed using patient data or a shared phone number alone; privileged access remains blocked without the required factor.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-ID-03-A — Authentication and recovery acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-03. 2. Use verified institutional authentication. Privileged users require MFA and recovery invalidates old sessions and devices. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Recovery cannot be completed using patient data or a shared phone number alone; privileged access remains blocked without the required factor.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-03-B — Authentication and recovery adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Attempt recovery using only a known patient number; the request must fail. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Attempt recovery using only a known patient number; the request must fail. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-03: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Verified privileged MFA, workforce recovery/device replacement and session revocation acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Risk reduction and prerequisite identity/policy integrity outrank convenience features; qualify the current slice-specific controls before expanding access/actions.

Source priorities: Must; release: R1. Source package inputs: none recorded. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover an approved sign-in and identity-verified recovery path.
* Refusal/adverse: Run TC-BR-ID-03-B; retained source adverse/recovery case: Attempt recovery using only a known patient number; the request must fail.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Interrupt identity-verified recovery during device replacement. Keep recovery incomplete and superseded credentials revoked as applicable; patient facts/shared phone alone must not finish recovery.
* Authorization refinement: For worker performing “an approved sign-in and identity-verified recovery path”: Use a revoked/wrong-tenant or no-longer-assigned identity and a guessed object ID; current server role, tenant, assignment, delegation and purpose must deny the protected read/action before content or side effects.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.