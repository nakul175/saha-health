# APL-27 — \[SAHA-004\] Structured encounter summary

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-27](https://linear.app/aplyd-sandbox/issue/APL-27/saha-004-structured-encounter-summary)  
Stable UUID: `4be325c9-7301-488b-8159-ac0746d41185`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:20.493Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `fb53d51dc86516f3dccd09cd88789960cd57adf138f23ae1ef402a9fd356fc59`  
Source plus v4.2 refinement SHA-256: `a9272e383e2089a4df2285fcf83d029d50d2edc2941271318b8dd5cb148848c9`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want to review confirmed facts, uncertain facts, missing information and proposed actions as separate readable elements, so I can identify the next required step and unresolved fields without searching a transcript.

**Scope boundary:** Correcting one field must preserve the selected person and other answers. Uncertain facts and AI suggestions must not appear as confirmed observations.

## Canonical scope and hierarchy

Scope ID: SAHA-004; type: functional. Original IDs: BR-UX-04.
CWO references: CWO-004. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-04 — Structured encounter summary

Priority: Must; original release: R1.

The workspace shall display confirmed facts, uncertain facts, missing information and proposed actions as separate readable elements. A conversational answer shall not be the only way to discover task status.

Acceptance: Usability participants can identify the next required step and each unresolved field without searching a transcript.

## Additional CWO acceptance / refusal criteria

* **CWO-004-AC03 (New acceptance)**: Given a correction before save, only the intended field changes; person context and other answers remain intact.

## Original test scenarios — not executed acceptance

### TC-BR-UX-04-A — Structured encounter summary acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-04. 2. The summary has confirmed facts, unresolved facts, recommendations and external actions as four distinct groups. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Usability participants can identify the next required step and each unresolved field without searching a transcript.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-04-B — Structured encounter summary adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Supply an uncertain date and an AI suggestion; neither may render as a confirmed observation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Supply an uncertain date and an AI suggestion; neither may render as a confirmed observation. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-04: source assessment "partial"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative usability evidence that workers find unresolved steps reliably.
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

* Positive: Run TC-BR-UX-04-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover review confirmed facts, uncertain facts, missing information and proposed actions as separate readable elements.
* Refusal/adverse: Run TC-BR-UX-04-B; retained source adverse/recovery case: Supply an uncertain date and an AI suggestion; neither may render as a confirmed observation.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return an invalid or incomplete save acknowledgement while reviewing the summary. Keep corrected values and missingness visible; do not mark the encounter confirmed from a transport response alone.
* Authorization refinement: For frontline worker performing “review confirmed facts, uncertain facts, missing information and proposed actions as separate readable elements”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-AC03** — proposed fixture `PROP-CWO-004-AC03`; actor: frontline worker.
* Given: A permitted review card has a pinned person/visit ID and at least two distinct answered fields.
* When: Correct one field before save, then inspect the complete proposed payload and card.
* Then: retain the exact CWO-004-AC03 clause above unchanged.
* Measurement: Only the intended field changes; person/visit IDs and all other answers compare equal to the before snapshot.
* Prohibited effects: Unrelated answer change, person switch, invented default or side-effectful save during correction.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.