// Slice 3i referral-request queue contract: who may read it, scope, which requests are open, ordering,
// waiting age, decide/blocked state, links, the bound, and the long-waiting rule in the exception queue.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.referral-request-queue-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['referral-request-queue', 'exceptions', 'operations', 'referrals', 'referral-rules', 'access', 'delegation', 'adapter-operations','core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const q = await import(pathToFileURL(join(dir, 'referral-request-queue.js')));
  const x = await import(pathToFileURL(join(dir, 'exceptions.js')));
  const now = '2026-09-30T06:00:00.000Z', hoursAgo = h => new Date(Date.parse(now) - h * 3600000).toISOString(), ahead = h => hoursAgo(-h);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 1, teamId: 't1', assigned: false };
  const request = (h, over = {}) => ({ facility: 'Synthetic CHC', reason: 'Synthetic very high reading', requestedBy: 'asha', requestedAt: hoursAgo(h), capturedAt: hoursAgo(h), ...over });
  const visit = (id, personId, h, over = {}, req = {}) => ({ id, personId, version: 1, state: 'confirmed', facts: { date: hoursAgo(h).slice(0, 16) }, createdAt: hoursAgo(h), referralRequest: request(h, req), ...over });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'), member('sup2', 'supervisor', { teamIds: ['t2'] }), member('own', 'clinician', { isOwner: true }), member('ownadm', 'admin', { isOwner: true, teamIds: [] }), member('adm', 'admin', { teamIds: [] }), member('prov', 'provider', { teamIds: [] }), member('idle', 'clinician', { status: 'suspended' })],
    workspace: { role: 'supervisor', audit: [], integrations: [], submissions: [], referrals: [],
      people: [
        { ...base, id: 'p1', name: 'P1', village: 'V1', assignedTo: 'asha' },
        { ...base, id: 'p2', name: 'P2', village: 'V2', assignedTo: 'asha' },
        { ...base, id: 'p3', name: 'P3', village: 'V3', teamId: 't2', assignedTo: null, exceptionalAccess: [{ id: 'g1', userId: 'doc', reason: 'x', from: hoursAgo(1), until: ahead(2) }] },
        { ...base, id: 'p4', name: 'P4', village: 'V4', teamId: 't2', assignedTo: null }],
      visits: [
        visit('v1', 'p1', 72),                                                   // oldest, confirmed, long waiting
        visit('v2', 'p1', 5, { clinicalConcern: { value: 'yes', reference: 'x', by: 'asha', at: hoursAgo(5) } }), // newest but concern
        visit('v3', 'p2', 30, { state: 'draft' }),                               // not confirmed yet
        visit('v4', 'p2', 47),                                                   // just under the wait
        visit('v5', 'p2', 48, {}, { requestedBy: 'left' }),                      // exactly the wait; requester no longer a member
        visit('v6', 'p2', 90, {}, { decision: { decision: 'referred', by: 'doc', at: hoursAgo(80), reason: 'x', referralId: 'r1' } }),
        visit('v7', 'p2', 90, {}, { decision: { decision: 'declined', by: 'doc', at: hoursAgo(80), reason: 'x' } }),
        visit('v8', 'p2', 90, { voidedAt: hoursAgo(80) }),
        visit('v9', 'p2', 90, { supersededBy: 'v10' }),
        { id: 'v10', personId: 'p2', version: 1, state: 'confirmed', createdAt: hoursAgo(80) },   // no request
        visit('v11', 'p3', 60),                                                  // team 2, emergency access for doc
        visit('v12', 'p4', 100, { state: 'draft' }, { requestedBy: 'asha' })],   // team 2, not confirmed, long waiting
    },
  };
  const read = userId => q.referralRequestQueue(s, s.members.find(m => m.userId === userId), now);

  // Who may read: clinicians, supervisors, owners with a care role. Refused: ASHA, administrators (owner or not), provider, suspended.
  for (const u of ['asha', 'adm', 'ownadm', 'prov', 'idle']) status(() => read(u), 403);
  // Scope, open requests only, order: concern first then oldest.
  const doc = read('doc');
  check(() => assert.deepEqual(doc.items.map(i => i.visitId), ['v2', 'v1', 'v11', 'v5', 'v4', 'v3']));
  check(() => { assert.equal(doc.total, 6); assert.equal(doc.canDecide, true); assert.equal(doc.truncated, false); assert.equal(doc.waitHours, 48); assert.equal(doc.awaitingConfirmation, 1); });
  const sup = read('sup');
  check(() => { assert.deepEqual(sup.items.map(i => i.visitId), ['v2', 'v1', 'v5', 'v4', 'v3']); assert.equal(sup.canDecide, false); assert.ok(sup.items.every(i => !i.canDecide)); });
  // Owner authority does not widen scope: an owner of team 1 sees team 1 only.
  check(() => assert.deepEqual(read('own').items.map(i => i.visitId), ['v2', 'v1', 'v5', 'v4', 'v3']));
  check(() => assert.deepEqual(read('sup2').items.map(i => i.visitId), ['v12', 'v11']));
  check(() => assert.deepEqual(read('doc2').items.map(i => i.visitId), ['v12', 'v11']));
  // Item details.
  const by = id => doc.items.find(i => i.visitId === id);
  check(() => { const i = by('v1'); assert.equal(i.ageHours, 72); assert.equal(i.longWaiting, true); assert.equal(i.canDecide, true); assert.equal(i.blocker, null); assert.equal(i.requestedBy, 'ASHA'); assert.equal(i.facility, 'Synthetic CHC'); assert.equal(i.reason, 'Synthetic very high reading'); assert.deepEqual(i.patient, { id: 'p1', name: 'P1', village: 'V1' }); assert.deepEqual(i.link, { personId: 'p1', visitId: 'v1', href: '/?patient=p1&visit=v1' }); assert.equal(i.visit.state, 'confirmed'); });
  check(() => { assert.equal(by('v4').longWaiting, false); assert.equal(by('v4').ageHours, 47); assert.equal(by('v5').longWaiting, true); assert.equal(by('v5').requestedBy, 'Former member'); });
  check(() => { const i = by('v3'); assert.equal(i.canDecide, false); assert.match(i.blocker, /not confirmed/); });
  check(() => { assert.equal(by('v2').concern, 'yes'); assert.equal(by('v1').concern, null); });
  // The bound.
  const big = structuredClone(s);
  for (let n = 0; n < 520; n++) big.workspace.visits.push(visit(`b${n}`, 'p1', 10 + (n % 50)));
  const bounded = q.referralRequestQueue(big, big.members.find(m => m.userId === 'doc'), now);
  check(() => { assert.equal(bounded.total, 526); assert.equal(bounded.items.length, 500); assert.equal(bounded.truncated, true); });

  // Exception queue (rules 1.1.0): undecided requests on current visits waiting 48 hours or more.
  const ex = userId => x.exceptionQueue(s, s.members.find(m => m.userId === userId), now);
  const exSup = ex('sup'), waiting = exSup.items.filter(i => i.kind === 'referral-request-waiting');
  check(() => { assert.equal(exSup.rulesVersion, '1.3.0'); assert.deepEqual(waiting.map(i => i.id).sort(), ['referral-request-waiting:v1', 'referral-request-waiting:v5']); assert.equal(exSup.counts['referral-request-waiting'], 2); });
  check(() => { const i = waiting.find(i => i.id.endsWith(':v1')); assert.equal(i.severity, 'normal'); assert.equal(i.owner, 'Clinicians of Team One'); assert.match(i.what, /Synthetic CHC not decided$/); assert.equal(i.ageDays, 3); assert.deepEqual(i.link, { personId: 'p1', visitId: 'v1', href: '/?patient=p1&visit=v1' }); assert.match(i.recovery, /creates the referral or declines/); });
  const exSup2 = ex('sup2').items.filter(i => i.kind === 'referral-request-waiting');
  check(() => { assert.deepEqual(exSup2.map(i => i.id).sort(), ['referral-request-waiting:v11', 'referral-request-waiting:v12']); const u = exSup2.find(i => i.id.endsWith(':v12')); assert.equal(u.owner, 'ASHA'); assert.match(u.what, /not confirmed/); assert.match(u.recovery, /confirms it/); });
  // A recorded concern raises severity once the request has waited.
  const concern = structuredClone(s); concern.workspace.visits.find(v => v.id === 'v2').referralRequest.requestedAt = hoursAgo(50);
  check(() => assert.equal(x.exceptionQueue(concern, concern.members.find(m => m.userId === 'sup'), now).items.find(i => i.id === 'referral-request-waiting:v2').severity, 'high'));
  // Administrators see no patient rows of this kind.
  check(() => assert.equal(ex('adm').items.filter(i => i.kind === 'referral-request-waiting').length, 0));

  writeFileSync('tests/referral-request-queue-contract-result.json', JSON.stringify({ suite: 'referral request queue contract (slice 3i)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
