# SAHA quality rules — Product strategy

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current assessment boundary

Use seven must-pass gates for the selected planning stage and this element type. Full product AI and personal-data branches are applicable: governed assistance and health/workforce records are protected original scope. A bounded manual D03 task introduces no model/provider but inherits applicable authorization, audit, data and source controls. No AI/privacy blanket exclusion is permitted.

The detailed reference field library supports diagnosis; it does not require hundreds of independent detail verdicts. Supporting samples are advisory, at most two per hierarchy level across the assessed scope. An observed mandatory/safety failure is never sampled away. Later readiness, delivery and learning evidence remains separately assessed at its actual stage.

### gate.strategy.planning.01 — Outcome and traceability

Each strategic choice resolves to the vision and an evidenced priority problem/user outcome; sources distinguish established facts from proposed bets. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.identity`, `common.traceability`, `strategy.vision_sources`, `strategy.priority_problems`, `strategy.choices_tradeoffs`.

### gate.strategy.planning.02 — Scope and context

Priority users/use cases, constraints, exclusions and reuse decisions bound the strategy and identify affected operators and prohibited scope expansion. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.boundary`, `strategy.priority_users_use_cases`, `strategy.constraints`, `strategy.deferral`.

### gate.strategy.planning.03 — Discovery and evidence

Diagnosis and major bets have cited evidence, counterevidence and limitations; the validation plan can disprove the riskiest choice and has a predeclared continue/change/stop rule. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.evidence`, `common.source_provenance`, `strategy.diagnosis_evidence`, `strategy.validation_plan`, `strategy.continue_adjust_stop`.

### gate.strategy.planning.04 — Measures and verification

Outcome measures, baseline and agreed targets define population, method and horizon; pending target decisions are explicit before the stage that depends on them. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `strategy.outcome_measures`, `strategy.targets`.

### gate.strategy.planning.05 — Priority, size and dependencies

Choice and sequencing rationale compare meaningful alternatives and opportunity cost; dependencies, capacity/resource assumptions and uncertainty support any actual commitment. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `strategy.choices_tradeoffs`, `strategy.dependencies_assumptions`, `strategy.open_decisions`.

### gate.strategy.planning.06 — Applicable assurance and controls

Applicable assurance obligations, including product AI and personal-data jurisdiction, constrain strategic choices; unsafe or unauthorized benefits cannot justify bypassing required controls. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated. Unsampled conditional assurance: resolve product AI yes/no/unknown from the pinned actual context. If AI is used, AI-01 to AI-07 in the pinned module apply at their current-stage requirements: dataset quality/rights, predeclared overall and critical-slice metrics/thresholds, observed safety/refusal/fallback, exact model/prompt/configuration revision, applicable personal-data/jurisdiction decisions and monitoring/drift/rollback. An evidence-backed no-use exclusion must not waive other applicable obligations. Unknown applicability or absent required rights/results is unresolved, never N/A.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.context_profile`, `strategy.constraints`, `strategy.choices_tradeoffs`.

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

### gate.strategy.planning.07 — Governance and learning

Actual decision authority and change state are explicit; observed discovery/release learning drives a recorded continue/change/stop decision and strategy/roadmap feedback, with actual follow-up owner. Planning stage: require a bounded testable plan, sourced priority/dependency rationale and honestly attributed size uncertainty where relevant. Unagreed targets/owners/estimates may remain explicitly pending only before a dependent commitment, approval or ready decision; record the exact unresolved decision and evidence needed. Future execution/launch results remain planned, never fabricated.

Evidence: Current Product strategy revision; explicit applicable field components and pinned authoritative sources. Exact evidence locators and stage-specific decision/evaluation/observation records; no invented facts or substituted future results.

Required fields: `common.state`, `common.change_history`, `strategy.identity_state`, `strategy.roadmap_release_links`, `strategy.review_history`.

## Working order and evidence

Check → summary → next → fix → check again. Use the unchanged v4.2 checker and its pinned catalogue. Source-backed editorial repairs and explicitly labelled recommendations can proceed autonomously. Actual external approval, actor identity, frontline/device outcomes and launch evidence cannot be assumed. Missing/stale reviews remain unresolved. Offline results are advisory, even with a locally matching trust file.

Every review names the exact revision, source, evidence locator, criterion and reason; edits invalidate affected reviews. Preserve original acceptance text and frozen specifications. One versioned team Ready checklist (`SAHA-READY-1.0`) and Done checklist (`SAHA-DONE-1.0`) are linked from stories/tasks in the existing readiness document.
