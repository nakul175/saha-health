# APL-85 — \[SAHA-062\] Provider self-service in a controlled environment

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-85](https://linear.app/aplyd-sandbox/issue/APL-85/saha-062-provider-self-service-in-a-controlled-environment)  
Stable UUID: `81273dfe-02a0-4dcf-a80f-f6cb323bf5ba`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:54.305Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `b9b3d01da732c01533e73635688f88b5fbb044f699ff26306be7ced03b5eb3d0`  
Source plus v4.2 refinement SHA-256: `e8c47c06a97b1b5dff66db5e3604ec35ac6d3e78890d4d9655f2b5464d4939db`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a provider permitted to use the controlled test environment, I need to maintain my own capability documentation, test credentials and proposed versions with approved synthetic fixtures, so that I can prepare a version for review without accessing unrelated capabilities or patient records.

Bounded scope: Keep provider access limited to its own capability and synthetic environment; providers cannot publish directly to production or activate their own live version.

## Canonical scope and hierarchy

Scope ID: SAHA-062; type: functional. Original IDs: BR-AI-11.
CWO references: CWO-020. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R2.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-11 — Provider self-service in a controlled environment

Priority: Should; original release: R2.

Providers may maintain documentation, credentials for testing and proposed versions in an isolated environment using approved synthetic data. They shall not publish directly to production or inspect unrestricted patient payloads.

Acceptance: Provider test access remains limited to its own capability and synthetic environment; production activation follows the standard review path.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-11-A — Provider self-service in a controlled environment acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-11.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-11. 2. Provider workspaces allow manifest drafts and synthetic fixtures only; live activation stays in deployment governance. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Provider test access remains limited to its own capability and synthetic environment; production activation follows the standard review path.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-11-B — Provider self-service in a controlled environment adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-11-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. A provider account attempts to read a real encounter or another vendor manifest draft; deny access. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: A provider account attempts to read a real encounter or another vendor manifest draft; deny access. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-11: source assessment "partial"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Physically isolated environment, provider-registered test endpoints, provider-facing contract and independent acceptance.
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

Source priorities: Should; release: R2. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AI-11-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover maintain my own capability documentation, test credentials and proposed versions with approved synthetic fixtures.
* Refusal/adverse: Run TC-BR-AI-11-B; retained source adverse/recovery case: A provider account attempts to read a real encounter or another vendor manifest draft; deny access.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Attempt provider test access to real encounter data or another vendor draft. Deny at the synthetic-environment/tenant/capability boundary; failed self-service cannot self-activate production.
* Authorization refinement: For provider permitted to use the controlled test environment performing “maintain my own capability documentation, test credentials and proposed versions with approved synthetic fixtures”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.