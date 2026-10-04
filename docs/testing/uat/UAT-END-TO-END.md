<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the 12 End to end journeys of the catalogue. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — end-to-end journeys

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

Each journey names the roles it needs. Sign in as each in turn (plan section 6). Journeys are long and most depend on partner systems that hosted staging does not have: run the steps that can be run, mark the others Blocked with the reason, and never record a Pass for a journey with a Blocked step.

- **Cases:** 12. Default Blocked: 3.

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
| TC-J01 | Multi programme home visit | BR-UX-01 (partial); BR-DATA-01 (implemented-local); BR-PROG-05 (partial); BR-INT-05 (implemented-local) | Not run |
| TC-J02 | Cough analysis within screening | BR-AI-02 (partial); BR-AI-06 (partial); BR-CLIN-03 (partial) | Blocked |
| TC-J03 | Offline capture and partial synchronisation | BR-OFF-02 (partial); BR-OFF-05 (partial); BR-INT-04 (partial) | Not run |
| TC-J04 | Repair an incorrect patient link | BR-ID-08 (partial); BR-DATA-06 (partial); BR-SEC-08 (partial) | Not run |
| TC-J05 | Onboard and suspend a provider | BR-AI-01 (partial); BR-AI-04 (partial); BR-AI-10 (partial) | Not run |
| TC-J06 | Review programme service gaps | BR-REP-02 (partial); BR-REP-03 (partial); BR-REP-04 (partial) | Not run |
| TC-J07 | Withdraw permission before upload | BR-SEC-03 (partial); BR-OFF-04 (partial) | Not run |
| TC-J08 | Multi AI clinical consultation and EHR update | BR-AI-09 (partial); BR-CLIN-05 (partial); BR-INT-21 (partial) | Blocked |
| TC-J09 | Consented ABDM retrieval and publication | BR-INT-13 (partial); BR-INT-15 (partial); BR-INT-18 (partial); BR-INT-19 (partial) | Not run |
| TC-J10 | Cross facility referral and diagnostic return | BR-CARE-03 (partial); BR-INT-12 (partial); BR-INT-20 (partial) | Blocked |
| TC-J11 | Coordinated chronic care follow up | BR-PROG-04 (partial); BR-CARE-05 (partial); BR-INT-21 (partial) | Not run |
| TC-J12 | Supervisor outreach planning | BR-REP-06 (partial); BR-AG-11 (partial); BR-RULE-08 (implemented-local) | Not run |

## Cases

### TC-J01 — Multi programme home visit

- **Requirements:** BR-UX-01 (partial); BR-DATA-01 (implemented-local); BR-PROG-05 (partial); BR-INT-05 (implemented-local). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J01, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** Care handover, Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role ASHA worker; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J01 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Open assigned household work and choose one person; the system verifies assignment and shows source freshness.
   - Observed: ______
2. Confirm the person and start an encounter. Maternal, TB and hypertension packs contribute their eligible questions.
   - Observed: ______
3. Capture the narrative once. The extractor returns draft fields with source spans; the worker corrects uncertain values.
   - Observed: ______
4. The question assembler reuses eligible existing facts and asks only unresolved or genuinely distinct questions.
   - Observed: ______
5. Run eligible AI support where permitted. Present the source facts, independent results and consolidated actions for review.
   - Observed: ______
6. Confirm the encounter and authorised programme actions. Submit each destination separately and display its receipt.
   - Observed: ______
7. Assign every open referral or rejected submission to a responsible person or monitored queue.
   - Observed: ______

**Exception to exercise** (catalogue): A destination timeout leaves only that action uncertain. Patient ambiguity stops disclosure. Urgent approved protocol actions take precedence over forms. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): One confirmed encounter; separate accepted or unresolved destination states; no duplicate entry of an eligible shared fact.

**Known gaps** (assessment, remaining work per requirement):

- BR-UX-01 (partial): Validate the full journey with two independent real providers and programme destinations.
- BR-DATA-01 (implemented-local): Owner-approved programme fixtures and field validation.
- BR-PROG-05 (partial): Approved privacy and timing rules (the late flag, the one-slot-per-item rule and the need catalogue are local defaults); packs do not declare referral needs or compatibility, so the worker names the need and the server matches it; referrals created before slice 10f carry no need and are never merged; plans exist only for people in a household; rescheduling a slot, reminders and outreach for a slot, and completing covered items from the visit are not built.
- BR-INT-05 (implemented-local): Two live systems demonstrate the same recovery behaviour.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-UX-01:** One authenticated patient workspace with programme and agent panels. Independent image-provider flow is available in the synthetic visit workspace and Connections screen.
- **BR-DATA-01:** Pinned programme questions deduplicate shared concepts and preserve distinct answers.
- **BR-PROG-05:** Slice 1 adds a per-household view of each member's open items and a purpose-scoped sharing preview. Slice 10f adds a household visit plan (each in-scope member's open follow-ups, referrals and routine visit in one place; members outside the worker's scope are counted, never named) and household visit slots (householdVisitSchedule, householdVisitCancel) that cover chosen items of several members without changing any due date, owner or completion condition: an item stays open until its own record is resolved, items due before the slot date are shown as late, one item sits in one planned slot, and a slot holds only references, a date and a window (no free text). A confirmed visit's programme episodes can raise referral needs (createProgrammeReferrals): the same need, facility, person and visit become one referral that links every asking pack as a source and records which packs asked; a different need or facility stays a separate referral.
- **BR-INT-05:** Independent destination states preserve accepted receipts during partial failure.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J02 — Cough analysis within screening

- **Requirements:** BR-AI-02 (partial); BR-AI-06 (partial); BR-CLIN-03 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J02, catalogue owner "Product QA and programme owner".
- **Default result:** **Blocked** (steps 3, 4, 5 cannot be done in the current build; the other steps can still be run and recorded)
- **Start from:** Person page and visit, AI tools. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Permitted worker and clinical reviewer; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J02 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Check that the patient, language, recording method and device are within the selected capability approval.
   - Observed: ______
2. Explain the optional recording and record the required permission without blocking ordinary screening when declined.
   - Observed: ______
3. Capture the signal using provider-approved instructions and confirm patient context. **Blocked by default.** Not testable in current build: The assessment records the current state as “clinical generation remains unavailable.” (BR-AI-02, current field of requirements/assessment.tsv).
   - Observed: ______ (Blocked)
4. Evaluate input quality, upload only permitted fields and create a version-pinned request with a deadline. **Blocked by default.** Same reason as step 3.
   - Observed: ______ (Blocked)
5. Validate the response and display result, limitations and quality state separately from diagnosis. **Blocked by default.** Same reason as step 3.
   - Observed: ______ (Blocked)
6. Apply the locally approved pathway and route any clinical decision to the appropriate reviewer.
   - Observed: ______

**Exception to exercise** (catalogue): Unusable audio returns retry guidance. Provider failure and inability to assess never become a negative screen. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Invocation and result or failure are traceable; any care decision records its human or approved protocol authority.

**Known gaps** (assessment, remaining work per requirement):

- BR-AI-02 (partial): Verified intended use, jurisdiction and broader population criteria with representative clinical evidence.
- BR-AI-06 (partial): Signal/media quality checks, per-field assessment, complete unsupported-population taxonomy and representative validation.
- BR-CLIN-03 (partial): Approved escalation pathways, response operations and verified offline clinical availability.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-AI-02:** Documentary capabilities enforce age, role/team, language, setting, device and task scope; clinical generation remains unavailable. Independent anaemia demo: explicitly synthetic environment and patient, normal care-role/team scope and per-image synthetic approval. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.
- **BR-AI-06:** Invalid/unavailable results stay separate; extraction uncertainty is withheld and language gates fail independently. Slice 5c: an explicit unable-to-assess outcome (noisy input, unsupported case, insufficient input) with a retry instruction and no values, shown as such and never applied. Independent anaemia demo: technical-quality unable_to_assess has no score; unknown outcomes remain unresolved without inference retry.
- **BR-CLIN-03:** Model-independent urgent-review findings cite current sources and service contacts; unknowns remain explicit.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J03 — Offline capture and partial synchronisation

- **Requirements:** BR-OFF-02 (partial); BR-OFF-05 (partial); BR-INT-04 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J03, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role ASHA worker and sync service; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J03 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Obtain a signed scoped offline lease while online and cache the assigned records and approved protocols.
   - Observed: ______
2. Capture the encounter into an encrypted local transaction. Show saved on device only after commit.
   - Observed: ______
3. Queue dependent commands with stable IDs and explicit person and encounter dependencies.
   - Observed: ______
4. On reconnection recheck lease, assignment, identity links, consent, versions and input freshness.
   - Observed: ______
5. Accept valid local records and dispatch only eligible destination actions. Destination A accepts; B times out.
   - Observed: ______
6. Reconcile B using its stable external reference; retry only when non-acceptance is established.
   - Observed: ______
7. Return per-item receipts and conflicts to the device. Retain pending work until its server receipt is durable.
   - Observed: ______

**Exception to exercise** (catalogue): Expired authority cancels pending optional uploads. Low storage preserves acknowledged records. Conflicts enter review. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): No duplicate destination action and no loss of acknowledged work; unresolved outcomes have owners.

**Known gaps** (assessment, remaining work per requirement):

- BR-OFF-02 (partial): Actual IndexedDB crash/restart/low-storage fault injection on supported devices.
- BR-OFF-05 (partial): Physical-device testing across real connection loss, and background sync.
- BR-INT-04 (partial): Real partner duplicate/reconciliation contracts and timeout acceptance; partner evidence that its search is authoritative and its consistency delay holds.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-OFF-02:** Serialized encrypted writes acknowledge after persistence; recovery logic tested.
- **BR-OFF-05:** Stable-key sync for existing authorised person and visit drafts. Slice 3g: a person registered offline, with a first visit draft and referral request, is created in one command keyed by a stable registration id, so resends under new keys never create a second person; Sync all sends registrations, then visit drafts, then media, stops on an uncertain outcome and retries it with the same key; tested with repeated lost responses. Slice 3h: a clinician turns the synced request into a referral in one step, or declines it, once the visit is confirmed. Slice 3i: open synced requests are listed for clinicians and supervisors until decided.
- **BR-INT-04:** Stable keys, lookup-before-resend and uncertain outcomes tested with mock transport. Slice 6u: an EHR publication refused before its write request (patient check or authority recheck) is closed as not sent ('blocked') instead of staying uncertain; one that may have been sent stays uncertain and needs a receipt lookup. Slice 7f: an owner may declare per EHR connection, from the partner contract, that its identifier search is authoritative with a consistency delay; an uncertain publication then resolves by lookup as accepted (one equal match), not stored after the delay (closed, never resent; a new publication only through the normal approval) or conflict (several or a different match); default off keeps the earlier rule. Each lookup checks its operation, is audited before sending, traced and limited to 24 per publication; the write must start within 30 s of the checkpoint. Replay soak: unresolved EHR share about 21% for the default partner and 0 for the authoritative one, no duplicate stored document.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J04 — Repair an incorrect patient link

- **Requirements:** BR-ID-08 (partial); BR-DATA-06 (partial); BR-SEC-08 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J04, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Identity steward and programme owner; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J04 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Report the suspected mismatch and place affected future disclosures on hold.
   - Observed: ______
2. Compare original identity sources with restricted access and confirm the correct person or preserve uncertainty.
   - Observed: ______
3. Append a superseding link record with reason and reviewer; retain the original link history.
   - Observed: ______
4. Use lineage to identify affected observations, model requests, plans and external submissions.
   - Observed: ______
5. Invalidate pending approvals and generate destination-specific correction tasks.
   - Observed: ______
6. Record external repair receipts or the remaining assisted correction obligation.
   - Observed: ______

**Exception to exercise** (catalogue): A steward without external amendment authority routes to the programme owner. Existing accepted records are not silently reassigned. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Identity history and all downstream impacts are visible; any incomplete external correction remains open.

**Known gaps** (assessment, remaining work per requirement):

- BR-ID-08 (partial): Identifiers verified with their issuers (nothing contacts one), further programme issuers, sending crosswalks to destinations and destination-specific correction automation.
- BR-DATA-06 (partial): Recomputation of shadow comparisons and released indicator figures, follow-up source links (follow-ups are listed as possible dependants), task reassignment and notification, tasks for corrections made before slice 2j, and identity-merge and correction tasks in one reconciliation view.
- BR-SEC-08 (partial): Audit of partition (delta) command responses, the browser's search over the loaded caseload and offline opens; other patient-level lists and queues (exception queue, referral queues, continuity, household, caseload preview, action plan, identity cases) and the pilot, expansion and worker-activity views; role, version and delegated authority on command events (they are on access events only); signing of checkpoints and automatic external publication; scheduled verification and independent reconstruction; a measured load cost for the added audit rows.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-ID-08:** Identity revisions, EHR link revocation and changed-link rejection retain history. Slice 1c: two-steward link-based merge that preserves original records and receipts, invalidates pending approvals, queues downstream corrections and supports unmerge with review of work created while merged. Slice 6r: a clinician holding only emergency access to a record cannot propose, decide, unmerge or resolve a merge naming it. Slice 6u: the merge view returns the case reason and evidence only to a viewer who may see both records. Slice 10e: a person's programme identifiers (slice 2h imports and new links) form an append-only crosswalk ledger recording who linked each, when, where it came from and a verification state a person attests; corrections and withdrawals append and keep the earlier entry; one live holder per identifier, and a conflicting link opens the slice 1c identity case for two stewards and never merges; a holder outside the requester's scope is not revealed (steward review event on the holder, three a day per requester).
- **BR-DATA-06:** Append-only revisions, linked amendments, voids and blocked stale plans. Slice 1c adds an identity-merge impact queue listing affected submissions, links, referrals, follow-ups, episodes, households and proxies. Slice 2j records, when a confirmed visit is amended or voided, one owned task per downstream output of that version (programme submissions, EHR publications, the plan, referrals, follow-ups, protocol evaluations, assistant results, shadow comparisons, worker activity, indicator release counts): work the server already refuses is recorded as invalidated, read-time computations as recomputed, the rest as review or correction tasks, shown in the action plan and exception queue and closed only with a verified receipt or a reason, audited. Slice 6ad (ninth review, finding 9): a visit with more than 60 downstream outputs can still be amended or voided; internal outputs past the cap are folded into one review task per kind with the count (every external output keeps its own task). Slice 13c: the shadow and drift reports recompute a corrected comparison on read (or leave it out for a void or an unconfirmed correction), so shadow-comparison correction tasks are recorded as recomputed or invalidated; released indicator figures stay open review tasks.
- **BR-SEC-08:** Writes/approvals/exports have append-only audit and revisions. Slice 6j: per-organisation SHA-256 audit chain with genesis seal over earlier events, owner/administrator verification reporting the first break, and a JSONL auditor export (digest-only for out-of-scope patient events) recorded in the chain. Slice 6t: material reads (paged full patient record, revision history, visit media, received ABDM records, FHIR downloads) and external AI/EHR-retrieval requests each record one chained event (identifiers and counts, no clinical content; emergency-access route named) before content is returned or the request sent, shown in the Activity log. Owners/administrators can download a chain-head checkpoint (sequence, hash, digest; issuing it is chained) to keep outside Saha and later check it, which detects a suffix rewritten with recomputed hashes. Slice 6w: full records returned through the paged workspace window that the viewer has not opened through the detail route in the last 12 hours are recorded as record views first, and left out if that event cannot be written; a checkpoint past the 100,000-event verification limit is verified from an anchor (a checkpoint the owner names, or the last one recorded); indicator CSV exports are access-audit events. Slice 6aa: an unpaged workspace read by a non-ASHA viewer above the paging threshold records a viewPatientRecord event for every returned record not recorded in the last 12 hours before returning it (fail closed); the import rejection report is an access-audit event that moves no revision. Slice 10h: the remaining read paths record chained events before the read returns, refused if the event cannot be written: one summarised event per workspace snapshot load (scope size, records returned, paging window; also the snapshot returned with a command and with a replayed command), an explicit record-opened event reported by the workspace (the workspace shows the record only after the server answers; client-reported), patient searches, duplicate checks and patient or work-list pages (kind and result count, never the search text or entered details) and aggregate views (indicator results, the JSON operations and care report, aggregate report history; no cell values). Every access event now carries the acting membership's role, owner flag, membership version and the delegated authority in force inside its hashed detail; the default Activity log page leaves summary events out unless asked.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J05 — Onboard and suspend a provider

- **Requirements:** BR-AI-01 (partial); BR-AI-04 (partial); BR-AI-10 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J05, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** Clinical governance. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Provider owner AI governance and clinical safety; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J05 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Register the provider and immutable manifest version in a synthetic test space.
   - Observed: ______
2. Run schema, quality, correlation, retry and timeout contract tests.
   - Observed: ______
3. Review hosting, retention, intended use, evidence and local clinical deployment scope.
   - Observed: ______
4. Activate the approved version only for its named deployment and population.
   - Observed: ______
5. Monitor errors, drift signals, cost and safety cases with defined escalation owners.
   - Observed: ______
6. When a material issue occurs suspend new calls, assess running work and identify affected encounters.
   - Observed: ______
7. Require corrective evidence and fresh review before a corrected version is activated.
   - Observed: ______

**Exception to exercise** (catalogue): An API test alone does not enable live clinical use. An unapproved alternative provider cannot silently take over. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Provider history, activation evidence, suspension scope and follow-up work are reproducible.

**Known gaps** (assessment, remaining work per requirement):

- BR-AI-01 (partial): Live provider onboarding, evidence ownership and verification of the full accountable manifest.
- BR-AI-04 (partial): Verified registration step, deployment-specific activation, automatic and live-provider shadow runs, delivered impact queues and live lifecycle acceptance.
- BR-AI-10 (partial): Representative quality monitoring on live, representative data rather than local-rules shadow comparisons, configurable drift thresholds, drift from synthetic evaluations, independent ground-truth annotation and adjudication, delivered alerting and clinical response operations.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-AI-01:** Versioned capability manifest records owner, model/task/context scope, support and data terms; reviewed activation required. Independent anaemia demo: separate provider organisation, customer agreement revision and independent administration; demo agreement only. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.
- **BR-AI-04:** Draft/reviewed/active/suspended/retired revisions, replacement history and scoped affected-encounter views. Slice 5d: BRD lifecycle stages derived per package (registered, technically verified, approved for scope, active, suspended, retired, replaced), replacement recorded on activation, use counted per exact version, and in-progress work of an unusable capability identified with its required action (cancel, withheld, review, check applied values) on the governance page and in the audit line. Slice 5f: shadow operation of a reviewed revision for named teams or the whole organisation over at most 30 days; runs on confirmed visits (local rules provider only) without showing, applying or planning its output; consent, restriction, budget and lifecycle respected. Slice 6q (second independent review): a shadow's teams are limited to the revision's reviewed teams (organisation scope is the overlap); running and stopping need an owner or a member of every shadow team, also on replay; visits outside the runner's normal care scope are skipped and counted.
- **BR-AI-10:** Versioned fixture scores by field/language/group, scoped related records, safety cases and immediate capability hold. Slice 5f: shadow outputs compared per field with clinician-confirmed values (agreement, disagreement, missing, not recorded, unable to assess), counts only to governance managers. Slice 5i: drift monitoring per capability revision from shadow comparisons: agreement rate per 7-day period by visit confirmation date over the last four periods, and a flag when the rate drops by more than 10 percentage points between consecutive periods with at least 10 rated fields each, counts only, to governance managers on the Clinical governance page; nothing is suspended automatically. Slice 6q: shadow comparisons (the drift input) no longer include teams outside the revision's reviewed teams or patients outside the runner's care scope. Slice 13c: shadow and drift counts use the comparison as it stands now: recomputed against a confirmed correction, left out for a voided visit or an unconfirmed correction.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J06 — Review programme service gaps

- **Requirements:** BR-REP-02 (partial); BR-REP-03 (partial); BR-REP-04 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J06, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-02, BR-REP-03, BR-REP-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Programme manager; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J06 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Choose an approved metric definition, reporting period and permitted programme scope.
   - Observed: ______
2. Resolve the cohort and distinguish people, encounters and accepted programme events.
   - Observed: ______
3. Display source refresh times, exclusions, denominator and incomplete feeds.
   - Observed: ______
4. Apply suppression and prevent disclosure through repeated filter differences.
   - Observed: ______
5. Open person-level follow-up only when a separate permission permits it.
   - Observed: ______
6. Assign operational review work with an owner and reason; retain the exact report version.
   - Observed: ______

**Exception to exercise** (catalogue): Unavailable ground truth produces an unsupported answer. A report cannot automatically sanction workers or deny care. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): The same versioned inputs reproduce the report and any resulting assignments.

**Known gaps** (assessment, remaining work per requirement):

- BR-REP-02 (partial): Approval and effective dates for definition changes, owner-defined measures, validation against programme specifications, and point-in-time data snapshots for historical reproduction.
- BR-REP-03 (partial): Configurable per-source lateness thresholds and reporting calendars; late arrivals for non-visit measures; freshness on aggregate reports and exports; marking figures already released as affected by later arrivals.
- BR-REP-04 (partial): Differencing across viewers, non-nested filters, groupings and definitions, suppression on the operational export and other report paths, and a separate purpose for patient exports.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-REP-02:** Fixed operational definitions and documented denominators/window. Slice 6d adds eight versioned indicator definitions with numerator, denominator, exclusions, owner and cadence. Slice 6s makes them version 1 entries of an owner-maintained, append-only registry: owners add, revise and retire definitions (measures, filters, exclusions, owner, cadence, minimum cohort) with a reason and audit event; every result names the definition and version used, and a recorded version can be run again to reproduce an earlier result over current records.
- **BR-REP-03:** Generation window and usage coverage limitations are visible. Slice 6d indicator results state computation time, window, cohort size and latest source record. Slice 6ac adds, per team the viewer belongs to, the latest record time and banded counts of records arriving in the window and arriving more than 72 hours late for online visits, field-notebook syncs, imports and programme receipts, a late share to the nearest 10 points when at least 20 records support it, a data-still-syncing warning for field grants unsynced after 12 hours, and on each released visit-based result the banded number of late visits confirmed since the viewer's previous release of that figure; none of it enters a released cell.
- **BR-REP-04:** Current team scope and administrator patient-aggregate denial. Slice 6d indicator queries refuse cohorts under 5 and suppress small and complementary cells. Slice 6s adds per-definition minimum cohorts, differencing protection across one viewer's nested queries over seven days (hashed filters and per-cell people counts only, no patient data), and a CSV of indicator results that keeps the suppression; slice 6s-2 gives that CSV an export identifier, a row-count and SHA-256 manifest and an audit event. Slice 6w (fifth independent review): differencing compares numerators, denominators and denominator minus numerator as well as people; definition filters (sex, age band, programme) are nesting dimensions, so complementary definitions, including several in one query, are compared; the ledger is pruned by time only and refuses new queries at a per-viewer (400) or organisation (4,000) bound instead of evicting; a view moves no revision and writes no command receipt, queries are POST only, and data exit leaves the ledger out. Slice 6aa (seventh independent review): differencing is also checked through the people behind each release rather than by key: every measure release of the viewer's last seven days is re-evaluated against the people in scope now and split into atoms (people, and window-to-window increments for windowed measures, in exactly the same shown cells); a result that would create or split an atom of 1 to 4 is withheld, so a different grouping, an exclusion definition or a different window no longer bypasses it; the window is part of each release's identity; the ledger is bounded by size (1 MB organisation, 250 KB per viewer, 429 when full); a property test over random synthetic query sequences finds no released nested pair differing by 1 to 4; the remaining limits (two viewers combining results, changes between queries, releases older than seven days, unrelated measures) are stated to owners. Slice 6ad (ninth review): a release for a window that ended in the past records its end, used in the window key, the ledger prune identity and the population check, which counts each window to its own end and falls back to whole-person profiles when windows do not nest.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J07 — Withdraw permission before upload

- **Requirements:** BR-SEC-03 (partial); BR-OFF-04 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J07, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-03, BR-OFF-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Patient through authorised worker; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J07 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Find the specific purpose and authority record used for a queued recording.
   - Observed: ______
2. Record the verified withdrawal and its effective time.
   - Observed: ______
3. Block local queued media immediately where the device knows of the withdrawal.
   - Observed: ______
4. On reconnection invalidate server-side pending calls and propagate the changed authority state.
   - Observed: ______
5. Dispose the recording under the approved retention policy or record an independent hold.
   - Observed: ______
6. If already received externally, initiate and track the recipient restriction or disposal request.
   - Observed: ______

**Exception to exercise** (catalogue): Disconnected copies cannot be claimed erased instantly. Withdrawal of optional AI use leaves the approved underlying care workflow available. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): No new unauthorised disclosure; downstream disposition status reflects actual evidence.

**Known gaps** (assessment, remaining work per requirement):

- BR-SEC-03 (partial): Destination notification with verified external outcomes, offline device copies, real ABDM consent-manager revocation and approved policy for retained completed transactions.
- BR-OFF-04 (partial): Provider/capability revalidation once media is sent to a provider; clinical adequacy of reduced photos; background upload; real-device, low-storage and eviction testing.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-SEC-03:** Revocation blocks pending use; contact changes cancel reminders; receipts remain visible. Slice 6o: withdrawing AI, sharing or contact permission (also with the switch) cancels queued and retryable deliveries, blocks unexecuted plans and prepared EHR publications, revokes EHR permissions and mock ABDM consents, stops unsent AI requests and pending reminders, and records each item as stopped, awaiting receipt, already sent or kept in a consent history and the audit chain.
- **BR-OFF-04:** Slice 3a: field-notebook queue of photos and voice notes with purpose, local quality checks and device retention, sealed per item; on reconnection the grant, patient access and draft visit are rechecked before upload, and failures route items to review without sending. Slices 3d and 3e: voice notes recorded in the notebook; camera photos re-encoded on the device under the size limit without embedded location metadata.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J08 — Multi AI clinical consultation and EHR update

- **Requirements:** BR-AI-09 (partial); BR-CLIN-05 (partial); BR-INT-21 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J08, catalogue owner "Product QA and programme owner".
- **Default result:** **Blocked** (steps 3, 4 cannot be done in the current build; the other steps can still be run and recorded)
- **Start from:** No screen is documented for BR-AI-09, BR-CLIN-05, BR-INT-21: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Nurse and clinician; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J08 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Open the authorised EHR person context and reconcile it with the local encounter.
   - Observed: ______
2. Record history and observations once with device associations and source times.
   - Observed: ______
3. Invoke approved retinal and ECG capabilities separately using their required inputs. **Blocked by default.** Not testable in current build: The assessment records the current state as “clinical generation remains unavailable.” (BR-AI-02, current field of requirements/assessment.tsv).
   - Observed: ______ (Blocked)
4. Display the original traces or images, provider versions, limitations and independent outputs. **Blocked by default.** Same reason as step 3.
   - Observed: ______ (Blocked)
5. The clinician records their interpretation and signs the care plan and permitted orders.
   - Observed: ______
6. Prepare and validate EHR writes; display business receipts and preserve any version conflict.
   - Observed: ______
7. Prepare ABDM clinical artefacts only through the separately enabled HIP scope.
   - Observed: ______

**Exception to exercise** (catalogue): Unsupported media requires recapture. Rejection of one EHR record does not reverse other accepted records. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Signed clinical decision, EHR receipts and any ABDM publication state are independently traceable.

**Known gaps** (assessment, remaining work per requirement):

- BR-AI-09 (partial): Complete legacy provenance, end-to-end input-time semantics and external-provider acceptance.
- BR-CLIN-05 (partial): Verified clinical authority and acceptance across all consequential task types and corrections.
- BR-INT-21 (partial): EHR updates/amendments, destination version conflicts and recording a conflict's resolution in Saha.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-AI-09:** Original outputs, model/provider, versioned source and reasoned human decisions are retained. Independent anaemia demo: saved signed result, consent/visit/agreement versions and reasoned staff acknowledgement or rejection; no automatic clinical record update. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.
- **BR-CLIN-05:** Reasoned accept/reject/override decisions retain original assistant and protocol evidence; clinician-only protocol decisions.
- **BR-INT-21:** Conditional document creation and duplicate receipt lookup. Slice 7f: a named reconciliation owner (owner or administrator) per EHR connection; publication conflicts (several documents, or a different one, under the publication's identifier with an authoritative search) hold the visit and appear in the exception queue for that owner, who is also named on unknown-outcome rows.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J09 — Consented ABDM retrieval and publication

- **Requirements:** BR-INT-13 (partial); BR-INT-15 (partial); BR-INT-18 (partial); BR-INT-19 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J09, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-13, BR-INT-15, BR-INT-18, BR-INT-19: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Authorised facility clinician; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J09 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Verify deployment module role, facility identity and the patient ABHA linkage through approved flows.
   - Observed: ______
2. Request the minimum record types and period required for the stated care purpose.
   - Observed: ______
3. Track consent approval and verify artefact scope, expiry, provider and requester.
   - Observed: ______
4. Receive and decrypt through the authorised exchange adapter, then validate the returned bundles.
   - Observed: ______
5. Present source provenance and dates without overwriting local observations.
   - Observed: ______
6. After care create the reviewed clinical document and make it available through the configured HIP pathway.
   - Observed: ______
7. Retain request, consent, validation, acknowledgement and publication references in the restricted audit chain.
   - Observed: ______

**Exception to exercise** (catalogue): Denied, expired or revoked consent stops new retrieval. Wrong-person or invalid bundles are quarantined. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Every disclosure and receipt is tied to current authority; local care continues where permitted if exchange is unavailable.

**Known gaps** (assessment, remaining work per requirement):

- BR-INT-13 (partial): Sandbox and production onboarding, real credentials, facility registry verification and deployment-specific enforcement.
- BR-INT-15 (partial): Real consent-manager integration, HIP/HIU callbacks, notifications and enforcement on actual ABDM exchange.
- BR-INT-18 (partial): Real gateway routing, partner HIP onboarding, ABDM-conformant encryption and callbacks, and more record types.
- BR-INT-19 (partial): Real consent-manager and gateway data flow, NRCeS profile validation and merging accepted records into care.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-INT-13:** Slice 7a: owner-recorded ABDM environment (mock only), ABHA/HIP/HIU modules, facility identifier and an approval reference per module; ABHA and HIU actions refused unless their module is enabled with approval. Local mock gateway only.
- **BR-INT-15:** Slice 7a: consent artefacts with purpose, health-information types, record date range, expiry and revocation; fetch checks enforce status, ABHA link, purpose, type and date. The consent manager is simulated by an owner; local mock gateway only.
- **BR-INT-18:** Slice 7b: care-context linking of confirmed visits under the current ABHA, and a mock HIP that encrypts consent-covered bundles for the requester (X25519, HKDF-SHA-256, AES-256-GCM) with checksums and delivery acknowledgement. Local mock gateway only.
- **BR-INT-19:** Slice 7b: consent-bound fetch with transfer tracking, decryption, checksum and bundle-type validation, and clinician review before any received record is accepted. Local mock gateway only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J10 — Cross facility referral and diagnostic return

- **Requirements:** BR-CARE-03 (partial); BR-INT-12 (partial); BR-INT-20 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J10, catalogue owner "Product QA and programme owner".
- **Default result:** **Blocked** (steps 3 cannot be done in the current build; the other steps can still be run and recorded)
- **Start from:** No screen is documented for BR-CARE-03, BR-INT-12, BR-INT-20: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Referring worker and receiving clinician; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J10 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Prepare a referral with verified identity, minimum necessary clinical context and an accountable owner.
   - Observed: ______
2. Send through the destination supported route and record acknowledgement.
   - Observed: ______
3. The receiving service records assessment, attendance and result in its own authoritative system. **Blocked by default.** Not testable in current build: The assessment lists as remaining work “Facility-verified outcomes and external outcome evidence.” (BR-CARE-03, remaining field of requirements/assessment.tsv).
   - Observed: ______ (Blocked)
4. Receive the result through the authorised EHR, ABDM or controlled document route.
   - Observed: ______
5. Match the result to the correct person, referral and source version; quarantine mismatches.
   - Observed: ______
6. Create the next task and close only with verified service outcome or coded unresolved disposition.
   - Observed: ______

**Exception to exercise** (catalogue): A destination without structured referral support uses labelled assisted hand-off. Missing attendance or result leaves work open. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Sent, received, scheduled, attended, resulted and closed states reflect distinct evidence.

**Known gaps** (assessment, remaining work per requirement):

- BR-CARE-03 (partial): Facility-verified outcomes and external outcome evidence.
- BR-INT-12 (partial): Element-level author/device, receipt/effective time and transformation lineage for all resources.
- BR-INT-20 (partial): Reference-partner profile covering all declared search/update/version/receipt/support behaviour.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-CARE-03:** Dated referral events with evidence. Slice 4a adds accepted, scheduled (with appointment time), attended, did-not-attend, declined, cancelled and unknown states under an explicit transition table; closed states are immutable.
- **BR-INT-12:** Imported source documents, timestamps and local submission provenance retained.
- **BR-INT-20:** Native FHIR capability profile gates document retrieval/publication.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J11 — Coordinated chronic care follow up

- **Requirements:** BR-PROG-04 (partial); BR-CARE-05 (partial); BR-INT-21 (partial). Priority Must, catalogue release R1.
- **Catalogue:** End to end, fixture FX-J11, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover, My work. These are the screens the requirement's own evidence-map entry cites, not a verified click path. An entry a role does not see in its navigation is not available to that role.
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Worker clinician and patient; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J11 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Identify compatible due tasks for a person in hypertension and diabetes care.
   - Observed: ______
2. Read permitted history with dates and source systems visible.
   - Observed: ______
3. Contact through the approved worker or patient channel respecting shared-phone preferences.
   - Observed: ______
4. Ask the combined approved questions and record any new measurements with current timestamps.
   - Observed: ______
5. Prepare appointments, medication-access tasks or clinical review requests for authorised confirmation.
   - Observed: ______
6. Write each reviewed update through its supported destination and assign unresolved follow-up.
   - Observed: ______

**Exception to exercise** (catalogue): An old EHR measurement cannot substitute for a required new observation. Concerning answers route to a qualified person. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Each programme action and EHR update retains independent status and ownership.

**Known gaps** (assessment, remaining work per requirement):

- BR-PROG-04 (partial): Approved measurement/adherence context, schedules, escalation and independent clinical evidence.
- BR-CARE-05 (partial): No dependency is derived automatically; packs do not declare their own referral needs (the worker names the need and the server matches it), referrals made before slice 10f carry no need and are never merged, and the need catalogue is a local default; programme pack migration and installation; dependencies are not applied to reminders, the escalation queue or caseload counts.
- BR-INT-21 (partial): EHR updates/amendments, destination version conflicts and recording a conflict's resolution in Saha.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-PROG-04:** BP and medicine-access capture plus bounded, reviewed observation rules; no prescribing path.
- **BR-CARE-05:** Shared visit facts and duplicate patient/day reminder suppression. Slice 4b: one ordered per-patient action plan across programme follow-ups, referrals, protocol reviews, safety cases and outreach, each with its source; follow-ups with the same title, due date and owner from several programme episodes shown once with every source. Slice 4d: recorded, audited dependencies between one patient's follow-ups, referrals and protocol reviews (self, cycle, closed-item and cross-patient links refused; removal needs a reason and keeps the record); a referral links further visits, protocol evaluations and programme episodes of the same patient, each with its kind and time, shown in the referral view and the action plan; single-source referrals are unchanged. Slice 10f: a referral can be created from several programme packs at once (createProgrammeReferrals): programme episodes on one confirmed visit that raise the same need for the same facility share one referral that links each asking episode as a source (slice 4d) and records which packs asked; the action plan names the asking packs on the referral's sources.
- **BR-INT-21:** Conditional document creation and duplicate receipt lookup. Slice 7f: a named reconciliation owner (owner or administrator) per EHR connection; publication conflicts (several documents, or a different one, under the publication's identifier with an authoritative search) hold the visit and appear in the exception queue for that owner, who is also named on unknown-outcome rows.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-J12 — Supervisor outreach planning

- **Requirements:** BR-REP-06 (partial); BR-AG-11 (partial); BR-RULE-08 (implemented-local). Priority Must, catalogue release R2.
- **Catalogue:** End to end, fixture FX-J12, catalogue owner "Product QA and programme owner".
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-06, BR-AG-11, BR-RULE-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use the navigation of each role in the journey (plan section 6).
- **Preconditions:** Catalogue precondition (target design): "Synthetic environment; role Block supervisor; journey-specific providers and destinations configured as test adapters; no live clinical data." On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture FX-J12 cannot be loaded, so use synthetic records and note which.

**Journey steps** (catalogue wording; record what you observed under each)

1. Select authorised operational measures and current worker availability.
   - Observed: ______
2. Find overdue visits and unresolved referrals using governed definitions.
   - Observed: ______
3. Remove duplicate people from compatible task groups while preserving separate care reasons.
   - Observed: ______
4. Show missing sources, stale directory entries and uncertainty in the proposed allocation.
   - Observed: ______
5. The supervisor reviews and confirms assignments within permitted scope.
   - Observed: ______
6. Workers receive tasks and later record outcomes linked to the report and allocation version.
   - Observed: ______

**Exception to exercise** (catalogue): ABDM HIU permission is not general population analytics authority. Small cohorts remain protected. Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.

**Expected result** (catalogue): Every proposed and confirmed assignment has a reason, owner and later outcome; no automated sanction occurs.

**Known gaps** (assessment, remaining work per requirement):

- BR-REP-06 (partial): Approved gap/risk measures and real data-quality/fairness validation.
- BR-AG-11 (partial): Natural-language analysis under governance, validated definitions with an approval workflow, owner-defined measures, and differencing protection across viewers, non-nested filters and groupings.
- BR-RULE-08 (implemented-local): Independent adversarial acceptance of the final agent catalogue.

<details><summary>What the build does today (assessment, current state)</summary>

- **BR-REP-06:** Human cohort selection with recorded criteria and allocation rationale.
- **BR-AG-11:** Slice 6d: a catalogue of eight versioned indicators queried over the viewer's scope with cohort minimum, small-cell and complementary suppression and freshness, plus a keyword interpreter that maps a question to catalogue entries for review without running it or using a model. Slice 6s: the catalogue is an owner-maintained registry of versioned definitions built from a fixed vocabulary of measures, filters and exclusions; the interpreter follows the registry; results name their definition version; one viewer's nested queries over seven days are checked for differencing and withheld when they would reveal a group of 1 to 4 people. Slice 6w: indicator queries are POST only (GET answers the catalogue and interpretation), a view no longer commits organisation-wide, and the CSV export is recorded as an access-audit event; differencing fixes as in BR-REP-04. Slice 6aa: indicator results carry the stated limits of small-group protection, and owners see them in the registry; the population-based differencing check withholds more results for small teams and narrow filters.
- **BR-RULE-08:** Closed command catalogue has no denial, benefit sanction, pay or employment transaction.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
