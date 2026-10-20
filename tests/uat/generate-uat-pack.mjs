// Slice 11e: generate the UAT pack in docs/testing/uat/ from the original catalogue, the assessment and the evidence map.
//   node tests/uat/generate-uat-pack.mjs           write the pack (the register is created only when missing; a register that exists is never overwritten)
//   node tests/uat/generate-uat-pack.mjs --check   write nothing; fail when the committed pack differs from what the sources now produce
// Deterministic: no clock, no commit hash, no randomness. Output depends only on the input files named in each generated header.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { suite } from '../lib/report.mjs';
import { abs, toCsv, REGISTER_COLUMNS, REGISTER_PATH, readCsv } from '../lib/uat-data.mjs';
import { buildUatModel, loadSeed, unmappedPanels, ROLES, ROLE_INFO, PANEL_HOME, BLOCKED_REQUIREMENTS, ROUTINE_CAPTURE_SCREEN, FRONTLINE_FOLLOWUP_SCREEN, MATCHING_SCREEN, FRESHNESS_SCREEN, TODAY_SCREEN, AMENDMENTS_SCREEN, PLAN_REVIEW_SCREEN, ASSISTANCE_SCREEN, WORKFORCE_SCREEN, SELECTIVE_REUSE_SCREEN, HOSTING_CONTROLS_SCREEN } from '../lib/uat-selection.mjs';

const OUT = 'docs/testing/uat';
const CHECK = process.argv.includes('--check');
const r = suite('UAT pack generator', abs('tests/reports/uat-pack-result.json'), {
  layer: 'uat', environment: 'static generation from repository files; no Worker, no network',
  limits: ['Generates documents; it does not run any case and proves nothing about the application.', 'Role assignment and the default-Blocked list are builder judgements recorded in tests/lib/uat-selection.mjs.'],
});

const SOURCES = 'docs/current/TEST-CATALOGUE.csv, requirements/assessment.tsv, requirements/evidence-map.json, requirements/brd-v1.1.json, lib/saha/navigation.ts, lib/saha/seed.ts, app/workspace.tsx';
const notice = what => `<!-- GENERATED FILE. Do not edit by hand. Source: tests/uat/generate-uat-pack.mjs. Inputs: ${SOURCES}. Regenerate with: node tests/uat/generate-uat-pack.mjs -->\n\n> **Generated file.** ${what} Edit \`tests/uat/generate-uat-pack.mjs\` or its inputs and regenerate; changes made here are overwritten.\n`;
const esc = s => String(s).replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');
const cell = s => esc(s).trim();
const list = a => a.join(', ');
const BLOCKED_RESULT = 'Blocked';

async function main() {
  const model = await buildUatModel();
  const seed = await loadSeed();
  const { selected, excluded, navigation, catalogue, assessment, reqs } = model;
  const nav = navigation.visible;
  const roleCases = Object.fromEntries([...ROLES, 'END_TO_END'].map(k => [k, selected.filter(s => s.role === k)]));
  const typeCounts = t => catalogue.filter(c => c.type === t).length;
  const status = id => assessment.get(id).implementation;

  // ------------------------------------------------------------ one case
  const visibleTo = role => new Set([...nav[role], ...(role === 'OWNER' ? [WORKFORCE_SCREEN, SELECTIVE_REUSE_SCREEN, HOSTING_CONTROLS_SCREEN] : []), 'Person page and visit', 'Alert bell (page header)', ...(role === 'ASHA' ? ['ASHA app Home (/app)', ROUTINE_CAPTURE_SCREEN, FRONTLINE_FOLLOWUP_SCREEN, MATCHING_SCREEN, FRESHNESS_SCREEN, TODAY_SCREEN, AMENDMENTS_SCREEN, PLAN_REVIEW_SCREEN, ASSISTANCE_SCREEN] : [])]);
  function startFrom(c, role) {
    const fallback = role ? 'Use this role\'s navigation, listed at the top of this script, and look for the screen that matches the requirement.' : 'Use the navigation of each role in the journey (plan section 6).';
    if (!c.screens.length) return `No screen is documented for ${c.tc.reqIds.join(', ')}: the evidence map has no requirement-specific screen, and its area-wide list is too broad to use as a starting point. ${fallback}`;
    const note = 'These are the screens the requirement\'s own evidence-map entry cites, not a verified click path.';
    if (!role) return `${list(c.screens)}. ${note} An entry a role does not see in its navigation is not available to that role.`;
    const ok = c.screens.filter(x => visibleTo(role).has(x)), no = c.screens.filter(x => !visibleTo(role).has(x));
    const out = [ok.length ? `${list(ok)}.` : `None of the screens the evidence map cites is in this role's navigation. ${fallback}`];
    if (ok.length && no.length) out.push(`Not in this role's navigation: ${list(no)}.`);
    out.push(note);
    return out.join(' ');
  }
  function functionalCase(c) {
    const { tc } = c, a = assessment.get(tc.reqIds[0]), q = reqs.get(tc.reqIds[0]), info = ROLE_INFO[c.role], role = c.role;
    const L = [];
    L.push(`### ${tc.id} — ${tc.title}`, '');
    L.push(`- **Requirement:** ${q.id} — ${q.title}. Assessment: **${a.implementation}**. Target ${a.target}. Priority ${q.priority}, BRD phase ${q.brdRelease}.`);
    L.push(`- **Catalogue:** ${tc.type}, fixture ${c.fixture}, catalogue owner "${tc.owner}".`);
    L.push(`- **Run as:** ${info.label}. Basis: ${c.roleBasis}.`);
    L.push(`- **Default result:** ${c.blocked ? `**${BLOCKED_RESULT}**` : 'Not run'}`);
    L.push(`- **Start from:** ${startFrom(c, role)}`);
    L.push(`- **Preconditions:** ${info.label} signed in to hosted staging with synthetic data only. Catalogue precondition (target design): "${tc.preconditions}" The step "reset fixture before execution" is not available on hosted staging, because test-reset commands are never run against the hosted site: use records no earlier case has changed, or create new synthetic ones, and note which.`);
    L.push('', '**Tester actions**', '');
    if (c.blocked) {
      L.push(`1. ${c.blocked.text}`);
      L.push(`2. Check it: open the screens named under Start from and look for the behaviour described in the expected result below. Do not work around a missing control.`);
      L.push(`3. If the behaviour is absent, leave the result Blocked and write in the register what you looked at and what was missing. If you can exercise part of it, do so, record exactly what you did and saw in Notes, and keep the result Blocked or set Fail if what you saw was wrong. A partial run is never a Pass.`);
      L.push(`4. Original design step, for reference: "${c.statement}"`);
    } else {
      L.push(`1. Sign in to hosted staging as ${info.label} and check that the synthetic-environment banner is showing (plan section 7).`);
      L.push(`2. Set up the data. The original case loads fixture ${c.fixture}; a fixture of that name cannot be loaded on hosted staging. Choose seeded or newly created synthetic records (plan section 7) and write down which ones you used.`);
      L.push(`3. Open the screens named under Start from.`);
      L.push(`4. Try to bring about the behaviour in the original design step: "${c.statement}" Use only what the screens offer. If a control or state described there does not exist in this build, do not work around it; note "not available in this build" and check the Known gaps line.`);
      L.push(`5. Compare what happened with the expected result below. If the build refuses the action, the refusal is a result: copy its message. Write the actual result in your own words (what you saw, not what you expected).`);
      L.push(`6. Capture evidence: a screenshot of the screen showing the outcome, plus the receipt, revision or Activity log entry where the action creates one (the Activity log is not in every role's navigation). Save it where the reviewer can open it and note its location.`);
    }
    L.push('', `**Expected result** (catalogue): ${tc.expected}`, '');
    L.push(`**Known gaps** (assessment, remaining work for ${q.id}): ${a.remaining}`, '');
    L.push(`<details><summary>What the build does today (assessment, current state of ${q.id})</summary>`, '', a.current, '', '</details>', '');
    L.push('**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______', '', '**Notes:**', '', '---', '');
    return L.join('\n');
  }
  function journeyCase(c) {
    const { tc, journey } = c, L = [], b = journey.blockedSteps;
    L.push(`### ${tc.id} — ${tc.title}`, '');
    L.push(`- **Requirements:** ${tc.reqIds.map(id => `${id} (${status(id)})`).join('; ')}. Priority ${tc.priority}, catalogue release ${tc.release}.`);
    L.push(`- **Catalogue:** ${tc.type}, fixture ${c.fixture}, catalogue owner "${tc.owner}".`);
    L.push(`- **Default result:** ${b ? `**${BLOCKED_RESULT}** (steps ${list(b.steps)} cannot be done in the current build; the other steps can still be run and recorded)` : 'Not run'}`);
    L.push(`- **Start from:** ${startFrom(c, null)}`);
    L.push(`- **Preconditions:** Catalogue precondition (target design): "${tc.preconditions}" On hosted staging the "test adapters" are the seeded demonstration connectors (plan section 7); real providers, programme destinations, facilities and patients are not available. Sign in as each role the journey names (plan section 6); fixture ${c.fixture} cannot be loaded, so use synthetic records and note which.`);
    L.push('', '**Journey steps** (catalogue wording; record what you observed under each)', '');
    for (const s of journey.steps) {
      const blocked = b && b.steps.includes(s.n);
      L.push(`${s.n}. ${s.text}${blocked ? ` **Blocked by default.** ${s.n === b.steps[0] ? b.text : `Same reason as step ${b.steps[0]}.`}` : ''}`);
      L.push(`   - Observed: ______${blocked ? ' (Blocked)' : ''}`);
    }
    if (journey.exception) L.push('', `**Exception to exercise** (catalogue): ${journey.exception} Exercise it only if a screen lets you cause it. If nothing in the build lets you induce it, record that in Notes; do not simulate it by editing data.`);
    L.push('', `**Expected result** (catalogue): ${tc.expected}`, '', '**Known gaps** (assessment, remaining work per requirement):', '');
    for (const id of tc.reqIds) L.push(`- ${id} (${status(id)}): ${assessment.get(id).remaining}`);
    L.push('', `<details><summary>What the build does today (assessment, current state)</summary>`, '');
    for (const id of tc.reqIds) L.push(`- **${id}:** ${assessment.get(id).current}`);
    L.push('', '</details>', '', '**Result:** ______ (Pass / Fail / Blocked / Not run)    **Defect:** ______', '', '**Notes:**', '', '---', '');
    return L.join('\n');
  }

  // ------------------------------------------------------------ one script
  function script(roleKey) {
    const cases = roleCases[roleKey], isJourney = roleKey === 'END_TO_END', info = ROLE_INFO[roleKey];
    const blockedN = cases.filter(c => c.blocked).length;
    const L = [notice(isJourney ? 'This script holds the 12 End to end journeys of the catalogue.' : `This script holds the catalogue cases assigned to the ${info.label} role.`)];
    L.push(isJourney ? '# UAT script — end-to-end journeys' : `# UAT script — ${info.label}`, '');
    L.push('Read the [UAT plan](UAT-PLAN.md) first: entry and exit criteria, sign-in, test data, how to record a result and the defect severity scale. Results go in [uat-results.csv](uat-results.csv); this script is the worksheet. UAT results count as formal evidence only when a named person executes and a different named person reviews. A Pass here is evidence for one catalogue case on a synthetic build; it does not accept a requirement.', '');
    if (isJourney) {
      L.push('Each journey names the roles it needs. Sign in as each in turn (plan section 6). Journeys are long and most depend on partner systems that hosted staging does not have: run the steps that can be run, mark the others Blocked with the reason, and never record a Pass for a journey with a Blocked step.', '');
    } else {
      L.push(`- **Who runs this:** ${info.how}.`, `- **What this role can do:** ${info.scope}`, `- **Navigation this role sees** (from lib/saha/navigation.ts): ${list(nav[roleKey])}.`, '');
    }
    L.push(`- **Cases:** ${cases.length}. Default Blocked: ${blockedN}.`, '', '| Run details | |', '| --- | --- |', '| Executor (name) | |', '| Reviewer (a different name) | |', '| Build (commit) | |', '| Date | |', '| Browser and version | |', '');
    L.push('## Case index', '', '| Case | Title | Requirement (assessment) | Default result |', '| --- | --- | --- | --- |');
    for (const c of cases) L.push(`| ${c.tc.id} | ${cell(c.tc.title)} | ${c.tc.reqIds.map(id => `${id} (${status(id)})`).join('; ')} | ${c.blocked ? BLOCKED_RESULT : 'Not run'} |`);
    L.push('', '## Cases', '');
    for (const c of cases) L.push(isJourney ? journeyCase(c) : functionalCase(c));
    return L.join('\n');
  }

  // ------------------------------------------------------------ the plan
  function plan() {
    const sel = selected.filter(s => s.kind === 'functional'), n = k => roleCases[k].length;
    const il = sel.filter(s => status(s.tc.reqIds[0]) === 'implemented-local').length, pa = sel.length - il;
    const blockedCases = selected.filter(s => s.blocked);
    const L = [notice('This is the plan for the hosted-staging UAT pack.')];
    L.push('# UAT plan — Saha hosted synthetic staging', '');
    L.push('**What this is.** A repeatable way for named people to try the original acceptance cases against the hosted synthetic staging site, and to leave records that [the test strategy](../../current/07_Test-Strategy_v1.1.md) can accept as formal execution records.', '');
    L.push('**What it is not.** No case in this pack has been run. Nothing here accepts a requirement: all 176 BRD acceptances stay pending, whatever the UAT results are. A Pass is evidence for one catalogue case, run on a synthetic build by named people; it is not a decision on the requirement, a clinical, field or security approval, or a statement that the product is ready for real patients.', '');
    L.push('## 1. Limits first', '',
      '- **Results are formal evidence only when a named person executes and a different named person reviews.** The register validator rejects a Pass without both, and rejects placeholders, roles, and tool or AI names in the executor and reviewer fields.',
      '- **Synthetic data on hosted staging only.** No real patient information. Live providers, programme destinations, EHRs, ABDM, SMS and partners are not reachable (external calls are off, `SAHA_EXTERNAL_APIS_ENABLED=false`, [hosted staging](../../current/HOSTED-STAGING.md)). Steps that need one are Blocked, not Failed.',
      '- **The original catalogue steps are generic.** Every functional case reads "load the fixture, apply this design statement, capture evidence". The scripts quote the design statement and, where the evidence map names a screen for the requirement, say where to start; they do not invent a click path, because none is documented. A tester will have to find the control, and where there is none, that is a finding.',
      '- **A Known gap is not a Fail.** If the expected result needs something the case\'s Known gaps line says is not built, the result is Blocked. A Fail is for behaviour the build claims and gets wrong.',
      '- **A desktop browser cannot establish physical-device claims** (crash, low storage, eviction, incoming calls, clock rollback). The offline cases can be exercised in a desktop browser only.',
      `- **Not in this pack:** the ${typeCounts('Negative or recovery')} Negative or recovery cases and ${typeCounts('Performance or control')} Performance or control cases of the catalogue; security, penetration, load, availability and accessibility testing (the automated suites and the separate accessibility audit cover what they cover); real-device and field evaluation.`,
      '- **The default-Blocked list and the role assignment are builder judgements** (section 11). Each default-Blocked case quotes the assessment text it rests on and the generator fails if that text changes. The owner should review both lists before the run.', '');
    L.push('## 2. Purpose', '',
      `Run the ${typeCounts('Functional')} Functional and ${typeCounts('End to end')} End to end cases of [the test catalogue](../../current/TEST-CATALOGUE.csv) that the current build can be tried against, role by role, on hosted staging; make what is not built visible in each case instead of letting it surface as noise; and produce one register ([uat-results.csv](uat-results.csv)) that a reviewer and the validator can check.`, '');
    L.push('## 3. Scope', '', '| Catalogue type | Cases | In this pack | Why |', '| --- | ---: | ---: | --- |',
      `| Functional | ${typeCounts('Functional')} | ${sel.length} | ${excluded.length} left out: ${excluded.map(e => e.tc.reqIds[0]).join(', ')} are not-built in the assessment, so there is nothing to run against (they are listed in section 11) |`,
      `| End to end | ${typeCounts('End to end')} | ${n('END_TO_END')} | all twelve journeys; ${selected.filter(s => s.kind === 'journey' && s.blocked).length} have steps that cannot be done in the current build |`,
      `| Negative or recovery | ${typeCounts('Negative or recovery')} | 0 | not in this pack |`,
      `| Performance or control | ${typeCounts('Performance or control')} | 0 | not in this pack |`,
      `| **Total** | ${catalogue.length} | ${selected.length} | |`, '',
      `Of the ${sel.length} functional cases, ${il} rest on a requirement assessed **implemented-local** and ${pa} on one assessed **partial**. The assessment is in [requirements/assessment.tsv](../../../requirements/assessment.tsv).`, '');
    L.push('## 4. Entry criteria', '', 'Do not start until all of these are true:', '',
      '1. The build is identified. Record the deployed commit in every register row (`build`). The deploy workflow run in [hosted staging](../../current/HOSTED-STAGING.md) names it. Every merge into `main` redeploys the site, so set the repository variable `SAHA_DEPLOY_FREEZE` to `true` for the run and set it back afterwards; a change of build mid-run invalidates earlier rows.',
      '2. Each executor\'s and reviewer\'s email address is on the Cloudflare Access policy (it is kept in the Cloudflare dashboard, not in Git).',
      '3. A UAT lead is named, and a named executor and a different named reviewer exist for each script in scope (sign-off table, section 10).',
      '4. The owner has created the invitations the run needs and each tester has accepted theirs (section 6), and the people the ASHA cases use are assigned to the ASHA worker.',
      '5. Every tester has read sections 1, 6, 7 and 8, and the open findings in [VALIDATION.md](../../../VALIDATION.md) and [slice 10k](../../current/SLICE-10K-COMBINED-REVIEW-FIXES.md), so a known finding is not raised as new.',
      '6. The signed-in page shows the synthetic-environment banner.',
      '7. `node tests/uat/check-uat-register.mjs` passes on the register as it stands.', '');
    L.push('## 5. Exit criteria', '',
      '1. Every case in every script in scope has a result in the register: Pass, Fail or Blocked. A case left empty or Not run is listed in the sign-off table as deferred, with a reason.',
      '2. Every Pass and Fail has been reviewed by a person other than its executor, and the register passes `node tests/uat/check-uat-register.mjs`.',
      '3. Every Fail has a defect id. No Critical or High defect is open without a recorded decision by the programme owner (section 9).',
      '4. Every Blocked row says in `actualResult` what was tried and what was missing.',
      '5. The sign-off table is complete.', '',
      'Meeting the exit criteria ends the run. It does not accept any requirement.', '');
    L.push('## 6. Roles, scripts and sign-in', '', '| Script | Role | Cases | Default Blocked | Navigation entries (lib/saha/navigation.ts) |', '| --- | --- | ---: | ---: | --- |');
    for (const k of ROLES) L.push(`| [${ROLE_INFO[k].file}](${ROLE_INFO[k].file}) | ${ROLE_INFO[k].label} | ${n(k)} | ${roleCases[k].filter(c => c.blocked).length} | ${cell(list(nav[k]))} |`);
    L.push(`| [UAT-END-TO-END.md](UAT-END-TO-END.md) | Several roles per journey | ${n('END_TO_END')} | ${roleCases.END_TO_END.filter(c => c.blocked).length} | as the roles in the journey |`, '');
    L.push('The role model is in [docs/current/06](../../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md): membership roles are ASHA, clinician, supervisor and administrator; the **owner** is a flag that gives membership, configuration and governance control but no patient access beyond the member\'s own role and teams. The owner script is therefore run by an owner account (a clinician with the owner flag). The navigation is display only: the server checks every action, so a hidden screen does not prove an action is denied.', '');
    L.push('**Signing in**', '',
      '1. Hosted staging sits behind Cloudflare Access. Open the address in [hosted staging](../../current/HOSTED-STAGING.md); a one-time code is emailed to an allowed address and a session lasts 24 hours.',
      '2. A tester\'s first sign-in creates a home organisation in which the tester is owner and clinician, seeded with the synthetic people and demonstration connectors in section 7 (lib/saha/store.ts, ensureAccount). That is the account for the owner script and for any case that needs a single user.',
      '3. To run as ASHA, supervisor or administrator, one owner account acts as the UAT coordinator. Each tester opens their account to read their account code and gives it to the coordinator, who creates an account-bound invitation naming the role and care team under **Organisation & team**; the tester accepts it and switches organisation from the side navigation. Invitations are single-use and expire after 72 hours; the application sends no email ([administrator guide](../../current/ADMINISTRATOR-GUIDE.md)).',
      '4. The seeded people belong to the account that first signed in. For an ASHA to see anyone, an owner with patient access or a supervisor must assign people to that worker (the assignment command is `assignPatient`; an assignment is refused if the destination team is outside the assigner\'s scope).',
      '5. Cases that compare roles (for example BR-ID-02) need two or more members: use the coordinator\'s organisation and its invited testers, not separate home organisations.', '');
    L.push('## 7. Environment and test data', '',
      '- **Site:** the `workers.dev` address recorded in [hosted staging](../../current/HOSTED-STAGING.md), synthetic environment (`SAHA_ENVIRONMENT=synthetic`), external APIs off. The banner says synthetic.',
      '- **Browser:** a desktop browser. Record the browser and version in the script\'s run details. The workspace can be switched to Hindi (slice 10j); the Hindi text is an unreviewed draft, so run the cases in English unless a case is about language.',
      '- **Never:** enter real patient information; send the local identity headers used by the automated suites to the hosted site; run test-reset commands or fixtures against it ([test strategy](../../current/07_Test-Strategy_v1.1.md)). Fixture names such as FX-UX-01 are design-time names and cannot be loaded on hosted staging.',
      '- **Reset:** there is none. Use a record no earlier case has changed or create a new synthetic one, and write down which you used. If a case changes shared records (for example by confirming a visit), say so in Notes so the next tester does not inherit it unknowingly.', '',
      '**Seeded synthetic people** (lib/saha/seed.ts; check the People screen, which is the authority)', '', '| Name | Age | Village | Programmes | Open task | Assigned in the seed |', '| --- | ---: | --- | --- | --- | --- |');
    for (const p of seed.people) L.push(`| ${p.name} | ${p.age} | ${p.village} | ${list(p.programmes)} | ${p.task} | ${p.assigned ? 'yes (to the first account)' : 'no'} |`);
    L.push('', '**Seeded connections** (lib/saha/seed.ts)', '', '| Name | Kind | Mode / status | Seeded behaviour |', '| --- | --- | --- | --- |');
    for (const i of seed.integrations) L.push(`| ${i.name} | ${i.kind} | ${i.mode} / ${i.status} | ${cell(i.description)}${i.behavior ? ` Behaviour: ${i.behavior}.` : ''} |`);
    L.push('', 'The clinical governance demonstration package (synthetic sources, services and two protocols, none clinically approved) is installed automatically in a new home organisation of the synthetic environment unless `SAHA_DEMONSTRATION_PACKAGE=manual` is set (slice 9a).', '');
    L.push('## 8. Running a case and recording a result', '',
      '1. Open the role\'s script and take the next case. Read Requirement, Known gaps and Expected result before you start.',
      '2. Follow the tester actions in order. Do not read the expected result as a checklist to confirm; observe first.',
      '3. Capture evidence as you go: a screenshot of the outcome, and the receipt, revision or Activity log entry where there is one. Evidence holds synthetic data only. Store it where the reviewer can open it and record its URI and SHA-256 (`sha256sum file`). If you commit evidence to the repository, put it under `tests/evidence/uat/<run>/` on a branch and publish it through a draft pull request.',
      '4. Choose the result:', '',
      '   | Result | Use it when |', '   | --- | --- |',
      '   | **Pass** | Every part of the expected result was observed on this build, with evidence. No partial Passes. |',
      '   | **Fail** | You could do the action and the build did something different from the expected result, or something unsafe. Raise a defect. |',
      '   | **Blocked** | You could not do the action in this build or environment: the capability is not built (see Known gaps), or it needs a live partner, a physical device or an approval hosted staging cannot give. Say what you tried and what was missing. |',
      '   | **Not run** | Not attempted. Use it only to say so explicitly; it must carry no executor, evidence or reviewer. |', '',
      '5. Add or update the case\'s row in [uat-results.csv](uat-results.csv). Do not rename or delete rows.',
      '6. A reviewer (a different named person) re-reads the evidence and the actual result, may repeat the case, and then fills `reviewer` and `reviewedAt`. A reviewer who disagrees changes nothing in the row and tells the executor, who corrects it.',
      '7. Run `node tests/uat/check-uat-register.mjs` before a review and again at exit.', '',
      '**Register columns** (the fields the strategy asks for: case ID, build, environment, observed result, evidence, defect, executor, reviewer)', '',
      '| Column | Meaning | Required for |', '| --- | --- | --- |',
      '| caseId | A catalogue id. The generator creates one row per case in the scripts. | all rows |',
      '| build | Commit hash of the deployed build, 7 to 40 hexadecimal characters. | Pass, Fail |',
      '| environment | For example "hosted synthetic staging, Chrome 130". | Pass, Fail |',
      '| executor | Name of the person who ran the case. Not a role, a placeholder, or a tool or AI name. | Pass, Fail, Blocked |',
      '| executedAt | ISO date or date-time. | Pass, Fail, Blocked |',
      '| result | Exactly Pass, Fail, Blocked or Not run; empty only while the row has not been touched. | all recorded rows |',
      '| actualResult | What was observed, or for Blocked what was tried and what was missing. | Pass, Fail, Blocked |',
      '| evidence | URI or path of the evidence, ideally with SHA-256. | Pass |',
      '| defect | Defect id or issue link. | Fail |',
      '| reviewer | Name of a different person from the executor. | Pass |',
      '| reviewedAt | ISO date or date-time, not before executedAt. | Pass |', '',
      'The register starts blank. A case marked **Blocked** by default in its script is still recorded by an executor, who confirms the reason first.', '');
    L.push('## 9. Defect severity', '', '| Severity | Definition | Effect on exit |', '| --- | --- | --- |',
      '| **Critical** | A person\'s record, recording or result is shown or sent to someone outside their scope (another patient, team or organisation); an identity, consent or authority control is bypassed; acknowledged work is lost or silently overwritten; a confirmed record, receipt or audit entry is altered; a secret is exposed. | Blocks exit. Stop the run in the affected area and tell the programme owner the same day. |',
      '| **High** | A safety or authority control that should stop an action does not (positive patient check, version-bound approval, role limit, stale-data check); a core journey step cannot be completed; the screen shows an external state that is wrong (for example "accepted" without a receipt). | Blocks exit unless the programme owner records a decision to accept it. |',
      '| **Medium** | A function works wrongly with a workaround, or a message or status is misleading without changing what is stored or sent. | Listed at exit; does not block. |',
      '| **Low** | Cosmetic, wording or layout problems, and documentation that disagrees with the screen, with no effect on behaviour. | Listed at exit; does not block. |', '',
      'A defect record carries an id (a GitHub issue in the project repository is enough), the case id, the build, steps to reproduce, expected and actual result, evidence, severity, who found it and when. Put the id in the register\'s `defect` column. Behaviour the Known gaps line already says is not built is not a defect: it is a Blocked result.', '');
    L.push('## 10. Sign-off', '', 'Sign-off records that the run met the exit criteria for the scripts named. It does not accept a requirement and does not change any of the 176 pending acceptances. Names are filled in by the people themselves.', '',
      '| Role in the run | Decision (met / not met / deferred, with reason) | Name | Date |', '| --- | --- | --- | --- |',
      '| UAT lead (owns the register, confirms the exit criteria) | | | |', '| Programme owner (accepts the results as evidence for the cases in scope; decides on High defects) | | | |',
      '| Clinical safety lead (clinical, AI governance and BR-CLIN cases) | | | |', '| Privacy and security owner (BR-SEC cases and scope-of-access cases) | | | |', '');
    L.push('## 11. How the cases were chosen and assigned', '',
      `**Selection.** Functional cases whose requirement is implemented-local or partial in the assessment, plus every End to end case: ${selected.length} cases (${sel.length} functional, ${n('END_TO_END')} end to end). Functional cases on a not-built requirement are left out:`, '',
      ...excluded.map(e => `- ${e.tc.id} (${e.tc.title}): ${e.reason}.`), '',
      '**Role assignment.** Each functional case takes its requirement area\'s default role, from the catalogue\'s owner column and the access model, unless reading the case\'s steps and expected result points to another role. Each case shows its basis. The exceptions table is `ROLE_BY_REQUIREMENT` in `tests/lib/uat-selection.mjs`. A case that needs a second role is assigned to the role that sets the situation up; the tester brings in a second member as the case needs.', '',
      '| Script | Cases | of which implemented-local | of which partial |', '| --- | ---: | ---: | ---: |');
    for (const k of ROLES) { const c = roleCases[k]; L.push(`| ${ROLE_INFO[k].label} | ${c.length} | ${c.filter(x => status(x.tc.reqIds[0]) === 'implemented-local').length} | ${c.filter(x => status(x.tc.reqIds[0]) === 'partial').length} |`); }
    L.push(`| End to end | ${n('END_TO_END')} | journeys mix statuses | |`, '',
      '**Default Blocked.** A case is Blocked by default only when the assessment itself says the capability its expected result rests on does not exist. Cases that are part built stay runnable and carry the gap in their Known gaps line. Each entry below quotes the assessment, and the generator stops if the quoted text is no longer there.', '',
      '| Case | Requirement | What the assessment says |', '| --- | --- | --- |');
    for (const c of blockedCases) L.push(`| ${c.tc.id}${c.journey ? ` (step${c.blocked.steps.length > 1 ? 's' : ''} ${list(c.blocked.steps)})` : ''} | ${c.blocked.req ?? c.tc.reqIds[0]} | ${cell(c.blocked.text.replace('Not testable in current build: ', ''))} |`);
    L.push('', '**Regenerating.** `node tests/uat/generate-uat-pack.mjs` rewrites the plan and scripts and creates the register only if it is missing; a register that exists is never overwritten, because it holds the testers\' results. To start a fresh blank register, delete the file and regenerate. `node tests/uat/generate-uat-pack.mjs --check` fails if the committed files differ from what the sources now produce.', '');
    return L.join('\n');
  }

  // ------------------------------------------------------------ register
  const registerRows = selected.map(s => Object.fromEntries(REGISTER_COLUMNS.map(c => [c, c === 'caseId' ? s.tc.id : ''])));
  const blankRegister = toCsv(REGISTER_COLUMNS, registerRows);

  const render = () => {
    const m = new Map();
    m.set(`${OUT}/UAT-PLAN.md`, plan());
    for (const k of ROLES) m.set(`${OUT}/${ROLE_INFO[k].file}`, script(k));
    m.set(`${OUT}/UAT-END-TO-END.md`, script('END_TO_END'));
    return m;
  };
  const files = render();

  // ------------------------------------------------------------ checks
  await r.check('selection: every selected case appears in exactly one script', () => {
    const seen = new Map(); for (const s of selected) seen.set(s.tc.id, (seen.get(s.tc.id) ?? 0) + 1);
    const dup = [...seen].filter(([, n]) => n !== 1); if (dup.length) throw new Error(`cases in more than one script: ${dup.map(d => d[0])}`);
    let texts = 0; for (const [p, t] of files) if (p !== `${OUT}/UAT-PLAN.md`) for (const s of selected) if (new RegExp(`^### ${s.tc.id} — `, 'm').test(t)) texts++;
    if (texts !== selected.length) throw new Error(`${texts} case headings for ${selected.length} selected cases`);
  });
  await r.check('selection: 148 Functional and 12 End to end cases accounted for (selected or excluded with a reason)', () => {
    const f = selected.filter(s => s.kind === 'functional').length + excluded.length, e = selected.filter(s => s.kind === 'journey').length;
    if (f !== typeCounts('Functional') || e !== typeCounts('End to end')) throw new Error(`functional ${f}/${typeCounts('Functional')}, journeys ${e}/${typeCounts('End to end')}`);
  });
  await r.check('every default-Blocked case quotes assessment text that is still present', () => {
    for (const id of Object.keys(BLOCKED_REQUIREMENTS)) if (!selected.some(s => s.tc.reqIds[0] === id && s.blocked)) throw new Error(`${id} is in BLOCKED_REQUIREMENTS but no selected case is blocked by it`);
    for (const s of selected) if (s.blocked && !/^Not testable in current build: /.test(s.blocked.text)) throw new Error(`${s.tc.id}: blocked without the standard wording`);
  });
  await r.check('every cited screen file is mapped to a screen or is the generic shell', () => { const u = unmappedPanels(model.evidenceMap); if (u.length) throw new Error(`unmapped panel files (add them to PANEL_HOME): ${u}`); });
  await r.check('every PANEL_HOME file exists', () => { for (const p of Object.keys(PANEL_HOME)) if (!existsSync(abs(p))) throw new Error(`${p} no longer exists`); });
  await r.check('generated text contains no unreplaced placeholders and no undefined', () => {
    for (const [p, t] of files) { if (/\bundefined\b|\[object Object\]|\$\{/.test(t)) throw new Error(`${p}: placeholder or undefined in text`); if (!t.startsWith('<!-- GENERATED FILE.')) throw new Error(`${p}: missing generated header`); }
  });
  await r.check('blank register has one empty-result row per selected case, in script order', () => {
    const rows = registerRows; if (rows.length !== selected.length || new Set(rows.map(x => x.caseId)).size !== rows.length) throw new Error('register rows do not match the selection');
    if (rows.some(x => REGISTER_COLUMNS.slice(1).some(c => x[c] !== ''))) throw new Error('blank register has data');
  });

  // ------------------------------------------------------------ write or compare
  const regPath = abs(REGISTER_PATH);
  if (CHECK) {
    await r.check('committed pack equals the regenerated pack (plan and scripts)', () => {
      const stale = []; for (const [p, t] of files) if (!existsSync(abs(p)) || readFileSync(abs(p), 'utf8') !== t) stale.push(p);
      if (stale.length) throw new Error(`stale or missing, regenerate: ${stale.join(', ')}`);
    });
    await r.check('committed register covers exactly the selected cases', () => {
      if (!existsSync(regPath)) throw new Error(`${REGISTER_PATH} is missing`);
      const { header, rows } = readCsv(REGISTER_PATH);
      if (header.join(',') !== REGISTER_COLUMNS.join(',')) throw new Error('register header differs');
      const have = rows.map(x => x.caseId).sort().join(), want = selected.map(s => s.tc.id).sort().join();
      if (have !== want) throw new Error('register case ids differ from the selected cases');
    });
  } else {
    for (const [p, t] of files) { mkdirSync(dirname(abs(p)), { recursive: true }); writeFileSync(abs(p), t); }
    if (!existsSync(regPath)) { mkdirSync(dirname(regPath), { recursive: true }); writeFileSync(regPath, blankRegister); console.log(`created ${REGISTER_PATH} (${registerRows.length} rows)`); }
    else console.log(`${REGISTER_PATH} exists and was left unchanged`);
    await r.check('register on disk covers exactly the selected cases', () => {
      const { header, rows } = readCsv(REGISTER_PATH);
      if (header.join(',') !== REGISTER_COLUMNS.join(',')) throw new Error('register header differs; move the old file aside and regenerate');
      const have = new Set(rows.map(x => x.caseId)), missing = selected.filter(s => !have.has(s.tc.id)).map(s => s.tc.id), extra = rows.filter(x => !selected.some(s => s.tc.id === x.caseId)).map(x => x.caseId);
      if (missing.length || extra.length) throw new Error(`register differs from the selection: missing ${missing.length} (${missing.slice(0, 5)}), extra ${extra.length} (${extra.slice(0, 5)}). Add rows by hand to keep recorded results, or delete the file to start blank.`);
    });
  }
  // Determinism: rendering again from a second, independent load of the inputs gives identical bytes.
  await r.check('generation is deterministic (a second build from freshly loaded inputs is byte-identical)', async () => {
    const again = await buildUatModel();
    if (again.selected.map(s => s.tc.id + s.role + (s.blocked ? 'B' : '')).join() !== selected.map(s => s.tc.id + s.role + (s.blocked ? 'B' : '')).join()) throw new Error('selection or role assignment differs between builds');
    const second = render();
    for (const [p, t] of files) if (second.get(p) !== t) throw new Error(`${p} differs between two renders`);
  });
  console.log(`UAT pack: ${selected.length} cases (${Object.entries(roleCases).map(([k, v]) => `${k} ${v.length}`).join(', ')}); ${excluded.length} excluded; ${[...files.keys()].length} documents`);
  await r.finish({ counts: { selected: selected.length, excluded: excluded.length, byRole: Object.fromEntries(Object.entries(roleCases).map(([k, v]) => [k, v.length])), defaultBlocked: selected.filter(s => s.blocked).length } });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
