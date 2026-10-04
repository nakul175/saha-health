import { z } from 'zod';
import { digest, fail, person, uuid } from './core';
import { normallyAllowed } from './access';
import { abdmIntegration } from './abdm';
import { operationRefusal } from './adapter-operations';
import type { Actor } from './store';
import type { Integration, Member, OrgState, Person } from './types';

// Slice 14e (R91; BR-SEC-03): telling each destination that received a person's data that the person withdrew the sharing
// permission, with the outcome recorded per destination. Slice 6o stops everything unsent and lists what already left Saha;
// this adds one notice per destination that holds (or may hold) the person's records:
//   - a programme destination with an accepted, sending or uncertain submission of the person;
//   - an EHR connection with an accepted, running or uncertain publication of the person;
//   - the (mock) ABDM gateway when the withdrawal revoked consent artefacts, or care contexts are linked, or records were
//     delivered through it.
// A notice carries no record content: the destination's own delivery keys and receipts, the time of the withdrawal and the
// permission version. It is created with the withdrawal and then follows the destination's own path:
//   - demonstration programme destinations ("simulator"): a care worker with normal access sends the exact stored payload,
//     quoting the notice version they reviewed (the approval; the SHA-256 of what was sent is kept); the maternal register
//     acknowledges with its own receipt; the community MIS stores it but loses the response, so the notice is uncertain and
//     only a receipt lookup resolves it, never a second send;
//   - the mock ABDM gateway ("gateway-record"): the revocation is recorded with the mock consent manager when the gateway's
//     delete operation is permitted (as `abdmConsentRevoke` does; no ABDM service is contacted in this release); otherwise
//     it is a manual notice;
//   - HTTP programme connections and EHR connections ("manual"): this release has no consent-withdrawal message for them,
//     so a named care worker tells the destination through its own process and records how (a reference and a note).
// A notice can also be closed as not required, with a reason. An uncertain notice cannot be closed by hand.
//
// Seam for slice 14c (draft PR #155, withdrawal of submissions and EHR publications through prepare, approve, execute and
// lookup): `noticePath` is the one switch. When 14c is merged, HTTP programme connections and EHR connections should send
// this notice through 14c's checkpointed execution (`lib/saha/withdrawal-execution.ts`) as a further operation
// (`saha-mis-v1` operation `consent-withdrawn`; for EHR a notice document like 14c's withdrawal notice, with a consent
// reason), gated by the destination's operation setting, instead of the manual path. Nothing here duplicates that
// execution: the simulator answers in process and no external request is made by this module.
export const NOTICE_CONTRACT = 'saha-mis-v1';
export const NOTICE_LOOKUP_LIMIT = 24, NOTICE_EVENT_LIMIT = 30, NOTICE_HOLD_LIMIT = 20, NOTICE_LIMIT = 100;
export type NoticeState = 'due' | 'uncertain' | 'acknowledged' | 'recorded' | 'manual' | 'told' | 'not-required';
export type NoticePath = 'simulator' | 'gateway-record' | 'manual';
export const NOTICE_OPEN: readonly NoticeState[] = ['due', 'uncertain', 'manual'];
export type NoticeHold = { kind: 'programme-submission' | 'ehr-publication' | 'abdm-consent' | 'abdm-care-context' | 'abdm-transfer'; ref: string; state: string; receipt?: string; key?: string };
export type WithdrawalNotice = {
  id: string; version: number; purpose: 'exchange'; permissionVersion: number; withdrawnAt: string; createdAt: string; updatedAt: string;
  destination: { kind: 'programme' | 'ehr' | 'abdm'; id: string; name: string; mode: 'demo' | 'http' | 'mock' };
  holds: NoticeHold[]; omittedHolds?: number; path: NoticePath; state: NoticeState; message: string;
  payload?: Record<string, unknown>; payloadHash?: string; attempts: number; lookups: number; receipt?: string;
  outcome?: { by: string; byName: string; at: string; reference: string; note: string };
  events: { at: string; state: NoticeState; detail: string; by?: string }[];
};
// Stored on the patient record (patients.data) as `withdrawalNotices`. Declared here rather than in types.ts' Person so this
// slice merges beside slice 14b's change to that line; Person is assignable to it because the field is optional.
export type NoticeHolder = Person & { withdrawalNotices?: WithdrawalNotice[] };
export const withdrawalNoticesOf = (p: Person): WithdrawalNotice[] => (p as NoticeHolder).withdrawalNotices ?? [];

const id = z.string().trim().min(1).max(200), version = z.number().int().positive();
export const noticeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sendWithdrawalNotice'), personId: id, noticeId: id, version }).strict(),
  z.object({ type: z.literal('lookupWithdrawalNotice'), personId: id, noticeId: id, version }).strict(),
  z.object({ type: z.literal('recordWithdrawalNotice'), personId: id, noticeId: id, version, outcome: z.enum(['told', 'not-required']), reference: z.string().trim().min(3, 'Give a reference of at least 3 characters.').max(200), note: z.string().trim().min(10, 'Write at least 10 characters.').max(1000) }).strict(),
]);
export const NOTICE_TYPES = new Set(['sendWithdrawalNotice', 'lookupWithdrawalNotice', 'recordWithdrawalNotice']);

const day = (s?: string) => (s ?? '').slice(0, 10);
// The path a destination's notice follows in this release (see the slice 14c seam above).
export function noticePath(kind: WithdrawalNotice['destination']['kind'], i: Integration | undefined): NoticePath {
  if (kind === 'programme' && i?.kind === 'mis' && i.mode === 'demo') return 'simulator';
  if (kind === 'abdm') return 'gateway-record';
  return 'manual';
}
function event(n: WithdrawalNotice, at: string, state: NoticeState, detail: string, by?: string) {
  n.version++;n.state = state;n.message = detail;n.updatedAt = at;n.events.push({ at, state, detail, ...(by ? { by } : {}) });
  if (n.events.length > NOTICE_EVENT_LIMIT) n.events.splice(1, n.events.length - NOTICE_EVENT_LIMIT);
}
const bounded = (holds: NoticeHold[]) => ({ holds: holds.slice(0, NOTICE_HOLD_LIMIT), ...(holds.length > NOTICE_HOLD_LIMIT ? { omittedHolds: holds.length - NOTICE_HOLD_LIMIT } : {}) });

// What each destination holds of the person, by destination. Run after the slice 6o withdrawal changed the record, so EHR
// permissions and ABDM consents are already revoked and unsent deliveries cancelled.
function destinations(s: OrgState, p: Person, revokedConsents: string[]) {
  const out = new Map<string, { kind: WithdrawalNotice['destination']['kind']; id: string; name: string; mode: WithdrawalNotice['destination']['mode']; holds: NoticeHold[] }>();
  const add = (key: string, d: Omit<NonNullable<ReturnType<typeof out.get>>, 'holds'>, h: NoticeHold) => { const x = out.get(key) ?? { ...d, holds: [] };x.holds.push(h);out.set(key, x); };
  for (const x of s.workspace.submissions) {
    if (x.personId !== p.id || !['accepted', 'sending', 'uncertain'].includes(x.state)) continue;
    const i = s.workspace.integrations.find(y => y.id === x.connectorId);
    add('programme:' + x.connectorId, { kind: 'programme', id: x.connectorId, name: i?.name ?? x.connectorName, mode: x.mode === 'http' ? 'http' : 'demo' }, { kind: 'programme-submission', ref: x.id, state: x.state, ...(x.receipt ? { receipt: x.receipt } : {}), key: x.delivery?.key ?? x.id });
  }
  for (const o of p.ehr?.operations ?? []) {
    if (!['accepted', 'running', 'uncertain'].includes(o.state)) continue;
    const link = p.ehr?.links.find(l => l.id === o.linkId), i = link ? s.workspace.integrations.find(y => y.id === link.integrationId) : undefined;
    add('ehr:' + (i?.id ?? o.linkId), { kind: 'ehr', id: i?.id ?? o.linkId, name: i?.name ?? 'EHR connection', mode: 'http' }, { kind: 'ehr-publication', ref: o.id, state: o.state, ...(o.receipt ? { receipt: o.receipt } : {}) });
  }
  const gw = abdmIntegration(s), gateway = { kind: 'abdm' as const, id: gw?.id ?? 'abdm-mock', name: gw?.name ?? 'ABDM gateway (mock)', mode: 'mock' as const };
  for (const c of p.abdmConsents ?? []) if (revokedConsents.includes(c.id)) add('abdm', gateway, { kind: 'abdm-consent', ref: c.id, state: 'REVOKED' });
  for (const c of p.careContexts ?? []) add('abdm', gateway, { kind: 'abdm-care-context', ref: c.id, state: 'linked' });
  for (const t of p.abdmTransfers ?? []) if (t.state === 'delivered') add('abdm', gateway, { kind: 'abdm-transfer', ref: t.id, state: t.state });
  return [...out.values()];
}
export function noticePayload(n: Pick<WithdrawalNotice, 'id' | 'withdrawnAt' | 'permissionVersion' | 'holds'>) {
  return { contract: NOTICE_CONTRACT, environment: 'synthetic', operation: 'consent-withdrawn', noticeId: n.id, purpose: 'external-record-sharing', withdrawnAt: n.withdrawnAt, permissionVersion: n.permissionVersion, notifies: n.holds.filter(h => h.kind === 'programme-submission').map(h => ({ submissionKey: h.key, ...(h.receipt ? { receipt: h.receipt } : {}) })) };
}

// Called from the slice 6o sharing withdrawal (consent.ts `exchange`) after it has changed the record. One notice per
// destination; an open notice to the same destination is brought up to date instead of adding a second one (its payload
// is rebuilt and its version moves, so an earlier review no longer matches), except an uncertain one, which must be looked
// up first.
export function createWithdrawalNotices(s: OrgState, p: Person, now: string, revokedConsents: string[]) {
  const holder: NoticeHolder = p, list = holder.withdrawalNotices ??= [], made: WithdrawalNotice[] = [];
  for (const d of destinations(s, p, revokedConsents)) {
    const i = d.kind === 'abdm' ? abdmIntegration(s) : s.workspace.integrations.find(x => x.id === d.id), path = noticePath(d.kind, i);
    const open = list.find(n => n.destination.kind === d.kind && n.destination.id === d.id && (n.state === 'due' || n.state === 'manual'));
    const n: WithdrawalNotice = open ?? { id: uuid(), version: 0, purpose: 'exchange', permissionVersion: p.consentVersion, withdrawnAt: now, createdAt: now, updatedAt: now, destination: { kind: d.kind, id: d.id, name: d.name, mode: d.mode }, holds: [], path, state: 'due', message: '', attempts: 0, lookups: 0, events: [] };
    Object.assign(n, { permissionVersion: p.consentVersion, withdrawnAt: now, path, ...bounded(d.holds) });if (!n.omittedHolds) delete n.omittedHolds;
    const what = `${d.holds.length} record${d.holds.length === 1 ? '' : 's'}`;
    if (path === 'simulator') { n.payload = noticePayload(n);delete n.payloadHash;event(n, now, 'due', `${open ? 'Updated by a later withdrawal. ' : ''}Notice to ${d.name} prepared (${what}): send it from the patient's withdrawal notices. It carries the destination's delivery keys and receipts only, no record content.`); }
    else if (path === 'gateway-record') {
      const told = !i || !operationRefusal(i, 'delete', 'patient');delete n.payload;delete n.payloadHash;
      if (told) event(n, now, 'recorded', `Withdrawal recorded with the mock ABDM consent manager (${what}): consent artefacts revoked, so further fetches under them are refused. No ABDM service is contacted in this release. Linked care contexts stay linked; unlinking is not available in this build.`);
      else event(n, now, 'manual', `The mock gateway's delete operation is withdrawn, so the gateway was not told (${what}). Tell the consent manager through its own process and record how.`);
    } else { delete n.payload;delete n.payloadHash;event(n, now, 'manual', `${open ? 'Updated by a later withdrawal. ' : ''}${d.name} holds ${what} of this person. This release has no consent-withdrawal message for ${d.kind === 'ehr' ? 'EHR connections' : 'HTTP programme connections'}: tell the destination through its own process and record how. Nothing more is sent to it under the withdrawn permission.`); }
    if (!open) list.push(n);made.push(n);
  }
  // Keep the newest NOTICE_LIMIT notices; only closed ones are dropped (the record revisions keep every earlier version).
  while (list.length > NOTICE_LIMIT) { const i = list.findIndex(n => !NOTICE_OPEN.includes(n.state));if (i < 0) break;list.splice(i, 1); }
  return made;
}

// An ASHA or clinician with normal (not emergency-only) access to the patient acts on a notice; owner authority does not
// replace patient scope, and supervisors and administrators are refused.
export function authorizeWithdrawalNotice(s: OrgState, m: Member, c: any) {
  if (!NOTICE_TYPES.has(c?.type) || typeof c.personId !== 'string') return;
  const p = person(s.workspace, c.personId);
  if (!['asha', 'clinician'].includes(m.role) || m.status !== 'active' || !normallyAllowed(m, p)) fail(403, 'A care worker (ASHA or clinician) with normal access to this patient sends, looks up and records withdrawal notices.');
}
export async function applyWithdrawalNotice(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): Promise<any | null> {
  if (!NOTICE_TYPES.has((input as any)?.type)) return null;
  const parsed = noticeSchema.safeParse(input);if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid withdrawal notice command.');
  const c = parsed.data;authorizeWithdrawalNotice(s, m, c);
  const p = person(s.workspace, c.personId), n = withdrawalNoticesOf(p).find(x => x.id === c.noticeId);if (!n) fail(404, 'Withdrawal notice not found for this patient.');
  if (n.version !== c.version) fail(409, 'This notice changed since you opened it. Refresh and review it again.');
  const i = s.workspace.integrations.find(x => x.id === n.destination.id);let detail = '', result: any;
  if (c.type === 'sendWithdrawalNotice') {
    if (n.path !== 'simulator') fail(409, 'This destination has no notice message in this release. Tell it through its own process and record how.');
    if (n.state === 'uncertain') fail(409, 'This notice was sent and its outcome is unknown. Look up its receipt; it is never sent again.');
    if (n.state !== 'due') fail(409, `This notice is already ${n.state}.`);
    if (!n.payload) fail(409, 'This notice has no message to send. Record how the destination was told by hand.');
    if (!i || i.kind !== 'mis' || i.mode !== 'demo') fail(409, 'The destination connection changed. Record the notice outcome by hand.');
    if (i.status !== 'active') fail(409, `${i.name} is not active. Record how it was told by hand, or send after it is active again.`);
    n.attempts++;n.payloadHash = await digest(n.payload);
    if (i.behavior === 'uncertain') { event(n, now, 'uncertain', `${i.name} stored the notice, but its response was lost. Look up the receipt; the notice is never sent again.`, u.userId);detail = `Withdrawal notice sent to ${i.name} (simulator); response lost, outcome unknown.`; }
    else { n.receipt = `SIM-N-${uuid().slice(0, 8).toUpperCase()}`;event(n, now, 'acknowledged', `${i.name} acknowledged the withdrawal notice with receipt ${n.receipt}. It keeps its copies under its own retention rules; Saha sends it nothing more under the withdrawn permission.`, u.userId);detail = `Withdrawal notice acknowledged by ${i.name} (simulator), receipt ${n.receipt}.`; }
  } else if (c.type === 'lookupWithdrawalNotice') {
    if (n.state !== 'uncertain') fail(409, 'Only a notice with an unknown outcome is looked up.');
    if (n.lookups >= NOTICE_LOOKUP_LIMIT) fail(409, 'The lookup limit for this notice is reached. Reconcile with the destination and record the outcome with its reference.');
    if (!i || i.kind !== 'mis' || i.mode !== 'demo') fail(409, 'The destination connection changed. Reconcile with the destination.');
    { const refused = operationRefusal(i, 'lookup', 'none');if (refused) fail(409, refused + ' The outcome stays unknown; the notice is not sent again.'); }
    n.lookups++;n.receipt = `SIM-N-${n.id.slice(0, 8).toUpperCase()}`;
    event(n, now, 'acknowledged', `Receipt ${n.receipt} found by lookup: ${i.name} holds the withdrawal notice. It was not sent again.`, u.userId);detail = `Withdrawal notice receipt found by lookup at ${i.name}: ${n.receipt}; sent once (${n.attempts} attempt).`;
  } else {
    if (n.state === 'uncertain') fail(409, 'This notice was sent and its outcome is unknown. Look up its receipt before recording anything by hand.');
    if (!['due', 'manual'].includes(n.state)) fail(409, `This notice is already ${n.state}.`);
    if (c.outcome === 'told' && n.state !== 'manual') fail(409, 'Send this notice to the destination; recording it as told by hand is for destinations without a notice message.');
    n.outcome = { by: u.userId, byName: u.displayName, at: now, reference: c.reference, note: c.note };
    event(n, now, c.outcome, c.outcome === 'told' ? `Recorded as told through ${n.destination.name}'s own process (reference ${c.reference}): ${c.note}` : `Recorded as not required (reference ${c.reference}): ${c.note}`, u.userId);
    detail = `Withdrawal notice to ${n.destination.name} recorded as ${c.outcome}; reference ${c.reference}.`;
  }
  result = { noticeId: n.id, version: n.version, state: n.state, ...(n.receipt ? { receipt: n.receipt } : {}), attempts: n.attempts };
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: n.id, personId: p.id, detail });
  return result;
}

// Exception-queue rows (slice 6i rules 1.4.0) for a patient's open notices.
export function noticeExceptions(p: Person, team: string) {
  return withdrawalNoticesOf(p).filter(n => NOTICE_OPEN.includes(n.state)).map(n => ({
    id: 'withdrawal-notice:' + n.id, kind: 'withdrawal-notice' as const, severity: n.state === 'uncertain' ? 'high' as const : 'normal' as const,
    what: `${n.destination.name}: sharing withdrawal of ${day(n.withdrawnAt)} ${n.state === 'due' ? 'not yet sent' : n.state === 'uncertain' ? 'sent, outcome unknown' : 'to be told through its own process'}`,
    since: n.withdrawnAt, owner: `Care workers of ${team}`,
    recovery: n.state === 'due' ? 'A care worker sends the notice from the patient\'s withdrawal notices; it carries no record content.' : n.state === 'uncertain' ? 'Look up the notice\'s receipt; it is never sent again.' : 'Tell the destination through its own process, then record how with a reference.',
  }));
}
