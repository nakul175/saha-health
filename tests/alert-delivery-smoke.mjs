// Slice 6v HTTP/D1 smoke: in-app alert delivery, acknowledgement clearing, re-open escalation, mark-read and scope.
import assert from 'node:assert/strict';
export async function alertDeliverySmoke({ get, post, check, accounts, org, sql }) {
  const { owner: o, supervisor: s, admin: a, worker: w, stranger: x } = accounts;
  const inbox = who => get(who, '/api/alerts', 200, org);
  const supervisorAlerts = ['referrals-overdue', 'followups-overdue', 'referrals-undated'];
  await get(null, '/api/alerts', 401, org); await get(x, '/api/alerts', 403, org);
  const workerInbox = await inbox(w);
  check(() => { assert.deepEqual(workerInbox.owns, []); assert.deepEqual(workerInbox.items, []); assert.equal(workerInbox.unread, 0); assert.match(workerInbox.channel, /In-app only/); });
  // Start from no open critical incident, so this check owns a fresh occurrence.
  let ops = await get(o, '/api/operations', 200, org);
  for (const i of ops.operations.incidents.filter(i => i.state !== 'resolved' && i.severity === 'critical')) { await post(a, { type: 'opsUpdateIncident', version: ops.operations.version, id: i.id, state: 'resolved', ownerId: o.id, resolution: 'Synthetic resolution before the 6v check', evidence: 'synthetic-6v' }); ops = await get(o, '/api/operations', 200, org); }
  const occurrence = () => sql.prepare("SELECT * FROM alert_occurrences WHERE org_id=? AND alert_id='incident-critical-open' AND closed_at IS NULL").all(org);
  check(() => assert.equal(occurrence().length, 0, 'no open critical-incident occurrence once incidents are resolved'));
  const first = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 6v delivery check', severity: 'critical', ownerId: o.id });
  // The organisation-wide command evaluated delivery on the state it loaded.
  check(() => { const occ = occurrence(); assert.equal(occ.length, 1); assert.equal(occ[0].scope_key, 'org'); assert.equal(occ[0].owner_role, 'operations'); assert.equal(occ[0].escalated_at, null); });
  const occId = occurrence()[0].id, rows = user => sql.prepare('SELECT * FROM alert_notifications WHERE org_id=? AND occurrence_id=? AND user_id=? ORDER BY level').all(org, occId, user);
  const adminInbox = await inbox(a), ownerInbox = await inbox(o), supInbox = await inbox(s);
  const item = (box, level = 1) => box.items.find(i => i.alertId === 'incident-critical-open' && i.level === level && i.active);
  check(() => { const i = item(adminInbox); assert.ok(i, 'administrator received the critical incident alert'); assert.equal(i.kind, 'delivery'); assert.equal(i.count, 1); assert.ok(i.deliveredAt); assert.equal(i.readAt, null); assert.ok(adminInbox.unread >= 1); });
  check(() => { assert.ok(item(ownerInbox), 'owner received it too'); assert.equal(supInbox.items.some(i => /^incident|^server|^maintenance|^ai-/.test(i.alertId)), false, 'a supervisor receives no operations or owner alerts'); assert.ok(supInbox.items.every(i => supervisorAlerts.includes(i.alertId) && i.level === 1)); });
  check(() => { for (const box of [adminInbox, ownerInbox, supInbox]) assert.equal(/Meena|Same test name/.test(JSON.stringify(box)), false, 'no patient names in notifications'); assert.equal(ownerInbox.escalations !== null, true); assert.equal(adminInbox.escalations, null, 'escalation records are listed for owners only'); });
  // Repeat reads and a repeat evaluation do not duplicate deliveries.
  const total = () => sql.prepare('SELECT count(*) AS n FROM alert_notifications WHERE org_id=?').get(org).n, before = total();
  await inbox(a); await inbox(a); await get(o, '/api/operations', 200, org); await inbox(o);
  check(() => { assert.equal(total(), before, 'repeat reads add no notification'); assert.equal(rows(a.id).length, 1); assert.equal(rows(o.id).length, 1); assert.equal(rows(s.id).length, 0); });
  // Acknowledgement clears it for the role (organisation-shared for operations alerts).
  ops = await get(a, '/api/operations', 200, org); const seen = ops.alerts.find(y => y.id === 'incident-critical-open').count;
  await post(a, { type: 'opsAcknowledgeAlert', alertId: 'incident-critical-open', count: seen, note: 'Synthetic 6v: incident owner investigating' });
  const clearedAdmin = await inbox(a), clearedOwner = await inbox(o);
  check(() => { for (const box of [clearedAdmin, clearedOwner]) { const i = box.items.find(y => y.alertId === 'incident-critical-open' && y.level === 1); assert.equal(i.active, false); assert.equal(i.clearedReason, 'acknowledged'); } assert.equal(occurrence()[0].escalated_at, null, 'an acknowledged alert does not escalate'); });
  // A second critical incident changes the count: the acknowledgement stops applying, the alert re-opens and escalates to owners.
  ops = await get(o, '/api/operations', 200, org);
  const second = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 6v second incident', severity: 'critical', ownerId: o.id });
  const reAdmin = await inbox(a), reOwner = await inbox(o);
  check(() => { const occ = occurrence()[0]; assert.equal(occ.id, occId, 'same occurrence'); assert.ok(occ.escalated_at); assert.equal(occ.escalated_to, 'owners'); assert.equal(occ.escalation_reason, 'reopened'); assert.ok(occ.escalation_recipients >= 1); });
  check(() => { const i = item(reAdmin); assert.ok(i, 'the delivery is shown again'); assert.equal(i.readAt, null); assert.equal(item(reAdmin, 2), undefined, 'an administrator who is not an owner receives no owner escalation'); });
  const escalated = item(reOwner, 2);
  check(() => { assert.ok(escalated, 'owner received the escalation'); assert.equal(escalated.kind, 'escalation'); assert.equal(escalated.count, null); assert.match(escalated.title, /^Escalated: /); assert.match(escalated.detail, /Re-opened after its acknowledgement stopped applying/); assert.ok(reOwner.escalations.some(e => e.alertId === 'incident-critical-open' && e.reason === 'reopened' && e.escalatedTo === 'owners')); });
  // Repeat evaluation: no second escalation.
  await inbox(o); await get(o, '/api/operations', 200, org);
  check(() => { assert.equal(rows(o.id).filter(r => r.level === 2).length, 1); assert.equal(sql.prepare("SELECT count(*) AS n FROM alert_occurrences WHERE org_id=? AND alert_id='incident-critical-open' AND escalated_at IS NOT NULL AND closed_at IS NULL").get(org).n, 1); });
  // Mark read: only the viewer's own notifications; idempotent replay with the same key.
  await post(s, { type: 'alertInboxMarkRead', ids: [escalated.id] }, 404);
  await post(a, { type: 'alertInboxMarkRead', ids: [escalated.id] }, 404);
  await post(o, { type: 'alertInboxMarkRead', ids: ['unknown-notification-id'] }, 404);
  await post(o, { type: 'alertInboxMarkRead', ids: [escalated.id], userId: a.id }, 422);
  const key = crypto.randomUUID(), read = await post(o, { type: 'alertInboxMarkRead', ids: [escalated.id] }, 200, key), replay = await post(o, { type: 'alertInboxMarkRead', ids: [escalated.id] }, 200, key);
  const afterRead = await inbox(o);
  check(() => { assert.equal(read.result.read, 1); assert.equal(replay.replayed, true); assert.deepEqual(replay.result, read.result); assert.ok(item(afterRead, 2).readAt); assert.equal(afterRead.unread, reOwner.unread - 1); });
  // Resolving both incidents closes the occurrence and clears every notification as resolved.
  ops = await get(o, '/api/operations', 200, org);
  for (const id of [first.result.incidentId, second.result.incidentId]) { await post(a, { type: 'opsUpdateIncident', version: ops.operations.version, id, state: 'resolved', ownerId: o.id, resolution: 'Synthetic 6v check finished', evidence: 'synthetic-6v' }); ops = await get(o, '/api/operations', 200, org); }
  check(() => { assert.equal(occurrence().length, 0); const left = sql.prepare('SELECT count(*) AS n FROM alert_notifications WHERE org_id=? AND occurrence_id=? AND cleared_at IS NULL').get(org, occId).n; assert.equal(left, 0); const reasons = sql.prepare('SELECT DISTINCT cleared_reason AS r FROM alert_notifications WHERE org_id=? AND occurrence_id=?').all(org, occId).map(r => r.r); assert.ok(reasons.length && reasons.every(r => ['acknowledged', 'resolved'].includes(r)), 'cleared by the acknowledgement applying again at count 1, then closed'); });
}
