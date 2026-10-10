# Historical delivery migration snapshots

Archived planning content captured before the full-hierarchy update on 10 October 2026. This record preserves previous candidate evidence and failures; it is not the current implementation instruction. Current source/spec/evidence and delivery checkpoint supersede old PR <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">nakul175/saha-health#184</pull-request>/#187 presentation claims. Those PRs remain preserved and unmerged.

## <issue id="ecb234f8-07df-4f45-bc4d-1550ab7be51f" href="https://linear.app/aplyd-sandbox/issue/APL-5/d01-reproduce-the-current-application-baseline">APL-5</issue> — \[D01\] Reproduce the current application baseline

## User story

As the delivery team, we need a reproducible current baseline so inherited failures are distinguished from new regressions.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope owner: SAHA-151. Specification: docs/current/community-worker-os/DELIVERY.md, D01, proposed in <pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>.

Outcome: distinguish inherited product failures, environment failures and new regressions on exact source 43f445a. Reuse existing checks/minima; no weakening or quarantine.

## Observed baseline — 9 October 2026

Run [https://github.com/nakul175/saha-health/actions/runs/37920175452](<https://github.com/nakul175/saha-health/actions/runs/37920175452>) completed SUCCESS against original source 43f445acf4c54352cd2084e0bcd88bfbf605d757 on Node v24.21.0.

* Documentation/requirement integrity, test catalogue, pinned dependency installation, lint ratchet, typecheck, build and existing security gate: passed.
* Existing unit selection: 201 suites, 10,696 reported checks, zero failed/skipped; guard preserved.
* Existing current HTTP selection: 5,020 reported checks passed.
* Recovery drill: 21 reported checks passed.
* Result artifact: community-worker-baseline-results, artifact 11612397487. Its summaries and logs were retrieved and inspected; numbers above are scoped reported assertions, not distinct product requirements or formal acceptance cases.

Native checkout initially failed on DNS; the authenticated source artifact supplied a complete inspected checkout. This environment failure is not a product failure.

## Broader regression run — not all green

The existing engineering workflow on the planning-only PR ran the unchanged application source: run 37920175529, regressions job 113785953095. Of 147 selected suites, 145 passed and two failed:

* #185: integration/composite-measures-http, independent viewer safe-output assertion.
* #186: integration/reminder-optout-http, runtime restart returned 503 where the permission test expected 403.

These are observed pre-existing failures, with root causes not yet established. No assertion/minimum was lowered and no suite quarantined. This qualifies the baseline with known failures; it is not an all-green product claim.

## Remaining boundaries

Candidate before/after comparison continues in <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">feat: connect mobile Today to the existing visit workflow</pull-request>; the earlier read-only entry candidates are superseded by the integrated worker-day slice. Original 364-case formal catalogue, physical devices, ASHA usability, clinical/partner acceptance and live-host qualification remain pending. No main merge, deployment, real data or provider activation occurred. Keep open pending review of scoped evidence; no automatic acceptance from a green run.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="adfe4945-bb19-47a6-a87d-a2f8c80962fe" href="https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today">APL-6</issue> — \[D02\] Open assigned work from mobile Today

## User story

As an ASHA, I want to open my assigned work on a mobile Today screen so I can find the correct person.

## Migration checkpoint

Current controller #188 supersedes historical issue-body status: D02 is delivered on merged/observed hosted SHA 7668a03d97c1ae62174f09e65ccd5a5717120be6 with 10/10 scoped delivery gates. This is a bounded synthetic delivery, not formal/clinical/ASHA/physical-phone acceptance.

## Canonical source and acceptance evidence

Scope: SAHA-001,002,007,011,102. Canonical specification: docs/current/community-worker-os/DELIVERY.md D02 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>). This is a delivery slice, not an extra item in the 160-item scope.

The selected implementation is now integrated within the existing protected app in <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">feat: connect mobile Today to the existing visit workflow</pull-request>: `/app?experience=worker-day`, active synthetic/training ASHA only. Today, People and My Space reuse the current assigned records, record-open audit, guided capture and save. No new patient database, task priority, approval or vendor catalogue. Default app remains unchanged. The separate read-only prototype #182 is closed and superseded.

## Observed verification — 9 October 2026

Exact source 28164a77b45db9c4a2e4c8084354bf56e75813e3 passed run 37924839450. Downloaded artifact 11613462948 contains actual outcomes: 16 pure presentation checks, 18 real-browser/local Worker-D1 journey checks, existing 5,020 HTTP/D1 and 21 recovery checks, zero failed/skipped in these selections. Static/build and existing security policy checks passed. The browser test reaches the actual saved draft and reads it back; this is not merely mocked transport.

The following commit edbda10 only updates generated coverage and removes the temporary authoring workflow; runtime/tests are unchanged. Fresh head runs report action_required and a rerun returned 403. Keep that distinct from the observed earlier-code pass. Coverage reconciliation separately passed in run 37924839408. Full broader regressions have inherited failures #185 and #186.

Earlier failed candidate and original assertion history remain preserved. No production, physical-device, ASHA, clinical or government acceptance is inferred. English/draft Hindi and the bounded current-work list do not close all parent UX/scheduling requirements.

Implementation: committed. Named engineering selection: verified on stated code. Latest-head CI/review: outstanding. Release: not approved. Parent acceptance: pending. Do not close or merge automatically. Dependencies and baseline: #174. Next connected slices: #176–#178.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="6d0fbb18-ad15-4dbc-9433-ec3b7ea1b8e5" href="https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit">APL-7</issue> — \[D03\] Review and save a bounded routine visit

## User story

As an ASHA, I want to review, correct and save a bounded routine visit so the recorded information reflects the visit.

## Migration checkpoint

Current controller #188: D03 is actively implementing on story/d03-routine-visit-20261010; scoped checks are ongoing. Not fully qualified or released. No second dispatch.

## Canonical source and acceptance evidence

Scope: SAHA-004,006,020,021,024,049. Specification: docs/current/community-worker-os/DELIVERY.md D03 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Reuse the existing guided capture and audited command path. Keep active person, source/time/unit and pack version. Review/correct a bounded synthetic visit, save it and read back the actual record. No new approval or parallel patient database; no external-acceptance claim from local/server save.

Required full evidence: current command schemas, affected tests, built-backend save/readback, mobile browser journey, compatible multi-programme/shared-field fixture, wrong-person/stale-version/invalid-value recovery and actual applicable NFR qualification. The original 500 ms local-save target remains unwaived.

## Bounded save witness observed — 9 October 2026

PR <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">feat: connect mobile Today to the existing visit workflow</pull-request> source 28164a77b45db9c4a2e4c8084354bf56e75813e3 passed workflow 37924839450; downloaded artifact 11613462948. Its 18-check real Chromium/local synthetic Worker-D1 journey enters weight 57.5 through the existing editor, preserves input through the existing dirty-navigation guard, saves an unconfirmed draft, reads back the same value/state, and reopens without creating another draft. Existing person-context confirmation remains. This is actual backend persistence, not the earlier scripted prototype.

That is a bounded engineering witness, NOT full D03 acceptance: complete shared-fact composition, all negative cases, performance, offline restart, clinical/ASHA and government acceptance remain open. The old failed candidate is retained. Latest head edbda10 changes only generated coverage and removes an authoring workflow; fresh head CI returned action_required/403 on rerun. No automatic acceptance or merge.

Implementation: existing save path reused. Verification: bounded online path passed on stated code; broader story pending. Dependencies #174/#175. Offline and reconciliation follow in #177/#178. Release is not approved; keep open.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## Current reconciliation checkpoint — 10 October 2026, 14:03 IST

[Delivery control #188](<https://github.com/nakul175/saha-health/issues/188>) reports a newer sequential author-test checkpoint at 08:29:32 UTC: D03 backend/browser selection 50 passed/0 failed, unchanged D02 regression 58 passed/0 failed. A1–A8 author evidence is reported present; A9 final checks, separate review and CI remain pending; A10 hosted gate remains pending. Full units were running at the source checkpoint.

The controller reports encrypted vault p95 below the unchanged 500 ms target on 100 full three-pack transactions; this is a reported author measurement, not independently requalified here. Candidate changes are not yet published/pinned to a commit in the controller, so these new results cannot be promoted to exact-source qualification or Done. No new PR, merge or D03 hosted deployment is established. D03 remains In Progress; D04 remains queued.

Historical candidate evidence and frozen criteria above are preserved. Original baseline dependency #174 remains applicable alongside delivered #175. Full unattended coding handoff, ownership and failure/resume qualification remain unresolved in setup #190.

## <issue id="97b6a5ad-d077-4b8c-b510-aa32e06d2f48" href="https://linear.app/aplyd-sandbox/issue/APL-8/d04-retain-routine-work-through-offline-interruption">APL-8</issue> — \[D04\] Retain routine work through offline interruption

## User story

As an ASHA, I want permitted prepared routine work retained offline through restart so connectivity loss does not erase my work.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope: SAHA-007,091,092,093,097. Specification: docs/current/community-worker-os/DELIVERY.md D04 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Reuse encrypted field vault, grants, revision-checked writes and device reconciliation. Complete permitted prepared routine capture without network/model; recover acknowledged fields after interruption/restart. No plaintext workaround, silent eviction or new daily supervisor approval.

Acceptance requires actual persistence/crypto/quota/restart and account-isolation evidence, not an offline toggle. Grant duration and recovery policy remain explicit DEC-03 dependencies; old 24/72-hour proposals are not approved policy.

## Observed D04a increment — 9 October 2026

Dependent draft PR <pull-request id="01204c5d-9925-4e99-badb-da924dbf005f" href="https://linear.app/aplyd-sandbox/review/feat-retain-prepared-worker-visits-through-offline-restart-and-safe-599da12a5393">feat: retain prepared worker visits through offline restart and safe sync</pull-request> applies the worker-day presentation, encrypted current-visit/step metadata and query-bearing public-shell fallback to the existing offline client. Exact prepared source `50c672c95044bf093f241f3f6dea1fce308dd3d5` was tested by the second job of run 37938542080. Its trigger commit 9b7d931 is only the seed, not the tested runtime.

Downloaded and inspected artifact 11620965339 (SHA-256 7cb7df728cb0d841f886ef13c19f7af498f855c9d0a2b064617b8eec5e3e1e5f) agrees across source-commit.txt, checks.tsv and actual suite reports:

* 26 new metadata/Web Crypto/routing checks; 11 existing grant and 12 current-shell policy checks passed.
* 26 real offline-browser journey checks and 18 existing online-browser checks passed.
* Documentation/requirements/catalogue, pinned installation, lint debt ratchet, types and build passed.

The browser test actually disabled connectivity, saved new information, closed Chromium, reopened the same retained profile offline and recovered the selected visit, step and observations from encrypted IndexedDB. It also inspected public/plaintext stores, injected a failed device write and verified connected wrong-account refusal. This is not only an offline flag or mocked storage test.

The following cleanup commit 53c78ab only records results and removes the temporary branch-writing workflow; application/tests are unchanged. Fresh cleanup-head CI is separate from the observed prepared-source pass. Full evidence and limitations: docs/current/worker-day-offline/RESULTS.md.

Implementation: bounded D04a committed. Technical verification: named browser/storage selection passed. Full D04 acceptance remains pending: physical Android, abrupt OS/power loss/eviction, all record types, measured p95 500 ms, complete multi-programme semantics and approved deployment policy are not qualified. Existing manual preparation/passphrase remain, not seamless recovery of an unprepared online form. New test count minima still need registration before merge. Parent <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">feat: connect mobile Today to the existing visit workflow</pull-request> CI/review and known baseline defects are not waived. Depends on #176; reconciliation witness tracked in #178.

Release: not approved. No main/parent merge, hosting change, real data or provider activation. Keep this scope issue open.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="7127b7ef-f559-4a07-b6e9-8993beb621b9" href="https://linear.app/aplyd-sandbox/issue/APL-9/d05-reconnect-without-duplication-or-false-completion">APL-9</issue> — \[D05\] Reconnect without duplication or false completion

## User story

As an ASHA, I want saved work reconciled safely when connectivity returns so retries do not duplicate or falsely complete it.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope: SAHA-006,075,076,095,096. Specification: docs/current/community-worker-os/DELIVERY.md D05 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Reuse stable command identities, receipt lookup and dependency-ordered sync. Revalidate context before disclosure; preserve partial successes per destination. Local saved, server saved and destination accepted remain separate.

Required tests: repeated connectivity loss, dropped acknowledgement after acceptance, changed content under used key, changed authority and dependent-person/visit records. No blind resend or deletion of confirmed history to clear a queue.

## Observed prepared-visit sync witness — 9 October 2026

PR <pull-request id="01204c5d-9925-4e99-badb-da924dbf005f" href="https://linear.app/aplyd-sandbox/review/feat-retain-prepared-worker-visits-through-offline-restart-and-safe-599da12a5393">feat: retain prepared worker visits through offline restart and safe sync</pull-request>, prepared source 50c672c95044bf093f241f3f6dea1fce308dd3d5, passed its selected checks in the explicit prepared-source verification job of run 37938542080. Downloaded artifact 11620965339 records 26 passing offline-browser checks plus the existing 18-check online journey. See docs/current/worker-day-offline/RESULTS.md for hashes and limits.

The test uses the real built local synthetic Worker/D1 and existing syncFieldVisit API. It captures information offline, restarts Chromium using actual persisted encrypted IndexedDB, reconnects, forwards the sync to the backend and then deliberately drops its accepted response. The device retains the same pending operation key; recovery leaves one matching unconfirmed visit draft. Stored observation/note are read back through the backend. A connected different-account check conceals data and refuses access even with the old passphrase.

No mock receiving programme is counted as business acceptance. The existing sync code was reused, not replaced with blind retry or a second queue. This is a single prepared-visit, lost-acknowledgement witness; it does not complete all D05 dependency-order, changed-payload, multi-destination, repeated-loss or external acceptance criteria. Existing reviewed sync is explicit, not newly automatic background submission.

Implementation: bounded existing-path integration committed. Verification: named witness passed. Full D05 acceptance: pending. Depends on #177. Latest cleanup head differs only in result documentation/workflow retirement; fresh head CI/review remains separate. New test minima adoption and parent <pull-request id="34f499b5-4440-42e9-89a1-7a2501b11950" href="https://linear.app/aplyd-sandbox/review/feat-connect-mobile-today-to-the-existing-visit-workflow-c6b33174d866">feat: connect mobile Today to the existing visit workflow</pull-request> release gates remain. No main merge, deployment, real data or provider activation; keep open.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="6984cd43-72e8-497c-b9bd-947968776004" href="https://linear.app/aplyd-sandbox/issue/APL-10/d06-open-or-prepare-bounded-tasks-conversationally">APL-10</issue> — \[D06\] Open or prepare bounded tasks conversationally

## User story

As an ASHA, I want bounded conversational access to existing tasks while retaining a manual path.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope: SAHA-009,040,041,043,044,049. Specification: docs/current/community-worker-os/DELIVERY.md D06 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Start with a small intent catalogue over an already working mobile journey: show work, find assigned person, reopen task and explain actual status. Return usable controls, distinguish duplicate names and keep a manual path. No arbitrary endpoints, generated SQL, expanded agent authority, ambient listening or invented clinical advice.

Test unsupported requests, injected instructions, changed account/person, stale proposals, minimised context and unavailable model. Label reference/simulated interactions honestly. Provider activation is not authorised here.

State: refined, implementation/verification pending. Depends on #175 and #176; does not block manual work.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="27b372ee-d91a-4cc4-84aa-2dd60fadae4d" href="https://linear.app/aplyd-sandbox/issue/APL-11/d07-identify-and-recover-the-synthetic-digitalocean-release">APL-11</issue> — \[D07\] Identify and recover the synthetic DigitalOcean release

## User story

As the delivery team, we need verified hosted-source and recovery evidence so a release can be identified and recovered.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope: SAHA-115,141,152. Specification: docs/current/community-worker-os/DELIVERY.md D07 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Read the actual deployed source/configuration and rehearse update/recovery only with authorised host access on an isolated synthetic target. Preserve data/migration history and queues. A code revert is not a database rollback.

No main merge, timer change, provisioning, live data or provider activation is authorised. Current hosting documentation is not a live-host observation. Production runtime choice remains separate SAHA-157.

State: refined; actual host inspection/recovery evidence pending. Native authoring environment has no established Droplet access. Acceptance requires measured running-source and recovery evidence, not a document.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.

## <issue id="1981ebaa-58db-4ca4-9c94-f0fe5a12563b" href="https://linear.app/aplyd-sandbox/issue/APL-12/d08-qualify-compact-phone-usability-and-persistence">APL-12</issue> — \[D08\] Qualify compact-phone usability and persistence

## User story

As an ASHA, I want a usable compact-phone experience whose persistence and interactions have been tested.

## Migration checkpoint

Historical candidate evidence below does not itself establish current full acceptance. Refresh controller and exact current source before implementation.

## Canonical source and acceptance evidence

Scope: SAHA-139,144,145,153. Specification: docs/current/community-worker-os/DELIVERY.md D08 (<pull-request id="94589fb7-9d6c-4c8a-ac61-26dc0216cfb7" href="https://linear.app/aplyd-sandbox/review/docs-start-community-worker-os-delivery-from-reconciled-scope-712ac20b0f3b">docs: start Community Worker OS delivery from reconciled scope</pull-request>).

Declare device/browser/language before testing. Exercise compact and taller viewports, long names, text scaling, focus, keyboard and actual save/restart behaviour. Preserve original local-save target and distinguish viewport simulation from real keyboards, memory/battery and physical-device evidence.

No screenshot-only accessibility acceptance and no target change after failure. ASHA formative testing follows the demo; it is distinct from original formal acceptance.

State: refined. The initial Today entry has isolated DOM/presentation tests only; actual handset qualification remains pending. Supports #175-#178.

## Execution

Delivery control: [https://github.com/nakul175/saha-health/issues/188](<https://github.com/nakul175/saha-health/issues/188>)
Preserve original requirement IDs and frozen story criteria. Engineering, product acceptance and release evidence are separate. Existing qualified-story permission only; no new blanket permission.