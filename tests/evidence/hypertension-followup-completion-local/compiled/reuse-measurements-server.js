import { identity, db, json, runtime } from './server.js';
import { readState, scope } from './store.js';
import { manager } from './indicators.js';
import { ensurePurpose } from './purpose-scope.js';
import { environmentOf } from './environment.js';
import { fail } from './core.js';
import { patientId } from './patient-directory.js';
import { figureRead, figurePost } from './indicator-figures-server.js';
import { boundedJsonBody } from './request-body.js';
import { reuseList, reuseFigure, reuseDefinition, reuseResponse, reuseViewInput } from './reuse-measurements.js';
function output(body, actor, org) { const r = json(body); r.headers.set('x-saha-operation-actor', actor); if (org)
    r.headers.set('x-saha-organisation', org); return r; }
async function context(request) { if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
    fail(409, 'Reuse figure review requires a synthetic or training workspace.'); const actor = await identity(), raw = request.headers.get('x-saha-organisation'), expected = request.headers.get('x-saha-operation-actor'); if (expected && expected !== actor.userId)
    fail(403, 'The signed-in reporting account changed. Refresh access.'); if (!raw)
    return { actor, org: null }; const org = patientId(raw), state = await readState(db(), org, [], actor.userId, true), member = scope(state, actor.userId); manager(member); ensurePurpose(member, 'reporting', state.operations?.purposeGrants); return { actor, org }; }
function internal(request, path, method = 'GET', body) { const url = new URL(request.url); url.pathname = path.split('?')[0]; url.search = path.includes('?') ? '?' + path.split('?').slice(1).join('?') : ''; const headers = new Headers(request.headers); headers.delete('content-length'); if (body !== undefined)
    headers.set('content-type', 'application/json'); return new Request(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
async function checkedMetadata(request, id) { const r = await figureRead(internal(request, '/api/indicator-figures?id=' + encodeURIComponent(id))); if (!r.ok)
    fail(r.status, 'Protected figure metadata is unavailable.'); return reuseDefinition(await r.json()); }
export async function reuseMeasurementsRead(request) {
    const { actor, org } = await context(request), q = new URL(request.url).searchParams;
    if ([...q.keys()].some(k => k !== 'cursor') || q.getAll('cursor').length > 1)
        fail(400, 'Choose a valid figure history page.');
    if (!org) {
        if (q.size)
            fail(400, 'Choose an explicit reporting organisation first.');
        const rows = await db().prepare("SELECT o.id,o.name FROM memberships m JOIN accounts a ON a.user_id=m.user_id JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status='active' AND m.role NOT IN ('asha','admin') AND (m.role='supervisor' OR m.is_owner=1) ORDER BY o.name,o.id").bind(actor.userId).all();
        if (!rows.results.length)
            fail(403, 'Current reporting owner or supervisor access is required.');
        return output(reuseResponse.parse({ kind: 'setup', actorId: actor.userId, organisations: rows.results }), actor.userId);
    }
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'Use the original account from reporting setup.');
    const cursor = q.get('cursor'), r = await figureRead(internal(request, '/api/indicator-figures' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')));
    if (!r.ok)
        fail(r.status, 'Figure history is unavailable.');
    let value;
    try {
        value = reuseList(actor.userId, org, await r.json());
    }
    catch {
        fail(409, 'Stored reporting definitions are unavailable.');
    }
    return output(value, actor.userId, org);
}
export async function reuseMeasurementsView(request) {
    const { actor, org } = await context(request);
    if (!org || request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'Use the original explicit reporting organisation and account.');
    if (new URL(request.url).search)
        fail(400, 'Protected figures do not accept URL selectors.');
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-origin figure views are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this protected figure view.');
    const parsed = reuseViewInput.safeParse(await boundedJsonBody(request, 1000));
    if (!parsed.success)
        fail(422, 'Choose one exact saved published reuse figure.');
    const selected = parsed.data;
    let before;
    try {
        before = await checkedMetadata(request, selected.figureId);
    }
    catch {
        fail(409, 'This published reuse figure is unavailable.');
    }
    if (before.digest !== selected.digest || before.sequence !== selected.sequence)
        fail(409, 'The selected published figure changed.');
    // The original protected POST view owns privacy reservation, audit and current cohort gates.
    // No prepare/review/publish/reissue/clinical command or new query is forwarded.
    const r = await figurePost(internal(request, '/api/indicator-figures', 'POST', { type: 'view', figureId: selected.figureId }));
    if (!r.ok)
        fail(r.status, 'Protected figure values are unavailable.');
    const raw = await r.json(), after = await checkedMetadata(request, selected.figureId);
    if (after.digest !== before.digest || after.sequence !== before.sequence)
        fail(409, 'The selected figure changed while opening.');
    let value;
    try {
        value = reuseFigure(actor.userId, org, raw, selected);
    }
    catch {
        fail(409, 'Protected figure source or cells are inconsistent. Nothing was shown.');
    }
    return output(value, actor.userId, org);
}
