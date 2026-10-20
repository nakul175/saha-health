// Slice feat/r13 (BR-ID-09): managed service identities for connectors and agents.
//
// A service identity is a machine credential distinct from a signed-in person (Principal in
// identity.ts). An organisation owner creates one that names a single connector (mis/ehr/abdm
// integration) or agent (ai integration) it may act for, an accountable (named) owner and an
// expiry. External-call paths must reference a service identity only through
// requireServiceIdentity, which refuses missing, revoked, expired or out-of-scope identities
// (fail closed). Human identity resolution is unchanged.
import { z } from 'zod';
import { fail, uuid } from './core.js';
import { serviceIdentityIsValid } from './identity.js';
const name = z.string().trim().min(3, 'Name the service identity in at least 3 characters.').max(80).regex(/^[^\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]+$/, 'Remove control characters from the name.');
const id = z.string().trim().min(1).max(200);
const version = z.number().int().min(0);
const isoDateTime = z.string().trim().min(1).max(40).refine(x => !Number.isNaN(Date.parse(x)), 'Enter a valid expiry date and time.');
const intents = z.array(z.enum(['send', 'lookup', 'probe'])).min(1).max(3).refine(x => new Set(x).size === x.length, 'Choose each service tool once.');
export const serviceIdentitySchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('serviceIdentityCreate'), version, name, kind: z.enum(['connector', 'agent']), targetId: id, ownerId: id, expiresAt: isoDateTime, intents: intents.optional() }).strict(),
    z.object({ type: z.literal('serviceIdentityRotate'), version, id, name: name.optional(), expiresAt: isoDateTime, intents: intents.optional() }).strict(),
    z.object({ type: z.literal('serviceIdentityRevoke'), version, id }).strict(),
    z.object({ type: z.literal('serviceIdentityBind'), version, targetId: id, serviceIdentityId: id }).strict(),
]);
// A minimal operations document so a service identity can be created before any other operations
// command has touched the organisation. Mirrors defaultOperations() without importing it (which
// would form a module cycle).
const emptyOperations = () => ({ version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null });
export const independentTargets = ["openai", "independent:anaemia", "frontline:oral-saathi", "frontline:skin-saathi", "frontline:shishu-breath", "frontline:matri-check", "frontline:poshan-check", "frontline:teeka-reader", "frontline:dawa-follow", "frontline:report-reader"];
// One effective agreement API for clinical preparation and the fresh service checkpoint.
export function frontlineAgreement(s, appId) { return s.operations?.frontlineProviders?.[appId] ?? { active: true, version: 1, by: 'synthetic-bootstrap', at: s.organisation.createdAt }; }
const CONNECTOR_KINDS = ['mis', 'ehr', 'abdm'];
// The target a service identity may act for: an active connector (programme/EHR/ABDM) or agent (AI).
export function resolveServiceIdentityTarget(s, kind, targetId) {
    if (independentTargets.includes(targetId)) {
        if (kind !== 'agent')
            fail(422, 'Independent providers require an agent identity.');
        return { id: targetId, name: targetId, kind: 'ai', status: 'active' };
    }
    const i = s.workspace.integrations.find(x => x.id === targetId);
    if (!i || i.status !== 'active')
        fail(422, 'Choose an active connection for this service identity.');
    if (kind === 'connector' && !CONNECTOR_KINDS.includes(i.kind))
        fail(422, 'A connector service identity must name a programme, EHR or ABDM connection.');
    if (kind === 'agent' && i.kind !== 'ai')
        fail(422, 'An agent service identity must name an AI provider.');
    return i;
}
// Owner lifecycle for service identities. Returns null when the input is not a service-identity
// command (so applyOperations can fall through); throws AppError on any refused change.
export function applyServiceIdentity(s, input, u, m) {
    const parsed = serviceIdentitySchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    if (!m.isOwner)
        fail(403, 'Only an organisation owner can manage service identities.');
    const ops = (s.operations ??= emptyOperations());
    if (c.version !== ops.version)
        fail(409, 'Service identities changed. Refresh and review the latest state.');
    const now = new Date().toISOString();
    const list = (ops.serviceIdentities ??= []);
    let result = { ok: true };
    if (c.type === 'serviceIdentityCreate') {
        if (list.length >= 100)
            fail(422, 'At most 100 service identities per organisation.');
        if (list.some(x => x.name.toLowerCase() === c.name.toLowerCase()))
            fail(409, 'A service identity with this name already exists.');
        const expiresAt = new Date(c.expiresAt).toISOString();
        if (Date.parse(expiresAt) <= Date.now())
            fail(422, 'The expiry must be in the future.');
        resolveServiceIdentityTarget(s, c.kind, c.targetId);
        const owner = s.members.find(x => x.userId === c.ownerId && x.status === 'active' && (x.isOwner || x.role === 'admin'));
        if (!owner)
            fail(422, 'Choose an active owner or administrator as the accountable owner.');
        const si = { id: uuid(), name: c.name, kind: c.kind, targetId: c.targetId, ownerId: owner.userId, ownerName: owner.displayName, createdAt: now, createdBy: u.userId, expiresAt, intents: c.intents ?? ['send', 'lookup'], status: 'active' };
        list.push(si);
        result = { serviceIdentityId: si.id, expiresAt };
    }
    else if (c.type === 'serviceIdentityRotate') {
        const previous = list.find(x => x.id === c.id);
        if (!previous)
            fail(404, 'Service identity not found.');
        if (previous.status !== 'active')
            fail(409, 'Only an active service identity can be rotated.');
        requireServiceIdentity(s, previous.id, previous.kind, previous.targetId);
        const expiresAt = new Date(c.expiresAt).toISOString();
        if (Date.parse(expiresAt) <= Date.now())
            fail(422, 'The expiry must be in the future.');
        const nextName = c.name ?? `${previous.name} rotation`;
        if (list.some(x => x.id !== previous.id && x.name.toLowerCase() === nextName.toLowerCase()))
            fail(409, 'A service identity with this name already exists.');
        const successor = { id: uuid(), name: nextName, kind: previous.kind, targetId: previous.targetId, ownerId: previous.ownerId, ownerName: previous.ownerName, createdAt: now, createdBy: u.userId, expiresAt, intents: c.intents ?? previous.intents ?? ['send', 'lookup'], rotatedFrom: previous.id, status: 'active' };
        previous.status = 'revoked';
        previous.revokedAt = now;
        previous.revokedBy = u.userId;
        previous.rotatedTo = successor.id;
        list.push(successor);
        if (ops.serviceBindings?.[previous.targetId] === previous.id)
            ops.serviceBindings[previous.targetId] = successor.id;
        result = { serviceIdentityId: successor.id, rotatedFrom: previous.id, expiresAt };
    }
    else if (c.type === 'serviceIdentityBind') {
        const kind = s.workspace.integrations.find(x => x.id === c.targetId)?.kind === 'ai' || independentTargets.includes(c.targetId) ? 'agent' : 'connector';
        if (s.workspace.integrations.find(x => x.id === c.targetId)?.kind === 'abdm')
            fail(422, 'ABDM is a local simulator. Live service dispatch is not available to bind.');
        resolveServiceIdentityTarget(s, kind, c.targetId);
        requireServiceIdentity(s, c.serviceIdentityId, kind, c.targetId);
        (ops.serviceBindings ??= {})[c.targetId] = c.serviceIdentityId;
        result = { serviceIdentityId: c.serviceIdentityId, targetId: c.targetId };
    }
    else {
        const si = list.find(x => x.id === c.id);
        if (!si)
            fail(404, 'Service identity not found.');
        if (si.status === 'revoked')
            fail(409, 'This service identity is already revoked.');
        si.status = 'revoked';
        si.revokedAt = now;
        si.revokedBy = u.userId;
        result = { serviceIdentityId: si.id, revoked: true };
    }
    ops.version++;
    ops.updatedAt = now;
    s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: s.organisation.id, detail: c.type === 'serviceIdentityCreate' ? `Service identity "${c.name}" created for ${c.kind} "${c.targetId}"; accountable owner ${s.members.find(x => x.userId === c.ownerId)?.displayName ?? c.ownerId}; tools ${(c.intents ?? ['send', 'lookup']).join(', ')}; expires ${c.expiresAt}.` : c.type === 'serviceIdentityRotate' ? `Service identity ${c.id} rotated to ${result.serviceIdentityId}; target and accountable owner retained; tools ${(list.find(x => x.id === result.serviceIdentityId)?.intents ?? []).join(', ')}; expires ${c.expiresAt}.` : c.type === 'serviceIdentityBind' ? `Service identity ${c.serviceIdentityId} bound to ${c.targetId} by ${u.displayName}.` : `Service identity ${c.id} revoked by ${u.displayName}.` });
    return result;
}
// Enforcement for external-call paths: only a valid (active), unexpired service identity scoped to
// exactly this connector or agent may be referenced. Throws AppError otherwise (fail closed).
export function requireServiceIdentity(s, serviceIdentityId, kind, targetId, now = Date.now()) {
    const si = (s.operations?.serviceIdentities ?? []).find(x => x.id === serviceIdentityId);
    if (!si)
        fail(404, 'Service identity not found.');
    if (si.kind !== kind)
        fail(403, 'This service identity is not scoped to this kind of external call.');
    if (si.targetId !== targetId)
        fail(403, 'This service identity is scoped to a different connector or agent.');
    if (si.status !== 'active')
        fail(403, 'This service identity has been revoked.');
    if (!serviceIdentityIsValid(si, now))
        fail(403, 'This service identity has expired.');
    if (!s.members.some(x => x.userId === si.ownerId && x.status === 'active' && (x.isOwner || x.role === 'admin')))
        fail(403, 'The accountable service owner is no longer eligible.');
    return si;
}
// Non-throwing form of the same gate, for callers that already branch on validity.
export function validServiceIdentity(s, serviceIdentityId, kind, targetId, now = Date.now()) {
    const si = (s.operations?.serviceIdentities ?? []).find(x => x.id === serviceIdentityId);
    return !!si && s.members.some(x => x.userId === si.ownerId && x.status === 'active' && (x.isOwner || x.role === 'admin')) && si.kind === kind && si.targetId === targetId && serviceIdentityIsValid(si, now);
}
export function requireServiceIntent(si, intent) {
    if (si.intents === undefined)
        return si;
    if (!Array.isArray(si.intents) || !si.intents.includes(intent))
        fail(403, `This service identity is not allowed to ${intent}.`);
    return si;
}
