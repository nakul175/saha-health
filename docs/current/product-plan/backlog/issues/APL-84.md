# APL-84 — \[SAHA-061\] Monitoring and safety suspension

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-84](https://linear.app/aplyd-sandbox/issue/APL-84/saha-061-monitoring-and-safety-suspension)  
Stable UUID: `d9f5331e-2270-4d6b-a842-ff7a339a230d`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:17:49.444Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `8f09e6f51d709f54befbdeb1f0fc947920f2a14d887ce1b8ac4e8569a41939d7`  
Source plus v4.2 refinement SHA-256: `1a4377c36b094b681d706ca1e187e2c9264c2f98df99ac6854888caa44011599`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised operator, I need to monitor and suspend a named capability version and identify affected encounters for follow-up, so that safety investigation can contain the affected work without disabling unrelated safe capabilities.

Bounded scope: Cover availability, latency, quality/unsupported cases, usage, incidents and reviewed outcomes where suitable ground truth exists; preserve accountable follow-up and the approved investigation process.

## Canonical scope and hierarchy

Scope ID: SAHA-061; type: functional. Original IDs: BR-AI-10.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-10 — Monitoring and safety suspension

Priority: Must; original release: R1.

Monitoring shall cover availability, latency, input-quality failures, unsupported cases, usage, incidents and reviewed outcome measures where suitable ground truth exists. Clinical degradation shall trigger the approved investigation and suspension process.

Acceptance: Operators can suspend a named version, identify affected encounters and assign follow-up without disabling unrelated safe capabilities.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-10-A — Monitoring and safety suspension acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-10.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-10. 2. Suspension sets an effective timestamp, prevents new admissions and emits tasks for affected pending or recent encounters. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Operators can suspend a named version, identify affected encounters and assign follow-up without disabling unrelated safe capabilities.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-10-B — Monitoring and safety suspension adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-10-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Suspend a provider while requests are queued; no new provider call may leave the broker. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Suspend a provider while requests are queued; no new provider call may leave the broker. Evidence must show the actual final state and any accountable unresolved work.
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

BR-AI-10: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative quality monitoring on live, representative data rather than local-rules shadow comparisons, configurable drift thresholds, drift from synthetic evaluations, independent ground-truth annotation and adjudication, delivered alerting and clinical response operations.
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

* Positive: Run TC-BR-AI-10-A, TC-J05 using the source-named fixture, actor, preconditions and exact Expected oracle; cover monitor and suspend a named capability version and identify affected encounters for follow-up.
* Refusal/adverse: Run TC-BR-AI-10-B; retained source adverse/recovery case: Suspend a provider while requests are queued; no new provider call may leave the broker.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Suspend a named version with queued requests and affected completed encounters. Stop new dispatch, enumerate affected scope and assign follow-up without disabling unrelated eligible capabilities.
* Authorization refinement: For authorised operator performing “monitor and suspend a named capability version and identify affected encounters for follow-up”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.