# APL-69 — \[SAHA-046\] Limits and cancellation

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-69](https://linear.app/aplyd-sandbox/issue/APL-69/saha-046-limits-and-cancellation)  
Stable UUID: `a817d2e6-94d5-483c-82c9-3e74e138049a`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:21.874Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `5435f4d15d36702de6a52779524013687a3db0d4616c670ec248f5499b387d97`  
Source plus v4.2 refinement SHA-256: `1b8931337f644fe815ea1db470eb956f317c97fedafddbd827793dc47a59a26d`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a worker, I want assistance tasks to respect configured time, call, retry and spending limits and allow pending activity to stop, so loops end with an understandable record of completed, cancelled and unresolved actions.

**Scope boundary:** Cancelling pending work must not claim to reverse an externally accepted action. Executor limits remain independent of model output.

## Canonical scope and hierarchy

Scope ID: SAHA-046; type: functional. Original IDs: BR-AG-07.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-07 — Limits and cancellation

Priority: Must; original release: R1.

Every task shall have limits on time, tool calls, retries and spend. Users shall be able to stop pending activity. Cancelling cannot falsely reverse an action already accepted elsewhere.

Acceptance: A looping provider interaction stops at the configured limit and reports which actions completed, were cancelled or remain unresolved.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AG-07-A — Limits and cancellation acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-07. 2. Enforce max_steps, deadline and budget in the executor independently of model output; cancellation records residual work. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A looping provider interaction stops at the configured limit and reports which actions completed, were cancelled or remain unresolved.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-07-B — Limits and cancellation adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Force a recursive tool loop; stop at the configured bound with a visible incomplete state. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Force a recursive tool loop; stop at the configured bound with a visible incomplete state. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-07: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: A looping-provider stop reporting completed/cancelled/unresolved actions across multi-step tasks, background detection and delivery of timed-out requests, provider billing API reconciliation, delivered alerts and validated provider outage operation.
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

* Positive: Run TC-BR-AG-07-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover assistance tasks to respect configured time, call, retry and spending limits and allow pending activity to stop.
* Refusal/adverse: Run TC-BR-AG-07-B; retained source adverse/recovery case: Force a recursive tool loop; stop at the configured bound with a visible incomplete state.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Force a recursive tool interaction and cancel at its configured limit. Preserve completed external receipts and identify cancelled/unresolved work; cancellation does not imply external reversal.
* Authorization refinement: For worker performing “assistance tasks to respect configured time, call, retry and spending limits and allow pending activity to stop”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.