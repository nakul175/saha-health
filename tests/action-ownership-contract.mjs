// SAHA-099 / BR-CARE-01: active care work always names an eligible owner or a visible monitored queue.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.action-ownership-contract-'));
let passed = 0;
const check = (fn) => { fn(); passed++; };
const status = (fn, code) => {
  try { fn(); } catch (error) { assert.equal(error.status, code, error.message); return; }
  assert.fail(`expected ${code}`);
};

try {
  for (const sourceFile of readdirSync('lib/saha').filter(file => file.endsWith('.ts'))) {
    const file = sourceFile.slice(0, -3);
    const source = readFileSync(`lib/saha/${sourceFile}`, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, `${file}.js`), js);
  }
  const { actionPlan, applyActionPlan } = await import(pathToFileURL(join(dir, 'action-plan.js')));
  const now = '2026-10-16T09:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: userId, accountCode: userId, role, isOwner: false, status: 'active', version: 1, createdAt: now, teamIds: ['team'], ...extra });
  const patient = { id: 'patient', name: 'Synthetic person', age: 31, sex: 'Female', village: 'Test', programmes: ['General care'], task: 'Review', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, assignedTo: 'worker', createdAt: now, version: 3, teamId: 'team', followUps: [
    { id: 'follow-up', enrolmentId: 'episode', packId: 'maternal', title: 'Urgent follow-up', due: '2026-10-16', ownerId: 'removed', state: 'open', createdAt: now, createdBy: 'worker' },
  ] };
  const state = {
    organisation: { id: 'org' }, teams: [{ id: 'team', name: 'Care Team' }], invitations: [],
    members: [member('worker', 'asha'), member('clinician', 'clinician'), member('supervisor', 'supervisor'), member('removed', 'asha', { status: 'suspended' }), member('outsider', 'asha', { teamIds: ['other'] })],
    workspace: { role: 'asha', audit: [], submissions: [], integrations: [], people: [patient], visits: [], referrals: [
      { id: 'referral', personId: patient.id, visitId: 'visit', facility: 'Synthetic facility', reason: 'Urgent assessment', state: 'sent', createdAt: now, ownerId: null, due: '2026-10-15', urgency: 'urgent', version: 1 },
    ] },
    governance: { entries: [], evaluations: [], safety: [] }, outreach: { plans: [], templates: [], messages: [] },
  };
  const actor = (id) => ({ userId: id, displayName: id, email: `${id}@example.invalid` });
  const as = (id) => { const m = state.members.find(x => x.userId === id); state.workspace.role = m.role; patient.assigned = m.teamIds.includes(patient.teamId) && (m.role !== 'asha' || patient.assignedTo === id); return m; };
  const plan = (id) => actionPlan(state, as(id), patient, now);

  check(() => {
    const rows = plan('worker').items.filter(item => item.kind === 'referral' || item.kind === 'follow-up');
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.ok(row.reason.length > 0, 'reason is visible');
      assert.ok(row.status.length > 0, 'state is visible');
      assert.ok(row.due, 'due time is visible where required by the fixture');
      assert.ok(row.owner?.eligible || row.queue, 'active work has an eligible owner or responsible queue');
    }
  });
  check(() => {
    const referral = plan('worker').items.find(item => item.key === 'referral:referral');
    assert.equal(referral.owner, null);
    assert.equal(referral.queue, 'Supervisors of Care Team');
    assert.equal(referral.attention, 'escalated');
    assert.equal(referral.canClaim, true);
  });
  check(() => {
    const followUp = plan('worker').items.find(item => item.key === 'follow-up:follow-up');
    assert.equal(followUp.owner.displayName, 'Former member');
    assert.equal(followUp.owner.eligible, false);
    assert.equal(followUp.queue, 'Supervisors of Care Team');
    assert.match(followUp.ownershipGap, /no longer has current care access/);
  });
  check(() => status(() => plan('outsider'), 403));
  check(() => {
    const command = { type: 'assignPlanItem', personId: patient.id, version: 3, targets: [{ kind: 'referral', id: 'referral', version: 1 }], ownerId: 'worker', reason: 'Taking responsibility for urgent assessment' };
    status(() => applyActionPlan(state, { ...command, version: 2 }, actor('worker'), as('worker'), now), 409);
    assert.equal(state.workspace.referrals[0].ownerId, null, 'stale command has no side effect');
    assert.equal(state.workspace.audit.length, 0, 'stale command writes no audit claim');
  });
  check(() => {
    const command = { type: 'assignPlanItem', personId: patient.id, version: 3, targets: [{ kind: 'referral', id: 'referral', version: 1 }], ownerId: 'outsider', reason: 'Attempt assignment outside current care scope' };
    status(() => applyActionPlan(state, command, actor('supervisor'), as('supervisor'), now), 422);
    assert.equal(state.workspace.referrals[0].ownerId, null);
  });
  check(() => {
    const command = { type: 'assignPlanItem', personId: patient.id, version: 3, targets: [{ kind: 'referral', id: 'referral', version: 1 }], ownerId: 'worker', reason: 'Taking responsibility for urgent assessment' };
    assert.deepEqual(applyActionPlan(state, command, actor('worker'), as('worker'), now), { assigned: 1, ownerId: 'worker' });
    const row = plan('worker').items.find(item => item.key === 'referral:referral');
    assert.equal(row.owner.userId, 'worker');
    assert.equal(row.owner.eligible, true);
    assert.equal(row.queue, null);
    assert.match(state.workspace.audit.at(-1).detail, /Ownership taken/);
  });
  check(() => {
    const replay = { type: 'assignPlanItem', personId: patient.id, version: 3, targets: [{ kind: 'referral', id: 'referral', version: 1 }], ownerId: 'worker', reason: 'Replaying an already committed ownership command' };
    status(() => applyActionPlan(state, replay, actor('worker'), as('worker'), now), 409);
    assert.equal(state.workspace.audit.length, 1, 'losing race does not append a second audit event');
  });

  writeFileSync('tests/action-ownership-contract-result.json', JSON.stringify({ suite: 'SAHA-099 action ownership', passed, failed: 0, completedAt: new Date().toISOString(), limits: 'Synthetic local contract evidence only; not formal acceptance, CI, merge or deployment.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, failed: 0 }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
