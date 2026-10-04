// Slice 6ab eighth-review-fixes contract: regressions for defects an eighth independent review found in round-4 slices
// 6z, 7e, 2i and 7d (reproduction /tmp/claude-0/review8/selfconfirm.mjs, 2 October 2026 UTC) and for the round-5
// integration limit (aggregate report screening without the slice 6aa population check). Each numbered block fails on
// the code before 6ab; run it from an export of the base tree with REPORT_ALL=1 to list every failing check.
//  1. confirmUnusualValue refuses the value's recorder and the author of any override with the same value.
//  2. An ABHA held by an out-of-scope record is refused before the one-time code is looked at; the server deduplicates
//     and limits the steward review events (source), and the access action text names the holding record only.
//  3. A correction of an accepted visit to a demonstration destination is an update, so withdrawing update stops it.
//  4. ABDM consent requests are governed by lookup; a revocation always applies and says whether the gateway was told;
//     an EHR publication rechecks create before its Patient/<id> read (source order).
//  6. The assistant summary input carries no "[object Object]" (entered, unusual and provenance objects are left out).
//  7. Aggregate reports use the population check, and a ledger write D1 refuses closes the report as not sent.
// (Finding 5, the 7d soak oracle, is fixed in tests/replay-soak-contract.mjs itself.)
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.eighth-review-fixes-contract-'));
let passed = 0;
const failed = [];
const fail = (name, e) => { if (process.env.REPORT_ALL) { failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); return; } e.message = `${name}: ${e.message}`; throw e; };
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { fail(name, e); } };
const thrown = async fn => { try { await fn(); } catch (e) { return e; } return null; };
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts'))) {
    const out = ts.transpileModule(readFileSync('lib/saha/' + f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, (['indicator-ledger.ts', 'access-audit.ts'].includes(f) ? f.replace(/\.ts$/, '-real') : f.replace(/\.ts$/, '')) + '.js'), out);
  }
  // Injectable persistence, access audit and differencing ledger for the aggregate path (as tests/aggregate-delivery-contract.mjs).
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';export let saved;export function setup(s){saved=structuredClone(s)}export async function readState(){return structuredClone(saved)}export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m)throw new AppError(403,'Member revoked');return m}export async function persist(db,before,after){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;}`);
  writeFileSync(join(dir, 'access-audit.js'), `export {ACCESS_ACTIONS,ACCESS_ACTION_NAMES,ACCESS_REFUSED,accessRoute} from './access-audit-real.js';export async function recordAccess(){}export async function recordAccesses(){return []}`);
  writeFileSync(join(dir, 'indicator-ledger.js'), `export {candidateReleases,ledgerHash} from './indicator-ledger-real.js';export let ledger=[];export let refuseWrite=false;export function setRefuseWrite(v){refuseWrite=v}export async function readLedger(){return {ledger:structuredClone(ledger),text:JSON.stringify(ledger)}}export async function writeLedger(db,org,prev,next){if(refuseWrite)throw new Error('D1_ERROR: string or blob too big');if(prev!==JSON.stringify(ledger))return false;ledger=structuredClone(next);return true}`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const now = new Date().toISOString();

  // 1. Unusual value confirmation by the value's recorder.
  {
    const core = await load('core'), FV = await load('fact-verification');
    const facts = (w, reason, entered) => ({ date: now.slice(0, 16), systolic: '', diastolic: '', weight: w, temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured', ...(reason ? { unusual: { weight: reason } } : {}), ...(entered ? { entered: { weight: entered } } : {}) });
    const A = { userId: 'clinA', displayName: 'Clinician A' }, X = { userId: 'ashaX', displayName: 'ASHA X' }, B = { userId: 'clinB', displayName: 'Clinician B' };
    const m = (userId, role) => ({ userId, role, accountCode: userId.toUpperCase(), isOwner: false, status: 'active', teamIds: ['t'] });
    const mA = m('clinA', 'clinician'), mX = m('ashaX', 'asha'), mB = m('clinB', 'clinician');
    const mk = () => ({ organisation: { id: 'o', revision: 1 }, members: [mA, mX, mB], workspace: { role: 'clinician', people: [{ id: 'p1', name: 'P', assigned: true, teamId: 't', assignedTo: null, version: 1, consentVersion: 1, programmes: ['General care'] }], visits: [{ id: 'v1', personId: 'p1', version: 1, state: 'draft', facts: facts('', null), createdAt: now, aiResults: [], recordVersion: 1 }], integrations: [], submissions: [], audit: [] } });
    const save = (s, actor, mem, f) => { const before = structuredClone(s), v = s.workspace.visits[0]; v.facts = core.checkFacts(f); v.version++; FV.recordFactAuthors(before, s, actor, mem, now); };
    const confirm = (s, actor, mem) => thrown(() => { const v = s.workspace.visits[0]; FV.applyFactReview(s, { type: 'confirmUnusualValue', visitId: 'v1', version: v.version, field: 'weight', overrideId: v.valueOverrides.at(-1).id }, actor, mem, now); });
    const reworded = () => { const s = mk(); save(s, A, mA, facts('320', 'Scale checked twice, value real')); save(s, X, mX, facts('320', 'Scale checked twice, value is real')); return s; };
    await check('1 setup: rewording credits the new override to X while A stays the weight author', () => { const v = reworded().workspace.visits[0]; assert.equal(v.factAuthors.weight.userId, 'clinA'); assert.equal(v.valueOverrides.at(-1).by.userId, 'ashaX'); });
    await check('1 the recorder cannot confirm after another worker rewords the reason', async () => assert.equal((await confirm(reworded(), A, mA))?.status, 403));
    await check('1 the author of an earlier override with the same value cannot confirm after a unit re-entry', async () => {
      const s = mk(); save(s, A, mA, facts('320', 'Scale checked twice, value real')); save(s, X, mX, facts('', 'Scale checked twice, value real', { value: '705.48', unit: 'lb' }));
      const v = s.workspace.visits[0]; assert.equal(v.facts.weight, '320'); assert.equal(v.valueOverrides.at(-1).by.userId, 'ashaX');
      assert.equal((await confirm(s, A, mA))?.status, 403);
    });
    await check('1 control: a clinician who recorded nothing can confirm', async () => assert.equal(await confirm(reworded(), B, mB), null));
  }

  // 2. ABHA duplicate outside the requester's scope: decided before the one-time code.
  {
    const Bm = await load('abdm'), AC = await load('access'), AA = await load('access-audit-real');
    const member = x => ({ accountCode: 'X', status: 'active', teamIds: ['t1'], isOwner: false, version: 1, ...x });
    const own = member({ userId: 'own', role: 'clinician', isOwner: true }), asha = member({ userId: 'asha', role: 'asha' });
    const P_ = (id, x) => ({ id, name: 'Synthetic ' + id, age: 40, sex: 'Female', village: 'V', programmes: ['General care'], version: 1, teamId: 't1', status: 'due', due: 'Today', assignedTo: null, createdAt: now, ...x });
    const held = { state: 'linked', number: '91-1234-5678-9012', at: now, by: 'x', history: [] };
    const mk = (mine = {}) => { const s = { organisation: { id: 'o' }, members: [own, asha], teams: [{ id: 't1' }], workspace: { people: [P_('mine', { assignedTo: 'asha', ...mine }), P_('theirs', { assignedTo: 'other', abha: held })], visits: [], referrals: [], submissions: [], integrations: [], audit: [] } };
      Bm.applyAbdm(s, { type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip: false, hiu: true }, facilityId: 'FAC-SYNTH', approvals: [{ module: 'abha', reference: 'APPROVAL-SYNTH' }, { module: 'hiu', reference: 'APPROVAL-SYNTH-2' }], reason: 'Synthetic mock gateway configuration' }, { userId: 'own', displayName: 'Owner' }, own, now);
      for (const p of s.workspace.people) p.assigned = AC.allowed(asha, p); return s; };
    const link = { type: 'abhaLink', personId: 'mine', version: 1, abhaNumber: held.number, otp: '000000' };
    await check('2 an out-of-scope duplicate is recognised before the one-time code is checked', async () => { const e = await thrown(() => Bm.applyAbdm(mk(), link, { userId: 'asha', displayName: 'ASHA' }, asha, now)); assert.ok(e instanceof Bm.AbhaHeldElsewhere, String(e?.message)); assert.equal(e.message, Bm.LINK_REFUSED); });
    await check('2 an already linked record is refused the same way whether or not the number is held elsewhere', async () => {
      const mine = { abha: { state: 'linked', number: '91-0000-0000-0001', at: now, by: 'x', history: [] } };
      const a = await thrown(() => Bm.applyAbdm(mk(mine), { ...link, otp: Bm.MOCK_OTP }, { userId: 'asha', displayName: 'ASHA' }, asha, now));
      const b = await thrown(() => Bm.applyAbdm(mk(mine), { ...link, abhaNumber: '91-2222-3333-4444', otp: Bm.MOCK_OTP }, { userId: 'asha', displayName: 'ASHA' }, asha, now));
      assert.equal(a.status, 409); assert.equal(a.message, b.message); assert.ok(!(a instanceof Bm.AbhaHeldElsewhere));
    });
    await check('2 the access action text names the holding record only', () => { assert.doesNotMatch(readFileSync('lib/saha/access-audit.ts', 'utf8'), /recorded on\s*\n?\s*\/\/\s*both records/); assert.match(AA.ACCESS_ACTIONS.abhaLinkReview, /holding record only/); });
    await check('2 source: one review event per requester and holding record a day, and a daily limit on refused links', () => {
      const src = readFileSync('lib/saha/server.ts', 'utf8'); assert.equal(Bm.ABHA_REVIEW_LIMIT, 3);
      // Slice 14a: the throttle reserves a limit_slots row before the lookup (one per requester and holding record a day, three a
      // day, an event exactly a day old still counting as before); the review is recorded only for a newly counted holder.
      assert.match(src, /const ABHA_REVIEW_SLOTS=\{kind:'abhaReview',limit:ABHA_REVIEW_LIMIT,inclusive:true\}/); assert.match(src, /review=await slot\.use\(e\.heldBy\);\}catch\{[^}]*\}\s*if\(review\)try\{await recordAccesses/); assert.match(src, /withLimitSlot\(db\(\),\{orgId:state\.organisation\.id,actorId:u\.userId,\.\.\.ABHA_REVIEW_SLOTS\}/);
    });

    // 4a. Consent request governed by lookup; revocation always applies.
    const withLookup = (allowed) => { const s = mk({ abha: { state: 'linked', number: '91-5555-6666-7777', at: now, by: 'x', history: [] } }); const i = s.workspace.integrations.find(x => x.kind === 'abdm'); i.operations = { version: 1, allowed, aggregateOnly: false, setBy: 'own', setAt: now, reason: 'Synthetic setting', history: [] }; return s; };
    const clin = member({ userId: 'clin', role: 'clinician' });
    const request = { type: 'abdmConsentRequest', personId: 'mine', version: 1, purpose: 'CAREMGT', hiTypes: ['Prescription'], from: '2026-01-01', to: '2026-09-30', expiresAt: new Date(Date.now() + 86400000).toISOString() };
    const asClin = s => { s.members.push(clin); for (const p of s.workspace.people) p.assigned = AC.allowed(clin, p); return s; };
    await check('4 a consent request is refused when the gateway may not look up records', async () => { const e = await thrown(() => Bm.applyAbdm(asClin(withLookup(['create', 'delete'])), request, { userId: 'clin', displayName: 'Clinician' }, clin, now)); assert.equal(e?.status, 409); assert.match(e.message, /not permitted to look up/); });
    await check('4 control: with lookup allowed the consent request is recorded', async () => { const s = asClin(withLookup(['create', 'delete', 'lookup'])); Bm.applyAbdm(s, request, { userId: 'clin', displayName: 'Clinician' }, clin, now); assert.equal(s.workspace.people[0].abdmConsents.length, 1); });
    await check('4 a revocation always applies and records that the gateway was not told when delete is withdrawn', async () => {
      const s = asClin(withLookup(['create', 'delete', 'lookup'])); Bm.applyAbdm(s, request, { userId: 'clin', displayName: 'Clinician' }, clin, now);
      s.workspace.integrations.find(x => x.kind === 'abdm').operations.allowed = ['create', 'lookup'];
      const p = s.workspace.people[0], r = Bm.applyAbdm(s, { type: 'abdmConsentRevoke', personId: 'mine', consentId: p.abdmConsents[0].id, reason: 'Patient withdrew permission' }, { userId: 'clin', displayName: 'Clinician' }, clin, now);
      assert.equal(p.abdmConsents[0].status, 'REVOKED'); assert.equal(r.gatewayNotified, false); assert.match(s.workspace.audit.at(-1).detail, /mock gateway was not told/);
    });
  }

  // 4b. EHR: create is rechecked before the Patient/<id> read of a publication.
  await check('4 source: the publication rechecks create on a fresh read before reading Patient/<id>', () => {
    const src = readFileSync('lib/saha/ehr-execution.ts', 'utf8'), branch = src.slice(src.indexOf("outcome:'not-stored',matches:0"));
    const recheck = branch.indexOf("operationRefusal(li,'create','patient')"), read = branch.indexOf("'Patient/'+link.externalId");
    assert.ok(recheck > 0 && read > 0 && recheck < read, 'create recheck must come before the patient read');
  });

  // 3. Demonstration destination: correction of an accepted visit is an update.
  {
    const core = await load('core');
    const mk = () => ({ role: 'clinician', people: [{ id: 'p1', name: 'P', assigned: true, version: 1, consentVersion: 1, exchangeConsent: true, programmes: ['General care'] }],
      visits: [{ id: 'v1', personId: 'p1', version: 1, state: 'confirmed', facts: { weight: '50' }, supersededBy: 'v2' }, { id: 'v2', personId: 'p1', version: 1, state: 'confirmed', facts: { weight: '51' }, amendsVisitId: 'v1' }, { id: 'v3', personId: 'p1', version: 1, state: 'confirmed', facts: { weight: '52' } }],
      integrations: [{ id: 'demo', kind: 'mis', mode: 'demo', name: 'Demo programme', status: 'active', version: 1, programmes: ['General care'], operations: { version: 1, allowed: ['create', 'lookup'], aggregateOnly: false, setBy: 'own', setAt: now, reason: 'Update withdrawn', history: [] } }],
      submissions: [{ id: 's1', visitId: 'v1', personId: 'p1', connectorId: 'demo', state: 'accepted', mode: 'demo' }], audit: [] });
    const ext = { call: () => { throw new Error('no external call'); } };
    await check('3 a correction of an accepted demo submission is refused when update is withdrawn', async () => { const e = await thrown(() => core.apply(mk(), { type: 'preparePlan', visitId: 'v2', recipients: ['demo'] }, 'u', ext, now)); assert.equal(e?.status, 409); assert.match(e.message, /not permitted to update/); });
    await check('3 control: a new visit to the same destination is a create and may be prepared', async () => { const w = mk(); await core.apply(w, { type: 'preparePlan', visitId: 'v3', recipients: ['demo'] }, 'u', ext, now); assert.ok(w.visits[2].plan); });
    await check('3 the classification follows the correction chain to the accepted ancestor', () => { const w = mk(); w.visits.push({ id: 'v4', personId: 'p1', version: 1, state: 'confirmed', facts: {}, amendsVisitId: 'v2' }); assert.equal(core.visitOperation(w, w.visits[3], 'demo', undefined), 'update'); assert.equal(core.visitOperation(w, w.visits[2], 'demo', undefined), 'create'); });
  }

  // 6. Assistant summary input.
  {
    const AG = await load('agent');
    const m = { userId: 'c', role: 'clinician', accountCode: 'C', isOwner: false, status: 'active', teamIds: ['t'] };
    const s = { organisation: { id: 'o', revision: 1 }, members: [m], teams: [{ id: 't' }], workspace: { role: 'clinician', people: [{ id: 'p1', name: 'Synthetic Person', village: 'Somewhere', assigned: true, teamId: 't', version: 1, consentVersion: 1, aiConsent: true, programmes: ['General care'] }],
      visits: [{ id: 'v1', personId: 'p1', version: 2, state: 'confirmed', recordVersion: 1, createdAt: now, aiResults: [], facts: { date: now.slice(0, 16), systolic: '', diastolic: '', weight: '320', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit', source: 'measured', entered: { weight: { value: '705.48', unit: 'lb' } }, unusual: { weight: 'Scale checked twice' }, provenance: { weight: { source: 'measured', at: now.slice(0, 16) } } } }], integrations: [], submissions: [], audit: [] } };
    await check('6 the summary input has no [object Object] entries', async () => {
      await AG.agentApply(s, { type: 'prepareAgent', visitId: 'v1', version: 2, providerId: 'local', task: 'summary', input: '' }, { userId: 'c', displayName: 'C' }, m, AG.providers([], {}));
      const input = s.workspace.visits[0].agentRuns.at(-1).input; assert.match(input, /weight: 320/); assert.doesNotMatch(input, /\[object Object\]/);
    });
  }

  // 7. Aggregate reports: population check and a refused ledger write.
  {
    const D = await load('aggregate-delivery'), store = await load('store'), L = await load('indicator-ledger'), { executeAggregate, LEDGER_WRITE_REFUSED } = await load('aggregate-execution');
    const old = '2026-01-01T08:00:00.000Z', recent = new Date(Date.now() - 2 * 86400000).toISOString(), today = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
    const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: 'Synthetic ' + userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: old, ...over });
    const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', assigned: true, programmes: ['General care'] };
    const def = (id, title, filters = {}) => ({ id, version: 1, status: 'active', spec: { title, unit: 'count', numerator: 'patients', denominator: null, filters, exclude: [], exclusionsNote: 'None', owner: 'Programme manager', cadence: 'Monthly', minimumCohort: 5 }, reason: 'Synthetic definition for tests', by: 'own', byName: 'Owner', at: old });
    const fresh = () => { const people = []; const add = (n, village, team, o = {}) => { for (let i = 0; i < n; i++)people.push({ ...base, id: `${team}-${village}-${i}`, name: `Synthetic ${village} ${i}`, village, teamId: team, ...o }); };
      add(7, 'Alpur', 't1'); add(3, 'Bedi', 't1'); add(3, 'Bedi', 't1', { sex: 'Male' }); add(9, 'Chak', 't2');
      return { organisation: { id: 'org', revision: 1 }, teams: [{ id: 't1', name: 'Team one' }, { id: 't2', name: 'Team two' }], invitations: [], members: [member('sup', 'supervisor', ['t1', 't2']), member('sup2', 'supervisor', ['t1', 't2'])],
        operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, indicatorDefinitions: [def('female-people', 'Women in the cohort', { sex: 'Female' }), def('all-people', 'People in the cohort')] },
        workspace: { people, visits: people.map(p => ({ id: 'v-' + p.id, personId: p.id, state: 'confirmed', createdAt: recent, confirmedAt: recent, facts: {} })), submissions: [], referrals: [], audit: [],
          integrations: [{ id: 'agg', kind: 'mis', mode: 'demo', name: 'District aggregate MIS', status: 'active', version: 1, operations: { version: 1, allowed: ['aggregate', 'lookup'], aggregateOnly: true, setBy: 'own', setAt: old, reason: 'Aggregate only', history: [] } }] } }; };
    const U = id => ({ userId: id, displayName: 'Synthetic ' + id, email: id + '@example.invalid' });
    let n = 0; const as = async (id, c) => { const s = await store.readState(); const m = store.scope(s, id); D.authorizeAggregate(s, m, c); return executeAggregate(null, s, c, U(id), m, 'key_' + (++n), 'hash'); };
    const prep = (defs, teamIds = ['t1', 't2']) => ({ type: 'prepareAggregateReport', destinationId: 'agg', definitions: defs, period: { start, end: today }, teamIds, group: 'none' });
    const report = id => store.saved.operations.aggregateReports.find(r => r.id === id);
    await check('7 a release whose complement in the team is fewer than 5 people is withheld (population check)', async () => {
      store.setup(fresh()); L.ledger.length = 0;
      const { reportId } = await as('sup', prep(['female-people'])); const blocks = report(reportId).payload.blocks;
      assert.equal(blocks.find(b => b.team === 'Team one').withheld, 'differencing', 'Team one: 10 women of 13 people reveals 3 men');
      assert.equal(blocks.find(b => b.team === 'Team two').withheld, null, 'control: Team two (9 women of 9) is released');
    });
    await check('7 a ledger write that D1 refuses closes the report as not sent', async () => {
      store.setup(fresh()); L.ledger.length = 0; L.setRefuseWrite(false);
      const { reportId } = await as('sup', prep(['all-people'])); await as('sup2', { type: 'approveAggregateReport', reportId, payloadSha256: report(reportId).payloadSha256 });
      L.setRefuseWrite(true);
      try { const r = await as('sup', { type: 'sendAggregateReport', reportId }); assert.equal(r.state, 'cancelled'); assert.equal(r.refused, true); assert.ok(r.message.includes(LEDGER_WRITE_REFUSED), r.message); assert.match(r.message, /Not sent/); }
      finally { L.setRefuseWrite(false); }
    });
  }

  if (failed.length) { console.log(JSON.stringify({ passed, failed }, null, 1)); process.exitCode = 1; }
  else {
    const result = { suite: 'eighth-review-fixes-contract', passed, checks: passed, completedAt: new Date().toISOString() };
    writeFileSync('tests/eighth-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
    console.log(`eighth review fixes contract: ${passed} checks passed`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
