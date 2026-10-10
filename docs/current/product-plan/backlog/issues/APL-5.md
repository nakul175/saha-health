# APL-5 — \[Task D01\] Reproduce the current application baseline

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-5](https://linear.app/aplyd-sandbox/issue/APL-5/task-d01-reproduce-the-current-application-baseline)  
Stable UUID: `ecb234f8-07df-4f45-bc4d-1550ab7be51f`  
Hierarchy kind: `technical_task`  
Native parent: [APL-174](APL-174.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T12:40:15.932Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `bbbc6f923d2463fb0eb5bc22c97ca06b7d8c9ff97a870be5d45ee18d85fc3ec6`  
Source plus v4.2 refinement SHA-256: `9fc3035f24d53c16082e7cf807671516a47a641915ec8a7b6fc6dd3d0198ff45`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-151](<https://linear.app/aplyd-sandbox/issue/APL-174/saha-151-establish-a-reproducible-reuse-baseline>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As the delivery team, we need a reproducible current baseline so inherited failures are distinguished from new regressions.

## Current planning checkpoint — 10 October 2026

Scoped original-baseline evidence exists on named 43f445a source, but D01 remains open with broader known defects #185/#186 and remaining qualification boundaries. A bounded baseline witness is not all-green product acceptance.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP11. Related canonical scope: SAHA-151.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D01 — Reproduce current application baseline

Scope: SAHA-151. Type: enabler. Disposition: retain-and-verify.

Requirement: As a developer, establish the original source/runtime/test state so new regressions are distinguishable from inherited failures.

Functional specification: read current repository rules; pin main; install pinned dependencies; execute existing documentation, catalogue, lint, types, build, security, unit and affected HTTP/recovery checks. Report each exit and skipped/blocked command. Do not alter assertions or quarantine failures. Current CLAUDE.md supersedes the older pre-merge handover.

Data/API: no schema or application mutation. Isolated synthetic fixtures only. Record source/config/test hashes, versions and evidence outside Git; no credentials or raw patient data.

NFR: reproducible commands and environment; no production resources. Native checkout currently failed on GitHub DNS. A read-only GitHub-runner baseline is configured in the dedicated workflow; queued/running is not passed.

Acceptance: D01-A1 exact source/runtime recorded; A2 each required command has observed outcome; A3 inherited, candidate and environment failures distinguished. Refusal: D01-N1 missing dependency is blocked, never green; N2 failed assertions are preserved. Rejection: D01-R1 historical counts used as fresh evidence; R2 deployment/provider activation as part of verification.

Tests/release: original documented tools. A baseline pass is engineering-only; no merge or host change. The original full browser regression selection and physical devices remain separate.

## Execution and release authority

GitHub [#174](<https://github.com/nakul175/saha-health/issues/174>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-174 — \[SAHA-151\] Establish a reproducible reuse baseline](https://linear.app/aplyd-sandbox/issue/APL-174/saha-151-establish-a-reproducible-reuse-baseline)
* Inputs: Baseline commands, pinned rules/dependencies and isolated fixtures; no code/schema/hosting mutation.
* Reviewable output: Compare exact baseline source/runtime/check outputs with the current candidate and retain each inherited versus candidate versus environment failure.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: none recorded. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

An incomplete dependency or historical count cannot yield a clean baseline; retain original failed assertions and actual command exits.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.