# First milestone: delivery specifications

Specification edition 1, 9 October 2026. Source baseline `43f445acf4c54352cd2084e0bcd88bfbf605d757`. D01-D08 are slices of the 160 scope items, not additional scope items. None is accepted by this document. UI/capture specifications are bounded to synthetic existing records; no clinical protocol is invented.

## Shared definition of ready and done

Ready: a bounded outcome, inspected reuse candidate, declared data/API delta, relevant original acceptance cases identified, explicit quality targets and no unresolved safety-critical design assumption in the selected slice. A missing institutional rule remains a dependency, not a rule invented by engineering.

Done for a delivery slice: implemented on a branch; affected existing checks and new positive/refusal/recovery cases executed on the named source/configuration; evidence and limits recorded; reviewed diff; release permission recorded separately. Scope-level, clinical, government, phone and ASHA acceptance do not automatically follow. No story may waive parent requirements by testing a narrower fixture.

Data/security checks accompany the slice. Shared constraints and historical criteria remain in their authoritative registers, not copied or weakened. Preserve confirmed data, applied migrations, command identities and evidence. Full test-catalogue remapping is not yet done; select and link applicable cases before acceptance.

## D01 — Reproduce current application baseline

Scope: SAHA-151. Type: enabler. Disposition: retain-and-verify.

Requirement: As a developer, establish the original source/runtime/test state so new regressions are distinguishable from inherited failures.

Functional specification: read current repository rules; pin main; install pinned dependencies; execute existing documentation, catalogue, lint, types, build, security, unit and affected HTTP/recovery checks. Report each exit and skipped/blocked command. Do not alter assertions or quarantine failures. Current CLAUDE.md supersedes the older pre-merge handover.

Data/API: no schema or application mutation. Isolated synthetic fixtures only. Record source/config/test hashes, versions and evidence outside Git; no credentials or raw patient data.

NFR: reproducible commands and environment; no production resources. Native checkout currently failed on GitHub DNS. A read-only GitHub-runner baseline is configured in the dedicated workflow; queued/running is not passed.

Acceptance: D01-A1 exact source/runtime recorded; A2 each required command has observed outcome; A3 inherited, candidate and environment failures distinguished. Refusal: D01-N1 missing dependency is blocked, never green; N2 failed assertions are preserved. Rejection: D01-R1 historical counts used as fresh evidence; R2 deployment/provider activation as part of verification.

Tests/release: original documented tools. A baseline pass is engineering-only; no merge or host change. The original full browser regression selection and physical devices remain separate.

## D02 — Open assigned work from mobile Today

Scope: SAHA-001,002,007,011,102. Type: functional. Disposition: adapt-existing.

Requirement: As an ASHA, reach an existing assigned person's visit through a short mobile work list without selecting a programme/vendor app.

Functional specification: opt-in same-origin Today entry; short briefing, one next-record action and remaining list. Reuse the existing scoped workspace and its source order; do not invent tasks or clinical priority. Stable Today, People and My Space controls are proposed. Distinguish loading, empty, unavailable, refused and offline-unprepared states. Choose a person explicitly; navigate to the existing protected /app patient/visit path. The existing guided capture is reused, not newly claimed as a redesigned full visit. No mutation occurs on opening Today.

Data/API: GET /api/workspace with same-origin credentials and no-store. Restrict this entry to active ASHA synthetic/training context, assigned records and the unpaged response it can actually represent; otherwise return a clear existing-workspace path. IDs are URL-encoded and destinations are fixed same-origin routes. No new table, commands or raw personal data in persistent browser storage. Destination server rechecks scope; client filtering is not authorisation. An existing draft is resolved by the existing application rather than created from this page.

NFR: compact 360x640 and taller phone fixtures, readable scaling, focus, accessible labels and no horizontal page overflow. Proposed touch target 44 CSS px. No network/model dependence is claimed for this initial entry: D04 supplies qualified offline capability. Data clears on refused/failed refresh; do not show a stale successful state.

Acceptance: D02-A1 only permitted assigned source records appear; A2 selecting a person uses the existing journey without a new draft mutation; A3 error is not an empty caseload; A4 equal names remain distinct contextual choices; A5 compact-screen and keyboard checks pass. Refusal: N1 401/403 clears private content; N2 invalid/malformed workspace cannot enable actions; N3 arbitrary IDs cannot navigate off-origin. Rejection: R1 client-granted access or fabricated clinical ordering; R2 module catalogue masked by chat; R3 claiming this is the complete offline/conversational OS.

Tests/release: read-only mock-transport browser tests qualify the new entry only. Existing backend/context/save tests must run before accepting its full journey. Feature candidate is opt-in; no change to default /app or live deployment.

## D03 — Review and save a bounded routine visit

Scope: SAHA-004,006,020,021,024,049. Type: functional. Disposition: adapt-existing.

Requirement: As an ASHA, review/correct captured facts and save routine work without duplicated shared questions or a required AI answer.

Functional specification: retain active person/visit; reuse guided capture/review controls. Distinguish current, reused, missing and uncertain values. Use one compatible synthetic programme fixture; similar field labels alone are not semantic equivalence. Reuse existing confirmation where required, not a new approval. Keep input on failure and state whether a server draft, confirmed encounter or destination result was actually saved.

Data/API: verify current startVisit/saveVisit/confirmVisit schemas before modification. Use existing audited /api/commands with organisation context, version and stable idempotency key. Preserve source/time/unit, author and pack version. No direct database writes or parallel patient store. Read the resulting record back. No schema migration is presumed necessary.

NFR: manual capture survives model outage; no fabricated missing values; permission/version/audit boundaries preserved. Original local-save p95 500 ms remains unwaived; connected-server and local-save measurements are distinct.

Acceptance: D03-A1 compatible shared fact captured once with distinct questions retained; A2 corrected record read back with provenance/version; A3 UI reflects actual save state; A4 AI outage does not block manual capture. Refusal: N1 ambiguous values remain unresolved; N2 stale/wrong-person request changes no authoritative data; N3 failure retains input. Rejection: R1 derived value shown as directly measured; R2 hidden failure or new supervisor/reporting obligation.

Tests/release: existing capture/command/DB checks plus a browser-to-built-backend case. D02 can reuse the old editor before redesign. No clinical/full-visit acceptance follows from an entry-page mock.

## D04 — Continue offline and resume interrupted work

Scope: SAHA-007,091,092,093,097. Type: functional/resilience. Disposition: adapt-and-verify.

Requirement: As a previously authorised ASHA, complete permitted routine capture without internet and recover acknowledged work after interruption/restart.

Functional specification: prepare a scoped encrypted caseload and workflow; acknowledge only durable writes; recover current task/step; show local versus pending state; remote tools unavailable honestly. Preserve protections while removing fragmented notebook navigation. Expired authority locks protected access under the declared policy without inventing daily supervisor approval. DEC-03 duration/key recovery remains unresolved.

Data/API: reuse current field vault, packet/grant, revisioned writes and device reconciliation. Journal must retain actor/task/schema/pack identities. No plaintext alternative or automatically discarded unsent work. Data loss from device destruction or deliberate storage clearing is not falsely covered.

NFR: real persistence fault injection, crash/reload/quota/crypto failure and account isolation on declared browser/device. No simulated flag is restart proof.

Acceptance: D04-A1 valid prepared routine fixture finishes locally without remote/model calls; A2 every acknowledged field survives tested restart; A3 failed save is clearly unsaved; A4 second user cannot read cache. Refusal: N1 quota/crypto failure prevents saved acknowledgement; N2 invalid grant cannot expand authority. Rejection: R1 raw localStorage patient data; R2 silent eviction or new mandatory worker approval.

Tests/release: actual vault and handset evidence required. D03 record contract is prerequisite; unresolved production authority policy does not block an explicitly synthetic demonstration.

## D05 — Reconnect without duplicates or false completion

Scope: SAHA-006,075,076,095,096. Type: integration/resilience. Disposition: retain-and-extend.

Requirement: As an ASHA, synchronise after local work without re-entry, duplication or a misleading completion tick.

Functional specification: send eligible dependent records in order; revalidate assignment/authority/linkage/freshness/version; reconcile uncertain outcomes using stable identities; show server and each destination independently. No rollback of a successful external transaction to simulate atomicity.

Data/API: retain command receipts, immutable key/payload binding, device references and source-to-server identity mapping. Subsequent corrections use amendment semantics. A changed payload cannot reuse a consumed operation key.

NFR: repeated connection loss and dropped acknowledgement; preserve prior targets and count failed/unresolved records, not only successful averages. No sensitive general telemetry.

Acceptance: D05-A1 replay does not duplicate supported logical actions; A2 local/server/destination states distinct; A3 dependent person/visit sequence has no orphans; A4 changed authority stops incompatible disclosure. Refusal: N1 timeout preserves identity and looks up before resend; N2 same key/different content refused. Rejection: R1 HTTP success treated as business acceptance; R2 deleted history to clear queues.

Tests/release: current receipt/HTTP/DB fixtures and explicit dropped-acknowledgement scenario on built backend, after D04. External owner acceptance remains an independent dependency.

## D06 — Open or prepare bounded tasks conversationally

Scope: SAHA-009,040,041,043,044,049. Type: functional. Disposition: investigate/adapt-existing.

Requirement: As an ASHA, express an intent and receive the appropriate controls without learning a capability catalogue or granting an agent broader authority.

Functional specification: begin with show work, find assigned person, reopen task and explain actual status. Return action cards; ask for an explicit choice on ambiguous matches. Preserve current consequential-action confirmation, but do not add approval to navigation. Manual controls remain available. Label a scripted matcher as a reference implementation, not live AI.

Data/API: allowlisted action schema; task-scoped current records; server authority/version checks. No model-generated URL, SQL, credential, arbitrary script or global patient memory. Notes/provider content are untrusted. Provider contract and secure configuration are separate dependencies.

NFR: voice optional; no ambient recording. Changed account/person invalidates proposals. Test prompt injection, unsupported intents, duplicate names, stale actions, privacy and outages. Clinical advisory is outside this small navigation slice.

Acceptance: D06-A1 intent maps to the same permitted visual action; A2 unsupported request produces no improvised mutation; A3 ambiguous names require selection; A4 manual flow works without model. Refusal: N1 content cannot expand tool authority; N2 stale proposal cannot execute. Rejection: R1 fabricated status/clinical advice; R2 new approval for navigation.

Tests/release: follows D02/D03 working path. No provider activated by a specification or simulated demonstration.

## D07 — Identify and recover synthetic DigitalOcean release

Scope: SAHA-115,141,152. Type: enabler. Disposition: investigate/reuse.

Requirement: As an operator, know the exact running source/configuration and recover a failed synthetic release without losing records.

Functional specification: inspect actual status through authorised host access; compare source; rehearse update/recovery only on an authorised isolated target. Inspect updater, migration ledger, service, origin and health checks. Hosting documentation is not observed host state. This task authorises no timer change, main merge or provisioning.

Data/API: retain data/migration history; restore compatibility separately from application rollback; queue recovery preserved. No credentials or dumps in Git.

NFR: declared topology/RPO/RTO and actual measured recovery. Development-runtime hosting is not production acceptance.

Acceptance: D07-A1 exact running source/config/time evidenced; A2 recovery preserves records and outstanding queues; A3 build/start/healthy states separate. Refusal: N1 failed migration cannot be success; N2 unknown remote state is not blindly retried. Rejection: R1 live/main mutation to satisfy documentation; R2 production claim from development runtime.

Tests/release: live host not inspected yet. SAHA-157 remains the separate production-runtime decision. A code revert alone is not data rollback.

## D08 — Qualify the compact-phone journey

Scope: SAHA-139,144,145,153. Type: non-functional. Disposition: verify.

Requirement: As an ASHA, use the selected journey without hidden controls, unreadable text or a keyboard trapping the task.

Functional specification: declare device/browser/language; test 360x640 and taller viewport, long names, 200% text, focus/back navigation and clear errors. Actual keyboards, memory, battery and persistence need physical-device evidence. ASHA formative research follows the demo.

Data/API: no additional patient data or analytics needed. Synthetic fixtures only. Retain redacted evidence with hashes outside Git.

NFR: original 500 ms local-save p95 remains; separate local/server timing. Proposed 44 CSS-pixel targets are this presentation goal, not full accessibility compliance. Do not change profiles/targets after failures.

Acceptance: D08-A1 essential controls reachable without horizontal page scrolling; A2 keyboard/focus/non-colour cues work; A3 simulated viewport, actual keyboard, device and ASHA evidence reported separately. Refusal: N1 clipped control fails even if backend works; N2 simulated storage is not durable-device evidence. Rejection: R1 screenshot equated to accessibility acceptance; R2 post-hoc target change.

Tests/release: qualify the available D02-D05 slices; leave untested properties pending. Original formal evaluation proposal is preserved separately from formative testing.
