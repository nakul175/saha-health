import { z } from 'zod';
import { fail, uuid } from './core';
import { allowed } from './access';
import { operator, requireReporting } from './operations';
import { HELD_REMOVALS, mergedNow, removalDue, restrictedNow, type FieldLease, type RemovalReason, type RemovalReceipt } from './field';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 14e (R73; BR-REP-01, BR-SEC-03, BR-OFF-07): what the field notebook tells Saha about the device itself, and what Saha
// tells the notebook to remove from it.
//
// 1. Sync failure reports. The notebook counts its own failed sync steps on the device (step, error class, grant id, first and
//    last time) and sends the counts with its version when it is next online (POST /api/field-device). A report carries no
//    patient name, identifier, record content or free text; the only reference is the field grant id, which the server checks
//    belongs to the reporting worker and resolves to the patient itself, for scope. Reports are stored in `field_sync_reports`
//    (migration 0020) with one audit event per report, written like an access-audit commit, so a report never makes a
//    teammate's command conflict. Supervisors and owners see them on the Operations page; reports for a grant that is still
//    open are rows of the exception queue with the worker as owner and a recovery action for the error class.
// 2. Removal of device copies. When a copy is due for removal is decided in lib/saha/field.ts (`removalDue`: grant revoked, access
//    ended, record merged, or processing restricted and the grant can no longer sync). When the notebook next contacts Saha it
//    asks for its orders (GET /api/field-device), removes those drafts, their queued photos and voice notes and synced
//    registration copies from the device, and confirms with a receipt (counts only: drafts, of which unsynced, media items,
//    registrations). The receipt is stored on each grant it covers. A device that never contacts Saha again keeps its encrypted
//    copy: its grants stay pending and are listed as pending. Saha does not register devices, so a receipt means one notebook
//    of that worker confirmed; orders stay in force while due, and every notebook of the worker removes its copy when it
//    contacts Saha.
export const FIELD_DEVICE_RULES = '1.0.0';
export const NOTEBOOK_VERSION = /^[a-z0-9][a-z0-9.-]{0,39}$/;
export const SYNC_STEPS = ['workspace', 'registration', 'draft', 'media'] as const;
export const SYNC_ERROR_CLASSES = ['network', 'signed-out', 'refused-access', 'not-found', 'conflict', 'gone', 'invalid', 'maintenance', 'rate-limited', 'server-error', 'unconfirmed', 'grant-expired', 'device-copy-damaged'] as const;
export type SyncStep = typeof SYNC_STEPS[number];
export type SyncErrorClass = typeof SYNC_ERROR_CLASSES[number];
// Bounds: entries per report, the count one entry may carry, rows one worker may add in 24 hours, how old a failure may be,
// rows returned by a view, and grants kept on a patient record only because their device copy is still awaiting removal.
export const REPORT_ENTRIES = 20, REPORT_COUNT_MAX = 10000, REPORT_DAILY_ROWS = 200, REPORT_MAX_AGE_DAYS = 30, VIEW_ROWS = 200;
export const REMOVAL_LABEL: Record<RemovalReason, string> = { 'grant-revoked': 'field grant revoked', 'access-ended': 'the worker no longer has access to this patient', 'record-merged': 'record merged into another record', 'processing-restricted': 'processing restricted under a rights request' };
export type RegistrationRemoval = { at: string; receiptId: string; reason: RemovalReason };
export const RECOVERY: Record<SyncErrorClass, string> = {
  network: 'The device could not reach Saha. Nothing is lost on the device; the worker syncs again when connected.',
  'signed-out': 'The worker was not signed in. They sign in online and sync again; a pending sync keeps its operation key.',
  'refused-access': 'Saha refused the worker access to this record or action. Check the worker\'s membership and the patient\'s assignment.',
  'not-found': 'The record the notebook named no longer exists in this organisation. Review the patient online with the worker.',
  conflict: 'The server record changed or the grant is no longer current. The worker compares the draft with the server and renews the grant, or resolves it online.',
  gone: 'The item was removed on the server. Review it online with the worker.',
  invalid: 'Saha refused the content as invalid and saved nothing from it. The worker reviews the draft.',
  maintenance: 'The organisation was paused for maintenance. The worker syncs after it resumes.',
  'rate-limited': 'Too many requests. The worker waits, then syncs again.',
  'server-error': 'Saha did not answer. The worker retries with the same operation key; if it continues, an owner opens an incident.',
  unconfirmed: 'The outcome is unknown. The worker retries with the same operation key; the notebook never sends it as a new item.',
  'grant-expired': 'The 24-hour field grant expired before the draft synced. The worker compares the draft with the server and renews the grant.',
  'device-copy-damaged': 'A queued photo or voice note was missing or damaged on the device and was not sent. Ask the worker to capture it again if it is still needed.',
};

const at = z.string().datetime();
const count = z.number().int().min(0).max(1000);
export const syncReportSchema = z.object({
  kind: z.literal('sync-failures'), appVersion: z.string().regex(NOTEBOOK_VERSION),
  reports: z.array(z.object({ step: z.enum(SYNC_STEPS), errorClass: z.enum(SYNC_ERROR_CLASSES), grantId: z.string().uuid().nullable(), count: z.number().int().min(1).max(REPORT_COUNT_MAX), firstAt: at, lastAt: at }).strict()).min(1).max(REPORT_ENTRIES),
}).strict();
export const removalReceiptSchema = z.object({
  kind: z.literal('removal-receipt'), appVersion: z.string().regex(NOTEBOOK_VERSION), receiptId: z.string().uuid(), personId: z.string().min(1).max(200),
  leaseIds: z.array(z.string().uuid()).max(HELD_REMOVALS + 20), registration: z.boolean(),
  removed: z.object({ drafts: count, unsynced: count, media: count, registrations: count }).strict(),
}).strict().refine(c => c.removed.unsynced <= c.removed.drafts, 'Unsynced drafts are counted among the drafts removed.');
export const fieldDevicePostSchema = z.union([syncReportSchema, removalReceiptSchema]);
export type SyncReport = z.infer<typeof syncReportSchema>;
export type RemovalReceiptInput = z.infer<typeof removalReceiptSchema>;
export type SyncReportRow = { id: string; actor_id: string; person_id: string | null; lease_id: string | null; step: string; error_class: string; count: number; first_at: string; last_at: string; app_version: string; report_key: string; received_at: string; audit_id: string };

const DAY = 86400000;
const memberOf = (s: OrgState, userId: string) => s.members.find(x => x.userId === userId);
const nameOf = (s: OrgState, userId: string) => memberOf(s, userId)?.displayName ?? 'Former member';

// A reason that applies to every copy of the patient on the worker's devices (and so also to a synced registration copy).
function personReason(s: OrgState, p: Person, actorId: string, now: string): RemovalReason | null {
  if (mergedNow(p)) return 'record-merged';
  const m = memberOf(s, actorId);
  if (!m || !allowed(m, p, now)) return 'access-ended';
  return null;
}
// Since when a copy has been due, for display: the order, the merge, the restriction, or the latest handover after the grant.
export function dueSince(p: Person, l: FieldLease | null, reason: RemovalReason): string {
  const issued = l?.createdAt ?? p.fieldRegistration?.syncedAt ?? p.createdAt;
  if (reason === 'grant-revoked') return l?.removal?.orderedAt ?? issued;
  if (reason === 'record-merged') return p.mergedInto?.at ?? issued;
  if (reason === 'processing-restricted') return restrictedNow(p)?.from ?? issued;
  const handover = (p.assignmentHistory ?? []).filter(e => e.at >= issued).at(-1);
  return handover?.at ?? issued;
}

// The orders for one worker's notebooks: per patient, the grants (and the synced registration copy) whose device copies are
// due for removal. `scope: 'person'` means every copy of the patient in this organisation on the device (including drafts of
// grants no longer on the record); `scope: 'grant'` only the named grants. Patient ids are returned only for records this
// worker held a grant for or registered in the field; no name or record content is returned.
export type RemovalOrder = { personId: string; scope: 'person' | 'grant'; reason: RemovalReason; leaseIds: string[]; registration: boolean; since: string; confirmed: boolean };
export function removalOrders(s: OrgState, actorId: string, now = new Date().toISOString(), only?: string): RemovalOrder[] {
  const orders: RemovalOrder[] = [];
  for (const p of s.workspace.people) {
    if (only && p.id !== only) continue;
    const mine = (p.fieldLeases ?? []).filter(l => l.actorId === actorId), reg = p.fieldRegistration?.by === actorId;
    if (!mine.length && !reg) continue;
    const whole = personReason(s, p, actorId, now);
    if (whole) {
      const since = mine.length ? mine.map(l => dueSince(p, l, whole)).sort()[0] : dueSince(p, null, whole);
      orders.push({ personId: p.id, scope: 'person', reason: whole, leaseIds: mine.map(l => l.id), registration: reg, since, confirmed: mine.every(l => !!l.removal?.confirmedAt) && (!reg || !!p.fieldRegistration?.deviceRemoval) });
      continue;
    }
    const due = mine.filter(l => removalDue(s, p, l, now)), regDue = reg && !!restrictedNow(p);
    if (!due.length && !regDue) continue;
    const reason = due.length ? removalDue(s, p, due[0], now)! : 'processing-restricted';
    const since = due.length ? due.map(l => dueSince(p, l, removalDue(s, p, l, now)!)).sort()[0] : dueSince(p, null, 'processing-restricted');
    orders.push({ personId: p.id, scope: 'grant', reason, leaseIds: due.map(l => l.id), registration: regDue, since, confirmed: due.every(l => !!l.removal?.confirmedAt) && (!regDue || !!p.fieldRegistration?.deviceRemoval) });
  }
  return orders.sort((a, b) => Number(a.confirmed) - Number(b.confirmed) || b.since.localeCompare(a.since) || a.personId.localeCompare(b.personId)).slice(0, VIEW_ROWS);
}

// A notebook's receipt for one patient's copies: stored on each grant it covers (and on the field registration), with one
// audit event. Only grants of this worker that are due may be confirmed; anything else is refused and nothing is recorded.
export function applyRemovalReceipt(s: OrgState, u: Actor, m: Member, c: RemovalReceiptInput, now = new Date().toISOString()) {
  const refused = () => fail(409, 'Saha has no removal order for this record on your devices. Nothing was recorded.');
  const p = s.workspace.people.find(x => x.id === c.personId);if (!p) return refused();
  const order = removalOrders(s, u.userId, now, p.id)[0];if (!order) return refused();
  if (c.leaseIds.some(id => !order.leaseIds.includes(id)) || new Set(c.leaseIds).size !== c.leaseIds.length || (c.registration && !order.registration)) return refused();
  if (!c.leaseIds.length && !c.registration) fail(422, 'Name the grants or the registration copy this receipt confirms.');
  const receipt: RemovalReceipt = { id: c.receiptId, at: now, drafts: c.removed.drafts, unsynced: c.removed.unsynced, media: c.removed.media, registrations: c.removed.registrations, appVersion: c.appVersion };
  let first = 0;
  for (const l of p.fieldLeases ?? []) {
    if (!c.leaseIds.includes(l.id)) continue;
    const reason = removalDue(s, p, l, now) ?? order.reason;
    if (!l.removal?.confirmedAt) first++;
    l.removal = { ...(l.removal ?? {}), reason: l.removal?.confirmedAt ? l.removal.reason : reason, ...(l.removal?.confirmedAt ? {} : { confirmedAt: now, receipt }), receipts: (l.removal?.receipts ?? 0) + 1, lastReceiptAt: now };
    // The copy is gone from that device: nothing more can be synced under this grant.
    if (l.status === 'active') l.status = 'revoked';
  }
  if (c.registration && p.fieldRegistration && !p.fieldRegistration.deviceRemoval) { p.fieldRegistration.deviceRemoval = { at: now, receiptId: c.receiptId, reason: order.reason }; first++; }
  const what = `${c.removed.drafts} draft${c.removed.drafts === 1 ? '' : 's'} (${c.removed.unsynced} not synced), ${c.removed.media} photo or voice note${c.removed.media === 1 ? '' : 's'} and ${c.removed.registrations} registration cop${c.removed.registrations === 1 ? 'y' : 'ies'}`;
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'confirmFieldRemoval', subject: p.id, personId: p.id,
    detail: `Field notebook (version ${c.appVersion}) confirmed removing this record's copies from the device (${REMOVAL_LABEL[order.reason]}): ${what}. Grants ${c.leaseIds.map(x => x.slice(0, 8)).join(', ') || 'none'}${c.registration ? ' and the field registration copy' : ''}. Receipt ${c.receiptId}.${c.removed.unsynced ? ' Observations not yet synced were discarded on the device and cannot be recovered.' : ''} Other browsers or devices of this worker remove their copies when they contact Saha.` });
  return { personId: p.id, confirmed: c.leaseIds, registration: c.registration, firstConfirmation: first > 0, unsynced: c.removed.unsynced };
}

// Validates a sync failure report against this worker's grants and returns the rows to store and the audit detail.
export function syncReportRows(s: OrgState, actorId: string, c: SyncReport, key: string, auditId: string, now = new Date().toISOString()) {
  const grants = new Map<string, { p: Person; l: FieldLease }>();
  for (const p of s.workspace.people) for (const l of p.fieldLeases ?? []) if (l.actorId === actorId) grants.set(l.id, { p, l });
  const rows: SyncReportRow[] = [], late = Date.parse(now) + 300000, early = Date.parse(now) - REPORT_MAX_AGE_DAYS * DAY;
  c.reports.forEach((r, i) => {
    if (r.firstAt > r.lastAt || Date.parse(r.lastAt) > late || Date.parse(r.firstAt) < early) fail(422, `Each failure needs a first time before its last time, within the last ${REPORT_MAX_AGE_DAYS} days and not in the future. Nothing was recorded.`);
    const g = r.grantId ? grants.get(r.grantId) : null;
    if (r.grantId && !g) fail(422, 'A reported grant is not one of your field grants in this organisation. Nothing was recorded.');
    rows.push({ id: `${auditId}:${i}`, actor_id: actorId, person_id: g?.p.id ?? null, lease_id: r.grantId, step: r.step, error_class: r.errorClass, count: r.count, first_at: r.firstAt, last_at: r.lastAt, app_version: c.appVersion, report_key: key, received_at: now, audit_id: auditId });
  });
  const classes = new Map<string, number>();for (const r of c.reports) classes.set(r.errorClass, (classes.get(r.errorClass) ?? 0) + r.count);
  const detail = `Field notebook (version ${c.appVersion}) reported ${c.reports.length} sync failure entr${c.reports.length === 1 ? 'y' : 'ies'}: ${[...classes].map(([k, n]) => `${k} ${n}`).join(', ')}; steps ${[...new Set(c.reports.map(r => r.step))].join(', ')}; ${new Set(rows.map(r => r.lease_id).filter(Boolean)).size} field grant${rows.filter(r => r.lease_id).length === 1 ? '' : 's'}. The report carries no patient details or free text.`;
  return { rows, detail };
}

// Exception-queue rows for one patient (slice 6i rules 1.4.0): device copies awaiting removal, and sync failures a notebook
// reported for a grant that is still open.
export type FieldExceptionRow = { id: string; kind: 'field-copy-removal' | 'field-sync-failure'; severity: 'high' | 'normal'; what: string; since: string; owner: string; recovery: string };
export function fieldDeviceExceptions(s: OrgState, p: Person, reports: readonly SyncReportRow[], now: string): FieldExceptionRow[] {
  const rows: FieldExceptionRow[] = [];
  for (const l of p.fieldLeases ?? []) {
    const reason = l.removal?.confirmedAt ? null : removalDue(s, p, l, now);
    if (reason) rows.push({ id: 'field-copy-removal:' + l.id, kind: 'field-copy-removal', severity: 'normal', what: `Device copy awaiting removal from ${nameOf(s, l.actorId)}'s field notebook: ${REMOVAL_LABEL[reason]}`, since: dueSince(p, l, reason), owner: nameOf(s, l.actorId),
      recovery: 'The notebook removes the copy and confirms with a receipt the next time it contacts Saha online. A device that never reconnects keeps its encrypted copy until the notebook is deleted on that device: ask the worker to open the notebook online.' });
    const open = l.status === 'active' && l.expiresAt > now && !reason, mine = open ? reports.filter(r => r.lease_id === l.id) : [];
    if (mine.length) {
      const total = mine.reduce((n, r) => n + r.count, 0), latest = [...mine].sort((a, b) => b.last_at.localeCompare(a.last_at))[0];
      rows.push({ id: 'field-sync-failure:' + l.id, kind: 'field-sync-failure', severity: 'normal', what: `Field notebook reported ${total} failed sync attempt${total === 1 ? '' : 's'} for this grant (latest: ${latest.error_class}, ${latest.step})`, since: mine.map(r => r.first_at).sort()[0], owner: nameOf(s, l.actorId), recovery: RECOVERY[latest.error_class as SyncErrorClass] ?? RECOVERY.unconfirmed });
    }
  }
  return rows;
}

// The Operations view of field devices for supervisors and operations members: device copies pending or confirmed removal,
// and reported sync failures. A row is shown when the viewer may see the patient, supervises the worker's team, or is an
// operations member; the patient is named only to a viewer who may see the patient.
export function fieldDeviceView(s: OrgState, m: Member, reports: readonly SyncReportRow[], now = new Date().toISOString()) {
  requireReporting(m);if (m.status !== 'active') fail(403, 'Your membership is inactive.');
  const ops = operator(m), people = new Map(s.workspace.people.map(p => [p.id, p]));
  const sees = (p: Person) => m.role !== 'admin' && allowed(m, p, now);
  const teamOf = (userId: string) => { const w = memberOf(s, userId);return !!w && w.teamIds.some(t => m.teamIds.includes(t)); };
  const visible = (p: Person | undefined, actorId: string) => ops || teamOf(actorId) || (!!p && sees(p));
  const patient = (p: Person | undefined) => p && sees(p) ? { id: p.id, name: p.name } : null;
  type RemovalRow = { id: string; copy: 'grant' | 'registration'; grant: string | null; worker: string; state: 'pending' | 'confirmed'; reason: RemovalReason; since: string; confirmedAt: string | null; receipt: RemovalReceipt | { id: string; at: string } | null; receipts: number; grantState: string | null; patient: { id: string; name: string } | null };
  const removals: RemovalRow[] = [], recent = Date.parse(now) - REPORT_MAX_AGE_DAYS * DAY;
  for (const p of s.workspace.people) {
    for (const l of p.fieldLeases ?? []) {
      const reason = l.removal?.confirmedAt ? null : removalDue(s, p, l, now), done = l.removal?.confirmedAt;
      if (!reason && !(done && Date.parse(done) >= recent)) continue;
      if (!visible(p, l.actorId)) continue;
      removals.push({ id: l.id, copy: 'grant', grant: l.id.slice(0, 8), worker: nameOf(s, l.actorId), state: reason ? 'pending' : 'confirmed', reason: reason ?? l.removal!.reason, since: dueSince(p, l, reason ?? l.removal!.reason), confirmedAt: done ?? null, receipt: l.removal?.receipt ?? null, receipts: l.removal?.receipts ?? 0, grantState: l.status, patient: patient(p) });
    }
    const r = p.fieldRegistration;
    if (r) {
      const reason = r.deviceRemoval ? null : personReason(s, p, r.by, now) ?? (restrictedNow(p) ? 'processing-restricted' : null), done = r.deviceRemoval?.at;
      if ((reason || (done && Date.parse(done) >= recent)) && visible(p, r.by)) removals.push({ id: 'registration:' + p.id, copy: 'registration', grant: null, worker: nameOf(s, r.by), state: reason ? 'pending' : 'confirmed', reason: reason ?? r.deviceRemoval!.reason, since: dueSince(p, null, reason ?? r.deviceRemoval!.reason), confirmedAt: done ?? null, receipt: r.deviceRemoval ? { id: r.deviceRemoval.receiptId, at: r.deviceRemoval.at } : null, receipts: r.deviceRemoval ? 1 : 0, grantState: null, patient: patient(p) });
    }
  }
  removals.sort((a, b) => (a.state === b.state ? 0 : a.state === 'pending' ? -1 : 1) || (a.state === 'pending' ? a.since.localeCompare(b.since) : (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? '')) || a.id.localeCompare(b.id));
  const leases = new Map<string, FieldLease>();for (const p of s.workspace.people) for (const l of p.fieldLeases ?? []) leases.set(l.id, l);
  const failures = reports.filter(r => visible(r.person_id ? people.get(r.person_id) : undefined, r.actor_id)).map(r => {
    const l = r.lease_id ? leases.get(r.lease_id) : undefined;
    return { id: r.id, worker: nameOf(s, r.actor_id), grant: r.lease_id?.slice(0, 8) ?? null, grantState: l ? (l.status === 'active' && l.expiresAt <= now ? 'expired' : l.status) : r.lease_id ? 'no longer on record' : null, patient: patient(r.person_id ? people.get(r.person_id) : undefined), step: r.step, errorClass: r.error_class, count: r.count, firstAt: r.first_at, lastAt: r.last_at, appVersion: r.app_version, receivedAt: r.received_at, recovery: RECOVERY[r.error_class as SyncErrorClass] ?? RECOVERY.unconfirmed };
  });
  return {
    rules: FIELD_DEVICE_RULES, generatedAt: now,
    scope: ops ? 'Every field notebook in this organisation; patients are named only where your care scope includes them.' : 'Field notebooks of workers in your teams and of patients in your care scope; patients are named only where your care scope includes them.',
    removals: { pending: removals.filter(r => r.state === 'pending').length, confirmed: removals.filter(r => r.state === 'confirmed').length, items: removals.slice(0, VIEW_ROWS), truncated: removals.length > VIEW_ROWS },
    syncFailures: { total: failures.length, items: failures.slice(0, VIEW_ROWS), truncated: failures.length > VIEW_ROWS, windowDays: REPORT_MAX_AGE_DAYS },
    limits: 'Removal is confirmed by a notebook when it contacts Saha. A device that never reconnects keeps its encrypted copy and stays pending here. Saha does not register devices: a receipt means one notebook of that worker confirmed, and another browser of the same worker removes its copy when it contacts Saha. Sync failures are counts the notebook sends when it is next online; failures on a device that never reconnects are never reported.',
  };
}
