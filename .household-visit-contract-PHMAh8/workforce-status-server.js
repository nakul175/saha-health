import { z } from 'zod';
import { identity, db, runtime, json, command } from './server.js';
import { fail, digest } from './core.js';
import { environmentOf } from './environment.js';
import { recordAccessBare } from './access-audit.js';
import { boundedJsonBody } from './request-body.js';
import { workforceContext, ownerOrganisations, suspensionCommand, unchangedSuspensionTarget } from './workforce-status.js';
const reference = z.string().min(1).max(200);
const memberRow = z.object({ user_id: z.string().min(1), display_name: z.string().nullable(), role: z.enum(['asha', 'clinician', 'supervisor', 'admin', 'provider']),
    status: z.enum(['active', 'suspended', 'removed']), version: z.number().int().positive(), is_owner: z.union([z.literal(0), z.literal(1)]) }).strict();
async function principal() {
    const actor = await identity();
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Workforce review requires a synthetic or training workspace.');
    return actor;
}
function organisation(request) {
    const value = reference.safeParse(request.headers.get('x-saha-organisation'));
    if (!value.success)
        fail(400, 'Select one existing owner organisation.');
    return value.data;
}
async function packet(org, actorId) {
    // These four metadata queries share one consistent snapshot. No patient or invitation payload is loaded.
    const rows = await db().batch([
        db().prepare('SELECT id,name FROM organisations WHERE id=?').bind(org),
        db().prepare('SELECT m.user_id,a.display_name,m.role,m.status,m.version,m.is_owner FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? AND m.user_id=?').bind(org, actorId),
        db().prepare('SELECT m.user_id,a.display_name,m.role,m.status,m.version,m.is_owner FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? ORDER BY m.user_id LIMIT 501').bind(org),
        db().prepare('SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id').bind(org),
    ]);
    const acting = memberRow.safeParse(rows[1].results[0]);
    if (!acting.success || acting.data.status !== 'active' || acting.data.is_owner !== 1)
        fail(403, 'Current organisation owner access is required.');
    const orgRow = z.object({ id: reference, name: z.string().min(1).max(200) }).strict().safeParse(rows[0].results[0]);
    const roster = z.array(memberRow).max(500).safeParse(rows[2].results);
    const links = z.array(z.object({ user_id: z.string().min(1), team_id: reference }).strict()).safeParse(rows[3].results);
    if (!orgRow.success || !roster.success || !links.success)
        fail(503, 'Current membership metadata is unavailable.');
    const members = roster.data.map(member => ({ userId: member.user_id, name: member.display_name || 'Name not recorded',
        role: member.role, status: member.status, version: member.version, isOwner: member.is_owner === 1,
        teamIds: links.data.filter(link => link.user_id === member.user_id).map(link => link.team_id) }));
    const parsed = workforceContext.safeParse({ actorId, organisation: orgRow.data, members });
    if (!parsed.success)
        fail(503, 'Current membership metadata is unavailable.');
    const member = { userId: actorId, displayName: acting.data.display_name || 'Name not recorded', accountCode: '',
        role: acting.data.role, status: 'active', isOwner: true, version: acting.data.version,
        teamIds: members.find(member => member.userId === actorId).teamIds, createdAt: '' };
    return { value: parsed.data, member };
}
async function audited(org, actor) {
    const before = await packet(org, actor.userId);
    await recordAccessBare(db(), org, actor, before.member, { action: 'viewWorkspace', subject: org,
        detail: `Minimal owner workforce membership metadata reviewed: ${before.value.members.length} members; no patient records or invitation tokens.` });
    const current = await packet(org, actor.userId);
    if (JSON.stringify(before.value) !== JSON.stringify(current.value))
        fail(409, 'Membership context changed while reading. Refresh before continuing.');
    return current.value;
}
function response(value, actorId, org) {
    const result = json(value);
    result.headers.set('x-saha-operation-actor', actorId);
    if (org)
        result.headers.set('x-saha-organisation', org);
    return result;
}
export async function workforceRead(request) {
    const actor = await principal();
    if (new URL(request.url).search)
        fail(400, 'Workforce review does not accept query selectors.');
    if (!request.headers.has('x-saha-organisation')) {
        const rows = await db().prepare("SELECT o.id,o.name FROM organisations o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=? AND m.status='active' AND m.is_owner=1 ORDER BY o.id LIMIT 501").bind(actor.userId).all();
        const value = ownerOrganisations.safeParse({ actorId: actor.userId, organisations: rows.results });
        if (!value.success)
            fail(503, 'Existing owner organisations are unavailable.');
        return response(value.data, actor.userId);
    }
    const org = organisation(request);
    return response(await audited(org, actor), actor.userId, org);
}
export async function workforceWrite(request) {
    const actor = await principal(), org = organisation(request);
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'Use the original owner account.');
    if (new URL(request.url).search)
        fail(400, 'Suspension accepts no query selectors.');
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-origin changes are unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for suspension.');
    const parsed = suspensionCommand.safeParse(await boundedJsonBody(request, 5000));
    if (!parsed.success)
        fail(422, 'Only reviewed existing-membership suspension is supported.');
    const key = request.headers.get('idempotency-key');
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
        fail(400, 'Keep a valid original attempt reference.');
    const recovery = request.headers.get('x-saha-recovery');
    if (recovery && recovery !== 'receipt-only')
        fail(400, 'Unsupported recovery mode.');
    const current = await audited(org, actor), target = current.members.find(member => member.userId === parsed.data.userId);
    const saved = await db().prepare('SELECT hash,org_id FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId, key).first();
    if (saved) {
        if (saved.org_id !== org || saved.hash !== await digest(parsed.data))
            fail(409, 'Original operation reference does not match this input.');
    }
    else {
        if (recovery)
            fail(409, 'No committed original suspension receipt was found. Nothing was resent.');
        if (parsed.data.userId === actor.userId || parsed.data.userId.startsWith('fixture:'))
            fail(422, 'Choose another current active membership.');
        if (!unchangedSuspensionTarget(target, parsed.data))
            fail(409, 'The membership changed. Refresh and review it again.');
    }
    // The unchanged original writer enforces current owner, self/last-owner/version guards and atomic receipts.
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(parsed.data) }));
    return response({ outcome: 'original-suspension-recorded', key, result: result.result, context: await audited(org, actor) }, actor.userId, org);
}
