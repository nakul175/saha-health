import { followUpOpen } from './programmes.js';
import { z } from 'zod';
import { fail, person, uuid } from './core.js';
import { allowed, normallyAllowed } from './access.js';
import { actionPlan } from './action-plan.js';
import { supervises } from './delegation.js';
import { ensurePurpose } from './purpose-scope.js';
import { TERMINAL } from './referral-rules.js';
import { CANCEL_REASONS, ITEM_KINDS, MAX_AHEAD_DAYS, MAX_COVERS, MAX_ITEMS, MAX_PLANNED, MAX_SLOTS, VISIT_WINDOWS } from './household-visit-constants.js';
const id = z.string().trim().min(1).max(100), ver = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x => !isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x, 'Enter a valid date.');
const item = z.object({ kind: z.enum(ITEM_KINDS), id }).strict();
export const householdVisitSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('householdVisitSchedule'), householdId: id, version: ver, date, window: z.enum(VISIT_WINDOWS), covers: z.array(z.object({ personId: id, items: z.array(item).min(1).max(MAX_ITEMS) }).strict()).min(1).max(MAX_COVERS) }).strict(),
    z.object({ type: z.literal('householdVisitReschedule'), householdId: id, version: ver, visitId: id, date, window: z.enum(VISIT_WINDOWS), personVersions: z.array(z.object({ personId: id, version: ver }).strict()).min(1).max(MAX_COVERS) }).strict(),
    z.object({ type: z.literal('householdVisitCancel'), householdId: id, version: ver, visitId: id, reason: z.enum(CANCEL_REASONS) }).strict(),
]);
const current = (h) => h.members.filter(x => !x.to);
const day = 86400000, addDays = (d, n) => new Date(Date.parse(d) + n * day).toISOString().slice(0, 10), iso = (d) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const same = (a, b) => a.kind === b.kind && a.id === b.id;
const careIn = (m, h) => ['asha', 'clinician'].includes(m.role) && m.teamIds.includes(h.teamId);
// One item as its own record states it now: title, whether it is still open work, and its own due date.
export function resolveItem(s, p, r) {
    if (r.kind === 'follow-up') {
        const f = p.followUps?.find(x => x.id === r.id);
        return f ? { found: true, open: followUpOpen(s, f), title: f.title, due: f.due } : { found: false, open: false, title: 'Follow-up', due: null };
    }
    if (r.kind === 'referral') {
        const x = s.workspace.referrals.find(y => y.id === r.id && y.personId === p.id);
        return x ? { found: true, open: !TERMINAL.has(x.state), title: `Referral to ${x.facility}`, due: x.due ?? null } : { found: false, open: false, title: 'Referral', due: null };
    }
    return r.id === p.id ? { found: true, open: p.status !== 'completed', title: 'Routine home visit', due: p.due ?? null } : { found: false, open: false, title: 'Routine home visit', due: null };
}
// Also applied when an idempotent request is replayed.
export function authorizeHouseholdVisit(s, m, c) {
    if (!['householdVisitSchedule', 'householdVisitCancel', 'householdVisitReschedule'].includes(c?.type))
        return;
    if (!['asha', 'clinician'].includes(m.role) && !(c.type === 'householdVisitCancel' && m.role === 'supervisor'))
        fail(403, 'A care role is required to plan household visits.');
    const h = (s.households ?? []).find(x => x.id === c.householdId);
    if (!h)
        fail(404, 'Household not found.');
    if (!m.teamIds.includes(h.teamId))
        fail(403, 'This household belongs to a care team you are not in.');
    if (c.type === 'householdVisitReschedule') {
        ensurePurpose(m, 'household-sharing');
        const slot = h.visits?.find(x => x.id === c.visitId);
        if (!slot)
            fail(404, 'Household visit not found.');
        if (slot.createdBy !== m.userId)
            fail(403, 'Only the care worker who planned this visit may reschedule it.');
        const members = new Set(current(h).map(x => x.personId));
        for (const cv of slot.covers) {
            const p = s.workspace.people.find(x => x.id === cv.personId);
            if (!p || !members.has(p.id) || !p.assigned || !normallyAllowed(m, p) || p.mergedInto)
                fail(403, 'Current care access to every covered household member is required to reschedule.');
        }
    }
}
const MESSAGE_MEMBERS = 'Choose current household members within your care scope.';
export function applyHouseholdVisit(s, input, u, m, now = new Date().toISOString()) {
    const parsed = householdVisitSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data, w = s.workspace;
    authorizeHouseholdVisit(s, m, c);
    const h = (s.households ?? []).find(x => x.id === c.householdId), today = now.slice(0, 10), slots = h.visits ??= [];
    if (h.version !== c.version)
        fail(409, 'This household changed. Refresh before planning a visit.');
    if (c.type === 'householdVisitReschedule') {
        const slot = slots.find(x => x.id === c.visitId);
        if (slot.state !== 'planned')
            fail(409, 'Only a planned household visit can be rescheduled.');
        if (c.date < today || c.date > addDays(today, MAX_AHEAD_DAYS))
            fail(422, `Choose a date from today to ${MAX_AHEAD_DAYS} days ahead.`);
        if (slot.date === c.date && slot.window === c.window)
            fail(409, 'Choose a different date or time window.');
        if (slots.length >= MAX_SLOTS)
            fail(422, 'A household can hold up to 100 recorded visit slots.');
        const versions = new Map(c.personVersions.map(x => [x.personId, x.version]));
        if (versions.size !== c.personVersions.length || versions.size !== slot.covers.length || slot.covers.some(cv => !versions.has(cv.personId)))
            fail(422, 'Refresh the versions of every covered household member.');
        for (const cv of slot.covers) {
            const p = w.people.find(x => x.id === cv.personId);
            if (p.version !== versions.get(p.id))
                fail(409, 'A covered record changed. Refresh before rescheduling.');
            for (const ref of cv.items) {
                const r = resolveItem(s, p, ref);
                if (!r.found || !r.open)
                    fail(409, 'Covered work changed or completed. Refresh the household plan.');
                if (slots.some(x => x.id !== slot.id && x.state === 'planned' && x.covers.some(y => y.personId === p.id && y.items.some(i => same(i, ref)))))
                    fail(409, 'Covered work is already included in another planned slot. Refresh the household plan.');
            }
        }
        // Validate everything before changing either record. Persisted history and receipt commit together.
        const replacement = { id: uuid(), date: c.date, window: c.window, workerId: slot.workerId, covers: structuredClone(slot.covers), state: 'planned', createdAt: now, createdBy: u.userId, replacesVisitId: slot.id };
        Object.assign(slot, { state: 'cancelled', cancelledAt: now, cancelledBy: u.userId, cancelReason: 'rescheduled', replacedByVisitId: replacement.id });
        slots.push(replacement);
        h.version++;
        for (const cv of slot.covers)
            w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: cv.personId, personId: cv.personId, detail: `Household visit rescheduled from ${slot.date} (${slot.window}) to ${replacement.date} (${replacement.window}); ${cv.items.length} item references retained for this person. Due dates, owners and completion conditions unchanged.` });
        return { visitId: replacement.id, replacesVisitId: slot.id, date: replacement.date, window: replacement.window, members: replacement.covers.length, items: replacement.covers.reduce((n, x) => n + x.items.length, 0) };
    }
    if (c.type === 'householdVisitCancel') {
        const slot = slots.find(x => x.id === c.visitId);
        if (!slot)
            fail(404, 'Household visit not found.');
        if (slot.state !== 'planned')
            fail(409, 'This household visit is already cancelled.');
        if (!(slot.createdBy === u.userId && careIn(m, h)) && !supervises(s, m, h.teamId, now))
            fail(403, 'Only the worker who planned this visit, or a supervisor or owner of the household\'s team, cancels it.');
        Object.assign(slot, { state: 'cancelled', cancelledAt: now, cancelledBy: u.userId, cancelReason: c.reason });
        h.version++;
        for (const cv of slot.covers) {
            const p = w.people.find(x => x.id === cv.personId);
            if (p)
                w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `Household visit planned for ${slot.date} cancelled (${c.reason.replace(/-/g, ' ')}). Items stay open with their own due dates.` });
        }
        return { visitId: slot.id, state: 'cancelled' };
    }
    if (!['asha', 'clinician'].includes(m.role))
        fail(403, 'A care role is required to plan household visits.');
    if (c.date < today || c.date > addDays(today, MAX_AHEAD_DAYS))
        fail(422, `Choose a date from today to ${MAX_AHEAD_DAYS} days ahead.`);
    if (slots.length >= MAX_SLOTS)
        fail(422, 'A household can hold up to 100 recorded visit slots.');
    if (slots.filter(x => x.state === 'planned').length >= MAX_PLANNED)
        fail(422, 'A household can have up to 10 planned visits at once. Cancel one first.');
    const members = new Set(current(h).map(x => x.personId)), seen = new Set(), covers = [], lines = [];
    for (const cv of c.covers) {
        if (seen.has(cv.personId))
            fail(422, 'Name each household member once.');
        seen.add(cv.personId);
        const p = w.people.find(x => x.id === cv.personId);
        // One refusal for a non-member and for a member outside the worker's scope, so the answer does not reveal membership.
        if (!p || !members.has(p.id) || !p.assigned || !normallyAllowed(m, p))
            fail(422, MESSAGE_MEMBERS);
        person(w, p.id);
        if (p.mergedInto)
            fail(409, 'A covered record was merged into another record. Plan the visit on the surviving record.');
        const refs = [], titles = [];
        for (const ref of cv.items) {
            if (refs.some(x => same(x, ref)))
                fail(422, 'Name each item once.');
            const r = resolveItem(s, p, ref);
            if (!r.found)
                fail(422, 'Each item must belong to the household member it is listed under.');
            if (!r.open)
                fail(409, `"${r.title}" is no longer open work. Refresh the household plan.`);
            const other = slots.find(x => x.state === 'planned' && x.covers.some(y => y.personId === p.id && y.items.some(i => same(i, ref))));
            if (other)
                fail(409, `"${r.title}" is already covered by the household visit planned for ${other.date}. Cancel that visit first.`);
            refs.push({ kind: ref.kind, id: ref.id });
            titles.push(r.title);
        }
        covers.push({ personId: p.id, items: refs });
        lines.push({ p, titles });
    }
    const slot = { id: uuid(), date: c.date, window: c.window, workerId: u.userId, covers, state: 'planned', createdAt: now, createdBy: u.userId };
    slots.push(slot);
    h.version++;
    // Each member's own audit line names only that member's items; nothing about the others.
    for (const { p, titles } of lines)
        w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `Household visit planned for ${c.date} (${c.window}) covering ${titles.length} item${titles.length === 1 ? '' : 's'} of this person: ${titles.join('; ')}. Due dates and completion conditions are unchanged; this person's observations are recorded on this person's own visit.` });
    return { visitId: slot.id, date: slot.date, window: slot.window, members: covers.length, items: covers.reduce((n, x) => n + x.items.length, 0) };
}
export function householdVisitPlan(s, m, h, now = new Date().toISOString()) {
    const today = now.slice(0, 10), slots = h.visits ?? [], names = new Map(s.members.map(x => [x.userId, x.displayName]));
    const coveredBy = (personId, ref) => slots.find(x => x.state === 'planned' && x.covers.some(cv => cv.personId === personId && cv.items.some(i => same(i, ref))));
    let outsideScope = 0;
    const members = current(h).flatMap(x => {
        const q = s.workspace.people.find(p => p.id === x.personId);
        if (!q || !allowed(m, q, now)) {
            outsideScope++;
            return [];
        }
        const own = q.mergedInto ? [] : actionPlan(s, m, q, now).items.filter(i => i.kind === 'follow-up' || i.kind === 'referral').slice(0, 50).map(i => {
            const refs = i.refs.filter(r => r.kind === 'follow-up' || r.kind === 'referral'), slot = refs.map(r => coveredBy(q.id, r)).find(Boolean);
            return { key: i.key, kind: i.kind, title: i.title, due: i.due, attention: i.attention, daysOverdue: i.daysOverdue, status: i.status, owner: i.owner?.displayName ?? null,
                programmes: [...new Set(i.sources.map(y => y.programme).filter((z) => !!z))], waitingOn: i.waitingOn.map(y => y.title), refs, covered: slot ? { visitId: slot.id, date: slot.date } : null };
        });
        const ref = { kind: 'home-visit', id: q.id }, slot = coveredBy(q.id, ref);
        if (!q.mergedInto && q.status !== 'completed')
            own.push({ key: 'home-visit:' + q.id, kind: 'home-visit', title: 'Routine home visit', due: q.due ?? null, attention: 'now', daysOverdue: 0, status: 'Due', owner: null, programmes: [], waitingOn: [], refs: [ref], covered: slot ? { visitId: slot.id, date: slot.date } : null });
        return [{ personId: q.id, name: q.name, age: q.age, relationship: x.relationship, merged: !!q.mergedInto, canCover: normallyAllowed(m, q) && !q.mergedInto, items: own }];
    });
    const lead = supervises(s, m, h.teamId, now, false), care = ['asha', 'clinician'].includes(m.role) && m.teamIds.includes(h.teamId);
    // A slot is shown to a viewer who can see at least one covered person (a former member too), and only for the people they can see.
    const seeable = (personId) => { const q = s.workspace.people.find(p => p.id === personId); return q && allowed(m, q, now) ? q : undefined; };
    const visits = slots.filter(x => x.covers.some(cv => seeable(cv.personId))).slice(-30).reverse().map(x => {
        const shown = x.covers.flatMap(cv => { const q = seeable(cv.personId); return q ? [{ cv, q }] : []; }).map(({ cv, q }) => {
            const items = cv.items.map(ref => { const r = resolveItem(s, q, ref); const completion = x.completions?.filter(e => e.personId === q.id && e.kind === ref.kind && e.itemId === ref.id).at(-1); return { kind: ref.kind, id: ref.id, title: r.title, open: r.open, canLink: ref.kind === 'home-visit' || (ref.kind === 'follow-up' ? !!q.followUps?.find(f => f.id === ref.id && (f.completionContract || f.state === 'completed')) : s.workspace.referrals.some(r => r.id === ref.id && r.personId === q.id && r.state === 'completed')), completion: completion ? { ...completion, current: slotCompletionCurrent(s, completion) } : null, due: r.due, lateByDays: iso(r.due) && x.date > r.due ? Math.round((Date.parse(x.date) - Date.parse(r.due)) / day) : 0 }; });
            return { personId: q.id, version: q.version, name: q.name, canRecord: careIn(m, h) && normallyAllowed(m, q) && current(h).some(y => y.personId === q.id) && x.state === 'planned', left: !current(h).some(y => y.personId === q.id), items, stillOpen: items.filter(i => i.open).length };
        });
        return { id: x.id, createdAt: x.createdAt, date: x.date, window: x.window, state: x.state, when: x.date < today ? 'past' : x.date === today ? 'today' : 'upcoming', worker: names.get(x.workerId) ?? 'Former member', covers: shown, outsideScopeCovered: x.covers.length - shown.length,
            outreachPlanIds: x.outreachPlanIds ?? [], canPrepareOutreach: x.state === 'planned' && care && x.covers.every(cv => { const q = seeable(cv.personId); return q && normallyAllowed(m, q) && current(h).some(y => y.personId === q.id); }), replacesVisitId: x.replacesVisitId ?? null, replacedByVisitId: x.replacedByVisitId ?? null,
            canReschedule: x.state === 'planned' && x.createdBy === m.userId && care && x.covers.every(cv => { const q = s.workspace.people.find(p => p.id === cv.personId); return q && q.assigned && normallyAllowed(m, q) && !q.mergedInto && current(h).some(y => y.personId === q.id) && cv.items.every(i => { const r = resolveItem(s, q, i); return r.found && r.open; }); }),
            cancelReason: x.cancelReason ?? null, canCancel: x.state === 'planned' && ((x.createdBy === m.userId && care) || lead) };
    });
    return {
        householdVersion: h.version, canSchedule: care, minDate: today, maxDate: addDays(today, MAX_AHEAD_DAYS), members, outsideScope, visits,
        rules: 'A household visit slot covers the open items you choose, member by member. It does not change any due date, owner or completion condition, and an item stays open until its own record is resolved. Each member keeps their own observations, visit and permissions; a slot holds only references, a date and a window, and no free text. Items due before the slot date are shown as late, never as on time. Members outside your care scope are counted, not named. Nothing is sent to anyone. These are local defaults, not an approved timing or privacy policy.',
    };
}
export function slotCompletionCurrent(s, e) { const v = s.workspace.visits.find(v => v.id === e.visitId && v.personId === e.personId); return !!v && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported; }
