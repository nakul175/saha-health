import { identity, loadFor, json } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { delegationView } from './delegation.js';
// Slice 1e: delegations the viewer granted or holds (owners see all), and what the viewer may delegate.
export async function delegationsRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation'));
    const m = scope(s, u.userId);
    if (m.status !== 'active')
        fail(403, 'Your membership is inactive.');
    return json(delegationView(s, m));
}
