import type { D1Database } from '@cloudflare/workers-types';
import { AppError, fail, uuid } from './core';
import { ACCESS_AUDIT } from './audit-chain';
import { exceptionalGrant, normallyAllowed } from './access';
import { persist, type Actor } from './store';
import type { Audit, Member, OrgState, Person } from './types';
export { ACCESS_ACTION_NAMES } from './types';
// Slice 6t: material reads and external requests are recorded in the organisation's audit hash chain
// before the content is returned or the request is sent (BR-SEC-08, NFR-10).
//
// One event per access. It goes through `persist` (so it is chained under the same unique sequence as
// every other event) as an access-audit commit: it appends the event only — no record rows, no command
// receipt — and does not move the organisation or patient revisions, so a read never makes a teammate's
// command conflict and never refreshes anyone's workspace. The event holds identifiers, counts and the
// route of access, never clinical content (no facts, notes, names, media bytes or document text).
//
// Fail closed: if the event cannot be written, the caller does not return the content or send the
// request, and the person sees ACCESS_REFUSED. This applies to every access listed in ACCESS_ACTIONS.
export const ACCESS_ACTIONS = {
  viewPatientRecord: 'Full patient record opened (paged workspace).',
  viewRecordHistory: 'Revision history read.',
  viewMedia: 'Visit media opened.',
  viewExternalRecords: 'Received external (ABDM) records listed.',
  downloadFhir: 'FHIR document downloaded.',
  externalRequest: 'Request to an external system recorded before it is sent.',
  // Slice 6w: an indicator CSV export is recorded the same way, so exporting does not move the organisation revision.
  indicatorExport: 'Indicator results exported as CSV (small cells suppressed).',
} as const;
export type AccessAction = keyof typeof ACCESS_ACTIONS;
export const ACCESS_REFUSED = 'Saha could not record this access in the audit log, so it was stopped: nothing was shown or sent. Try again; if this continues, tell your organisation owner.';
// How the viewer reached the patient: an emergency grant is named so a reviewer can find these reads.
export function accessRoute(m: Member, p: Person, now = new Date().toISOString()) {
  if (normallyAllowed(m, p)) return '';
  const g = exceptionalGrant(m, p, now);
  return g ? ` Through emergency access grant ${g.id}.` : '';
}
// An organisation shell carrying no records: the commit diff covers the one event and nothing else.
const shell = (s: OrgState): OrgState => ({ organisation: s.organisation, teams: [], members: [], invitations: [], workspace: { ...s.workspace, people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
type AccessEntry = { action: AccessAction; subject: string; personId?: string | null; detail: string };
export async function recordAccess(db: D1Database, s: OrgState, actor: Actor, m: Member, a: AccessEntry, now = new Date().toISOString()) {
  return (await recordAccesses(db, s, actor, m, [a], now))[0];
}
// Several access events in one access-audit commit (slice 6w: the paged workspace window).
export async function recordAccesses(db: D1Database, s: OrgState, actor: Actor, m: Member, list: AccessEntry[], now = new Date().toISOString()) {
  const before = shell(s), after = shell(s);
  const events: Audit[] = list.map(a => ({ id: uuid(), at: now, actor: actor.displayName, actorId: actor.userId, role: m.role, action: a.action, subject: a.subject, detail: a.detail, personId: a.personId ?? null }));
  after.workspace.audit = events;
  try { await persist(db, before, after, actor, { type: ACCESS_AUDIT }, 'access_' + events[0].id, '', null); }
  catch (e) { console.error('Access audit not recorded', e instanceof AppError ? e.status : e instanceof Error ? e.name : 'unknown'); fail(503, ACCESS_REFUSED); }
  return events;
}
// Slice 6w (fifth review, finding 7): a paging client names up to 50 opened patients (x-saha-patient-window) and
// receives their full records with every workspace read. A window id the viewer has not opened through
// /api/patients/detail (or re-read through the window) in the last WINDOW_REOPEN_HOURS is recorded as a
// viewPatientRecord access before its record is returned. If the event cannot be written, those ids are left
// out of the window (nothing of them is returned); ids already recorded in the period stay.
export const WINDOW_REOPEN_HOURS = 12;
export async function auditWindow(db: D1Database, s: OrgState, actor: Actor, m: Member, ids: string[], now = new Date().toISOString()): Promise<string[]> {
  if (!ids.length) return ids;
  const since = new Date(Date.parse(now) - WINDOW_REOPEN_HOURS * 3600000).toISOString();
  const seen = new Set((await db.prepare(`SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND at>=? AND person_id IN (${ids.map(() => '?').join(',')})`).bind(s.organisation.id, actor.userId, since, ...ids).all<{ person_id: string }>()).results.map(r => r.person_id));
  const missing = ids.filter(id => !seen.has(id));
  if (!missing.length) return ids;
  const people = new Map(s.workspace.people.map(p => [p.id, p]));
  try {
    await recordAccesses(db, s, actor, m, missing.map(id => ({ action: 'viewPatientRecord' as const, subject: id, personId: id, detail: `Full patient record returned through the paged workspace window (not opened through the patient detail route in the last ${WINDOW_REOPEN_HOURS} hours).${people.get(id) ? accessRoute(m, people.get(id)!, now) : ''}` })), now);
    return ids;
  } catch { return ids.filter(id => seen.has(id)); }
}
