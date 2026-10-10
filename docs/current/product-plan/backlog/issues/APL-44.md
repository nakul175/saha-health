# APL-44 — \[SAHA-021\] Fact and exchange provenance

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-44](https://linear.app/aplyd-sandbox/issue/APL-44/saha-021-fact-and-exchange-provenance)  
Stable UUID: `97267d7a-1f16-4b0b-b509-bc18398fba6d`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:13:52.525Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `681d4d3c1ca04da5a3c96ab62dde59092f2bf12fb9e63e5f75849979f53a9ede`  
Source plus v4.2 refinement SHA-256: `5a0c290e1e6dfe703fa8fb57205407a47e2e3e98c83ad4ad6cea0cc460d7696b`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a worker or programme data owner, I want observations and exchanged clinical elements to retain their source, author, timing, units and verification state, so I can trace every destination field to a confirmed fact or documented transformation.

**Scope boundary:** Unknown, not asked, refused and not applicable stay distinct. Imported or transformed information must not appear as a measurement originally taken by the worker, and contradictory value/absence states are refused.

## Canonical scope and hierarchy

Scope ID: SAHA-021; type: functional. Original IDs: BR-DATA-02, BR-INT-12.
CWO references: CWO-004,CWO-013. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-02 — Source and timing for every fact

Priority: Must; original release: R1.

Reusable observations shall retain person, concept, value, unit, time, source, author and verification state. Unknown, not asked, refused and not applicable shall be separate responses.

Acceptance: Each destination field can be traced to the confirmed source fact or a documented transformation; missing data is never converted to a negative finding.

### BR-INT-12 — Source and destination provenance

Priority: Must; original release: R1.

Every imported or exported clinical element shall retain source system, source identifier, author or device where known, effective time, receipt time, transformation version and confidence or verification state. A transformed record shall not be represented as if the platform originally measured it.

Acceptance: An imported laboratory result and an ASHA-recorded observation remain distinguishable after display, export and reconciliation.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-02-A — Source and timing for every fact acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-02. 2. Each observation includes effective_at, recorded_at, source_type, verification, author and either value or absent_reason. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Each destination field can be traced to the confirmed source fact or a documented transformation; missing data is never converted to a negative finding.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-02-B — Source and timing for every fact adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Send both a value and a refusal code; reject the contradictory observation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Send both a value and a refusal code; reject the contradictory observation. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-12-A — Source and destination provenance acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-12.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-12. 2. Source identifiers, author, effective time, original status and transformation versions survive import and export. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An imported laboratory result and an ASHA-recorded observation remain distinguishable after display, export and reconciliation.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-12-B — Source and destination provenance adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-12-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Import a laboratory result; it must not appear as a measurement originally taken by the ASHA. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Import a laboratory result; it must not appear as a measurement originally taken by the ASHA. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J10 — Cross facility referral and diagnostic return

Type: End to end; source role: Product QA and programme owner; fixture: FX-J10.
Preconditions: Synthetic environment; role Referring worker and receiving clinician; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Prepare a referral with verified identity, minimum necessary clinical context and an accountable owner.
2\. Send through the destination supported route and record acknowledgement.
3\. The receiving service records assessment, attendance and result in its own authoritative system.
4\. Receive the result through the authorised EHR, ABDM or controlled document route.
5\. Match the result to the correct person, referral and source version; quarantine mismatches.
6\. Create the next task and close only with verified service outcome or coded unresolved disposition.
Inject exception: A destination without structured referral support uses labelled assisted hand-off. Missing attendance or result leaves work open.
Expected: Sent, received, scheduled, attended, resulted and closed states reflect distinct evidence.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-02: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Disputes raised in the verification review (slices 2e and 2g) are a clinician's review and still do not stop sending (only a dispute raised in the slice 10g form does); an answer dispute stops every programme destination because no mapping carries answers yet; ABDM transfer, aggregate reports and receipt lookups are not gated by disputes or sign-off; a blocked send raises no exception-queue item or notification; coded FHIR provenance (authors, reviews, disputes and sign-off are not in FHIR or programme payloads); destination-approved per-measurement transformation/conformance semantics; unification of visit and programme absence reasons; code
BR-INT-12: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Element-level author/device, receipt/effective time and transformation lineage for all resources.
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

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-02-A, TC-BR-INT-12-A, TC-J10 using the source-named fixture, actor, preconditions and exact Expected oracle; cover observations and exchanged clinical elements to retain their source, author, timing, units and verification state.
* Refusal/adverse: Run TC-BR-DATA-02-B, TC-BR-INT-12-B; retained source adverse/recovery case: Send both a value and a refusal code; reject the contradictory observation. | Import a laboratory result; it must not appear as a measurement originally taken by the ASHA.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Reject an observation carrying both a value and a refusal/absence state. Preserve its submitted source for correction without converting unknown/refused into a negative finding or logging raw clinical payloads.
* Authorization refinement: For worker or programme data owner performing “observations and exchanged clinical elements to retain their source, author, timing, units and verification state”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.