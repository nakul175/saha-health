import { db, identity, loadFor, json } from './server.js';
import { accessRoute, recordAccess } from './access-audit.js';
import { fail, person } from './core.js';
import { scope } from './store.js';
import { abdmView } from './abdm.js';
// Slice 7a: one patient's ABHA link, consent artefacts and an optional consent check (partition load).
export async function abdmRead(request) {
    const u = await identity(), p = new URL(request.url).searchParams, personId = p.get('personId') ?? '';
    if (!personId || personId.length > 200)
        fail(422, 'Choose a person.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation'), async () => [personId]), m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Patient access is required.');
    const date = p.get('date');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        fail(422, 'Use a YYYY-MM-DD date.');
    const target = person(s.workspace, personId), view = abdmView(s, target, { consentId: p.get('consentId'), hiType: p.get('hiType'), date, purpose: p.get('purpose') });
    // Slice 6t: a view that lists records received from outside Saha is a material read, recorded before it is returned.
    if (view.received.length)
        await recordAccess(db(), s, u, m, { action: 'viewExternalRecords', subject: personId, personId, detail: `Received external records listed: ${view.received.length} (ABDM).${accessRoute(m, target)}` });
    return json(view);
}
