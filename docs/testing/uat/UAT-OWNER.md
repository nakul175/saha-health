<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the catalogue cases assigned to the Organisation owner / programme lead role. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — Organisation owner / programme lead

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

- **Who runs this:** the account that first signs in to a new organisation (owner and clinician), or any member the owner flags as owner.
- **What this role can do:** Membership, teams, connections, governance activation, retention, budgets, pilot settings and data export. The owner flag gives no patient access beyond the member's own role and teams (lib/saha/platform.ts manage(); docs/current/06).
- **Navigation this role sees** (from lib/saha/navigation.ts): My work, People, Submissions, Outreach, Care handover, Clinical governance, Pilot readiness, Expansion, Operations, Programmes, AI tools, Connections, Activity log, Organisation & team.

- **Cases:** 53. Default Blocked: 7.

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
| TC-BR-ID-01-A | Workforce lifecycle acceptance | BR-ID-01 (partial) | Not run |
| TC-BR-ID-02-A | Scoped permissions acceptance | BR-ID-02 (partial) | Not run |
| TC-BR-ID-10-A | Organisational federation acceptance | BR-ID-10 (partial) | Blocked |
| TC-BR-DATA-09-A | Authoritative field mapping acceptance | BR-DATA-09 (partial) | Not run |
| TC-BR-DATA-10-A | Selective permitted reuse acceptance | BR-DATA-10 (partial) | Not run |
| TC-BR-DATA-11-A | Controlled migration acceptance | BR-DATA-11 (partial) | Not run |
| TC-BR-PROG-01-A | Versioned programme packs acceptance | BR-PROG-01 (partial) | Not run |
| TC-BR-PROG-06-A | Eligibility and enrolment distinction acceptance | BR-PROG-06 (partial) | Blocked |
| TC-BR-PROG-07-A | Protocol change and case continuity acceptance | BR-PROG-07 (partial) | Not run |
| TC-BR-PROG-08-A | Additional programme packs acceptance | BR-PROG-08 (partial) | Not run |
| TC-BR-AG-12-A | Change control for the agent acceptance | BR-AG-12 (partial) | Not run |
| TC-BR-AI-01-A | Capability registration acceptance | BR-AI-01 (partial) | Not run |
| TC-BR-AI-03-A | Evidence and deployment authorisation acceptance | BR-AI-03 (partial) | Not run |
| TC-BR-AI-04-A | Capability lifecycle acceptance | BR-AI-04 (partial) | Not run |
| TC-BR-AI-07-A | Version pinning acceptance | BR-AI-07 (partial) | Not run |
| TC-BR-AI-08-A | Least-data provider invocation acceptance | BR-AI-08 (partial) | Not run |
| TC-BR-AI-10-A | Monitoring and safety suspension acceptance | BR-AI-10 (partial) | Not run |
| TC-BR-AI-11-A | Provider self-service in a controlled environment acceptance | BR-AI-11 (partial) | Not run |
| TC-BR-AI-12-A | Cost and contractual limits acceptance | BR-AI-12 (partial) | Not run |
| TC-BR-CLIN-04-A | Scope of practice acceptance | BR-CLIN-04 (partial) | Not run |
| TC-BR-INT-01-A | Integration readiness contract acceptance | BR-INT-01 (partial) | Not run |
| TC-BR-INT-02-A | Independent read and write permissions acceptance | BR-INT-02 (partial) | Not run |
| TC-BR-INT-06-A | Inbound changes and reconciliation acceptance | BR-INT-06 (partial) | Not run |
| TC-BR-INT-07-A | Schema and mapping change control acceptance | BR-INT-07 (partial) | Not run |
| TC-BR-INT-08-A | Limited integration alternatives acceptance | BR-INT-08 (partial) | Not run |
| TC-BR-INT-09-A | Per-destination data minimisation acceptance | BR-INT-09 (partial) | Not run |
| TC-BR-INT-10-A | Standards-based exchange acceptance | BR-INT-10 (partial) | Not run |
| TC-BR-INT-11-A | Canonical exchange representation acceptance | BR-INT-11 (partial) | Not run |
| TC-BR-INT-13-A | ABDM participation scope acceptance | BR-INT-13 (partial) | Not run |
| TC-BR-INT-15-A | ABDM consent enforcement acceptance | BR-INT-15 (partial) | Not run |
| TC-BR-INT-16-A | Facility and professional attribution acceptance | BR-INT-16 (partial) | Blocked |
| TC-BR-INT-17-A | ABDM FHIR conformance and version control acceptance | BR-INT-17 (partial) | Not run |
| TC-BR-INT-20-A | EHR connector capability profile acceptance | BR-INT-20 (partial) | Not run |
| TC-BR-INT-21-A | EHR writeback and conflict handling acceptance | BR-INT-21 (partial) | Not run |
| TC-BR-INT-22-A | Legacy and document exchange acceptance | BR-INT-22 (partial) | Blocked |
| TC-BR-INT-23-A | Terminology and mapping governance acceptance | BR-INT-23 (partial) | Not run |
| TC-BR-INT-24-A | Conformance and production claims acceptance | BR-INT-24 (implemented-local) | Not run |
| TC-BR-CARE-07-A | External messaging and scheduling acceptance | BR-CARE-07 (partial) | Not run |
| TC-BR-OPS-01-A | Deployment configuration acceptance | BR-OPS-01 (partial) | Not run |
| TC-BR-OPS-02-A | Separation of environments acceptance | BR-OPS-02 (partial) | Not run |
| TC-BR-OPS-03-A | Controlled publishing and rollback acceptance | BR-OPS-03 (partial) | Not run |
| TC-BR-OPS-06-A | Training and competency acceptance | BR-OPS-06 (partial) | Not run |
| TC-BR-OPS-07-A | Data exit and continuity acceptance | BR-OPS-07 (partial) | Not run |
| TC-BR-OPS-08-A | Repeatable deployment packaging acceptance | BR-OPS-08 (partial) | Not run |
| TC-BR-SEC-01-A | Purpose and lawful authority acceptance | BR-SEC-01 (partial) | Not run |
| TC-BR-SEC-05-A | Encryption and secrets acceptance | BR-SEC-05 (partial) | Blocked |
| TC-BR-SEC-06-A | Tenant and record isolation acceptance | BR-SEC-06 (partial) | Not run |
| TC-BR-SEC-08-A | Audit evidence acceptance | BR-SEC-08 (partial) | Not run |
| TC-BR-SEC-09-A | Controlled retention and disposal acceptance | BR-SEC-09 (partial) | Blocked |
| TC-BR-SEC-10-A | Rights and correction workflow acceptance | BR-SEC-10 (partial) | Not run |
| TC-BR-SEC-12-A | Provider and supply-chain assurance acceptance | BR-SEC-12 (partial) | Not run |
| TC-BR-SEC-14-A | Hosting and cross-border controls acceptance | BR-SEC-14 (partial) | Blocked |
| TC-BR-RULE-06-A | Rechecks at execution time acceptance | BR-RULE-06 (implemented-local) | Not run |

## Cases

### TC-BR-ID-01-A — Workforce lifecycle acceptance

- **Requirement:** BR-ID-01 — Workforce lifecycle. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-01, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Organisation owner / programme lead. Basis: invitations, role changes and suspension are owner actions (platform.ts manage()).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Membership activation follows institutional verification; suspension increments a revocation version consumed by all services." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A suspended user's online access and pending privileged actions are revoked within the NFR limit, with offline limits disclosed.

**Known gaps** (assessment, remaining work for BR-ID-01): Formal verification, scheduled or API workforce feeds, upstream de-provisioning, batches over 100 rows, verified and displayed external staff ids, and production identity governance.

<details><summary>What the build does today (assessment, current state of BR-ID-01)</summary>

Account-bound invitations, role/team changes, suspension and immediate online access checks. Slice 1b adds removal that requires the caseload to be transferred first, keeps history and needs a new invitation to return. Slice 1d adds roster-based bulk invitation, update and suspension. Slice 10d adds workforce import from a CSV file: an owner uploads a roster (name, account code, role, team, status, optional external staff id) for a dry run that lists invitations to create, memberships to update or suspend, rows rejected with reasons and conflicts under a plan hash, downloads a rejection report and applies exactly the previewed plan (refused if anything changed since), on the slice 1d rules, in batches of at most 100 rows with an audit record.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-02-A — Scoped permissions acceptance

- **Requirement:** BR-ID-02 — Scoped permissions. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-02, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Organisation owner / programme lead. Basis: the boundaries are tested across several roles and teams, which only an owner can set up.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-ID-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-ID-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Policy input includes tenant, active role, assignment, programme, facility, purpose, action and resource sensitivity." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Negative tests cover each boundary and prove that hidden screens or manipulated requests cannot expand access.

**Known gaps** (assessment, remaining work for BR-ID-02): Validated facility and geography directories, locality-based caseload transfer, and acceptance with named reviewers.

<details><summary>What the build does today (assessment, current state of BR-ID-02)</summary>

Organisation, team, role and direct-worker scope enforced on reads/writes/exports. Slice 1e: time-limited, revocable delegation of team supervision (assignment, rights, action-plan and referral stewardship) and of reporting-only aggregates, enforced on the server, ineffective once either party stops qualifying, each use audited. Slice 6p (independent review): the delegation limit counts only delegations still in force, so ended and revoked records no longer block grants; the audit-chain export and data exit give the sandbox provider role no patient scope. Slice 6q: stored delegation records are capped at 1,000 (kept as evidence); export retries re-check care scope; shadow runs are limited to the runner's care scope. Slices R08 and R09 added owner-managed facility/locality scope and programme grants; slice 13a applies both in every normallyAllowed check and in the SQL pre-filter (viewer-scoped reads, patient list and detail, work lists, identifier search), and refuses API requests another website started. Slice 13f: the cross-site gate no longer depends on how the path is spelled (an encoded /api/ path was let through), and receiving workers and assignees must be inside the facility, locality and programme policy.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-10-A — Organisational federation acceptance

- **Requirement:** BR-ID-10 — Organisational federation. Assessment: **partial**. Target R15. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-ID-10, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Organisation owner / programme lead. Basis: owners reconcile membership with an institution roster (assessment, slice 1d).
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-ID-10: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Buyer-approved federation or identity-provider sync, automatic upstream removal feed and controlled emergency administration.” (BR-ID-10, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Federated groups map through reviewed local role mappings; an external group cannot grant an unmapped clinical privilege."

**Expected result** (catalogue): An upstream removal or scope change is reflected within the approved synchronisation window, including termination of incompatible sessions.

**Known gaps** (assessment, remaining work for BR-ID-10): Buyer-approved federation or identity-provider sync, automatic upstream removal feed and controlled emergency administration.

<details><summary>What the build does today (assessment, current state of BR-ID-10)</summary>

Slice 1d: owners reconcile membership with an institution roster (up to 100 rows per batch): preview, then apply exactly that preview to invite, update roles and teams, and suspend leavers; never removes, never reactivates a local suspension, never suspends an owner.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-09-A — Authoritative field mapping acceptance

- **Requirement:** BR-DATA-09 — Authoritative field mapping. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-09, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** Organisation owner / programme lead. Basis: only an owner configures programme delivery and its mapping (mis.ts).
- **Default result:** Not run
- **Start from:** Connections, Submissions. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-09; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Mapping packages contain source field, target field, transformation, unit and null semantics plus conformance fixtures." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A mapping change passes owner-approved fixtures and does not reinterpret earlier accepted records without a documented migration.

**Known gaps** (assessment, remaining work for BR-DATA-09): Native partner/clinical terminology and source semantics acceptance, representative external conformance corpus and larger-history qualification remain. Closed deterministic software semantics and owner-declared conformance are delivered; they do not establish partner approval. Unknown delivery remains lookup-only.

<details><summary>What the build does today (assessment, current state of BR-DATA-09)</summary>

MIS mapping versions and selected field allowlists are bound to submissions. App-first B07 adds immutable source-versioned effective-dated drafts, exact current-state count-only impact/review/publication and append-only rollback. Due reviewed changes block new work until explicit publication/cancellation; publication suspends delivery for existing connection tests. Pending-plan applicability and phone hash wrapping are independently repaired. App-first reviewed conformance adds closed deterministic transform and unit/missing rules, explicit unmapped handling and independent source-versioned required-field/code examples; per-field impact protects current queued work and reviewed rollback preserves conformance.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-10-A — Selective permitted reuse acceptance

- **Requirement:** BR-DATA-10 — Selective permitted reuse. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-DATA-10, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** Organisation owner / programme lead. Basis: per-destination allowlists are owner-managed connection settings.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-DATA-10: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-10; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Each action creates a field allowlist from the approved destination and purpose; a source fact can have several permitted uses." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A fact approved for one task is excluded from another provider's payload when that second use lacks the required permission.

**Known gaps** (assessment, remaining work for BR-DATA-10): Approved purpose vocabulary and per-destination reuse policy; re-checking already prepared payloads when a grant changes.

<details><summary>What the build does today (assessment, current state of BR-DATA-10)</summary>

Per-connector mapping allowlists, AI permission and scoped EHR permissions. Slice R09 added purpose-limited grants; slice 13a checks them at every data-flow checkpoint (plans, submissions, destination enrolment, identifier corrections, incentive claims, EHR and ABDM flows, assistant runs, anaemia and frontline providers, aggregate reports and indicator figures, household disclosure).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-DATA-11-A — Controlled migration acceptance

- **Requirement:** BR-DATA-11 — Controlled migration. Assessment: **partial**. Target R15. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-DATA-11, catalogue owner "QA with Frontline worker and programme data owner".
- **Run as:** Organisation owner / programme lead. Basis: imports and migrations are dry-run and applied by owners, supervisors or delegates; run by the owner.
- **Default result:** Not run
- **Start from:** Organisation & team, Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-DATA-11; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Migration runs produce source totals, parsed totals, rejected rows, duplicate candidates and reversible import batch IDs." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A migration sample reconciles source counts, rejects, merges and accepted records, with a reversible process for failed batches.

**Known gaps** (assessment, remaining work for BR-DATA-11): Wider import quality reports, issuer verification/correction, representative source contracts and larger media/history qualification remain. Documentary imported-source review and overlap decisions are delivered within declared limits; partner clinical-version conflict queues remain separate B09 work. Formal/clinical/external acceptance stays pending.

<details><summary>What the build does today (assessment, current state of BR-DATA-11)</summary>

Legacy workspace migration validates counts, source hash and rollback; a controlled fixture-marking migration has an owner dry run with counts and rejects, applies only the reviewed plan with per-record lineage and an audit batch, and reverses a batch. Slice 2f: a controlled patient import: owners, supervisors and supervision delegates dry-run a CSV of people for their teams (accepted, rejected with reasons, possible duplicates against permitted records and earlier rows; ids and counts only) under a plan hash bound to the rows and record versions, then apply only that plan with lineage, a revision per person and one counted audit event. Slice 6p (independent review): a fixture batch reversal removes marks only from records in the reverting owner's care scope; others keep their mark, are reported and can be reversed by an owner whose scope covers them (each mark once). Slice 6q: the ASHA role no longer imports (her duplicate matching could not see other ASHAs' patients); the import file limit is 16,000 UTF-8 bytes. Slice 2h: the same importers dry-run CSVs of programme enrolments and external identifiers for existing people matched by a Saha record id or an exact recorded identifier (one neutral reason for unknown and out-of-scope records): episodes open on the adopted or a named compiled or activated pack version and an already open episode is refused; identifiers are format-checked for known issuers, ABHA is refused, and a value already on another record is refused, naming that record only when the importer can see it; apply takes only the plan with lineage, a revision per record and one counted audit event. Every import dry run (people, enrolments, identifiers) has a downloadable rejection report of row numbers and reasons only, formula-escaped, with a control total and SHA-256 manifest, recorded as an audited export. Slice 6aa: identifier import accepts listed issuers only (rch, nikshay) and refuses ABHA-shaped values under any issuer; the rejection report's audit event no longer moves the organisation revision. Slice 10i: an owner or a clinician (not an ASHA, an administrator or a supervisor who is not an owner) dry-runs a CSV of historical visits with clinical content, one row per visit, for people in their own normal care scope (owner authority and emergency access do not widen it): person by record id or recorded identifier (one neutral reason for unknown and out-of-scope records), visit date, source system, measurements with a stated unit and a source (measured or reported), an override reason and notes. Units are stated and converted by the slice 2i rules; a value outside the placeholder expected range needs a reason and one beyond the confirmation range is refused; a visit already imported from the same source system on the same date, or repeated in the file, is refused. The dry run lists the visits to create and the rows rejected with reasons, the SHA-256 of the file and a plan hash, and returns no clinical values or notes; apply takes only that plan and creates confirmed visits marked IMPORTED with lineage (file digest, row, importer, time) and no clinician review or sign-off implied, with a revision per visit and one counted audit event. An import never creates enrolments, submissions, referrals or plans and never changes the person; an imported visit is read-only history, kept out of sending, referral, publication, assistant summaries, FHIR download, indicators, reports, pilot and shadow measures, freshness and work statistics, so it is not reused as a current observation without a fresh measurement. The rejection report covers visits. The placeholder value ranges are not clinically approved. App-first B08 contacts dry-run/hash/apply retains source/file/row/batch provenance, always imports permission false and refuses overwriting care preferences. Reviewed contact-only reversal appends withdrawal and requires unchanged unconsented preferences; original actor current all-person/purpose authority applies to saved receipts. Actual phone recovery/export and independent consent/authority checks pass. App-first imported evidence adds pinned documentary answers, structured notes and bounded original media bytes, independent explicit source decisions, empty linked current drafts, same-date overlap review and retained batch withdrawals. Independent review repairs merged-original audited history, scoped saved-receipt recovery and phone overflow; no source facts become current automatically.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-01-A — Versioned programme packs acceptance

- **Requirement:** BR-PROG-01 — Versioned programme packs. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-01, catalogue owner "QA with Programme owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-PROG; catalogue owner "QA with Programme owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-PROG-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Activation requires valid schemas, approved mappings, effective dates and named programme and clinical approvals." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An incomplete or unapproved pack cannot be activated, and each completed encounter records the pack version used.

**Known gaps** (assessment, remaining work for BR-PROG-01): Integrate complete governed manifests with programme questions, indicators and approved clinical protocols.

<details><summary>What the build does today (assessment, current state of BR-PROG-01)</summary>

Version-pinned illustrative packs plus immutable, independently reviewed source/service/protocol packages.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-06-A — Eligibility and enrolment distinction acceptance

- **Requirement:** BR-PROG-06 — Eligibility and enrolment distinction. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-06, catalogue owner "QA with Programme owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-PROG; catalogue owner "QA with Programme owner").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-PROG-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Destination-authorised enrolment request/rejection/acceptance lifecycle.” (BR-PROG-06, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Enrolment stores eligibility_assessment and external_registration independently; only a verified receipt confirms the latter."

**Expected result** (catalogue): A person whose external enrolment is rejected remains locally visible with a clear rejection reason and no false enrolled status.

**Known gaps** (assessment, remaining work for BR-PROG-06): Destination-authorised enrolment request/rejection/acceptance lifecycle.

<details><summary>What the build does today (assessment, current state of BR-PROG-06)</summary>

Local episodes explicitly show official registration not submitted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-07-A — Protocol change and case continuity acceptance

- **Requirement:** BR-PROG-07 — Protocol change and case continuity. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-PROG-07, catalogue owner "QA with Programme owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-PROG; catalogue owner "QA with Programme owner").
- **Default result:** Not run
- **Start from:** Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Pack migration computes affected open cases and applies an approved transition plan at an effective timestamp." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Updating a referral rule identifies affected open work and requires reviewed migration rather than silently rewriting past decisions.

**Known gaps** (assessment, remaining work for BR-PROG-07): Approved pack versions with their own clinical review, per-team adoption, answer migration and schedule recomputation, a reviewed reverse path, and coordinated version changes across installed packs (installation is BR-PROG-08).

<details><summary>What the build does today (assessment, current state of BR-PROG-07)</summary>

Immutable protocol revisions, effective/review dates, dependency invalidation, scoped related records and new-review-only transition. Slice 4e adds reviewed migration of open episodes to a newer pack version: an owner or clinician dry run over open episodes on older versions in their care scope with the changes between versions, candidates and episodes blocked with reasons (open visit, merged record, restriction, no reviewed mapping), a plan hash bound to record versions, apply of exactly that plan with a revision and episode history entry per episode and one counted audit batch, confirmed visits kept on their version, and owner adoption of the new version for new episodes; exercised with one illustrative maternal v2. Slice 6w: a clinician's dry run counts episodes within their care scope only (no out-of-scope count) and the batch history shows them only the batches they applied, without organisation-wide counts; owners see both as before.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-PROG-08-A — Additional programme packs acceptance

- **Requirement:** BR-PROG-08 — Additional programme packs. Assessment: **partial**. Target R16. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-PROG-08, catalogue owner "QA with Programme owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-PROG; catalogue owner "QA with Programme owner").
- **Default result:** Not run
- **Start from:** Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-PROG-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Additional packs use the same schema with their own definitions and reviewed value sets; pack IDs remain stable across versions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A new pack can reuse common identity and observations while defining independent schedules, role boundaries and destination rules.

**Known gaps** (assessment, remaining work for BR-PROG-08): Clinically approved pack content and a clinical sign-off workflow; new programme categories with MIS/EHR/report routing; automated schedules and escalation from installed rules; translations; per-team adoption; cross-organisation publication and production rollout.

<details><summary>What the build does today (assessment, current state of BR-PROG-08)</summary>

Slice 4f: an owner uploads a size-bounded, strictly validated data-only pack manifest (questions on shared facts with fixed units or options, show-when conditions, follow-up interval, escalation rules in the protocol rule vocabulary, declared mapping from earlier versions); conflicts with compiled and installed packs are refused; a clinician other than the uploader reviews the exact manifest hash; an owner activates; activation, review and retirement are versioned and audited, retirement never deletes; episodes open only on activated versions and slice 4e migration moves open episodes to an installed version through the declared mapping. Synthetic packs only; installed packs are marked not clinically approved. Expansion proposals still describe programmes without installing them. Slice 6z: question ids that name Object.prototype members (constructor, toString and similar) are refused by the manifest schema, and answers and absence reasons are read as own properties only, for installed and compiled packs. Optional installed reviewed completion/referral declarations pin exact rule/question/version/hash and do not invent rules for legacy compiled packs.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AG-12-A — Change control for the agent acceptance

- **Requirement:** BR-AG-12 — Change control for the agent. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AG-12, catalogue owner "QA with Worker or clinician within active scope".
- **Run as:** Organisation owner / programme lead. Basis: agent change control is governance, which owners activate.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AG-12: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AG-12; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Agent release manifests pin prompts, tools, safety tests, model release IDs and rollback compatibility." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Operators can identify the exact configuration behind an encounter and restore a previously approved configuration after a regression.

**Known gaps** (assessment, remaining work for BR-AG-12): Formal prompt/routing change approval, complete impact analysis and operational rollback validation.

<details><summary>What the build does today (assessment, current state of BR-AG-12)</summary>

Pinned agent/model and immutable capability revisions; independent review, retirement/hold and scoped related-encounter list.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-01-A — Capability registration acceptance

- **Requirement:** BR-AI-01 — Capability registration. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-01, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AI-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "A manifest version is immutable and owned by one verified provider; missing evidence keeps its activation state incomplete." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Registration cannot reach an active state while mandatory manifest fields or accountable ownership are missing.

**Known gaps** (assessment, remaining work for BR-AI-01): Live provider onboarding, evidence ownership and verification of the full accountable manifest.

<details><summary>What the build does today (assessment, current state of BR-AI-01)</summary>

Versioned capability manifest records owner, model/task/context scope, support and data terms; reviewed activation required. Independent anaemia demo: separate provider organisation, customer agreement revision and independent administration; demo agreement only. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-03-A — Evidence and deployment authorisation acceptance

- **Requirement:** BR-AI-03 — Evidence and deployment authorisation. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-03, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-AI-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Evidence and approval are distinct records tied to provider version, population, study setting and deployment scope." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A technically successful API test cannot activate a clinical capability without the required documented evidence and deployment approvals.

**Known gaps** (assessment, remaining work for BR-AI-03): Regulatory status, representative clinical evidence and signed deployment authorisation; no real approval recorded.

<details><summary>What the build does today (assessment, current state of BR-AI-03)</summary>

Version-bound synthetic evaluation, separate clinical review and owner activation are persisted and checked at use. Independent anaemia demo remains outside clinical activation and carries clinicalUse:false; real model use is engineering-only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-04-A — Capability lifecycle acceptance

- **Requirement:** BR-AI-04 — Capability lifecycle. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-04, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Clinical governance. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Lifecycle transitions require scoped roles; registration and deployment approval are independent permissions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A provider cannot self-activate; suspension blocks new invocations and identifies in-progress work requiring cancellation or review.

**Known gaps** (assessment, remaining work for BR-AI-04): Verified registration step, deployment-specific activation, automatic and live-provider shadow runs, delivered impact queues and live lifecycle acceptance.

<details><summary>What the build does today (assessment, current state of BR-AI-04)</summary>

Draft/reviewed/active/suspended/retired revisions, replacement history and scoped affected-encounter views. Slice 5d: BRD lifecycle stages derived per package (registered, technically verified, approved for scope, active, suspended, retired, replaced), replacement recorded on activation, use counted per exact version, and in-progress work of an unusable capability identified with its required action (cancel, withheld, review, check applied values) on the governance page and in the audit line. Slice 5f: shadow operation of a reviewed revision for named teams or the whole organisation over at most 30 days; runs on confirmed visits (local rules provider only) without showing, applying or planning its output; consent, restriction, budget and lifecycle respected. Slice 6q (second independent review): a shadow's teams are limited to the revision's reviewed teams (organisation scope is the overlap); running and stopping need an owner or a member of every shadow team, also on replay; visits outside the runner's normal care scope are skipped and counted.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-07-A — Version pinning acceptance

- **Requirement:** BR-AI-07 — Version pinning. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-07, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Clinical governance. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Each invocation stores manifest version, provider release ID, input hash and adapter version; mutable aliases are not accepted alone." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A provider version change triggers quarantine or controlled reapproval and cannot silently replace a validated version.

**Known gaps** (assessment, remaining work for BR-AI-07): Formal provider change review, live contract compatibility and historical legacy provenance limitations.

<details><summary>What the build does today (assessment, current state of BR-AI-07)</summary>

Agent/model/capability/corpus versions are bound; legacy HTTP AI bypass is disabled. Slice 5g: provider and model history per capability key (pinned provider, model and agent version per revision, changes from the previous revision, activity period, stage and request counts) for governance managers. Independent anaemia demo: pinned provider, ONNX model/hash and contract retained per request. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-08-A — Least-data provider invocation acceptance

- **Requirement:** BR-AI-08 — Least-data provider invocation. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-08, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Person page and visit, Connections. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Build payloads from manifest-required fields intersected with purpose permissions; log references rather than raw payloads." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Payload inspection confirms excluded identifiers are absent and a provider with incompatible retention terms is blocked.

**Known gaps** (assessment, remaining work for BR-AI-08): Complete representative minimisation assessment and enforceable provider retention, training, subprocessor and region compliance; no clinical or real-provider acceptance.

<details><summary>What the build does today (assessment, current state of BR-AI-08)</summary>

Structured identity excluded; common free-text identifiers rejected; manifest retains region, retention, training prohibition and agreement reference. Independent anaemia demo: cropped RGB only, no identity/notes/EXIF, no stored image pixels in either request ledger. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval. Mapped AI/frontline narratives are checked after decoding; normalization is used only for comparison, retaining the exact approved wire body/hash. Cropped image envelopes require exact RGB dimensions/digest and exclude identity/EXIF. Independent destination/header review retains the original defensive findings and verifies repaired transport boundaries.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-10-A — Monitoring and safety suspension acceptance

- **Requirement:** BR-AI-10 — Monitoring and safety suspension. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-10, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Clinical governance. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-10; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Suspension sets an effective timestamp, prevents new admissions and emits tasks for affected pending or recent encounters." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Operators can suspend a named version, identify affected encounters and assign follow-up without disabling unrelated safe capabilities.

**Known gaps** (assessment, remaining work for BR-AI-10): Representative quality monitoring on live, representative data rather than local-rules shadow comparisons, configurable drift thresholds, drift from synthetic evaluations, independent ground-truth annotation and adjudication, delivered alerting and clinical response operations.

<details><summary>What the build does today (assessment, current state of BR-AI-10)</summary>

Versioned fixture scores by field/language/group, scoped related records, safety cases and immediate capability hold. Slice 5f: shadow outputs compared per field with clinician-confirmed values (agreement, disagreement, missing, not recorded, unable to assess), counts only to governance managers. Slice 5i: drift monitoring per capability revision from shadow comparisons: agreement rate per 7-day period by visit confirmation date over the last four periods, and a flag when the rate drops by more than 10 percentage points between consecutive periods with at least 10 rated fields each, counts only, to governance managers on the Clinical governance page; nothing is suspended automatically. Slice 6q: shadow comparisons (the drift input) no longer include teams outside the revision's reviewed teams or patients outside the runner's care scope. Slice 13c: shadow and drift counts use the comparison as it stands now: recomputed against a confirmed correction, left out for a voided visit or an unconfirmed correction.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-11-A — Provider self-service in a controlled environment acceptance

- **Requirement:** BR-AI-11 — Provider self-service in a controlled environment. Assessment: **partial**. Target R16. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-AI-11, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Clinical governance. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-11; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Provider workspaces allow manifest drafts and synthetic fixtures only; live activation stays in deployment governance." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Provider test access remains limited to its own capability and synthetic environment; production activation follows the standard review path.

**Known gaps** (assessment, remaining work for BR-AI-11): Physically isolated environment, provider-registered test endpoints, provider-facing contract and independent acceptance.

<details><summary>What the build does today (assessment, current state of BR-AI-11)</summary>

Slice 5b: provider sandbox organisations (no patient records, one provider) with a provider-only role limited to its own documentation, credential references, capability proposals and synthetic evaluations; owner import into production as a draft that must pass production evaluation, independent review and owner activation. Slice 6p (independent review): the sandbox import no longer reads another organisation before checking ownership, and gives one 404 for not found, not a sandbox and not the importer's own. Eight frontline demo providers: independent apps/stores, speech or printed-text OCR, confirmed synthetic input, checkpointed signed receipts and staff review; no clinical deployment approval.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-AI-12-A — Cost and contractual limits acceptance

- **Requirement:** BR-AI-12 — Cost and contractual limits. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-AI-12, catalogue owner "QA with AI governance owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-AI; catalogue owner "QA with AI governance owner").
- **Default result:** Not run
- **Start from:** Operations. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-AI-12; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Budget admission reserves the maximum approved call cost and settles actual charges or releases unused reservation." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Reaching a cost limit results in a visible controlled fallback and does not silently select an unapproved model.

**Known gaps** (assessment, remaining work for BR-AI-12): Provider and deployment budgets, delivered (pushed) budget alerts, evaluation and other AI cost coverage, reconciliation by provider billing API rather than an owner-entered summary, and per-provider or historical cost rates.

<details><summary>What the build does today (assessment, current state of BR-AI-12)</summary>

Per-capability daily call and reserved-token limits with reported usage and bounded synthetic evaluations. Slice 5a: owner-set monthly USD budget per capability, estimated from recorded rates and reservations, refusal with a visible message and no provider substitution, and budget use on the Operations page. Slice 5e: computed alerts at 80% and 100% of a capability's estimated monthly budget, owned and acknowledged by organisation owners, labelled as estimates; per-capability task attempt limits. Slice 5h: invoice reconciliation per provider, model and month (Saha's estimated tokens and USD against owner-recorded invoiced tokens and USD, with differences and an owner-set threshold flag), append-only and audited with supersession, shown to owners and administrators on Operations, and owner-owned variance and unreconciled-month alerts.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CLIN-04-A — Scope of practice acceptance

- **Requirement:** BR-CLIN-04 — Scope of practice. Assessment: **partial**. Target R11. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-CLIN-04, catalogue owner "QA with Clinical safety lead and clinician".
- **Run as:** Organisation owner / programme lead. Basis: the case changes a user's role, which only an owner can do.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-CLIN-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CLIN-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Clinical command policy uses verified credentials and locally approved scope, not role label alone." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): User role changes modify available clinical actions, and server-side tests reject unauthorised orders.

**Known gaps** (assessment, remaining work for BR-CLIN-04): Verified professional authority and action-specific clinical scope policies.

<details><summary>What the build does today (assessment, current state of BR-CLIN-04)</summary>

Role checks prevent supervisor clinical writes; prescribing/ordering is unavailable.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-01-A — Integration readiness contract acceptance

- **Requirement:** BR-INT-01 — Integration readiness contract. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-01, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Connector activation requires owner agreement, allowed operations, exact environment, receipt examples and support contact." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A connector cannot be labelled live until the receiving owner has accepted its tested scope and production access is enabled.

**Known gaps** (assessment, remaining work for BR-INT-01): Receiving-owner contracts, complete supported operations and live acceptance.

<details><summary>What the build does today (assessment, current state of BR-INT-01)</summary>

MIS/EHR configuration, capability probes and scoped credential gates.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-02-A — Independent read and write permissions acceptance

- **Requirement:** BR-INT-02 — Independent read and write permissions. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-02, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-02: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "The operation allowlist independently grants search, read, create, amend, delete, export and status lookup." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A read-only connector exposes no active write path and clearly states when programme updates require a separate process.

**Known gaps** (assessment, remaining work for BR-INT-02): Live partner adapters configured and tested with narrowed operations; void and aggregate report paths; AI providers are not covered; production acceptance.

<details><summary>What the build does today (assessment, current state of BR-INT-02)</summary>

EHR read/write directions and local scoped permissions are independent. Slice 7e: every programme destination, EHR connection and the mock ABDM gateway has owner-managed, versioned and audited create, update, delete or void, lookup and aggregate permissions, checked on the server before preparation and again inside each external-execution checkpoint; a withdrawal closes the item as not sent, shown on the trace and in the exception queue. Slice 6ab: a correction to a demonstration destination is classified as update by an accepted submission of a visit it corrects; ABDM consent requests are governed by lookup (a revocation always applies; delete decides only whether the mock gateway is told); an EHR publication rechecks create before its Patient read.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-06-A — Inbound changes and reconciliation acceptance

- **Requirement:** BR-INT-06 — Inbound changes and reconciliation. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-06, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Inbound updates retain source version and effective time; conflicts produce a review record against local pending changes." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An external status change does not silently discard an unsynchronised local correction, and the responsible reviewer sees both.

**Known gaps** (assessment, remaining work for BR-INT-06): Scheduled reconciliation and broader inbound clinical conflict queues.

<details><summary>What the build does today (assessment, current state of BR-INT-06)</summary>

Receipt callbacks/lookups and staged document imports preserve source data. Slice 6u: programme callbacks are authenticated (server grant and signature) before any organisation data is read, and every authentication failure gets the same 401. Reviewed retrieval handoff and current-service repair retain original records/receipts and refuse revocation during the final response; exact saved history receipt replay performs no external retry or new care write.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-07-A — Schema and mapping change control acceptance

- **Requirement:** BR-INT-07 — Schema and mapping change control. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-07, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-07: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Schema upgrades validate fixtures and pending payload compatibility before activation; incompatible work pauses visibly." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A removed mandatory destination field causes a controlled connector exception, not silent data loss or guessed replacement values.

**Known gaps** (assessment, remaining work for BR-INT-07): Owner-reviewed external schema change detection and preserved-queue migration.

<details><summary>What the build does today (assessment, current state of BR-INT-07)</summary>

Connector versions invalidate queued approvals; mapping fixtures reject unsupported fields.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-08-A — Limited integration alternatives acceptance

- **Requirement:** BR-INT-08 — Limited integration alternatives. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-08, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "File exports and assisted hand-offs retain a local action ID and prepared state until external acceptance evidence exists." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Exported files carry reconciliation identifiers; a prepared export is never reported as accepted until acceptance evidence is recorded.

**Known gaps** (assessment, remaining work for BR-INT-08): Owner-authorised batch/assisted workflows with reconciliation identifiers and receipts.

<details><summary>What the build does today (assessment, current state of BR-INT-08)</summary>

Labelled FHIR document import/export without assumed acceptance.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-09-A — Per-destination data minimisation acceptance

- **Requirement:** BR-INT-09 — Per-destination data minimisation. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-09, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-09: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-09; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Per-destination allowlists distinguish aggregate measures from person-level transactions and remove unrelated fields." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Payload fixtures and production audits verify field allowlists and distinguish person records from aggregate measures.

**Known gaps** (assessment, remaining work for BR-INT-09): Live destination contracts, representative real-profile minimisation and partner testing; synthetic boundary evidence does not complete all destination-specific semantics.

<details><summary>What the build does today (assessment, current state of BR-INT-09)</summary>

Per-destination mapped field allowlists. Slice 7e: aggregate-only programme destinations refuse every patient-level record before preparation and inside the delivery checkpoint. Slice 7g: an aggregate-only demonstration destination receives approved aggregate reports only: suppressed cells from named indicator versions, a definition and version manifest, row count and SHA-256; a payload minimisation check (no patient-level field or identifier value, no released cell from 1 to 4) runs before preparing, before the checkpoint and inside it, and its result is recorded on the report; a failed check closes the report as not sent. Slice 6ab: aggregate report screening also uses the slice 6aa population check (preparation, pre-send recomputation and checkpoint), and a ledger write D1 refuses closes the report as not sent. Slice 6ad (ninth review): aggregate report reads return the manifest and withheld blocks but never the cells (figures go to the destination only); payloads are kept only while a report is open and bounded (150 kB each, 450 kB for all reports beside the 1 MB ledger); only open reports count towards the limit of 20 and unapproved or unsent reports expire after 24 hours; a late destination answer is appended as evidence; receipt lookup stays available in maintenance and the send checkpoint re-checks maintenance. Patient-level destination envelopes now constrain paths/fields/current mapping and exact approved digest, and repeat sensitive checks before immediate send. Aggregate malformed arrays fail closed and suppression repeats even for a rehashed stored body. Validated FHIR headers are materialised without losing conditional-create fields; server credentials are added last, caller credentials refused, uncertain lookup remains body-free.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-10-A — Standards-based exchange acceptance

- **Requirement:** BR-INT-10 — Standards-based exchange. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-10, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-10: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-10; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Connector manifests pin the receiving system profile, terminology release and validator configuration." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Standards validation and owner acceptance are recorded separately; valid FHIR content alone does not mark the connector production-ready.

**Known gaps** (assessment, remaining work for BR-INT-10): Pinned ecosystem implementation guides, validators and independent owner acceptance.

<details><summary>What the build does today (assessment, current state of BR-INT-10)</summary>

Native FHIR R4 subset with explicit conformance limitations.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-11-A — Canonical exchange representation acceptance

- **Requirement:** BR-INT-11 — Canonical exchange representation. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-11, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-11: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-11; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Canonical entities map to destination records through explicit versioned transformations with provenance links." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A single confirmed blood-pressure observation can be mapped to two approved destinations, and the audit shows the original source, canonical value, units, mapping version and each destination payload.

**Known gaps** (assessment, remaining work for BR-INT-11): Canonical condition, service request, medication, diagnostic result and full provenance semantics.

<details><summary>What the build does today (assessment, current state of BR-INT-11)</summary>

Person/visit/observations and document Bundle mapping.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-13-A — ABDM participation scope acceptance

- **Requirement:** BR-INT-13 — ABDM participation scope. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-13, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-13: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-13; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "ABDM module roles are flags on a verified connector deployment; enabling ABHA does not enable HIP or HIU." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Administration and test evidence identify the enabled ABDM role, environment, facility, client credentials, approved operations and responsible owner; all other operations are unavailable.

**Known gaps** (assessment, remaining work for BR-INT-13): Sandbox and production onboarding, real credentials, facility registry verification and deployment-specific enforcement.

<details><summary>What the build does today (assessment, current state of BR-INT-13)</summary>

Slice 7a: owner-recorded ABDM environment (mock only), ABHA/HIP/HIU modules, facility identifier and an approval reference per module; ABHA and HIU actions refused unless their module is enabled with approval. Local mock gateway only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-15-A — ABDM consent enforcement acceptance

- **Requirement:** BR-INT-15 — ABDM consent enforcement. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-15, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-15: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-15; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Validate consent requester, provider, purpose, data types, period, frequency, expiry and current status before retrieval." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Requests outside the approved purpose, date range, data type or validity period are blocked even when the calling user can otherwise view the local patient record.

**Known gaps** (assessment, remaining work for BR-INT-15): Real consent-manager integration, HIP/HIU callbacks, notifications and enforcement on actual ABDM exchange.

<details><summary>What the build does today (assessment, current state of BR-INT-15)</summary>

Slice 7a: consent artefacts with purpose, health-information types, record date range, expiry and revocation; fetch checks enforce status, ABHA link, purpose, type and date. The consent manager is simulated by an owner; local mock gateway only.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-16-A — Facility and professional attribution acceptance

- **Requirement:** BR-INT-16 — Facility and professional attribution. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-16, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-INT-16: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Verified HFR/HPR or destination professional/facility attribution and expiry checks.” (BR-INT-16, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Facility and professional identifiers include registry source, verification state and deployment association."

**Expected result** (catalogue): A consultation bundle fails validation or enters review when the configured facility or practitioner attribution is absent, expired or inconsistent with the encounter.

**Known gaps** (assessment, remaining work for BR-INT-16): Verified HFR/HPR or destination professional/facility attribution and expiry checks.

<details><summary>What the build does today (assessment, current state of BR-INT-16)</summary>

Document publisher and patient link configuration exist.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-17-A — ABDM FHIR conformance and version control acceptance

- **Requirement:** BR-INT-17 — ABDM FHIR conformance and version control. Assessment: **partial**. Target R13. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-17, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-17: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-17; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "FHIR package hash, profile URL, terminology and validator version are retained with each validation result." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Every outbound test bundle passes the pinned validator; a deliberate profile violation is rejected with a specific error and no external submission.

**Known gaps** (assessment, remaining work for BR-INT-17): Pinned NRCeS profile package, HL7 validator, terminology and mapping bundle, owner-approved upgrades, and a partner-agreed regression corpus.

<details><summary>What the build does today (assessment, current state of BR-INT-17)</summary>

Slice 7c: a pinned, versioned structural rule set (FHIR R4 Bundle invariants bdl-7, bdl-9, bdl-10, bdl-11 and a Saha subset) validates every outbound EHR and mock ABDM document before anything is sent, stamps it, and refuses a deliberate violation with a specific error; 14-case regression corpus. No NRCeS profile package or terminology validator is installed.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-20-A — EHR connector capability profile acceptance

- **Requirement:** BR-INT-20 — EHR connector capability profile. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-20, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-20: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-20; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Connector profiles declare resource types, search keys, operations, amendments, pagination, limits and receipt semantics." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): The platform enables only operations declared in the active profile and blocks configuration that assumes unsupported search, update or acknowledgement behaviour.

**Known gaps** (assessment, remaining work for BR-INT-20): Reference-partner profile covering all declared search/update/version/receipt/support behaviour.

<details><summary>What the build does today (assessment, current state of BR-INT-20)</summary>

Native FHIR capability profile gates document retrieval/publication.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-21-A — EHR writeback and conflict handling acceptance

- **Requirement:** BR-INT-21 — EHR writeback and conflict handling. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-21, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** Person page and visit. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-21; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "External version checks or reconciliation protect EHR writes; conflicts never default to last-write-wins." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Concurrent-update tests preserve both versions, prevent silent loss and route unresolved conflicts to the named operational owner.

**Known gaps** (assessment, remaining work for BR-INT-21): EHR updates/amendments, destination version conflicts and recording a conflict's resolution in Saha.

<details><summary>What the build does today (assessment, current state of BR-INT-21)</summary>

Conditional document creation and duplicate receipt lookup. Slice 7f: a named reconciliation owner (owner or administrator) per EHR connection; publication conflicts (several documents, or a different one, under the publication's identifier with an authoritative search) hold the visit and appear in the exception queue for that owner, who is also named on unknown-outcome rows. Current human purpose/scope and bound service status/expiry/accountable ownership guard retrieved candidate intake and clinical staging; original conflicting documentary versions remain retained.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-22-A — Legacy and document exchange acceptance

- **Requirement:** BR-INT-22 — Legacy and document exchange. Assessment: **partial**. Target R12. Priority Should, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-22, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-INT-22: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Approved legacy HL7 v2/CDA/REST/SOAP/file adapters as selected by buyer.” (BR-INT-22, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Legacy adapters declare batch latency, source artefacts, acknowledgements and manual review obligations."

**Expected result** (catalogue): A batch or document connector identifies its delay, source document, extracted fields, reviewer and destination receipt; unsupported writeback remains unavailable.

**Known gaps** (assessment, remaining work for BR-INT-22): Approved legacy HL7 v2/CDA/REST/SOAP/file adapters as selected by buyer.

<details><summary>What the build does today (assessment, current state of BR-INT-22)</summary>

Reviewed FHIR document route preserves source and limitations.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-23-A — Terminology and mapping governance acceptance

- **Requirement:** BR-INT-23 — Terminology and mapping governance. Assessment: **partial**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-23, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** Connections, Submissions. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-23; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Unmapped terminology has an explicit state and blocks destinations requiring a code until reviewed mapping exists." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A terminology change produces an impact report and blocks affected submissions until the mapping is approved or the value is explicitly represented as unmapped.

**Known gaps** (assessment, remaining work for BR-INT-23): Native partner/clinical terminology and source semantics acceptance, representative external conformance corpus and larger-history qualification remain. Closed deterministic software semantics and owner-declared conformance are delivered; they do not establish partner approval. Unknown delivery remains lookup-only.

<details><summary>What the build does today (assessment, current state of BR-INT-23)</summary>

Small explicit LOINC/unit whitelist and mapping versions. App-first B07 source-versioned revisions can declare explicit partner-local/LOINC target codes and active/deprecated/ambiguous status; impact records declaration counts and refuses unresolved publication. These are owner declarations, not a terminology registry or clinical code approval. App-first reviewed conformance adds closed deterministic transform and unit/missing rules, explicit unmapped handling and independent source-versioned required-field/code examples; per-field impact protects current queued work and reviewed rollback preserves conformance.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-INT-24-A — Conformance and production claims acceptance

- **Requirement:** BR-INT-24 — Conformance and production claims. Assessment: **implemented-local**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-INT-24, catalogue owner "QA with Integration owner".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-INT; catalogue owner "QA with Integration owner").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-INT-24: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-INT-24; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Expose conformance, sandbox, security review, onboarding and live acceptance as separate evidence fields." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A sandbox-passing connector cannot be labelled production-live until credentials, owner approval, end-to-end transaction evidence and support responsibility are recorded.

**Known gaps** (assessment, remaining work for BR-INT-24): Independent review of all production claims when onboarding evidence exists.

<details><summary>What the build does today (assessment, current state of BR-INT-24)</summary>

UI and release gates distinguish simulation, configured endpoints and real acceptance.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-CARE-07-A — External messaging and scheduling acceptance

- **Requirement:** BR-CARE-07 — External messaging and scheduling. Assessment: **partial**. Target R14. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-CARE-07, catalogue owner "QA with Worker clinician and supervisor".
- **Run as:** Organisation owner / programme lead. Basis: the notification channel is an owner setting (Organisation & team).
- **Default result:** Not run
- **Start from:** Outreach. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-CARE-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Channel adapters record delivery and opt-out status separately from patient acknowledgement or service completion." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Delivery failure creates a retry or follow-up task and is not reported as patient acknowledgement.

**Known gaps** (assessment, remaining work for BR-CARE-07): Approved SMS/IVR/appointment provider, real incoming events/receipts, channel qualification and formal acceptance remain pending. Mock provider is synthetic/training only.

<details><summary>What the build does today (assessment, current state of BR-CARE-07)</summary>

Independent reminder simulation, receipts, bounded retry and owned failure follow-up. App-first R77: synthetic staff STOP simulation and exact-organisation signed mock callback, stable durable receipts, preference/consent history and unsent reminder cancellation; scope rechecked for staff receipt replay.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-01-A — Deployment configuration acceptance

- **Requirement:** BR-OPS-01 — Deployment configuration. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-01, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: the configuration check is owner-only (assessment).
- **Default result:** Not run
- **Start from:** Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Configuration is tenant-scoped and versioned; validate referenced roles, packs, capabilities and connector profiles before publish." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Updating one tenant's configuration cannot change another tenant's behaviour or data visibility.

**Known gaps** (assessment, remaining work for BR-OPS-01): Facilities, jurisdiction, full language/provider eligibility, validated deployment limits and validation before configuration changes take effect.

<details><summary>What the build does today (assessment, current state of BR-OPS-01)</summary>

Tenant/team/member and selected provider/connector settings are scoped; an owner-only read-only configuration check reports missing or unsafe deployment settings and per-connection credential, grant and allowlist state without secret values.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-02-A — Separation of environments acceptance

- **Requirement:** BR-OPS-02 — Separation of environments. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-02, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: environment and configuration are shown to owners (administrator guide).
- **Default result:** Not run
- **Start from:** Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-02; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Production credentials and routes are unavailable in test environments; fixtures carry synthetic mode on every record." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A demonstration record cannot reach a live MIS, and a training account cannot access real patient records.

**Known gaps** (assessment, remaining work for BR-OPS-02): Separate production/training identities, databases and credentials per deployment, and outbound labels that follow the environment.

<details><summary>What the build does today (assessment, current state of BR-OPS-02)</summary>

Declared environment (synthetic, training, staging, production; invalid values fail closed) decides fixture seeding, live provider calls, demonstration connectors and whether synthetic fixture records may reach a destination; shown in the banner; disabled real credentials and private deployment.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-03-A — Controlled publishing and rollback acceptance

- **Requirement:** BR-OPS-03 — Controlled publishing and rollback. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-03, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: publishing and rollback are governance changes.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-03; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Publish creates an immutable manifest and independent approval for sensitive changes; rollback checks schema compatibility." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A failed change is reversible to an approved version while preserving the history of work completed under the changed version.

**Known gaps** (assessment, remaining work for BR-OPS-03): Unified pack/language/knowledge/model/mapping publication, impact review and approved rollback.

<details><summary>What the build does today (assessment, current state of BR-OPS-03)</summary>

Source versions and independent template/proposal reviews.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-06-A — Training and competency acceptance

- **Requirement:** BR-OPS-06 — Training and competency. Assessment: **partial**. Target R16. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-06, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: pilot training records are configured by the owner; the rehearsal is owner-run.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Activation records completed role-specific training and a competency assessment in the synthetic environment." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Activation records show training completion and role-specific competency evidence for the pilot cohort.

**Known gaps** (assessment, remaining work for BR-OPS-06): Real cohort competency, actual training delivery and activation enforcement.

<details><summary>What the build does today (assessment, current state of BR-OPS-06)</summary>

Synthetic training assessment and personal acknowledgement records.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-07-A — Data exit and continuity acceptance

- **Requirement:** BR-OPS-07 — Data exit and continuity. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-07, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: the organisation export is owner-only (assessment).
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-07: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Exit exports preserve IDs, provenance, record versions and open tasks; verify counts with the receiving operator." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An exit rehearsal produces a usable export, a list of unresolved external actions and a named owner for open patient tasks.

**Known gaps** (assessment, remaining work for BR-OPS-07): Buyer-authorised export beyond the owner's care scope, independent re-import tooling, staged exports for large tenants and queue disposition on provider termination.

<details><summary>What the build does today (assessment, current state of BR-OPS-07)</summary>

Local encrypted backup, configuration export, limited report/FHIR exports and an owner-only organisation export archive (every table, audit chain, media, manifest and checksums, hand-over list of unresolved external actions and owned patient tasks) with an offline verifier. Slice 6p (independent review): patient-linked entries inside organisation documents (safety cases, shadow results, outreach items and messages, person holds) now follow the owner's care scope and are counted as withheld (before 6p they were exported whole); a command saved during an export no longer discards it (the audit event is retried on a fresh read with the authority re-checked). Slice 6q: the audit-chain and operations export retries refuse (409, nothing delivered) a changed care scope and, for the operations CSV, a changed reporting reach. Slice 6u: household members and caseload transfer patients outside the exporter's scope are left out of those rows and counted, and the verifier checks them; pilot dossier and expansion pack exports retry their audit commit with access rechecked. Slice 6z: alert notifications are exported for the exporter only; other members' notifications (counts from their own care scope) are left out and counted in the manifest.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-08-A — Repeatable deployment packaging acceptance

- **Requirement:** BR-OPS-08 — Repeatable deployment packaging. Assessment: **partial**. Target R16. Priority Should, BRD phase R2.
- **Catalogue:** Functional, fixture FX-OPS-08, catalogue owner "QA with Deployment operations".
- **Run as:** Organisation owner / programme lead. Basis: the deployment pack is an owner export.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "A deployment manifest packages reviewed config and references secrets by name rather than embedding them." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A second deployment can be assembled from the pack with explicit local differences and no copied production patient data.

**Known gaps** (assessment, remaining work for BR-OPS-08): Installable approved deployment pack including training, tests and operating responsibility.

<details><summary>What the build does today (assessment, current state of BR-OPS-08)</summary>

Configuration-only proposal pack with local differences; no patient collection copied. Slice 6u: the pack export's audit event is retried on a concurrent command with operations access rechecked.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-01-A — Purpose and lawful authority acceptance

- **Requirement:** BR-SEC-01 — Purpose and lawful authority. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-01, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-01: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-01; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Authority records distinguish consent-based flows from other approved processing bases and specify allowed purpose and recipients." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A new provider or connector cannot activate without an approved data-flow record, and a user clicking confirm cannot override an absent processing basis.

**Known gaps** (assessment, remaining work for BR-SEC-01): Approved processing inventory and enforceable authority/recipient/retention basis for every flow.

<details><summary>What the build does today (assessment, current state of BR-SEC-01)</summary>

Local AI/sharing flags and EHR purpose/direction/time permissions.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-05-A — Encryption and secrets acceptance

- **Requirement:** BR-SEC-05 — Encryption and secrets. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-05, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-SEC-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Independent storage/key-management, rotation, media and end-to-end encryption assessment.” (BR-SEC-05, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "TLS, envelope encryption and secret references protect data; key rotation and access are audited separately."

**Expected result** (catalogue): Security review finds no usable provider keys in the client bundle or agent context, and local data is unreadable outside the authorised application.

**Known gaps** (assessment, remaining work for BR-SEC-05): Independent storage/key-management, rotation, media and end-to-end encryption assessment.

<details><summary>What the build does today (assessment, current state of BR-SEC-05)</summary>

TLS hosting, server secrets, encrypted field vault and encrypted local backups.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-06-A — Tenant and record isolation acceptance

- **Requirement:** BR-SEC-06 — Tenant and record isolation. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-06, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Every object query and attachment token enforces tenant and record policy; database RLS supplies a second tenant boundary." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Cross-tenant adversarial tests and wrong-record reference tests result in denial with no content disclosure.

**Known gaps** (assessment, remaining work for BR-SEC-06): Independent adversarial coverage of hosted backup, future indexes/media and asynchronous services.

<details><summary>What the build does today (assessment, current state of BR-SEC-06)</summary>

Organisation/patient scope tested across current APIs and exports.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-08-A — Audit evidence acceptance

- **Requirement:** BR-SEC-08 — Audit evidence. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-08, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-08: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-08; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "A material command commits its audit record atomically; durable read-access audit precedes sensitive data return." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An auditor reconstructs a selected encounter and submission from evidence without relying on the chat transcript or provider recollection.

**Known gaps** (assessment, remaining work for BR-SEC-08): Remaining browser-local search/uncovered material reads, direct operational writer authority coverage, unknown delegation tracking, external anchor signing/publication/key lifecycle, independent reconstruction and measured cost. Durable offline opens have bounded synthetic software evidence; physical-device and complete audit acceptance remain pending.

<details><summary>What the build does today (assessment, current state of BR-SEC-08)</summary>

Writes/approvals/exports have append-only audit and revisions. Slice 6j: per-organisation SHA-256 audit chain with genesis seal over earlier events, owner/administrator verification reporting the first break, and a JSONL auditor export (digest-only for out-of-scope patient events) recorded in the chain. Slice 6t: material reads (paged full patient record, revision history, visit media, received ABDM records, FHIR downloads) and external AI/EHR-retrieval requests each record one chained event (identifiers and counts, no clinical content; emergency-access route named) before content is returned or the request sent, shown in the Activity log. Owners/administrators can download a chain-head checkpoint (sequence, hash, digest; issuing it is chained) to keep outside Saha and later check it, which detects a suffix rewritten with recomputed hashes. Slice 6w: full records returned through the paged workspace window that the viewer has not opened through the detail route in the last 12 hours are recorded as record views first, and left out if that event cannot be written; a checkpoint past the 100,000-event verification limit is verified from an anchor (a checkpoint the owner names, or the last one recorded); indicator CSV exports are access-audit events. Slice 6aa: an unpaged workspace read by a non-ASHA viewer above the paging threshold records a viewPatientRecord event for every returned record not recorded in the last 12 hours before returning it (fail closed); the import rejection report is an access-audit event that moves no revision. Slice 10h: the remaining read paths record chained events before the read returns, refused if the event cannot be written: one summarised event per workspace snapshot load (scope size, records returned, paging window; also the snapshot returned with a command and with a replayed command), an explicit record-opened event reported by the workspace (the workspace shows the record only after the server answers; client-reported), patient searches, duplicate checks and patient or work-list pages (kind and result count, never the search text or entered details) and aggregate views (indicator results, the JSON operations and care report, aggregate report history; no cell values). Every access event now carries the acting membership's role, owner flag, membership version and the delegated authority in force inside its hashed detail; the default Activity log page leaves summary events out unless asked. Current app-first integration audits care continuity, referral escalations and action plans before return with count-only fixed labels. Distinct viewActionPlan avoids suppressing full-record access audits; independent actual 507-patient fault/recovery reproduction verifies this. Response metadata batching preserves existing SQL predicates and durable access ordering; independent SQL and Worker review passes. At the earlier audit checkpoint, offline opens, delta responses and external anchor lifecycle remained. Current command deltas append atomic count-only partition and per-record read events before return. Saved receipt replay now uses a fresh scoped/paged material load; per-record audit refusal omits patient data under the existing read-window contract without repeating the saved mutation. New common-persist command events append actor pre-mutation membership/version/owner and server-recorded delegation-use metadata inside their hashed detail; direct untracked uses are explicit, and prior history remains unchanged. Encrypted app/field material-open records now capture original grant provenance before plaintext display; metadata-only uploads require the trusted originating account before parsing/replay/writes, retain historical scope, and never renew care authority. Explicitly abandoned never-dispatched links retire only with current encrypted-book proof; unknown and accepted evidence stays retained.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-09-A — Controlled retention and disposal acceptance

- **Requirement:** BR-SEC-09 — Controlled retention and disposal. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-09, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** **Blocked**
- **Start from:** Organisation & team. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment records the current state as “No record is deleted.” (BR-SEC-09, current field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Retention jobs require record class, schedule, legal-hold checks and evidence of actual disposal at each storage tier."

**Expected result** (catalogue): Test data expires according to its configured schedule, while held records remain protected and identifiable; backup restoration does not silently revive deleted operational data.

**Known gaps** (assessment, remaining work for BR-SEC-09): Approved record-class schedule, tombstones, restore-safe disposal and coverage of backups and exports.

<details><summary>What the build does today (assessment, current state of BR-SEC-09)</summary>

Slice 6c: owner-set, versioned retention schedules for six record classes, patient and organisation holds, and a per-class eligibility review. No record is deleted. Slice 6u: the review shows only the id, scope and times of holds on patients outside the viewer's scope (reason, reference and patient withheld), also for administrator-role owners.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-10-A — Rights and correction workflow acceptance

- **Requirement:** BR-SEC-10 — Rights and correction workflow. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-10, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-10: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-10; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Rights cases verify requester identity, track affected custodians and deadlines, and record evidence-backed resolution." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A test request reaches the responsible organisation, has a due date under its approved policy and closes only with an evidence-backed outcome.

**Known gaps** (assessment, remaining work for BR-SEC-10): Legally reviewed policy, verified requester channel, copy-of-record package, grievance escalation and retention-based deletion.

<details><summary>What the build does today (assessment, current state of BR-SEC-10)</summary>

Slice 6b: access, correction, restriction, deletion and grievance requests with identity or proxy-authority check, 30-day local due date, owner, destination notification items, outcome evidence and an enforced processing restriction. Slice 6r: the restriction also pauses reminder sending and ABDM care-context linking; unsent draft and approved reminders are cancelled with a reason when it takes effect. Slice 6u: FHIR downloads of a restricted patient's visits are paused too.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-12-A — Provider and supply-chain assurance acceptance

- **Requirement:** BR-SEC-12 — Provider and supply-chain assurance. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-12, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-12: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-12; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Provider onboarding records dependencies, subprocessors, update obligations and vulnerability response ownership." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An unresolved critical vulnerability affecting the deployment blocks release or disables the affected component until the approved remedy is implemented.

**Known gaps** (assessment, remaining work for BR-SEC-12): SBOM/vulnerability gates, supplier controls/subprocessors and material-change assurance.

<details><summary>What the build does today (assessment, current state of BR-SEC-12)</summary>

Dependency lockfile and provider configuration inventory. Slice 0c: production SBOM (CycloneDX) and an audit gate failing on critical advisories or high advisories present in the built bundle.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-14-A — Hosting and cross-border controls acceptance

- **Requirement:** BR-SEC-14 — Hosting and cross-border controls. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-14, catalogue owner "QA with Privacy and security owners".
- **Run as:** Organisation owner / programme lead. Basis: requirement area default (BR-SEC; catalogue owner "QA with Privacy and security owners").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-SEC-14: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Enforced legal data-location policy across storage, providers, backups, analytics and support.” (BR-SEC-14, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Routing policy constrains provider, storage, backup and support regions before any transfer."

**Expected result** (catalogue): A model endpoint or support route outside the deployment's permitted locations is rejected before personal data is transferred.

**Known gaps** (assessment, remaining work for BR-SEC-14): Enforced legal data-location policy across storage, providers, backups, analytics and support.

<details><summary>What the build does today (assessment, current state of BR-SEC-14)</summary>

Explicit HTTPS origin allowlist limits outbound destinations.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-RULE-06-A — Rechecks at execution time acceptance

- **Requirement:** BR-RULE-06 — Rechecks at execution time. Assessment: **implemented-local**. Target R12. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-RULE-06, catalogue owner "QA with All actors".
- **Run as:** Organisation owner / programme lead. Basis: the case revokes a worker's role between drafting and execution.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-RULE-06: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Organisation owner / programme lead signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Organisation owner / programme lead and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-RULE-06; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Execution performs current policy and authority checks even when the planning-stage checks passed." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Revoking a worker's role between drafting and execution blocks the pending action and preserves it for authorised reassignment.

**Known gaps** (assessment, remaining work for BR-RULE-06): Real gateway/provider revocation and in-flight lifecycle acceptance.

<details><summary>What the build does today (assessment, current state of BR-RULE-06)</summary>

Current permissions, linkage, consent and versions checked before guarded execution.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
