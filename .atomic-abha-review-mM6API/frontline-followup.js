import { z } from 'zod';
import { VISIT_WINDOWS } from './household-visit-constants.js';
const id = z.string().min(1).max(100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const item = z.object({ kind: id, id, title: z.string(), due: z.string().nullable(), open: z.boolean(), lateByDays: z.number().int().nonnegative() });
const line = z.object({ refs: z.array(z.object({ kind: id, id })), owner: z.string().nullable(),
    attention: z.string(), daysOverdue: z.number().int().nonnegative() });
const cover = z.object({ personId: id, version: z.number().int().positive(), items: z.array(item) });
const slot = z.object({ id, date, window: z.enum(VISIT_WINDOWS), state: z.enum(['planned', 'cancelled']),
    canReschedule: z.boolean(), covers: z.array(cover).min(1), outsideScopeCovered: z.number().int().nonnegative(), replacesVisitId: id.nullable() });
const response = z.object({ household: z.object({ id, version: z.number().int().positive() }).nullable(),
    visitPlan: z.object({ householdVersion: z.number().int().positive(), minDate: date, maxDate: date,
        members: z.array(z.object({ personId: id, items: z.array(line) })), visits: z.array(slot) }).optional() });
export function frontlineRecord(value, personId) {
    const record = z.object({ record: z.object({ id, name: z.string() }) }).parse(value).record;
    if (record.id !== personId)
        throw Error('refused');
    return record;
}
export function rescheduleAccepted(value, previousId) {
    const parsed = z.object({ result: z.object({ visitId: id, replacesVisitId: id }) }).parse(value);
    if (parsed.result.replacesVisitId !== previousId)
        throw Error('Result not confirmed');
    return parsed.result;
}
export function followupSelector(query) {
    if ([...query.keys()].some(key => !['personId', 'organisationId'].includes(key)) ||
        query.getAll('personId').length !== 1 || query.getAll('organisationId').length !== 1)
        return null;
    const personId = id.safeParse(query.get('personId')), organisationId = id.safeParse(query.get('organisationId'));
    return personId.success && organisationId.success ? { personId: personId.data, organisationId: organisationId.data } : null;
}
// This is a display projection, not authority. Each read and command remains server scoped.
export function frontlinePlan(value, personId) {
    const parsed = response.parse(value);
    if (!parsed.household) {
        if (parsed.visitPlan)
            throw Error('Household plan is inconsistent.');
        return { kind: 'no-household' };
    }
    const plan = parsed.visitPlan;
    if (!plan || plan.householdVersion !== parsed.household.version ||
        plan.members.filter(member => member.personId === personId).length !== 1 ||
        new Set(plan.visits.map(visit => visit.id)).size !== plan.visits.length)
        throw Error('Current plan is unavailable.');
    const slots = plan.visits.flatMap(visit => {
        const selected = visit.covers.filter(member => member.personId === personId);
        if (selected.length > 1 || new Set(visit.covers.map(member => member.personId)).size !== visit.covers.length)
            throw Error('Plan members are inconsistent.');
        if (visit.state !== 'planned' || !selected.length)
            return [];
        const currentItems = plan.members.find(member => member.personId === personId).items;
        return [{ id: visit.id, date: visit.date, window: visit.window, canReschedule: visit.canReschedule,
                items: selected[0].items.map(item => {
                    const current = currentItems.find(line => line.refs.some(ref => ref.kind === item.kind && ref.id === item.id));
                    return { ...item, owner: current?.owner ?? null, daysOverdue: current?.attention === 'overdue' ? current.daysOverdue : 0 };
                }), personVersions: visit.covers.map(member => ({ personId: member.personId, version: member.version })),
                hasOutsideScope: visit.outsideScopeCovered > 0, replacesVisitId: visit.replacesVisitId }];
    });
    return { kind: 'plans', householdId: parsed.household.id, householdVersion: plan.householdVersion,
        minDate: plan.minDate, maxDate: plan.maxDate, slots };
}
export function frontlineReschedule(plan, slotId, proposedDate, proposedWindow) {
    if (plan.kind !== 'plans')
        throw Error('Refresh the existing plan.');
    const selected = plan.slots.find(slot => slot.id === slotId), parsedDate = date.parse(proposedDate), window = z.enum(VISIT_WINDOWS).parse(proposedWindow);
    if (!selected?.canReschedule || parsedDate < plan.minDate || parsedDate > plan.maxDate ||
        (parsedDate === selected.date && window === selected.window))
        throw Error('Choose a permitted different visit time.');
    return { type: 'householdVisitReschedule', householdId: plan.householdId, version: plan.householdVersion,
        visitId: selected.id, date: parsedDate, window, personVersions: selected.personVersions.map(member => ({ ...member })) };
}
