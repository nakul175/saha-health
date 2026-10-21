import { db, identity, json, loadFor } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { boundedJsonBody } from './request-body.js';
import { patientId } from './patient-directory.js';
import { OPEN_SOURCES, recordRecordOpened } from './read-audit.js';
// Slice 10h: POST /api/record-opened — the workspace tells the server that the person opened a patient record the browser
// already held (a non-paged workspace carries its whole permitted caseload, so opening a record is otherwise a screen change
// the server never sees). The server checks the record is in the caller's care scope and writes one `openRecord` event before
// answering; the browser does not show the record until the answer arrives. The event is client-reported: it says the
// browser claimed an open, not that the server saw one. Opens through GET /api/patients/detail are recorded there instead.
// A second report for the same viewer and patient within a minute is acknowledged and not recorded again.
export async function recordOpenedPost(request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
        fail(403, 'Cross-origin requests are not allowed.');
    if (request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-site requests are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const body = await boundedJsonBody(request, 600);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['personId', 'source'].includes(k)))
        fail(422, 'Send the patient to open as {personId, source}.');
    const b = body;
    if (typeof b.personId !== 'string')
        fail(422, 'Choose a patient.');
    const source = b.source === undefined ? 'other' : b.source;
    if (typeof source !== 'string' || !OPEN_SOURCES.includes(source))
        fail(422, 'Unknown source of this open.');
    const u = await identity(), id = patientId(b.personId);
    const state = await loadFor(u, request.headers.get('x-saha-organisation'), async () => [id]);
    return json(await recordRecordOpened(db(), state, u, scope(state, u.userId), id, source));
}
