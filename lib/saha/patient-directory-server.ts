import { activeOrg, db, identity, json, loadFor, snapshotFor } from './server';
import { digest, fail } from './core';
import { scope } from './store';
import { accessRoute, recordAccess } from './access-audit';
import { recordPatientList } from './read-audit';
import { boundedJsonBody } from './request-body';
import { pageQuery, patientId, patientPage } from './patient-directory';
import { reportingPatientAccess } from './reporting-patient-access';
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
  const member = { userId: u.userId, role: row.role, status: row.status, isOwner: !!row.is_owner, version: row.version, teamIds: (t.results as { team_id: string }[]).map(r => r.team_id) } as Member;
  const query = pageQuery(source), page = await patientPage(db(), orgId, member, query);
  // Slice 10h: a patient list or search is recorded before the rows are returned: its kind and result count, never the search text.
  await recordPatientList(db(), orgId, u, member, { text: !!query.q, programme: !!query.programme, later: !!query.cursor }, page.rows.length, page.total);
  return json(page);
}

// Slice 0b-3: GET /api/patients/detail?personId= — the patient partition snapshot for one permitted
// patient, in the same shape as a command delta, for the workspace to merge when the record is opened.
export async function patientDetailRead(request: Request) {
  const u = await identity(), url = new URL(request.url), id = patientId(url.searchParams.get('personId'));
  const context = url.searchParams.get('context') ?? 'care', format = url.searchParams.get('format') ?? 'json';
  if (!['care', 'reporting'].includes(context)) fail(400, 'Choose care or reporting patient access.');
  if (!['json', 'download'].includes(format)) fail(400, 'Choose a supported patient record format.');
  if (format === 'download' && context !== 'reporting') fail(403, 'Patient exports require an approved reporting purpose and separate patient access.');
  const state = await loadFor(u, request.headers.get('x-saha-organisation'), async () => [id]);
  const reportingGate = (current: typeof state) => {
    const member = scope(current, u.userId), person = current.workspace.people.find(x => x.id === id);
    if (!person) fail(404, 'This patient is not in your care scope.');
    if (context === 'reporting') reportingPatientAccess(current, member, person);
    return { member, person };
  };
  const initial = reportingGate(state), delta = await snapshotFor(state, u);
  if (!delta.people.some(p => p.id === id)) fail(404, 'This patient is not in your care scope.');
  // Slice 6t: opening the full record is a material read, recorded before the record is returned.
  const basis = await digest({ organisation: state.organisation.id, revision: state.organisation.revision, patientRevision: state.organisation.patientRevision ?? 0, member: initial.member, person: initial.person, purposeGrants: state.operations?.purposeGrants ?? null, delegations: state.operations?.delegations ?? null });
  await recordAccess(db(), state, u, initial.member, { action: 'viewPatientRecord', subject: id, personId: id, detail: `${context === 'reporting' ? format === 'download' ? 'Patient record exported from reporting context' : 'Patient record opened from reporting context' : 'Full patient record opened'}: ${delta.visits.length} visit${delta.visits.length === 1 ? '' : 's'}, ${delta.referrals.length} referral${delta.referrals.length === 1 ? '' : 's'}.${accessRoute(initial.member, initial.person)}` });
  // Audit is fail-closed and authority is checked again afterwards. A purpose, delegation,
  // membership, patient-scope or record change during preparation returns no patient content.
  if (context === 'reporting') {
    const fresh = await loadFor(u, state.organisation.id, async () => [id]), current = reportingGate(fresh);
    const currentBasis = await digest({ organisation: fresh.organisation.id, revision: fresh.organisation.revision, patientRevision: fresh.organisation.patientRevision ?? 0, member: current.member, person: current.person, purposeGrants: fresh.operations?.purposeGrants ?? null, delegations: fresh.operations?.delegations ?? null });
    if (currentBasis !== basis) fail(409, 'Patient reporting authority or record changed while it was prepared. Refresh before viewing or exporting it.');
  }
  const body = { delta, partition: [id] };
  if (format === 'download') return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="saha-patient-${id}.json"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  return json(body);
}
