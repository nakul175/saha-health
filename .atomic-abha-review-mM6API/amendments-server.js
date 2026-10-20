import { z } from 'zod';
import { db, identity, loadFor, runtime, json, command } from './server.js';
import { fail } from './core.js';
import { scope } from './store.js';
import { patientId } from './patient-directory.js';
import { environmentOf } from './environment.js';
import { recordAccess, accessRoute } from './access-audit.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { boundedJsonBody } from './request-body.js';
const operation = z.object({ personId: z.string(), command: z.object({ type: z.literal('amendVisit'), visitId: z.string(),
        version: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) }).strict() }).strict();
async function context(request, id, sourceId, correctionId) {
    const actor = await identity(), org = request.headers.get('x-saha-organisation');
    if (!org)
        fail(400, 'Choose the organisation returned by Today.');
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Amendment review requires a synthetic or training workspace.');
    const state = await loadFor(actor, org, async () => [id]), member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'Assigned amendment review requires an active ASHA membership.');
    const p = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
    if (!p)
        fail(404, 'This record is not in your assigned care scope.');
    const all = state.workspace.visits.filter(v => v.personId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const displayed = all.slice(0, 50);
    // A committed correction can move its source beyond the discovery window.
    // Keep the explicit original source/result in its own authorised recovery read.
    for (const wanted of [sourceId, correctionId]) {
        const v = all.find(v => v.id === wanted);
        if (v && !displayed.some(x => x.id === v.id))
            displayed.push(v);
    }
    const superseded = displayed.filter(v => v.supersededBy);
    const revisionBatches = superseded.length ? await db().batch(superseded.map(v => db().prepare("SELECT entity_id,version,actor_id,actor_name,reason,created_at,data FROM record_revisions WHERE org_id=? AND person_id=? AND entity_type='visit' AND entity_id=? AND action='amendVisit' ORDER BY version DESC LIMIT 1").bind(state.organisation.id, id, v.id))) : [];
    const amendments = new Map();
    for (let i = 0; i < superseded.length; i++) {
        const row = revisionBatches[i].results[0];
        if (!row)
            continue;
        let correctionVisitId = '';
        try {
            const data = JSON.parse(row.data);
            if (typeof data.supersededBy === 'string')
                correctionVisitId = data.supersededBy;
        }
        catch { /* Refuse to present malformed history as trace evidence. */ }
        if (correctionVisitId && correctionVisitId === superseded[i].supersededBy)
            amendments.set(row.entity_id, { actorId: row.actor_id, actorName: row.actor_name, at: row.created_at, reason: row.reason, correctionVisitId, sourceVersion: row.version });
    }
    const value = { organisationId: state.organisation.id, actorId: actor.userId, person: { id: p.id, name: p.name, village: p.village },
        truncated: all.length > 50, visits: displayed.map(v => ({ id: v.id, personId: v.personId, state: v.state, recordVersion: v.recordVersion,
            createdAt: v.createdAt, confirmedAt: v.confirmedAt, supersededBy: v.supersededBy, amendsVisitId: v.amendsVisitId, voidedAt: v.voidedAt,
            imported: !!v.imported, facts: v.facts, plan: v.plan ? { id: v.plan.id, state: v.plan.state } : null,
            ai: v.aiResults.map(a => ({ id: a.id, status: a.status, reviewed: a.reviewed })),
            submissions: state.workspace.submissions.filter(s => s.visitId === v.id).map(s => ({ id: s.id, state: s.state, receipt: s.receipt ?? null })), tasks: v.correctionTasks ?? [], amendment: amendments.get(v.id) ?? null })) };
    await recordAccess(db(), state, actor, member, { action: 'viewRecordHistory', subject: id, personId: id, detail: 'Bounded local amendment source and existing downstream obligations review.' + accessRoute(member, p) });
    await assertAssignedRead(db(), member, state.organisation.id, { personId: id });
    return value;
}
function response(value, actorId, org) { const r = json(value); r.headers.set('x-saha-operation-actor', actorId); r.headers.set('x-saha-organisation', org); return r; }
export async function amendmentsRead(request) {
    const query = new URL(request.url).searchParams;
    if (query.getAll('personId').length !== 1 || [...query.keys()].some(k => k !== 'personId'))
        fail(400, 'Choose one assigned record.');
    const value = await context(request, patientId(query.get('personId')));
    return response(value, value.actorId, value.organisationId);
}
export async function amendmentsWrite(request) {
    const actor = await identity();
    if (request.headers.get('x-saha-operation-actor') !== actor.userId)
        fail(403, 'The original signed-in account is required to create or recover this correction draft.');
    if (new URL(request.url).search)
        fail(400, 'Correction draft does not accept query selectors.');
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-origin changes are unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for correction drafts.');
    const parsed = operation.safeParse(await boundedJsonBody(request, 4000));
    if (!parsed.success)
        fail(422, 'Choose a current confirmed source and a correction reason.');
    const id = patientId(parsed.data.personId), visitId = patientId(parsed.data.command.visitId), initial = await context(request, id, visitId);
    if (!initial.visits.some(v => v.id === visitId && v.personId === id))
        fail(404, 'The selected source does not belong to this record.');
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.set('x-saha-organisation', initial.organisationId);
    // Original dispatcher is the sole authority/writer for versions, restrictions,
    // amendments, downstream invalidation and immutable actor/key/body receipts.
    const result = await command(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(parsed.data.command) }));
    const current = await context(request, id, visitId, typeof result.result?.visitId === 'string' ? result.result.visitId : undefined);
    return response({ outcome: 'draft-created', key: request.headers.get('idempotency-key'), correctionVisitId: result.result?.visitId, context: current }, actor.userId, initial.organisationId);
}
