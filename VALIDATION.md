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

## Development slice 7a — ABDM mock workflows — 30 September 2026 IST (30 September UTC)

- **2,038 automated assertions passed:** 1,423 HTTP/D1 (1,389 plus 34 ABDM mock checks), 594 contract/checkpoint (580 plus 14 ABDM mock contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-7a/`.
- The ABDM suites passed on their first full run; the full suite showed no local Worker restarts.
- Browser check with headless Chromium: module configuration, ABHA link, consent request, mock grant and an allowed fetch check. The first browser run stopped at an ambiguous navigation locator in the test script; after fixing the locator the whole flow passed with no console errors.
- Nothing was sent to ABDM. Purpose and type codes come from a secondary implementer's guide and are unverified against the ABDM sandbox.
- Assessment changes: BR-INT-13, BR-INT-14 and BR-INT-15 moved from not-built to partial, each stating that only a local mock gateway exists. Counts are now 14 implemented-local, 145 partial, 8 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 7b — ABDM mock transfer — 30 September 2026 IST (30 September UTC)

- **2,086 automated assertions passed:** 1,452 HTTP/D1 (1,423 plus 29 transfer checks), 613 contract/checkpoint (594 plus 19 transfer contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-7b/`.
- The first full run failed in the new transfer suite: it expected a clinician to be refused when revoking consent, but slice 7a deliberately lets any care role with patient access revoke. The assertion now uses an administrator; the rerun passed. The contract's first version compared bundles including their generation timestamp and now excludes it.
- Browser check with headless Chromium: care-context link, fetch under a mock-granted consent and acceptance of the received record. The first browser setup used approval references shorter than the three-character minimum and was refused as designed; with valid references the flow passed with no console errors.
- Nothing was sent to ABDM; the encryption is Saha's own and is not validated against ABDM.
- Assessment changes: BR-INT-18 and BR-INT-19 moved from not-built to partial, each stating mock-only. Counts are now 14 implemented-local, 147 partial, 6 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 2b — visit media — 30 September 2026 IST (30 September UTC)

- **2,126 automated assertions passed:** 1,487 HTTP/D1 (1,452 plus 35 media checks), 618 contract/checkpoint (613 plus 5 media contract checks) and 21 encrypted restore checks over 31 SQLite tables including media. Reports: `tests/evidence/slice-2b/`.
- The first full run stopped after an over-limit upload: the refusal left the body unread and the local Worker restarted on the next request (the behaviour first seen in R10 and fixed for JSON bodies in slice 0c). Upload bodies are now drained up to 1 MB before refusal; the rerun passed.
- Browser check with headless Chromium: a real 40 × 40 PNG attached to a draft visit and rendered from the playback route. The first browser attempt could not find the upload control because it was only on confirmed visits; the panel was moved to the draft visit screen and the full suite was rerun after that change.
- Assessment changes: BR-DATA-08 moved from not-built to partial. Counts are now 14 implemented-local, 148 partial, 5 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6e — accessibility audit — 30 September 2026 IST (30 September UTC)

- **Automated accessibility audit (axe-core 4.13.0, WCAG 2.0/2.1/2.2 A and AA tags, headless Chromium, built local Worker, synthetic owner and ASHA):** 16 screens and dialogs. First run: one failing rule, `color-contrast`, 271 elements across all 16 screens. Second run: 38 elements, because the first stylesheet pass darkened two sidebar captions that already passed on the dark background. Third run, after restoring them and fixing inactive tab labels: no violations. Reports: `tests/evidence/slice-6e/a11y-audit-before.json` and `tests/evidence/slice-6e/a11y-audit-result.json`.
- **2,126 automated assertions passed** on the changed stylesheet: 1,487 HTTP/D1, 618 contract/checkpoint and 21 encrypted restore checks over 31 SQLite tables. Reports: `tests/evidence/slice-6e/`.
- Limits: automated rules cover part of WCAG only; no screen-reader, keyboard-only, zoom, reflow, representative-user or independent review was done; the field notebook, populated panels, error states, mobile viewports and Hindi screens were not audited. NFR-13 stays partial; counts are unchanged at 14 implemented-local, 148 partial, 5 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3a — offline media queue — 30 September 2026 IST (30 September UTC)

- **2,196 automated assertions passed:** 1,487 HTTP/D1, 688 contract/checkpoint (618 plus 70 field-notebook media queue checks) and 21 encrypted restore checks over 31 SQLite tables. Reports: `tests/evidence/slice-3a/`.
- The new client checks run `public/field/app.js` in Node with real Web Crypto and injected storage and network; they do not exercise IndexedDB. A separate headless-Chromium check with real IndexedDB queued a PNG offline, synced online, confirmed one upload, confirmed the sealed copy was deleted from the device and found the file on the server's draft visit, with no console errors (`tests/evidence/slice-3a/offline-media-browser.json`).
- During development, the first run of the new client checks stopped inside the test itself: the synthetic file generator exceeded the Web Crypto random-fill limit of 65,536 bytes. This was a test defect, fixed before the evidence run.
- Assessment changes: BR-OFF-04 moved from not-built to partial. Counts are now 14 implemented-local, 149 partial, 4 not-built and 9 unverified; all 176 formal acceptances remain pending. Provider revalidation, in-app capture, background upload and real-device testing are not done. The evidence text of BR-UX-03, BR-DATA-08, BR-OFF-06 and BR-OFF-08 was updated to reflect media playback, the offline queue and the media allowance; their status stays partial.

## Development slice 3b — field storage warnings — 30 September 2026 IST (30 September UTC)

- **2,224 automated assertions passed:** 1,487 HTTP/D1, 716 contract/checkpoint (688 plus 28 storage-warning checks) and 21 encrypted restore checks over 31 SQLite tables. Reports: `tests/evidence/slice-3b/`.
- The first run of the new checks failed on the test's own expectation of the usage text ("10.0 MB" where the page correctly prints "10 MB" at exactly 10 MB); the expectation was corrected.
- Browser check with headless Chromium: the page showed usage against a 408 MB allowance and reported that the browser did not agree to keep the data (headless Chromium refuses persistence). No console errors. `tests/evidence/slice-3b/storage-browser.json`.
- BR-OFF-08 evidence text updated; status stays partial. Counts unchanged at 14 implemented-local, 149 partial, 4 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 7c — pinned outbound FHIR validation — 30 September 2026 IST (30 September UTC)

- **2,248 automated assertions passed:** 1,489 HTTP/D1 (1,487 plus 2 validation-stamp checks), 738 contract/checkpoint (716 plus 20 validation contract checks and 2 ABDM deliberate-violation checks) and 21 encrypted restore checks over 31 SQLite tables. Reports: `tests/evidence/slice-7c/`.
- Changed existing tests: the slice 7b ABDM transfer contract compared the received bundle with the example collection; the mock HIP now sends documents, so that assertion was replaced by document checks (Composition first, patient, visit weight, stamp). The R11 EHR contract suites gained `fhir-validate` in their transpile file lists; their assertions are unchanged.
- Browser check with headless Chromium over the mock ABDM flow: the received record showed the validation stamp; all requests returned 200; no console errors.
- Assessment changes: BR-INT-17 moved from not-built to partial. Counts are now 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending. The rule set is a structural subset of FHIR R4, not NRCeS conformance.

## Development slice 6f — field, phone and keyboard accessibility — 30 September 2026 IST (30 September UTC)

- **Accessibility audit (axe-core 4.13.0, WCAG 2.0/2.1/2.2 A and AA tags):** 24 screens including the field notebook in English and Hindi and a 390 × 844 phone viewport; no violations before or after. **Keyboard walk** on two screens (29 focus stops each): before, one stop on each screen had no visible focus indicator; after, every stop showed one. Reports: `tests/evidence/slice-6f/`.
- The keyboard walk first flagged four stops; two were measurement artefacts (buttons read mid-transition). After adding a 250 ms settle the walk flagged two real stops ("Search people" in the workspace and the notebook date-time field's calendar button), which were fixed.
- **2,248 automated assertions passed** on the changed stylesheets: 1,489 HTTP/D1, 738 contract/checkpoint and 21 encrypted restore checks.
- NFR-13 evidence updated; status stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Slice 3b follow-up — storage line without editor rebuild — 30 September 2026 IST (30 September UTC)

- A self-review found that the slice 3b storage check re-rendered the whole field notebook editor when its estimate arrived after an action, which could move keyboard focus out of a field the worker had just entered. The late estimate now updates only the storage line.
- A new client assertion checks that the editor is not rebuilt by a late estimate; it fails on the slice 3b code and passes with the fix.
- **2,250 automated assertions passed:** 1,489 HTTP/D1, 740 contract/checkpoint (738 plus 2) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3b-followup/`.
- Also in this follow-up: the Operations page notice still said "Release 9"; it now says "Release 11 with development slices". The application build passed; no test asserts this text.

## Development slice 6g — computed operational alerts — 30 September 2026 IST (30 September UTC)

- **2,268 automated assertions passed:** 1,493 HTTP/D1 (1,489 plus 4 alert checks), 754 contract/checkpoint (740 plus 14 alert contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6g/`.
- Browser check with headless Chromium: a critical incident showed as a critical alert and "Show details" opened the service tab; no console errors. The first run of the check script reported failure because its own text pattern expected a separator the page does not render; the pattern was corrected and the check rerun. The accessibility audit (24 screens) still reported no violations.
- BR-OPS-04 and NFR-18 evidence updated; both stay partial (no delivery, acknowledgement or five-minute detection). Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3c — media queue hardening after independent review — 30 September 2026 IST (30 September UTC)

- A separate review agent, which had not written the code, reviewed every change after slice 2b and reported six findings (two medium, four low): a 2xx response without a media id treated as a confirmed upload, a lock-time send without a pending mark, removal of a synced copy deleting never-sent media, sealed copies left after failed deletes or saves, a weak supervisor alert-scope check, and misleading receipt-alert wording. All six were fixed; details in `docs/current/SLICE-3C-QUEUE-HARDENING.md`.
- **2,290 automated assertions passed:** 1,495 HTTP/D1, 774 contract/checkpoint (field media queue 70 → 90) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3c/`.
- Changed existing tests: the slice 3a assertion that removing a synced copy deletes queued media was replaced (that behaviour was the defect); the slice 6g alert action text assertion was updated to the new wording.
- Real-IndexedDB browser check repeated and passed. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6h — alert acknowledgement — 30 September 2026 IST (30 September UTC)

- **2,306 automated assertions passed:** 1,500 HTTP/D1 (1,495 plus 5 acknowledgement checks), 785 contract/checkpoint (774 plus 11) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6h/`.
- The replay path previously refused every `ops*` command from non-operators; acknowledgements are exempted and checked against the alert's owning role instead, so a supervisor's replayed acknowledgement is not wrongly refused.
- Browser check with headless Chromium: an owner acknowledged a critical incident alert and saw it marked with the note; no console errors. The accessibility audit (24 screens) still reported no violations.
- BR-OPS-04 evidence updated; it and NFR-18 stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3d — in-app voice-note recording — 30 September 2026 IST (30 September UTC)

- **2,334 automated assertions passed:** 1,500 HTTP/D1, 813 contract/checkpoint (785 plus 28 recording checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3d/`.
- The first runs of the new checks failed on the test itself (too short a wait for unlock, and a size-limit case that added up to 230 KB, under the 240 KB stop point); both were corrected before the evidence run.
- Browser check with headless Chromium's synthetic microphone and real IndexedDB: an offline 3.5-second recording was queued, then uploaded after sync as a 6,267-byte `audio/webm` voice note; the device copy was removed; no console errors.
- BR-UX-03 and BR-OFF-04 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3e — on-device photo reduction — 30 September 2026 IST (30 September UTC)

- **2,341 automated assertions passed:** 1,500 HTTP/D1, 820 contract/checkpoint (field media queue 90 → 97) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3e/`.
- The first full run failed one suite: the slice 3b storage-warning checks attach PNG files and their harness had no image decoder, so the new decode step refused them. An injected decoder and canvas were added to that harness (as in the media queue checks) and the full run was repeated.
- Changed existing tests: image-signature and image-size refusals in the media queue checks were moved to audio files, because photos are now decoded and re-encoded on the device instead of signature-checked; the stored and uploaded bytes are now compared with the re-encoded JPEG.
- Browser check with headless Chromium and real IndexedDB: a 5,724,852-byte camera-sized JPEG with a synthetic location string in its metadata was reduced to 226,943 bytes, uploaded after sync, and served back without the location string; no console errors.
- BR-OFF-04 evidence updated; stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3f — workspace photo reduction — 30 September 2026 IST (30 September UTC)

- **2,351 automated assertions passed:** 1,500 HTTP/D1, 830 contract/checkpoint (820 plus 10 photo contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3f/`.
- Browser check with headless Chromium: a 5,724,216-byte JPEG with a synthetic location string, attached in the online visit screen, was stored as a 226,584-byte JPEG, rendered, and served back without the location string; no console errors.
- BR-DATA-08 evidence updated; stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Merge into main — 30 September 2026 IST

- At the sponsor's instruction, pull requests #1–#34 (Releases 7–11, the R11 handover and development slices 0a–3f) were merged into GitHub `main` in order with merge commits. No branches were deleted and nothing was force-pushed. The resulting `main` tree is identical to the top of the stack (`slice-3f-workspace-photo-reduction`), whose CI and full local suites passed (2,351 assertions).
- No independent human review took place before the merge. Formal acceptance is unchanged: all 176 criteria remain pending, and `main` is not accepted for production or real patient use.
- GitHub reported a server error while merging #12; the merge commit had already reached `main` and GitHub recorded the pull request as merged a few minutes later. No merge was repeated.

## Development slice 3g — offline registration with ordered sync — 30 September 2026 IST (30 September UTC)

- **2,467 automated assertions passed:** 1,551 HTTP/D1 (1,500 plus 51 registration checks), 895 contract/checkpoint (830 plus 65 registration queue checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3g/`.
- The first run of the new registration queue checks failed on a harness error: arrays read from the notebook's VM context were compared structurally with arrays from the test's own context. Those comparisons now go through JSON; no product code changed. The first full run failed the new HTTP module where it loaded the administrator's workspace: an earlier module leaves that membership inactive. The role refusals were changed to post directly (each account is refused whatever its state) and a direct supervisor-role refusal was added.
- The registration queue checks transpile `lib/saha/field-registration.ts` and its imports (core, mis, programmes, types, continuity, access, referral-rules) to check every notebook body against the server schema.
- Browser check with headless Chromium and real IndexedDB: two registrations and a visit-draft edit made offline sent nothing; Sync all sent the registrations first, then the draft; the possible duplicate was reviewed on the device and synced; the server held the expected people, the draft visit with its referral request, and the edited draft; no console errors.
- BR-OFF-05 and BR-OFF-01 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 2c — source and time for each fact — 30 September 2026 IST (30 September UTC)

- **2,552 automated assertions passed:** 1,578 HTTP/D1 (1,551 plus 27 provenance checks), 953 contract/checkpoint (895 plus 41 provenance contract and 17 field provenance checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-2c/`.
- The first full run failed to load the new HTTP module: it declared a local `base` that clashed with the harness's `base` parameter. The local was renamed and the full run repeated; no product code changed.
- The new pure module `lib/saha/fact-provenance.ts` is imported by `core.ts`, so the 29 contract harnesses that transpile `core.ts` now also transpile it. Before the module was added to their lists they could not load (seen first on the field contract and slice 3g registration client); no assertion in those harnesses changed.
- Browser check with headless Chromium: a reported weight with an earlier time and a declined temperature were entered in the visit screen, saved, reviewed and confirmed; the stored entries, the review text and the FHIR example (earlier weight time, reported method, no temperature Observation) matched; no console errors.
- BR-DATA-02 evidence updated; stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3h — clinician action on field referral requests — 30 September 2026 IST (30 September UTC)

- **2,576 automated assertions passed:** 1,602 HTTP/D1 (1,578 plus 24 referral request checks), 953 contract/checkpoint and 21 encrypted restore checks. Reports: `tests/evidence/slice-3h/`. The new HTTP module passed on its first run.
- Browser check with headless Chromium: a clinician created a referral from a field request on a confirmed visit, with a changed facility; the panel showed the outcome and the server held one linked draft referral; no console errors.
- BR-OFF-05 evidence updated; stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 4b — unified action plan with ownership — 30 September 2026 IST (30 September UTC)

- **2,398 automated assertions passed:** 1,539 HTTP/D1 (1,500 plus 39 action-plan assertions), 838 contract/checkpoint (830 plus 8 action-plan contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-4b/`.
- First-run failures, both in the new tests and fixed there: the contract fixture used past dates where future ones were meant, so its expected item count was wrong (the plan was right); the HTTP module confirmed a visit after programme enrolment without answering the programme questions, which the existing confirmation rule correctly refused. The visit is now confirmed before enrolment. No existing test changed.
- Browser check with headless Chromium on the built Worker: the patient's Action plan panel showed an unowned referral with its queue; the owner assigned it from the panel and the gap cleared; no console errors (`tests/evidence/slice-4b/browser-action-plan.json`).
- BR-CARE-01 and BR-CARE-05 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6i — item-level exception queue — 30 September 2026 IST (30 September UTC)

- **2,432 automated assertions passed:** 1,566 HTTP/D1 (1,539 plus 25 exception-queue assertions and 2 that restore the administrator before the action-plan checks), 845 contract/checkpoint (838 plus 7 exception-queue contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6i/`.
- First-run failure: the new HTTP module expected the administrator to read the queue and got 403 because an earlier module (expansion) leaves the administrator suspended. The slice 4b administrator refusals had been passing for that reason rather than for the role. The action-plan module now reactivates the administrator first; its refusals still hold. The exception contract passed on its first run.
- Browser check with headless Chromium on the built Worker: the Operations exception queue listed an overdue referral with owner and recovery action; the kind filter, the row link and a direct `/?patient=&visit=` link each opened the patient's visit; an unknown record opened nothing; no console errors (`tests/evidence/slice-6i/browser-exception-queue.json`).
- BR-REP-01 and NFR-18 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6k — reconciled operational export — 30 September 2026 IST (30 September UTC)

- **2,449 automated assertions passed:** 1,576 HTTP/D1 (1,566 plus 10 export assertions), 852 contract/checkpoint (845 plus 7 export contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6k/`.
- First-run failure in the new HTTP module only: its helper for reading a CSV row skipped one character too few and kept the opening quote of the first value. Fixed in the test; the export was correct. The export contract passed on its first run.
- Browser check with headless Chromium on the built Worker: the CSV downloaded from the Operations page matched its manifest row count and SHA-256, its four control totals reconciled, and the on-screen confirmation showed the same checksum; no console errors (`tests/evidence/slice-6k/browser-export.json`).
- Accessibility audit (`tests/a11y-audit.mjs`, axe-core, headless Chromium) on the slice 6k build, which includes the slice 4b action-plan panel and the slice 6i exception queue: 24 screens, no violations; every keyboard focus stop on the two walked screens visible (`tests/evidence/slice-6k/a11y-audit-result.json`). The audited patient and Operations screens held little open work, so populated panels were not audited.
- BR-REP-05 evidence updated; stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Slice 6i follow-up — exception queue indexed by patient — 30 September 2026 IST (30 September UTC)

- A self-review after slice 6k found that the slice 6i exception queue scanned every submission, referral, visit and safety case once for each patient. Records are now indexed by patient once per read.
- A new contract check builds 30,000 patients, each with a submission, referral and visit, and requires the queue in under 2 seconds with 3,000 rows found and the first 500 returned. It took 36.4 seconds on the slice 6i code and fails there; it passes with the fix (the whole contract file runs in about 1.3 seconds).
- **2,450 automated assertions passed:** 1,576 HTTP/D1, 853 contract/checkpoint (852 plus 1) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6i-followup/`.
- Requirement statuses and counts unchanged.

## Development slice 6j — tamper-evident audit chain — 30 September 2026 IST (30 September UTC)

- **2,439 automated assertions passed:** 1,540 HTTP/D1 (1,500 plus 40 audit-chain checks), 878 contract/checkpoint (830 plus 48 audit-chain contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6j/`. Migration 0013 adds three columns and a unique index to `audit_events`; the restore drill passed unchanged over the new schema.
- `tests/storage-contract.mjs` and `tests/scoped-read-contract.mjs` now transpile `lib/saha/audit-chain.ts` because `store.ts` imports it; their counts are unchanged. `tests/database-fixtures.mjs` expects three audit events after a legacy migration instead of two (the genesis marker).
- First full run: the HTTP smoke used the shared administrator, who is suspended by an earlier module, and failed with a 403 at assertion 902. The smoke now invites the administrator into its own new organisation; the rerun passed. A later change turned an exhausted chain retry into a 409 (two more contract checks) and the full suite was run again.
- Browser check with headless Chromium: the activity log's Audit chain panel verified the chain as intact and downloaded a JSONL export whose sign-off digest matched its body; the genesis and export events appeared in the log; no console errors. The accessibility audit, extended to the activity log (25 screens), reported no violations.
- BR-SEC-08 and NFR-10 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5a — AI cost budgets and stopping unsent requests — 30 September 2026 IST (30 September UTC)

- **2,523 automated assertions passed:** 1,583 HTTP/D1 (1,540 plus 43 budget and stop checks), 919 contract/checkpoint (878 plus 41 budget contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5a/`. No migration; budgets live in the existing operations settings.
- `tests/governance-contract.mjs` and `tests/agent-contract.mjs` now transpile `lib/saha/ai-budget.ts` because `governance.ts` imports it; their counts are unchanged.
- First full run: the HTTP smoke expected 400 for an invalid budget amount; command validation returns 422. The expectation was corrected and the rerun passed.
- Browser check with headless Chromium: the owner set a $20.00 budget on the Operations page and the row showed "No cost rates: requests refused"; axe-core found no violations in the budget panel; no console errors. The accessibility audit (25 screens) reported no violations.
- The refusal path is exercised only by the contract suite with a fixture provider, because live providers are disabled in the HTTP sandbox.
- BR-AG-07 and BR-AI-12 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6l — safe logs check — 30 September 2026 IST (30 September UTC)

- **2,559 automated assertions passed:** 1,611 HTTP/D1 (1,583 plus 28 safe-logs checks), 927 contract/checkpoint (919 plus 8 safe-logs contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6l/`.
- `tests/run-api-smoke.mjs` now exposes the Worker's captured console output to smoke modules. The media smoke still removes media with the query-string reason, which remains accepted for compatibility.
- First run, before any fix: the safe-logs smoke passed (1,609 HTTP/D1) while media removal and indicator questions still used query strings, because the local development server does not print query strings. The move of that free text into request bodies comes from code review; the new contract guards it. A later run failed once because the smoke expected indicator results for a one-person village cohort; the cohort minimum refuses that over POST exactly as over GET, and the expectation was corrected.
- Browser check with headless Chromium: media removal from the visit screen and an indicator question on the Operations page worked, and no request URL carried the reason or question; no console errors. The accessibility audit (25 screens) reported no violations.
- BR-SEC-07 evidence updated; it stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Parallel build integration (slices 3g–6l) — 30 September 2026 IST

- Nine slices were built at the same time by three builders in separate worktrees from `parallel-base` (the configurable test port): lane A 3g, 2c and 3h; lane B 4b, 6i and 6k; lane C 6j, 5a and 6l. Each lane's own sections above record that lane's runs, on that lane's source only.
- Lane A was taken as built. Lane B and lane C slices were merged onto it in order (`int-4b-action-plan` … `int-6l-safe-logs`) with merge commits; no branch was rewritten. Conflicts in the command dispatch and replay chain, test imports, the CI loop, count sentences, the route paragraph in `docs/IMPLEMENTATION.md` and requirement files were resolved by keeping both sides; generated catalogues, traceability and baselines were rebuilt at each step.
- The first full run on the combined source failed five contract suites (action plan, exceptions, report export, audit chain, AI budget): lane B and C harnesses transpile `core.ts`, which imports the slice 2c `fact-provenance` module they had never seen. The integration chain was rebuilt with `fact-provenance` added to those harness file lists at each step; no assertion changed.
- The README slice list was garbled by the automatic merge in the 6j, 5a and 6l integration commits and is corrected in this commit.
- **2,883 automated assertions passed on the combined source:** 1,789 HTTP/D1, 1,073 contract/checkpoint and 21 encrypted restore checks. Reports: `tests/evidence/slice-integration-1/`.
- Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5b — provider self-service in a provider sandbox — 30 September 2026 IST (30 September UTC)

- **3,059 automated assertions passed:** 1,890 HTTP/D1 (1,789 plus 101 provider sandbox checks), 1,148 contract/checkpoint (1,073 plus 75 provider sandbox contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5b/`. No migration; the sandbox declaration, provider documentation and import origin live in the existing governance document, and the provider role in the existing membership role column.
- `governance.ts` imports the new module for types only, so the harnesses that transpile it (`governance`, `agent`, `ai-budget` contracts) are unchanged.
- First runs: the new contract suite failed three times on its own authoring (an import attempt without the sandbox state, raw local extraction scored without the output validator the evaluation runner applies, and the order of two refusal messages). The first full run failed one HTTP assertion: replaying the sandbox declaration was refused by the new sandbox gate, because the gate ran before the receipt was returned. The gate now lets a second declaration reach its handler, which refuses it with 409; the replay returns its receipt.
- Browser check with headless Chromium on the built Worker: the owner declared an empty organisation a sandbox from the Clinical governance page, a provider account joined, saw only Clinical governance, Activity log and Organisation & team, and saved documentation version 1 with a credential reference; no console errors. The first browser run reported one colour-contrast failure (4.08:1) on the Save documentation button while the pointer was still over it (the shared hover colour of default buttons); with the pointer moved away axe-core found no WCAG A/AA violations in the panel for either account. The shared hover colour was not changed in this slice. `tests/evidence/slice-5b/provider-sandbox-browser.json`.
- BR-AI-11 moves from not-built to partial. Counts are now 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5c — conflicting assistant values and inability to assess — 30 September 2026 IST (30 September UTC)

- **3,151 automated assertions passed:** 1,932 HTTP/D1 (1,890 plus 42 assistant quality and conflict checks), 1,198 contract/checkpoint (1,148 plus 50 assistant quality contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5c/`. No migration; assessments, conflicts and resolutions are stored on the assistant results inside visits.
- The agent version moved from `saha-agent-1.1.0` to `saha-agent-1.2.0` because the provider instructions and output schema changed. `tests/agent-smoke.mjs` pins the version and was updated deliberately; its other assertions are unchanged.
- First runs: the new contract suite failed once on its own authoring (it read the action plan as a list rather than the object with `items`). The first full run failed in the existing agent smoke on the pinned agent version (1.1.0 expected). The second failed in the new smoke: the shared test organisation registers a capability for the local provider in the governance suite, so an unregistered local request there is refused (409); the new smoke now uses its own organisation. The third run passed.
- Browser check with headless Chromium on the built Worker: the visit assistant showed an unable-to-assess result and both conflicts under the proposed value with no averaged value; apply stayed disabled until the explicit choice and a reason were given, and the applied result recorded the resolution; axe-core found no WCAG A/AA violations in the assistant panel; no console errors. It passed on its first run.
- BR-AG-08 and BR-AI-06 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5d — capability lifecycle, replacement and in-progress work — 30 September 2026 IST (30 September UTC)

- **3,265 automated assertions passed:** 2,021 HTTP/D1 (1,932 plus 89 lifecycle checks, 34 of them evaluation preparation and case commands), 1,223 contract/checkpoint (1,198 plus 25 lifecycle contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5d/`. No migration; `replacedBy` is a new optional field on governance packages and everything else is derived on read.
- `governance.ts` now imports `capability-lifecycle.ts`, so the five contract harnesses that transpile it list the new module; their counts are unchanged.
- First runs: the new contract suite failed once on its own fixture (it prepared an extraction on a confirmed visit, which the assistant refuses). The first full run failed in the new smoke, which read a package version from a stale governance response. The second full run passed the HTTP and contract suites but failed the restore drill: it compares the governance read with the stored packages after removing `issues` and `usable`, and the four new derived read fields made the comparison unequal. The drill now removes those fields too; the stored packages are unchanged. The third run passed.
- Browser check with headless Chromium on the built Worker: the AI capabilities tab showed the replaced revision with its replacement, use by status and in-progress work, and the active revision; axe-core found no WCAG A/AA violations; no console errors. It passed on its first run.
- BR-AI-04 evidence updated; it stays partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6m — organisation data exit — 30 September 2026 IST (30 September UTC)

- **2,951 automated assertions passed:** 1,820 HTTP/D1 (1,789 plus 31 data-exit checks), 1,110 contract/checkpoint (1,073 plus 37 data-exit contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6m/`. No migration.
- The contract suite exports a 1000-person synthetic organisation and re-imports it into a fresh migrated database: all 28 tables have equal row counts, loaded patients and visits are identical and the audit chain verifies at the same head. The run's figures are in `tests/evidence/slice-6m/data-exit-contract-result.json` (`thousandPersonExport`).
- First runs, before the fixes: the contract suite expected one command receipt, but each test commit also stores one (the expectation was corrected); its re-import failed a foreign key because member accounts were listed after memberships (the archive now lists accounts first, and the manifest order satisfies foreign keys). The HTTP smoke then failed four times: the shared organisation's chain is reported broken at the genesis seal because the retention suite inserts an old event without chain fields, so the smoke now requires the offline verifier to reach the same finding there and to pass completely on a new organisation; the verifier compared media rows as hex, but the application stores the media SHA-256 in base64 (the verifier and format notes now say so); account emails appeared where the application stores an email as the display name (the check now covers accounts whose display name differs from their email); and switching the owner to a new organisation broke the later restore drill, so the smoke switches back.
- Browser check with headless Chromium: the Organisation & team page's data export panel downloaded a tar archive with FHIR requested; the confirmation named the archive checksum prefix; `scripts/verify-export.mjs` passed all ten checks on the downloaded file; axe-core found no violations in the panel; no console errors.
- BR-OPS-07 and NFR-22 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 6n — environment separation and configuration check — 30 September 2026 IST (30 September UTC)

- **2,998 automated assertions passed:** 1,842 HTTP/D1 (1,820 plus 22 environment checks), 1,135 contract/checkpoint (1,110 plus 25 environment contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6n/`. No migration. The full suite passed on its first run.
- Seeded fixture people now carry `synthetic: true`; no existing suite needed a change for it.
- Local Worker check: the built Worker was served four times with `--var SAHA_ENVIRONMENT:<value> --var SAHA_EXTERNAL_APIS_ENABLED:true` and a fresh local database (production, training, staging, and the invalid value `Prod`). Production and the invalid value gave empty home organisations and refused live calls; training seeded six marked fixture people and refused live calls; staging seeded nothing and allowed live calls. The banner, pill and configuration panel showed each environment; axe-core found no violations in the banner or panel; no console errors. No real Site configuration was changed and nothing was deployed.
- BR-OPS-01 and BR-OPS-02 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 2d — controlled migration marking seeded fixtures — 30 September 2026 IST (30 September UTC)

- **3,048 automated assertions passed:** 1,870 HTTP/D1 (1,842 plus 28 fixture-migration checks), 1,157 contract/checkpoint (1,135 plus 22 fixture-migration contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-2d/`. No migration file; batches live in the existing operations settings and marks in the patient record. The full suite passed on its first run.
- The HTTP smoke removes the synthetic marks from a new account's fixtures directly in the local database to stand in for data created before slice 6n.
- Browser check with headless Chromium: the Organisation & team migration panel ran a dry run (six to mark), applied it with a reason (six marked, batch listed) and reversed it (none marked). The first run reported one colour-contrast finding captured while the panel was still updating after the reversal, because the script's wait matched static text; with the wait corrected, two runs found no violations in the dry-run, applied and reversed states. No console errors.
- BR-DATA-11 evidence updated; it stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Slice 6m follow-up — consistent audit chain end in the data export — 30 September 2026 IST (30 September UTC)

- The data export read its tables before verifying the chain, so an export taken while commands ran could hold chained events after the head in its manifest and fail offline verification. The chain is now verified and its head read first, later events are left out, and the manifest records `auditChain.exportedHead`, which `scripts/verify-export.mjs` checks against.
- **3,050 automated assertions passed:** 1,870 HTTP/D1, 1,159 contract/checkpoint (1,157 plus 2 data-exit contract checks: a command committed during the export, and a manifest claiming a later head) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6m-followup/`.
- First contract run failed the existing size-guard check: its stand-in database had no `first()` for the chain reads that now come first. The stand-in was extended; no assertion changed.
- Requirement statuses unchanged.

## Slice 6n follow-up — training practice plans — 30 September 2026 IST (30 September UTC)

- Found in review: the synthetic-record barrier refused executing a plan for a seeded fixture in training even when every recipient was a demonstration connector, which blocked the training practice the environment exists for. A plan whose recipients are all demonstration connectors is no longer treated as a destination; production still refuses demonstration connectors outright.
- **3,051 automated assertions passed:** 1,870 HTTP/D1, 1,160 contract/checkpoint (1,159 plus 1 environment contract check) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6n-followup/`.
- Requirement statuses unchanged.

## Development slice 6o — consent withdrawal and its downstream effects — 30 September 2026 IST (30 September UTC)

- **2,995 automated assertions passed:** 1,876 HTTP/D1 (1,789 plus 85 consent withdrawal checks and one more check each in the MIS and agent smokes), 1,098 contract/checkpoint (1,073 plus 25 consent contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-6o/`. No migration; the consent history is part of the patient document.
- Changed expectations: withdrawing permission with the switch now cancels a queued programme delivery and an unsent assistant request itself. `tests/mis-smoke.mjs` expects a send attempt to report "cancelled" and a manual cancellation to be refused as already done; `tests/agent-smoke.mjs` expects approval to report "cancelled" with no call. `tests/outreach-contract.mjs` now transpiles `consent.ts` and `abdm.ts`; its count is unchanged.
- First runs, before fixes: the contract expected 7 stopped items for the sharing withdrawal where 8 were correct (two ABDM artefacts); the first HTTP run was refused preparing a local assistant request (409) because the governance suite had placed the shared organisation's local assistant under capability review, so that part moved to a new organisation; the second posted the administrator's template review without the organisation header (404); the third expected three withdrawal revisions for the patient and found four, because blocking a plan also writes a visit revision, which is now asserted separately.
- Browser check with headless Chromium: withdrawal from the "Consent history" dialog recorded the event with a blocked plan and an accepted delivery listed as not recalled; axe-core found no violations in the dialog; no console errors. The accessibility audit (25 screens) reported no violations.
- BR-SEC-03 and NFR-26 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 1e — scoped, time-limited delegation — 30 September 2026 IST (30 September UTC)

- **3,080 automated assertions passed:** 1,939 HTTP/D1 (1,876 plus 63 delegation checks), 1,120 contract/checkpoint (1,098 plus 22 delegation contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-1e/`. No migration; delegations are kept in the organisation operations document.
- `tests/rights-contract.mjs`, `tests/action-plan-contract.mjs`, `tests/referral-contract.mjs` and `tests/exceptions-contract.mjs` now transpile `lib/saha/delegation.ts`; their counts are unchanged. The certified patient command count in `docs/IMPLEMENTATION.md` is corrected to 44 (slice 6o added `withdrawConsent` without updating it).
- First runs, before fixes: the contract found that a refused grant left an empty delegation list behind (now nothing is written on refusal), that the rights checks read the wall clock instead of the command time (now passed through), that the duplicate check came after the five-delegation limit, and that an owner who already holds supervision was offered as a delegate (now refused). The HTTP suite passed on its first full run. The first browser run showed the Operations page's own client-side gate refusing a reporting delegate although the server allowed the report; the page now also opens for a reporting delegation.
- Browser check with headless Chromium: an owner delegated reporting only to an invited clinician from the Organisation & team page; the clinician then saw the Operations page with the aggregate report (six people in scope) and no exception queue; axe-core found no violations in the panel; no console errors. The accessibility audit (25 screens) reported no violations.
- Service accounts were not added; the slice document records why. BR-ID-02 and BR-ID-09 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 4c — worker activity evidence for supervisors — 30 September 2026 IST (30 September UTC)

- **3,136 automated assertions passed:** 1,983 HTTP/D1 (1,939 plus 44 worker activity checks), 1,132 contract/checkpoint (1,120 plus 12 worker activity contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-4c/`. No migration and no new tracking; the summary is derived on read.
- First runs, before fixes: the contract expected a visit confirmed exactly seven days earlier at 06:00 to fall inside the 7-day period; the period starts at midnight six days back, so the expectation was corrected. The HTTP suite and the browser check passed on their first runs.
- Browser check with headless Chromium: the Care handover page showed the worker activity panel with the notice, definitions and one owner row (one performed visit, one wrong-patient visit with its reason); axe-core found no violations in the panel; no console errors. The accessibility audit (25 screens) reported no violations.
- BR-CARE-08 evidence updated; it stays partial. Counts unchanged at 14 implemented-local, 150 partial, 3 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Parallel build integration, round 2 (slices 5b–4c) — 30 September 2026 IST

- Ten slices were built at the same time by three builders in separate worktrees from `int-6l-safe-logs` (the round-1 top): lane A 5b, 5c and 5d; lane B 6m, 6n, 2d and the 6m/6n follow-ups; lane C 6o, 1e and 4c. Each lane's own sections above record that lane's runs, on that lane's source only.
- Lane A was taken as built. Lane B and lane C slices were merged onto it in order (`int2-6m-data-exit` … `int2-4c-worker-activity`) with merge commits; no branch was rewritten. No textual conflict needed a manual resolution in this round; generated catalogues, traceability and baselines were rebuilt at each step.
- The `agent-quality` contract harness from lane A transpiles `core.ts`, which imports the slice 1e `delegation` module from lane C. `delegation` was added to that harness's file list in the 1e integration commit; no assertion changed.
- Corrected in this commit: the automatic merge repeated "and" in the README slice list, and the route paragraph in `docs/IMPLEMENTATION.md` gave the wrong number. The route inventory lists thirty-six method/route handlers; lane A's provider-sandbox route had not been counted.
- **3,686 automated assertions passed on the combined source:** 2,296 HTTP/D1, 1,369 contract/checkpoint and 21 encrypted restore checks, with no failing suite on the first combined run. Reports: `tests/evidence/slice-integration-2/`.
- Counts: 14 implemented-local, 151 partial, 2 not-built and 9 unverified (BR-AI-11 moved from not-built to partial in slice 5d); all 176 formal acceptances remain pending.

## Development slice 0b-3 — paged patient lists and on-demand patient detail — 30 September 2026 IST (30 September UTC)

- **3,833 automated assertions passed:** 2,390 HTTP/D1 (2,296 plus 94 patient-directory checks), 1,422 contract/checkpoint (1,369 plus 53 patient-directory contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-0b3/`. No migration. Clients that do not ask for paging, including the field notebook and every earlier test, read exactly as before.
- First runs, before fixes: the HTTP smoke expected the sixth seeded person to be in Chronic care; the seeding rule puts that person in Maternal care, so the expectation was corrected (no product change). The contract passed on its first run. The first browser run counted directory rows before the first page had arrived and reported 0; the script now waits for the first row. The My work notice was reworded after that run.
- Local read-only probe (`tests/load-envelope.mjs`, `SAHA_LOAD_SUPERVISOR=1`, sizes 1,006 to 50,006, same machine and run): a whole-team supervisor's paged workspace read stayed at 34–39 ms and 5 KB and one patient's detail at 18–27 ms, while the unpaged read grew from 57 ms and 791 KB to 1,905 ms and 38.6 MB; the first 50-row list page stayed at 27–38 ms; a search matching many names grew to 149 ms at 50,006 because it scans the scope. Local machine only; hosted D1, Worker limits, concurrency and reference devices were not tested.
- Browser check with headless Chromium: a synthetic owner with 606 people in scope received a 4.5 KB workspace, saw the paged notice on My work, listed 50 then 100 people, found one by search, opened it on demand and started a visit from it; axe-core found no violations in the directory; no console errors.
- NFR-24 current text updated with the local measurements; it stays unverified. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3i — open field referral request queue — 30 September 2026 IST (30 September UTC)

- **3,880 automated assertions passed:** 2,416 HTTP/D1 (2,390 plus 26 referral request queue checks), 1,443 contract/checkpoint (1,422 plus 21 referral request queue contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3i/`. No migration and no new command.
- Exception rules move from 1.0.0 to 1.1.0 (one new kind, `referral-request-waiting`); the existing exception-queue smoke assertion on the rules version was updated to 1.1.0 and nothing else in it changed. The slice 6i contract passed unchanged.
- First runs: one expected ordering in the new contract was corrected while writing it, before its first run (a 60-hour request under emergency access sorts before a 48-hour one). The contract, the HTTP suite and the browser check then passed on their first runs.
- Browser check with headless Chromium: Care handover showed one long-waiting request with its reason and "Open visit to decide"; the link opened the visit and its request panel; the Operations exception queue showed the matching row; axe-core found no violations in the panel; no console errors.
- BR-CARE-04 and BR-OFF-05 current text and evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 3j — field notebook capacity of 200 visit drafts — 30 September 2026 IST (30 September UTC)

- **3,895 automated assertions passed:** 2,416 HTTP/D1 (unchanged), 1,458 contract/checkpoint/client (1,443 plus 15 field capacity client checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-3j/`. No migration and no server change.
- First run: the new capacity client test passed its 14 checks at the time, but measured Sync all of 200 drafts at 21.4 s with 201 workspace reads, because each draft re-read the workspace and saved the notebook for it. Sync all now reads the workspace once per organisation per run; the rerun took about 9.1 s with one read, and a 15th check asserts the single read. The eight existing field suites passed unchanged after the change.
- Browser check with headless Chromium at a phone viewport: 200 sealed drafts in real IndexedDB were unlocked, verified and listed in 328 ms on the build machine; no console errors. Build-machine timings, not a reference device or network.
- BR-OFF-08 and NFR-11 stay partial and NFR-12 stays unverified; their current text and evidence were updated. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Slice 0b-3 follow-up — paging header checked before commands — 30 September 2026 IST (30 September UTC)

- Found on review after slice 3j: a command with a malformed `x-saha-patient-window` header was committed and then answered 400 when the paged snapshot was built. The header is now checked before the command runs, and the workspace sends only ids in the accepted form. The patient-directory smoke adds one check (a command with 51 window ids is refused with 400 and starts no visit); it would have failed before the fix.
- **3,896 automated assertions passed:** 2,417 HTTP/D1 (2,416 plus 1), 1,458 contract/checkpoint/client and 21 encrypted restore checks, on the first run. The paged-directory browser check was rerun on this build and passed (50 then 100 rows, search, on-demand opening, a visit started, no axe violations, no console errors). Reports: `tests/evidence/slice-0b3-followup/`.
- No requirement status changed; counts remain 14 implemented-local, 151 partial, 2 not-built and 9 unverified.

## Development slice 5e — task time and attempt limits, and AI budget alerts — 30 September 2026 IST (30 September UTC)

- **3,726 automated assertions passed:** 2,297 HTTP/D1 (2,296 plus 1 timed-out decision refusal), 1,408 contract/checkpoint (1,369 plus 39 task-limit and budget-alert contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5e/`. No migration file; limits live in the capability manifest and the request record. `tsc --noEmit` reports no errors.
- First-run failures while writing the slice, before the full suite: `tests/alerts-contract.mjs` failed on its alert-rules version assertion (1.0.0), and `tests/operations-smoke.mjs` carried the same expectation; both now expect 1.1.0 because this slice adds rules. The new contract failed twice on its own fixtures: a use of exactly 80% (2.40 of 3.00) is 2.4000000000000004 in floating point and did not reach the near threshold, and the first fixture's next reservation already exceeded the budget, so the capability was correctly in the reached state. The fixtures were changed (budget 2.90, then 2.45 for the reached case); the rules were not. The full suite then passed on its first run.
- The harnesses that transpile `agent.ts` (`agent`, `agent-quality`, `ai-budget`, `capability-lifecycle`, `governance`, `provider-sandbox`) list the new `task-limits` module; their counts are unchanged.
- No browser check was run for this slice. The governance form fields and the visit's timed-out notice are covered only by type checking and the build.
- BR-AG-07, BR-AI-12 and BR-OPS-04 evidence updated; all stay partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5f — shadow operation of a reviewed capability revision — 30 September 2026 IST (30 September UTC)

- **3,823 automated assertions passed:** 2,348 HTTP/D1 (2,297 plus 51 shadow-operation checks), 1,454 contract/checkpoint (1,408 plus 46 shadow contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5f/`. No migration file; shadows live in the governance document. `tsc --noEmit` reports no errors after one fix (an untyped index into the not-run labels in the new panel).
- First full run failed: the HTTP suite stopped at the consent smoke with 422 "This release supports up to 10 organisations owned by one account", because the new shadow smoke created one more organisation as the owner account. The shadow smoke now creates its organisation with the clinician account and invites the owner account as the independent reviewer; the second full run passed. The first browser run failed in the script, which confirmed a visit without the required patient check; with it added the check passed. The new contract's first run failed on its own leak check, which searched the report for the word "Weight" that the field label contains; it now searches for the note text.
- Browser check with headless Chromium: the owner started a shadow from the AI capabilities tab, ran it after a visit was confirmed, and saw weight in agreement and temperature in disagreement; the slice 5e task-limit line showed on the same capability; axe-core found no violations in the tab and there were no console errors. `tests/evidence/slice-5f/shadow-browser.json`.
- BR-AI-04 and BR-AI-10 evidence updated; both stay partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 5g — provider and model history per capability — 30 September 2026 IST (30 September UTC)

- **3,839 automated assertions passed:** 2,351 HTTP/D1 (2,348 plus 3 provider-history checks in the capability lifecycle smoke), 1,467 contract/checkpoint (1,454 plus 13 provider-history contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-5g/`. No migration file; the history is derived on read. `tsc --noEmit` reports no errors. The new contract, the full suite and the browser check each passed on their first run.
- Browser check with headless Chromium: the AI capabilities tab showed the provider and model history table with the replaced and the active revision; axe-core found no violations in the tab and there were no console errors. `tests/evidence/slice-5g/provider-history-browser.json`.
- BR-AI-07 evidence updated; it stays partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.

## Development slice 2e — author and clinician verification for each measurement — 30 September 2026 IST (30 September UTC)

- **3,761 automated assertions passed:** 2,334 HTTP/D1 (2,296 plus 38 fact-verification checks), 1,406 contract/checkpoint (1,369 plus 37 fact-verification contract checks) and 21 encrypted restore checks. Reports: `tests/evidence/slice-2e/`. No migration; authors and reviews are part of the visit document.
- No existing assertion changed. The FHIR outputs of visits without authors or reviews are unchanged, so the slice 2c and 7c suites pass as before; the pinned rule set `saha-fhir-r4-document-structure` 1.0.0 is unchanged. The certified patient command count in `docs/IMPLEMENTATION.md` is now 45 (`verifyFact`); the route count is unchanged at thirty-six.
- The contract suite, the full HTTP suite and the browser check each passed on their first run.
- Browser check with headless Chromium: a second clinician opened the owner's confirmed visit, saw the recorder and "unverified" for three measurements, verified the weight and disputed the blood pressure with a reason; the panel and the stored reviews agreed; axe-core found no violations in the panel; no console errors.
- BR-DATA-02 evidence and text updated; it stays partial. Counts unchanged at 14 implemented-local, 151 partial, 2 not-built and 9 unverified; all 176 formal acceptances remain pending.
