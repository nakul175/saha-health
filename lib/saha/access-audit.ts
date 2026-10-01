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
export async function recordAccess(db: D1Database, s: OrgState, actor: Actor, m: Member, a: { action: AccessAction; subject: string; personId?: string | null; detail: string }, now = new Date().toISOString()) {
  const before = shell(s), after = shell(s);
  const event: Audit = { id: uuid(), at: now, actor: actor.displayName, actorId: actor.userId, role: m.role, action: a.action, subject: a.subject, detail: a.detail, personId: a.personId ?? null };
  after.workspace.audit = [event];
  try { await persist(db, before, after, actor, { type: ACCESS_AUDIT }, 'access_' + event.id, '', null); }
  catch (e) { console.error('Access audit not recorded', e instanceof AppError ? e.status : e instanceof Error ? e.name : 'unknown'); fail(503, ACCESS_REFUSED); }
  return event;
}
