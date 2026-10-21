import { identity, loadFor, json, db } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { mergeView } from './merge.js';
// Slice 1c: merge cases for one person. Loads the person and every record named in their cases.
export async function mergeRead(request) {
    const u = await identity(), personId = new URL(request.url).searchParams.get('personId') ?? '';
    if (!personId || personId.length > 200)
        fail(422, 'Choose a person.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation'), async (orgId) => {
        const rows = await db().prepare('SELECT survivor_id,duplicate_id FROM identity_cases WHERE org_id=? AND (survivor_id=? OR duplicate_id=?) LIMIT 200').bind(orgId, personId, personId).all();
        return [...new Set([personId, ...rows.results.flatMap(r => [r.survivor_id, r.duplicate_id])])];
    });
    const m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Patient access is required.');
    return json(mergeView(s, m, personId));
}
