// Slice 6a exceptional-access contract: record resolution, grant limits, scope, closure and review.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.exceptional-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['exceptional', 'access', 'core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'exceptional.js')));
  const a = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', at = min => new Date(Date.parse(now) + min * 60000).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 40, sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1, assignedTo: null };
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 'north', name: 'North', createdAt: now }, { id: 'south', name: 'South', createdAt: now }], invitations: [],
    members: [member('doc', 'clinician', ['south']), member('doc2', 'clinician', ['south']), member('supN', 'supervisor', ['north']), member('supS', 'supervisor', ['south']), member('ownN', 'clinician', ['north'], { isOwner: true }), member('asha', 'asha', ['south']), member('adm', 'admin', [], { isOwner: true })],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], submissions: [{ id: 'sub1', personId: '3f9a21c0-aaaa-4bbb-8ccc-000000000001' }], referrals: [],
      visits: [{ id: 'v1', personId: '3f9a21c0-aaaa-4bbb-8ccc-000000000001' }],
      people: [
        { ...base, id: '3f9a21c0-aaaa-4bbb-8ccc-000000000001', name: 'North One', teamId: 'north' },
        { ...base, id: '3f9a21c0-bbbb-4bbb-8ccc-000000000002', name: 'North Two', teamId: 'north' },
        { ...base, id: 'p_kamla', name: 'Kamla', teamId: 'north' },
        { ...base, id: 'south-1', name: 'South One', teamId: 'south' },
        { ...base, id: 'merged-1', name: 'Merged', teamId: 'north', mergedInto: { personId: 'p_kamla', caseId: 'k', at: now } },
        ...[1, 2, 3, 4].map(n => ({ ...base, id: `aaaa000${n}-0000-4000-8000-00000000000${n}`, name: `Extra ${n}`, teamId: 'north' })),
      ] },
  };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id);
  const run = (userId, cmd, when = now) => x.applyExceptional(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, M(userId), when);
  const open = (over = {}) => ({ type: 'exceptionalOpen', recordRef: 'KAMLA', minutes: 60, reason: 'Unconscious patient brought to the synthetic clinic', ...over });
  const one = '3f9a21c0-aaaa-4bbb-8ccc-000000000001';
  check(() => { assert.equal(x.resolveRecord(s, 'KAMLA').id, 'p_kamla'); assert.equal(x.resolveRecord(s, one).id, one); assert.equal(x.resolveRecord(s, '3F9A21C0-AAAA').id, one); assert.equal(x.resolveRecord(s, 'Record 3f9a21c0-bbbb').name, 'North Two'); });
  check(() => { status(() => x.resolveRecord(s, '3F9A21C0'), 409); status(() => x.resolveRecord(s, '3f9a'), 404); status(() => x.resolveRecord(s, 'nobody-here'), 404); });
  check(() => { status(() => run('asha', open()), 403); status(() => run('supS', open()), 403); status(() => run('ownN', open()), 409); status(() => run('doc', open({ recordRef: 'south-1' })), 409); status(() => run('doc', open({ recordRef: 'merged-1' })), 409); });
  check(() => assert.equal(run('doc', { ...open(), reason: 'too short' }), null, 'schema requires a 20-character reason'));
  check(() => assert.equal(run('doc', open({ minutes: 600 })), null, 'schema caps duration'));
  const r = run('doc', open());
  const kamla = P('p_kamla'), g = kamla.exceptionalAccess[0];
  check(() => { assert.equal(r.personId, 'p_kamla'); assert.equal(r.until, at(60)); assert.equal(g.userId, 'doc'); assert.equal(kamla.version, 2); assert.equal(s.workspace.audit.at(-1).action, 'exceptionalOpen'); assert.equal(s.workspace.audit.at(-1).personId, 'p_kamla'); });
  check(() => { assert.equal(a.allowed(M('doc'), kamla, at(30)), true); assert.equal(a.normallyAllowed(M('doc'), kamla), false); assert.equal(a.allowed(M('doc'), kamla, at(61)), false, 'expires'); assert.equal(a.allowed(M('doc2'), kamla, at(30)), false, 'grant is personal'); });
  check(() => status(() => run('doc', open()), 409));
  // Scope while access is exceptional only.
  check(() => { for (const c of [{ type: 'startVisit', personId: 'p_kamla' }, { type: 'saveVisit', visitId: 'v9' }, { type: 'createReferral', personId: 'p_kamla' }]) x.ensureExceptionalScope(s, M('doc'), c, at(5)); });
  check(() => { for (const c of [{ type: 'assignPatient', personId: 'p_kamla' }, { type: 'setConsent', personId: 'p_kamla' }, { type: 'proxyGrant', personId: 'p_kamla' }, { type: 'identityMergePropose', personId: 'p_kamla' }, { type: 'exportFhir', personId: 'p_kamla' }]) status(() => x.ensureExceptionalScope(s, M('doc'), c, at(5)), 403); });
  check(() => { x.ensureExceptionalScope(s, M('ownN'), { type: 'assignPatient', personId: 'p_kamla' }, at(5)); x.ensureExceptionalScope(s, M('doc'), { type: 'assignPatient', personId: 'south-1' }, at(5)); x.ensureExceptionalScope(s, M('doc'), { type: 'assignPatient', personId: 'p_kamla' }, at(61)); });
  run('doc', open({ recordRef: one, minutes: 15 }));
  check(() => { status(() => x.ensureExceptionalScope(s, M('doc'), { type: 'preparePlan', visitId: 'v1' }, at(5)), 403); status(() => x.ensureExceptionalScope(s, M('doc'), { type: 'sendSubmission', submissionId: 'sub1' }, at(5)), 403); });
  run('doc', open({ recordRef: '3f9a21c0-bbbb' }));
  check(() => { const e = status(() => run('doc', open({ recordRef: 'aaaa0001' })), 429); assert.match(e.message, /At most 3/); });
  // Review and closure.
  check(() => { status(() => run('supN', { type: 'exceptionalReview', personId: 'p_kamla', grantId: g.id, outcome: 'appropriate', note: 'Checked the visit note' }), 409); status(() => run('supS', { type: 'exceptionalReview', personId: 'p_kamla', grantId: g.id, outcome: 'appropriate', note: 'Checked the visit note' }), 403); status(() => run('doc', { type: 'exceptionalReview', personId: 'p_kamla', grantId: g.id, outcome: 'appropriate', note: 'Self review attempt' }), 403); });
  check(() => { status(() => run('doc2', { type: 'exceptionalClose', personId: 'p_kamla', grantId: g.id }), 403); run('doc', { type: 'exceptionalClose', personId: 'p_kamla', grantId: g.id }, at(10)); assert.equal(g.closedAt, at(10)); assert.equal(a.allowed(M('doc'), kamla, at(11)), false); status(() => run('doc', { type: 'exceptionalClose', personId: 'p_kamla', grantId: g.id }, at(12)), 409); });
  check(() => { run('supN', { type: 'exceptionalReview', personId: 'p_kamla', grantId: g.id, outcome: 'inappropriate', note: 'Patient was not in danger' }, at(20)); assert.equal(g.review.outcome, 'inappropriate'); assert.equal(g.review.by, 'supN'); status(() => run('ownN', { type: 'exceptionalReview', personId: 'p_kamla', grantId: g.id, outcome: 'appropriate', note: 'Second review' }, at(21)), 409); });
  check(() => { const v = x.exceptionalView(s, M('supN'), at(30)); assert.equal(v.canReview, true); assert.equal(v.reviews.length, 2); assert.ok(v.reviews.some(r => r.active)); assert.equal(v.reviewed[0].review.outcome, 'inappropriate'); assert.equal(v.reviewed[0].review.by, 'SUPN'); });
  check(() => { const v = x.exceptionalView(s, M('doc'), at(30)); assert.equal(v.canOpen, true); assert.equal(v.canReview, false); assert.equal(v.mine.length, 3); assert.equal(v.mine.filter(g => g.active).length, 1); assert.deepEqual(x.exceptionalView(s, M('supS'), at(30)).reviews, []); });
  // Daily cap: ten openings in 24 hours, counted from opening time.
  check(() => { const t = s.workspace.people.find(p => p.id === 'aaaa0001-0000-4000-8000-000000000001'); t.exceptionalAccess = Array.from({ length: 7 }, (_, n) => ({ id: 'old' + n, userId: 'doc', reason: 'x', from: at(-60 + n), until: at(-50 + n), closedAt: at(-50 + n) })); const e = status(() => run('doc', open({ recordRef: 'aaaa0002' }), at(61)), 429); assert.match(e.message, /24 hours/); run('doc', open({ recordRef: 'aaaa0002' }), at(24 * 60 + 1)); });
  const result = { suite: 'exceptional access contract (slice 6a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/exceptional-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
