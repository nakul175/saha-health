# APL-25 — \[SAHA-002\] Clear patient and visit context

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-25](https://linear.app/aplyd-sandbox/issue/APL-25/saha-002-clear-patient-and-visit-context)  
Stable UUID: `4b21fc15-82f3-49fd-b4d0-1e00999ba22e`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:10.720Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `d14fa9fdf8b8a564a08b8a876eca183f16f672f9d3bcbdb86c2b60ebbfc77fae`  
Source plus v4.2 refinement SHA-256: `d65a930b72d3981677601f94030658d39697ab857a0ccdfa211c34271540860a`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want the active person and visit to remain clear while I capture information, use assistance and review actions, so recordings, answers and results stay attached to the correct person.

**Scope boundary:** Switching people must close or suspend the previous context and preserve or deliberately discard unsaved work without reassigning it to the new person.

## Canonical scope and hierarchy

Scope ID: SAHA-002; type: functional. Original IDs: BR-UX-02.
CWO references: CWO-002,CWO-004. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-02 — Clear patient and visit context

Priority: Must; original release: R1.

The interface shall show the active person and visit throughout capture, model use and action review. Changing patients shall explicitly close or suspend the current context and clear uncommitted cross-person inputs.

Acceptance: Patient-switch tests cannot attach the prior person's recording, answer or AI result to the next person.

## Additional CWO acceptance / refusal criteria

* **CWO-004-NEG03 (Expected refusal / recovery)**: A person switch with unsaved work requires safe preservation or deliberate discard, not reassignment of the data to the newly selected person.

## Original test scenarios — not executed acceptance

### TC-BR-UX-02-A — Clear patient and visit context acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-02. 2. Every patient-specific request carries person and encounter IDs validated against the active session context. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Patient-switch tests cannot attach the prior person's recording, answer or AI result to the next person.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-02-B — Clear patient and visit context adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Switch patients with an unsaved voice draft; the old draft must not appear in the new encounter. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Switch patients with an unsaved voice draft; the old draft must not appear in the new encounter. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-02: source assessment "implemented-local"; target checkpoint R16. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative wrong-person and field usability acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D02 / <issue id="adfe4945-bb19-47a6-a87d-a2f8c80962fe" href="https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today">APL-6</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-UX-02-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover the active person and visit to remain clear while I capture information, use assistance and review actions.
* Refusal/adverse: Run TC-BR-UX-02-B; retained source adverse/recovery case: Switch patients with an unsaved voice draft; the old draft must not appear in the new encounter.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Interrupt a person switch before draft persistence completes. Retain the previous draft under its original person, and require an explicit resume/discard choice rather than moving answers to the new person.
* Authorization refinement: For frontline worker performing “the active person and visit to remain clear while I capture information, use assistance and review actions”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-NEG03** — proposed fixture `PROP-CWO-004-NEG03`; actor: frontline worker.
* Given: Person A has unsaved entered fields while person B is a separate permitted context.
* When: Switch to B and exercise preserve, deliberate discard and interrupted-switch paths.
* Then: retain the exact CWO-004-NEG03 clause above unchanged.
* Measurement: A's values remain under A or are discarded only by explicit choice; B contains no A-derived field/media reference.
* Prohibited effects: Reassignment of unsaved values/media to newly selected B.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.