// Slice 6ad ninth-review-fixes contract: regressions for defects a ninth independent review found in the round-5
// slices, mainly 7g aggregate delivery (/tmp/claude-0/review9/FINDINGS.md, reproductions t1-t3.mjs, 2 October 2026
// UTC). Each numbered block fails on the code before 6ad; run it from an export of the base tree with REPORT_ALL=1 to
// list every failing check.
//  1. A report read returns no cells (only the manifest and which blocks were withheld).
//  2. A report for a period that ended in the past records its window end: a second report with the same start and a
//     later end never replaces the first release, and the population check counts each window to its own end.
//  3. Report payloads are bounded and dropped when a report closes; all reports together have a byte budget.
//  4. Only open reports count towards the limit, and reports not approved or not sent in time expire.
//  6. An answer that arrives after a lookup took over is appended as evidence, not discarded.
//  7. A receipt lookup is allowed during maintenance; the send checkpoint re-checks maintenance.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.ninth-review-fixes-contract-'));
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
  // Injectable persistence, access audit and differencing ledger (as tests/eighth-review-fixes-contract.mjs).
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';export let saved;export function setup(s){saved=structuredClone(s)}export async function readState(){return structuredClone(saved)}export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m)throw new AppError(403,'Member revoked');return m}export async function persist(db,before,after){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;if(hook){const h=hook;hook=null;h(saved)}}export let hook=null;export function setHook(f){hook=f}`);
  writeFileSync(join(dir, 'access-audit.js'), `export {ACCESS_ACTIONS,ACCESS_ACTION_NAMES,ACCESS_REFUSED,accessRoute} from './access-audit-real.js';export async function recordAccess(){}export async function recordAccesses(){return []}`);
  writeFileSync(join(dir, 'indicator-ledger.js'), `export {candidateReleases,ledgerHash} from './indicator-ledger-real.js';export let ledger=[];export async function readLedger(){return {ledger:structuredClone(ledger),text:JSON.stringify(ledger)}}export async function writeLedger(db,org,prev,next){if(prev!==JSON.stringify(ledger))return false;ledger=structuredClone(next);return true}`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const D = await load('aggregate-delivery'), store = await load('store'), L = await load('indicator-ledger'), O = await load('operations'), DIFF = await load('indicator-differencing'), { executeAggregate } = await load('aggregate-execution');
  const day = 86400000, ago = n => new Date(Date.now() - n * day).toISOString(), date = n => ago(n).slice(0, 10), old = '2026-01-01T08:00:00.000Z';
  const member = (userId, role, teamIds) => ({ userId, displayName: 'Synthetic ' + userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: old });
  const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', assigned: true, programmes: ['General care'] };
  const def = (id, title, numerator = 'patients') => ({ id, version: 1, status: 'active', spec: { title, unit: 'count', numerator, denominator: null, filters: {}, exclude: [], exclusionsNote: 'None', owner: 'Programme manager', cadence: 'Monthly', minimumCohort: 5 }, reason: 'Synthetic definition for the contract test.', at: old, by: 'own' });
  // Team one: six people in Alpur seen 20 days ago, six in Bedi seen 18 days ago, and one Bedi person seen again 10 days ago.
  const fresh = () => {
    const people = [], visits = [];
    for (let i = 0; i < 12; i++) people.push({ ...base, id: `t1-${i < 6 ? 'Alpur' : 'Bedi'}-${i}`, name: `Synthetic person ${i}`, village: i < 6 ? 'Alpur' : 'Bedi', teamId: 't1' });
    people.forEach((p, i) => visits.push({ id: 'v-' + p.id, personId: p.id, state: 'confirmed', createdAt: ago(i < 6 ? 20 : 18), confirmedAt: ago(i < 6 ? 20 : 18), facts: {} }));
    visits.push({ id: 'v-late', personId: people[7].id, state: 'confirmed', createdAt: ago(10), confirmedAt: ago(10), facts: {} });
    return { organisation: { id: 'org', revision: 1 }, teams: [{ id: 't1', name: 'Team one' }], invitations: [], members: [member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t1'])],
      operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, indicatorDefinitions: [def('all-people', 'People in the cohort'), def('visits-done', 'Visits confirmed', 'visits-confirmed')] },
      workspace: { people, visits, submissions: [], referrals: [], audit: [],
        integrations: [{ id: 'agg', kind: 'mis', mode: 'demo', name: 'District aggregate MIS', status: 'active', version: 1, operations: { version: 1, allowed: ['aggregate', 'lookup'], aggregateOnly: true, setBy: 'own', setAt: old, reason: 'Aggregate only', history: [] } }] } };
  };
  const U = id => ({ userId: id, displayName: 'Synthetic ' + id, email: id + '@example.invalid' });
  let n = 0; const as = async (id, c, transport) => { const s = await store.readState(); const m = store.scope(s, id); D.authorizeAggregate(s, m, c); return executeAggregate(null, s, c, U(id), m, 'key_' + (++n), 'hash', transport); };
  const prep = (over = {}) => ({ type: 'prepareAggregateReport', destinationId: 'agg', definitions: ['all-people'], period: { start: date(25), end: date(0) }, teamIds: ['t1'], group: 'none', ...over });
  const report = id => store.saved.operations.aggregateReports.find(r => r.id === id);
  const approve = id => as('sup2', { type: 'approveAggregateReport', reportId: id, payloadSha256: report(id).payloadSha256 });
  const reset = () => { store.setup(fresh()); L.ledger.length = 0; };

  // 1. The read returns no cells.
  await check('1 a report view carries the manifest and withheld blocks but no payload or cells', async () => {
    reset(); const { reportId } = await as('sup', prep()); const v = D.reportView(report(reportId));
    assert.equal(v.payload, undefined); assert.equal(v.manifest.sha256, report(reportId).payloadSha256); assert.ok(v.blocks.length > 0);
    assert.equal(JSON.stringify(v.blocks).includes('cells'), false); assert.equal(/numerator|denominator/.test(JSON.stringify({ m: v.manifest, b: v.blocks })), false);
  });
  await check('1 the aggregate reports read uses the cell-free view', () => assert.match(readFileSync('lib/saha/aggregate-reports-server.ts', 'utf8'), /\.\.\.reportView\(r\)/));

  // 2. Window end.
  await check('2 a report ending one day later than a sent report never reveals the one visit in between', async () => {
    reset();
    const first = await as('sup', prep({ definitions: ['visits-done'], group: 'village', period: { start: date(25), end: date(11) } }));
    assert.deepEqual(report(first.reportId).payload.blocks[0].cells.map(c => [c.group, c.value]), [['Alpur', 6], ['Bedi', 6]]);
    await approve(first.reportId); assert.equal((await as('sup', { type: 'sendAggregateReport', reportId: first.reportId })).state, 'accepted');
    const e = await thrown(async () => { const second = await as('sup', prep({ definitions: ['visits-done'], group: 'village', period: { start: date(25), end: date(10) } }));
      assert.equal(report(second.reportId).payload.blocks[0].withheld, 'differencing', 'Bedi 7 after Bedi 6 reveals one visit'); });
    if (e) assert.match(e.message, /every block is withheld/);
    assert.ok(L.ledger.some(r => r.u), 'the release records its window end');
  });
  await check('2 releases with the same start and different ends are both kept by the ledger prune', () => {
    const r = { v: 'x', at: new Date().toISOString(), k: 'k', f: {}, c: { g: 6 }, m: { g: [6, 0] }, n: 'visits-confirmed', d: null, w: ago(25), z: [] };
    assert.equal(DIFF.pruneLedger([{ ...r, u: ago(11) }, { ...r, u: ago(10) }], new Date().toISOString()).length, 2);
  });
  await check('2 windows that do not nest fall back to whole profiles', () => {
    assert.deepEqual(DIFF.windowChain(['2026-09-05T00:00:00.000Z', '2026-09-01T00:00:00.000Z']), ['2026-09-05T00:00:00.000Z', '2026-09-01T00:00:00.000Z']);
    assert.equal(DIFF.windowChain(['2026-09-01T00:00:00.000Z|2026-09-10T23:59:59.999Z', '2026-09-05T00:00:00.000Z']), null);
  });

  // 3. Storage bounds.
  await check('3 payload and report budgets keep the operations row inside D1 limits with the ledger', () => {
    assert.ok(D.PAYLOAD_BYTES <= D.REPORTS_BYTES && D.REPORTS_BYTES + DIFF.LEDGER_BYTES <= 1_600_000, 'reports and ledger leave at least 400 kB of the 2 MB value');
  });
  await check('3 a sent report keeps its manifest, hash and receipt but not its payload', async () => {
    reset(); const { reportId } = await as('sup', prep()); await approve(reportId); const r = await as('sup', { type: 'sendAggregateReport', reportId });
    assert.equal(r.state, 'accepted'); assert.equal(report(reportId).payload, undefined); assert.ok(report(reportId).receipt); assert.match(report(reportId).payloadSha256, /^[a-f0-9]{64}$/);
  });
  await check('3 preparing is refused when the stored reports would exceed their byte budget', async () => {
    reset(); store.saved.operations.aggregateReports = [{ id: 'big', destinationId: 'agg', destinationName: 'x', definitions: [], period: { start: date(3), end: date(2) }, teamIds: ['t1'], group: 'none', computedAt: ago(2), state: 'accepted', preparedBy: 'sup', preparedByName: 'x', preparedAt: ago(2), payloadSha256: '0'.repeat(64), rowCount: 1, attempts: 1, minimisation: [], events: [{ at: ago(2), state: 'accepted', detail: 'x'.repeat(D.REPORTS_BYTES) }], message: '', updatedAt: ago(2) }];
    const e = await thrown(() => as('sup', prep())); assert.equal(e?.status, 409); assert.match(e.message, /space this release keeps/);
  });

  // 4. Open reports only, and expiry.
  const closed = i => ({ id: 'old-' + i, destinationId: 'agg', destinationName: 'x', definitions: ['all-people@1'], period: { start: date(40), end: date(39) }, teamIds: ['t1'], group: 'none', computedAt: ago(39), state: 'accepted', preparedBy: 'sup', preparedByName: 'x', preparedAt: ago(39), payloadSha256: '0'.repeat(64), rowCount: 1, attempts: 1, minimisation: [], events: [], message: '', updatedAt: ago(39) });
  await check('4 closed reports do not count towards the report limit', async () => {
    reset(); store.saved.operations.aggregateReports = Array.from({ length: 200 }, (_, i) => closed(i));
    assert.equal((await as('sup', prep())).state, 'prepared');
  });
  await check('4 a report not approved within the approval window expires and cannot be approved', async () => {
    reset(); const { reportId } = await as('sup', prep()); report(reportId).preparedAt = ago(2);
    const e = await thrown(() => approve(reportId)); assert.equal(e?.status, 409); assert.match(e.message, /expired/);
    await as('sup', prep({ group: 'village' })); const r = report(reportId);
    assert.equal(r.state, 'cancelled'); assert.match(r.message, /Expired: not approved/); assert.equal(r.payload, undefined);
    assert.ok(store.saved.workspace.audit.some(a => a.action === 'aggregateReportExpired' && a.subject === reportId));
  });

  // 6. Late answers.
  await check('6 a send answer that arrives after a lookup took over is recorded, not discarded', async () => {
    reset(); const { reportId } = await as('sup', prep()); await approve(reportId);
    const transport = async (i, body, key) => { store.saved.operations.aggregateReports.find(r => r.id === reportId).operationId = 'lookup-took-over'; store.saved.organisation.revision++; return D.demoAggregateTransport(i, body, key); };
    const r = await as('sup', { type: 'sendAggregateReport', reportId }, transport);
    assert.equal(r.state, 'accepted'); assert.ok(report(reportId).receipt, 'receipt kept');
    assert.ok(report(reportId).events.some(e => /Late answer to an earlier send/.test(e.detail)));
  });

  // 7. Maintenance.
  await check('7 a receipt lookup stays available during maintenance', () => assert.equal(O.maintenanceAllows({ type: 'lookupAggregateReport' }), true));
  await check('7 the send checkpoint re-checks maintenance and sends nothing', async () => {
    reset(); const { reportId } = await as('sup', prep()); await approve(reportId);
    let calls = 0; const transport = async () => { calls++; return null; };
    // The pause lands just after the checkpoint is saved, before the checkpoint's fresh read.
    store.setHook(saved => { saved.operations.maintenance = true; });
    const r = await as('sup', { type: 'sendAggregateReport', reportId }, transport);
    assert.equal(calls, 0); assert.equal(r.state, 'cancelled'); assert.match(r.message, /paused for maintenance/);
  });

  if (failed.length) { console.log(JSON.stringify({ passed, failed }, null, 1)); process.exitCode = 1; }
  else {
    const result = { suite: 'ninth-review-fixes-contract', passed, checks: passed, completedAt: new Date().toISOString() };
    writeFileSync('tests/ninth-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
    console.log(`ninth review fixes contract: ${passed} checks passed`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
