# APL-81 — \[SAHA-058\] Version pinning

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-81](https://linear.app/aplyd-sandbox/issue/APL-81/saha-058-version-pinning)  
Stable UUID: `b4d7eefa-2b14-45b0-a19f-b6629dc38916`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:32.735Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `c0fce9187035138903c11844dd178e102b195a83db374366eb020574e6c68c9d`  
Source plus v4.2 refinement SHA-256: `78822288fa3abbcfdf2c874b29b749fbbb003c767c8aa5b5d256dbb2bceaa4a6`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an AI governance owner, I need to bind each invocation to the approved provider and model release identifier, so that a provider update cannot silently change the version supporting a care decision.

Bounded scope: Keep invocation version evidence and hold a changed or undisclosed release for quarantine or controlled reapproval; historical version attribution remains intact.

## Canonical scope and hierarchy

Scope ID: SAHA-058; type: functional. Original IDs: BR-AI-07.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-07 — Version pinning

Priority: Must; original release: R1.

Production invocations shall bind to an approved provider and model version or an equivalently controlled provider release identifier. Undisclosed provider updates shall be treated as contract violations requiring review.

Acceptance: A provider version change triggers quarantine or controlled reapproval and cannot silently replace a validated version.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-07-A — Version pinning acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-07. 2. Each invocation stores manifest version, provider release ID, input hash and adapter version; mutable aliases are not accepted alone. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A provider version change triggers quarantine or controlled reapproval and cannot silently replace a validated version.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-07-B — Version pinning adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Provider changes its reported version mid-session; hold affected results for review. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Provider changes its reported version mid-session; hold affected results for review. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-07: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Formal provider change review, live contract compatibility and historical legacy provenance limitations.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Core visual capture correctness and authority take precedence over optional assistance; provider activation/evaluation evidence is a separate dependency.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AI-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover bind each invocation to the approved provider and model release identifier.
* Refusal/adverse: Run TC-BR-AI-07-B; retained source adverse/recovery case: Provider changes its reported version mid-session; hold affected results for review.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Change the reported provider/model version during a session. Quarantine affected results and require controlled reapproval; earlier reviewed outputs retain their original version identity.
* Authorization refinement: For AI governance owner performing “bind each invocation to the approved provider and model release identifier”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.