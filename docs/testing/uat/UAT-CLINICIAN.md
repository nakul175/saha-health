<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the catalogue cases assigned to the Clinician role. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — Clinician

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

- **Who runs this:** invited by the owner with role Clinician and the care team (the owner account is also a clinician).
- **What this role can do:** Patients in the member's teams: care, clinical review, protocol and safety cases, identity decisions, emergency access. Membership does not verify professional credentials (docs/current/06).
- **Navigation this role sees** (from lib/saha/navigation.ts): My work, People, Submissions, Outreach, Care handover, Clinical governance, Pilot readiness, Programmes, AI tools, Connections, Activity log, Organisation & team.

- **Cases:** 29. Default Blocked: 0.

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
| TC-BR-ID-05-A | Patient matching with human resolution acceptance | BR-ID-05 (partial) | Not run |
| TC-BR-ID-08-A | Correctable identity links acceptance | BR-ID-08 (partial) | Not run |
| TC-BR-AG-01-A | Bounded task planning acceptance | BR-AG-01 (implemented-local) | Not run |
| TC-BR-AG-02-A | Context restricted to the task acceptance | BR-AG-02 (partial) | Not run |
| TC-BR-AG-03-A | Eligibility before tool selection acceptance | BR-AG-03 (partial) | Not run |
| TC-BR-AG-04-A | Approved execution paths acceptance | BR-AG-04 (implemented-local) | Not run |
| TC-BR-AG-05-A | Human authority at action boundaries acceptance | BR-AG-05 (implemented-local) | Not run |
| TC-BR-AG-07-A | Limits and cancellation acceptance | BR-AG-07 (partial) | Not run |
| TC-BR-AG-08-A | Conflicting outputs acceptance | BR-AG-08 (partial) | Not run |
| TC-BR-AG-09-A | Evidence behind explanations acceptance | BR-AG-09 (partial) | Not run |
| TC-BR-AI-02-A | Intended use and excluded use acceptance | BR-AI-02 (partial) | Not run |
| TC-BR-AI-05-A | Contract validation acceptance | BR-AI-05 (partial) | Not run |
| TC-BR-AI-06-A | Input quality and inability to assess acceptance | BR-AI-06 (partial) | Not run |
| TC-BR-AI-09-A | Multi-provider result history acceptance | BR-AI-09 (partial) | Not run |
| TC-BR-CLIN-01-A | Approved source library acceptance | BR-CLIN-01 (partial) | Not run |
| TC-BR-CLIN-02-A | Controlled clinical logic acceptance | BR-CLIN-02 (partial) | Not run |
| TC-BR-CLIN-03-A | Escalation without model dependence acceptance | BR-CLIN-03 (partial) | Not run |
| TC-BR-CLIN-05-A | Review and override acceptance | BR-CLIN-05 (partial) | Not run |
| TC-BR-CLIN-08-A | Harm reporting and review acceptance | BR-CLIN-08 (partial) | Not run |
| TC-BR-INT-12-A | Source and destination provenance acceptance | BR-INT-12 (partial) | Not run |
| TC-BR-INT-14-A | ABHA identity and record linking acceptance | BR-INT-14 (partial) | Not run |
| TC-BR-INT-18-A | Health Information Provider operation acceptance | BR-INT-18 (partial) | Not run |
| TC-BR-INT-19-A | Health Information User operation acceptance | BR-INT-19 (partial) | Not run |
| TC-BR-CARE-02-A | Service directory acceptance | BR-CARE-02 (partial) | Not run |
| TC-BR-CARE-03-A | Referral lifecycle acceptance | BR-CARE-03 (partial) | Not run |
| TC-BR-SEC-11-A | Emergency and support access acceptance | BR-SEC-11 (partial) | Not run |
| TC-BR-RULE-03-A | Review depends on unchanged evidence acceptance | BR-RULE-03 (implemented-local) | Not run |
| TC-BR-RULE-05-A | No false model equivalence acceptance | BR-RULE-05 (implemented-local) | Not run |
| TC-BR-RULE-07-A | No experimental output in care acceptance | BR-RULE-07 (partial) | Not run |

## Cases

### TC-BR-ID-05-A — Patient matching with human resolution acceptance

- **Requirement:** BR-ID-05 — Patient matching with human resolution. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-05, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Clinician. Basis: the identity link needs an authorised person decision; the assessment names clinician resolution.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Matching returns candidates with evidence and score only as assistance; a verified link needs an authorised person decision." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Same-name, shared-phone, spelling-variant and twin cases remain distinct unless an authorised reviewer resolves the identity link.

**Known gaps** (assessment, remaining work for BR-ID-05): Issuer-registry-backed identifier lookup (nothing contacts an issuer), validated matching performance, timing and enumeration testing by an independent reviewer, and approved wider identity resolution.

<details><summary>What the build does today (assessment, current state of BR-ID-05)</summary>

R10 scoped exact/similar-name candidates, explicit separate/provisional decisions and clinician resolution. Slice 1c: merges need two different stewards and are never automatic; merged records are not offered as matches. Slice 10e: search by one complete issuer identifier (a linked ABHA number, RCH ID or Ni-kshay ID) inside the searcher's own care scope only; exact whole-value formats, so a partial or wildcard identifier is refused rather than searched; each search is a material read audited before it returns and a search that finds nothing is audited too; per-searcher limits (30 an hour, 8 finding nothing an hour, 24 a day); a record outside the scope gets the same answer as no record. The programme issuer formats are illustrative and unchecked against the registries. Atomic-review slice: D1 admission reservations bound concurrent ABHA review probes before lookup; stable retries do not probe again, generic refusal is preserved, and 32 local concurrent attempts admit exactly three. No raw ABHA or patient identifiers enter protection rows.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-08-A — Correctable identity links acceptance

- **Requirement:** BR-ID-08 — Correctable identity links. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-08, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Clinician. Basis: link merges and corrections need two different stewards (assessment, slice 1c).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Link correction appends a superseding relationship and generates a downstream repair list from lineage records." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An authorised correction unlinks the wrong identity, flags affected submissions and records which external changes remain unresolved.

**Known gaps** (assessment, remaining work for BR-ID-08): Identifiers verified with their issuers (nothing contacts one), further programme issuers, sending crosswalks to destinations and destination-specific correction automation.

<details><summary>What the build does today (assessment, current state of BR-ID-08)</summary>

Identity revisions, EHR link revocation and changed-link rejection retain history. Slice 1c: two-steward link-based merge that preserves original records and receipts, invalidates pending approvals, queues downstream corrections and supports unmerge with review of work created while merged. Slice 6r: a clinician holding only emergency access to a record cannot propose, decide, unmerge or resolve a merge naming it. Slice 6u: the merge view returns the case reason and evidence only to a viewer who may see both records. Slice 10e: a person's programme identifiers (slice 2h imports and new links) form an append-only crosswalk ledger recording who linked each, when, where it came from and a verification state a person attests; corrections and withdrawals append and keep the earlier entry; one live holder per identifier, and a conflicting link opens the slice 1c identity case for two stewards and never merges; a holder outside the requester's scope is not revealed (steward review event on the holder, three a day per requester).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-01-A — Bounded task planning acceptance

- **Requirement:** BR-AG-01 — Bounded task planning. Assessment: **implemented-local**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-01, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Plan nodes are typed tool calls with dependencies, limits and authority class. Free text cannot create a new action type." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An out-of-scope request receives a clear limitation or referral to the correct role and does not trigger an improvised external action.

**Known gaps** (assessment, remaining work for BR-AG-01): Approved task catalogue and live-provider acceptance.

<details><summary>What the build does today (assessment, current state of BR-AG-01)</summary>

Closed extraction/summary/review task catalogue and explicit unavailable states. Slice 6ab: the summary source lists text facts only (no entered-unit, unusual-reason or provenance objects).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-02-A — Context restricted to the task acceptance

- **Requirement:** BR-AG-02 — Context restricted to the task. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-02, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Retrieve only authorised fields referenced by the current task; cache keys include tenant, person, purpose and policy version." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A cross-patient prompt cannot retrieve another person's information without a separately authorised task and permission check.

**Known gaps** (assessment, remaining work for BR-AG-02): Comprehensive sensitive-data minimisation, representative leak testing and purpose-specific review.

<details><summary>What the build does today (assessment, current state of BR-AG-02)</summary>

Patient/task-scoped input, exact-source approval and rejection of common identifiers in external narratives.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-03-A — Eligibility before tool selection acceptance

- **Requirement:** BR-AG-03 — Eligibility before tool selection. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-03, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The eligibility filter precedes cost or latency ranking and records excluded tools with machine-readable reasons." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A cheaper or available tool with an incompatible approved use is never substituted into the workflow.

**Known gaps** (assessment, remaining work for BR-AG-03): Jurisdiction, broader population/clinical scope, professional verification and quality eligibility acceptance.

<details><summary>What the build does today (assessment, current state of BR-AG-03)</summary>

Use-time checks for reviewed capability, model/agent, age, care team/role, task, language, setting and browser device.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-04-A — Approved execution paths acceptance

- **Requirement:** BR-AG-04 — Approved execution paths. Assessment: **implemented-local**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-04, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Tool arguments validate against closed schemas; executable action names are resolved only from the trusted registry." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Instructions embedded in a patient note or provider output cannot activate a new tool, reveal credentials or bypass a confirmation.

**Known gaps** (assessment, remaining work for BR-AG-04): Independent adversarial review and live-provider corpus acceptance.

<details><summary>What the build does today (assessment, current state of BR-AG-04)</summary>

Closed command/output schemas and grounded proposals cannot grant tools or credentials.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-05-A — Human authority at action boundaries acceptance

- **Requirement:** BR-AG-05 — Human authority at action boundaries. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-05, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Approval hashes bind actor, resource versions, action, recipient, purpose and capability versions; the executor checks them." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The agent cannot make itself the approving actor, and expired approvals cannot be reused for changed data or a different destination.

**Known gaps** (assessment, remaining work for BR-AG-05): Clinical authority policy and independently accepted action-boundary scenarios.

<details><summary>What the build does today (assessment, current state of BR-AG-05)</summary>

Actor-bound explicit approvals expire and stale data invalidates them.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-07-A — Limits and cancellation acceptance

- **Requirement:** BR-AG-07 — Limits and cancellation. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-07, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** None of the screens the evidence map cites is in this role's navigation. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Enforce max_steps, deadline and budget in the executor independently of model output; cancellation records residual work." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A looping provider interaction stops at the configured limit and reports which actions completed, were cancelled or remain unresolved.

**Known gaps** (assessment, remaining work for BR-AG-07): A looping-provider stop reporting completed/cancelled/unresolved actions across multi-step tasks, background detection and delivery of timed-out requests, provider billing API reconciliation, delivered alerts and validated provider outage operation.

<details><summary>What the build does today (assessment, current state of BR-AG-07)</summary>

One-call checkpointing, timeout/cancellation, per-capability daily call and reserved-token quotas; no automatic provider substitution. Slice 5a: monthly USD budgets per capability (estimates from recorded rates) checked before preparing and before sending; clinicians and supervisors with care scope can stop another worker's unsent request; sent requests are never reported as recalled. Slice 5e: per-capability task time and attempt limits in the reviewed manifest; unsent requests expire at the limit; a sent request without a result past the limit is shown as timed out with an uncertain outcome, never retried, and closed only by a recorded human decision; attempts beyond the limit refused before preparing and before sending; owner-owned budget alerts at 80% and 100% of estimated use. Slice 5h: owners record a provider invoice summary per provider and month and reconcile it against Saha's recorded estimates per model, with an owner-set threshold flag; records are append-only and audited, later ones supersede earlier ones, and budgets and rates are never changed automatically; owner-owned alerts for flagged variance and providers used without a reconciliation in the previous month.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-08-A — Conflicting outputs acceptance

- **Requirement:** BR-AG-08 — Conflicting outputs. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-08, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** Person page and visit, AI tools. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Store each model result separately. A conflict policy creates a human review task for incompatible outputs." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A designed model-disagreement case produces a review task with both original outputs and no fabricated combined diagnosis.

**Known gaps** (assessment, remaining work for BR-AG-08): Cross-model composition policy, routing beyond the requesting worker, comparison with earlier confirmed records and validated disagreement handling for risk outputs.

<details><summary>What the build does today (assessment, current state of BR-AG-08)</summary>

Conflicting extraction candidates are withheld; original results remain separate. Slice 5c: values that conflict with recorded facts or another open result are flagged on both results, listed as one action-plan review task with every original value, never combined, and applied only after an explicit choice with a reason.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-09-A — Evidence behind explanations acceptance

- **Requirement:** BR-AG-09 — Evidence behind explanations. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-09, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Clinician. Basis: requirement area default (BR-AG; catalogue owner "QA with Worker or clinician within active scope").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-09: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-09; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Recommendation records contain source fact IDs and rule or model version references; unsupported text is excluded." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Reviewers can trace each consequential recommendation to its underlying rule or approved output; unsupported answers are withheld or escalated.

**Known gaps** (assessment, remaining work for BR-AG-09): Verified clinical source content and consequential recommendation acceptance on representative scenarios.

<details><summary>What the build does today (assessment, current state of BR-AG-09)</summary>

Exact field evidence plus saved protocol findings with source edition/link and service-version attribution.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-02-A — Intended use and excluded use acceptance

- **Requirement:** BR-AI-02 — Intended use and excluded use. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-02, catalogue owner "QA with AI governance owner".
- **Run as:** Clinician. Basis: the capability is run on a patient case by a worker or clinician.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AI-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Eligibility predicates cover role, age basis, population, language, device, geography, quality and required history." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A capability approved for adults cannot run on a child case unless that use has separate approval.

**Known gaps** (assessment, remaining work for BR-AI-02): Verified intended use, jurisdiction and broader population criteria with representative clinical evidence.

<details><summary>What the build does today (assessment, current state of BR-AI-02)</summary>

Documentary capabilities enforce age, role/team, language, setting, device and task scope; clinical generation remains unavailable. Independent anaemia demo: explicitly synthetic environment and patient, normal care-role/team scope and per-image synthetic approval. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-05-A — Contract validation acceptance

- **Requirement:** BR-AI-05 — Contract validation. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-05, catalogue owner "QA with AI governance owner".
- **Run as:** Clinician. Basis: results are seen in the visit's assistant panel.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AI-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Validate request and response against pinned schemas, request correlation, media format and result semantics." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Malformed or unsupported responses are quarantined with an actionable error and cannot be presented as a valid clinical result.

**Known gaps** (assessment, remaining work for BR-AI-05): Capability-specific clinical semantics, media/asynchronous contracts and governed rejected-response quarantine.

<details><summary>What the build does today (assessment, current state of BR-AI-05)</summary>

Strict documentary output contracts, exact evidence/field checks and checkpointed failed results. Independent anaemia demo: strict versioned image/result contract, HMAC and input binding, one-call durable checkpoint and receipt-only recovery. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-06-A — Input quality and inability to assess acceptance

- **Requirement:** BR-AI-06 — Input quality and inability to assess. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-06, catalogue owner "QA with AI governance owner".
- **Run as:** Clinician. Basis: input quality is met when a result is requested for a visit.
- **Default result:** Not run
- **Start from:** Person page and visit, AI tools. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Capture quality failures carry retry guidance from approved provider instructions and do not yield clinical risk values." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A noisy cough recording produces a quality failure or valid retry instruction, never an implied negative screen.

**Known gaps** (assessment, remaining work for BR-AI-06): Signal/media quality checks, per-field assessment, complete unsupported-population taxonomy and representative validation.

<details><summary>What the build does today (assessment, current state of BR-AI-06)</summary>

Invalid/unavailable results stay separate; extraction uncertainty is withheld and language gates fail independently. Slice 5c: an explicit unable-to-assess outcome (noisy input, unsupported case, insufficient input) with a retry instruction and no values, shown as such and never applied. Independent anaemia demo: technical-quality unable_to_assess has no score; unknown outcomes remain unresolved without inference retry.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-09-A — Multi-provider result history acceptance

- **Requirement:** BR-AI-09 — Multi-provider result history. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-09, catalogue owner "QA with AI governance owner".
- **Run as:** Clinician. Basis: results are compared inside the encounter.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AI-09: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-09; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Results are immutable references with provider attribution. Switching a provider creates a new invocation, never rewrites history." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An encounter spanning a provider change shows both results independently with their input timestamps and review states.

**Known gaps** (assessment, remaining work for BR-AI-09): Complete legacy provenance, end-to-end input-time semantics and external-provider acceptance.

<details><summary>What the build does today (assessment, current state of BR-AI-09)</summary>

Original outputs, model/provider, versioned source and reasoned human decisions are retained. Independent anaemia demo: saved signed result, consent/visit/agreement versions and reasoned staff acknowledgement or rejection; no automatic clinical record update. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-01-A — Approved source library acceptance

- **Requirement:** BR-CLIN-01 — Approved source library. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-01, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Clinician. Basis: requirement area default (BR-CLIN; catalogue owner "QA with Clinical safety lead and clinician").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Knowledge entries require source, version, applicability, reviewer and expiry. Retrieval filters by active local approval." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Superseded or unapproved guidance cannot be offered as current advice, and each displayed recommendation links to its source.

**Known gaps** (assessment, remaining work for BR-CLIN-01): Approved source acquisition/content verification, document retrieval and clinical authorisation.

<details><summary>What the build does today (assessment, current state of BR-CLIN-01)</summary>

Immutable source metadata retains publisher/edition/link, applicability, owner, effective dates and independent review; protocols cite it.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-02-A — Controlled clinical logic acceptance

- **Requirement:** BR-CLIN-02 — Controlled clinical logic. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-02, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Clinician. Basis: requirement area default (BR-CLIN; catalogue owner "QA with Clinical safety lead and clinician").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The protocol engine evaluates reviewed decision tables; the LLM receives the decision and evidence for explanation only." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Rephrasing a prompt does not change a protocol's decision for the same confirmed facts.

**Known gaps** (assessment, remaining work for BR-CLIN-02): Clinically approved eligibility/red-flag logic, contraindications/interactions and scenario acceptance.

<details><summary>What the build does today (assessment, current state of BR-CLIN-02)</summary>

Bounded declarative observation/worker-concern rules with age/programme scope, freshness, sources and verified service dependencies.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-03-A — Escalation without model dependence acceptance

- **Requirement:** BR-CLIN-03 — Escalation without model dependence. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-03, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Clinician. Basis: requirement area default (BR-CLIN; catalogue owner "QA with Clinical safety lead and clinician").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Urgent protocol actions have a local route and contact record; provider waits cannot delay their display." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An urgent synthetic scenario follows the configured escalation path when cloud AI and external MIS services are unavailable.

**Known gaps** (assessment, remaining work for BR-CLIN-03): Approved escalation pathways, response operations and verified offline clinical availability.

<details><summary>What the build does today (assessment, current state of BR-CLIN-03)</summary>

Model-independent urgent-review findings cite current sources and service contacts; unknowns remain explicit.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-05-A — Review and override acceptance

- **Requirement:** BR-CLIN-05 — Review and override. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-05, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Clinician. Basis: requirement area default (BR-CLIN; catalogue owner "QA with Clinical safety lead and clinician").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Reviews capture accepted or rejected recommendation, reason, clinician identity and exact evidence snapshot." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The record distinguishes the model recommendation from the human decision and identifies the responsible professional.

**Known gaps** (assessment, remaining work for BR-CLIN-05): Verified clinical authority and acceptance across all consequential task types and corrections.

<details><summary>What the build does today (assessment, current state of BR-CLIN-05)</summary>

Reasoned accept/reject/override decisions retain original assistant and protocol evidence; clinician-only protocol decisions.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-08-A — Harm reporting and review acceptance

- **Requirement:** BR-CLIN-08 — Harm reporting and review. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-08, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Clinician. Basis: requirement area default (BR-CLIN; catalogue owner "QA with Clinical safety lead and clinician").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Safety case intake is available from the encounter and creates containment and follow-up assignments." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A safety report creates a visible case, preserves relevant versions and can initiate a capability hold and affected-case review.

**Known gaps** (assessment, remaining work for BR-CLIN-08): Real incident response operations, independent review and harm reporting acceptance.

<details><summary>What the build does today (assessment, current state of BR-CLIN-08)</summary>

Encounter-linked safety cases bind original versions, named clinical ownership, resolution evidence and optional capability/protocol hold.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-12-A — Source and destination provenance acceptance

- **Requirement:** BR-INT-12 — Source and destination provenance. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-12, catalogue owner "QA with Integration owner".
- **Run as:** Clinician. Basis: imported results and recorded observations are read in the patient record.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-12: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-12; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Source identifiers, author, effective time, original status and transformation versions survive import and export." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An imported laboratory result and an ASHA-recorded observation remain distinguishable after display, export and reconciliation.

**Known gaps** (assessment, remaining work for BR-INT-12): Element-level author/device, receipt/effective time and transformation lineage for all resources.

<details><summary>What the build does today (assessment, current state of BR-INT-12)</summary>

Imported source documents, timestamps and local submission provenance retained.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-14-A — ABHA identity and record linking acceptance

- **Requirement:** BR-INT-14 — ABHA identity and record linking. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-14, catalogue owner "QA with Integration owner".
- **Run as:** Clinician. Basis: ABHA linking is a patient-level action (assessment, slice 7a).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-14: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-14; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "ABHA verification and record-linking follow the onboarded flow with explicit user confirmation where required." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Tests cover verified ABHA linkage, declined linkage, absent ABHA, duplicate candidates, demographic mismatch and later correction without wrong-person disclosure.

**Known gaps** (assessment, remaining work for BR-INT-14): Authorised ABHA creation and verification with ABDM, a checksum if ABDM specifies one, issuer checks, and correction through ABDM.

<details><summary>What the build does today (assessment, current state of BR-INT-14)</summary>

Slice 7a: ABHA link after a mock one-time-code check, decline, unlink with history and consent revocation, one current record per ABHA number, masked display. Local mock gateway only. Slice 6r: patient history is redacted on read (ABHA numbers masked in revision data and field changes, received bundles withheld); stored revisions unchanged. Slice 6u: when the record already holding an ABHA number is outside the worker's scope, the link refusal is neutral and does not reveal it. Slice 6z: that refusal is now the ordinary link refusal (same status and text as a gateway refusal), and the server records the conflict as an audit event on the holding record for an identity steward; the requester is not told. Slice 6ab: an ABHA held by an out-of-scope record is refused before the one-time code is looked at; because the mock code is public the refusal is still distinguishable from a link, so the oracle is bounded (one steward review event per requester and holding record a day; after three in a day every further link by that requester is refused the same way), not removed. Slice 10e: an ABHA number is accepted as 14 digits or grouped 2-4-4-4 with hyphens and refused otherwise, in the link command and in search. No checksum is applied because no official specification of one was found: the PIB explainer and community guides call it a random 14-digit number, and abdm.gov.in and the sandbox documents could not be read from the build environment. ABHA review reservations apply before linking lookups, including audit-failure retention and rollout coverage; no live ABDM acceptance is implied.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-18-A — Health Information Provider operation acceptance

- **Requirement:** BR-INT-18 — Health Information Provider operation. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-18, catalogue owner "QA with Integration owner".
- **Run as:** Clinician. Basis: received records are reviewed by a clinician (assessment, slice 7b).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-18: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-18; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "HIP publication registers eligible local records and care contexts, then fulfils only verified authorised requests." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A consented request retrieves only the authorised records and produces traceable request, encryption, transfer, acknowledgement and error evidence without exposing unrelated records.

**Known gaps** (assessment, remaining work for BR-INT-18): Real gateway routing, partner HIP onboarding, ABDM-conformant encryption and callbacks, and more record types.

<details><summary>What the build does today (assessment, current state of BR-INT-18)</summary>

Slice 7b: care-context linking of confirmed visits under the current ABHA, and a mock HIP that encrypts consent-covered bundles for the requester (X25519, HKDF-SHA-256, AES-256-GCM) with checksums and delivery acknowledgement. Local mock gateway only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-19-A — Health Information User operation acceptance

- **Requirement:** BR-INT-19 — Health Information User operation. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-19, catalogue owner "QA with Integration owner".
- **Run as:** Clinician. Basis: received records are reviewed by a clinician (assessment, slice 7b).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-19: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-19; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "HIU retrieval tracks consent and data-flow transactions, decrypts through the authorised boundary and validates each bundle." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A received record is shown with its source and effective date, while invalid, duplicate or conflicting content enters the configured reconciliation path.

**Known gaps** (assessment, remaining work for BR-INT-19): Real consent-manager and gateway data flow, NRCeS profile validation and merging accepted records into care.

<details><summary>What the build does today (assessment, current state of BR-INT-19)</summary>

Slice 7b: consent-bound fetch with transfer tracking, decryption, checksum and bundle-type validation, and clinician review before any received record is accepted. Local mock gateway only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-02-A — Service directory acceptance

- **Requirement:** BR-CARE-02 — Service directory. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-02, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Clinician. Basis: requirement area default (BR-CARE; catalogue owner "QA with Worker clinician and supervisor").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CARE-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Directory entries require last_verified_at and supported services; expired availability is labelled and escalated." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A stale or unavailable service listing is labelled and routes the worker to an approved alternative or supervisor.

**Known gaps** (assessment, remaining work for BR-CARE-02): Real local-directory verification, urgent alternatives, availability updates and independent facility acceptance.

<details><summary>What the build does today (assessment, current state of BR-CARE-02)</summary>

Versioned service metadata, contacts, constraints, verification and expiry gate source-backed referral drafts; legacy free text is labelled.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-03-A — Referral lifecycle acceptance

- **Requirement:** BR-CARE-03 — Referral lifecycle. Assessment: **partial**. Target R14. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CARE-03, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Clinician. Basis: requirement area default (BR-CARE; catalogue owner "QA with Worker clinician and supervisor").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CARE-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Referral transitions attach evidence_type, evidence_ref and verifying actor; closure needs outcome or coded unresolved disposition." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Completion requires a defined evidence source and actor; unsupported closure attempts are rejected.

**Known gaps** (assessment, remaining work for BR-CARE-03): Facility-verified outcomes and external outcome evidence.

<details><summary>What the build does today (assessment, current state of BR-CARE-03)</summary>

Dated referral events with evidence. Slice 4a adds accepted, scheduled (with appointment time), attended, did-not-attend, declined, cancelled and unknown states under an explicit transition table; closed states are immutable.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-11-A — Emergency and support access acceptance

- **Requirement:** BR-SEC-11 — Emergency and support access. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-11, catalogue owner "QA with Privacy and security owners".
- **Run as:** Clinician. Basis: emergency access is a clinician action (assessment, slice 6a).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-11: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-11; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Exceptional access requires an approved role, purpose, scope, expiry and independent retrospective review." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A break-glass event is visible to the designated reviewer and automatically expires; an ordinary worker cannot invoke it unless specifically authorised.

**Known gaps** (assessment, remaining work for BR-SEC-11): Approved eligibility policy, support-staff access, step-up authentication, team notification and material-read audit during access.

<details><summary>What the build does today (assessment, current state of BR-SEC-11)</summary>

Slice 6a: clinician emergency access to one out-of-scope patient by record reference, 15 minutes to 4 hours, with reason, caps, urgent-care actions only, audit and single independent review by the patient's team. Slice 6r: the urgent-care-only restriction resolves every patient a command names (merge survivor/duplicate, identity and safety cases, legal holds, visits) and fails closed; reviewers need normal access to the patient and the review queue follows it. Slice 6u: outreach item and plan commands and reminder creation are restricted too (an item's patient, or every patient on the plan).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-03-A — Review depends on unchanged evidence acceptance

- **Requirement:** BR-RULE-03 — Review depends on unchanged evidence. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-03, catalogue owner "QA with All actors".
- **Run as:** Clinician. Basis: requirement area default (BR-RULE; catalogue owner "QA with All actors").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Approval includes hashes of facts, action, recipient, purpose, rules and model versions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Editing a measurement after referral approval prevents silent use of the previous approval for a changed recommendation.

**Known gaps** (assessment, remaining work for BR-RULE-03): Independent evidence review across the final clinical/integration catalogue.

<details><summary>What the build does today (assessment, current state of BR-RULE-03)</summary>

Visit/person/consent/connector/plan versions bind approvals and stale actions fail.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-05-A — No false model equivalence acceptance

- **Requirement:** BR-RULE-05 — No false model equivalence. Assessment: **implemented-local**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-05, catalogue owner "QA with All actors".
- **Run as:** Clinician. Basis: requirement area default (BR-RULE; catalogue owner "QA with All actors").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Result displays preserve provider-specific scales and calibration notes; unsupported score comparisons are disallowed." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A multi-model result screen avoids a fabricated common score and presents the required review path for disagreement.

**Known gaps** (assessment, remaining work for BR-RULE-05): Approved composition/disagreement policy if combined clinical outputs are introduced.

<details><summary>What the build does today (assessment, current state of BR-RULE-05)</summary>

Provider results stay separate; no common clinical risk score is produced.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-07-A — No experimental output in care acceptance

- **Requirement:** BR-RULE-07 — No experimental output in care. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-07, catalogue owner "QA with All actors".
- **Run as:** Clinician. Basis: requirement area default (BR-RULE; catalogue owner "QA with All actors").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-07: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Clinician signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Clinician and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Environment and output-use labels travel with every model result; live action builders reject test or shadow results." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An experimental high-risk result cannot trigger a live referral or patient notification outside an explicitly authorised evaluation protocol.

**Known gaps** (assessment, remaining work for BR-RULE-07): Hard environment segregation and experimental-result exclusion from future production care.

<details><summary>What the build does today (assessment, current state of BR-RULE-07)</summary>

Synthetic workspace and explicit simulation labels; live credentials absent.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
