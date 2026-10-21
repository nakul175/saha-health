import { fail } from './core.js';
import { allowed } from './access.js';
import { supervises } from './delegation.js';
// Slice 4c: worker activity evidence for supervisors (BR-CARE-08). A read-only summary per worker,
// derived from records Saha already keeps; nothing new is tracked, and no location is used.
//  - performed: a visit the worker confirmed (their positive patient check), still current;
//  - claimed: an outreach item the worker recorded as completed;
//  - verified: a claim whose linked visit is a current confirmed visit of the same patient
//    (evidence-matched by the system, not a supervisor audit);
//  - submitted: a performed visit a programme destination accepted, with its receipt.
// Corrections and wrong-patient marks remove a visit from the counts but stay listed with who changed
// it, when and why, so the original evidence and review history remain traceable.
export const NOTICE = 'Activity evidence for supervision and programme review. It is not a payment claim, incentive calculation or performance rating.';
export const WINDOWS = [7, 30, 90];
export const MAX_ITEMS = 100;
const day = (s) => (s ?? '').slice(0, 10);
// Teams whose worker activity the viewer may review: teams they supervise in their own right or by delegation.
export function reviewTeams(s, m, now = new Date().toISOString()) { return s.teams.map(t => t.id).filter(t => supervises(s, m, t, now, false)); }
function submission(s, v) {
    const subs = s.workspace.submissions.filter(x => x.visitId === v.id);
    if (!subs.length)
        return { submission: 'none' };
    const accepted = subs.find(x => x.state === 'accepted');
    if (accepted)
        return { submission: 'accepted', ...(accepted.receipt ? { receipt: accepted.receipt } : {}) };
    if (subs.some(x => ['queued', 'sending', 'uncertain', 'retryable'].includes(x.state)))
        return { submission: 'pending' };
    return { submission: subs.some(x => x.state === 'rejected') ? 'rejected' : 'cancelled' };
}
export function workerActivity(s, m, days, corrections = [], now = new Date()) {
    if (!WINDOWS.includes(days))
        fail(422, 'Choose 7, 30 or 90 days.');
    if (m.status !== 'active' || m.role === 'admin')
        fail(403, 'Worker activity contains patient information; an administrator role cannot view it.');
    const iso = now.toISOString(), teams = reviewTeams(s, m, iso);
    if (!teams.length)
        fail(403, 'A team supervisor, an owner with a care role or a supervision delegate reviews worker activity.');
    const since = new Date(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') - (days - 1) * 86400000).toISOString(), inRange = (at) => !!at && at >= since && at <= iso;
    const people = new Map(s.workspace.people.filter(p => teams.includes(p.teamId) && allowed(m, p, iso)).map(p => [p.id, p]));
    const visits = new Map(s.workspace.visits.map(v => [v.id, v])), fix = new Map();
    for (const c of corrections)
        if (!fix.has(c.visitId))
            fix.set(c.visitId, c);
    const byWorker = new Map(), add = (worker, item) => { const list = byWorker.get(worker) ?? []; list.push(item); byWorker.set(worker, list); };
    for (const v of s.workspace.visits) {
        const p = people.get(v.personId), by = v.patientCheck?.by, at = v.confirmedAt;
        if (!p || !by || v.state !== 'confirmed' || !inRange(at))
            continue;
        const c = fix.get(v.id), changed = c ? ` by ${c.actorName} on ${day(c.at)}: ${c.reason}` : '';
        if (v.voidedAt)
            add(by, { kind: 'visit', ref: v.id, personId: p.id, personName: p.name, at: at, status: 'wrong-patient', ...submission(s, v), trace: `Confirmed ${day(at)}; marked as recorded against the wrong patient${changed || ` on ${day(v.voidedAt)}: ${v.voidReason ?? ''}`}. Not counted; the original record is kept.` });
        else if (v.supersededBy) {
            const next = visits.get(v.supersededBy);
            add(by, { kind: 'visit', ref: v.id, personId: p.id, personName: p.name, at: at, status: 'corrected', ...submission(s, v), trace: `Confirmed ${day(at)}; corrected${changed}. The correction ${next?.state === 'confirmed' ? `was confirmed on ${day(next.confirmedAt)} and counts in its place` : 'is still a draft'}; the original record is kept.` });
        }
        else
            add(by, { kind: 'visit', ref: v.id, personId: p.id, personName: p.name, at: at, status: 'performed', ...submission(s, v), trace: `Confirmed ${day(at)} after the worker's patient check${v.amendsVisitId ? '; corrects an earlier visit' : ''}.` });
    }
    for (const plan of s.outreach?.plans ?? [])
        for (const i of plan.items) {
            const p = people.get(i.personId);
            if (!p)
                continue;
            for (const e of i.events) {
                if (e.state !== 'completed' || !inRange(e.at))
                    continue;
                const v = e.visitId ? visits.get(e.visitId) : undefined, current = !!v && v.personId === i.personId && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy;
                add(e.by, { kind: 'outreach', ref: i.id, personId: p.id, personName: p.name, at: e.at, status: current ? 'verified' : 'unverified', trace: `Outreach "${plan.title}" recorded as completed ${day(e.at)} (reference ${e.reference}). ${current ? `Matched to the confirmed visit of ${day(v.confirmedAt)}.` : v ? 'The linked visit was corrected or marked wrong-patient; the claim is no longer backed by a current visit.' : 'No linked visit; not verified.'}` });
            }
        }
    const name = (id) => s.members.find(x => x.userId === id);
    const workers = [...byWorker.entries()].map(([userId, items]) => {
        const w = name(userId), n = (f) => items.filter(f).length, performed = items.filter(i => i.kind === 'visit' && i.status === 'performed');
        return { userId, displayName: w?.displayName ?? 'Former member', role: w?.role ?? 'unknown', status: w?.status ?? 'removed',
            counts: { performed: performed.length, claimed: n(i => i.kind === 'outreach'), verified: n(i => i.status === 'verified'), unverified: n(i => i.status === 'unverified'), submitted: performed.filter(i => i.submission === 'accepted').length, submissionPending: performed.filter(i => i.submission === 'pending').length, notSubmitted: performed.filter(i => i.submission === 'none' || i.submission === 'rejected' || i.submission === 'cancelled').length, corrected: n(i => i.status === 'corrected'), wrongPatient: n(i => i.status === 'wrong-patient') },
            items: items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS), omitted: Math.max(0, items.length - MAX_ITEMS) };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { notice: NOTICE, days, since, until: iso, teams: teams.map(t => ({ id: t, name: s.teams.find(x => x.id === t)?.name ?? t })), workers, definitions: { performed: 'Visits the worker confirmed after checking the patient, still current.', claimed: 'Outreach items the worker recorded as completed.', verified: 'Claims matched to a current confirmed visit of the same patient. Evidence-matched by Saha, not audited by a supervisor.', submitted: 'Performed visits a programme destination accepted, with its receipt.' }, scope: 'Patients currently in the teams you supervise; activity attributed to the worker who confirmed or recorded it. No location data is used.' };
}
