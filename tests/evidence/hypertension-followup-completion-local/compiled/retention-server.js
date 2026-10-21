import { identity, loadFor, json, db } from './server.js';
import { scope } from './store.js';
import { retentionReview, yearsAgo } from './retention.js';
// Slice 6c: retention schedule, holds and eligibility counts for organisation owners.
export async function retentionRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), now = new Date().toISOString();
    const rule = s.retention?.policies.at(-1)?.rules.find(r => r.recordClass === 'audit-event');
    const total = await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').bind(s.organisation.id).first();
    const past = rule ? await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND at<?').bind(s.organisation.id, yearsAgo(now, rule.years)).first() : null;
    return json(retentionReview(s, m, { total: total?.n ?? 0, pastSchedule: past?.n ?? 0 }, now));
}
