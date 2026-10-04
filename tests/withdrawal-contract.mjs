// Slice 14c withdrawal contract (R58; BR-INT-02, BR-RULE-04, BR-INT-21): withdrawal (void) of an accepted programme
// submission and withdrawal or amendment of an accepted EHR publication, each prepared, approved for the exact payload hash
// and executed by the approver with its own receipt, recorded against the original receipt (never edited).
//
// Runs the real applyWithdrawal (prepare, approve, cancel), the real executeWithdrawal (checkpoint, recheck, request, receipt,
// lookup) with the two demonstration simulators and injected HTTP programme and FHIR transports, the real correction-task
// propagation and closing, trace stamping and assembly, and an in-memory compare-and-swap store. Every lib/saha module is
// transpiled, so this harness needs no list of dependencies.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const dir = mkdtempSync(join(process.cwd(), '.withdrawal-contract-'));
let passed = 0;
const check = async (fn) => { await fn(); passed++; };
const status = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  // An in-memory store with the compare-and-swap rule of the real one; `hook` runs inside persist (to change state mid-flight).
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';
export let saved;let hook=null;export const commits=[];export function setup(s){saved=structuredClone(s);hook=null;commits.length=0}export function setHook(f){hook=f}export function edit(f){f(saved)}
export async function readState(){return structuredClone(saved)}
export function scope(s,id){const m=s.members.find(m=>m.userId===id&&m.status==='active');if(!m)throw new AppError(403,'Member revoked');return m}
export async function persist(db,before,after,u,c,key){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;commits.push({type:c.type,key});if(hook){const h=hook;hook=null;await h(c,saved);}}`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const store = await imp('store'), W = await imp('withdrawal'), X = await imp('withdrawal-execution'), C = await imp('correction-tasks'), A = await imp('access'), E = await imp('ehr'), T = await imp('trace'), O = await imp('adapter-operations'), Ops = await imp('operations'), P = await imp('platform');
  const now = new Date().toISOString(), past = '2026-09-28T06:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: past, ...over });
  const members = [member('asha', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'), member('own', 'clinician', { isOwner: true, teamIds: ['t2'] }), member('adm', 'admin', { isOwner: true, teamIds: [] })];
  const m = id => members.find(x => x.userId === id), u = id => ({ userId: id, displayName: id.toUpperCase(), email: `${id}@example.invalid` });
  const ops = (allowed, version = 1) => ({ version, allowed, aggregateOnly: false, setBy: 'own', setAt: past, reason: 'Synthetic partner agreement', history: [] });
  const withDelete = ops(['create', 'update', 'delete', 'lookup']);
  const facts = { date: past.slice(0, 16), systolic: '', diastolic: '', weight: '55', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit note', source: 'measured' };
  const env = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_MIS_TEST: 'mis-secret', SAHA_EHR_TEST: 'ehr-secret',
    SAHA_MIS_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: 'mis_http', origin: 'https://mis.example', credentialBinding: 'SAHA_MIS_TEST' }]),
    SAHA_EHR_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: 'ehr1', baseUrl: 'https://ehr.example/fhir', credentialBinding: 'SAHA_EHR_TEST' }]) };
  const sub = (id, connectorId, name, state, receipt, over = {}) => ({ id, visitId: 'v1', personId: 'p1', connectorId, connectorName: name, state, mode: 'demo', payloadHash: 'h', receipt, attempts: 1, message: '', createdAt: past, updatedAt: past, ...over });
  const P1 = { id: 'p1', name: 'Withdrawal Synthetic', age: 30, sex: 'Female', village: 'Synthetic village', programmes: ['Maternal care', 'General care'], task: 'Visit', due: 'Today', status: 'completed', aiConsent: true, exchangeConsent: true, consentVersion: 2, createdAt: past, version: 5, teamId: 't1', assignedTo: 'asha', assigned: true };
  const base = async () => {
    const p = structuredClone(P1), hashOf = await E.identityHash(p);
    p.ehr = { links: [{ id: 'l1', integrationId: 'ehr1', externalId: 'ext-1', externalName: 'Withdrawal Synthetic', identityHash: hashOf, status: 'active', at: past, verifiedBy: 'doc', method: 'worker-confirmed' }],
      permissions: [{ id: 'g1', linkId: 'l1', direction: 'write', purpose: 'care-coordination', from: '2026-01-01T00:00:00.000Z', to: new Date(Date.now() + 86400000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), status: 'active', at: past }],
      documents: [], operations: [{ id: 'op1', linkId: 'l1', permissionId: 'g1', actorId: 'doc', integrationVersion: 2, identityHash: hashOf, consentVersion: 2, state: 'accepted', visitId: 'v1', visitVersion: 3, approvalUntil: past, bundle: {}, hash: 'h', at: past, message: '', receipt: 'Bundle/published-1' }] };
    return {
      organisation: { id: 'org', name: 'Synthetic organisation', revision: 1 }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [], members: structuredClone(members),
      workspace: { role: 'clinician', receipts: {}, referrals: [], audit: [], people: [p],
        visits: [{ id: 'v1', personId: 'p1', version: 3, recordVersion: 4, state: 'confirmed', facts, createdAt: past, confirmedAt: past, aiResults: [] }],
        integrations: [
          { id: 'mis_maternal', name: 'Maternal & child register', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: ['Maternal care'], behavior: 'accept', operations: structuredClone(withDelete) },
          { id: 'mis_community', name: 'Community health MIS', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: ['General care'], behavior: 'uncertain', operations: structuredClone(withDelete) },
          { id: 'mis_plain', name: 'Plain register', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: ['General care'], behavior: 'accept' },
          { id: 'mis_http', name: 'Synthetic HTTP MIS', kind: 'mis', mode: 'http', status: 'active', version: 3, description: '', programmes: ['General care'], endpoint: 'https://mis.example/api', credentialBinding: 'SAHA_MIS_TEST', mis: { contract: 'saha-mis-v1', mapping: [], corrections: true }, operations: structuredClone(withDelete) },
          { id: 'ehr1', name: 'Synthetic EHR', kind: 'ehr', mode: 'http', status: 'active', version: 2, description: '', programmes: [], endpoint: 'https://ehr.example/fhir', credentialBinding: 'SAHA_EHR_TEST', ehr: { read: true, write: true }, operations: structuredClone(withDelete) }],
        submissions: [sub('s1', 'mis_maternal', 'Maternal & child register', 'accepted', 'SIM-AAAA1111'), sub('s2', 'mis_community', 'Community health MIS', 'accepted', 'SIM-BBBB2222'), sub('s4', 'mis_maternal', 'Maternal & child register', 'uncertain', undefined), sub('s5', 'mis_plain', 'Plain register', 'accepted', 'SIM-CCCC3333'),
          sub('s3', 'mis_http', 'Synthetic HTTP MIS', 'accepted', 'MIS-R3', { mode: 'http', delivery: { endpoint: 'https://mis.example/api', credentialBinding: 'SAHA_MIS_TEST', key: 's3-key', actorId: 'doc', connectorVersion: 3, personVersion: 5, consentVersion: 2, visitVersion: 3, expiresAt: past, payload: {}, events: [] } })] } };
  };
  // The state a member sees: workspace role and patient access as the real store's scope() sets them.
  const view = (s, id) => { const x = structuredClone(s), mm = x.members.find(y => y.userId === id); x.workspace.role = mm.role; A.bindAccessPolicy(x); for (const p of x.workspace.people) p.assigned = A.allowed(mm, p); return { x, mm }; };
  // One ordinary command commit through the real applyWithdrawal; returns its result.
  const run = async (id, c) => { const { x, mm } = view(store.saved, id), r = await W.applyWithdrawal(x, c, u(id), mm); x.organisation.revision = store.saved.organisation.revision + 1; store.edit(s => Object.assign(s, structuredClone(x))); return r; };
  let transportCalls = [];
  const demo = (i, w, lookup) => { transportCalls.push({ kind: 'demo', lookup, id: w.id }); return W.demoWithdrawalTransport(i, w, lookup); };
  const exec = (id, c, transports = {}, e = {}) => { const { x, mm } = view(store.saved, id); return X.executeWithdrawal(null, x, c, u(id), mm, 'key-' + Math.random().toString(16).slice(2), 'h', e, { demo, ...transports }); };
  const wd = id => { for (const v of store.saved.workspace.visits) { const w = v.withdrawals?.find(x => x.id === id); if (w) return w; } };
  const prepare = (id, over = {}) => run(id, { type: 'prepareWithdrawal', personId: 'p1', target: 'programme-submission', refId: 's1', operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Recorded against the wrong person in the household', ...over });

  // ---- 1. command shapes, the operation mapping and maintenance
  await check(() => { const ok = { type: 'prepareWithdrawal', personId: 'p1', target: 'programme-submission', refId: 's1', operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Recorded against the wrong person' };
    assert.equal(P.platformSchema.safeParse(ok).success, true); assert.equal(P.platformSchema.safeParse({ ...ok, reason: 'too short' }).success, false); assert.equal(P.platformSchema.safeParse({ ...ok, reasonCode: 'other' }).success, false); assert.equal(P.platformSchema.safeParse({ ...ok, visitId: 'v1' }).success, false, 'strict');
    assert.equal(P.platformSchema.safeParse({ type: 'approveWithdrawal', personId: 'p1', withdrawalId: 'w', payloadHash: 'x' }).success, false, 'a payload hash is a SHA-256'); });
  await check(() => { assert.equal(O.misOperation({ operation: 'withdraw' }), 'delete'); assert.equal(O.misOperation({ operation: 'correct' }), 'update'); assert.equal(O.misOperation({ operation: 'submit' }), 'create'); assert.ok(O.OPERATION_PATHS.mis.delete && O.OPERATION_PATHS.ehr.delete && O.OPERATION_PATHS.ehr.update); });
  await check(() => { assert.equal(Ops.maintenanceAllows({ type: 'lookupWithdrawal' }), true); assert.equal(Ops.maintenanceAllows({ type: 'cancelWithdrawal' }), true); assert.equal(Ops.maintenanceAllows({ type: 'executeWithdrawal' }), false); assert.equal(Ops.maintenanceAllows({ type: 'prepareWithdrawal' }), false); });

  // ---- 2. who may prepare, and what may be withdrawn
  store.setup(await base());
  await check(async () => { for (const who of ['adm', 'doc2', 'own', 'sup']) await status(() => prepare(who), 403); });
  await check(async () => { await status(() => prepare('asha', { refId: 's4' }), 409, /Only a submission the destination accepted/); await status(() => prepare('asha', { refId: 'missing' }), 404); await status(() => prepare('asha', { operation: 'amend' }), 422); });
  await check(async () => { await status(() => prepare('asha', { refId: 's5' }), 409, /not permitted to delete or void records .*Nothing was prepared/); assert.equal(store.saved.workspace.visits[0].withdrawals, undefined, 'nothing stored'); });

  // ---- 3. the maternal register simulator: prepare, approve, execute, receipt
  const original = structuredClone(store.saved.workspace.submissions.find(x => x.id === 's1'));
  const r1 = await prepare('asha'), w1 = () => wd(r1.withdrawalId);
  await check(() => { const w = w1(); assert.equal(w.state, 'prepared'); assert.deepEqual(w.payload, { contract: 'saha-mis-v1', environment: 'synthetic', operation: 'withdraw', withdraws: { submissionKey: 's1', receipt: 'SIM-AAAA1111' }, reason: 'wrong-patient' }); assert.equal(w.payloadHash, sha(w.payload)); assert.equal(r1.payloadHash, w.payloadHash);
    assert.ok(!JSON.stringify(w.payload).includes('household') && !JSON.stringify(w.payload).includes('55'), 'no free-text reason or visit fact is sent'); assert.equal(w.adapterOperation, 'delete'); assert.deepEqual(w.original, { id: 's1', receipt: 'SIM-AAAA1111' });
    assert.deepEqual({ ...w.bound }, { personVersion: 5, consentVersion: 2, visitVersion: 3, visitStatus: 'current', integrationVersion: 1, operationsVersion: 1 }); });
  await check(() => { const a = store.saved.workspace.audit.at(-1); assert.equal(a.action, 'prepareWithdrawal'); assert.equal(a.subject, r1.withdrawalId); assert.equal(a.personId, 'p1'); assert.match(a.detail, /original and its receipt are kept unchanged/); });
  await check(async () => { await status(() => prepare('doc'), 409, /already open/); });
  await check(async () => { await status(() => run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId, payloadHash: '0'.repeat(64) }), 409, /not the withdrawal you reviewed/); for (const who of ['doc2', 'adm', 'sup']) await status(() => run(who, { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId, payloadHash: r1.payloadHash }), 403); });
  await check(async () => { await status(() => exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 409, /Approve the withdrawal/); await status(() => exec('asha', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 409); });
  const a1 = await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId, payloadHash: r1.payloadHash });
  await check(() => { const w = w1(); assert.equal(w.state, 'approved'); assert.equal(w.approvedBy, 'doc'); const minutes = (Date.parse(w.expiresAt) - Date.parse(w.approvedAt)) / 60000; assert.equal(minutes, 15); assert.equal(a1.expiresAt, w.expiresAt); });
  await check(async () => { await status(() => exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 409, /care worker who approved/); await status(() => exec('doc2', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 403); assert.equal(transportCalls.length, 0); });
  await check(async () => { store.edit(s => { s.workspace.visits[0].withdrawals[0].expiresAt = '2026-01-01T00:00:00.000Z'; }); await status(() => exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 409, /approval has expired/); store.edit(s => { s.workspace.visits[0].withdrawals[0].expiresAt = new Date(Date.now() + 600000).toISOString(); }); });
  const e1 = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId });
  await check(() => { const w = w1(); assert.equal(e1.state, 'accepted'); assert.equal(w.state, 'accepted'); assert.match(w.receipt, /^SIM-W-[0-9A-F]{8}$/); assert.equal(e1.receipt, w.receipt); assert.equal(w.attempts, 1); assert.equal(w.payload, undefined, 'the payload is dropped once final; its hash stays'); assert.ok(w.payloadHash);
    assert.deepEqual(w.events.map(e => e.state), ['prepared', 'approved', 'sending', 'accepted']); assert.deepEqual(transportCalls, [{ kind: 'demo', lookup: false, id: r1.withdrawalId }]); });
  await check(() => { assert.deepEqual(store.saved.workspace.submissions.find(x => x.id === 's1'), original, 'the original submission and its receipt are not edited'); });
  await check(() => { const acts = store.saved.workspace.audit.filter(a => a.subject === r1.withdrawalId).map(a => a.action); assert.deepEqual(acts, ['prepareWithdrawal', 'approveWithdrawal', 'executeWithdrawal', 'withdrawalReceipt']); assert.deepEqual(store.commits.map(c => c.type), ['executeWithdrawal', 'withdrawalReceipt'], 'a checkpoint commit before the request, the receipt after it'); });
  await check(() => { const w = w1(); assert.ok(w.events.slice(2).every(e => e.ref && e.ref.auditId), 'execution steps carry their trace reference'); assert.equal(w.events[3].ref.command, 'withdrawalReceipt'); });
  await check(async () => { const again = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }); assert.deepEqual(again, { withdrawalId: r1.withdrawalId, state: 'accepted' }); assert.equal(transportCalls.length, 1, 'a second press never sends again'); assert.equal(w1().attempts, 1); });
  await check(async () => { await status(() => prepare('asha'), 409, /already confirmed/); await status(() => run('asha', { type: 'cancelWithdrawal', personId: 'p1', withdrawalId: r1.withdrawalId }), 409, /never sent/); });

  // ---- 4. the community MIS simulator loses the response; only a lookup resolves it
  transportCalls = [];
  const r2 = await prepare('doc', { refId: 's2', reasonCode: 'entered-in-error', reason: 'Submitted to the wrong programme by mistake' });
  await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId, payloadHash: r2.payloadHash });
  const e2 = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId });
  await check(() => { const w = wd(r2.withdrawalId); assert.equal(e2.state, 'uncertain'); assert.equal(w.receipt, undefined); assert.match(w.message, /No response .* Look up/); assert.ok(w.payload, 'kept while unresolved'); });
  await check(async () => { const again = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId }); assert.equal(again.state, 'uncertain'); assert.equal(transportCalls.length, 1, 'an unknown outcome is never sent again'); });
  await check(async () => { await status(() => exec('doc2', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId }), 403); });
  const l2 = await exec('asha', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId });
  await check(() => { const w = wd(r2.withdrawalId); assert.equal(l2.state, 'accepted'); assert.match(w.receipt, /^SIM-W-/); assert.equal(w.attempts, 1, 'the lookup sends nothing'); assert.equal(w.lookups, 1); assert.match(w.message, /found by lookup; nothing was sent again/); assert.deepEqual(transportCalls.map(c => c.lookup), [false, true]); });
  await check(async () => { await status(() => exec('asha', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r2.withdrawalId }), 409, /outcome is unknown/); });

  // ---- 5. a changed patient, visit or permission blocks approval and sending
  store.setup(await base());
  const r3 = await prepare('asha');
  await check(async () => { store.edit(s => { s.workspace.people[0].version++; }); await status(() => run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId, payloadHash: r3.payloadHash }), 409, /patient record or sharing permission changed/); store.edit(s => { s.workspace.people[0].version--; }); });
  await check(async () => { store.edit(s => { s.workspace.visits[0].voidedAt = now; }); await status(() => run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId, payloadHash: r3.payloadHash }), 409, /visit changed/); store.edit(s => { delete s.workspace.visits[0].voidedAt; }); });
  await check(async () => { store.edit(s => { s.workspace.integrations[0].version++; }); await status(() => run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId, payloadHash: r3.payloadHash }), 409, /destination connection changed/); store.edit(s => { s.workspace.integrations[0].version--; }); });
  await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId, payloadHash: r3.payloadHash });
  await check(async () => { store.edit(s => { s.workspace.people[0].consentVersion++; }); await status(() => exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId }), 409, /Not sent: the patient record or sharing permission changed/); store.edit(s => { s.workspace.people[0].consentVersion--; }); assert.equal(wd(r3.withdrawalId).state, 'approved', 'refused before the checkpoint: nothing changed'); });
  // The owner withdraws the delete operation after approval: the withdrawal is closed as not sent (slice 7e rule).
  transportCalls = [];
  await check(async () => { store.edit(s => { s.workspace.integrations[0].operations = ops(['create', 'update', 'lookup'], 2); }); const r = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r3.withdrawalId }); const w = wd(r3.withdrawalId);
    assert.equal(r.refused, true); assert.equal(w.state, 'cancelled'); assert.equal(w.refusal.stage, 'before-send'); assert.equal(w.refusal.operation, 'delete'); assert.equal(w.refusal.settingVersion, 2); assert.equal(transportCalls.length, 0); assert.equal(store.saved.workspace.audit.at(-1).action, 'adapterOperationRefused'); });
  // ...and inside the checkpoint, after it is stored and before the request.
  store.setup(await base());
  const r4 = await prepare('asha'); await run('asha', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r4.withdrawalId, payloadHash: r4.payloadHash });
  await check(async () => { store.setHook(c => { if (c.type === 'executeWithdrawal') store.edit(s => { s.workspace.integrations[0].operations = ops(['create', 'lookup'], 2); }); });
    const r = await exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r4.withdrawalId }); const w = wd(r4.withdrawalId);
    assert.equal(r.state, 'cancelled'); assert.equal(w.refusal.stage, 'checkpoint'); assert.equal(w.attempts, 0, 'the reserved attempt is released'); assert.equal(transportCalls.length, 0, 'nothing was sent'); assert.match(w.message, /after the checkpoint and before the request/); assert.equal(store.saved.workspace.audit.at(-1).action, 'adapterOperationRefused'); });
  // A visit voided after the checkpoint also stops the request.
  store.setup(await base());
  const r5 = await prepare('asha'); await run('asha', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r5.withdrawalId, payloadHash: r5.payloadHash });
  await check(async () => { store.setHook(c => { if (c.type === 'executeWithdrawal') store.edit(s => { s.workspace.visits[0].voidedAt = now; }); });
    const r = await exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r5.withdrawalId }); assert.equal(r.state, 'cancelled'); assert.equal(transportCalls.length, 0); assert.match(wd(r5.withdrawalId).message, /The visit changed .* after the checkpoint/); assert.equal(store.saved.workspace.audit.at(-1).action, 'withdrawalNotSent'); });
  // Cancelling an unsent withdrawal.
  await check(async () => { const r = await prepare('asha', { refId: 's2' }); await status(() => run('doc2', { type: 'cancelWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId }), 403); const c = await run('asha', { type: 'cancelWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId }); assert.equal(c.state, 'cancelled'); assert.equal(wd(r.withdrawalId).payload, undefined); assert.equal(store.saved.workspace.audit.at(-1).action, 'cancelWithdrawal');
    const again = await prepare('asha', { refId: 's2' }); assert.equal(again.state, 'prepared', 'a cancelled withdrawal does not block a new one'); });

  // ---- 6. the HTTP programme adapter carries the explicit withdrawal payload (injected transport; no live call)
  store.setup(await base());
  const r6 = await prepare('doc', { refId: 's3' }); await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r6.withdrawalId, payloadHash: r6.payloadHash });
  await check(async () => { const sent = []; await status(() => exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r6.withdrawalId }, { mis: async (...a) => { sent.push(a); } }, {}), 409, /External programme services are disabled/); assert.equal(sent.length, 0); assert.equal(wd(r6.withdrawalId).state, 'approved', 'refused before the checkpoint'); });
  await check(() => { const w = wd(r6.withdrawalId); assert.deepEqual(w.payload.withdraws, { submissionKey: 's3-key', receipt: 'MIS-R3' }); assert.deepEqual(w.bound.route, { endpoint: 'https://mis.example/api', credentialBinding: 'SAHA_MIS_TEST' }); });
  {
    const sent = [];
    const mis = async (i, orgId, e, body, key) => { sent.push({ body, key, orgId, endpoint: i.endpoint }); return { contract: 'saha-mis-v1', key: body.key, payloadHash: '0'.repeat(64), status: 'accepted', receipt: 'MIS-W1' }; };
    const r = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r6.withdrawalId }, { mis }, env);
    await check(() => { const w = wd(r6.withdrawalId); assert.equal(sent.length, 1); assert.deepEqual(sent[0].body, { contract: 'saha-mis-v1', environment: 'synthetic', operation: 'withdraw', withdraws: { submissionKey: 's3-key', receipt: 'MIS-R3' }, reason: 'wrong-patient', key: w.id, payloadHash: w.payloadHash }); assert.equal(sent[0].key, w.id, 'the idempotency key is the withdrawal id'); assert.equal(sent[0].orgId, 'org'); });
    await check(() => { assert.equal(r.state, 'uncertain', 'a receipt for a different payload hash is not definitive'); });
    const look = async (i, orgId, e, body, key) => { sent.push({ body, key }); return { contract: 'saha-mis-v1', key: body.key, payloadHash: body.payloadHash, status: 'not_found' }; };
    const l = await exec('asha', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r6.withdrawalId }, { mis: look }, env);
    await check(() => { const w = wd(r6.withdrawalId); assert.deepEqual(sent[1].body, { contract: 'saha-mis-v1', operation: 'lookup', key: w.id, payloadHash: w.payloadHash }); assert.equal(sent[1].key, 'lookup_' + w.operationId); assert.equal(l.state, 'not-stored'); assert.match(w.message, /holds no withdrawal under this key. Nothing was resent/); assert.equal(w.attempts, 1); });
  }
  await check(async () => { const r = await prepare('doc', { refId: 's3' }); await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId, payloadHash: r.payloadHash }); const e = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId }, { mis: async () => { throw new Error('timeout'); } }, env); assert.equal(e.state, 'uncertain'); });
  await check(async () => { store.setup(await base()); store.edit(s => { s.workspace.integrations.find(i => i.id === 'mis_http').endpoint = 'https://other.example/api'; }); await status(() => prepare('doc', { refId: 's3' }), 409, /route changed/); });
  await check(async () => { store.setup(await base()); const r = await prepare('doc', { refId: 's3' }); await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId, payloadHash: r.payloadHash });
    const e = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId }, { mis: async (i, o, x, body) => ({ contract: 'saha-mis-v1', key: body.key, payloadHash: body.payloadHash, status: 'rejected' }) }, env); assert.equal(e.state, 'rejected'); assert.match(wd(r.withdrawalId).message, /original record stands/); });

  // ---- 7. EHR withdrawal: an entered-in-error notice replacing the published document (injected FHIR transport)
  store.setup(await base());
  const ehrPrep = (who, over = {}) => run(who, { type: 'prepareWithdrawal', personId: 'p1', target: 'ehr-publication', refId: 'op1', operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Published for the wrong person in the household', ...over });
  await check(async () => { await status(() => ehrPrep('doc', { operation: 'amend' }), 409, /confirmed correction visit/); await status(() => ehrPrep('doc', { refId: 'nope' }), 404); });
  const r7 = await ehrPrep('doc');
  await check(() => { const w = wd(r7.withdrawalId), b = w.payload, comp = b.entry[0].resource; assert.equal(b.identifier.system, 'urn:saha:withdrawals'); assert.equal(b.identifier.value, w.id); assert.equal(comp.status, 'entered-in-error');
    assert.deepEqual(comp.relatesTo, [{ code: 'replaces', targetIdentifier: { system: 'urn:saha:documents', value: 'op1' } }]); const patient = b.entry.find(e => e.resource.resourceType === 'Patient').resource; assert.deepEqual(patient, { resourceType: 'Patient', id: 'ext-1' });
    assert.equal(b.entry.some(e => e.resource.resourceType === 'Observation'), false); assert.ok(!JSON.stringify(b).includes('Withdrawal Synthetic'), 'the notice carries no patient name or visit content'); assert.equal(w.payloadHash, sha(b)); });
  await run('doc', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r7.withdrawalId, payloadHash: r7.payloadHash });
  {
    const calls = [];
    const fhir = async (i, orgId, e, path, init) => { calls.push({ path, init }); const body = JSON.parse(init.body); body.entry[0].resource.title = 'Changed by the server'; return { ...body, id: 'srv-1' }; };
    const r = await exec('doc', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r7.withdrawalId }, { fhir }, env);
    await check(() => { const w = wd(r7.withdrawalId); assert.equal(calls[0].path, 'Bundle'); assert.equal(calls[0].init.method, 'POST'); assert.equal(calls[0].init.headers['If-None-Exist'], 'identifier=' + encodeURIComponent('urn:saha:withdrawals|' + w.id)); assert.deepEqual(JSON.parse(calls[0].init.body), w.payload); assert.equal(r.state, 'uncertain', 'changed content is not a definitive receipt'); });
    const look = async (i, orgId, e, path) => { calls.push({ path }); const w = wd(r7.withdrawalId); return { resourceType: 'Bundle', type: 'searchset', entry: [{ resource: { ...w.payload, id: 'srv-1' } }] }; };
    const l = await exec('asha', { type: 'lookupWithdrawal', personId: 'p1', withdrawalId: r7.withdrawalId }, { fhir: look }, env);
    await check(() => { const w = wd(r7.withdrawalId); assert.equal(calls[1].path, 'Bundle?identifier=' + encodeURIComponent('urn:saha:withdrawals|' + w.id) + '&_count=2'); assert.equal(l.state, 'accepted'); assert.equal(w.receipt, 'Bundle/srv-1'); assert.equal(store.saved.workspace.people[0].ehr.operations[0].receipt, 'Bundle/published-1', 'the published document record is not edited'); assert.equal(store.saved.workspace.people[0].ehr.operations[0].state, 'accepted'); });
  }
  await check(async () => { store.setup(await base()); store.edit(s => { s.workspace.integrations.find(i => i.id === 'ehr1').operations = ops(['create', 'lookup']); }); await status(() => ehrPrep('doc'), 409, /not permitted to delete or void/); });

  // ---- 8. EHR amendment: the confirmed correction visit's document replaces the published one
  store.setup(await base());
  store.edit(s => { s.workspace.visits[0].supersededBy = 'v2'; s.workspace.visits.push({ id: 'v2', personId: 'p1', version: 1, recordVersion: 1, state: 'draft', facts: { ...facts, weight: '57', notes: 'Corrected weight' }, createdAt: now, aiResults: [], amendsVisitId: 'v1' }); });
  await check(async () => { await status(() => ehrPrep('doc', { operation: 'amend', reasonCode: 'corrected', reason: 'Weight entered in the wrong field' }), 409, /Confirm the correction visit first/); });
  store.edit(s => { const v = s.workspace.visits[1]; v.state = 'confirmed'; v.confirmedAt = now; v.version = 2; });
  await check(async () => { store.edit(s => { s.workspace.integrations.find(i => i.id === 'ehr1').operations = ops(['create', 'delete', 'lookup']); }); await status(() => ehrPrep('doc', { operation: 'amend', reasonCode: 'corrected', reason: 'Weight entered in the wrong field' }), 409, /not permitted to update records/); store.edit(s => { s.workspace.integrations.find(i => i.id === 'ehr1').operations = structuredClone(withDelete); }); });
  // A purpose grant without care coordination (slice 13a) stops an amendment (it carries visit content), not a withdrawal.
  await check(async () => { store.edit(s => { s.operations = { purposeGrants: [{ id: 'pg1', memberId: 'doc', programme: null, purposes: ['programme-delivery'], at: past, by: 'own', reason: 'Synthetic narrowing' }] }; });
    await status(() => ehrPrep('doc', { operation: 'amend', reasonCode: 'corrected', reason: 'Weight entered in the wrong field' }), 403, /care coordination/);
    const r = await ehrPrep('doc'); assert.equal(r.state, 'prepared'); await run('doc', { type: 'cancelWithdrawal', personId: 'p1', withdrawalId: r.withdrawalId }); store.edit(s => { delete s.operations; }); });
  const r8 = await ehrPrep('doc', { operation: 'amend', reasonCode: 'corrected', reason: 'Weight entered in the wrong field' });
  await check(() => { const w = wd(r8.withdrawalId), b = w.payload, comp = b.entry[0].resource; assert.equal(w.adapterOperation, 'update'); assert.equal(b.identifier.system, 'urn:saha:documents'); assert.equal(b.identifier.value, w.id); assert.equal(comp.status, 'final');
    assert.deepEqual(comp.relatesTo, [{ code: 'replaces', targetIdentifier: { system: 'urn:saha:documents', value: 'op1' } }]); assert.ok(b.entry.some(e => e.resource.resourceType === 'Observation' && e.resource.valueQuantity?.value === 57), 'the correction visit\'s values');
    assert.equal(w.visitId, 'v1', 'recorded against the original visit and receipt'); assert.equal(w.bound.correctionVisitId, 'v2'); assert.equal(w.bound.correctionVersion, 2); assert.equal(w.bound.permissionId, 'g1'); });
  await run('asha', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r8.withdrawalId, payloadHash: r8.payloadHash });
  await check(async () => { store.edit(s => { s.workspace.visits[1].version = 3; }); await status(() => exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r8.withdrawalId }, {}, env), 409, /correction visit changed/); store.edit(s => { s.workspace.visits[1].version = 2; }); });
  {
    const calls = [], fhir = async (i, orgId, e, path, init) => { calls.push({ path, init }); return { ...JSON.parse(init.body), id: 'srv-2' }; };
    const r = await exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r8.withdrawalId }, { fhir }, env);
    await check(() => { const w = wd(r8.withdrawalId); assert.equal(calls[0].init.headers['If-None-Exist'], 'identifier=' + encodeURIComponent('urn:saha:documents|' + w.id)); assert.equal(r.state, 'accepted'); assert.equal(w.receipt, 'Bundle/srv-2'); assert.match(w.message, /confirmed the amendment with receipt Bundle\/srv-2. The original receipt Bundle\/published-1 is kept unchanged/); });
  }

  // ---- 9. correction tasks (slice 2j): the withdrawal path completes them where the destination permits it
  const tasksOf = async (cause, edit) => { const s = await base(); edit?.(s); const { x } = view(s, 'doc'); return { s: x, tasks: C.correctionTasks(x, x.workspace.visits[0], cause, u('doc'), now, cause === 'amend' ? 'v2' : null) }; };
  await check(async () => { const { tasks } = await tasksOf('void'), by = id => tasks.find(t => t.output.refId === id);
    assert.equal(by('s1').action, 'send-withdrawal'); assert.match(by('s1').instruction, /Receipts tab prepare, approve and send a withdrawal.*Nothing is sent automatically/); assert.equal(by('s5').action, 'manual-correction', 'no delete permission: manual'); assert.match(by('s5').instruction, /reverse or void/);
    assert.equal(by('op1').action, 'send-withdrawal'); assert.equal(by('s4').action, 'look-up-first'); });
  await check(async () => { const { tasks } = await tasksOf('amend'), by = id => tasks.find(t => t.output.refId === id); assert.equal(by('op1').action, 'send-correction'); assert.match(by('op1').instruction, /permits amendment.*replaces that document/); assert.equal(by('s1').action, 'manual-correction', 'a withdrawal is not a correction of an amended visit (no correction support)'); });
  await check(async () => { const { tasks } = await tasksOf('amend', s => { s.workspace.integrations.find(i => i.id === 'ehr1').operations = ops(['create', 'lookup']); }); assert.equal(tasks.find(t => t.output.refId === 'op1').action, 'manual-correction'); assert.match(tasks.find(t => t.output.refId === 'op1').instruction, /not permitted to amend documents through Saha/); });
  // A void creates the send-withdrawal task; the confirmed withdrawal completes it with the verified receipt.
  store.setup(await base());
  await check(async () => { const { x } = view(store.saved, 'doc'); const v = x.workspace.visits[0]; v.correctionTasks = C.correctionTasks(x, v, 'void', u('doc'), now, null); v.voidedAt = now; v.voidReason = 'Wrong person'; store.edit(s => Object.assign(s, structuredClone(x))); assert.equal(v.correctionTasks.find(t => t.output.refId === 's1').state, 'open'); });
  const r9 = await prepare('asha'), task = () => store.saved.workspace.visits[0].correctionTasks.find(t => t.output.refId === 's1');
  await check(() => { assert.equal(wd(r9.withdrawalId).bound.visitStatus, 'voided', 'a withdrawal of a wrong-patient visit is bound to the voided visit'); });
  await run('asha', { type: 'approveWithdrawal', personId: 'p1', withdrawalId: r9.withdrawalId, payloadHash: r9.payloadHash });
  const e9 = await exec('asha', { type: 'executeWithdrawal', personId: 'p1', withdrawalId: r9.withdrawalId });
  await check(() => { const w = wd(r9.withdrawalId), t = task(); assert.equal(e9.state, 'accepted'); assert.deepEqual(e9.closedTasks, [t.id]); assert.equal(t.state, 'closed'); assert.equal(t.closed.verified, true); assert.equal(t.closed.receiptId, w.receipt); assert.equal(t.closed.by, 'asha'); assert.deepEqual(w.closedTaskIds, [t.id]);
    const a = store.saved.workspace.audit.find(x => x.action === 'closeCorrectionTask'); assert.match(a.detail, /by the confirmed withdrawal .* verified\. The original record and its receipt SIM-AAAA1111 were not changed/); });
  await check(() => { const other = store.saved.workspace.visits[0].correctionTasks.find(t => t.output.refId === 's2'); assert.equal(other.state, 'open', 'only the tasks of the withdrawn output are completed'); });
  // A task can also be closed with that receipt by hand, and a wrong receipt is refused.
  await check(async () => { const { x, mm } = view(store.saved, 'doc'), v = x.workspace.visits[0], t = v.correctionTasks.find(t => t.output.refId === 's1'); t.state = 'open'; delete t.closed;
    await status(() => C.applyCorrectionTask(x, { type: 'closeCorrectionTask', personId: 'p1', visitId: 'v1', taskId: t.id, receiptId: 'SIM-W-00000000' }, u('doc'), mm), 422);
    const r = C.applyCorrectionTask(x, { type: 'closeCorrectionTask', personId: 'p1', visitId: 'v1', taskId: t.id, receiptId: wd(r9.withdrawalId).receipt }, u('doc'), mm); assert.deepEqual(r, { taskId: t.id, state: 'closed', verified: true }); });
  // A void after a confirmed withdrawal adds no external task for that output.
  await check(async () => { const s = structuredClone(store.saved); s.workspace.visits[0].correctionTasks = []; const { x } = view(s, 'doc'); const tasks = C.correctionTasks(x, x.workspace.visits[0], 'void', u('doc'), now, null); assert.equal(tasks.some(t => t.output.refId === 's1'), false); assert.equal(tasks.find(t => t.output.refId === 's2').action, 'send-withdrawal'); });

  // ---- 10. trace: the withdrawal is its own thread, linked to its commands and audit events
  await check(() => { const s = store.saved, mm = s.members.find(x => x.userId === 'doc'); A.bindAccessPolicy(s); const t = T.traceTarget(s, mm, { visit: 'v1' }, now), l = T.traceLookups(s, t, now);
    assert.ok(l.subjects.includes(r9.withdrawalId)); const audit = s.workspace.audit.map((a, i) => ({ id: a.id, at: a.at, actor_name: a.actor, role: a.role, action: a.action, subject: a.subject, seq: i + 1 }));
    const tr = T.assembleTrace(s, mm, t, audit, [], now), th = tr.threads.find(x => x.id === 'withdrawal:' + r9.withdrawalId); assert.equal(tr.traceVersion, '1.2.0'); assert.equal(th.kind, 'withdrawal'); assert.equal(th.state, 'accepted'); assert.equal(th.receipt, wd(r9.withdrawalId).receipt);
    assert.ok(th.steps.filter(x => x.linked).length >= 2); assert.ok(tr.events.some(e => e.action === 'withdrawalReceipt' && e.steps.includes('withdrawal:' + r9.withdrawalId))); assert.ok(T.EXECUTION_ACTIONS.includes('executeWithdrawal')); });
  await check(() => { const s = structuredClone(store.saved), own = s.members.find(x => x.userId === 'own'); A.bindAccessPolicy(s); const t = T.traceTarget(s, own, { submission: 's1' }, now), tr = T.assembleTrace(s, own, t, [], [], now);
    assert.equal(tr.scope, 'redacted'); const th = tr.threads.find(x => x.kind === 'withdrawal'); assert.ok(th, 'the withdrawal of the focused submission'); assert.equal(th.receipt, null); assert.equal(th.receiptExists, true); assert.ok(!th.attempts.rule.includes('SIM-AAAA1111'), 'no receipt outside the care scope'); });

  writeFileSync('tests/withdrawal-contract-result.json', JSON.stringify({ passed, suite: 'withdrawal-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'withdrawal-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
