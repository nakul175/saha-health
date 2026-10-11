# Routine-visit security qualification repair

11 October 2026. Isolated PR202 remains based on main7668a03d. Published predecessor71b4131b has green CI but failed independent security qualification. This document describes a new working repair; it does not reuse the predecessor as a final-source pass. The unchanged frozen story gate remains8/10 pending complete current-source checks and the separate merge/hosting/live criterion.

## Defects and resulting behavior

A separate reviewer proved that minified bundled React Server Components19.2.6 were falsely classified as absent because package-name text was removed. Advisory1124314/GHSA-wx67-qw84-cm4g was accepted despite actual production membership. Registry error JSON could also become an empty audit and a false pass. Both original findings and negative controls are retained.

The reviewed compiler now records actual chunk module membership, package versions, chunk digests and four build-input hashes. Its manifest is bound to a compiler receipt outside dist. Unknown executable artifacts, changed or missing receipts/inputs/chunks and incomplete membership evidence refuse qualification. Framework sidecars are permitted only through exact data-only grammar and valid local asset references; a filename alone never exempts code. A final custody fingerprint includes manifests, receipts, public-script content and generated sidecars. A genuine concurrent rebuild with a new valid receipt now refuses the old audit rather than borrowing its result.

Every bundled package version must occur in the complete audited lock graph. Both inventory walkers retain children in later expanded occurrences of a repeated package. Bundled development dependencies enter the SBOM. The original policy remains: every critical advisory blocks, and high advisories block when their package ships. Moderate/runtime and absent-tool findings remain visible for review; no severity threshold or original test minimum was relaxed.

React, React DOM and React Server Components are minimally patched from19.2.6 to19.2.8, including the transitive override. Other package identities are unchanged; peer snapshot references necessarily change. Existing dependency release-age safeguards remain. The maintenance advisory lists19.2.8 as fixed: [React security advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g).

Registry results must be the supported complete pnpm audit envelope, with consistent severity counters and consumed advisory/finding fields. Only expected exit1 for findings is usable; tool errors, signals, unexpected exits, malformed/incomplete responses and malformed production inventories fail closed with fixed diagnostics. The selected report is invalidated before build/tool validation, preventing a prior green report from being reused. Raw child diagnostics are not disclosed.

## Actual local evidence

| Evidence | Observed result |
| --- | --- |
| Compiler custody controls |50 passed,0 failed,0 skipped; explicit compiler double and real file validation|
| Exact audited-version controls |21 passed,0 failed,0 skipped|
| Gate process controls |83 cases,499 assertions,0 failed,0 skipped; declared subprocess/compiler doubles|
| Real pre-patch provenance gate |High1124314 classified shipped and blocked; exit1|
| Real patched registry audit |247 SBOM components,837 lock identities,57 bundled identities;0 critical,29 high,23 moderate,8 low;0 blocking,52 accepted under original policy|
| Patched application build |Actual build002 exit0;179 compiled chunks,12 copied public scripts,6 strictly validated generated sidecars|
| Type check |Actual composed run exit0|
| Complete fresh unit selection |211 suites,11480 assertions,0 failed,0 skipped; all211 original/new guards pass with0 quarantine|
| Original regression records |All385 predecessor records exact; three new minima50/21/499,388 total|

The original82 audit case names, outcomes and decision/refusal/count/diagnostic oracles are retained. The disposable fixture now invokes the actual reviewed compiler writer and includes the full-lock command in its trace. A new83rd case verifies the repeated leaf-to-expanded dependency inventory. These are fresh executions of the composed source, not inherited493 results from standalone PR205.

Separate final frozen-code review and QA now PASS with no unresolved code defect in their scoped16-file review. QA actually repeats570 focused assertions plus8 original adversarial controls, including a concurrent legitimate compiler rebuild refused with exit3. Final published-source/doc review, complete current-source checks/CI and fresh changed-runtime performance remain pending. The first211-suite local run reported11440 positive assertions but failed four original suite guards because localhost listen and read-only process measurements returned EPERM; exact failures remain retained, and a fresh same-source authorized full selection completed211 suites/11480assertions/0failed/0skipped with all guards passed. Original sandbox failure stays separate. No failing suite is waived or counted passed. Concurrent lint returned2 because a unit fixture disappeared while lint read it; that failed tooling run is retained and will be repeated after units stop. The final sequential lint ratchet passes1392errors against the unchanged1392 baseline, with627warnings versus the recorded618; warnings are recorded and do not gate this existing ratchet. No baseline was raised. New owned security files have no lint warnings. The lint baseline is unchanged.

## Trust and delivery limits

The separate reviewed compiler/CI invocation produces custody receipts. These hashes are not signatures or protection against an author rewriting the writer and receipts; final-source independent review and CI bind that trust boundary. No runtime exploit or hosted exposure was tested. Gate-process doubles are not a production bundle or registry test; the real build/audit are separate evidence.

The old2e18 complete1000/path measurement remains historical and cannot automatically qualify the patched React runtime. New immutable source/build measurements preserve all original samples, targets, cold intervals, degraded97th API aborts, authority/clinical-unchanged checks and cleanup. Physical devices, capacity/soak/plateau, clinical/domain/provider acceptance and formalBRD0/176/UAT0/364 remain open.

Current source is unmerged. Existing DigitalOcean read-only console access remains blocked by unavailable admin browser-security verification; no alternate access bypass or fresh hostedSHA/live journey is claimed.50 stories by22:49:55UTC is the sponsor's target; actual new fully delivered canonical stories remain0. Parallel PR203/204/205 are isolated prerequisites, not accepted whole stories.

Raw evidence and source pins: [manifest](security-repair-evidence-20261011/manifest.json). Earlier qualification records retain their original dates and are superseded for current release applicability by this checkpoint.
