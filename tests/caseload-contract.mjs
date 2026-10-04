// Slice 1b caseload contract: transfer, scheduling, acknowledgement, removal and gap rules on in-memory state.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.caseload-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const c = await import(pathToFileURL(join(dir, 'caseload.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', day = 86400000, at = ms => new Date(Date.parse(now) + ms).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 30, sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  const fresh = () => {
    const s = {
      organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }, { id: 't2', name: 'Two', createdAt: now }], invitations: [],
      members: [member('owner', 'clinician', ['t1'], { isOwner: true }), member('sup', 'supervisor', ['t1']), member('a1', 'asha', ['t1']), member('a2', 'asha', ['t1']), member('a3', 'asha', ['t2']), member('adm', 'admin', [], { isOwner: true })],
      workspace: { schemaVersion: 1, revision: 1, role: 'supervisor', integrations: [], submissions: [], receipts: {}, audit: [],
        people: ['p1', 'p2', 'p3'].map(id => ({ ...base, id, name: id.toUpperCase(), teamId: 't1', assignedTo: 'a1', followUps: [{ id: `f-${id}`, enrolmentId: 'e', packId: 'maternal', title: 'Check', due: id === 'p1' ? '2026-10-01' : '2026-11-20', ownerId: 'a1', state: 'open' }], fieldLeases: [{ id: `l-${id}`, status: 'active' }] })).concat([{ ...base, id: 'p4', name: 'P4', teamId: 't2', assignedTo: 'a3' }]),
        visits: [{ id: 'v1', personId: 'p1', plan: { id: 'pl', state: 'proposed' } }],
        referrals: [{ id: 'r1', personId: 'p1', visitId: 'v1', facility: 'F', reason: 'Synthetic', state: 'sent', createdAt: now, ownerId: 'a1', due: '2026-09-29', version: 1 }] },
      caseloads: [],
    };
    return s;
  };
  const as = (s, userId) => { const m = s.members.find(x => x.userId === userId); for (const p of s.workspace.people) p.assigned = allowed(m, p); return [{ userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, m]; };
  const run = (s, userId, cmd, when = now) => { const [u, m] = as(s, userId); return c.applyCaseload(s, cmd, u, m, when); };
  const transfer = (over = {}) => ({ type: 'caseloadTransfer', teamId: 't1', fromUserId: 'a1', toUserId: 'a2', personIds: ['p1', 'p2'], effectiveAt: null, reason: 'Synthetic leave cover', ...over });

  check(() => { assert.equal(c.urgent({ due: '2026-09-30' }, now), true); assert.equal(c.urgent({ due: '2026-10-02' }, now), true); assert.equal(c.urgent({ due: '2026-10-03' }, now), false); assert.equal(c.urgent({ due: null }, now), false); assert.equal(c.urgent({ due: '2026-09-01T00:00:00Z' }, now), true); });
  check(() => assert.equal(c.applyCaseload(fresh(), { type: 'startVisit' }, {}, {}), null, 'other commands are not handled'));
  let s = fresh();
  check(() => { status(() => run(s, 'a1', transfer()), 403); status(() => run(s, 'adm', transfer()), 403); status(() => run(s, 'sup', transfer({ teamId: 't2', fromUserId: 'a3', personIds: ['p4'] })), 403); });
  check(() => { status(() => run(s, 'sup', transfer({ toUserId: 'a3' })), 422); status(() => run(s, 'sup', transfer({ toUserId: 'sup' })), 422); status(() => run(s, 'sup', transfer({ toUserId: 'a1' })), 422); });
  check(() => status(() => run(s, 'sup', transfer({ personIds: ['p1', 'p4'] })), 409));
  check(() => { s.members.find(x => x.userId === 'a2').status = 'suspended'; status(() => run(s, 'sup', transfer()), 422); s.members.find(x => x.userId === 'a2').status = 'active'; });
  const r1 = run(s, 'sup', transfer());
  const t1 = s.caseloads[0];
  check(() => { assert.equal(r1.moved, 2); assert.equal(t1.state, 'applied'); assert.deepEqual(t1.applied.moved, ['p1', 'p2']); assert.equal(t1.version, 2); });
  check(() => { const p1 = s.workspace.people[0]; assert.equal(p1.assignedTo, 'a2'); assert.equal(p1.followUps[0].ownerId, 'a2'); assert.equal(s.workspace.referrals[0].ownerId, 'a2'); assert.equal(p1.fieldLeases[0].status, 'revoked'); assert.equal(s.workspace.visits[0].plan.state, 'blocked'); assert.equal(p1.assignmentHistory.at(-1).transferId, t1.id); assert.equal(t1.applied.assignments.p1, p1.assignmentHistory.at(-1).id); });
  check(() => { assert.equal(s.workspace.people[2].assignedTo, 'a1', 'unselected patient stays'); assert.equal(s.workspace.audit.at(-1).action, 'caseloadTransfer'); });
  // Scheduling.
  check(() => { status(() => run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', effectiveAt: at(-60000) })), 422); status(() => run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', effectiveAt: at(61 * day) })), 422); });
  const r2 = run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', effectiveAt: at(day) }));
  const t2 = s.caseloads[1];
  check(() => { assert.equal(r2.state, 'scheduled'); assert.equal(s.workspace.people[0].assignedTo, 'a2', 'scheduled transfer moves nothing yet'); });
  check(() => status(() => run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', personIds: ['p2'], effectiveAt: at(2 * day) })), 409));
  check(() => { status(() => run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: 1 }), 409); status(() => run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: 9 }, at(day)), 409); status(() => run(s, 'a1', { type: 'caseloadApply', transferId: t2.id, version: 1 }, at(day)), 403); });
  // The first acknowledgement is by the receiving worker only.
  check(() => { status(() => run(s, 'a1', { type: 'caseloadAcknowledge', transferId: t1.id, version: t1.version, reference: 'SYNTH' }), 403); });
  // p2 is reassigned by hand before the scheduled transfer applies; it is skipped, not moved.
  s.workspace.people[1].assignedTo = 'owner';
  const r3 = run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: 1 }, at(day + 60000));
  check(() => { assert.equal(r3.moved, 1); assert.deepEqual(r3.skipped.map(x => x.personId), ['p2']); assert.equal(s.workspace.people[0].assignedTo, 'a1'); assert.equal(t2.state, 'applied'); });
  check(() => status(() => run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: t2.version }, at(2 * day)), 409));
  // a2 acknowledges transfer 1: p1 moved on, p2 was reassigned; neither can be acknowledged.
  const ack = run(s, 'a2', { type: 'caseloadAcknowledge', transferId: t1.id, version: t1.version, reference: 'SYNTH-MEETING' });
  check(() => { assert.deepEqual(ack, { acknowledged: 0, notAcknowledged: 2 }); assert.deepEqual(t1.acknowledgement.notAcknowledged, ['p1', 'p2']); });
  check(() => status(() => run(s, 'a2', { type: 'caseloadAcknowledge', transferId: t1.id, version: t1.version, reference: 'AGAIN' }), 409));
  const ack2 = run(s, 'a1', { type: 'caseloadAcknowledge', transferId: t2.id, version: t2.version, reference: 'SYNTH-2' });
  check(() => { assert.equal(ack2.acknowledged, 1); assert.equal(s.workspace.people[0].assignmentHistory.at(-1).acknowledgement.reference, 'SYNTH-2'); });
  // Cancel.
  s = fresh();
  run(s, 'sup', transfer({ effectiveAt: at(day) }));
  const t3 = s.caseloads[0];
  check(() => assert.equal(run(s, 'sup', { type: 'caseloadCancel', transferId: t3.id, version: 1, reason: 'short' }), null, 'schema rejects a short reason before any change'));
  check(() => { run(s, 'sup', { type: 'caseloadCancel', transferId: t3.id, version: 1, reason: 'Synthetic change of plan' }); assert.equal(t3.state, 'cancelled'); assert.equal(t3.cancelled.by, 'sup'); status(() => run(s, 'sup', { type: 'caseloadApply', transferId: t3.id, version: 2 }, at(2 * day)), 409); assert.equal(s.workspace.people[0].assignedTo, 'a1'); });
  check(() => { run(s, 'sup', transfer({ personIds: ['p1', 'p2', 'p3'] })); status(() => run(s, 'sup', transfer({ personIds: ['p1'] })), 409); });
  // Removal: owners only, never self, and only once no caseload, open work or scheduled transfer remains.
  check(() => { status(() => run(s, 'sup', { type: 'removeMember', userId: 'a1', version: 1, reason: 'Synthetic departure' }), 403); status(() => run(s, 'owner', { type: 'removeMember', userId: 'owner', version: 1, reason: 'Synthetic departure' }), 422); });
  check(() => { const e = status(() => run(s, 'owner', { type: 'removeMember', userId: 'a2', version: 1, reason: 'Synthetic departure' }), 409); assert.match(e.message, /3 assigned patients and 4 open items/); status(() => run(s, 'owner', { type: 'removeMember', userId: 'a3', version: 1, reason: 'Synthetic departure' }), 409); });
  run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', personIds: ['p3'], effectiveAt: at(day) }));
  check(() => { const e = status(() => run(s, 'owner', { type: 'removeMember', userId: 'a1', version: 1, reason: 'Synthetic departure' }), 409); assert.match(e.message, /scheduled/); });
  const t4 = s.caseloads.at(-1); run(s, 'sup', { type: 'caseloadCancel', transferId: t4.id, version: 1, reason: 'Synthetic change of plan' });
  check(() => { run(s, 'owner', { type: 'removeMember', userId: 'a1', version: 1, reason: 'Synthetic departure' }); const a1 = s.members.find(x => x.userId === 'a1'); assert.equal(a1.status, 'removed'); assert.deepEqual(a1.teamIds, []); assert.equal(a1.version, 2); assert.equal(s.workspace.audit.at(-1).action, 'removeMember'); status(() => run(s, 'owner', { type: 'removeMember', userId: 'a1', version: 2, reason: 'Synthetic departure' }), 409); status(() => run(s, 'owner', { type: 'removeMember', userId: 'a1', version: 1, reason: 'Synthetic departure' }), 409); });
  check(() => status(() => run(s, 'sup', transfer({ fromUserId: 'a2', toUserId: 'a1', personIds: ['p3'] })), 422));
  // Responsibility gaps.
  s = fresh();
  s.members.find(x => x.userId === 'a1').status = 'suspended';
  s.workspace.people[1].assignedTo = 'a3';
  s.workspace.people[2].followUps[0].ownerId = 'a2';
  s.workspace.people.push({ ...base, id: 'p5', name: 'P5', teamId: 't1', assignedTo: null, followUps: [{ id: 'f5', title: 'Check', due: '2026-09-30', ownerId: null, state: 'open' }] });
  const gaps = c.responsibilityGaps(s, s.workspace.people.filter(p => p.teamId === 't1'), now);
  check(() => { const kinds = Object.fromEntries(gaps.map(g => [g.personId + ':' + g.kind, g.urgent])); assert.equal(kinds['p1:inactive-assignee'], true); assert.equal(kinds['p2:assignee-outside-team'], false); assert.equal(kinds['p3:inactive-assignee'], false); assert.equal(kinds['p3:other-owner'], false); assert.equal(kinds['p5:unassigned-open-work'], true); assert.equal(gaps[0].urgent, true, 'urgent gaps first'); });
  // View.
  check(() => { const [, m] = as(s, 'a2'); status(() => c.caseloadView(s, m, { teamId: 't1', fromUserId: 'a1' }, now), 403); assert.equal(c.caseloadView(s, m, {}, now).steward, false); });
  check(() => { const [, m] = as(s, 'sup'); const v = c.caseloadView(s, m, { teamId: 't1', fromUserId: 'a1' }, now); assert.equal(v.steward, true); assert.equal(v.workers.find(x => x.userId === 'a1').patients, 2); assert.equal(v.workers.find(x => x.userId === 'a1').urgent, 2); assert.equal(v.workers.some(x => x.userId === 'adm'), false); assert.deepEqual(v.preview.recipients.map(r => r.userId).sort(), ['a2', 'owner']); assert.equal(v.preview.patients.length, 2); assert.ok(v.gapCount >= 4); status(() => c.caseloadView(s, m, { teamId: 't2', fromUserId: 'a3' }, now), 403); status(() => c.caseloadView(s, m, { teamId: 't1' }, now), 422); });
  const result = { suite: 'caseload contract (slice 1b)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/caseload-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
