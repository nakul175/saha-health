import {captureAggregateAlerts,checkAggregateAlertContext,AGGREGATE_ALERT_NOTICE,clinicalAggregateAlert,aggregateAlertGuardedDatabase} from './aggregate-alert-disclosure';
import {recordAggregateView} from './read-audit';
// Slice 10b: evaluation and the owner read for the out-of-app notification channel (demonstration simulator only).
//
// Evaluation runs inside every alert delivery evaluation (slice 6v: on alert and Operations reads and after
// organisation-wide commands, and from any scheduled trigger that calls `evaluateDelivery`), after occurrences are opened, so
// the planner sees the same occurrences and views. Each message is committed together with its audit event in one
// access-audit style commit (slice 6t): it appends audit events and message rows only, moves neither the organisation nor
// the patient revision, and the unique key (occurrence, tier, recipient) makes a repeated or concurrent evaluation harmless.
import type { D1Database } from '@cloudflare/workers-types';
import { db, identity, json, loadFor, rawRuntime } from './server';
import { environmentOf } from './environment';
import { ACCESS_AUDIT } from './audit-chain';
import { persist, scope, type Actor, type Row } from './store';
import { evaluateIfDue } from './alert-delivery-server';
import { fail, uuid } from './core';
import { CHANNELS, CHANNEL_RULES_VERSION, DEFAULT_ESCALATE_MINUTES, LOG_LIMIT, MAX_ESCALATE_MINUTES, MAX_RECIPIENTS, MAX_SENDS_PER_EVALUATION, MIN_ESCALATE_MINUTES, NOTIFIABLE_KINDS, NOTIFIABLE_OWNERS, SIMULATOR_NOTICE, SOURCE_KINDS, TIERS, channelOf, demoAddress, ladderFor, messageKey, notifiableKindsFor, planNotifications, planSourceNotifications, redactFor, simulatorRefusal, sourceKey, type ChannelOccurrence, type ChannelPresent, type PlannedMessage } from './notification-channel';
import { channelSources, SOURCE_RULES_VERSION } from './notification-sources';
import type { Audit, OrgState, Role } from './types';

// The simulator is not a person: its messages and audit events are written under a fixed system identity.
export const SYSTEM_ACTOR: Actor = { userId: 'system:notification-simulator', displayName: 'Saha notification simulator', email: '' };
const CHUNK = 20;
const shell = (s: OrgState): OrgState => ({ organisation: s.organisation, teams: [], members: [], invitations: [], workspace: { ...s.workspace, people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
const kind = (c: string) => c === 'sms' ? 'SMS' : 'email';
export const auditDetail = (m: PlannedMessage) => `Simulated ${kind(m.channel)} to ${m.recipientName} (tier ${m.tier}${m.reason === 'escalation' ? ', escalation' : ''}) for alert ${m.alertId}${m.count === null ? '' : `, count ${m.count}`}. Receipt ${m.receipt.receiptId}. Stored in Saha only: no address or number was contacted. The message carries no patient names or identifiers.`;

// Writes up to CHUNK messages and their audit events in one commit. Throws if the commit fails; nothing is half written.
async function commit(d: D1Database, s: OrgState, messages: PlannedMessage[], now: string, configVersion: number) {
  const before = shell(s), after = shell(s), ids = messages.map(() => ({ message: uuid(), audit: uuid() }));
  after.workspace.audit = messages.map((m, i): Audit => ({ id: ids[i].audit, at: now, actor: SYSTEM_ACTOR.displayName, actorId: SYSTEM_ACTOR.userId, role: 'system' as Role, action: 'notificationSent', subject: ids[i].message, detail: auditDetail(m), personId: null }));
  const orgId = s.organisation.id;
  const rows: Row[] = messages.map((m, i) => ({ table: 'notification_messages', keys: ['org_id', 'id'], append: true, values: { org_id: orgId, id: ids[i].message, occurrence_id: m.occurrenceId, alert_id: m.alertId, scope_key: m.scopeKey, tier: m.tier, rung: m.rung, user_id: m.userId, channel: m.channel, reason: m.reason, severity: m.severity, title: m.title, count: m.count, subject: m.subject, body: m.body, link: m.link, address: m.address, status: m.status, receipt: JSON.stringify(m.receipt), due_at: m.dueAt, sent_at: m.sentAt, audit_id: ids[i].audit, config_version: configVersion } }));
  await persist(messages.some(m=>clinicalAggregateAlert(m.alertId))?aggregateAlertGuardedDatabase(d,s):d, before, after, SYSTEM_ACTOR, { type: ACCESS_AUDIT }, 'notify_' + ids[0].audit, '', null, rows);
}

// Plans and sends what is due. `present` is the evaluation's own view of the alerts (slice 6v `presentFrom`). Never throws for
// a refusal; a storage failure throws to the caller, which records it without failing the read or command.
// Slice 13d (round-10 review L4): `env` is the caller's environment (the scheduled job passes the one its handler received);
// without it, the request's runtime environment is used, as before.
export async function evaluateChannel(d: D1Database, s: OrgState, present: ChannelPresent[], now = new Date().toISOString(), env?: Record<string, string | undefined>) {
  const config = channelOf(s), result = { sent: 0, planned: 0, refused: null as string | null, skipped: 0 };
  if (!config?.enabled || !config.recipients.length) return result;
  const orgId = s.organisation.id, environment = environmentOf(env ?? rawRuntime()).name;
  result.refused = simulatorRefusal(environment);
  if (result.refused) return result;
  const occurrences = (await d.prepare('SELECT id,alert_id,scope_key,owner_role,severity,title,opened_at FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL').bind(orgId).all<any>()).results.map((r): ChannelOccurrence => ({ id: r.id, alertId: r.alert_id, scopeKey: r.scope_key, owner: r.owner_role, severity: r.severity, title: r.title, openedAt: r.opened_at }));
  const visibleOccurrences=occurrences.filter(o=>!clinicalAggregateAlert(o.alertId)||present.some(p=>p.alertId===o.alertId&&p.scopeKey===o.scopeKey));
  if (!visibleOccurrences.length) return result;
  const sent = new Set((await d.prepare('SELECT occurrence_id,tier,user_id FROM notification_messages WHERE org_id=? AND occurrence_id IN (SELECT id FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL)').bind(orgId, orgId).all<{ occurrence_id: string; tier: number; user_id: string }>()).results.map(r => messageKey(r.occurrence_id, r.tier, r.user_id)));
  const plan = planNotifications({ config, environment, occurrences:visibleOccurrences, present, sent, members: s.members, now });
  result.planned = plan.messages.length; result.skipped = plan.skipped.length;
  const due = plan.messages.slice(0, MAX_SENDS_PER_EVALUATION);
  for (let i = 0; i < due.length; i += CHUNK) { const part = due.slice(i, i + CHUNK); await commit(d, s, part, now, config.version); result.sent += part.length; }
  return result;
}

// Slice r03: plans and sends the additional sources (drift, timed-out requests, exception items, referral requests)
// through the same demonstration simulator and message table. Called at the end of `evaluateDelivery` beside
// `evaluateChannel`, so it runs on the same reads, organisation-wide commands and scheduled triggers. A failure is
// reported and never undoes the in-app delivery or blocks the read/command; the unique key makes repeats harmless.
export async function evaluateChannelSources(d: D1Database, s: OrgState, now = new Date().toISOString(), env?: Record<string, string | undefined>) {
  const config = channelOf(s), result = { sent: 0, planned: 0, refused: null as string | null, skipped: 0 };
  if (!config?.enabled || !config.recipients.length) return result;
  const environment = environmentOf(env ?? rawRuntime()).name;
  result.refused = simulatorRefusal(environment);
  if (result.refused) return result;
  const sources = channelSources(s, now);
  if (!sources.length) return result;
  const ids = sources.map(x => sourceKey(x.kind, x.scopeKey));
  const sent = new Set((await d.prepare(`SELECT occurrence_id,tier,user_id FROM notification_messages WHERE org_id=? AND occurrence_id IN (${ids.map(() => '?').join(',')})`).bind(s.organisation.id, ...ids).all<{ occurrence_id: string; tier: number; user_id: string }>()).results.map(r => messageKey(r.occurrence_id, r.tier, r.user_id)));
  const plan = planSourceNotifications({ config, environment, sources, sent, members: s.members, now });
  result.planned = plan.messages.length; result.skipped = plan.skipped.length;
  const due = plan.messages.slice(0, MAX_SENDS_PER_EVALUATION);
  for (let i = 0; i < due.length; i += CHUNK) { const part = due.slice(i, i + CHUNK); await commit(d, s, part, now, config.version); result.sent += part.length; }
  return result;
}

const iso = (v: string | null) => v ?? null;
// GET /api/notification-channel: owners only. Reads current settings, the members who may be listed, the open alerts
// with their escalation schedule, and the message log. Counts that belong to another person's care scope are withheld.
export async function notificationChannelRead(request: Request) {
  const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
  if (!m.isOwner) fail(403, 'Only an organisation owner can open the notification channel.');
  const orgId = s.organisation.id, d = db();
  await evaluateIfDue(orgId, s);
  const environment = environmentOf(rawRuntime()).name, refusal = simulatorRefusal(environment), config = channelOf(s), now = new Date().toISOString();
  const named = new Map(s.members.map(x => [x.userId, x]));
  const log = (await d.prepare(`SELECT id,occurrence_id,alert_id,scope_key,tier,rung,user_id,channel,reason,severity,title,count,subject,body,link,address,status,receipt,due_at,sent_at,audit_id,config_version FROM notification_messages WHERE org_id=? AND alert_id NOT IN ('destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing') ORDER BY sent_at DESC,id DESC LIMIT ?`).bind(orgId, LOG_LIMIT).all<any>()).results;
  const total = (await d.prepare(`SELECT count(*) AS n FROM notification_messages WHERE org_id=? AND alert_id NOT IN ('destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing')`).bind(orgId).first<{ n: number }>())?.n ?? 0;
  const messages = log.map(r => redactFor({ id: r.id, occurrenceId: r.occurrence_id, alertId: r.alert_id as string, tier: r.tier as number, rung: r.rung as number, reason: r.reason as string, userId: r.user_id as string, recipientName: named.get(r.user_id)?.displayName ?? 'Former member', channel: r.channel as string, address: r.address as string, severity: r.severity as string, title: r.title as string, count: r.count as number | null, subject: iso(r.subject), body: r.body as string, link: r.link as string, status: r.status as string, receipt: JSON.parse(r.receipt), dueAt: r.due_at as string, sentAt: r.sent_at as string, lateMinutes: Math.max(0, Math.floor((Date.parse(r.sent_at) - Date.parse(r.due_at)) / 60000)), auditId: r.audit_id as string, configVersion: r.config_version as number }, u.userId));
  const openRows = (await d.prepare("SELECT o.id,o.alert_id,o.scope_key,o.owner_role,o.severity,o.title,o.opened_at,o.escalated_at,(SELECT count(*) FROM alert_notifications n WHERE n.org_id=o.org_id AND n.occurrence_id=o.id AND n.level=1 AND n.cleared_at IS NULL) AS active FROM alert_occurrences o WHERE o.org_id=? AND o.closed_at IS NULL AND o.alert_id NOT IN ('destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing') ORDER BY o.opened_at DESC LIMIT 50").bind(orgId).all<any>()).results;
  const sentKeys = new Set((await d.prepare('SELECT occurrence_id,tier,user_id FROM notification_messages WHERE org_id=? AND occurrence_id IN (SELECT id FROM alert_occurrences WHERE org_id=? AND closed_at IS NULL)').bind(orgId, orgId).all<{ occurrence_id: string; tier: number; user_id: string }>()).results.map(r => messageKey(r.occurrence_id, r.tier, r.user_id)));
  const open = openRows.map(o => {
    const ladder = config ? ladderFor(config, { alertId: o.alert_id, scopeKey: o.scope_key, openedAt: o.opened_at }, s.members) : { rungs: [], skipped: [] };
    return { occurrenceId: o.id as string, alertId: o.alert_id as string, severity: o.severity as string, title: o.title as string, openedAt: o.opened_at as string, scope: o.owner_role === 'supervisors' ? named.get(o.scope_key)?.displayName ?? 'a supervisor' : 'organisation', acknowledged: o.active === 0, escalatedInApp: !!o.escalated_at, rungs: ladder.rungs.map(r => { const all = r.recipients.map(x => sentKeys.has(messageKey(o.id, r.tier, x.member.userId))); return { tier: r.tier, dueAt: r.dueAt, recipients: r.recipients.length, state: all.every(Boolean) ? 'sent' : all.some(Boolean) ? 'partly sent' : Date.parse(r.dueAt) <= Date.parse(now) ? 'due' : 'scheduled' }; }) };
  });
  const members = s.members.filter(x => x.status === 'active').map(x => ({ userId: x.userId, displayName: x.displayName, role: x.role, isOwner: x.isOwner, kinds: notifiableKindsFor(x) })).filter(x => x.kinds.length);
  const body = config ?? { version: 0, enabled: false, escalateAfterMinutes: DEFAULT_ESCALATE_MINUTES, recipients: [], setBy: '', setAt: '', reason: '', history: [] };
  const context=await captureAggregateAlerts(d,s,u.userId);await recordAggregateView(d,s,u,m,'current aggregate reporting alert channel','Current protected aggregate sidecar read; historical clinical channel payload and occurrence metadata withheld.');await checkAggregateAlertContext(d,orgId,context);
  return json({aggregatePrivacy:{notice:AGGREGATE_ALERT_NOTICE,currentAvailable:context.available},currentAggregateAlerts:context.current.map(a=>({id:a.id,title:a.title,severity:a.severity,count:a.count,action:a.action})),
    rules: { version: CHANNEL_RULES_VERSION, sourceRules: SOURCE_RULES_VERSION, escalateMinutes: { min: MIN_ESCALATE_MINUTES, max: MAX_ESCALATE_MINUTES, default: DEFAULT_ESCALATE_MINUTES }, tiers: TIERS, channels: CHANNELS, maxRecipients: MAX_RECIPIENTS, kinds: NOTIFIABLE_KINDS.map(id => ({ id, owner: NOTIFIABLE_OWNERS[id], source: (SOURCE_KINDS as readonly string[]).includes(id) })), notice: SIMULATOR_NOTICE },
    environment, available: !refusal, refusal,
    channel: { ...body, setByName: named.get(body.setBy)?.displayName ?? null, recipients: body.recipients.map(r => ({ ...r, displayName: named.get(r.userId)?.displayName ?? 'Former member', role: named.get(r.userId)?.role ?? null, status: named.get(r.userId)?.status ?? 'removed', address: demoAddress(r.channel, r.userId) })) },
    members, open, messages, total,
  });
}
