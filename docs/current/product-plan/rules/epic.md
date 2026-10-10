# SAHA quality rules — Epic

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current assessment boundary

Use seven must-pass gates for the selected planning stage and this element type. Full product AI and personal-data branches are applicable: governed assistance and health/workforce records are protected original scope. A bounded manual D03 task introduces no model/provider but inherits applicable authorization, audit, data and source controls. No AI/privacy blanket exclusion is permitted.

The detailed reference field library supports diagnosis; it does not require hundreds of independent detail verdicts. Supporting samples are advisory, at most two per hierarchy level across the assessed scope. An observed mandatory/safety failure is never sampled away. Later readiness, delivery and learning evidence remains separately assessed at its actual stage.

### gate.epic.planning.01 — Outcome and traceability

One coherent capability addresses an evidenced user/operator problem and traces to current strategy/release requirements; its scope is not a collection of unrelated tasks. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.identity`, `common.traceability`, `epic.alignment_requirements`, `epic.problem`, `epic.capability_outcome`.

### gate.epic.planning.02 — Scope and context

Included/excluded scope and hand-offs are explicit; canonical children have one primary parent and cross-epic contributions use related links rather than duplicate acceptance counts. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.boundary`, `epic.included_scope`, `epic.excluded_handoffs`, `epic.children`, `epic.primary_parent`.

### gate.epic.planning.03 — Discovery and evidence

The riskiest assumption is ranked by consequence/uncertainty and has a falsifiable test, authorized method/sample, predeclared decision threshold, observed result when due and documented continue/change/stop or bounded authorized risk decision. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.evidence`, `common.source_provenance`, `epic.assumption_test`, `epic.risks_decisions`.

### gate.epic.planning.04 — Measures and verification

The capability completion/outcome boundary has observable measures and child acceptance mapping; uncovered source requirements, unsuccessful children and scope denominators remain visible. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `epic.completion_boundary`, `epic.child_evidence_gaps`, `epic.accepted_rollup`.

### gate.epic.planning.05 — Priority, size and dependencies

Priority compares meaningful alternatives and opportunity cost; size is a sourced range/coarse unit with scope, method, uncertainty and dependencies, and true prerequisites are separated from design relationships. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `epic.priority_rationale`, `epic.size_estimate`, `epic.dependencies`.

### gate.epic.planning.06 — Applicable assurance and controls

Shared experience/information/interface/quality contracts carry actual applicable access, safety, privacy, accessibility and AI requirements into children; no critical obligation falls between epics or into advisory-only samples. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated. Unsampled conditional assurance: resolve product AI yes/no/unknown from the pinned actual context. If AI is used, AI-01 to AI-07 in the pinned module apply at their current-stage requirements: dataset quality/rights, predeclared overall and critical-slice metrics/thresholds, observed safety/refusal/fallback, exact model/prompt/configuration revision, applicable personal-data/jurisdiction decisions and monitoring/drift/rollback. An evidence-backed no-use exclusion must not waive other applicable obligations. Unknown applicability or absent required rights/results is unresolved, never N/A.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.context_profile`, `epic.shared_contracts`, `epic.risks_decisions`.

Mandatory conditional branches (source scope determines applicability):

```json
{
  "ai": [
    "common.ai_assurance_reference",
    "epic.ai_validation_contract"
  ],
  "personalData": [
    "common.personal_data_controls"
  ]
}
```

### gate.epic.planning.07 — Governance and learning

Actual epic owner/authority, revision, readiness/completion and gaps are distinct; accepted children alone do not prove capability value, and outcome learning feeds strategy/roadmap with an actual owner and next review. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Epic revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.state`, `common.change_history`, `epic.identity_workpackage`, `epic.gaps_history`.

## Working order and evidence

Check → summary → next → fix → check again. Use the unchanged v4.2 checker and its pinned catalogue. Source-backed editorial repairs and explicitly labelled recommendations can proceed autonomously. Actual external approval, actor identity, frontline/device outcomes and launch evidence cannot be assumed. Missing/stale reviews remain unresolved. Offline results are advisory, even with a locally matching trust file.

Every review names the exact revision, source, evidence locator, criterion and reason; edits invalidate affected reviews. Preserve original acceptance text and frozen specifications. One versioned team Ready checklist (`SAHA-READY-1.0`) and Done checklist (`SAHA-DONE-1.0`) are linked from stories/tasks in the existing readiness document.
