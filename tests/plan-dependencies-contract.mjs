// Slice 4d contract: action dependencies in the per-patient plan and referrals with several source links.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.plan-dependencies-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, msg) => { try { fn(); } catch (e) { assert.equal(e.status, code, `${msg ?? ''} ${e.message}`); return e; } assert.fail(`expected ${code}${msg ? ': ' + msg : ''}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'referrals', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'action-plan.js')));
  const rf = await import(pathToFileURL(join(dir, 'referrals.js')));
  const now = '2026-09-30T06:00:00.000Z', ago = n => new Date(Date.parse(now) - n * 86400000).toISOString().slice(0, 10), ahead = n => ago(-n);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 4, teamId: 't1' };
  const fu = (id, over = {}) => ({ id, enrolmentId: 'e1', packId: 'maternal', title: 'Home visit', due: ago(3), ownerId: 'asha', state: 'open', createdAt: now, createdBy: 'asha', ...over });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('asha2', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'),
      member('own', 'clinician', { isOwner: true, teamIds: [] }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('gone', 'asha', { status: 'suspended' })],
    workspace: { role: 'clinician', audit: [], submissions: [], integrations: [],
      people: [{ ...base, id: 'p1', name: 'P1', assignedTo: 'asha', assigned: true,
        enrolments: [{ id: 'e1', packId: 'maternal', packVersion: 1, state: 'active', episodeLabel: 'Synthetic pregnancy', startDate: null, createdAt: '2026-09-20T05:00:00.000Z', createdBy: 'doc', registration: 'not_submitted' }],
        followUps: [fu('fA'), fu('fB', { title: 'Medicine check', due: ahead(5) }), fu('fC', { title: 'Weigh baby', due: ahead(2) }), fu('fD', { state: 'completed' })] },
        { ...base, id: 'p2', name: 'P2', assignedTo: 'asha2', assigned: true, teamId: 't2', followUps: [fu('fX', { ownerId: 'asha2' })] }],
      visits: [{ id: 'v1', personId: 'p1', state: 'confirmed', createdAt: '2026-09-25T05:00:00.000Z', confirmedAt: '2026-09-25T06:00:00.000Z', protocolChecks: [{ id: 'c1', at: '2026-09-25T06:30:00.000Z', findings: [{ label: 'High blood pressure', urgency: 'review' }] }] },
        { id: 'v2', personId: 'p1', state: 'confirmed', createdAt: '2026-09-28T05:00:00.000Z', confirmedAt: '2026-09-28T06:00:00.000Z' },
        { id: 'v3', personId: 'p1', state: 'confirmed', createdAt: '2026-09-27T05:00:00.000Z', voidedAt: now },
        { id: 'v9', personId: 'p2', state: 'confirmed', createdAt: '2026-09-27T05:00:00.000Z' }],
      referrals: [
        { id: 'rA', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'BP review', state: 'sent', createdAt: '2026-09-25T06:10:00.000Z', ownerId: 'asha', due: ago(4), urgency: 'urgent', version: 1 },
        { id: 'rB', personId: 'p1', visitId: 'v1', facility: 'PHC', reason: 'Done', state: 'completed', createdAt: now, ownerId: 'asha', due: ago(10), version: 3 },
        { id: 'rX', personId: 'p2', visitId: 'v9', facility: 'DH', reason: 'Other team', state: 'sent', createdAt: now, ownerId: 'asha2', due: ahead(1), version: 1 }] },
    governance: { entries: [], evaluations: [], safety: [] }, outreach: { plans: [], templates: [], messages: [] },
  };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id), R = id => s.workspace.referrals.find(r => r.id === id);
  const view = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = m.role !== 'admin' && m.teamIds.includes(p.teamId) && (m.role !== 'asha' || p.assignedTo === userId); return m; };
  const plan = (userId, pid = 'p1') => x.actionPlan(s, view(userId), P(pid), now);
  const item = (pl, key) => pl.items.find(i => i.key === key);
  const run = (userId, cmd) => x.applyActionPlan(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x' }, view(userId), now);
  const link = (over = {}) => ({ type: 'linkPlanItems', personId: 'p1', version: P('p1').version, dependent: { kind: 'follow-up', id: 'fA' }, blocker: { kind: 'referral', id: 'rA' }, reason: 'Home visit only after the CHC review', ...over });

  // Before any dependency: the overdue follow-up is overdue; nothing waits.
  check(() => {
    const pl = plan('sup'); assert.equal(item(pl, 'follow-up:fA').attention, 'overdue'); assert.equal(item(pl, 'follow-up:fA').daysOverdue, 3);
    assert.equal(pl.waiting, 0); assert.deepEqual(pl.dependencies, []); assert.equal(pl.canLink, true);
    assert.equal(plan('asha').canLink, false, 'an ASHA does not record dependencies'); assert.equal(plan('doc').canLink, true);
    assert.deepEqual(item(pl, 'referral:rA').sources.map(x => x.link), ['visit'], 'single-source referral unchanged');
  });
  // Authority, scope and input refusals.
  check(() => {
    assert.equal(run('doc', { type: 'linkPlanItems' }), null, 'incomplete input is not this schema');
    assert.equal(run('doc', link({ reason: 'short' })), null);
    status(() => run('adm', link()), 403, 'administrator'); status(() => run('own', link()), 403, 'owner outside the team');
    status(() => run('asha', link()), 403, 'ASHA'); status(() => run('doc2', link()), 403, 'other team clinician');
    status(() => x.authorizeActionPlan(s, view('asha'), link()), 403, 'rechecked on replay'); x.authorizeActionPlan(s, view('doc'), link());
    status(() => run('doc', link({ version: 3 })), 409, 'stale patient version');
    status(() => run('doc', link({ blocker: { kind: 'follow-up', id: 'fA' } })), 422, 'self');
    status(() => run('doc', link({ blocker: { kind: 'referral', id: 'rX' } })), 422, 'cross-patient referral');
    status(() => run('doc', link({ blocker: { kind: 'follow-up', id: 'fX' } })), 422, 'cross-patient follow-up');
    status(() => run('doc', link({ blocker: { kind: 'referral', id: 'rB' } })), 409, 'closed blocker');
    status(() => run('doc', link({ dependent: { kind: 'follow-up', id: 'fD' } })), 409, 'closed dependent');
    status(() => run('doc', link({ dependent: { kind: 'protocol-review', id: 'c1' } })), 422, 'protocol review never waits');
    assert.equal(P('p1').version, 4); assert.equal(s.workspace.audit.length, 0);
  });
  // Recording: the follow-up waits; the overdue blocker still surfaces first.
  let dep1;
  check(() => {
    const r = run('doc', link()); dep1 = r.dependencyId; assert.ok(dep1);
    assert.equal(P('p1').version, 5); assert.equal(P('p1').planDependencies.length, 1);
    assert.match(s.workspace.audit.at(-1).detail, /^"Home visit" waits on "Referral to CHC"\. Home visit only/); assert.equal(s.workspace.audit.at(-1).action, 'linkPlanItems');
    const pl = plan('sup'), a = item(pl, 'follow-up:fA'), b = item(pl, 'referral:rA');
    assert.equal(a.attention, 'waiting'); assert.equal(a.daysOverdue, 0, 'not counted as overdue'); assert.match(a.status, /^Waiting for Referral to CHC/);
    assert.equal(a.waitingOn[0].attention, 'escalated'); assert.ok(a.waitingOn[0].daysOverdue >= 4);
    assert.equal(b.attention, 'escalated', 'overdue blocker still surfaces'); assert.deepEqual(b.blocks.map(z => z.key), ['follow-up:fA']);
    assert.equal(pl.items.at(-1).key, 'follow-up:fA', 'waiting items come last'); assert.equal(pl.waiting, 1);
    assert.equal(pl.dependencies[0].state, 'waiting'); assert.equal(pl.dependencies[0].by, 'DOC');
  });
  check(() => {
    status(() => run('sup', link()), 409, 'duplicate');
    status(() => run('sup', link({ dependent: { kind: 'referral', id: 'rA' }, blocker: { kind: 'follow-up', id: 'fA' } })), 422, 'direct cycle');
    run('sup', link({ dependent: { kind: 'follow-up', id: 'fB' }, blocker: { kind: 'follow-up', id: 'fA' }, reason: 'Medicine check after the home visit' }));
    status(() => run('sup', link({ dependent: { kind: 'referral', id: 'rA' }, blocker: { kind: 'follow-up', id: 'fB' } })), 422, 'cycle through another item');
    const pl = plan('doc'); assert.equal(item(pl, 'follow-up:fB').attention, 'waiting'); assert.equal(item(pl, 'follow-up:fB').waitingOn[0].status.startsWith('Waiting for'), true, 'chains show the waiting blocker');
    assert.equal(pl.waiting, 2);
  });
  // An ownership gap still escalates a waiting item; a closed blocker releases it.
  check(() => {
    const f = P('p1').followUps.find(z => z.id === 'fA'); f.ownerId = 'gone';
    assert.equal(item(plan('sup'), 'follow-up:fA').attention, 'escalated'); f.ownerId = 'asha';
    R('rA').state = 'completed';
    const pl = plan('sup'), a = item(pl, 'follow-up:fA');
    assert.equal(a.attention, 'overdue'); assert.equal(a.daysOverdue, 3); assert.deepEqual(a.waitingOn, []);
    assert.equal(pl.dependencies.find(d => d.id === dep1).state, 'released');
    R('rA').state = 'sent';
  });
  // A protocol review can hold back a follow-up until a clinician decides.
  check(() => {
    run('doc', link({ dependent: { kind: 'follow-up', id: 'fC' }, blocker: { kind: 'protocol-review', id: 'c1' }, reason: 'Weigh after the protocol review' }));
    assert.equal(item(plan('sup'), 'follow-up:fC').attention, 'waiting');
    s.workspace.visits[0].protocolChecks[0].decision = { decision: 'accepted' };
    const pl = plan('sup'); assert.equal(item(pl, 'follow-up:fC').attention, 'upcoming');
    assert.equal(pl.dependencies.find(d => d.blocker.kind === 'protocol-review').state, 'released');
    delete s.workspace.visits[0].protocolChecks[0].decision;
  });
  // Removal needs a reason and keeps the record.
  check(() => {
    const un = (over = {}) => ({ type: 'unlinkPlanItems', personId: 'p1', version: P('p1').version, dependencyId: dep1, reason: 'Referral no longer gates the home visit', ...over });
    assert.equal(run('sup', un({ reason: 'short' })), null);
    status(() => run('asha', un()), 403); status(() => run('sup', un({ dependencyId: 'nope' })), 404);
    const n = P('p1').planDependencies.length, r = run('sup', un()); assert.deepEqual(r, { dependencyId: dep1, removed: true });
    assert.equal(P('p1').planDependencies.length, n, 'append-only'); assert.equal(P('p1').planDependencies[0].removed.by, 'sup');
    assert.match(s.workspace.audit.at(-1).detail, /no longer waits on/);
    status(() => run('sup', un()), 409, 'already removed');
    const pl = plan('sup'); assert.equal(item(pl, 'follow-up:fA').attention, 'overdue'); assert.equal(pl.dependencies.find(d => d.id === dep1).state, 'removed');
    run('doc', link({ reason: 'Recorded again after review' })); assert.equal(item(plan('sup'), 'follow-up:fA').attention, 'waiting', 'a removed pair can be recorded again');
  });
  // Referrals with several source links.
  const lr = (userId, over = {}) => rf.applyReferral(s, { type: 'linkReferralSource', referralId: 'rA', version: R('rA').version, kind: 'visit', sourceId: 'v2', note: 'Repeat reading confirms the need', ...over }, { userId, displayName: userId.toUpperCase(), email: 'x' }, view(userId), now);
  check(() => {
    status(() => lr('adm'), 403); status(() => lr('asha2'), 403); status(() => lr('doc2'), 403); status(() => lr('own'), 403);
    status(() => rf.authorizeReferralSource(s, view('asha2'), { type: 'linkReferralSource', referralId: 'rA' }), 403, 'rechecked on replay');
    status(() => lr('doc', { version: 9 }), 409); status(() => lr('doc', { sourceId: 'v1' }), 409, 'first visit already a source');
    status(() => lr('doc', { sourceId: 'v9' }), 422, 'other patient visit'); status(() => lr('doc', { sourceId: 'v3' }), 409, 'voided visit');
    status(() => lr('doc', { kind: 'programme-episode', sourceId: 'nope' }), 422);
    status(() => lr('doc', { referralId: 'rB', version: 3 }), 409, 'closed referral');
    assert.equal(R('rA').version, 1);
  });
  check(() => {
    assert.deepEqual(lr('asha'), { referralId: 'rA', sources: 2 }, 'the referral owner may link');
    assert.deepEqual(lr('doc', { kind: 'protocol-evaluation', sourceId: 'c1', note: 'Protocol evaluation that raised it' }), { referralId: 'rA', sources: 3 });
    assert.deepEqual(lr('sup', { kind: 'programme-episode', sourceId: 'e1', note: 'Maternal episode' }), { referralId: 'rA', sources: 4 });
    status(() => lr('doc'), 409, 'duplicate source');
    assert.equal(R('rA').version, 4);
    assert.deepEqual(R('rA').sources.map(z => [z.kind, z.refId, z.sourceAt]), [['visit', 'v2', '2026-09-28T06:00:00.000Z'], ['protocol-evaluation', 'c1', '2026-09-25T06:30:00.000Z'], ['programme-episode', 'e1', '2026-09-20T05:00:00.000Z']]);
    assert.equal(R('rA').sources[1].visitId, 'v1');
    assert.match(s.workspace.audit.at(-1).detail, /linked to programme episode "Synthetic pregnancy" e1 \(2026-09-20\)\. Maternal episode/);
    const r = item(plan('sup'), 'referral:rA');
    assert.deepEqual(r.sources.map(z => z.link), ['visit', 'visit', 'protocol-evaluation', 'programme-episode']);
    assert.deepEqual(r.sources.map(z => z.label), ['Referral', 'Visit · 2026-09-28', 'Protocol evaluation · 2026-09-25', 'Programme episode · 2026-09-20']);
    assert.equal(item(plan('sup'), 'follow-up:fA').waitingOn[0].key, 'referral:rA', 'dependencies and sources coexist');
  });
  writeFileSync('tests/plan-dependencies-contract-result.json', JSON.stringify({ suite: 'plan dependencies and referral sources contract (slice 4d)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
