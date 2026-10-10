# APL-24 — \[SAHA-001\] One task entry point

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-24](https://linear.app/aplyd-sandbox/issue/APL-24/saha-001-one-task-entry-point)  
Stable UUID: `0ff208dd-5356-4283-8387-80f33d99d121`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:06.223Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `e2622a732c445157dec47e39c93f589066b082f6f0350848ee20651e542c0045`  
Source plus v4.2 refinement SHA-256: `da87cb9c2e2c3bb45739c4a1161d933e6b5d0eeb5328777391b64a3c4f8e7c2e`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want to start visits, follow-ups and screenings from one authenticated workspace, so I can complete eligible programme work without separate vendor logins or copying patient details.

**Scope boundary:** Keep programme eligibility and existing server permissions intact. Today must retain existing drafts, distinguish a failed source request from an empty caseload, and disclose only assigned work; the full multi-programme journey remains broader than D02.

## Canonical scope and hierarchy

Scope ID: SAHA-001; type: functional. Original IDs: BR-UX-01.
CWO references: CWO-002,CWO-019,CWO-023,CWO-031. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-01 — One task entry point

Priority: Must; original release: R1.

The worker shall start a visit, follow-up or screening from one workspace. Eligible programme activities and AI functions shall appear within that task without requiring the worker to select a vendor application.

Acceptance: The approved multi-programme journey completes through one authenticated workspace with no separate AI login or manual transfer of patient details.

## Additional CWO acceptance / refusal criteria

* **CWO-002-AC01 (New acceptance)**: Given current assigned work, Today shows the same permitted task identities as the scoped source, without exposing another worker’s household details.
* **CWO-002-AC02 (New acceptance)**: Given an existing draft for the selected task/person, starting from Today resumes it or clearly identifies the choice without silently duplicating the visit.
* **CWO-002-AC03 (New acceptance)**: Given no assigned work, a useful empty state appears without invented visits or partner promotions.
* **CWO-002-NEG02 (Expected refusal / recovery)**: A failed source request must not be shown as an empty caseload or completed work.
* **CWO-002-RJ01 (Delivery rejection)**: Reject a twelve-module home hidden behind a chatbot.
* **CWO-002-RJ02 (Delivery rejection)**: Reject any implementation that gives the client authority to start out-of-scope work or loses an existing draft.

## Original test scenarios — not executed acceptance

### TC-BR-UX-01-A — One task entry point acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-01.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-01. 2. The home screen groups tasks by person and encounter. Provider selection remains behind an eligible capability action. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: The approved multi-programme journey completes through one authenticated workspace with no separate AI login or manual transfer of patient details.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-01-B — One task entry point adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-01-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Disable one programme destination while another remains available; the visit remains usable and displays the missing route. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Disable one programme destination while another remains available; the visit remains usable and displays the missing route. Evidence must show the actual final state and any accountable unresolved work.
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

BR-UX-01: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Validate the full journey with two independent real providers and programme destinations.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D02 / <issue id="adfe4945-bb19-47a6-a87d-a2f8c80962fe" href="https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today">APL-6</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

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

* Positive: Run TC-BR-UX-01-A, TC-J01 using the source-named fixture, actor, preconditions and exact Expected oracle; cover start visits, follow-ups and screenings from one authenticated workspace.
* Refusal/adverse: Run TC-BR-UX-01-B; retained source adverse/recovery case: Disable one programme destination while another remains available; the visit remains usable and displays the missing route.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Fail one programme-work source request while an existing draft remains. Show the source failure separately from zero assigned work and preserve the same draft/person identity.
* Authorization refinement: For frontline worker performing “start visits, follow-ups and screenings from one authenticated workspace”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-002-AC01** — proposed fixture `PROP-CWO-002-AC01`; actor: frontline worker.
* Given: Synthetic workers A and B have distinct current assignments; the permitted source projection for A is pinned.
* When: Sign in as A and open Today; compare each displayed task/person identity with A's authoritative projection.
* Then: retain the exact CWO-002-AC01 clause above unchanged.
* Measurement: Displayed permitted task IDs equal the source ID set; inspect UI and returned payload for zero B-household disclosure.
* Prohibited effects: Unassigned household detail, invented task, client-side expansion of source authority.

**CWO-002-AC02** — proposed fixture `PROP-CWO-002-AC02`; actor: frontline worker.
* Given: The selected assigned person/task already has a named durable draft revision.
* When: Open the task from Today and exercise the visible resume/choice path.
* Then: retain the exact CWO-002-AC02 clause above unchanged.
* Measurement: Compare selected person/task/draft IDs before and after; visit count gains no silent duplicate and the existing draft remains identifiable.
* Prohibited effects: Silent duplicate visit, draft loss, reassociation to another person.

**CWO-002-AC03** — proposed fixture `PROP-CWO-002-AC03`; actor: frontline worker.
* Given: The current authenticated projection is successfully returned with no assigned work.
* When: Open Today without changing the source and inspect all empty-state actions/content.
* Then: retain the exact CWO-002-AC03 clause above unchanged.
* Measurement: Show a meaningful no-work state; count zero invented visits and zero partner promotions in the state.
* Prohibited effects: Invented record/activity, promotional partner card presented as assigned work.

**CWO-002-NEG02** — proposed fixture `PROP-CWO-002-NEG02`; actor: frontline worker.
* Given: An assigned-work source request can fail while the same account previously had permitted work.
* When: Inject the named source failure and open/refresh Today.
* Then: retain the exact CWO-002-NEG02 clause above unchanged.
* Measurement: Record the actual failure response and visible recovery state; it is not rendered as zero caseload or completed work.
* Prohibited effects: False empty caseload, false completion, deletion of prior permitted draft.

**CWO-002-RJ01** — proposed fixture `PROP-CWO-002-RJ01`; actor: frontline worker.
* Given: The candidate's Today navigation graph and mobile UI are available for design review.
* When: Walk the ordinary primary task entry and conversational route and inspect any hidden module home.
* Then: retain the exact CWO-002-RJ01 clause above unchanged.
* Measurement: Record whether the primary journey still requires the twelve-module home; presence behind a chatbot is a delivery rejection.
* Prohibited effects: Claiming a hidden twelve-module home satisfies the focused Today outcome.

**CWO-002-RJ02** — proposed fixture `PROP-CWO-002-RJ02`; actor: frontline worker.
* Given: The candidate has an existing draft and an actor without authority for a second task.
* When: Manipulate client IDs/start controls and interrupt reopening of the existing draft.
* Then: retain the exact CWO-002-RJ02 clause above unchanged.
* Measurement: Server denies out-of-scope start before side effects; the same draft ID/values survive; any violation rejects the candidate.
* Prohibited effects: Client-granted authority, new out-of-scope visit, silent draft loss.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.