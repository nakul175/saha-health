import { z } from 'zod';
import { identity, db, json, runtime, command } from './server.js';
import { readState, scope } from './store.js';
import { fail, digest } from './core.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { ensurePurpose } from './purpose-scope.js';
import { recordAccess } from './access-audit.js';
import { boundedJsonBody } from './request-body.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { crosswalkCorrectionSchema, correctionDestination } from './crosswalk-correction.js';
import { identityLinkOperation, identityLinkSaved } from './identity-link-review.js';
import { projectIdentityLinks } from './identity-link-review-projection.js';
import { identityLinkTransferReadProof, IDENTITY_LINK_TRANSFER_PROOF_SQL } from './identity-link-read-guard.js';
const SQL = [
    'SELECT id,revision FROM organisations WHERE id=?',
    'SELECT user_id,role,status,version,is_owner FROM memberships WHERE org_id=? ORDER BY user_id',
    'SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id',
    'SELECT data FROM operations WHERE org_id=?',
    'SELECT id,version,team_id,assigned_to,data FROM patients WHERE org_id=? AND id=?',
    'SELECT id,version,kind,status,data FROM integrations WHERE org_id=? ORDER BY id',
    IDENTITY_LINK_TRANSFER_PROOF_SQL,
];
async function proof(org, id) {
    return (await db().batch(SQL.map((sql, i) => db()
        .prepare(sql)
        .bind(...(i === 4 ? [org, id] : [org]))))).map((x) => x.results);
}
async function read(actor, org, id) {
    const state = await readState(db(), org, [id], actor.userId, true), member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'An active assigned ASHA membership is required.');
    ensurePurpose(member, 'programme-delivery', state.operations?.purposeGrants);
    const person = state.workspace.people.find((p) => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
    if (!person)
        fail(404, 'This record is not in your assigned care scope.');
    let view;
    try {
        view = projectIdentityLinks(state, person, actor.userId, new Date().toISOString());
    }
    catch {
        fail(503, 'Current identifier or repair metadata is unavailable.');
    }
    return { state, member, person, view };
}
async function bind(request) {
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Use a synthetic or training workspace.');
    const actor = await identity(), org = patientId(request.headers.get('x-saha-organisation')), bound = request.headers.get('x-saha-operation-actor');
    if (bound !== null && bound !== actor.userId)
        fail(403, 'The signed-in account changed. Return to Today.');
    return { actor, org };
}
function reply(value, actor, org) {
    const response = json(value);
    response.headers.set('x-saha-operation-actor', actor.userId);
    response.headers.set('x-saha-organisation', org);
    return response;
}
async function context(actor, org, id) {
    const before = await proof(org, id), current = await read(actor, org, id);
    identityLinkTransferReadProof(before[SQL.length - 1], [id], new Date().toISOString());
    await recordAccess(db(), current.state, actor, current.member, {
        action: 'viewRecordHistory',
        subject: id,
        personId: id,
        detail: 'Bounded programme identifier history and recorded repair review; values masked; no external request.',
    });
    await assertAssignedRead(db(), current.member, org, { personId: id });
    const final = await proof(org, id);
    if (JSON.stringify(before) !== JSON.stringify(final))
        fail(409, 'The identifier, destination or current authority changed. Refresh.');
    const transfer = identityLinkTransferReadProof(final[SQL.length - 1], [id], new Date().toISOString());
    current.view = projectIdentityLinks(current.state, current.person, actor.userId, new Date().toISOString());
    if (transfer.refreshAt && (!current.view.refreshAt || transfer.refreshAt < current.view.refreshAt))
        current.view.refreshAt = transfer.refreshAt;
    return current;
}
export async function identityLinkRead(request) {
    const { actor, org } = await bind(request), q = new URL(request.url).searchParams;
    if ([...q.keys()].some((k) => k !== 'personId') || q.getAll('personId').length !== 1)
        fail(400, 'Choose one assigned person.');
    const id = patientId(q.get('personId'));
    return reply((await context(actor, org, id)).view, actor, org);
}
export async function identityLinkWrite(request) {
    const { actor, org } = await bind(request);
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'Use the original signed-in account.');
    if (new URL(request.url).search)
        fail(400, 'Changes do not accept query selectors.');
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
        (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin))
        fail(403, 'Cross-origin correction is unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const parsed = identityLinkOperation.safeParse(await boundedJsonBody(request, 4000));
    if (!parsed.success)
        fail(422, 'Choose one exact supported correction.');
    const input = parsed.data, id = patientId(input.personId), c = crosswalkCorrectionSchema.parse(input.command), key = z.string().uuid().safeParse(request.headers.get('idempotency-key'));
    if (!key.success)
        fail(400, 'Use the exact original operation key.');
    const current = await context(actor, org, id), before = await proof(org, id), hash = await digest(c), saved = await db()
        .prepare('SELECT org_id,hash,command_type,person_id,result FROM command_receipts WHERE actor_id=? AND key=?')
        .bind(actor.userId, key.data)
        .first();
    if (saved &&
        (saved.org_id !== org ||
            saved.hash !== hash ||
            saved.command_type !== 'prepareIdentifierCorrection' ||
            saved.person_id !== id))
        fail(409, 'The original key belongs to different input or scope.');
    if (!saved) {
        if (current.person.version !== input.command.version ||
            !current.view.entries.some((e) => e.current && e.id === input.command.corrects && e.issuer === input.command.issuer))
            fail(409, 'The reviewed record or current identifier changed. Refresh.');
        correctionDestination(current.state, input.command.destinationId);
        if (identityLinkTransferReadProof(before[SQL.length - 1], [id], new Date().toISOString()).refreshAt)
            fail(409, 'An assignment interval is pending. Return to Today before preparing a correction.');
    }
    const final = await proof(org, id);
    if (JSON.stringify(before) !== JSON.stringify(final))
        fail(409, 'The correction or current authority changed before preparation.');
    identityLinkTransferReadProof(final[SQL.length - 1], [id], new Date().toISOString());
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.set('x-saha-organisation', org);
    const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(c) })), correctionId = result.result.correctionId;
    if (!correctionId)
        fail(409, 'The original correction receipt could not be matched.');
    const latest = await context(actor, org, id);
    if (!latest.view.repairs.some((x) => x.id === correctionId &&
        x.preparedBy === actor.userId &&
        x.corrects === input.command.corrects &&
        x.destinationId === input.command.destinationId))
        fail(409, 'The recorded correction changed. Keep the original attempt unresolved.');
    return reply(identityLinkSaved.parse({
        key: key.data,
        replayed: result.replayed === true,
        correctionId,
        review: latest.view,
    }), actor, org);
}
