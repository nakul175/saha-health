# SAHA quality rules — User story

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current assessment boundary

Use seven must-pass gates for the selected planning stage and this element type. Full product AI and personal-data branches are applicable: governed assistance and health/workforce records are protected original scope. A bounded manual D03 task introduces no model/provider but inherits applicable authorization, audit, data and source controls. No AI/privacy blanket exclusion is permitted.

The detailed reference field library supports diagnosis; it does not require hundreds of independent detail verdicts. Supporting samples are advisory, at most two per hierarchy level across the assessed scope. An observed mandatory/safety failure is never sampled away. Later readiness, delivery and learning evidence remains separately assessed at its actual stage.

### gate.user_story.planning.01 — Outcome and traceability

One bounded user/operator need and observable outcome resolves to its canonical epic/release and original source clauses; supporting/investigation items use their explicit variant rather than invented end-user value. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.identity`, `common.traceability`, `user_story.identity_parent`, `user_story.story_statement`, `user_story.source_clauses`.

### gate.user_story.planning.02 — Scope and context

Trigger/preconditions, main journey, in/out of scope, preserved behaviour and affected users/operators are explicit; the experience can be understood without guessing. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.boundary`, `user_story.context_trigger`, `user_story.in_scope`, `user_story.out_of_scope`, `user_story.main_journey`.

### gate.user_story.planning.03 — Discovery and evidence

Evidence and inspected reuse sources support the need/design; unresolved assumptions/decisions retain exact source, actual owner and resume condition, and source criteria are distinguished from proposed supplements. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.evidence`, `common.source_provenance`, `user_story.inspected_components`, `user_story.source_supplement_separation`, `user_story.ready_prerequisites`.

### gate.user_story.planning.04 — Measures and verification

Identified criteria define observable positive/adverse/refusal/failure/authorization/recovery outcomes as applicable; every criterion maps to an approved evaluation context and expected evidence, with measurable thresholds where required. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `user_story.criteria`, `user_story.scenario_coverage`, `user_story.evaluation_mapping`, `user_story.nfr_thresholds`.

### gate.user_story.planning.05 — Priority, size and dependencies

Priority follows sourced outcome, urgency/risk and alternatives; size is an attributable range/coarse unit with method, uncertainty, scope and dependencies, supporting a feasible bounded item. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `user_story.priority_rationale`, `user_story.size_estimate`, `user_story.ready_prerequisites`.

### gate.user_story.planning.06 — Applicable assurance and controls

Actual operation contracts and side effects, access/accountability, refusal, information continuity, accessibility and NFRs cover applicable risks; AI acceptance metrics/slices, safety/fallback, rights/versioning and monitoring use the pinned module. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated. Unsampled conditional assurance: resolve product AI yes/no/unknown from the pinned actual context. If AI is used, AI-01 to AI-07 in the pinned module apply at their current-stage requirements: dataset quality/rights, predeclared overall and critical-slice metrics/thresholds, observed safety/refusal/fallback, exact model/prompt/configuration revision, applicable personal-data/jurisdiction decisions and monitoring/drift/rollback. An evidence-backed no-use exclusion must not waive other applicable obligations. Unknown applicability or absent required rights/results is unresolved, never N/A.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.context_profile`, `user_story.operation_contracts`, `user_story.permissions_refusal`, `user_story.interaction_accessibility`, `user_story.nfr_thresholds`.

Mandatory conditional branches (source scope determines applicability):

```json
{
  "ai": [
    "common.ai_assurance_reference",
    "user_story.ai_acceptance_contract"
  ],
  "personalData": [
    "common.personal_data_controls"
  ]
}
```

### gate.user_story.planning.07 — Governance and learning

Canonical team Ready/Done versions and item-specific additions are linked; quality, specification approval, execution readiness, criterion acceptance and delivery are distinct, with final revision and outcome-learning hand-off current. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current User story revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.state`, `common.change_history`, `user_story.specification_state`, `user_story.team_ready_reference`, `user_story.team_done_reference`.

## Working order and evidence

Check → summary → next → fix → check again. Use the unchanged v4.2 checker and its pinned catalogue. Source-backed editorial repairs and explicitly labelled recommendations can proceed autonomously. Actual external approval, actor identity, frontline/device outcomes and launch evidence cannot be assumed. Missing/stale reviews remain unresolved. Offline results are advisory, even with a locally matching trust file.

Every review names the exact revision, source, evidence locator, criterion and reason; edits invalidate affected reviews. Preserve original acceptance text and frozen specifications. One versioned team Ready checklist (`SAHA-READY-1.0`) and Done checklist (`SAHA-DONE-1.0`) are linked from stories/tasks in the existing readiness document.
