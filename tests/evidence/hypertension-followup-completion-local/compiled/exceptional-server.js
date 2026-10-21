import { identity, loadFor, json } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { exceptionalView } from './exceptional.js';
// Slice 6a: the viewer's emergency-access grants and the grants they may review.
export async function exceptionalRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Patient access is required.');
    return json(exceptionalView(s, m));
}
