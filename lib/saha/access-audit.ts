import type { D1Database } from '@cloudflare/workers-types';
import { AppError, fail, uuid } from './core';
import { ACCESS_AUDIT } from './audit-chain';
import { exceptionalGrant, normallyAllowed } from './access';
import { heldBy } from './delegation';
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
  // Slice 6z: an ABHA link refused because the number is linked to a record outside the requester's scope, recorded on
  // the record that holds the number (not on the requesting record) for identity steward review; the requester is shown
  // the ordinary link refusal. Slice 6ab: at most one event per requester and holding record a day.
  abhaLinkReview: 'ABHA link refused: the number is linked to this record. Recorded on the holding record only, for identity steward review.',
  // Slice 6aa: an import rejection report (row numbers and reasons only) is recorded the same way as an indicator export.
  importRejectionsExport: 'Import rejection report exported as CSV (row numbers and reasons only).',
  // Slice 10h: the remaining read paths. One summarised event per workspace snapshot load (counts only, never one row per
  // patient); an explicit record-opened event when the browser opens a record it already holds; patient searches and
  // lists (query kind and result count, never the search text); aggregate views (indicators, the scoped care report,
  // aggregate report history).
  viewWorkspace: 'Workspace snapshot loaded (summary: scope size, records returned, paging window).',
  openRecord: 'Patient record opened on screen from the workspace (reported by the browser; the record was already loaded).',
  searchPatients: 'Patient search run (kind and result count; the search text is not recorded).',
  listPatients: 'Patient list or work list page read (kind and result count).',
  viewAggregate: 'Aggregate view read (indicator results, scoped care report or aggregate report history).',
  // Slice 10e: a search by issuer identifier is a material read when it returns a match (one event per matched record,
  // sharing the search's id in `subject`) and is recorded without a record when it finds nothing; both count toward the
  // searcher's rate limit. A link refused because another record outside the requester's scope already holds the
  // identifier is recorded on that record for identity steward review, as for ABHA numbers (slice 6z).
  identifierSearch: 'Searched by an issuer identifier; this record matched and was returned to the searcher.',
  identifierSearchMiss: 'Searched by an issuer identifier; no record in the searcher\'s care scope matched.',
  identifierConflictReview: 'Identifier link refused: the identifier is recorded on this record. Recorded on the holding record only, for identity steward review.',
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
// Slice 10h: a read that is answered from SQL alone (a patient page, a work-list page) has no organisation state loaded.
// Its audit commit needs only the organisation id, so it is built on an empty shell; delegations are not consulted
// because those views are scoped by the viewer's own membership and teams (delegation never widens patient access).
const bare = (orgId: string): OrgState => ({ organisation: { id: orgId, name: '', revision: 0, createdAt: '' }, teams: [], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 0, role: 'admin', people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
// Slice 10h (BR-SEC-08): the acting membership's role, its version and any delegated authority in force are written into
// the detail of every access event, so they are covered by the audit chain hash like the rest of the event. `s` is null for
// a read answered without organisation state. Identifiers only: no names, no reasons.
export function authorityClause(s: OrgState | null, m: Member, now = new Date().toISOString()) {
  const head = ` Authority: role ${m.role}${m.isOwner ? ' (organisation owner)' : ''}, membership version ${m.version ?? 'unknown'}`;
  if (!s) return `${head}; delegated authority: not consulted for this view (scoped by the viewer's own membership and teams).`;
  const held = [...heldBy(s, m, 'team-supervision', now), ...heldBy(s, m, 'reporting', now)];
  return `${head}; delegated authority in force: ${held.length ? held.map(d => `${d.kind} ${d.id} (grantor ${d.grantorId}, until ${d.until})`).join('; ') : 'none'}.`;
}
type AccessEntry = { action: AccessAction; subject: string; personId?: string | null; detail: string };
export async function recordAccess(db: D1Database, s: OrgState, actor: Actor, m: Member, a: AccessEntry, now = new Date().toISOString()) {
  return (await recordAccesses(db, s, actor, m, [a], now))[0];
}
// A read answered without organisation state (slice 10h): same single chained commit, authority without delegations.
export async function recordAccessBare(db: D1Database, orgId: string, actor: Actor, m: Member, a: AccessEntry, now = new Date().toISOString()) {
  return (await write(db, bare(orgId), actor, m, [a], now, null))[0];
}
// Several access events in one access-audit commit (slice 6w: the paged workspace window).
export async function recordAccesses(db: D1Database, s: OrgState, actor: Actor, m: Member, list: AccessEntry[], now = new Date().toISOString()) {
  return write(db, s, actor, m, list, now, s);
}
async function write(db: D1Database, s: OrgState, actor: Actor, m: Member, list: AccessEntry[], now: string, authoritySource: OrgState | null) {
  const before = shell(s), after = shell(s), authority = authorityClause(authoritySource, m, now);
  const events: Audit[] = list.map(a => ({ id: uuid(), at: now, actor: actor.displayName, actorId: actor.userId, role: m.role, action: a.action, subject: a.subject, detail: a.detail + authority, personId: a.personId ?? null }));
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
// Slice 6aa (seventh review, finding 3): also used for an unpaged workspace read by a non-ASHA viewer above the paging
// threshold (`how` = 'full'); the lookup is chunked so a large scope stays under D1's bound-parameter limit.
const SEEN_CHUNK = 90;
export async function auditWindow(db: D1Database, s: OrgState, actor: Actor, m: Member, ids: string[], now = new Date().toISOString(), how: 'window' | 'full' = 'window'): Promise<string[]> {
  if (!ids.length) return ids;
  const since = new Date(Date.parse(now) - WINDOW_REOPEN_HOURS * 3600000).toISOString(), seen = new Set<string>();
  for (let i = 0; i < ids.length; i += SEEN_CHUNK) { const part = ids.slice(i, i + SEEN_CHUNK); for (const r of (await db.prepare(`SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND at>=? AND person_id IN (${part.map(() => '?').join(',')})`).bind(s.organisation.id, actor.userId, since, ...part).all<{ person_id: string }>()).results) seen.add(r.person_id); }
  const missing = ids.filter(id => !seen.has(id));
  if (!missing.length) return ids;
  const people = new Map(s.workspace.people.map(p => [p.id, p])), route = how === 'full' ? 'an unpaged workspace read (no paging window requested; scope above the paging threshold)' : 'the paged workspace window';
  try {
    await recordAccesses(db, s, actor, m, missing.map(id => ({ action: 'viewPatientRecord' as const, subject: id, personId: id, detail: `Full patient record returned through ${route} (not opened through the patient detail route in the last ${WINDOW_REOPEN_HOURS} hours).${people.get(id) ? accessRoute(m, people.get(id)!, now) : ''}` })), now);
    return ids;
  } catch { return ids.filter(id => seen.has(id)); }
}
