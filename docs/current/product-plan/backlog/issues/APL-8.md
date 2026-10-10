# APL-8 — \[Task D04\] Retain routine work through offline interruption

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-8](https://linear.app/aplyd-sandbox/issue/APL-8/task-d04-retain-routine-work-through-offline-interruption)  
Stable UUID: `97b6a5ad-d077-4b8c-b510-aa32e06d2f48`  
Hierarchy kind: `technical_task`  
Native parent: [APL-115](APL-115.md)  
Native blockers: [APL-7](APL-7.md)  
Recorded native status: **Backlog** at source revision `2026-10-10T12:40:02.104Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `bb36fc45c8471a825e553389a253782cc9e5e412e105443236a2c73e4b00dfc1`  
Source plus v4.2 refinement SHA-256: `50396fe8e58d7ac6969986c858c7b1f7ff7070524d0a7c1bfce89324bf936841`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-092](<https://linear.app/aplyd-sandbox/issue/APL-115/saha-092-durable-acknowledged-local-saves>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As an ASHA, I want permitted prepared routine work retained offline through restart so connectivity loss does not erase my work.

## Current planning checkpoint — 10 October 2026

Queued; D03 full delivery prerequisite. PR <pull-request id="01204c5d-9925-4e99-badb-da924dbf005f" href="https://linear.app/aplyd-sandbox/review/feat-retain-prepared-worker-visits-through-offline-restart-and-safe-599da12a5393">nakul175/saha-health#187</pull-request> is historical separately inspected evidence, preserved/unmerged. Freeze current prepared routine contract and tests; actual encrypted restart/account-isolation/fault/device evidence and DEC-03 production duration/key recovery remain prerequisites. No reuse of old test pass as current qualification.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP08. Related canonical scope: SAHA-007, SAHA-091, SAHA-092, SAHA-093, SAHA-097.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D04 — Continue offline and resume interrupted work

Scope: SAHA-007,091,092,093,097. Type: functional/resilience. Disposition: adapt-and-verify.

Requirement: As a previously authorised ASHA, complete permitted routine capture without internet and recover acknowledged work after interruption/restart.

Functional specification: prepare a scoped encrypted caseload and workflow; acknowledge only durable writes; recover current task/step; show local versus pending state; remote tools unavailable honestly. Preserve protections while removing fragmented notebook navigation. Expired authority locks protected access under the declared policy without inventing daily supervisor approval. DEC-03 duration/key recovery remains unresolved.

Data/API: reuse current field vault, packet/grant, revisioned writes and device reconciliation. Journal must retain actor/task/schema/pack identities. No plaintext alternative or automatically discarded unsent work. Data loss from device destruction or deliberate storage clearing is not falsely covered.

NFR: real persistence fault injection, crash/reload/quota/crypto failure and account isolation on declared browser/device. No simulated flag is restart proof.

Acceptance: D04-A1 valid prepared routine fixture finishes locally without remote/model calls; A2 every acknowledged field survives tested restart; A3 failed save is clearly unsaved; A4 second user cannot read cache. Refusal: N1 quota/crypto failure prevents saved acknowledgement; N2 invalid grant cannot expand authority. Rejection: R1 raw localStorage patient data; R2 silent eviction or new mandatory worker approval.

Tests/release: actual vault and handset evidence required. D03 record contract is prerequisite; unresolved production authority policy does not block an explicitly synthetic demonstration.

## Execution and release authority

GitHub [#177](<https://github.com/nakul175/saha-health/issues/177>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-115 — \[SAHA-092\] Durable acknowledged local saves](https://linear.app/aplyd-sandbox/issue/APL-115/saha-092-durable-acknowledged-local-saves)
* Inputs: Qualified D03 exact outcome, frozen D04 contract and synthetic restart/low-storage/offline fixtures.
* Reviewable output: Retain routine captured work under supported offline interruption with actual local durability and disclosed authority/storage limits.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: APL-7. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

Blocked by D03 until its full gate; do not import old offline PR wholesale or claim viewport evidence proves physical-device persistence.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.