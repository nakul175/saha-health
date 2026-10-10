# APL-12 — \[Task D08\] Qualify compact-phone usability and persistence

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-12](https://linear.app/aplyd-sandbox/issue/APL-12/task-d08-qualify-compact-phone-usability-and-persistence)  
Stable UUID: `1981ebaa-58db-4ca4-9c94-f0fe5a12563b`  
Hierarchy kind: `technical_task`  
Native parent: [APL-162](APL-162.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T12:39:45.464Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `4d30dd7d309d86184859b34e5d046d357cb2be909473373527fcbb79921dfd2c`  
Source plus v4.2 refinement SHA-256: `b1f0c5e571d71893cf03a75516e990d8eb1c881b7887275846cea065f3d53769`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-139](<https://linear.app/aplyd-sandbox/issue/APL-162/saha-139-responsive-field-interface>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As an ASHA, I want a usable compact-phone experience whose persistence and interactions have been tested.

## Current planning checkpoint — 10 October 2026

D02 has actual declared browser viewport/scaling/focus evidence; D03 has local real browser evidence, still unqualified. Full D08 chosen D02–D05 journey requires declared actual device/keyboard/memory/battery/persistence and ASHA evidence separately; no screenshot/viewport-only acceptance. All relevant original targets remain.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP11. Related canonical scope: SAHA-139, SAHA-144, SAHA-145, SAHA-153.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D08 — Qualify the compact-phone journey

Scope: SAHA-139,144,145,153. Type: non-functional. Disposition: verify.

Requirement: As an ASHA, use the selected journey without hidden controls, unreadable text or a keyboard trapping the task.

Functional specification: declare device/browser/language; test 360x640 and taller viewport, long names, 200% text, focus/back navigation and clear errors. Actual keyboards, memory, battery and persistence need physical-device evidence. ASHA formative research follows the demo.

Data/API: no additional patient data or analytics needed. Synthetic fixtures only. Retain redacted evidence with hashes outside Git.

NFR: original 500 ms local-save p95 remains; separate local/server timing. Proposed 44 CSS-pixel targets are this presentation goal, not full accessibility compliance. Do not change profiles/targets after failures.

Acceptance: D08-A1 essential controls reachable without horizontal page scrolling; A2 keyboard/focus/non-colour cues work; A3 simulated viewport, actual keyboard, device and ASHA evidence reported separately. Refusal: N1 clipped control fails even if backend works; N2 simulated storage is not durable-device evidence. Rejection: R1 screenshot equated to accessibility acceptance; R2 post-hoc target change.

Tests/release: qualify the available D02-D05 slices; leave untested properties pending. Original formal evaluation proposal is preserved separately from formative testing.

## Execution and release authority

GitHub [#181](<https://github.com/nakul175/saha-health/issues/181>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-162 — \[SAHA-139\] Responsive field interface](https://linear.app/aplyd-sandbox/issue/APL-162/saha-139-responsive-field-interface)
* Inputs: Current bounded journey, source WCAG/usability/latency targets and approved synthetic reference-device/field test protocol.
* Reviewable output: Qualify compact-phone usability and persistence under the declared device/protocol with actual evidence and clear physical-device limits.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: none recorded. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

Viewport checks cannot prove physical battery/memory/durability; SAHA-153 acceptance remains proposed and source-gated.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.