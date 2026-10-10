# SAHA quality rules — Acceptance criteria

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current assessment boundary

Use seven must-pass gates for the selected planning stage and this element type. Full product AI and personal-data branches are applicable: governed assistance and health/workforce records are protected original scope. A bounded manual D03 task introduces no model/provider but inherits applicable authorization, audit, data and source controls. No AI/privacy blanket exclusion is permitted.

The detailed reference field library supports diagnosis; it does not require hundreds of independent detail verdicts. Supporting samples are advisory, at most two per hierarchy level across the assessed scope. An observed mandatory/safety failure is never sampled away. Later readiness, delivery and learning evidence remains separately assessed at its actual stage.

### gate.acceptance_criterion.planning.01 — Outcome and traceability

Criterion ID and owning item resolve to exact source provenance/current specification; a proposed supplement is distinguished from a protected original requirement. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.identity`, `common.traceability`, `acceptance_criterion.identity_owner`, `acceptance_criterion.source_provenance`, `acceptance_criterion.approval_state`.

### gate.acceptance_criterion.planning.02 — Scope and context

Given/When/Then identify one scenario, trigger, expected observable result and applicable prohibited effects without implementation guesses or hidden side effects. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.boundary`, `acceptance_criterion.scenario_kind`, `acceptance_criterion.given`, `acceptance_criterion.when`, `acceptance_criterion.then`, `acceptance_criterion.prohibited_effects`.

### gate.acceptance_criterion.planning.03 — Discovery and evidence

The intended scenario and evaluation design use relevant source/risk evidence and an authorized reproducible context; missing facts or unavailable test inputs remain unresolved rather than guessed. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.evidence`, `common.source_provenance`, `acceptance_criterion.source_provenance`, `acceptance_criterion.evaluation_method`.

### gate.acceptance_criterion.planning.04 — Measures and verification

Measurement defines method, units, threshold, sample/population and uncertainty where relevant; expected evidence can distinguish pass/fail, and AI metrics use fixed dataset/slice/model/prompt revisions. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `acceptance_criterion.measurement`, `acceptance_criterion.expected_evidence`.

### gate.acceptance_criterion.planning.05 — Priority, size and dependencies

The criterion maps to the owning item priority/risk and feasible verification method; any fixture/sample or predecessor constraint is explicit, and one result is not double-counted across competing criterion IDs. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `acceptance_criterion.identity_owner`, `acceptance_criterion.evaluation_method`, `acceptance_criterion.gap_resume`.

### gate.acceptance_criterion.planning.06 — Applicable assurance and controls

The criterion covers its applicable safety/privacy/access/authorization/fallback obligation and prohibited effects; actual AI accuracy and critical-slice/safety thresholds are independently required when this criterion claims AI behaviour. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated. Unsampled conditional assurance: resolve product AI yes/no/unknown from the pinned actual context. If AI is used, AI-01 to AI-07 in the pinned module apply at their current-stage requirements: dataset quality/rights, predeclared overall and critical-slice metrics/thresholds, observed safety/refusal/fallback, exact model/prompt/configuration revision, applicable personal-data/jurisdiction decisions and monitoring/drift/rollback. An evidence-backed no-use exclusion must not waive other applicable obligations. Unknown applicability or absent required rights/results is unresolved, never N/A.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.context_profile`, `acceptance_criterion.prohibited_effects`, `acceptance_criterion.measurement`.

Mandatory conditional branches (source scope determines applicability):

```json
{
  "ai": [
    "common.ai_assurance_reference",
    "acceptance_criterion.ai_evaluation_measurement"
  ],
  "personalData": [
    "common.personal_data_controls"
  ]
}
```

### gate.acceptance_criterion.planning.07 — Governance and learning

Specification approval, not-run/planned execution, observed result and accepted state remain separate; evidence is bound to the current criterion/revision and a failed/skipped/blocked result has a precise follow-up. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Acceptance criterion revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.state`, `common.change_history`, `acceptance_criterion.approval_state`, `acceptance_criterion.gap_resume`.

## Working order and evidence

Check → summary → next → fix → check again. Use the unchanged v4.2 checker and its pinned catalogue. Source-backed editorial repairs and explicitly labelled recommendations can proceed autonomously. Actual external approval, actor identity, frontline/device outcomes and launch evidence cannot be assumed. Missing/stale reviews remain unresolved. Offline results are advisory, even with a locally matching trust file.

Every review names the exact revision, source, evidence locator, criterion and reason; edits invalidate affected reviews. Preserve original acceptance text and frozen specifications. One versioned team Ready checklist (`SAHA-READY-1.0`) and Done checklist (`SAHA-DONE-1.0`) are linked from stories/tasks in the existing readiness document.
