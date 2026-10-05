// Slice 11e: which catalogue cases go into the UAT scripts, who runs them, and which are not testable in the current build.
// Shared by tests/uat/generate-uat-pack.mjs, tests/uat/check-uat-register.mjs and tests/uat/coverage-map.mjs.
// Every judgement below is a table with its reason beside it; a "not testable" reason must quote the assessment (checked on every run).
import ts from 'typescript';
import { read, loadCatalogue, loadAssessment, loadRequirements, loadEvidenceMap, evidenceFor, areaOf, exists } from './uat-data.mjs';

// ---------------------------------------------------------------- roles
// Membership roles are asha, clinician, supervisor, admin (lib/saha/platform.ts); the owner flag is separate (docs/current/06 access model).
// A new sign-in becomes owner and clinician of a new home organisation (lib/saha/store.ts ensureAccount), so the owner script is run from that account.
export const ROLES = ['OWNER', 'ASHA', 'SUPERVISOR', 'CLINICIAN', 'ADMIN'];
export const ROLE_INFO = {
  OWNER: { file: 'UAT-OWNER.md', label: 'Organisation owner / programme lead', membership: { role: 'clinician', isOwner: true, reporting: false }, how: 'the account that first signs in to a new organisation (owner and clinician), or any member the owner flags as owner',
    scope: 'Membership, teams, connections, governance activation, retention, budgets, pilot settings and data export. The owner flag gives no patient access beyond the member\'s own role and teams (lib/saha/platform.ts manage(); docs/current/06).' },
  ASHA: { file: 'UAT-ASHA.md', label: 'ASHA worker', membership: { role: 'asha', isOwner: false, reporting: false }, how: 'invited by the owner with role ASHA and a care team; the owner must assign people to this worker',
    scope: 'Directly assigned patients in the member\'s teams: visit capture, the field notebook, referral requests, reviewed care actions. No independent clinical credential (docs/current/06).' },
  SUPERVISOR: { file: 'UAT-SUPERVISOR.md', label: 'Supervisor', membership: { role: 'supervisor', isOwner: false, reporting: false }, how: 'invited by the owner with role Supervisor and the care team',
    scope: 'Patients in the member\'s teams for oversight, assignment and reconciliation. No clinical fact writes (docs/current/06; lib/saha/indicators.ts manager()).' },
  CLINICIAN: { file: 'UAT-CLINICIAN.md', label: 'Clinician', membership: { role: 'clinician', isOwner: false, reporting: false }, how: 'invited by the owner with role Clinician and the care team (the owner account is also a clinician)',
    scope: 'Patients in the member\'s teams: care, clinical review, protocol and safety cases, identity decisions, emergency access. Membership does not verify professional credentials (docs/current/06).' },
  ADMIN: { file: 'UAT-ADMIN.md', label: 'Administrator', membership: { role: 'admin', isOwner: false, reporting: false }, how: 'invited by the owner with role Administrator',
    scope: 'Permitted configuration and operational metadata. No patient-record scope and no clinical export (docs/current/06; docs/current/ADMINISTRATOR-GUIDE.md).' },
};
const AREA_ROLE = { 'BR-UX': 'ASHA', 'BR-ID': 'ADMIN', 'BR-DATA': 'ASHA', 'BR-PROG': 'OWNER', 'BR-AG': 'CLINICIAN', 'BR-AI': 'OWNER', 'BR-CLIN': 'CLINICIAN', 'BR-INT': 'OWNER', 'BR-OFF': 'ASHA', 'BR-CARE': 'CLINICIAN', 'BR-REP': 'SUPERVISOR', 'BR-OPS': 'ADMIN', 'BR-SEC': 'OWNER', 'BR-RULE': 'CLINICIAN' };
// Exceptions to the area default, from reading each case's steps and expected result against the access model and the code that gates the action.
const ROLE_BY_REQUIREMENT = {
  'BR-ID-01': ['OWNER', 'invitations, role changes and suspension are owner actions (platform.ts manage())'],
  'BR-ID-02': ['OWNER', 'the boundaries are tested across several roles and teams, which only an owner can set up'],
  'BR-ID-04': ['SUPERVISOR', 'assigning and transferring patients is an owner or supervisor action (assignPatient)'],
  'BR-ID-05': ['CLINICIAN', 'the identity link needs an authorised person decision; the assessment names clinician resolution'],
  'BR-ID-06': ['ASHA', 'local registration happens at the point of care'],
  'BR-ID-07': ['ASHA', 'household sharing previews and proxy records are used from a person\'s page by the worker who holds that person'],
  'BR-ID-08': ['CLINICIAN', 'link merges and corrections need two different stewards (assessment, slice 1c)'],
  'BR-ID-10': ['OWNER', 'owners reconcile membership with an institution roster (assessment, slice 1d)'],
  'BR-DATA-09': ['OWNER', 'only an owner configures programme delivery and its mapping (mis.ts)'],
  'BR-DATA-10': ['OWNER', 'per-destination allowlists are owner-managed connection settings'],
  'BR-DATA-11': ['OWNER', 'imports and migrations are dry-run and applied by owners, supervisors or delegates; run by the owner'],
  'BR-DATA-12': ['SUPERVISOR', 'reuse indicators are for supervisors and owners (indicators.ts manager())'],
  'BR-PROG-02': ['ASHA', 'episodes are opened and followed up by the worker during visits'],
  'BR-PROG-03': ['ASHA', 'screening is captured by the worker during a visit'],
  'BR-PROG-04': ['ASHA', 'measurements are captured by the worker during a visit'],
  'BR-PROG-05': ['ASHA', 'the household visit plan is used by the worker who visits the household'],
  'BR-AG-06': ['ASHA', 'submissions are confirmed and sent by the worker from the visit'],
  'BR-AG-10': ['ASHA', 'the step is structured capture and drafting without a model'],
  'BR-AG-11': ['SUPERVISOR', 'programme analysis uses the governed indicators, which are for supervisors and owners'],
  'BR-AG-12': ['OWNER', 'agent change control is governance, which owners activate'],
  'BR-AI-02': ['CLINICIAN', 'the capability is run on a patient case by a worker or clinician'],
  'BR-AI-05': ['CLINICIAN', 'results are seen in the visit\'s assistant panel'],
  'BR-AI-06': ['CLINICIAN', 'input quality is met when a result is requested for a visit'],
  'BR-AI-09': ['CLINICIAN', 'results are compared inside the encounter'],
  'BR-INT-03': ['ASHA', 'submissions are made from the visit\'s Review & act and Submissions screens'],
  'BR-INT-04': ['ASHA', 'submissions are made from the visit\'s Review & act and Submissions screens'],
  'BR-INT-05': ['ASHA', 'submissions are made from the visit\'s Review & act and Submissions screens'],
  'BR-INT-12': ['CLINICIAN', 'imported results and recorded observations are read in the patient record'],
  'BR-INT-14': ['CLINICIAN', 'ABHA linking is a patient-level action (assessment, slice 7a)'],
  'BR-INT-18': ['CLINICIAN', 'received records are reviewed by a clinician (assessment, slice 7b)'],
  'BR-INT-19': ['CLINICIAN', 'received records are reviewed by a clinician (assessment, slice 7b)'],
  'BR-CARE-01': ['SUPERVISOR', 'a supervisor or owner reassigns unowned work (assessment, slice 4b)'],
  'BR-CARE-04': ['SUPERVISOR', 'overdue work enters the supervisor queue'],
  'BR-CARE-05': ['ASHA', 'the action plan is read by the care worker holding the patient'],
  'BR-CARE-06': ['ASHA', 'contact preferences are recorded on the person\'s page'],
  'BR-CARE-07': ['OWNER', 'the notification channel is an owner setting (Organisation & team)'],
  'BR-CARE-08': ['SUPERVISOR', 'worker activity evidence is a supervisor view (assessment, slice 4c)'],
  'BR-REP-07': ['ADMIN', 'product metrics are operational metadata, which administrators may see'],
  'BR-OPS-01': ['OWNER', 'the configuration check is owner-only (assessment)'],
  'BR-OPS-02': ['OWNER', 'environment and configuration are shown to owners (administrator guide)'],
  'BR-OPS-03': ['OWNER', 'publishing and rollback are governance changes'],
  'BR-OPS-06': ['OWNER', 'pilot training records are configured by the owner; the rehearsal is owner-run'],
  'BR-OPS-07': ['OWNER', 'the organisation export is owner-only (assessment)'],
  'BR-OPS-08': ['OWNER', 'the deployment pack is an owner export'],
  'BR-SEC-02': ['ASHA', 'notice and the decline of optional AI recording happen during the visit'],
  'BR-SEC-03': ['ASHA', 'withdrawal is recorded for a person and acts on the worker\'s queued recordings'],
  'BR-SEC-04': ['ASHA', 'household summaries and shared schedules are read by the worker'],
  'BR-SEC-07': ['ADMIN', 'support and report exports are operational'],
  'BR-SEC-11': ['CLINICIAN', 'emergency access is a clinician action (assessment, slice 6a)'],
  'BR-SEC-13': ['ADMIN', 'incidents are kept on the Operations page'],
  'BR-CLIN-04': ['OWNER', 'the case changes a user\'s role, which only an owner can do'],
  'BR-RULE-01': ['ASHA', 'missingness is met while capturing a visit'],
  'BR-RULE-02': ['ASHA', 'the positive patient check is made by the worker'],
  'BR-RULE-04': ['ASHA', 'a plan is cancelled by the worker after a submission'],
  'BR-RULE-06': ['OWNER', 'the case revokes a worker\'s role between drafting and execution'],
  'BR-RULE-08': ['SUPERVISOR', 'allocation is a supervisor decision'],
};
function assignRole(tc, ownerColumn) {
  const exception = ROLE_BY_REQUIREMENT[tc.reqIds[0]];
  if (exception) return { role: exception[0], basis: exception[1] };
  return { role: AREA_ROLE[tc.area], basis: `requirement area default (${tc.area}; catalogue owner "${ownerColumn}")` };
}

// ---------------------------------------------------------------- not testable in the current build
// Rule: a case is Blocked by default only when the assessment itself records that the capability the case's expected result
// rests on does not exist. Mixed cases (part built, part missing) stay runnable and carry the gap in their Known gaps line.
// Each entry quotes the assessment; the quote is verified against requirements/assessment.tsv every run.
export const BLOCKED_REQUIREMENTS = {
  'BR-ID-03': ['remaining', 'Verified privileged MFA, workforce recovery/device replacement and session revocation acceptance.'],
  'BR-ID-09': ['current', 'service accounts are documented as unsupported by both identity providers'],
  'BR-ID-10': ['remaining', 'Buyer-approved federation or identity-provider sync, automatic upstream removal feed and controlled emergency administration.'],
  'BR-PROG-06': ['remaining', 'Destination-authorised enrolment request/rejection/acceptance lifecycle.'],
  'BR-INT-16': ['remaining', 'Verified HFR/HPR or destination professional/facility attribution and expiry checks.'],
  'BR-INT-22': ['remaining', 'Approved legacy HL7 v2/CDA/REST/SOAP/file adapters as selected by buyer.'],
  'BR-SEC-05': ['remaining', 'Independent storage/key-management, rotation, media and end-to-end encryption assessment.'],
  'BR-SEC-09': ['current', 'No record is deleted.'],
  'BR-SEC-14': ['remaining', 'Enforced legal data-location policy across storage, providers, backups, analytics and support.'],
};
// End to end journeys: individual steps that cannot be done (step number -> assessment quote).
const CLINICAL_GENERATION = { req: 'BR-AI-02', field: 'current', quote: 'clinical generation remains unavailable.' };
export const BLOCKED_JOURNEY_STEPS = {
  'TC-J02': { steps: [3, 4, 5], ...CLINICAL_GENERATION },
  'TC-J08': { steps: [3, 4], ...CLINICAL_GENERATION },
  'TC-J10': { steps: [3], req: 'BR-CARE-03', field: 'remaining', quote: 'Facility-verified outcomes and external outcome evidence.' },
};
const FIELD_LABEL = { current: 'The assessment records the current state as', remaining: 'The assessment lists as remaining work' };
function verifiedReason(assessment, req, field, quote) {
  const a = assessment.get(req);
  if (!a || !a[field].includes(quote)) throw new Error(`The assessment for ${req} (${field}) no longer contains: "${quote}". Re-read the requirement and update BLOCKED_* in tests/lib/uat-selection.mjs.`);
  return { req, field, quote, text: `Not testable in current build: ${FIELD_LABEL[field]} “${quote}” (${req}, ${field} field of requirements/assessment.tsv).` };
}

// ---------------------------------------------------------------- where to start
// Navigation labels come from app/workspace.tsx and visibility from lib/saha/navigation.ts (read at run time, so they cannot drift).
export async function loadNavigation() {
  const js = ts.transpileModule(read('lib/saha/navigation.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const nav = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const line = read('app/workspace.tsx').split('\n').find(l => l.startsWith('const nav=['));
  if (!line) throw new Error('app/workspace.tsx no longer has a `const nav=[` line');
  const labels = Object.fromEntries([...line.matchAll(/\{id:'(\w+)',label:'([^']+)'/g)].map(m => [m[1], m[2]]));
  if (Object.keys(labels).length !== nav.VIEW_ORDER.length) throw new Error('Navigation labels and VIEW_ORDER disagree');
  const visible = Object.fromEntries(ROLES.map(r => [r, nav.shownViews(ROLE_INFO[r].membership, false).map(id => labels[id])]));
  return { labels, visible, order: nav.VIEW_ORDER.map(id => labels[id]) };
}
// Which screen hosts each panel file, from the import graph of app/*.tsx and the view guards in app/workspace.tsx at the base commit
// (a panel imported by another panel is hosted wherever that panel is). 'Person page' is a person's page opened from My work or People.
const PERSON = 'Person page and visit';
export const PANEL_HOME = {
  'app/indicator-definitions/page.tsx': ['Organisation & team'],
  'app/imported-evidence-panel.tsx': ['Organisation & team'],
  'app/imported-source-reference.tsx': [PERSON],
  'app/mis-mapping-panel.tsx': ['Connections', 'Submissions'],
  'app/reconciliation-panel.tsx': ['Care handover'],
  'app/reminder-optout-panel.tsx': ['Outreach'],
  'app/service-identity-panel.tsx': ['Operations'],
  'app/abdm-panel.tsx': [PERSON, 'Connections'], 'app/action-plan-panel.tsx': [PERSON], 'app/activity.tsx': ['Activity log'], 'app/adapter-operations-panel.tsx': ['Connections'],
  'app/agent-panel.tsx': [PERSON, 'AI tools'], 'app/aggregate-reports-panel.tsx': ['Connections'], 'app/ai-budget-panel.tsx': ['Operations'], 'app/ai-invoice-panel.tsx': ['Operations'],
  'app/alert-inbox.tsx': ['Alert bell (page header)'], 'app/anaemia-panel.tsx': [PERSON, 'Connections'], 'app/frontline-panel.tsx': [PERSON, 'Connections'], 'app/voice-input.tsx': ['My work', PERSON, 'Organisation & team'], 'app/audit-chain-panel.tsx': ['Activity log'], 'app/caseload-panel.tsx': ['Care handover'], 'app/clinical-panel.tsx': [PERSON],
  'app/consent-panel.tsx': [PERSON], 'app/continuity-panel.tsx': ['Care handover'], 'app/data-exit-panel.tsx': ['Organisation & team'], 'app/delegation-panel.tsx': ['Organisation & team'],
  'app/dispute-panel.tsx': [PERSON, 'Organisation & team'], 'app/ehr-panel.tsx': [PERSON, 'Connections'], 'app/entry-verification-panel.tsx': [PERSON, 'Organisation & team'],
  'app/environment-panel.tsx': ['Organisation & team'], 'app/exceptional-panel.tsx': [PERSON, 'Care handover'], 'app/exceptions-panel.tsx': ['Operations'], 'app/expansion-panel.tsx': ['Expansion'],
  'app/fact-verification-panel.tsx': [PERSON], 'app/fixture-migration-panel.tsx': ['Organisation & team'], 'app/governance-panel.tsx': ['Clinical governance'], 'app/household-panel.tsx': [PERSON],
  'app/household-visit-panel.tsx': [PERSON], 'app/identifier-panels.tsx': ['My work', 'People', PERSON], 'app/imported-visit-panel.tsx': [PERSON], 'app/incentive-claims-panel.tsx': ['Care handover'],
  'app/indicator-registry-panel.tsx': ['Operations'], 'app/indicators-panel.tsx': ['Operations'], 'app/media-panel.tsx': [PERSON], 'app/merge-panel.tsx': [PERSON],
  'app/mis-panel.tsx': ['Connections', 'Submissions'], 'app/notification-channel-panel.tsx': ['Organisation & team'], 'app/operations-panel.tsx': ['Operations'], 'app/organisation.tsx': ['Organisation & team'],
  'app/outreach-panel.tsx': ['Outreach'], 'app/pack-installation-panel.tsx': ['Organisation & team'], 'app/patient-directory-panel.tsx': ['My work', 'People'], 'app/patient-import-panel.tsx': ['Organisation & team'],
  'app/pilot-panel.tsx': ['Pilot readiness'], 'app/programme-migration-panel.tsx': ['Organisation & team'], 'app/programme-referral-panel.tsx': [PERSON], 'app/programmes.tsx': ['Programmes', PERSON, 'My work'],
  'app/provenance-panel.tsx': [PERSON], 'app/provider-history-panel.tsx': ['Clinical governance'], 'app/provider-sandbox-panel.tsx': ['Clinical governance'], 'app/record-controls.tsx': [PERSON],
  'app/record-import-panel.tsx': ['Organisation & team'], 'app/referral-panel.tsx': ['Care handover', 'My work', PERSON], 'app/referral-request-panel.tsx': [PERSON],
  'app/referral-request-queue-panel.tsx': ['Care handover'], 'app/retention-panel.tsx': ['Organisation & team'], 'app/rights-panel.tsx': [PERSON, 'Care handover'], 'app/roster-panel.tsx': ['Organisation & team'],
  'app/shadow-panel.tsx': ['Clinical governance'], 'app/trace-panel.tsx': ['Submissions', 'Operations'], 'app/value-override-panel.tsx': [PERSON, 'Organisation & team'],
  'app/availability-panel.tsx': ['Operations'], 'app/work-burden-panel.tsx': ['Operations'], 'app/value-range-protocol-panel.tsx': ['Organisation & team', PERSON],
  'app/worker-activity-panel.tsx': ['Care handover'], 'app/workforce-import-panel.tsx': ['Organisation & team'], 'app/worklist-panel.tsx': ['My work', 'People', 'Submissions'],
};
const GENERIC_SHELL = new Set(['app/workspace.tsx', 'app/layout.tsx', 'app/page.tsx', 'app/app/page.tsx', 'app/frontline-navigation.tsx', 'app/i18n.tsx', 'app/chatgpt-auth.ts', 'app/globals.css']);
export function unmappedPanels(evidenceMap) {
  const cited = new Set(Object.values(evidenceMap).flat().filter(p => p.startsWith('app/') && p.endsWith('.tsx')));
  return [...cited].filter(p => !PANEL_HOME[p] && !GENERIC_SHELL.has(p) && !p.startsWith('app/api/')).sort();
}
function screensFor(tc, evidenceMap) {
  const homes = new Set();
  // Only a requirement's own evidence entry says anything about that requirement; the area-wide fallback list is shared by every sibling.
  for (const id of tc.reqIds) { const e = evidenceFor(id, evidenceMap); if (e.own) for (const p of e.paths) for (const h of PANEL_HOME[p] ?? []) homes.add(h); }
  return [...homes];
}

// ---------------------------------------------------------------- the model
const FUNCTIONAL = /^1\. Load (FX-[A-Z0-9-]+)\. 2\. ([\s\S]*) 3\. Capture UI\/API results and stored receipt or audit evidence\.$/;
export function splitJourney(steps) {
  const lines = steps.split('\n').map(l => l.trim()).filter(Boolean), numbered = [];
  let exception = '';
  for (const l of lines) { const m = /^(\d+)\. ([\s\S]*)$/.exec(l); if (m) numbered.push({ n: +m[1], text: m[2] }); else if (/^Inject exception:/i.test(l)) exception = l.replace(/^Inject exception:\s*/i, ''); else throw new Error(`Unrecognised journey line: ${l}`); }
  numbered.forEach((s, i) => { if (s.n !== i + 1) throw new Error('Journey steps are not numbered 1..n'); });
  return { steps: numbered, exception };
}
export function splitFunctional(tc) {
  const m = FUNCTIONAL.exec(tc.steps);
  if (!m) throw new Error(`${tc.id}: steps do not follow the catalogue template`);
  return { fixture: m[1], statement: m[2].trim() };
}

/**
 * Returns { selected, excluded, navigation } where selected is ordered by script (role order, then catalogue order) and carries
 * everything the generator needs. Selection: Functional cases whose requirement is implemented-local or partial, and all End to end cases.
 */
export async function buildUatModel() {
  const catalogue = loadCatalogue(), assessment = loadAssessment(), reqs = new Map(loadRequirements().map(r => [r.id, r])), evidenceMap = loadEvidenceMap();
  const navigation = await loadNavigation();
  const selected = [], excluded = [];
  for (const tc of catalogue) {
    if (tc.type !== 'Functional' && tc.type !== 'End to end') continue;
    for (const id of tc.reqIds) if (!assessment.has(id) || !reqs.has(id)) throw new Error(`${tc.id}: unknown requirement ${id}`);
    const statuses = tc.reqIds.map(id => assessment.get(id).implementation);
    if (tc.type === 'Functional') {
      if (!statuses.every(s => s === 'implemented-local' || s === 'partial')) { excluded.push({ tc, reason: `requirement ${tc.reqIds[0]} is ${statuses[0]} in the assessment, so there is nothing built to run the case against` }); continue; }
      const { role, basis } = assignRole(tc, tc.owner), { fixture, statement } = splitFunctional(tc);
      const blocked = BLOCKED_REQUIREMENTS[tc.reqIds[0]] ? verifiedReason(assessment, tc.reqIds[0], ...BLOCKED_REQUIREMENTS[tc.reqIds[0]]) : null;
      selected.push({ tc, kind: 'functional', role, roleBasis: basis, fixture, statement, blocked, journey: null, screens: screensFor(tc, evidenceMap) });
    } else {
      const journey = splitJourney(tc.steps), spec = BLOCKED_JOURNEY_STEPS[tc.id];
      let blockedSteps = null;
      if (spec) { const why = verifiedReason(assessment, spec.req, spec.field, spec.quote); blockedSteps = { steps: spec.steps, ...why }; for (const n of spec.steps) if (!journey.steps[n - 1]) throw new Error(`${tc.id}: no step ${n}`); }
      selected.push({ tc, kind: 'journey', role: 'END_TO_END', roleBasis: 'End to end case (all 12 journeys)', fixture: tc.fixture, statement: '', blocked: blockedSteps ? { ...blockedSteps, text: blockedSteps.text } : null, journey: { ...journey, blockedSteps }, screens: screensFor(tc, evidenceMap) });
    }
  }
  const order = [...ROLES, 'END_TO_END'];
  selected.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || catalogue.indexOf(a.tc) - catalogue.indexOf(b.tc));
  return { selected, excluded, navigation, catalogue, assessment, reqs, evidenceMap };
}
export { areaOf, exists };

// The synthetic organisation a first sign-in receives (lib/saha/seed.ts), read at run time so the plan cannot drift from the code.
export async function loadSeed() {
  const js = ts.transpileModule(read('lib/saha/seed.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const seed = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const w = seed.seedWorkspace('2026-01-01T00:00:00.000Z');
  return { people: w.people.map(p => ({ name: p.name, age: p.age, sex: p.sex, village: p.village, programmes: p.programmes, task: p.task, assigned: p.assigned })), integrations: w.integrations.map(i => ({ name: i.name, kind: i.kind, mode: i.mode, status: i.status, behavior: i.behavior ?? '', description: i.description })) };
}
