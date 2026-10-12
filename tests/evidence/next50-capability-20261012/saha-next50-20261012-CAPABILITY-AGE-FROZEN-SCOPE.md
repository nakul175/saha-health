# Declared capability age validation

12 October 2026, frozen before this candidate's source edit. Base main22a271033eaa57e124a235fc615744928f1ac106. Canonical SAHA-053/APL-76, BR-AI-02, technical ENG-BR-AI-02/APL-236; related eligibility-before-ranking SAHA-042 retains its own acceptance. No whole-story or clinical approval is granted.

The existing `checkCapability` compares patient age with the already-reviewed manifest's range. JavaScript comparisons can silently accept undefined/NaN or coerce a numeric string; prove this on the untouched source before repair. The existing boundary must require a finite numeric age before applying that same unchanged range. No inferred age, new range, provider/model or clinical policy. Local manual programme review's existing exception remains unchanged.

Freeze cases: same configured adult capability admits age18/32/60; rejects17/61; rejects unknown/undefined/null/NaN/infinite/text/object age instead of guessing. Unknown age with range0..120 is also refused. Actual `agentApply` must refuse malformed/unknown age before any run, audit or state mutation; valid explicit age may prepare the same authorised draft without external invocation. Existing language/role/team/model/evidence/consent/budget guards and original governance/minimisation/agent tests retain original assertions/minima.

Fixtures are explicit synthetic in-memory states exercising actual server functions, not external human approval, provider API or real patient evidence. Preserve untouched predecessor failures, use a new after-run, inspect outputs and separately review. No SQL migration or hosted access. Full population/jurisdiction/site/clinical/evaluation/UAT and hosting qualification stays open.
