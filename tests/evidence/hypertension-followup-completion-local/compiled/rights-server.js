import { identity, loadFor, json } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { rightsView } from './rights.js';
// Slice 6b: rights requests for one patient (partition load), or open requests across the viewer's scope.
export async function rightsRead(request) {
    const u = await identity(), personId = new URL(request.url).searchParams.get('personId');
    if (personId !== null && (!personId || personId.length > 200))
        fail(422, 'Choose a person.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation'), personId ? async () => [personId] : undefined);
    const m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Rights requests contain patient information; an administrator role cannot view them.');
    return json(rightsView(s, m, personId));
}
