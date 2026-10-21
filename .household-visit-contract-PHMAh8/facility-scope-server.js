import { identity, json, loadFor } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { facilityScopeView } from './facility-scope.js';
// Slice feat/r08 (BR-ID-02/BR-OPS-01): the owner-managed facility/geography access policy. Owners see and
// manage the whole configuration; every other active member receives only the version (no facility/team mapping).
export async function facilityScopeRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation'));
    const m = scope(s, u.userId);
    if (m.status !== 'active')
        fail(403, 'Your membership is inactive.');
    return json(facilityScopeView(s, m));
}
