# Current validation — Release 9 / v1.1-readiness

27 September 2026 (UTC). **1,007 automated checks passed** against synthetic data:

| Suite | Checks |
| --- | ---: |
| Built Worker HTTP/database regression, including outreach and expansion | 687 |
| Outreach/expansion contracts: time zones, stale authority, identity/contact changes, retry limit and maintenance | 55 |
| Retained agent, MIS, EHR, field, operations and pilot contract suites | 248 |
| Encrypted local backup and restored Worker, including new records and receipts | 17 |

Strict TypeScript, production build and whitespace validation pass. The append-only migration adds outreach and expansion tables; prior migrations remain unchanged. Recovery validates all 24 local SQLite tables (23 application tables plus metadata). Test reports are tracked under `tests/`.

Browser preview: created a one-person synthetic outreach plan with a named care worker and selection rationale; scheduled it with a reason; recorded an attempted outcome with a source reference; confirmed that plan closure remains blocked while unresolved. Contact preferences showed no automated-contact permission by default. The expansion workspace and proposal form expose local differences, six evidence categories and the explicit live-activation boundary. No additional real account, patient or destination was created or contacted.

API coverage includes team/direct-worker scope and admin PHI denial; independent template/message reviews; shared/unknown/private-contact blocking; preference-change cancellation; due time and duplicate suppression; failed-message replay/retry/follow-up; revoked receipt access; visit-backed completion and reopening after void; strict configuration-only imports; six-category review; changed-spec evidence invalidation and withdrawal. Contract checks additionally exercise approval expiry, current author/reviewer/worker authority, identity changes and daylight-saving-aware local contact windows.

These are local engineering checks. Live messaging/IVR and inbound opt-outs, installed expansion protocols/providers, full 176-requirement traceability and accepted real pilot/G7 evidence remain outstanding. No hosted disaster recovery, production capacity, physical-device, clinical, legal, security or accessibility acceptance is claimed. Earlier sections record historical release evidence.

# Validation — Release 1 / Saha v0.2

26 September 2026 (UTC).

## Automated evidence

- Strict TypeScript check passed.
- Production Worker build passed: dynamic app page plus workspace, command, patient history, audit and FHIR API routes.
- **163 checks passed** against the built Worker and local D1. Run metadata and coverage: `tests/latest-result.json`. These are executable HTTP/database assertions, not a claim that all BRD test cases passed.
- Identities: organisation owner, ASHA worker, clinician, supervisor, administrator, outsider and legacy migration fixtures. The owner and clinician intentionally share a display name; one still cannot execute the other's approval.
- Access checks: unauthenticated rejection, no sandbox role switch, organisation and team boundaries, direct ASHA assignments, admin patient/history/FHIR denial, supervisor clinical-write denial, membership suspension and reassignment, including old receipt replay after access removal.
- Membership checks: invitation bound to the recipient account, used/revoked/expired invitations, owner-only changes, last active owner, organisation creation/switching and recovery when the stored active organisation was revoked.
- Consistency: concurrent edits yield one save and one conflict; concurrent identical commands return one committed result; idempotency replay and changed-input rejection; confirmed facts cannot be overwritten.
- Migration: source JSON/revision unchanged; source hash/count ledger; people, visit facts, AI output, receipt, referral, audit and command receipts preserved; earlier unexecuted approval blocked; repeat opening does not duplicate records. An intentionally invalid source forced a transactional failure; no partial organisation/membership/ledger persisted, and restoring the source allowed a successful retry.
- History: original/new identity values, correction author, linked amendments, retained original observations and outputs, wrong-patient blocking, database triggers rejecting mutation, revision/audit pagination without duplicate events.
- Continued workflow: independent simulated submissions, safe uncertain receipt lookup without another send, optional AI permission withdrawal/restoration, output review, synthetic FHIR export and cross-origin write rejection.
- The applied v0.1 migration and snapshot have no source diff. The appended migration is schema-only.

## Browser evidence

Managed preview used synthetic records only. Verified:

1. Existing v0.1 preview data migrated: six people, one confirmed visit and two programme receipts remained available.
2. Organisation/team page, account code, owner/clinical membership and creation of a care team.
3. Demographic correction with required reason; history explicitly showed age 26 before and 27 after, with author and timestamp.
4. Correction draft created from the confirmed visit while the original remained in Previous visits.
5. Two browser sessions opened the same draft. One saved weight 58; the other attempted a stale notes save. The comparison dialog retained the local notes and showed the saved weight. Explicit merge retained both changes, followed by a new save.

The earlier v0.1 browser journey covered the shared visit, confirmation, programme review/approval, partial receipts, recovery and assistance-review flow; those paths were also covered by this release's HTTP regression checks.

Desktop UI inspected. Responsive rules are implemented; a physical-device/mobile-emulation run and 200% zoom accessibility test were not completed. WebMCP remains feature-detected and was not validated in this browser. No hosted staff account was granted access during QA; the Site audience remains owner-private.

## Evidence boundaries

These checks establish the tested synthetic release behaviour, not clinical or production readiness. No live AI/MIS/EHR/ABDM service, FHIR/ABDM profile conformance, clinical validation, external penetration/load test, legal compliance assessment, independent audit attestation or production backup restoration was tested. The live schema is deployed before per-owner first-open migration; fixture results do not by themselves prove a particular owner's live backfill has run.

## Release 2 / v0.3

- 202 automated API/database assertions passed; all 163 Release 1 checks retained, plus 39 programme checks (see tests/latest-result.json).
- Production build and TypeScript check passed.
- Browser preview: opened a TB episode for synthetic Sunita with an unknown start date; scheduled a named follow-up with due date and owner; started a pack-pinned visit; saved weight and notes; saved cough/testing answers; verified the review panel contains those answers and pack version; confirmed the visit.
- Unsaved programme evidence blocks tab changes and patient navigation; shared facts and programme evidence are saved sequentially to avoid losing one edit when saving the other.
- Existing Release 1 synthetic records remained accessible in preview.
- No live clinical system, AI provider, EHR or ABDM service contacted. No production-access sharing changed.
- Mobile, screen-reader and clinical protocol validation are not claimed. Catalogue uses illustrative sandbox packs and cannot activate production clinical content.

## Release 3 / v0.4

- 263 API/database assertions pass (the previous 202 retained, plus 61 agent workflow checks). 21 additional provider-contract assertions pass using injected mock HTTP transport. Reports: tests/latest-result.json and tests/agent-contract-result.json.
- TypeScript and production build pass.
- Browser preview: started a synthetic Rajesh visit; entered one narrative containing BP 128/82 mmHg, weight 76 kg and cough for 3 days; prepared and approved a local extraction; reviewed four proposals with exact source quotations; selected BP and weight only; applied three reviewed fields with observation source/time and original narrative. Weight became 76 kg; excluded cough duration was not applied. Request retained as applied, and the visit remained a draft.
- Existing R1/R2 patients, visits and follow-ups remained available.
- No live model call or live health-system integration was tested. Hosted provider credentials are absent. Local parser is clearly labelled rules-only; OpenAI is visibly unavailable.
- Live language-model accuracy, multilingual behavior, clinical interpretation, mobile and accessibility audits remain unverified. Lexical evidence checks plus human review do not establish clinical correctness.

## Release 4 / v0.5 — 26 September 2026

- 298 API/database assertions pass against a local Worker and D1 database, including mapping ownership, validation, persistence, stale updates, disabled credentials, programme consent gates, immutable mapped plans, idempotent durable queue creation, scoped delivery access and cancellation. Prior release assertions remain included.
- 43 programme contract checks pass with injected transport: destination mapping, omitted unknowns, required missing fields, reserved/duplicate target rejection, organisation-scoped grants, dedicated credentials, private-literal endpoint rejection, bounded HTTP/JSON responses, receipt key/hash matching, terminal conflicts, safe retry state, linked corrections including skipped intermediate amendments, and HMAC freshness/tamper rejection.
- 10 delivery-checkpoint checks pass with injected transport and a CAS persistence model: commit before send, concurrent calls issue one request, terminal duplicate requests do not resend, lost response stays uncertain, lookup has no visit fields, not_found allows same-key retry, interrupted final writes do not repeat the provider, and in-flight permission withdrawal retains the actual receipt. These are not live partner or D1 concurrency acceptance tests.
- 21 existing AI provider contract checks pass. Total automated checks: 372.
- TypeScript no-emit and Worker production build pass.
- Browser: existing workspace loaded; registered a suspended synthetic MIS profile; opened mapping controls; edited notes destination to visit_notes; enabled linked corrections; saved and refreshed; reviewed persisted fields. Test and activation controls correctly disabled without server grants/credentials.
- No actual programme endpoint, credential, callback ingress or real patient data used. Real two-destination acceptance is blocked, not simulated as passed. Callback route code and HMAC contract exist; full hosted callback E2E is not claimed. Autonomous background dispatch is deferred; sending is explicitly worker-driven after durable queue creation.

## Release 5 / v0.6 — 27 September 2026

- 340 API/database assertions pass against the local Worker and D1, retaining earlier release checks and adding EHR configuration, patient linking, scoped permissions, document review and persistence gates.
- 46 FHIR/EHR contract assertions and 8 exchange checkpoint assertions pass with injected HTTP transport and CAS persistence: structural document checks, reference resolution, patient identity, time windows, capabilities, receipts, checkpoint-before-send, concurrent approvals, interrupted saves and receipt-only recovery.
- Existing 43 MIS contract, 10 MIS checkpoint and 21 AI contract assertions pass. Total: 468 automated checks. Mock transport checks are not live partner acceptance or hosted concurrency tests.
- TypeScript no-emit and Worker production build pass.
- Browser preview: inspected ABDM readiness gates; added a suspended synthetic FHIR partner; saved read capabilities; confirmed testing/activation are unavailable without server credentials. Opened an existing synthetic patient, explicitly confirmed an external patient reference, and verified its active link is displayed while external sharing remains off. Existing confirmed visit and programme evidence remain visible.
- No real EHR, ABDM gateway, live credential or real patient data used. ABHA/HIP/HIU workflows are not implemented. Official ABDM profile validation and live partner acceptance remain outstanding; full Release 5 acceptance is not claimed.
- Desktop preview only; mobile, accessibility, clinical validation and production backup/restore acceptance are not claimed.

## Release 6 / v0.7 — 27 September 2026 UTC

- 381 API/database assertions pass against the local production Worker and D1. New checks include signed-grant issuance, care-role scope, exact duplicate replay, payload-key mismatch, server visit conflicts, permission/identity invalidation, grant revocation, referral responsibility, evidence requirements, ordered transitions and immutable completion.
- 38 field/encryption contract assertions pass: real Web Crypto encryption/decryption across key re-derivation, random IVs, wrong passphrase and tamper rejection, signed-packet verification, grant expiry/authority/version gates and referral evidence state machine.
- 23 client recovery assertions pass with real Web Crypto and injected storage/network/minimal DOM. They cover lock clearing memory, encrypted recovery, frozen payload/key after lost response, account mismatch blocking, conflict retention, save failure blocking transmission and stale-tab rejection. These do not test real IndexedDB or a browser.
- 11 service-worker policy assertions pass with injected event/cache/network objects: narrow static cache, API/auth/query exclusion, disconnected fallback and failed installation rejection. They do not test real browser service-worker behavior.
- 128 retained AI/MIS/EHR contracts/checkpoints pass. Total: 581 automated checks. TypeScript no-emit, JavaScript syntax checks and production build pass.
- Browser preview: opened the notebook from the sidebar; verified the HTTP preview refuses encrypted storage without Web Crypto. No insecure workaround was used. Prepared a synthetic referral from an existing confirmed visit, assigned Preview owner with due date 2026-09-29, recorded a worker-observed sent event with timestamp, note and synthetic evidence reference, and verified persisted owner/status/event on screen. No facility was contacted.
- Browser offline reload, actual IndexedDB recovery, disconnected visit sync, microphone/transcription, physical mobile devices, accessibility audits, native Android keystore/MDM and independent referral outcome verification remain untested. Full Release 6 acceptance is incomplete. Prior live integration and ABDM gaps remain unchanged.

## Release 7 / v0.8 — 27 September 2026 UTC

- **667 automated assertions passed:** 429 built-Worker API/database checks; 24 new operations contracts; 14 encrypted recovery checks; 200 retained AI, MIS, EHR, field crypto/client and offline-shell assertions. These are assertions across several test layers, not 667 end-to-end workflows or an independent security assessment.
- Reporting tests cover organisation/team boundaries, administrator clinical-aggregate denial, worker/clinician restrictions, scoped exports, operator revocation, incident evidence and immutability, stale operations versions, maintenance write blocking, permitted withdrawal/receipt lookup and idempotent maintenance replay.
- Contract checks cover UTC window boundaries, current-team scoping, exclusion of voided/superseded records, separate undated/overdue counts, CSV formula injection, maintenance safety exceptions, and bounded streaming JSON bodies including invalid UTF-8.
- Recovery used a consistent encrypted snapshot of all 21 tables in the isolated local database (20 application tables plus local D1 metadata). It rejected wrong passphrases, modified ciphertext and existing targets; compared schema and all table digests; verified foreign keys, integrity and immutable audit/revisions; then started the built Worker against the restored database. Authenticated workspace/operations reads passed and command receipts were unchanged. This does not test hosted export, retained production backups, external-system reconciliation or infrastructure cutover.
- Twenty local concurrent report requests, concurrency five, returned without errors; measured timings are in `tests/operations-load-result.json`. This is a bounded smoke test on small synthetic data, not a scale benchmark or production SLO.
- Strict TypeScript, source whitespace checks and production build passed. Prior migrations and snapshots remain unchanged; migration 0002 adds only operations state and request metrics.
- Browser preview: existing patients, visits and earlier programme/referral records remained accessible; inspected supervisor overview, separate backlog and receipts, unknown cost assumptions, incident creation and resolution with an evidence reference, and a persisted maintenance pause/resume. No external service or real patient data used. Development identity is intentionally excluded from durable production request metrics.
- Remaining gates: live models/MIS/EHR, ABHA/HIP/HIU and ABDM validation, disconnected physical-device/speech acceptance, independent penetration/accessibility review, representative load/soak, hosted backup scheduling/retention/restore, external alerting and clinical acceptance. Full Release 7 pilot-candidate acceptance is not complete.

## Release 8 / v1.0-readiness — 27 September 2026 UTC

- **800 automated assertions passed:** 537 built-Worker API/database checks, 24 pilot contracts, 15 encrypted recovery checks and 224 retained agent/MIS/EHR/field/operations contracts. These are layered engineering assertions, not 800 end-to-end workflows or externally accepted pilot outcomes.
- Pilot API tests exercise strict configuration, four distinct reviewers, current membership/role checks, stale version conflicts, personally acknowledged training, invalid/self/other-account assessments, baseline and outcome authority, nonempty programme cohort, evidence/dossier invalidation, four-account decisions, high-incident startup blocking, idempotent start replay, membership revocation during an active rehearsal, pause/retraining/restart, outcome-required completion, immutable completion, new scope revision, permission-filtered exports and audited persistence.
- Contract checks exercise date and cohort bounds, foreign teams/participants, duplicate inputs, live-connection exclusion, administrator measurement denial, out-of-team assessment/evidence denial, needs-practice acknowledgement denial, reviewer reassignment and fingerprint invalidation after membership, team, connection or configuration changes.
- Local encrypted recovery verified all 22 tables (21 application tables plus local D1 metadata), their schema/count/content digests, wrong-passphrase/tamper/overwrite protection, append-only audit/revisions, authenticated reads by the built Worker, and exact retention of pilot version, training and reviewer decisions. Reads did not create or replay command receipts. Hosted backup/cutover/RPO-RTO remain untested.
- Strict TypeScript, production build and source whitespace checks passed. Migration 0003 adds only the organisation-keyed pilot table. Prior applied migrations/snapshots are unchanged.
- Desktop browser preview verified navigation, loaded readiness/empty states, four tab panels, training module guidance, configuration dialog and participant/reviewer selection, unresolved external acceptance gates and layout. The full multi-account pilot lifecycle is verified through HTTP/D1 tests, not browser impersonation. No actual training, user invitation, clinical sign-off, live connection or external acceptance was created.
- The API test harness needed a new active synthetic programme episode after earlier tests had closed their maternal episode; the nonempty-cohort gate correctly refused startup until the fixture supplied it.
- Twenty bounded local reporting requests at concurrency five returned without errors; timings remain a local smoke check only. Physical devices, real disconnected IndexedDB recovery, screen readers, live providers/partners, official ABDM validation, representative scale/soak, independent security and real clinical effectiveness/acceptance are not established. See PILOT-RUNBOOK.md for the remaining deployment gates and measurement limitations.

## Release 9 / v1.1-readiness — 27 September 2026 UTC

- 1,007 automated assertions passed: 687 API/D1, 55 outreach/expansion contracts, 248 retained contracts and 17 encrypted restore checks. See RELEASE-9.md for the retained release evidence and limits.

## Release 10 / v1.2-readiness — 27 September 2026 UTC

- **1,107 automated assertions passed:** 756 API/D1, 29 continuity contracts, 303 retained contracts/checkpoints and 19 encrypted recovery checks. Current machine-readable results are in `tests/*-result.json`; API scope is in `tests/latest-result.json`.
- Identity checks cover permitted-record matching, hidden records not affecting fingerprints, Unicode compatibility and Hindi combining marks, candidate overflow, stale reviews, explicit provisional/distinct decisions, clinician-only resolution, draft preservation and consequential-action blocks. Confirmation rejects absent, wrong-person and stale patient checks and stores the actual positive check.
- Handover checks cover all four open-work categories, preservation of completed work/receipts, atomicity, unassignment refusal with open work, pending-reminder cancellation, field-grant revocation, receiving-worker acknowledgement, replay, suspension and scoped exception visibility.
- Recovery verifies the complete schema and table digests for 24 local SQLite tables, then compares identity-review, assignment-history and patient-check metadata returned by a restarted built Worker. Production hosted recovery, RPO/RTO and device-only draft recovery are not claimed.
- Strict TypeScript, production build and source whitespace passed. The requirements checker verifies all 176 exact source IDs, unique assessments, valid targets/statuses, existing evidence paths and generated-file consistency. This is documentation integrity, not BRD acceptance.
- Desktop browser preview exercised scoped duplicate search, explicit provisional registration, saved draft capture, confirmation remaining blocked, and clinician identity review with evidence through Care handover. Prior synthetic visits and referral evidence remained visible. Multi-account transfers and acknowledgements were verified by HTTP/D1 tests.
- An initial local Worker test run returned a transient non-JSON 503 on an invalid search request. The harness now preserves raw error responses; the full rerun and final built-Worker run passed, including that 422 validation case. No server acceptance failure was hidden or changed to pass.
- The audit records 14 implemented-local, 129 partial, 24 not-built and 9 unverified requirements. All 176 formal acceptance criteria remain pending. Evidence paths provide related implementation/test context, not proof of complete clause coverage. Live integrations, clinical governance, physical devices, accessibility, security, representative scale and field acceptance remain outstanding.

## Release 11 / v1.3-readiness — 27 September 2026 UTC

- **1,284 automated assertions passed:** 902 HTTP/D1, 361 contract/checkpoint checks (including 27 new governance checks and two additional evidence-validation regressions), and 21 encrypted restore checks. Results are in `tests/latest-result.json` and the current `tests/*-result.json` files.
- New HTTP coverage verifies immutable revision lifecycle, author/reviewer separation, current authority, version-bound evaluation, one-case replay, failed Hindi eligibility, review-before-activation, age/context gates, ASHA-only protocol evaluation reviewed by a clinician in the originating worker's context, stale finding rejection, directory dependency invalidation, rejection retaining original outputs, named safety ownership, capability hold and administrator PHI denial.
- Contract checks cover age/team/language/setting/device/model eligibility, membership/expiry invalidation, pending and midnight quota accounting, external identifier rejection without misclassifying timestamps, language-specific accuracy gates, no-data scores, stale observation rules, full-clause negation and BP field/value alignment.
- Recovery verifies all 25 SQLite tables and compares complete governance records through the restarted built Worker alongside existing pilot, outreach, expansion and continuity evidence. No hosted recovery or infrastructure cutover claim is made.
- Browser preview created a clearly synthetic capability draft, ran 16 English fixtures, retained independent-review blocking after the pass, and recorded an unknown worker concern with a synthetic reference. Prior synthetic records remained visible. Multi-account approvals were API-tested, not fabricated in the browser.
- A transient local Worker restart interrupted initial negative-request tests. The final full run passed unchanged expectations without request retries. The test harness now isolates the built artifact and development registry. A referral fixture was corrected to record a synthetic note before confirmation, preserving the existing empty-visit rejection.
- TypeScript, production build, source whitespace and all-176 audit consistency checks passed. Tiny known-corpus scores do not establish NFR-16 accuracy; live provider, approved clinical content and real professional review remain outstanding. All 176 formal BRD acceptances remain pending.

## Development slice 0a — patient-partitioned storage — 30 September 2026 IST (29 September UTC)

- **1,324 automated assertions passed:** 923 HTTP/D1 (902 retained plus 21 partition checks), 380 contract/checkpoint (361 retained plus 19 storage-contract checks) and 21 encrypted restore checks. Reports are in `tests/evidence/slice-0a/` with a digest manifest; the R11 result files in `tests/` are retained unchanged as historical evidence.
- The storage contract runs the real migrations in in-memory SQLite through a minimal D1 shim and exercises interleavings HTTP timing cannot guarantee: stale same-patient commits refused with no partial rows, an organisation-level commit invalidating an earlier patient read, an organisation-wide commit refused after a patient commit, and uncertified commands kept organisation-wide.
- A local load probe (`tests/load-envelope.mjs`) measured the R11 model up to 100,006 synthetic people (`tests/load-envelope-r11-baseline.json`) and slice 0a at 1,006 people (`tests/evidence/slice-0a/load-envelope-result.json`). Simultaneous writes on different people went from 3 of 50 accepted to 50 of 50. Throughput at 50 requests/second stayed at 5.9 requests/second because full organisation snapshots remain; that is slice 0b.
- One of two full-suite runs hit the transient local Worker restart recorded in R10 and R11 (a non-JSON 503 at a pre-existing integration toggle step). The rerun passed with unchanged expectations and no request retries.
- TypeScript no-emit and the production build passed. No user-interface change was made, so no browser preview was run for this slice. Hosted D1, Worker limits and multi-account load were not tested; NFR-24 remains unverified and all 176 formal acceptances remain pending.

## Development slice 0b — partition delta responses — 30 September 2026 IST (29 September UTC)

- **1,351 automated assertions passed:** 950 HTTP/D1 (923 from slice 0a plus 27 delta checks), 380 contract/checkpoint and 21 encrypted restore checks. Reports: `tests/evidence/slice-0b/`.
- Delta checks run eight certified commands and assert after each that merging the partition delta into the previous full snapshot equals a freshly loaded full snapshot. The first attempt exposed an ordering difference: full loads returned referrals in primary-key order by accident, while the merge appended new rows. Reads now use an explicit order and the merge sorts the same way.
- One run hit the known transient local Worker restart (a 503 on a patient search in the continuity suite, before any slice 0b test). The delta suite's temporary directory was also moved out of the repository to rule out file-watch restarts. The final run passed with unchanged expectations and no retries.
- Browser check with headless Chromium against the built Worker and a synthetic owner: start visit, save notes, reload and see the saved notes, record weight, confirm with the patient check. Every command answered with a delta; the confirmed record displayed correctly; no console errors.
- Load probe at 1,006 people with deltas: one write returns 5 KB instead of 774 KB; 50 simultaneous writes on different people all commit with a median of 1.7 s instead of 3.6 s. Throughput in the mixed sustained phase is still bounded by full workspace reads. TypeScript and production build passed.

## Development slice 0c — identity layer, supply-chain gate and CI — 30 September 2026 IST (29 September UTC)

- **1,369 automated assertions passed:** 950 HTTP/D1, 398 contract/checkpoint (380 plus 18 identity contract checks) and 21 encrypted restore checks. Reports, the production SBOM and the gate report are in `tests/evidence/slice-0c/`.
- Identity contract checks use a locally generated RSA key and an injected key endpoint; no real Access application or identity provider was contacted. HTTP checks against the built Worker confirmed 503 for a misconfigured Access provider, 401 for Sites headers and a forged token under Access, and 401 with the Access header ignored under the default provider.
- Supply-chain gate passed: 222 production components; 0 critical and 22 high advisories, all in development or build tooling and none found in the built output.
- The intermittent local "worker restarted mid-request" 503, previously recorded in R10, R11, 0a and 0b, was traced to requests rejected before their body was read. After draining unread bodies, five consecutive full runs passed with no restarts.
- The new CI workflow was committed but had not run on GitHub at the time of this record. TypeScript and production build passed. The browser check found the default sign-out link unchanged and no page errors.

## Development slice 1 — households and proxy authority — 30 September 2026 IST (29 September UTC)

- **1,432 automated assertions passed:** 1,001 HTTP/D1 (950 plus 51 household checks), 410 contract/checkpoint (398 plus 12 household contract checks) and 21 encrypted restore checks over 26 tables including households. Reports: `tests/evidence/slice-1/`.
- The household suite passed on its first full run and the full suite showed no local Worker restarts.
- Browser check with headless Chromium against the built Worker: household created, member added, proxy grant recorded for Appointments without the maternal class, sharing preview showed only the general home visit for the pregnant member. No console errors.
- Assessment changes: BR-ID-07 and BR-SEC-04 moved from not-built to partial; BR-PROG-05 text updated. Counts are now 14 implemented-local, 136 partial, 17 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 1b — workforce lifecycle and caseload transfer — 30 September 2026 IST (29 September UTC)

- **1,545 automated assertions passed:** 1,084 HTTP/D1 (1,001 plus 83 caseload checks), 440 contract/checkpoint (410 plus 30 caseload contract checks) and 21 encrypted restore checks over 27 SQLite tables including caseload transfers. Reports: `tests/evidence/slice-1b/`.
- The caseload suite passed on its first full run; the full suite showed no local Worker restarts.
- Browser check with headless Chromium against the built Worker and two synthetic accounts: a partial caseload transfer from the Care handover page, then acknowledgement by the receiving ASHA from her own page. No console errors; every command and caseload read returned 200.
- CI now also runs the household and caseload contract suites, which slice 1 had omitted from the workflow.
- Assessment changes: BR-ID-01 and BR-ID-04 texts updated; both remain partial. Counts are unchanged at 14 implemented-local, 136 partial, 17 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 1c — controlled identity merge and unmerge — 30 September 2026 IST (29 September UTC)

- **1,626 automated assertions passed:** 1,138 HTTP/D1 (1,084 plus 54 merge checks), 467 contract/checkpoint (440 plus 27 merge contract checks) and 21 encrypted restore checks over 28 SQLite tables including identity cases. Reports: `tests/evidence/slice-1c/`.
- The merge suites passed on their first full run. One later full run stalled in the operations load smoke, before any slice 1c test, with a local request-header timeout and so did not reach the restore drill; the immediate rerun passed and its reports are the ones saved.
- Browser check with headless Chromium against the built Worker and two synthetic clinicians: proposal by one, approval by the other, read-only notice on the duplicate. No console errors; every command and identity-case read returned 200.
- Assessment changes: BR-ID-05, BR-ID-08 and BR-DATA-06 texts updated; all remain partial. Counts are unchanged at 14 implemented-local, 136 partial, 17 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6a — exceptional access — 30 September 2026 IST (29 September UTC)

- **1,692 automated assertions passed:** 1,185 HTTP/D1 (1,138 plus 47 exceptional-access checks), 486 contract/checkpoint (467 plus 19 exceptional-access contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6a/`.
- The exceptional-access suites passed on their first full run, apart from one contract assertion that read the review outcome from the wrong field of the view; the assertion was corrected, not the code.
- Browser check with headless Chromium against the built Worker and two synthetic accounts: emergency access opened by record reference, restriction notice on the patient page, early closure, then an "appropriate" review by the owner. No console errors; every command and emergency-access read returned 200.
- Assessment changes: BR-SEC-11 moved from not-built to partial. Counts are now 14 implemented-local, 137 partial, 16 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6b — rights and grievance requests — 30 September 2026 IST (29 September UTC)

- **1,755 automated assertions passed:** 1,231 HTTP/D1 (1,185 plus 46 rights checks), 503 contract/checkpoint (486 plus 17 rights contract checks) and 21 encrypted restore checks over 29 SQLite tables including rights requests. Reports: `tests/evidence/slice-6b/`.
- The rights suites passed on their first full run; the full suite showed no local Worker restarts.
- Browser check with headless Chromium against the built Worker: a restriction request recorded and closed as fulfilled from the patient page, followed by the restriction notice. No console errors; every command and rights read returned 200.
- Assessment changes: BR-SEC-10 moved from not-built to partial. Counts are now 14 implemented-local, 138 partial, 15 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 0b-2 — viewer-scoped workspace reads — 30 September 2026 IST (29-30 September UTC)

- **1,782 automated assertions passed:** 1,231 HTTP/D1 (unchanged, now with every workspace read scoped), 530 contract/checkpoint (503 plus 27 scoped-read contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-0b2/`.
- A first implementation used one correlated SQL predicate for every viewer. The probe showed owner reads 18–23 percent slower at 20,000–50,000 people (819 ms against 668 ms, and 2,050 ms against 1,743 ms), so it was replaced before commit with a per-viewer predicate and a plain read for all-team viewers; only the second version's results are saved.
- Local read-only probe against the previous build: an ASHA's median workspace read at 50,006 people fell from 965 ms to 48 ms; owner reads were unchanged within noise (1,743 ms and 1,738 ms).
- Browser check with headless Chromium: owner and ASHA workspaces loaded and a caseload transfer completed. No console errors.
- Assessment changes: NFR-24 text updated; it remains unverified. Counts are unchanged at 14 implemented-local, 138 partial, 15 not-built and 9 unverified.

## Development slice 6c — retention schedules and holds — 30 September 2026 IST (29-30 September UTC)

- **1,820 automated assertions passed:** 1,258 HTTP/D1 (1,231 plus 27 retention checks), 541 contract/checkpoint (530 plus 11 retention contract checks) and 21 encrypted restore checks over 30 SQLite tables. Reports: `tests/evidence/slice-6c/`.
- The first full run failed one new assertion of this slice: it compared audit-event counts before and after hold commands, which themselves add audit events. The assertion now compares patients, visits and submissions for equality and requires revisions not to decrease; the rerun passed.
- Browser check with headless Chromium: schedule saved and organisation hold placed from the Organisation page. No console errors.
- Assessment changes: BR-SEC-09 moved from not-built to partial. Counts are now 14 implemented-local, 139 partial, 14 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6d — indicator catalogue and suppression — 30 September 2026 IST (30 September UTC)

- **1,856 automated assertions passed:** 1,285 HTTP/D1 (1,258 plus 27 indicator checks), 550 contract/checkpoint (541 plus 9 indicator contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6d/`.
- The indicator suites passed on their first full run; the full suite showed no local Worker restarts.
- Browser check with headless Chromium: a question interpreted and run from the Operations page. No console errors.
- Assessment changes: BR-AG-11 moved from not-built to partial; BR-REP-02, BR-REP-03 and BR-REP-04 texts updated. Counts are now 14 implemented-local, 140 partial, 13 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 4a — referral lifecycle and escalation — 30 September 2026 IST (30 September UTC)

- **1,919 automated assertions passed:** 1,338 HTTP/D1 (1,285 plus 53 referral checks), 560 contract/checkpoint (550 plus 10 referral contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-4a/`.
- Ten contract harnesses, six of them from R11, now also compile `lib/saha/referral-rules.ts` because modules they load import it; no assertion changed and their pass counts are unchanged. Their saved R11 reports in `tests/` are untouched.
- The first full run's open-work check read the continuity view, which lists only patients with exceptions and so could pass vacuously; it now reads the caseload preview and requires the patient to be listed with no open work. Only the second run is saved.
- Browser check with headless Chromium: escalation list and a "Sent" event recorded from the referral card. No console errors.
- Assessment changes: BR-CARE-03 and BR-CARE-04 texts updated; both remain partial. Counts are unchanged at 14 implemented-local, 140 partial, 13 not-built and 9 unverified.

## Development slice 2a — reuse metering — 30 September 2026 IST (30 September UTC)

- **1,952 automated assertions passed:** 1,364 HTTP/D1 (1,338 plus 26 across the new reuse suite and the extended indicator suite), 567 contract/checkpoint (560 plus 7 reuse contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-2a/`.
- The first full run failed in the new reuse suite: its synthetic visit entered systolic without diastolic, which visit validation correctly refuses. The fixture now leaves both blank and records them as not measured; the rerun passed.
- No user-interface code changed, so no browser check was run for this slice.
- Assessment changes: BR-DATA-12 moved from not-built to partial; BR-REP-07 text updated. Counts are now 14 implemented-local, 141 partial, 12 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 1d — workforce roster reconciliation — 30 September 2026 IST (30 September UTC)

- **1,990 automated assertions passed:** 1,389 HTTP/D1 (1,364 plus 25 roster checks), 580 contract/checkpoint (567 plus 13 roster contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-1d/`.
- The first full run failed in the new roster suite because its fixture named a team that does not exist in the test organisation; the roster preview correctly reported it as an unknown team. The fixture now uses the team's id; the rerun passed.
- Browser check with headless Chromium: one roster line previewed and applied from the Organisation page, returning one invitation code. No console errors.
- Assessment changes: BR-ID-10 moved from not-built to partial; BR-ID-01 text updated. Counts are now 14 implemented-local, 142 partial, 11 not-built and 9 unverified; all 176 formal acceptances remain pending.
