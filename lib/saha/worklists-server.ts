import { activeOrg, db, identity, json } from './server';
import { fail } from './core';
import { worklistData, worklistPage, worklistQuery } from './worklists';
import type { Member } from './types';

// Slice 0b-4: GET /api/worklists?view=work|followups|submissions|referrals&cursor=n:<offset>&limit=&tab=all|attention
// — one page of a work view over the viewer's whole permitted scope, for a paged workspace. No free text, no name
// and no record id travels in the address (slice 6l/6q rules). Membership is read from the database for this request,
// as for /api/patients.
export async function worklistsRead(request: Request) {
  const q = worklistQuery(new URL(request.url));
  const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation'));
  const [m, t] = await db().batch([
    db().prepare('SELECT role,status,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
    db().prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
  ]);
  const row = (m.results as Record<string, any>[])[0];
  if (!row || row.status !== 'active') fail(403, 'Your organisation membership is inactive or unavailable.');
  const member = { userId: u.userId, role: row.role, status: row.status, isOwner: !!row.is_owner, teamIds: (t.results as { team_id: string }[]).map(r => r.team_id) } as Member;
  return json(worklistPage(await worklistData(db(), orgId, member, q.view), q));
}
