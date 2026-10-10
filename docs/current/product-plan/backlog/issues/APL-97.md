# APL-97 — \[SAHA-074\] Confirmed submission receipts

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-97](https://linear.app/aplyd-sandbox/issue/APL-97/saha-074-confirmed-submission-receipts)  
Stable UUID: `b8fce5d7-7777-4607-b29d-ffae23aedae2`  
Hierarchy kind: `functional_story`  
Native parent: [APL-19](APL-19.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:19:24.440Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `691b277d0e5a89eea2557ed5518aca0a8baed7d1811342a6b4f6ec5a8ade10fd`  
Source plus v4.2 refinement SHA-256: `3c70de178f78f77c29892e92a31396f00d4e914ac32c1e81d957e47a055efc1c`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted worker reviewing an external submission, I need to see its destination, submitted version, initiating authority and meaningful receipt or error, so that a transport success cannot hide a destination business rejection.

Bounded scope: Keep every attempted write independently traceable; only the destination's meaningful acknowledgement can support an accepted status.

## Canonical scope and hierarchy

Scope ID: SAHA-074; type: functional. Original IDs: BR-INT-03.
CWO references: CWO-015,CWO-016. Decision references: None recorded.
Primary epic: WP07; related work packages: WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-INT-03 — Confirmed submission receipts

Priority: Must; original release: R1.

Every attempted external write shall retain destination, submitted version, time, initiating authority, status and receipt or error. Acceptance shall require the destination's meaningful acknowledgement, not merely a successful HTTP transport response.

Acceptance: A response containing a business rejection is shown as rejected even when the network request technically succeeded.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-INT-03-A — Confirmed submission receipts acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-03. 2. Acceptance requires a verified destination business receipt linked to payload revision and action ID. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A response containing a business rejection is shown as rejected even when the network request technically succeeded.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-03-B — Confirmed submission receipts adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Return HTTP 200 with a business rejection; record rejected rather than accepted. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Return HTTP 200 with a business rejection; record rejected rather than accepted. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-INT-03: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Actual partner acceptance and authorisation evidence.
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

* Positive: Run TC-BR-INT-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover see its destination, submitted version, initiating authority and meaningful receipt or error.
* Refusal/adverse: Run TC-BR-INT-03-B; retained source adverse/recovery case: Return HTTP 200 with a business rejection; record rejected rather than accepted.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return HTTP 200 carrying a destination business rejection, or lose a receipt lookup. Keep rejection/uncertainty explicit; a transport acknowledgement cannot establish business acceptance.
* Authorization refinement: For permitted worker reviewing an external submission performing “see its destination, submitted version, initiating authority and meaningful receipt or error”: Remove the required destination-specific write/disclosure authority or expire its consent/purpose between preparation and dispatch; no protected payload may leave and read authority must not grant write authority.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.