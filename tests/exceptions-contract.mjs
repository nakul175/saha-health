// Slice 6i exception-queue contract: every exception kind, ordering, item links and viewer scope.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.exceptions-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['exceptions', 'operations', 'referrals', 'referral-rules', 'access', 'core','fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'exceptions.js')));
  const now = '2026-09-30T06:00:00.000Z', ago = n => new Date(Date.parse(now) - n * 86400000).toISOString(), agoDate = n => ago(n).slice(0, 10), ahead = n => ago(-n);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 1, teamId: 't1', assigned: false };
  const sub = (id, personId, state, over = {}) => ({ id, visitId: 'v1', personId, connectorId: 'mis-a', connectorName: 'Synthetic MIS', state, mode: 'demo', payloadHash: 'h', attempts: 1, message: '', createdAt: ago(3), updatedAt: ago(3), ...over });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('doc', 'clinician'), member('sup', 'supervisor'), member('sup2', 'supervisor', { teamIds: ['t2'] }), member('own', 'clinician', { isOwner: true }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('gone', 'asha', { status: 'suspended' }), member('idle', 'supervisor', { status: 'suspended' })],
    workspace: { role: 'supervisor', audit: [], integrations: [],
      people: [
        { ...base, id: 'p1', name: 'P1', assignedTo: 'asha', identityReview: { state: 'provisional', by: 'asha', at: ago(4), reason: 'x', candidateCount: 1 },
          followUps: [{ id: 'f1', enrolmentId: 'e', packId: 'tb', title: 'Sputum check', due: agoDate(6), ownerId: 'gone', state: 'open' }, { id: 'f2', enrolmentId: 'e', packId: 'tb', title: 'Later', due: agoDate(-3), ownerId: 'asha', state: 'open' }],
          ehr: { links: [], permissions: [], documents: [], operations: [{ id: 'e1', state: 'uncertain', visitId: 'v1', at: ago(2) }, { id: 'e2', state: 'running', visitId: 'v1', at: ago(1) }, { id: 'e3', state: 'running', visitId: 'v1', at: new Date(Date.parse(now) - 60000).toISOString() }, { id: 'e4', state: 'accepted', visitId: 'v1', at: ago(9) }] },
          fieldLeases: [{ id: 'l1', actorId: 'asha', visitId: 'v1', status: 'active', expiresAt: ago(1) }, { id: 'l2', actorId: 'asha', visitId: 'v1', status: 'active', expiresAt: ahead(1) }, { id: 'l3', actorId: 'asha', visitId: 'v1', status: 'synced', expiresAt: ago(3) }],
          abdmReceived: [{ id: 'a1', hiType: 'OPConsultation', state: 'review', receivedAt: ago(1) }, { id: 'a2', hiType: 'Prescription', state: 'accepted', receivedAt: ago(1) }],
          exceptionalAccess: [{ id: 'g1', userId: 'doc', reason: 'x', from: ago(3), until: ago(2), closedAt: ago(2) }, { id: 'g2', userId: 'doc', reason: 'x', from: ago(3), until: ago(2), closedAt: ago(2), review: { by: 'sup', at: ago(1), outcome: 'appropriate', note: 'ok' } }, { id: 'g3', userId: 'doc', reason: 'x', from: ago(0), until: ahead(1) }] },
        { ...base, id: 'p2', name: 'P2', teamId: 't2', assignedTo: null }],
      visits: [{ id: 'v1', personId: 'p1', state: 'confirmed', protocolChecks: [{ id: 'c1', at: ago(1), findings: [{ label: 'High BP', urgency: 'urgent_review' }] }] }, { id: 'v2', personId: 'p1', state: 'confirmed', protocolChecks: [{ id: 'c2', at: ago(1), findings: [{ label: 'Reviewed', urgency: 'review' }], decision: { decision: 'accepted' } }] }],
      submissions: [sub('s1', 'p1', 'uncertain', { updatedAt: ago(5), attempts: 2 }), sub('s2', 'p1', 'rejected', { visitId: 'v2' }), sub('s3', 'p1', 'accepted', { visitId: 'v2', createdAt: ago(2) }), sub('s4', 'p1', 'rejected', { connectorId: 'mis-b', connectorName: 'Other MIS', updatedAt: ago(1) }), sub('s5', 'p1', 'retryable', { updatedAt: ago(2) }), sub('s6', 'p1', 'accepted'), sub('s7', 'p2', 'uncertain', { visitId: 'v9' })],
      referrals: [
        { id: 'r1', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'x', state: 'sent', createdAt: ago(20), ownerId: 'asha', due: agoDate(5), urgency: 'urgent', version: 1 },
        { id: 'r2', personId: 'p1', visitId: 'v1', facility: 'PHC', reason: 'x', state: 'sent', createdAt: ago(20), ownerId: 'asha', due: agoDate(-5), version: 1 },
        { id: 'r3', personId: 'p2', visitId: 'v9', facility: 'DH', reason: 'x', state: 'received', createdAt: ago(20), due: agoDate(1), urgency: 'emergency', version: 1 }] },
    governance: { entries: [], evaluations: [], safety: [{ id: 'sc1', personId: 'p1', visitId: 'v1', ownerId: 'doc', kind: 'potential-harm', summary: 'x', state: 'open', createdAt: ago(1) }, { id: 'sc2', personId: 'p1', visitId: 'v1', ownerId: 'doc', kind: 'wrong-patient', summary: 'x', state: 'closed', createdAt: ago(1) }] },
  };
  const q = userId => x.exceptionQueue(s, s.members.find(m => m.userId === userId), now);
  const sup = q('sup'), ids = sup.items.map(i => i.id);
  check(() => {
    assert.deepEqual([...ids].sort(), ['abdm-received:a1', 'ehr-publication:e1', 'ehr-publication:e2', 'emergency-access-unreviewed:g1', 'field-grant-expired:l1', 'follow-up-overdue:f1', 'identity-provisional:p1', 'protocol-review:c1', 'referral-overdue:r1', 'safety-case:sc1', 'submission:s1', 'submission:s4', 'submission:s5'].sort(),
      'every kind found; resolved, reviewed, fresh, accepted, superseded and other-team items excluded');
    assert.equal(sup.total, 13); assert.equal(sup.truncated, false); assert.equal(Object.values(sup.counts).reduce((a, b) => a + b, 0), 13);
  });
  check(() => {
    assert.equal(ids[0], 'safety-case:sc1', 'critical first');
    const sev = sup.items.map(i => i.severity); assert.deepEqual(sev, [...sev].sort((a, b) => ({ critical: 0, high: 1, normal: 2 })[a] - ({ critical: 0, high: 1, normal: 2 })[b]));
    const high = sup.items.filter(i => i.severity === 'high'); for (let i = 1; i < high.length; i++) assert.ok(high[i - 1].ageDays >= high[i].ageDays, 'older first within severity');
    assert.equal(high[0].id, 'referral-overdue:r1', 'five-day-old overdue referral is the oldest high item');
  });
  check(() => {
    const r = id => sup.items.find(i => i.id === id);
    assert.deepEqual(r('submission:s1').link, { personId: 'p1', visitId: 'v1', href: '/?patient=p1&visit=v1' });
    assert.deepEqual(r('submission:s1').patient, { id: 'p1', name: 'P1' });
    assert.match(r('submission:s1').what, /outcome unknown after 2 attempts/); assert.match(r('submission:s1').recovery, /Look up the receipt/); assert.equal(r('submission:s1').ageDays, 5);
    assert.equal(r('submission:s4').severity, 'normal'); assert.match(r('submission:s4').recovery, /amendment/);
    assert.equal(r('identity-provisional:p1').link.href, '/?patient=p1'); assert.equal(r('identity-provisional:p1').owner, 'Clinicians of Team One');
    assert.match(r('follow-up-overdue:f1').what, /TB screening follow-up "Sputum check".*no current access/); assert.equal(r('follow-up-overdue:f1').owner, 'Supervisors of Team One');
    assert.equal(r('referral-overdue:r1').owner, 'ASHA'); assert.match(r('referral-overdue:r1').what, /urgent referral overdue by 5 days/);
    assert.equal(r('field-grant-expired:l1').owner, 'ASHA'); assert.match(r('emergency-access-unreviewed:g1').what, /DOC ended without review/);
    assert.equal(r('protocol-review:c1').severity, 'high'); assert.match(r('ehr-publication:e2').what, /still running/);
  });
  check(() => {
    const adm = q('adm');
    assert.deepEqual(adm.items.map(i => i.id).sort(), ['ehr-publication:e1', 'ehr-publication:e2', 'submission:s1', 'submission:s4', 'submission:s5', 'submission:s7'].sort(), 'administrators see delivery exceptions only');
    assert.ok(adm.items.every(i => i.patient === null && i.link === null), 'no patient details for administrators');
    assert.ok(!JSON.stringify(adm).includes('P1') && !JSON.stringify(adm).includes('P2'), 'no patient names anywhere');
    assert.match(adm.scope, /without patient details/);
  });
  check(() => {
    const own = q('own'), s7 = own.items.find(i => i.id === 'submission:s7');
    assert.equal(own.items.filter(i => i.patient?.id === 'p1').length, 13, 'owner sees team patients in full');
    assert.equal(s7.patient, null); assert.equal(s7.link, null); assert.equal(own.items.some(i => i.id === 'referral-overdue:r3'), false, 'no clinical rows outside the owner\'s teams');
  });
  check(() => {
    const two = q('sup2');
    assert.deepEqual(two.items.map(i => i.id), ['referral-overdue:r3', 'submission:s7']);
    assert.equal(two.items[0].severity, 'critical'); assert.equal(two.items[0].owner, 'Supervisors of Team Two'); assert.equal(two.items[0].link.href, '/?patient=p2&visit=v9');
  });
  check(() => { status(() => q('asha'), 403); status(() => q('doc'), 403); status(() => q('idle'), 403); });
  writeFileSync('tests/exceptions-contract-result.json', JSON.stringify({ suite: 'exception queue contract (slice 6i)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
