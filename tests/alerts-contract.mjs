// Slice 6g contract: computed operational alerts, thresholds, ownership, ordering and scoping.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.alerts-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['alerts', 'core', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const A = await import(pathToFileURL(join(dir, 'alerts.js')));
  const backlog = over => ({ drafts: 0, openFollowUps: 0, overdueFollowUps: 0, openReferrals: 0, overdueReferrals: 0, undatedReferrals: 0, unresolvedSubmissions: 0, unresolvedEhr: 0, ...over });
  const report = (over = {}, usage = { missingUsage: 0 }) => ({ backlog: backlog(over), usage });
  const ops = (incidents = [], maintenance = false) => ({ maintenance, reason: 'Synthetic maintenance reason', incidents });
  const ids = a => a.map(x => x.id);
  check(() => assert.equal(A.ALERT_RULES_VERSION, '1.0.0'));
  check(() => assert.deepEqual(A.alertsFor({ report: report(), telemetry: { count: 500, serverErrors: 0, errorRate: 0 }, operations: ops() }), [], 'quiet data raises nothing'));
  const all = A.alertsFor({ report: report({ unresolvedSubmissions: 2, unresolvedEhr: 1, overdueReferrals: 3, overdueFollowUps: 4, undatedReferrals: 1 }, { missingUsage: 2 }), telemetry: { count: 100, serverErrors: 10, errorRate: 0.1 }, operations: ops([{ severity: 'critical', state: 'open' }, { severity: 'critical', state: 'resolved' }, { severity: 'high', state: 'investigating' }], true) });
  check(() => assert.deepEqual(ids(all), ['server-errors', 'incident-critical-open', 'referrals-overdue', 'destination-uncertain', 'ehr-uncertain', 'maintenance', 'followups-overdue', 'provider-usage-missing', 'incident-open', 'referrals-undated'], 'critical first, then by count'));
  check(() => { const x = all.find(a => a.id === 'incident-critical-open'); assert.equal(x.count, 1, 'resolved incidents excluded'); assert.equal(x.owner, 'operations'); assert.equal(x.tab, 'service'); });
  check(() => { const x = all.find(a => a.id === 'referrals-overdue'); assert.equal(x.owner, 'supervisors'); assert.equal(x.count, 3); assert.match(x.action, /escalation queue/); });
  check(() => assert.match(all.find(a => a.id === 'destination-uncertain').action, /look up the receipt of any uncertain submission before a resend/));
  check(() => assert.match(all.find(a => a.id === 'maintenance').action, /Synthetic maintenance reason/));
  check(() => assert.equal(all.every(a => ['critical', 'high', 'normal'].includes(a.severity) && a.count > 0 && a.action.length > 10), true));
  // Error-rate thresholds: at least 20 requests and strictly above 5%.
  const errs = t => ids(A.alertsFor({ report: null, telemetry: t, operations: null }));
  check(() => assert.deepEqual(errs({ count: 19, serverErrors: 19, errorRate: 1 }), []));
  check(() => assert.deepEqual(errs({ count: 20, serverErrors: 1, errorRate: 0.05 }), []));
  check(() => assert.deepEqual(errs({ count: 20, serverErrors: 2, errorRate: 0.1 }), ['server-errors']));
  check(() => assert.deepEqual(errs({ count: 0, serverErrors: 0, errorRate: null }), []));
  // Scope: a supervisor sees report-based alerts only; an administrator sees no clinical backlog alerts.
  const supervisor = A.alertsFor({ report: report({ overdueReferrals: 1, unresolvedSubmissions: 1 }), telemetry: null, operations: null });
  check(() => assert.deepEqual(ids(supervisor), ['destination-uncertain', 'referrals-overdue']));
  const admin = A.alertsFor({ report: null, telemetry: { count: 50, serverErrors: 0, errorRate: 0 }, operations: ops([{ severity: 'normal', state: 'open' }]) });
  check(() => assert.deepEqual(ids(admin), ['incident-open']));
  // Slice 6h: acknowledgement.
  const now = '2026-09-30T03:00:00.000Z', hourAgo = '2026-09-30T02:00:00.000Z', dayAgo = '2026-09-29T02:59:00.000Z';
  const base = { report: report({ overdueReferrals: 3, unresolvedSubmissions: 2 }), telemetry: null, operations: ops([{ severity: 'normal', state: 'open' }]), viewerId: 'sup1', now };
  const ack = (alertId, count, at, scope = 'organisation', userId = 'op1') => ({ alertId, count, userId, by: userId, at, note: 'Looking into it', scope });
  let acked = A.alertsFor({ ...base, acknowledgements: [ack('destination-uncertain', 2, hourAgo)] });
  check(() => { const x = acked.find(a => a.id === 'destination-uncertain'); assert.equal(x.acknowledged.by, 'op1'); assert.equal(acked.at(-1).id, 'destination-uncertain', 'acknowledged alerts sort last'); });
  check(() => assert.equal(A.alertsFor({ ...base, acknowledgements: [ack('destination-uncertain', 1, hourAgo)] }).find(a => a.id === 'destination-uncertain').acknowledged, null, 'a changed count reopens the alert'));
  check(() => assert.equal(A.alertsFor({ ...base, acknowledgements: [ack('destination-uncertain', 2, dayAgo)] }).find(a => a.id === 'destination-uncertain').acknowledged, null, 'acknowledgements lapse after 24 hours'));
  check(() => assert.ok(A.alertsFor({ ...base, acknowledgements: [ack('referrals-overdue', 3, hourAgo, 'user', 'sup1')] }).find(a => a.id === 'referrals-overdue').acknowledged, 'own supervisor acknowledgement applies'));
  check(() => assert.equal(A.alertsFor({ ...base, viewerId: 'sup2', acknowledgements: [ack('referrals-overdue', 3, hourAgo, 'user', 'sup1')] }).find(a => a.id === 'referrals-overdue').acknowledged, null, 'another supervisor acknowledgement does not'));
  const member = (userId, role, isOwner = false) => ({ userId, displayName: userId, role, isOwner, status: 'active', teamIds: ['t1'], version: 1 });
  const state = () => ({ organisation: { id: 'org' }, operations: { version: 3, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }, workspace: { audit: [] } });
  const actor = id => ({ userId: id, displayName: id, email: 'x' });
  const s1 = state(), cmd = (alertId, count = 1, note = 'Receipt lookup started') => ({ type: 'opsAcknowledgeAlert', alertId, count, note });
  const r1 = A.applyAlertAck(s1, cmd('incident-open'), actor('op1'), member('op1', 'admin'), now);
  check(() => { assert.equal(r1.alertId, 'incident-open'); assert.equal(s1.operations.acknowledgements[0].scope, 'organisation'); assert.equal(s1.operations.version, 3, 'acknowledging does not bump the operations version'); assert.match(s1.workspace.audit[0].detail, /incident-open acknowledged at count 1/); });
  const refused = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code); passed++; return; } assert.fail('expected ' + code); };
  refused(() => A.applyAlertAck(s1, cmd('incident-open'), actor('sup1'), member('sup1', 'supervisor'), now), 403);
  refused(() => A.applyAlertAck(s1, cmd('referrals-overdue'), actor('adm'), member('adm', 'admin'), now), 403);
  refused(() => A.applyAlertAck(s1, cmd('referrals-overdue'), actor('w1'), member('w1', 'asha'), now), 403);
  A.applyAlertAck(s1, cmd('referrals-overdue', 3), actor('sup1'), member('sup1', 'supervisor'), now);
  A.applyAlertAck(s1, cmd('referrals-overdue', 4), actor('sup1'), member('sup1', 'supervisor'), now);
  A.applyAlertAck(s1, cmd('referrals-overdue', 2), actor('own'), member('own', 'clinician', true), now);
  check(() => { const r = s1.operations.acknowledgements.filter(a => a.alertId === 'referrals-overdue'); assert.equal(r.length, 2, 'one per supervisor, latest kept'); assert.deepEqual(r.map(a => [a.userId, a.count, a.scope]).sort(), [['own', 2, 'user'], ['sup1', 4, 'user']]); });
  check(() => { assert.equal(A.applyAlertAck(s1, cmd('unknown-alert'), actor('op1'), member('op1', 'admin'), now), null); assert.equal(A.applyAlertAck(s1, cmd('incident-open', 1, 'no'), actor('op1'), member('op1', 'admin'), now), null); });
  const result = { suite: 'Operational alerts contract (slices 6g and 6h)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/alerts-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
