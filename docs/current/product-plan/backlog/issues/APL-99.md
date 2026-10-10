# APL-99 — \[SAHA-076\] Partial completion across systems

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-99](https://linear.app/aplyd-sandbox/issue/APL-99/saha-076-partial-completion-across-systems)  
Stable UUID: `c07fee9f-9cd4-42bd-b4c6-dd9f0d26b9d7`  
Hierarchy kind: `functional_story`  
Native parent: [APL-19](APL-19.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:19:38.162Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `b40ea85c95cb9a140d9f7269f3fa380cad45de229e9e69ab9581b70591b4f89a`  
Source plus v4.2 refinement SHA-256: `7fdf26ea76c2e4870efab31e824d6bba60925964b222e2280f780bcd8e68bdff`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted worker managing a multi-destination action, I need to see each destination's independent accepted, failed or uncertain state, so that recovery preserves successful work and addresses only the outstanding destination.

Bounded scope: Keep per-destination receipts and controlled recovery; no cross-system atomicity or deletion of valid records is promised, and uncertainty still requires reconciliation before retry.

## Canonical scope and hierarchy

Scope ID: SAHA-076; type: functional. Original IDs: BR-INT-05.
CWO references: CWO-006,CWO-016. Decision references: None recorded.
Primary epic: WP07; related work packages: WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-INT-05 — Partial completion across systems

Priority: Must; original release: R1.

The platform shall track each destination independently and support recovery from partial success. It shall not promise an atomic transaction across unrelated MIS systems or automatically delete valid records to simulate rollback.

Acceptance: If one of two writes succeeds, the success receipt is preserved and only the failed or uncertain destination is retried.

## Additional CWO acceptance / refusal criteria

* **CWO-006-AC03 (New acceptance)**: Given several queued items, one refusal does not erase acknowledgements for successful items or delete the refused draft.

## Original test scenarios — not executed acceptance

### TC-BR-INT-05-A — Partial completion across systems acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-05. 2. Each external action has its own receipt and retry policy; successful actions remain accepted during another failure. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: If one of two writes succeeds, the success receipt is preserved and only the failed or uncertain destination is retried.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-05-B — Partial completion across systems adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Destination A succeeds and B fails; recovery must not undo or resend A. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Destination A succeeds and B fails; recovery must not undo or resend A. Evidence must show the actual final state and any accountable unresolved work.
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

BR-INT-05: source assessment "implemented-local"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Two live systems demonstrate the same recovery behaviour.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D05 / <issue id="7127b7ef-f559-4a07-b6e9-8993beb621b9" href="https://linear.app/aplyd-sandbox/issue/APL-9/d05-reconnect-without-duplication-or-false-completion">APL-9</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Prefer a self-contained current synthetic journey before partner-dependent exchange; receiving-owner contracts and real conformance cannot be assumed.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-INT-05-A, TC-J01 using the source-named fixture, actor, preconditions and exact Expected oracle; cover see each destination's independent accepted, failed or uncertain state.
* Refusal/adverse: Run TC-BR-INT-05-B; retained source adverse/recovery case: Destination A succeeds and B fails; recovery must not undo or resend A.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Accept destination A and fail B, then replay recovery. Preserve A and recover only B under its existing idempotency/receipt contract; no aggregate completion hides B.
* Authorization refinement: For permitted worker managing a multi-destination action performing “see each destination's independent accepted, failed or uncertain state”: Remove the required destination-specific write/disclosure authority or expire its consent/purpose between preparation and dispatch; no protected payload may leave and read authority must not grant write authority.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-006-AC03** — proposed fixture `PROP-CWO-006-AC03`; actor: permitted worker managing a multi-destination action.
* Given: A queue contains successful items with acknowledgements plus one refused draft.
* When: Reconcile the batch and inspect each item after the refusal.
* Then: retain the exact CWO-006-AC03 clause above unchanged.
* Measurement: Successful receipts remain intact; refused draft remains identifiable with its reason and recovery state.
* Prohibited effects: Erasing accepted receipts, deleting the refused draft, collapsing all items into one failure/success.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.