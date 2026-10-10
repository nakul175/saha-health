# APL-72 — \[SAHA-049\] Clinical workflow continuity without an LLM

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-72](https://linear.app/aplyd-sandbox/issue/APL-72/saha-049-clinical-workflow-continuity-without-an-llm)  
Stable UUID: `6986e54f-90bf-4c01-8960-36c74315609d`  
Hierarchy kind: `functional_story`  
Native parent: [APL-17](APL-17.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:16:36.484Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `f1234b8ef37acf341b17f5ed0505e4500df6904ecb7516beab6c9b9f8a9a794d`  
Source plus v4.2 refinement SHA-256: `e54dab440afbc11f5bb1d8ade669417c4ce2a09938309df5a6b368573aa5fc80`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want core structured capture, valid cached protocols, local draft referrals and urgent-task visibility to remain usable during a language-model outage, so I can continue approved non-generative care workflows.

**Scope boundary:** Unavailable assistance is explicit and produces no invented AI result. Optional speech, advice, Academy or study participation must not block routine capture, review or save; the ordinary visual path remains available.

## Canonical scope and hierarchy

Scope ID: SAHA-049; type: functional. Original IDs: BR-AG-10.
CWO references: CWO-004,CWO-005,CWO-007. Decision references: None recorded.
Primary epic: WP05; related work packages: WP05. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-AG-10 — Clinical workflow continuity without an LLM

Priority: Must; original release: R1.

Loss of the language model shall not prevent structured capture, access to valid cached protocols, a local draft referral or visibility of urgent tasks. The interface shall make unavailable functions explicit.

Acceptance: A simulated LLM outage leaves the core non-generative encounter workflow usable without substituting invented AI results.

## Additional CWO acceptance / refusal criteria

* **CWO-004-AC05 (New acceptance)**: Given absent optional AI, the worker completes the manual path without waiting for an inference.
* **CWO-004-RJ02 (Delivery rejection)**: Reject a routine visit that is blocked by optional speech, advice, Academy or study participation.
* **CWO-005-AC04 (New acceptance)**: External AI unavailability changes the assistance state but does not disable routine capture/review/save.
* **CWO-007-AC05 (New acceptance)**: Given the language service is unavailable or the request unsupported, the app still offers the ordinary visual task path.

## Original test scenarios — not executed acceptance

### TC-BR-AG-10-A — Clinical workflow continuity without an LLM acceptance

Type: Functional; source role: QA with Worker or clinician within active scope; fixture: FX-AG-10.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-AG-10. 2. Structured capture, cached approved guidance and draft referrals operate without a model dependency. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A simulated LLM outage leaves the core non-generative encounter workflow usable without substituting invented AI results.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-AG-10-B — Clinical workflow continuity without an LLM adverse condition

Type: Negative or recovery; source role: QA with Worker or clinician within active scope; fixture: FX-AG-10-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Disable the LLM service during a visit; approved non-generative functions remain available. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Disable the LLM service during a visit; approved non-generative functions remain available. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-AG-10: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Approved outage pathways, offline cached protocols and device-level escalation acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D03 / <issue id="6d0fbb18-ad15-4dbc-9433-ec3b7ea1b8e5" href="https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit">APL-7</issue>, D06 / <issue id="6984cd43-72e8-497c-b9bd-947968776004" href="https://linear.app/aplyd-sandbox/issue/APL-10/d06-open-or-prepare-bounded-tasks-conversationally">APL-10</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

First inspect the bounded controls directly referenced by the preserved D02/D03 delivery slices; do not qualify the full parent from a narrower slice.

Source priorities: Must; release: R1. Source package inputs: WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–10 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-AG-10-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover core structured capture, valid cached protocols, local draft referrals and urgent-task visibility to remain usable during a language-model outage.
* Refusal/adverse: Run TC-BR-AG-10-B; retained source adverse/recovery case: Disable the LLM service during a visit; approved non-generative functions remain available.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Disable the LLM during capture/review/save. Retain the ordinary structured path and valid cached protocol context; label assistance unavailable without inventing a result.
* Authorization refinement: For frontline worker performing “core structured capture, valid cached protocols, local draft referrals and urgent-task visibility to remain usable during a language-model outage”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-AC05** — proposed fixture `PROP-CWO-004-AC05`; actor: frontline worker.
* Given: The optional AI/speech/advice capability is absent while ordinary manual capture is permitted.
* When: Complete the manual routine path through review/save without requesting inference.
* Then: retain the exact CWO-004-AC05 clause above unchanged.
* Measurement: Ordinary required fields and permitted save complete independently; no wait-for-inference gate is introduced.
* Prohibited effects: Blocked care/manual save, fabricated AI output, optional feature converted into a prerequisite.

**CWO-004-RJ02** — proposed fixture `PROP-CWO-004-RJ02`; actor: frontline worker.
* Given: A routine task has optional speech, advice, Academy or study participation disabled/declined.
* When: Walk capture/review/save for the same permitted actor and source pack.
* Then: retain the exact CWO-004-RJ02 clause above unchanged.
* Measurement: Any required optional participation/inference gate rejects the candidate; routine manual controls remain operable.
* Prohibited effects: Optional module as compulsory care gate or extra provider/login prerequisite.

**CWO-005-AC04** — proposed fixture `PROP-CWO-005-AC04`; actor: frontline worker.
* Given: External AI becomes unavailable during an otherwise permitted routine encounter.
* When: Inject outage during capture/review/save and retry through the visual path.
* Then: retain the exact CWO-005-AC04 clause above unchanged.
* Measurement: Only assistance state changes; ordinary capture/review/save remain enabled and durable under their existing contract.
* Prohibited effects: Disabling core work, losing draft, falsely marking AI completion.

**CWO-007-AC05** — proposed fixture `PROP-CWO-007-AC05`; actor: frontline worker.
* Given: Language service is unavailable or a conversational request is outside its supported scope.
* When: Attempt conversational entry, then use the offered ordinary visual task control.
* Then: retain the exact CWO-007-AC05 clause above unchanged.
* Measurement: Visual task path remains discoverable and reaches the same permitted task; assistance limitation is explicit.
* Prohibited effects: Stranded workflow, hidden visual fallback, improvised unsupported task.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.