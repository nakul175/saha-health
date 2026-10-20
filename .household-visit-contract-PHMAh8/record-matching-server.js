import { db, identity, json, loadFor, runtime } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { environmentOf } from './environment.js';
import { ensurePurpose } from './purpose-scope.js';
import { recordAccess, accessRoute } from './access-audit.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { patientId } from './patient-directory.js';
import { patientMatches } from './continuity.js';
import { boundedJsonBody } from './request-body.js';
import { matchingOperation, matchingResponse, matchingSetup } from './record-matching.js';
import { assertMatchingPurpose } from './record-matching-purpose.js';
function environment() { if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
    fail(409, 'Record matching requires a synthetic or training workspace.'); }
function organisation(request) { const org = request.headers.get('x-saha-organisation'); if (!org)
    fail(400, 'Choose an explicit organisation.'); return patientId(org); }
async function current(actor, org, query) {
    const state = await loadFor(actor, org, query ? undefined : async () => []), member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'Record matching requires an active ASHA membership.');
    ensurePurpose(member, 'care-coordination', state.operations?.purposeGrants);
    const teams = state.teams.filter(t => member.teamIds.includes(t.id)).map(t => ({ id: t.id, name: t.name }));
    const ids = state.workspace.people.filter(p => p.assigned && p.assignedTo === actor.userId && !p.mergedInto).map(p => p.id).sort();
    const result = query ? await patientMatches(state, member, query) : null;
    if (result?.candidates.some(p => !ids.includes(p.id)))
        fail(409, 'Your current assigned care scope changed. Search again.');
    const fingerprint = JSON.stringify({ member: { role: member.role, status: member.status, version: member.version, isOwner: member.isOwner, teams: [...member.teamIds].sort() }, teams, ids, result });
    return { state, member, teams, ids, result, fingerprint };
}
function response(body, actor, org) { const r = json(body); r.headers.set('x-saha-operation-actor', actor.userId); r.headers.set('x-saha-organisation', org); return r; }
export async function recordMatchingSetup(request) {
    environment();
    if (new URL(request.url).search)
        fail(400, 'Matching setup does not accept query selectors.');
    const actor = await identity(), org = organisation(request), c = await current(actor, org);
    return response(matchingSetup.parse({ organisationId: org, actorId: actor.userId, teams: c.teams }), actor, org);
}
export async function recordMatchingRead(request) {
    environment();
    const actor = await identity(), org = organisation(request);
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'The signed-in account changed. Refresh before searching.');
    const url = new URL(request.url), origin = request.headers.get('origin');
    if (url.search)
        fail(400, 'Send demographic search only in the request body.');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-origin searches are unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this search.');
    const parsed = matchingOperation.safeParse(await boundedJsonBody(request, 3000));
    if (!parsed.success)
        fail(422, 'Enter valid demographics and one supported search or selection.');
    const input = parsed.data, initial = await current(actor, org, input.query), result = initial.result;
    let selected = null;
    if (input.type === 'select') {
        if (result.overflow || result.hash !== input.hash)
            fail(409, 'Matches changed or exceeded the limit. Search and choose again.');
        const c = result.candidates.find(p => p.id === input.personId && p.version === input.version);
        if (!c)
            fail(409, 'The selected existing record changed. Search and choose again.');
        const person = initial.state.workspace.people.find(p => p.id === c.id);
        await recordAccess(db(), initial.state, actor, initial.member, { action: 'viewPatientRecord', subject: c.id, personId: c.id, detail: `Explicit possible-match selection; no identity link or merge.${accessRoute(initial.member, person)}` });
        selected = { id: person.id, name: person.name, age: person.age, sex: person.sex, village: person.village, version: person.version, identityState: c.identityState };
    }
    else
        await recordAccess(db(), initial.state, actor, initial.member, { action: 'searchPatients', subject: org, personId: null, detail: `Bounded demographic possible-match search; ${result.candidates.length} candidate rows${result.overflow ? ' (limited)' : ''}; entered values not recorded. No identity decision.` });
    const fresh = await current(actor, org, input.query);
    if (fresh.fingerprint !== initial.fingerprint)
        fail(409, 'Records or permissions changed during the read. Search again.');
    // Preserve the existing guard's statements/results and add only a purpose proof
    // to its same atomic snapshot; the original guard does not carry a named flow.
    const database = db();
    let batches = 0;
    const consistent = new Proxy(database, { get(target, key) {
            if (key === 'batch')
                return async (statements) => {
                    const rows = await target.batch([...statements, target.prepare("SELECT json_type(data) AS root_type,data FROM operations WHERE org_id=?").bind(org)]);
                    const proof = rows.pop();
                    assertMatchingPurpose(fresh.member, proof?.results);
                    batches++;
                    return rows;
                };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        } });
    await assertAssignedRead(consistent, fresh.member, org, { ids: fresh.ids });
    if (batches !== 1)
        fail(503, 'Current matching scope is unavailable.');
    return response(matchingResponse.parse({ organisationId: org, actorId: actor.userId, ...fresh.result, selected }), actor, org);
}
