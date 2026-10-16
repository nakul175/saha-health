import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
import { startMiniflare } from './lib/miniflare.mjs';
import { client, identity } from './lib/worker.mjs';

const output = 'tests/reports/workforce-lifecycle-complete';
const state = resolve(tmpdir(), `saha-workforce-lifecycle-${randomUUID()}`);
mkdirSync(output, { recursive: true });
const checks = [];
const check = (condition, name) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
let worker, db, failure, disposed = false, portFree = false;
try {
  worker = await startMiniflare({ port: process.env.SAHA_TEST_PORT ?? 21910, name: 'workforce-lifecycle-complete', state, assetsFirst: true });
  db = await worker.mf.getD1Database('DB');
  const api = client(worker.base, { connectionClose: true }), tag = randomUUID().slice(0, 8);
  const owner = identity('lifecycle-owner', tag, 'Synthetic lifecycle owner');
  const workerIdentity = identity('lifecycle-worker', tag, 'Synthetic lifecycle worker');
  const wrongIdentity = identity('lifecycle-wrong', tag, 'Synthetic wrong account');
  const removable = identity('lifecycle-removable', tag, 'Synthetic removable member');
  const ownerWorkspace = ok(await api.get(owner, '/api/workspace'));
  const org = ownerWorkspace.organisation.id;
  const account = ok(await api.get(workerIdentity, '/api/workspace')).user.accountCode;
  const removableAccount = ok(await api.get(removable, '/api/workspace')).user.accountCode;
  const command = (who, body, expected = 200, key = randomUUID()) => api.command(who, body, org, key).then(response => {
    assert.equal(response.status, expected, response.text); return response;
  });
  const snapshot = () => api.get(owner, '/api/workspace', org).then(ok);
  const currentMember = async id => (await snapshot()).members.find(member => member.userId === id);

  const invitation = ok(await command(owner, { type: 'createInvite', accountCode: account, label: 'Synthetic verified worker', role: 'asha', teamIds: ['default'] })).result;
  check((await command(wrongIdentity, { type: 'joinOrganisation', token: invitation.token }, 403)).status === 403,
    'Account-bound invitation refuses a different trusted sign-in without activating membership');
  check(!(await snapshot()).members.some(member => member.userId === wrongIdentity.id),
    'Refused identity verification creates no organisation membership');
  ok(await command(workerIdentity, { type: 'joinOrganisation', token: invitation.token }));
  let member = await currentMember(workerIdentity.id);
  check(member.status === 'active' && member.role === 'asha' && member.teamIds.includes('default'),
    'Exact invited sign-in activates with the reviewed role and team');
  check((await command(workerIdentity, { type: 'joinOrganisation', token: invitation.token }, 403)).status === 403,
    'Single-use invitation cannot activate the account twice');

  ok(await command(owner, { type: 'updateMember', userId: member.userId, version: member.version, role: 'admin', teamIds: [], isOwner: false, status: 'active', reason: 'Synthetic accountable role reassignment' }));
  member = await currentMember(workerIdentity.id);
  check(member.role === 'admin' && member.version === 2 && (await api.get(workerIdentity, '/api/today', org)).status === 403,
    'Role reassignment advances membership version and the next online request uses the new role');
  ok(await command(owner, { type: 'updateMember', userId: member.userId, version: member.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'active', reason: 'Synthetic restore for offline grant test' }));

  let person = (await snapshot()).people.find(value => value.id === 'p_meena');
  ok(await command(owner, { type: 'assignPatient', personId: person.id, version: person.version, teamId: 'default', assignedTo: workerIdentity.id, reason: 'Synthetic lifecycle assignment' }));
  const visitId = ok(await command(workerIdentity, { type: 'startVisit', personId: person.id })).result.visitId;
  let current = await snapshot(), visit = current.visits.find(value => value.id === visitId); person = current.people.find(value => value.id === person.id);
  const grant = ok(await command(workerIdentity, { type: 'prepareFieldVisit', personId: person.id, version: person.version })).result;
  const preparedAgent = ok(await command(workerIdentity, { type: 'prepareAgent', visitId, version: visit.version, providerId: 'local', task: 'extract', input: 'Weight 58 kg' })).result;
  current = await snapshot();
  const preparedRun = current.visits.find(value => value.id === visitId).agentRuns.find(run => run.id === preparedAgent.runId);
  const grantWindowMs = Date.parse(grant.packet.payload.expiresAt) - Date.parse(grant.packet.payload.issuedAt);
  check(grant.packet.payload.userId === workerIdentity.id && grantWindowMs === 24 * 60 * 60 * 1000,
    'Disconnected encrypted copy has an explicit account-bound twenty-four-hour residual grant window');

  member = await currentMember(workerIdentity.id);
  const suspendedAt = performance.now();
  ok(await command(owner, { type: 'updateMember', userId: member.userId, version: member.version, role: member.role, teamIds: member.teamIds, isOwner: false, status: 'suspended', reason: 'Synthetic immediate online revocation' }));
  const onlineDenied = await api.get(workerIdentity, '/api/today', org), denialMs = performance.now() - suspendedAt;
  check(onlineDenied.status === 403 && denialMs < 300000,
    'Suspension refuses the next active-session online read within the five-minute requirement');
  check((await command(workerIdentity, { type: 'executeAgent', visitId, runId: preparedAgent.runId, inputHash: preparedRun.inputHash }, 403)).status === 403,
    'Suspension refuses a previously prepared privileged operation before execution');
  check((await command(workerIdentity, { type: 'syncFieldVisit', personId: person.id, leaseId: grant.packet.payload.leaseId,
    packageHash: grant.packageHash, offlineWorkHash: grant.packet.payload.offlineWork.hash, facts: grant.packet.payload.facts,
    answers: grant.packet.payload.programmeCapture?.answers ?? {}, absence: grant.packet.payload.programmeCapture?.absence ?? {} }, 403)).status === 403,
    'Reconnect upload from the residual offline grant rechecks and refuses suspended membership');
  check(Date.parse(grant.packet.payload.expiresAt) > Date.now(),
    'Suspension does not falsely claim remote erasure of the still-unexpired disconnected grant');

  const removableInvite = ok(await command(owner, { type: 'createInvite', accountCode: removableAccount, label: 'Synthetic removable member', role: 'supervisor', teamIds: ['default'] })).result;
  ok(await command(removable, { type: 'joinOrganisation', token: removableInvite.token }));
  let removableMember = await currentMember(removable.id);
  ok(await command(owner, { type: 'removeMember', userId: removable.id, version: removableMember.version, reason: 'Synthetic completed workforce departure' }));
  removableMember = await currentMember(removable.id);
  check(removableMember.status === 'removed' && removableMember.teamIds.length === 0,
    'Removal ends an unencumbered membership while retaining its versioned history');
  check((await api.get(removable, '/api/workspace', org)).status === 403,
    'Removed member cannot use the old online organisation access');
  const returnInvite = ok(await command(owner, { type: 'createInvite', accountCode: removableAccount, label: 'Synthetic reviewed return', role: 'clinician', teamIds: ['default'] })).result;
  ok(await command(removable, { type: 'joinOrganisation', token: returnInvite.token }));
  const returned = await currentMember(removable.id);
  check(returned.status === 'active' && returned.role === 'clinician' && returned.version > removableMember.version,
    'Return after removal requires a new account-bound invitation and advances membership history');

  const audit = (await db.prepare("SELECT action,actor_id,subject,detail FROM audit_events WHERE org_id=? AND action IN ('createInvite','acceptInvite','updateMember','removeMember') ORDER BY seq").bind(org).all()).results;
  check(audit.filter(row => row.action === 'acceptInvite').length === 3 && audit.some(row => row.action === 'updateMember' && row.subject === workerIdentity.id) && audit.some(row => row.action === 'removeMember' && row.subject === removable.id),
    'Invitation, activation, reassignment, suspension and removal retain accountable audit evidence');
  writeFileSync(`${output}/observed.json`, JSON.stringify({ org, workerId: workerIdentity.id, removableId: removable.id,
    denialMs, grant: { leaseId: grant.packet.payload.leaseId, issuedAt: grant.packet.payload.issuedAt, expiresAt: grant.packet.payload.expiresAt, windowMs: grantWindowMs }, audit }, null, 2));
} catch (error) {
  failure = String(error.stack ?? error); throw error;
} finally {
  if (worker) {
    await worker.stop(); disposed = true;
    portFree = await new Promise(resolve => { const socket = connect(21910, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(false); }); socket.once('error', error => resolve(error.code === 'ECONNREFUSED')); });
  }
  if (!failure) { check(disposed && portFree, 'Owned synthetic runtime is disposed and its loopback port is free'); rmSync(state, { recursive: true, force: true }); }
  const result = { passed: checks.length, failed: failure ? 1 : 0, skipped: 0, checks, disposed, portFree, failure,
    completedAt: new Date().toISOString(), limits: 'Synthetic local application evidence only. Account-code matching is not external institutional verification. No real device, identity provider, production background service, formal UAT, CI, merge, hosting or domain acceptance.' };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
}
