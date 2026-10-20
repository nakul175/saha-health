// Slice 4a: referral lifecycle and escalation rules. Pure data and functions, shared by server and client.
export const REFERRAL_STATES = ['draft', 'sent', 'received', 'scheduled', 'attended', 'completed', 'declined', 'not-attended', 'cancelled', 'unknown'];
export const REFERRAL_EVENTS = REFERRAL_STATES.filter(s => s !== 'draft');
export const TERMINAL = new Set(['completed', 'declined', 'cancelled']);
// Which recorded event may follow the current state. Completion straight after acceptance stays allowed.
export const NEXT = {
    draft: ['sent', 'cancelled'],
    sent: ['received', 'declined', 'unknown', 'cancelled'],
    received: ['scheduled', 'attended', 'completed', 'declined', 'unknown', 'cancelled'],
    scheduled: ['attended', 'not-attended', 'unknown', 'cancelled'],
    attended: ['completed', 'unknown'],
    'not-attended': ['scheduled', 'unknown', 'cancelled'],
    unknown: ['received', 'scheduled', 'attended', 'completed', 'declined', 'not-attended', 'cancelled'],
    completed: [], declined: [], cancelled: [],
};
export const STATE_LABEL = { draft: 'Draft', sent: 'Sent', received: 'Accepted by facility', scheduled: 'Appointment scheduled', attended: 'Attended', completed: 'Completed', declined: 'Declined',
    'not-attended': 'Did not attend', cancelled: 'Cancelled', unknown: 'Outcome unknown' };
export const URGENCIES = ['routine', 'urgent', 'emergency'];
// Days past the due date before an open referral is escalated, by urgency.
export const ESCALATE_AFTER = { emergency: 0, urgent: 1, routine: 7 };
export const STALE_UNCERTAIN_DAYS = 2;
export const CONSTRAINTS = ['patient-unavailable', 'facility-capacity', 'transport', 'awaiting-results', 'other'];
const day = 86400000;
export function escalation(r, activeOwner, now = new Date().toISOString()) {
    if (TERMINAL.has(r.state))
        return { level: 'none', reasons: [], daysOverdue: 0 };
    const reasons = [], watch = [], urgency = r.urgency ?? 'routine', today = now.slice(0, 10);
    const daysOverdue = r.due ? Math.max(0, Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(r.due + 'T00:00:00Z')) / day)) : 0;
    if (!r.ownerId)
        reasons.push('No named owner');
    else if (!activeOwner)
        reasons.push('Owner no longer has active care access');
    if (!r.due)
        watch.push('No due date');
    else if (r.due < today && daysOverdue > ESCALATE_AFTER[urgency])
        reasons.push(`${urgency} referral overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`);
    else if (r.due < today)
        watch.push(`Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`);
    if (['unknown', 'not-attended'].includes(r.state)) {
        const since = r.events?.at(-1)?.occurredAt ?? r.createdAt, days = Math.floor((Date.parse(now) - Date.parse(since)) / day);
        if (days >= STALE_UNCERTAIN_DAYS)
            reasons.push(`${r.state === 'unknown' ? 'Outcome unknown' : 'Missed appointment'} for ${days} days`);
        else
            watch.push(r.state === 'unknown' ? 'Outcome unknown' : 'Missed appointment');
    }
    if (urgency === 'emergency' && ['draft', 'sent'].includes(r.state))
        reasons.push('Emergency referral not yet accepted');
    return reasons.length ? { level: 'escalated', reasons: [...reasons, ...watch], daysOverdue } : watch.length ? { level: 'watch', reasons: watch, daysOverdue } : { level: 'none', reasons: [], daysOverdue };
}
