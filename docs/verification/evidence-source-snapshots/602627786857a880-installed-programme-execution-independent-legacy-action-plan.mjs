import {mkdirSync as ownMkdir} from 'node:fs';ownMkdir('tests/evidence/installed-programme-execution-independent/legacy',{recursive:true});
// Slice 4b action-plan contract: ordering, consolidation, ownership gaps, scope and the assignment command.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.action-plan-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'action-plan.js')));
  const now = '2026-09-30T06:00:00.000Z', ago = n => new Date(Date.parse(now) - n * 86400000).toISOString().slice(0, 10), ahead = n => ago(-n);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 4, teamId: 't1' };
  const fu = (id, over = {}) => ({ id, enrolmentId: 'e1', packId: 'maternal', title: 'Home visit', due: ahead(2), ownerId: 'asha', state: 'open', createdAt: now, createdBy: 'asha', ...over });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('asha2', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'), member('sup2', 'supervisor', { teamIds: ['t2'] }),
      member('own', 'clinician', { isOwner: true, teamIds: [] }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('gone', 'asha', { status: 'suspended' })],
    workspace: { role: 'clinician', audit: [], submissions: [], integrations: [],
      people: [{ ...base, id: 'p1', name: 'P1', assignedTo: 'asha', assigned: true,
        followUps: [fu('f1'), fu('f2', { enrolmentId: 'e2', packId: 'hypertension', title: 'home  visit' }), fu('f3', { title: 'Weigh baby', due: ago(3) }), fu('f4', { ownerId: 'gone', title: 'Blood pressure recheck', due: ahead(5) }), fu('f5', { state: 'completed' })] },
        { ...base, id: 'p2', name: 'P2', assignedTo: 'asha2', assigned: true, teamId: 't2' }],
      visits: [{ id: 'v1', personId: 'p1', state: 'confirmed', protocolChecks: [
        { id: 'old', findings: [{ label: 'Old', urgency: 'review' }], decision: undefined },
        { id: 'c1', findings: [{ label: 'High blood pressure', urgency: 'urgent_review' }, { label: 'Weight', urgency: 'review' }] }] },
        { id: 'v2', personId: 'p1', state: 'confirmed', voidedAt: now, protocolChecks: [{ id: 'c2', findings: [{ label: 'Voided', urgency: 'review' }] }] },
        { id: 'v3', personId: 'p1', state: 'confirmed', protocolChecks: [{ id: 'c3', findings: [{ label: 'Reviewed', urgency: 'review' }], decision: { decision: 'accepted' } }] }],
      referrals: [
        { id: 'r1', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'BP review', state: 'sent', createdAt: now, ownerId: 'asha', due: ahead(10), urgency: 'urgent', version: 2 },
        { id: 'r2', personId: 'p1', visitId: 'v1', facility: 'PHC', reason: 'Done', state: 'completed', createdAt: now, ownerId: 'asha', due: ago(10), version: 3 },
        { id: 'r3', personId: 'p1', visitId: 'v1', facility: 'DH', reason: 'Scan', state: 'received', createdAt: now, due: ago(10), version: 1 },
        { id: 'r4', personId: 'p2', visitId: 'v9', facility: 'DH', reason: 'Other team', state: 'sent', createdAt: now, ownerId: 'asha2', due: ago(1), version: 1 }] },
    governance: { entries: [], evaluations: [], safety: [{ id: 's1', personId: 'p1', visitId: 'v1', ownerId: 'doc', kind: 'potential-harm', summary: 'Synthetic safety concern', state: 'open', version: 1 }, { id: 's2', personId: 'p1', visitId: 'v1', ownerId: 'doc', kind: 'wrong-patient', summary: 'Closed', state: 'closed', version: 2 }] },
    outreach: { plans: [{ id: 'op', title: 'Village camp', date: ago(1), teamId: 't1', state: 'scheduled', items: [{ id: 'oi', personId: 'p1', ownerId: 'asha', state: 'planned' }] }], templates: [], messages: [{ id: 'm1', personId: 'p1', recovery: { ownerId: 'gone', state: 'open' } }] },
  };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id);
  const view = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = m.role !== 'admin' && m.teamIds.includes(p.teamId) && (m.role !== 'asha' || p.assignedTo === userId); return m; };
  const plan = (userId, pid = 'p1') => x.actionPlan(s, view(userId), P(pid), now);
  let pl = plan('sup');
  const keys = pl.items.map(i => i.key);
  check(() => {
    assert.deepEqual(keys, ['safety-case:s1', 'referral:r3', 'follow-up:f4', 'message-follow-up:m1', 'follow-up:f3', 'outreach:oi', 'protocol-review:c1', 'referral:r1', 'follow-up:f1+f2'],
      'escalated (urgent, then longest overdue, then earliest due), overdue, review now, upcoming; closed, reviewed, older, voided and other-patient work excluded');
    assert.deepEqual(pl.items.map(i => i.attention), ['escalated', 'escalated', 'escalated', 'escalated', 'overdue', 'overdue', 'now', 'upcoming', 'upcoming']);
  });
  check(() => {
    const merged = pl.items.find(i => i.key === 'follow-up:f1+f2');
    assert.ok(merged, 'same title, due and owner across two programme episodes shown once');
    assert.deepEqual(merged.sources.map(s => s.programme), ['Maternal care', 'Hypertension follow-up']);
    assert.equal(merged.targets.length, 2);
    assert.ok(pl.items.some(i => i.key === 'follow-up:f3'), 'different work stays separate');
  });
  check(() => {
    const r3 = pl.items.find(i => i.key === 'referral:r3'), f4 = pl.items.find(i => i.key === 'follow-up:f4'), c1 = pl.items.find(i => i.key === 'protocol-review:c1');
    assert.equal(r3.ownershipGap, 'No named care worker'); assert.equal(r3.queue, 'Supervisors of Team One'); assert.equal(r3.daysOverdue, 10);
    assert.match(f4.ownershipGap, /no longer has current care access/); assert.equal(f4.owner.eligible, false);
    assert.equal(c1.owner, null); assert.equal(c1.queue, 'Clinicians of Team One'); assert.equal(c1.ownershipGap, null); assert.equal(c1.urgency, 'urgent'); assert.equal(c1.attention, 'now');
    assert.equal(pl.unowned, 3); assert.equal(pl.canAssign, true);
    assert.deepEqual(pl.eligibleOwners.map(o => o.userId), ['asha', 'doc']);
  });
  check(() => {
    status(() => plan('adm'), 403); status(() => plan('own'), 403, 'owner authority does not override patient scope');
    status(() => plan('doc2'), 403); status(() => plan('asha2'), 403);
    const a = plan('asha'); assert.equal(a.canAssign, false); assert.deepEqual(a.eligibleOwners.map(o => o.userId), ['asha']);
    assert.equal(a.items.find(i => i.key === 'referral:r3').canClaim, true); assert.equal(a.items.find(i => i.key === 'referral:r1').canClaim, false);
    assert.equal(a.items.find(i => i.key === 'safety-case:s1').canClaim, false);
  });
  check(() => {
    s.members.find(m => m.userId === 'doc').status = 'suspended';
    const d = plan('sup'); assert.match(d.items.find(i => i.key === 'protocol-review:c1').ownershipGap, /No clinician with current access/);
    assert.match(d.items.find(i => i.key === 'safety-case:s1').ownershipGap, /clinical owner|no longer/);
    s.members.find(m => m.userId === 'doc').status = 'active';
  });
  // Assignment command.
  const run = (userId, cmd) => x.applyActionPlan(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x' }, view(userId), now);
  const cmd = (over = {}) => ({ type: 'assignPlanItem', personId: 'p1', version: P('p1').version, targets: [{ kind: 'referral', id: 'r3', version: 1 }], ownerId: 'asha', reason: 'Taking the scan referral', ...over });
  check(() => {
    assert.equal(run('asha', { type: 'somethingElse' }), null);
    assert.equal(run('asha', cmd({ reason: 'short' })), null, 'reason too short is not this schema');
    status(() => run('adm', cmd()), 403); status(() => run('own', cmd()), 403); status(() => run('doc2', cmd()), 403);
    status(() => run('asha', cmd({ ownerId: 'doc' })), 403);
    status(() => run('asha', cmd({ targets: [{ kind: 'referral', id: 'r1', version: 2 }] })), 403);
    status(() => run('asha', cmd({ version: 1 })), 409);
    status(() => run('asha', cmd({ targets: [{ kind: 'referral', id: 'r3', version: 9 }] })), 409);
    status(() => run('asha', cmd({ targets: [{ kind: 'referral', id: 'r2', version: 3 }] })), 409);
    status(() => run('sup', cmd({ ownerId: 'asha2' })), 422, 'ASHA not assigned to patient is not eligible');
    status(() => run('sup', cmd({ ownerId: 'gone' })), 422);
    status(() => run('sup', cmd({ targets: [{ kind: 'referral', id: 'r3', version: 1 }, { kind: 'referral', id: 'r3', version: 1 }] })), 422);
  });
  const audits = s.workspace.audit.length;
  check(() => {
    const r = run('asha', cmd()); assert.deepEqual(r, { assigned: 1, ownerId: 'asha' });
    const r3 = s.workspace.referrals.find(r => r.id === 'r3'); assert.equal(r3.ownerId, 'asha'); assert.equal(r3.version, 2);
    assert.equal(P('p1').version, 4, 'referral-only change keeps the patient version');
    assert.equal(s.workspace.audit.length, audits + 1); assert.match(s.workspace.audit.at(-1).detail, /Ownership taken to ASHA: referral to DH from nobody\. Taking/);
    assert.equal(plan('sup').items.find(i => i.key === 'referral:r3').ownershipGap, null);
  });
  check(() => {
    status(() => run('asha', cmd({ targets: [{ kind: 'follow-up', id: 'f1', version: 4 }] })), 403, 'owned follow-up cannot be claimed');
    run('asha', cmd({ targets: [{ kind: 'follow-up', id: 'f4', version: 4 }], reason: 'Owner left the team' }));
    assert.equal(P('p1').followUps.find(f => f.id === 'f4').ownerId, 'asha'); assert.equal(P('p1').version, 5);
    const merged = plan('sup').items.find(i => i.key === 'follow-up:f1+f2');
    run('sup', cmd({ version: 5, targets: merged.targets.map(t => ({ ...t, version: 5 })), ownerId: 'doc', reason: 'Clinician takes the combined visit' }));
    assert.deepEqual(P('p1').followUps.filter(f => ['f1', 'f2'].includes(f.id)).map(f => f.ownerId), ['doc', 'doc']);
    assert.match(s.workspace.audit.at(-1).detail, /^Reassigned to DOC/);
    status(() => run('sup', cmd({ version: 6, targets: [{ kind: 'follow-up', id: 'f1', version: 6 }], ownerId: 'doc' })), 409);
    assert.equal(plan('sup').unowned, 1, 'only the failed-message follow-up (outreach-owned) remains unowned');
  });
  writeFileSync('tests/evidence/installed-programme-execution-independent/legacy/action-plan-contract-result.json', JSON.stringify({ suite: 'action-plan contract (slice 4b)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
