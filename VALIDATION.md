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
