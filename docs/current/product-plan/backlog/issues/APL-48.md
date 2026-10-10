# APL-48 — \[SAHA-025\] Traceable amendments

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-48](https://linear.app/aplyd-sandbox/issue/APL-48/saha-025-traceable-amendments)  
Stable UUID: `e407ee94-c9e8-436c-a31a-d684ee8ce1d0`  
Hierarchy kind: `functional_story`  
Native parent: [APL-15](APL-15.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:14:13.187Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `53f58bddde9770bd6ab0f347902315795ed24ed0e35d778caeb506552e19db90`  
Source plus v4.2 refinement SHA-256: `56d51492d2532c6be55de98cf0052def56baf8b5b49d74e29879bf0caf9f500e`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised record user, I want corrections to confirmed facts recorded as traceable amendments, so I can see invalidated AI results, affected submissions and required reconciliation work.

**Scope boundary:** Preserve prior versions, actor, time and reason. A fact change must invalidate dependent approval where relevant rather than silently preserving authority for a changed action.

## Canonical scope and hierarchy

Scope ID: SAHA-025; type: functional. Original IDs: BR-DATA-06.
CWO references: CWO-024. Decision references: None recorded.
Primary epic: WP03; related work packages: WP03. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-DATA-06 — Traceable amendments

Priority: Must; original release: R1.

Confirmed records shall be corrected by amendment with actor, time and reason. Existing accepted submissions shall be identified for downstream correction; prior versions remain available under the retention policy.

Acceptance: Correcting a key fact reveals all dependent AI results and submissions, marks invalidated outputs and creates the necessary reconciliation tasks.

## Additional CWO acceptance / refusal criteria

No additional CWO criterion assigned to this owner; original criteria are retained unchanged.

## Original test scenarios — not executed acceptance

### TC-BR-DATA-06-A — Traceable amendments acceptance

Type: Functional; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-06.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-DATA-06. 2. Amendment records supersedes_id and reason. Lineage locates dependent plans, model results and submissions. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Correcting a key fact reveals all dependent AI results and submissions, marks invalidated outputs and creates the necessary reconciliation tasks.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-DATA-06-B — Traceable amendments adverse condition

Type: Negative or recovery; source role: QA with Frontline worker and programme data owner; fixture: FX-DATA-06-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Amend a fact used in a pending order; invalidate approval and require re-evaluation. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Amend a fact used in a pending order; invalidate approval and require re-evaluation. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-J04 — Repair an incorrect patient link

Type: End to end; source role: Product QA and programme owner; fixture: FX-J04.
Preconditions: Synthetic environment; role Identity steward and programme owner; journey-specific providers and destinations configured as test adapters; no live clinical data.
Steps: 1. Report the suspected mismatch and place affected future disclosures on hold.
2\. Compare original identity sources with restricted access and confirm the correct person or preserve uncertainty.
3\. Append a superseding link record with reason and reviewer; retain the original link history.
4\. Use lineage to identify affected observations, model requests, plans and external submissions.
5\. Invalidate pending approvals and generate destination-specific correction tasks.
6\. Record external repair receipts or the remaining assisted correction obligation.
Inject exception: A steward without external amendment authority routes to the programme owner. Existing accepted records are not silently reassigned.
Expected: Identity history and all downstream impacts are visible; any incomplete external correction remains open.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-DATA-06: source assessment "partial"; target checkpoint R12. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Independent representative-scale validation, historical evidence completeness, external correction receipts, released indicator recomputation and formal acceptance remain pending. Canonical frozen edition regressions now cover bounded stored-material/reissue and supported cancellation software; broader downstream lineage, governed archival/capacity and official publication validation remain pending.
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

* Positive: Run TC-BR-DATA-06-A, TC-J04 using the source-named fixture, actor, preconditions and exact Expected oracle; cover corrections to confirmed facts recorded as traceable amendments.
* Refusal/adverse: Run TC-BR-DATA-06-B; retained source adverse/recovery case: Amend a fact used in a pending order; invalidate approval and require re-evaluation.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Amend a fact referenced by pending AI results/submissions. Preserve old versions and invalidate affected approval; route each downstream repair without rewriting an accepted receipt.
* Authorization refinement: For authorised record user performing “corrections to confirmed facts recorded as traceable amendments”: Remove the source actor’s task/record purpose or change person/assignment between preparation and commitment; deny the protected operation at its existing server/action boundary, preserving previously accepted history.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.