# APL-67 — \[SAHA-044\] Action authority bound to unchanged evidence

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-67](https://linear.app/aplyd-sandbox/issue/APL-67/saha-044-action-authority-bound-to-unchanged-evidence)  
Stable UUID: `b230b6c5-e110-4f1e-9f17-e190793bbf5b`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:09.206Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `48e065206126b5a03a59024c990fff7c331433f27069e4d7169fd0ba744427f9`  
Source plus v4.2 refinement SHA-256: `675067909886c447acc807282978126babb5dc72bdde0634fd62316a43c22837`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised person reviewing an action, I want confirmation bound to the reviewed facts, action, destination and relevant versions, so changed evidence cannot silently reuse previous approval.

**Scope boundary:** Draft preparation, routine authorised recording and consequential actions retain their existing authority classes. An agent cannot approve itself, and stale/expired approvals or stale visit proposals require the normal review/reconciliation path.

## Canonical scope and hierarchy

Scope ID: SAHA-044; type: functional. Original IDs: BR-AG-05, BR-RULE-03.
CWO references: CWO-007,CWO-012. Decision references: DEC-08.
Primary epic: WP05; related work packages: WP05, WP02. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-05 — Human authority at action boundaries

Priority: Must; original release: R1.

The platform shall distinguish draft preparation, routine authorised recording and consequential clinical or external actions. Actions shall require the confirmation and professional authority defined in Section 21.

Acceptance: The agent cannot make itself the approving actor, and expired approvals cannot be reused for changed data or a different destination.

### BR-RULE-03 — Review depends on unchanged evidence

Priority: Must; original release: R1.

An approval shall be bound to the material facts, intended action, destination and relevant versions reviewed. Material changes shall invalidate it and require an appropriate new review.

Acceptance: Editing a measurement after referral approval prevents silent use of the previous approval for a changed recommendation.

## Additional CWO acceptance / refusal criteria

* **CWO-007-AC03 (New acceptance)**: Given a mutation proposal, the resulting operation retains all the existing server scope, version and idempotency rules; chat never grants broader authority.
* **CWO-007-NEG02 (Expected refusal / recovery)**: An assistant proposal referencing a stale visit cannot be executed against the current record without the normal reconciliation path.

## Original test scenarios — not executed acceptance

### TC-BR-AG-05-A — Human authority at action boundaries acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-05. 2. Approval hashes bind actor, resource versions, action, recipient, purpose and capability versions; the executor checks them. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: The agent cannot make itself the approving actor, and expired approvals cannot be reused for changed data or a different destination.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-05-B — Human authority at action boundaries adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Replay an approval after changing a clinical fact; reject as stale. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Replay an approval after changing a clinical fact; reject as stale. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-03-A — Review depends on unchanged evidence acceptance

Type: Functional; source role: QA with All actors; fixture: FX-RULE-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-RULE-03. 2. Approval includes hashes of facts, action, recipient, purpose, rules and model versions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Editing a measurement after referral approval prevents silent use of the previous approval for a changed recommendation.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-03-B — Review depends on unchanged evidence adverse condition

Type: Negative or recovery; source role: QA with All actors; fixture: FX-RULE-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Reuse approval after changing one bound input; reject and return to review. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Reuse approval after changing one bound input; reject and return to review. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-05: source assessment "implemented-local"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Clinical authority policy and independently accepted action-boundary scenarios.
BR-RULE-03: source assessment "implemented-local"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Independent evidence review across the final clinical/integration catalogue.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D06 / <issue id="6984cd43-72e8-497c-b9bd-947968776004" href="https://linear.app/aplyd-sandbox/issue/APL-10/d06-open-or-prepare-bounded-tasks-conversationally">APL-10</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-AG-05 · APL-227](<https://linear.app/aplyd-sandbox/issue/APL-227/eng-br-ag-05-human-authority-at-action-boundaries>) — Human authority at action boundaries
* [ENG-BR-RULE-03 · APL-774](<https://linear.app/aplyd-sandbox/issue/APL-774/eng-br-rule-03-review-depends-on-unchanged-evidence>) — Review depends on unchanged evidence

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Core visual capture correctness and authority take precedence over optional assistance; provider activation/evaluation evidence is a separate dependency.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 6–14 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AG-05-A, TC-BR-RULE-03-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover confirmation bound to the reviewed facts, action, destination and relevant versions.
* Refusal/adverse: Run TC-BR-AG-05-B, TC-BR-RULE-03-B; retained source adverse/recovery case: Replay an approval after changing a clinical fact; reject as stale. | Reuse approval after changing one bound input; reject and return to review.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Change one bound fact, destination or relevant version after approval. Reject stale/expired confirmation and return to the existing review path; an agent cannot approve itself.
* Authorization refinement: For authorised person reviewing an action performing “confirmation bound to the reviewed facts, action, destination and relevant versions”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-007-AC03** — proposed fixture `PROP-CWO-007-AC03`; actor: authorised person reviewing an action.
* Given: A permitted mutation proposal is bound to current source role/scope, object version and operation identity.
* When: Execute the same bounded operation through chat and inspect the server check/receipt path.
* Then: retain the exact CWO-007-AC03 clause above unchanged.
* Measurement: Existing server scope/version/idempotency rules remain active with the same outcomes as the visual command.
* Prohibited effects: Chat-granted authority, version bypass or fresh-key duplicate created by a different entry path.

**CWO-007-NEG02** — proposed fixture `PROP-CWO-007-NEG02`; actor: authorised person reviewing an action.
* Given: An assistant proposal references an older visit revision than the current record.
* When: Attempt to execute the proposal without normal reconciliation.
* Then: retain the exact CWO-007-NEG02 clause above unchanged.
* Measurement: Refuse or route through the existing version reconciliation; compare stored current record unchanged before resolution.
* Prohibited effects: Executing stale payload against current state or force-overwriting through chat.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.