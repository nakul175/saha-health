# APL-96 — \[SAHA-073\] Independent read and write permissions

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-96](https://linear.app/aplyd-sandbox/issue/APL-96/saha-073-independent-read-and-write-permissions)  
Stable UUID: `b29b53b7-f810-49bf-8275-7511f2560bdb`  
Hierarchy kind: `functional_story`  
Native parent: [APL-19](APL-19.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:19:18.760Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `7c892605a437bb865ca4693208428ca75c94928fe60100777b554fef9ba72718`  
Source plus v4.2 refinement SHA-256: `1af680e2e150f2935b478660a3f09fcba391c1879edf4a35439723afb241854f`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an integration owner, I need to configure search, read, create, amend, delete, export and status permissions independently, so that read access cannot enable an unauthorised external write or patient registration.

Bounded scope: A read-only connector exposes no active write path and refuses unsupported submission before dispatch; show when an update needs a separate approved process.

## Canonical scope and hierarchy

Scope ID: SAHA-073; type: functional. Original IDs: BR-INT-02.
CWO references: None. Decision references: None recorded.
Primary epic: WP07; related work packages: WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-INT-02 — Independent read and write permissions

Priority: Must; original release: R1.

Read access, creation, update, deletion, status lookup and aggregation shall be separately configurable. Permission to retrieve a record shall not imply permission to modify it or register a patient.

Acceptance: A read-only connector exposes no active write path and clearly states when programme updates require a separate process.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-INT-02-A — Independent read and write permissions acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-02. 2. The operation allowlist independently grants search, read, create, amend, delete, export and status lookup. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A read-only connector exposes no active write path and clearly states when programme updates require a separate process.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-02-B — Independent read and write permissions adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Use a read-only connector to submit an encounter; block before network dispatch. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Use a read-only connector to submit an encounter; block before network dispatch. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-INT-02: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Live partner adapters configured and tested with narrowed operations; void and aggregate report paths; AI providers are not covered; production acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Prefer a self-contained current synthetic journey before partner-dependent exchange; receiving-owner contracts and real conformance cannot be assumed.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-INT-02-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover configure search, read, create, amend, delete, export and status permissions independently.
* Refusal/adverse: Run TC-BR-INT-02-B; retained source adverse/recovery case: Use a read-only connector to submit an encounter; block before network dispatch.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Prepare a write using read-only connector credentials. Deny before dispatch and show the separate update process; no UI omission may stand in for server enforcement.
* Authorization refinement: For integration owner performing “configure search, read, create, amend, delete, export and status permissions independently”: Remove the required destination-specific write/disclosure authority or expire its consent/purpose between preparation and dispatch; no protected payload may leave and read authority must not grant write authority.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.