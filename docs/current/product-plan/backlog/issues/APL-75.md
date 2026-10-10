# APL-75 — \[SAHA-052\] Capability registration

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-75](https://linear.app/aplyd-sandbox/issue/APL-75/saha-052-capability-registration)  
Stable UUID: `06ddd4ab-3e5f-4ddd-a769-4f19d17bab07`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:58.762Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `e5c1c1af8bd46980adae86db8a4c8ce6d3a93ef4ebaeb57ab02ad75039d511e6`  
Source plus v4.2 refinement SHA-256: `40deaba8e13fccbd165e0e1d24c50ac688133340e8f0de9aeb3be99e1ba4074c`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an accountable provider or deployment owner, I want each capability registered with a stable identity, version, purpose, schemas, scope, evidence, limits and support contact, so its ownership and permitted operation can be checked before activation.

**Scope boundary:** Clinical and administrative capabilities remain distinct. Missing mandatory manifest fields or accountable ownership keeps the capability inactive; API success alone cannot approve clinical use.

## Canonical scope and hierarchy

Scope ID: SAHA-052; type: functional. Original IDs: BR-AI-01.
CWO references: CWO-019,CWO-020. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AI-01 — Capability registration

Priority: Must; original release: R1.

Every capability shall have an accountable provider, a stable identity, version, purpose, input and output definitions, deployment scope, evidence, operating limits and a support contact. Clinical and administrative capabilities shall be clearly distinguished.

Acceptance: Registration cannot reach an active state while mandatory manifest fields or accountable ownership are missing.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AI-01-A — Capability registration acceptance

Type: Functional; source role: QA with AI governance owner; fixture: FX-AI-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AI-01. 2. A manifest version is immutable and owned by one verified provider; missing evidence keeps its activation state incomplete. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Registration cannot reach an active state while mandatory manifest fields or accountable ownership are missing.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AI-01-B — Capability registration adverse condition

Type: Negative or recovery; source role: QA with AI governance owner; fixture: FX-AI-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Register a capability without input schema or accountable owner; reject activation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Register a capability without input schema or accountable owner; reject activation. Evidence must show the actual final state and any accountable unresolved work.
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

BR-AI-01: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Live provider onboarding, evidence ownership and verification of the full accountable manifest.
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

* Positive: Run TC-BR-AI-01-A, TC-J05 using the source-named fixture, actor, preconditions and exact Expected oracle; cover each capability registered with a stable identity, version, purpose, schemas, scope, evidence, limits and support contact.
* Refusal/adverse: Run TC-BR-AI-01-B; retained source adverse/recovery case: Register a capability without input schema or accountable owner; reject activation.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Omit a mandatory manifest schema or accountable owner. Keep registration incomplete/inactive and provide the exact missing field; an API response cannot finish capability approval.
* Authorization refinement: For accountable provider or deployment owner performing “each capability registered with a stable identity, version, purpose, schemas, scope, evidence, limits and support contact”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.