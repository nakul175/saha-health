import { z } from 'zod';
import { identity, db, json, runtime, command } from './server.js';
import { readState, scope } from './store.js';
import { fail, digest } from './core.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { boundedJsonBody } from './request-body.js';
import { recordAccess } from './access-audit.js';
import { rosterDiff, rosterSchema } from './roster.js';
import { institutionRosterOperation, institutionRosterContext, institutionRosterPreview, institutionRosterSaved, } from './institution-roster-review.js';
import { institutionAllTransferProof, INSTITUTION_TRANSFER_PROOF_SQL } from './institution-roster-read-guard.js';
const SQL = [
    'SELECT id,name,revision,patient_revision FROM organisations WHERE id=?',
    'SELECT m.user_id,m.role,m.status,m.version,m.is_owner,a.account_code,a.display_name FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=? ORDER BY m.user_id',
    'SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id',
    'SELECT id,name FROM teams WHERE org_id=? ORDER BY id',
    'SELECT id,account_code,label,status,accepted_by,expires_at FROM invitations WHERE org_id=? ORDER BY id',
    'SELECT data FROM operations WHERE org_id=?',
    INSTITUTION_TRANSFER_PROOF_SQL,
];
async function proof(org) {
    return (await db().batch(SQL.map((sql) => db().prepare(sql).bind(org)))).map((x) => x.results);
}
function editable(m, actor) {
    return (m.status === 'active' &&
        !m.isOwner &&
        m.userId !== actor &&
        !m.userId.startsWith('fixture:') &&
        m.role !== 'provider');
}
async function bind(request) {
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Use a synthetic or training workspace.');
    if (new URL(request.url).search)
        fail(400, 'Choose the explicit organisation context header.');
    const actor = await identity(), org = patientId(request.headers.get('x-saha-organisation')), bound = request.headers.get('x-saha-operation-actor');
    if (bound !== null && bound !== actor.userId)
        fail(403, 'The signed-in account changed. Use the original account.');
    return { actor, org };
}
function reply(value, actor, org) {
    const response = json(value);
    response.headers.set('x-saha-operation-actor', actor.userId);
    response.headers.set('x-saha-organisation', org);
    return response;
}
async function read(actor, org) {
    const state = await readState(db(), org, [], actor.userId, true), member = scope(state, actor.userId);
    if (!member.isOwner)
        fail(403, 'A current organisation owner is required.');
    const value = institutionRosterContext.parse({
        actorId: actor.userId,
        organisationId: org,
        organisationName: state.organisation.name,
        refreshAt: null,
        teams: state.teams.map((t) => ({ id: t.id, name: t.name })),
        members: state.members.map((m) => ({
            userId: m.userId,
            accountCode: m.accountCode,
            name: m.displayName,
            role: m.role,
            status: m.status,
            version: m.version,
            isOwner: m.isOwner,
            teams: [...m.teamIds].sort(),
            editable: editable(m, actor.userId),
        })),
    });
    return { state, member, value };
}
async function context(actor, org) {
    const before = await proof(org), current = await read(actor, org);
    const transfer = institutionAllTransferProof(before[SQL.length - 1], new Date().toISOString());
    await recordAccess(db(), current.state, actor, current.member, {
        action: 'viewWorkspace',
        subject: org,
        personId: null,
        detail: 'Bounded owner existing-member partial institution roster review; no patient data, tokens, provisioning or upstream federation.',
    });
    const final = await proof(org);
    if (JSON.stringify(before) !== JSON.stringify(final))
        fail(409, 'Current roster or owner authority changed. Refresh.');
    const finalTransfer = institutionAllTransferProof(final[SQL.length - 1], new Date().toISOString());
    if (transfer.fingerprint !== finalTransfer.fingerprint)
        fail(409, 'Current assignment context changed. Refresh.');
    current.value.refreshAt = finalTransfer.refreshAt;
    return current;
}
function existingRows(current, rows, actor) {
    for (const row of rows) {
        const m = current.state.members.find((x) => x.accountCode === row.accountCode);
        if (!m || !editable(m, actor) || row.name !== m.displayName)
            fail(409, 'Choose only the exact current existing member; owner/self/provider/fixture/provisioning changes are unavailable.');
        if (row.teams.some((id) => !current.state.teams.some((t) => t.id === id)))
            fail(422, 'Choose current recorded teams.');
    }
}
export async function institutionRosterRead(request) {
    const { actor, org } = await bind(request);
    return reply((await context(actor, org)).value, actor, org);
}
export async function institutionRosterWrite(request) {
    const { actor, org } = await bind(request);
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'Use the original signed-in account.');
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
        (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin))
        fail(403, 'Cross-origin roster changes are unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON.');
    const parsed = institutionRosterOperation.safeParse(await boundedJsonBody(request, 30000));
    if (!parsed.success)
        fail(422, 'Choose one supported partial existing-member roster operation.');
    const input = parsed.data, current = await context(actor, org), before = await proof(org);
    let saved = null, key, c;
    if (input.kind === 'apply') {
        const k = z.string().uuid().safeParse(request.headers.get('idempotency-key'));
        if (!k.success)
            fail(400, 'Use the exact original operation key.');
        key = k.data;
        c = rosterSchema.parse({
            type: 'rosterApply',
            rows: input.rows,
            complete: false,
            previewHash: input.previewHash,
            reason: input.reason,
        });
        const hash = await digest(c);
        saved = await db()
            .prepare('SELECT org_id,hash,command_type,result FROM command_receipts WHERE actor_id=? AND key=?')
            .bind(actor.userId, key)
            .first();
        if (saved && (saved.org_id !== org || saved.hash !== hash || saved.command_type !== 'rosterApply'))
            fail(409, 'The original key belongs to different input or scope.');
    }
    let preview;
    if (!saved) {
        existingRows(current, input.rows, actor.userId);
        const diff = await rosterDiff(current.state, input.rows, false, actor.userId);
        if (diff.errors.length || diff.counts.invite || diff.counts.conflict)
            fail(409, 'Current roster requires a separate controlled workflow. No invitations or conflicted changes are applied here.');
        preview = institutionRosterPreview.parse({
            context: current.value,
            actions: diff.actions,
            hash: diff.hash,
            counts: diff.counts,
        });
        if (input.kind === 'apply' && preview.hash !== input.previewHash)
            fail(409, 'The reviewed roster or current membership changed. Preview again.');
    }
    const final = await proof(org);
    if (JSON.stringify(before) !== JSON.stringify(final))
        fail(409, 'The roster or current owner authority changed. Refresh.');
    const transfer = institutionAllTransferProof(final[SQL.length - 1], new Date().toISOString());
    if (input.kind === 'preview') {
        preview.context.refreshAt = transfer.refreshAt;
        return reply(preview, actor, org);
    }
    if (transfer.refreshAt)
        fail(409, 'A scheduled assignment interval is pending. Use existing authoritative organisation processing before applying or recovering this roster.');
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.set('x-saha-organisation', org);
    const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(c) })), value = result.result;
    if (value.invitations?.length)
        fail(409, 'Keep the exact attempt unresolved; provisioning is not exposed here.');
    const latest = await context(actor, org);
    return reply(institutionRosterSaved.parse({
        key,
        replayed: result.replayed === true,
        context: latest.value,
        counts: value.counts,
    }), actor, org);
}
