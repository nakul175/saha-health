// Slice 6v contract: in-app alert delivery planning, acknowledgement clearing, escalation ladders and thresholds,
// recipient scope, idempotent writes and the mark-read command shape.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.alert-delivery-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['alert-delivery', 'alerts', 'adapter-operations','core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const D = await import(pathToFileURL(join(dir, 'alert-delivery.js')));
  const member = (userId, role, isOwner = false, status = 'active') => ({ userId, displayName: 'Synthetic ' + userId, role, isOwner, status, teamIds: ['t1'], version: 1, createdAt: '2026-10-01T00:00:00Z' });
  const alert = (id, owner, severity = 'high', count = 2, acknowledged = null) => ({ id, owner, severity, title: 'Synthetic ' + id, count, action: 'Synthetic action text.', tab: 'overview', acknowledged });
  const own = member('own', 'clinician', true), own2 = member('own2', 'clinician', true), adm = member('adm', 'admin'), sup = member('sup', 'supervisor'), sup2 = member('sup2', 'supervisor'), asha = member('asha', 'asha'), gone = member('gone', 'clinician', true, 'suspended');
  const members = [own, own2, adm, sup, sup2, asha, gone];
  const T0 = '2026-10-01T10:00:00.000Z', at = min => new Date(Date.parse(T0) + min * 60000).toISOString();
  // 1. Ladders stay inside the organisation and end at owners; thresholds by severity.
  check(() => { assert.equal(D.DELIVERY_RULES_VERSION, '1.0.0'); assert.deepEqual(D.ESCALATION_LADDER, { operations: ['operations', 'owners'], supervisors: ['supervisors', 'owners'], owners: ['owners'] }); assert.deepEqual(D.ESCALATE_AFTER_MINUTES, { critical: 30, high: 240, normal: 1440 }); });
  // 2. Recipients: each member receives only alerts they own, from their own view; supervisor alerts are per supervisor.
  const views = [
    { member: own, alerts: [alert('incident-open', 'operations', 'normal', 1), alert('referrals-overdue', 'supervisors', 'high', 5), alert('ai-budget-reached', 'owners', 'high', 1)] },
    { member: adm, alerts: [alert('incident-open', 'operations', 'normal', 1), alert('referrals-overdue', 'supervisors', 'high', 9)] },
    { member: sup, alerts: [alert('referrals-overdue', 'supervisors', 'high', 2), alert('incident-open', 'operations', 'normal', 1)] },
    { member: asha, alerts: [alert('incident-open', 'operations', 'normal', 1)] },
  ];
  const present = D.presentFrom(views), find = (a, s) => present.find(p => p.alertId === a && p.scopeKey === s);
  check(() => { assert.deepEqual(find('incident-open', 'org').recipients.map(r => r.userId).sort(), ['adm', 'own'], 'operations alert to owners and administrators only, one shared occurrence'); });
  check(() => { assert.equal(find('referrals-overdue', 'sup').recipients.length, 1); assert.equal(find('referrals-overdue', 'sup').recipients[0].count, 2, 'a supervisor receives the count from their own scope'); assert.ok(find('referrals-overdue', 'own'), 'a non-administrator owner holds their own supervisor-alert occurrence'); assert.equal(find('referrals-overdue', 'adm'), undefined, 'an administrator never receives a clinical backlog alert'); });
  check(() => { assert.deepEqual(find('ai-budget-reached', 'org').recipients.map(r => r.userId), ['own'], 'owner alerts to owners only'); assert.equal(present.some(p => p.recipients.some(r => r.userId === 'asha')), false, 'an ASHA receives nothing'); });
  // 3. First evaluation opens occurrences and delivers to each recipient.
  const first = D.planDelivery({ present, open: [], acknowledgements: [], members, now: T0 });
  check(() => { assert.equal(first.open.length, present.length); assert.equal(first.deliver.length, 5); assert.deepEqual([first.close, first.clear, first.escalate], [[], [], []]); });
  // 4. A repeat evaluation with the occurrences open opens nothing new (deliveries are deduplicated by unique key).
  const open = present.map((p, i) => ({ id: 'occ' + i, alertId: p.alertId, scopeKey: p.scopeKey, owner: p.owner, severity: p.severity, title: p.title, openedAt: T0, escalatedAt: null }));
  const again = D.planDelivery({ present, open, acknowledgements: [], members, now: at(1) });
  check(() => { assert.equal(again.open.length, 0); assert.equal(again.escalate.length, 0, 'nothing escalates before its threshold'); assert.equal(again.deliver.length, 5); });
  // 5. An alert no longer present closes its occurrence.
  const closed = D.planDelivery({ present: present.filter(p => p.alertId !== 'incident-open'), open, acknowledgements: [], members, now: at(2) });
  check(() => assert.deepEqual(closed.close, [open.find(o => o.alertId === 'incident-open').id]));
  // 6. Thresholds: critical 30 minutes, high 4 hours, normal 24 hours; owner alerts never escalate (top of the ladder).
  const one = (a, sev, scopeKey, recips) => [{ alertId: a, scopeKey, owner: a === 'incident-open' || a === 'incident-critical-open' ? 'operations' : a.startsWith('ai-') ? 'owners' : 'supervisors', severity: sev, title: 'Synthetic ' + a, recipients: recips }];
  const occ = (a, sev, scopeKey, extra = {}) => [{ id: 'o-' + a, alertId: a, scopeKey, owner: a.startsWith('incident') ? 'operations' : a.startsWith('ai-') ? 'owners' : 'supervisors', severity: sev, title: 'Synthetic ' + a, openedAt: T0, escalatedAt: null, ...extra }];
  const esc = (a, sev, scopeKey, mins, acks = [], extra = {}, recips = [{ userId: scopeKey === 'org' ? 'adm' : scopeKey, count: 1, acknowledged: false }]) => D.planDelivery({ present: one(a, sev, scopeKey, recips), open: occ(a, sev, scopeKey, extra), acknowledgements: acks, members, now: at(mins) }).escalate;
  check(() => { assert.equal(esc('incident-critical-open', 'critical', 'org', 29).length, 0); assert.equal(esc('incident-critical-open', 'critical', 'org', 30).length, 1); });
  check(() => { assert.equal(esc('referrals-overdue', 'high', 'sup', 239).length, 0); assert.equal(esc('referrals-overdue', 'high', 'sup', 240).length, 1); assert.equal(esc('followups-overdue', 'normal', 'sup', 1439).length, 0); assert.equal(esc('followups-overdue', 'normal', 'sup', 1440).length, 1); });
  check(() => assert.equal(esc('ai-budget-reached', 'high', 'org', 100000, [], {}, [{ userId: 'own', count: 1, acknowledged: false }]).length, 0, 'owner alerts are at the top of their ladder'));
  // 7. Escalation goes to active owners, never to the supervisor-scope holder or a suspended owner, and names no count.
  const supEsc = esc('referrals-overdue', 'high', 'sup', 300)[0];
  check(() => { assert.equal(supEsc.toRole, 'owners'); assert.equal(supEsc.reason, 'unacknowledged'); assert.deepEqual(supEsc.recipients, ['own', 'own2']); assert.match(supEsc.detail, /care scope of Synthetic sup/); assert.match(supEsc.detail, /4 hours/); assert.doesNotMatch(supEsc.detail, /\b1\b/, 'escalations carry no count from another scope'); });
  check(() => { const e = esc('referrals-overdue', 'high', 'own', 300, [], {}, [{ userId: 'own', count: 3, acknowledged: false }])[0]; assert.deepEqual(e.recipients, ['own2'], 'an owner holding a supervisor occurrence escalates to the other owners'); });
  // 8. Already escalated: never again for the same occurrence.
  check(() => assert.equal(esc('incident-critical-open', 'critical', 'org', 600, [], { escalatedAt: at(31) }).length, 0));
  // 9. Acknowledged: notifications clear and nothing escalates, however long it has been open.
  // Slice 6z (sixth review): this check used views where one recipient's view showed the acknowledgement and the other's
  // did not, and expected the whole occurrence to clear — the defect itself (an acknowledgement at one scope's count
  // cleared another owner's notification and blocked escalation). An organisation-wide input gives every recipient the
  // same count, so both views show the acknowledgement here; the mixed case is asserted below and in
  // tests/sixth-review-fixes-contract.mjs.
  const acked = D.planDelivery({ present: one('incident-critical-open', 'critical', 'org', [{ userId: 'adm', count: 1, acknowledged: true }, { userId: 'own', count: 1, acknowledged: true }]), open: occ('incident-critical-open', 'critical', 'org'), acknowledgements: [], members, now: at(600) });
  check(() => { assert.deepEqual(acked.clear, ['o-incident-critical-open'], 'an organisation acknowledgement clears the shared occurrence'); assert.equal(acked.escalate.length, 0); assert.equal(acked.restore.length, 0); });
  const mixed = D.planDelivery({ present: one('incident-critical-open', 'critical', 'org', [{ userId: 'adm', count: 1, acknowledged: true }, { userId: 'own', count: 1, acknowledged: false }]), open: occ('incident-critical-open', 'critical', 'org'), acknowledgements: [], members, now: at(600) });
  check(() => { assert.deepEqual(mixed.clear, [], 'a view without the acknowledgement keeps the occurrence open'); assert.deepEqual(mixed.clearFor, [{ occurrenceId: 'o-incident-critical-open', userId: 'adm' }]); assert.equal(mixed.escalate.length, 1); assert.equal(mixed.escalate[0].reason, 'unacknowledged'); });
  // 10. Re-opened after an acknowledgement made during the occurrence stopped applying: shown again and escalated at once.
  const orgAck = [{ alertId: 'incident-open', count: 1, userId: 'adm', by: 'Synthetic adm', at: at(5), note: 'Looking into it', scope: 'organisation' }];
  const re = D.planDelivery({ present: one('incident-open', 'normal', 'org', [{ userId: 'adm', count: 2, acknowledged: false }]), open: occ('incident-open', 'normal', 'org'), acknowledgements: orgAck, members, now: at(10) });
  check(() => { assert.deepEqual(re.restore, ['o-incident-open']); assert.equal(re.escalate.length, 1); assert.equal(re.escalate[0].reason, 'reopened'); assert.deepEqual(re.escalate[0].recipients, ['own', 'own2']); });
  check(() => { const before = [{ ...orgAck[0], at: '2026-09-30T10:00:00.000Z' }]; assert.equal(D.planDelivery({ present: one('incident-open', 'normal', 'org', [{ userId: 'adm', count: 2, acknowledged: false }]), open: occ('incident-open', 'normal', 'org'), acknowledgements: before, members, now: at(10) }).escalate.length, 0, 'an acknowledgement from before the occurrence opened does not count as a re-open'); });
  check(() => { const other = [{ alertId: 'referrals-overdue', count: 2, userId: 'sup2', by: 'Synthetic sup2', at: at(5), note: 'Other team', scope: 'user' }]; assert.equal(esc('referrals-overdue', 'high', 'sup', 10, other).length, 0, "another supervisor's acknowledgement does not re-open this supervisor's occurrence"); assert.equal(esc('referrals-overdue', 'high', 'sup', 10, [{ ...other[0], userId: 'sup' }])[0].reason, 'reopened'); });
  // 11. Who may hold a notification now (rechecked on every inbox read and mark-read, including replays).
  check(() => { assert.equal(D.mayHold(sup, { level: 1, owner: 'supervisors', scopeKey: 'sup' }), true); assert.equal(D.mayHold(sup, { level: 1, owner: 'supervisors', scopeKey: 'sup2' }), false); assert.equal(D.mayHold(sup, { level: 1, owner: 'operations', scopeKey: 'org' }), false); assert.equal(D.mayHold(adm, { level: 1, owner: 'operations', scopeKey: 'org' }), true); assert.equal(D.mayHold(adm, { level: 2, owner: 'operations', scopeKey: 'org' }), false); assert.equal(D.mayHold(own, { level: 2, owner: 'supervisors', scopeKey: 'sup' }), true); assert.equal(D.mayHold(gone, { level: 2, owner: 'operations', scopeKey: 'org' }), false); assert.equal(D.mayHold(member('sup', 'clinician'), { level: 1, owner: 'supervisors', scopeKey: 'sup' }), false, 'a former supervisor no longer holds the notification'); });
  // 12. Mark-read command shape.
  check(() => { const ok = D.inboxSchema.safeParse({ type: 'alertInboxMarkRead', ids: ['abcdef12-3456'] }); assert.equal(ok.success, true); assert.equal(D.inboxSchema.safeParse({ type: 'alertInboxMarkRead', ids: [] }).success, false); assert.equal(D.inboxSchema.safeParse({ type: 'alertInboxMarkRead', ids: Array.from({ length: 51 }, (_, i) => 'abcdefgh' + i) }).success, false); assert.equal(D.inboxSchema.safeParse({ type: 'alertInboxMarkRead', ids: ["x' OR 1=1"] }).success, false); assert.equal(D.inboxSchema.safeParse({ type: 'alertInboxMarkRead', ids: ['abcdef1234'], userId: 'own' }).success, false, 'no other person can be named'); });
  // 13. Server writes are idempotent and in-app only.
  const server = readFileSync('lib/saha/alert-delivery-server.ts', 'utf8');
  check(() => { assert.match(server, /INSERT OR IGNORE INTO alert_occurrences/); assert.equal((server.match(/INSERT OR IGNORE INTO alert_notifications/g) ?? []).length, 2); assert.match(server, /WHERE org_id=\? AND id=\? AND escalated_at IS NULL AND closed_at IS NULL/); assert.doesNotMatch(server + readFileSync('lib/saha/alert-delivery.ts', 'utf8'), /fetch\(|sendEmail|smtp|sms/i, 'no external delivery'); });
  check(() => { assert.match(server, /plan\.deliver = plan\.deliver\.filter/); assert.match(server, /plan\.restore = plan\.restore\.filter/); assert.match(server, /plan\.clear = plan\.clear\.filter/); }); // steady state writes nothing
  check(() => { const sqlText = readFileSync('drizzle/0014_alert_delivery.sql', 'utf8'); assert.match(sqlText, /CREATE UNIQUE INDEX `alert_occurrence_open` ON `alert_occurrences` \(`org_id`,`alert_id`,`scope_key`\) WHERE `closed_at` IS NULL/); assert.match(sqlText, /CREATE UNIQUE INDEX `alert_notification_once` ON `alert_notifications` \(`org_id`,`occurrence_id`,`user_id`,`level`\)/); });
  const result = { suite: 'In-app alert delivery contract (slice 6v)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/alert-delivery-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
