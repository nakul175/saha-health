import { uuid } from './core.js';
import { reportEvent, reportsOf } from './aggregate-delivery.js';
import { timedOut } from './task-limits.js';
// Slice 10a: requests past their time limit are marked as needing review by the scheduled job (BR-OPS-04, NFR-18).
//
// Today a provider request or a destination request that never got its answer is noticed only when someone opens the
// page that shows it. The scheduled job (lib/saha/scheduled-job.ts) finds them without anyone looking and marks each
// one once, with an audit event that names the scheduled job as the actor. Marking never contacts a provider or a
// destination, never retries and never resends: the outcome of such a request is unknown, and an unknown outcome is
// resolved only by a person (a receipt lookup, or the recorded decision of slice 5e), never by a blind retry.
//   assistant request   a request sent to a provider whose recorded task time limit (slice 5e) has passed with no
//                       confirmed result. It keeps its status so the requester or a clinician can still record the
//                       decision (closeTimedOutAgent); it gains `timeoutReview`.
//   destination request a programme delivery in `sending`, an EHR publication in `running` or an aggregate report in
//                       `sending` for longer than IN_FLIGHT_MINUTES (the request itself stops waiting after 15 seconds;
//                       the exception queue already calls an EHR publication stale after the same ten minutes). It
//                       becomes `uncertain`, the state in which the only available step is a receipt lookup.
export const IN_FLIGHT_MINUTES = 10;
export const REVIEW_ACTION = 'scheduledTimeoutReview';
export const JOB_ACTOR = { userId: 'system', displayName: 'Saha scheduled job', email: '' };
const minutesAfter = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();
// Read-only: the requests that are past their limit and not yet marked, oldest overdue first.
export function timedOutRequests(s, now, minutes = IN_FLIGHT_MINUTES) {
    const out = [], cutoff = Date.parse(now) - minutes * 60000;
    for (const v of s.workspace.visits)
        for (const r of v.agentRuns ?? [])
            if (timedOut(r, now) && !r.timeoutReview && !r.timeoutDecision)
                out.push({ kind: 'assistant-request', id: r.id, overdueAt: minutesAfter(r.startedAt ?? r.createdAt, r.limits?.timeMinutes ?? 0), personId: v.personId, visitId: v.id });
    for (const x of s.workspace.submissions) {
        const since = x.delivery?.startedAt ?? x.updatedAt;
        if (x.state === 'sending' && x.delivery && Date.parse(since) < cutoff)
            out.push({ kind: 'programme-delivery', id: x.id, overdueAt: minutesAfter(since, minutes), personId: x.personId, visitId: x.visitId });
    }
    for (const p of s.workspace.people)
        for (const o of p.ehr?.operations ?? [])
            if (o.state === 'running' && Date.parse(o.at) < cutoff)
                out.push({ kind: 'ehr-publication', id: o.id, overdueAt: minutesAfter(o.at, minutes), personId: p.id, visitId: o.visitId });
    for (const r of reportsOf(s)) {
        const since = r.startedAt ?? r.updatedAt;
        if (r.state === 'sending' && Date.parse(since) < cutoff)
            out.push({ kind: 'aggregate-report', id: r.id, overdueAt: minutesAfter(since, minutes), personId: null, visitId: null });
    }
    return out.sort((a, b) => a.overdueAt.localeCompare(b.overdueAt) || a.id.localeCompare(b.id));
}
// Marks the given requests on the state (the caller persists it). A request that is no longer past its limit, or was
// already marked or closed since the list was made, is left alone. Returns what was marked.
export function markTimedOut(s, items, now, minutes = IN_FLIGHT_MINUTES) {
    const marked = [], current = new Map(timedOutRequests(s, now, minutes).map(x => [`${x.kind}:${x.id}`, x]));
    const audit = (item, detail) => s.workspace.audit.push({ id: uuid(), at: now, actorId: JOB_ACTOR.userId, actor: JOB_ACTOR.displayName, role: 'system', action: REVIEW_ACTION, subject: item.kind === 'assistant-request' ? item.visitId : item.id, ...(item.personId ? { personId: item.personId } : {}), detail });
    for (const item of items) {
        if (!current.has(`${item.kind}:${item.id}`))
            continue;
        if (item.kind === 'assistant-request') {
            const r = s.workspace.visits.flatMap(v => v.agentRuns ?? []).find(x => x.id === item.id);
            r.timeoutReview = { at: now, by: JOB_ACTOR.userId, byName: JOB_ACTOR.displayName };
            audit(item, `Assistant request to ${r.provider.name} passed its ${r.limits?.timeMinutes}-minute time limit without a confirmed result and needs review. Its outcome is uncertain. It was not resent or retried; the requester or a clinician records the decision.`);
        }
        else if (item.kind === 'programme-delivery') {
            const x = s.workspace.submissions.find(y => y.id === item.id), text = `No confirmed result ${minutes} minutes after the request started; flagged for review by the scheduled job. The outcome is unknown. Look up the receipt before anything else; it is never sent again blindly.`;
            x.state = 'uncertain';
            x.updatedAt = now;
            x.message = text;
            if (x.delivery.events.length < 50)
                x.delivery.events.push({ at: now, state: 'uncertain', detail: text });
            audit(item, `Programme delivery to ${x.connectorName} had no confirmed result after ${minutes} minutes and needs review. Nothing was resent.`);
        }
        else if (item.kind === 'ehr-publication') {
            const o = s.workspace.people.flatMap(p => p.ehr?.operations ?? []).find(y => y.id === item.id);
            o.state = 'uncertain';
            o.message = `No confirmed result ${minutes} minutes after the publication started; flagged for review by the scheduled job. Look up the document identifier with the EHR; do not publish again.`;
            audit(item, `EHR publication had no confirmed result after ${minutes} minutes and needs review. Nothing was resent.`);
        }
        else {
            const r = reportsOf(s).find(y => y.id === item.id);
            r.state = 'uncertain';
            reportEvent(r, now, `No confirmed result ${minutes} minutes after the request started; flagged for review by the scheduled job. Look up this report before anything else; it is never sent again.`);
            audit(item, `Aggregate report to ${r.destinationName} had no confirmed result after ${minutes} minutes and needs review. Nothing was resent.`);
        }
        marked.push(item);
    }
    return marked;
}
