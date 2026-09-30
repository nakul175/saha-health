import { activeOrg, db, identity, json, loadFor, snapshotFor } from './server';
import { fail } from './core';
import { pageQuery, patientId, patientPage } from './patient-directory';
import type { Member } from './types';

// Slice 0b-3: GET /api/patients — one page of the viewer's permitted patients, searchable by name,
// village or id and filterable by programme. Membership is read from the database for this request.
export async function patientsRead(request: Request) {
  const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation'));
  const [m, t] = await db().batch([
    db().prepare('SELECT role,status,is_owner,version,created_at FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
    db().prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
  ]);
  const row = (m.results as Record<string, any>[])[0];
  if (!row || row.status !== 'active') fail(403, 'Your organisation membership is inactive or unavailable.');
  const member = { userId: u.userId, role: row.role, status: row.status, isOwner: !!row.is_owner, teamIds: (t.results as { team_id: string }[]).map(r => r.team_id) } as Member;
  return json(await patientPage(db(), orgId, member, pageQuery(new URL(request.url))));
}

// Slice 0b-3: GET /api/patients/detail?personId= — the patient partition snapshot for one permitted
// patient, in the same shape as a command delta, for the workspace to merge when the record is opened.
export async function patientDetailRead(request: Request) {
  const u = await identity(), id = patientId(new URL(request.url).searchParams.get('personId'));
  const state = await loadFor(u, request.headers.get('x-saha-organisation'), async () => [id]);
  const delta = await snapshotFor(state, u);
  if (!delta.people.some(p => p.id === id)) fail(404, 'This patient is not in your care scope.');
  return json({ delta, partition: [id] });
}
