# APL-9 — \[Task D05\] Reconnect without duplication or false completion

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-9](https://linear.app/aplyd-sandbox/issue/APL-9/task-d05-reconnect-without-duplication-or-false-completion)  
Stable UUID: `7127b7ef-f559-4a07-b6e9-8993beb621b9`  
Hierarchy kind: `technical_task`  
Native parent: [APL-118](APL-118.md)  
Native blockers: [APL-8](APL-8.md)  
Recorded native status: **Backlog** at source revision `2026-10-10T12:39:57.787Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `b4b98eeff28d8978b18004c679912dc25c5be0c2d457e5bca14e5fa8010aacd6`  
Source plus v4.2 refinement SHA-256: `2c5e721cc177684e6e85d45f4eeefbe9a226ddb2b143dff871097cf6c45600f8`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Tracking role

This is an implementation and qualification task under [SAHA-095](<https://linear.app/aplyd-sandbox/issue/APL-118/saha-095-ordered-synchronisation-and-measured-queue-recovery>), included in the common task total and not an additional product story. All related product items remain linked below. Passing this task qualifies only its frozen scope; parent and cross-cutting acceptance remain separate.

## User story and bounded outcome

## User story

As an ASHA, I want saved work reconciled safely when connectivity returns so retries do not duplicate or falsely complete it.

## Current planning checkpoint — 10 October 2026

Queued after D04 full delivery. Historical PR <pull-request id="01204c5d-9925-4e99-badb-da924dbf005f" href="https://linear.app/aplyd-sandbox/review/feat-retain-prepared-worker-visits-through-offline-restart-and-safe-599da12a5393">nakul175/saha-health#187</pull-request> one-visit lost-ack witness is preserved, not current full qualification. Revalidate current stable key/payload/authority/dependent-record sequence and actual built-backend replay; external owner acceptance separate.

## Hierarchy and authoritative source

This existing bounded delivery slice links to canonical scope owners, preserving the full product hierarchy. It is not an additional scope item. Primary epic: WP08. Related canonical scope: SAHA-006, SAHA-075, SAHA-076, SAHA-095, SAHA-096.
[Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>) · [Delivery gates](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Historical snapshot](<https://linear.app/aplyd-sandbox/document/saha-historical-delivery-migration-snapshots-b13990f995b0>)

## Retained source specification — edition 1

The following is preserved source planning from PR <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">nakul175/saha-health#173</pull-request>/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1. It is not fresh execution evidence; the current checkpoint above supersedes dated hosting/implementation observations. A current inspected frozen contract is required before execution.

## D05 — Reconnect without duplicates or false completion

Scope: SAHA-006,075,076,095,096. Type: integration/resilience. Disposition: retain-and-extend.

Requirement: As an ASHA, synchronise after local work without re-entry, duplication or a misleading completion tick.

Functional specification: send eligible dependent records in order; revalidate assignment/authority/linkage/freshness/version; reconcile uncertain outcomes using stable identities; show server and each destination independently. No rollback of a successful external transaction to simulate atomicity.

Data/API: retain command receipts, immutable key/payload binding, device references and source-to-server identity mapping. Subsequent corrections use amendment semantics. A changed payload cannot reuse a consumed operation key.

NFR: repeated connection loss and dropped acknowledgement; preserve prior targets and count failed/unresolved records, not only successful averages. No sensitive general telemetry.

Acceptance: D05-A1 replay does not duplicate supported logical actions; A2 local/server/destination states distinct; A3 dependent person/visit sequence has no orphans; A4 changed authority stops incompatible disclosure. Refusal: N1 timeout preserves identity and looks up before resend; N2 same key/different content refused. Rejection: R1 HTTP success treated as business acceptance; R2 deleted history to clear queues.

Tests/release: current receipt/HTTP/DB fixtures and explicit dropped-acknowledgement scenario on built backend, after D04. External owner acceptance remains an independent dependency.

## Execution and release authority

GitHub [#178](<https://github.com/nakul175/saha-health/issues/178>) maps one-to-one to this existing delivery slice. [#188](<https://github.com/nakul175/saha-health/issues/188>) owns execution; planning reconciliation must preserve these source IDs, parent links, frozen criteria, checklists and hold. Five coding schedules remain disabled. Current demonstrations are synthetic; no provider/paid service/new hosting/destructive migration or clinical policy. Implemented, tested, accepted, merged and observed deployed remain separate.

## v4.2 planning refinement — source preserved

Author planning recommendation; the retained outcome and source acceptance remain unchanged. Do not weaken criteria to obtain a pass.

### Bounded handoff

* Parent contract: [APL-118 — \[SAHA-095\] Ordered synchronisation and measured queue recovery](https://linear.app/aplyd-sandbox/issue/APL-118/saha-095-ordered-synchronisation-and-measured-queue-recovery)
* Inputs: Qualified D04 outcome, source receipt/version/queue ordering and actual synthetic timeout/replay fixtures.
* Reviewable output: Reconnect and reconcile dependent pending work without duplicate acceptance, wrong authority, orphan records or false completion.
* Boundary: finish only this named outcome; no whole-parent or production qualification follows.

Native blockers: APL-8. Source package inspection inputs: none recorded. Recommended remaining-work forecast: 2–6 engineering effort days, low confidence, conditional on verified reuse and a frozen bounded contract. Interface/device/source-gap tasks use the wider range; excludes external approval/observation wait and is not additional to the parent forecast.

### Verification and evidence

Blocked by D04; preserve accepted receipts and unresolved rejections separately, with no blind retry after an unverifiable external outcome.

Retain actual named check exits, source/config/fixture versions, before/after state, side effects, receipts/audit and unresolved limits for the exact parent contract. No planned test, historical source status or local narrow witness is a formal acceptance pass.

### Shared gates and delivery constraints

Apply [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) at the pinned engineering/synthetic scope in addition to the exact parent acceptance. No broad dispatch: inspect source/current candidate first; dependency references do not require completing entire epics. Native status, parent, priority, milestone, assignee and estimate stay unchanged.