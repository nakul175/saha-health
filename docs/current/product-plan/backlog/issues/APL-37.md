# APL-37 — \[SAHA-014\] Patient matching with human resolution

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-37](https://linear.app/aplyd-sandbox/issue/APL-37/saha-014-patient-matching-with-human-resolution)  
Stable UUID: `5eae89ba-9bf6-4e40-a46c-5cec8064b847`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:12:20.043Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `5eac794c2ab02c025da903c9066db05c4532830cced2b403c2b50f38ff4fb143`  
Source plus v4.2 refinement SHA-256: `a8083fdc5ba917e658ee7a4b1e87232b81bcff9f9caca1769050ac5dcbc2f829`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised record user, I want permitted possible patient matches and identity uncertainty shown before linking a person, so I can select the correct record without silently merging similar people.

**Scope boundary:** A name or shared phone alone cannot trigger a merge. Same-name, spelling-variant and twin cases need an authorised identity-resolution decision; conversational actions require disambiguation.

## Canonical scope and hierarchy

Scope ID: SAHA-014; type: functional. Original IDs: BR-ID-05.
CWO references: CWO-007,CWO-002. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-05 — Patient matching with human resolution

Priority: Must; original release: R1.

The platform shall search permitted records using identifiers and selected demographics, present possible matches and support uncertain identities. A name or phone number alone shall not trigger an automatic merge.

Acceptance: Same-name, shared-phone, spelling-variant and twin cases remain distinct unless an authorised reviewer resolves the identity link.

## Additional CWO acceptance / refusal criteria

* **CWO-002-NEG03 (Expected refusal / recovery)**: Selecting two similarly named people must not silently infer identity from conversational text.
* **CWO-007-AC02 (New acceptance)**: Given two matching people, the assistant requires disambiguation before preparing a person-specific action.

## Original test scenarios — not executed acceptance

### TC-BR-ID-05-A — Patient matching with human resolution acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-05. 2. Matching returns candidates with evidence and score only as assistance; a verified link needs an authorised person decision. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Same-name, shared-phone, spelling-variant and twin cases remain distinct unless an authorised reviewer resolves the identity link.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-05-B — Patient matching with human resolution adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Create twins with the same address and shared phone; no automatic merge may occur. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Create twins with the same address and shared phone; no automatic merge may occur. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-05: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Issuer-registry-backed identifier lookup (nothing contacts an issuer), validated matching performance, timing and enumeration testing by an independent reviewer, and approved wider identity resolution.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: none recorded. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-05-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover permitted possible patient matches and identity uncertainty shown before linking a person.
* Refusal/adverse: Run TC-BR-ID-05-B; retained source adverse/recovery case: Create twins with the same address and shared phone; no automatic merge may occur.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Return ambiguous same-name/shared-phone candidates or lose the matching source. Keep permitted records distinct and limit disclosure until the existing authorised resolution path completes.
* Authorization refinement: For authorised record user performing “permitted possible patient matches and identity uncertainty shown before linking a person”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-002-NEG03** — proposed fixture `PROP-CWO-002-NEG03`; actor: authorised record user.
* Given: Two permitted records share a similar displayed name and remain distinct in the authoritative source.
* When: Select/request them conversationally without an unambiguous identifier.
* Then: retain the exact CWO-002-NEG03 clause above unchanged.
* Measurement: No person-specific action/disclosure is silently assigned; an explicit choice identifies the intended existing person.
* Prohibited effects: Identity inference/merge or wrong-person preparation from name text alone.

**CWO-007-AC02** — proposed fixture `PROP-CWO-007-AC02`; actor: authorised record user.
* Given: The assistant's permitted candidate list contains two matching existing people.
* When: Ask to prepare a person-specific action without selecting one candidate.
* Then: retain the exact CWO-007-AC02 clause above unchanged.
* Measurement: Assistant requires explicit disambiguation before action preparation; inspect pending context/plan for no chosen identity.
* Prohibited effects: Silently selecting one person or preparing a wrong-person operation.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.