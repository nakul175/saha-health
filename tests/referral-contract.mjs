// Slice 4a referral contract: lifecycle table, escalation rules, reasoned delays and the queue.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.referral-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'installed-transition-authority', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'referrals', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const R = await import(pathToFileURL(join(dir, 'referral-rules.js')));
  const x = await import(pathToFileURL(join(dir, 'referrals.js')));
  const now = '2026-09-30T06:00:00.000Z', daysAgo = n => new Date(Date.parse(now) - n * 86400000).toISOString(), date = n => daysAgo(n).slice(0, 10);
  check(() => { for (const t of R.TERMINAL) assert.deepEqual(R.NEXT[t], []); for (const [s, next] of Object.entries(R.NEXT)) { assert.ok(R.REFERRAL_STATES.includes(s)); for (const n of next) assert.ok(R.REFERRAL_STATES.includes(n) && n !== 'draft'); } });
  check(() => { assert.equal(R.NEXT.draft.includes('completed'), false); assert.ok(R.NEXT.received.includes('completed'), 'R11 path kept'); assert.ok(R.NEXT['not-attended'].includes('scheduled')); assert.ok(R.NEXT.unknown.includes('attended')); assert.equal(R.NEXT.scheduled.includes('received'), false); });
  const e = (over, active = true, at = now) => R.escalation({ state: 'sent', ownerId: 'w', due: date(-3), urgency: 'routine', createdAt: daysAgo(20), events: [], ...over }, active, at);
  check(() => { assert.equal(e({ state: 'completed', due: date(30) }).level, 'none'); assert.equal(e({}).level, 'none'); assert.equal(e({ ownerId: undefined }).level, 'escalated'); assert.match(e({}, false).reasons[0], /no longer/); assert.equal(e({ due: undefined }).level, 'watch'); });
  check(() => { assert.equal(e({ due: date(3) }).level, 'watch'); assert.equal(e({ due: date(8) }).level, 'escalated'); assert.equal(e({ due: date(8) }).daysOverdue, 8); assert.equal(e({ due: date(2), urgency: 'urgent' }).level, 'escalated'); assert.equal(e({ due: date(1), urgency: 'urgent' }).level, 'watch'); assert.equal(e({ due: date(1), urgency: 'emergency', state: 'received' }).level, 'escalated'); });
  check(() => { assert.match(e({ urgency: 'emergency', state: 'sent' }).reasons.join(), /not yet accepted/); assert.equal(e({ urgency: 'emergency', state: 'scheduled' }).level, 'none'); assert.equal(e({ state: 'unknown', events: [{ occurredAt: daysAgo(3) }] }).level, 'escalated'); assert.equal(e({ state: 'unknown', events: [{ occurredAt: daysAgo(1) }] }).level, 'watch'); assert.equal(e({ state: 'not-attended', events: [{ occurredAt: daysAgo(2) }] }).level, 'escalated'); });
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 1, teamId: 't1' };
  const s = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'One' }], invitations: [], members: [member('asha', 'asha'), member('asha2', 'asha'), member('doc', 'clinician'), member('sup', 'supervisor'), member('adm', 'admin', { isOwner: true, teamIds: [] })],
    workspace: { role: 'clinician', audit: [], visits: [], submissions: [], integrations: [], people: [{ ...base, id: 'p1', name: 'P1', assignedTo: 'asha', assigned: true }, { ...base, id: 'p2', name: 'P2', assignedTo: 'asha2', assigned: true }],
      referrals: [
        { id: 'r1', personId: 'p1', visitId: 'v', facility: 'CHC', reason: 'x', state: 'sent', createdAt: daysAgo(20), ownerId: 'asha', due: date(10), urgency: 'routine', version: 1 },
        { id: 'r2', personId: 'p1', visitId: 'v', facility: 'PHC', reason: 'x', state: 'completed', createdAt: daysAgo(20), ownerId: 'asha', due: date(10), version: 3 },
        { id: 'r3', personId: 'p2', visitId: 'v', facility: 'DH', reason: 'x', state: 'received', createdAt: daysAgo(5), ownerId: 'asha2', due: date(1), urgency: 'emergency', version: 1 },
        { id: 'r4', personId: 'p2', visitId: 'v', facility: 'DH', reason: 'x', state: 'scheduled', createdAt: daysAgo(5), ownerId: 'gone', due: date(-5), version: 1 },
      ] } };
  const M = id => s.members.find(m => m.userId === id);
  const run = (userId, cmd) => { s.workspace.role = M(userId).role; for (const p of s.workspace.people) p.assigned = M(userId).role === 'asha' ? p.assignedTo === userId : M(userId).role !== 'admin'; return x.applyReferral(s, cmd, { userId, displayName: userId, email: 'x' }, M(userId), now); };
  const delay = (over = {}) => ({ type: 'referralDelay', referralId: 'r1', version: 1, due: date(-7), constraint: 'transport', reason: 'No transport until next week', ...over });
  check(() => { status(() => run('doc', delay()), 403); status(() => run('asha', delay({ version: 9 })), 409); status(() => run('asha', delay({ due: date(12) })), 422); status(() => run('asha', delay({ due: date(-200) })), 422); status(() => run('asha', delay({ referralId: 'r2', version: 3 })), 409); assert.equal(run('asha', { ...delay(), reason: 'short' }), null); });
  run('asha', delay());
  const r1 = s.workspace.referrals[0];
  check(() => { assert.equal(r1.due, date(-7)); assert.equal(r1.version, 2); assert.deepEqual([r1.delays[0].from, r1.delays[0].to, r1.delays[0].constraint], [date(10), date(-7), 'transport']); assert.match(s.workspace.audit.at(-1).detail, /delayed/); });
  run('sup', delay({ referralId: 'r3', due: date(-2), constraint: 'facility-capacity', reason: 'Facility asked to rebook later' }));
  check(() => assert.equal(s.workspace.referrals[2].due, date(-2), 'a steward may delay'));
  const q = id => { for (const p of s.workspace.people) p.assigned = M(id).role === 'asha' ? p.assignedTo === id : true; return x.escalationQueue(s, M(id), now); };
  check(() => { const v = q('sup'); assert.deepEqual(v.items.map(i => i.referralId), ['r4']); assert.equal(v.items[0].level, 'escalated'); assert.match(v.items[0].reasons.join(), /Owner no longer/); });
  check(() => { s.workspace.referrals[2].due = date(1); const v = q('sup'); assert.deepEqual(v.items.map(i => i.referralId), ['r3', 'r4'], 'emergency first'); assert.equal(q('asha').items.length, 0); assert.deepEqual(q('asha2').items.map(i => i.referralId), ['r3'], 'own referrals only'); status(() => q('adm'), 403); });
  const result = { suite: 'referral contract (slice 4a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/referral-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
