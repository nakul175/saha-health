# APL-73 — \[SAHA-050\] Programme manager analysis

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-73](https://linear.app/aplyd-sandbox/issue/APL-73/saha-050-programme-manager-analysis)  
Stable UUID: `7dbec3c1-986e-4944-97b2-3d0f2e938a0f`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:43.743Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `d8d2b0d529d2cd782b7ae757a1e0b061585bf22b39aebf9c6c91f63f3807ce24`  
Source plus v4.2 refinement SHA-256: `14794051f1504c0a98d836c0e22407d89137ce8fa2fb4589bf04ec0985f949f6`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised programme manager, I want natural-language questions to use approved datasets and metric definitions with visible cohort, period, freshness, filters and method, so results match governed reports.

**Scope boundary:** Apply the same disclosure restrictions as standard reporting. Reformulating an aggregate query must not reveal restricted patient lists or imply general population authority.

## Canonical scope and hierarchy

Scope ID: SAHA-050; type: functional. Original IDs: BR-AG-11.
CWO references: None. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R2.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-11 — Programme manager analysis

Priority: Should; original release: R2.

Authorised managers may request questions over approved datasets and metric definitions. The agent shall disclose the cohort, time period, data freshness, filters and method, and enforce the same restrictions as standard reporting.

Acceptance: A natural-language count matches the governed report and cannot expose restricted patient lists through a reformulated query.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AG-11-A — Programme manager analysis acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-11.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-11. 2. Natural language reporting resolves to approved metric IDs and filters, then applies the same report policy checks. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A natural-language count matches the governed report and cannot expose restricted patient lists through a reformulated query.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-11-B — Programme manager analysis adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-11-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Ask for a hidden patient list through an aggregate question; reject the disclosure. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Ask for a hidden patient list through an aggregate question; reject the disclosure. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J12 — Supervisor outreach planning

Type: End to end; source role: Product QA and programme owner; fixture: FX-J12.
Preconditions: Synthetic environment; role Block supervisor; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Select authorised operational measures and current worker availability.
2\. Find overdue visits and unresolved referrals using governed definitions.
3\. Remove duplicate people from compatible task groups while preserving separate care reasons.
4\. Show missing sources, stale directory entries and uncertainty in the proposed allocation.
5\. The supervisor reviews and confirms assignments within permitted scope.
6\. Workers receive tasks and later record outcomes linked to the report and allocation version.
Inject exception: ABDM HIU permission is not general population analytics authority. Small cohorts remain protected.
Expected: Every proposed and confirmed assignment has a reason, owner and later outcome; no automated sanction occurs.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-11: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Natural-language analysis under governance, validated definitions with an approval workflow, owner-defined measures, and differencing protection across viewers, non-nested filters and groupings.
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

* Positive: Run TC-BR-AG-11-A, TC-J12 using the source-named fixture, actor, preconditions and exact Expected oracle; cover natural-language questions to use approved datasets and metric definitions with visible cohort, period, freshness, filters and method.
* Refusal/adverse: Run TC-BR-AG-11-B; retained source adverse/recovery case: Ask for a hidden patient list through an aggregate question; reject the disclosure.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Disconnect one governed dataset or reformulate an aggregate query to expose a person list. Show freshness/denominator limits and enforce standard report disclosure controls.
* Authorization refinement: For authorised programme manager performing “natural-language questions to use approved datasets and metric definitions with visible cohort, period, freshness, filters and method”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.