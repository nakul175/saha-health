# APL-43 — \[SAHA-020\] Shared question assembly

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-43](https://linear.app/aplyd-sandbox/issue/APL-43/saha-020-shared-question-assembly)  
Stable UUID: `bd2d6220-9e22-4898-8f9d-549a93b97e39`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:13:47.955Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `5222bd8ebee496d95b1bf3903306dabd2b7a02df0ed390d3308cf27801c8fdfb`  
Source plus v4.2 refinement SHA-256: `537916eedbab88ba870f68d56b585b3989bf854fdba72713c7b3becb26ecec01`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want eligible equivalent questions from applicable programme packs combined in one encounter, so I enter a shared fact once while retaining every distinct mandatory programme question.

**Scope boundary:** Equivalence must preserve meaning, person, episode, time window, unit and permitted purpose. Conflicting definitions of one question ID are a configuration error, and no extra review role is inferred.

## Canonical scope and hierarchy

Scope ID: SAHA-020; type: functional. Original IDs: BR-DATA-01.
CWO references: CWO-004,CWO-013,CWO-014. Decision references: DEC-08.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-01 — Shared question assembly

Priority: Must; original release: R1.

The platform shall combine required questions from applicable programme packs and avoid asking an identical eligible fact twice in one encounter. It shall preserve separate questions where programme meanings differ.

Acceptance: The approved three-programme fixture asks each shared concept once and retains every distinct mandatory programme-specific question.

## Additional CWO acceptance / refusal criteria

* **CWO-004-AC01 (New acceptance)**: Given two reviewed synthetic packs sharing an equivalent field for the same encounter, the worker enters it once and each pack’s output references that entry.
* **CWO-004-NEG01 (Expected refusal / recovery)**: Conflicting definitions using the same question ID are refused as a configuration error; do not silently choose one definition.
* **CWO-004-RJ03 (Delivery rejection)**: Reject a mandatory new review/approval role inferred from a generic software pattern.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-01-A — Shared question assembly acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-01. 2. Question equivalence requires the same semantic concept, person, episode, time window, unit and permitted purpose. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: The approved three-programme fixture asks each shared concept once and retains every distinct mandatory programme-specific question.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-01-B — Shared question assembly adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Give two similarly named fields with different reporting periods; they remain separate questions. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Give two similarly named fields with different reporting periods; they remain separate questions. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J01 — Multi programme home visit

Type: End to end; source role: Product QA and programme owner; fixture: FX-J01.
Preconditions: Synthetic environment; role ASHA worker; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Open assigned household work and choose one person; the system verifies assignment and shows source freshness.
2\. Confirm the person and start an encounter. Maternal, TB and hypertension packs contribute their eligible questions.
3\. Capture the narrative once. The extractor returns draft fields with source spans; the worker corrects uncertain values.
4\. The question assembler reuses eligible existing facts and asks only unresolved or genuinely distinct questions.
5\. Run eligible AI support where permitted. Present the source facts, independent results and consolidated actions for review.
6\. Confirm the encounter and authorised programme actions. Submit each destination separately and display its receipt.
7\. Assign every open referral or rejected submission to a responsible person or monitored queue.
Inject exception: A destination timeout leaves only that action uncertain. Patient ambiguity stops disclosure. Urgent approved protocol actions take precedence over forms.
Expected: One confirmed encounter; separate accepted or unresolved destination states; no duplicate entry of an eligible shared fact.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-01: source assessment "implemented-local"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Owner-approved programme fixtures and field validation.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D03 / <issue id="6d0fbb18-ad15-4dbc-9433-ec3b7ea1b8e5" href="https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit">APL-7</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

First inspect the bounded controls directly referenced by the preserved D02/D03 delivery slices; do not qualify the full parent from a narrower slice.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-01-A, TC-J01 using the source-named fixture, actor, preconditions and exact Expected oracle; cover eligible equivalent questions from applicable programme packs combined in one encounter.
* Refusal/adverse: Run TC-BR-DATA-01-B; retained source adverse/recovery case: Give two similarly named fields with different reporting periods; they remain separate questions.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Load two packs with one question ID but incompatible meaning, period or unit. Identify configuration conflict, retain distinct mandatory questions, and do not choose a convenient answer silently.
* Authorization refinement: For frontline worker performing “eligible equivalent questions from applicable programme packs combined in one encounter”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-AC01** — proposed fixture `PROP-CWO-004-AC01`; actor: frontline worker.
* Given: Two reviewed synthetic packs define an equivalent field for the same person/encounter and also retain distinct required fields.
* When: Enter the shared concept once and generate each pack's reviewed output.
* Then: retain the exact CWO-004-AC01 clause above unchanged.
* Measurement: Count one entered shared value/source reference; both outputs reference it while distinct mandatory fields remain present.
* Prohibited effects: Duplicate required entry, loss of programme-specific field, equivalence invented across person/time/unit boundaries.

**CWO-004-NEG01** — proposed fixture `PROP-CWO-004-NEG01`; actor: frontline worker.
* Given: Two pack definitions use the same question ID with incompatible semantics or units.
* When: Assemble/activate the candidate question set and inspect the validation result.
* Then: retain the exact CWO-004-NEG01 clause above unchanged.
* Measurement: An explicit configuration error identifies the conflicting ID; no one definition is silently selected or submitted.
* Prohibited effects: Silent arbitrary definition choice or invented conversion to make the pack valid.

**CWO-004-RJ03** — proposed fixture `PROP-CWO-004-RJ03`; actor: frontline worker.
* Given: The source departmental process and candidate workflow/role matrix are pinned.
* When: Inspect any new review/approval step added while assembling programme questions.
* Then: retain the exact CWO-004-RJ03 clause above unchanged.
* Measurement: Any mandatory added role without a source-bound existing-process requirement rejects the candidate; record the offending step.
* Prohibited effects: Invented approval role or sign-off gate justified solely by generic software patterns.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.