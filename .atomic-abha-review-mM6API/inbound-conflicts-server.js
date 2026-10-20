import { db, identity, loadFor, json, rawRuntime } from './server.js';
import { scope, persist } from './store.js';
import { digest, fail } from './core.js';
import { boundedJsonBody } from './request-body.js';
import { environmentOf } from './environment.js';
import { recordAccesses } from './access-audit.js';
import { ensureOperating } from './operations.js';
import { applyInbound, conflictBasis, conflictFor, currentReviewer, inboundCare, inboundSchema } from './inbound-conflicts.js';
export async function inboundWrite(request) {
    const u = await identity();
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site')
        fail(403, 'Cross-site requests are refused.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const parsed = inboundSchema.safeParse(await boundedJsonBody(request, 16000));
    if (!parsed.success)
        fail(422, 'Choose a valid inbound review action.');
    const c = parsed.data;
    if (c.expectedActorId !== u.userId)
        fail(403, 'The account changed. This review was not saved.');
    const hash = await digest(c);
    const old = await db().prepare('SELECT org_id,hash,result,person_id FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, c.key).first();
    const header = request.headers.get('x-saha-organisation');
    if (old && header && old.org_id !== header)
        fail(409, 'This receipt belongs to another organisation.');
    const s = await loadFor(u, old?.org_id ?? header), m = scope(s, u.userId);
    inboundCare(s, m, c.personId, c.type === 'decide');
    if (c.type !== 'stage') {
        const item = conflictFor(s, c.personId, c.conflictId);
        if (c.type !== 'assign' || old)
            currentReviewer(s, c.personId, item.ownerId);
        if (c.type === 'decide' && (item.ownerId !== u.userId || item.by === u.userId))
            fail(403, 'The assigned independent clinician must review this conflict.');
    }
    if (c.type === 'stage' || c.type === 'assign')
        currentReviewer(s, c.personId, c.ownerId);
    if (old) {
        if (old.hash !== hash || old.person_id !== c.personId)
            fail(409, 'This operation key identifies different input.');
        const saved = JSON.parse(old.result), item = conflictFor(s, c.personId, saved.conflictId);
        currentReviewer(s, c.personId, item.ownerId);
        return json({ result: saved, replayed: true });
    }
    const env = environmentOf(rawRuntime());
    if (env.name === 'misconfigured')
        fail(409, 'The environment is not configured.');
    ensureOperating(s, { type: 'inboundConflict' });
    const before = structuredClone(s), result = await applyInbound(s, c, u, m, env.name);
    await persist(db(), before, s, u, { type: 'inboundConflict' + c.type }, c.key, hash, result);
    return json({ result, replayed: false });
}
export async function inboundRead(request) {
    const u = await identity(), url = new URL(request.url);
    if ([...url.searchParams.keys()].some(k => k !== 'personId') || url.searchParams.getAll('personId').length !== 1)
        fail(422, 'Choose one patient.');
    const id = url.searchParams.get('personId');
    if (!id || id.length > 200)
        fail(422, 'Choose one patient.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), p = inboundCare(s, m, id), rows = p.ehr?.inboundConflicts ?? [];
    const fingerprint = await digest({ p, visits: s.workspace.visits.filter(v => v.personId === id), member: m });
    await recordAccesses(db(), s, u, m, [{ action: 'viewRecordHistory', subject: id, personId: id, detail: `Inbound conflict history read; ${rows.length} retained reviews; source and local versions displayed, no external writes.` }]);
    const fresh = await loadFor(u, s.organisation.id), fm = scope(fresh, u.userId), fp = inboundCare(fresh, fm, id);
    if (await digest({ p: fp, visits: fresh.workspace.visits.filter(v => v.personId === id), member: fm }) !== fingerprint)
        fail(409, 'Record or current authority changed during this read. Refresh.');
    const output = [];
    for (const item of fp.ehr?.inboundConflicts ?? []) {
        let basis = null, reviewEligible = true;
        try {
            currentReviewer(fresh, id, item.ownerId);
            basis = await conflictBasis(fresh, id, item);
        }
        catch {
            reviewEligible = false;
        }
        output.push({ ...item, basis, reviewEligible, stale: !reviewEligible || basis !== item.localHash, local: fresh.workspace.visits.find(v => v.id === item.visitId) });
    }
    return json({ rows: output, candidates: fp.ehr?.inboundCandidates ?? [], documents: fp.ehr?.documents ?? [], visits: fresh.workspace.visits.filter(v => v.personId === id && !v.voidedAt && !v.supersededBy), reviewers: fresh.members.filter(x => { try {
            inboundCare(fresh, x, id, true);
            return true;
        }
        catch {
            return false;
        } }).map(x => ({ id: x.userId, name: x.displayName })), scope: 'Documentary source versions; accepted destination records remain authoritative. No provider request or automatic clinical confirmation.' });
}
