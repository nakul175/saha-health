import { identity, loadFor, json } from './server.js';
import { scope } from './store.js';
import { lostWork } from './reassignment.js';
// Slice r74: the monitored queue of work whose owner was lost (BR-CARE-01, BR-REP-01). A viewer-scoped
// organisation read; supervisors and owners see their teams, care workers their own care scope.
export async function reassignmentRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation'), undefined, true), m = scope(s, u.userId);
    return json(lostWork(s, m));
}
