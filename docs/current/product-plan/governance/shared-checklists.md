# SAHA shared readiness and completion contract

[Current plan and coding start](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c) · [Vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea) · [Roadmap/releases](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c) · [Shared Ready/Done](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) · [AI/discovery/learning](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e)

Planning edition 4.2 · 10 October 2026 · proposed engineering checklist versions. This updates documentation under the sponsor's instruction to prepare the product before coding. It does not approve clinical policies, a full pilot, live providers, patient processing or a deployment. The current planning preparation can finish while later execution gates remain open.

## Authority and source precedence

Use fresh GitHub main and the latest evidenced checkpoint in [delivery controller #188](https://github.com/nakul175/saha-health/issues/188) for execution state, the original versioned BRD/CWO contracts for protected requirements, and Linear for the mapped planning view. The ops/control seed, old issue #175 body and main's pre-merge D02 handover remain historical where contradicted by the evidenced PR #189 delivery. Their existence does not restart the disabled five schedules or qualify old PR #184/#187.

Full planning scope is 140 functional stories, 20 supporting product items, 11 epics and 200 tasks. D01–D08 are eight of those tasks. The 176 original requirements, 364 original test cases and 95 published CWO clauses retain their original authority. This checklist supplements, and never replaces, the applicable protected acceptance criteria or frozen D02/D03 specifications.

## SAHA-READY-1.0 — shared engineering readiness

Status: proposed shared engineering contract, attributable to this agent-assisted planning revision. Applicable to the next bounded synthetic implementation; an independent reviewer must assess the exact candidate and all additional required approvals remain separate. A story/task links this version once, states its criteria subset and records actual evidence for each applicable check.

| ID | Must-pass condition before implementation or qualification of the selected boundary | Evidence |
| --- | --- | --- |
| R1 | Actor, trigger, user/operator outcome, canonical owning item, inclusions and exclusions are explicit. A technical task has a bounded reviewable output and does not become a duplicate story. | Stable item and parent IDs; current scope statement. |
| R2 | The source edition and exact criterion IDs are retained. The execution specification is versioned and frozen before changed code is qualified. Positive, refusal, error, authorization and recovery results are observable wherever applicable. Proposed refinements cannot silently replace approved criteria. | Protected source references, frozen specification, scenario matrix. |
| R3 | Current identity, assignment, purpose, record, revision, audit and receipt contracts are inspected for the exact selected behavior. UX and data/API states distinguish draft, saved, confirmed and external acceptance. Opening an existing record creates no visit. | Named current components and API/state contract; inspection SHA. |
| R4 | A synthetic fixture and actual validation route exist for affected assertions, unchanged NFR targets and relevant adversarial paths. Local encrypted save p95 <=500 ms remains separate from server timing where originally applicable. Planned tests are not observed passes. | Fixture IDs, measurement boundary, sample/denominator plan, commands and expected results. |
| R5 | Concrete prerequisites are resolved or independently verified reuse is recorded. D03's native D01 dependency requires an explicit fresh baseline decision, including #185/#186 impact; no relation is removed by this checklist. | Exact baseline/configuration, retained failures, dependency decision and regression selection. |
| R6 | Scope has existing authority and required access. Synthetic local engineering can proceed within the existing constraints; clinical, privacy, participant, provider, real-device, hosting and live-write decisions are resolved before dependent actions. Unknown authority remains a blocker for that action. | Existing permission/source; precise unmet approval/access and resume condition. |
| R7 | Priority rationale, explicit forecast unit/range/assumptions/confidence, risks, feasible change and review plan are documented. Relevant epic discovery and AI/privacy branches are linked. Estimates do not invent capacity or dates. | Planning recommendation, riskiest-assumption test, verification/review plan and checklist version. |

## SAHA-DONE-1.0 — shared delivery completion

Status: proposed shared completion contract. Completion is evaluated at the actual item's declared boundary, not inherited from a child status or an aggregate test count. An inapplicable release step requires a source-backed scope explanation; it cannot waive a frozen story gate.

| ID | Must-pass condition before a completion claim | Evidence |
| --- | --- | --- |
| D1 | The completed change/output exists on a published isolated revision with traceable parent/source/specification versions. No bulk merge, hidden legacy activation, new patient database or unapproved provider/policy is introduced. | Branch/PR, artifact revision and reviewed diff. |
| D2 | Every criterion in this item's declared boundary has an actual result; adverse paths, prohibited side effects and applicable unchanged NFRs are tested. Remaining parent/formal/device/clinical cases stay explicitly open. | Exact case IDs, outcomes, fixture/configuration, failed and passing receipts. |
| D3 | Required code/build/CI and affected regressions pass on the final source. Earlier failures remain retained and classified. No criterion, assertion, minimum or fixture is weakened to create a pass. | Final-head CI and command logs; explicit inherited/new failure analysis. |
| D4 | A separate current diff/evidence review has no unresolved mandatory findings, and genuine required native/human/domain approvals and branch protections are satisfied. Agent critique is labelled advisory. | Reviewer provenance, current review scope, resolved findings, required approval records. |
| D5 | Where the declared gate includes integration, only the isolated qualified change is merged under existing authority and protections. Merge SHA is separate from build and hosted SHA. A documentation draft PR need not deploy. | Exact approved/merged revision or explicit non-release task boundary. |
| D6 | Where availability/live verification is part of the gate, the exact deployed commit/configuration and authorized synthetic user journey are actually observed. Fresh role changes or live writes need their own authority; D02's temporary-role permission is not reused automatically for D03. | Hosting observation, scoped live smoke, restoration/cleanup evidence or precise blocker. |
| D7 | Operations/recovery/support handoff and release learning measurement plan exist at the applicable scope. Product learning compares actual results to targets later; release success cannot manufacture user benefit. | Handoff/recovery references, measured/planned distinction, learning window and decision route. |

## Separate states

Documentation-quality assessment, source/specification approval, engineering Ready, scoped acceptance, integration, observed hosting, user validation and release learning are separate. A recommendation is not an approval. A stage's missing external review cannot become a pass because all editable text is populated. No task/status/estimate/assignee change is implied by this documentation update.

## First coding package for tomorrow

1. Read the latest plan and current #188 checkpoint. Re-read current main (`7668a03d97c1ae62174f09e65ccd5a5717120be6` observed for this planning pass) and preserve the existing D03 candidate on `story/d03-routine-visit-20261010`.
2. Resolve the bounded D01 baseline dependency with fresh actual evidence for D03, including inherited #185/#186 impact. Inspect current candidate/source integrity before writing more code. This is the first execution task, not an assumption that D01 is done.
3. Continue only D03/#176 against unchanged frozen revision 1 A1–A10. Finish source/documentation integrity, exact final-head CI and separate diff/evidence review before a qualified merge; then separately verify authorized live synthetic behavior.
4. D04/D05 follow after D03's full declared gate. D07 supports exact-release/recovery evidence; D08 supplies separate physical-device/frontline qualification. D06 assistance follows a working permitted manual flow.

This planning pass performs no application code changes, merge, deployment, account-role change, synthetic visit creation or schedule restart. SAHA-153–160 remain recommended criterion drafts awaiting a versioned adoption/source decision before their affected execution. Full R1 pilot approvals and formal UAT remain separate.
