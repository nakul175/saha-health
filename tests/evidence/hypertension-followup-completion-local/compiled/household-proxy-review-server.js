import { identity, db, json, runtime } from './server.js';
import { scope, readState } from './store.js';
import { fail } from './core.js';
import { environmentOf } from './environment.js';
import { patientId } from './patient-directory.js';
import { ensurePurpose } from './purpose-scope.js';
import { recordAccesses, accessRoute } from './access-audit.js';
import { assertAssignedRead } from './routine-read-guard.js';
import { householdOf } from './household.js';
import { householdProxySelection, householdProxyProjection } from './household-proxy-review.js';
import { householdTransferReadProof, HOUSEHOLD_TRANSFER_PROOF_SQL } from './household-proxy-read-guard.js';
async function read(actor, org, id, recipient, purpose) {
    const anchor = await readState(db(), org, [id], actor.userId, true), anchorMember = scope(anchor, actor.userId);
    if (anchorMember.role !== 'asha')
        fail(403, 'An active assigned ASHA membership is required.');
    ensurePurpose(anchorMember, 'household-sharing', anchor.operations?.purposeGrants);
    const anchorPerson = anchor.workspace.people.find(x => x.id === id && x.assigned && x.assignedTo === actor.userId && !x.mergedInto);
    if (!anchorPerson)
        fail(404, 'This record is not in your assigned care scope.');
    const household = householdOf(anchor, anchorPerson);
    let ids = [id];
    if (household) {
        if (!Array.isArray(household.members) || household.members.some(x => typeof x.personId !== 'string' || x.to !== undefined && typeof x.to !== 'string'))
            fail(503, 'Current household metadata is unavailable.');
        const members = household.members.filter(x => !x.to).map(x => x.personId);
        if (members.length > 30)
            fail(503, 'Current household metadata is unavailable.');
        ids = [...new Set([id, ...members])];
    }
    const state = ids.length === 1 ? anchor : await readState(db(), org, ids, actor.userId, true);
    const member = scope(state, actor.userId);
    if (member.role !== 'asha')
        fail(403, 'An active assigned ASHA membership is required.');
    ensurePurpose(member, 'household-sharing', state.operations?.purposeGrants);
    const person = state.workspace.people.find(x => x.id === id && x.assigned && x.assignedTo === actor.userId && !x.mergedInto);
    if (!person)
        fail(404, 'This record is not in your assigned care scope.');
    let review;
    try {
        review = householdProxyProjection(org, actor.userId, state, member, person, recipient, purpose, new Date().toISOString());
    }
    catch {
        fail(409, 'Current household or proxy metadata is unavailable. Refresh and choose again.');
    }
    const shown = [id, ...review.members.map(x => x.id)], transferRows = (await db().prepare(HOUSEHOLD_TRANSFER_PROOF_SQL).bind(org).all()).results, transfer = householdTransferReadProof(transferRows, shown, new Date().toISOString());
    review.assignmentRefreshAt = transfer.refreshAt;
    if (transfer.refreshAt && (!review.refreshAt || transfer.refreshAt < review.refreshAt))
        review.refreshAt = transfer.refreshAt;
    return { state, member, person, review, transfer, shown };
}
export async function householdProxyRead(request) {
    if (!['synthetic', 'training'].includes(environmentOf(runtime()).name))
        fail(409, 'Use a synthetic or training workspace.');
    const actor = await identity(), rawOrg = request.headers.get('x-saha-organisation');
    if (!rawOrg)
        fail(400, 'Choose an explicit organisation.');
    const org = patientId(rawOrg);
    let selected;
    try {
        selected = householdProxySelection(new URL(request.url).searchParams);
    }
    catch {
        fail(400, 'Choose an assigned person and explicit recipient/purpose.');
    }
    const bound = request.headers.get('x-saha-operation-actor');
    if (bound && bound !== actor.userId)
        fail(403, 'The account changed. Return to Today.');
    const initial = await read(actor, org, selected.personId, selected.recipientId, selected.purpose);
    const shown = initial.review.members.length ? initial.review.members.map(x => x.id) : [initial.person.id];
    await recordAccesses(db(), initial.state, actor, initial.member, shown.map(id => { const p = initial.state.workspace.people.find(x => x.id === id); return { action: 'viewHousehold', subject: initial.review.household?.id ?? id, personId: id, detail: `Read-only household/proxy boundary review; no sharing or history.${accessRoute(initial.member, p)}` }; }));
    const current = await read(actor, org, selected.personId, selected.recipientId, selected.purpose);
    const withoutTime = (r) => { const { evaluatedAt, ...rest } = r; void evaluatedAt; return JSON.stringify(rest); };
    if (withoutTime(initial.review) !== withoutTime(current.review) || initial.member.version !== current.member.version || initial.transfer.fingerprint !== current.transfer.fingerprint)
        fail(409, 'Relationships or authority changed while opening. Refresh.');
    const ids = current.state.workspace.people.map(x => x.id).sort(), h = householdOf(current.state, current.person), database = db();
    let batches = 0;
    let finalTransferRows;
    const consistent = new Proxy(database, { get(target, key) {
            if (key === 'batch')
                return async (statements) => {
                    const rows = await target.batch([...statements, target.prepare(`SELECT id,version,team_id,assigned_to,data FROM patients WHERE org_id=? AND id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).bind(org, ...ids), target.prepare('SELECT data,version,team_id FROM households WHERE org_id=? AND id=?').bind(org, h?.id ?? ''), target.prepare("SELECT json_type(data) AS root_type,data FROM operations WHERE org_id=?").bind(org), target.prepare('SELECT version FROM memberships WHERE org_id=? AND user_id=?').bind(org, actor.userId), target.prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=? ORDER BY team_id').bind(org, actor.userId), target.prepare(HOUSEHOLD_TRANSFER_PROOF_SQL).bind(org)]);
                    const transferRows = rows.pop();
                    finalTransferRows = transferRows.results;
                    const transfer = householdTransferReadProof(finalTransferRows, current.shown, new Date().toISOString());
                    if (transfer.fingerprint !== current.transfer.fingerprint)
                        fail(409, 'Current assignment transfer context changed. Return to Today and refresh.');
                    const teams = rows.pop(), membership = rows.pop(), ops = rows.pop(), household = rows.pop(), patients = rows.pop();
                    if (membership.results[0]?.version !== current.member.version)
                        fail(409, 'Current membership changed. Refresh.');
                    if (JSON.stringify(teams.results.map(x => x.team_id)) !== JSON.stringify([...current.member.teamIds].sort()))
                        fail(409, 'Current care teams changed. Refresh.');
                    const operation = ops.results[0];
                    if (operation && operation.root_type !== 'object')
                        fail(503, 'Current purpose is unavailable.');
                    const operations = operation ? JSON.parse(operation.data) : undefined;
                    if (JSON.stringify(operations ?? {}) !== JSON.stringify(current.state.operations ?? {}))
                        fail(409, 'Current purpose changed. Refresh.');
                    ensurePurpose(current.member, 'household-sharing', operations?.purposeGrants);
                    const raw = household.results, freshH = raw[0] ? { ...JSON.parse(raw[0].data), version: raw[0].version, teamId: raw[0].team_id } : null;
                    if (JSON.stringify(freshH) !== JSON.stringify(h ?? null))
                        fail(409, 'Current household changed. Refresh.');
                    const persons = patients.results.map(r => ({ ...JSON.parse(r.data), version: r.version, teamId: r.team_id, assignedTo: r.assigned_to, assigned: false }));
                    if (persons.length !== ids.length)
                        fail(409, 'Current household records changed. Refresh.');
                    for (const q of persons) {
                        const old = current.state.workspace.people.find(x => x.id === q.id);
                        const { assigned: a, ...v } = old;
                        void a;
                        const { assigned: b, ...w } = q;
                        void b;
                        if (JSON.stringify(v) !== JSON.stringify(w))
                            fail(409, 'Current relationship or consent changed. Refresh.');
                    }
                    batches++;
                    return rows;
                };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        } });
    await assertAssignedRead(consistent, current.member, org, { personId: selected.personId });
    if (batches !== 1)
        fail(503, 'Current relationship scope is unavailable.');
    const finalTransfer = householdTransferReadProof(finalTransferRows, current.shown, new Date().toISOString());
    let final;
    try {
        final = householdProxyProjection(org, actor.userId, current.state, current.member, current.person, selected.recipientId, selected.purpose, new Date().toISOString());
    }
    catch {
        fail(409, 'Current proxy interval is unavailable.');
    }
    final.assignmentRefreshAt = finalTransfer.refreshAt;
    if (finalTransfer.refreshAt && (!final.refreshAt || finalTransfer.refreshAt < final.refreshAt))
        final.refreshAt = finalTransfer.refreshAt;
    if (withoutTime(current.review) !== withoutTime(final))
        fail(409, 'A proxy interval changed. Refresh.');
    const response = json(final);
    response.headers.set('x-saha-operation-actor', actor.userId);
    response.headers.set('x-saha-organisation', org);
    return response;
}
