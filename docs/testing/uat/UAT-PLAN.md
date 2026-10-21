<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx. Regenerate with: node tests/uat/generate-uat-pack.mjs -->

> **Generated file.** This is the plan for the hosted-staging UAT pack. Edit `tests/uat/generate-uat-pack.mjs` or its inputs and regenerate; changes made here are overwritten.

# UAT plan — Saha hosted synthetic staging

**What this is.** A repeatable way for named people to try the original acceptance cases against the hosted synthetic staging site, and to leave records that [the test strategy](../../current/07_Test-Strategy_v1.1.md) can accept as formal execution records.

**What it is not.** No case in this pack has been run. Nothing here accepts a requirement: all 176 BRD acceptances stay pending, whatever the UAT results are. A Pass is evidence for one catalogue case, run on a synthetic build by named people; it is not a decision on the requirement, a clinical, field or security approval, or a statement that the product is ready for real patients.

## 1. Limits first

- **Results are formal evidence only when a named person executes and a different named person reviews.** The register validator rejects a Pass without both, and rejects placeholders, roles, and tool or AI names in the executor and reviewer fields.
- **Synthetic data on hosted staging only.** No real patient information. Live providers, programme destinations, EHRs, ABDM, SMS and partners are not reachable (external calls are off, `SAHA_EXTERNAL_APIS_ENABLED=false`, [hosted staging](../../current/HOSTED-STAGING.md)). Steps that need one are Blocked, not Failed.
- **The original catalogue steps are generic.** Every functional case reads "load the fixture, apply this design statement, capture evidence". The scripts quote the design statement and, where the evidence map names a screen for the requirement, say where to start; they do not invent a click path, because none is documented. A tester will have to find the control, and where there is none, that is a finding.
- **A Known gap is not a Fail.** If the expected result needs something the case's Known gaps line says is not built, the result is Blocked. A Fail is for behaviour the build claims and gets wrong.
- **A desktop browser cannot establish physical-device claims** (crash, low storage, eviction, incoming calls, clock rollback). The offline cases can be exercised in a desktop browser only.
- **Not in this pack:** the 176 Negative or recovery cases and 28 Performance or control cases of the catalogue; security, penetration, load, availability and accessibility testing (the automated suites and the separate accessibility audit cover what they cover); real-device and field evaluation.
- **The default-Blocked list and the role assignment are builder judgements** (section 11). Each default-Blocked case quotes the assessment text it rests on and the generator fails if that text changes. The owner should review both lists before the run.

## 2. Purpose

Run the 148 Functional and 12 End to end cases of [the test catalogue](../../current/TEST-CATALOGUE.csv) that the current build can be tried against, role by role, on hosted staging; make what is not built visible in each case instead of letting it surface as noise; and produce one register ([uat-results.csv](uat-results.csv)) that a reviewer and the validator can check.

## 3. Scope

| Catalogue type | Cases | In this pack | Why |
| --- | ---: | ---: | --- |
| Functional | 148 | 146 | 2 left out: BR-CLIN-06, BR-CLIN-07 are not-built in the assessment, so there is nothing to run against (they are listed in section 11) |
| End to end | 12 | 12 | all twelve journeys; 3 have steps that cannot be done in the current build |
| Negative or recovery | 176 | 0 | not in this pack |
| Performance or control | 28 | 0 | not in this pack |
| **Total** | 364 | 158 | |

Of the 146 functional cases, 19 rest on a requirement assessed **implemented-local** and 127 on one assessed **partial**. The assessment is in [requirements/assessment.tsv](../../../requirements/assessment.tsv).

## 4. Entry criteria

Do not start until all of these are true:

1. The build is identified. Record the deployed commit in every register row (`build`). The deploy workflow run in [hosted staging](../../current/HOSTED-STAGING.md) names it. Every merge into `main` redeploys the site, so set the repository variable `SAHA_DEPLOY_FREEZE` to `true` for the run and set it back afterwards; a change of build mid-run invalidates earlier rows.
2. Each executor's and reviewer's email address is on the Cloudflare Access policy (it is kept in the Cloudflare dashboard, not in Git).
3. A UAT lead is named, and a named executor and a different named reviewer exist for each script in scope (sign-off table, section 10).
4. The owner has created the invitations the run needs and each tester has accepted theirs (section 6), and the people the ASHA cases use are assigned to the ASHA worker.
5. Every tester has read sections 1, 6, 7 and 8, and the open findings in [VALIDATION.md](../../../VALIDATION.md) and [slice 10k](../../current/SLICE-10K-COMBINED-REVIEW-FIXES.md), so a known finding is not raised as new.
6. The signed-in page shows the synthetic-environment banner.
7. `node tests/uat/check-uat-register.mjs` passes on the register as it stands.

## 5. Exit criteria

1. Every case in every script in scope has a result in the register: Pass, Fail or Blocked. A case left empty or Not run is listed in the sign-off table as deferred, with a reason.
2. Every Pass and Fail has been reviewed by a person other than its executor, and the register passes `node tests/uat/check-uat-register.mjs`.
3. Every Fail has a defect id. No Critical or High defect is open without a recorded decision by the programme owner (section 9).
4. Every Blocked row says in `actualResult` what was tried and what was missing.
5. The sign-off table is complete.

Meeting the exit criteria ends the run. It does not accept any requirement.

## 6. Roles, scripts and sign-in

| Script | Role | Cases | Default Blocked | Navigation entries (lib/saha/navigation.ts) |
| --- | --- | ---: | ---: | --- |
| [UAT-OWNER.md](UAT-OWNER.md) | Organisation owner / programme lead | 53 | 7 | My work, People, Submissions, Outreach, Care handover, Clinical governance, Pilot readiness, Expansion, Operations, Programmes, AI tools, Connections, Activity log, Organisation & team |
| [UAT-ASHA.md](UAT-ASHA.md) | ASHA worker | 44 | 0 | My work, People, Submissions, Outreach, Care handover, Organisation & team |
| [UAT-SUPERVISOR.md](UAT-SUPERVISOR.md) | Supervisor | 13 | 0 | My work, People, Submissions, Outreach, Care handover, Pilot readiness, Operations, Connections, Activity log, Organisation & team |
| [UAT-CLINICIAN.md](UAT-CLINICIAN.md) | Clinician | 29 | 0 | My work, People, Submissions, Outreach, Care handover, Clinical governance, Pilot readiness, Programmes, AI tools, Connections, Activity log, Organisation & team |
| [UAT-ADMIN.md](UAT-ADMIN.md) | Administrator | 7 | 2 | My work, People, Submissions, Outreach, Clinical governance, Pilot readiness, Expansion, Operations, Programmes, AI tools, Connections, Activity log, Organisation & team |
| [UAT-END-TO-END.md](UAT-END-TO-END.md) | Several roles per journey | 12 | 3 | as the roles in the journey |

The role model is in [docs/current/06](../../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md): membership roles are ASHA, clinician, supervisor and administrator; the **owner** is a flag that gives membership, configuration and governance control but no patient access beyond the member's own role and teams. The owner script is therefore run by an owner account (a clinician with the owner flag). The navigation is display only: the server checks every action, so a hidden screen does not prove an action is denied.

**Signing in**

1. Hosted staging sits behind Cloudflare Access. Open the address in [hosted staging](../../current/HOSTED-STAGING.md); a one-time code is emailed to an allowed address and a session lasts 24 hours.
2. A tester's first sign-in creates a home organisation in which the tester is owner and clinician, seeded with the synthetic people and demonstration connectors in section 7 (lib/saha/store.ts, ensureAccount). That is the account for the owner script and for any case that needs a single user.
3. To run as ASHA, supervisor or administrator, one owner account acts as the UAT coordinator. Each tester opens their account to read their account code and gives it to the coordinator, who creates an account-bound invitation naming the role and care team under **Organisation & team**; the tester accepts it and switches organisation from the side navigation. Invitations are single-use and expire after 72 hours; the application sends no email ([administrator guide](../../current/ADMINISTRATOR-GUIDE.md)).
4. The seeded people belong to the account that first signed in. For an ASHA to see anyone, an owner with patient access or a supervisor must assign people to that worker (the assignment command is `assignPatient`; an assignment is refused if the destination team is outside the assigner's scope).
5. Cases that compare roles (for example BR-ID-02) need two or more members: use the coordinator's organisation and its invited testers, not separate home organisations.

## 7. Environment and test data

- **Site:** the `workers.dev` address recorded in [hosted staging](../../current/HOSTED-STAGING.md), synthetic environment (`SAHA_ENVIRONMENT=synthetic`), external APIs off. The banner says synthetic.
- **Browser:** a desktop browser. Record the browser and version in the script's run details. The workspace can be switched to Hindi (slice 10j); the Hindi text is an unreviewed draft, so run the cases in English unless a case is about language.
- **Never:** enter real patient information; send the local identity headers used by the automated suites to the hosted site; run test-reset commands or fixtures against it ([test strategy](../../current/07_Test-Strategy_v1.1.md)). Fixture names such as FX-UX-01 are design-time names and cannot be loaded on hosted staging.
- **Reset:** there is none. Use a record no earlier case has changed or create a new synthetic one, and write down which you used. If a case changes shared records (for example by confirming a visit), say so in Notes so the next tester does not inherit it unknowingly.

**Seeded synthetic people** (lib/saha/seed.ts; check the People screen, which is the authority)

| Name | Age | Village | Programmes | Open task | Assigned in the seed |
| --- | ---: | --- | --- | --- | --- |
| Meena Devi | 26 | Rampur | Maternal care, General care | Antenatal home visit | yes (to the first account) |
| Rajesh Kumar | 54 | Rampur | Chronic care, General care | Blood pressure follow-up | yes (to the first account) |
| Sunita Bai | 38 | Kheda | TB screening, General care | Symptom screening | yes (to the first account) |
| Aarav Singh | 3 | Kheda | Child health, General care | Growth follow-up | yes (to the first account) |
| Farida Begum | 47 | Rampur | Chronic care, General care | Facility follow-up | yes (to the first account) |
| Kamla Devi | 62 | Kheda | Chronic care, General care | Medication history review | no |

**Seeded connections** (lib/saha/seed.ts)

| Name | Kind | Mode / status | Seeded behaviour |
| --- | --- | --- | --- |
| Maternal & child register | mis | demo / active | A programme register simulator. Records acceptance and a distinct receipt. Behaviour: accept. |
| Community health MIS | mis | demo / active | A programme simulator that demonstrates a lost response and safe reconciliation. Behaviour: uncertain. |
| Visit summariser | ai | demo / active | Creates a structured summary from confirmed facts. Deterministic demo adapter; no clinical inference. |
| Record completeness | ai | demo / active | Checks missing visit fields and provenance. Deterministic demo adapter; no diagnosis. |
| Facility EHR | ehr | unconfigured / unconfigured | FHIR R4 example export is available. Live access needs an owner-approved endpoint and resource mapping. |
| ABDM exchange | abdm | unconfigured / unconfigured | ABHA, HIP and HIU connections require separate onboarding, consent flows and current conformance validation. |

The clinical governance demonstration package (synthetic sources, services and two protocols, none clinically approved) is installed automatically in a new home organisation of the synthetic environment unless `SAHA_DEMONSTRATION_PACKAGE=manual` is set (slice 9a).

## 8. Running a case and recording a result

1. Open the role's script and take the next case. Read Requirement, Known gaps and Expected result before you start.
2. Follow the tester actions in order. Do not read the expected result as a checklist to confirm; observe first.
3. Capture evidence as you go: a screenshot of the outcome, and the receipt, revision or Activity log entry where there is one. Evidence holds synthetic data only. Store it where the reviewer can open it and record its URI and SHA-256 (`sha256sum file`). If you commit evidence to the repository, put it under `tests/evidence/uat/<run>/` on a branch and publish it through a draft pull request.
4. Choose the result:

   | Result | Use it when |
   | --- | --- |
   | **Pass** | Every part of the expected result was observed on this build, with evidence. No partial Passes. |
   | **Fail** | You could do the action and the build did something different from the expected result, or something unsafe. Raise a defect. |
   | **Blocked** | You could not do the action in this build or environment: the capability is not built (see Known gaps), or it needs a live partner, a physical device or an approval hosted staging cannot give. Say what you tried and what was missing. |
   | **Not run** | Not attempted. Use it only to say so explicitly; it must carry no executor, evidence or reviewer. |

5. Add or update the case's row in [uat-results.csv](uat-results.csv). Do not rename or delete rows.
6. A reviewer (a different named person) re-reads the evidence and the actual result, may repeat the case, and then fills `reviewer` and `reviewedAt`. A reviewer who disagrees changes nothing in the row and tells the executor, who corrects it.
7. Run `node tests/uat/check-uat-register.mjs` before a review and again at exit.

**Register columns** (the fields the strategy asks for: case ID, build, environment, observed result, evidence, defect, executor, reviewer)

| Column | Meaning | Required for |
| --- | --- | --- |
| caseId | A catalogue id. The generator creates one row per case in the scripts. | all rows |
| build | Commit hash of the deployed build, 7 to 40 hexadecimal characters. | Pass, Fail |
| environment | For example "hosted synthetic staging, Chrome 130". | Pass, Fail |
| executor | Name of the person who ran the case. Not a role, a placeholder, or a tool or AI name. | Pass, Fail, Blocked |
| executedAt | ISO date or date-time. | Pass, Fail, Blocked |
| result | Exactly Pass, Fail, Blocked or Not run; empty only while the row has not been touched. | all recorded rows |
| actualResult | What was observed, or for Blocked what was tried and what was missing. | Pass, Fail, Blocked |
| evidence | URI or path of the evidence, ideally with SHA-256. | Pass |
| defect | Defect id or issue link. | Fail |
| reviewer | Name of a different person from the executor. | Pass |
| reviewedAt | ISO date or date-time, not before executedAt. | Pass |

The register starts blank. A case marked **Blocked** by default in its script is still recorded by an executor, who confirms the reason first.

## 9. Defect severity

| Severity | Definition | Effect on exit |
| --- | --- | --- |
| **Critical** | A person's record, recording or result is shown or sent to someone outside their scope (another patient, team or organisation); an identity, consent or authority control is bypassed; acknowledged work is lost or silently overwritten; a confirmed record, receipt or audit entry is altered; a secret is exposed. | Blocks exit. Stop the run in the affected area and tell the programme owner the same day. |
| **High** | A safety or authority control that should stop an action does not (positive patient check, version-bound approval, role limit, stale-data check); a core journey step cannot be completed; the screen shows an external state that is wrong (for example "accepted" without a receipt). | Blocks exit unless the programme owner records a decision to accept it. |
| **Medium** | A function works wrongly with a workaround, or a message or status is misleading without changing what is stored or sent. | Listed at exit; does not block. |
| **Low** | Cosmetic, wording or layout problems, and documentation that disagrees with the screen, with no effect on behaviour. | Listed at exit; does not block. |

A defect record carries an id (a GitHub issue in the project repository is enough), the case id, the build, steps to reproduce, expected and actual result, evidence, severity, who found it and when. Put the id in the register's `defect` column. Behaviour the Known gaps line already says is not built is not a defect: it is a Blocked result.

## 10. Sign-off

Sign-off records that the run met the exit criteria for the scripts named. It does not accept a requirement and does not change any of the 176 pending acceptances. Names are filled in by the people themselves.

| Role in the run | Decision (met / not met / deferred, with reason) | Name | Date |
| --- | --- | --- | --- |
| UAT lead (owns the register, confirms the exit criteria) | | | |
| Programme owner (accepts the results as evidence for the cases in scope; decides on High defects) | | | |
| Clinical safety lead (clinical, AI governance and BR-CLIN cases) | | | |
| Privacy and security owner (BR-SEC cases and scope-of-access cases) | | | |

## 11. How the cases were chosen and assigned

**Selection.** Functional cases whose requirement is implemented-local or partial in the assessment, plus every End to end case: 158 cases (146 functional, 12 end to end). Functional cases on a not-built requirement are left out:

- TC-BR-CLIN-06-A (Model-specific quality requirements acceptance): requirement BR-CLIN-06 is not-built in the assessment, so there is nothing built to run the case against.
- TC-BR-CLIN-07-A (Composition safety acceptance): requirement BR-CLIN-07 is not-built in the assessment, so there is nothing built to run the case against.

**Role assignment.** Each functional case takes its requirement area's default role, from the catalogue's owner column and the access model, unless reading the case's steps and expected result points to another role. Each case shows its basis. The exceptions table is `ROLE_BY_REQUIREMENT` in `tests/lib/uat-selection.mjs`. A case that needs a second role is assigned to the role that sets the situation up; the tester brings in a second member as the case needs.

| Script | Cases | of which implemented-local | of which partial |
| --- | ---: | ---: | ---: |
| Organisation owner / programme lead | 53 | 3 | 50 |
| ASHA worker | 44 | 7 | 37 |
| Supervisor | 13 | 3 | 10 |
| Clinician | 29 | 6 | 23 |
| Administrator | 7 | 0 | 7 |
| End to end | 12 | journeys mix statuses | |

**Default Blocked.** A case is Blocked by default only when the assessment itself says the capability its expected result rests on does not exist. Cases that are part built stay runnable and carry the gap in their Known gaps line. Each entry below quotes the assessment, and the generator stops if the quoted text is no longer there.

| Case | Requirement | What the assessment says |
| --- | --- | --- |
| TC-BR-ID-10-A | BR-ID-10 | The assessment lists as remaining work “Buyer-approved federation or identity-provider sync, automatic upstream removal feed and controlled emergency administration.” (BR-ID-10, remaining field of requirements/assessment.tsv). |
| TC-BR-PROG-06-A | BR-PROG-06 | The assessment lists as remaining work “Destination-authorised enrolment request/rejection/acceptance lifecycle.” (BR-PROG-06, remaining field of requirements/assessment.tsv). |
| TC-BR-INT-16-A | BR-INT-16 | The assessment lists as remaining work “Verified HFR/HPR or destination professional/facility attribution and expiry checks.” (BR-INT-16, remaining field of requirements/assessment.tsv). |
| TC-BR-INT-22-A | BR-INT-22 | The assessment lists as remaining work “Approved legacy HL7 v2/CDA/REST/SOAP/file adapters as selected by buyer.” (BR-INT-22, remaining field of requirements/assessment.tsv). |
| TC-BR-SEC-05-A | BR-SEC-05 | The assessment lists as remaining work “Independent hosted storage/KMS and backup custody, actual provider rotation, deployed bundle/log/context inspection, physical-device media assessment, end-to-end encryption assessment and formal security acceptance.” (BR-SEC-05, remaining field of requirements/assessment.tsv). |
| TC-BR-SEC-09-A | BR-SEC-09 | The assessment records the current state as “No record is deleted.” (BR-SEC-09, current field of requirements/assessment.tsv). |
| TC-BR-SEC-14-A | BR-SEC-14 | The assessment lists as remaining work “Enforced legal data-location policy across storage, providers, backups, analytics and support.” (BR-SEC-14, remaining field of requirements/assessment.tsv). |
| TC-BR-ID-03-A | BR-ID-03 | The assessment lists as remaining work “Verified privileged MFA, workforce recovery/device replacement and session revocation acceptance.” (BR-ID-03, remaining field of requirements/assessment.tsv). |
| TC-BR-ID-09-A | BR-ID-09 | The assessment records the current state as “service accounts are documented as unsupported by both identity providers” (BR-ID-09, current field of requirements/assessment.tsv). |
| TC-J02 (steps 3, 4, 5) | BR-AI-02 | The assessment records the current state as “clinical generation remains unavailable.” (BR-AI-02, current field of requirements/assessment.tsv). |
| TC-J08 (steps 3, 4) | BR-AI-02 | The assessment records the current state as “clinical generation remains unavailable.” (BR-AI-02, current field of requirements/assessment.tsv). |
| TC-J10 (step 3) | BR-CARE-03 | The assessment lists as remaining work “Facility-verified outcomes, partner integration, formal QA and observed external outcome evidence.” (BR-CARE-03, remaining field of requirements/assessment.tsv). |

**Regenerating.** `node tests/uat/generate-uat-pack.mjs` rewrites the plan and scripts and creates the register only if it is missing; a register that exists is never overwritten, because it holds the testers' results. To start a fresh blank register, delete the file and regenerate. `node tests/uat/generate-uat-pack.mjs --check` fails if the committed files differ from what the sources now produce.
