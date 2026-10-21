import { db, identity, loadFor, json, runtime } from './server.js';
import { AppError, fail } from './core.js';
import { persist, readState, scope } from './store.js';
import { allowed } from './access.js';
import { linkTrace } from './trace.js';
import { authenticateOptout, applyReminderOptout, eventIdentity, optoutSchema, requireMockEnvironment } from './reminder-optout.js';
async function bodyOf(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON.');
    const reader = request.body?.getReader();
    if (!reader)
        fail(400, 'Missing opt-out event.');
    let size = 0, raw = '';
    const decoder = new TextDecoder();
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > 4096) {
            await reader.cancel();
            fail(413, 'Opt-out event too large.');
        }
        raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    try {
        return { raw, body: optoutSchema.parse(JSON.parse(raw)) };
    }
    catch {
        fail(422, 'Invalid mock opt-out event.');
    }
}
const serviceActor = (org) => ({ userId: 'mock_reminder_optout_' + org, displayName: 'Mock reminder opt-out provider', email: '' });
async function commitEvent(e, staff) {
    const store = db(), actor = serviceActor(e.organisationId), { key, hash } = await eventIdentity(e);
    for (let attempt = 0; attempt < 3; attempt++) {
        // The callback reaches this read only after HMAC and exact org grant authentication. Staff simulation rechecks scope on every retry.
        const s = staff ? await loadFor(staff, e.organisationId) : await readState(store, e.organisationId), m = staff ? scope(s, staff.userId) : undefined;
        const prior = await store.prepare('SELECT hash,result,org_id,person_id FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId, key).first();
        if (prior) {
            if (m) {
                const savedPatient = s.workspace.people.find(p => p.id === prior.person_id);
                if (!savedPatient || !['asha', 'clinician', 'supervisor'].includes(m.role) || !allowed(m, savedPatient))
                    fail(403, 'Care-team access to this patient is required.');
            }
            if (prior.hash !== hash || prior.org_id !== e.organisationId)
                fail(409, 'This provider event key was already used for different input.');
            return { ...JSON.parse(prior.result), replayed: true };
        }
        const before = structuredClone(s), result = applyReminderOptout(s, e, staff ?? actor, staff ? 'staff-mock-simulation' : 'signed-mock-callback', m);
        linkTrace(before, s, 'reminderOptout', key, (staff ?? actor).userId);
        try {
            await persist(store, before, s, actor, { type: 'reminderOptout' }, key, hash, result);
            return result;
        }
        catch (error) {
            if (!(error instanceof AppError && error.status === 409) || attempt === 2)
                throw error;
        }
    }
    fail(409, 'Opt-out conflict. Retry the same provider event.');
}
export async function reminderOptoutSimulate(request) {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-site changes are not allowed.');
    const staff = await identity();
    requireMockEnvironment(runtime());
    const { body } = await bodyOf(request);
    if (request.headers.get('x-saha-organisation') !== body.organisationId)
        fail(409, 'Choose the active organisation for this simulation.');
    return json(await commitEvent(body, staff));
}
export async function reminderOptoutCallback(request) {
    const { raw, body } = await bodyOf(request);
    await authenticateOptout(raw, body, request.headers.get('x-saha-timestamp') ?? '', request.headers.get('x-saha-signature') ?? '', runtime());
    return json(await commitEvent(body));
}
