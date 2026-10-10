# APL-10 — \[Task D06\] Open or prepare bounded tasks conversationally

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-10](https://linear.app/aplyd-sandbox/issue/APL-10/task-d06-open-or-prepare-bounded-tasks-conversationally)  
Stable UUID: `6984cd43-72e8-497c-b9bd-947968776004`  
Hierarchy kind: `technical_task`  
Native parent: [APL-63](APL-63.md)  
Native blockers: [APL-7](APL-7.md), [APL-6](APL-6.md)  
Recorded native status: **Backlog** at source revision `2026-10-10T12:39:53.662Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `cec5831598193601782bd109b2593a22bd6e94161d89a2ba503f5d15a8574261`  
Source plus v4.2 refinement SHA-256: `a65c551e0bf1c792fc37840c47a68d789e422c29f2c5dc666e122466b4f9cd83`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-040](<https://linear.app/aplyd-sandbox/issue/APL-63/saha-040-bounded-task-planning>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As an ASHA, I want bounded conversational access to existing tasks while retaining a manual path.

## Current planning checkpoint — 10 October 2026

Queued after working delivered D02/D03 paths. Inspect and freeze allowlisted intent/navigation contract, ambiguous identity and stale/injected action refusal, truthful status and manual model-outage behaviour. No provider or clinical advisory activation.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP05. Related canonical scope: SAHA-009, SAHA-040, SAHA-041, SAHA-043, SAHA-044, SAHA-049.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D06 — Open or prepare bounded tasks conversationally

Scope: SAHA-009,040,041,043,044,049. Type: functional. Disposition: investigate/adapt-existing.

Requirement: As an ASHA, express an intent and receive the appropriate controls without learning a capability catalogue or granting an agent broader authority.

Functional specification: begin with show work, find assigned person, reopen task and explain actual status. Return action cards; ask for an explicit choice on ambiguous matches. Preserve current consequential-action confirmation, but do not add approval to navigation. Manual controls remain available. Label a scripted matcher as a reference implementation, not live AI.

Data/API: allowlisted action schema; task-scoped current records; server authority/version checks. No model-generated URL, SQL, credential, arbitrary script or global patient memory. Notes/provider content are untrusted. Provider contract and secure configuration are separate dependencies.

NFR: voice optional; no ambient recording. Changed account/person invalidates proposals. Test prompt injection, unsupported intents, duplicate names, stale actions, privacy and outages. Clinical advisory is outside this small navigation slice.

Acceptance: D06-A1 intent maps to the same permitted visual action; A2 unsupported request produces no improvised mutation; A3 ambiguous names require selection; A4 manual flow works without model. Refusal: N1 content cannot expand tool authority; N2 stale proposal cannot execute. Rejection: R1 fabricated status/clinical advice; R2 new approval for navigation.

Tests/release: follows D02/D03 working path. No provider activated by a specification or simulated demonstration.

## Execution and release authority

GitHub [#179](<https://github.com/nakul175/saha-health/issues/179>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-63 — \[SAHA-040\] Bounded task planning](https://linear.app/aplyd-sandbox/issue/APL-63/saha-040-bounded-task-planning)
* Inputs: Qualified D02/D03 context plus source tool allowlist, synthetic adversarial prompts and explicit AI applicability/evaluation limits.
* Reviewable output: Open or prepare only permitted bounded conversational tasks while preserving the same ordinary visual workflow and action authority.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: APL-7, APL-6. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

Current native blockers are D02/D03; no unapproved tool/provider/clinical policy, patient chatbot or agent self-approval.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.