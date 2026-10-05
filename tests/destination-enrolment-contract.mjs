import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Slice r37: destination enrolment request/rejection/acceptance lifecycle against a mock programme destination (BR-PROG-06).
// Mirrors tests/mis-contract.mjs (pure module checks) and tests/mis-delivery.mjs (checkpoint/idempotency/receipt with an
// injected CAS store and transport). No network; the mock adapter decides accept/reject/lost deterministically.

const dir = mkdtempSync(join(process.cwd(), '.dest-enrol-'));
let passed = 0;
try {
  const modules = ['types', 'programmes', 'adapter-operations', 'service-dispatch','facility-scope','identity','service-identity','access','delegation','audit-chain','access-audit','core', 'fact-provenance', 'mis', 'destination-enrolment-adapter', 'destination-enrolment', 'destination-enrolment-execution'];
  for (const f of modules) {
    const code = ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, f + '.js'), code);
  }
  // Injectable persistence models the same compare-and-swap boundary; the API suite separately runs the real D1 path.
  writeFileSync(join(dir, 'store.js'), `import {AppError} from './core.js';
export let saved; export let failNextFinish = false;
export function setup(s, f = false) { saved = structuredClone(s); failNextFinish = f; }
export async function readState() { return structuredClone(saved); }
export function scope(s, id) { return s.members.find(m => m.userId === id); }
export async function persist(db, before, after, u, c) { if (failNextFinish && c.type === 'requestDestinationEnrolment' && after.workspace.audit.some(a => a.action === 'requestDestinationEnrolmentResult')) { failNextFinish = false; throw new AppError(409, 'Injected final-write conflict'); } if (before.organisation.revision !== saved.organisation.revision) throw new AppError(409, 'CAS conflict'); saved = structuredClone(after); saved.organisation.revision++; }`);

  const adapter = await import(pathToFileURL(join(dir, 'destination-enrolment-adapter.js')));
  const de = await import(pathToFileURL(join(dir, 'destination-enrolment.js')));
  const exec = await import(pathToFileURL(join(dir, 'destination-enrolment-execution.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));

  const check = fn => { fn(); passed++; };
  const rejects = async (fn, re) => { await assert.rejects(fn, re); passed++; };

  const now = new Date().toISOString();
  const makeEnrolment = () => ({ id: 'e1', packId: 'maternal', packVersion: 1, state: 'active', episodeLabel: 'ANC episode', startDate: null, createdAt: now, createdBy: 'worker', registration: 'not_submitted' });
  const makePerson = () => ({ id: 'p', name: 'Meena Devi', age: 26, sex: 'Female', village: 'Rampur', programmes: ['Maternal care', 'General care'], task: 'Home visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'default', assignedTo: null, enrolments: [makeEnrolment()], followUps: [] });
  const makeDest = (behavior = 'accept') => ({ id: 'dest1', name: 'Maternal & child register', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: 'Mock register', programmes: ['Maternal care', 'Child health'], behavior });
  const makeState = (behavior = 'accept') => ({ organisation: { id: 'org', revision: 1, name: 'Org', createdAt: now }, members: [{ userId: 'worker', displayName: 'Synthetic worker', accountCode: '', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now }, { userId: 'owner', displayName: 'Owner', accountCode: '', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now }, { userId: 'asha', displayName: 'ASHA', accountCode: '', role: 'asha', isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now }], teams: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [makePerson()], visits: [], integrations: [makeDest(behavior)], submissions: [], referrals: [], audit: [], receipts: {} } });
  const actor = { userId: 'worker', displayName: 'Synthetic worker', email: 'worker@example.invalid' };
  const member = m => ({ userId: m.userId, displayName: m.displayName, accountCode: '', role: m.role, isOwner: m.isOwner, status: 'active', version: 1, teamIds: ['default'], createdAt: now });

  // ---- mock adapter (pure) ----
  const s = makeState();
  check(() => assert.equal(adapter.enrolmentSimulatorRefusal('synthetic'), null));
  check(() => assert.match(adapter.enrolmentSimulatorRefusal('production'), /synthetic and training/));
  check(() => assert.equal(adapter.mockDestination(s, 'dest1', 'Maternal care').id, 'dest1'));
  check(() => assert.throws(() => adapter.mockDestination(s, 'dest1', 'TB screening'), /does not cover/));
  check(() => assert.throws(() => adapter.mockDestination(s, 'missing', 'Maternal care'), /active demonstration programme destination/));
  check(() => assert.throws(() => adapter.mockDestination({ ...s, workspace: { ...s.workspace, integrations: [{ ...makeDest(), mode: 'http' }] } }, 'dest1', 'Maternal care'), /mock adapter only/));
  const ph = 'a'.repeat(64);
  const accepted = adapter.mockEnrolment(makeDest('accept'), { key: 'k', payloadHash: ph, operation: 'request' });
  check(() => assert.equal(accepted.status, 'accepted'));
  check(() => assert.match(accepted.enrolmentRef, /^SIM-ENROL-/));
  const rejected = adapter.mockEnrolment(makeDest('reject'), { key: 'k', payloadHash: ph, operation: 'request' });
  check(() => { assert.equal(rejected.status, 'rejected'); assert.ok(rejected.reason && rejected.reason.length > 0); });
  check(() => assert.throws(() => adapter.mockEnrolment(makeDest('uncertain'), { key: 'k', payloadHash: ph, operation: 'request' }), /lost the response/));
  // A lookup on an uncertain destination finds the record (accepted), never throws.
  check(() => assert.equal(adapter.mockEnrolment(makeDest('uncertain'), { key: 'k', payloadHash: ph, operation: 'lookup' }).status, 'accepted'));

  // ---- schema ----
  check(() => assert.equal(de.destinationEnrolmentSchema.safeParse({ type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }).success, true));
  check(() => assert.equal(de.destinationEnrolmentSchema.safeParse({ type: 'lookupDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1' }).success, true));
  check(() => assert.equal(de.destinationEnrolmentSchema.safeParse({ type: 'activateDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', enrolmentVersion: 1, reason: 'Destination accepted' }).success, true));
  check(() => assert.equal(de.destinationEnrolmentSchema.safeParse({ type: 'activateDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', enrolmentVersion: 1, reason: 'no' }).success, false));
  check(() => assert.equal(de.destinationEnrolmentSchema.safeParse({ type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: -1 }).success, false));

  // ---- authorisation ----
  check(() => assert.throws(() => de.authorizeDestinationEnrolment(member({ ...s.members[2] }), { type: 'activateDestinationEnrolment' }), /clinician, supervisor or organisation owner/));
  check(() => de.authorizeDestinationEnrolment(member(s.members[0]), { type: 'requestDestinationEnrolment' }));
  check(() => assert.throws(() => de.authorizeDestinationEnrolment(member({ ...s.members[0], role: 'admin' }), { type: 'lookupDestinationEnrolment' }), /care role/));

  // ---- requestTarget validation ----
  const req = { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 };
  check(() => assert.equal(de.requestTarget(s, req, actor, member(s.members[0])).destination.id, 'dest1'));
  check(() => assert.throws(() => de.requestTarget(s, { ...req, destinationId: 'missing' }, actor, member(s.members[0])), /active demonstration programme destination/));
  check(() => assert.throws(() => de.requestTarget(s, { ...req, personId: 'p', version: 2 }, actor, member(s.members[0])), /changed/));
  check(() => assert.throws(() => de.requestTarget(s, { ...req, enrolmentVersion: 1 }, actor, member(s.members[0])), /changed/));

  // ---- receipt application ----
  const d = { version: 0, state: 'requested', destinationId: 'dest1', destinationName: 'Maternal & child register', payloadHash: ph, attempts: 1, delivery: { key: 'e1', actorId: 'worker', connectorVersion: 1, personVersion: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), events: [] }, history: [] };
  de.applyEnrolmentReceipt(d, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'accepted', enrolmentRef: 'SIM-ENROL-1' }, 'worker');
  check(() => { assert.equal(d.state, 'accepted'); assert.equal(d.destinationReceipt, 'SIM-ENROL-1'); assert.equal(d.version, 1); assert.equal(d.history.length, 1); });
  de.applyEnrolmentReceipt(d, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'accepted', enrolmentRef: 'SIM-ENROL-1' }, 'worker');
  check(() => assert.equal(d.delivery.events.length, 1)); // idempotent repeat adds no event
  check(() => assert.throws(() => de.applyEnrolmentReceipt(d, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'rejected', reason: 'x' }, 'worker'), /conflicting/));
  const d2 = { version: 0, state: 'requested', destinationId: 'dest1', destinationName: 'Maternal & child register', payloadHash: ph, attempts: 1, delivery: { key: 'e1', actorId: 'worker', connectorVersion: 1, personVersion: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), events: [] }, history: [] };
  de.applyEnrolmentReceipt(d2, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'rejected', reason: 'does not meet acceptance rules' }, 'worker');
  check(() => { assert.equal(d2.state, 'rejected'); assert.equal(d2.rejectionReason, 'does not meet acceptance rules'); });
  check(() => assert.throws(() => de.applyEnrolmentReceipt({ ...d2, state: 'requested' }, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'not_found' }, 'worker'), /lookup/));
  check(() => assert.throws(() => de.applyEnrolmentReceipt({ ...d2, state: 'requested' }, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'accepted' }, 'worker'), /enrolment reference/));
  check(() => assert.throws(() => de.applyEnrolmentReceipt({ ...d2, state: 'requested' }, { contract: 'saha-destination-enrolment-v1', key: 'other', payloadHash: ph, status: 'accepted', enrolmentRef: 'R' }, 'worker'), /match/));
  const d3 = { version: 0, state: 'requested', destinationId: 'dest1', destinationName: 'Maternal & child register', payloadHash: ph, attempts: 1, delivery: { key: 'e1', actorId: 'worker', connectorVersion: 1, personVersion: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), events: [] }, history: [] };
  de.applyEnrolmentReceipt(d3, { contract: 'saha-destination-enrolment-v1', key: 'e1', payloadHash: ph, status: 'not_found' }, 'worker', true);
  check(() => assert.equal(d3.state, 'retryable'));

  // ---- execution: accepted (happy path) ----
  const acceptT = async (_d, body) => ({ contract: 'saha-destination-enrolment-v1', key: body.key, payloadHash: body.payloadHash, status: 'accepted', enrolmentRef: 'SIM-ENROL-ABC12345' });
  const rejectT = async (_d, body) => ({ contract: 'saha-destination-enrolment-v1', key: body.key, payloadHash: body.payloadHash, status: 'rejected', reason: 'The destination declined this enrolment (mock).' });
  const lostT = async () => { throw new Error('lost'); };
  const notFoundT = async (_d, body) => ({ contract: 'saha-destination-enrolment-v1', key: body.key, payloadHash: body.payloadHash, status: 'not_found' });

  let calls = 0;
  store.setup(makeState());
  await exec.executeDestinationEnrolment({}, structuredClone(makeState()), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k1', 'hash', 'synthetic', async (_d, body) => { calls++; return acceptT(_d, body); });
  let enrolled = store.saved.workspace.people[0].enrolments[0];
  check(() => { assert.equal(enrolled.destinationEnrolment.state, 'accepted'); assert.equal(enrolled.destinationEnrolment.destinationReceipt, 'SIM-ENROL-ABC12345'); assert.equal(enrolled.registration, 'not_submitted'); });
  check(() => assert.equal(calls, 1));

  // ---- execution: rejected stays locally visible, no false enrolled status ----
  store.setup(makeState('reject'));
  const rejResult = await exec.executeDestinationEnrolment({}, structuredClone(makeState('reject')), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k2', 'hash', 'synthetic', rejectT);
  enrolled = store.saved.workspace.people[0].enrolments[0];
  check(() => { assert.equal(enrolled.destinationEnrolment.state, 'rejected'); assert.match(enrolled.destinationEnrolment.rejectionReason, /declined/); assert.equal(enrolled.registration, 'not_submitted'); assert.equal(enrolled.state, 'active'); });
  check(() => { assert.equal(rejResult.state, 'rejected'); assert.ok(rejResult.rejectionReason); });

  // ---- execution: lost response -> uncertain -> lookup accepted (reconciliation) ----
  store.setup(makeState('uncertain'));
  await exec.executeDestinationEnrolment({}, structuredClone(makeState('uncertain')), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k3', 'hash', 'synthetic', lostT);
  check(() => assert.equal(store.saved.workspace.people[0].enrolments[0].destinationEnrolment.state, 'uncertain'));
  await exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'lookupDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1' }, actor, member(makeState().members[0]), 'k4', 'hash', 'synthetic', acceptT);
  enrolled = store.saved.workspace.people[0].enrolments[0];
  check(() => { assert.equal(enrolled.destinationEnrolment.state, 'accepted'); assert.equal(enrolled.destinationEnrolment.destinationReceipt, 'SIM-ENROL-ABC12345'); });
  // A lookup is only allowed while the request is unresolved; it was already accepted above, so a repeat is refused.
  await rejects(() => exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'lookupDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1' }, actor, member(makeState().members[0]), 'k4b', 'hash', 'synthetic', acceptT), /unresolved/);

  // ---- execution: lookup not_found -> retryable -> re-request reuses key ----
  store.setup(makeState('uncertain'));
  await exec.executeDestinationEnrolment({}, structuredClone(makeState('uncertain')), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k5', 'hash', 'synthetic', lostT);
  await exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'lookupDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1' }, actor, member(makeState().members[0]), 'k6', 'hash', 'synthetic', notFoundT);
  check(() => assert.equal(store.saved.workspace.people[0].enrolments[0].destinationEnrolment.state, 'retryable'));
  // A second worker may not look up on the original worker's behalf.
  const otherActor = { userId: 'other', displayName: 'Other', email: 'other@example.invalid' };
  store.setup(makeState('uncertain'));
  await exec.executeDestinationEnrolment({}, structuredClone(makeState('uncertain')), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k7', 'hash', 'synthetic', lostT);
  await rejects(() => exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'lookupDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1' }, otherActor, member(makeState().members[0]), 'k8', 'hash', 'synthetic', acceptT), /original requesting worker/);

  // ---- execution: activate accepted -> active, registration submitted ----
  store.setup(makeState());
  await exec.executeDestinationEnrolment({}, structuredClone(makeState()), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k9', 'hash', 'synthetic', acceptT);
  check(() => assert.equal(store.saved.workspace.people[0].enrolments[0].destinationEnrolment.version, 1));
  await exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'activateDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', enrolmentVersion: 1, reason: 'Destination accepted; programme authorisation recorded.' }, member(makeState().members[1]), member(makeState().members[1]), 'k10', 'hash', 'synthetic', acceptT);
  enrolled = store.saved.workspace.people[0].enrolments[0];
  check(() => { assert.equal(enrolled.destinationEnrolment.state, 'active'); assert.equal(enrolled.registration, 'submitted'); assert.equal(enrolled.destinationEnrolment.version, 2); });
  // An ASHA may not activate.
  store.setup(makeState());
  await exec.executeDestinationEnrolment({}, structuredClone(makeState()), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k11', 'hash', 'synthetic', acceptT);
  await rejects(() => exec.executeDestinationEnrolment({}, structuredClone(store.saved), { type: 'activateDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', enrolmentVersion: 1, reason: 'Wrong role' }, member(makeState().members[2]), member(makeState().members[2]), 'k12', 'hash', 'synthetic', acceptT), /clinician, supervisor or organisation owner/);

  // ---- execution: environment gate refuses the simulator ----
  await rejects(() => exec.executeDestinationEnrolment({}, structuredClone(makeState()), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k13', 'hash', 'production', acceptT), /synthetic and training/);

  // ---- execution: a CAS conflict on the final write is retried, not lost ----
  // The injected store throws one 409 on the first final write; finish() re-reads the checkpoint and applies the
  // receipt again, so the accepted outcome is still committed exactly once.
  store.setup(makeState(), true);
  await exec.executeDestinationEnrolment({}, structuredClone(makeState()), { type: 'requestDestinationEnrolment', personId: 'p', version: 1, enrolmentId: 'e1', destinationId: 'dest1', enrolmentVersion: 0 }, actor, member(makeState().members[0]), 'k14', 'hash', 'synthetic', acceptT);
  check(() => assert.equal(store.saved.workspace.people[0].enrolments[0].destinationEnrolment.state, 'accepted'));

  const result = { passed, suite: 'destination enrolment contract (slice feat/r37)', liveSystemsTested: 0, completedAt: new Date().toISOString() };
  writeFileSync('tests/destination-enrolment-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
