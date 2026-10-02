// Slice 6v: evaluation of in-app alert delivery and escalation, the inbox read and mark-read.
//
// The Worker has no background timer in this deployment, so delivery and escalation are evaluated when
// people use Saha: on inbox and operations reads, and after organisation-wide commands (using the state
// the command already loaded). A read evaluates at most once a minute per Worker instance unless the
// organisation or a patient record changed since its last evaluation, so detection time depends on traffic.
import type { D1Database } from '@cloudflare/workers-types';
import { activeOrg, db, identity, json } from './server';
import { readState, type Actor } from './store';
import { careReport, defaultOperations, operator } from './operations';
import { reportingScope } from './delegation';
import { alertsFor, ALERT_RULES_VERSION, canAcknowledge } from './alerts';
import { budgetView } from './ai-budget';
import { invoiceAlertInputs } from './ai-invoice';
import { fail, uuid } from './core';
import { CLEARED_DAYS, DELIVERY_RULES_VERSION, ESCALATE_AFTER_MINUTES, ESCALATION_LADDER, EVALUATE_EVERY_SECONDS, INBOX_LIMIT, mayHold, planDelivery, presentFrom, type OpenOccurrence, type OwnerRole } from './alert-delivery';
import type { Member, OrgState } from './types';
const last = new Map<string, { basis: string; at: number }>();
const basisOf = async (d: D1Database, orgId: string) => { const r = await d.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').bind(orgId).first<{ revision: number; patient_revision: number | null }>(); return r ? `${r.revision}:${r.patient_revision ?? 0}` : ''; };
// The alert views of every member who owns at least one alert kind, each computed exactly as their Operations page would be.
export async function memberViews(d: D1Database, s: OrgState, now: string) {
  const recipients = s.members.filter(m => m.status === 'active' && (['operations', 'supervisors', 'owners'] as const).some(o => canAcknowledge(m, o)));
  if (!recipients.length) return [];
  const ops = s.operations ?? defaultOperations();
  let telemetry: any = null;
  if (recipients.some(operator)) { const r = await d.prepare('SELECT sum(count) AS count,sum(CASE WHEN status>=500 THEN count ELSE 0 END) AS errors FROM request_metrics WHERE org_id=? AND bucket>=?').bind(s.organisation.id, new Date(Date.parse(now) - 86400000).toISOString()).first<{ count: number | null; errors: number | null }>(); const count = r?.count ?? 0, errors = r?.errors ?? 0; telemetry = { count, serverErrors: errors, errorRate: count ? errors / count : null }; }
  const budgets = recipients.some(operator) ? budgetView(s, now) : null, invoices = recipients.some(operator) ? invoiceAlertInputs(s, now) : null;
  return recipients.map(m => { const report = m.role === 'admin' ? null : careReport(s, m, 7, new Date(now), reportingScope(s, m, now).include); return { member: m, alerts: alertsFor({ budgets: operator(m) ? budgets : null, invoices: operator(m) ? invoices : null, report, telemetry: operator(m) ? telemetry : null, operations: operator(m) ? ops : null, acknowledgements: ops.acknowledgements ?? [], viewerId: m.userId, now }) }; });
}
// One evaluation: read open occurrences, plan, write. Every write is idempotent (unique keys, guarded updates).
export async function evaluateDelivery(d: D1Database, s: OrgState, now = new Date().toISOString()) {
  const orgId = s.organisation.id, views = await memberViews(d, s, now), present = presentFrom(views);
  const open = (await d.prepare('SELECT id,alert_id,scope_key,owner_role,severity,title,opened_at,escalated_at FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL').bind(orgId).all<any>()).results.map((r): OpenOccurrence => ({ id: r.id, alertId: r.alert_id, scopeKey: r.scope_key, owner: r.owner_role, severity: r.severity, title: r.title, openedAt: r.opened_at, escalatedAt: r.escalated_at }));
  const plan = planDelivery({ present, open, acknowledgements: s.operations?.acknowledgements ?? [], members: s.members, now });
  // Only changes are written: a steady state (nothing new, cleared or re-opened) costs these reads and no writes.
  const held = open.length ? (await d.prepare('SELECT occurrence_id,user_id,level,cleared_at,cleared_reason FROM alert_notifications WHERE org_id=? AND occurrence_id IN (SELECT id FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL)').bind(orgId, orgId).all<{ occurrence_id: string; user_id: string; level: number; cleared_at: string | null; cleared_reason: string | null }>()).results : [];
  const openId = new Map(open.map(o => [`${o.alertId}|${o.scopeKey}`, o.id])), has = new Set(held.map(r => `${r.occurrence_id}|${r.user_id}|${r.level}`));
  plan.deliver = plan.deliver.filter(n => { const id = openId.get(`${n.alertId}|${n.scopeKey}`); return !id || !has.has(`${id}|${n.userId}|1`); });
  plan.clear = plan.clear.filter(id => held.some(r => r.occurrence_id === id && !r.cleared_at) || plan.deliver.some(n => openId.get(`${n.alertId}|${n.scopeKey}`) === id));
  plan.restore = plan.restore.filter(id => held.some(r => r.occurrence_id === id && r.cleared_reason === 'acknowledged'));
  const stmts = [];
  for (const id of plan.close) { stmts.push(d.prepare('UPDATE alert_occurrences SET closed_at=? WHERE org_id=? AND id=? AND closed_at IS NULL').bind(now, orgId, id)); stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='resolved' WHERE org_id=? AND occurrence_id=? AND cleared_at IS NULL").bind(now, orgId, id)); }
  for (const o of plan.open) stmts.push(d.prepare('INSERT OR IGNORE INTO alert_occurrences (org_id,id,alert_id,scope_key,owner_role,severity,title,opened_at) VALUES (?,?,?,?,?,?,?,?)').bind(orgId, uuid(), o.alertId, o.scopeKey, o.owner, o.severity, o.title, now));
  // The occurrence id comes from the open row itself, so a concurrent evaluation that opened it first is reused.
  for (const n of plan.deliver) stmts.push(d.prepare('INSERT OR IGNORE INTO alert_notifications (org_id,id,occurrence_id,user_id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at) SELECT ?,?,o.id,?,1,?,?,?,?,?,?,NULL,? FROM alert_occurrences o WHERE o.org_id=? AND o.alert_id=? AND o.scope_key=? AND o.closed_at IS NULL').bind(orgId, uuid(), n.userId, n.alertId, n.scopeKey, n.owner, n.severity, n.title, n.count, now, orgId, n.alertId, n.scopeKey));
  for (const id of plan.clear) stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='acknowledged' WHERE org_id=? AND occurrence_id=? AND cleared_at IS NULL").bind(now, orgId, id));
  for (const id of plan.restore) stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=NULL,cleared_reason=NULL,read_at=NULL WHERE org_id=? AND occurrence_id=? AND cleared_reason='acknowledged'").bind(orgId, id));
  for (const e of plan.escalate) {
    stmts.push(d.prepare('UPDATE alert_occurrences SET escalated_at=?,escalated_to=?,escalation_reason=?,escalation_recipients=? WHERE org_id=? AND id=? AND escalated_at IS NULL AND closed_at IS NULL').bind(now, e.toRole, e.reason, e.recipients.length, orgId, e.occurrenceId));
    for (const userId of e.recipients) stmts.push(d.prepare('INSERT OR IGNORE INTO alert_notifications (org_id,id,occurrence_id,user_id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at) VALUES (?,?,?,?,2,?,?,?,?,?,NULL,?,?)').bind(orgId, uuid(), e.occurrenceId, userId, e.alertId, e.scopeKey, e.owner, e.severity, `Escalated: ${e.title}`, e.detail, now));
  }
  for (let i = 0; i < stmts.length; i += 90) await d.batch(stmts.slice(i, i + 90));
  return { opened: plan.open.length, closed: plan.close.length, escalated: plan.escalate.length, recipients: views.length, writes: stmts.length };
}
// Reads: evaluate when the organisation changed since the last evaluation, or a minute has passed. Best effort:
// a failed evaluation never blocks the read; existing notifications are still shown.
export async function evaluateIfDue(orgId: string, loaded?: OrgState | null, nowMs = Date.now()) {
  try {
    const d = db(), basis = await basisOf(d, orgId), prev = last.get(orgId);
    if (prev && prev.basis === basis && nowMs - prev.at < EVALUATE_EVERY_SECONDS * 1000) return false;
    if (last.size > 1000) last.clear();
    last.set(orgId, { basis, at: nowMs });
    await evaluateDelivery(d, loaded && !loaded.partition && !loaded.paging ? loaded : await readState(d, orgId), new Date(nowMs).toISOString());
    return true;
  } catch (e) { last.delete(orgId); console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown'); return false; }
}
// Writes: an organisation-wide command evaluates on the full state it already loaded. Patient-scoped commands load only
// their patients (slice 0a), so they are picked up by the next read, which sees that the patient revision moved.
export async function evaluateAfterCommand(s: OrgState) {
  if (s.partition || s.paging || s.readOnlyFor) return false;
  try { const d = db(), nowMs = Date.now(); await evaluateDelivery(d, s, new Date(nowMs).toISOString()); last.set(s.organisation.id, { basis: await basisOf(d, s.organisation.id), at: nowMs }); return true; }
  catch (e) { console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown'); return false; }
}
async function membership(d: D1Database, orgId: string, userId: string) {
  const r = await d.prepare('SELECT user_id,role,is_owner,status FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, userId).first<{ user_id: string; role: Member['role']; is_owner: number; status: Member['status'] }>();
  if (!r || r.status !== 'active') fail(403, 'Your organisation membership is inactive or unavailable.');
  return { userId: r!.user_id, role: r!.role, isOwner: !!r!.is_owner, status: r!.status } as Member;
}
const visible = (m: Member, r: any) => mayHold(m, { level: r.level, owner: r.owner_role as OwnerRole, scopeKey: r.scope_key });
// GET /api/alerts: the signed-in member's own notifications, rechecked against their current membership.
export async function alertInbox(request: Request) {
  const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation')), d = db(), m = await membership(d, orgId, u.userId);
  const owns = (['operations', 'supervisors', 'owners'] as const).filter(o => canAcknowledge(m, o));
  const evaluated = owns.length ? await evaluateIfDue(orgId) : false;
  const since = new Date(Date.now() - CLEARED_DAYS * 86400000).toISOString();
  const rows = owns.length ? (await d.prepare('SELECT id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at,read_at,cleared_at,cleared_reason FROM alert_notifications WHERE org_id=? AND user_id=? AND (cleared_at IS NULL OR cleared_at>=?) ORDER BY (cleared_at IS NULL) DESC,delivered_at DESC LIMIT 200').bind(orgId, u.userId, since).all<any>()).results.filter(r => visible(m, r)) : [];
  const items = rows.slice(0, INBOX_LIMIT).map(r => ({ id: r.id, alertId: r.alert_id, level: r.level, kind: r.level === 1 ? 'delivery' : 'escalation', severity: r.severity, title: r.title, count: r.count, detail: r.detail, deliveredAt: r.delivered_at, readAt: r.read_at, clearedAt: r.cleared_at, clearedReason: r.cleared_reason, active: !r.cleared_at }));
  const escalations = m.isOwner ? (await d.prepare('SELECT alert_id,owner_role,severity,title,opened_at,closed_at,escalated_at,escalated_to,escalation_reason,escalation_recipients FROM alert_occurrences WHERE org_id=? AND escalated_at IS NOT NULL ORDER BY escalated_at DESC LIMIT 20').bind(orgId).all<any>()).results.map(r => ({ alertId: r.alert_id, owner: r.owner_role, severity: r.severity, title: r.title, openedAt: r.opened_at, closedAt: r.closed_at, escalatedAt: r.escalated_at, escalatedTo: r.escalated_to, reason: r.escalation_reason, recipients: r.escalation_recipients })) : null;
  return json({ rules: { delivery: DELIVERY_RULES_VERSION, alerts: ALERT_RULES_VERSION, escalateAfterMinutes: ESCALATE_AFTER_MINUTES, ladder: ESCALATION_LADDER, evaluateEverySeconds: EVALUATE_EVERY_SECONDS }, owns, evaluated, unread: rows.filter(r => !r.cleared_at && !r.read_at).length, items, escalations, channel: 'In-app only. Nothing is emailed, texted or sent outside Saha.' });
}
// Mark-read (command `alertInboxMarkRead`): only the viewer's own notifications that their current membership may hold.
// The same check runs again when an idempotent request is replayed.
async function ownedNotifications(d: D1Database, orgId: string, m: Member, ids: string[]) {
  const unique = [...new Set(ids)];
  const rows = (await d.prepare(`SELECT id,level,owner_role,scope_key FROM alert_notifications WHERE org_id=? AND user_id=? AND id IN (${unique.map(() => '?').join(',')})`).bind(orgId, m.userId, ...unique).all<any>()).results;
  if (rows.length !== unique.length || !rows.every(r => visible(m, r))) fail(404, 'Notification not found.');
  return unique;
}
export async function authorizeInboxReplay(s: OrgState, m: Member, c: { type: string; ids?: string[] }) { if (c.type === 'alertInboxMarkRead') await ownedNotifications(db(), s.organisation.id, m, c.ids!); }
export async function markRead(s: OrgState, u: Actor, m: Member, c: { ids: string[] }, key: string, hash: string) {
  const d = db(), orgId = s.organisation.id, ids = await ownedNotifications(d, orgId, m, c.ids), now = new Date().toISOString(), result = { read: ids.length, readAt: now };
  await d.batch([d.prepare(`UPDATE alert_notifications SET read_at=COALESCE(read_at,?) WHERE org_id=? AND user_id=? AND id IN (${ids.map(() => '?').join(',')})`).bind(now, orgId, u.userId, ...ids), d.prepare('INSERT INTO command_receipts (actor_id,key,org_id,hash,result,person_id,created_at) VALUES (?,?,?,?,?,NULL,?)').bind(u.userId, key, orgId, hash, JSON.stringify(result), now)]);
  return result;
}
