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
  writeFileSync(join(dir, 'alerts.js'), ts.transpileModule(readFileSync('lib/saha/alerts.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
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
  check(() => assert.match(all.find(a => a.id === 'destination-uncertain').action, /never retried blindly/));
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
  const result = { suite: 'Operational alerts contract (slice 6g)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/alerts-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
