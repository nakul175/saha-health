# APL-29 — \[SAHA-006\] Truthful lifecycle status and cancellation

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-29](https://linear.app/aplyd-sandbox/issue/APL-29/saha-006-truthful-lifecycle-status-and-cancellation)  
Stable UUID: `1a5f6d92-dde4-48e1-a58f-978ca2bb3124`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:28.853Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `63d4b169b85eec37f92d56092fed9dc2f3e29986eeb99c16f2abae49b79ef822`  
Source plus v4.2 refinement SHA-256: `95aff5c77bb87fb724cea60554f4d6c0be0a0ae30b501477c8f6f0168d4a63dc`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a worker reviewing an encounter, I want separate device-save, server-save, review and destination states, so I know which actions succeeded and which still require recovery.

**Scope boundary:** A completion tick cannot imply acceptance by every destination. Local cancellation must preserve accepted external receipts and identify any separately authorised correction or reversal work.

## Canonical scope and hierarchy

Scope ID: SAHA-006; type: functional. Original IDs: BR-UX-06, BR-RULE-04.
CWO references: CWO-004,CWO-005,CWO-006,CWO-016,CWO-022,CWO-026. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP02. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-06 — Status that reflects reality

Priority: Must; original release: R1.

The application shall distinguish saved on device, saved on server, awaiting review, submitted, accepted, rejected and unresolved. A general completion tick shall never imply that every destination accepted a record.

Acceptance: Simultaneous success in one programme and failure in another produces separate visible statuses and a specific recovery action.

### BR-RULE-04 — Honest completion and cancellation

Priority: Must; original release: R1.

Local completion, external acceptance and service completion shall be distinct. Cancelling a local task shall not falsely cancel an accepted external transaction; a separate authorised correction or cancellation request is required.

Acceptance: Cancellation after submission reports the actual destination state and generates any remaining reversal task.

## Additional CWO acceptance / refusal criteria

* **CWO-004-AC04 (New acceptance)**: Given a valid save, the persisted visit/pack snapshot agrees with the review card and returns an appropriate local/server state.
* **CWO-005-AC05 (New acceptance)**: The receipt distinguishes locally completed capture, pending server sync and pending programme acceptance.
* **CWO-006-AC04 (New acceptance)**: Given a destination still has not acknowledged the record, the interface does not display programme acceptance.
* **CWO-006-RJ01 (Delivery rejection)**: Reject boolean-only synced state that hides failed or pending destination delivery.

## Original test scenarios — not executed acceptance

### TC-BR-UX-06-A — Status that reflects reality acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-06. 2. Show one state per destination plus a separate encounter-save state. Completion derives from required actions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Simultaneous success in one programme and failure in another produces separate visible statuses and a specific recovery action.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-06-B — Status that reflects reality adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Accept destination A and reject B; no overall all-submitted status may appear. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Accept destination A and reject B; no overall all-submitted status may appear. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-04-A — Honest completion and cancellation acceptance

Type: Functional; source role: QA with All actors; fixture: FX-RULE-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-RULE-04. 2. Local task cancellation records remaining external obligations; it never rewrites destination receipts. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Cancellation after submission reports the actual destination state and generates any remaining reversal task.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-RULE-04-B — Honest completion and cancellation adverse condition

Type: Negative or recovery; source role: QA with All actors; fixture: FX-RULE-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Cancel after external acceptance; the accepted receipt remains and a correction task is created. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Cancel after external acceptance; the accepted receipt remains and a correction task is created. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-06: source assessment "implemented-local"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Real destination and device-state acceptance.
BR-RULE-04: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Correction or reversal support from real partners (no destination declares void support and Saha has no EHR amendment or withdrawal path, so these stay manual), partner-confirmed reversal receipts, and acceptance with a real destination.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D03 / <issue id="6d0fbb18-ad15-4dbc-9433-ec3b7ea1b8e5" href="https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit">APL-7</issue>, D05 / <issue id="7127b7ef-f559-4a07-b6e9-8993beb621b9" href="https://linear.app/aplyd-sandbox/issue/APL-9/d05-reconnect-without-duplication-or-false-completion">APL-9</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-UX-06 · APL-189](<https://linear.app/aplyd-sandbox/issue/APL-189/eng-br-ux-06-status-that-reflects-reality>) — Status that reflects reality
* [ENG-BR-RULE-04 · APL-775](<https://linear.app/aplyd-sandbox/issue/APL-775/eng-br-rule-04-honest-completion-and-cancellation>) — Honest completion and cancellation

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

First inspect the bounded controls directly referenced by the preserved D02/D03 delivery slices; do not qualify the full parent from a narrower slice.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-UX-06-A, TC-BR-RULE-04-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover separate device-save, server-save, review and destination states.
* Refusal/adverse: Run TC-BR-UX-06-B, TC-BR-RULE-04-B; retained source adverse/recovery case: Accept destination A and reject B; no overall all-submitted status may appear. | Cancel after external acceptance; the accepted receipt remains and a correction task is created.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Lose acknowledgement after one destination accepts. Preserve its receipt, show other destination states independently, and recover only the uncertain action under its existing receipt contract.
* Authorization refinement: For worker reviewing an encounter performing “separate device-save, server-save, review and destination states”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-AC04** — proposed fixture `PROP-CWO-004-AC04`; actor: worker reviewing an encounter.
* Given: A valid corrected review card and applicable pack snapshots are prepared for the same permitted visit.
* When: Save through the existing command and read back the persisted visit/pack snapshot and receipt.
* Then: retain the exact CWO-004-AC04 clause above unchanged.
* Measurement: Compare persisted facts/pack versions with the reviewed card; receipt identifies the actual local/server durable state.
* Prohibited effects: Review/persistence disagreement, local-only receipt labelled server accepted, fabricated confirmation.

**CWO-005-AC05** — proposed fixture `PROP-CWO-005-AC05`; actor: worker reviewing an encounter.
* Given: Capture can be durable locally while server sync and programme acceptance are independently pending.
* When: Complete local capture and inspect receipt/status before and after synthetic server and destination acknowledgement.
* Then: retain the exact CWO-005-AC05 clause above unchanged.
* Measurement: Verify separate capture, server-sync and programme-acceptance fields for each observed stage; no status collapses them.
* Prohibited effects: Local capture labelled remotely/programme accepted without evidence.

**CWO-006-AC04** — proposed fixture `PROP-CWO-006-AC04`; actor: worker reviewing an encounter.
* Given: A corresponding local/server record exists but a destination has not acknowledged it.
* When: Refresh the result and exercise an acknowledgement timeout/delay.
* Then: retain the exact CWO-006-AC04 clause above unchanged.
* Measurement: Destination status stays pending/uncertain until its authoritative acknowledgement; inspect actual receipt provenance.
* Prohibited effects: Displaying programme acceptance from a local save or transport-only response.

**CWO-006-RJ01** — proposed fixture `PROP-CWO-006-RJ01`; actor: worker reviewing an encounter.
* Given: The candidate has mixed acknowledged, pending and failed destination items.
* When: Inspect stored lifecycle/status schema and UI for every seeded item.
* Then: retain the exact CWO-006-RJ01 clause above unchanged.
* Measurement: Each state and destination identity is distinguishable; a single boolean hiding pending/failure rejects the candidate.
* Prohibited effects: Boolean-only synced flag obscuring failed or pending delivery.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.