# APL-53 — \[SAHA-030\] Controlled migration

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-53](https://linear.app/aplyd-sandbox/issue/APL-53/saha-030-controlled-migration)  
Stable UUID: `e0335617-9649-4acd-b357-c8956ad58384`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:55.501Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `cad7f425bfb562fee1858fa380d2b819cb93023e2942726bd1f5e07736b6161a`  
Source plus v4.2 refinement SHA-256: `9fbcb6e6b6422b666ea5201f70c72f81e0e91064ea8dd00b17e2d6bcc8bf297f`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As a programme data owner, I want legacy imports to provide dry-run quality reports, duplicate review and source lineage, so I can reconcile accepted, rejected and merged records and recover failed batches.

**Scope boundary:** Bulk import cannot automatically enrol people in programmes or alter a clinician's recorded decision. Repeat batches must identify duplicates without creating duplicate official enrolments.

## Canonical scope and hierarchy

Scope ID: SAHA-030; type: functional. Original IDs: BR-DATA-11.
CWO references: None. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R2.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-11 — Controlled migration

Priority: Should; original release: R2.

Legacy imports shall support dry runs, data-quality reports, duplicate review and source lineage. A bulk import shall not automatically create programme enrolment or change a clinician's recorded decision.

Acceptance: A migration sample reconciles source counts, rejects, merges and accepted records, with a reversible process for failed batches.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-11-A — Controlled migration acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-11.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-11. 2. Migration runs produce source totals, parsed totals, rejected rows, duplicate candidates and reversible import batch IDs. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: A migration sample reconciles source counts, rejects, merges and accepted records, with a reversible process for failed batches.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-11-B — Controlled migration adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-11-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Repeat a batch containing duplicate people; report candidates without creating duplicate official enrolments. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Repeat a batch containing duplicate people; report candidates without creating duplicate official enrolments. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-11: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Wider import quality reports, issuer verification/correction, representative source contracts and larger media/history qualification remain. Documentary imported-source review and overlap decisions are delivered within declared limits; partner clinical-version conflict queues remain separate B09 work. Formal/clinical/external acceptance stays pending.
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

Source priorities: Should; release: R2. Source package inputs: WP01, WP02. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-DATA-11-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover legacy imports to provide dry-run quality reports, duplicate review and source lineage.
* Refusal/adverse: Run TC-BR-DATA-11-B; retained source adverse/recovery case: Repeat a batch containing duplicate people; report candidates without creating duplicate official enrolments.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Repeat a partially failed import batch in a synthetic dry-run corpus. Reconcile source/accepted/rejected/merged counts and duplicates; do not create automatic enrolments or amend clinical decisions.
* Authorization refinement: For programme data owner performing “legacy imports to provide dry-run quality reports, duplicate review and source lineage”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.