# APL-98 — \[SAHA-075\] Duplicate-safe external execution and uncertain outcomes

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-98](https://linear.app/aplyd-sandbox/issue/APL-98/saha-075-duplicate-safe-external-execution-and-uncertain-outcomes)  
Stable UUID: `be01b71f-63a9-4be8-bbf8-dd252953875b`  
Hierarchy kind: `functional_story`  
Native parent: [APL-19](APL-19.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:19:31.889Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `e17d9c68b40184dba77500a5198515830b74c651e588ccb8b164673f88b967ea`  
Source plus v4.2 refinement SHA-256: `bff4321e0bcf75f9af17eb97bbd521baf035958dbdefa87c1177675dad582c80`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a permitted worker recovering an external action, I need to reconcile an uncertain outcome using the same logical submission identity before any resubmission, so that a timeout after acceptance cannot create a duplicate patient or activity.

Bounded scope: Preserve destination-supported idempotency/reconciliation and the source's at least 10000 replay/timeout qualification target; unsupported or unverifiable outcomes remain visibly unresolved.

## Canonical scope and hierarchy

Scope ID: SAHA-075; type: functional. Original IDs: BR-INT-04, NFR-05.
CWO references: CWO-003,CWO-006,CWO-016,CWO-019. Decision references: None recorded.
Primary epic: WP07; related work packages: WP07, WP11. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-INT-04 — Duplicate prevention and uncertain outcomes

Priority: Must; original release: R1.

Retries shall use stable submission identity and destination-supported duplicate controls. Where acceptance is uncertain, the platform shall reconcile before resubmitting or route the case for review.

Acceptance: A timeout after external acceptance does not create a second patient or activity; an unverifiable outcome remains visibly unresolved.

### NFR-05 — Duplicate-safe execution

Priority: Must; original release: R1.

Repeated delivery, retries and replay of the same logical action shall not create duplicate business events where the connector contract supports idempotency or reconciliation. Unsupported cases shall remain unresolved instead of being blindly retried.

Verification: At least 10000 replay and timeout test events produce no duplicate accepted activity in the supported connector fixtures.

## Additional CWO acceptance / refusal criteria

* **CWO-003-AC03 (New acceptance)**: Given a repeated submission with the same operation identity and payload, no second planned replacement or duplicate activity is created.
* **CWO-003-NEG03 (Expected refusal / recovery)**: A reused idempotency key with changed input is refused; a lost acknowledgement does not trigger a fresh-key duplicate.
* **CWO-006-AC02 (New acceptance)**: Given the server committed but the client lost the acknowledgement, recovery identifies the existing effect and does not create a duplicate visit or charge.
* **CWO-006-AC05 (New acceptance)**: After a process restart during reconciliation, the same operation identity and original payload remain available for safe recovery.
* **CWO-006-NEG01 (Expected refusal / recovery)**: A key reused for a different payload is refused with no second effect.
* **CWO-006-NEG03 (Expected refusal / recovery)**: A provider timeout or malformed receipt remains uncertain until an authoritative reconciliation result exists.
* **CWO-006-RJ02 (Delivery rejection)**: Reject blind automatic retries of an uncertain payment, provider request or external record submission.

## Original test scenarios — not executed acceptance

### TC-BR-INT-04-A — Duplicate prevention and uncertain outcomes acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-04. 2. Use a persistent logical action ID and destination idempotency mechanism; uncertain outcomes enter reconciliation. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A timeout after external acceptance does not create a second patient or activity; an unverifiable outcome remains visibly unresolved.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-04-B — Duplicate prevention and uncertain outcomes adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Simulate acceptance followed by a network timeout; retry cannot create a duplicate event. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Simulate acceptance followed by a network timeout; retry cannot create a duplicate event. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-05-A — Duplicate-safe execution acceptance

Type: Performance or control; source role: QA with engineering owner; fixture: FX-NFR-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-NFR-05. 2. Replay at least 10000 action deliveries with timeouts before and after external acceptance and compare destination counts. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: At least 10000 replay and timeout test events produce no duplicate accepted activity in the supported connector fixtures.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-05-B — Duplicate-safe execution adverse condition

Type: Negative or recovery; source role: QA with engineering owner; fixture: FX-NFR-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Use a destination without deduplication or status lookup; require unresolved review rather than blind retry. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Use a destination without deduplication or status lookup; require unresolved review rather than blind retry. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J03 — Offline capture and partial synchronisation

Type: End to end; source role: Product QA and programme owner; fixture: FX-J03.
Preconditions: Synthetic environment; role ASHA worker and sync service; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Obtain a signed scoped offline lease while online and cache the assigned records and approved protocols.
2\. Capture the encounter into an encrypted local transaction. Show saved on device only after commit.
3\. Queue dependent commands with stable IDs and explicit person and encounter dependencies.
4\. On reconnection recheck lease, assignment, identity links, consent, versions and input freshness.
5\. Accept valid local records and dispatch only eligible destination actions. Destination A accepts; B times out.
6\. Reconcile B using its stable external reference; retry only when non-acceptance is established.
7\. Return per-item receipts and conflicts to the device. Retain pending work until its server receipt is durable.
Inject exception: Expired authority cancels pending optional uploads. Low storage preserves acknowledged records. Conflicts enter review.
Expected: No duplicate destination action and no loss of acknowledged work; unresolved outcomes have owners.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-INT-04: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Real partner duplicate/reconciliation contracts and timeout acceptance; partner evidence that its search is authoritative and its consistency delay holds.
NFR-05: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: The same evidence against real partner sandboxes, D1 persistence and the deployed Worker, including partner deduplication of late or eventually consistent requests; EHR publications whose write was not stored stay unresolved (no definitive not-found) and need partner reconciliation.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D05 / <issue id="7127b7ef-f559-4a07-b6e9-8993beb621b9" href="https://linear.app/aplyd-sandbox/issue/APL-9/d05-reconnect-without-duplication-or-false-completion">APL-9</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-INT-04 · APL-258](<https://linear.app/aplyd-sandbox/issue/APL-258/eng-br-int-04-duplicate-prevention-and-uncertain-outcomes>) — Duplicate prevention and uncertain outcomes
* [ENG-NFR-05 · APL-784](<https://linear.app/aplyd-sandbox/issue/APL-784/eng-nfr-05-duplicate-safe-execution>) — Duplicate-safe execution

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Prefer a self-contained current synthetic journey before partner-dependent exchange; receiving-owner contracts and real conformance cannot be assumed.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04, WP05, WP07, WP08, WP09, WP10. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 6–14 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-INT-04-A, TC-NFR-05-A, TC-J03 using the source-named fixture, actor, preconditions and exact Expected oracle; cover reconcile an uncertain outcome using the same logical submission identity before any resubmission.
* Refusal/adverse: Run TC-BR-INT-04-B, TC-NFR-05-B; retained source adverse/recovery case: Simulate acceptance followed by a network timeout; retry cannot create a duplicate event. | Use a destination without deduplication or status lookup; require unresolved review rather than blind retry.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Drop acknowledgement after external acceptance and replay the same action. Inspect supported deduplication/status lookup; an unsupported destination stays unresolved instead of receiving a blind duplicate retry.
* Authorization refinement: For permitted worker recovering an external action performing “reconcile an uncertain outcome using the same logical submission identity before any resubmission”: Remove the required destination-specific write/disclosure authority or expire its consent/purpose between preparation and dispatch; no protected payload may leave and read authority must not grant write authority.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-003-AC03** — proposed fixture `PROP-CWO-003-AC03`; actor: permitted worker recovering an external action.
* Given: A committed reschedule has a retained operation identity and original payload.
* When: Repeat the identical submission and inspect accepted activity/slot count and receipt.
* Then: retain the exact CWO-003-AC03 clause above unchanged.
* Measurement: Same operation resolves to the existing effect; exactly one planned replacement/accepted activity, with no second effect.
* Prohibited effects: Duplicate slot/activity or changed payload silently accepted under the prior operation identity.

**CWO-003-NEG03** — proposed fixture `PROP-CWO-003-NEG03`; actor: permitted worker recovering an external action.
* Given: A prior operation identity exists; one retry changes input while a separate committed identical request lost its acknowledgement.
* When: Submit changed input under the original key; recover the lost identical acknowledgement using its existing identity.
* Then: retain the exact CWO-003-NEG03 clause above unchanged.
* Measurement: Changed input is refused; identical committed effect is reconciled without a fresh-key duplicate.
* Prohibited effects: Changed-payload key reuse or acknowledgement-loss recovery creating a second planned replacement.

**CWO-006-AC02** — proposed fixture `PROP-CWO-006-AC02`; actor: permitted worker recovering an external action.
* Given: The server committed a synthetic operation but its acknowledgement was dropped before the client received it.
* When: Restart/retry recovery with the same operation identity and original payload.
* Then: retain the exact CWO-006-AC02 clause above unchanged.
* Measurement: Find the existing effect/receipt; accepted visit/activity/charge count does not increase from recovery.
* Prohibited effects: Second visit/charge caused by a new identity or blind retry after committed acceptance.

**CWO-006-AC05** — proposed fixture `PROP-CWO-006-AC05`; actor: permitted worker recovering an external action.
* Given: Reconciliation is underway with a durable operation identity and original payload.
* When: Kill/restart the process before reconciliation completes, then resume.
* Then: retain the exact CWO-006-AC05 clause above unchanged.
* Measurement: Recovered operation ID and payload fingerprint compare equal; existing effect is looked up before any permitted retry.
* Prohibited effects: Lost identity, substituted payload or fresh-key recovery of the same effect.

**CWO-006-NEG01** — proposed fixture `PROP-CWO-006-NEG01`; actor: permitted worker recovering an external action.
* Given: A stored operation identity/payload fingerprint already exists.
* When: Reuse that key for a different named input field and submit.
* Then: retain the exact CWO-006-NEG01 clause above unchanged.
* Measurement: Refuse changed-payload reuse with no second accepted effect and preserve original receipt.
* Prohibited effects: Overwriting the original command identity or creating a second side effect.

**CWO-006-NEG03** — proposed fixture `PROP-CWO-006-NEG03`; actor: permitted worker recovering an external action.
* Given: A provider/destination request times out or returns a malformed receipt with no authoritative result.
* When: Inspect UI/queue state and perform only the contract-supported reconciliation lookup.
* Then: retain the exact CWO-006-NEG03 clause above unchanged.
* Measurement: State remains visibly uncertain until authoritative reconciliation; no fabricated accepted/rejected result.
* Prohibited effects: Treating timeout/malformed receipt as proof of success or manufacturing a receipt.

**CWO-006-RJ02** — proposed fixture `PROP-CWO-006-RJ02`; actor: permitted worker recovering an external action.
* Given: An uncertain payment/provider request/external submission lacks verified deduplication or status evidence.
* When: Inspect the candidate automatic retry path and attempted transaction identity.
* Then: retain the exact CWO-006-RJ02 clause above unchanged.
* Measurement: Blind automatic retry of that uncertain effect rejects the candidate; retain unresolved review/reconciliation.
* Prohibited effects: Duplicate charge/request/record caused by blind retry or unverified fresh-key replay.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.