import { identity, db, json, runtime } from './server.js';
import { scope, readState } from './store.js';
import { fail } from './core.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { ensurePurpose, ACCESS_PURPOSES, PROGRAMME_NAMES } from './purpose-scope.js';
import { recordAccess, accessRoute } from './access-audit.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { sharedQuestionProjection } from './shared-question-review.js';
import { sharedQuestionTransferReadProof, SHARED_QUESTION_TRANSFER_PROOF_SQL } from './shared-question-assignment-read-guard.js';
import { z } from 'zod';
const grants = z.object({ purposeGrants: z.array(z.object({ memberId: z.string().min(1), programme: z.enum(PROGRAMME_NAMES).nullish(), purposes: z.array(z.enum(ACCESS_PURPOSES)), revokedAt: z.string().nullish() }).passthrough()).nullish() }).passthrough();
async function current(actor, org, id, visitId, version) {
    const state = await readState(db(), org, [id], actor.userId, true), member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'Shared question review requires an active ASHA membership.');
    ensurePurpose(member, 'care-coordination', state.operations?.purposeGrants);
    const person = state.workspace.people.find(p => p.id === id && p.assigned && p.assignedTo === actor.userId && !p.mergedInto);
    if (!person)
        fail(404, 'This record is not in your assigned care scope.');
    const visit = visitId ? state.workspace.visits.find(v => v.id === visitId && v.personId === id && !v.voidedAt && !v.supersededBy) : undefined;
    if (visitId && (!visit || visit.version !== version))
        fail(409, 'The selected captured visit changed. Refresh and choose again.');
    let value;
    try {
        value = sharedQuestionProjection(org, actor.userId, person, state.workspace.visits, visit);
    }
    catch {
        fail(409, 'Captured question configuration is inconsistent or unavailable. Nothing was combined.');
    }
    const transferRows = (await db().prepare(SHARED_QUESTION_TRANSFER_PROOF_SQL).bind(org).all()).results, transfer = sharedQuestionTransferReadProof(transferRows, [id], new Date().toISOString());
    if (transfer.refreshAt && transfer.refreshAt < value.refreshAt)
        value.refreshAt = transfer.refreshAt;
    return { state, member, person, visit, value: value, transfer };
}
export async function sharedQuestionRead(request) {
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Question review requires a synthetic or training workspace.');
    const actor = await identity(), org = patientId(request.headers.get('x-saha-organisation')), q = new URL(request.url).searchParams;
    if ([...q.keys()].some(k => !['personId', 'visitId', 'version'].includes(k)) || q.getAll('personId').length !== 1 || q.getAll('visitId').length > 1 || q.getAll('version').length > 1 || q.has('visitId') !== q.has('version'))
        fail(400, 'Choose one assigned person and one exact existing visit/version.');
    const expectedActor = request.headers.get('x-saha-operation-actor');
    if (expectedActor && expectedActor !== actor.userId)
        fail(403, 'The signed-in account changed. Return to Today.');
    const id = patientId(q.get('personId')), visitId = q.has('visitId') ? patientId(q.get('visitId')) : undefined, raw = q.get('version'), version = raw === null ? undefined : Number(raw);
    if (raw !== null && (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(version)))
        fail(400, 'Choose an exact current visit version.');
    const before = await current(actor, org, id, visitId, version);
    await recordAccess(db(), before.state, actor, before.member, { action: 'viewRecordHistory', subject: id, personId: id, detail: `Read-only captured shared question definitions; no reuse, capture, provider or clinical approval.${accessRoute(before.member, before.person)}` });
    const after = await current(actor, org, id, visitId, version);
    if (JSON.stringify(before.value) !== JSON.stringify(after.value) || before.member.version !== after.member.version || before.transfer.fingerprint !== after.transfer.fingerprint)
        fail(409, 'Captured questions or permissions changed during review. Refresh and choose again.');
    let batches = 0;
    let transferRows;
    const d = db(), consistent = new Proxy(d, { get(target, key) { if (key === 'batch')
            return async (statements) => { const rows = await target.batch([...statements, target.prepare("SELECT json_type(data) AS root_type,data FROM operations WHERE org_id=?").bind(org), ...(after.visit ? [target.prepare('SELECT version,data FROM visits WHERE org_id=? AND id=? AND person_id=?').bind(org, after.visit.id, id)] : []), target.prepare('SELECT version FROM patients WHERE org_id=? AND id=?').bind(org, id), target.prepare(SHARED_QUESTION_TRANSFER_PROOF_SQL).bind(org)]); transferRows = rows.pop().results; const transfer = sharedQuestionTransferReadProof(transferRows, [id], new Date().toISOString()); if (transfer.fingerprint !== after.transfer.fingerprint)
                fail(409, 'Assignment transfer context changed. Return to Today.'); const person = rows.pop(), source = after.visit ? rows.pop() : null, policy = rows.pop(); const p = z.array(z.object({ root_type: z.literal('object'), data: z.string() })).max(1).safeParse(policy?.results); if (!p.success)
                fail(503, 'Current question review purpose is unavailable.'); let parsed; try {
                parsed = grants.parse(p.data[0] ? JSON.parse(p.data[0].data) : {});
            }
            catch {
                fail(503, 'Current question review purpose is unavailable.');
            } const active = parsed.purposeGrants ?? []; if (active.filter(g => g.memberId === after.member.userId && !g.revokedAt).length > 1)
                fail(503, 'Current question review purpose is unavailable.'); ensurePurpose(after.member, 'care-coordination', active); const personProof = z.array(z.object({ version: z.number().int() })).length(1).safeParse(person?.results); if (!personProof.success || personProof.data[0].version !== after.person.version)
                fail(409, 'The selected person changed.'); if (after.visit) {
                const sourceProof = z.array(z.object({ version: z.number().int(), data: z.string() })).length(1).safeParse(source?.results);
                if (!sourceProof.success || sourceProof.data[0].version !== after.visit.version)
                    fail(409, 'The selected visit changed.');
                const r = sourceProof.data[0];
                let stored;
                try {
                    stored = JSON.parse(r.data);
                }
                catch {
                    fail(503, 'Captured source is unavailable.');
                }
                if (stored.voidedAt || stored.supersededBy || JSON.stringify(stored.programmeCapture ?? null) !== JSON.stringify(after.visit.programmeCapture ?? null))
                    fail(409, 'Captured questions changed before disclosure.');
            } batches++; return rows; }; const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; } });
    await assertAssignedRead(consistent, after.member, org, { personId: id }, after.visit ? { id: after.visit.id, personId: id, minimumVersion: after.visit.version } : undefined);
    if (batches !== 1)
        fail(503, 'Current assigned question review is unavailable.');
    sharedQuestionTransferReadProof(transferRows, [id], new Date().toISOString());
    if (Date.parse(after.value.refreshAt) <= Date.now())
        fail(409, 'Assignment time changed. Return to Today and refresh.');
    const r = json(after.value);
    r.headers.set('x-saha-operation-actor', actor.userId);
    r.headers.set('x-saha-organisation', org);
    return r;
}
