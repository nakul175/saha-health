<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the catalogue cases assigned to the Supervisor role. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — Supervisor

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

- **Who runs this:** invited by the owner with role Supervisor and the care team.
- **What this role can do:** Patients in the member's teams for oversight, assignment and reconciliation. No clinical fact writes (docs/current/06; lib/saha/indicators.ts manager()).
- **Navigation this role sees** (from lib/saha/navigation.ts): My work, People, Submissions, Outreach, Care handover, Pilot readiness, Operations, Connections, Activity log, Organisation & team.

- **Cases:** 13. Default Blocked: 0.

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
| TC-BR-ID-04-A | Caseload assignment and transfer acceptance | BR-ID-04 (partial) | Not run |
| TC-BR-DATA-12-A | Measurement of actual reuse acceptance | BR-DATA-12 (partial) | Not run |
| TC-BR-AG-11-A | Programme manager analysis acceptance | BR-AG-11 (partial) | Not run |
| TC-BR-CARE-01-A | Action ownership acceptance | BR-CARE-01 (partial) | Not run |
| TC-BR-CARE-04-A | Due work and escalation acceptance | BR-CARE-04 (partial) | Not run |
| TC-BR-CARE-08-A | Worker activity evidence acceptance | BR-CARE-08 (partial) | Not run |
| TC-BR-REP-01-A | Operational exception queues acceptance | BR-REP-01 (partial) | Not run |
| TC-BR-REP-02-A | Governed indicator definitions acceptance | BR-REP-02 (partial) | Not run |
| TC-BR-REP-03-A | Data freshness and completeness acceptance | BR-REP-03 (partial) | Not run |
| TC-BR-REP-04-A | Privacy-preserving aggregation acceptance | BR-REP-04 (partial) | Not run |
| TC-BR-REP-05-A | Reconciled exports acceptance | BR-REP-05 (partial) | Not run |
| TC-BR-REP-06-A | Population prioritisation acceptance | BR-REP-06 (partial) | Not run |
| TC-BR-RULE-08-A | No silent adverse allocation acceptance | BR-RULE-08 (implemented-local) | Not run |

## Cases

### TC-BR-ID-04-A — Caseload assignment and transfer acceptance

- **Requirement:** BR-ID-04 — Caseload assignment and transfer. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-04, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Supervisor. Basis: assigning and transferring patients is an owner or supervisor action (assignPatient).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Assignment changes carry effective dates and an explicit list of transferred open tasks with receiving ownership." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Transferring a worker's caseload moves eligible open tasks, records acknowledgement and prevents duplicate ownership or orphaned urgent tasks.

**Known gaps** (assessment, remaining work for BR-ID-04): A timed trigger that has actually run on the hosted Worker (the job needs the Workers Paid plan and has not been seen firing on Cloudflare; on a host with no trigger the application time depends on use), locality transfer, field acceptance of handovers and approved urgency rules.

<details><summary>What the build does today (assessment, current state of BR-ID-04)</summary>

R10 transfers open patient work atomically, records effective time and receiving-worker acknowledgement. Slice 1b adds bulk caseload transfer with scheduled effective dates, re-checks at application, bulk acknowledgement and a responsibility-gap view with urgent work first. Slice 1f applies due scheduled transfers automatically on the first read or command at or after their effective time, with the same re-checks under the scheduling steward's authority, exactly once under the organisation-wide commit guard, a revision and audit event per application and a held state with the reason when a re-check fails; and adds whole-household transfer, refused when any current member is outside the requester's scope. Slice 10a: a Cloudflare Cron Trigger (every five minutes, set in the hosted staging configuration only) runs a scheduled job that applies due scheduled transfers through the same all-or-nothing path (slice 6ae), at most 10 per organisation per run, oldest effective time first, with the scheduling steward's authority re-checked, a revision and audit event per application naming a system actor, and a refused transfer held whole and never retried by the job; where no trigger is configured, application time still depends on use. Verified in contract tests and a local scheduled-handler check, not on Cloudflare.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-12-A — Measurement of actual reuse acceptance

- **Requirement:** BR-DATA-12 — Measurement of actual reuse. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-12, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** Supervisor. Basis: reuse indicators are for supervisors and owners (indicators.ts manager()).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-DATA-12: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-12; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Reuse opportunities are logged before question display, with reasons for reuse, recapture or blocked reuse." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Auditors can reproduce a sample reuse calculation from event records and separate avoidable re-entry from clinically required recapture.

**Known gaps** (assessment, remaining work for BR-DATA-12): Cross-visit reuse, time and burden measurement, and validation against observed field practice.

<details><summary>What the build does today (assessment, current state of BR-DATA-12)</summary>

Slice 2a: reuse opportunities, successful reuse and blocked reuse recomputed from stored confirmed visits, plus possible repeated entries and corrections, as versioned catalogue indicators with suppression.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-11-A — Programme manager analysis acceptance

- **Requirement:** BR-AG-11 — Programme manager analysis. Assessment: **partial**. Target R15. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-AG-11, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Supervisor. Basis: programme analysis uses the governed indicators, which are for supervisors and owners.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-11: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-11; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Natural language reporting resolves to approved metric IDs and filters, then applies the same report policy checks." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A natural-language count matches the governed report and cannot expose restricted patient lists through a reformulated query.

**Known gaps** (assessment, remaining work for BR-AG-11): Natural-language analysis under governance, validated definitions with an approval workflow, owner-defined measures, and differencing protection across viewers, non-nested filters and groupings.

<details><summary>What the build does today (assessment, current state of BR-AG-11)</summary>

Slice 6d: a catalogue of eight versioned indicators queried over the viewer's scope with cohort minimum, small-cell and complementary suppression and freshness, plus a keyword interpreter that maps a question to catalogue entries for review without running it or using a model. Slice 6s: the catalogue is an owner-maintained registry of versioned definitions built from a fixed vocabulary of measures, filters and exclusions; the interpreter follows the registry; results name their definition version; one viewer's nested queries over seven days are checked for differencing and withheld when they would reveal a group of 1 to 4 people. Slice 6w: indicator queries are POST only (GET answers the catalogue and interpretation), a view no longer commits organisation-wide, and the CSV export is recorded as an access-audit event; differencing fixes as in BR-REP-04. Slice 6aa: indicator results carry the stated limits of small-group protection, and owners see them in the registry; the population-based differencing check withholds more results for small teams and narrow filters.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-01-A — Action ownership acceptance

- **Requirement:** BR-CARE-01 — Action ownership. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-01, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Supervisor. Basis: a supervisor or owner reassigns unowned work (assessment, slice 4b).
- **Default result:** Not run
- **Start from:** Person page and visit, Care handover, My work. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Task creation requires an owner or a monitored assignment queue with a service-level escalation rule." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): No active urgent task can exist without a visible responsible queue or assignee.

**Known gaps** (assessment, remaining work for BR-CARE-01): All clinical/integration exceptions, urgency policy and production monitoring coverage; queue notification; safety-case reassignment outside clinicians.

<details><summary>What the build does today (assessment, current state of BR-CARE-01)</summary>

Follow-up/referral/outreach owners; R10 unavailable-owner queue and handover. Slice 4b: per-patient action plan shows each open item's owner or responsible queue and flags items without a current eligible owner; a care worker takes ownership of an unowned follow-up or referral, and a supervisor or owner of the patient's team reassigns them. Slice 4d: a clinician with current access or a steward of the patient's team records that one follow-up or referral waits on another open item of the same patient; the plan shows each waiting item's blocker with the blocker's owner state and status, and what each item holds back.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-04-A — Due work and escalation acceptance

- **Requirement:** BR-CARE-04 — Due work and escalation. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-04, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Supervisor. Basis: overdue work enters the supervisor queue.
- **Default result:** Not run
- **Start from:** Care handover, Person page and visit, My work, People, Submissions. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Due-work calculations record schedule version and timezone; escalation retains prior owner and reason for delay." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An overdue case enters the correct supervisor queue and remains visible until completion or a documented resolution.

**Known gaps** (assessment, remaining work for BR-CARE-04): Approved urgency policy, delivery of real notifications to approved recipients, on-call escalation, and automatic reassignment. The referral escalation queue, caseload and handover counts do not yet apply action dependencies.

<details><summary>What the build does today (assessment, current state of BR-CARE-04)</summary>

Due dates and overdue counts; scoped handover exception queue. Slice 4a adds urgency, reasoned delays with constraint and history, and a computed escalation queue ordered by level, urgency and days overdue. Slice 3i: a queue of open field referral requests for clinicians, supervisors and owners in scope (clinical concern first, then oldest, with waiting time and a link to the visit); requests waiting 48 hours or more are also exception-queue rows. Slice 4d: in the action plan an item waiting on an open blocker is not counted as overdue and is listed after other work; an overdue blocker keeps its own place, and an ownership gap still escalates a waiting item. Slice 0b-4: in a workspace paged for a scope above 500 people, the follow-up list (due dates and overdue marks) and the referral tracker on My work cover the viewer's whole scope, built on the server page by page with the same order and counts as the unpaged workspace; before, they covered only opened records. Slice 10b: the overdue-referral, overdue-follow-up and undated-referral alerts can be sent out of the app to a listed recipient tier as simulated messages carrying a count and a link only, and an unacknowledged alert escalates to the next tier after an owner-set interval; every message has a receipt and an audit event (demonstration simulator in synthetic and training environments only).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-08-A — Worker activity evidence acceptance

- **Requirement:** BR-CARE-08 — Worker activity evidence. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-08, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Supervisor. Basis: worker activity evidence is a supervisor view (assessment, slice 4c).
- **Default result:** Not run
- **Start from:** Care handover. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Activity evidence distinguishes performed, verified, claimed and submitted; corrections invalidate derived claims." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Correcting or cancelling an activity updates derived claims and leaves the original evidence and review history traceable.

**Known gaps** (assessment, remaining work for BR-CARE-08): Real incentive rates and scheme rules, beneficiary or field verification, payment and reconciliation, buyer reporting, external anchoring or qualified signing of claims, and an archive policy for stored claims.

<details><summary>What the build does today (assessment, current state of BR-CARE-08)</summary>

Visit-backed outreach completion and correction-aware evidence. Slice 4c: per-worker summary for supervisors separating performed, claimed, verified (evidence-matched) and submitted activity, with corrections traced to reviser and reason and no payment language or location. Slice 10c: worker incentive claims on an owner-set synthetic placeholder schedule (not a real rate): an ASHA prepares a claim from her own current confirmed visits and outreach completions, each line linked to its source record and never claimed twice; the team supervisor verifies or returns it with a reason; a different owner approves; an approved claim is immutable and stored with a digest chained to the previous claim, with corrections as new linked claims and a CSV export carrying the digests; no payment is made or implied. Slice 10k: claims, their patient ids and evidence visit ids are no longer returned by the Operations view (it returns an allow-list of the operations record); they are read only through the scoped claims route.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-01-A — Operational exception queues acceptance

- **Requirement:** BR-REP-01 — Operational exception queues. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-01, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** Submissions, Operations. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Exceptions are indexed by owner, type, age, state and permitted person reference with direct recovery actions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Each seeded failure is discoverable and assignable without searching individual worker transcripts.

**Known gaps** (assessment, remaining work for BR-REP-01): Assignment from the queue itself, sync failures on a device that never reconnects (reports are sent only when the notebook is next online), notification of individual exception items (slice 6v notifies alert-level counts in the app only), and seeded-failure acceptance.

<details><summary>What the build does today (assessment, current state of BR-REP-01)</summary>

Operational backlog counts plus R10 identity/ownership/handover queues. Slice 6i: item-level exception queue on the Operations page for uncertain, retryable or rejected programme submissions, unconfirmed EHR publications, escalated referrals, overdue follow-ups, provisional identities, expired unsynced field grants, received ABDM records and protocol findings awaiting review, open safety cases and unreviewed emergency access, each with patient, problem, age, owner, recovery action and a link to the patient or visit, scoped to the viewer. Slice 6v: the alert counts behind the queue (unconfirmed submissions and EHR publications, overdue referrals and follow-ups, undated referrals) are delivered as in-app notifications to the owning role and escalate to owners when left unacknowledged. Slice 6y: programme submission and EHR publication rows open a trace of that item's commands, checkpoints, receipts and audit events. Slice 14e: field notebooks report their sync failures as counts (step, error class, grant, first and last time; no patient details), listed for supervisors and owners in a Field devices panel on the Operations page and, for grants still open, as exception rows owned by the worker with a recovery action; device copies awaiting removal and consent-withdrawal notices not yet sent, uncertain or to be told by hand are exception rows too.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-02-A — Governed indicator definitions acceptance

- **Requirement:** BR-REP-02 — Governed indicator definitions. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-02, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Metric definitions version numerator, denominator, exclusions, source grain, cutoff and suppression." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A reviewer can recalculate sample indicators from authorised records and distinguish visits, unique people and accepted programme submissions.

**Known gaps** (assessment, remaining work for BR-REP-02): Approval and effective dates for definition changes, owner-defined measures, validation against programme specifications, and point-in-time data snapshots for historical reproduction.

<details><summary>What the build does today (assessment, current state of BR-REP-02)</summary>

Fixed operational definitions and documented denominators/window. Slice 6d adds eight versioned indicator definitions with numerator, denominator, exclusions, owner and cadence. Slice 6s makes them version 1 entries of an owner-maintained, append-only registry: owners add, revise and retire definitions (measures, filters, exclusions, owner, cadence, minimum cohort) with a reason and audit event; every result names the definition and version used, and a recorded version can be run again to reproduce an earlier result over current records.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-03-A — Data freshness and completeness acceptance

- **Requirement:** BR-REP-03 — Data freshness and completeness. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-03, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Each report shows source refresh time and incomplete feeds; delayed records revise a new report version." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Disconnecting one source produces a visible completeness warning and an explicit affected denominator.

**Known gaps** (assessment, remaining work for BR-REP-03): Configurable per-source lateness thresholds and reporting calendars; late arrivals for non-visit measures; freshness on aggregate reports and exports; marking figures already released as affected by later arrivals.

<details><summary>What the build does today (assessment, current state of BR-REP-03)</summary>

Generation window and usage coverage limitations are visible. Slice 6d indicator results state computation time, window, cohort size and latest source record. Slice 6ac adds, per team the viewer belongs to, the latest record time and banded counts of records arriving in the window and arriving more than 72 hours late for online visits, field-notebook syncs, imports and programme receipts, a late share to the nearest 10 points when at least 20 records support it, a data-still-syncing warning for field grants unsynced after 12 hours, and on each released visit-based result the banded number of late visits confirmed since the viewer's previous release of that figure; none of it enters a released cell.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-04-A — Privacy-preserving aggregation acceptance

- **Requirement:** BR-REP-04 — Privacy-preserving aggregation. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-04, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Aggregate policy combines minimum cohort rules, protected dimensions and query-history controls against differencing." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Combining filters cannot reveal a suppressed small group or bypass person-level access restrictions.

**Known gaps** (assessment, remaining work for BR-REP-04): Differencing across viewers, non-nested filters, groupings and definitions; differencing across operational report exports (two files with different filters, windows or teams can be subtracted; the indicator ledger is not applied to the operational report); the in-app aggregate views (operations JSON view, worker activity, alerts, caseload) are not suppressed, by decision pending; the data-exit purpose check cannot restrict owners, who cannot be purpose-limited.

<details><summary>What the build does today (assessment, current state of BR-REP-04)</summary>

Current team scope and administrator patient-aggregate denial. Slice 6d indicator queries refuse cohorts under 5 and suppress small and complementary cells. Slice 6s adds per-definition minimum cohorts, differencing protection across one viewer's nested queries over seven days (hashed filters and per-cell people counts only, no patient data), and a CSV of indicator results that keeps the suppression; slice 6s-2 gives that CSV an export identifier, a row-count and SHA-256 manifest and an audit event. Slice 6w (fifth independent review): differencing compares numerators, denominators and denominator minus numerator as well as people; definition filters (sex, age band, programme) are nesting dimensions, so complementary definitions, including several in one query, are compared; the ledger is pruned by time only and refuses new queries at a per-viewer (400) or organisation (4,000) bound instead of evicting; a view moves no revision and writes no command receipt, queries are POST only, and data exit leaves the ledger out. Slice 6aa (seventh independent review): differencing is also checked through the people behind each release rather than by key: every measure release of the viewer's last seven days is re-evaluated against the people in scope now and split into atoms (people, and window-to-window increments for windowed measures, in exactly the same shown cells); a result that would create or split an atom of 1 to 4 is withheld, so a different grouping, an exclusion definition or a different window no longer bypasses it; the window is part of each release's identity; the ledger is bounded by size (1 MB organisation, 250 KB per viewer, 429 when full); a property test over random synthetic query sequences finds no released nested pair differing by 1 to 4; the remaining limits (two viewers combining results, changes between queries, releases older than seven days, unrelated measures) are stated to owners. Slice 6ad (ninth review): a release for a window that ended in the past records its end, used in the window key, the ledger prune identity and the population check, which counts each window to its own end and falls back to whole-person profiles when windows do not nest. Slice 13d: refused indicator queries (combination or cohort below 5) are recorded with filter names only and limited to 20 per viewer per day. Slice 14a: the refusal limit holds under parallel queries (each query reserves a slot before it is run; a refusal or partial withhold keeps it); over HTTP, eight parallel refused queries after 17 refusals are answered as three refusals and five 429s; a partial differencing withhold is recorded as an indicator refusal and counted, on screen and in a CSV export. Slice 14g: the operational report CSV (the one count-bearing file that had no suppression) now shows counts of 1 to 4 as <5, withholds every count when the report covers 1 to 4 people, withholds one further cell where a breakdown with a shown total would reveal a suppressed one, and states the rule and the number of cells in the file; control totals over a suppressed breakdown are withheld. Every route handler, Content-Disposition source, file-saving screen and outbound command is classified in an inventory, and a contract fails when a new one is not. Patient-level files (FHIR download, data exit) are a separate patient-export purpose; the operational CSV needs the reporting purpose.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-05-A — Reconciled exports acceptance

- **Requirement:** BR-REP-05 — Reconciled exports. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-05, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Exports contain metric definition version, scope, date window and row count, with expiring authorised download." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An exported report reconciles to the displayed governed measure and cannot be downloaded by an unauthorised role.

**Known gaps** (assessment, remaining work for BR-REP-05): Expiry applies to the operational CSV only (the indicator CSV, data exit, audit export, incentive CSV and rejection report are delivered directly, not held); filters beyond window, team and programme (village, age band, sex) on the operational report; no screen for held exports or filters; and an official reviewed-submission lifecycle distinct from draft export. Aggregate reports go to demonstration destinations only; there is no official reviewed-submission lifecycle with the programme, no reporting calendar or scheduled report, and no snapshot of the records behind a sent report.

<details><summary>What the build does today (assessment, current state of BR-REP-05)</summary>

Audited scoped CSV with generation time/window and formula escaping. Slice 6k: the CSV names its definition and version, export identifier, draft status, exporting member and role, window and teams; control totals tie displayed measures to the sums of their detail rows; a trailing manifest gives the row count and SHA-256 of the content, also recorded in the export's audit line and response headers; administrators and care roles cannot download it. Slice 7g: an aggregate report for an aggregate-only destination is prepared from named definition versions, a period and teams in the preparer's scope, approved by a different authorised person and sent with the same suppression, a manifest (definitions, row count, SHA-256), a release recorded for the destination in the differencing ledger, and the receipt kept in the report history on the destination's screen. Slice 6ab: aggregate reports are screened with the population check, as indicator queries are. Slice 6ad (ninth review): aggregate report cells are never shown to people (they were screened for the destination only); a report period ending in the past records its window end so it never replaces or escapes an earlier release to the same destination. Slice 13d: the send checkpoint applies the sender's scope before the population screen (it saw an empty population before). Slice 14g: the CSV is suppressed (definition 1.2.0); the operational report takes team and programme filters inside the viewer's reporting reach; a prepared report can be held for one download (POST /api/exports, GET /api/exports?id=): 15-minute expiry, delivered once to the member who prepared it, refused on replay, on another member, after a change of role, reach or purpose, content blanked after delivery or expiry, and each download audited.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-06-A — Population prioritisation acceptance

- **Requirement:** BR-REP-06 — Population prioritisation. Assessment: **partial**. Target R14. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-REP-06, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Supervisor. Basis: requirement area default (BR-REP; catalogue owner "QA with Supervisor and programme manager").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-REP-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Prioritisation returns reasons and uncertainty for human allocation; neither payment nor eligibility is automatically changed." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Supervisors can inspect selection criteria and override an allocation with a reason; uncertainty remains visible.

**Known gaps** (assessment, remaining work for BR-REP-06): Approved gap/risk measures and real data-quality/fairness validation.

<details><summary>What the build does today (assessment, current state of BR-REP-06)</summary>

Human cohort selection with recorded criteria and allocation rationale.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-08-A — No silent adverse allocation acceptance

- **Requirement:** BR-RULE-08 — No silent adverse allocation. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-08, catalogue owner "QA with All actors".
- **Run as:** Supervisor. Basis: allocation is a supervisor decision.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Supervisor signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Supervisor and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The action catalogue excludes autonomous benefits, sanctions and employment decisions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Requests for an automatic denial or sanction produce no operational transaction and identify the required authority.

**Known gaps** (assessment, remaining work for BR-RULE-08): Independent adversarial acceptance of the final agent catalogue.

<details><summary>What the build does today (assessment, current state of BR-RULE-08)</summary>

Closed command catalogue has no denial, benefit sanction, pay or employment transaction.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
