import { digest, fail } from './core.js';
import { openPatientWork } from './continuity.js';
import { followUpOpen } from './programmes.js';
import { referenceValue, ageBandOf, groupLabels, GROUPS, reuseOf, WINDOWED } from './indicators.js';
export async function captureFigureMaterial(s, h, capturedAt) {
    if (!Number.isFinite(Date.parse(capturedAt)))
        fail(422, 'Choose a valid figure cutoff.');
    const active = new Set(s.members.filter(m => m.status === 'active').map(m => m.userId)), memberContext = await digest(s.members.map(m => ({ id: m.userId, version: m.version, status: m.status })));
    const units = await Promise.all(s.workspace.people.filter(p => p.assigned && !p.mergedInto).map(async (p) => {
        const visits = s.workspace.visits.filter(v => v.personId === p.id), referrals = s.workspace.referrals.filter(r => r.personId === p.id), submissions = s.workspace.submissions.filter(x => x.personId === p.id), followups = (p.followUps ?? []).filter(f => followUpOpen(s, f));
        const f = { team: [await h('team:' + p.teamId)], village: [await h('village:' + p.village)], programme: await Promise.all(p.programmes.map(x => h('programme:' + x))), defProgramme: await Promise.all(p.programmes.map(x => h('defProgramme:' + x))), sex: [await h('sex:' + p.sex)], ageBand: [await h('ageBand:' + ageBandOf(p.age))] };
        const g = {};
        for (const d of GROUPS)
            g[d] = await Promise.all(groupLabels(s, p, d).map(x => h('group:' + x)));
        const live = visits.filter(v => v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported).sort((a, b) => (a.confirmedAt ?? a.createdAt).localeCompare(b.confirmedAt ?? b.createdAt));
        return { personId: p.id, personVersion: p.version, sourceHashVersion: 3, sourceHash: await digest({ countingSemantics: 3, p, visits, referrals, submissions, outreach: { plans: (s.outreach?.plans ?? []).filter(x => x.items.some(i => i.personId === p.id)).map(x => ({ ...x, items: x.items.filter(i => i.personId === p.id) })), messages: (s.outreach?.messages ?? []).filter(x => x.personId === p.id) }, memberContext, f, g }), sourceVersions: { submissions: submissions.map(x => ({ id: x.id, state: x.state, updatedAt: x.updatedAt, payloadHash: x.payloadHash })), visits: visits.map(v => ({ id: v.id, version: v.version, recordVersion: v.recordVersion })) }, f, g, x: [...(p.identityReview?.state === 'provisional' ? ['identity-provisional'] : []), ...(!p.programmes.length ? ['no-programme'] : [])],
            visits: await Promise.all(live.map(async (v) => { const r = reuseOf(v); return { at: v.confirmedAt ?? v.createdAt, signature: await h('repeat:' + p.id + ':' + [String(v.facts.date ?? '').slice(0, 10), v.facts.weight, v.facts.systolic, v.facts.diastolic, v.facts.temperature].join('|')), reuse: [r.opportunities, r.reused, r.blocked, r.blockedBy.Unknown, r.blockedBy['Not measured'], r.blockedBy.Declined, r.blockedBy['Unable to obtain']] }; })),
            corrections: visits.filter(v => v.amendsVisitId || v.voidedAt).map(v => ({ amendedAt: v.amendsVisitId ? v.createdAt : null, voidedAt: v.voidedAt ?? null })), referrals: referrals.map(r => ({ at: r.createdAt, completed: r.state === 'completed' })), followupDue: followups.map(f => f.due), maternal: (p.enrolments ?? []).filter(e => e.packId === 'maternal' && e.state === 'active').length, unowned: openPatientWork(s, p).filter(w => !w.ownerId || !active.has(w.ownerId)).length, unresolved: submissions.filter(x => ['queued', 'sending', 'retryable', 'uncertain'].includes(x.state)).length, provisional: p.identityReview?.state === 'provisional' ? 1 : 0 };
    }));
    return { version: 1, capturedAt, units };
}
export function figureMeasure(u, id, since, until) {
    const inWindow = (t) => !!t && t >= since && t <= until, visits = u.visits.filter(v => inWindow(v.at));
    switch (id) {
        case 'patients': return 1;
        case 'patients-seen': return visits.length ? 1 : 0;
        case 'visits-confirmed': return visits.length;
        case 'followups-open': return u.followupDue.length;
        case 'followups-overdue': return u.followupDue.filter(d => d < until.slice(0, 10)).length;
        case 'referrals-created': return u.referrals.filter(r => inWindow(r.at)).length;
        case 'referrals-completed': return u.referrals.filter(r => inWindow(r.at) && r.completed).length;
        case 'maternal-episodes-active': return u.maternal;
        case 'open-work-unowned': return u.unowned;
        case 'submissions-unresolved': return u.unresolved;
        case 'reuse-opportunities': return visits.reduce((n, v) => n + v.reuse[0], 0);
        case 'reuse-served': return visits.reduce((n, v) => n + v.reuse[1], 0);
        case 'reuse-blocked': return visits.reduce((n, v) => n + v.reuse[2], 0);
        case 'reuse-blocked-unknown': return visits.reduce((n, v) => n + v.reuse[3], 0);
        case 'reuse-blocked-not-measured': return visits.reduce((n, v) => n + v.reuse[4], 0);
        case 'reuse-blocked-declined': return visits.reduce((n, v) => n + v.reuse[5], 0);
        case 'reuse-blocked-unable': return visits.reduce((n, v) => n + v.reuse[6], 0);
        case 'repeat-entries': {
            let n = 0;
            const seen = new Set();
            for (const v of u.visits) {
                if (seen.has(v.signature) && inWindow(v.at))
                    n++;
                seen.add(v.signature);
            }
            return n;
        }
        case 'corrections': return u.corrections.filter(v => inWindow(v.amendedAt) || inWindow(v.voidedAt)).length;
        case 'identity-provisional': return u.provisional;
        default: fail(422, 'The stored figure measure needs review.');
    }
}
export function figurePopulation(material) {
    if (material.version !== 1 || !Number.isFinite(Date.parse(material.capturedAt)))
        fail(409, 'The stored figure material version needs review.');
    return { windowed: WINDOWED, units: material.units.map(u => ({ f: u.f, g: u.g, x: u.x, q: (id, window) => { const [since, until] = window.split('|'); return referenceValue(id, leaf => figureMeasure(u, leaf, since, until || material.capturedAt)); } })) };
}
