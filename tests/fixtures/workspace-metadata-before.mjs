// Frozen read-only oracle from 23cbcf89, before response batching.
// Changes to policy require explicitly updating this historical parity fixture.
const j=JSON.stringify;const SUMMARY_ACCESS_ACTIONS=['viewWorkspace','searchPatients','listPatients','viewAggregate'];
export async function auditPage(db, orgId, userId, cursor = null, summaries = false) {
    const q = `SELECT a.* FROM audit_events a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=? AND m.status='active' WHERE a.org_id=? AND ((a.person_id IS NULL AND (m.is_owner=1 OR m.role='admin')) OR EXISTS (SELECT 1 FROM patients p JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=m.user_id WHERE p.org_id=a.org_id AND p.id=a.person_id AND m.role NOT IN ('admin','provider') AND (m.role!='asha' OR p.assigned_to=m.user_id)))${summaries ? '' : ` AND a.action NOT IN (${SUMMARY_ACCESS_ACTIONS.map(x => `'${x}'`).join(',')})`}${cursor ? ' AND (a.at<? OR (a.at=? AND a.id<?))' : ''} ORDER BY a.at DESC,a.id DESC LIMIT 101`;
    const result = await db.prepare(q).bind(userId, orgId, ...(cursor ? [cursor[0], cursor[0], cursor[1]] : [])).all();
    const rows = result.results.slice(0, 100), last = rows.at(-1);
    return { events: rows.map(r => ({ id: r.id, at: r.at, actor: r.actor_name, actorId: r.actor_id, role: r.role, action: r.action, subject: r.subject, detail: r.detail, personId: r.person_id })), nextCursor: result.results.length > 100 ? j([last.at, last.id]) : null };
}

export async function snapshotDecorationsBefore(db,orgId,userId){const orgs=await db.prepare('SELECT o.id,o.name,m.role,m.is_owner FROM memberships m JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status=? ORDER BY o.created_at').bind(userId,'active').all();const migration=await db.prepare('SELECT migrated_at,counts FROM legacy_migrations WHERE org_id=?').bind(orgId).first();const activity=await auditPage(db,orgId,userId);return {orgs:orgs.results,migration,activity};}
