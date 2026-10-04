// Slice 13d (tenth review, medium): the aggregate send checkpoint screens the release against the people in the sender's
// scope. The state it reads inside the checkpoint comes from an unscoped read, where every person is unassigned, so the
// population was empty and the population screen passed whatever the ledger held.
// The harness is the one of tests/ninth-review-fixes-contract.mjs, with two differences that matter here: the store's
// read returns every person unassigned, as the real `readState` does, and `scope` is the real one from lib/saha/store.ts.
// Scenario: two reports are prepared and approved before either is sent. A counts everyone by village (Alpur 6, Bedi 6);
// B counts everyone by age band (50+ 5, 18–49 7). Each is safe alone. Together they split the team into groups of 1 (Alpur
// 50+), 5, 4 and 2, which a receiver can isolate by subtraction once both are released. A send re-screens the report before
// it starts (on the scoped state), so the checkpoint is what stands between B and a report sent in the meantime: here A is
// sent while B is between that re-screen and its checkpoint, and B must be refused there.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.aggregate-checkpoint-population-'));
let passed = 0;
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts'))) {
    const out = ts.transpileModule(readFileSync('lib/saha/' + f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, (['indicator-ledger.ts', 'access-audit.ts', 'store.ts'].includes(f) ? f.replace(/\.ts$/, '-real') : f.replace(/\.ts$/, '')) + '.js'), out);
  }
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';export {scope} from './store-real.js';export let saved;export function setup(s){saved=structuredClone(s)}
export async function readState(){const s=structuredClone(saved);for(const p of s.workspace.people)p.assigned=false;return s}
export async function persist(db,before,after){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);for(const p of saved.workspace.people)delete p.assigned;saved.organisation.revision++;if(hook){const h=hook;hook=null;await h()}}export let hook=null;export function setHook(f){hook=f}`);
  writeFileSync(join(dir, 'access-audit.js'), `export {ACCESS_ACTIONS,ACCESS_ACTION_NAMES,ACCESS_REFUSED,accessRoute} from './access-audit-real.js';export async function recordAccess(){}export async function recordAccesses(){return []}`);
  writeFileSync(join(dir, 'indicator-ledger.js'), `export {candidateReleases,ledgerHash} from './indicator-ledger-real.js';export let ledger=[];export async function readLedger(){return {ledger:structuredClone(ledger),text:JSON.stringify(ledger)}}export async function writeLedger(db,org,prev,next){if(prev!==JSON.stringify(ledger))return false;ledger=structuredClone(next);return true}`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const D = await load('aggregate-delivery'), store = await load('store'), L = await load('indicator-ledger'), { executeAggregate } = await load('aggregate-execution');
  const day = 86400000, ago = n => new Date(Date.now() - n * day).toISOString(), date = n => ago(n).slice(0, 10), old = '2026-01-01T08:00:00.000Z';
  const member = (userId, role, teamIds) => ({ userId, displayName: 'Synthetic ' + userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: old });
  const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', programmes: ['General care'], teamId: 't1' };
  const def = { id: 'all-people', version: 1, status: 'active', spec: { title: 'People in the cohort', unit: 'count', numerator: 'patients', denominator: null, filters: {}, exclude: [], exclusionsNote: 'None', owner: 'Programme manager', cadence: 'Monthly', minimumCohort: 5 }, reason: 'Synthetic definition for the contract test.', at: old, by: 'own' };
  const fresh = () => {
    const people = [];
    for (let i = 0; i < 12; i++) people.push({ ...base, id: `p${i}`, name: `Synthetic person ${i}`, village: i < 6 ? 'Alpur' : 'Bedi', age: i === 0 || (i >= 6 && i <= 9) ? 60 : 30 });
    return { organisation: { id: 'org', revision: 1 }, teams: [{ id: 't1', name: 'Team one' }], invitations: [], members: [member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t1'])],
      operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, indicatorDefinitions: [def] },
      workspace: { people, visits: [], submissions: [], referrals: [], audit: [],
        integrations: [{ id: 'agg', kind: 'mis', mode: 'demo', name: 'District aggregate MIS', status: 'active', version: 1, operations: { version: 1, allowed: ['aggregate', 'lookup'], aggregateOnly: true, setBy: 'own', setAt: old, reason: 'Aggregate only', history: [] } }] } };
  };
  const U = id => ({ userId: id, displayName: 'Synthetic ' + id, email: id + '@example.invalid' });
  let n = 0; const as = async (id, c) => { const s = await store.readState(); const m = store.scope(s, id); D.authorizeAggregate(s, m, c); return executeAggregate(null, s, c, U(id), m, 'key_' + (++n), 'hash'); };
  const prep = (definition, group) => ({ type: 'prepareAggregateReport', destinationId: 'agg', definitions: [definition], period: { start: date(25), end: date(0) }, teamIds: ['t1'], group });
  const report = id => store.saved.operations.aggregateReports.find(r => r.id === id);
  const ready = async (definition, group) => { const { reportId } = await as('sup', prep(definition, group)); await as('sup2', { type: 'approveAggregateReport', reportId, payloadSha256: report(reportId).payloadSha256 }); return reportId; };
  const shown = id => report(id).payload.blocks[0].cells.filter(c => !c.suppressed).map(c => [c.group, c.value]);

  store.setup(fresh()); L.ledger.length = 0;
  await check('the unscoped read leaves every person unassigned, as the real store does', async () => {
    const s = await store.readState(); assert.equal(s.workspace.people.filter(p => p.assigned).length, 0);
    store.scope(s, 'sup'); assert.equal(s.workspace.people.filter(p => p.assigned).length, 12, 'the real scope assigns the sender\'s team');
  });
  const A = await ready('all-people', 'village'), B = await ready('all-people', 'age-band');
  await check('each report alone is safe and both are approved', () => {
    assert.deepEqual(shown(A), [['Alpur', 6], ['Bedi', 6]]);
    assert.deepEqual(shown(B), [['18–49', 7], ['50+', 5]]);
    assert.deepEqual([report(A).state, report(B).state], ['approved', 'approved']);
  });
  await check('the second is refused at the checkpoint when the first is sent in the meantime: together they would isolate one person', async () => {
    let state, error, first;
    store.setHook(async () => { first = (await as('sup2', { type: 'sendAggregateReport', reportId: A })).state; });
    try { state = (await as('sup', { type: 'sendAggregateReport', reportId: B })).state; } catch (e) { error = e; }
    assert.equal(first, 'accepted', 'A was sent while B was on its way to the checkpoint'); assert.ok(L.ledger.length > 0);
    assert.notEqual(state, 'accepted', 'sent: the population screen saw no people');
    const r = report(B); assert.notEqual(r.state, 'accepted'); assert.equal(r.receipt, undefined, 'nothing was sent');
    assert.match(JSON.stringify(r.events.at(-1)) + String(error?.message ?? ''), /fewer than 5 people/);
  });
  await check('the checkpoint applies the sender\'s scope before the population screen', () => {
    const src = readFileSync('lib/saha/aggregate-execution.ts', 'utf8');
    assert.ok(src.indexOf('scope(latest,m.userId)') > 0 && src.indexOf('scope(latest,m.userId)') < src.indexOf('withdrawn=await recordReleases(db,latest'));
  });

  writeFileSync('tests/aggregate-checkpoint-population-contract-result.json', JSON.stringify({ passed, suite: 'aggregate-checkpoint-population-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'aggregate-checkpoint-population-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
