# APL-76 — \[SAHA-053\] Intended use and excluded use

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-76](https://linear.app/aplyd-sandbox/issue/APL-76/saha-053-intended-use-and-excluded-use)  
Stable UUID: `f3cd8f2c-8c5f-470a-b573-526cfe58f65e`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:03.992Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `bab91659e7a0654086e0bd6b60db91c4086211b30cb2d153dd6db6593d65fddc`  
Source plus v4.2 refinement SHA-256: `f61efd07b8cfef4829ff0a9047d23a9ba9952e55d7b158c347031bfd656f6261`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised capability user, I want intended and excluded uses checked against the current person and deployment context, so a capability runs only for approved users, populations, ages, settings, languages, devices and input quality.

**Scope boundary:** Machine-checkable eligibility is enforced and other conditions remain explicitly reviewable. Adult-only approval does not permit child use or required-but-unknown age without separate approval.

## Canonical scope and hierarchy

Scope ID: SAHA-053; type: functional. Original IDs: BR-AI-02.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-02 — Intended use and excluded use

Priority: Must; original release: R1.

Each capability shall specify authorised users, populations, age range where relevant, settings, languages, devices, required input quality and excluded uses. Eligibility shall be machine-checkable where possible and explicitly reviewable elsewhere.

Acceptance: A capability approved for adults cannot run on a child case unless that use has separate approval.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-02-A — Intended use and excluded use acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-02. 2. Eligibility predicates cover role, age basis, population, language, device, geography, quality and required history. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A capability approved for adults cannot run on a child case unless that use has separate approval.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-02-B — Intended use and excluded use adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Invoke an adult-only model for a child or unknown age when age is required; return unsupported-case. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Invoke an adult-only model for a child or unknown age when age is required; return unsupported-case. Evidence must show the actual final state and any accountable unresolved work.
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

BR-AI-02: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Verified intended use, jurisdiction and broader population criteria with representative clinical evidence.
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

* Positive: Run TC-BR-AI-02-A, TC-J02 using the source-named fixture, actor, preconditions and exact Expected oracle; cover intended and excluded uses checked against the current person and deployment context.
* Refusal/adverse: Run TC-BR-AI-02-B; retained source adverse/recovery case: Invoke an adult-only model for a child or unknown age when age is required; return unsupported-case.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Prepare an adult-only capability for a child or required-but-unknown age. Return unsupported-case before invocation; no cheaper or similar tool may bypass the same intended-use restriction.
* Authorization refinement: For authorised capability user performing “intended and excluded uses checked against the current person and deployment context”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.