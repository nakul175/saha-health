// Slice 10g contract: disputes that block sending, per-programme and per-destination sign-off rules, and sign-off
// withdrawal (BR-DATA-02). Runs the real visit-signoff.ts, send-gate.ts, mis-execution.ts and ehr-execution.ts with an
// injected store (whose commit hook raises a dispute or withdraws a sign-off between the checkpoint and the request) and
// injected transports, so "nothing is sent" is observed, not assumed.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const payloadDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.send-gate-contract-'));
let passed = 0;
const failures = [];
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { failures.push(`${name}: ${e?.message ?? e}`); } };
const refuses = async (fn, status, pattern) => { let err; try { await fn(); } catch (e) { err = e; } assert.ok(err, 'expected a refusal'); assert.equal(err.status, status, err.message); if (pattern) assert.match(err.message, pattern); return err; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'access-audit', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'service-dispatch','core', 'delegation', 'ehr', 'ehr-execution','ehr-probe', 'ehr-provider', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fact-verification', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'mis-execution', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'verification-disputes', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'trace', 'types', 'visit-signoff'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js'; export let saved;let hook=null;export function setup(s,h=null){saved=structuredClone(s);hook=h}export async function readState(){return structuredClone(saved)}export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}export async function persist(db,before,after,u,c){saved=structuredClone(after);saved.organisation.revision=(saved.organisation.revision??1)+1;if(hook)hook(saved,c);}`);
  writeFileSync(join(dir, 'access-audit.js'), 'export async function recordAccess(){}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const S = await imp('visit-signoff'), G = await imp('send-gate'), store = await imp('store'), { executeMis } = await imp('mis-execution'), { executeEhr } = await imp('ehr-execution'), { applyEhr } = await imp('ehr'), {mappedPayload}=await imp('mis');
  const now = '2026-10-02T06:00:00.000Z';
  const author = (userId, role) => ({ userId, name: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, at: now });
  const member = (userId, role, teamIds = ['default'], extra = {}) => ({ userId, displayName: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...extra });
  const actor = id => ({ userId: id, displayName: `Name ${id}`, email: `${id}@example.invalid` });
  const facts = { date: '2026-10-02T04:00', systolic: '130', diastolic: '85', weight: '60', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic notes.', source: 'measured' };
  const pack = { id: 'hypertension', version: 1, name: 'Hypertension follow-up', programme: 'Chronic care', questions: [{ id: 'medication_access', label: 'Reported access to prescribed medicines', options: ['Available', 'Access difficulty'], required: true }] };
  const capture = () => ({ packs: [{ enrolmentId: 'e1', pack: structuredClone(pack) }], answers: { medication_access: 'Available' }, absence: {} });
  const person = { id: 'p1', name: 'Synthetic Person', programmes: ['Chronic care', 'General care'], status: 'completed', exchangeConsent: true, consentVersion: 1, assigned: true, version: 1, teamId: 'default', assignedTo: 'asha-1' };
  const visit = (id, extra = {}) => ({ id, personId: 'p1', version: 4, state: 'confirmed', facts: structuredClone(facts), createdAt: now, aiResults: [], recordVersion: 3, programmeCapture: capture(), patientCheck: { personId: 'p1', personVersion: 1, by: 'asha-1', at: now }, noteAuthor: author('asha-1', 'asha'), answerAuthors: { medication_access: author('asha-1', 'asha') }, factAuthors: { weight: author('clin-1', 'clinician'), bloodPressure: author('asha-1', 'asha') }, ...extra });
  const demo = { id: 'mis_demo', name: 'Programme simulator', kind: 'mis', mode: 'demo', status: 'active', version: 1, programmes: ['Chronic care'] };
  const http = { id: 'mis_http', name: 'Programme MIS', kind: 'mis', mode: 'http', status: 'active', version: 1, programmes: ['Chronic care'], endpoint: 'https://programme.example/api', credentialBinding: 'SAHA_MIS_TEST', mis: { contract: 'saha-mis-v1', corrections: false, mapping: [{ source: 'weight', target: 'wt', required: false }] } };
  const ehrI = { id: 'ehr1', name: 'District EHR', kind: 'ehr', mode: 'http', status: 'active', version: 1, programmes: ['Chronic care'], endpoint: 'https://ehr.example/fhir', credentialBinding: 'SAHA_EHR_TEST', ehr: { read: true, write: true } };
  const ops = (extra = {}) => ({ version: 1, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, ...extra });
  const state = (visits, operations, integrations = [demo, http]) => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care', createdAt: now }, { id: 'north', name: 'North', createdAt: now }], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [structuredClone(person)], visits, integrations: structuredClone(integrations), submissions: [], referrals: [], audit: [], receipts: {} }, ...(operations ? { operations } : {}) });
  const fresh = (o, i) => state([visit('v1')], o, i);
  const owner = member('own-1', 'admin', [], { isOwner: true }), sup = member('sup-1', 'supervisor'), clin1 = member('clin-1', 'clinician'), clin2 = member('clin-2', 'clinician'), asha = member('asha-1', 'asha'), ashaOther = member('asha-9', 'asha');
  const run = (s, c, who, at = now) => S.applySignOff(s, c, actor(who.userId), who, at);

  // 1. Sign-off requirement: a destination rule wins, then the most protective programme rule, then the organisation default
  //    (which has only ever covered programme destinations).
  const withRules = (required, rules) => state([], ops({ signOffPolicy: { required, version: 1, changes: [], ...(rules ? { rules } : {}) } }));
  const need = (s, i, programmes = ['Chronic care', 'General care']) => G.signOffRequirement(s, i, { programmes });
  await check('requirement: default off and organisation default', () => {
    assert.equal(need(withRules(false), demo).required, false);
    assert.deepEqual(need(withRules(true), demo), { required: true, basis: 'organisation', programme: 'Chronic care' });
    assert.equal(need(withRules(true), ehrI).required, false, 'the organisation default never covered EHR publication');
    assert.equal(G.signOffRequirement(withRules(true), demo, undefined).required, false, 'no programmes known: nothing concerned');
  });
  await check('requirement: programme rules', () => {
    const on = withRules(false, { programmes: { 'Chronic care': 'required' }, destinations: {} });
    assert.deepEqual(need(on, demo), { required: true, basis: 'programme', programme: 'Chronic care' });
    assert.equal(need(on, demo, ['Child health']).required, false, 'a programme the patient is not in does not apply');
    assert.equal(need(on, { ...demo, programmes: ['Maternal care'] }, ['Chronic care']).required, true, 'destination serving none of them falls back to the patient programmes');
    const off = withRules(true, { programmes: { 'Chronic care': 'not-required' }, destinations: {} });
    assert.equal(need(off, demo, ['Chronic care']).required, false, 'a programme can be exempted from the organisation default');
    assert.equal(need(off, { ...demo, programmes: ['Chronic care', 'General care'] }, ['Chronic care', 'General care']).required, true, 'most protective applicable programme wins: General care inherits the default');
    assert.equal(need(off, demo, ['Chronic care', 'General care']).required, false, 'a programme the destination does not serve is not concerned');
    assert.equal(need(off, ehrI, ['Chronic care']).required, false);
    const ehrOn = withRules(false, { programmes: { 'Chronic care': 'required' }, destinations: {} });
    assert.equal(need(ehrOn, ehrI).required, true, 'a programme rule also covers EHR publication');
  });
  await check('requirement: destination rule wins both ways', () => {
    const a = withRules(true, { programmes: { 'Chronic care': 'required' }, destinations: { mis_demo: 'not-required', ehr1: 'required' } });
    assert.deepEqual(need(a, demo), { required: false, basis: 'destination' });
    assert.deepEqual(need(a, ehrI), { required: true, basis: 'destination' });
    assert.equal(need(a, http).required, true, 'other destinations follow programme and organisation rules');
    assert.equal(G.signOffRequirement(a, { ...demo, id: 'constructor' }, { programmes: [] }).required, false, 'rule keys are read as own properties only');
  });

  // 2. setSignOffRules: owner only, versioned (shared with the organisation default), audited, no-op refused.
  const rulesCmd = (over = {}) => ({ type: 'setSignOffRules', version: 0, programmes: { 'Chronic care': 'required' }, destinations: { ehr1: 'required' }, reason: 'Pilot wants chronic care signed off.', ...over });
  await check('setSignOffRules schema', () => {
    assert.equal(S.signOffSchema.safeParse(rulesCmd({ reason: 'short' })).success, false);
    assert.equal(S.signOffSchema.safeParse(rulesCmd({ extra: 1 })).success, false);
    assert.equal(S.signOffSchema.safeParse(rulesCmd({ programmes: { 'Chronic care': 'maybe' } })).success, false);
    assert.equal(S.signOffSchema.safeParse(rulesCmd()).success, true);
  });
  const ruled = state([visit('v1')], undefined, [demo, http, ehrI, { id: 'ai1', name: 'AI', kind: 'ai', mode: 'demo', status: 'active', version: 1, programmes: [] }]);
  await check('setSignOffRules refusals', async () => {
    for (const who of [clin1, sup, asha]) await refuses(() => run(ruled, rulesCmd(), who), 403, /owner/);
    await refuses(() => run(ruled, rulesCmd({ programmes: { 'Dental care': 'required' } }), owner), 422, /not a programme/);
    await refuses(() => run(ruled, rulesCmd({ destinations: { nope: 'required' } }), owner), 422, /programme and EHR destinations only/);
    await refuses(() => run(ruled, rulesCmd({ destinations: { ai1: 'required' } }), owner), 422, /programme and EHR destinations only/);
    await refuses(() => run(ruled, rulesCmd({ version: 3 }), owner), 409, /changed/);
    await refuses(() => run(ruled, rulesCmd({ programmes: {}, destinations: {} }), owner), 409, /Nothing changed/);
    await refuses(() => run(ruled, rulesCmd({ programmes: { 'Chronic care': 'inherit' }, destinations: { ehr1: 'inherit' } }), owner), 409, /Nothing changed/);
  });
  await check('setSignOffRules applies, keeps the default, shares the version', async () => {
    const r = await run(ruled, rulesCmd(), owner);
    assert.deepEqual(r, { version: 1, programmes: { 'Chronic care': 'required' }, destinations: { ehr1: 'required' } });
    const pol = G.signOffPolicy(ruled);
    assert.equal(pol.version, 1); assert.equal(pol.required, false); assert.equal(pol.changes.length, 1); assert.equal(pol.changes[0].kind, 'rules'); assert.deepEqual(pol.changes[0].rules.destinations, { ehr1: 'required' });
    const a = ruled.workspace.audit.at(-1); assert.equal(a.action, 'setSignOffRules'); assert.match(a.detail, /Programmes: Chronic care required\. Destinations: District EHR required\./); assert.match(a.detail, /Pilot wants chronic care signed off\./);
    await refuses(() => run(ruled, rulesCmd(), owner), 409, /changed/);
    // The organisation default is changed with the same version and keeps the rules; 'inherit' removes a rule.
    const d = await run(ruled, { type: 'setSignOffPolicy', required: true, version: 1, reason: 'Default on for every programme destination.' }, owner);
    assert.deepEqual(d, { required: true, version: 2 }); assert.deepEqual(G.signOffPolicy(ruled).rules.destinations, { ehr1: 'required' }); assert.equal(G.signOffPolicy(ruled).changes.at(-1).kind, 'default');
    await run(ruled, rulesCmd({ version: 2, programmes: { 'Chronic care': 'inherit' }, destinations: { ehr1: 'not-required' }, reason: 'EHR is signed off elsewhere.' }), owner);
    assert.deepEqual(G.signOffRules(ruled), { programmes: {}, destinations: { ehr1: 'not-required' } }); assert.equal(G.signOffPolicy(ruled).version, 3); assert.equal(G.signOffPolicy(ruled).changes.length, 3);
    await refuses(() => S.applySignOff(structuredClone(ruled), { ...rulesCmd({ version: 3 }), type: 'setSignOffRules' }, actor('clin-1'), clin1), 403, /owner/);
  });

  // 3. raiseDispute: any care-team member in normal scope; recorded content; refusals.
  const dispute = (over = {}) => ({ type: 'raiseDispute', visitId: 'v1', recordVersion: 3, target: 'fact:weight', reason: 'The weight was copied from another patient.', reference: 'Register page 14', ...over });
  await check('raiseDispute schema', () => {
    assert.equal(S.signOffSchema.safeParse(dispute({ reason: 'short' })).success, false);
    assert.equal(S.signOffSchema.safeParse(dispute({ reference: 'ab' })).success, false);
    for (const target of ['fact:height', 'answer:../x', 'fact:', 'weight', 'answer:']) assert.equal(S.signOffSchema.safeParse(dispute({ target })).success, false, target);
    for (const target of ['notes', 'fact:bloodPressure', 'answer:medication_access']) assert.equal(S.signOffSchema.safeParse(dispute({ target })).success, true, target);
    assert.equal(S.signOffSchema.safeParse(dispute({ extra: true })).success, false);
  });
  await check('raiseDispute refusals', async () => {
    await refuses(() => run(fresh(), dispute(), member('adm', 'admin', ['default'])), 403, /care-team member/);
    await refuses(() => run(fresh(), dispute(), member('pv', 'provider')), 403, /care-team member/);
    await refuses(() => run(fresh(), dispute(), member('clin-3', 'clinician', ['north'])), 403, /outside your care scope/);
    await refuses(() => run(fresh(), dispute(), ashaOther), 403, /outside your care scope/);
    const emergency = fresh(); emergency.workspace.people[0].exceptionalAccess = [{ userId: 'clin-3', until: '2099-01-01T00:00:00.000Z' }];
    await refuses(() => run(emergency, dispute(), member('clin-3', 'clinician', ['north'])), 403, /outside your care scope/);
    const d = fresh(); d.workspace.visits[0].state = 'draft';
    await refuses(() => run(d, dispute(), clin1), 409, /confirmed visit/);
    await refuses(() => run(fresh(), dispute({ recordVersion: 1 }), clin1), 409, /changed/);
    await refuses(() => run(fresh(), dispute({ target: 'fact:temperature' }), clin1), 422, /not recorded/);
    await refuses(() => run(fresh(), dispute({ target: 'answer:nothing' }), clin1), 422, /not recorded/);
    const sup2 = fresh(); sup2.workspace.visits[0].supersededBy = 'v2';
    await refuses(() => run(sup2, dispute(), clin1), 409, /corrected or marked as wrong-patient/);
  });
  const raised = fresh();
  await check('raiseDispute appends, audits and changes nothing else', async () => {
    const r = await run(raised, dispute(), asha);
    const v = raised.workspace.visits[0], d = v.disputes[0];
    assert.equal(r.disputeId, d.id); assert.equal(r.target, 'fact:weight');
    assert.deepEqual([d.by, d.role, d.target, d.reference, d.visitVersion, d.valueText], ['asha-1', 'asha', 'fact:weight', 'Register page 14', 4, '60']);
    assert.match(d.contentHash, /^[a-f0-9]{64}$/); assert.deepEqual(v.facts, facts); assert.equal(v.version, 4);
    const a = raised.workspace.audit.at(-1); assert.equal(a.action, 'raiseDispute'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /Weight disputed.*blocked until a clinician resolves.*Reference: Register page 14/);
    await refuses(() => run(raised, dispute({ reason: 'Another reason for the same weight.' }), clin1), 409, /already has an open dispute/);
    await run(raised, dispute({ target: 'answer:medication_access', reason: 'The family says medicines were not available.', reference: 'Home visit call' }), clin1);
    await run(raised, dispute({ target: 'notes', reason: 'Notes describe a different person.', reference: 'Clinic file' }), sup);
    assert.deepEqual(raised.workspace.visits[0].disputes.map(x => x.target), ['fact:weight', 'answer:medication_access', 'notes']);
    assert.equal(G.openDisputes(raised.workspace.visits[0]).length, 3);
  });

  // 4. resolveDispute: a clinician appends evidence; the dispute stays; independence rules; content binding.
  const resolve = (id, over = {}) => ({ type: 'resolveDispute', visitId: 'v1', recordVersion: 3, disputeId: id, outcome: 'stands', evidence: 'Checked the register page; the weight is right.', ...over });
  await check('resolveDispute refusals', async () => {
    const id = raised.workspace.visits[0].disputes[0].id;
    await refuses(() => run(raised, resolve(id), sup), 403, /clinician with current care scope/);
    await refuses(() => run(raised, resolve(id), asha), 403, /clinician with current care scope/);
    await refuses(() => run(raised, resolve(id), member('clin-3', 'clinician', ['north'])), 403, /outside your care scope/);
    await refuses(() => run(raised, resolve(id, { recordVersion: 1 }), clin2), 409, /changed/);
    await refuses(() => run(raised, resolve('missing'), clin2), 404, /Dispute not found/);
    assert.equal(S.signOffSchema.safeParse(resolve(id, { evidence: 'short' })).success, false);
    // The author of the weight (clin-1) cannot close it as standing; the raiser of another dispute cannot close that one.
    await refuses(() => run(raised, resolve(id), clin1), 403, /different clinician from the one who recorded/);
    const second = raised.workspace.visits[0].disputes[1].id;
    await refuses(() => run(raised, resolve(second), clin1), 403, /different clinician must close a dispute you raised/);
    // Unchanged content cannot be "corrected"; the visit is immutable until a correction draft exists.
    await refuses(() => run(raised, resolve(id, { outcome: 'corrected' }), clin2), 409, /has not changed/);
    assert.equal(G.openDisputes(raised.workspace.visits[0]).length, 3, 'refusals change nothing');
  });
  await check('resolveDispute standing: appended evidence, dispute kept', async () => {
    const v = raised.workspace.visits[0], id = v.disputes[0].id;
    const r = await run(raised, resolve(id, { reference: 'Register page 14, checked' }), clin2);
    assert.equal(r.outcome, 'stands'); assert.equal(v.disputes.length, 3, 'the dispute is never removed'); assert.equal(v.disputes[0].reason, 'The weight was copied from another patient.');
    assert.deepEqual([v.disputeResolutions[0].disputeId, v.disputeResolutions[0].by, v.disputeResolutions[0].outcome, v.disputeResolutions[0].reference], [id, 'clin-2', 'stands', 'Register page 14, checked']);
    assert.equal(G.resolutionOf(v, v.disputes[0]).evidence, 'Checked the register page; the weight is right.'); assert.equal(G.openDisputes(v).length, 2);
    const a = raised.workspace.audit.at(-1); assert.equal(a.action, 'resolveDispute'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /Weight resolved as standing as recorded.*the dispute and its reason are kept\. Evidence: Checked/);
    await refuses(() => run(raised, resolve(id), clin2), 409, /already resolved/);
    // Raising again after a resolution is allowed (a new, separate dispute).
    await run(raised, dispute({ reason: 'A second source disagrees with the register.', reference: 'Clinic card' }), asha);
    assert.equal(v.disputes.length, 4); assert.equal(G.openDisputes(v).length, 3);
  });
  await check('resolveDispute: content bound', async () => {
    // A correction draft carries an open dispute; its content changes; standing is then refused and corrected allowed.
    const before = fresh(); await run(before, dispute(), asha);
    const after = structuredClone(before); after.workspace.visits.push(visit('v2', { state: 'draft', amendsVisitId: 'v1', version: 1, recordVersion: 1, noteAuthor: undefined, answerAuthors: undefined, patientCheck: undefined })); after.workspace.visits[0].supersededBy = 'v2';
    S.carryDisputes(before, after, actor('clin-1'), clin1, now);
    const v2 = after.workspace.visits[1];
    assert.equal(v2.disputes.length, 1); assert.equal(v2.disputes[0].carriedFrom, before.workspace.visits[0].disputes[0].id); assert.notEqual(v2.disputes[0].id, before.workspace.visits[0].disputes[0].id); assert.equal(v2.disputes[0].contentHash, before.workspace.visits[0].disputes[0].contentHash);
    assert.equal(after.workspace.audit.at(-1).action, 'carryDisputes'); assert.match(after.workspace.audit.at(-1).detail, /1 open dispute carried.*Weight/);
    v2.state = 'confirmed'; v2.version = 2; v2.recordVersion = 1; v2.facts.weight = '56'; v2.factAuthors = { weight: author('clin-1', 'clinician') };
    assert.equal(G.openDisputes(after.workspace.visits[0]).length, 0, 'a dispute on a corrected visit no longer blocks it');
    const id = v2.disputes[0].id, cmd = over => ({ type: 'resolveDispute', visitId: 'v2', recordVersion: 1, disputeId: id, outcome: 'stands', evidence: 'The recorded weight stands after the check.', ...over });
    await refuses(() => run(after, cmd(), clin2), 409, /changed since the dispute was raised/);
    const r = await run(after, cmd({ outcome: 'corrected', evidence: 'Weight corrected to 56 from the register.' }), clin1);
    assert.equal(r.outcome, 'corrected'); assert.equal(G.openDisputes(v2).length, 0);
    // A resolved dispute is not carried forward; an unresolved one on another target is.
    const b2 = fresh(); await run(b2, dispute(), asha); await run(b2, dispute({ target: 'notes', reason: 'Notes look like another person.', reference: 'File' }), asha); await run(b2, resolve(b2.workspace.visits[0].disputes[0].id), clin2);
    const a2 = structuredClone(b2); a2.workspace.visits.push(visit('v3', { state: 'draft', amendsVisitId: 'v1', version: 1, recordVersion: 1 })); S.carryDisputes(b2, a2, actor('clin-1'), clin1, now);
    assert.deepEqual(a2.workspace.visits[1].disputes.map(x => x.target), ['notes']);
  });

  // 5. withdrawSignOff: any current supervisor of the team; reason; the sign-off is kept; sending is held until re-signed.
  const sign = over => ({ type: 'signOffVisit', visitId: 'v1', recordVersion: 3, ...over });
  const withdraw = over => ({ type: 'withdrawSignOff', visitId: 'v1', recordVersion: 3, reason: 'The supervisor found the weight inconsistent.', ...over });
  const signed = fresh(); const so1 = await run(signed, sign({ note: 'Reviewed.' }), sup);
  await check('withdrawSignOff refusals', async () => {
    assert.equal(S.signOffSchema.safeParse(withdraw({ reason: 'short' })).success, false);
    await refuses(() => run(signed, withdraw(), clin1), 403, /supervisor of the patient's team.*withdraw/);
    await refuses(() => run(signed, withdraw(), asha), 403, /withdraw a sign-off/);
    await refuses(() => run(signed, withdraw(), member('sup-2', 'supervisor', ['north'])), 403, /withdraw a sign-off/);
    await refuses(() => run(signed, withdraw({ recordVersion: 1 }), sup), 409, /changed/);
    await refuses(() => run(fresh(), withdraw(), sup), 409, /no current sign-off/);
    const draft = fresh(); draft.workspace.visits[0].state = 'draft'; await refuses(() => run(draft, withdraw(), sup), 409, /confirmed visit/);
  });
  await check('withdrawSignOff appends, keeps the sign-off, holds sending', async () => {
    const v = signed.workspace.visits[0];
    assert.equal((await G.currentSignOff(v))?.id, so1.signOffId);
    const w = await run(signed, withdraw(), member('sup-2', 'supervisor'));
    assert.equal(w.signOffId, so1.signOffId); assert.equal(v.signOffs.length, 1, 'the sign-off record stays'); assert.equal(v.signOffWithdrawals.length, 1);
    assert.deepEqual([v.signOffWithdrawals[0].by, v.signOffWithdrawals[0].signOffId, v.signOffWithdrawals[0].reason], ['sup-2', so1.signOffId, 'The supervisor found the weight inconsistent.']);
    assert.equal(await G.currentSignOff(v), null); assert.equal(G.withdrawalHold(v).id, v.signOffWithdrawals[0].id);
    const a = signed.workspace.audit.at(-1); assert.equal(a.action, 'withdrawSignOff'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /withdrawn before sending; the sign-off record is kept.*Anything already sent is not recalled/);
    await refuses(() => run(signed, withdraw(), sup), 409, /no current sign-off/);
    // The hold applies whatever the policy says, to every destination; a new sign-off lifts it.
    const plan = { id: 'plan1', state: 'approved', recipients: ['mis_demo'] }; v.plan = plan;
    await refuses(() => G.ensureCanSend(signed, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }), 409, /withdrew the supervisor sign-off.*must sign the visit off again.*not recalled/);
    const again = await run(signed, sign({ note: 'Checked again.' }), sup);
    assert.equal(v.signOffs.length, 2); assert.equal((await G.currentSignOff(v)).id, again.signOffId); assert.equal(G.withdrawalHold(v), null);
    assert.equal((await G.ensureCanSend(signed, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }))?.id, again.signOffId);
    // A sign-off made stale by a change is still stale after the withdrawal rules (not a hold: it was never withdrawn).
    const edited = structuredClone(signed); edited.workspace.visits[0].facts.notes = 'Edited.'; assert.equal(await G.currentSignOff(edited.workspace.visits[0]), null); assert.equal(G.withdrawalHold(edited.workspace.visits[0]), null);
  });

  // 6. Dispatcher check (ensureCanSend): prepare, approve and run stop on the disputes the destination would carry.
  const planned = (recipients, planState = 'proposed', o) => { const s = fresh(o, [demo, http, ehrI]); s.workspace.visits[0].plan = { id: 'plan1', state: planState, recipients }; return s; };
  await check('carries: what each destination would send', () => {
    assert.equal(G.carries(demo, 'answer:medication_access'), true); assert.equal(G.carries(demo, 'fact:temperature'), true);
    assert.equal(G.carries(http, 'fact:weight'), true); assert.equal(G.carries(http, 'fact:bloodPressure'), false, 'the mapping reads weight only');
    assert.equal(G.carries(http, 'notes'), false); assert.equal(G.carries(http, 'answer:medication_access'), true, 'answers have no mapping: every programme destination is stopped');
    assert.equal(G.carries({ ...http, mis: { mapping: [{ source: 'systolic' }, { source: 'notes' }] } }, 'fact:bloodPressure'), true); assert.equal(G.carries({ ...http, mis: { mapping: [{ source: 'systolic' }, { source: 'notes' }] } }, 'notes'), true);
    assert.equal(G.carries(ehrI, 'fact:bloodPressure'), true); assert.equal(G.carries(ehrI, 'notes'), true); assert.equal(G.carries(ehrI, 'answer:medication_access'), false, 'the FHIR document carries no programme answers');
    assert.equal(G.carries({ kind: 'abdm' }, 'fact:weight'), false);
  });
  await check('a member outside the patient\u2019s care scope is told only that sending is blocked', async () => {
    // The dispatcher check runs before a command\u2019s own authority check, so the dispute text must not reach someone who could not read it.
    const s = planned(['mis_demo']); await run(s, dispute(), asha);
    const generic = /^Sending is blocked for this visit\. Ask a member of the patient\u2019s care team for the reason\.$/;
    for (const who of [owner, member('clin-n', 'clinician', ['north']), ashaOther]) await refuses(() => G.ensureCanSend(s, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_demo'] }, who), 409, generic);
    await refuses(() => G.ensureCanSend(s, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }, owner), 409, generic);
    await refuses(() => G.ensureCanSend(s, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_demo'] }, clin1), 409, /Open dispute on Weight.*copied from another patient.*Register page 14/);
  });
  // Slice 13d (round-10 review L5): an assistant run stops on any open dispute of the confirmed visit.
  await check('prepareAgent and executeAgent stop on an open dispute; without one they pass', async () => {
    const clear = planned(['mis_demo']);
    for (const type of ['prepareAgent', 'executeAgent']) assert.equal(await G.ensureCanSend(clear, { type, visitId: 'v1' }), null, `${type} with no dispute`);
    const s = planned(['mis_demo']); await run(s, dispute({ target: 'notes', reason: 'The notes describe another patient.', reference: 'Visit sheet 3' }), asha);
    for (const type of ['prepareAgent', 'executeAgent']) await refuses(() => G.ensureCanSend(s, { type, visitId: 'v1' }, clin1), 409, /Open dispute on .*notes describe another patient.*An assistant run would read the disputed values/i);
    await refuses(() => G.ensureCanSend(s, { type: 'prepareAgent', visitId: 'v1' }, owner), 409, /^Sending is blocked for this visit\./);
  });
  await check('preparePlan, approvePlan and executePlan stop on a carried dispute with its reason', async () => {
    const s = planned(['mis_demo']); await run(s, dispute(), asha);
    for (const type of ['preparePlan', 'approvePlan', 'executePlan']) {
      const e = await refuses(() => G.ensureCanSend(s, { type, visitId: 'v1', planId: 'plan1', recipients: ['mis_demo'] }), 409, /Open dispute on Weight.*copied from another patient.*Register page 14.*raised by Name asha-1 on 2026-10-02/);
      assert.match(e.message, /Programme simulator would receive this item.*until a clinician resolves it.*already sent is not recalled/);
    }
    // A mapped destination that does not read the disputed fact is not stopped; one that does, is.
    const bp = planned(['mis_http']); await run(bp, dispute({ target: 'fact:bloodPressure', reason: 'Blood pressure was taken on the wrong arm.', reference: 'Observation sheet' }), clin2);
    assert.equal(await G.ensureCanSend(bp, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_http'] }), null);
    await refuses(() => G.ensureCanSend(bp, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_demo', 'mis_http'] }), 409, /Open dispute on Blood pressure.*Programme simulator would receive/);
    bp.workspace.integrations.find(i => i.id === 'mis_http').mis.mapping.push({ source: 'systolic', target: 'sys', required: false });
    await refuses(() => G.ensureCanSend(bp, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_http'] }), 409, /Open dispute on Blood pressure.*Programme MIS would receive/);
    // Unknown visits and other commands are left to their own handlers.
    assert.equal(await G.ensureCanSend(s, { type: 'preparePlan', visitId: 'nope', recipients: ['mis_demo'] }), null); assert.equal(await G.ensureCanSend(s, { type: 'saveVisit', visitId: 'v1' }), null);
    // Resolving the dispute lifts the block.
    await run(s, resolve(s.workspace.visits[0].disputes[0].id), clin2);
    assert.equal(await G.ensureCanSend(s, { type: 'preparePlan', visitId: 'v1', recipients: ['mis_demo', 'mis_http'] }), null);
  });
  await check('several disputes are all counted; EHR preparation stops; a completed plan is idempotent', async () => {
    const s = planned(['mis_demo']); await run(s, dispute(), asha); await run(s, dispute({ target: 'notes', reason: 'Notes describe another person.', reference: 'File' }), asha);
    await refuses(() => G.ensureCanSend(s, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }), 409, /and 1 more open dispute\./);
    s.workspace.people[0].ehr = { links: [{ id: 'l1', integrationId: 'ehr1', status: 'active' }], permissions: [], documents: [], operations: [] };
    await refuses(() => G.ensureCanSend(s, { type: 'prepareEhrPublish', visitId: 'v1', personId: 'p1', linkId: 'l1' }), 409, /Open dispute.*District EHR would receive these items/);
    s.workspace.visits[0].plan.state = 'completed'; assert.equal(await G.ensureCanSend(s, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }), null);
    // Disputes on a corrected or voided visit do not block it (the correction draft carries them).
    s.workspace.visits[0].plan.state = 'approved'; s.workspace.visits[0].supersededBy = 'v2'; assert.equal(await G.ensureCanSend(s, { type: 'executePlan', visitId: 'v1', planId: 'plan1' }), null);
  });
  await check('executePlan applies the rule of each destination', async () => {
    const policy = (required, rules) => ops({ signOffPolicy: { required, version: 1, changes: [], ...(rules ? { rules } : {}) } });
    const exec = { type: 'executePlan', visitId: 'v1', planId: 'plan1' };
    // Organisation default off, but one destination requires sign-off: the plan is refused and names it.
    const s = planned(['mis_demo', 'mis_http'], 'approved', policy(false, { programmes: {}, destinations: { mis_http: 'required' } }));
    const e = await refuses(() => G.ensureCanSend(s, exec), 409, /sign-off is required before sending/); assert.match(e.message, /required for Programme MIS by the sign-off rule for Programme MIS\./);
    // Only the exempt destination: passes without a sign-off even though the organisation default is on.
    const t = planned(['mis_demo'], 'approved', policy(true, { programmes: {}, destinations: { mis_demo: 'not-required' } })); assert.equal(await G.ensureCanSend(t, exec), null);
    // A programme rule is named as the basis.
    const u = planned(['mis_demo'], 'approved', policy(false, { programmes: { 'Chronic care': 'required' }, destinations: {} })); await refuses(() => G.ensureCanSend(u, exec), 409, /by the sign-off rule for Chronic care\./);
    // A current sign-off satisfies every destination and is returned for stamping.
    const done = await run(s, sign(), sup); assert.equal((await G.ensureCanSend(s, exec)).id, done.signOffId);
    // The organisation default applies to programme destinations only: EHR publication is not stopped by it.
    const v = planned(['mis_demo'], 'approved', policy(true)); const g = await G.sendBlock(v, v.workspace.visits[0], ehrI, 'plan'); assert.equal(g.block, null);
  });

  // 7. Inside the delivery checkpoint (executeMis): checked before it and again on a fresh read before the request.
  const env = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_MIS_TEST: 'test', SAHA_MIS_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: 'mis_http', origin: 'https://programme.example', credentialBinding: 'SAHA_MIS_TEST' }]) };
  const worker = member('asha-1', 'asha');
  const deliveryState = (o, withSign = false) => { const s = fresh(o, [http]); s.members = [worker, sup, clin1, clin2, owner]; if (withSign) { s.workspace.visits[0].signOffs = [{ id: 'so0', by: 'sup-1', byName: 'sup-1', accountCode: 'x', role: 'supervisor', at: now, visitVersion: 4, contentHash: '' }]; }
    const payload=mappedPayload(http,s.workspace.visits[0],s);
    s.workspace.submissions = [{ id: 'sub', visitId: 'v1', personId: 'p1', connectorId: 'mis_http', connectorName: 'Programme MIS', state: 'queued', attempts: 0, mode: 'http', payloadHash: payloadDigest(payload), createdAt: now, updatedAt: now, delivery: { endpoint: http.endpoint, credentialBinding: http.credentialBinding, key: 'sub', actorId: 'asha-1', connectorVersion: 1, personVersion: 1, consentVersion: 1, visitVersion: 4, expiresAt: new Date(Date.now() + 60000).toISOString(), payload, events: [] } }]; return s; };
  const signedDelivery = async (o) => { const s = deliveryState(o); const r = await run(s, sign(), sup); return { s, signOffId: r.signOffId }; };
  const receipt = { contract: 'saha-mis-v1', key: 'sub', status: 'accepted', receipt: 'PARTNER-1' };
  let calls = 0; const transport = async (_i,_org,_env,body) => { calls++; return {...receipt,payloadHash:body.payloadHash}; };
  const send = { type: 'sendSubmission', submissionId: 'sub' };
  const policy = (required, rules) => ops({ signOffPolicy: { required, version: 1, changes: [], ...(rules ? { rules } : {}) } });
  await check('MIS send refused before the checkpoint by an open dispute: stays queued, nothing sent', async () => {
    const s = deliveryState(); await run(s, dispute(), clin2); store.setup(s); calls = 0;
    await refuses(() => executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k1', 'h', env, transport), 409, /Open dispute on Weight.*Programme MIS would receive this item/);
    assert.equal(calls, 0); assert.equal(store.saved.workspace.submissions[0].state, 'queued'); assert.equal(store.saved.workspace.submissions[0].attempts, 0);
    // A dispute on something the mapping does not read does not stop it.
    const t = deliveryState(); await run(t, dispute({ target: 'notes', reason: 'Notes describe another person.', reference: 'File' }), clin2); store.setup(t); calls = 0;
    const r = await executeMis({}, structuredClone(t), send, actor('asha-1'), worker, 'k1b', 'h', env, transport); assert.equal(calls, 1); assert.equal(r.state, 'accepted');
  });
  await check('MIS send: a dispute raised inside the checkpoint stops the request and closes the delivery as not sent', async () => {
    const s = deliveryState(); let raisedNow = false;
    store.setup(s, (saved, c) => { if (c.type === 'sendSubmission' && !raisedNow) { raisedNow = true; const v = saved.workspace.visits[0]; v.disputes = [{ id: 'd-late', target: 'fact:weight', reason: 'Raised just after the checkpoint.', reference: 'Phone call', by: 'clin-2', byName: 'clin-2', accountCode: 'x', role: 'clinician', at: new Date().toISOString(), visitVersion: 4, contentHash: 'x', valueText: '60' }]; } }); calls = 0;
    const r = await executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k2', 'h', env, transport);
    const sub = store.saved.workspace.submissions[0];
    assert.equal(calls, 0, 'no request after the dispute'); assert.equal(r.refused, true); assert.equal(sub.state, 'cancelled'); assert.equal(sub.attempts, 0, 'reserved attempt released');
    assert.deepEqual([sub.block.kind, sub.block.stage, sub.block.disputeIds], ['dispute', 'checkpoint', ['d-late']]); assert.equal(sub.refusal, undefined, 'not an operation refusal');
    assert.deepEqual(sub.delivery.events.map(e => e.state), ['sending', 'cancelled']); assert.equal(sub.delivery.events[1].ref.command, 'sendBlocked'); assert.match(sub.delivery.events[1].detail, /^Not sent: Open dispute on Weight.*A dispute or sign-off change took effect after the checkpoint and before the request, so nothing was sent/);
    assert.equal(store.saved.workspace.audit.at(-1).action, 'sendBlocked'); assert.equal(sub.delivery.events[1].ref.auditId, store.saved.workspace.audit.at(-1).id);
    const again = await executeMis({}, await store.readState(), send, actor('asha-1'), worker, 'k2b', 'h', env, transport); assert.equal(again.state, 'cancelled'); assert.equal(calls, 0);
  });
  await check('MIS send: a sign-off withdrawn inside the checkpoint stops the request', async () => {
    const { s, signOffId } = await signedDelivery(policy(true)); let done = false; store.setup(s, (saved, c) => { if (c.type === 'sendSubmission' && !done) { done = true; (saved.workspace.visits[0].signOffWithdrawals ??= []).push({ id: 'w1', signOffId, by: 'sup-1', byName: 'sup-1', accountCode: 'x', role: 'supervisor', at: new Date().toISOString(), reason: 'Found a mismatch with the register.' }); } }); calls = 0;
    const r = await executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k3', 'h', env, transport); const sub = store.saved.workspace.submissions[0];
    assert.equal(calls, 0); assert.equal(r.refused, true); assert.equal(sub.state, 'cancelled'); assert.equal(sub.block.kind, 'sign-off'); assert.equal(sub.attempts, 0); assert.match(sub.message, /withdrew the supervisor sign-off.*must sign the visit off again/);
  });
  await check('MIS send: a withdrawn sign-off holds sending before the checkpoint even when the policy is off', async () => {
    const { s, signOffId } = await signedDelivery(); s.workspace.visits[0].signOffWithdrawals = [{ id: 'w1', signOffId, by: 'sup-1', byName: 'sup-1', accountCode: 'x', role: 'supervisor', at: now, reason: 'Found a mismatch with the register.' }]; store.setup(s); calls = 0;
    await refuses(() => executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k4', 'h', env, transport), 409, /withdrew the supervisor sign-off/); assert.equal(calls, 0); assert.equal(store.saved.workspace.submissions[0].state, 'queued');
  });
  await check('MIS send: the destination rule decides', async () => {
    const dest = (r) => policy(false, { programmes: {}, destinations: { mis_http: r } });
    // Required for this destination though the organisation default is off: missing sign-off refuses, a current one sends.
    let s = deliveryState(dest('required')); store.setup(s); calls = 0;
    await refuses(() => executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k5', 'h', env, transport), 409, /sign-off is missing or stale/); assert.equal(calls, 0);
    const { s: ok, signOffId } = await signedDelivery(dest('required')); store.setup(ok); const r = await executeMis({}, structuredClone(ok), send, actor('asha-1'), worker, 'k6', 'h', env, transport);
    assert.equal(calls, 1); assert.equal(r.state, 'accepted'); assert.equal(store.saved.workspace.submissions[0].signOff.id, signOffId);
    // Exempt for this destination though the organisation default is on: sends without a sign-off.
    s = deliveryState(policy(true, { programmes: {}, destinations: { mis_http: 'not-required' } })); store.setup(s); calls = 0;
    const r2 = await executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k7', 'h', env, transport); assert.equal(calls, 1); assert.equal(r2.state, 'accepted'); assert.equal(store.saved.workspace.submissions[0].signOff, undefined);
    // The organisation default alone still refuses (slice 2g behaviour).
    s = deliveryState(policy(true)); store.setup(s); calls = 0; await refuses(() => executeMis({}, structuredClone(s), send, actor('asha-1'), worker, 'k8', 'h', env, transport), 409, /sign-off is missing or stale/); assert.equal(calls, 0);
  });

  // 8. Inside the EHR checkpoint (executeEhr): before it, before the patient read, and again before the write.
  const eenv = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_EHR_TEST: 'test-secret', SAHA_EHR_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: 'ehr1', baseUrl: ehrI.endpoint, credentialBinding: ehrI.credentialBinding }]) };
  const owner2 = { ...member('clin-1', 'clinician'), isOwner: true };
  const prepared = async (o) => {
    const p = { id: 'p1', name: 'Test Person', sex: 'Other', age: 30, village: 'Test village', version: 1, consentVersion: 1, exchangeConsent: true, assigned: true, teamId: 'default', programmes: ['Chronic care', 'General care'] };
    const s = { organisation: { id: 'org', name: 'Test organisation', revision: 1 }, members: [owner2], workspace: { role: 'clinician', people: [p], visits: [visit('v1', { facts: { date: new Date().toISOString().slice(0, 16), source: 'reported', weight: '55', notes: 'Synthetic visit', systolic: '', diastolic: '', temperature: '', weeks: '', coughDays: '' }, programmeCapture: undefined, answerAuthors: undefined, factAuthors: undefined })], integrations: [structuredClone(ehrI)], submissions: [], audit: [] }, ...(o ? { operations: o } : {}) };
    await applyEhr(s, { type: 'linkEhr', personId: 'p1', version: 1, integrationId: 'ehr1', externalId: 'external-1', externalName: 'Test Person', reason: 'Check synthetic ID', confirmed: true }, actor('clin-1'), owner2, eenv);
    const linkId = p.ehr.links[0].id;
    await applyEhr(s, { type: 'grantEhrPermission', personId: 'p1', linkId, direction: 'write', purpose: 'care-coordination', from: '2026-01-01T00:00:00.000Z', to: new Date(Date.now() + 60000).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() }, actor('clin-1'), owner2, eenv);
    await applyEhr(s, { type: 'prepareEhrPublish', personId: 'p1', linkId, permissionId: p.ehr.permissions[0].id, visitId: 'v1' }, actor('clin-1'), owner2, eenv);
    return { s, op: p.ehr.operations[0] };
  };
  const remote = { resourceType: 'Patient', id: 'external-1', name: [{ text: 'Test Person' }] };
  const pubCmd = op => ({ type: 'executeEhrPublish', personId: 'p1', operationId: op.id, hash: op.hash });
  const lateDispute = { id: 'd-ehr', target: 'fact:weight', reason: 'Weight disputed after the publication was approved.', reference: 'Register', by: 'clin-2', byName: 'clin-2', accountCode: 'x', role: 'clinician', at: now, visitVersion: 4, contentHash: 'x', valueText: '55' };
  let writes = 0, reads = 0;
  await check('EHR publish refused before the checkpoint by an open dispute: stays prepared, nothing requested', async () => {
    const { s, op } = await prepared(); s.workspace.visits[0].disputes = [lateDispute]; store.setup(s); writes = 0; reads = 0;
    await refuses(() => executeEhr({}, structuredClone(s), pubCmd(op), actor('clin-1'), owner2, 'e1', 'h', eenv, async () => { reads++; return remote; }), 409, /Open dispute on Weight.*District EHR would receive this item/);
    assert.equal(reads, 0); assert.equal(store.saved.workspace.people[0].ehr.operations[0].state, 'prepared');
    // A dispute on a programme answer does not stop the EHR document (it carries no answers).
    const { s: t, op: o2 } = await prepared(); t.workspace.visits[0].disputes = [{ ...lateDispute, target: 'answer:medication_access' }]; store.setup(t); writes = 0;
    const r = await executeEhr({}, structuredClone(t), pubCmd(o2), actor('clin-1'), owner2, 'e1b', 'h', eenv, async (_i, _o, _e, path) => { if (path.startsWith('Patient/')) return remote; writes++; return { resourceType: 'Bundle', id: 'b1', identifier: o2.bundle.identifier, entry: o2.bundle.entry }; });
    assert.equal(writes, 1); assert.ok(['accepted', 'uncertain'].includes(r.state));
  });
  await check('EHR publish: a dispute raised between the checkpoint and the patient read sends nothing at all', async () => {
    const { s, op } = await prepared(); let done = false; store.setup(s, (saved, c) => { if (c.type === 'executeEhrPublish' && !done) { done = true; saved.workspace.visits[0].disputes = [lateDispute]; } }); writes = 0; reads = 0;
    const r = await executeEhr({}, structuredClone(s), pubCmd(op), actor('clin-1'), owner2, 'e2', 'h', eenv, async () => { reads++; return remote; });
    const saved = store.saved.workspace.people[0].ehr.operations[0];
    assert.equal(reads, 0, 'not even the patient read'); assert.equal(r.state, 'blocked'); assert.equal(saved.state, 'blocked'); assert.deepEqual([saved.block.kind, saved.block.stage, saved.block.disputeIds], ['dispute', 'checkpoint', ['d-ehr']]); assert.equal(saved.refusal, undefined);
    assert.match(saved.message, /^Not sent: Open dispute on Weight.*Nothing was sent to the EHR; this publication is closed/); assert.deepEqual(saved.events.map(e => e.state), ['running', 'blocked']); assert.equal(saved.events[1].ref.command, 'sendBlocked'); assert.equal(store.saved.workspace.audit.at(-1).action, 'sendBlocked');
  });
  await check('EHR publish: a dispute raised after the patient read stops the write', async () => {
    const { s, op } = await prepared(); store.setup(s); writes = 0;
    const transport = async (_i, _o, _e, path) => { if (path.startsWith('Patient/')) { store.saved.workspace.visits[0].disputes = [lateDispute]; return remote; } writes++; return {}; };
    const r = await executeEhr({}, structuredClone(s), pubCmd(op), actor('clin-1'), owner2, 'e3', 'h', eenv, transport); const saved = store.saved.workspace.people[0].ehr.operations[0];
    assert.equal(writes, 0, 'no document write'); assert.equal(r.state, 'blocked'); assert.equal(saved.block.kind, 'dispute');
  });
  await check('EHR publish: a destination rule requires sign-off, which is recorded on the publication', async () => {
    const o = policy(false, { programmes: {}, destinations: { ehr1: 'required' } });
    const { s, op } = await prepared(o); store.setup(s); writes = 0; reads = 0;
    await refuses(() => executeEhr({}, structuredClone(s), pubCmd(op), actor('clin-1'), owner2, 'e4', 'h', eenv, async () => { reads++; return remote; }), 409, /sign-off is required before sending.*by the sign-off rule for District EHR/); assert.equal(reads, 0);
    // Signed off by a supervisor who did not record the visit: the publication proceeds and records it.
    const { s: t, op: o2 } = await prepared(o); t.members.push(sup); const so = await run(t, sign({ recordVersion: 3 }), sup); store.setup(t);
    await executeEhr({}, structuredClone(t), pubCmd(o2), actor('clin-1'), owner2, 'e5', 'h', eenv, async (_i, _o, _e, path) => { if (path.startsWith('Patient/')) return remote; writes++; return {}; });
    const saved = store.saved.workspace.people[0].ehr.operations[0]; assert.equal(saved.signOff.id, so.signOffId); assert.equal(saved.signOff.by, 'sup-1');
  });


  const V=await imp('verification-disputes'),F=await imp('fact-verification');
  const legacy=()=>{const s=fresh();s.workspace.visits[0].factAuthors.weight=author('asha-1','asha');s.workspace.visits[0].factReviews=[{id:'old-review',measure:'weight',state:'disputed',by:'clin-1',byName:'Original clinician',at:now,reason:'Retained older disputed review'}];return s;};
  await check('legacy disputed review is conservatively unbound and destination-specific',async()=>{const s=legacy(),v=s.workspace.visits[0],d=G.openDisputes(v)[0];assert.equal(d.contentHash,'');assert.equal(d.verification.binding,'legacy-unbound');assert.ok(G.disputeBlock(v,demo));assert.ok(G.disputeBlock(v,http));assert.ok(G.disputeBlock(v,ehrI));assert.equal(G.disputeBlock(v,{...http,mis:{...http.mis,mapping:[{source:'temperature',target:'temp'}]}}),null);});
  await check('a later verified click materializes the old unbound hold without inventing a hash',async()=>{const s=legacy(),v=s.workspace.visits[0];await F.applyFactReview(s,{type:'verifyFact',visitId:v.id,recordVersion:v.recordVersion,measure:'weight',decision:'verified'},actor('clin-2'),clin2,now);assert.equal(v.factReviews.length,2);assert.equal(G.openDisputes(v).length,1);assert.equal(v.disputes[0].contentHash,'');});
  await check('legacy standing resolution is an independent current-content attestation',async()=>{const s=legacy(),v=s.workspace.visits[0],d=G.openDisputes(v)[0];const c={type:'resolveDispute',visitId:v.id,recordVersion:v.recordVersion,disputeId:d.id,outcome:'stands',evidence:'Explicit current-content clinical attestation'};await refuses(()=>run(s,c,clin1),403,/different clinician/);const out=await run(s,c,clin2);assert.equal(out.disputeId,d.id);assert.equal(G.openDisputes(v).length,0);assert.equal(v.disputeResolutions[0].currentContentHash,await G.targetHash(v,d.target));assert.equal(v.factReviews[0].state,'disputed');});
  await check('legacy corrected cannot invent a prior value comparison',async()=>{const s=legacy(),v=s.workspace.visits[0],d=G.openDisputes(v)[0];await refuses(()=>run(s,{type:'resolveDispute',visitId:v.id,recordVersion:v.recordVersion,disputeId:d.id,outcome:'corrected',evidence:'Synthetic correction with no original binding'},clin2),409,/not bound/);assert.equal(v.disputeResolutions,undefined);});
  await check('amendment retains legacy hold and labels new carry-time content comparison',async()=>{const before=legacy(),after=structuredClone(before),base=after.workspace.visits[0];base.supersededBy='correction';const v=visit('correction',{state:'draft',amendsVisitId:base.id,facts:{...base.facts,weight:'61'}});after.workspace.visits.push(v);S.carryDisputes(before,after,actor('asha-1'),asha,now);assert.equal(v.disputes.length,1);assert.equal(v.disputes[0].contentHash,'');assert.equal(v.disputes[0].verification.carryContent,JSON.stringify(G.targetContent(base,'fact:weight')));v.state='confirmed';v.factAuthors.weight=author('asha-1','asha');await run(after,{type:'resolveDispute',visitId:v.id,recordVersion:v.recordVersion,disputeId:v.disputes[0].id,outcome:'corrected',evidence:'Independent explicit amended weight evidence'},clin2);assert.equal(G.openDisputes(v).length,0);assert.equal(before.workspace.visits[0].factReviews[0].state,'disputed');});
  await check('unchanged legacy correction cannot be resolved as corrected',async()=>{const before=legacy(),after=structuredClone(before),base=after.workspace.visits[0],v=visit('correction',{amendsVisitId:base.id,facts:structuredClone(base.facts)});base.supersededBy=v.id;after.workspace.visits.push(v);S.carryDisputes(before,after,actor('asha-1'),asha,now);await refuses(()=>run(after,{type:'resolveDispute',visitId:v.id,recordVersion:v.recordVersion,disputeId:v.disputes[0].id,outcome:'corrected',evidence:'No actual current content changed here'},clin2),409,/has not changed/);});
  await check('removed target retains unresolved review lineage through correction',async()=>{const before=legacy(),after=structuredClone(before),base=after.workspace.visits[0],v=visit('correction',{amendsVisitId:base.id,facts:{...base.facts,weight:''}});base.supersededBy=v.id;after.workspace.visits.push(v);S.carryDisputes(before,after,actor('asha-1'),asha,now);assert.equal(v.disputes.length,1);assert.ok(G.disputeBlock(v,http));});
  await check('void keeps historical review hold and never permits a new live send',async()=>{const s=legacy(),v=s.workspace.visits[0];v.voidedAt=now;assert.equal(V.unresolvedDisputes(v).length,1);assert.equal(G.openDisputes(v).length,0);assert.equal(v.factReviews[0].state,'disputed');});
  await check('new fact dispute hash is bound to value AND provenance with append-only origin',async()=>{const s=fresh(),v=s.workspace.visits[0];await F.applyFactReview(s,{type:'verifyFact',visitId:v.id,recordVersion:v.recordVersion,measure:'weight',decision:'disputed',reason:'Independent exact provenance conflict'},actor('clin-2'),clin2,now);const d=v.disputes[0];assert.equal(d.contentHash,await G.targetHash(v,d.target));assert.equal(d.verification.reviewId,v.factReviews[0].id);v.facts.provenance={weight:{source:'reported',at:now}};assert.notEqual(d.contentHash,await G.targetHash(v,d.target));});


  await check('review-derived hold blocks prepare approve execute for carrying destination',async()=>{const s=planned(['mis_demo']);await F.applyFactReview(s,{type:'verifyFact',visitId:'v1',recordVersion:3,measure:'weight',decision:'disputed',reason:'Exact independent review-derived sending hold'},actor('clin-2'),clin2,now);for(const type of ['preparePlan','approvePlan','executePlan'])await refuses(()=>G.ensureCanSend(s,{type,visitId:'v1',planId:'plan1',recipients:['mis_demo']}),409,/Open dispute/);});
  await check('new exact-bound review arriving after MIS checkpoint prevents any transport',async()=>{const s=deliveryState(),reviewed=structuredClone(s);await F.applyFactReview(reviewed,{type:'verifyFact',visitId:'v1',recordVersion:3,measure:'weight',decision:'disputed',reason:'Actual review created before checkpoint interleaving'},actor('clin-2'),clin2,now);let changed=false;store.setup(s,(saved,c)=>{if(c.type==='sendSubmission'&&!changed){changed=true;saved.workspace.visits[0].disputes=structuredClone(reviewed.workspace.visits[0].disputes);saved.workspace.visits[0].factReviews=structuredClone(reviewed.workspace.visits[0].factReviews);}});calls=0;await executeMis({},structuredClone(s),send,actor('asha-1'),worker,'verification-mis-checkpoint','h',env,transport);assert.equal(calls,0);assert.equal(store.saved.workspace.submissions[0].block.kind,'dispute');assert.equal(store.saved.workspace.submissions[0].block.stage,'checkpoint');});
  await check('new note review after EHR checkpoint blocks even initial patient GET',async()=>{const {s,op}=await prepared(),reviewed=structuredClone(s);await run(reviewed,{type:'verifyEntry',visitId:'v1',recordVersion:3,entry:'notes',decision:'disputed',reason:'Actual independent note review checkpoint hold'},clin2);let changed=false;store.setup(s,(saved,c)=>{if(c.type==='executeEhrPublish'&&!changed){changed=true;saved.workspace.visits[0].disputes=structuredClone(reviewed.workspace.visits[0].disputes);saved.workspace.visits[0].entryReviews=structuredClone(reviewed.workspace.visits[0].entryReviews);}});writes=0;reads=0;const result=await executeEhr({},structuredClone(s),pubCmd(op),actor('clin-1'),owner2,'verification-ehr-checkpoint','h',eenv,async()=>{reads++;return remote;});assert.equal(reads,0);assert.equal(writes,0);assert.equal(result.state,'blocked');assert.equal(store.saved.workspace.people[0].ehr.operations[0].block.kind,'dispute');});
  assert.deepEqual(failures, [], failures.join('\n'));
  const result = { passed, suite: 'slice 10g: disputes block sending, per-programme and per-destination sign-off rules, sign-off withdrawal, and checks inside the MIS and EHR checkpoints', completedAt: new Date().toISOString() };
  writeFileSync('tests/evidence/verification-send-independent/repeat/contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(result);
} finally { rmSync(dir, { recursive: true, force: true }); }
