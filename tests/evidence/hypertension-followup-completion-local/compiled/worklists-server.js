import { activeOrg, db, identity, json } from './server.js';
import { fail } from './core.js';
import { worklistData, worklistPage, worklistQuery } from './worklists.js';
import { recordWorkList } from './read-audit.js';
// Slice 0b-4: GET /api/worklists?view=work|followups|submissions|referrals&cursor=n:<offset>&limit=&tab=all|attention
// — one page of a work view over the viewer's whole permitted scope, for a paged workspace. No free text, no name
// and no record id travels in the address (slice 6l/6q rules). Membership is read from the database for this request,
// as for /api/patients.
export async function worklistsRead(request) {
    const q = worklistQuery(new URL(request.url));
    const u = await identity(), orgId = await activeOrg(u, request.headers.get('x-saha-organisation'));
    const [m, t] = await db().batch([
        db().prepare('SELECT role,status,is_owner,version FROM memberships WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
        db().prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=?').bind(orgId, u.userId),
    ]);
    const row = m.results[0];
    if (!row || row.status !== 'active')
        fail(403, 'Your organisation membership is inactive or unavailable.');
    const member = { userId: u.userId, role: row.role, status: row.status, isOwner: !!row.is_owner, version: row.version, teamIds: t.results.map(r => r.team_id) };
    const page = worklistPage(await worklistData(db(), orgId, member, q.view), q);
    // Slice 10h: a work-list page is recorded before it is returned (view, page position and row count; no names).
    await recordWorkList(db(), orgId, u, member, q.view, q.attention, q.offset > 0, page.rows.length, page.total);
    return json(page);
}
