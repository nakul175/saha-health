import { z } from 'zod';
import { identity, db, loadFor, runtime, json, command } from './server.js';
import { scope } from './store.js';
import { fail } from './core.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { recordAccess, accessRoute } from './access-audit.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { boundedJsonBody } from './request-body.js';
import { assistanceProjection } from './assistance-control.js';
const operation = z.object({ personId: z.string(), command: z.object({ type: z.literal('cancelAgent'), visitId: z.string(), runId: z.string() }).strict() }).strict();
async function context(request, id, visitId) { const actor = await identity(), org = request.headers.get('x-saha-organisation'); if (!org)
    fail(400, 'Choose the organisation returned by Today.'); if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
    fail(409, 'Assistance control requires a synthetic or training workspace.'); const now = new Date().toISOString(); const assigned = async () => { const state = await loadFor(actor, org, async () => [id]), member = scope(state, actor.userId); if (member.role !== 'asha')
    fail(403, 'Assistance control requires an active ASHA membership.'); const person = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto); if (!person)
    fail(404, 'This record is not in your assigned care scope.'); const visit = visitId ? state.workspace.visits.find(v => v.id === visitId && v.personId === id && !v.voidedAt && !v.supersededBy && !v.imported) : undefined; if (visitId && !visit)
    fail(404, 'Choose a current local visit of this assigned person.'); return { state, member, person, visit, value: assistanceProjection(state, person, actor.userId, visit, now) }; }; const initial = await assigned(); await recordAccess(db(), initial.state, actor, initial.member, { action: 'viewPatientRecord', subject: id, personId: id, detail: 'Bounded own assistance status and cancellation review.' + accessRoute(initial.member, initial.person) }); const current = await assigned(); if (JSON.stringify(initial.value) !== JSON.stringify(current.value))
    fail(409, 'The request context changed while opening. Refresh before continuing.'); await assertAssignedRead(db(), current.member, org, { personId: id }, current.visit ? { id: current.visit.id, personId: id, minimumVersion: current.visit.version } : undefined); return current.value; }
function response(value, actorId, org) { const r = json(value); r.headers.set('x-saha-operation-actor', actorId); r.headers.set('x-saha-organisation', org); return r; }
export async function assistanceRead(request) { const q = new URL(request.url).searchParams; if (q.getAll('personId').length !== 1 || q.getAll('visitId').length > 1 || [...q.keys()].some(k => !['personId', 'visitId'].includes(k)))
    fail(400, 'Choose one assigned person and at most one existing visit.'); const value = await context(request, patientId(q.get('personId')), q.has('visitId') ? patientId(q.get('visitId')) : undefined); return response(value, value.actorId, value.organisationId); }
export async function assistanceWrite(request) { const actor = await identity(); if (request.headers.get('x-saha-operation-actor') !== actor.userId)
    fail(403, 'The original signed-in account is required to stop or recover this request.'); if (new URL(request.url).search)
    fail(400, 'Cancellation does not accept query selectors.'); const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site')
    fail(403, 'Cross-origin changes are unavailable.'); if (!request.headers.get('content-type')?.startsWith('application/json'))
    fail(415, 'Use JSON for this operation.'); const parsed = operation.safeParse(await boundedJsonBody(request, 4000)); if (!parsed.success)
    fail(422, 'Choose one current request and the supported cancellation operation.'); const id = patientId(parsed.data.personId), visitId = patientId(parsed.data.command.visitId), runId = patientId(parsed.data.command.runId), initial = await context(request, id, visitId); if (!initial.selected?.requests.some(r => r.id === runId && r.actorId === actor.userId))
    fail(404, 'This request does not belong to the selected account and visit.'); const headers = new Headers(request.headers); headers.delete('content-length'); headers.set('x-saha-organisation', initial.organisationId); const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(parsed.data.command) })); const current = await context(request, id, visitId); return response({ outcome: 'cancelled-locally', key: request.headers.get('idempotency-key'), result: result.result, context: current }, actor.userId, initial.organisationId); }
