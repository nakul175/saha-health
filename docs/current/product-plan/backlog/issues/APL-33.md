# APL-33 — \[SAHA-010\] Workforce lifecycle and timely online revocation

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-33](https://linear.app/aplyd-sandbox/issue/APL-33/saha-010-workforce-lifecycle-and-timely-online-revocation)  
Stable UUID: `bb86d1d0-def5-4b76-959f-cc6870c30a6f`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:46.654Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `043d20b8706980f8c2c7822d63022e7bfa5a758bc8a7b6bfb3ae29e4489152f6`  
Source plus v4.2 refinement SHA-256: `335bb83b4c067db53c7857d6924c2b77b5293d7970db7d10116ffc6dec28159d`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a deployment administrator or identity steward, I want to manage verified workforce membership from invitation through removal, so organisation-owned accounts and pending privileged work reflect each user's current role.

**Scope boundary:** Shared credentials are not the operating model. Suspension or role removal stops new online access and actions within five minutes; disconnected-device residual access follows its disclosed offline grant and lock limits.

## Canonical scope and hierarchy

Scope ID: SAHA-010; type: functional. Original IDs: BR-ID-01, NFR-09.
CWO references: CWO-011,CWO-031. Decision references: DEC-02.
Primary epic: WP01; related work packages: WP01, WP11. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-01 — Workforce lifecycle

Priority: Must; original release: R1.

The platform shall support invitation or approved import, identity verification, role assignment, activation, suspension, reassignment and removal. Every account shall belong to an accountable organisation; shared credentials shall not be the operating model.

Acceptance: A suspended user's online access and pending privileged actions are revoked within the NFR limit, with offline limits disclosed.

### NFR-09 — Online revocation

Priority: Must; original release: R1.

Role removal or account suspension shall stop new online access and actions within 5 minutes. A disconnected device is constrained by its offline grant and local lock policy; it cannot be promised immediate remote revocation.

Verification: Session, background job and reconnect tests enforce the limit and record the residual offline window.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-ID-01-A — Workforce lifecycle acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-01. 2. Membership activation follows institutional verification; suspension increments a revocation version consumed by all services. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A suspended user's online access and pending privileged actions are revoked within the NFR limit, with offline limits disclosed.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-01-B — Workforce lifecycle adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Suspend a user with an active browser session and queued work; new online actions stop within the BRD limit. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Suspend a user with an active browser session and queued work; new online actions stop within the BRD limit. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-09-A — Online revocation acceptance

Type: Performance or control; source role: QA with engineering owner; fixture: FX-NFR-09.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-NFR-09. 2. Suspend sessions and service accounts during active requests and queues; timestamp last allowed action and first denial. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Session, background job and reconnect tests enforce the limit and record the residual offline window.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-09-B — Online revocation adverse condition

Type: Negative or recovery; source role: QA with engineering owner; fixture: FX-NFR-09-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Keep an offline device disconnected; report residual access until lease expiry rather than claiming immediate revocation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Keep an offline device disconnected; report residual access until lease expiry rather than claiming immediate revocation. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-01: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Formal verification, scheduled or API workforce feeds, upstream de-provisioning, batches over 100 rows, verified and displayed external staff ids, and production identity governance.
NFR-09: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Measured production revocation across sessions, background jobs and devices within five minutes.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-ID-01 · APL-193](<https://linear.app/aplyd-sandbox/issue/APL-193/eng-br-id-01-workforce-lifecycle>) — Workforce lifecycle
* [ENG-NFR-09 · APL-788](<https://linear.app/aplyd-sandbox/issue/APL-788/eng-nfr-09-online-revocation>) — Online revocation

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Risk reduction and prerequisite identity/policy integrity outrank convenience features; qualify the current slice-specific controls before expanding access/actions.

Source priorities: Must; release: R1. Source package inputs: WP02, WP05, WP07, WP08, WP09, WP10. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-01-A, TC-NFR-09-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover manage verified workforce membership from invitation through removal.
* Refusal/adverse: Run TC-BR-ID-01-B, TC-NFR-09-B; retained source adverse/recovery case: Suspend a user with an active browser session and queued work; new online actions stop within the BRD limit. | Keep an offline device disconnected; report residual access until lease expiry rather than claiming immediate revocation.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Suspend a synthetic account with an active session, background job and disconnected device. Timestamp online denial against the retained five-minute target and disclose the actual offline grant window.
* Authorization refinement: For deployment administrator or identity steward performing “manage verified workforce membership from invitation through removal”: Use a revoked/wrong-tenant or no-longer-assigned identity and a guessed object ID; current server role, tenant, assignment, delegation and purpose must deny the protected read/action before content or side effects.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.