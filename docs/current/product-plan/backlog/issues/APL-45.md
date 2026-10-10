# APL-45 — \[SAHA-022\] Reviewable extraction and field-level quality

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-45](https://linear.app/aplyd-sandbox/issue/APL-45/saha-022-reviewable-extraction-and-field-level-quality)  
Stable UUID: `7b9fb4c2-19f1-4428-9e8d-d1bb622387de`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:13:57.296Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `3077e7fa03ecb9b41f2f551f7ced19d16561bf0dd057863c6c985c13bbb0ed7d`  
Source plus v4.2 refinement SHA-256: `f60ed1173158dfb18dbdb13a6d2c9df24abf60f24e33d612499acf230b4e8c9d`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want speech and free-text extraction to produce reviewable draft fields with uncertain values highlighted, so I can correct negations, identities, dates, medicines and quantities before an authoritative write.

**Scope boundary:** Derived values remain labelled and critical clinical fields require confirmation regardless of score. Administrative extraction quality is evaluated against the existing proposed 95-percent precision/recall target with field-level and subgroup results.

## Canonical scope and hierarchy

Scope ID: SAHA-022; type: functional. Original IDs: BR-DATA-03, NFR-16.
CWO references: CWO-018. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03, WP11. Source original release(s): R1.
This is one of the 160 reconciled scope items. 2 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-03 — Speech extraction as a draft

Priority: Must; original release: R1.

Speech and free text may populate draft fields, but uncertain negations, numbers, medicines, dates and identities shall be surfaced for correction. Derived values shall not be presented as direct measurements.

Acceptance: A test set containing negation, mixed language, background speakers and ambiguous quantities produces reviewable fields and no unconfirmed authoritative write.

### NFR-16 — AI extraction quality

Priority: Must; original release: R1.

The proposed administrative extraction target is at least 95 percent precision and recall for required nonclinical fields on a representative annotated corpus. Critical clinical fields require confirmation regardless of extraction score; clinical model targets remain capability-specific.

Verification: Report field-level errors, language and noise subgroups, missingness and correction burden against a versioned test set.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-03-A — Speech extraction as a draft acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-03.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-03. 2. Extraction stores original segment references and draft confidence markers; confirmation is an explicit separate command. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A test set containing negation, mixed language, background speakers and ambiguous quantities produces reviewable fields and no unconfirmed authoritative write.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-03-B — Speech extraction as a draft adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-03-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Transcribe a negated symptom and an ambiguous number; neither can silently become a confirmed positive fact. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Transcribe a negated symptom and an ambiguous number; neither can silently become a confirmed positive fact. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-16-A — AI extraction quality acceptance

Type: Performance or control; source role: QA with engineering owner; fixture: FX-NFR-16.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-NFR-16. 2. Measure precision and recall on an independently annotated representative administrative extraction set; report missingness and corrections. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Report field-level errors, language and noise subgroups, missingness and correction burden against a versioned test set.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-NFR-16-B — AI extraction quality adverse condition

Type: Negative or recovery; source role: QA with engineering owner; fixture: FX-NFR-16-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Run ambiguous clinical fields; require confirmation regardless of extraction confidence. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Run ambiguous clinical fields; require confirmation regardless of extraction confidence. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-03: source assessment "partial"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative mixed-language/noisy-speaker corpus, broad ambiguity handling and correction-burden acceptance.
NFR-16: source assessment "unverified"; target checkpoint R11. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Representative independently annotated corpus, clinical subgroups, correction burden and accuracy acceptance.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Not part of the first D01–D08 implementation tasks; later prioritisation requires sponsor decision and dependency checks.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## Native technical child issues

All tasks below are native Linear child issues. The earlier capacity fallback has been migrated by exact task ID; outcomes, criteria and test references are preserved on each child and the owning story. Tasks remain Backlog; D03 qualification tasks retain SAHA Planning hold. Coding remains held.

* [ENG-BR-DATA-03 · APL-205](<https://linear.app/aplyd-sandbox/issue/APL-205/eng-br-data-03-speech-extraction-as-a-draft>) — Speech extraction as a draft
* [ENG-NFR-16 · APL-795](<https://linear.app/aplyd-sandbox/issue/APL-795/eng-nfr-16-ai-extraction-quality>) — AI extraction quality

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Retain original Must-before-Should/Could and source-release ordering; use risk reduction and prerequisites to choose one bounded slice before adding further product surface.

Source priorities: Must; release: R1. Source package inputs: WP01, WP02, WP05, WP07, WP08, WP09, WP10. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 4–9 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-03-A, TC-NFR-16-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover speech and free-text extraction to produce reviewable draft fields with uncertain values highlighted.
* Refusal/adverse: Run TC-BR-DATA-03-B, TC-NFR-16-B; retained source adverse/recovery case: Transcribe a negated symptom and an ambiguous number; neither can silently become a confirmed positive fact. | Run ambiguous clinical fields; require confirmation regardless of extraction confidence.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Inject negation, mixed language, background speakers and an ambiguous clinical quantity. Keep field-level uncertainties reviewable and prevent an authoritative write until the required confirmation.
* Authorization refinement: For frontline worker performing “speech and free-text extraction to produce reviewable draft fields with uncertain values highlighted”: Attempt the same operation with an ineligible role/purpose, unsupported case or unapproved capability version; deny retrieval/invocation/action before protected content reaches a model or tool.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

AI applicability: version the intended use, permitted data, model/prompt/tool configuration and evaluation dataset; preserve every existing proposed/approved threshold and subgroup/critical-field requirement. Safety, malformed/unsupported output, non-generative fallback and drift/incident triggers require distinct evidence before activation.

Use the [SAHA AI assurance, discovery and release-learning recommendation](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e) for the versioned dataset/evaluation, safety/fallback, privacy and drift contract; this link does not approve provider/clinical activation.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.