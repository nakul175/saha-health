# APL-50 — \[SAHA-027\] Documents and media

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-50](https://linear.app/aplyd-sandbox/issue/APL-50/saha-027-documents-and-media)  
Stable UUID: `89f1605d-cccd-401e-91d4-2592c2066004`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:35.128Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `925ec3a6613f627a5a9949f497f836e6c853190b5dabe056bb6eaf24eddb106e`  
Source plus v4.2 refinement SHA-256: `eb5ed9bbeef1eb0761ebaa506df99fd989b4e1c8e1ae9b8618aadfa5f25f4f30`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a frontline worker, I want person- and encounter-linked documents or media checked for supported type, quality, purpose and retention, so attachments can assist capture without being mistaken for verified clinical entries.

**Scope boundary:** Wrong-person, unsupported or unscanned media cannot invoke a provider or write authoritative values. Low-quality extraction remains unconfirmed, and deleting an unsubmitted recording removes its draft references.

## Canonical scope and hierarchy

Scope ID: SAHA-027; type: functional. Original IDs: BR-DATA-08.
CWO references: None. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-08 — Documents and media

Priority: Must; original release: R1.

Attachments shall be linked to a person and encounter, checked for supported type and quality, and governed by purpose and retention. Extraction from an image or document shall remain distinguishable from a verified clinical entry.

Acceptance: A low-quality image cannot silently generate confirmed values; deleting an unsubmitted recording removes the associated draft references.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-08-A — Documents and media acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-08.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-08. 2. Media progresses through uploaded, scanned, quality_checked and available. Extracted fields preserve source offsets. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A low-quality image cannot silently generate confirmed values; deleting an unsubmitted recording removes the associated draft references.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-08-B — Documents and media adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-08-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Attach a wrong-person or unscanned document; prevent provider invocation and authoritative write. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Attach a wrong-person or unscanned document; prevent provider invocation and authoritative write. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-08: source assessment "partial"; target checkpoint R14. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Object storage and larger media, clinical quality assessment of reduced photos, and a retention lifecycle for media on the server (offline queueing: slice 3a, BR-OFF-04).
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

* Positive: Run TC-BR-DATA-08-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover person- and encounter-linked documents or media checked for supported type, quality, purpose and retention.
* Refusal/adverse: Run TC-BR-DATA-08-B; retained source adverse/recovery case: Attach a wrong-person or unscanned document; prevent provider invocation and authoritative write.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Fail scanning or upload of wrong-person/low-quality media. Quarantine or retain an explicit pending state; do not invoke a provider or confirm extracted facts from unqualified media.
* Authorization refinement: For frontline worker performing “person- and encounter-linked documents or media checked for supported type, quality, purpose and retention”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.