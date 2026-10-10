# APL-51 — \[SAHA-028\] Versioned terminology and destination field mappings

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-51](https://linear.app/aplyd-sandbox/issue/APL-51/saha-028-versioned-terminology-and-destination-field-mappings)  
Stable UUID: `86115927-472a-4aca-b3e9-bd7ab2765a1c`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:40.488Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `57b0672901550963d6b1163cf0291fac749e8743ff0609416f3b873a7685da4f`  
Source plus v4.2 refinement SHA-256: `235b318b4247b1ce18c34758abda07b2f0fefa4595289338937447c5f7fcf8cd`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a programme or integration data owner, I want reviewed, versioned mappings for destination fields, codes and units, so common facts retain the correct meaning across submissions and terminology changes.

**Scope boundary:** Record versions and effective dates, preserve earlier accepted interpretation, and produce impact information for changes. Missing mandatory mappings and ambiguous, deprecated or unmapped concepts cannot be silently substituted.

## Canonical scope and hierarchy

Scope ID: SAHA-028; type: functional. Original IDs: BR-DATA-09, BR-INT-23.
CWO references: CWO-013. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP07. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-09 — Authoritative field mapping

Priority: Must; original release: R1.

Each connector shall use a reviewed mapping from common facts to destination definitions, codes and units. Mapping versions shall be recorded with submissions and effective dates.

Acceptance: A mapping change passes owner-approved fixtures and does not reinterpret earlier accepted records without a documented migration.

### BR-INT-23 — Terminology and mapping governance

Priority: Must; original release: R1.

Clinical codes, local programme values, units and mapping tables shall be versioned, reviewed and tested for the specific source and destination. Unmapped, deprecated or ambiguous concepts shall not be silently replaced with the nearest available code.

Acceptance: A terminology change produces an impact report and blocks affected submissions until the mapping is approved or the value is explicitly represented as unmapped.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-09-A — Authoritative field mapping acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-09.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-09. 2. Mapping packages contain source field, target field, transformation, unit and null semantics plus conformance fixtures. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A mapping change passes owner-approved fixtures and does not reinterpret earlier accepted records without a documented migration.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-09-B — Authoritative field mapping adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-09-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Remove a target mandatory field in a new mapping; activation must fail and queued work stay on a compatible version. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Remove a target mandatory field in a new mapping; activation must fail and queued work stay on a compatible version. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-23-A — Terminology and mapping governance acceptance

Type: Functional; source role: QA with Integration owner; fixture: FX-INT-23.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-INT-23. 2. Unmapped terminology has an explicit state and blocks destinations requiring a code until reviewed mapping exists. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A terminology change produces an impact report and blocks affected submissions until the mapping is approved or the value is explicitly represented as unmapped.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-INT-23-B — Terminology and mapping governance adverse condition

Type: Negative or recovery; source role: QA with Integration owner; fixture: FX-INT-23-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Use a deprecated or ambiguous code; do not silently substitute a nearest code. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Use a deprecated or ambiguous code; do not silently substitute a nearest code. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-09: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Native partner/clinical terminology and source semantics acceptance, representative external conformance corpus and larger-history qualification remain. Closed deterministic software semantics and owner-declared conformance are delivered; they do not establish partner approval. Unknown delivery remains lookup-only.
BR-INT-23: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Native partner/clinical terminology and source semantics acceptance, representative external conformance corpus and larger-history qualification remain. Closed deterministic software semantics and owner-declared conformance are delivered; they do not establish partner approval. Unknown delivery remains lookup-only.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-DATA-09 · APL-211](<https://linear.app/aplyd-sandbox/issue/APL-211/eng-br-data-09-authoritative-field-mapping>) — Authoritative field mapping
* [ENG-BR-INT-23 · APL-725](<https://linear.app/aplyd-sandbox/issue/APL-725/eng-br-int-23-terminology-and-mapping-governance>) — Terminology and mapping governance

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP03, WP04. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-09-A, TC-BR-INT-23-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover reviewed, versioned mappings for destination fields, codes and units.
* Refusal/adverse: Run TC-BR-DATA-09-B, TC-BR-INT-23-B; retained source adverse/recovery case: Remove a target mandatory field in a new mapping; activation must fail and queued work stay on a compatible version. | Use a deprecated or ambiguous code; do not silently substitute a nearest code.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Remove a mandatory destination mapping or introduce an ambiguous/deprecated code. Pause affected activation/submission on the pinned version and produce a change-impact record without guessed substitutes.
* Authorization refinement: For programme or integration data owner performing “reviewed, versioned mappings for destination fields, codes and units”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.