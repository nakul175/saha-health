// Slice 1f caseload schedule contract: automatic application of due transfers, holds, and household transfer on in-memory state.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.caseload-schedule-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'installed-transition-authority', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
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

  const household = (s, id, members, over = {}) => { (s.households ??= []).push({ id, version: 1, label: `Household ${id}`, teamId: 't1', members: members.map(pid => ({ personId: pid, relationship: 'other', from: '2026-01-01', addedBy: 'owner', addedAt: now })), createdAt: now, createdBy: 'owner', ...over }); for (const pid of members) s.workspace.people.find(p => p.id === pid).householdId = id; };
  const hh = (over = {}) => ({ type: 'caseloadHouseholdTransfer', teamId: 't1', fromUserId: 'a1', toUserId: 'a2', householdId: 'h1', householdVersion: 1, effectiveAt: null, reason: 'Synthetic household handover', ...over });
  const audits = (s, action) => s.workspace.audit.filter(a => a.action === action);

  // Due selection and the effective-time boundary.
  let s = fresh();
  run(s, 'sup', transfer({ effectiveAt: at(day) }));
  const t1 = s.caseloads[0];
  check(() => { assert.deepEqual(c.dueTransfers(s, at(day - 1)), []); assert.deepEqual(c.dueTransfers(s, at(day)).map(t => t.id), [t1.id]); });
  check(() => { assert.deepEqual(c.applyDueTransfers(s, at(day - 1)), []); assert.equal(t1.state, 'scheduled'); assert.equal(s.workspace.people[0].assignedTo, 'a1'); });
  // Applied at the effective time, by the scheduler, with the same moves as a manual application.
  const r1 = c.applyDueTransfers(s, at(day));
  check(() => { assert.deepEqual(r1, [{ transferId: t1.id, state: 'applied', moved: 2, skipped: 0 }]); assert.equal(t1.state, 'applied'); assert.equal(t1.version, 2); assert.equal(t1.applied.automatic, true); assert.equal(t1.applied.by, 'system'); });
  check(() => { const p1 = s.workspace.people[0]; assert.equal(p1.assignedTo, 'a2'); assert.equal(p1.followUps[0].ownerId, 'a2'); assert.equal(p1.fieldLeases[0].status, 'revoked'); assert.equal(p1.assignmentHistory.at(-1).by, 'system'); assert.equal(p1.assignmentHistory.at(-1).transferId, t1.id); assert.equal(p1.version, 2); });
  check(() => { const a = audits(s, 'caseloadAutoApply'); assert.equal(a.length, 1); assert.equal(a[0].actorId, 'system'); assert.equal(a[0].role, 'system'); assert.equal(a[0].subject, t1.id); assert.ok(!a[0].detail.includes('P1')); });
  // Idempotent: a second evaluation changes nothing and the receiver acknowledges as usual.
  check(() => { assert.deepEqual(c.applyDueTransfers(s, at(day + 1000)), []); assert.equal(audits(s, 'caseloadAutoApply').length, 1); assert.equal(t1.version, 2); });
  check(() => assert.deepEqual(run(s, 'a2', { type: 'caseloadAcknowledge', transferId: t1.id, version: 2, reference: 'SYNTH-AUTO' }), { acknowledged: 2, notAcknowledged: 0 }));
  // A patient reassigned before the effective time is skipped, as for a manual application.
  s = fresh(); run(s, 'sup', transfer({ effectiveAt: at(day) })); s.workspace.people[1].assignedTo = 'owner';
  check(() => { const r = c.applyDueTransfers(s, at(day)); assert.equal(r[0].moved, 1); assert.equal(r[0].skipped, 1); assert.equal(s.caseloads[0].applied.skipped[0].reason, 'Assignment changed after the transfer was scheduled.'); });
  // Holds: receiver no longer eligible, scheduling steward no longer stewarding the team, or nobody left to move.
  s = fresh(); run(s, 'sup', transfer({ effectiveAt: at(day) })); s.members.find(x => x.userId === 'a2').status = 'suspended';
  let r2 = c.applyDueTransfers(s, at(day)); const t2 = s.caseloads[0];
  check(() => { assert.equal(r2[0].state, 'held'); assert.equal(t2.state, 'held'); assert.equal(t2.version, 2); assert.match(t2.held.reason, /receiving worker/); assert.equal(s.workspace.people[0].assignedTo, 'a1', 'nothing moves on a hold'); assert.equal(audits(s, 'caseloadHold').length, 1); });
  check(() => { assert.deepEqual(c.applyDueTransfers(s, at(2 * day)), [], 'a held transfer is never retried automatically'); assert.equal(audits(s, 'caseloadHold').length, 1); });
  check(() => { const v = c.caseloadView(s, as(s, 'sup')[1], {}, at(day)); const x = v.transfers.find(t => t.id === t2.id); assert.equal(x.state, 'held'); assert.match(x.held.reason, /receiving worker/); assert.equal(x.automatic, false); });
  check(() => { status(() => run(s, 'sup', transfer({ toUserId: 'owner', personIds: ['p1'], effectiveAt: at(3 * day) }), at(day)), 409); status(() => run(s, 'a1', { type: 'caseloadApply', transferId: t2.id, version: 2 }, at(day)), 403); status(() => run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: 2 }, at(day)), 422); });
  s.members.find(x => x.userId === 'a2').status = 'active';
  check(() => { const r = run(s, 'sup', { type: 'caseloadApply', transferId: t2.id, version: 2 }, at(day)); assert.equal(r.moved, 2); assert.equal(t2.state, 'applied'); assert.equal(t2.applied.automatic, undefined); assert.equal(t2.applied.by, 'sup'); });
  s = fresh(); run(s, 'sup', transfer({ effectiveAt: at(day) })); s.members.find(x => x.userId === 'sup').teamIds = ['t2'];
  check(() => { const r = c.applyDueTransfers(s, at(day)); assert.equal(r[0].state, 'held'); assert.match(s.caseloads[0].held.reason, /no longer manages this team/); });
  s = fresh(); run(s, 'sup', transfer({ effectiveAt: at(day) })); s.members.find(x => x.userId === 'sup').status = 'suspended';
  check(() => { c.applyDueTransfers(s, at(day)); assert.match(s.caseloads[0].held.reason, /no longer an active member/); });
  s = fresh(); run(s, 'sup', transfer({ effectiveAt: at(day) })); s.workspace.people[0].assignedTo = 'owner'; s.workspace.people[1].assignedTo = 'owner';
  check(() => { c.applyDueTransfers(s, at(day)); assert.equal(s.caseloads[0].state, 'held'); assert.match(s.caseloads[0].held.reason, /still assigned to the sending worker/); });
  check(() => { run(s, 'sup', { type: 'caseloadCancel', transferId: s.caseloads[0].id, version: 2, reason: 'Synthetic cancel of held transfer' }, at(day)); assert.equal(s.caseloads[0].state, 'cancelled'); });
  // Several due transfers are taken in effective-time order in one evaluation.
  s = fresh(); run(s, 'sup', transfer({ personIds: ['p2'], effectiveAt: at(2 * day) })); run(s, 'sup', transfer({ personIds: ['p1'], effectiveAt: at(day) }));
  check(() => assert.deepEqual(c.applyDueTransfers(s, at(3 * day)).map(x => x.transferId), [s.caseloads[1].id, s.caseloads[0].id]));
  // Household transfer: every current member held by the sending worker; members held elsewhere are reported, not moved.
  s = fresh(); household(s, 'h1', ['p1', 'p2', 'p3']); s.workspace.people[2].assignedTo = 'a2';
  const h1 = run(s, 'sup', hh());
  check(() => { assert.equal(h1.state, 'applied'); assert.equal(h1.moved, 2); assert.equal(h1.householdId, 'h1'); assert.deepEqual(h1.notIncluded.map(x => x.personId), ['p3']); assert.equal(s.caseloads[0].householdId, 'h1'); assert.deepEqual(s.caseloads[0].personIds, ['p1', 'p2']); });
  check(() => { const v = c.caseloadView(s, as(s, 'sup')[1], { teamId: 't1', fromUserId: 'a2' }, now); assert.equal(v.transfers[0].household, true); assert.deepEqual(v.preview.patients.find(p => p.id === 'p1').household, { id: 'h1', version: 1, label: 'Household h1' }); });
  // Refusals: worker, stale version, unknown household, a member outside the requester's scope, nobody held by the sender.
  s = fresh(); household(s, 'h1', ['p1', 'p2']); household(s, 'h2', ['p3', 'p4']); household(s, 'h3', ['p4']);
  check(() => { status(() => run(s, 'a1', hh()), 403); status(() => run(s, 'adm', hh()), 403); status(() => run(s, 'sup', hh({ householdVersion: 2 })), 409); status(() => run(s, 'sup', hh({ householdId: 'nope' })), 404); });
  check(() => { const e = status(() => run(s, 'sup', hh({ householdId: 'h2' })), 403); assert.match(e.message, /1 current member of this household is outside your care scope/); assert.ok(!e.message.includes('P4')); });
  check(() => status(() => run(s, 'sup', hh({ householdId: 'h3' })), 404, 'a household with no member in scope is answered as not found'));
  check(() => status(() => run(s, 'sup', hh({ fromUserId: 'a2', toUserId: 'a1' })), 409));
  check(() => assert.equal(c.applyCaseload(s, { ...hh(), personIds: ['p1'] }, {}, {}), null, 'the household command is strict'));
  check(() => { const [, m] = as(s, 'a1'); status(() => c.authorizeCaseload(s, m, hh()), 403); const [, sm] = as(s, 'sup'); assert.equal(c.authorizeCaseload(s, sm, hh()), undefined); });
  check(() => { const [, sm] = as(s, 'sup'); s.workspace.people[1].teamId = 't2'; s.workspace.people[1].assignedTo = 'a3'; const e = status(() => c.authorizeCaseload(s, sm, hh()), 403); assert.ok(!e.message.includes('P2')); s.workspace.people[1].teamId = 't1'; s.workspace.people[1].assignedTo = 'a1'; });
  // A scheduled household transfer re-checks membership at application: a member who left is skipped.
  s = fresh(); household(s, 'h1', ['p1', 'p2']);
  run(s, 'sup', hh({ effectiveAt: at(day) }));
  check(() => { status(() => run(s, 'sup', hh({ effectiveAt: at(2 * day) })), 409); });
  Object.assign(s.households[0].members[1], { to: '2026-09-30', endedBy: 'owner', endReason: 'Synthetic move' });
  check(() => { const r = c.applyDueTransfers(s, at(day)); assert.equal(r[0].moved, 1); assert.deepEqual(s.caseloads[0].applied.skipped, [{ personId: 'p2', reason: 'Left the household after the transfer was scheduled.' }]); assert.equal(s.workspace.people[1].assignedTo, 'a1'); });
  check(() => assert.match(c.RULES, /applies automatically/));
  check(() => { const t = s.caseloads[0]; assert.equal(t.householdId, 'h1'); assert.equal(audits(s, 'caseloadAutoApply').length, 1); });
  // The server hook: one indexed due query for active members, the full load only when something is due, the
  // organisation-wide commit guard, and no timer.
  const hook = readFileSync('lib/saha/caseload-schedule.ts', 'utf8'), server = readFileSync('lib/saha/server.ts', 'utf8');
  check(() => { assert.match(hook, /state='scheduled' AND json_extract\(data,'\$\.effectiveAt'\)<=\? AND EXISTS \(SELECT 1 FROM memberships WHERE org_id=\? AND user_id=\? AND status='active'\)/); assert.match(hook, /await persist\(d, before, state, SCHEDULER, \{ type: 'caseloadAutoApply' \}/); assert.match(hook, /maintenance/); assert.ok(!/setInterval|setTimeout|scheduled\(/.test(hook)); });
  check(() => assert.match(server, /const id=await activeOrg\(u,orgId\);\n \/\/ Slice 1f[^\n]*\n await applyDueCaseloads\(db\(\),id,u\.userId\);/));
  const result = { suite: 'caseload schedule contract (slice 1f)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/caseload-schedule-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
