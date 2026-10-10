# APL-77 — \[SAHA-054\] Evidence and deployment authorisation

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-77](https://linear.app/aplyd-sandbox/issue/APL-77/saha-054-evidence-and-deployment-authorisation)  
Stable UUID: `3dff9cd4-81da-4f4d-8209-974aff563fe6`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:10.735Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `dda59b5e5973c9cf999e0472611f333015643dd7057009c379ed594f19c3fe0f`  
Source plus v4.2 refinement SHA-256: `d383e91db1d6b7c2f231836957f4c552b20aba8ce1ec5b02beda44e31d25e1fd`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an AI governance owner, I need to review model-version evidence, evaluation context, limitations and deployment authorisation separately, so that clinical activation cannot follow from a successful technical API test alone.

Bounded scope: Evidence review and regulatory/deployment decisions remain separate, version-bound records; activation stays blocked until the source-required evidence and approvals exist.

## Canonical scope and hierarchy

Scope ID: SAHA-054; type: functional. Original IDs: BR-AI-03.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-03 — Evidence and deployment authorisation

Priority: Must; original release: R1.

Evidence records shall identify model version, evaluation context, limitations and review decisions. Regulatory status and local deployment authorisation shall be recorded separately from technical integration and sandbox evaluation.

Acceptance: A technically successful API test cannot activate a clinical capability without the required documented evidence and deployment approvals.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-03-A — Evidence and deployment authorisation acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-03. 2. Evidence and approval are distinct records tied to provider version, population, study setting and deployment scope. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A technically successful API test cannot activate a clinical capability without the required documented evidence and deployment approvals.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-03-B — Evidence and deployment authorisation adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Provide only an API success log as evidence; clinical activation remains blocked. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Provide only an API success log as evidence; clinical activation remains blocked. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-03: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Regulatory status, representative clinical evidence and signed deployment authorisation; no real approval recorded.
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

* Positive: Run TC-BR-AI-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover review model-version evidence, evaluation context, limitations and deployment authorisation separately.
* Refusal/adverse: Run TC-BR-AI-03-B; retained source adverse/recovery case: Provide only an API success log as evidence; clinical activation remains blocked.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Supply only an API success receipt for a clinical model version. Keep deployment authorisation blocked and identify the missing signed capability-specific evidence and deployment approval.
* Authorization refinement: For AI governance owner performing “review model-version evidence, evaluation context, limitations and deployment authorisation separately”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.