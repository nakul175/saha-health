import { captureAggregateAlerts, checkAggregateAlertContext, clinicalAggregateAlert, AGGREGATE_ALERT_NOTICE, aggregateAlertTransactionGuard, discloseAggregateAlerts } from './aggregate-alert-disclosure.js';
import { recordAggregateView } from './read-audit.js';
import { activeOrg, db, identity, json } from './server.js';
import { readState } from './store.js';
import { defaultOperations, operator } from './operations.js';
import { alertsFor, ALERT_RULES_VERSION, canAcknowledge } from './alerts.js';
import { budgetView } from './ai-budget.js';
import { invoiceAlertInputs } from './ai-invoice.js';
import { fail, uuid } from './core.js';
import { CLEARED_DAYS, DELIVERY_RULES_VERSION, ESCALATE_AFTER_MINUTES, ESCALATION_LADDER, EVALUATE_EVERY_SECONDS, INBOX_LIMIT, mayHold, planDelivery, presentFrom } from './alert-delivery.js';
import { evaluateChannel, evaluateChannelSources } from './notification-channel-server.js';
import { authorizeChannelCommand } from './notification-channel.js';
const last = new Map();
const basisOf = async (d, orgId) => { const r = await d.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').bind(orgId).first(); return r ? `${r.revision}:${r.patient_revision ?? 0}` : ''; };
// The alert views of every member who owns at least one alert kind, each computed exactly as their Operations page would be.
export async function memberViews(d, s, now) {
    const recipients = s.members.filter(m => m.status === 'active' && ['operations', 'supervisors', 'owners'].some(o => canAcknowledge(m, o)));
    if (!recipients.length)
        return [];
    const ops = s.operations ?? defaultOperations();
    let telemetry = null;
    if (recipients.some(operator)) {
        const r = await d.prepare("SELECT sum(count) AS count,sum(CASE WHEN status>=500 THEN count ELSE 0 END) AS errors FROM request_metrics WHERE org_id=? AND route NOT LIKE 'burden:%' AND bucket>=?").bind(s.organisation.id, new Date(Date.parse(now) - 86400000).toISOString()).first();
        const count = r?.count ?? 0, errors = r?.errors ?? 0;
        telemetry = { count, serverErrors: errors, errorRate: count ? errors / count : null };
    }
    const budgets = recipients.some(operator) ? budgetView(s, now) : null, invoices = recipients.some(operator) ? invoiceAlertInputs(s, now) : null;
    const views = [];
    // The committed-state recheck of each context is made once, in evaluateDelivery, before anything is planned, written or sent
    // (it was repeated here immediately before, with no use of the result in between: one full state read per recipient saved).
    for (const m of recipients) {
        const context = await captureAggregateAlerts(d, s, m.userId, now);
        const nonclinical = alertsFor({ budgets: operator(m) ? budgets : null, invoices: operator(m) ? invoices : null, report: null, telemetry: operator(m) ? telemetry : null, operations: operator(m) ? ops : null, acknowledgements: ops.acknowledgements ?? [], viewerId: m.userId, now });
        views.push({ member: m, alerts: [...nonclinical, ...context.current], aggregateAvailable: context.available, aggregateContext: context });
    }
    // An unavailable recipient is unknown, never evidence that their clinical work resolved.
    // Hold the clinical occurrence family conservatively rather than silently closing another view.
    if (views.some(v => v.member.role !== 'admin' && !v.aggregateAvailable))
        for (const view of views)
            view.alerts = view.alerts.filter(a => !clinicalAggregateAlert(a.id));
    return views;
}
// One evaluation: read open occurrences, plan, write. Every write is idempotent (unique keys, guarded updates).
export async function evaluateDelivery(d, s, now = new Date().toISOString(), env) {
    const orgId = s.organisation.id, views = await memberViews(d, s, now);
    for (const view of views)
        try {
            await checkAggregateAlertContext(d, orgId, view.aggregateContext);
        }
        catch {
            view.aggregateAvailable = false;
            view.aggregateContext.available = false;
            view.aggregateContext.current = [];
            view.alerts = view.alerts.filter(a => !clinicalAggregateAlert(a.id));
        }
    if (views.some(v => v.member.role !== 'admin' && !v.aggregateAvailable))
        for (const view of views)
            view.alerts = view.alerts.filter(a => !clinicalAggregateAlert(a.id));
    const present = presentFrom(views);
    const open = (await d.prepare('SELECT id,alert_id,scope_key,owner_role,severity,title,opened_at,escalated_at FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL').bind(orgId).all()).results.map((r) => ({ id: r.id, alertId: r.alert_id, scopeKey: r.scope_key, owner: r.owner_role, severity: r.severity, title: r.title, openedAt: r.opened_at, escalatedAt: r.escalated_at }));
    // No eligible reporting recipients means unknown clinical coverage, never resolution.
    const reportingViews = views.filter(v => v.member.role !== 'admin');
    const clinicalReady = reportingViews.length > 0 && reportingViews.every(v => v.aggregateAvailable);
    const plan = planDelivery({ present, open: clinicalReady ? open : open.filter(o => !clinicalAggregateAlert(o.alertId)), acknowledgements: s.operations?.acknowledgements ?? [], members: s.members, now });
    // Only changes are written: a steady state (nothing new, cleared or re-opened) costs these reads and no writes.
    const held = open.length ? (await d.prepare('SELECT occurrence_id,user_id,level,cleared_at,cleared_reason FROM alert_notifications WHERE org_id=? AND occurrence_id IN (SELECT id FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL)').bind(orgId, orgId).all()).results : [];
    const openId = new Map(open.map(o => [`${o.alertId}|${o.scopeKey}`, o.id])), has = new Set(held.map(r => `${r.occurrence_id}|${r.user_id}|${r.level}`));
    plan.deliver = plan.deliver.filter(n => { const id = openId.get(`${n.alertId}|${n.scopeKey}`); return !id || !has.has(`${id}|${n.userId}|1`); });
    plan.clear = plan.clear.filter(id => held.some(r => r.occurrence_id === id && !r.cleared_at) || plan.deliver.some(n => openId.get(`${n.alertId}|${n.scopeKey}`) === id));
    // Slice 6z: a recipient whose own view shows the acknowledgement keeps their level-1 notification cleared.
    const keep = new Map();
    for (const x of plan.clearFor) {
        const k = keep.get(x.occurrenceId) ?? new Set();
        k.add(x.userId);
        keep.set(x.occurrenceId, k);
    }
    const kept = (r) => r.level === 1 && !!keep.get(r.occurrence_id)?.has(r.user_id);
    plan.clearFor = plan.clearFor.filter(x => held.some(r => r.occurrence_id === x.occurrenceId && r.user_id === x.userId && r.level === 1 && !r.cleared_at) || plan.deliver.some(n => openId.get(`${n.alertId}|${n.scopeKey}`) === x.occurrenceId && n.userId === x.userId));
    plan.restore = plan.restore.filter(id => held.some(r => r.occurrence_id === id && r.cleared_reason === 'acknowledged' && !kept(r)));
    const stmts = [];
    for (const id of plan.close) {
        stmts.push(d.prepare('UPDATE alert_occurrences SET closed_at=? WHERE org_id=? AND id=? AND closed_at IS NULL').bind(now, orgId, id));
        stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='resolved' WHERE org_id=? AND occurrence_id=? AND cleared_at IS NULL").bind(now, orgId, id));
    }
    for (const o of plan.open)
        stmts.push(d.prepare('INSERT OR IGNORE INTO alert_occurrences (org_id,id,alert_id,scope_key,owner_role,severity,title,opened_at) VALUES (?,?,?,?,?,?,?,?)').bind(orgId, uuid(), o.alertId, o.scopeKey, o.owner, o.severity, o.title, now));
    // The occurrence id comes from the open row itself, so a concurrent evaluation that opened it first is reused.
    for (const n of plan.deliver)
        stmts.push(d.prepare('INSERT OR IGNORE INTO alert_notifications (org_id,id,occurrence_id,user_id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at) SELECT ?,?,o.id,?,1,?,?,?,?,?,?,NULL,? FROM alert_occurrences o WHERE o.org_id=? AND o.alert_id=? AND o.scope_key=? AND o.closed_at IS NULL').bind(orgId, uuid(), n.userId, n.alertId, n.scopeKey, n.owner, n.severity, n.title, n.count, now, orgId, n.alertId, n.scopeKey));
    for (const id of plan.clear)
        stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='acknowledged' WHERE org_id=? AND occurrence_id=? AND cleared_at IS NULL").bind(now, orgId, id));
    for (const x of plan.clearFor)
        stmts.push(d.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='acknowledged' WHERE org_id=? AND occurrence_id=? AND user_id=? AND level=1 AND cleared_at IS NULL").bind(now, orgId, x.occurrenceId, x.userId));
    // Slice 6z: restore only on a still-open occurrence (a concurrent evaluation may have closed it), and never a
    // recipient whose own view shows the acknowledgement.
    for (const id of plan.restore) {
        const k = [...(keep.get(id) ?? [])];
        stmts.push(d.prepare(`UPDATE alert_notifications SET cleared_at=NULL,cleared_reason=NULL,read_at=NULL WHERE org_id=? AND occurrence_id=? AND cleared_reason='acknowledged' AND EXISTS (SELECT 1 FROM alert_occurrences o WHERE o.org_id=? AND o.id=? AND o.closed_at IS NULL)${k.length ? ` AND NOT (level=1 AND user_id IN (${k.map(() => '?').join(',')}))` : ''}`).bind(orgId, id, orgId, id, ...k));
    }
    const groups = stmts.map(x => [x]);
    for (const e of plan.escalate) {
        if (clinicalAggregateAlert(e.alertId))
            e.recipients = e.recipients.filter(id => views.some(v => v.member.userId === id && v.aggregateAvailable));
        const g = [];
        groups.push(g);
        g.push(d.prepare('UPDATE alert_occurrences SET escalated_at=?,escalated_to=?,escalation_reason=?,escalation_recipients=? WHERE org_id=? AND id=? AND escalated_at IS NULL AND closed_at IS NULL').bind(now, e.toRole, e.reason, e.recipients.length, orgId, e.occurrenceId));
        // Slice 6z (sixth review): each escalation notification is inserted only when the guarded update above escalated
        // this occurrence in this evaluation (same transaction): an occurrence a concurrent evaluation closed or escalated
        // first gets no escalation row.
        for (const userId of e.recipients)
            g.push(d.prepare('INSERT OR IGNORE INTO alert_notifications (org_id,id,occurrence_id,user_id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at) SELECT ?,?,o.id,?,2,?,?,?,?,?,NULL,?,? FROM alert_occurrences o WHERE o.org_id=? AND o.id=? AND o.closed_at IS NULL AND o.escalated_at=? AND o.escalation_reason=?').bind(orgId, uuid(), userId, e.alertId, e.scopeKey, e.owner, e.severity, `Escalated: ${e.title}`, e.detail, now, orgId, e.occurrenceId, now, e.reason));
    }
    // Batches of at most about 90 statements; an escalation's update and its notification inserts stay in one batch.
    const commitBatch = async (statements) => { for (const view of views)
        if (view.aggregateAvailable)
            await checkAggregateAlertContext(d, orgId, view.aggregateContext); if (clinicalReady)
        return d.batch([aggregateAlertTransactionGuard(d, s), ...statements, aggregateAlertTransactionGuard(d, s)]); return d.batch(statements); };
    let batch = [], writes = 0;
    for (const g of groups) {
        if (batch.length && batch.length + g.length > 90) {
            await commitBatch(batch);
            batch = [];
        }
        batch.push(...g);
        writes += g.length;
    }
    if (batch.length)
        await commitBatch(batch);
    // Slice 10b: out-of-app messages (demonstration simulator) for what is now open. A failure here is reported in the result and never
    // undoes or blocks the in-app delivery above; the next evaluation tries again (messages are unique per occurrence, tier and recipient).
    let channel = null;
    // The committed-state recheck runs inside evaluateChannel, after its disabled/no-occurrence exits and before any disclosure or send, so a disabled channel costs no state read.
    try {
        const recheck = async () => { for (const view of views)
            if (view.aggregateAvailable)
                await checkAggregateAlertContext(d, orgId, view.aggregateContext); };
        channel = await evaluateChannel(d, s, present, now, env, new Map(views.map(v => [v.member.userId, v.aggregateContext])), recheck);
    }
    catch (e) {
        channel = { error: e instanceof Error ? e.name : 'unknown' };
    }
    // Slice r03: additional sources (drift, timed-out requests, exception items, referral requests) in the same
    // demonstration-simulator channel. Isolated so a failure never undoes or blocks the in-app delivery above.
    let sources = null;
    try {
        sources = await evaluateChannelSources(d, s, now, env);
    }
    catch (e) {
        sources = { error: e instanceof Error ? e.name : 'unknown' };
    }
    return { opened: plan.open.length, closed: plan.close.length, escalated: plan.escalate.length, recipients: views.length, writes, channel, sources };
}
// Reads: evaluate when the organisation changed since the last evaluation, or a minute has passed. Best effort:
// a failed evaluation never blocks the read; existing notifications are still shown.
export async function evaluateIfDue(orgId, loaded, nowMs = Date.now()) {
    try {
        const d = db(), basis = await basisOf(d, orgId), prev = last.get(orgId);
        if (prev && prev.basis === basis && nowMs - prev.at < EVALUATE_EVERY_SECONDS * 1000)
            return false;
        if (last.size > 1000)
            last.clear();
        last.set(orgId, { basis, at: nowMs });
        await evaluateDelivery(d, loaded && !loaded.partition && !loaded.paging ? loaded : await readState(d, orgId), new Date(nowMs).toISOString());
        return true;
    }
    catch (e) {
        last.delete(orgId);
        console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown');
        return false;
    }
}
// Writes: an organisation-wide command evaluates on the full state it already loaded. Patient-scoped commands load only
// their patients (slice 0a), so they are picked up by the next read, which sees that the patient revision moved.
export async function evaluateAfterCommand(s) {
    if (s.partition || s.paging || s.readOnlyFor)
        return false;
    // Slice 14a: `s` is the post-command state, but persist moves the stored organisation revisions without writing them back to it.
    // The aggregate-alert transaction guard compares exactly those revisions, so a clinical alert that is available made every
    // after-command evaluation fail on a stale revision (the incident of an organisation-wide command then opened no occurrence
    // until the next read). Evaluate on the committed revisions; everything else in `s` is already the committed state.
    try {
        const d = db(), nowMs = Date.now(), rev = await d.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').bind(s.organisation.id).first(); // Fail closed: a command moves each revision by at most one. Anything further means another commit intervened, so this state is not the committed one.
        if (!rev || rev.revision - s.organisation.revision < 0 || rev.revision - s.organisation.revision > 1 || (rev.patient_revision ?? 0) - (s.organisation.patientRevision ?? 0) < 0 || (rev.patient_revision ?? 0) - (s.organisation.patientRevision ?? 0) > 1)
            return false;
        await evaluateDelivery(d, { ...s, organisation: { ...s.organisation, revision: rev.revision, patientRevision: rev.patient_revision ?? 0 } }, new Date(nowMs).toISOString());
        last.set(s.organisation.id, { basis: await basisOf(d, s.organisation.id), at: nowMs });
        return true;
    }
    catch (e) {
        console.error('Alert delivery evaluation failed', e instanceof Error ? e.name : 'unknown');
        return false;
    }
}
async function membership(d, orgId, userId) {
    const r = await d.prepare('SELECT user_id,role,is_owner,status FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, userId).first();
    if (!r || r.status !== 'active')
        fail(403, 'Your organisation membership is inactive or unavailable.');
    return { userId: r.user_id, role: r.role, isOwner: !!r.is_owner, status: r.status };
}
const visible = (m, r) => mayHold(m, { level: r.level, owner: r.owner_role, scopeKey: r.scope_key });
// GET /api/alerts: the signed-in member's own notifications, rechecked against their current membership.
export async function alertInbox(request) {
    const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation')), d = db(), m = await membership(d, orgId, u.userId);
    const state = await readState(d, orgId), context = await captureAggregateAlerts(d, state, u.userId);
    const owns = ['operations', 'supervisors', 'owners'].filter(o => canAcknowledge(m, o));
    const evaluated = owns.length ? await evaluateIfDue(orgId) : false;
    const since = new Date(Date.now() - CLEARED_DAYS * 86400000).toISOString();
    const rows = owns.length ? (await d.prepare(`SELECT id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at,read_at,cleared_at,cleared_reason FROM alert_notifications WHERE org_id=? AND user_id=? AND (cleared_at IS NULL OR cleared_at>=?) AND alert_id NOT IN ('destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing') ORDER BY (cleared_at IS NULL) DESC,delivered_at DESC LIMIT 200`).bind(orgId, u.userId, since).all()).results.filter(r => visible(m, r)) : [];
    const items = rows.slice(0, INBOX_LIMIT).map(r => ({ id: r.id, alertId: r.alert_id, level: r.level, kind: r.level === 1 ? 'delivery' : 'escalation', severity: r.severity, title: r.title, count: r.count, detail: r.detail, deliveredAt: r.delivered_at, readAt: r.read_at, clearedAt: r.cleared_at, clearedReason: r.cleared_reason, active: !r.cleared_at }));
    const escalations = m.isOwner ? (await d.prepare(`SELECT alert_id,owner_role,severity,title,opened_at,closed_at,escalated_at,escalated_to,escalation_reason,escalation_recipients FROM alert_occurrences WHERE org_id=? AND escalated_at IS NOT NULL AND alert_id NOT IN ('destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing') ORDER BY escalated_at DESC LIMIT 20`).bind(orgId).all()).results.map(r => ({ alertId: r.alert_id, owner: r.owner_role, severity: r.severity, title: r.title, openedAt: r.opened_at, closedAt: r.closed_at, escalatedAt: r.escalated_at, escalatedTo: r.escalated_to, reason: r.escalation_reason, recipients: r.escalation_recipients })) : null;
    await recordAggregateView(d, state, u, context.m, 'current aggregate reporting alerts', 'Current protected reporting sidecar read; historical clinical notification counts and event metadata withheld.');
    await checkAggregateAlertContext(d, orgId, context);
    await discloseAggregateAlerts(d, orgId, context);
    return json({ aggregatePrivacy: { notice: AGGREGATE_ALERT_NOTICE, currentAvailable: context.available }, currentAggregateAlerts: context.current.map(a => ({ id: a.id, title: a.title, severity: a.severity, count: a.count, action: a.action })), rules: { delivery: DELIVERY_RULES_VERSION, alerts: ALERT_RULES_VERSION, escalateAfterMinutes: ESCALATE_AFTER_MINUTES, ladder: ESCALATION_LADDER, evaluateEverySeconds: EVALUATE_EVERY_SECONDS }, owns, evaluated, unread: rows.filter(r => !r.cleared_at && !r.read_at).length, items, escalations, channel: 'In-app only. Nothing is emailed, texted or sent outside Saha.' });
}
// Mark-read (command `alertInboxMarkRead`): only the viewer's own notifications that their current membership may hold.
// The same check runs again when an idempotent request is replayed.
async function ownedNotifications(d, orgId, m, ids) {
    const unique = [...new Set(ids)];
    const rows = (await d.prepare(`SELECT id,level,owner_role,scope_key,alert_id FROM alert_notifications WHERE org_id=? AND user_id=? AND id IN (${unique.map(() => '?').join(',')})`).bind(orgId, m.userId, ...unique).all()).results;
    if (rows.length !== unique.length || !rows.every(r => visible(m, r) && !clinicalAggregateAlert(r.alert_id)))
        fail(404, 'Notification not found.');
    return unique;
}
export async function authorizeInboxReplay(s, m, c) { if (c.type === 'alertInboxMarkRead')
    await ownedNotifications(db(), s.organisation.id, m, c.ids); authorizeChannelCommand(m, c, fail); } // slice 10b: an owner-only command shares this replay hook
export async function markRead(s, u, m, c, key, hash) {
    const d = db(), orgId = s.organisation.id, ids = await ownedNotifications(d, orgId, m, c.ids), now = new Date().toISOString(), result = { read: ids.length, readAt: now };
    await d.batch([d.prepare(`UPDATE alert_notifications SET read_at=COALESCE(read_at,?) WHERE org_id=? AND user_id=? AND id IN (${ids.map(() => '?').join(',')})`).bind(now, orgId, u.userId, ...ids), d.prepare('INSERT INTO command_receipts (actor_id,key,org_id,hash,result,person_id,created_at) VALUES (?,?,?,?,?,NULL,?)').bind(u.userId, key, orgId, hash, JSON.stringify(result), now)]);
    return result;
}
