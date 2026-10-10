# APL-28 — \[SAHA-005\] Language support and qualified language content

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-28](https://linear.app/aplyd-sandbox/issue/APL-28/saha-005-language-support-and-qualified-language-content)  
Stable UUID: `24067f1c-c5a6-43ce-bfd8-86585e90b113`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:11:24.833Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `07089f0b9c5f26fd83debcc2bde19fc4c2b585ab79bac4bea529d0f43dbbf5c4`  
Source plus v4.2 refinement SHA-256: `b40eb57c90dd0c5f09be6c2a8263b04711a5ae379bc861bdfaaa9791641f003f`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want to use the site's approved interface, speech and content languages, so I can understand the encounter without changing the meaning of clinical information.

**Scope boundary:** Supported languages and safety-critical translations require the existing qualified review. Names, numeric values and units must survive language changes; field-specific language evaluation remains required.

## Canonical scope and hierarchy

Scope ID: SAHA-005; type: functional. Original IDs: BR-UX-05, NFR-15.
CWO references: CWO-018,CWO-031. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP11. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-UX-05 — Language and accessibility

Priority: Must; original release: R1.

The pilot shall support approved interface, speech and content languages, initially Hindi and English if suitable for the selected site. Critical content shall have reviewed translations. Numeric values, units and names shall survive language changes.

Acceptance: The same encounter retains meaning across supported languages and passes the defined accessibility and language-specific task tests.

### NFR-15 — Language quality

Priority: Must; original release: R1.

Critical UI, counselling and escalation content shall receive qualified human review in each supported language. Numeric extraction, negation and clinical terms require task-specific evaluation; aggregate speech word error rate alone is insufficient.

Verification: Reviewers accept the language corpus, and all safety-critical benchmark cases meet the approved pass criteria.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-UX-05-A — Language and accessibility acceptance

Type: Functional; source role: QA with Frontline worker; fixture: FX-UX-05.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-UX-05. 2. Language is a user preference; concepts and numeric values are language-neutral. Reviewed clinical strings have version IDs. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: The same encounter retains meaning across supported languages and passes the defined accessibility and language-specific task tests.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-UX-05-B — Language and accessibility adverse condition

Type: Negative or recovery; source role: QA with Frontline worker; fixture: FX-UX-05-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Switch language after entering a decimal measurement; the value and unit remain identical. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Switch language after entering a decimal measurement; the value and unit remain identical. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-15-A — Language quality acceptance

Type: Performance or control; source role: QA with engineering owner; fixture: FX-NFR-15.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-NFR-15. 2. Use reviewed language fixtures for clinical negation units dates names and mixed-language speech. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Reviewers accept the language corpus, and all safety-critical benchmark cases meet the approved pass criteria.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-15-B — Language quality adverse condition

Type: Negative or recovery; source role: QA with engineering owner; fixture: FX-NFR-15-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Translate a safety-critical string incorrectly; block that language workflow until corrected. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Translate a safety-critical string incorrectly; block that language workflow until corrected. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-UX-05: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Qualified translator review of all Hindi text; translate the remaining workspace panels and views; user testing of the Hindi screens with ASHAs; complete reviewed localisation and accessibility/language acceptance.
NFR-15: source assessment "unverified"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Qualified review of critical translations (notebook and workspace) and language safety benchmark acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-UX-05 · APL-188](<https://linear.app/aplyd-sandbox/issue/APL-188/eng-br-ux-05-language-and-accessibility>) — Language and accessibility
* [ENG-NFR-15 · APL-794](<https://linear.app/aplyd-sandbox/issue/APL-794/eng-nfr-15-language-quality>) — Language quality

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP05, WP07, WP08, WP09, WP10. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-UX-05-A, TC-NFR-15-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover use the site's approved interface, speech and content languages.
* Refusal/adverse: Run TC-BR-UX-05-B, TC-NFR-15-B; retained source adverse/recovery case: Switch language after entering a decimal measurement; the value and unit remain identical. | Translate a safety-critical string incorrectly; block that language workflow until corrected.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Make an approved language resource unavailable during a visit. Preserve names, decimal values and units; identify unavailable content without silently switching to an unqualified translation.
* Authorization refinement: For frontline worker performing “use the site's approved interface, speech and content languages”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.