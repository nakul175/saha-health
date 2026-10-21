import { z } from 'zod';
import { digest, fail, person, uuid } from './core.js';
import { normallyAllowed } from './access.js';
import { supervises } from './delegation.js';
import { stewardRole } from './merge.js';
import { correctionTasks } from './correction-tasks.js';
const id = z.string().trim().min(1).max(200), reason = z.string().trim().min(10).max(500);
export const reconciliationSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('assignReconciliationTask'), personId: id, kind: z.enum(['correction', 'identity-merge']), parentId: id, taskId: id, ownerId: id, reason, expectedHistory: z.number().int().min(0), expectedOwnerId: id.nullable() }).strict(),
    z.object({ type: z.literal('acknowledgeReconciliationTask'), personId: id, kind: z.enum(['correction', 'identity-merge']), parentId: id, taskId: id }).strict(),
    z.object({ type: z.literal('previewReconciliationBackfill'), personId: id }).strict(),
    z.object({ type: z.literal('applyReconciliationBackfill'), personId: id, planHash: z.string().regex(/^[a-f0-9]{64}$/), reason }).strict(),
]);
const TYPES = new Set(reconciliationSchema.options.map(x => x.shape.type.value));
const manage = (s, m, p) => m.status === 'active' && normallyAllowed(m, p) && (['asha', 'clinician'].includes(m.role) || supervises(s, m, p.teamId));
const visible = (s, m, id) => { const p = s.workspace.people.find(x => x.id === id); return !!p && p.assigned && normallyAllowed(m, p); };
function locate(s, m, c) {
    const p = person(s.workspace, c.personId);
    if (c.kind === 'correction') {
        const v = s.workspace.visits.find(x => x.id === c.parentId && x.personId === p.id), task = v?.correctionTasks?.find(x => x.id === c.taskId);
        if (!v || !task)
            fail(404, 'Reconciliation task not found.');
        return { task: task, people: [p], visit: v };
    }
    const k = s.identityCases?.find(x => x.id === c.parentId), task = k?.items.find(x => x.id === c.taskId && x.personId === p.id);
    if (!k || !task || ![k.survivorId, k.duplicateId].every(x => visible(s, m, x)))
        fail(404, 'Reconciliation task not found.');
    return { task: task, people: [person(s.workspace, k.survivorId), person(s.workspace, k.duplicateId)], merge: k };
}
export function authorizeReconciliation(s, m, c) {
    if (!TYPES.has(c?.type))
        return;
    const p = person(s.workspace, c.personId);
    if (!manage(s, m, p))
        fail(403, 'Current care access is required for reconciliation.');
    if (c.type.includes('Backfill'))
        return;
    const found = locate(s, m, c);
    if (found.merge && !stewardRole(m))
        fail(403, 'An identity steward with access to both records is required.');
    if (c.type === 'acknowledgeReconciliationTask' && (found.task.assignmentNotice?.to !== m.userId || found.task.ownerId !== m.userId))
        fail(403, 'Only the current notification recipient may acknowledge this assignment.');
}
export function reconciliationQueue(s, m, filter) {
    if (m.role === 'admin' || m.status !== 'active')
        fail(403, 'Patient access is required.');
    if (filter)
        person(s.workspace, filter);
    const rows = [];
    const add = (kind, parentId, p, t, people) => {
        if (!visible(s, m, p.id) || !people.every(x => visible(s, m, x.id)) || (filter && p.id !== filter))
            return;
        const owner = s.members.find(x => x.userId === ('ownerId' in t ? t.ownerId : null));
        const eligible = s.members.filter(x => x.status === 'active' && people.every(p => normallyAllowed(x, p)) && (kind === 'identity-merge' ? stewardRole(x) : manage(s, x, p)));
        const mine = t.assignmentNotice?.to === m.userId && ('ownerId' in t ? t.ownerId : null) === m.userId;
        rows.push({ kind, parentId, taskId: t.id, personId: p.id, personName: p.name, title: 'output' in t ? t.output.label : t.kind,
            instruction: 'instruction' in t ? t.instruction : t.detail, createdAt: t.createdAt, ownerId: t.ownerId ?? null,
            ownerName: owner && eligible.some(x => x.userId === owner.userId) ? owner.displayName : 'Unassigned or unavailable',
            assignmentHistory: t.assignmentHistory ?? [], newAssignment: mine && !t.assignmentNotice?.seenAt,
            eligibleOwners: eligible.map(x => ({ id: x.userId, name: x.displayName })), canAssign: manage(s, m, p) && (kind !== 'identity-merge' || stewardRole(m)),
            href: `/?patient=${encodeURIComponent(p.id)}${kind === 'correction' ? `&visit=${encodeURIComponent(parentId)}` : ''}` });
    };
    for (const v of s.workspace.visits) {
        const p = s.workspace.people.find(x => x.id === v.personId);
        if (p)
            for (const t of v.correctionTasks ?? [])
                if (t.state === 'open')
                    add('correction', v.id, p, t, [p]);
    }
    for (const k of s.identityCases ?? []) {
        const ps = [k.survivorId, k.duplicateId].map(id => s.workspace.people.find(x => x.id === id));
        if (ps.some(x => !x))
            continue;
        for (const t of k.items)
            if (t.state === 'open') {
                const p = ps.find(x => x.id === t.personId);
                if (p)
                    add('identity-merge', k.id, p, t, ps);
            }
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || `${a.kind}:${a.parentId}:${a.taskId}`.localeCompare(`${b.kind}:${b.parentId}:${b.taskId}`));
    return rows;
}
async function backfillPlan(s, p, u, now) {
    const visits = s.workspace.visits.filter(v => v.personId === p.id && v.correctionTasks === undefined && (v.voidedAt || v.supersededBy)).sort((a, b) => a.id.localeCompare(b.id));
    if (visits.length > 100)
        fail(413, 'Backfill at most 100 historical visits per patient; a staged reviewed migration is required.');
    for (const v of visits)
        if (!v.voidedAt && !s.workspace.visits.some(x => x.id === v.supersededBy && x.personId === p.id && x.amendsVisitId === v.id))
            fail(409, 'A historical amendment link is missing. Review the original record before backfilling.');
    const items = visits.map(v => ({ visit: v, cause: v.voidedAt ? 'void' : 'amend', correctionVisitId: v.voidedAt ? null : v.supersededBy ?? null })).map(x => ({ ...x, tasks: correctionTasks(s, x.visit, x.cause, u, now, x.correctionVisitId) }));
    const planHash = await digest({ version: 1, personId: p.id, personVersion: p.version, items: items.map(x => ({ visitId: x.visit.id, version: x.visit.version, cause: x.cause, correctionVisitId: x.correctionVisitId, correctionVersion: s.workspace.visits.find(v => v.id === x.correctionVisitId)?.version ?? null, tasks: x.tasks.map(({ id, createdAt, createdBy, ownerId, ...rest }) => rest) })) });
    return { planHash, items };
}
export async function applyReconciliation(s, input, u, m, now = new Date().toISOString()) {
    const parsed = reconciliationSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    authorizeReconciliation(s, m, c);
    const p = person(s.workspace, c.personId);
    let result;
    if (c.type === 'previewReconciliationBackfill' || c.type === 'applyReconciliationBackfill') {
        if (c.type === 'applyReconciliationBackfill' && s.workspace.visits.some(v => v.personId === p.id && v.reconciliationBackfill?.planHash === c.planHash))
            return { applied: 0, replayed: true, planHash: c.planHash };
        const plan = await backfillPlan(s, p, u, now);
        if (c.type === 'previewReconciliationBackfill') {
            s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `Historical reconciliation backfill previewed: ${plan.items.length} visits, no task or output changed.` });
            return { planHash: plan.planHash, visits: plan.items.map(x => ({ visitId: x.visit.id, cause: x.cause, tasks: x.tasks.map(t => ({ kind: t.output.kind, title: t.output.label, action: t.action, state: t.state })) })), externalSends: 0 };
        }
        if (c.planHash !== plan.planHash)
            fail(409, 'Historical work changed. Preview the backfill again before applying it.');
        for (const x of plan.items) {
            for (let i = 0; i < x.tasks.length; i++)
                x.tasks[i].id = 'backfill_' + (await digest([p.id, x.visit.id, x.cause, x.tasks[i].output.kind, x.tasks[i].output.refId, i])).slice(0, 40);
            x.visit.correctionTasks = x.tasks;
            x.visit.reconciliationBackfill = { planHash: c.planHash, by: u.userId, at: now };
            x.visit.version++;
        }
        result = { applied: plan.items.length, planHash: c.planHash, externalSends: 0 };
    }
    else {
        const found = locate(s, m, c), t = found.task;
        if (t.state !== 'open')
            fail(409, 'This task is no longer open.');
        if (c.type === 'assignReconciliationTask') {
            if ((t.assignmentHistory?.length ?? 0) !== c.expectedHistory || (t.ownerId ?? null) !== c.expectedOwnerId)
                fail(409, 'The assignment changed. Refresh before assigning.');
            const owner = s.members.find(x => x.userId === c.ownerId);
            if (!owner || owner.status !== 'active' || !found.people.every(p => normallyAllowed(owner, p)) || (found.merge ? !stewardRole(owner) : !found.people.every(p => manage(s, owner, p))))
                fail(403, 'The assignee must have current care access to every affected record.');
            if ((t.assignmentHistory?.length ?? 0) >= 100)
                fail(413, 'Assignment history is full; existing evidence is preserved.');
            (t.assignmentHistory ??= []).push({ by: u.userId, at: now, from: t.ownerId ?? null, to: owner.userId, reason: c.reason });
            t.ownerId = owner.userId;
            t.assignmentNotice = { to: owner.userId, at: now };
            result = { ownerId: owner.userId, notifiedInApp: true };
        }
        else {
            t.assignmentNotice.seenAt ??= now;
            result = { acknowledged: true };
        }
        if (found.visit)
            found.visit.version++;
        if (found.merge)
            found.merge.version++;
    }
    s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: c.type === 'applyReconciliationBackfill' ? `Historical reconciliation tasks appended from reviewed plan ${result.planHash}; ${result.applied} visits; no external action. Reason: ${c.type === 'applyReconciliationBackfill' ? c.reason : ''}.` : c.type === 'assignReconciliationTask' ? `Reconciliation task ${c.taskId} assigned to ${c.ownerId}. ${c.reason} No output was changed or sent.` : 'In-app reconciliation assignment acknowledged.' });
    return result;
}
