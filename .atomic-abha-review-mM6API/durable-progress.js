const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const clone = (x) => structuredClone(x);
const authorised = (p, a) => { if (!a.active || a.actorId !== p.actorId || a.organisationId !== p.organisationId || a.purpose !== p.purpose)
    fail(403, 'Current authority no longer permits this recovery action.'); };
const refresh = (p) => { for (const s of p.steps)
    if (s.state === 'blocked' && s.dependsOn.every(id => p.steps.find(x => x.id === id)?.state === 'accepted'))
        s.state = 'ready'; p.state = p.steps.every(s => s.state === 'accepted' || s.state === 'cancelled') ? 'complete' : p.state; };
export function startProgress(input, now) {
    if (!input.steps.length || new Set(input.steps.map(x => x.id)).size !== input.steps.length)
        fail(422, 'Workflow steps must be non-empty and unique.');
    const ids = new Set(input.steps.map(x => x.id));
    for (const s of input.steps)
        if ((s.dependsOn ?? []).some(x => !ids.has(x) || x === s.id))
            fail(422, 'Workflow dependency is invalid.');
    const p = { id: input.id, actorId: input.actorId, organisationId: input.organisationId, purpose: input.purpose, version: 1, state: 'active', steps: input.steps.map(s => ({ id: s.id, dependsOn: s.dependsOn ?? [], state: (s.dependsOn ?? []).length ? 'blocked' : 'ready', actionKey: s.actionKey, payloadHash: s.payloadHash, updatedAt: now })), updatedAt: now };
    return p;
}
export async function advance(p0, stepId, a, expectedVersion, send, now) {
    const p = clone(p0);
    authorised(p, a);
    if (p.version !== expectedVersion)
        fail(409, 'Progress changed; reload before continuing.');
    if (p.state !== 'active')
        fail(409, 'Workflow is no longer active.');
    const s = p.steps.find(x => x.id === stepId);
    if (!s)
        fail(404, 'Step not found.');
    if (s.state === 'accepted' || s.state === 'cancelled')
        return p;
    if (s.state === 'uncertain')
        fail(409, 'Outcome is uncertain. Reconcile the existing action key before any resend.');
    if (s.state !== 'ready' && s.state !== 'failed')
        fail(409, 'Step dependencies are unfinished.');
    s.state = 'running';
    s.updatedAt = now;
    let result;
    try {
        result = await send(s.actionKey, s.payloadHash);
    }
    catch {
        result = { state: 'pending' };
    }
    s.state = result.state === 'accepted' ? 'accepted' : result.state === 'rejected' ? 'failed' : 'uncertain';
    s.receipt = result.receipt;
    s.message = result.state === 'accepted' ? 'Destination accepted this exact action.' : result.state === 'rejected' ? 'Destination rejected this action.' : 'Outcome is unresolved; look up the existing action key.';
    s.updatedAt = now;
    p.version++;
    p.updatedAt = now;
    refresh(p);
    return p;
}
export async function reconcile(p0, stepId, a, expectedVersion, lookup, now) {
    const p = clone(p0);
    authorised(p, a);
    if (p.version !== expectedVersion)
        fail(409, 'Progress changed; reload before continuing.');
    const s = p.steps.find(x => x.id === stepId);
    if (!s)
        fail(404, 'Step not found.');
    if (s.state !== 'uncertain')
        fail(409, 'Only an uncertain step can be reconciled.');
    const r = await lookup(s.actionKey, s.payloadHash);
    if (r.state === 'accepted') {
        s.state = 'accepted';
        s.receipt = r.receipt;
        s.message = 'Existing destination receipt recovered; action was not sent again.';
    }
    else if (r.state === 'rejected') {
        s.state = 'failed';
        s.message = 'Destination confirmed rejection; an explicit retry may now use the same action identity.';
    }
    else {
        s.message = 'Outcome remains unresolved; action was not sent again.';
    }
    s.updatedAt = now;
    p.version++;
    p.updatedAt = now;
    refresh(p);
    return p;
}
export function cancelProgress(p0, a, expectedVersion, now) { const p = clone(p0); authorised(p, a); if (p.version !== expectedVersion)
    fail(409, 'Progress changed; reload before cancelling.'); if (p.steps.some(s => s.state === 'running' || s.state === 'uncertain'))
    fail(409, 'Resolve in-flight or uncertain actions before cancellation.'); for (const s of p.steps)
    if (!['accepted', 'cancelled'].includes(s.state))
        s.state = 'cancelled'; p.state = 'cancelled'; p.version++; p.updatedAt = now; return p; }
export function privateView(p, a) { authorised(p, a); return clone(p); }
export function cleanupPrivate(p0, a, now) { const p = clone(p0); authorised(p, a); for (const s of p.steps) {
    delete s.message;
    if (s.state === 'cancelled')
        delete s.receipt;
} p.updatedAt = now; return p; }
