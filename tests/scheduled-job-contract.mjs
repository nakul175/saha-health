// Slice 10a contract: the scheduled job (Cloudflare Cron Trigger) that applies due caseload transfers, marks requests past
// their time limit as needing review and evaluates operational alerts, per organisation, whether or not anyone is using Saha.
// Runs the real job modules over the real migrations in an in-memory database. No network: any fetch fails the suite.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const lib = 'lib/saha', dir = mkdtempSync(join(process.cwd(), '.scheduled-job-contract-'));
let passed = 0;
const check = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

// The job calls no external service: every outbound fetch fails the suite.
let fetches = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = () => { fetches++; throw new Error('The scheduled job must never call an external service.'); };

try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts') && f !== 'server.ts'))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  // `server` (the Next.js runtime) is replaced by a stub: the job takes the database binding as an argument.
  writeFileSync(join(dir, 'server.js'), `export async function identity() { throw new Error('not used'); }
export async function activeOrg() { throw new Error('not used'); }
export function db() { throw new Error('not used'); }
export async function loadFor() { throw new Error('not used'); }
export function rawRuntime() { return {}; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const J = await load('scheduled-job'), R = await load('scheduled-review'), store = await load('store'), C = await load('caseload'), { allowed } = await load('access');

  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const created = '2026-10-01T06:00:00.000Z', day = 86400000, ms = t => new Date(Date.parse(created) + t).toISOString();
  const T0 = '2026-10-02T09:00:00.000Z', min = (n, from = T0) => new Date(Date.parse(from) + n * 60000).toISOString();
  const env = { SAHA_ENVIRONMENT: 'synthetic' };
  const actors = { owner: ['Synthetic owner', 'clinician', true], sup: ['Synthetic supervisor', 'supervisor', false], a1: ['Synthetic worker one', 'asha', false], a2: ['Synthetic worker two', 'asha', false] };
  for (const [id, [name]] of Object.entries(actors)) d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(id, (id.toUpperCase() + '0'.repeat(24)).slice(0, 24), name, `${id}@example.invalid`, created);
  const member = id => ({ userId: id, accountCode: (id.toUpperCase() + '0'.repeat(24)).slice(0, 24), displayName: actors[id][0], role: actors[id][1], isOwner: actors[id][2], status: 'active', version: 1, teamIds: ['default'], createdAt: created });
  const actor = id => ({ userId: id, displayName: actors[id][0], email: `${id}@example.invalid` });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: created, version: 1, teamId: 'default', assignedTo: 'a1', enrolments: [], followUps: [] };
  const person = (id, over = {}) => ({ ...base, id, name: 'Synthetic ' + id, ...over });
  const transfer = (personIds, effectiveAt) => ({ type: 'caseloadTransfer', teamId: 'default', fromUserId: 'a1', toUserId: 'a2', personIds, effectiveAt, reason: 'Synthetic leave cover' });

  // Builds one organisation in the database. `transfers` are scheduled (in memory, by the supervisor) before it is stored.
  async function org(id, { people = ['p1', 'p2'], transfers = [], visits = [], submissions = [], operations, mutate } = {}) {
    const s = { organisation: { id, name: 'Synthetic ' + id, revision: 1, createdAt: created }, teams: [{ id: 'default', name: 'Care team', createdAt: created }], invitations: [], members: Object.keys(actors).map(member),
      workspace: { schemaVersion: 1, revision: 1, role: 'supervisor', integrations: [], submissions, receipts: {}, audit: [], referrals: [], visits, people: people.map(p => person(p)) }, caseloads: [], ...(operations ? { operations } : {}) };
    for (const t of transfers) {
      const sup = s.members.find(m => m.userId === 'sup'); for (const p of s.workspace.people) p.assigned = allowed(sup, p);
      C.applyCaseload(s, transfer(t.people, t.effectiveAt), actor('sup'), sup, created);
    }
    mutate?.(s);
    await store.createState(d1, s, actor('owner'), 'createOrganisation');
    return id;
  }
  const row = (q, ...a) => sql(q, ...a)[0];
  const audits = (orgId, action) => sql('SELECT * FROM audit_events WHERE org_id=? AND action=? ORDER BY at,id', orgId, action);
  const revision = orgId => row('SELECT revision FROM organisations WHERE id=?', orgId).revision;
  const state = orgId => store.readState(d1, orgId);
  const incident = { id: 'i1', title: 'Synthetic outage', severity: 'critical', state: 'open', ownerId: 'owner', createdAt: created, updatedAt: created };
  const ops = (extra = {}) => ({ version: 1, maintenance: false, reason: '', updatedAt: created, incidents: [], rates: null, ...extra });
  const clean = () => { d1.db.exec('DELETE FROM alert_notifications; DELETE FROM alert_occurrences;'); };

  // ---- 1. Due transfers: applied through the existing path, with the scheduler named as the actor ----
  const A = await org('org_due', { transfers: [{ people: ['p1', 'p2'], effectiveAt: ms(day) }] });
  const before1 = revision(A);
  await checkAsync('1 nothing is applied before the effective time', async () => {
    const r = await J.runScheduled(d1, env, ms(day - 1000));
    assert.equal(sql("SELECT state FROM caseload_transfers WHERE org_id=?", A)[0].state, 'scheduled');
    assert.equal((await state(A)).workspace.people[0].assignedTo, 'a1');
    assert.equal(r.organisations.find(o => o.organisationId === A).transfers, null);
  });
  const run1 = await J.runScheduled(d1, env, T0);
  const o1 = run1.organisations.find(o => o.organisationId === A);
  await checkAsync('1 a due transfer is applied by the scheduled job without anyone using Saha', async () => {
    assert.deepEqual(o1.transfers, { applied: 1, held: 0, deferred: 0 });
    const s = await state(A);
    assert.deepEqual(s.workspace.people.map(p => p.assignedTo), ['a2', 'a2']);
    assert.equal(s.caseloads[0].state, 'applied'); assert.equal(s.caseloads[0].applied.automatic, true); assert.equal(s.caseloads[0].applied.by, 'system');
    assert.ok(revision(A) > before1);
  });
  await checkAsync('1 one audit event and one revision per moved patient name the scheduler, and a receipt is written', async () => {
    const a = audits(A, 'caseloadAutoApply'); assert.equal(a.length, 1); assert.equal(a[0].actor_id, 'system'); assert.equal(a[0].role, 'system'); assert.match(a[0].actor_name, /scheduled/);
    const r = sql("SELECT actor_id,actor_name,action FROM record_revisions WHERE org_id=? AND action='caseloadAutoApply'", A); assert.equal(r.length, 2); assert.ok(r.every(x => x.actor_id === 'system'));
    assert.equal(sql("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND actor_id='system' AND key LIKE 'caseload-auto-%'", A)[0].n, 1);
  });
  await checkAsync('1 a repeat run changes nothing about the transfer', async () => {
    const r = await J.runScheduled(d1, env, min(5)); assert.equal(r.organisations.find(o => o.organisationId === A).transfers, null);
    assert.equal(audits(A, 'caseloadAutoApply').length, 1);
  });

  // ---- 2. A refused transfer is held whole, never half-applied ----
  const B = await org('org_refused', { transfers: [{ people: ['p1', 'p2'], effectiveAt: ms(day) }], mutate: s => { s.workspace.people[1].assignmentHistory = Array.from({ length: 100 }, (_, i) => ({ id: 'h' + i, at: created, by: 'x', fromTeam: 'default', fromOwner: 'a1', teamId: 'default', ownerId: 'a1', reason: 'r', openWork: 0 })); } });
  const peopleBefore = JSON.stringify((await state(B)).workspace.people);
  const run2 = await J.runScheduled(d1, env, T0);
  await checkAsync('2 the refused transfer is held whole: every patient is exactly as before', async () => {
    assert.deepEqual(run2.organisations.find(o => o.organisationId === B).transfers, { applied: 0, held: 1, deferred: 0 });
    const s = await state(B); assert.equal(s.caseloads[0].state, 'held'); assert.ok(s.caseloads[0].held.reason);
    assert.equal(JSON.stringify(s.workspace.people), peopleBefore);
    assert.equal(audits(B, 'caseloadHold').length, 1); assert.equal(audits(B, 'caseloadAutoApply').length, 0);
    assert.equal(audits(B, 'caseloadHold')[0].actor_id, 'system');
  });
  await checkAsync('2 a held transfer is never retried by a later run', async () => {
    await J.runScheduled(d1, env, min(10)); assert.equal(audits(B, 'caseloadHold').length, 1); assert.equal((await state(B)).caseloads[0].state, 'held');
  });

  // ---- 3. Requests past their time limit are marked as needing review, never retried or resent ----
  const run = (id, over = {}) => ({ id, task: 'extract', status: 'running', actorId: 'a1', createdAt: ms(0), expiresAt: ms(60000), startedAt: min(-30), version: 'saha-agent-1.2.0', provider: { id: 'p', name: 'Synthetic provider', mode: 'http', model: 'm', version: 1, available: true, reason: '' }, visitVersion: 1, personVersion: 1, consentVersion: 1, inputHash: 'h', input: 'x', warnings: [], message: '', callCount: 1, steps: [], limits: { timeMinutes: 5, attempts: null }, ...over });
  const visit = { id: 'v1', personId: 'p1', version: 1, recordVersion: 1, state: 'draft', facts: {}, createdAt: created, aiResults: [], agentRuns: [run('r_late'), run('r_in_time', { startedAt: min(-2), limits: { timeMinutes: 60, attempts: null } }), run('r_unlimited', { limits: null }), run('r_closed', { status: 'failed', outcome: 'uncertain' })] };
  const sub = (id, startedAt, over = {}) => ({ id, visitId: 'v1', personId: 'p1', connectorId: 'mis_x', connectorName: 'Synthetic MIS', state: 'sending', mode: 'http', payloadHash: 'h'.repeat(64), attempts: 1, message: 'Sending', createdAt: created, updatedAt: startedAt, delivery: { endpoint: 'https://example.invalid', credentialBinding: 'X', key: id, actorId: 'a1', connectorVersion: 1, personVersion: 1, consentVersion: 1, visitVersion: 1, expiresAt: ms(day), payload: {}, startedAt, events: [{ at: startedAt, state: 'sending', detail: 'Delivery checkpoint saved before the programme request.' }] }, ...over });
  const C3 = await org('org_late', {
    visits: [visit], submissions: [sub('s_late', min(-20)), sub('s_fresh', min(-2)), sub('s_accepted', min(-40), { state: 'accepted', receipt: 'R1' })],
    operations: ops({ aggregateReports: [{ id: 'g_late', destinationId: 'mis_x', destinationName: 'Synthetic aggregate destination', state: 'sending', attempts: 1, startedAt: min(-15), updatedAt: min(-15), events: [{ at: min(-15), state: 'sending', detail: 'Checkpoint saved before the request to the destination.' }] }, { id: 'g_fresh', destinationId: 'mis_x', destinationName: 'Synthetic aggregate destination', state: 'sending', attempts: 1, startedAt: min(-1), updatedAt: min(-1), events: [] }] }),
    mutate: s => { s.workspace.people[0].ehr = { links: [], permissions: [], operations: [{ id: 'e_late', linkId: 'l', permissionId: 'pm', actorId: 'a1', integrationVersion: 1, identityHash: 'h', consentVersion: 1, state: 'running', visitId: 'v1', at: min(-25), hash: 'h', message: 'Running' }, { id: 'e_fresh', linkId: 'l', permissionId: 'pm', actorId: 'a1', integrationVersion: 1, identityHash: 'h', consentVersion: 1, state: 'running', visitId: 'v1', at: min(-3), hash: 'h', message: 'Running' }] }; }
  });
  const s3 = await state(C3), found = R.timedOutRequests(s3, T0), keep = JSON.stringify(s3);
  check('3 the finder lists the four late requests and no fresh, closed, accepted or unlimited one', () => {
    assert.deepEqual(found.map(x => `${x.kind}:${x.id}`), ['assistant-request:r_late', 'ehr-publication:e_late', 'programme-delivery:s_late', 'aggregate-report:g_late'], 'oldest overdue first');
    assert.equal(JSON.stringify(s3), keep, 'the finder changes nothing');
  });
  const rev3 = revision(C3), attemptsBefore = s3.workspace.submissions.map(x => x.attempts);
  const run3 = await J.runScheduled(d1, env, T0);
  const s3b = await state(C3);
  await checkAsync('3 each late request is marked once; fresh ones are left alone', async () => {
    assert.deepEqual(run3.organisations.find(o => o.organisationId === C3).reviews, { marked: 4, deferred: 0 });
    const r = s3b.workspace.visits[0].agentRuns; const late = r.find(x => x.id === 'r_late');
    assert.deepEqual(late.timeoutReview, { at: T0, by: 'system', byName: 'Saha scheduled job' });
    assert.equal(late.status, 'running', 'the requester or a clinician still records the decision');
    assert.equal(r.find(x => x.id === 'r_in_time').timeoutReview, undefined); assert.equal(r.find(x => x.id === 'r_unlimited').timeoutReview, undefined);
    const subs = Object.fromEntries(s3b.workspace.submissions.map(x => [x.id, x]));
    assert.equal(subs.s_late.state, 'uncertain'); assert.match(subs.s_late.message, /flagged for review by the scheduled job/); assert.match(subs.s_late.delivery.events.at(-1).detail, /Look up the receipt/);
    assert.equal(subs.s_fresh.state, 'sending'); assert.equal(subs.s_accepted.state, 'accepted');
    const e = Object.fromEntries(s3b.workspace.people[0].ehr.operations.map(x => [x.id, x])); assert.equal(e.e_late.state, 'uncertain'); assert.equal(e.e_fresh.state, 'running');
    const g = Object.fromEntries(s3b.operations.aggregateReports.map(x => [x.id, x])); assert.equal(g.g_late.state, 'uncertain'); assert.equal(g.g_fresh.state, 'sending');
  });
  await checkAsync('3 nothing is resent or retried and no external service is called', async () => {
    assert.deepEqual(s3b.workspace.submissions.map(x => x.attempts), attemptsBefore);
    assert.equal(s3b.operations.aggregateReports.find(x => x.id === 'g_late').attempts, 1);
    assert.equal(fetches, 0);
  });
  await checkAsync('3 one audit event per marked request names the scheduled job, with a receipt and trace links', async () => {
    const a = audits(C3, 'scheduledTimeoutReview'); assert.equal(a.length, 4); assert.ok(a.every(x => x.actor_id === 'system' && x.actor_name === 'Saha scheduled job' && x.role === 'system'));
    assert.deepEqual(a.map(x => x.subject).sort(), ['e_late', 'g_late', 's_late', 'v1']);
    assert.ok(a.every(x => !/Synthetic p\d/.test(x.detail)), 'no patient name in an audit detail');
    assert.equal(sql("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND actor_id='system' AND key LIKE 'scheduled-review-%'", C3)[0].n, 1);
    const ev = s3b.workspace.submissions.find(x => x.id === 's_late').delivery.events.at(-1); assert.equal(ev.ref.command, 'scheduledTimeoutReview'); assert.equal(ev.ref.actorId, 'system'); assert.ok(ev.ref.auditId);
    assert.ok(revision(C3) > rev3);
  });
  await checkAsync('3 a repeat run marks nothing again', async () => {
    const n = audits(C3, 'scheduledTimeoutReview').length, r = await J.runScheduled(d1, env, min(5));
    assert.equal(r.organisations.find(o => o.organisationId === C3).reviews, null); assert.equal(audits(C3, 'scheduledTimeoutReview').length, n);
  });
  await checkAsync('3 a request that becomes late later is marked at that run', async () => {
    const r = await J.runScheduled(d1, env, min(70)); const o = r.organisations.find(o => o.organisationId === C3).reviews;
    assert.deepEqual(o, { marked: 4, deferred: 0 }, 'the in-time assistant request, the fresh delivery, publication and report are now past their limits');
  });
  await checkAsync('3 review marks per organisation per run are bounded, oldest overdue first', async () => {
    const X = await org('org_late_many', { visits: [{ ...visit, id: 'vx', aiResults: [], agentRuns: ['x1', 'x2', 'x3'].map((id, i) => run(id, { startedAt: min(-300 + i * 10, min(70)) })) }] });
    const a = await J.runScheduled(d1, env, min(80), { reviews: 2 }); assert.deepEqual(a.organisations.find(o => o.organisationId === X).reviews, { marked: 2, deferred: 1 });
    assert.deepEqual((await state(X)).workspace.visits[0].agentRuns.filter(r => r.timeoutReview).map(r => r.id), ['x1', 'x2'], 'the oldest first');
    const b = await J.runScheduled(d1, env, min(85), { reviews: 2 }); assert.deepEqual(b.organisations.find(o => o.organisationId === X).reviews, { marked: 1, deferred: 0 });
  });

  // ---- 4. Alert evaluation independent of traffic, and its recorded time ----
  clean();
  const T4 = min(100);
  const D = await org('org_alerts', { operations: ops({ incidents: [incident] }) });
  const run4 = await J.runScheduled(d1, env, T4), o4 = run4.organisations.find(o => o.organisationId === D);
  await checkAsync('4 the evaluation opens the occurrence and delivers in-app notifications at the evaluation time', async () => {
    assert.ok(o4.alerts.opened >= 1); assert.equal(o4.alerts.recipients >= 1, true);
    const occ = sql("SELECT * FROM alert_occurrences WHERE org_id=? AND alert_id='incident-critical-open'", D); assert.equal(occ.length, 1); assert.equal(occ[0].opened_at, T4); assert.equal(occ[0].closed_at, null);
    const n = sql("SELECT * FROM alert_notifications WHERE org_id=? AND alert_id='incident-critical-open'", D); assert.ok(n.length >= 1); assert.ok(n.every(x => x.delivered_at === T4 && x.user_id === 'owner'));
  });
  await checkAsync('4 the evaluation time is recorded in the organisation record with an audit event', async () => {
    const s = await state(D); assert.equal(s.operations.scheduledJob.evaluatedAt, T4); assert.equal(s.operations.scheduledJob.recordedBecause, 'first'); assert.equal(s.operations.scheduledJob.version, '1.0.0');
    assert.equal(s.operations.scheduledJob.alertRules, '1.3.0'); assert.equal(s.operations.scheduledJob.deliveryRules, '1.0.0');
    const a = audits(D, 'scheduledAlertEvaluation'); assert.equal(a.length, 1); assert.equal(a[0].actor_id, 'system'); assert.equal(a[0].actor_name, 'Saha scheduled job'); assert.match(a[0].detail, /In-app only; nothing was sent outside Saha/);
    assert.equal(o4.recorded, true); assert.equal(s.operations.version, 1, 'the operations edit version is not moved by the job');
  });
  const rev4 = revision(D);
  await checkAsync('4 a steady state is evaluated again but not recorded again within the hour', async () => {
    const r = await J.runScheduled(d1, env, min(5, T4)), o = r.organisations.find(o => o.organisationId === D);
    assert.deepEqual([o.alerts.opened, o.alerts.closed, o.alerts.escalated], [0, 0, 0]); assert.equal(o.recorded, false);
    assert.equal(revision(D), rev4); assert.equal(audits(D, 'scheduledAlertEvaluation').length, 1);
    assert.equal(sql("SELECT count(*) AS n FROM alert_notifications WHERE org_id=? AND level=1", D)[0].n, sql("SELECT count(*) AS n FROM alert_notifications WHERE org_id=? AND level=1 AND delivered_at=?", D, T4)[0].n, 'no duplicate delivery');
  });
  await checkAsync('4 an escalation due by the clock alone is made without traffic and recorded as changed', async () => {
    const r = await J.runScheduled(d1, env, min(31, T4)), o = r.organisations.find(o => o.organisationId === D);
    assert.equal(o.alerts.escalated, 1, 'a critical alert unacknowledged for 30 minutes escalates to owners'); assert.equal(o.recorded, true);
    assert.equal((await state(D)).operations.scheduledJob.recordedBecause, 'changed'); assert.equal(audits(D, 'scheduledAlertEvaluation').length, 2);
    assert.equal(sql("SELECT count(*) AS n FROM alert_occurrences WHERE org_id=? AND escalated_at IS NOT NULL", D)[0].n, 1);
  });
  await checkAsync('4 the record is refreshed when the previous one is an hour old', async () => {
    const r = await J.runScheduled(d1, env, min(92, T4)), o = r.organisations.find(o => o.organisationId === D); assert.equal(o.recorded, true);
    const s = await state(D); assert.equal(s.operations.scheduledJob.recordedBecause, 'heartbeat'); assert.equal(s.operations.scheduledJob.evaluatedAt, min(92, T4)); assert.equal(audits(D, 'scheduledAlertEvaluation').length, 3);
  });

  // Slice 13d (round-10 L1): the record is written without moving the organisation revision, by compare-and-set on the
  // record the run read, and never in maintenance; an ordinary operations write built on an older read keeps it.
  await checkAsync('4 (13d) the record does not move the revision: a command prepared just before it still commits and keeps it', async () => {
    const prepared = await state(D), rev = revision(D), stored = prepared.operations.scheduledJob;
    const r = await J.runScheduled(d1, env, min(160, T4)), o = r.organisations.find(o => o.organisationId === D); assert.equal(o.recorded, true);
    assert.equal(revision(D), rev, 'the organisation revision is not moved by the record');
    const after = structuredClone(prepared); after.operations = { ...after.operations, reason: 'Synthetic note', version: after.operations.version + 1 };
    after.workspace.audit.push({ id: 'l1-command', at: min(161, T4), actorId: 'owner', actor: 'Synthetic owner', role: 'admin', action: 'opsNote', subject: D, detail: 'Synthetic organisation-wide command.' });
    await store.persist(d1, prepared, after, { userId: 'owner', displayName: 'Synthetic owner', email: '' }, { type: 'opsNote' }, 'l1-key', 'l1-hash', {});
    const s = await state(D); assert.equal(s.operations.reason, 'Synthetic note'); assert.ok(revision(D) > rev);
    assert.equal(s.operations.scheduledJob.evaluatedAt, min(160, T4), 'the command built on the older read did not roll the record back'); assert.notDeepEqual(s.operations.scheduledJob, stored);
    assert.equal(s.operations.auditChain.recordedBecause !== undefined, true, 'the chain record is kept too');
  });
  await checkAsync('4 (13d) nothing is written when another run recorded first or the organisation is in maintenance', async () => {
    const s = await state(D), rev = revision(D), n = audits(D, 'scheduledAlertEvaluation').length, current = s.operations.scheduledJob;
    const ev = id => ({ id, at: min(170, T4), actorId: 'system', actor: 'Saha scheduled job', role: 'system', action: 'scheduledAlertEvaluation', subject: D, detail: 'Synthetic record.' });
    assert.equal(await store.persistScheduledRecord(d1, D, 'scheduledJob', { ...current, evaluatedAt: min(1, T4) }, { ...current, evaluatedAt: min(170, T4) }, ev('l1-a')), false, 'the stored record is not the one read');
    d1.db.prepare("UPDATE operations SET data=json_set(data,'$.maintenance',json('true')) WHERE org_id=?").run(D);
    assert.equal(await store.persistScheduledRecord(d1, D, 'scheduledJob', current, { ...current, evaluatedAt: min(171, T4) }, ev('l1-b')), false, 'maintenance began after the read');
    d1.db.prepare("UPDATE operations SET data=json_set(data,'$.maintenance',json('false')) WHERE org_id=?").run(D);
    assert.equal(audits(D, 'scheduledAlertEvaluation').length, n); assert.deepEqual((await state(D)).operations.scheduledJob, current); assert.equal(revision(D), rev);
    assert.equal(await store.persistScheduledRecord(d1, D, 'scheduledJob', current, { ...current, evaluatedAt: min(172, T4) }, ev('l1-c')), true);
    assert.equal((await state(D)).operations.scheduledJob.evaluatedAt, min(172, T4)); assert.equal(audits(D, 'scheduledAlertEvaluation').length, n + 1); assert.equal(revision(D), rev);
    await assert.rejects(() => store.persistScheduledRecord(d1, D, 'maintenance', false, true, ev('l1-d')), /Not a scheduled record/);
  });

  // ---- 5. A misconfigured environment is refused; maintenance pauses writes ----
  const snapshot = () => JSON.stringify([sql('SELECT id,revision,patient_revision FROM organisations ORDER BY id'), sql('SELECT count(*) AS n FROM audit_events'), sql('SELECT count(*) AS n FROM alert_occurrences'), sql('SELECT count(*) AS n FROM alert_notifications')]);
  const T5 = min(300), frozen = snapshot();
  await checkAsync('5 a misconfigured environment is refused before anything is read or written', async () => {
    for (const bad of ['prod', 'Production ', 'live', 'synthetic2']) {
      const r = await J.runScheduled(d1, { SAHA_ENVIRONMENT: bad }, T5);
      assert.equal(r.stoppedBy, 'refused'); assert.match(r.refused, /not configured correctly/); assert.deepEqual([r.organisations.length, r.queries], [0, 0]);
    }
    assert.equal(snapshot(), frozen);
  });
  await checkAsync('5 every valid environment name is accepted', async () => {
    for (const ok of [undefined, '', 'synthetic', 'training', 'staging', 'production']) { const r = await J.runScheduled(d1, ok === undefined ? {} : { SAHA_ENVIRONMENT: ok }, T5, { organisations: 0 }); assert.equal(r.refused, null); assert.equal(r.stoppedBy, 'organisations'); }
  });
  const M = await org('org_maintenance', { transfers: [{ people: ['p1'], effectiveAt: ms(day) }], operations: ops({ maintenance: true, reason: 'Synthetic maintenance window', incidents: [incident] }), visits: [{ ...visit, id: 'vm', personId: 'p2', aiResults: [], agentRuns: [run('r_maint')] }] });
  await checkAsync('5 maintenance pauses transfers, review marks and the evaluation record; alerts are still evaluated', async () => {
    const rv = revision(M), r = await J.runScheduled(d1, env, T5), o = r.organisations.find(o => o.organisationId === M);
    assert.equal(o.maintenance, true); assert.equal(o.transfers, null); assert.equal(o.reviews, null); assert.ok(o.alerts); assert.equal(o.recorded, false);
    assert.equal(sql("SELECT state FROM caseload_transfers WHERE org_id=?", M)[0].state, 'scheduled'); assert.equal(revision(M), rv); assert.equal(audits(M, 'scheduledTimeoutReview').length, 0);
    assert.equal(sql("SELECT count(*) AS n FROM alert_occurrences WHERE org_id=?", M)[0].n >= 1, true);
    d1.db.prepare("UPDATE caseload_transfers SET state='cancelled' WHERE org_id=?").run(M); // keep later queue checks about other organisations
  });

  // ---- 6. Bounded and resumable ----
  const E = await org('org_many', { people: ['p1', 'p2', 'p3', 'p4'], transfers: [{ people: ['p4'], effectiveAt: ms(3 * day) }, { people: ['p1'], effectiveAt: ms(day) }, { people: ['p3'], effectiveAt: ms(2 * day) }] });
  const later = ms(5 * day), plus = n => new Date(Date.parse(later) + n).toISOString();
  await checkAsync('6 transfers per organisation per run are bounded, oldest effective time first', async () => {
    const r1 = await J.runScheduled(d1, env, plus(0), { transfers: 1 }); assert.deepEqual(r1.organisations.find(o => o.organisationId === E).transfers, { applied: 1, held: 0, deferred: 2 });
    const s = await state(E), st = pid => s.caseloads.find(t => t.personIds.includes(pid)).state; assert.deepEqual(['p1', 'p3', 'p4'].map(st), ['applied', 'scheduled', 'scheduled']);
    assert.equal(s.workspace.people.find(p => p.id === 'p1').assignedTo, 'a2'); assert.equal(s.workspace.people.find(p => p.id === 'p3').assignedTo, 'a1');
    const r2 = await J.runScheduled(d1, env, plus(1), { transfers: 1 }); assert.deepEqual(r2.organisations.find(o => o.organisationId === E).transfers, { applied: 1, held: 0, deferred: 1 });
    const r3 = await J.runScheduled(d1, env, plus(2), { transfers: 1 }); assert.deepEqual(r3.organisations.find(o => o.organisationId === E).transfers, { applied: 1, held: 0, deferred: 0 });
    assert.deepEqual((await state(E)).workspace.people.map(p => p.assignedTo), ['a2', 'a1', 'a2', 'a2']);
    const byEffective = (await state(E)).caseloads.slice().sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)).map(t => t.id);
    assert.deepEqual(audits(E, 'caseloadAutoApply').map(x => x.subject), byEffective, 'applied in effective-time order');
  });
  // Organisations with a due transfer are visited first, oldest effective time first.
  const F1 = await org('org_z_due_late', { transfers: [{ people: ['p1'], effectiveAt: ms(9 * day) }] }), F2 = await org('org_a_idle'), F3 = await org('org_m_due_early', { transfers: [{ people: ['p1'], effectiveAt: ms(8 * day) }] });
  await checkAsync('6 the queue puts due transfers first, oldest first, then the rest', async () => {
    const q = await J.organisationQueue(d1, ms(10 * day), 20); assert.deepEqual(q.ids.slice(0, 2), [F3, F1]); assert.equal(q.ids.length, sql('SELECT id FROM organisations').length); assert.equal(new Set(q.ids).size, q.ids.length, 'a due organisation is not listed twice');
    const none = await J.organisationQueue(d1, ms(day - 1), 20); assert.ok(!none.ids.slice(0, 1).includes(F1));
  });
  await checkAsync('6 organisations per run are bounded and the unreached ones are still due next run', async () => {
    const r = await J.runScheduled(d1, env, ms(10 * day), { organisations: 1 });
    assert.equal(r.stoppedBy, 'organisations'); assert.deepEqual(r.organisations.map(o => o.organisationId), [F3]); assert.equal(r.notReached, sql('SELECT id FROM organisations').length - 1);
    assert.equal(sql("SELECT state FROM caseload_transfers WHERE org_id=?", F3)[0].state, 'applied'); assert.equal(sql("SELECT state FROM caseload_transfers WHERE org_id=?", F1)[0].state, 'scheduled', 'not reached, still due');
    const next = await J.runScheduled(d1, env, ms(10 * day), { organisations: 1 }); assert.deepEqual(next.organisations.map(o => o.organisationId), [F1], 'resumed with the next due organisation');
    assert.equal(sql("SELECT state FROM caseload_transfers WHERE org_id=?", F1)[0].state, 'applied');
  });
  await checkAsync('6 the rest are reached in rotation, so every organisation is visited over successive runs', async () => {
    const all = sql('SELECT id FROM organisations').map(x => x.id), seen = new Set();
    for (let i = 0; i < all.length; i++) { const r = await J.runScheduled(d1, env, min(5 * i, ms(20 * day)), { organisations: 2 }); for (const o of r.organisations) seen.add(o.organisationId); }
    assert.deepEqual([...seen].sort(), all.sort());
  });
  // Slice 13d (round-10 review M2): the rotation continues from the last organisation a run actually reached.
  await checkAsync('6 a run stopped early leaves no organisation behind: the next run continues after the last one reached', async () => {
    const all = sql('SELECT id FROM organisations ORDER BY id').map(x => x.id), at = ms(30 * day);
    sql("DELETE FROM scheduled_cursor"); sql("INSERT INTO scheduled_cursor (job,last_org,updated_at) VALUES ('scheduled-job',?,?)", all[0], at);
    const stopped = await J.runScheduled(d1, env, at, { organisations: 3, queries: 1 });
    assert.equal(stopped.stoppedBy, 'queries'); assert.deepEqual(stopped.organisations.map(o => o.organisationId), [all[1]], 'one organisation reached before the statement bound');
    assert.equal(sql("SELECT last_org FROM scheduled_cursor WHERE job='scheduled-job'")[0].last_org, all[1], 'the cursor moved only past it');
    const next = await J.runScheduled(d1, env, at, { organisations: 2 });
    assert.deepEqual(next.organisations.map(o => o.organisationId), [all[2], all[3]], 'the next run starts with the organisation after it (the clock-based rotation skipped ahead)');
    sql("UPDATE scheduled_cursor SET last_org=? WHERE job='scheduled-job'", all.at(-1));
    const wrapped = await J.runScheduled(d1, env, at, { organisations: 2 });
    assert.deepEqual(wrapped.organisations.map(o => o.organisationId), [all[0], all[1]], 'after the last organisation it wraps to the first');
    assert.equal(wrapped.notReached, all.length - 2, 'not reached counts every organisation not visited this run');
  });
  // Slice 13f (review of 13a–13e, finding 5): the cursor moves only to the end of the rotation's processed prefix, and an
  // organisation in maintenance is not put first as due.
  await checkAsync('6 (13f) a due organisation processed first does not move the cursor past rotation members not reached', async () => {
    const Z = await org('org_zzz_due', { transfers: [{ people: ['p1'], effectiveAt: ms(day) }] });
    const all = sql('SELECT id FROM organisations ORDER BY id').map(x => x.id), i = all.indexOf(Z), at = ms(40 * day);
    sql("UPDATE scheduled_cursor SET last_org=? WHERE job='scheduled-job'", all[i - 2]);
    const r = await J.runScheduled(d1, env, at, { organisations: 3, queries: 1 });
    assert.deepEqual(r.organisations.map(o => o.organisationId), [Z], 'the due organisation runs first and the statement bound stops the run');
    assert.equal(sql("SELECT last_org FROM scheduled_cursor WHERE job='scheduled-job'")[0].last_org, all[i - 2], 'the organisation before it was not reached, so the cursor stays');
    const next = await J.runScheduled(d1, env, at, { organisations: 2 });
    assert.equal(next.organisations[0].organisationId, all[i - 1], 'the next run reaches it');
  });
  await checkAsync('6 (13f) an organisation in maintenance is not queued first as due', async () => {
    const Y = await org('org_zzy_maint', { transfers: [{ people: ['p1'], effectiveAt: ms(day) }], operations: ops({ maintenance: true, reason: 'Synthetic maintenance window' }) });
    const q = await J.organisationQueue(d1, ms(40 * day), 5);
    assert.ok(!q.ids.slice(0, 1).includes(Y)); assert.ok(Array.isArray(q.rotation));
    d1.db.prepare("UPDATE caseload_transfers SET state='cancelled' WHERE org_id=?").run(Y);
  });
  await checkAsync('6 database statements per run are bounded and counted', async () => {
    const r = await J.runScheduled(d1, env, plus(100), { queries: 1 });
    assert.equal(r.stoppedBy, 'queries'); assert.equal(r.organisations.length, 1); assert.ok(r.queries >= 20, 'a full organisation read is more than twenty statements');
    const t = { queries: 0 }, c = J.counted(d1, t); await c.prepare('SELECT 1 AS x').first(); await c.batch([c.prepare('SELECT 1').bind(), c.prepare('SELECT 2').bind()]); assert.equal(t.queries, 3);
  });
  await checkAsync('6 elapsed time per run is bounded', async () => {
    let clock = 0; const r = await J.runScheduled(d1, env, plus(200), { milliseconds: 1000 }, () => (clock += 1000));
    assert.equal(r.stoppedBy, 'time'); assert.equal(r.organisations.length, 1);
  });
  await checkAsync('6 a failure in one organisation is reported without content and does not stop the others', async () => {
    const G = await org('org_broken'); d1.db.prepare("UPDATE patients SET data='{not json' WHERE org_id=?").run(G);
    const r = await J.runScheduled(d1, env, plus(300)), o = r.organisations.find(o => o.organisationId === G);
    assert.ok(o.problems.length >= 1); assert.ok(o.problems.every(x => /^[a-z]+: [A-Za-z ()0-9,]+$/.test(x)), 'step and error class only: ' + o.problems.join('|'));
    assert.ok(r.organisations.length > 1);
  });

  // ---- 7. Static guarantees: no external call is reachable from the job, the entry delegates, defaults are fixed ----
  const jobText = readFileSync('lib/saha/scheduled-job.ts', 'utf8'), reviewText = readFileSync('lib/saha/scheduled-review.ts', 'utf8'), entry = readFileSync('worker/index.ts', 'utf8');
  const imports = t => [...t.matchAll(/^import (?:type )?[^;]*? from '([^']+)'/gm)].map(m => m[1]);
  check('7 the job and review modules import no execution, provider or transport module', () => {
    for (const m of [...imports(jobText), ...imports(reviewText)]) assert.ok(!/execution|provider|transport|-fetch|http/.test(m), m);
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|connect\(/.test(jobText + reviewText));
    assert.ok(!/externalCall|executeMis|executeEhr|executeAgent|executeAggregate|misRequest|ehrRequest/.test(jobText + reviewText));
  });
  check('7 the Worker entry keeps the fetch handler and adds scheduled; the build entry is the Worker entry', () => {
    assert.match(entry, /import handler from 'vinext\/server\/fetch-handler'/); assert.match(entry, /fetch: async \(request: Request, env: unknown, ctx: ExecutionContext\) => \(await crossSiteRefusal\(request\)\) \?\? handler\.fetch\(request, env, ctx\)/, 'slice 13a: every request still reaches the application unless another website started an API request'); assert.match(entry, /async scheduled\(controller: ScheduledController/);
    assert.match(readFileSync('vite.config.ts', 'utf8'), /main: "\.\/worker\/index\.ts"/);
  });
  check('7 defaults: every five minutes, bounded work', () => {
    assert.equal(J.CRON, '*/5 * * * *'); assert.deepEqual(J.JOB_LIMITS, { organisations: 20, transfers: 10, reviews: 25, queries: 800, milliseconds: 20000, heartbeatMinutes: 60 }); assert.equal(R.IN_FLIGHT_MINUTES, 10);
    assert.deepEqual(R.JOB_ACTOR, { userId: 'system', displayName: 'Saha scheduled job', email: '' });
  });
  check('7 no network call was made by any run', () => assert.equal(fetches, 0));

  const result = { suite: 'Scheduled job contract (slice 10a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/scheduled-job-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { globalThis.fetch = realFetch; rmSync(dir, { recursive: true, force: true }); }
