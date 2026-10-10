# APL-59 — \[SAHA-036\] Cross-programme scheduling

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-59](https://linear.app/aplyd-sandbox/issue/APL-59/saha-036-cross-programme-scheduling)  
Stable UUID: `041a2fce-d7e4-4f63-acb3-ec1805d54688`  
Hierarchy kind: `functional_story`  
Native parent: [APL-16](APL-16.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:15:26.481Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `a8dd30145cdc4d38734cd3d058d44843a89d09d5a19c963850ddb87e64f67f77`  
Source plus v4.2 refinement SHA-256: `b65f76dad6d0429fa780a41563b94a496c2be8424b7934b23863de09d5920654`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want compatible due activities combined into a person or household visit plan, so one visit can complete eligible shared work while each programme keeps its owner and completion criteria.

**Scope boundary:** Preserve clinical due dates, privacy constraints and referral identity. Rescheduling my own eligible slot requires no invented supervisor approval; stale changes are atomic, cancelled proposals make no stored changes, and local pending work must not be called remotely accepted.

## Canonical scope and hierarchy

Scope ID: SAHA-036; type: functional. Original IDs: BR-PROG-05.
CWO references: CWO-003,CWO-032. Decision references: DEC-08.
Primary epic: WP04; related work packages: WP04. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-PROG-05 — Cross-programme scheduling

Priority: Must; original release: R1.

The platform shall combine due activities into a person or household visit plan where timing and privacy permit, while retaining each programme's completion criteria and owner.

Acceptance: One visit completes eligible shared tasks, leaves incomplete activities open and does not duplicate a referral merely because two packs identify it.

## Additional CWO acceptance / refusal criteria

* **CWO-003-AC01 (New acceptance)**: Given an assigned worker’s own planned slot, a valid reschedule changes its planned date/window with no supervisor approval request.
* **CWO-003-AC02 (New acceptance)**: After success, the old and replacement slots are linked and exactly one is planned; covered programme due dates, owners and completion conditions remain unchanged.
* **CWO-003-AC04 (New acceptance)**: Given a worker who cancels the UI action before submission, no stored slot, receipt or clinical record changes.
* **CWO-003-AC05 (New acceptance)**: The worker can understand the new schedule and any unchanged overdue status from the mobile result without opening a programme administration screen.
* **CWO-003-NEG01 (Expected refusal / recovery)**: A stale household/member version is refused with a refresh path; neither the old nor replacement slot is partially modified.
* **CWO-003-RJ01 (Delivery rejection)**: Reject if rescheduling changes a clinical due date, completion state or entitlement.
* **CWO-003-RJ02 (Delivery rejection)**: Reject a newly added supervisor approval or compulsory explanatory form unsupported by the current departmental process.
* **CWO-003-RJ03 (Delivery rejection)**: Reject if the UI describes a local pending change as an accepted remote change.

## Original test scenarios — not executed acceptance

### TC-BR-PROG-05-A — Cross-programme scheduling acceptance

Type: Functional; source role: QA with Programme owner; fixture: FX-PROG-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-PROG-05. 2. Scheduling joins compatible tasks into a visit plan while preserving programme due dates and completion conditions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: One visit completes eligible shared tasks, leaves incomplete activities open and does not duplicate a referral merely because two packs identify it.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-PROG-05-B — Cross-programme scheduling adverse condition

Type: Negative or recovery; source role: QA with Programme owner; fixture: FX-PROG-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Combine two tasks with incompatible timing or privacy constraints; they must not be silently treated as one. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Combine two tasks with incompatible timing or privacy constraints; they must not be silently treated as one. Evidence must show the actual final state and any accountable unresolved work.
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

BR-PROG-05: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved privacy and timing rules (the late flag, the one-slot-per-item rule and the need catalogue are local defaults); packs do not declare referral needs or compatibility, so the worker names the need and the server matches it; referrals created before slice 10f carry no need and are never merged; plans exist only for people in a household; reminders/outreach for a slot and completing covered items from the visit remain separate software; physical/clinical timing acceptance is pending.
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

Source priorities: Must; release: R1. Source package inputs: WP03. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-PROG-05-A, TC-J01 using the source-named fixture, actor, preconditions and exact Expected oracle; cover compatible due activities combined into a person or household visit plan.
* Refusal/adverse: Run TC-BR-PROG-05-B; retained source adverse/recovery case: Combine two tasks with incompatible timing or privacy constraints; they must not be silently treated as one.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Cancel or replay a stale schedule proposal with incompatible task timing/privacy. Make no stored changes on cancellation, apply only an atomic current-version change, and keep genuinely distinct tasks/referrals.
* Authorization refinement: For frontline worker performing “compatible due activities combined into a person or household visit plan”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-003-AC01** — proposed fixture `PROP-CWO-003-AC01`; actor: frontline worker.
* Given: An authenticated assigned worker owns an eligible planned slot at its current version.
* When: Submit a valid reschedule date/window through the ordinary mobile path.
* Then: retain the exact CWO-003-AC01 clause above unchanged.
* Measurement: Persist the permitted new window under current identity; inspect workflow for no supervisor-approval request.
* Prohibited effects: New supervisor sign-off, clinical due-date change, change to another worker's slot.

**CWO-003-AC02** — proposed fixture `PROP-CWO-003-AC02`; actor: frontline worker.
* Given: A valid reschedule has committed for a worker's current eligible slot and covered programme tasks.
* When: Read old and replacement slots plus their programme dependencies after success.
* Then: retain the exact CWO-003-AC02 clause above unchanged.
* Measurement: Both slots reference their linkage; exactly one is planned; programme due dates, owners and completion conditions compare unchanged.
* Prohibited effects: Two planned slots, orphan link, altered programme obligation or completion condition.

**CWO-003-AC04** — proposed fixture `PROP-CWO-003-AC04`; actor: frontline worker.
* Given: The UI has a reschedule proposal but no submission has been committed.
* When: Cancel before submission, including navigating away from the proposal.
* Then: retain the exact CWO-003-AC04 clause above unchanged.
* Measurement: Compare stored slots/receipts/clinical records with the before snapshot; all remain unchanged.
* Prohibited effects: Stored mutation or receipt generation caused by cancellation alone.

**CWO-003-AC05** — proposed fixture `PROP-CWO-003-AC05`; actor: frontline worker.
* Given: A worker has a successful proposed schedule result and any clinically unchanged overdue status.
* When: Read the result on the declared mobile viewport and identify new versus unchanged schedule information.
* Then: retain the exact CWO-003-AC05 clause above unchanged.
* Measurement: Result presents the new window and unchanged overdue state without needing programme administration; collect task-observation evidence rather than invent a comprehension score.
* Prohibited effects: Hidden overdue state, required admin detour, false clinical due-date resolution.

**CWO-003-NEG01** — proposed fixture `PROP-CWO-003-NEG01`; actor: frontline worker.
* Given: Household/member/slot version changes after the proposal is prepared.
* When: Submit the stale proposal and follow its refresh/reconciliation response.
* Then: retain the exact CWO-003-NEG01 clause above unchanged.
* Measurement: Server refuses with refresh path; both old and proposed replacement slot snapshots show no partial mutation.
* Prohibited effects: Partial old/new slot change, forced overwrite, silent stale-version acceptance.

**CWO-003-RJ01** — proposed fixture `PROP-CWO-003-RJ01`; actor: frontline worker.
* Given: The candidate reschedules an eligible synthetic planned slot tied to programme obligations.
* When: Compare clinical due date, completion state and entitlement before/after the change.
* Then: retain the exact CWO-003-RJ01 clause above unchanged.
* Measurement: All protected values compare unchanged; any change rejects rescheduling delivery.
* Prohibited effects: Changing a clinical deadline, completion or entitlement through a planned-slot edit.

**CWO-003-RJ02** — proposed fixture `PROP-CWO-003-RJ02`; actor: frontline worker.
* Given: The actual departmental process has no source requirement for an added supervisor approval or compulsory explanation form.
* When: Walk the reschedule UI and inspect its server prerequisite checks.
* Then: retain the exact CWO-003-RJ02 clause above unchanged.
* Measurement: Any newly mandatory unsupported sign-off/form is recorded as a delivery rejection.
* Prohibited effects: Invented approval/form gate that prevents the ordinary permitted reschedule.

**CWO-003-RJ03** — proposed fixture `PROP-CWO-003-RJ03`; actor: frontline worker.
* Given: A reschedule is acknowledged only locally and has no remote acceptance receipt.
* When: Inspect the mobile result and local/server lifecycle fields.
* Then: retain the exact CWO-003-RJ03 clause above unchanged.
* Measurement: The state is explicitly local/pending; any accepted-remote claim rejects the result.
* Prohibited effects: Local pending mutation represented as accepted by a remote system.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.