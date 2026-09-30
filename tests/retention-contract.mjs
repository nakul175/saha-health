// Slice 6c retention contract: schedules, holds and eligibility counts on in-memory state. Nothing is deleted.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.retention-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['retention', 'core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'retention.js')));
  const now = '2026-09-30T06:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 40, sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, version: 1, teamId: 't1', assignedTo: null };
  const people = [
    { ...base, id: 'old', name: 'Old', createdAt: '2010-01-01T00:00:00.000Z', assigned: true, fieldLeases: [{ id: 'l1', createdAt: '2012-01-01T00:00:00.000Z', status: 'synced' }] },
    { ...base, id: 'oldButActive', name: 'Old but active', createdAt: '2010-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'held', name: 'Held', createdAt: '2010-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'new', name: 'New', createdAt: '2026-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'hidden', name: 'Hidden', createdAt: '2010-01-01T00:00:00.000Z', assigned: false },
  ];
  const s = { organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [], invitations: [], members: [member('own', 'clinician', { isOwner: true }), member('sup', 'supervisor'), member('adm', 'admin', { isOwner: true })],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [], people,
      visits: [{ id: 'v1', personId: 'oldButActive', createdAt: '2010-02-01T00:00:00.000Z', confirmedAt: '2026-05-01T00:00:00.000Z' }, { id: 'v2', personId: 'old', createdAt: '2011-01-01T00:00:00.000Z' }],
      submissions: [{ id: 's1', personId: 'old', updatedAt: '2011-02-01T00:00:00.000Z' }, { id: 's2', personId: 'held', updatedAt: '2011-02-01T00:00:00.000Z' }, { id: 's3', personId: 'new', updatedAt: '2026-02-01T00:00:00.000Z' }] },
    outreach: { plans: [], templates: [], messages: [{ id: 'm1', personId: 'old', createdAt: '2012-01-01T00:00:00.000Z' }] },
    rightsRequests: [{ id: 'r1', personId: 'old', closed: { at: '2013-01-01T00:00:00.000Z' } }, { id: 'r2', personId: 'new', state: 'open' }] };
  const M = id => s.members.find(m => m.userId === id);
  const run = (userId, cmd) => (s.workspace.role = M(userId).role, x.applyRetention(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, M(userId), now));
  const audit = { total: 40, pastSchedule: 7 };
  const all = years => x.RECORD_CLASSES.map(recordClass => ({ recordClass, years }));
  check(() => { status(() => run('sup', { type: 'retentionPolicySet', rules: all(10), basis: 'Synthetic records policy v1' }), 403); status(() => x.retentionReview(s, M('sup'), audit, now), 403); });
  check(() => { assert.equal(run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'audit-event', years: 0 }], basis: 'Synthetic records policy v1' }), null); assert.equal(run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'audit-event', years: 5 }, { recordClass: 'audit-event', years: 6 }], basis: 'Synthetic records policy v1' }), null); });
  let v = x.retentionReview(s, M('own'), audit, now);
  check(() => { assert.equal(v.policy, null); assert.ok(v.review.every(r => r.years === null && r.eligible === 0)); assert.match(v.disposal, /never deletes/); });
  check(() => { const r = run('own', { type: 'retentionPolicySet', rules: all(10), basis: 'Synthetic records policy v1' }); assert.equal(r.version, 1); assert.match(s.workspace.audit.at(-1).detail, /No records are deleted/); });
  v = x.retentionReview(s, M('own'), audit, now);
  const row = c => v.review.find(r => r.recordClass === c);
  check(() => { assert.deepEqual([row('patient-record').total, row('patient-record').pastSchedule, row('patient-record').eligible], [5, 3, 3], 'recent visit keeps a patient; hidden patients are counted'); assert.equal(row('programme-receipt').eligible, 2); assert.equal(row('outreach-message').eligible, 1); assert.equal(row('rights-request').total, 1, 'only closed requests are dated'); assert.equal(row('field-package').eligible, 1); assert.deepEqual([row('audit-event').total, row('audit-event').eligible], [40, 7]); });
  // Holds.
  check(() => { status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 422); status(() => run('own', { type: 'retentionHoldPlace', scope: 'organisation', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 422); status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'hidden', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 403); status(() => run('adm', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 403); });
  const hold = run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' });
  check(() => { status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-2' }), 409); v = x.retentionReview(s, M('own'), audit, now); assert.deepEqual([row('patient-record').held, row('patient-record').eligible], [1, 2]); assert.deepEqual([row('programme-receipt').held, row('programme-receipt').eligible], [1, 1]); assert.equal(row('audit-event').eligible, 7, 'a patient hold does not hold audit counts'); });
  const org = run('own', { type: 'retentionHoldPlace', scope: 'organisation', reason: 'Synthetic regulator inquiry', reference: 'REG-9' });
  check(() => { v = x.retentionReview(s, M('own'), audit, now); assert.ok(v.review.every(r => r.eligible === 0), 'an organisation hold makes nothing eligible'); assert.equal(row('audit-event').held, 7); });
  check(() => { status(() => run('own', { type: 'retentionHoldRelease', holdId: 'nope', reason: 'Matter closed in synthetic test' }), 404); run('own', { type: 'retentionHoldRelease', holdId: org.holdId, reason: 'Inquiry closed in synthetic test' }); status(() => run('own', { type: 'retentionHoldRelease', holdId: org.holdId, reason: 'Inquiry closed in synthetic test' }), 409); v = x.retentionReview(s, M('own'), audit, now); assert.equal(row('patient-record').eligible, 2, 'the patient hold remains'); });
  check(() => { v = x.retentionReview(s, M('own'), audit, now); assert.equal(v.holds.find(h => h.id === hold.holdId).personName, 'Held'); run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'patient-record', years: 20 }], basis: 'Synthetic records policy v2' }); v = x.retentionReview(s, M('own'), audit, now); assert.equal(v.policy.version, 2); assert.equal(v.history.length, 2); assert.equal(row('patient-record').pastSchedule, 0); assert.equal(row('audit-event').years, null); });
  check(() => { assert.equal(s.workspace.people.length, 5); assert.equal(s.workspace.submissions.length, 3); assert.equal(s.outreach.messages.length, 1); });
  const result = { suite: 'retention contract (slice 6c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/retention-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
