# APL-78 — \[SAHA-055\] Capability lifecycle and isolation of experimental output

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-78](https://linear.app/aplyd-sandbox/issue/APL-78/saha-055-capability-lifecycle-and-isolation-of-experimental-output)  
Stable UUID: `6f1899b2-e3c3-480d-90bc-b26401b19303`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:17.399Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `81a4be3c592e295d50856bc472fa33a961e2ed9a15843236e04e7cade0b85f88`  
Source plus v4.2 refinement SHA-256: `5f4529942ad29f9344f88ee6786d3961ffc2d70ebfb53cd29c10228c1e828996`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an AI governance owner, I need to manage a capability's deployment-specific lifecycle and isolate trial, shadow and other unapproved outputs, so that only approved capabilities can influence care and suspended versions stop receiving new invocations.

Bounded scope: Track registration through replacement, refusal of provider self-activation, suspension impacts on in-progress work and exclusion of experimental outputs from operational care; no new clinical approval is granted by this item.

## Canonical scope and hierarchy

Scope ID: SAHA-055; type: functional. Original IDs: BR-AI-04, BR-RULE-07.
CWO references: CWO-020. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05, WP02. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-04 — Capability lifecycle

Priority: Must; original release: R1.

The lifecycle shall cover registered, technically verified, under review, approved for a scope, active, suspended, retired and replaced. Activation shall be deployment-specific and allow trial or shadow status without exposing unapproved results to care.

Acceptance: A provider cannot self-activate; suspension blocks new invocations and identifies in-progress work requiring cancellation or review.

### BR-RULE-07 — No experimental output in care

Priority: Must; original release: R1.

Training, synthetic, shadow or unapproved model results shall be segregated from the operational care record and shall not influence user-visible clinical action lists.

Acceptance: An experimental high-risk result cannot trigger a live referral or patient notification outside an explicitly authorised evaluation protocol.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-04-A — Capability lifecycle acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-04. 2. Lifecycle transitions require scoped roles; registration and deployment approval are independent permissions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A provider cannot self-activate; suspension blocks new invocations and identifies in-progress work requiring cancellation or review.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-04-B — Capability lifecycle adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Provider owner tries to activate their own version in a live tenant; deny the transition. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Provider owner tries to activate their own version in a live tenant; deny the transition. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-07-A — No experimental output in care acceptance

Type: Functional; source role: QA with All actors; fixture: FX-RULE-07.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-RULE-07. 2. Environment and output-use labels travel with every model result; live action builders reject test or shadow results. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An experimental high-risk result cannot trigger a live referral or patient notification outside an explicitly authorised evaluation protocol.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-07-B — No experimental output in care adverse condition

Type: Negative or recovery; source role: QA with All actors; fixture: FX-RULE-07-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Attach a shadow result to a real care order; reject the source association. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Attach a shadow result to a real care order; reject the source association. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J05 — Onboard and suspend a provider

Type: End to end; source role: Product QA and programme owner; fixture: FX-J05.
Preconditions: Synthetic environment; role Provider owner AI governance and clinical safety; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Register the provider and immutable manifest version in a synthetic test space.
2\. Run schema, quality, correlation, retry and timeout contract tests.
3\. Review hosting, retention, intended use, evidence and local clinical deployment scope.
4\. Activate the approved version only for its named deployment and population.
5\. Monitor errors, drift signals, cost and safety cases with defined escalation owners.
6\. When a material issue occurs suspend new calls, assess running work and identify affected encounters.
7\. Require corrective evidence and fresh review before a corrected version is activated.
Inject exception: An API test alone does not enable live clinical use. An unapproved alternative provider cannot silently take over.
Expected: Provider history, activation evidence, suspension scope and follow-up work are reproducible.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AI-04: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Verified registration step, deployment-specific activation, automatic and live-provider shadow runs, delivered impact queues and live lifecycle acceptance.
BR-RULE-07: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Hard environment segregation and experimental-result exclusion from future production care.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-AI-04 · APL-238](<https://linear.app/aplyd-sandbox/issue/APL-238/eng-br-ai-04-capability-lifecycle>) — Capability lifecycle
* [ENG-BR-RULE-07 · APL-778](<https://linear.app/aplyd-sandbox/issue/APL-778/eng-br-rule-07-no-experimental-output-in-care>) — No experimental output in care

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Core visual capture correctness and authority take precedence over optional assistance; provider activation/evaluation evidence is a separate dependency.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 6–14 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AI-04-A, TC-BR-RULE-07-A, TC-J05 using the source-named fixture, actor, preconditions and exact Expected oracle; cover manage a capability's deployment-specific lifecycle and isolate trial, shadow and other unapproved outputs.
* Refusal/adverse: Run TC-BR-AI-04-B, TC-BR-RULE-07-B; retained source adverse/recovery case: Provider owner tries to activate their own version in a live tenant; deny the transition. | Attach a shadow result to a real care order; reject the source association.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Suspend a version while requests are queued, or attach a shadow result to care. Block new invocation/live association and identify in-progress work requiring permitted cancellation or review.
* Authorization refinement: For AI governance owner performing “manage a capability's deployment-specific lifecycle and isolate trial, shadow and other unapproved outputs”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.