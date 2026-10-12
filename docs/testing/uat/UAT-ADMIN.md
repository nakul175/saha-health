<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This script holds the catalogue cases assigned to the Administrator role. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT script — Administrator

Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.

- **Who runs this:** invited by the owner with role Administrator.
- **What this role can do:** Permitted configuration and operational metadata. No patient-record scope and no clinical export (docs/current/06; docs/current/ADMINISTRATOR-GUIDE.md).
- **Navigation this role sees** (from lib/saha/navigation.ts): My work, People, Submissions, Outreach, Clinical governance, Pilot readiness, Expansion, Operations, Programmes, AI tools, Connections, Activity log, Organisation & team.

- **Cases:** 7. Default Blocked: 2.

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
| TC-BR-ID-03-A | Authentication and recovery acceptance | BR-ID-03 (partial) | Blocked |
| TC-BR-ID-09-A | Service accounts and delegation acceptance | BR-ID-09 (partial) | Blocked |
| TC-BR-REP-07-A | Product performance metrics acceptance | BR-REP-07 (partial) | Not run |
| TC-BR-OPS-04-A | Operational monitoring acceptance | BR-OPS-04 (partial) | Not run |
| TC-BR-OPS-05-A | Support without unnecessary disclosure acceptance | BR-OPS-05 (partial) | Not run |
| TC-BR-SEC-07-A | Safe logs and analytics acceptance | BR-SEC-07 (partial) | Not run |
| TC-BR-SEC-13-A | Incident response acceptance | BR-SEC-13 (partial) | Not run |

## Cases

### TC-BR-ID-03-A — Authentication and recovery acceptance

- **Requirement:** BR-ID-03 — Authentication and recovery. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-03, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Administrator. Basis: requirement area default (BR-ID; catalogue owner "QA with Deployment administrator and identity steward").
- **Default result:** **Blocked**
- **Start from:** No screen is documented for BR-ID-03: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment lists as remaining work “Verified privileged MFA, workforce recovery/device replacement and session revocation acceptance.” (BR-ID-03, remaining field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Use verified institutional authentication. Privileged users require MFA and recovery invalidates old sessions and devices."

**Expected result** (catalogue): Recovery cannot be completed using patient data or a shared phone number alone; privileged access remains blocked without the required factor.

**Known gaps** (assessment, remaining work for BR-ID-03): Verified privileged MFA, workforce recovery/device replacement and session revocation acceptance.

<details><summary>What the build does today (assessment, current state of BR-ID-03)</summary>

Slice 0c: identity sits behind a provider layer; Sites/ChatGPT sign-in remains the default and a verified Cloudflare Access JWT provider allows an institutional identity provider. Shared application passwords are absent.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-ID-09-A — Service accounts and delegation acceptance

- **Requirement:** BR-ID-09 — Service accounts and delegation. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-ID-09, catalogue owner "QA with Deployment administrator and identity steward".
- **Run as:** Administrator. Basis: requirement area default (BR-ID; catalogue owner "QA with Deployment administrator and identity steward").
- **Default result:** **Blocked**
- **Start from:** Operations, Organisation & team. Not in this role's navigation: Candidate existing service/delegation metadata (/service-authority-review; owner only; deployment pending). These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Not testable in current build: The assessment records the current state as “service accounts are documented as unsupported by both identity providers” (BR-ID-09, current field of requirements/assessment.tsv).
2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.
3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.
4. Original design step, for reference: "Service identities have specific audiences and tools, rotated credentials and expiry; user tokens never become provider credentials."

**Expected result** (catalogue): Revoking a connector credential stops its new calls without disabling unrelated connectors; audit identifies both initiating user and executing service.

**Known gaps** (assessment, remaining work for BR-ID-09): Independent credential issuance/rotation/revocation, default enforcement policy, service-owned unattended work, hosted IAM and live-provider qualification remain pending. Opt-in binding is not autonomous machine sign-in.

<details><summary>What the build does today (assessment, current state of BR-ID-09)</summary>

Scoped connector server bindings and grants separate user sessions from provider keys. Slice 1e: person-to-person delegation has scope, expiry, an accountable grantor, revocation and use audit; service accounts are documented as unsupported by both identity providers. Slice 6p: a provider sandbox import checks the importer's active ownership of the source before reading it and answers one 404 for not found, not a sandbox and not the importer's own. App-first service-authority batch: owner management of exact target-bound, accountable, expiring machine identity; current-state transport gates and initiating-human/service audit, maintenance-safe revocation and rotation by rebinding. Default unbound connections retain legacy behaviour. Independent review corrected effective frontline agreement lookup and repeats domain consent, purpose, maintenance, current visit/sign-off/checkpoint gates before and after the new service audit; receipt-only lookup remains separate from clinical sends. Bounded12October2026 increment: Review recorded service identities and delegation under current owner authority; see docs/current/next50/SERVICE-AUTHORITY-REVIEW-20261012.md. Actual evidence and limits recorded separately; original formal acceptance remains unchanged.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-REP-07-A — Product performance metrics acceptance

- **Requirement:** BR-REP-07 — Product performance metrics. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-REP-07, catalogue owner "QA with Supervisor and programme manager".
- **Run as:** Administrator. Basis: product metrics are operational metadata, which administrators may see.
- **Default result:** Not run
- **Start from:** Operations. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Administrator and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-REP-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Operational metrics use event references and redacted counters; patient content never becomes general product telemetry." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): Product dashboards can support the Section 6 evaluation and contain no unnecessary patient identifiers or recording content.

**Known gaps** (assessment, remaining work for BR-REP-07): Full encrypted field lifecycle instrumentation and timing continuity are in progress. Proven real uncertain transport-to-receipt recovery, external ticket linkage, comparable observed baseline and pilot evaluation remain. Internal synthetic intervention evidence is not external help-desk acceptance.

<details><summary>What the build does today (assessment, current state of BR-REP-07)</summary>

Privacy-safe route metrics, task counts and partial agent usage. Slice 2a adds reuse, blocked reuse, repeated-entry and correction indicators. B26 adds default-disabled count-only sampling, atomic metadata receipts/counters/chained audit, current care authority/configuration guards and separately labelled parsed sync response categories. Weekly human care-active denominator uses durable trusted command-authority events; saved receipt checks do not prove transport recovery. Client metadata retries preserve their original key without repeating clinical saves. An encrypted fixed-counter outbox retains UUIDs across reload/lost ACK and binds expected originating account to trusted server identity. Current policy reads are audited only when enabled, freeze the resolved organisation and recheck membership/configuration. Protected internal requests, scoped helper assignment, distinct-helper attestation and requester acknowledgement append exact workflow history; actual clinical mutation receipts link bounded online work stages.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-04-A — Operational monitoring acceptance

- **Requirement:** BR-OPS-04 — Operational monitoring. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-04, catalogue owner "QA with Deployment operations".
- **Run as:** Administrator. Basis: requirement area default (BR-OPS; catalogue owner "QA with Deployment operations").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-04: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Administrator and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-04; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Alert rules cover service, queue, provider, policy and cost failures and route to an accountable team." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): An induced provider outage and a stalled writeback queue reach the correct support owner within the agreed alert target.

**Known gaps** (assessment, remaining work for BR-OPS-04): Delivery to real approved recipients (a live SMS or email provider, contact details, consent and message review), approved detection/response targets and escalation ladders; the scheduled evaluation has not run on the hosted Worker, needs the Workers Paid plan and its five-minute interval is a setting, not a measured detection time; on a host with no trigger, evaluation still depends on traffic.

<details><summary>What the build does today (assessment, current state of BR-OPS-04)</summary>

Hourly request metrics, incidents, queue counts and cost assumptions. Slice 6g: versioned alert rules computed on each operations read, each with an owning role, count and next safe action, scoped to the viewer. Slice 6h: the owning role acknowledges an alert with a note; the acknowledgement lapses when the count changes or after 24 hours. Slice 5e: owner-owned AI budget alerts (80% and 100% of estimated monthly use) in alert rules 1.1.0. Slice 5h: alert rules 1.2.0 add owner-owned alerts for AI invoices of the previous month that differ from Saha's estimates beyond the owner's threshold, and for providers used that month without a recorded reconciliation. Slice 6v: each alert that opens is delivered in-app (top-bar bell with unread count) to the members who own it, from their own scope, with its delivery time; an acknowledgement clears it; an occurrence left unacknowledged past its severity threshold (critical 30 minutes, high 4 hours, normal 24 hours), or re-opened after its acknowledgement stopped applying, escalates once to owners inside the organisation with a recorded reason; evaluated idempotently on reads and organisation-wide writes. Slice 6z: an organisation acknowledgement clears only the notifications of recipients whose own view shows it (counts differ by care scope); the occurrence counts as acknowledged, and is not escalated, only when every recipient's view shows it; escalation notifications are written only with the guarded escalation update, and restore never re-opens a closed occurrence. Slice 10b: an owner keeps a recipient list of named organisation members (owners, administrators, supervisors) with a tier (1 to 3), a channel (SMS or email) and the alert kinds each receives, and sets the number of minutes (5 to 1440) after which an alert that is still unacknowledged is sent to the next tier. A demonstration simulator (mode demo; synthetic and training environments only, refused with 409 elsewhere) stores each message with a simulated delivery receipt and a hash-chained audit event in one commit, one message per alert occurrence, tier and recipient; recipients hold no phone number or address and nothing leaves Saha. Messages carry the alert title, severity, a count and a path link only, never a patient name or identifier (counts of care-scoped alerts are withheld from owners outside that scope). Escalation is evaluated inside the alert delivery evaluation (alert and Operations reads, organisation-wide commands), as a pure planner that a scheduled trigger can call; the owner screen on Organisation shows the list, open alerts with their tier schedule and the message log with lateness. Slice 10a: the same scheduled job evaluates every organisation's alerts and in-app delivery about every five minutes whether or not anyone uses Saha (at most 20 organisations, 800 database statements and 20 seconds a run; organisations with due work first, the rest in rotation), through the slice 6v writer, and records the evaluation time and counts in the organisation record with an audit event naming the scheduled job (first evaluation, on any change, and at least hourly); in-app only, nothing is sent outside Saha. Verified in contract tests and a local scheduled-handler check, not on Cloudflare. Slice 13d: the scheduled rotation continues from a stored cursor, and the job's records are written without moving the organisation revision (no conflict with a person's command).

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-OPS-05-A — Support without unnecessary disclosure acceptance

- **Requirement:** BR-OPS-05 — Support without unnecessary disclosure. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-OPS-05, catalogue owner "QA with Deployment operations".
- **Run as:** Administrator. Basis: requirement area default (BR-OPS; catalogue owner "QA with Deployment operations").
- **Default result:** Not run
- **Start from:** No screen is documented for BR-OPS-05: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Administrator and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-OPS-05; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Support tickets expose redacted diagnostics first. Clinical content requires a separate scoped expiring grant." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A routine support agent can diagnose a sync failure without unrestricted patient access; exceptional access is logged and expires.

**Known gaps** (assessment, remaining work for BR-OPS-05): Task-linked support cases and purpose/time-limited exceptional support access.

<details><summary>What the build does today (assessment, current state of BR-OPS-05)</summary>

Redacted technical support export and generic incidents.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-07-A — Safe logs and analytics acceptance

- **Requirement:** BR-SEC-07 — Safe logs and analytics. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-07, catalogue owner "QA with Privacy and security owners".
- **Run as:** Administrator. Basis: support and report exports are operational.
- **Default result:** Not run
- **Start from:** My work, People. These are the screens the requirement's own evidence-map entry cites, not a verified click path.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Administrator and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-07; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "A structured logging allowlist excludes clinical values, credentials, raw prompts and recording bytes." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A representative end-to-end test leaves no raw recording, credential or complete patient narrative in general operational telemetry.

**Known gaps** (assessment, remaining work for BR-SEC-07): Hosted log, crash-report and analytics configuration and retention, identifiers in request paths, and a separate access-controlled store for necessary sensitive diagnostics with policy review.

<details><summary>What the build does today (assessment, current state of BR-SEC-07)</summary>

Fixed route/status telemetry and redacted support exports. Slice 6l: an end-to-end test shows distinctive names, narratives, a raw recording and an invitation token absent from request metrics, console output and support/report exports; console calls and log fields are statically reviewed; media removal reasons and indicator questions travel in request bodies rather than URLs. Slice 6q (second independent review): the paged patient list no longer puts names in URLs (opaque cursor, POST search); the static check also flags free-text and search keys set on URLSearchParams. Routine retention repair (11 October 2026): independent source review confirmed a shared metadata deletion authority gap on refused foreign/suspended requests. Only the existing DELETE adds the same trusted actor active-membership predicate; separate code review, fresh build and all nine native HTTP scenarios/64 named check groups pass with independent whole-row/source/build evidence verification; normal CI fixture qualification, exact successor CI/full NFR and hosted acceptance remain pending. See docs/current/d03/TELEMETRY-RETENTION-QUALIFICATION-20261011.md. Original formal status, policies, criteria and minima unchanged.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---

### TC-BR-SEC-13-A — Incident response acceptance

- **Requirement:** BR-SEC-13 — Incident response. Assessment: **partial**. Target R15. Priority Must, BRD phase R1.
- **Catalogue:** Functional, fixture FX-SEC-13, catalogue owner "QA with Privacy and security owners".
- **Run as:** Administrator. Basis: incidents are kept on the Operations page.
- **Default result:** Not run
- **Start from:** No screen is documented for BR-SEC-13: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. Use this role's navigation, listed at the top of this script, and look for the screen that matches the requirement.
- **Preconditions:** Administrator signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "Synthetic tenant A; verified actor with intended scope; relevant pack and connector test profile active; reset fixture before execution." The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.

**Tester actions**

1. Sign in to hosted staging as Administrator and check that the synthetic-environment banner is showing (plan section 7).
2. Set up the data. The original case loads fixture FX-SEC-13; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.
3. Open the screens named under Start from.
4. Try to bring about the behaviour in the original design step: "Incident records retain timeline, containment, affected scope and jurisdiction-specific notification decisions." Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.
5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).
6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.

**Expected result** (catalogue): A tabletop exercise demonstrates who acts, what access is revoked, how affected records are found and how notification decisions are documented.

**Known gaps** (assessment, remaining work for BR-SEC-13): Impact discovery, notification policy and recorded security/privacy tabletop exercise.

<details><summary>What the build does today (assessment, current state of BR-SEC-13)</summary>

Incident owner/triage/evidence and maintenance/suspension controls.

</details>

**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______

**Notes:**

---
