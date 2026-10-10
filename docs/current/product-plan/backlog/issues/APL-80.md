# APL-80 — \[SAHA-057\] Input quality and inability to assess

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-80](https://linear.app/aplyd-sandbox/issue/APL-80/saha-057-input-quality-and-inability-to-assess)  
Stable UUID: `6a78b588-af3d-4c78-bdc2-4ce1b782ce97`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:27.389Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `049bd428ce55c06f350619c9a5e6b51a436b37351e40cb08b9dd5914f749e032`  
Source plus v4.2 refinement SHA-256: `22cf7c9ff1a0cf3d3a99b5924794eae323b13176cf7eb77ffa431fe87403d441`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted worker using an approved capability, I need to see input-quality failures, unsupported cases, unavailability and inability to assess as distinct states, so that an unusable recording cannot be mistaken for a negative or low-risk screen.

Bounded scope: Use the selected capability's approved quality and retry instructions; this item does not create clinical thresholds or treat a failed assessment as a clinical result.

## Canonical scope and hierarchy

Scope ID: SAHA-057; type: functional. Original IDs: BR-AI-06.
CWO references: CWO-019. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-06 — Input quality and inability to assess

Priority: Must; original release: R1.

The workflow shall check signal quality and record insufficient-input, unsupported-case, unavailable and unable-to-assess states separately from a low-risk or negative result.

Acceptance: A noisy cough recording produces a quality failure or valid retry instruction, never an implied negative screen.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-06-A — Input quality and inability to assess acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-06. 2. Capture quality failures carry retry guidance from approved provider instructions and do not yield clinical risk values. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A noisy cough recording produces a quality failure or valid retry instruction, never an implied negative screen.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-06-B — Input quality and inability to assess adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Send unusable cough audio; no negative screening label may be generated. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Send unusable cough audio; no negative screening label may be generated. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J02 — Cough analysis within screening

Type: End to end; source role: Product QA and programme owner; fixture: FX-J02.
Preconditions: Synthetic environment; role Permitted worker and clinical reviewer; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Check that the patient, language, recording method and device are within the selected capability approval.
2\. Explain the optional recording and record the required permission without blocking ordinary screening when declined.
3\. Capture the signal using provider-approved instructions and confirm patient context.
4\. Evaluate input quality, upload only permitted fields and create a version-pinned request with a deadline.
5\. Validate the response and display result, limitations and quality state separately from diagnosis.
6\. Apply the locally approved pathway and route any clinical decision to the appropriate reviewer.
Inject exception: Unusable audio returns retry guidance. Provider failure and inability to assess never become a negative screen.
Expected: Invocation and result or failure are traceable; any care decision records its human or approved protocol authority.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-06: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Signal/media quality checks, per-field assessment, complete unsupported-population taxonomy and representative validation.
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

* Positive: Run TC-BR-AI-06-A, TC-J02 using the source-named fixture, actor, preconditions and exact Expected oracle; cover see input-quality failures, unsupported cases, unavailability and inability to assess as distinct states.
* Refusal/adverse: Run TC-BR-AI-06-B; retained source adverse/recovery case: Send unusable cough audio; no negative screening label may be generated.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Send noisy/unusable audio or partial required inputs. Return quality failure/inability-to-assess with a valid retry option; never substitute a negative screen.
* Authorization refinement: For permitted worker using an approved capability performing “see input-quality failures, unsupported cases, unavailability and inability to assess as distinct states”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.