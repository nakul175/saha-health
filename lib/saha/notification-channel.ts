// Slice 10b: out-of-app notification channel, demonstration adapter only (BR-OPS-04, NFR-18, BR-CARE-04).
//
// Slice 6v shows operational alerts inside Saha only. This module adds an owner-managed channel for people who are not
// looking at Saha: recipient lists (named organisation members, the alert kinds each may receive, a tier and SMS or
// email), an owner-set escalation delay, and a planner that says which messages are due.
//
// The only adapter is a demonstration simulator. It runs in the synthetic and training environments and is refused
// everywhere else. It never contacts an address or a number: recipients carry no contact details at all, the simulator
// derives a label that cannot be dialled or delivered (`demo-xxxxxxxx`, `@simulator.invalid`), and what it "sent" is
// stored and shown inside Saha with a simulated receipt.
//
// Messages carry an alert title, a count and a fixed link path, never a patient name or identifier (BR-SEC-07, slice 6l).
// A count appears only when it comes from the recipient's own view of the alert (slice 6v), never from another care scope.
//
// `planNotifications` is a pure function of the stored settings, the open occurrences (slice 6v), the alert views and the
// messages already sent: the server calls it when alerts are evaluated, and a scheduled trigger may call the same
// evaluation without changing it. Nothing here imports the runtime, so every harness that transpiles `alerts` can list it.
import { z } from 'zod';
import { ALERT_OWNERS, canAcknowledge } from './alerts';
import type { Alert } from './alerts';
import type { Member, OrgState } from './types';
import type { Operations } from './operations';

export const CHANNEL_RULES_VERSION = '1.0.0';
// Environments in which the demonstration simulator may run (slice 6n: demoConnectors). The contract ties this to POLICY.
export const SIMULATOR_ENVIRONMENTS = ['synthetic', 'training'] as const;
export const CHANNELS = ['sms', 'email'] as const;
export type ChannelKind = typeof CHANNELS[number];
export type Tier = 1 | 2 | 3;
export const TIERS: readonly Tier[] = [1, 2, 3];
export type AlertId = keyof typeof ALERT_OWNERS;
export const ALERT_IDS = Object.keys(ALERT_OWNERS) as [AlertId, ...AlertId[]];
export type OwnerRole = 'operations' | 'supervisors' | 'owners';
export const MAX_RECIPIENTS = 30, MIN_ESCALATE_MINUTES = 5, MAX_ESCALATE_MINUTES = 1440, DEFAULT_ESCALATE_MINUTES = 30;
// A single evaluation sends at most this many messages; the rest follow at the next evaluation.
export const MAX_SENDS_PER_EVALUATION = 40, LOG_LIMIT = 100, HISTORY_LIMIT = 10, SMS_LIMIT = 160;
// Where a message points. A real channel would put the deployment's public address in front of it.
export const LINK = '/?view=operations';
export const PROVIDER = 'saha-demonstration-simulator';
export const SIMULATOR_NOTICE = 'Demonstration simulator. Messages are stored and shown inside Saha. Nothing is sent to any email address or phone number, and recipients hold no contact details.';

export type ChannelRecipient = { userId: string; tier: Tier; channel: ChannelKind; kinds: AlertId[] };
export type ChannelSummary = { version: number; enabled: boolean; escalateAfterMinutes: number; recipients: number; setBy: string; setAt: string; reason: string };
export type NotificationChannel = { version: number; enabled: boolean; escalateAfterMinutes: number; recipients: ChannelRecipient[]; setBy: string; setAt: string; reason: string; history: ChannelSummary[] };
export const channelOf = (s: Pick<OrgState, 'operations'>): NotificationChannel | undefined => (s.operations as (Operations & { notificationChannel?: NotificationChannel }) | undefined)?.notificationChannel;

export function simulatorRefusal(environment: string): string | null {
  return (SIMULATOR_ENVIRONMENTS as readonly string[]).includes(environment) ? null : `The demonstration notification simulator runs only in the synthetic and training environments; this deployment is ${environment}. No message is created.`;
}

const userId = z.string().min(1).max(200);
export const notificationChannelSchema = z.discriminatedUnion('type', [z.object({
  type: z.literal('setNotificationChannel'), version: z.number().int().min(0), enabled: z.boolean(),
  escalateAfterMinutes: z.number().int().min(MIN_ESCALATE_MINUTES, `Escalate after at least ${MIN_ESCALATE_MINUTES} minutes.`).max(MAX_ESCALATE_MINUTES, `Escalate after at most ${MAX_ESCALATE_MINUTES} minutes.`),
  recipients: z.array(z.object({ userId, tier: z.union([z.literal(1), z.literal(2), z.literal(3)]), channel: z.enum(CHANNELS), kinds: z.array(z.enum(ALERT_IDS)).min(1, 'Choose at least one alert kind for each recipient.').max(ALERT_IDS.length) }).strict()).max(MAX_RECIPIENTS, `At most ${MAX_RECIPIENTS} recipients.`),
  reason: z.string().trim().min(5, 'Explain the change in at least 5 characters.').max(500),
}).strict()]);
export type NotificationChannelCommand = z.infer<typeof notificationChannelSchema>;

// Why a member may not receive an alert occurrence (null = may). Mirrors slice 6v: the owning role of the alert, and for a
// supervisor alert the supervisor whose care scope raised it or an owner.
export function mayReceive(m: Member | undefined | null, alertId: AlertId, scopeKey: string): 'inactive' | 'role' | 'scope' | null {
  if (!m || m.status !== 'active') return 'inactive';
  const owner = ALERT_OWNERS[alertId] as OwnerRole;
  if (!canAcknowledge(m, owner)) return 'role';
  if (owner === 'supervisors' && m.userId !== scopeKey && !m.isOwner) return 'scope';
  return null;
}
// Alert kinds a member's current role may hold, for the owner screen and for validating a list.
export const kindsFor = (m: Member): AlertId[] => ALERT_IDS.filter(k => canAcknowledge(m, ALERT_OWNERS[k] as OwnerRole));

// Only an owner changes the channel (also checked again when an idempotent request is replayed).
export function authorizeChannelCommand(m: Member, c: { type: string }, fail: (status: number, message: string) => never) {
  if (c.type === 'setNotificationChannel' && !m.isOwner) fail(403, 'Only an organisation owner can change the notification channel.');
}
export function applyNotificationChannel(s: OrgState, input: unknown, u: { userId: string; displayName: string }, m: Member, environment: string, fail: (status: number, message: string) => never, uuid: () => string, now = new Date().toISOString()) {
  if ((input as any)?.type !== 'setNotificationChannel') return null;
  authorizeChannelCommand(m, input as { type: string }, fail);
  const refusal = simulatorRefusal(environment);
  if (refusal) fail(409, refusal);
  const parsed = notificationChannelSchema.safeParse(input);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid notification channel setting.');
  const c = parsed.data!, ops = (s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }) as Operations & { notificationChannel?: NotificationChannel };
  const current = ops.notificationChannel;
  if ((current?.version ?? 0) !== c.version) fail(409, 'The notification channel changed. Refresh and review it again.');
  const seen = new Set<string>();
  for (const r of c.recipients) {
    const member = s.members.find(x => x.userId === r.userId);
    if (seen.has(r.userId)) fail(422, 'List each member once.');
    seen.add(r.userId);
    if (!member || member.status !== 'active') fail(422, 'Recipients must be active members of this organisation.');
    if (new Set(r.kinds).size !== r.kinds.length) fail(422, 'List each alert kind once for a recipient.');
    const allowed = kindsFor(member!);
    const refused = r.kinds.filter(k => !allowed.includes(k));
    if (refused.length) fail(422, `${member!.displayName} (${member!.role}) may not receive ${refused.join(', ')}: that alert belongs to a role they do not hold.`);
  }
  if (c.enabled && !c.recipients.length) fail(422, 'Add at least one recipient before turning the channel on.');
  const same = !!current ? current.enabled === c.enabled && current.escalateAfterMinutes === c.escalateAfterMinutes && JSON.stringify(canonical(current.recipients)) === JSON.stringify(canonical(c.recipients)) : !c.enabled && !c.recipients.length && c.escalateAfterMinutes === DEFAULT_ESCALATE_MINUTES;
  if (same) fail(409, 'Nothing changed.');
  const version = (current?.version ?? 0) + 1;
  const prior: ChannelSummary[] = current ? [...current.history, { version: current.version, enabled: current.enabled, escalateAfterMinutes: current.escalateAfterMinutes, recipients: current.recipients.length, setBy: current.setBy, setAt: current.setAt, reason: current.reason }] : [];
  ops.notificationChannel = { version, enabled: c.enabled, escalateAfterMinutes: c.escalateAfterMinutes, recipients: canonical(c.recipients), setBy: u.userId, setAt: now, reason: c.reason, history: prior.slice(-HISTORY_LIMIT) };
  const tiers = TIERS.map(t => `${c.recipients.filter(r => r.tier === t).length} in tier ${t}`).join(', ');
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'setNotificationChannel', subject: s.organisation.id, detail: `Notification channel (demonstration simulator) ${c.enabled ? 'on' : 'off'}: ${c.recipients.length} recipients (${tiers}); an alert not acknowledged within ${c.escalateAfterMinutes} minutes goes to the next tier (setting version ${version}). Messages are simulated and stored in Saha; nothing is sent to any address or number. Reason: ${c.reason}` });
  return { version, enabled: c.enabled, recipients: c.recipients.length, escalateAfterMinutes: c.escalateAfterMinutes };
}
const canonical = (rs: ChannelRecipient[]): ChannelRecipient[] => [...rs].map(r => ({ userId: r.userId, tier: r.tier, channel: r.channel, kinds: ALERT_IDS.filter(k => r.kinds.includes(k)) })).sort((a, b) => a.tier - b.tier || a.userId.localeCompare(b.userId));

// ---- planning ---------------------------------------------------------------------------------------------------------
// Open occurrence as slice 6v stores it, and the alert views its recipients hold (slice 6v `presentFrom`).
export type ChannelOccurrence = { id: string; alertId: string; scopeKey: string; owner: OwnerRole; severity: Alert['severity']; title: string; openedAt: string };
export type ChannelPresent = { alertId: string; scopeKey: string; recipients: { userId: string; count: number; acknowledged: boolean }[] };
export type Rung = { index: number; tier: Tier; dueAt: string; recipients: { recipient: ChannelRecipient; member: Member }[] };
export type PlannedMessage = { key: string; occurrenceId: string; alertId: AlertId; scopeKey: string; tier: Tier; rung: number; userId: string; recipientName: string; channel: ChannelKind; reason: 'first' | 'escalation'; severity: Alert['severity']; title: string; count: number | null; subject: string | null; body: string; link: string; address: string; status: 'simulated-delivered'; receipt: Receipt; dueAt: string; sentAt: string };
export type Receipt = { receiptId: string; provider: typeof PROVIDER; status: 'simulated-delivered'; simulated: true; contacted: false; address: string; at: string };
export const messageKey = (occurrenceId: string, tier: number, userId: string) => `${occurrenceId}|${tier}|${userId}`;
// A small synchronous hash for labels and references only. It protects nothing.
export function label(text: string) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
// What the simulator calls a recipient. Neither form can be dialled or delivered: `.invalid` never resolves (RFC 2606).
export const demoAddress = (channel: ChannelKind, id: string) => channel === 'email' ? `demo-${label('addr:' + id)}@simulator.invalid` : `demo-sms-${label('addr:' + id)} (not a phone number)`;

// The ladder of one occurrence: distinct tiers among the recipients who may receive it now, lowest first. Rung i is due
// i x escalateAfterMinutes after Saha opened the occurrence. A tier with nobody eligible leaves no gap.
export function ladderFor(config: Pick<NotificationChannel, 'recipients' | 'escalateAfterMinutes'>, o: { alertId: string; scopeKey: string; openedAt: string }, members: Member[]): { rungs: Rung[]; skipped: { userId: string; why: 'inactive' | 'role' | 'scope' }[] } {
  const eligible: { recipient: ChannelRecipient; member: Member }[] = [], skipped: { userId: string; why: 'inactive' | 'role' | 'scope' }[] = [];
  for (const r of config.recipients) {
    if (!r.kinds.includes(o.alertId as AlertId)) continue;
    const member = members.find(m => m.userId === r.userId), why = mayReceive(member, o.alertId as AlertId, o.scopeKey);
    if (why) skipped.push({ userId: r.userId, why }); else eligible.push({ recipient: r, member: member! });
  }
  const tiers = [...new Set(eligible.map(e => e.recipient.tier))].sort((a, b) => a - b) as Tier[], opened = Date.parse(o.openedAt);
  return { rungs: tiers.map((tier, index) => ({ index, tier, dueAt: new Date(opened + index * config.escalateAfterMinutes * 60000).toISOString(), recipients: eligible.filter(e => e.recipient.tier === tier).sort((a, b) => a.member.userId.localeCompare(b.member.userId)) })), skipped };
}

const fit = (text: string, room: number) => text.length <= room ? text : text.slice(0, Math.max(0, room - 1)).trimEnd() + '…';
// The wording of one message. SMS is at most SMS_LIMIT characters. No patient name or identifier: the title is a fixed
// alert title, the count a number, the link a fixed path, the reference derived from the message key.
export function compose(m: { channel: ChannelKind; severity: Alert['severity']; title: string; count: number | null; tier: Tier; rung: number; minutes: number; ref: string; openedAt: string }): { subject: string | null; body: string } {
  const escalation = m.rung > 0 ? `Not acknowledged after ${m.rung * m.minutes} min; escalated to tier ${m.tier}.` : '';
  if (m.channel === 'sms') {
    const count = m.count === null ? '' : ` (${m.count})`, tail = `${escalation ? ' ' + escalation : ''} ${LINK} Ref ${m.ref}`, head = `Saha ${m.severity}: `;
    return { subject: null, body: head + fit(m.title, SMS_LIMIT - head.length - count.length - tail.length) + count + tail };
  }
  return {
    subject: `Saha ${m.severity} alert: ${m.title}`,
    body: [`Saha operational alert (demonstration simulator; this is not a real message).`, `Severity: ${m.severity}`, `Alert: ${m.title}`, m.count === null ? 'Count: not shown here. Open Saha to see the count in your own scope.' : `Count in your own view: ${m.count}`, escalation ? `Escalation: ${escalation} First raised ${m.openedAt}.` : `First notification for this alert (tier ${m.tier}).`, `Open: ${LINK}`, `Reference: ${m.ref}`, 'This message carries no patient names or identifiers.'].join('\n'),
  };
}

export type Plan = { refused: string | null; messages: PlannedMessage[]; pending: { occurrenceId: string; alertId: string; scopeKey: string; tier: Tier; dueAt: string }[]; skipped: { occurrenceId: string; userId: string; why: 'inactive' | 'role' | 'scope' }[] };
// Which messages are due now. Pure: no clock, no storage, no randomness.
//  - Nothing is planned when the channel is off, has no recipients, or the environment refuses the simulator.
//  - An occurrence still present in the alert views and not acknowledged in every owning member's own view sends rung i
//    (tier by tier, lowest first) once `now` reaches its due time; an acknowledged occurrence sends nothing more, and one
//    that re-opens carries on from where it stood (slice 6v).
//  - A message is keyed by occurrence, tier and recipient: anything already in `sent` is never planned again.
//  - A message that is late (Saha evaluates alerts when people use it) records when it was due and when it was sent.
export function planNotifications({ config, environment, occurrences, present, sent, members, now }: { config: NotificationChannel | undefined | null; environment: string; occurrences: ChannelOccurrence[]; present: ChannelPresent[]; sent: Set<string>; members: Member[]; now: string }): Plan {
  const plan: Plan = { refused: null, messages: [], pending: [], skipped: [] };
  if (!config?.enabled || !config.recipients.length) return plan;
  plan.refused = simulatorRefusal(environment);
  if (plan.refused) return plan;
  const live = new Map(present.map(p => [`${p.alertId}|${p.scopeKey}`, p])), at = Date.parse(now);
  for (const o of occurrences) {
    const p = live.get(`${o.alertId}|${o.scopeKey}`);
    if (!p || !(o.alertId in ALERT_OWNERS)) continue;
    if (p.recipients.length && p.recipients.every(r => r.acknowledged)) continue;
    const { rungs, skipped } = ladderFor(config, o, members);
    for (const s of skipped) plan.skipped.push({ occurrenceId: o.id, ...s });
    let waiting = false;
    for (const rung of rungs) {
      if (Date.parse(rung.dueAt) > at) { if (!waiting) plan.pending.push({ occurrenceId: o.id, alertId: o.alertId, scopeKey: o.scopeKey, tier: rung.tier, dueAt: rung.dueAt }); waiting = true; continue; }
      for (const { recipient, member } of rung.recipients) {
        const key = messageKey(o.id, rung.tier, recipient.userId);
        if (sent.has(key)) continue;
        // A count is only ever the recipient's own: a supervisor alert raised in someone else's care scope shows none.
        const count = p.recipients.find(r => r.userId === recipient.userId)?.count ?? null, ref = 'NC-' + label(key).slice(0, 6).toUpperCase();
        const text = compose({ channel: recipient.channel, severity: o.severity, title: o.title, count, tier: rung.tier, rung: rung.index, minutes: config.escalateAfterMinutes, ref, openedAt: o.openedAt }), address = demoAddress(recipient.channel, member.userId);
        plan.messages.push({ key, occurrenceId: o.id, alertId: o.alertId as AlertId, scopeKey: o.scopeKey, tier: rung.tier, rung: rung.index, userId: member.userId, recipientName: member.displayName, channel: recipient.channel, reason: rung.index === 0 ? 'first' : 'escalation', severity: o.severity, title: o.title, count, subject: text.subject, body: text.body, link: LINK, address, status: 'simulated-delivered', receipt: { receiptId: 'SIM-' + label(key + '|' + now).toUpperCase(), provider: PROVIDER, status: 'simulated-delivered', simulated: true, contacted: false, address, at: now }, dueAt: rung.dueAt, sentAt: now });
      }
    }
  }
  plan.messages.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.key.localeCompare(b.key));
  return plan;
}
// Alert kinds whose count is computed from the care scope of the person looking (slice 6v: care report, referrals,
// follow-ups). A count belongs to the recipient's own scope, so anyone else reading the message log sees the text without it.
export const CARE_SCOPED: readonly AlertId[] = ['destination-uncertain', 'ehr-uncertain', 'provider-usage-missing', 'referrals-overdue', 'followups-overdue', 'referrals-undated'];
export function redactFor<T extends { userId: string; alertId: string; count: number | null; body: string }>(m: T, viewerId: string): T & { redacted: boolean } {
  if (m.userId === viewerId || !(CARE_SCOPED as readonly string[]).includes(m.alertId)) return { ...m, redacted: false };
  return { ...m, count: null, body: m.body.replace(/ \(\d+\)(?= |$)/, '').replace(/Count in your own view: \d+/, 'Count: withheld (the recipient\'s own care scope)'), redacted: true };
}
