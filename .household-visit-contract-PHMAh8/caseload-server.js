import { identity, loadFor, json } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { caseloadView } from './caseload.js';
// Slice 1b: caseload view for stewards (workload, gaps, transfers, preview) and incoming handovers for workers.
export async function caseloadRead(request) {
    const u = await identity(), url = new URL(request.url), teamId = url.searchParams.get('teamId'), fromUserId = url.searchParams.get('fromUserId');
    if ((teamId && teamId.length > 200) || (fromUserId && fromUserId.length > 200))
        fail(422, 'Choose a worker and a team.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation'));
    const m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Caseloads contain patient information; an administrator role cannot view them.');
    return json(caseloadView(s, m, { teamId, fromUserId }));
}
