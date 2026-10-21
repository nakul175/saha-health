import { z } from 'zod';
import { db, identity, json, loadFor, runtime, command } from './server.js';
import { AppError, fail } from './core.js';
import { scope } from './store.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { recordAccess, accessRoute } from './access-audit.js';
import { boundedJsonBody } from './request-body.js';
import { routineVisit } from './routine-visit.js';
import { visitLifecycle } from './lifecycle-status.js';
import { assertAssignedRead } from './routine-read-guard.js';
const operation = z.object({ personId: z.string(), command: z.record(z.unknown()) }).strict();
const permitted = new Set(['startVisit', 'saveVisit', 'saveProgrammeAnswers', 'confirmVisit']);
function routineJson(value, actor, status = 200) {
    const response = json(value, status);
    response.headers.set('X-Saha-Operation-Actor', actor.userId);
    return response;
}
async function assignedContext(actor, organisationId, id, selected, discoverDraft = true) {
    const state = await loadFor(actor, organisationId, async () => [id]);
    const member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'Routine capture requires an active ASHA membership.');
    const person = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
    if (!person)
        fail(404, 'This record is not in your assigned care scope.');
    const visit = selected
        ? state.workspace.visits.find(v => v.id === selected && v.personId === id)
        : discoverDraft ? state.workspace.visits.find(v => v.personId === id && v.state === 'draft' && !v.voidedAt && !v.supersededBy) : undefined;
    if (selected && !visit)
        fail(404, 'This visit does not belong to the selected person.');
    return { state, member, person, visit };
}
async function context(request, id, selected, organisationId = request.headers.get('x-saha-organisation')) {
    const actor = await identity();
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Routine capture requires a synthetic or training workspace.');
    const { state, member, person, visit } = await assignedContext(actor, organisationId, id, selected);
    await recordAccess(db(), state, actor, member, {
        action: 'viewPatientRecord', subject: id, personId: id,
        detail: `Bounded routine visit context.${accessRoute(member, person)}`,
    });
    // Audit persistence can wait/retry. Revalidate this exact selection afterwards;
    // never resolve a now-revoked omitted organisation into an account's fallback.
    // Return the audited snapshot, not a newly discovered unaudited draft.
    await assertAssignedRead(db(), member, state.organisation.id, { personId: id }, visit
        ? { id: visit.id, personId: id, currentDraft: !selected } : undefined);
    return { organisationId: state.organisation.id,
        person: { id: person.id, name: person.name, village: person.village, age: person.age, sex: person.sex, version: person.version },
        visit: visit ? routineVisit(visit) : null,
        lifecycle: visitLifecycle(visit ?? null, visit ? state.workspace.submissions.filter(item => item.personId === id) : []) };
}
export async function routineRead(request) {
    const actor = await identity();
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(k => !['personId', 'visitId'].includes(k)) ||
        query.getAll('personId').length !== 1 || query.getAll('visitId').length > 1)
        fail(400, 'Choose one person and at most one visit.');
    const id = patientId(query.get('personId'));
    const selected = query.has('visitId') ? patientId(query.get('visitId')) : undefined;
    return routineJson(await context(request, id, selected), actor);
}
export async function routineWrite(request) {
    const actor = await identity();
    // An expected actor binds original intent; it never supplies authentication.
    // Refuse before reading protected context or dispatching under another account.
    const expectedActor = request.headers.get('x-saha-operation-actor');
    if (expectedActor !== null && expectedActor !== actor.userId)
        fail(403, 'The signed-in account changed. Recover the original attempt with the original account.');
    if (new URL(request.url).search)
        fail(400, 'Routine changes do not accept query selectors.');
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-origin changes are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const parsed = operation.safeParse(await boundedJsonBody(request, 20000));
    if (!parsed.success)
        fail(422, 'Choose one person and one supported routine operation.');
    const input = parsed.data, id = patientId(input.personId), c = input.command;
    if (typeof c.type !== 'string' || !permitted.has(c.type))
        fail(422, 'Unsupported routine operation.');
    if (c.type !== 'startVisit' && typeof c.visitId !== 'string')
        fail(422, 'Choose a visit reference.');
    const selected = c.type === 'startVisit' ? undefined : patientId(c.visitId);
    const initial = await context(request, id, selected);
    if (c.type === 'startVisit' && c.personId !== id)
        fail(409, 'The operation belongs to another person.');
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.set('x-saha-organisation', initial.organisationId);
    // The existing dispatcher remains the only writer, including version, purpose, receipt and audit checks.
    let result;
    try {
        result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(c) }));
    }
    catch (cause) {
        const key = request.headers.get('idempotency-key');
        if (!(cause instanceof AppError) || cause.status !== 409 || !selected || !key ||
            !['saveVisit', 'saveProgrammeAnswers', 'confirmVisit'].includes(c.type) ||
            typeof c.version !== 'number' || !Number.isSafeInteger(c.version) || c.version < 1)
            throw cause;
        const current = await context(request, id, selected, initial.organisationId);
        if (!current.visit || !Number.isSafeInteger(current.visit.version) || current.visit.version <= c.version)
            throw cause;
        const actor = await identity();
        const saved = await db().prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?')
            .bind(actor.userId, key).first();
        if (saved)
            throw cause;
        // The receipt lookup is another awaited storage operation. Current authority
        // and exact visit ownership must still hold before exposing refusal metadata.
        const auditedMember = (await assignedContext(actor, current.organisationId, id, selected, false)).member;
        await assertAssignedRead(db(), auditedMember, current.organisationId, { personId: id }, { id: selected, personId: id, minimumVersion: current.visit.version });
        // Receipt absence alone is not an outcome. The higher visit version also
        // prevents any in-flight old-version command from passing the existing atomic CAS.
        const refused = { outcome: 'not-applied-stale-version', key,
            organisationId: current.organisationId, personId: id, visitId: selected,
            expectedVersion: c.version, currentVersion: current.visit.version };
        return routineJson({ error: cause.message, operation: refused }, actor, 409);
    }
    const visitId = c.type === 'startVisit' ? result.result?.visitId : selected;
    return routineJson({ result: result.result, replayed: Boolean(result.replayed),
        context: await context(request, id, typeof visitId === 'string' ? visitId : selected, initial.organisationId) }, actor);
}
