import { transitionSuperseded, followUpOpen } from './programmes.js';
import { z } from 'zod';
import { fail, person, uuid } from './core.js';
import { allowed, normallyAllowed, allowedFor } from './access.js';
import { PACKS } from './programmes.js';
import { escalation, STATE_LABEL, TERMINAL } from './referral-rules.js';
import { supervises } from './delegation.js';
const ATTENTION = { escalated: 0, overdue: 1, 'due-today': 2, now: 3, undated: 4, upcoming: 5, waiting: 6 };
const URGENCY = { emergency: 0, urgent: 1, routine: 2 };
const KIND = { 'safety-case': 0, referral: 1, 'protocol-review': 2, 'ai-disagreement': 3, 'follow-up': 4, outreach: 5, 'message-follow-up': 6, correction: 7 };
const day = 86400000;
// Stewards may reassign any open item of a patient in their team; this mirrors referrals.ts.
export // Slice 1e: a team supervisor or owner with a care role, or a clinician holding a supervision delegation for the team.
 const steward = (s, m, p) => supervises(s, m, p.teamId);
// Eligible owners of care tasks: active care workers with normal (not emergency) access to the patient.
export const eligibleOwner = (o, p) => !!o && ['asha', 'clinician'].includes(o.role) && normallyAllowed(o, p);
const careWorker = (m, p) => ['asha', 'clinician'].includes(m.role) && normallyAllowed(m, p);
function dated(due, now) {
    const today = now.slice(0, 10);
    if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due))
        return { attention: 'undated', daysOverdue: 0 };
    if (due < today)
        return { attention: 'overdue', daysOverdue: Math.floor((Date.parse(today) - Date.parse(due)) / day) };
    return { attention: due === today ? 'due-today' : 'upcoming', daysOverdue: 0 };
}
const SOURCE_LABEL = { visit: 'Visit', 'protocol-evaluation': 'Protocol evaluation', 'programme-episode': 'Programme episode' };
// Slice 4d: who may record or remove a dependency: a steward of the patient's team or a clinician with normal access.
const canLink = (s, m, p) => steward(s, m, p) || (m.role === 'clinician' && normallyAllowed(m, p));
// Reads one referenced item from its own record. found=false when it is not this patient's; open=true when it is still open work.
export function describe(s, p, r) {
    if (r.kind === 'follow-up') {
        const f = p.followUps?.find(x => x.id === r.id);
        return f ? { found: true, open: followUpOpen(s, f), title: f.title } : { found: false, open: false, title: 'Unknown follow-up' };
    }
    if (r.kind === 'referral') {
        const x = s.workspace.referrals.find(y => y.id === r.id && y.personId === p.id);
        return x ? { found: true, open: !TERMINAL.has(x.state), title: `Referral to ${x.facility}` } : { found: false, open: false, title: 'Unknown referral' };
    }
    for (const v of s.workspace.visits)
        if (v.personId === p.id) {
            const c = v.protocolChecks?.find(x => x.id === r.id);
            if (!c)
                continue;
            const open = !v.voidedAt && !v.supersededBy && v.protocolChecks.at(-1) === c && !c.decision && c.findings.length > 0;
            return { found: true, open, title: `Review ${c.findings.length} protocol finding${c.findings.length === 1 ? '' : 's'}` };
        }
    return { found: false, open: false, title: 'Unknown protocol review' };
}
const norm = (s) => s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function actionPlan(s, m, p, now = new Date().toISOString()) {
    if (m.role === 'admin' || !allowed(m, p, now))
        fail(403, 'This patient is outside your current care scope.');
    const members = new Map(s.members.filter(x => x.status === 'active').map(x => [x.userId, x])), team = s.teams.find(t => t.id === p.teamId)?.name ?? 'the patient\'s team';
    const lead = steward(s, m, p), care = careWorker(m, p);
    const who = (id, eligible) => { if (!id)
        return null; const o = members.get(id); return { userId: id, displayName: o?.displayName ?? 'Former member', role: o?.role ?? 'unknown', eligible: eligible(o) }; };
    const gapFor = (owner, label = 'care worker') => !owner ? `No named ${label}` : !owner.eligible ? `${owner.displayName} no longer has current care access` : null;
    const items = [], base = new Map();
    // Programme follow-ups. Same title, due date and owner across programme episodes are one reminder
    // with every source kept; different titles, dates or owners stay separate work (BR-CARE-05).
    const groups = new Map();
    for (const t of p.followUps ?? [])
        if (followUpOpen(s, t)) {
            const k = [norm(t.title), t.due, t.ownerId].join('|');
            groups.set(k, [...(groups.get(k) ?? []), t]);
        }
    for (const group of groups.values()) {
        const t = group[0], owner = who(t.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner), d = dated(t.due, now);
        const programmes = group.map(x => PACKS.find(pk => pk.id === x.packId)?.name ?? x.packId);
        items.push({ key: 'follow-up:' + group.map(x => x.id).sort().join('+'), kind: 'follow-up', title: t.title, reason: group.length > 1 ? `Scheduled by ${group.length} programme episodes (${[...new Set(programmes)].join(', ')}); shown once` : `${programmes[0]} follow-up`,
            sources: group.map((x, i) => ({ kind: 'follow-up', id: x.id, label: `${programmes[i]} follow-up`, programme: programmes[i] })), owner, queue: gap ? `Supervisors of ${team}` : null, ownershipGap: gap, due: t.due, urgency: 'routine', status: d.attention === 'overdue' ? 'Overdue' : 'Open', daysOverdue: d.daysOverdue, attention: gap ? 'escalated' : d.attention,
            assignVia: 'action-plan', targets: group.map(x => ({ kind: 'follow-up', id: x.id, version: p.version })), canAssign: lead && group.every(x => x.state === 'open'), canClaim: !!gap && care && group.every(x => x.state === 'open'), refs: group.map(x => ({ kind: 'follow-up', id: x.id })), waitingOn: [], blocks: [] });
    }
    // Referrals, with the slice 4a escalation rules.
    for (const r of s.workspace.referrals)
        if (r.personId === p.id && !TERMINAL.has(r.state)) {
            const owner = who(r.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner), e = escalation(r, !!owner?.eligible, now), d = dated(r.due ?? null, now);
            base.set('referral:' + r.id, r.reason);
            // Slice 4d: the referral's own visit is its first source; further linked sources follow in link order.
            // Slice 10f: a source linked because a programme pack asked for the referral says which pack asked.
            const sources = [{ kind: 'referral', id: r.id, label: 'Referral', visitId: r.visitId, link: 'visit', at: r.createdAt }, ...(r.sources ?? []).map(x => ({ kind: 'referral', id: x.refId, label: `${(r.packRequests ?? []).filter(q => q.sourceId === x.id).map(q => `Asked by ${q.packName} v${q.packVersion}`)[0] ?? SOURCE_LABEL[x.kind]} · ${x.sourceAt.slice(0, 10)}`, visitId: x.visitId, link: x.kind, at: x.sourceAt }))];
            items.push({ key: 'referral:' + r.id, kind: 'referral', title: `Referral to ${r.facility}`, reason: r.reason + (e.reasons.length ? ` · ${e.reasons.join('; ')}` : ''), sources, owner, queue: gap ? `Supervisors of ${team}` : null, ownershipGap: gap, due: r.due ?? null, urgency: r.urgency ?? 'routine',
                status: STATE_LABEL[r.state] ?? r.state, daysOverdue: e.daysOverdue || d.daysOverdue, attention: gap || e.level === 'escalated' ? 'escalated' : d.attention, assignVia: 'action-plan', targets: [{ kind: 'referral', id: r.id, version: r.version ?? 1 }], canAssign: lead, canClaim: !!gap && care, refs: [{ kind: 'referral', id: r.id }], waitingOn: [], blocks: [] });
        }
    // Open clinical safety cases: owner must be a clinician with normal access (governance.ts ownPatient).
    for (const c of s.governance?.safety ?? [])
        if (c.personId === p.id && c.state === 'open') {
            const owner = who(c.ownerId, o => !!o && o.role === 'clinician' && normallyAllowed(o, p)), gap = gapFor(owner, 'clinical owner');
            items.push({ key: 'safety-case:' + c.id, kind: 'safety-case', title: `Clinical safety case: ${c.kind.replace(/-/g, ' ')}`, reason: c.summary, sources: [{ kind: 'safety-case', id: c.id, label: 'Safety case', visitId: c.visitId }], owner, queue: gap ? `Clinicians of ${team}` : null, ownershipGap: gap, due: null, urgency: 'urgent', status: 'Open', daysOverdue: 0, attention: 'escalated',
                assignVia: 'governance', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [] });
        }
    // The latest protocol evaluation of each current visit, when it has findings and no clinician decision.
    // It belongs to the team's clinician review queue rather than a named person.
    const clinicians = [...members.values()].filter(o => o.role === 'clinician' && normallyAllowed(o, p)).length;
    for (const v of s.workspace.visits)
        if (v.personId === p.id && !v.voidedAt && !v.supersededBy) {
            const check = v.protocolChecks?.at(-1);
            if (!check || check.decision || !check.findings.length)
                continue;
            const urgent = check.findings.some(f => f.urgency === 'urgent_review'), gap = clinicians ? null : `No clinician with current access in ${team}`;
            items.push({ key: 'protocol-review:' + check.id, kind: 'protocol-review', title: `Review ${check.findings.length} protocol finding${check.findings.length === 1 ? '' : 's'}`, reason: check.findings.map(f => f.label).join('; '), sources: [{ kind: 'protocol-review', id: check.id, label: 'Protocol evaluation', visitId: v.id }], owner: null, queue: `Clinicians of ${team}`, ownershipGap: gap, due: null, urgency: urgent ? 'urgent' : 'routine', status: 'Awaiting clinician review', daysOverdue: 0,
                attention: gap ? 'escalated' : urgent ? 'now' : 'undated', assignVia: 'none', targets: [], canAssign: false, canClaim: false, refs: [{ kind: 'protocol-review', id: check.id }], waitingOn: [], blocks: [] });
        }
    // Slice 5c (BR-AG-08): open assistant results on the same visit version that disagree are one review task for
    // the worker who requested them, listing every original value; nothing is combined.
    for (const v of s.workspace.visits)
        if (v.personId === p.id && !v.voidedAt && !v.supersededBy && v.state === 'draft') {
            const runs = (v.agentRuns ?? []).filter(r => r.status === 'review' && !r.reviewDecision && r.visitVersion === v.version && r.conflicts?.some(c => c.kind === 'other-run'));
            if (!runs.length)
                continue;
            const values = new Map();
            for (const r of runs)
                for (const c of r.conflicts)
                    if (c.kind === 'other-run')
                        values.set(c.field, new Set([...(values.get(c.field) ?? []), `${c.proposed} (${r.provider.name})`]));
            const owner = who(runs[0].actorId, o => eligibleOwner(o, p)), gap = gapFor(owner);
            items.push({ key: 'ai-disagreement:' + v.id + ':' + runs.map(r => r.id).sort().join(','), kind: 'ai-disagreement', title: 'Assistant results disagree', reason: [...values].map(([f, xs]) => `${f}: ${[...xs].join(' vs ')}`).join('; ') + '. Choose explicitly or record the value manually.', sources: runs.map(r => ({ kind: 'ai-disagreement', id: r.id, label: 'Assistant result · ' + r.provider.name, visitId: v.id })), owner, queue: gap ? `Care workers of ${team}` : null, ownershipGap: gap, due: null, urgency: 'routine', status: 'Awaiting reviewer choice', daysOverdue: 0, attention: gap ? 'escalated' : 'now', assignVia: 'none', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [] });
        }
    // Slice 2j: open correction tasks recorded when a confirmed visit was amended or voided. External outputs come
    // first (urgent); each names its owner (the worker who corrected the visit) and is closed with evidence here.
    for (const v of s.workspace.visits)
        if (v.personId === p.id)
            for (const t of v.correctionTasks ?? [])
                if (t.state === 'open') {
                    const owner = who(t.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner), ageDays = Math.max(0, Math.floor((Date.parse(now) - Date.parse(t.createdAt)) / day));
                    items.push({ key: 'correction:' + t.id, kind: 'correction', title: `${t.cause === 'amend' ? 'Corrected' : 'Wrong-patient'} visit: ${t.output.label}`, reason: t.instruction, sources: [{ kind: 'correction', id: t.id, label: `${t.cause === 'amend' ? 'Corrected' : 'Wrong-patient'} visit of ${(v.confirmedAt ?? v.createdAt).slice(0, 10)}`, visitId: v.id, link: 'visit', at: t.createdAt }], owner, queue: gap ? `Supervisors of ${team}` : null, ownershipGap: gap, due: null, urgency: t.external ? 'urgent' : 'routine',
                        status: `Open ${ageDays} day${ageDays === 1 ? '' : 's'} · ${t.output.stateAtCorrection}`, daysOverdue: 0, attention: gap ? 'escalated' : 'now', assignVia: 'none', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [],
                        correction: { taskId: t.id, visitId: v.id, correctionVisitId: t.correctionVisitId, cause: t.cause, action: t.action, external: t.external, outputKind: t.output.kind, destination: t.output.destination?.name ?? null, receipt: t.output.receipt ?? null, ageDays, since: t.createdAt, canClose: lead || care, receiptCloses: t.action === 'send-correction', href: `/?patient=${encodeURIComponent(p.id)}&visit=${encodeURIComponent(v.id)}` } });
                }
    // Outreach items and failed-message follow-ups keep their own reassignment on the Outreach page.
    for (const plan of s.outreach?.plans ?? [])
        if (!['completed', 'cancelled'].includes(plan.state))
            for (const i of plan.items)
                if (i.personId === p.id && !['completed', 'cancelled'].includes(i.state)) {
                    const owner = who(i.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner), d = dated(plan.date, now);
                    items.push({ key: 'outreach:' + i.id, kind: 'outreach', title: plan.title, reason: `Outreach ${plan.state}; item ${i.state}`, sources: [{ kind: 'outreach', id: i.id, label: 'Outreach plan' }], owner, queue: gap ? `Supervisors of ${team}` : null, ownershipGap: gap, due: plan.date, urgency: 'routine', status: i.state, daysOverdue: d.daysOverdue, attention: gap ? 'escalated' : d.attention, assignVia: 'outreach', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [] });
                }
    for (const msg of s.outreach?.messages ?? [])
        if (msg.personId === p.id && msg.recovery?.state === 'open') {
            const owner = who(msg.recovery.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner);
            items.push({ key: 'message-follow-up:' + msg.id, kind: 'message-follow-up', title: 'Follow up a failed reminder', reason: 'A simulated reminder failed; the patient has not been reached by message.', sources: [{ kind: 'message-follow-up', id: msg.id, label: 'Message follow-up' }], owner, queue: gap ? `Supervisors of ${team}` : null, ownershipGap: gap, due: null, urgency: 'routine', status: 'Open', daysOverdue: 0, attention: gap ? 'escalated' : 'undated', assignVia: 'outreach', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [] });
        }
    // Installed escalations are independent work, never hidden by visit void/correction, AI or follow-up completion.
    for (const x of (p.installedWork ?? []).filter(x => x.kind === 'escalation' && x.state !== 'resolved' && normallyAllowed(m, p) && allowedFor(m, p, s.operations?.purposeGrants, 'care-coordination'))) {
        const owner = who(x.ownerId, o => eligibleOwner(o, p)), gap = gapFor(owner, 'clinician reviewer');
        items.push({ key: 'installed:' + x.id, kind: 'protocol-review', title: x.title, reason: 'Installed rule ' + x.ruleId + ' · ' + x.packId + ' v' + x.packVersion + ' · ' + (x.sourceStatus === 'review-required' ? 'Source changed: independent review required' : 'Confirmed source') + ' · Synthetic governance; clinical approval pending', sources: [{ kind: 'protocol-review', id: x.id, label: 'Installed rule ' + x.ruleId, visitId: x.visitId, at: x.confirmedAt }], owner, queue: 'Independent clinician', ownershipGap: gap, due: x.due, urgency: x.urgency === 'urgent_review' ? 'urgent' : 'routine', status: x.state === 'acknowledged' ? 'Acknowledged; still unresolved' : 'Unresolved installed escalation', daysOverdue: dated(x.due, now).daysOverdue, attention: 'escalated', assignVia: 'none', targets: [], canAssign: false, canClaim: false, refs: [], waitingOn: [], blocks: [] });
    }
    // Slice 4d: recorded dependencies. A dependent item waits while its blocker is open work in this plan; its own
    // due date does not make it overdue meanwhile, but an ownership gap still escalates it. The blocker keeps its own
    // attention, so an overdue blocker still surfaces. Nothing is derived automatically.
    const byRef = new Map();
    for (const i of items)
        for (const r of i.refs)
            byRef.set(r.kind + ':' + r.id, i);
    const pairs = [];
    for (const dep of p.planDependencies ?? []) {
        if (dep.removed)
            continue;
        const a = byRef.get(dep.dependent.kind + ':' + dep.dependent.id), b = byRef.get(dep.blocker.kind + ':' + dep.blocker.id);
        if (!a || !b || a === b || pairs.some(x => x.a === a && x.b === b))
            continue;
        pairs.push({ id: dep.id, a, b });
    }
    // Mark every waiting item first, so a chain shows its blocker's own waiting state.
    for (const i of new Set(pairs.map(x => x.a))) {
        i.attention = i.ownershipGap ? 'escalated' : 'waiting';
        i.daysOverdue = 0;
        i.status = `Waiting for ${pairs.filter(x => x.a === i).map(x => x.b.title).join('; ')}`;
        if (base.has(i.key))
            i.reason = base.get(i.key);
        i.reason += ' · Waiting: not counted as overdue while the blocking item is open.';
    }
    for (const { id, a, b } of pairs) {
        a.waitingOn.push({ dependencyId: id, key: b.key, title: b.title, status: b.status, attention: b.attention, daysOverdue: b.daysOverdue });
        b.blocks.push({ dependencyId: id, key: a.key, title: a.title });
    }
    items.sort((a, b) => ATTENTION[a.attention] - ATTENTION[b.attention] || URGENCY[a.urgency] - URGENCY[b.urgency] || b.daysOverdue - a.daysOverdue || (a.due ?? '9999').localeCompare(b.due ?? '9999') || KIND[a.kind] - KIND[b.kind] || a.key.localeCompare(b.key));
    const eligible = [...members.values()].filter(o => eligibleOwner(o, p)).map(o => ({ userId: o.userId, displayName: o.displayName, role: o.role })).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId));
    const names = new Map(s.members.map(x => [x.userId, x.displayName]));
    const dependencies = (p.planDependencies ?? []).map(dep => {
        const a = describe(s, p, dep.dependent), b = describe(s, p, dep.blocker);
        return { id: dep.id, dependent: { ...dep.dependent, title: a.title, open: a.open }, blocker: { ...dep.blocker, title: b.title, open: b.open }, at: dep.at, by: names.get(dep.by) ?? 'Former member', reason: dep.reason,
            state: dep.removed ? 'removed' : !a.open ? 'closed' : !b.open ? 'released' : 'waiting', removed: dep.removed ? { ...dep.removed, by: names.get(dep.removed.by) ?? 'Former member' } : null };
    }).reverse();
    return { personId: p.id, personVersion: p.version, generatedAt: now, items, unowned: items.filter(i => i.ownershipGap).length, waiting: items.filter(i => i.waitingOn.length).length, canAssign: lead, canLink: canLink(s, m, p), dependencies, eligibleOwners: lead ? eligible : eligible.filter(o => o.userId === m.userId),
        rules: 'Ordered: ownership gaps and escalations first, then overdue, due today, needing review now, undated and upcoming, then items waiting on another open item; within each, higher urgency and longer overdue first. Follow-ups with the same title, due date and owner are shown once with every programme source. A waiting item is not counted as overdue while its blocker is open; the blocker keeps its own order. Computed on read; nothing is sent.' };
}
// Take ownership of, or reassign, open follow-ups and referrals shown in the plan (BR-CARE-01).
const text = z.string().trim().min(10).max(500), id = z.string().trim().min(1).max(200);
const ref = z.object({ kind: z.enum(['follow-up', 'referral', 'protocol-review']), id }).strict();
export const actionPlanSchema = z.discriminatedUnion('type', [
    // Slice 4d: one item waits on another item of the same patient; removal keeps the record and needs a reason.
    z.object({ type: z.literal('linkPlanItems'), personId: id, version: z.number().int().positive(), dependent: ref, blocker: ref, reason: text }).strict(),
    z.object({ type: z.literal('unlinkPlanItems'), personId: id, version: z.number().int().positive(), dependencyId: id, reason: text }).strict(),
    z.object({ type: z.literal('assignPlanItem'), personId: id, version: z.number().int().positive(), targets: z.array(z.object({ kind: z.enum(['follow-up', 'referral']), id, version: z.number().int().positive() }).strict()).min(1).max(20), ownerId: id, reason: text }).strict(),
]);
export function authorizeActionPlan(s, m, c) {
    if (c?.type === 'linkPlanItems' || c?.type === 'unlinkPlanItems') {
        const p = person(s.workspace, c.personId);
        if (!canLink(s, m, p))
            fail(403, 'A clinician with current access, or a supervisor or owner of the patient\'s team, records dependencies between plan items.');
        return;
    }
    if (c?.type !== 'assignPlanItem')
        return;
    const p = person(s.workspace, c.personId);
    if (steward(s, m, p))
        return;
    if (!careWorker(m, p))
        fail(403, 'A supervisor or owner of the patient\'s team, or a care worker with current access, is required.');
    if (c.ownerId !== m.userId)
        fail(403, 'Care workers can take ownership for themselves only. Ask a supervisor to assign someone else.');
}
export function applyActionPlan(s, input, u, m, now = new Date().toISOString()) {
    const parsed = actionPlanSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data, w = s.workspace;
    authorizeActionPlan(s, m, c);
    const p = person(w, c.personId);
    if (p.version !== c.version)
        fail(409, 'Patient changed. Refresh the action plan before assigning.');
    if (c.type === 'linkPlanItems' || c.type === 'unlinkPlanItems')
        return applyDependency(s, c, p, u, m, now);
    if (new Set(c.targets.map(t => t.kind + ':' + t.id)).size !== c.targets.length)
        fail(422, 'List each item once.');
    const owner = s.members.find(x => x.userId === c.ownerId && x.status === 'active');
    if (!eligibleOwner(owner, p))
        fail(422, 'Choose an active care worker with current access to this patient.');
    const lead = steward(s, m, p), changed = [];
    let personChanged = false;
    for (const t of c.targets) {
        if (t.kind === 'follow-up') {
            const f = p.followUps?.find(x => x.id === t.id);
            if (!f || f.state !== 'open' || transitionSuperseded(s, f))
                fail(409, 'Choose an open follow-up of this patient.');
            if (!lead && eligibleOwner(s.members.find(x => x.userId === f.ownerId && x.status === 'active'), p))
                fail(403, 'This follow-up already has an owner with current access. Ask a supervisor to reassign it.');
            if (f.ownerId === owner.userId)
                fail(409, 'This follow-up already belongs to that care worker.');
            changed.push(`follow-up "${f.title}" from ${f.ownerId || 'nobody'}`);
            f.ownerId = owner.userId;
            personChanged = true;
        }
        else {
            const r = w.referrals.find(x => x.id === t.id && x.personId === p.id);
            if (!r || TERMINAL.has(r.state))
                fail(409, 'Choose an open referral of this patient.');
            if ((r.version ?? 1) !== t.version)
                fail(409, 'Referral changed. Refresh the action plan before assigning.');
            if (!lead && eligibleOwner(s.members.find(x => x.userId === r.ownerId && x.status === 'active'), p))
                fail(403, 'This referral already has an owner with current access. Ask a supervisor to reassign it.');
            if (r.ownerId === owner.userId)
                fail(409, 'This referral already belongs to that care worker.');
            changed.push(`referral to ${r.facility} from ${r.ownerId ?? 'nobody'}`);
            r.ownerId = owner.userId;
            r.version = (r.version ?? 1) + 1;
        }
    }
    if (personChanged)
        p.version++;
    w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `${c.ownerId === u.userId && !lead ? 'Ownership taken' : 'Reassigned'} to ${owner.displayName}: ${changed.join('; ')}. ${c.reason}` });
    return { assigned: c.targets.length, ownerId: owner.userId };
}
// Slice 4d: record or remove one dependency. Both items must be open work of this patient; cycles are refused.
const MAX_ACTIVE = 50, MAX_TOTAL = 200;
function applyDependency(s, c, p, u, m, now) {
    const w = s.workspace, deps = (p.planDependencies ??= []);
    if (c.type === 'unlinkPlanItems') {
        const dep = deps.find(x => x.id === c.dependencyId);
        if (!dep)
            fail(404, 'Dependency not found for this patient.');
        if (dep.removed)
            fail(409, 'This dependency was already removed.');
        dep.removed = { at: now, by: u.userId, reason: c.reason };
        p.version++;
        const a = describe(s, p, dep.dependent), b = describe(s, p, dep.blocker);
        w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `"${a.title}" no longer waits on "${b.title}". ${c.reason}` });
        return { dependencyId: dep.id, removed: true };
    }
    if (p.mergedInto)
        fail(409, 'This record was merged into another record.');
    if (c.dependent.kind === 'protocol-review')
        fail(422, 'A protocol review is never held back; choose a follow-up or referral to wait.');
    const key = (r) => r.kind + ':' + r.id;
    if (key(c.dependent) === key(c.blocker))
        fail(422, 'An item cannot wait on itself.');
    const a = describe(s, p, c.dependent), b = describe(s, p, c.blocker);
    if (!a.found || !b.found)
        fail(422, 'Both items must belong to this patient.');
    if (!a.open || !b.open)
        fail(409, 'Choose open items: a closed item cannot wait or hold another item back.');
    if (c.dependent.kind === 'follow-up' && c.blocker.kind === 'follow-up') {
        const f = p.followUps.find(x => x.id === c.dependent.id), g = p.followUps.find(x => x.id === c.blocker.id);
        if (norm(f.title) === norm(g.title) && f.due === g.due && f.ownerId === g.ownerId)
            fail(422, 'These follow-ups are shown as one reminder; one cannot wait on the other.');
    }
    const active = deps.filter(x => !x.removed);
    if (active.some(x => key(x.dependent) === key(c.dependent) && key(x.blocker) === key(c.blocker)))
        fail(409, 'This dependency is already recorded.');
    // Refuse a cycle: the new blocker must not already wait, directly or through others, on the dependent.
    const edges = new Map();
    for (const x of active)
        edges.set(key(x.dependent), [...(edges.get(key(x.dependent)) ?? []), key(x.blocker)]);
    const seen = new Set(), stack = [key(c.blocker)];
    while (stack.length) {
        const k = stack.pop();
        if (k === key(c.dependent))
            fail(422, 'This would make the items wait on each other.');
        if (seen.has(k))
            continue;
        seen.add(k);
        stack.push(...(edges.get(k) ?? []));
    }
    if (active.length >= MAX_ACTIVE || deps.length >= MAX_TOTAL)
        fail(422, 'Too many dependencies recorded for this patient; remove ones no longer needed.');
    const dep = { id: uuid(), dependent: { kind: c.dependent.kind, id: c.dependent.id }, blocker: { kind: c.blocker.kind, id: c.blocker.id }, at: now, by: u.userId, reason: c.reason };
    deps.push(dep);
    p.version++;
    w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `"${a.title}" waits on "${b.title}". ${c.reason}` });
    return { dependencyId: dep.id };
}
