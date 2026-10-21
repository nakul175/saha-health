import { identity, loadFor, db, json } from './server.js';
import { scope, persist } from './store.js';
import { digest, fail, AppError } from './core.js';
import { boundedJsonBody } from './request-body.js';
import { transitionSchema, applyTransition, transitionRows, transitionsOf, transitionPlan, transitionCareGate, transitionPatientGate } from './installed-pack-transition.js';
import { installedWorkRows, INSTALLED_WORK_NOTICE } from './installed-pack-work.js';
import { installationsOf } from './pack-installation.js';
import { transitionVerified, transitionOriginalCohort } from './installed-transition-authority.js';
import { purposePermits } from './access.js';
import { recordAccesses } from './access-audit.js';
function reader(s, m) { if (m.status !== 'active' || (!m.isOwner && m.role !== 'clinician') || !['asha', 'clinician', 'supervisor'].includes(m.role) || !purposePermits(m, 'care-coordination', s.operations?.purposeGrants))
    fail(403, 'Current care owner or independent clinician is required.'); }
function gate(s, m, c) { reader(s, m); const t = transitionsOf(s).find(t => t.id === c.transitionId), team = c.teamId ?? t?.teamId; if (!team)
    fail(403, 'Current transition unavailable.'); transitionCareGate(s, m, team); if (t) {
    if (!transitionVerified(s, t))
        fail(409, 'Protected transition provenance is unavailable.');
    for (const id of transitionOriginalCohort(s, t)) {
        const p = s.workspace.people.find(p => p.id === id);
        if (!p)
            fail(403, 'Original transition cohort unavailable.');
        transitionPatientGate(s, m, p);
    }
} if (c.type === 'review' ? (m.role !== 'clinician' || m.userId === t?.proposer) : !m.isOwner)
    fail(403, 'Current independent transition governance authority is required.'); }
export async function transitionWrite(request) {
    const u = await identity(), org = request.headers.get('x-saha-organisation');
    if (request.headers.get('x-saha-expected-actor') && request.headers.get('x-saha-expected-actor') !== u.userId)
        fail(403, 'The original signed-in worker changed.');
    const s = await loadFor(u, org), m = scope(s, u.userId);
    reader(s, m);
    if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)
        fail(403, 'Cross-site changes are not allowed.');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(415, 'Use JSON for this operation.');
    const parsed = transitionSchema.safeParse(await boundedJsonBody(request, 12000));
    if (!parsed.success)
        fail(422, 'Invalid reviewed transition input.');
    const c = parsed.data, key = request.headers.get('idempotency-key');
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
        fail(400, 'A stable original operation key is required.');
    const hash = await digest(c), receiptKey = 'installed-transition:' + key, old = await db().prepare('SELECT org_id,hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, receiptKey).first();
    if (old) {
        if (old.org_id !== s.organisation.id || old.hash !== hash)
            fail(409, 'The original key belongs to different input.');
        const fresh = await loadFor(u, org);
        gate(fresh, scope(fresh, u.userId), c);
        return json({ result: JSON.parse(old.result), replayed: true });
    }
    const before = structuredClone(s), result = await applyTransition(s, c, u, m), fresh = await loadFor(u, org), fm = scope(fresh, u.userId);
    gate(fresh, fm, c);
    if (fm.version !== m.version || JSON.stringify(fm) !== JSON.stringify(m))
        fail(409, 'Current governance authority changed. Refresh the plan.');
    await applyTransition(fresh, c, u, fm); // Recheck exact original governance/cohort before original-baseline CAS.
    await persist(db(), before, s, u, { type: 'installedTransition.' + c.type }, receiptKey, hash, result, [...transitionRows(s, before), ...installedWorkRows(s, before)]);
    try {
        const final = await loadFor(u, org);
        gate(final, scope(final, u.userId), { ...c, transitionId: result.transitionId });
    }
    catch (e) {
        const withdrawn = e instanceof AppError && [401, 403].includes(e.status);
        return json({ outcome: 'accepted', operationReference: key, error: 'The original operation was saved. Current governed access is unavailable. Keep this reference; do not submit again.' }, withdrawn ? 403 : 503);
    }
    return json({ result });
}
export async function transitionRead(request) {
    const u = await identity(), org = request.headers.get('x-saha-organisation'), query = new URL(request.url).searchParams;
    let s = await loadFor(u, org), m = scope(s, u.userId);
    reader(s, m);
    const receiptKey = query.get('receiptKey');
    if (receiptKey) {
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(receiptKey))
            fail(422, 'Invalid original operation reference.');
        const row = await db().prepare('SELECT org_id,command_type,result FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, 'installed-transition:' + receiptKey).first();
        s = await loadFor(u, org);
        m = scope(s, u.userId);
        reader(s, m);
        if (!row) {
            await transitionReadAudit(s, u, m, [], 0, 'original outcome unknown');
            const final = await loadFor(u, org), fm = scope(final, u.userId);
            reader(final, fm);
            if (JSON.stringify(fm) !== JSON.stringify(m))
                fail(409, 'Current governance changed during original outcome read.');
            return json({ outcome: 'unknown' });
        }
        if (row.org_id !== s.organisation.id || !row.command_type.startsWith('installedTransition.'))
            fail(403, 'Original saved result unavailable.');
        const result = JSON.parse(row.result);
        gate(s, m, { type: row.command_type.slice('installedTransition.'.length), transitionId: result.transitionId });
        await transitionReadAudit(s, u, m, [], 0, 'original accepted outcome');
        const final = await loadFor(u, org), fm = scope(final, u.userId);
        gate(final, fm, { type: row.command_type.slice('installedTransition.'.length), transitionId: result.transitionId });
        if (JSON.stringify(fm) !== JSON.stringify(m))
            fail(409, 'Current governance changed during original outcome read.');
        return json({ outcome: 'accepted', result });
    }
    const original = s.organisation.revision, plans = [];
    for (const t of transitionsOf(s).filter(t => m.teamIds.includes(t.teamId))) {
        transitionCareGate(s, m, t.teamId);
        plans.push({ transition: t, impact: await transitionPlan(s, m, t) });
    }
    for (const id of m.teamIds)
        transitionCareGate(s, m, id);
    const disclosedIds = [...new Set(plans.flatMap(p => [...p.impact.people.map(x => x.personId), ...transitionOriginalCohort(s, p.transition)]))].sort();
    await transitionReadAudit(s, u, m, disclosedIds, plans.length, 'impact and history');
    const latest = await loadFor(u, org), lm = scope(latest, u.userId);
    reader(latest, lm);
    for (const id of m.teamIds)
        transitionCareGate(latest, lm, id);
    const currentPlans = [];
    for (const t of transitionsOf(latest).filter(t => lm.teamIds.includes(t.teamId))) {
        transitionCareGate(latest, lm, t.teamId);
        currentPlans.push({ transition: t, impact: await transitionPlan(latest, lm, t) });
    }
    if (await digest({ plans: currentPlans, catalogue: transitionReadCatalogue(latest, lm) }) !== await digest({ plans, catalogue: transitionReadCatalogue(s, m) }) || latest.organisation.revision !== original || JSON.stringify(lm) !== JSON.stringify(m))
        fail(409, 'Current cohort or governance changed during plan read. Refresh.');
    return json({ notice: INSTALLED_WORK_NOTICE + ' Explicit reviewed team transitions; no answers or confirmed source are rewritten.', plans, ...transitionReadCatalogue(s, m) });
}
async function transitionReadAudit(s, u, m, ids, plans, kind) { await recordAccesses(db(), s, u, m, [{ action: 'listPatients', subject: s.organisation.id, personId: null, detail: `Reviewed programme transition ${kind} read: ${plans} declarations; ${ids.length} protected patient work records. No patient facts, plan hashes or clinical values recorded.` }, ...ids.map(id => ({ action: 'viewActionPlan', subject: id, personId: id, detail: 'Reviewed programme transition impact/history returned for this current permitted patient. No facts, answers, task values or source content recorded.' }))]); }
function transitionReadCatalogue(s, m) { return { teams: s.teams.filter(t => m.teamIds.includes(t.id)), installations: installationsOf(s).filter(i => i.state === 'active').map(i => ({ id: i.id, hash: i.manifestHash, packId: i.packId, version: i.version, name: i.pack.name })), canStage: !!m.isOwner, canReview: m.role === 'clinician' }; }
