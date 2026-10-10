# APL-47 — \[SAHA-024\] Validation, missingness and no fabricated facts

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-47](https://linear.app/aplyd-sandbox/issue/APL-47/saha-024-validation-missingness-and-no-fabricated-facts)  
Stable UUID: `a373500c-55d3-447a-acfc-6003198d9d73`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:08.811Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `5503ea174b20ce5f68dd4abcc37957657225bf9714b9f2746bea485b97232c0c`  
Source plus v4.2 refinement SHA-256: `8931b19610af41fbf2b3621af7e743ce7c65e37f0be746385fff5141e2cd00a1`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want validation to identify invalid units, implausible values and missing information without inventing answers, so I can correct inputs or use a permitted documented override.

**Scope boundary:** Mandatory checks cannot be silently bypassed. Permitted overrides retain original value, reason and reviewer identity; missing, refused and uncertain inputs stay distinct, and derived values require approved inputs and formula.

## Canonical scope and hierarchy

Scope ID: SAHA-024; type: functional. Original IDs: BR-DATA-05, BR-RULE-01.
CWO references: CWO-004. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP02. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-05 — Validation without fabrication

Priority: Must; original release: R1.

Range, unit, logical and cross-field checks shall flag implausible or incomplete inputs. A worker may record an unusual confirmed measurement with a reason where policy permits, but cannot silently bypass a mandatory validation.

Acceptance: Invalid units block submission; a permitted override retains the original value, reason and reviewer identity.

### BR-RULE-01 — No invented facts

Priority: Must; original release: R1.

The platform shall never fill an unanswered clinical or programme field with an assumed answer. It may calculate a derived value only where the formula and required inputs are approved and the result is labelled as derived.

Acceptance: Missing, refused and uncertain inputs remain distinguishable across local records, model calls and outgoing submissions.

## Additional CWO acceptance / refusal criteria

* **CWO-004-NEG02 (Expected refusal / recovery)**: Missing mandatory information uses the pack’s documented absent-value rule or an actionable error; never fabricate a normal finding.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-05-A — Validation without fabrication acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-05. 2. Validation returns field paths and reason codes. Permitted outlier overrides require a scoped reviewer and reason. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Invalid units block submission; a permitted override retains the original value, reason and reviewer identity.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-05-B — Validation without fabrication adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Submit an unsupported unit or impossible date; block submission without coercing the value. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Submit an unsupported unit or impossible date; block submission without coercing the value. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-01-A — No invented facts acceptance

Type: Functional; source role: QA with All actors; fixture: FX-RULE-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-RULE-01. 2. Observation validation requires a real captured value or explicit missingness; model-derived values carry derivation references. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Missing, refused and uncertain inputs remain distinguishable across local records, model calls and outgoing submissions.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-01-B — No invented facts adverse condition

Type: Negative or recovery; source role: QA with All actors; fixture: FX-RULE-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Complete a mandatory form by inventing a missing answer; the platform must refuse the fabricated value. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Complete a mandatory form by inventing a missing answer; the platform must refuse the fabricated value. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-05: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved clinical thresholds/terminology and production population policies; programme-answer range coverage and structured exchange of overrides; broader clinical, physical-device and phone accessibility acceptance.
BR-RULE-01: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Distinct missing/refused/uncertain semantics across every downstream resource.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D03 / <issue id="6d0fbb18-ad15-4dbc-9433-ec3b7ea1b8e5" href="https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit">APL-7</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-DATA-05 · APL-207](<https://linear.app/aplyd-sandbox/issue/APL-207/eng-br-data-05-validation-without-fabrication>) — Validation without fabrication
* [ENG-BR-RULE-01 · APL-772](<https://linear.app/aplyd-sandbox/issue/APL-772/eng-br-rule-01-no-invented-facts>) — No invented facts

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

First inspect the bounded controls directly referenced by the preserved D02/D03 delivery slices; do not qualify the full parent from a narrower slice.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-05-A, TC-BR-RULE-01-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover validation to identify invalid units, implausible values and missing information without inventing answers.
* Refusal/adverse: Run TC-BR-DATA-05-B, TC-BR-RULE-01-B; retained source adverse/recovery case: Submit an unsupported unit or impossible date; block submission without coercing the value. | Complete a mandatory form by inventing a missing answer; the platform must refuse the fabricated value.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Submit an unsupported unit or impossible date with a missing mandatory answer. Reject without coercion or fabrication; any permitted override retains original value, reason and reviewer.
* Authorization refinement: For frontline worker performing “validation to identify invalid units, implausible values and missing information without inventing answers”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-NEG02** — proposed fixture `PROP-CWO-004-NEG02`; actor: frontline worker.
* Given: A reviewed pack has its documented mandatory/absent-value rule and a genuinely missing answer.
* When: Attempt review/save with that answer absent, refused or unknown as applicable.
* Then: retain the exact CWO-004-NEG02 clause above unchanged.
* Measurement: Use the permitted absent-value state or actionable error; no normal value is synthesised and mandatory rules remain intact.
* Prohibited effects: Fabricated normal finding, silent missing-value coercion or bypass of the pack rule.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.