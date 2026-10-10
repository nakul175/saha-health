# APL-34 — \[SAHA-011\] Scoped permissions

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-34](https://linear.app/aplyd-sandbox/issue/APL-34/saha-011-scoped-permissions)  
Stable UUID: `372f857c-5bc6-4e8a-a69f-072973bd0bf7`  
Hierarchy kind: `functional_story`  
Native parent: [APL-13](APL-13.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T13:12:05.579Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `9bf2e2b1f83b4af297a01ccb746e5b919d0bacbcba00746c5db6b07da10a4fe0`  
Source plus v4.2 refinement SHA-256: `50d3872272166d7b494678c3adc85614d74ce0675133e889f4e20214b65c204b`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## User / outcome

As an authorised record user, I want every read, write, search, export and tool call constrained by my effective permissions, so records stay within the intended tenant, role, assignment, programme, facility or geography and purpose.

**Scope boundary:** The server enforces these boundaries even for guessed IDs, manipulated requests, stale assignments and revoked access. Hiding a screen cannot grant or establish authority.

## Canonical scope and hierarchy

Scope ID: SAHA-011; type: functional. Original IDs: BR-ID-02.
CWO references: CWO-002,CWO-003,CWO-012. Decision references: None recorded.
Primary epic: WP01; related work packages: WP01. Source original release(s): R1.
This is one of the 160 reconciled scope items. 1 original requirement(s) map here exactly once.

## Original requirement and acceptance text

### BR-ID-02 — Scoped permissions

Priority: Must; original release: R1.

Access shall be constrained by tenant, role, assignment, programme, facility or geography, purpose and action. The server shall enforce the effective permission set for reads, writes, searches, exports and tool calls.

Acceptance: Negative tests cover each boundary and prove that hidden screens or manipulated requests cannot expand access.

## Additional CWO acceptance / refusal criteria

* **CWO-002-NEG01 (Expected refusal / recovery)**: A stale or revoked assignment cannot be opened by supplying its ID directly; retain the rest of the permitted list.
* **CWO-003-NEG02 (Expected refusal / recovery)**: An out-of-scope member, another worker’s slot or closed covered work is refused by the server, without revealing otherwise inaccessible records.

## Original test scenarios — not executed acceptance

### TC-BR-ID-02-A — Scoped permissions acceptance

Type: Functional; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-02.
Preconditions: Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution.
Steps: 1. Load FX-ID-02. 2. Policy input includes tenant, active role, assignment, programme, facility, purpose, action and resource sensitivity. 3. Capture UI/API results and stored receipt or audit evidence.
Expected: Negative tests cover each boundary and prove that hidden screens or manipulated requests cannot expand access.
Formal status: Not run; no engineering subset automatically passes this case.

### TC-BR-ID-02-B — Scoped permissions adverse condition

Type: Negative or recovery; source role: QA with Deployment administrator and identity steward; fixture: FX-ID-02-NEG.
Preconditions: Isolated synthetic tenant; begin from the corresponding acceptance scenario; inject only the named adverse condition.
Steps: 1. Establish the normal precondition. 2. Guess a valid record ID outside the assigned caseload; deny access without revealing record content. 3. Inspect user state, side effects, audit and any recovery queue.
Expected: Guess a valid record ID outside the assigned caseload; deny access without revealing record content. Evidence must show the actual final state and any accountable unresolved work.
Formal status: Not run; no engineering subset automatically passes this case.

## Authorization, error and recovery contract

Current server role/tenant/assignment/purpose, audit and version constraints remain applicable. Before execution, freeze authorised positive behaviour, out-of-scope/changed-authority refusal, invalid input, unavailable dependency, stale version and uncertain-save recovery wherever relevant. Inspect actual code/API/data and inherited failures; preserve targets and no-side-effect guarantees. Do not substitute an assumed UI or reference API catalogue for a current implementation contract.

## Current evidence and readiness

BR-ID-02: source assessment "partial"; target checkpoint R15. Full remaining scope stays open; see authoritative requirements/assessment.tsv and current evidence-map. Remaining: Validated facility and geography directories, locality-based caseload transfer, and acceptance with named reviewers.
Canonical item remains Backlog/unqualified. Current local source/assessment may contain bounded implemented components; original formal acceptance is not thereby passed. No named executor, estimate or delivery date is invented.
Related implementation tasks: D02 / <issue id="adfe4945-bb19-47a6-a87d-a2f8c80962fe" href="https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today">APL-6</issue>. D02 is delivered only within its frozen read-only synthetic gate; no parent acceptance follows. D03 coding is held for planning.

## Technical work and delivery

Requirement-linked engineering subtasks retain ENG IDs, source outcomes, owner roles, dependencies and tests. Inspect current reuse and freeze a minimal ready slice before coding; no bulk implementation dispatch. GitHub #188 remains the single delivery controller. Isolated qualified story PRs, final-code CI/review/native approvals and exact hosting/smoke evidence govern delivery.
No real patient/recipient, provider activation, paid services, new hosting, parallel database, clinical policy or destructive migration is authorised by this backlog.

Sources: [scope row](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>), [additional criteria](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/new-criteria.tsv>), [source BRD requirements](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/requirements/brd-v1.1.json>), [formal catalogue](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/workbook/Test-Catalogue.csv>), [delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>).

## v4.2 planning refinement — source preserved

Author recommendation for planning only. Original requirements, frozen criteria, native status/priority/milestone/assignee and historic evidence remain unchanged. Do not weaken criteria to obtain a pass.

### Priority, sequence and forecast

Risk reduction and prerequisite identity/policy integrity outrank convenience features; qualify the current slice-specific controls before expanding access/actions.

Source priorities: Must; release: R1. Source package inputs: none recorded. These are inspection inputs, not whole-epic completion requirements.

Recommended size: 2–5 engineering effort days, low confidence. Method: owned requirement count plus interface/device/source-gap uncertainty; inspect current reuse first. Excludes approval/partner wait, participant recruitment and observation windows; no staffing/date commitment.

### Scenario coverage and evidence contract

* Positive: Run TC-BR-ID-02-A using the source-named fixture, actor, preconditions and exact Expected oracle; cover every read, write, search, export and tool call constrained by my effective permissions.
* Refusal/adverse: Run TC-BR-ID-02-B; retained source adverse/recovery case: Guess a valid record ID outside the assigned caseload; deny access without revealing record content.. Its source label does not by itself establish refusal coverage.
* Error/recovery refinement: Change assignment or role between a permitted read and attempted write/export/tool call. Recheck the current server authority for each operation; no guessed ID may disclose out-of-scope content.
* Authorization refinement: For authorised record user performing “every read, write, search, export and tool call constrained by my effective permissions”: Use a revoked/wrong-tenant or no-longer-assigned identity and a guessed object ID; current server role, tenant, assignment, delegation and purpose must deny the protected read/action before content or side effects.

Bind source/configuration and synthetic fixture version to actual UI/API/state/side-effect/audit outputs; record every failed, skipped and untested case separately. Planned scenarios remain Not run, and local reuse evidence cannot satisfy full formal or live/domain approval.

### Shared gates and remaining decisions

Link [SAHA-READY-1.0 and SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7); apply the engineering/synthetic scope and exact version, alongside this issue’s unchanged source acceptance. Shared checklist completeness cannot approve domain decisions or stand in for observed delivery.

Use the existing Current evidence/readiness and original formal cases for unresolved authority/evidence; this refinement does not mark the canonical item Ready or accepted.

### Proposed per-clause CWO test contracts — original text unchanged

These are recommended synthetic Given/When/measurement expansions, not approved or frozen replacement criteria. The original clause above is the unchanged Then oracle; proposed fixture IDs are not formal catalogue cases and every execution result remains Not run until observed.

**CWO-002-NEG01** — proposed fixture `PROP-CWO-002-NEG01`; actor: authorised record user.
* Given: A previously assigned task is now stale/revoked while another task remains permitted.
* When: Supply the revoked task/person ID directly in the read route and reopen Today.
* Then: retain the exact CWO-002-NEG01 clause above unchanged.
* Measurement: Denied object returns no protected content; the unaffected permitted list remains available and unchanged.
* Prohibited effects: Out-of-scope disclosure, removal of unrelated allowed work, guessed-ID bypass.

**CWO-003-NEG02** — proposed fixture `PROP-CWO-003-NEG02`; actor: authorised record user.
* Given: A synthetic actor sees own open planned work but another member/worker slot or closed covered item is outside the allowed operation.
* When: Submit each out-of-scope/closed object ID directly to the reschedule/action boundary.
* Then: retain the exact CWO-003-NEG02 clause above unchanged.
* Measurement: Server refuses each forbidden operation with no inaccessible content; compare slot/clinical-record snapshots unchanged.
* Prohibited effects: Disclosure, write to another worker's slot, reopening closed covered work by client request.

Use the original owner/native task links and shared Ready/Done versions already recorded here. Bind results to the exact candidate and preserve failed/unobserved evidence; no broad parent acceptance follows from a bounded witness.