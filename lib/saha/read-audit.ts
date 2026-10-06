import type { D1Database } from '@cloudflare/workers-types';
import { fail } from './core';
import { exceptionalGrant, normallyAllowed } from './access';
import { accessRoute, recordAccess, recordAccessBare, recordAccesses } from './access-audit';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';
// Slice 10h: the remaining read paths are audited through the same single-event, chained, fail-closed access commit as
// slice 6t (BR-SEC-08). Everything written here is an identifier or a count; nothing a person typed is recorded and no
// event repeats patient names, facts or notes.
//
//   viewWorkspace   one event per workspace snapshot load: viewer (the event's actor), scope size, records returned in
//                   full, paging window, and records reached through emergency access. Not one row per patient.
//   openRecord      the browser reports that it opened a record it already holds (the server cannot see that otherwise).
//   searchPatients  a text search or a duplicate check: kind and result count, never the search text.
//   listPatients    a patient page or work-list page: kind and result count.
//   viewAggregate   indicator results, the scoped care report, aggregate report history: which view, counts, no cell values.

export const OPEN_COALESCE_SECONDS = 60;
// What the browser says it opened the record from. Reported by the client, so it is a label, not evidence.
export const OPEN_SOURCES = ['work list', 'patient list', 'search', 'link', 'other'] as const;
export type OpenSource = typeof OPEN_SOURCES[number];
export type PagedInfo = { total: number; threshold: number; window: number } | null;

// The snapshot a viewer receives: how it was asked for is part of the event.
export type SnapshotVia = 'workspace load' | 'response to a command' | 'replay of a saved command';
export function workspaceSummary(state: OrgState, m: Member, via: SnapshotVia, paged: PagedInfo, now = new Date().toISOString()) {
  const people = state.workspace.people.filter(p => p.assigned), ids = new Set(people.map(p => p.id));
  const scopeSize = paged ? paged.total : people.length;
  const visits = state.workspace.visits.filter(v => ids.has(v.personId)).length, referrals = state.workspace.referrals.filter(r => ids.has(r.personId)).length, submissions = state.workspace.submissions.filter(s => ids.has(s.personId)).length;
  const grants = people.filter(p => !normallyAllowed(m, p) && exceptionalGrant(m, p, now)).length;
  const detail = `Workspace snapshot returned (${via}): ${scopeSize} patient${scopeSize === 1 ? '' : 's'} in care scope; ${people.length} record${people.length === 1 ? '' : 's'} returned in full${paged ? ` (paged workspace: ${paged.window} opened, scope above the ${paged.threshold}-patient paging threshold)` : ''}; ${visits} visit${visits === 1 ? '' : 's'}, ${referrals} referral${referrals === 1 ? '' : 's'}, ${submissions} submission${submissions === 1 ? '' : 's'}.${grants ? ` ${grants} record${grants === 1 ? '' : 's'} reached through emergency access grants.` : ''}`;
  return { detail, scopeSize, returned: people.length, visits, referrals, submissions, grants };
}
export async function recordWorkspaceLoad(db: D1Database, state: OrgState, actor: Actor, m: Member, via: SnapshotVia, paged: PagedInfo, now = new Date().toISOString()) {
  const s = workspaceSummary(state, m, via, paged, now);
  await recordAccess(db, state, actor, m, { action: 'viewWorkspace', subject: state.organisation.id, personId: null, detail: s.detail }, now);
  return s;
}

// A command partition returns full records, even when the browser requested a paged
// workspace. Record this actual disclosure independently of screen-open/window
// coalescing. The mutation and its receipt have already committed; a refused read
// must not rerun the mutation. One access-only batch leaves clinical revisions alone.
export async function recordPartitionResponse(db: D1Database, state: OrgState, actor: Actor, m: Member, now = new Date().toISOString()) {
  const people = state.workspace.people.filter(p => p.assigned), ids = new Set(people.map(p => p.id));
  const count = (rows: { personId: string }[]) => rows.filter(r => ids.has(r.personId)).length;
  await recordAccesses(db, state, actor, m, [
    { action: 'viewWorkspace', subject: state.organisation.id, personId: null, detail: `Partition snapshot returned (response to a command): ${people.length} patient records returned in full; ${count(state.workspace.visits)} visits, ${count(state.workspace.referrals)} referrals, ${count(state.workspace.submissions)} submissions. Counts describe only the returned partition, not the full care scope.` },
    ...people.map(p => ({ action: 'viewPatientRecord' as const, subject: p.id, personId: p.id, detail: `Full patient record returned through a command partition (response to a command).${accessRoute(m, p, now)}` })),
  ], now);
}

// A patient page or search from SQL alone (no organisation state): kind and count only.
export type PatientListKind = { text: boolean; programme: boolean; later: boolean };
export function patientListDetail(k: PatientListKind, rows: number, total: number | null) {
  const kind = k.text && k.programme ? 'text search with programme filter' : k.text ? 'text search (name, village or id)' : k.programme ? 'programme filter' : 'browse';
  return `Patient ${k.text ? 'search' : 'list'}: ${kind}; ${k.later ? 'later page' : 'first page'}; ${rows} row${rows === 1 ? '' : 's'} returned${total === null ? '' : ` of ${total} matching`}.`;
}
export async function recordPatientList(db: D1Database, orgId: string, actor: Actor, m: Member, k: PatientListKind, rows: number, total: number | null, now = new Date().toISOString()) {
  await recordAccessBare(db, orgId, actor, m, { action: k.text ? 'searchPatients' : 'listPatients', subject: orgId, personId: null, detail: patientListDetail(k, rows, total) }, now);
}
export async function recordWorkList(db: D1Database, orgId: string, actor: Actor, m: Member, view: string, attention: boolean, later: boolean, rows: number, total: number, now = new Date().toISOString()) {
  await recordAccessBare(db, orgId, actor, m, { action: 'listPatients', subject: orgId, personId: null, detail: `Work list: ${view}${attention ? ' (attention tab)' : ''}; ${later ? 'later page' : 'first page'}; ${rows} row${rows === 1 ? '' : 's'} returned of ${total}.` }, now);
}
// The duplicate check on registration: the entered name, age and village are not recorded, only that a check ran.
export async function recordMatchSearch(db: D1Database, state: OrgState, actor: Actor, m: Member, candidates: number, overflow: boolean, now = new Date().toISOString()) {
  await recordAccess(db, state, actor, m, { action: 'searchPatients', subject: state.organisation.id, personId: null, detail: `Patient search: duplicate check on registration (name, age, sex, village and team entered; not recorded); ${candidates} candidate${candidates === 1 ? '' : 's'} returned${overflow ? ' (more than the limit; list truncated)' : ''}.` }, now);
}

// Aggregate views: the view, the counts, and which filters were set (never their values).
export async function recordAggregateView(db: D1Database, state: OrgState, actor: Actor, m: Member, view: string, detail: string, now = new Date().toISOString()) {
  await recordAccess(db, state, actor, m, { action: 'viewAggregate', subject: view, personId: null, detail }, now);
}

// Derived patient views still disclose patient work even when the full workspace is not returned.
// Queue reads append one count-only event, including empty results; a single-patient plan records
// the patient's identifier and access route. Await the durable chain commit before returning either.
export async function recordPatientWorkView(db: D1Database, state: OrgState, actor: Actor, m: Member, view: 'care continuity' | 'referral escalations' | 'action plan', rows: number, patient?: Person, now = new Date().toISOString()) {
  await recordAccess(db, state, actor, m, {
    action: patient ? 'viewActionPlan' : 'listPatients',
    subject: patient?.id ?? state.organisation.id, personId: patient?.id ?? null,
    detail: `Patient work view: ${view}; ${rows} row${rows === 1 ? '' : 's'} returned.${patient ? accessRoute(m, patient, now) : ''}`,
  }, now);
}

// The browser opened a record it already held. A second report for the same viewer and patient inside
// OPEN_COALESCE_SECONDS is not recorded again (a re-render or a double click is one open).
export async function recordRecordOpened(db: D1Database, state: OrgState, actor: Actor, m: Member, personId: string, source: OpenSource, now = new Date().toISOString()) {
  const p = state.workspace.people.find(x => x.id === personId);
  if (!p || !p.assigned) fail(404, 'This patient is not in your care scope.');
  const since = new Date(Date.parse(now) - OPEN_COALESCE_SECONDS * 1000).toISOString();
  const seen = await db.prepare("SELECT 1 AS x FROM audit_events WHERE org_id=? AND person_id=? AND actor_id=? AND action='openRecord' AND at>=? LIMIT 1").bind(state.organisation.id, personId, actor.userId, since).first();
  if (seen) return { recorded: false as const, coalesced: true as const };
  const e = await recordAccess(db, state, actor, m, { action: 'openRecord', subject: personId, personId, detail: `Record opened on screen from ${source} (the record was already loaded in the browser; reported by the browser).${accessRoute(m, p, now)}` }, now);
  return { recorded: true as const, coalesced: false as const, eventId: e.id };
}
