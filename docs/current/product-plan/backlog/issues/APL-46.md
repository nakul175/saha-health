# APL-46 — \[SAHA-023\] Freshness and relevance

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-46](https://linear.app/aplyd-sandbox/issue/APL-46/saha-023-freshness-and-relevance)  
Stable UUID: `536dc72e-cf9e-430d-8797-f2b97a7f6744`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:03.880Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `6c82043fc97467c1a33405fc65f66713bf54c9a606f8c9bff72b569f8d07f2ea`  
Source plus v4.2 refinement SHA-256: `2458f96bd2ccd626b04f7741378155b971509a8a33816a5019cee3eb3d614ee9`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want prior observations shown with their original time and approved reuse limits, so I can distinguish historical facts from new measurements and remeasure when required.

**Scope boundary:** Freshness uses effective time and the applicable programme or capability rule. Uploading an old value today cannot make it current or eligible for a time-sensitive model.

## Canonical scope and hierarchy

Scope ID: SAHA-023; type: functional. Original IDs: BR-DATA-04.
CWO references: CWO-004,CWO-013,CWO-014. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-04 — Freshness and relevance

Priority: Must; original release: R1.

Each programme or capability shall specify which prior inputs can be reused and their allowed age. The workspace shall distinguish a historical value from a new observation and request remeasurement where the approved rule requires it.

Acceptance: An expired measurement is excluded from a time-sensitive model call even if it is the latest value available.

## Additional CWO acceptance / refusal criteria

* **CWO-004-AC02 (New acceptance)**: Given an old observation, the review card retains its original observed time and does not silently classify it as a measurement from this visit.
* **CWO-004-RJ01 (Delivery rejection)**: Reject stale-data reuse presented as a new observation.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-04-A — Freshness and relevance acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-04.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-04. 2. Freshness is evaluated from effective time against the active pack requirement, not server receipt time. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: An expired measurement is excluded from a time-sensitive model call even if it is the latest value available.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-04-B — Freshness and relevance adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-04-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Upload an old measurement today; it must remain historical and cannot satisfy a new-measurement requirement. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Upload an old measurement today; it must remain historical and cannot satisfy a new-measurement requirement. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-04: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Concept-specific reuse and quality policies across every programme/model, including clinical acceptance.
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

Source priorities: Must; release: R1. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-04-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover prior observations shown with their original time and approved reuse limits.
* Refusal/adverse: Run TC-BR-DATA-04-B; retained source adverse/recovery case: Upload an old measurement today; it must remain historical and cannot satisfy a new-measurement requirement.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Upload an old measurement today or change a freshness rule during preparation. Use effective observation time and the approved version; stale data stays historical and cannot satisfy a new measurement.
* Authorization refinement: For frontline worker performing “prior observations shown with their original time and approved reuse limits”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-004-AC02** — proposed fixture `PROP-CWO-004-AC02`; actor: frontline worker.
* Given: An old observation has a pinned effective observed time distinct from the current visit.
* When: Load it on the review card and prepare the current visit snapshot.
* Then: retain the exact CWO-004-AC02 clause above unchanged.
* Measurement: Displayed/persisted effective time remains the old time; origin/new-versus-historical classification stays truthful.
* Prohibited effects: Upload/open time replacing observation time or relabelling stale history as a new measurement.

**CWO-004-RJ01** — proposed fixture `PROP-CWO-004-RJ01`; actor: frontline worker.
* Given: The candidate reuses a stale measurement while displaying this visit's summary.
* When: Compare displayed new-observation claims with the original observation ID/time/provenance.
* Then: retain the exact CWO-004-RJ01 clause above unchanged.
* Measurement: Any stale value represented as newly observed rejects the candidate; retain original source evidence.
* Prohibited effects: Invented fresh observation or hidden provenance/time alteration.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.