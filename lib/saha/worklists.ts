import type { D1Database } from '@cloudflare/workers-types';
import { allowed } from './access';
import { fail } from './core';
import { viewerScope } from './store';
import type { Member, Person, Referral, Submission } from './types';
import type { FollowUp } from './programmes';
import { followUpGroups, referralList, submissionList, visitList, workStats, type WorkStats } from './worklist-views';

// Slice 0b-4: server-side work views for a paged workspace. The viewer's whole permitted scope is selected with
// the slice 0b-2 predicate (as for /api/patients), each patient is checked again with access.ts, and the shared
// functions in worklist-views.ts order and count it exactly as the unpaged workspace does. Owner authority never
// widens the scope; administrators, providers and inactive members see nothing. Only one page of rows leaves
// the server, with summary fields only.
export const WORKLIST_VIEWS = ['work', 'followups', 'submissions', 'referrals'] as const;
export type WorklistView = typeof WORKLIST_VIEWS[number];
export const WORKLIST_PAGE = 50;
const CURSOR = /^n:(\d{1,7})(?::(\d{1,7}))?$/;

// The cursor is a position in the ordered view (`n:<offset>`): it carries no name, no free text and no record id.
// Slice 6w (fifth review, finding 9): the cursor also carries the view's total when the page was served
// (`n:<offset>:<total>`). If the total has changed, the list moved under the client: the server restarts at the
// first page and says so (`restarted`), and the client replaces its rows instead of appending.
export type WorklistQuery = { view: WorklistView; limit: number; offset: number; attention: boolean; total?: number };
export function worklistQuery(url: URL): WorklistQuery {
  for (const k of url.searchParams.keys()) if (!['view', 'cursor', 'limit', 'tab'].includes(k)) fail(400, 'Invalid work list request.');
  const view = url.searchParams.get('view') ?? 'work';
  if (!(WORKLIST_VIEWS as readonly string[]).includes(view)) fail(400, 'Choose a work list.');
  const rawLimit = url.searchParams.get('limit');
  if (rawLimit !== null && !/^\d{1,3}$/.test(rawLimit)) fail(400, 'Invalid page size.');
  const limit = Math.min(100, Math.max(1, rawLimit === null ? WORKLIST_PAGE : Number(rawLimit)));
  const raw = url.searchParams.get('cursor');
  let offset = 0;
  let total: number | undefined;
  if (raw !== null) { const c = CURSOR.exec(raw); if (!c) fail(400, 'Invalid work list cursor. Start the list again.'); offset = Number(c![1]); if (c![2] !== undefined) total = Number(c![2]); }
  const tab = url.searchParams.get('tab') ?? 'all';
  if (!['all', 'attention'].includes(tab) || (tab === 'attention' && view !== 'submissions')) fail(400, 'Choose all or attention submissions.');
  return { view: view as WorklistView, limit, offset, attention: tab === 'attention', ...(total !== undefined ? { total } : {}) };
}

export type WorkPerson = Pick<Person, 'id' | 'name' | 'age' | 'sex' | 'village' | 'programmes' | 'task' | 'due' | 'status'> & { followUps?: FollowUp[]; merged: boolean };
export type WorklistData = { people: WorkPerson[]; stats?: WorkStats; submissions: Submission[]; referrals: Referral[] };
type Need = { visits: boolean; submissions: 'none' | 'state' | 'full'; referrals: boolean };
const NEEDS: Record<WorklistView, Need> = {
  work: { visits: true, submissions: 'state', referrals: false },
  followups: { visits: false, submissions: 'none', referrals: false },
  submissions: { visits: false, submissions: 'full', referrals: false },
  referrals: { visits: false, submissions: 'none', referrals: true },
};

// The viewer's permitted patients with only the fields the work views use, plus (as the view needs) visit states,
// submissions and referrals of those patients, in one batched round trip.
export async function worklistData(db: D1Database, orgId: string, member: Member, view: WorklistView, now = new Date().toISOString()): Promise<WorklistData> {
  if (member.status !== 'active') fail(403, 'Your organisation membership is inactive or unavailable.');
  const need = NEEDS[view];
  const vs = await viewerScope(db, orgId, member.userId, now), where = vs ? vs.sql : '1', binds = vs ? vs.binds : [];
  const permitted = `SELECT p.id FROM patients p WHERE p.org_id=? AND ${where}`;
  const statements = [
    db.prepare(`SELECT p.id,p.team_id,p.assigned_to,json_extract(p.data,'$.name') AS name,json_extract(p.data,'$.age') AS age,json_extract(p.data,'$.sex') AS sex,json_extract(p.data,'$.village') AS village,json_extract(p.data,'$.programmes') AS programmes,json_extract(p.data,'$.task') AS task,json_extract(p.data,'$.due') AS due,json_extract(p.data,'$.status') AS status,json_extract(p.data,'$.followUps') AS follow_ups,json_extract(p.data,'$.exceptionalAccess') AS grants,json_extract(p.data,'$.mergedInto') AS merged FROM patients p WHERE p.org_id=? AND ${where} ORDER BY p.id`).bind(orgId, ...binds),
    need.visits ? db.prepare(`SELECT person_id,json_extract(data,'$.state') AS state,json_extract(data,'$.voidedAt') AS voided_at,json_extract(data,'$.supersededBy') AS superseded_by,json_extract(data,'$.imported.batchId') AS imported FROM visits WHERE org_id=? AND person_id IN (${permitted})`).bind(orgId, orgId, ...binds) : null,
    need.submissions === 'state' ? db.prepare(`SELECT person_id,json_extract(data,'$.state') AS state FROM submissions WHERE org_id=? AND person_id IN (${permitted})`).bind(orgId, orgId, ...binds)
      : need.submissions === 'full' ? db.prepare(`SELECT person_id,data FROM submissions WHERE org_id=? AND person_id IN (${permitted}) ORDER BY id`).bind(orgId, orgId, ...binds) : null,
    need.referrals ? db.prepare(`SELECT person_id,data FROM referrals WHERE org_id=? AND person_id IN (${permitted}) ORDER BY id`).bind(orgId, orgId, ...binds) : null,
  ];
  const used = statements.filter(s => s !== null) as NonNullable<typeof statements[number]>[];
  const results = await db.batch(used);
  const at = (i: number): Record<string, any>[] => { const s = statements[i]; return s ? results[used.indexOf(s)].results as Record<string, any>[] : []; };
  const people: WorkPerson[] = [];
  for (const r of at(0)) {
    const p = { id: r.id, teamId: r.team_id, assignedTo: r.assigned_to, exceptionalAccess: r.grants ? JSON.parse(r.grants) : [] } as unknown as Person;
    if (!allowed(member, p, now)) continue;
    people.push({ id: r.id, name: r.name ?? '', age: r.age, sex: r.sex ?? '', village: r.village ?? '', programmes: r.programmes ? JSON.parse(r.programmes) : [], task: r.task ?? '', due: r.due ?? '', status: r.status, merged: !!r.merged, ...(r.follow_ups ? { followUps: JSON.parse(r.follow_ups) } : {}) });
  }
  const ids = new Set(people.map(p => p.id)), mine = (r: Record<string, any>) => ids.has(r.person_id);
  const submissions = need.submissions === 'full' ? at(2).filter(mine).map(r => JSON.parse(r.data) as Submission) : at(2).filter(mine).map(r => ({ state: r.state }) as Submission);
  const referrals = at(3).filter(mine).map(r => JSON.parse(r.data) as Referral);
  const stats = need.visits ? workStats(people, at(1).filter(mine).map(v => ({ state: v.state, voidedAt: v.voided_at ?? undefined, supersededBy: v.superseded_by ?? undefined, imported: v.imported ?? undefined })), submissions) : undefined;
  return { people, stats, submissions, referrals };
}

export type WorkRow = { id: string; name: string; age: number | null; sex: string; village: string; programmes: string[]; task: string; due: string; status: string; merged: boolean };
export type FollowUpRow = { personId: string; name: string; tasks: { id: string; due: string; packId: string; title: string }[] };
export type SubmissionRow = Pick<Submission, 'id' | 'personId' | 'visitId' | 'connectorName' | 'state' | 'receipt' | 'attempts' | 'mode' | 'message' | 'createdAt' | 'signOff'> & { personName: string };
export type ReferralRow = Pick<Referral, 'id' | 'personId' | 'visitId' | 'facility' | 'reason' | 'state' | 'due' | 'urgency' | 'ownerId'> & { personName: string };
export type WorklistPage = { view: WorklistView; total: number; nextCursor: string | null; restarted?: boolean; stats?: WorkStats; tasks?: number; all?: number; attention?: number; rows: (WorkRow | FollowUpRow | SubmissionRow | ReferralRow)[] };

const page = <T>(items: T[], q: WorklistQuery) => { const stale = q.total !== undefined && q.total !== items.length, offset = stale ? 0 : q.offset; return { rows: items.slice(offset, offset + q.limit), nextCursor: offset + q.limit < items.length ? `n:${offset + q.limit}:${items.length}` : null, restarted: stale }; };

// One page of one view. `total` counts the whole ordered view and every page repeats it, so a client can tell
// when the list changed between pages.
export function worklistPage(data: WorklistData, q: WorklistQuery): WorklistPage {
  const name = new Map(data.people.map(p => [p.id, p.name]));
  if (q.view === 'work') {
    const list = visitList(data.people), pg = page(list, q);
    return { view: q.view, stats: data.stats, total: list.length, nextCursor: pg.nextCursor, ...(pg.restarted ? { restarted: true } : {}), rows: pg.rows.map(p => ({ id: p.id, name: p.name, age: p.age ?? null, sex: p.sex, village: p.village, programmes: p.programmes, task: p.task, due: p.due, status: p.status, merged: p.merged })) };
  }
  if (q.view === 'followups') {
    const f = followUpGroups(data.people), pg = page(f.groups, q);
    return { view: q.view, tasks: f.tasks, total: f.groups.length, nextCursor: pg.nextCursor, ...(pg.restarted ? { restarted: true } : {}), rows: pg.rows.map(g => ({ personId: g.person.id, name: g.person.name, tasks: g.tasks.map(t => ({ id: t.id, due: t.due, packId: t.packId, title: t.title })) })) };
  }
  if (q.view === 'submissions') {
    const s = submissionList(data.submissions, q.attention), pg = page(s.rows, q);
    return { view: q.view, all: s.all, attention: s.attention, total: s.rows.length, nextCursor: pg.nextCursor, ...(pg.restarted ? { restarted: true } : {}), rows: pg.rows.map(x => ({ id: x.id, personId: x.personId, visitId: x.visitId, connectorName: x.connectorName, state: x.state, receipt: x.receipt, attempts: x.attempts, mode: x.mode, message: x.message, createdAt: x.createdAt, personName: name.get(x.personId) ?? '', ...(x.signOff ? { signOff: x.signOff } : {}) })) };
  }
  const list = referralList(data.referrals), pg = page(list, q);
  return { view: q.view, total: list.length, nextCursor: pg.nextCursor, ...(pg.restarted ? { restarted: true } : {}), rows: pg.rows.map(r => ({ id: r.id, personId: r.personId, visitId: r.visitId, facility: r.facility, reason: r.reason, state: r.state, due: r.due, urgency: r.urgency, ownerId: r.ownerId, personName: name.get(r.personId) ?? '' })) };
}
