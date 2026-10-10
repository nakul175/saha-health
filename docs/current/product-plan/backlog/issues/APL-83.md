# APL-83 — \[SAHA-060\] Multi-provider result history

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-83](https://linear.app/aplyd-sandbox/issue/APL-83/saha-060-multi-provider-result-history)  
Stable UUID: `795ec333-de09-4569-9dce-f7bd3db550f5`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:42.488Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `cb15fa9e98d0793dfba6bd3598d9a341549504940fb3efc832e5b4a810475b8f`  
Source plus v4.2 refinement SHA-256: `797bced94a1d4ee6a4ef503701038573acb2c6624e55b66f550b7684ec237b66`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted record user, I need to inspect separate provider results with original output, version, input timestamps and review states, so that an earlier decision remains traceable after a provider changes.

Bounded scope: A new provider invocation adds independent history; it must not overwrite an old output or obscure the version originally used.

## Canonical scope and hierarchy

Scope ID: SAHA-060; type: functional. Original IDs: BR-AI-09.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-09 — Multi-provider result history

Priority: Must; original release: R1.

The platform shall retain provider attribution and original output for each invocation. Replacing a provider shall not overwrite historical results or obscure the version used for an earlier decision.

Acceptance: An encounter spanning a provider change shows both results independently with their input timestamps and review states.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-09-A — Multi-provider result history acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-09.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-09. 2. Results are immutable references with provider attribution. Switching a provider creates a new invocation, never rewrites history. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An encounter spanning a provider change shows both results independently with their input timestamps and review states.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-09-B — Multi-provider result history adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-09-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Replace an active model and view an old encounter; the original provider and output remain visible. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Replace an active model and view an old encounter; the original provider and output remain visible. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J08 — Multi AI clinical consultation and EHR update

Type: End to end; source role: Product QA and programme owner; fixture: FX-J08.
Preconditions: Synthetic environment; role Nurse and clinician; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Open the authorised EHR person context and reconcile it with the local encounter.
2\. Record history and observations once with device associations and source times.
3\. Invoke approved retinal and ECG capabilities separately using their required inputs.
4\. Display the original traces or images, provider versions, limitations and independent outputs.
5\. The clinician records their interpretation and signs the care plan and permitted orders.
6\. Prepare and validate EHR writes; display business receipts and preserve any version conflict.
7\. Prepare ABDM clinical artefacts only through the separately enabled HIP scope.
Inject exception: Unsupported media requires recapture. Rejection of one EHR record does not reverse other accepted records.
Expected: Signed clinical decision, EHR receipts and any ABDM publication state are independently traceable.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-09: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Complete legacy provenance, end-to-end input-time semantics and external-provider acceptance.
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

* Positive: Run TC-BR-AI-09-A, TC-J08 using the source-named fixture, actor, preconditions and exact Expected oracle; cover inspect separate provider results with original output, version, input timestamps and review states.
* Refusal/adverse: Run TC-BR-AI-09-B; retained source adverse/recovery case: Replace an active model and view an old encounter; the original provider and output remain visible.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Replace the active provider and reopen an old encounter. Preserve separate original results, input timestamps and review states; failure to fetch old output must not silently show the new provider result.
* Authorization refinement: For permitted record user performing “inspect separate provider results with original output, version, input timestamps and review states”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.