# Saha tests and recovery for the next coding package

Prepared 10 October 2026 for the next coding session. These are proposed execution cases, all **Not run** in this documentation pass. The next package is a fresh bounded D01 baseline and defect-impact decision, then qualification of the existing D03 candidate. It is not a new implementation story or a replacement acceptance catalogue.

Current main was verified at `7668a03d97c1ae62174f09e65ccd5a5717120be6`. Re-read main and the existing `story/d03-routine-visit-20261010` candidate before execution. Its frozen D03 revision 1 SHA-256 is `f390d7c13d7794556115b04caed8982179d1fcfd18a81dda59d70f6f573758df`; A1–A10 remain unchanged. D03 covers SAHA-004, SAHA-006, SAHA-020, SAHA-021, SAHA-024 and SAHA-049. Original parent criteria and formal cases continue to govern their wider scope.

## Environment and evidence

Use the current [development guide](../DEVELOPMENT-AND-CI.md), [testing guide](../TESTING.md), actual `package.json`, `scripts/test.mjs`, catalogue and regression baseline. Older dated suite counts in prose are historical, not the size or success of the new run. Use Node 24 for `node:sqlite`, backup and filesystem APIs; retain the pinned package manager and lockfile. Do not install dependencies or start paid CI/provider/cloud work without applicable permission.

Run against a built local Worker with disposable synthetic D1 state and free loopback ports. `tests/lib/worker.mjs` creates and migrates its declared state; its `fresh` default recreates that state. Verify the path is disposable before calling it. The D03 candidate browser script uses port 9164 and `.wrangler/d03-synthetic-test`; it can replace that test state. Never point local dispatcher-model identity headers, fault triggers, test cleanup or restore at hosted data. Keep databases, backups, browser profiles, keys, credentials and raw patient content outside Git.

Retain one run manifest with source SHA and dirty-file status, frozen-spec hash, build/configuration hash, applied migration identities, Node/browser/device versions, fixture IDs, commands and exit codes, raw logs/result hashes, failures, exclusions and reviewer scope. Bind subsequent CI/review/live receipts to their exact source. A fresh run has its own output directory. Preserve earlier failed evidence and minimum assertion counts; do not recycle a previous report as a new success or merge overlapping author/reviewer totals into a count of unique cases.

## Synthetic fixtures

| ID | Construction and purpose |
| --- | --- |
| FX-D03-BASE | Disposable synthetic organisation A, active individually signed-in ASHA A, assigned existing `p_meena` and `p_farida`, owner, other ASHA and a separate organisation B. Use existing invite/join/assignment commands; owner is not a patient-scope bypass. |
| FX-D03-PACKS | Existing maternal, hypertension and TB synthetic compatible packs enrolled for the selected person, with captured pack/version identities. Include one semantically shared fact, distinct programme questions and a conditional question. Illustrative packs are not clinical policy. |
| FX-D03-DRAFT | One explicit server draft with known person/visit versions, measurement source/time, entered `100 lb` and corresponding canonical unit, notes, programme answer and explicit missing reason. Opening the context must not construct it. |
| FX-D03-FAULT | Explicit local-only failure injection: dropped acknowledgement after commit, unavailable transport before commit, stale version, readback failure after write, local audit-insert failure and changed authority. Remove injected faults after the case and record restoration. |
| FX-D03-REFUSAL | Anonymous, owner/non-ASHA, other tenant, unassigned person, foreign-person visit, suspended/reassigned actor, merged person and malformed selectors. Snapshot protected response content and clinical state before/after. |
| FX-D03-PHONE | Real Chromium at 360×640 and 390×844, keyboard-only input and 200% text; providers off. These are browser fixtures, not physical-phone acceptance. |
| FX-RECOVERY | Populated disposable API-suite database, encrypted backup to a new path, fresh separate restore path and a distinct loopback Worker port. Never overwrite an existing database or reverse historical migrations. |

Direct historical contract scripts may write tracked evidence; inspect their output paths, preserve original files and use an isolated run/candidate before execution. The current test runner restores its tracked result files; retain any new raw logs and failure receipts separately.

For refused commands, compare relevant patient/visit data and revisions, receipts and any external effects. Distinguish legitimate read/refusal audit from clinical mutation: a logged access attempt is not a forbidden clinical side effect. For uncertain writes, inspect authoritative state rather than assuming an error means no commit.

## Test layers and actual entry points

| Layer | Existing entry point | Qualification purpose and limit |
| --- | --- | --- |
| Static/source | `npm run typecheck`, `npm run build`, `python3 scripts/check-documentation.py`, `node scripts/audit-requirements.mjs --check`, `npm run test:catalogue` | Current build, source/docs/requirement/catalogue consistency. A build is not acceptance. |
| Unit/contracts | `npm run test:unit`; targeted `tests/fact-provenance-contract.mjs`, `tests/fact-reuse-contract.mjs`, `tests/programme-raw-key-contract.mjs`, `tests/value-ranges-context-contract.mjs`, `tests/access-audit-contract.mjs`, `tests/scoped-read-contract.mjs` | Pure capture, units, question identity, ranges, audit and scope invariants; inspect imports and current catalogue before selecting broader affected tests. Add D03-specific unit coverage only for an independently testable contract gap. |
| Native database/API | `npm run test:integration`; `tests/run-api-smoke.mjs`, `tests/lib/worker.mjs` and `tests/lib/migrate.mjs` | Built Worker requests against actual local D1/SQLite, applied migrations, durable revisions/receipts/audit and restart behavior. Mocked persistence alone cannot qualify these assertions. |
| D03 browser/backend | Candidate-only `node tests/smoke/routine-visit-browser.mjs` | Existing integrated local D03 test with real browser and SQL observations. It is absent from this main-based documentation checkout; inspect and run the sole existing candidate rather than inventing a successful main command. |
| Smoke | `npm run test:smoke`; `tests/smoke/local-smoke.mjs`, `tests/smoke/today-browser.mjs` | Build alive, ordinary entry/navigation and refusal paths retained; not full D03/parent acceptance. |
| Browser/accessibility | `npm run test:ui`, `tests/ui/playwright.config.mjs`; selected journey axe checks, plus `tests/a11y-audit.mjs` where its actual prerequisites are available | Keyboard/focus, phone layout, labels, zoom, accessible state announcements and current journeys. Inspect current dependency declarations rather than copying historical installation instructions. Physical device, language and frontline usability remain separate. |
| Security/privacy | `tests/nfr/authorisation-matrix.mjs`, `tests/nfr/identity-hardening.mjs`; D03-specific cases below | Server identity, active role, assignment, organisation and purpose, revocation, data minimisation, no-store and protected UI clearing. Supply-chain gate is `scripts/security-gate.mjs`; its network/paid prerequisites remain separately governed. |
| Performance | `tests/nfr/performance-budgets.mjs`, `tests/nfr/memory-growth.mjs`, `tests/nfr/load-burst.mjs`; separate encrypted-vault timing protocol | Existing connected route/load budgets detect regressions; they do not replace the original local-save p95 ≤500 ms. Local and connected clocks/data profiles stay separate. |
| Recovery | `npm run test:resilience`, `tests/recovery-drill.mjs`, `scripts/recovery.mjs` | Authenticated encrypted backup, refusal of tampered/wrong-key input and existing target, exact inventory restoration, append-only controls and restarted local reads. Full hosted RPO/RTO requires an authorised isolated target and actual evidence. |
| Regression/formal | `npm run test:regression`, `tests/regression-baseline.json`, `tests/quarantine.json`; `npm run test:uat` | Retain affected suite identities and minima, no silent quarantine. UAT commands validate registers/generated packs; they do not execute or accept the original 364 formal cases. |

## D03 case contracts

`CASE-D03-*` and `CASE-REC-*` identify proposed handoff cases only. They are distinct from native D03-T01–D03-T06 technical tasks and original source `TC-*` formal cases; they add no new native item or accepted criterion.

Every row below has result **Not run**. Retain actual raw results separately when executed; do not change these planned cases into an observed result by reference to an older suite. `GET /api/routine-visit` and the bounded `POST` exist on the D03 candidate, not on the verified main baseline.

| Case and gate | Fixture and action | Required oracle and prohibited effects |
| --- | --- | --- |
| CASE-D03-01 · A1/A5 | BASE: open `/today`, choose exact existing reference, open routine page and GET selected context without Start | Exact person and allowed selected/current visit only; visit count/revision unchanged. Read audit may append. No other person's details, legacy bulk workspace or implicit encounter. |
| CASE-D03-02 · A1/A4 | BASE: explicit Start with stable key, then same-key replay and explicit resume of existing draft | One logical draft and stable ID. Replay has no additional clinical version/receipt effect; existing draft is reused. Opening remains read-only. |
| CASE-D03-03 · A1/A2 | PACKS: render shared fact and distinct/conditional questions, save permitted answers | Shared semantics captured once; distinct meaning/condition remains distinct. Exact key, pack/version and answer author read back; no silent key collision or invented answer. |
| CASE-D03-04 · A2 | DRAFT: save entered `100 lb`, source/time and notes, then change canonical correction to `57.5 kg` | Entered/canonical unit and time/source correct for each state; trusted server author and exact person/visit/pack preserved. New correction does not retain contradictory old entered value. |
| CASE-D03-05 · A2/A6 | DRAFT: move between observation, programme, review and save stages with unsaved answers/missing reason | Values and explicit unknown/missing state remain visible; saving facts does not silently discard unsaved programme input. No default clinical value substitutes for unknown. |
| CASE-D03-06 · A3 | REFUSAL: foreign-person visit, wrong selected person, invalid/ambiguous value and stale version | Expected source-defined refusal; relevant clinical preimage unchanged and no external effect. Preserve the original conflict rather than silently correcting request IDs/version. |
| CASE-D03-07 · A3 | DRAFT: confirm with wrong patient/version or unresolved applicable capture problem; then a valid existing confirmation | Wrong check refuses without mutation. Valid check yields exact confirmed record under existing rules. Further ordinary save cannot overwrite confirmed history. |
| CASE-D03-08 · A4 | FAULT: commit save but drop acknowledgement, inspect read-only comparison, retry exact attempt | Original key and exact payload survive; one logical write/version/receipt. UI remains uncertain until authoritative reconciliation/readback, never blindly sends a new-key retry. |
| CASE-D03-09 · A4/A6 | FAULT: reuse original key with changed payload, and separately fail readback after a committed write | Changed-payload reuse refuses. Readback failure never announces Saved; it may leave a committed write and must reconcile the exact attempt. Do not infer rollback from transport error. |
| CASE-D03-10 · A5 | REFUSAL: anonymous, non-ASHA including owner, other tenant and unassigned person GET/POST | Server checks active role, organisation/assignment/purpose. Error projection reveals no protected content; no clinical mutation or recipient/model call. |
| CASE-D03-11 · A5 | REFUSAL: duplicate/unknown query keys, malformed IDs, oversized/invalid body, unsupported command, off-origin request | Existing parser/origin/body/command restrictions refuse as specified; no arbitrary dispatcher operation or off-origin destination reaches execution. |
| CASE-D03-12 · A5/A6 | BASE: view context; reassign person or change/suspend membership through authorised local fixture commands; read/save again | Current authority rechecked immediately, protected response absent and UI cleared on authoritative refusal. Old displayed identity or a local role flag cannot authorise writing. |
| CASE-D03-13 · A5 | Native DB: read and valid save; inspect durable read/write audit, revision and receipt. Inject local audit-insert failure for read, remove it afterwards | Durable evidence exists; failed read audit returns unavailable without protected projection. Classify any attempted write/readback failure using actual commit state; do not erase evidence or assert atomic rollback without proof. |
| CASE-D03-14 · A5 | BASE: inspect headers, logs, browser storage/cache/history, routine projection and request inventory | Responses no-store; unrelated plans/provider payloads absent. Patient bodies absent from general storage/logs. Request URL contains stable reference only where required; no secrets/provider call. |
| CASE-D03-15 · A6 | PHONE/FAULT: loading, zero-result, refusal, unavailable, offline, version conflict and uncertain write | States distinguish absence/refusal/unavailability. Unavailable/offline keeps current-page input while saying unsaved; comparison read does not overwrite it. Replacing unsaved input requires explicit action. |
| CASE-D03-16 · A7 | PHONE: keep model/integrations disabled and complete manual allowed path; capture all network requests | Manual capture/review/save works; no external model/provider request or invented approval/value. Local static resources stay within declared origin. |
| CASE-D03-17 · A8 | PHONE: both viewports, 200% text, keyboard through all relevant controls, focus after error/conflict, labels and state announcements | No horizontal page overflow; labelled controls and at least 44 px applicable touch targets; visible focus and usable ordered flow. Automated axe is supplemented by actual keyboard/state observations. |
| CASE-D03-18 · A9 | Real encrypted-vault write→read→decrypt timing under a predeclared synthetic payload/storage/device profile; connected save/readback measured separately | Original local-save p95 ≤500 ms, with raw timings/N/faults and exact boundary. Candidate's existing 100 transactions are a component witness, not D04 screen persistence, handset endurance or production SLA. Never substitute connected route budgets. |
| CASE-D03-19 · A9 | Native DB: restart same disposable Worker state after saved/readback; repeat exact operation and inspect persisted evidence | Correct record/version/receipt retained without duplicate mutation or lost audit; compare actual SQL inventory. Clear distinction between page-only unsaved input and persisted draft. |
| CASE-D03-20 · A9 | D01: fresh main/candidate checks and inherited #185/#186 impact; affected previous suites, build/types and exact published-head CI | Retain all failures; classify inherited versus candidate regression with scoped evidence. No lowered minima, removed case, silent quarantine or altered NFR to get green. Separate current diff/evidence review required. |
| CASE-D03-21 · A10 | Qualified isolated candidate after actual required checks/review/merge permission; observe existing host identity and authorised live synthetic journey | Merge SHA, deployed SHA/configuration and live review/save/readback/refusal receipts separately recorded. No completion from merge alone; no unauthorised role/data writes or copied D02 permission. |

## Recovery cases

All results **Not run**. These supplement the existing recovery drill; they do not overwrite it or certify a hosted recovery target.

| Case | Action | Oracle |
| --- | --- | --- |
| CASE-REC-01 | Back up populated disposable database to a new encrypted file; restore to a fresh path | Authenticated envelope contains no plaintext structured patient metadata; exact schema/table/content inventory matches after restoration. Keep encryption keys out of logs/Git. |
| CASE-REC-02 | Wrong passphrase, changed ciphertext, pre-existing backup path and pre-existing restore target | Refuse; no partial target or overwrite. Preserve original working database and history. |
| CASE-REC-03 | Start separate local Worker on restored state; read selected authorised record and inspect version, audit, receipts and assignments | Durable clinical and governance evidence retained; append-only audit/revision tampering still refuses. Restored state does not bypass current identity/scope. |
| CASE-REC-04 | Restart after a committed write/lost reply; recover exact operation using original key/receipt | One logical mutation and truthful uncertain/reconciled state. Backup or process restart never authorises a blind external retry. |
| CASE-REC-05 | D07 preparation: document topology, source/configuration, permitted target, RPO/RTO definitions and recovery steps | Plan complete with exact blocker/resume condition. Observed hosted recovery stays pending until the actual host owner grants target/mutation authority and the drill runs. |

## Execution order and decision

First inspect fresh sources, exact candidate/spec and D01/#185/#186 impact. Freeze the synthetic fixture and affected suite selection; run static/unit checks, built native DB/API/browser adverse cases and separate local timing. Resolve actual failures, then repeat only affected evidence at the final revision before current-head CI and separate diff/evidence review. Protect physical-device, clinical, partner and formal-UAT boundaries.

D03 delivery requires all A1–A10 and actual applicable permissions. A scoped unit/API result cannot accept its whole parent story. Full canonical product acceptance and formal UAT stay at their retained checkpoint **0/160** and **0/364** until genuine acceptance evidence changes them. D04/D05 preparation below may be documented now; implementation follows D03's complete gate.
