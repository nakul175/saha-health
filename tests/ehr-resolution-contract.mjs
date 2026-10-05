// Slice 7f: definitive resolution of uncertain EHR publications (BR-INT-04, BR-INT-21).
//
// Runs the real setEhrLookupPolicy command (applyEhr), the real search classification (classifySearch), the real
// executeEhr lookup and publication paths and the real exception queue against an injected FHIR transport and an
// in-memory compare-and-swap store. Checks: the policy command's authority and validation; the default (no policy)
// keeps the earlier rule; with an authoritative search an empty result inside the consistency delay stays unknown,
// after it the publication is not stored and may be prepared again but is never resent; several matches or a
// different document are a conflict named to the reconciliation owner; a policy change during a lookup voids a
// definitive answer; the lookup attempt limit; the external-request audit event is written (and linked in the trace)
// before the lookup request, and nothing is requested if it cannot be written; a lookup never sends a document; the
// write must start inside the attempt window.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.ehr-resolution-'));
let passed = 0;
const check = async fn => { await fn(); passed++; };
const status = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'access-audit', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'ehr-execution', 'ehr-provider', 'environment', 'evaluation', 'exceptional', 'exceptions', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'referrals', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'trace', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';
export let saved;let hook=null;export function setup(s){saved=structuredClone(s);hook=null}export function setHook(f){hook=f}export function edit(f){f(saved)}
export async function readState(){return structuredClone(saved)}
export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}
export async function persist(db,before,after,u,c){if(hook)await hook(c,after);if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;}`);
  // The slice 6t access audit, stubbed: records the event (and the order of events and requests), or fails closed.
  writeFileSync(join(dir, 'access-audit.js'), `import {AppError} from './core.js';
export const calls=[];export const order=[];let failing=false;export function setFailing(x){failing=x}
export async function recordAccess(db,s,u,m,a){if(failing)throw new AppError(503,'Saha could not record this access in the audit log, so it was stopped: nothing was shown or sent.');const e={id:'ev-'+(calls.length+1),...a};calls.push(e);order.push('audit:'+e.id);return e;}`);
  const store = await import(pathToFileURL(join(dir, 'store.js'))), audit = await import(pathToFileURL(join(dir, 'access-audit.js')));
  const { executeEhr } = await import(pathToFileURL(join(dir, 'ehr-execution.js'))), E = await import(pathToFileURL(join(dir, 'ehr.js'))), { classifySearch } = await import(pathToFileURL(join(dir, 'ehr-provider.js'))), { exceptionQueue } = await import(pathToFileURL(join(dir, 'exceptions.js')));
  const at = new Date().toISOString();
  const mem = (userId, displayName, role, isOwner) => ({ userId, displayName, accountCode: 'X', role, isOwner, status: 'active', version: 1, teamIds: ['t1'], createdAt: at });
  const owner = mem('own', 'Owner Olu', 'clinician', true), admin = mem('adm', 'Admin Ada', 'admin', false), care = mem('care', 'Care Chidi', 'clinician', false);
  const i = { id: 'ehr1', kind: 'ehr', mode: 'http', status: 'active', version: 1, name: 'Synthetic EHR', endpoint: 'https://ehr.example/fhir', credentialBinding: 'SAHA_EHR_TEST', ehr: { read: true, write: true } };
  const p = { id: 'p', name: 'Test Person', sex: 'Other', age: 30, village: 'Test village', version: 1, consentVersion: 1, exchangeConsent: true, assigned: true, teamId: 't1', createdAt: at };
  const v = { id: 'v', personId: 'p', version: 1, state: 'confirmed', facts: { date: at.slice(0, 16), source: 'reported', weight: '55', notes: 'Synthetic visit' } };
  const env = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_EHR_TEST: 'test-secret', SAHA_EHR_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: i.id, baseUrl: i.endpoint, credentialBinding: i.credentialBinding }]) };
  const base = { organisation: { id: 'org', name: 'Test organisation', revision: 1 }, teams: [{ id: 't1', name: 'Team One' }], invitations: [], members: [owner, admin, care], workspace: { role: 'clinician', people: [p], visits: [v], integrations: [i], submissions: [], referrals: [], audit: [] } };
  await E.applyEhr(base, { type: 'linkEhr', personId: 'p', version: 1, integrationId: 'ehr1', externalId: 'external-1', externalName: 'Test Person', reason: 'Check synthetic ID', confirmed: true }, care, care, env);
  const linkId = p.ehr.links[0].id;
  await E.applyEhr(base, { type: 'grantEhrPermission', personId: 'p', linkId, direction: 'write', purpose: 'care-coordination', from: '2026-01-01T00:00:00.000Z', to: new Date(Date.now() + 600000).toISOString(), expiresAt: new Date(Date.now() + 6000000).toISOString() }, care, care, env);
  const permissionId = p.ehr.permissions[0].id;
  const policy = (over = {}) => ({ type: 'setEhrLookupPolicy', integrationId: 'ehr1', version: 0, authoritative: true, consistencySeconds: 60, ownerId: 'adm', reason: 'Partner contract 4.2: search is authoritative', ...over });

  // ---- 1. the policy command
  await check(() => { const d = E.lookupPolicyOf(i); assert.deepEqual(d, { version: 0, authoritative: false, declared: false, consistencySeconds: 0, ownerId: null }); });
  await check(async () => {
    const s = structuredClone(base);
    await status(() => E.applyEhr(s, policy(), care, care, env), 403);
    await status(() => E.applyEhr(s, policy({ ownerId: null }), owner, owner, env), 422, /reconciliation owner/);
    await status(() => E.applyEhr(s, policy({ ownerId: 'care' }), owner, owner, env), 422, /owner or administrator/);
    await status(() => E.applyEhr(s, policy({ ownerId: 'nobody' }), owner, owner, env), 422);
    await status(() => E.applyEhr(s, policy({ version: 1 }), owner, owner, env), 409);
    const noWrite = structuredClone(base); noWrite.workspace.integrations[0].ehr.write = false;
    await status(() => E.applyEhr(noWrite, policy(), owner, owner, env), 422, /document storage/);
    await status(() => E.applyEhr(s, policy({ authoritative: false, ownerId: null }), owner, owner, env), 409, /Nothing changed/);
    const r = await E.applyEhr(s, policy(), owner, owner, env);
    assert.deepEqual(r, { integrationId: 'ehr1', version: 1, authoritative: true, consistencySeconds: 60, ownerId: 'adm' });
    assert.equal(s.workspace.integrations[0].version, 1, 'the lookup policy does not change the connection version (uncertain publications stay lookup-able)');
    assert.equal(s.workspace.audit.at(-1).action, 'setEhrLookupPolicy'); assert.match(s.workspace.audit.at(-1).detail, /Admin Ada.*version 1.*Partner contract 4\.2/);
    await status(() => E.applyEhr(s, policy({ version: 1 }), owner, owner, env), 409, /Nothing changed/);
    await E.applyEhr(s, policy({ version: 1, ownerId: 'own', consistencySeconds: 120 }), owner, owner, env);
    assert.equal(s.workspace.integrations[0].ehr.lookup.version, 2); assert.equal(s.workspace.integrations[0].ehr.lookup.history.length, 1); assert.equal(s.workspace.integrations[0].ehr.lookup.history[0].ownerId, 'adm');
    // Reconfiguring capabilities keeps the lookup policy; turning document storage off makes it inactive, not deleted.
    await E.applyEhr(s, { type: 'configureEhr', integrationId: 'ehr1', version: 1, read: true, write: false }, owner, owner, env);
    assert.equal(s.workspace.integrations[0].ehr.lookup.version, 2); assert.equal(E.lookupPolicyOf(s.workspace.integrations[0]).authoritative, false); assert.equal(E.lookupPolicyOf(s.workspace.integrations[0]).declared, true);
  });

  // ---- 2. search classification
  const doc = { resourceType: 'Bundle', type: 'document', identifier: { system: 'urn:saha:documents', value: 'x' } };
  const auth = { authoritative: true, consistencySeconds: 60 }, none = { authoritative: false, consistencySeconds: 0 }, old = new Date(Date.now() - 200000).toISOString(), fresh = new Date().toISOString();
  const set = (entries, total) => ({ resourceType: 'Bundle', type: 'searchset', ...(total === undefined ? {} : { total }), entry: entries });
  await check(async () => {
    await status(() => classifySearch(set([]), doc, 'external-1', none, old), 502, /exactly one/);
    await status(() => classifySearch(set([{ resource: doc }, { resource: doc }]), doc, 'external-1', none, old), 502, /exactly one/);
    assert.equal(classifySearch(set([], 0), doc, 'external-1', auth, fresh).outcome, 'wait');
    assert.equal(classifySearch(set([], 0), doc, 'external-1', auth, old).outcome, 'not-stored');
    assert.equal(classifySearch({ resourceType: 'Bundle', type: 'searchset' }, doc, 'external-1', auth, old).outcome, 'not-stored');
    assert.deepEqual(classifySearch(set([{ resource: doc }, { resource: doc }], 2), doc, 'external-1', auth, fresh), { outcome: 'conflict', matches: 2, detail: "2 documents in the EHR carry this publication's identifier." });
    assert.equal(classifySearch(set([{ resource: doc }, { resource: doc }], 3), doc, 'external-1', auth, fresh).matches, 3);
    await status(() => classifySearch(set([], 1), doc, 'external-1', auth, old), 502, /inconsistent/);
    await status(() => classifySearch(set([{ resource: doc }], 0), doc, 'external-1', auth, old), 502, /inconsistent/);
    await status(() => classifySearch({ resourceType: 'OperationOutcome' }, doc, 'external-1', auth, old), 502);
    // An OperationOutcome entry (search mode "outcome") is not a match.
    assert.equal(classifySearch(set([{ resource: { resourceType: 'OperationOutcome' }, search: { mode: 'outcome' } }], 0), doc, 'external-1', auth, old).outcome, 'not-stored');
    // One match that is not the published document is a conflict, never a receipt.
    const c = classifySearch(set([{ resource: { resourceType: 'Patient' } }], 1), doc, 'external-1', auth, old); assert.equal(c.outcome, 'conflict'); assert.equal(c.matches, 1);
  });

  // ---- 3. execution with an authoritative policy
  const remote = { resourceType: 'Patient', id: 'external-1', name: [{ text: 'Test Person' }] };
  let requests = [];
  const searchTransport = answer => async (ii, org, e, path, init) => { requests.push({ path, init }); audit.order.push('request'); if (!path.startsWith('Bundle?identifier=')) throw Error('Only a lookup may be requested: ' + path); assert.equal(init, undefined, 'A lookup carries no body'); return typeof answer === 'function' ? answer() : answer; };
  const fresh0 = async (withPolicy) => {
    const s = structuredClone(base); if (withPolicy) await E.applyEhr(s, policy(), owner, owner, env);
    await E.applyEhr(s, { type: 'prepareEhrPublish', personId: 'p', linkId, permissionId, visitId: 'v' }, care, care, env);
    const op = s.workspace.people[0].ehr.operations.at(-1); store.setup(s); requests = [];
    // The write is sent and its response lost: the outcome is unknown.
    const r = await executeEhr({}, await store.readState(), { type: 'executeEhrPublish', personId: 'p', operationId: op.id, hash: op.hash }, care, care, 'k-send', 'h', env, async (ii, org, e, path, init) => { if (path.startsWith('Patient/')) return remote; requests.push({ path, init }); throw Error('Response lost'); });
    assert.equal(r.state, 'uncertain'); assert.equal(requests.length, 1);
    return op;
  };
  const opNow = id => store.saved.workspace.people[0].ehr.operations.find(o => o.id === id);
  const lookup = (op, key, transport) => executeEhr({}, store.saved && structuredClone(store.saved), { type: 'lookupEhrPublish', personId: 'p', operationId: op.id }, care, care, key, 'h', env, transport);
  const backdate = (op, seconds) => store.edit(s => { const o = s.workspace.people[0].ehr.operations.find(x => x.id === op.id); o.publishStartedAt = new Date(Date.parse(o.publishStartedAt) - seconds * 1000).toISOString(); });
  let notStoredOp;
  await check(async () => {
    const op = await fresh0(true); assert.ok(opNow(op.id).publishStartedAt, 'the checkpoint records when the publication was attempted');
    audit.calls.length = 0; audit.order.length = 0; requests = [];
    // Inside the consistency delay an empty search is not definitive.
    const r1 = await lookup(op, 'l1', searchTransport(set([], 0)));
    assert.equal(r1.state, 'uncertain'); assert.match(opNow(op.id).message, /60-second consistency delay has not passed/); assert.equal(opNow(op.id).lookups, 1); assert.equal(opNow(op.id).resolution, undefined);
    assert.deepEqual(audit.order, ['audit:ev-1', 'request'], 'the external-request event is written before the lookup request');
    assert.equal(audit.calls[0].action, 'externalRequest'); assert.match(audit.calls[0].detail, /^lookupEhrPublish: identifier search .* \(lookup 1 of at most 24; search authoritative, policy version 1\) about to be sent\. No document is sent\./);
    // After the attempt window and the delay, the same empty search means the document is not stored.
    backdate(op, 45 + 60 + 1);
    const r2 = await lookup(op, 'l2', searchTransport(set([], 0)));
    assert.equal(r2.state, 'not-stored'); assert.match(r2.message, /^Not stored: .*Nothing was resent\. If the document is still needed, prepare a new publication/);
    const o = opNow(op.id); assert.equal(o.lookups, 2); assert.deepEqual({ ...o.resolution, at: null }, { outcome: 'not-stored', matches: 0, policyVersion: 1, at: null, key: 'l2', detail: "No document with this identifier after the partner's 60-second consistency delay." });
    const step = o.events.find(x => x.state === 'lookup request' && x.ref.key === 'l2'); assert.deepEqual(step.ref, { command: 'lookupEhrPublish', key: 'l2', actorId: 'care', auditId: 'ev-2' }, 'the lookup request step is linked to its external-request audit event');
    assert.equal(store.saved.workspace.audit.at(-1).action, 'ehrReceipt'); assert.match(store.saved.workspace.audit.at(-1).detail, /^Not stored/);
    notStoredOp = op;
  });
  await check(async () => {
    // Never resent: approving it again or looking it up again sends nothing.
    requests = [];
    const r = await executeEhr({}, structuredClone(store.saved), { type: 'executeEhrPublish', personId: 'p', operationId: notStoredOp.id, hash: notStoredOp.hash }, care, care, 'k-again', 'h', env, async () => { throw Error('Must not be resent'); });
    assert.equal(r.state, 'not-stored'); assert.equal(requests.length, 0);
    await status(() => lookup(notStoredOp, 'l3', searchTransport(set([], 0))), 409, /Only an unresolved publication/); assert.equal(requests.length, 0);
    // A new publication of the same visit may be prepared through the normal approval path (a new identifier).
    const s = structuredClone(store.saved); const r2 = await E.applyEhr(s, { type: 'prepareEhrPublish', personId: 'p', linkId, permissionId, visitId: 'v' }, care, care, env);
    assert.notEqual(r2.operationId, notStoredOp.id); assert.equal(s.workspace.people[0].ehr.operations.at(-1).state, 'prepared');
    // The exception queue lists it as not stored (normal severity) until that new publication exists.
    const q = exceptionQueue(store.saved, admin), row = q.items.find(x => x.id === 'ehr-publication:' + notStoredOp.id);
    assert.equal(row.severity, 'normal'); assert.match(row.what, /not stored/); assert.match(row.recovery, /Nothing was resent/); assert.equal(q.rulesVersion, '1.3.0');
    assert.equal(exceptionQueue(s, admin).items.some(x => x.id === 'ehr-publication:' + notStoredOp.id), false);
    // Preparation can append within the same millisecond. Only a later appended operation suppresses the resolved row.
    const sameTime = structuredClone(s), operations = sameTime.workspace.people[0].ehr.operations;
    const previous = operations.find(x => x.id === notStoredOp.id), replacement = operations.at(-1);
    replacement.at = previous.at;
    assert.equal(exceptionQueue(sameTime, admin).items.some(x => x.id === 'ehr-publication:' + notStoredOp.id), false);
    replacement.linkId = 'another-link';
    assert.equal(exceptionQueue(sameTime, admin).items.some(x => x.id === 'ehr-publication:' + notStoredOp.id), true);
    replacement.linkId = previous.linkId; replacement.at = new Date(Date.parse(previous.at) - 1).toISOString();
    assert.equal(exceptionQueue(sameTime, admin).items.some(x => x.id === 'ehr-publication:' + notStoredOp.id), true);
  });
  await check(async () => {
    // Several documents under one identifier: a conflict for the named reconciliation owner.
    const op = await fresh0(true); requests = [];
    const r = await lookup(op, 'c1', searchTransport(set([{ resource: { ...op.bundle, id: 'a' } }, { resource: { ...op.bundle, id: 'b' } }], 2)));
    assert.equal(r.state, 'conflict'); assert.match(r.message, /^Conflict: 2 documents .* Admin Ada, the reconciliation owner, resolves this with the partner; do not publish again\./);
    assert.equal(opNow(op.id).resolution.outcome, 'conflict'); assert.equal(opNow(op.id).resolution.matches, 2);
    const q = exceptionQueue(store.saved, admin), row = q.items.find(x => x.id === 'ehr-publication:' + op.id);
    assert.equal(row.severity, 'high'); assert.equal(row.owner, 'Admin Ada (reconciliation owner)'); assert.match(row.what, /conflict: 2 documents/); assert.equal(row.patient, null, 'an administrator sees the row redacted');
    // No new publication of that visit while the conflict stands, and the conflicted one is never resent or looked up again.
    await status(() => E.applyEhr(structuredClone(store.saved), { type: 'prepareEhrPublish', personId: 'p', linkId, permissionId, visitId: 'v' }, care, care, env), 409, /prior external delivery/);
    const again = await executeEhr({}, structuredClone(store.saved), { type: 'executeEhrPublish', personId: 'p', operationId: op.id, hash: op.hash }, care, care, 'c2', 'h', env, async () => { throw Error('Must not be resent'); });
    assert.equal(again.state, 'conflict');
    await status(() => lookup(op, 'c3', searchTransport(set([], 0))), 409);
  });
  await check(async () => {
    // One match that differs from the published document is a conflict too.
    const op = await fresh0(true);
    const r = await lookup(op, 'd1', searchTransport(() => set([{ resource: { ...op.bundle, id: 'a', entry: op.bundle.entry.slice(0, -1) } }], 1)));
    assert.equal(r.state, 'conflict'); assert.equal(opNow(op.id).resolution.matches, 1); assert.match(exceptionQueue(store.saved, admin).items.find(x => x.id === 'ehr-publication:' + op.id).what, /differs from the published document/);
    // Exactly one matching document is accepted with its receipt, under either policy.
    const op2 = await fresh0(true);
    const ok = await lookup(op2, 'd2', searchTransport(() => set([{ resource: { ...op2.bundle, id: 'stored-9' } }], 1)));
    assert.equal(ok.state, 'accepted'); assert.equal(opNow(op2.id).receipt, 'Bundle/stored-9'); assert.equal(opNow(op2.id).resolution.outcome, 'found');
  });

  // ---- 4. the default (non-authoritative) behaviour is unchanged
  await check(async () => {
    const op = await fresh0(false); backdate(op, 3600);
    const r = await lookup(op, 'n1', searchTransport(set([], 0)));
    assert.equal(r.state, 'uncertain'); assert.equal(opNow(op.id).message, 'No definitive EHR acknowledgement. Look up the document identifier before further action.'); assert.equal(opNow(op.id).resolution, undefined);
    const r2 = await lookup(op, 'n2', searchTransport(set([{ resource: { ...op.bundle, id: 'a' } }, { resource: { ...op.bundle, id: 'b' } }], 2)));
    assert.equal(r2.state, 'uncertain');
    const row = exceptionQueue(store.saved, admin).items.find(x => x.id === 'ehr-publication:' + op.id); assert.equal(row.owner, 'Operations (owner or administrator)'); assert.match(row.what, /outcome unknown/);
    const ok = await lookup(op, 'n3', searchTransport(() => set([{ resource: { ...op.bundle, id: 'stored-1' } }], 1)));
    assert.equal(ok.state, 'accepted'); assert.equal(opNow(op.id).resolution.policyVersion, 0);
  });

  // ---- 5. guards
  await check(async () => {
    // A policy change during the lookup voids its definitive answer.
    const op = await fresh0(true); backdate(op, 200);
    const r = await lookup(op, 'g1', searchTransport(() => { store.edit(s => { s.workspace.integrations[0].ehr.lookup.version = 2; s.workspace.integrations[0].ehr.lookup.authoritative = false; }); return set([], 0); }));
    assert.equal(r.state, 'uncertain'); assert.match(opNow(op.id).message, /lookup policy changed during the lookup/);
    // The reconciliation owner is also named on rows whose outcome is still unknown.
    store.edit(s => { s.workspace.integrations[0].ehr.lookup.ownerId = 'own'; });
    assert.equal(exceptionQueue(store.saved, admin).items.find(x => x.id === 'ehr-publication:' + op.id).owner, 'Owner Olu (reconciliation owner)');
  });
  await check(async () => {
    // The lookup attempt limit: nothing is requested once a publication has had EHR_LOOKUP_LIMIT lookups.
    const op = await fresh0(true); store.edit(s => { s.workspace.people[0].ehr.operations.find(x => x.id === op.id).lookups = E.EHR_LOOKUP_LIMIT; }); requests = []; audit.calls.length = 0;
    await status(() => lookup(op, 'm1', searchTransport(set([], 0))), 409, /24 receipt lookups, the limit/);
    assert.equal(requests.length, 0); assert.equal(audit.calls.length, 0); assert.equal(opNow(op.id).state, 'uncertain');
  });
  await check(async () => {
    // Fail closed: if the external-request event cannot be written, no lookup request is sent.
    const op = await fresh0(true); backdate(op, 200); requests = []; audit.setFailing(true);
    const r = await lookup(op, 'a1', searchTransport(set([], 0))); audit.setFailing(false);
    assert.equal(r.state, 'uncertain'); assert.equal(requests.length, 0); assert.match(opNow(op.id).message, /^Receipt lookup not made: it could not be recorded in the audit log/);
  });
  await check(async () => {
    // A concurrent definitive answer is never overwritten by a later lookup's final write.
    const op = await fresh0(true); backdate(op, 200);
    store.setHook((c, after) => { if (c.type === 'ehrReceipt') { store.setHook(null); store.edit(s => { const o = s.workspace.people[0].ehr.operations.find(x => x.id === op.id); o.state = 'conflict'; s.organisation.revision++; }); } });
    const r = await lookup(op, 'x1', searchTransport(set([], 0)));
    assert.equal(r.state, 'conflict'); assert.equal(opNow(op.id).state, 'conflict');
  });
  await check(async () => {
    // The write starts inside the attempt window or not at all: slow pre-write steps close the publication as not sent.
    const s = structuredClone(base); await E.applyEhr(s, { type: 'prepareEhrPublish', personId: 'p', linkId, permissionId, visitId: 'v' }, care, care, env);
    const op = s.workspace.people[0].ehr.operations.at(-1); store.setup(s); let writes = 0, r; const realNow = Date.now;
    try { r = await executeEhr({}, structuredClone(store.saved), { type: 'executeEhrPublish', personId: 'p', operationId: op.id, hash: op.hash }, care, care, 'w1', 'h', env, async (ii, org, e, path) => { if (path.startsWith('Patient/')) { Date.now = () => realNow() + 31000; return remote; } writes++; throw Error('must not write'); }); } finally { Date.now = realNow; }
    assert.equal(writes, 0); assert.equal(r.state, 'blocked'); assert.match(r.message, /^Not sent: The publication did not reach its write step within 30 seconds/);
  });

  const result = { passed, suite: 'EHR publication resolution: lookup policy, authoritative search outcomes, reconciliation owner, attempt limit and request audit', completedAt: new Date().toISOString() };
  writeFileSync('tests/ehr-resolution-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(result);
} finally { rmSync(dir, { recursive: true, force: true }); }
