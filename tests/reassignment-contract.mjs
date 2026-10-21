// Slice r74 reassignment contract: automatic (derived-on-read) reassignment of lost-owner work and
// the assignQueueItem command (assigning follow-ups, referrals and safety cases directly from the queue).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.reassignment-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'reassignment', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'reassignment.js')));
  const now = '2026-09-30T06:00:00.000Z', ago = n => new Date(Date.parse(now) - n * 86400000).toISOString(), ahead = n => ago(-n), aheadDate = n => ahead(n).slice(0, 10);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 1, teamId: 't1', assigned: true, assignedTo: 'asha' };
  const fu = (id, over = {}) => ({ id, enrolmentId: 'e1', packId: 'maternal', title: 'Home visit', due: aheadDate(2), ownerId: 'asha', state: 'open', createdAt: now, createdBy: 'asha', ...over });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('doc', 'clinician'), member('sup', 'supervisor'), member('sup2', 'supervisor', { teamIds: ['t2'] }), member('asha2', 'asha', { teamIds: ['t2'] }),
      member('own', 'clinician', { isOwner: true, teamIds: [] }), member('owncli', 'clinician', { isOwner: true }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('gone', 'asha', { status: 'suspended' })],
    workspace: { role: 'supervisor', audit: [], integrations: [], submissions: [],
      people: [
        { ...base, id: 'p1', name: 'P1',
          followUps: [fu('f1', { ownerId: 'gone', createdAt: ago(5) }), fu('f2', { createdAt: ago(4) }), fu('f3', { ownerId: 'gone', state: 'completed', createdAt: ago(6) })] },
        { ...base, id: 'p2', name: 'P2', teamId: 't2', assignedTo: 'asha2',
          followUps: [fu('f4', { ownerId: 'gone', createdAt: ago(2) })] }],
      visits: [{ id: 'v1', personId: 'p1', state: 'confirmed' }],
      referrals: [
        { id: 'r1', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'BP', state: 'sent', createdAt: ago(3), due: aheadDate(5), urgency: 'routine', version: 1 },
        { id: 'r2', personId: 'p1', visitId: 'v1', facility: 'PHC', reason: 'Scan', state: 'sent', createdAt: ago(4), ownerId: 'asha', due: aheadDate(9), urgency: 'routine', version: 1 },
        { id: 'r3', personId: 'p1', visitId: 'v1', facility: 'DH', reason: 'Done', state: 'completed', createdAt: ago(4), ownerId: 'gone', due: aheadDate(1), version: 2 },
        { id: 'r4', personId: 'p2', visitId: 'v9', facility: 'DH', reason: 'Other', state: 'sent', createdAt: ago(2), due: aheadDate(1), version: 1 }] },
    governance: { entries: [], evaluations: [], safety: [
      { id: 'sc1', personId: 'p1', visitId: 'v1', ownerId: 'asha', kind: 'potential-harm', summary: 'x', state: 'open', version: 1, createdAt: ago(10) },
      { id: 'sc2', personId: 'p1', visitId: 'v1', ownerId: 'doc', kind: 'missed-escalation', summary: 'y', state: 'open', version: 1, createdAt: ago(9) },
      { id: 'sc3', personId: 'p1', visitId: 'v1', ownerId: 'gone', kind: 'wrong-patient', summary: 'z', state: 'closed', version: 2, createdAt: ago(8) },
      { id: 'sc4', personId: 'p2', visitId: 'v9', ownerId: 'gone', kind: 'potential-harm', summary: 'w', state: 'open', version: 1, createdAt: ago(1) }] },
  };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id);
  const lw = userId => x.lostWork(s, M(userId), now);

  // Derived-on-read automatic reassignment: lost owners surface with their responsible queue.
  check(() => {
    const sup = lw('sup');
    assert.deepEqual(sup.items.map(i => `${i.kind}:${i.id}`), ['safety-case:sc1', 'follow-up:f1', 'referral:r1'],
      'safety case first, then the lost follow-up and referral; owned, completed, closed and other-team work excluded');
    assert.equal(sup.total, 3); assert.equal(sup.truncated, false);
  });
  check(() => {
    const sup = lw('sup');
    const sc1 = sup.items.find(i => i.id === 'sc1');
    assert.equal(sc1.reassignedTo, 'Clinicians of Team One'); assert.match(sc1.reason, /no longer holds a clinical role/);
    assert.equal(sc1.ownerId, 'asha'); assert.equal(sc1.ownerName, 'ASHA'); assert.equal(sc1.automatic, true);
    assert.equal(sc1.canAssign, true); assert.equal(sc1.canClaim, false);
    assert.equal(sc1.link.href, '/?patient=p1&visit=v1');
    const f1 = sup.items.find(i => i.id === 'f1');
    assert.equal(f1.reassignedTo, 'Supervisors of Team One'); assert.match(f1.reason, /no longer an active member/);
    assert.equal(f1.ownerName, 'GONE'); assert.equal(f1.recovery, 'Assign the follow-up to an eligible care worker from here, or complete it from the patient\'s action plan.');
    const r1 = sup.items.find(i => i.id === 'r1');
    assert.equal(r1.reason, 'No named care worker'); assert.equal(r1.ownerId, null); assert.equal(r1.ownerName, null);
    assert.equal(r1.reassignedTo, 'Supervisors of Team One');
  });
  check(() => {
    status(() => lw('adm'), 403);
    assert.equal(lw('own').items.length, 0, 'an owner outside the patient team sees no rows');
    const two = lw('sup2');
    assert.deepEqual(two.items.map(i => `${i.kind}:${i.id}`), ['safety-case:sc4', 'follow-up:f4', 'referral:r4'], 'supervisor sees only their own team');
    assert.equal(two.items.find(i => i.id === 'sc4').reassignedTo, 'Clinicians of Team Two');
    status(() => lw('asha'), 403, 'a care worker has no reporting read');
  });

  // assignQueueItem command.
  const run = (userId, cmd) => x.applyReassignment(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x' }, M(userId), now);
  const cmd = (over = {}) => ({ type: 'assignQueueItem', targets: [{ kind: 'referral', id: 'r1', version: 1 }], ownerId: 'asha', reason: 'Taking the unowned referral', ...over });
  check(() => {
    assert.equal(run('sup', { type: 'somethingElse' }), null, 'a non-reassignment type is not this schema');
    assert.equal(run('sup', cmd({ reason: 'short' })), null, 'a too-short reason is not this schema');
    status(() => run('adm', cmd()), 403); status(() => run('own', cmd()), 403, 'owner authority does not override scope');
    status(() => run('sup2', cmd()), 403);
    status(() => run('sup', cmd({ targets: [{ kind: 'referral', id: 'r1', version: 1 }, { kind: 'referral', id: 'r1', version: 1 }] })), 422, 'duplicate targets refused');
    status(() => run('sup', cmd({ targets: [{ kind: 'referral', id: 'r1', version: 9 }] })), 409, 'stale referral version');
    status(() => run('sup', cmd({ targets: [{ kind: 'referral', id: 'r3', version: 2 }] })), 409, 'closed referral');
    status(() => run('sup', cmd({ ownerId: 'gone' })), 422, 'suspended owner not eligible');
    status(() => run('sup', cmd({ ownerId: 'asha2' })), 422, 'owner in the other team not eligible for p1');
    status(() => run('sup', cmd({ ownerId: 'own' })), 422, 'owner outside the team not eligible');
    status(() => run('asha', cmd({ ownerId: 'doc' })), 403, 'care worker cannot assign someone else');
    status(() => run('asha', cmd({ targets: [{ kind: 'referral', id: 'r2', version: 1 }] })), 403, 'care worker cannot claim an owned referral');
  });
  check(() => {
    const audits = s.workspace.audit.length;
    const r = run('sup', cmd());
    assert.deepEqual(r, { assigned: 1, ownerId: 'asha' });
    const r1 = s.workspace.referrals.find(r => r.id === 'r1');
    assert.equal(r1.ownerId, 'asha'); assert.equal(r1.version, 2);
    assert.equal(P('p1').version, 1, 'referral-only reassignment keeps the patient version');
    assert.equal(s.workspace.audit.length, audits + 1); assert.match(s.workspace.audit.at(-1).detail, /^Reassigned to ASHA: referral to CHC from nobody\. Taking/);
    assert.equal(lw('sup').items.some(i => i.id === 'r1'), false, 'the reassigned referral leaves the queue');
  });
  check(() => {
    // A care worker takes ownership for themselves of an unowned follow-up.
    const audits = s.workspace.audit.length;
    const r = run('asha', cmd({ targets: [{ kind: 'follow-up', id: 'f1' }], ownerId: 'asha', reason: 'Owner left the team' }));
    assert.deepEqual(r, { assigned: 1, ownerId: 'asha' });
    assert.equal(P('p1').followUps.find(f => f.id === 'f1').ownerId, 'asha');
    assert.equal(P('p1').version, 2, 'a follow-up reassignment bumps the patient version');
    assert.match(s.workspace.audit.at(-1).detail, /^Ownership taken to ASHA: follow-up "Home visit" from GONE\. Owner left/);
    assert.equal(s.workspace.audit.length, audits + 1);
  });
  check(() => {
    // Safety-case reassignment beyond clinicians: a supervisor (not the clinician owner) reassigns it.
    const audits = s.workspace.audit.length;
    const r = run('sup', cmd({ targets: [{ kind: 'safety-case', id: 'sc1', version: 1 }], ownerId: 'doc', reason: 'Reassigning the safety case to the team clinician' }));
    assert.deepEqual(r, { assigned: 1, ownerId: 'doc' });
    const sc1 = s.governance.safety.find(x => x.id === 'sc1');
    assert.equal(sc1.ownerId, 'doc'); assert.equal(sc1.version, 2);
    assert.match(s.workspace.audit.at(-1).detail, /^Reassigned to DOC: safety case "potential harm" from ASHA\. Reassigning/);
    assert.equal(s.workspace.audit.length, audits + 1);
    assert.equal(lw('sup').items.some(i => i.id === 'sc1'), false, 'the reassigned safety case leaves the queue');
    status(() => run('asha', cmd({ targets: [{ kind: 'safety-case', id: 'sc2', version: 1 }], ownerId: 'asha', reason: 'A care worker tries to claim a safety case' })), 403, 'care workers cannot reassign safety cases');
    status(() => run('sup', cmd({ targets: [{ kind: 'safety-case', id: 'sc2', version: 1 }], ownerId: 'asha', reason: 'Assigning a safety case to a non-clinician' })), 422, 'a safety case needs a clinician owner');
    status(() => run('sup', cmd({ targets: [{ kind: 'safety-case', id: 'sc2', version: 9 }], ownerId: 'doc', reason: 'Stale safety-case version' })), 409);
  });
  check(() => {
    // Combined targets in one command: a supervisor reassigns an unowned follow-up and referral together.
    const audits = s.workspace.audit.length;
    const r = run('sup2', cmd({ targets: [{ kind: 'follow-up', id: 'f4' }, { kind: 'referral', id: 'r4', version: 1 }], ownerId: 'asha2', reason: 'Clearing both team-two items in one command' }));
    assert.equal(r.assigned, 2);
    assert.equal(s.workspace.audit.length, audits + 1);
  });
  check(() => {
    status(() => run('sup', cmd({ targets: [{ kind: 'follow-up', id: 'f2' }], ownerId: 'asha', reason: 'Reassigning an owned follow-up' })), 409, 'reassigning to the current owner is refused');
    status(() => run('sup', cmd({ targets: [{ kind: 'follow-up', id: 'nope' }], ownerId: 'asha', reason: 'Assigning a missing follow-up' })), 404);
    status(() => run('sup', cmd({ targets: [{ kind: 'follow-up', id: 'f3' }], ownerId: 'asha', reason: 'Assigning a completed follow-up' })), 409);
    status(() => run('sup', cmd({ targets: [{ kind: 'referral', id: 'r2', version: 1 }], ownerId: 'asha', reason: 'Already the owner' })), 409, 'a referral already owned by the target is refused');
    status(() => run('sup', cmd({ targets: [{ kind: 'safety-case', id: 'sc2', version: 1 }], ownerId: 'doc', reason: 'Already the safety-case owner' })), 409);
  });
  // Integration of #144 (review finding): owner authority never overrides patient scope. An owner whose role is ASHA and who is
  // in the team, but to whom the patient is not assigned (the server loads the patient with assigned: false for them), cannot
  // reassign that patient's safety case, as assignSafety already refused.
  check(() => {
    const ownAsha = member('ownasha', 'asha', { isOwner: true });
    const scoped = structuredClone(s); scoped.members.push(ownAsha); scoped.workspace.role = 'asha';
    for (const p of scoped.workspace.people) p.assigned = false;
    const e = status(() => x.authorizeReassignment(scoped, ownAsha, { type: 'assignQueueItem', targets: [{ kind: 'safety-case', id: 'sc1', version: 1 }], ownerId: 'doc', reason: 'Reassigning outside my care scope' }), 403);
    assert.match(e.message, /not assigned to this worker/);
  });
  writeFileSync('tests/reassignment-contract-result.json', JSON.stringify({ suite: 'reassignment contract (slice r74)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
