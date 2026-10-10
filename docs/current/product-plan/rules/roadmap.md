# SAHA quality rules — Roadmap

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current assessment boundary

Use seven must-pass gates for the selected planning stage and this element type. Full product AI and personal-data branches are applicable: governed assistance and health/workforce records are protected original scope. A bounded manual D03 task introduces no model/provider but inherits applicable authorization, audit, data and source controls. No AI/privacy blanket exclusion is permitted.

The detailed reference field library supports diagnosis; it does not require hundreds of independent detail verdicts. Supporting samples are advisory, at most two per hierarchy level across the assessed scope. An observed mandatory/safety failure is never sampled away. Later readiness, delivery and learning evidence remains separately assessed at its actual stage.

### gate.roadmap.planning.01 — Outcome and traceability

Canonical roadmap outcomes and items resolve to current strategy and release goals; no duplicate backlog competes with the owning records. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.identity`, `common.traceability`, `roadmap.alignment_links`, `roadmap.sequence_outcome`, `roadmap.sequence_item_links`.

### gate.roadmap.planning.02 — Scope and context

Now/Next/Later and release allocation bound a versioned scope; deferrals, shared contributors and confidence distinguish intended direction from agreed commitments. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.boundary`, `roadmap.now`, `roadmap.next`, `roadmap.later`, `roadmap.deferred_scope`.

### gate.roadmap.planning.03 — Discovery and evidence

Evidence gates for horizon movement reference the highest-risk assumptions and actual discovery outputs; an untested hypothesis is not presented as an established predecessor result. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.evidence`, `common.source_provenance`, `roadmap.horizon_gate_evidence`, `roadmap.predecessor_outputs`.

### gate.roadmap.planning.04 — Measures and verification

Each allocated outcome has a linked release measure and review window or explicit pending decision; progress denominators and evidence describe outcomes without counting duplicate items. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `roadmap.sequence_outcome`, `roadmap.release_allocation`, `roadmap.sequence_gate`.

### gate.roadmap.planning.05 — Priority, size and dependencies

Sequence rationale reflects child priority/size ranges, genuine predecessor outputs and capacity uncertainty; estimates/timing are sourced and confidence is explicit, not invented. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `roadmap.sequence_rationale`, `roadmap.capacity_uncertainty`, `roadmap.sequence_confidence`, `roadmap.predecessor_outputs`.

### gate.roadmap.planning.06 — Applicable assurance and controls

Assurance, approval and access prerequisites appear as actual dependency/decision gates, including AI evaluation/privacy/fallback where applicable; a horizon label never waives a safety obligation. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated. Unsampled conditional assurance: resolve product AI yes/no/unknown from the pinned actual context. If AI is used, AI-01 to AI-07 in the pinned module apply at their current-stage requirements: dataset quality/rights, predeclared overall and critical-slice metrics/thresholds, observed safety/refusal/fallback, exact model/prompt/configuration revision, applicable personal-data/jurisdiction decisions and monitoring/drift/rollback. An evidence-backed no-use exclusion must not waive other applicable obligations. Unknown applicability or absent required rights/results is unresolved, never N/A.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.context_profile`, `roadmap.sequence_gate`, `roadmap.horizon_gate_evidence`.

Mandatory conditional branches (source scope determines applicability):

```json
{
  "ai": [
    "common.ai_assurance_reference"
  ],
  "personalData": [
    "common.personal_data_controls"
  ]
}
```

### gate.roadmap.planning.07 — Governance and learning

Actual roadmap authority, blockers and precise resume conditions are current; measured learning changes priority/allocation or records a no-change rationale with a next decision and owner. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Roadmap revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.state`, `common.change_history`, `roadmap.identity_state`, `roadmap.blockers_decisions`, `roadmap.change_history`.

## Working order and evidence

Check → summary → next → fix → check again. Use the unchanged v4.2 checker and its pinned catalogue. Source-backed editorial repairs and explicitly labelled recommendations can proceed autonomously. Actual external approval, actor identity, frontline/device outcomes and launch evidence cannot be assumed. Missing/stale reviews remain unresolved. Offline results are advisory, even with a locally matching trust file.

Every review names the exact revision, source, evidence locator, criterion and reason; edits invalidate affected reviews. Preserve original acceptance text and frozen specifications. One versioned team Ready checklist (`SAHA-READY-1.0`) and Done checklist (`SAHA-DONE-1.0`) are linked from stories/tasks in the existing readiness document.
