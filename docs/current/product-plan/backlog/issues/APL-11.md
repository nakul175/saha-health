# APL-11 — \[Task D07\] Identify and recover the synthetic DigitalOcean release

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-11](https://linear.app/aplyd-sandbox/issue/APL-11/task-d07-identify-and-recover-the-synthetic-digitalocean-release)  
Stable UUID: `27b372ee-d91a-4cc4-84aa-2dd60fadae4d`  
Hierarchy kind: `technical_task`  
Native parent: [APL-175](APL-175.md)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T12:39:49.395Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `ab686d992e503dba9ba77d175b19fe86957a22da09e7f5f75e9c9f5bbb5f613c`  
Source plus v4.2 refinement SHA-256: `19f4430d6b37acb04e8a6c3bcd84776c94543363e8375b26eef3da5eac1a1161`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-152](<https://linear.app/aplyd-sandbox/issue/APL-175/saha-152-identify-and-safely-promote-the-synthetic-digitalocean>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As the delivery team, we need verified hosted-source and recovery evidence so a release can be identified and recovered.

## Current planning checkpoint — 10 October 2026

D02 provides exact observed synthetic host SHA7668a03d and actual live smoke, so the old claim 'host not inspected' is superseded. D07 full authorised isolated recovery/RPO/RTO and records/queue preservation still unqualified. No timer/provisioning/live-recovery mutation is authorised by planning; original production-runtime decision SAHA-157 remains separate.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP11. Related canonical scope: SAHA-115, SAHA-141, SAHA-152.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D07 — Identify and recover synthetic DigitalOcean release

Scope: SAHA-115,141,152. Type: enabler. Disposition: investigate/reuse.

Requirement: As an operator, know the exact running source/configuration and recover a failed synthetic release without losing records.

Functional specification: inspect actual status through authorised host access; compare source; rehearse update/recovery only on an authorised isolated target. Inspect updater, migration ledger, service, origin and health checks. Hosting documentation is not observed host state. This task authorises no timer change, main merge or provisioning.

Data/API: retain data/migration history; restore compatibility separately from application rollback; queue recovery preserved. No credentials or dumps in Git.

NFR: declared topology/RPO/RTO and actual measured recovery. Development-runtime hosting is not production acceptance.

Acceptance: D07-A1 exact running source/config/time evidenced; A2 recovery preserves records and outstanding queues; A3 build/start/healthy states separate. Refusal: N1 failed migration cannot be success; N2 unknown remote state is not blindly retried. Rejection: R1 live/main mutation to satisfy documentation; R2 production claim from development runtime.

Tests/release: live host not inspected yet. SAHA-157 remains the separate production-runtime decision. A code revert alone is not data rollback.

## Execution and release authority

GitHub [#180](<https://github.com/nakul175/saha-health/issues/180>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-175 — \[SAHA-152\] Identify and safely promote the synthetic DigitalOcean release](https://linear.app/aplyd-sandbox/issue/APL-175/saha-152-identify-and-safely-promote-the-synthetic-digitalocean)
* Inputs: Exact existing DigitalOcean served identity, release manifest and compatible schema/queue/recovery contract.
* Reviewable output: Identify served synthetic release/build and verify compatible promotion/recovery with separately observed evidence.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: none recorded. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

Deployment identity is separate from complete rollout/recovery and production-runtime approval; no new hosting or paid plan.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.