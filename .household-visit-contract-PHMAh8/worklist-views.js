import { TERMINAL } from './referral-rules.js';
// Slice 0b-4: the browser-built work views (My work statistics, visit list and follow-ups, Submissions and the
// referral tracker) are defined once here. The unpaged workspace applies them to the records it holds; the
// server applies the same functions to the viewer's whole scope for a paged workspace (lib/saha/worklists.ts),
// so counts and ordering are the same for the same viewer on the same data. No database or browser code here.
export const ATTENTION_STATES = ['uncertain', 'sending', 'queued', 'retryable'];
export const needsAttention = (s) => ATTENTION_STATES.includes(s.state);
const byIdAsc = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// Not yet confirmed first, then due today, then name (fixed 'en' collation, so the browser and the Worker agree);
// the record id breaks ties so the order never depends on load order.
export function visitCompare(a, b) {
    return Number(a.status === 'completed') - Number(b.status === 'completed') || Number(b.due === 'Today') - Number(a.due === 'Today') || a.name.localeCompare(b.name, 'en') || byIdAsc(a.id, b.id);
}
export const visitList = (people) => people.slice().sort(visitCompare);
export function workStats(people, visits, submissions) {
    return {
        toDo: people.filter(p => p.status === 'due' && p.due === 'Today').length,
        inProgress: people.filter(p => p.status === 'in_progress').length,
        confirmed: visits.filter(v => v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported).length,
        attention: submissions.filter(needsAttention).length,
    };
}
export function followUpGroups(people) {
    const rows = people.flatMap(p => (p.followUps ?? []).filter(t => t.state === 'open' && t.transitionStatus !== 'superseded').map(t => ({ p, t })))
        .sort((a, b) => a.t.due.localeCompare(b.t.due) || byIdAsc(a.p.id, b.p.id));
    const groups = new Map();
    for (const { p, t } of rows) {
        const g = groups.get(p.id);
        if (g)
            g.tasks.push(t);
        else
            groups.set(p.id, { person: p, tasks: [t] });
    }
    return { tasks: rows.length, groups: [...groups.values()] };
}
// Most recent first: creation time, then record id, both descending. Before slice 0b-4 the list was the reverse
// of the snapshot's record id order; ids are random, so that order was not by time.
export function submissionList(submissions, attentionOnly = false) {
    const all = submissions.slice().sort((a, b) => byIdAsc(b.createdAt ?? '', a.createdAt ?? '') || byIdAsc(b.id, a.id));
    return { all: all.length, attention: all.filter(needsAttention).length, rows: attentionOnly ? all.filter(needsAttention) : all };
}
// Open referrals first, then by due date (none last); the record id breaks ties.
export function referralList(referrals) {
    return referrals.slice().sort((a, b) => Number(TERMINAL.has(a.state)) - Number(TERMINAL.has(b.state)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || byIdAsc(a.id, b.id));
}
