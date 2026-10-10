# APL-70 — \[SAHA-047\] Disagreement handling without false model equivalence

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-70](https://linear.app/aplyd-sandbox/issue/APL-70/saha-047-disagreement-handling-without-false-model-equivalence)  
Stable UUID: `b1e204e1-7853-4b8d-8522-32473c9941c7`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:26.157Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `aa42a0ea910d1a52912878d8f3e69a7a8c45dcf03636997e225ff31558d1b3ff`  
Source plus v4.2 refinement SHA-256: `06d8965ff96702053b147790048cb83ff623b081cc0b31d05c4ff0223aa9d37c`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised reviewer, I want contradictory or incomparable model results shown separately with their original meaning, so disagreement follows approved review policy without a fabricated diagnosis or score.

**Scope boundary:** Do not average confidence or risk scales, invent consensus or suppress a qualifying warning unless a validated composition explicitly permits it.

## Canonical scope and hierarchy

Scope ID: SAHA-047; type: functional. Original IDs: BR-AG-08, BR-RULE-05.
CWO references: CWO-017. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05, WP02. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-08 — Conflicting outputs

Priority: Must; original release: R1.

Contradictory or incomparable model outputs shall be shown as such and routed according to approved policy. The agent shall not average risk scores, invent a consensus or suppress a qualifying warning unless a validated composition explicitly permits it.

Acceptance: A designed model-disagreement case produces a review task with both original outputs and no fabricated combined diagnosis.

### BR-RULE-05 — No false model equivalence

Priority: Must; original release: R1.

Provider outputs shall retain their meaning and intended use. Confidence scores from different models shall not be treated as directly comparable without an approved interpretation and evaluation.

Acceptance: A multi-model result screen avoids a fabricated common score and presents the required review path for disagreement.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-AG-08-A — Conflicting outputs acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-08.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-08. 2. Store each model result separately. A conflict policy creates a human review task for incompatible outputs. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A designed model-disagreement case produces a review task with both original outputs and no fabricated combined diagnosis.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-08-B — Conflicting outputs adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-08-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Return opposite risk outputs; no fabricated average or consensus diagnosis may appear. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Return opposite risk outputs; no fabricated average or consensus diagnosis may appear. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-05-A — No false model equivalence acceptance

Type: Functional; source role: QA with All actors; fixture: FX-RULE-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-RULE-05. 2. Result displays preserve provider-specific scales and calibration notes; unsupported score comparisons are disallowed. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A multi-model result screen avoids a fabricated common score and presents the required review path for disagreement.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-05-B — No false model equivalence adverse condition

Type: Negative or recovery; source role: QA with All actors; fixture: FX-RULE-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Average two unrelated risk scores in a plan; validation rejects the invented combined metric. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Average two unrelated risk scores in a plan; validation rejects the invented combined metric. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-08: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Cross-model composition policy, routing beyond the requesting worker, comparison with earlier confirmed records and validated disagreement handling for risk outputs.
BR-RULE-05: source assessment "implemented-local"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved composition/disagreement policy if combined clinical outputs are introduced.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-AG-08 · APL-230](<https://linear.app/aplyd-sandbox/issue/APL-230/eng-br-ag-08-conflicting-outputs>) — Conflicting outputs
* [ENG-BR-RULE-05 · APL-776](<https://linear.app/aplyd-sandbox/issue/APL-776/eng-br-rule-05-no-false-model-equivalence>) — No false model equivalence

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Core visual capture correctness and authority take precedence over optional assistance; provider activation/evaluation evidence is a separate dependency.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 6–14 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AG-08-A, TC-BR-RULE-05-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover contradictory or incomparable model results shown separately with their original meaning.
* Refusal/adverse: Run TC-BR-AG-08-B, TC-BR-RULE-05-B; retained source adverse/recovery case: Return opposite risk outputs; no fabricated average or consensus diagnosis may appear. | Average two unrelated risk scores in a plan; validation rejects the invented combined metric.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return contradictory models with incompatible scales. Keep both original results and route the existing review path without an invented average, consensus or combined diagnosis.
* Authorization refinement: For authorised reviewer performing “contradictory or incomparable model results shown separately with their original meaning”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.