import type { D1Database } from '@cloudflare/workers-types';
import { allowed } from './access';
import { fail } from './core';
import { viewerScope } from './store';
import type { Member, Person, Programme } from './types';

// Slice 0b-3: large team scopes read a paged, searchable patient list and open one patient's detail
// on demand instead of loading every permitted patient into the workspace.
// A client opts in with `x-saha-patients: paged`; the server pages only when the viewer is not an
// ASHA and the permitted scope is larger than PAGED_THRESHOLD. ASHAs keep their whole caseload
// (the field notebook needs it offline), and small scopes read exactly as before.
export const PAGED_THRESHOLD = 500;
export const PAGE_SIZE = 50;
export const WINDOW_MAX = 50;
export type PagingRequest = { window: string[] };
const ID = /^[A-Za-z0-9_:.-]{1,120}$/;

export function pagingRequest(request?: Request | null): PagingRequest | null {
  if (!request || request.headers.get('x-saha-patients') !== 'paged') return null;
  const raw = request.headers.get('x-saha-patient-window') ?? '';
  if (raw.length > 8000) fail(400, 'Too many opened patients in this request.');
  const window = [...new Set(raw.split(',').map(x => x.trim()).filter(Boolean))];
  if (window.length > WINDOW_MAX || window.some(x => !ID.test(x))) fail(400, 'Too many or invalid opened patients in this request.');
  return { window };
}

export function patientId(value: string | null) {
  if (!value || !ID.test(value)) fail(400, 'Choose a patient.');
  return value!;
}

// Returns null when the viewer keeps the full scoped read; otherwise the window of opened patients
// that are inside the viewer's scope (selected in SQL with the same predicate as the scoped read).
export async function pagedWindow(db: D1Database, orgId: string, userId: string, window: string[]) {
  const m = await db.prepare('SELECT role,status FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, userId).first<{ role: string; status: string }>();
  if (!m || m.status !== 'active' || m.role === 'asha') return null;
  const vs = await viewerScope(db, orgId, userId), where = vs ? vs.sql : '1', binds = vs ? vs.binds : [];
  const count = await db.prepare(`SELECT count(*) AS n FROM patients p WHERE p.org_id=? AND ${where}`).bind(orgId, ...binds).first<{ n: number }>();
  const total = count?.n ?? 0;
  if (total <= PAGED_THRESHOLD) return null;
  const ids = window.length ? (await db.prepare(`SELECT p.id FROM patients p WHERE p.org_id=? AND p.id IN (${window.map(() => '?').join(',')}) AND ${where}`).bind(orgId, ...window, ...binds).all<{ id: string }>()).results.map(r => r.id) : [];
  return { ids, total };
}

export type PatientRow = { id: string; name: string; age: number | null; sex: string; village: string; programmes: Programme[]; task: string; due: string; status: Person['status']; teamId: string; assignedTo: string | null; merged: boolean; exceptional: boolean };
export type PatientPage = { rows: PatientRow[]; nextCursor: string | null; total: number | null };

// Slice 6q (second review): the cursor is opaque and name-free (`after:<patient id>`); the server resolves the
// id to its sort position inside the viewer's scope. Search text travels only in a POST body (see
// patient-directory-server.ts), never in a URL, where hosting platforms record it in request logs.
const CURSOR = /^after:([A-Za-z0-9_:.-]{1,120})$/;
export function pageQuery(source: URL | Record<string, unknown>) {
  const get = (k: string) => source instanceof URL ? source.searchParams.get(k) : typeof source[k] === 'string' || typeof source[k] === 'number' ? String(source[k]) : source[k] == null ? null : fail(400, 'Invalid patient list request.');
  const q = (get('q') ?? '').trim().toLowerCase();
  if (q.length > 80) fail(400, 'Search text is too long.');
  const programme = get('programme') ?? '';
  if (programme.length > 60) fail(400, 'Choose a programme.');
  const limit = Math.min(100, Math.max(1, Number(get('limit') ?? PAGE_SIZE) || PAGE_SIZE));
  const raw = get('cursor');
  let cursor: string | null = null;
  if (raw) { const c = CURSOR.exec(raw); if (!c) fail(400, 'Invalid patient list cursor.'); cursor = c![1]; }
  return { q, programme, limit, cursor };
}

// One page ordered by name then id. Scope is the SQL predicate of the scoped workspace read, and every
// returned row is checked again with access.ts. Owners and administrators get no wider scope here.
export async function patientPage(db: D1Database, orgId: string, member: Member, query: ReturnType<typeof pageQuery>, now = new Date().toISOString()): Promise<PatientPage> {
  const vs = await viewerScope(db, orgId, member.userId, now), where = vs ? vs.sql : '1', binds: (string | number | null)[] = vs ? [...vs.binds] : [];
  const filters: string[] = [], fb: (string | number)[] = [];
  if (query.q) { filters.push("(instr(lower(p.name),?)>0 OR instr(lower(coalesce(json_extract(p.data,'$.village'),'')),?)>0 OR instr(lower(p.id),?)>0)"); fb.push(query.q, query.q, query.q); }
  if (query.programme) { filters.push("EXISTS (SELECT 1 FROM json_each(p.data,'$.programmes') g WHERE g.value=?)"); fb.push(query.programme); }
  const base = `FROM patients p WHERE p.org_id=? AND ${where}${filters.map(f => ` AND ${f}`).join('')}`;
  let key: [string, string] | null = null;
  if (query.cursor) {
    const at = await db.prepare(`SELECT p.name FROM patients p WHERE p.org_id=? AND p.id=? AND ${where}`).bind(orgId, query.cursor, ...binds).first<{ name: string }>();
    if (!at) fail(400, 'The patient list changed. Start again from the first page.');
    key = [at!.name, query.cursor];
  }
  const after = key ? ' AND (p.name>? OR (p.name=? AND p.id>?))' : '';
  const rows = await db.prepare(`SELECT p.id,p.name,p.team_id,p.assigned_to,json_extract(p.data,'$.age') AS age,json_extract(p.data,'$.sex') AS sex,json_extract(p.data,'$.village') AS village,json_extract(p.data,'$.programmes') AS programmes,json_extract(p.data,'$.task') AS task,json_extract(p.data,'$.due') AS due,json_extract(p.data,'$.status') AS status,json_extract(p.data,'$.mergedInto') AS merged,json_extract(p.data,'$.exceptionalAccess') AS grants ${base}${after} ORDER BY p.name,p.id LIMIT ?`)
    .bind(orgId, ...binds, ...fb, ...(key ? [key[0], key[0], key[1]] : []), query.limit + 1).all<Record<string, any>>();
  const total = query.cursor ? null : (await db.prepare(`SELECT count(*) AS n ${base}`).bind(orgId, ...binds, ...fb).first<{ n: number }>())?.n ?? 0;
  const out: PatientRow[] = [];
  for (const r of rows.results.slice(0, query.limit)) {
    const grants = r.grants ? JSON.parse(r.grants) : [];
    const p = { id: r.id, teamId: r.team_id, assignedTo: r.assigned_to, exceptionalAccess: grants } as Person;
    if (!allowed(member, p, now)) continue;
    out.push({ id: r.id, name: r.name, age: typeof r.age === 'number' ? r.age : null, sex: r.sex ?? '', village: r.village ?? '', programmes: r.programmes ? JSON.parse(r.programmes) : [], task: r.task ?? '', due: r.due ?? '', status: r.status ?? 'due', teamId: r.team_id, assignedTo: r.assigned_to, merged: !!r.merged, exceptional: !member.teamIds.includes(r.team_id) });
  }
  const last = rows.results.length > query.limit ? rows.results[query.limit - 1] : null;
  return { rows: out, nextCursor: last ? `after:${last.id}` : null, total };
}
