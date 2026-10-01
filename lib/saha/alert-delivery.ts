// Slice 6v: in-app alert delivery and escalation (BR-OPS-04, NFR-18, BR-REP-01).
//
// Alerts are still computed from data each recipient may already see (slice 6g). This module turns the
// computed views into delivery state, kept outside the organisation record so a delivery never moves the
// organisation revision or collides with a teammate's command:
//  - an occurrence opens when an alert first appears in an owner's view and closes when it disappears;
//  - each member who owns the alert (6h `canAcknowledge`) receives one in-app notification per occurrence,
//    recorded with its delivery time; nothing is emailed, texted or sent outside Saha;
//  - an acknowledgement (6h) clears the occurrence's notifications; when it stops applying (count change or
//    24-hour lapse) they are shown again;
//  - an occurrence that stays unacknowledged past its severity threshold, or re-opens after an acknowledgement
//    made during it, escalates once to the next role on its ladder, inside the organisation only.
// The planner is pure: the server reads the open occurrences, plans, and writes with INSERT OR IGNORE on unique
// keys, so repeated or concurrent evaluations never duplicate a delivery or an escalation.
import { z } from 'zod';
import { ALERT_OWNERS, canAcknowledge, type Alert, type AlertAck } from './alerts';
import type { Member } from './types';
export const DELIVERY_RULES_VERSION = '1.0.0';
export type OwnerRole = 'operations' | 'supervisors' | 'owners';
// Each ladder starts with the owning role. Owners are the top of every ladder: nothing escalates outside the organisation.
export const ESCALATION_LADDER: Record<OwnerRole, readonly ('operations' | 'supervisors' | 'owners')[]> = { operations: ['operations', 'owners'], supervisors: ['supervisors', 'owners'], owners: ['owners'] };
// Minutes an occurrence may stay open and unacknowledged before it escalates (engineering defaults, not approved targets).
export const ESCALATE_AFTER_MINUTES = { critical: 30, high: 240, normal: 1440 } as const;
// Reads re-evaluate at most this often unless the organisation or a patient record changed since the last evaluation.
export const EVALUATE_EVERY_SECONDS = 60;
export const INBOX_LIMIT = 30, CLEARED_DAYS = 7, MARK_READ_MAX = 50;
// Organisation-shared acknowledgements (operations and owner alerts) give one occurrence per organisation;
// supervisor acknowledgements are per person (6h), so each supervisor's view is its own occurrence.
export const scopeKeyFor = (owner: OwnerRole, userId: string) => owner === 'supervisors' ? userId : 'org';
export type ViewEntry = { userId: string; count: number; acknowledged: boolean };
export type Present = { alertId: keyof typeof ALERT_OWNERS; scopeKey: string; owner: OwnerRole; severity: Alert['severity']; title: string; recipients: ViewEntry[] };
export type OpenOccurrence = { id: string; alertId: string; scopeKey: string; owner: OwnerRole; severity: Alert['severity']; title: string; openedAt: string; escalatedAt: string | null };
export type Plan = {
  open: { alertId: string; scopeKey: string; owner: OwnerRole; severity: Alert['severity']; title: string }[];
  deliver: { alertId: string; scopeKey: string; userId: string; owner: OwnerRole; severity: Alert['severity']; title: string; count: number }[];
  close: string[];
  clear: string[];
  restore: string[];
  escalate: { occurrenceId: string; alertId: string; scopeKey: string; owner: OwnerRole; severity: Alert['severity']; title: string; toRole: 'owners'; reason: 'unacknowledged' | 'reopened'; recipients: string[]; detail: string }[];
};
export const key = (alertId: string, scopeKey: string) => `${alertId}|${scopeKey}`;
// Group each recipient's own alert view into occurrences. A member receives only alerts they own and see.
export function presentFrom(views: { member: Member; alerts: Alert[] }[]): Present[] {
  const out = new Map<string, Present>();
  for (const { member, alerts } of views) for (const a of alerts) {
    if (!canAcknowledge(member, a.owner)) continue;
    const scopeKey = scopeKeyFor(a.owner, member.userId), k = key(a.id, scopeKey);
    const p = out.get(k) ?? { alertId: a.id as keyof typeof ALERT_OWNERS, scopeKey, owner: a.owner, severity: a.severity, title: a.title, recipients: [] };
    p.recipients.push({ userId: member.userId, count: a.count, acknowledged: !!a.acknowledged });
    out.set(k, p);
  }
  return [...out.values()];
}
// Who receives a level of the ladder. Level 2 (owners) excludes the person whose own view raised a supervisor occurrence.
export function ladderRecipients(members: Member[], role: 'owners', scopeKey: string) {
  return members.filter(m => m.status === 'active' && (role === 'owners' && m.isOwner) && m.userId !== scopeKey).map(m => m.userId).sort();
}
// May this member see a notification of this level for this occurrence now? Checked on every inbox read and mark-read.
export function mayHold(m: Member | undefined | null, n: { level: number; owner: OwnerRole; scopeKey: string }) {
  if (!m || m.status !== 'active') return false;
  if (n.level === 1) return canAcknowledge(m, n.owner) && (n.owner !== 'supervisors' || n.scopeKey === m.userId);
  return m.isOwner;
}
export function planDelivery({ present, open, acknowledgements, members, now }: { present: Present[]; open: OpenOccurrence[]; acknowledgements: AlertAck[]; members: Member[]; now: string }): Plan {
  const plan: Plan = { open: [], deliver: [], close: [], clear: [], restore: [], escalate: [] };
  const live = new Map(present.map(p => [key(p.alertId, p.scopeKey), p]));
  for (const o of open) if (!live.has(key(o.alertId, o.scopeKey))) plan.close.push(o.id);
  const byKey = new Map(open.map(o => [key(o.alertId, o.scopeKey), o]));
  for (const p of present) {
    const o = byKey.get(key(p.alertId, p.scopeKey));
    if (!o) plan.open.push({ alertId: p.alertId, scopeKey: p.scopeKey, owner: p.owner, severity: p.severity, title: p.title });
    for (const r of p.recipients) plan.deliver.push({ alertId: p.alertId, scopeKey: p.scopeKey, userId: r.userId, owner: p.owner, severity: p.severity, title: p.title, count: r.count });
    if (!o) continue;
    // Organisation acknowledgements are shared: one recipient's view showing it applies clears the occurrence.
    const acknowledged = p.recipients.some(r => r.acknowledged);
    if (acknowledged) { plan.clear.push(o.id); continue; }
    plan.restore.push(o.id);
    if (o.escalatedAt) continue;
    const next = ESCALATION_LADDER[p.owner][1];
    if (!next) continue;
    const ackDuring = acknowledgements.some(k => k.alertId === p.alertId && (p.owner === 'supervisors' ? k.scope === 'user' && k.userId === p.scopeKey : k.scope === 'organisation') && k.at >= o.openedAt && k.at <= now);
    const overdue = Date.parse(now) - Date.parse(o.openedAt) >= ESCALATE_AFTER_MINUTES[p.severity] * 60000;
    if (!ackDuring && !overdue) continue;
    const reason = ackDuring ? 'reopened' as const : 'unacknowledged' as const;
    const raisedFor = p.owner === 'supervisors' ? members.find(m => m.userId === p.scopeKey)?.displayName ?? 'a supervisor' : null;
    const detail = `${reason === 'reopened' ? 'Re-opened after its acknowledgement stopped applying' : `Not acknowledged within ${ESCALATE_AFTER_MINUTES[p.severity] >= 60 ? `${ESCALATE_AFTER_MINUTES[p.severity] / 60} hours` : `${ESCALATE_AFTER_MINUTES[p.severity]} minutes`}`}; open since ${o.openedAt}. Owned by ${p.owner}${raisedFor ? ` (care scope of ${raisedFor})` : ''}. Open Operations to see what your own scope shows.`;
    plan.escalate.push({ occurrenceId: o.id, alertId: p.alertId, scopeKey: p.scopeKey, owner: p.owner, severity: p.severity, title: p.title, toRole: next as 'owners', reason, recipients: ladderRecipients(members, next as 'owners', p.scopeKey), detail });
  }
  return plan;
}
export const inboxSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('alertInboxMarkRead'), ids: z.array(z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/)).min(1).max(MARK_READ_MAX) }).strict()]);
