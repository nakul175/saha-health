import { z } from 'zod';
import { fail, uuid } from './core.js';
import { exceptionalGrant, normallyAllowed } from './access.js';
export const MIN_MINUTES = 15, MAX_MINUTES = 240, MAX_ACTIVE = 3, MAX_PER_DAY = 10;
const id = z.string().trim().min(1).max(200), reason = z.string().trim().min(20, 'Explain the emergency in at least 20 characters.').max(1000), note = z.string().trim().min(5).max(1000);
export const exceptionalSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('exceptionalOpen'), recordRef: z.string().trim().min(4).max(100), minutes: z.number().int().min(MIN_MINUTES).max(MAX_MINUTES), reason }).strict(),
    z.object({ type: z.literal('exceptionalClose'), personId: id, grantId: id }).strict(),
    z.object({ type: z.literal('exceptionalReview'), personId: id, grantId: id, outcome: z.enum(['appropriate', 'inappropriate']), note }).strict(),
]);
// Commands a clinician may run on a patient reached only through exceptional access.
export const PERMITTED_UNDER_EXCEPTIONAL = new Set(['startVisit', 'saveVisit', 'confirmVisit', 'createReferral', 'createDirectoryReferral', 'saveClinicalConcern', 'checkProtocol', 'scheduleFollowUp', 'saveProgrammeAnswers', 'exceptionalClose', 'attachMedia']);
// Slice 6r: every patient a command names, directly or through a visit, submission, referral, message,
// identity or safety case, or legal hold. A reference that cannot be resolved names no loaded patient.
function targets(s, c) {
    const w = s.workspace, ids = new Set(), add = (x) => { if (typeof x === 'string' && x)
        ids.add(x); };
    for (const k of ['personId', 'survivorId', 'duplicateId', 'proxyPersonId', 'recipientId'])
        add(c?.[k]);
    if (Array.isArray(c?.personIds))
        c.personIds.forEach(add);
    if (c?.visitId)
        add(w.visits.find(v => v.id === c.visitId)?.personId);
    if (Array.isArray(c?.visitIds))
        for (const id of c.visitIds)
            add(w.visits.find(v => v.id === id)?.personId);
    if (c?.submissionId)
        add(w.submissions.find(v => v.id === c.submissionId)?.personId);
    if (c?.referralId)
        add(w.referrals.find(v => v.id === c.referralId)?.personId);
    if (c?.messageId)
        add(s.outreach?.messages.find(v => v.id === c.messageId)?.personId);
    if (c?.caseId) {
        const k = (s.identityCases ?? []).find(x => x.id === c.caseId);
        if (k) {
            add(k.survivorId);
            add(k.duplicateId);
        }
        add(s.governance?.safety?.find((x) => x.id === c.caseId)?.personId);
    }
    if (c?.holdId)
        add(s.retention?.holds.find(x => x.id === c.holdId)?.personId);
    // Slice 6u: outreach plan references. An item command (planId+itemId, including messageCreate) names that
    // item's patient; a plan-level command (planId alone, for example outreachTransition) names every item's patient.
    if (c?.planId) {
        const plan = s.outreach?.plans.find(x => x.id === c.planId);
        if (plan) {
            if (c.itemId)
                add(plan.items.find(x => x.id === c.itemId)?.personId);
            else
                plan.items.forEach(x => add(x.personId));
        }
    }
    return w.people.filter(p => ids.has(p.id));
}
// Refuses anything beyond urgent care when any patient the command names is reachable by the member only
// through an emergency grant (fails closed across every reference, not just the first).
export function ensureExceptionalScope(s, m, c, now = new Date().toISOString()) {
    if (PERMITTED_UNDER_EXCEPTIONAL.has(c.type))
        return;
    if (targets(s, c).some(p => !normallyAllowed(m, p) && exceptionalGrant(m, p, now)))
        fail(403, 'Emergency access permits reading and recording urgent care only. Ask the patient\'s team for anything else.');
}
export function resolveRecord(s, ref) {
    const r = ref.trim().toLowerCase().replace(/^record\s+/, '');
    const found = s.workspace.people.filter(p => { const i = p.id.toLowerCase(); return i === r || i === 'p_' + r || (r.length >= 8 && i.startsWith(r)); });
    if (!found.length)
        fail(404, 'No record matches this reference in this organisation.');
    if (found.length > 1)
        fail(409, 'This reference matches more than one record. Enter the full record reference.');
    return found[0];
}
// Slice 6r: the reviewer must also be normally allowed to see the patient (role and scope), not merely hold a team id.
const reviewer = (s, m, p) => m.status === 'active' && (m.role === 'supervisor' || (m.isOwner && m.role !== 'admin')) && m.teamIds.includes(p.teamId) && normallyAllowed(m, p);
export function applyExceptional(s, input, u, m, now = new Date().toISOString()) {
    const parsed = exceptionalSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    const w = s.workspace;
    let p, detail, result = { ok: true };
    if (c.type === 'exceptionalOpen') {
        if (m.role !== 'clinician' || m.status !== 'active')
            fail(403, 'Only a clinician can open emergency access.');
        p = resolveRecord(s, c.recordRef);
        if (normallyAllowed(m, p))
            fail(409, 'You already have access to this patient.');
        if (p.mergedInto)
            fail(409, 'This record was merged into another record. Use the surviving record.');
        if (exceptionalGrant(m, p, now))
            fail(409, 'You already have current emergency access to this patient.');
        const mine = w.people.flatMap(q => (q.exceptionalAccess ?? []).filter(g => g.userId === m.userId));
        if (mine.filter(g => !g.closedAt && g.until > now).length >= MAX_ACTIVE)
            fail(429, `At most ${MAX_ACTIVE} emergency accesses can be open at once. Close one first.`);
        const dayAgo = new Date(Date.parse(now) - 86400000).toISOString();
        if (mine.filter(g => g.from > dayAgo).length >= MAX_PER_DAY)
            fail(429, `At most ${MAX_PER_DAY} emergency accesses can be opened in 24 hours.`);
        if ((p.exceptionalAccess ?? []).length >= 200)
            fail(422, 'Emergency access history limit reached for this record; an archival policy is required.');
        const g = { id: uuid(), userId: m.userId, reason: c.reason, from: now, until: new Date(Date.parse(now) + c.minutes * 60000).toISOString() };
        (p.exceptionalAccess ??= []).push(g);
        p.version++;
        p.assigned = true;
        detail = `Emergency access opened for ${c.minutes} minutes by ${u.displayName}, outside normal care scope. Reading and urgent care recording only; review required. Reason: ${c.reason}`;
        result = { personId: p.id, grantId: g.id, until: g.until };
    }
    else {
        p = w.people.find(x => x.id === c.personId);
        if (!p)
            fail(404, 'Patient not found.');
        const g = (p.exceptionalAccess ?? []).find(x => x.id === c.grantId);
        if (!g)
            fail(404, 'Emergency access grant not found.');
        if (c.type === 'exceptionalClose') {
            if (g.userId !== m.userId)
                fail(403, 'Only the clinician who opened emergency access can close it early.');
            if (g.closedAt || g.until <= now)
                fail(409, 'This emergency access has already ended.');
            g.closedAt = now;
            g.closedBy = u.userId;
            detail = 'Emergency access closed early by the clinician who opened it.';
        }
        else {
            if (!reviewer(s, m, p))
                fail(403, 'A supervisor or owner of the patient\'s team must review emergency access.');
            if (g.userId === m.userId)
                fail(403, 'A different person must review your emergency access.');
            if (g.review)
                fail(409, 'This emergency access has already been reviewed.');
            if (!g.closedAt && g.until > now)
                fail(409, 'Review emergency access after it has ended.');
            g.review = { by: u.userId, at: now, outcome: c.outcome, note: c.note };
            detail = `Emergency access by ${s.members.find(x => x.userId === g.userId)?.displayName ?? 'a former member'} reviewed: ${c.outcome}. ${c.note}`;
        }
        p.version++;
    }
    w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail });
    return result;
}
export function authorizeExceptional(s, m, c) {
    if (c?.type === 'exceptionalOpen' && m.role !== 'clinician')
        fail(403, 'Only a clinician can open emergency access.');
    if (c?.type === 'exceptionalReview') {
        const p = s.workspace.people.find(x => x.id === c.personId);
        if (!p || !reviewer(s, m, p))
            fail(403, 'A supervisor or owner of the patient\'s team must review emergency access.');
    }
}
// Grants the viewer holds, and grants the viewer may review.
export function exceptionalView(s, m, now = new Date().toISOString()) {
    const name = (id) => s.members.find(x => x.userId === id)?.displayName ?? 'Former member';
    const row = (p, g) => ({ personId: p.id, name: p.name, grantId: g.id, user: name(g.userId), userId: g.userId, reason: g.reason, from: g.from, until: g.until, closedAt: g.closedAt ?? null, active: !g.closedAt && g.until > now, review: g.review ? { ...g.review, by: name(g.review.by) } : null });
    const mine = s.workspace.people.flatMap(p => (p.exceptionalAccess ?? []).filter(g => g.userId === m.userId).map(g => row(p, g))).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 20);
    const reviews = s.workspace.people.filter(p => reviewer(s, m, p)).flatMap(p => (p.exceptionalAccess ?? []).filter(g => g.userId !== m.userId && !g.review).map(g => row(p, g))).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 100);
    const reviewed = s.workspace.people.filter(p => reviewer(s, m, p)).flatMap(p => (p.exceptionalAccess ?? []).filter(g => g.review).map(g => row(p, g))).sort((a, b) => b.review.at.localeCompare(a.review.at)).slice(0, 20);
    return { canOpen: m.role === 'clinician', canReview: m.status === 'active' && (m.role === 'supervisor' || (m.isOwner && m.role !== 'admin')), mine, reviews, reviewed, limits: { minMinutes: MIN_MINUTES, maxMinutes: MAX_MINUTES, maxActive: MAX_ACTIVE, maxPerDay: MAX_PER_DAY }, rule: 'Emergency access is for urgent care of a patient outside your normal scope. It lasts at most four hours, permits reading and recording urgent care only, and is reviewed afterwards by a supervisor or owner of the patient\'s team.' };
}
