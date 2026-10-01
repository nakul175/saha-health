import { activeOrg, db, identity, json, loadFor, snapshotFor } from './server';
import { fail } from './core';
import { scope } from './store';
import { accessRoute, recordAccess } from './access-audit';
import { boundedJsonBody } from './request-body';
import { pageQuery, patientId, patientPage } from './patient-directory';
import type { Member } from './types';

// Slice 0b-3: GET /api/patients — one page of the viewer's permitted patients, searchable by name,
// village or id and filterable by programme. Membership is read from the database for this request.
// Slice 6q: GET serves unsearched paging only; search text is sent with POST in a JSON body.
export async function patientsRead(request: Request) {
  let source: URL | Record<string, unknown> = new URL(request.url);
  if (request.method === 'POST') {
    const origin = request.headers.get('origin'); if (origin && origin !== source.origin) fail(403, 'Cross-origin requests are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Use JSON for this operation.');
    const body = await boundedJsonBody(request, 2000); if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid patient list request.');
    source = body as Record<string, unknown>;
  } else if (source.searchParams.has('q')) fail(400, 'Send search text in the request body (POST), not in the address.');
  const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation'));
  const [m, t] = await db().batch([
    db().prepare('SELECT role,status,is_owner,version,created_at FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
    db().prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
  ]);
  const row = (m.results as Record<string, any>[])[0];
  if (!row || row.status !== 'active') fail(403, 'Your organisation membership is inactive or unavailable.');
  const member = { userId: u.userId, role: row.role, status: row.status, isOwner: !!row.is_owner, teamIds: (t.results as { team_id: string }[]).map(r => r.team_id) } as Member;
  return json(await patientPage(db(), orgId, member, pageQuery(source)));
}

// Slice 0b-3: GET /api/patients/detail?personId= — the patient partition snapshot for one permitted
// patient, in the same shape as a command delta, for the workspace to merge when the record is opened.
export async function patientDetailRead(request: Request) {
  const u = await identity(), id = patientId(new URL(request.url).searchParams.get('personId'));
  const state = await loadFor(u, request.headers.get('x-saha-organisation'), async () => [id]);
  const delta = await snapshotFor(state, u);
  if (!delta.people.some(p => p.id === id)) fail(404, 'This patient is not in your care scope.');
  // Slice 6t: opening the full record is a material read, recorded before the record is returned.
  const m = scope(state, u.userId), p = state.workspace.people.find(x => x.id === id)!;
  await recordAccess(db(), state, u, m, { action: 'viewPatientRecord', subject: id, personId: id, detail: `Full patient record opened: ${delta.visits.length} visit${delta.visits.length === 1 ? '' : 's'}, ${delta.referrals.length} referral${delta.referrals.length === 1 ? '' : 's'}.${accessRoute(m, p)}` });
  return json({ delta, partition: [id] });
}
