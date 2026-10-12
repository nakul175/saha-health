<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the catalogue cases assigned to the ASHA worker role. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — ASHA worker

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

- **Who runs this:** invited by the owner with role ASHA and a care team; the owner must assign people to this worker.
- **What this role can do:** Directly assigned patients in the member's teams: visit capture, the field notebook, referral requests, reviewed care actions. No independent clinical credential (docs/current/06).
- **Navigation this role sees** (from lib/saha/navigation.ts): My work, People, Submissions, Outreach, Care handover, Organisation & team.

- **Cases:** 44. Default Blocked: 0.

| Run details | |
| --- | --- |
| Executor (name) | |
| Reviewer (a different name) | |
| Build (commit) | |
| Date | |
| Browser and version | |

## Case index

| Case | Title | Requirement (assessment) | Default result |
| --- | --- | --- | --- |
| TC-BR-UX-01-A | One task entry point acceptance | BR-UX-01 (partial) | Not run |
| TC-BR-UX-02-A | Clear patient and visit context acceptance | BR-UX-02 (implemented-local) | Not run |
| TC-BR-UX-03-A | Voice text and guided entry acceptance | BR-UX-03 (partial) | Not run |
| TC-BR-UX-04-A | Structured encounter summary acceptance | BR-UX-04 (partial) | Not run |
| TC-BR-UX-05-A | Language and accessibility acceptance | BR-UX-05 (partial) | Not run |
| TC-BR-UX-06-A | Status that reflects reality acceptance | BR-UX-06 (implemented-local) | Not run |
| TC-BR-UX-07-A | Resume interrupted work acceptance | BR-UX-07 (partial) | Not run |
| TC-BR-UX-08-A | Low literacy and field use acceptance | BR-UX-08 (partial) | Not run |
| TC-BR-UX-09-A | Explainable action review acceptance | BR-UX-09 (implemented-local) | Not run |
| TC-BR-ID-06-A | Local registration without national identifier acceptance | BR-ID-06 (implemented-local) | Not run |
| TC-BR-ID-07-A | Household and proxy boundaries acceptance | BR-ID-07 (partial) | Not run |
| TC-BR-DATA-01-A | Shared question assembly acceptance | BR-DATA-01 (implemented-local) | Not run |
| TC-BR-DATA-02-A | Source and timing for every fact acceptance | BR-DATA-02 (partial) | Not run |
| TC-BR-DATA-03-A | Speech extraction as a draft acceptance | BR-DATA-03 (partial) | Not run |
| TC-BR-DATA-04-A | Freshness and relevance acceptance | BR-DATA-04 (partial) | Not run |
| TC-BR-DATA-05-A | Validation without fabrication acceptance | BR-DATA-05 (partial) | Not run |
| TC-BR-DATA-06-A | Traceable amendments acceptance | BR-DATA-06 (partial) | Not run |
| TC-BR-DATA-07-A | Concurrent edits acceptance | BR-DATA-07 (partial) | Not run |
| TC-BR-DATA-08-A | Documents and media acceptance | BR-DATA-08 (partial) | Not run |
| TC-BR-PROG-02-A | Maternal health workflow acceptance | BR-PROG-02 (partial) | Not run |
| TC-BR-PROG-03-A | TB screening workflow acceptance | BR-PROG-03 (partial) | Not run |
| TC-BR-PROG-04-A | Hypertension follow-up workflow acceptance | BR-PROG-04 (partial) | Not run |
| TC-BR-PROG-05-A | Cross-programme scheduling acceptance | BR-PROG-05 (partial) | Not run |
| TC-BR-AG-06-A | Durable progress and recovery acceptance | BR-AG-06 (partial) | Not run |
| TC-BR-AG-10-A | Clinical workflow continuity without an LLM acceptance | BR-AG-10 (partial) | Not run |
| TC-BR-INT-03-A | Confirmed submission receipts acceptance | BR-INT-03 (partial) | Not run |
| TC-BR-INT-04-A | Duplicate prevention and uncertain outcomes acceptance | BR-INT-04 (partial) | Not run |
| TC-BR-INT-05-A | Partial completion across systems acceptance | BR-INT-05 (implemented-local) | Not run |
| TC-BR-OFF-01-A | Defined offline capability acceptance | BR-OFF-01 (partial) | Not run |
| TC-BR-OFF-02-A | Durable local capture acceptance | BR-OFF-02 (partial) | Not run |
| TC-BR-OFF-03-A | Controlled offline authority acceptance | BR-OFF-03 (partial) | Not run |
| TC-BR-OFF-04-A | Pending media and AI work acceptance | BR-OFF-04 (partial) | Not run |
| TC-BR-OFF-05-A | Safe synchronisation ordering acceptance | BR-OFF-05 (partial) | Not run |
| TC-BR-OFF-06-A | Revalidation of delayed actions acceptance | BR-OFF-06 (partial) | Not run |
| TC-BR-OFF-07-A | Shared and lost devices acceptance | BR-OFF-07 (partial) | Not run |
| TC-BR-OFF-08-A | Offline workflow capacity acceptance | BR-OFF-08 (partial) | Not run |
| TC-BR-CARE-05-A | Unified action plan acceptance | BR-CARE-05 (partial) | Not run |
| TC-BR-CARE-06-A | Safe communication preferences acceptance | BR-CARE-06 (partial) | Not run |
| TC-BR-SEC-02-A | Understandable notice and consent acceptance | BR-SEC-02 (partial) | Not run |
| TC-BR-SEC-03-A | Withdrawal and downstream effects acceptance | BR-SEC-03 (partial) | Not run |
| TC-BR-SEC-04-A | Sensitive data and proxy handling acceptance | BR-SEC-04 (partial) | Not run |
| TC-BR-RULE-01-A | No invented facts acceptance | BR-RULE-01 (partial) | Not run |
| TC-BR-RULE-02-A | Patient confirmation before commitment acceptance | BR-RULE-02 (partial) | Not run |
| TC-BR-RULE-04-A | Honest completion and cancellation acceptance | BR-RULE-04 (partial) | Not run |

## Cases

### TC-BR-UX-01-A — One task entry point acceptance

- **Requirement:** BR-UX-01 — One task entry point. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-01, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** Care handover, My work, People, Candidate ASHA routine visit (Today > Review routine visit; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The home screen groups tasks by person and encounter. Provider selection remains behind an eligible capability action." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The approved multi-programme journey completes through one authenticated workspace with no separate AI login or manual transfer of patient details.

**Known gaps** (assessment, remaining work for BR-UX-01): Validate the full journey with two independent real providers and programme destinations.

<details><summary>What the build does today (assessment, current state of BR-UX-01)</summary>

One authenticated patient workspace with programme and agent panels. Independent image-provider flow is available in the synthetic visit workspace and Connections screen. App-first slice: authenticated /app reuses the care workspace, with Today, People, Referrals, Sync and More; a browser phone preview is tested with synthetic data. Android Browser Helper source opens the same app, but APK/device verification remains pending. Guided ASHA Home adds three explicit English/draft-Hindi navigation choices and a follow-on record prompt; actual phone geometry, audited selection, unsaved Home and Back safeguards pass locally. Full step-by-step capture and representative worker training/usability remain pending. D02 isolated /today candidate reuses server scope and durable audit with a read-only identity-context projection; see docs/current/d02/SPECIFICATION.md and VALIDATION.md. Formal and representative-worker acceptance remain pending. D03 isolated routine candidate reuses current guided controls and four audited commands bound to one selected person;50 built synthetic backend/browser checks cover shared three-pack capture, provenance, lost committed acknowledgement, explicit conflict recovery and changed-authority refusal. Existing encrypted local component full-fixture p95 is separately measured under the unchanged500ms target; the connected screen does not acknowledge durable local work. Final CI/review/host gate and representative-device/worker/formal acceptance remain pending. See docs/current/d03/SPECIFICATION.md and EVIDENCE.json. Overnight recovery checkpoint (11 October 2026): originating organisation and unresolved exact-key continuity are repaired; a bounded audited higher-version/no-receipt disposition permits explicit stale recovery. Current source/evidence and the unresolved full-unit contention failure are in docs/current/d03/OVERNIGHT-RECOVERY-20261011.md. Local browser/component evidence is not full NFR, CI, hosted or formal acceptance. Overnight access/recovery checkpoint (11 October 2026): final consistent Routine/Today access checks, bounded ACCESS append liveness, original-organisation dispatch and original-account exact-attempt recovery have scoped native/browser and final203-unit/API/restore evidence. See docs/current/d03/OVERNIGHT-AUTHORITY-20261011.md and EVIDENCE-20261011-AUTHORITY.json. Current-head CI, complete applicable physical/reference-device NFR and hosted A10 remain pending; wider captured-member helper and formal acceptance are not closed. Integrated audit qualification (11 October 2026): current-membership append/postcheck and native excess-count witness pass fresh current305 full205/10791 guarded205; same-runtime canonical166/14529 passes guarded166 with one inherited media skip and excluded old13 unit fixture declared. All380 prior guard records remain exact. See docs/current/d03/AUDIT-GUARD-QUALIFICATION-20261011.md and EVIDENCE-20261011-AUDIT-GUARD.json for exact source/setup limits and saved Git receipts. Complete real UI/reference NFR02, originalNFR5, final-head CI, separate final review and A10 remain pending; physical/clinical/formal acceptance is unchanged. Current NFR checkpoint (11 October 2026): authorization63/0, classifier11/0 and native source-drift10/0 pass; load12/3 fails with360/400 slots complete under unchanged minima/budgets. Fixed1000 realUI control finishes8000 records, Routine p953132.309ms exceeds3s; desktop surrogate is not physical/R1 acceptance. Navigation proposal failed22/1 and is withheld, original Today unchanged. See docs/current/d03/NFR-CHECKPOINT-20261011.md and EVIDENCE-20261011-NFR-CHECKPOINT.json. Current-head CI/A9/A10 and formal criteria remain open; no implementation status is promoted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-02-A — Clear patient and visit context acceptance

- **Requirement:** BR-UX-02 — Clear patient and visit context. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-02, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** My work, People, Candidate ASHA routine visit (Today > Review routine visit; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Every patient-specific request carries person and encounter IDs validated against the active session context." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Patient-switch tests cannot attach the prior person's recording, answer or AI result to the next person.

**Known gaps** (assessment, remaining work for BR-UX-02): Representative wrong-person and field usability acceptance.

<details><summary>What the build does today (assessment, current state of BR-UX-02)</summary>

Patient-scoped views, dirty-form guards and version-bound confirmation; switching clears visit state. App-first bottom-tab navigation retains the existing dirty-form guard; browser Back handling is locally reviewed and verified; physical Android Back acceptance remains pending. Browser Back controller and actual Chromium checks now pass dirty-form keep/discard and scope-aware restoration; physical Android Back remains unverified. Guided ASHA Home adds three explicit English/draft-Hindi navigation choices and a follow-on record prompt; actual phone geometry, audited selection, unsaved Home and Back safeguards pass locally. Full step-by-step capture and representative worker training/usability remain pending. D02 isolated /today candidate reuses server scope and durable audit with a read-only identity-context projection; see docs/current/d02/SPECIFICATION.md and VALIDATION.md. Formal and representative-worker acceptance remain pending. D03 isolated routine candidate reuses current guided controls and four audited commands bound to one selected person;50 built synthetic backend/browser checks cover shared three-pack capture, provenance, lost committed acknowledgement, explicit conflict recovery and changed-authority refusal. Existing encrypted local component full-fixture p95 is separately measured under the unchanged500ms target; the connected screen does not acknowledge durable local work. Final CI/review/host gate and representative-device/worker/formal acceptance remain pending. See docs/current/d03/SPECIFICATION.md and EVIDENCE.json. Overnight recovery checkpoint (11 October 2026): originating organisation and unresolved exact-key continuity are repaired; a bounded audited higher-version/no-receipt disposition permits explicit stale recovery. Current source/evidence and the unresolved full-unit contention failure are in docs/current/d03/OVERNIGHT-RECOVERY-20261011.md. Local browser/component evidence is not full NFR, CI, hosted or formal acceptance. Overnight access/recovery checkpoint (11 October 2026): final consistent Routine/Today access checks, bounded ACCESS append liveness, original-organisation dispatch and original-account exact-attempt recovery have scoped native/browser and final203-unit/API/restore evidence. See docs/current/d03/OVERNIGHT-AUTHORITY-20261011.md and EVIDENCE-20261011-AUTHORITY.json. Current-head CI, complete applicable physical/reference-device NFR and hosted A10 remain pending; wider captured-member helper and formal acceptance are not closed. Integrated audit qualification (11 October 2026): current-membership append/postcheck and native excess-count witness pass fresh current305 full205/10791 guarded205; same-runtime canonical166/14529 passes guarded166 with one inherited media skip and excluded old13 unit fixture declared. All380 prior guard records remain exact. See docs/current/d03/AUDIT-GUARD-QUALIFICATION-20261011.md and EVIDENCE-20261011-AUDIT-GUARD.json for exact source/setup limits and saved Git receipts. Complete real UI/reference NFR02, originalNFR5, final-head CI, separate final review and A10 remain pending; physical/clinical/formal acceptance is unchanged. Current NFR checkpoint (11 October 2026): authorization63/0, classifier11/0 and native source-drift10/0 pass; load12/3 fails with360/400 slots complete under unchanged minima/budgets. Fixed1000 realUI control finishes8000 records, Routine p953132.309ms exceeds3s; desktop surrogate is not physical/R1 acceptance. Navigation proposal failed22/1 and is withheld, original Today unchanged. See docs/current/d03/NFR-CHECKPOINT-20261011.md and EVIDENCE-20261011-NFR-CHECKPOINT.json. Current-head CI/A9/A10 and formal criteria remain open; no implementation status is promoted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-03-A — Voice text and guided entry acceptance

- **Requirement:** BR-UX-03 — Voice text and guided entry. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-03, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** Care handover, My work, Person page and visit, Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Voice capture has visible start, stop, playback and discard actions; the same fields accept typed or guided input." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A user completes each pilot journey without using a microphone and can review or correct a voice-derived value before confirmation.

**Known gaps** (assessment, remaining work for BR-UX-03): Real-device recording quality and interruption handling, recognizer accuracy in Hindi and English on field phones, and complete common workflow coverage with representative workers.

<details><summary>What the build does today (assessment, current state of BR-UX-03)</summary>

Structured/text capture and gated on-device speech transcript review. Slices 2b and 3a: attached voice notes play back in the visit and can be deleted from drafts or discarded from the device queue. Slice 3d: voice notes recorded in the field notebook (24 kbps, up to 60 s) and queued offline. Slice 12a: a microphone on every text and number field of the workspace and the field notebook; one tap listens once, what was heard is reviewed and inserted only on request, and nothing is saved by speaking. On-device speech where the browser has it; the browser speech service only when an owner allows it in the synthetic or training environment.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-04-A — Structured encounter summary acceptance

- **Requirement:** BR-UX-04 — Structured encounter summary. Assessment: **partial**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-04, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-UX-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The summary has confirmed facts, unresolved facts, recommendations and external actions as four distinct groups." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Usability participants can identify the next required step and each unresolved field without searching a transcript.

**Known gaps** (assessment, remaining work for BR-UX-04): Representative usability evidence that workers find unresolved steps reliably.

<details><summary>What the build does today (assessment, current state of BR-UX-04)</summary>

Facts, missing programme questions, action previews and separate receipts are shown. Guided ASHA Home adds three explicit English/draft-Hindi navigation choices and a follow-on record prompt; actual phone geometry, audited selection, unsaved Home and Back safeguards pass locally. Full step-by-step capture and representative worker training/usability remain pending.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-05-A — Language and accessibility acceptance

- **Requirement:** BR-UX-05 — Language and accessibility. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-05, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** Care handover. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Language is a user preference; concepts and numeric values are language-neutral. Reviewed clinical strings have version IDs." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The same encounter retains meaning across supported languages and passes the defined accessibility and language-specific task tests.

**Known gaps** (assessment, remaining work for BR-UX-05): Qualified translator review of all Hindi text; translate the remaining workspace panels and views; user testing of the Hindi screens with ASHAs; complete reviewed localisation and accessibility/language acceptance.

<details><summary>What the build does today (assessment, current state of BR-UX-05)</summary>

Hindi/English field notebook (slice 6f). Slice 10j: each member can choose English or Hindi for the workspace (saved for the member in the organisation) from a message catalogue of about 400 strings, with a draft Hindi translation of the ASHA journey screens (My work, patient page, visit capture, Review & act, Receipts, clinical review panel, navigation) and a visible notice on every Hindi screen that the text is an unreviewed draft. Protocol text, record contents, programme names, units and numbers are not translated; sign-off, verification, unusual-value confirmation, referral, media, supervisor and administration panels are still English. Guided ASHA Home adds three explicit English/draft-Hindi navigation choices and a follow-on record prompt; actual phone geometry, audited selection, unsaved Home and Back safeguards pass locally. Full step-by-step capture and representative worker training/usability remain pending.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-06-A — Status that reflects reality acceptance

- **Requirement:** BR-UX-06 — Status that reflects reality. Assessment: **implemented-local**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-06, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-UX-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Show one state per destination plus a separate encounter-save state. Completion derives from required actions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Simultaneous success in one programme and failure in another produces separate visible statuses and a specific recovery action.

**Known gaps** (assessment, remaining work for BR-UX-06): Real destination and device-state acceptance.

<details><summary>What the build does today (assessment, current state of BR-UX-06)</summary>

Local, server, queued, uncertain and destination-specific states remain separate. The app sync centre explicitly separates encrypted device drafts from programme submissions and never infers a zero queue from a locked notebook.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-07-A — Resume interrupted work acceptance

- **Requirement:** BR-UX-07 — Resume interrupted work. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-07, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** Care handover, Person page and visit. Not in this role's navigation: Connections. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Persist a draft revision after each committed field change and store the last completed workflow step." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): App restart, incoming call and network-loss scenarios retain every field previously shown as durably saved.

**Known gaps** (assessment, remaining work for BR-UX-07): Physical-device crash, incoming-call, eviction and network-loss acceptance; broader offline caseload and native Android qualification remain.

<details><summary>What the build does today (assessment, current state of BR-UX-07)</summary>

Server drafts, local encrypted drafts and command replay support restart recovery. App-first A02 adds a public locked offline /app shell sharing the unchanged encrypted field vault: current prepared visits, capture and sync; account/packet-owner/lifetime gates, ciphertext-only storage and public-only caches; weight and notes survive actual offline browser reload. Synced visits remain unconfirmed until online review. The app view does not claim a full offline caseload or approved-guidance cache. Independent A02 review fixed actual withdrawn-assignment disclosure: connected unlock and reconnect recheck every current prepared patient in its original organisation; positive refusal/login redirect locks and redacts, while unreachable transport retains only bounded signed offline access. Prepared and registration copy recovery now retains originating-account encrypted proof and exact observed receipt variants without blind clinical resend. Shared field hooks preserve latest-book receipt/tombstone state under queued writes and account transitions.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-08-A — Low literacy and field use acceptance

- **Requirement:** BR-UX-08 — Low literacy and field use. Assessment: **partial**. Target R14. Priority Should, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-08, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-UX-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Critical actions use short labels and text plus icon status. Optional audio guidance stops before private playback." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Representative workers complete the principal tasks under the defined field usability protocol, including noisy and private-entry conditions.

**Known gaps** (assessment, remaining work for BR-UX-08): On-demand audio guidance and representative low-literacy field evaluation.

<details><summary>What the build does today (assessment, current state of BR-UX-08)</summary>

Guided forms and textual status cues exist.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-UX-09-A — Explainable action review acceptance

- **Requirement:** BR-UX-09 — Explainable action review. Assessment: **implemented-local**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-UX-09, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-UX; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-UX-09: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-UX-09; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Approval review lists purpose, recipient and exact record revisions. The worker can exclude an optional action." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A worker can exclude one proposed destination or edit one fact before confirming the remaining permitted action bundle.

**Known gaps** (assessment, remaining work for BR-UX-09): Partner-specific payload comprehension and recipient exclusion acceptance.

<details><summary>What the build does today (assessment, current state of BR-UX-09)</summary>

Destination selection and exact payload review precede approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-06-A — Local registration without national identifier acceptance

- **Requirement:** BR-ID-06 — Local registration without national identifier. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-06, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** ASHA worker. Basis: local registration happens at the point of care.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Create a local UUID before external linking. Required local demographics permit explicit unknown where programme rules allow." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A person lacking all three completes an eligible pilot encounter without a fabricated external identifier.

**Known gaps** (assessment, remaining work for BR-ID-06): Pilot acceptance with the approved local identity process.

<details><summary>What the build does today (assessment, current state of BR-ID-06)</summary>

Local registration and visits do not require ABHA, phone or biometrics.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-07-A — Household and proxy boundaries acceptance

- **Requirement:** BR-ID-07 — Household and proxy boundaries. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-07, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** ASHA worker. Basis: household sharing previews and proxy records are used from a person's page by the worker who holds that person.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-07: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Proxy relationship includes relationship type, authority scope and evidence; household membership does not populate access grants." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A caregiver and household head can receive only the information permitted by the relevant relationship and authorisation rules.

**Known gaps** (assessment, remaining work for BR-ID-07): Household relationships and purpose-limited, expiring proxy authority.

<details><summary>What the build does today (assessment, current state of BR-ID-07)</summary>

Slice 1: households with dated membership history; proxy grants recorded on the subject with relationship, purposes, allowed sensitive classes, evidence and expiry. Membership grants no staff access or disclosure; household sharing previews include only members with a current grant. Slice 6r: the sharing preview names only members inside the viewer's care scope, even when a member has granted the recipient a proxy; others are counted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-01-A — Shared question assembly acceptance

- **Requirement:** BR-DATA-01 — Shared question assembly. Assessment: **implemented-local**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-01, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** Candidate ASHA routine visit (Today > Review routine visit; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Question equivalence requires the same semantic concept, person, episode, time window, unit and permitted purpose." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The approved three-programme fixture asks each shared concept once and retains every distinct mandatory programme-specific question.

**Known gaps** (assessment, remaining work for BR-DATA-01): Owner-approved programme fixtures and field validation.

<details><summary>What the build does today (assessment, current state of BR-DATA-01)</summary>

Pinned programme questions deduplicate shared concepts and preserve distinct answers. D03 isolated routine candidate reuses current guided controls and four audited commands bound to one selected person;50 built synthetic backend/browser checks cover shared three-pack capture, provenance, lost committed acknowledgement, explicit conflict recovery and changed-authority refusal. Existing encrypted local component full-fixture p95 is separately measured under the unchanged500ms target; the connected screen does not acknowledge durable local work. Final CI/review/host gate and representative-device/worker/formal acceptance remain pending. See docs/current/d03/SPECIFICATION.md and EVIDENCE.json. Overnight recovery checkpoint (11 October 2026): originating organisation and unresolved exact-key continuity are repaired; a bounded audited higher-version/no-receipt disposition permits explicit stale recovery. Current source/evidence and the unresolved full-unit contention failure are in docs/current/d03/OVERNIGHT-RECOVERY-20261011.md. Local browser/component evidence is not full NFR, CI, hosted or formal acceptance. Overnight access/recovery checkpoint (11 October 2026): final consistent Routine/Today access checks, bounded ACCESS append liveness, original-organisation dispatch and original-account exact-attempt recovery have scoped native/browser and final203-unit/API/restore evidence. See docs/current/d03/OVERNIGHT-AUTHORITY-20261011.md and EVIDENCE-20261011-AUTHORITY.json. Current-head CI, complete applicable physical/reference-device NFR and hosted A10 remain pending; wider captured-member helper and formal acceptance are not closed. Integrated audit qualification (11 October 2026): current-membership append/postcheck and native excess-count witness pass fresh current305 full205/10791 guarded205; same-runtime canonical166/14529 passes guarded166 with one inherited media skip and excluded old13 unit fixture declared. All380 prior guard records remain exact. See docs/current/d03/AUDIT-GUARD-QUALIFICATION-20261011.md and EVIDENCE-20261011-AUDIT-GUARD.json for exact source/setup limits and saved Git receipts. Complete real UI/reference NFR02, originalNFR5, final-head CI, separate final review and A10 remain pending; physical/clinical/formal acceptance is unchanged.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-02-A — Source and timing for every fact acceptance

- **Requirement:** BR-DATA-02 — Source and timing for every fact. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-02, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** Person page and visit, Organisation & team, Candidate ASHA routine visit (Today > Review routine visit; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Each observation includes effective_at, recorded_at, source_type, verification, author and either value or absent_reason." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Each destination field can be traced to the confirmed source fact or a documented transformation; missing data is never converted to a negative finding.

**Known gaps** (assessment, remaining work for BR-DATA-02): Disputes raised in the verification review (slices 2e and 2g) are a clinician's review and still do not stop sending (only a dispute raised in the slice 10g form does); an answer dispute stops every programme destination because no mapping carries answers yet; ABDM transfer, aggregate reports and receipt lookups are not gated by disputes or sign-off; a blocked send raises no exception-queue item or notification; coded FHIR provenance (authors, reviews, disputes and sign-off are not in FHIR or programme payloads); destination-approved per-measurement transformation/conformance semantics; unification of visit and programme absence reasons; coded methods.

<details><summary>What the build does today (assessment, current state of BR-DATA-02)</summary>

"Visits record source/time; programme answers retain author and explicit absence values. Slice 2c: each measurement may carry its own source (measured or reported) and observation time, or a separate missing reason (not asked, declined, unknown, not applicable), checked on every save path and carried into FHIR observation times, methods and narratives; older visits fall back to the visit-level values. Slice 2e: each measurement records who recorded it (account and role from the server identity, never from the request; older facts show ""not recorded"") and a verification state (unverified, verified or disputed by a clinician with time and reason), changed only by an appended, audited, scope-checked clinician review on a confirmed visit, shown on the visit screen and carried into FHIR notes and performers. Slice 2g: the visit notes and each programme answer also record who recorded them (server identity and role at save time; older entries ""not recorded"") and a clinician verification state changed only by an appended, audited, scope-checked review on a confirmed visit; an owner can require supervisor sign-off before programme submissions are sent, recorded by a supervisor of the patient's team or a supervision delegate, bound to the visit's facts and answers so any later change makes it stale, and checked on the server before executePlan and again inside the delivery checkpoint; shown on the visit screen and the submissions view. Slice 6z: on a visit with no recorded entry or measurement author (recorded before slices 2e and 2g), the confirmer and, for a programme answer, the person who saved the answers are treated as authors, so they cannot verify their own entries; the person who saved the programme answers cannot sign the visit off. Slice 10g: a care-team member in normal scope (an ASHA only for an assigned patient) can raise a dispute on one confirmed measurement, the visit notes or one programme answer, with a reason and a reference; while it is open on a current visit, no programme plan or EHR publication that would carry the item is prepared, approved or run, the reason is shown, and the same check is repeated on a fresh read inside the delivery and publication checkpoint so a dispute raised between the checkpoint and the request stops the request and closes the item as not sent; a clinician in scope resolves it by appending evidence (closing it as standing needs a clinician who neither recorded the item nor raised the dispute), and the dispute and the original value stay on the record; a correction draft carries still-open disputes forward. An owner can set the sign-off requirement per programme and per destination (versioned with the organisation default, audited; a destination rule wins over programme rules, which win over the default, and the default covers programme destinations only), and a supervisor of the patient's team can withdraw a current sign-off with a reason, which holds sending until a supervisor signs the visit off again whatever the rules say. Nothing already sent is recalled; the screens say so. App-first B07 adds explicit per-measurement source, observation time and canonical-unit MIS selectors with existing provenance fallback and server-pinned internal mapping revisions; reviewed impact/publication preserves approved wire bodies. D03 isolated routine candidate reuses current guided controls and four audited commands bound to one selected person;50 built synthetic backend/browser checks cover shared three-pack capture, provenance, lost committed acknowledgement, explicit conflict recovery and changed-authority refusal. Existing encrypted local component full-fixture p95 is separately measured under the unchanged500ms target; the connected screen does not acknowledge durable local work. Final CI/review/host gate and representative-device/worker/formal acceptance remain pending. See docs/current/d03/SPECIFICATION.md and EVIDENCE.json. Overnight recovery checkpoint (11 October 2026): originating organisation and unresolved exact-key continuity are repaired; a bounded audited higher-version/no-receipt disposition permits explicit stale recovery. Current source/evidence and the unresolved full-unit contention failure are in docs/current/d03/OVERNIGHT-RECOVERY-20261011.md. Local browser/component evidence is not full NFR, CI, hosted or formal acceptance. Overnight access/recovery checkpoint (11 October 2026): final consistent Routine/Today access checks, bounded ACCESS append liveness, original-organisation dispatch and original-account exact-attempt recovery have scoped native/browser and final203-unit/API/restore evidence. See docs/current/d03/OVERNIGHT-AUTHORITY-20261011.md and EVIDENCE-20261011-AUTHORITY.json. Current-head CI, complete applicable physical/reference-device NFR and hosted A10 remain pending; wider captured-member helper and formal acceptance are not closed. Integrated audit qualification (11 October 2026): current-membership append/postcheck and native excess-count witness pass fresh current305 full205/10791 guarded205; same-runtime canonical166/14529 passes guarded166 with one inherited media skip and excluded old13 unit fixture declared. All380 prior guard records remain exact. See docs/current/d03/AUDIT-GUARD-QUALIFICATION-20261011.md and EVIDENCE-20261011-AUDIT-GUARD.json for exact source/setup limits and saved Git receipts. Complete real UI/reference NFR02, originalNFR5, final-head CI, separate final review and A10 remain pending; physical/clinical/formal acceptance is unchanged. Bounded12October2026 increment: Correct effective-provenance author attribution; see docs/current/next50/PROGRAMME-20261012.md. Actual evidence and limits recorded separately; original formal acceptance remains unchanged."

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-03-A — Speech extraction as a draft acceptance

- **Requirement:** BR-DATA-03 — Speech extraction as a draft. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-03, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** My work, Person page and visit, Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Extraction stores original segment references and draft confidence markers; confirmation is an explicit separate command." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A test set containing negation, mixed language, background speakers and ambiguous quantities produces reviewable fields and no unconfirmed authoritative write.

**Known gaps** (assessment, remaining work for BR-DATA-03): Representative mixed-language/noisy-speaker corpus, broad ambiguity handling and correction-burden acceptance.

<details><summary>What the build does today (assessment, current state of BR-DATA-03)</summary>

Grounded field extraction checks exact quotes, full-clause ambiguity and field/value alignment; synthetic language-specific scoring. Slice 12a: dictated values go into a draft field only after review; a measurement box takes the first number heard and names the others, and when no digit is heard nothing is inserted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-04-A — Freshness and relevance acceptance

- **Requirement:** BR-DATA-04 — Freshness and relevance. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-04, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-DATA-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Freshness is evaluated from effective time against the active pack requirement, not server receipt time." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An expired measurement is excluded from a time-sensitive model call even if it is the latest value available.

**Known gaps** (assessment, remaining work for BR-DATA-04): Concept-specific reuse and quality policies across every programme/model, including clinical acceptance.

<details><summary>What the build does today (assessment, current state of BR-DATA-04)</summary>

New visits do not inherit old measurements; bounded protocol rules reject stale/future observations using reviewed freshness limits.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-05-A — Validation without fabrication acceptance

- **Requirement:** BR-DATA-05 — Validation without fabrication. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-05, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** Person page and visit, Organisation & team, Candidate ASHA routine visit (Today > Review routine visit; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Validation returns field paths and reason codes. Permitted outlier overrides require a scoped reviewer and reason." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Invalid units block submission; a permitted override retains the original value, reason and reviewer identity.

**Known gaps** (assessment, remaining work for BR-DATA-05): Approved clinical thresholds/terminology and production population policies; programme-answer range coverage and structured exchange of overrides; broader clinical, physical-device and phone accessibility acceptance.

<details><summary>What the build does today (assessment, current state of BR-DATA-05)</summary>

Numeric syntax, paired BP, date and programme evidence checks; stated alternative units (weight lb, temperature °F, cough duration weeks) converted on the server with the entered value kept; versioned placeholder expected and confirmation ranges labelled not clinically approved; a recorder reason outside the expected range and, beyond the confirmation range, confirmation by a different clinician before the visit is confirmed; overrides appended with who/when/why, audited, shown on the visit screen and review, kept through corrections and rechecked on replay (slice 2i). Slice 6ab: a clinician confirming an unusual value must not be the measurement's recorded author or the author of any override with the same value (rewording the reason or re-entering the value in another unit no longer lets the recorder confirm it). App-first A04 completes six online/notebook unit pickers, canonical read-only previews and original-quantity/source/override-author/range-version lineage through encrypted reload and draft sync; unknown entered fields now return controlled 422. Independent review reran 20 Chromium journeys and 126 conversion cases. Wider pinned patient-context protocol governance remains required software work; clinical ranges are not approved. Current governed range publications pin compiled policy/hash/context/intervals on new visits, imports and signed grants with exact-hash independent review, current reviewer authority and explicit stale-context refresh. Existing captures stay immutable; population examples remain synthetic/training only and clinical approval pending. CSV now accepts all six existing alternate units including BP kPa and weeks+days, preserving original/source/file/policy lineage. Phone first-tap Save defect found by independent review is fixed locally and being retested before publishing this batch. D03 isolated routine candidate reuses current guided controls and four audited commands bound to one selected person;50 built synthetic backend/browser checks cover shared three-pack capture, provenance, lost committed acknowledgement, explicit conflict recovery and changed-authority refusal. Existing encrypted local component full-fixture p95 is separately measured under the unchanged500ms target; the connected screen does not acknowledge durable local work. Final CI/review/host gate and representative-device/worker/formal acceptance remain pending. See docs/current/d03/SPECIFICATION.md and EVIDENCE.json. Overnight recovery checkpoint (11 October 2026): originating organisation and unresolved exact-key continuity are repaired; a bounded audited higher-version/no-receipt disposition permits explicit stale recovery. Current source/evidence and the unresolved full-unit contention failure are in docs/current/d03/OVERNIGHT-RECOVERY-20261011.md. Local browser/component evidence is not full NFR, CI, hosted or formal acceptance. Overnight access/recovery checkpoint (11 October 2026): final consistent Routine/Today access checks, bounded ACCESS append liveness, original-organisation dispatch and original-account exact-attempt recovery have scoped native/browser and final203-unit/API/restore evidence. See docs/current/d03/OVERNIGHT-AUTHORITY-20261011.md and EVIDENCE-20261011-AUTHORITY.json. Current-head CI, complete applicable physical/reference-device NFR and hosted A10 remain pending; wider captured-member helper and formal acceptance are not closed. Integrated audit qualification (11 October 2026): current-membership append/postcheck and native excess-count witness pass fresh current305 full205/10791 guarded205; same-runtime canonical166/14529 passes guarded166 with one inherited media skip and excluded old13 unit fixture declared. All380 prior guard records remain exact. See docs/current/d03/AUDIT-GUARD-QUALIFICATION-20261011.md and EVIDENCE-20261011-AUDIT-GUARD.json for exact source/setup limits and saved Git receipts. Complete real UI/reference NFR02, originalNFR5, final-head CI, separate final review and A10 remain pending; physical/clinical/formal acceptance is unchanged.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-06-A — Traceable amendments acceptance

- **Requirement:** BR-DATA-06 — Traceable amendments. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-06, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Amendment records supersedes_id and reason. Lineage locates dependent plans, model results and submissions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Correcting a key fact reveals all dependent AI results and submissions, marks invalidated outputs and creates the necessary reconciliation tasks.

**Known gaps** (assessment, remaining work for BR-DATA-06): Independent representative-scale validation, historical evidence completeness, external correction receipts, released indicator recomputation and formal acceptance remain pending. Canonical frozen edition regressions now cover bounded stored-material/reissue and supported cancellation software; broader downstream lineage, governed archival/capacity and official publication validation remain pending.

<details><summary>What the build does today (assessment, current state of BR-DATA-06)</summary>

Append-only revisions, linked amendments, voids and blocked stale plans. Slice 1c adds an identity-merge impact queue listing affected submissions, links, referrals, follow-ups, episodes, households and proxies. Slice 2j records, when a confirmed visit is amended or voided, one owned task per downstream output of that version (programme submissions, EHR publications, the plan, referrals, follow-ups, protocol evaluations, assistant results, shadow comparisons, worker activity, indicator release counts): work the server already refuses is recorded as invalidated, read-time computations as recomputed, the rest as review or correction tasks, shown in the action plan and exception queue and closed only with a verified receipt or a reason, audited. Slice 6ad (ninth review, finding 9): a visit with more than 60 downstream outputs can still be amended or voided; internal outputs past the cap are folded into one review task per kind with the count (every external output keeps its own task). Slice 13c: the shadow and drift reports recompute a corrected comparison on read (or leave it out for a void or an unconfirmed correction), so shadow-comparison correction tasks are recorded as recomputed or invalidated; released indicator figures stay open review tasks. App-first R27: one scoped correction/identity-merge reconciliation queue, audited current-scope assignment history and in-app acknowledgement notices, and deterministic historical backfill preview/apply with stale-plan and replay guards. App-first B27 captures immutable released populations, per-person counting material and pinned definitions; corrections leave original figures unchanged and prepare a parent-linked edition requiring independent review and current-authority publication. Derived reopened household follow-ups are counted consistently by live and newly frozen V3 material; historical editions and original completion fields remain unchanged. Frozen owner composite calculations retain canonical expression/examples and per-person primitive source lineage; supported void/reissue checks preserve original edition bytes and refuse unsafe dependency complements. Live/CSV post-audit revalidation refuses changed source/definition409. Wider impact discovery and protected reconstruction remain open.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-07-A — Concurrent edits acceptance

- **Requirement:** BR-DATA-07 — Concurrent edits. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-07, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Compare expected record version before commit. Store both candidate revisions and a conflict object on collision." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Two offline edits to the same observation produce a visible conflict with both versions, and no unsafe destination update is committed before resolution.

**Known gaps** (assessment, remaining work for BR-DATA-07): Representative concurrent offline edits and partner-origin clinical conflict resolution.

<details><summary>What the build does today (assessment, current state of BR-DATA-07)</summary>

Version/CAS conflicts and field comparison preserve both versions. Slice 0a: edits on different patients commit independently; same-patient edits still conflict for comparison. Reviewed local inbound-version queue preserves first source, independent review and current scope; actual retrieval retains changed-response candidates and rechecks service binding after response and before clinical use. Transport and coupled pressure provenance repairs are independently evidenced.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-08-A — Documents and media acceptance

- **Requirement:** BR-DATA-08 — Documents and media. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-08, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** ASHA worker. Basis: requirement area default (BR-DATA; catalogue owner "QA with Frontline worker and programme data owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-DATA-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Media progresses through uploaded, scanned, quality_checked and available. Extracted fields preserve source offsets." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A low-quality image cannot silently generate confirmed values; deleting an unsubmitted recording removes the associated draft references.

**Known gaps** (assessment, remaining work for BR-DATA-08): Object storage and larger media, clinical quality assessment of reduced photos, and a retention lifecycle for media on the server (offline queueing: slice 3a, BR-OFF-04).

<details><summary>What the build does today (assessment, current state of BR-DATA-08)</summary>

Slice 2b: photos and voice notes up to 256 KB on draft visits with type allowlist, signature and size checks, a required purpose, scoped playback and tombstoned deletion from drafts; immutable after confirmation. Slices 3e and 3f: photos reduced in the browser to JPEG under the limit, without embedded location metadata.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-02-A — Maternal health workflow acceptance

- **Requirement:** BR-PROG-02 — Maternal health workflow. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-02, catalogue owner "QA with Programme owner".
- **Run as:** ASHA worker. Basis: episodes are opened and followed up by the worker during visits.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-PROG-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Maternal records use an episode identifier and outcome state; unknown dates are stored as unknown with task follow-up." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Approved normal, uncertain, overdue, escalated and closed-episode scenarios follow the correct workflow and preserve episode identity.

**Known gaps** (assessment, remaining work for BR-PROG-02): Approved maternal symptoms, escalation, missed-visit/outcome logic and clinical scenario evidence.

<details><summary>What the build does today (assessment, current state of BR-PROG-02)</summary>

Maternal episodes and follow-ups plus a programme-scoped source-backed rule-review framework.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-03-A — TB screening workflow acceptance

- **Requirement:** BR-PROG-03 — TB screening workflow. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-03, catalogue owner "QA with Programme owner".
- **Run as:** ASHA worker. Basis: screening is captured by the worker during a visit.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-PROG-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "TB screening and programme registration are separate workflows with separate confirmation and receipt states." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A low-risk AI output cannot suppress a referral required by the approved symptom protocol, and an unresolved result remains visible for follow-up.

**Known gaps** (assessment, remaining work for BR-PROG-03): Approved TB protocol, tested urgent referral paths and non-suppressible clinical escalation.

<details><summary>What the build does today (assessment, current state of BR-PROG-03)</summary>

TB episodes and testing follow-up plus bounded protocol/worker-concern review without model dependency.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-04-A — Hypertension follow-up workflow acceptance

- **Requirement:** BR-PROG-04 — Hypertension follow-up workflow. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-04, catalogue owner "QA with Programme owner".
- **Run as:** ASHA worker. Basis: measurements are captured by the worker during a visit.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-PROG-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Measurements include device or observer, time, unit and context. Reported medicines are not signed prescriptions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Worker tests cannot issue or amend a prescription, and measurements retain unit, time, context and source.

**Known gaps** (assessment, remaining work for BR-PROG-04): Approved measurement/adherence context, schedules, escalation and independent clinical evidence.

<details><summary>What the build does today (assessment, current state of BR-PROG-04)</summary>

BP and medicine-access capture plus bounded, reviewed observation rules; no prescribing path.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-05-A — Cross-programme scheduling acceptance

- **Requirement:** BR-PROG-05 — Cross-programme scheduling. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-05, catalogue owner "QA with Programme owner".
- **Run as:** ASHA worker. Basis: the household visit plan is used by the worker who visits the household.
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Scheduling joins compatible tasks into a visit plan while preserving programme due dates and completion conditions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): One visit completes eligible shared tasks, leaves incomplete activities open and does not duplicate a referral merely because two packs identify it.

**Known gaps** (assessment, remaining work for BR-PROG-05): Approved privacy and timing rules (the late flag, the one-slot-per-item rule and the need catalogue are local defaults); packs do not declare referral needs or compatibility, so the worker names the need and the server matches it; referrals created before slice 10f carry no need and are never merged; plans exist only for people in a household; reminders/outreach for a slot and completing covered items from the visit remain separate software; physical/clinical timing acceptance is pending.

<details><summary>What the build does today (assessment, current state of BR-PROG-05)</summary>

Slice 1 adds a per-household view of each member's open items and a purpose-scoped sharing preview. Slice 10f adds a household visit plan (each in-scope member's open follow-ups, referrals and routine visit in one place; members outside the worker's scope are counted, never named) and household visit slots (householdVisitSchedule, householdVisitCancel) that cover chosen items of several members without changing any due date, owner or completion condition: an item stays open until its own record is resolved, items due before the slot date are shown as late, one item sits in one planned slot, and a slot holds only references, a date and a window (no free text). A confirmed visit's programme episodes can raise referral needs (createProgrammeReferrals): the same need, facility, person and visit become one referral that links every asking pack as a source and records which packs asked; a different need or facility stays a separate referral. Atomic original-planner rescheduling now preserves the prior slot and creates a linked replacement in one version-bound commit, checks every covered current person and purpose, and preserves due dates/owners/completion. Independent real Worker/phone review includes scope changes, role demotion, receipt/audit rollback, replay and slot-capacity checks. Reviewed explicit installed completion/referral declarations support selected covered-item visit lineage, independent compatibility and neutral slot-linked outreach; unmet and other-member work stays open, void derives unresolved work and replacement appends evidence.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-06-A — Durable progress and recovery acceptance

- **Requirement:** BR-AG-06 — Durable progress and recovery. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-06, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** ASHA worker. Basis: submissions are confirmed and sent by the worker from the visit.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Persist a checkpoint and action identity for each step. Resume reads receipts before selecting pending steps." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A failure after one destination accepts a record does not repeat that submission; the user sees and can recover only unfinished steps.

**Known gaps** (assessment, remaining work for BR-AG-06): Full multi-step dependency recovery with real destinations and operational owners.

<details><summary>What the build does today (assessment, current state of BR-AG-06)</summary>

Durable running checkpoints, receipts and no automatic repeat after ambiguous completion.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-10-A — Clinical workflow continuity without an LLM acceptance

- **Requirement:** BR-AG-10 — Clinical workflow continuity without an LLM. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-10, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** ASHA worker. Basis: the step is structured capture and drafting without a model.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-10: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-10; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Structured capture, cached approved guidance and draft referrals operate without a model dependency." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A simulated LLM outage leaves the core non-generative encounter workflow usable without substituting invented AI results.

**Known gaps** (assessment, remaining work for BR-AG-10): Approved outage pathways, offline cached protocols and device-level escalation acceptance.

<details><summary>What the build does today (assessment, current state of BR-AG-10)</summary>

Structured capture and current source-backed rule/referral review operate without a model. A05 adds signed prepared documentary task types and complete captured programme pack/version guidance, encrypted offline conditional answers and explicit absence reasons. New server-held work digests and captured episode/version checks apply before sync even if an older client omits its optional digest. Sync remains an unconfirmed draft; clinical approval remains pending.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-03-A — Confirmed submission receipts acceptance

- **Requirement:** BR-INT-03 — Confirmed submission receipts. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-03, catalogue owner "QA with Integration owner".
- **Run as:** ASHA worker. Basis: submissions are made from the visit's Review & act and Submissions screens.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Acceptance requires a verified destination business receipt linked to payload revision and action ID." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A response containing a business rejection is shown as rejected even when the network request technically succeeded.

**Known gaps** (assessment, remaining work for BR-INT-03): Actual partner acceptance and authorisation evidence.

<details><summary>What the build does today (assessment, current state of BR-INT-03)</summary>

Outbox and meaningful business receipts/errors are retained per destination.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-04-A — Duplicate prevention and uncertain outcomes acceptance

- **Requirement:** BR-INT-04 — Duplicate prevention and uncertain outcomes. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-04, catalogue owner "QA with Integration owner".
- **Run as:** ASHA worker. Basis: submissions are made from the visit's Review & act and Submissions screens.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Use a persistent logical action ID and destination idempotency mechanism; uncertain outcomes enter reconciliation." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A timeout after external acceptance does not create a second patient or activity; an unverifiable outcome remains visibly unresolved.

**Known gaps** (assessment, remaining work for BR-INT-04): Real partner duplicate/reconciliation contracts and timeout acceptance; partner evidence that its search is authoritative and its consistency delay holds.

<details><summary>What the build does today (assessment, current state of BR-INT-04)</summary>

Stable keys, lookup-before-resend and uncertain outcomes tested with mock transport. Slice 6u: an EHR publication refused before its write request (patient check or authority recheck) is closed as not sent ('blocked') instead of staying uncertain; one that may have been sent stays uncertain and needs a receipt lookup. Slice 7f: an owner may declare per EHR connection, from the partner contract, that its identifier search is authoritative with a consistency delay; an uncertain publication then resolves by lookup as accepted (one equal match), not stored after the delay (closed, never resent; a new publication only through the normal approval) or conflict (several or a different match); default off keeps the earlier rule. Each lookup checks its operation, is audited before sending, traced and limited to 24 per publication; the write must start within 30 s of the checkpoint. Replay soak: unresolved EHR share about 21% for the default partner and 0 for the authoritative one, no duplicate stored document.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-05-A — Partial completion across systems acceptance

- **Requirement:** BR-INT-05 — Partial completion across systems. Assessment: **implemented-local**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-05, catalogue owner "QA with Integration owner".
- **Run as:** ASHA worker. Basis: submissions are made from the visit's Review & act and Submissions screens.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Each external action has its own receipt and retry policy; successful actions remain accepted during another failure." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): If one of two writes succeeds, the success receipt is preserved and only the failed or uncertain destination is retried.

**Known gaps** (assessment, remaining work for BR-INT-05): Two live systems demonstrate the same recovery behaviour.

<details><summary>What the build does today (assessment, current state of BR-INT-05)</summary>

Independent destination states preserve accepted receipts during partial failure.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-01-A — Defined offline capability acceptance

- **Requirement:** BR-OFF-01 — Defined offline capability. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-01, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Offline availability is a manifest of cached records, protocols and commands under a signed device lease." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The core offline visit test completes without network access; no cloud model is falsely shown as having run.

**Known gaps** (assessment, remaining work for BR-OFF-01): Cached approved guidance, wider task capture and actual offline device acceptance.

<details><summary>What the build does today (assessment, current state of BR-OFF-01)</summary>

Encrypted bounded draft notebook with unavailable online functions. Slice 3g: new people, first-visit facts and referral requests can be captured offline and wait in the encrypted notebook until sync. App-first A02 adds a public locked offline /app shell sharing the unchanged encrypted field vault: current prepared visits, capture and sync; account/packet-owner/lifetime gates, ciphertext-only storage and public-only caches; weight and notes survive actual offline browser reload. Synced visits remain unconfirmed until online review. The app view does not claim a full offline caseload or approved-guidance cache. App-only connected patient-scope revalidation and redirect refusal are independently browser-tested; prepared-visit scope remains narrower than a complete offline caseload. A05 adds signed prepared documentary task types and complete captured programme pack/version guidance, encrypted offline conditional answers and explicit absence reasons. New server-held work digests and captured episode/version checks apply before sync even if an older client omits its optional digest. Sync remains an unconfirmed draft; clinical approval remains pending.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-02-A — Durable local capture acceptance

- **Requirement:** BR-OFF-02 — Durable local capture. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-02, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Draft and queue mutations commit atomically to encrypted storage before the saved indicator appears." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Forced restart and low-storage tests preserve acknowledged data or clearly report that saving did not complete.

**Known gaps** (assessment, remaining work for BR-OFF-02): Actual IndexedDB crash/restart/low-storage fault injection on supported physical devices and wider task recovery qualification.

<details><summary>What the build does today (assessment, current state of BR-OFF-02)</summary>

Serialized encrypted writes acknowledge after persistence; recovery logic tested. App-first A02 adds a public locked offline /app shell sharing the unchanged encrypted field vault: current prepared visits, capture and sync; account/packet-owner/lifetime gates, ciphertext-only storage and public-only caches; weight and notes survive actual offline browser reload. Synced visits remain unconfirmed until online review. The app view does not claim a full offline caseload or approved-guidance cache. Both app/field surfaces preserve latest encrypted book during queued timing/access updates, with originating-account checks and fail-closed CAS. Explicit abandoned unsent links can be retired without deleting accepted/unknown request evidence.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-03-A — Controlled offline authority acceptance

- **Requirement:** BR-OFF-03 — Controlled offline authority. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-03, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Lease checks use signed server time plus monotonic elapsed time; clock rollback or untrusted reboot requires online verification." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Expired grants lock cached patient records. Operators understand that revocation cannot reach a disconnected device before reconnection or local expiry.

**Known gaps** (assessment, remaining work for BR-OFF-03): Managed keys/trusted device clock and approved deployment-specific extension policy.

<details><summary>What the build does today (assessment, current state of BR-OFF-03)</summary>

Signed 24-hour scoped grants, expiry and reconnect checks.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-04-A — Pending media and AI work acceptance

- **Requirement:** BR-OFF-04 — Pending media and AI work. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-04, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Pending media carries its purpose, consent reference, capability version and expiry; all are rechecked before upload." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An offline request is cancelled or routed for review when its permission expires or its capability is suspended before upload.

**Known gaps** (assessment, remaining work for BR-OFF-04): Provider/capability revalidation once media is sent to a provider; clinical adequacy of reduced photos; background upload; real-device, low-storage and eviction testing.

<details><summary>What the build does today (assessment, current state of BR-OFF-04)</summary>

Slice 3a: field-notebook queue of photos and voice notes with purpose, local quality checks and device retention, sealed per item; on reconnection the grant, patient access and draft visit are rechecked before upload, and failures route items to review without sending. Slices 3d and 3e: voice notes recorded in the notebook; camera photos re-encoded on the device under the size limit without embedded location metadata.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-05-A — Safe synchronisation ordering acceptance

- **Requirement:** BR-OFF-05 — Safe synchronisation ordering. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-05, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Sync envelopes include command ID, dependencies, base version and local sequence; per-item results return independently." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A new local person, encounter and referral synchronise without orphan records across repeated connection loss and restoration.

**Known gaps** (assessment, remaining work for BR-OFF-05): Physical-device testing across real connection loss, and background sync.

<details><summary>What the build does today (assessment, current state of BR-OFF-05)</summary>

Stable-key sync for existing authorised person and visit drafts. Slice 3g: a person registered offline, with a first visit draft and referral request, is created in one command keyed by a stable registration id, so resends under new keys never create a second person; Sync all sends registrations, then visit drafts, then media, stops on an uncertain outcome and retries it with the same key; tested with repeated lost responses. Slice 3h: a clinician turns the synced request into a referral in one step, or declines it, once the visit is confirmed. Slice 3i: open synced requests are listed for clinicians and supervisors until decided.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-06-A — Revalidation of delayed actions acceptance

- **Requirement:** BR-OFF-06 — Revalidation of delayed actions. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-06, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Delayed commands recheck active assignment, patient link, clinical freshness, pack version and recipient permission." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A material rule or data change places the action into review with an explanation instead of silently executing the old plan.

**Known gaps** (assessment, remaining work for BR-OFF-06): Protocol/freshness revalidation for expanded queued tasks, and provider revalidation for media.

<details><summary>What the build does today (assessment, current state of BR-OFF-06)</summary>

Assignment, identity, membership, consent and visit versions rechecked at sync. Slice 3a: queued media is uploaded only after the grant, patient access and draft visit are rechecked. A05 adds signed prepared documentary task types and complete captured programme pack/version guidance, encrypted offline conditional answers and explicit absence reasons. New server-held work digests and captured episode/version checks apply before sync even if an older client omits its optional digest. Sync remains an unconfirmed draft; clinical approval remains pending.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-07-A — Shared and lost devices acceptance

- **Requirement:** BR-OFF-07 — Shared and lost devices. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-07, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-07: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Device switching clears decrypted memory and locks the cache. Remote revocation is enforced on next contact or lease expiry." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A second user cannot view the first user's cached records, and a reported lost device loses server access on its next contact.

**Known gaps** (assessment, remaining work for BR-OFF-07): Main-workspace shared-device protection, native keystore/MDM and lost-device exercises.

<details><summary>What the build does today (assessment, current state of BR-OFF-07)</summary>

Encrypted per-user notebook, inactivity lock, grants and reconnect denial. App-first A02 adds a public locked offline /app shell sharing the unchanged encrypted field vault: current prepared visits, capture and sync; account/packet-owner/lifetime gates, ciphertext-only storage and public-only caches; weight and notes survive actual offline browser reload. Synced visits remain unconfirmed until online review. The app view does not claim a full offline caseload or approved-guidance cache. Reconnected app visits are redacted during current permission validation and lock on positive withdrawal or login redirect.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OFF-08-A — Offline workflow capacity acceptance

- **Requirement:** BR-OFF-08 — Offline workflow capacity. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OFF-08, catalogue owner "QA with Frontline worker".
- **Run as:** ASHA worker. Basis: requirement area default (BR-OFF; catalogue owner "QA with Frontline worker").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OFF-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OFF-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Capacity reserves space for structured records before new media. Pending work is never evicted for cache refresh." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A capacity test reaches the agreed limit, warns before exhaustion and preserves every acknowledged record.

**Known gaps** (assessment, remaining work for BR-OFF-08): 200 encounters on a real device, device-measured thresholds and no-eviction acceptance.

<details><summary>What the build does today (assessment, current state of BR-OFF-08)</summary>

Notebook supported ten drafts; slice 3j raises this to 200 visit drafts, tested in a Node client harness with save, restart and ordered Sync all at 200; slice 3a adds up to four queued media items per draft and 1 MB per notebook, raised in slice 3k to 100 queued items and 25 MB per device; slice 3b requests persistent storage, shows usage and pauses new visits and media when space is low. Slice 3k: 200 server-prepared visit drafts plus 100 reduced photos and voice notes in headless Chromium against the built Worker, with the 201st draft and the 101st item refused and nothing lost, lock and unlock, and two page reloads mid-sync ending with each visit and item on the server once.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-05-A — Unified action plan acceptance

- **Requirement:** BR-CARE-05 — Unified action plan. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-05, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** ASHA worker. Basis: the action plan is read by the care worker holding the patient.
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover, My work. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Deduplication joins only equivalent person, purpose, destination and time-window tasks and retains both programme links." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Two packs generating the same approved referral create one referral with both source links and appropriate programme completion states.

**Known gaps** (assessment, remaining work for BR-CARE-05): No dependency is derived automatically; packs do not declare their own referral needs (the worker names the need and the server matches it), referrals made before slice 10f carry no need and are never merged, and the need catalogue is a local default; programme pack migration and installation; dependencies are not applied to reminders, the escalation queue or caseload counts.

<details><summary>What the build does today (assessment, current state of BR-CARE-05)</summary>

Shared visit facts and duplicate patient/day reminder suppression. Slice 4b: one ordered per-patient action plan across programme follow-ups, referrals, protocol reviews, safety cases and outreach, each with its source; follow-ups with the same title, due date and owner from several programme episodes shown once with every source. Slice 4d: recorded, audited dependencies between one patient's follow-ups, referrals and protocol reviews (self, cycle, closed-item and cross-patient links refused; removal needs a reason and keeps the record); a referral links further visits, protocol evaluations and programme episodes of the same patient, each with its kind and time, shown in the referral view and the action plan; single-source referrals are unchanged. Slice 10f: a referral can be created from several programme packs at once (createProgrammeReferrals): programme episodes on one confirmed visit that raise the same need for the same facility share one referral that links each asking episode as a source (slice 4d) and records which packs asked; the action plan names the asking packs on the referral's sources. Slice 13d: the household view records one read-audit event per member shown.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-06-A — Safe communication preferences acceptance

- **Requirement:** BR-CARE-06 — Safe communication preferences. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-06, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** ASHA worker. Basis: contact preferences are recorded on the person's page.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CARE-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Communication preferences are per person, purpose and channel, with shared-phone disclosure limits." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A patient requesting private contact receives no revealing automated message through a household contact number.

**Known gaps** (assessment, remaining work for BR-CARE-06): Real notice/permission workflow, shared-phone field safety and approved notification channels.

<details><summary>What the build does today (assessment, current state of BR-CARE-06)</summary>

Explicit synthetic contact ownership, language, privacy, hours and withdrawal controls.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-02-A — Understandable notice and consent acceptance

- **Requirement:** BR-SEC-02 — Understandable notice and consent. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-02, catalogue owner "QA with Privacy and security owners".
- **Run as:** ASHA worker. Basis: notice and the decline of optional AI recording happen during the visit.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Notices have language and version, and record the actor, relationship, decision, time and purpose." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Declining an optional AI recording leaves the approved non-AI care workflow available and prevents that media from being sent.

**Known gaps** (assessment, remaining work for BR-SEC-02): Reviewed multilingual notices, notice versions, representative authority and full expiry semantics.

<details><summary>What the build does today (assessment, current state of BR-SEC-02)</summary>

Optional AI can be declined; contact preferences and EHR scopes are recorded.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-03-A — Withdrawal and downstream effects acceptance

- **Requirement:** BR-SEC-03 — Withdrawal and downstream effects. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-03, catalogue owner "QA with Privacy and security owners".
- **Run as:** ASHA worker. Basis: withdrawal is recorded for a person and acts on the worker's queued recordings.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Revocation invalidates pending disclosures immediately online and schedules device and recipient disposition actions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Revocation blocks a queued provider upload and produces a traceable disposition record; the system does not claim to erase an external record without evidence.

**Known gaps** (assessment, remaining work for BR-SEC-03): Destination notification with verified external outcomes, wider local copy inventory, physical-device/hosted privacy validation, real ABDM consent-manager revocation and approved policy for retained completed transactions. Legacy unobserved wire variants retain unknown proof; no permission to care-replay after withdrawal.

<details><summary>What the build does today (assessment, current state of BR-SEC-03)</summary>

Revocation blocks pending use; contact changes cancel reminders; receipts remain visible. Slice 6o: withdrawing AI, sharing or contact permission (also with the switch) cancels queued and retryable deliveries, blocks unexecuted plans and prepared EHR publications, revokes EHR permissions and mock ABDM consents, stops unsent AI requests and pending reminders, and records each item as stopped, awaiting receipt, already sent or kept in a consent history and the audit chain. A06 adds original prepared-grant provenance, redacted own-only purge instructions after current care access is removed, encrypted revision-checked notebook/media deletion before durable client acknowledgement, and minimal tombstones preserving uncertain sync/media receipt references without blind care retries. Independent actual browser checks verify fail-closed known-refusal storage failures and offline reload on both surfaces; partial committed deletion batches survive later faults. Registration follow-up now records immutable original registration/match provenance, verifies the trusted original notebook account, clears cached candidate copies before connected reuse, and atomically removes known-withdrawn local registration copies while retaining unknown receipt proof. Append-only actual wire receipt mappings resolve observed raw/parsed ordering differences; pure privacy authority does not depend on a strict receipt lookup succeeding. Both surfaces pass synthetic encrypted-store and actual Worker recovery checks.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-04-A — Sensitive data and proxy handling acceptance

- **Requirement:** BR-SEC-04 — Sensitive data and proxy handling. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-04, catalogue owner "QA with Privacy and security owners".
- **Run as:** ASHA worker. Basis: household summaries and shared schedules are read by the worker.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Sensitive data classes and proxy rules are evaluated before views, exports, notifications and model payload construction." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A household member cannot infer restricted information through summaries, notifications, shared schedules or access to another member's encounter.

**Known gaps** (assessment, remaining work for BR-SEC-04): Jurisdiction-specific sensitivity restrictions and relationship/authority/expiry enforcement.

<details><summary>What the build does today (assessment, current state of BR-SEC-04)</summary>

Slice 1: sensitive classes (maternal, TB, adolescent, child) derived per person; household sharing withholds items revealing a class the proxy grant does not name, and omits members without a grant. Not yet applied to notifications, exports or model payloads.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-01-A — No invented facts acceptance

- **Requirement:** BR-RULE-01 — No invented facts. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-01, catalogue owner "QA with All actors".
- **Run as:** ASHA worker. Basis: missingness is met while capturing a visit.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Observation validation requires a real captured value or explicit missingness; model-derived values carry derivation references." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Missing, refused and uncertain inputs remain distinguishable across local records, model calls and outgoing submissions.

**Known gaps** (assessment, remaining work for BR-RULE-01): Distinct missing/refused/uncertain semantics across every downstream resource.

<details><summary>What the build does today (assessment, current state of BR-RULE-01)</summary>

Unknown facts remain unknown; stale or absent rule inputs surface missing evidence and cannot silently become normal.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-02-A — Patient confirmation before commitment acceptance

- **Requirement:** BR-RULE-02 — Patient confirmation before commitment. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-02, catalogue owner "QA with All actors".
- **Run as:** ASHA worker. Basis: the positive patient check is made by the worker.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Consequential commands require a recently confirmed patient context tied to the encounter revision." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A deliberately ambiguous match cannot create an authoritative programme update until the identity requirement is resolved.

**Known gaps** (assessment, remaining work for BR-RULE-02): Partner-specific identity requirements and all downstream clinical commitment acceptance.

<details><summary>What the build does today (assessment, current state of BR-RULE-02)</summary>

R10 version-bound positive patient check; provisional identity blocks consequential actions.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-04-A — Honest completion and cancellation acceptance

- **Requirement:** BR-RULE-04 — Honest completion and cancellation. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-04, catalogue owner "QA with All actors".
- **Run as:** ASHA worker. Basis: a plan is cancelled by the worker after a submission.
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** ASHA worker signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as ASHA worker and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Local task cancellation records remaining external obligations; it never rewrites destination receipts." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Cancellation after submission reports the actual destination state and generates any remaining reversal task.

**Known gaps** (assessment, remaining work for BR-RULE-04): Correction or reversal support from real partners (no destination declares void support and Saha has no EHR amendment or withdrawal path, so these stay manual), partner-confirmed reversal receipts, and acceptance with a real destination.

<details><summary>What the build does today (assessment, current state of BR-RULE-04)</summary>

Local/simulator/external outcomes remain distinct and receipts are not silently reversed. Slice 2j turns each external output of an amended or voided visit into an owned task: the destination's correction through the normal approval and execution path when a programme destination supports corrections and permits update, otherwise a manual correction or reversal with the destination; unknown outcomes are looked up first and unsent deliveries cancelled; nothing is sent or recalled automatically and closing needs a verified correction receipt or a reason.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
