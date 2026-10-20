import { z } from 'zod';
import { digest, fail, uuid } from './core.js';
import { normallyAllowed, allowedFor, purposePermits } from './access.js';
import { installationsOf } from './pack-installation.js';
import { occurrencesOf, visitSource } from './installed-pack-work.js';
import { followUpOpen } from './programmes.js';
import { transitionDeclaration, transitionVerified, transitionOriginalCohort, transitionReplacementVerified } from './installed-transition-authority.js';
const id = z.string().min(1).max(100), hash = z.string().regex(/^[a-f0-9]{64}$/), reason = z.string().trim().min(10).max(500);
export const transitionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('stage'), fromId: id, fromHash: hash, toId: id, toHash: hash, teamId: id, effectiveAt: z.string().datetime(), schedule: z.enum(['keep', 'replace-open-declared']), mapping: z.array(z.object({ from: id, to: id }).strict()).max(25), reason }).strict(),
    z.object({ type: z.literal('review'), transitionId: id, version: z.number().int().positive(), hash, planHash: hash, decision: z.enum(['approve', 'reject']), reason }).strict(),
    z.object({ type: z.literal('apply'), transitionId: id, version: z.number().int().positive(), hash, planHash: hash, reason }).strict()
]);
export const transitionsOf = (s) => s.operations?.installedTransitions ?? [];
const team = (m, t) => m.status === 'active' && ['asha', 'clinician', 'supervisor'].includes(m.role) && m.teamIds.includes(t);
function pair(s, t, active = true) { const a = installationsOf(s).find(i => i.id === t.fromId && i.manifestHash === t.fromHash), b = installationsOf(s).find(i => i.id === t.toId && i.manifestHash === t.toHash); if (!a || !b || active && (a.state !== 'active' || b.state !== 'active') || a.packId !== b.packId || a.version === b.version)
    fail(409, 'Choose exact active versions of one installed pack.'); return { a, b }; }
function authority(s, t) { const a = s.members.find(m => m.userId === t.proposer), b = s.members.find(m => m.userId === t.reviewer); if (!a?.isOwner || a.version !== t.proposerVersion || !team(a, t.teamId) || !b || b.role !== 'clinician' || b.version !== t.reviewerVersion || b.userId === a.userId || !team(b, t.teamId))
    fail(409, 'Original independent transition authority changed.'); return { a, b }; }
export function transitionCareGate(s, m, t) { if (!team(m, t) || !purposePermits(m, 'care-coordination', s.operations?.purposeGrants))
    fail(403, 'Current team care purpose is required.'); for (const p of s.workspace.people.filter(p => p.teamId === t))
    transitionPatientGate(s, m, p); }
export function transitionPatientGate(s, m, p) { if (!normallyAllowed(m, p) || !allowedFor(m, p, s.operations?.purposeGrants, 'care-coordination'))
    fail(403, 'Current normal care scope and purpose are required for the entire selected team cohort.'); }
export async function transitionPlan(s, m, t) {
    if (!transitionVerified(s, t))
        fail(409, 'Protected transition provenance is unavailable.');
    if (!team(m, t.teamId) || (!m.isOwner && m.role !== 'clinician'))
        fail(403, 'Current team governance authority is required.');
    transitionCareGate(s, m, t.teamId);
    for (const id of transitionOriginalCohort(s, t)) {
        const p = s.workspace.people.find(p => p.id === id);
        if (!p)
            fail(403, 'Original transition cohort is unavailable.');
        transitionPatientGate(s, m, p);
    }
    const { a, b } = pair(s, t, false);
    let authorityCurrent = false;
    try {
        const auth = authority(s, t);
        transitionCareGate(s, auth.a, t.teamId);
        transitionCareGate(s, auth.b, t.teamId);
        authorityCurrent = a.state === 'active' && b.state === 'active';
    }
    catch { /* Retained history remains visible to current authorized care; apply still requires original fresh authority. */ }
    const cohort = s.workspace.people.filter(p => p.teamId === t.teamId && (p.enrolments ?? []).some(e => e.state === 'active' && e.packId === a.packId && e.packVersion === a.version));
    if (cohort.length > 100)
        fail(422, 'Transition cohort exceeds the100-record atomic bound; retain work and review a bounded team plan.');
    const people = [];
    for (const p of cohort) {
        transitionPatientGate(s, m, p);
        const episodes = p.enrolments.filter(e => e.state === 'active' && e.packId === a.packId && e.packVersion === a.version), episodeIds = new Set(episodes.map(e => e.id)), visits = s.workspace.visits.filter(v => v.personId === p.id && v.programmeCapture?.packs.some(c => episodeIds.has(c.enrolmentId))), work = occurrencesOf(p).filter(x => episodeIds.has(x.episodeId)), tasks = (p.followUps ?? []).filter(x => episodeIds.has(x.enrolmentId)), submissions = s.workspace.submissions.filter(x => x.personId === p.id), referrals = s.workspace.referrals.filter(x => x.personId === p.id);
        const blockers = [...(p.mergedInto ? ['merged record'] : []), ...(p.restrictions?.some(r => !r.liftedAt) ? ['processing restriction'] : []), ...(visits.some(v => v.state === 'draft' && !v.voidedAt && !v.supersededBy) ? ['open captured visit or field grant'] : []), ...(submissions.some(x => ['sending', 'uncertain'].includes(x.state)) ? ['uncertain destination operation'] : [])];
        if (t.schedule === 'replace-open-declared')
            for (const task of tasks.filter(x => followUpOpen(s, x))) {
                const source = work.find(x => x.kind === 'follow-up' && x.id === (task.transitionOrigin?.sourceOccurrenceId ?? task.id));
                if (source) {
                    const original = s.workspace.visits.find(v => v.id === source.visitId);
                    if (!original || original.state !== 'confirmed' || original.voidedAt || original.supersededBy || source.sourceHashVersion !== 1 || await visitSource(original) !== source.sourceHash)
                        blockers.push('current confirmed scheduled source requires review');
                }
            }
        const sources = [];
        for (const v of visits)
            sources.push({ id: v.id, version: v.version, recordVersion: v.recordVersion, hash: await visitSource(v) });
        people.push({ personId: p.id, version: p.version, episodes: episodes.map(e => ({ id: e.id, version: e.packVersion })), sources, tasks: tasks.map(x => ({ id: x.id, open: followUpOpen(s, x) })), work: work.map(x => ({ id: x.id, version: x.version, state: x.state, sourceStatus: x.sourceStatus })), blockers, materialHash: await digest({ episodes, tasks, work, referrals, submissions }) });
    }
    const plan = { transitionId: t.id, transitionVersion: t.version, hash: t.hash, teamId: t.teamId, packId: a.packId, fromVersion: a.version, toVersion: b.version, effectiveAt: t.effectiveAt, schedule: t.schedule, mapping: t.mapping, people };
    const { transitionVersion: _, ...impact } = plan;
    return { ...plan, authorityCurrent, impactHash: await digest({ format: 'saha-transition-reviewed-impact-v1', ...impact }), planHash: await digest({ format: 'saha-installed-transition-impact-v1', ...plan, actor: { id: m.userId, version: m.version, role: m.role, owner: !!m.isOwner, teams: m.teamIds }, purposeGrants: s.operations?.purposeGrants ?? [] }) };
}
const audit = (s, u, m, action, id, reason, at) => s.workspace.audit.push({ id: uuid(), at, actorId: u.userId, actor: u.displayName, role: m.role, action, subject: id, detail: reason });
export async function applyTransition(s, c, u, m, now = new Date().toISOString()) {
    if (c.type === 'stage') {
        transitionCareGate(s, m, c.teamId);
        if (!m.isOwner || !team(m, c.teamId))
            fail(403, 'Current team care owner stages a transition.');
        const { a, b } = pair(s, c);
        if (!s.teams.some(t => t.id === c.teamId))
            fail(422, 'Choose a current team.');
        if (transitionsOf(s).length >= 100)
            fail(422, 'Retained transition history limit reached.');
        const seen = new Set();
        for (const q of c.mapping) {
            const from = a.pack.questions.find(x => x.id === q.from), to = b.pack.questions.find(x => x.id === q.to);
            if (!from || !to || from.fact || to.fact || seen.has(q.from) || seen.has(q.to) || JSON.stringify(from.options) !== JSON.stringify(to.options))
                fail(422, 'Mapping requires distinct documentary questions with identical declared options; measurements and redefined answers need current capture.');
            seen.add(q.from);
            seen.add(q.to);
        }
        if (c.schedule === 'replace-open-declared' && !b.manifest.schedule)
            fail(422, 'The exact target manifest has no declared schedule.');
        const t = { ...c, id: uuid(), version: 1, hash: '', state: 'staged', proposer: u.userId, proposerVersion: m.version, history: [] };
        delete t.type;
        delete t.reason;
        t.hash = await digest(transitionDeclaration(t));
        if (transitionsOf(s).some(x => x.hash === t.hash))
            fail(409, 'This exact declaration already has retained history.');
        t.history.push({ id: uuid(), at: now, by: u.userId, kind: 'staged', reason: c.reason });
        s.operations.installedTransitions = [...transitionsOf(s), t];
        audit(s, u, m, 'installedTransition.stage', t.id, c.reason, now);
        return { transitionId: t.id, hash: t.hash, version: t.version };
    }
    const t = transitionsOf(s).find(x => x.id === c.transitionId);
    if (!t || !team(m, t.teamId))
        fail(403, 'Current transition unavailable.');
    transitionCareGate(s, m, t.teamId);
    if (!transitionVerified(s, t))
        fail(409, 'Protected declaration provenance is unavailable.');
    if (t.version !== c.version || t.hash !== c.hash)
        fail(409, 'Transition changed.');
    pair(s, t);
    if (c.type === 'review') {
        if (m.role !== 'clinician' || m.userId === t.proposer)
            fail(403, 'A different current clinician independently reviews this declaration.');
        const p = s.members.find(x => x.userId === t.proposer);
        if (!['staged', 'approved'].includes(t.state) || !p?.isOwner || p.version !== t.proposerVersion || !team(p, t.teamId))
            fail(409, 'Original proposal authority changed.');
        transitionCareGate(s, p, t.teamId);
        const displayed = await transitionPlan(s, m, t);
        if (displayed.planHash !== c.planHash)
            fail(409, 'The displayed review impact changed. Reload and explicitly review the current plan.');
        if (t.history.length >= 19)
            fail(422, 'Retained review history limit reached. Stage a fresh declaration.');
        t.reviewedImpactHash = displayed.impactHash;
        t.reviewer = u.userId;
        t.reviewerVersion = m.version;
        t.state = c.decision === 'approve' ? 'approved' : 'rejected';
    }
    else {
        if (!m.isOwner)
            fail(403, 'Current care owner explicitly applies adoption.');
        if (t.state !== 'approved' || Date.parse(t.effectiveAt) > Date.parse(now))
            fail(409, 'Only independently approved effective transitions can apply.');
        const original = authority(s, t);
        transitionCareGate(s, original.a, t.teamId);
        transitionCareGate(s, original.b, t.teamId);
        const plan = await transitionPlan(s, m, t);
        if (plan.impactHash !== t.reviewedImpactHash)
            fail(409, 'Independent impact review is stale. Reload and obtain explicit independent review before applying.');
        if (plan.planHash !== c.planHash)
            fail(409, 'Cohort, source or work changed since impact review.');
        if (plan.people.some(p => p.blockers.length))
            fail(409, 'Resolve every blocked episode before this atomic transition.');
        const { a, b } = pair(s, t), eventId = uuid();
        t.appliedPersonIds = plan.people.map(p => p.personId);
        for (const item of plan.people) {
            const p = s.workspace.people.find(p => p.id === item.personId);
            for (const ep of item.episodes) {
                const e = p.enrolments.find(e => e.id === ep.id);
                (e.migrations ??= []).push({ batchId: t.id, from: e.packVersion, to: b.version, at: now, by: u.userId, reason: c.reason, planHash: plan.planHash });
                e.packVersion = b.version;
                for (const x of occurrencesOf(p).filter(x => x.episodeId === e.id && x.state !== 'resolved')) {
                    if (x.kind === 'escalation') {
                        x.sourceStatus = 'review-required';
                        x.version++;
                        x.history.push({ id: uuid(), at: now, by: u.userId, kind: 'transition-review-required', reason: 'Episode moved through reviewed transition ' + t.id + '; unresolved original rule remains.' });
                    }
                }
                if (t.schedule === 'replace-open-declared')
                    for (const task of [...(p.followUps ?? [])].filter(x => x.enrolmentId === e.id && followUpOpen(s, x))) {
                        if (task.transitionOrigin && !transitionReplacementVerified(s, task, p.id))
                            fail(409, 'Original replacement lineage is unavailable; no transition was applied.');
                        const source = occurrencesOf(p).find(x => x.episodeId === e.id && x.id === (task.transitionOrigin?.sourceOccurrenceId ?? task.id) && x.kind === 'follow-up');
                        if (!source)
                            continue;
                        const replacementId = await digest({ format: 'saha-transition-follow-up-v1', transition: t.id, original: task.id });
                        if ((p.followUps ?? []).length >= 200)
                            fail(422, 'Retained task history bound reached; no transition was applied.');
                        const originalBody = JSON.stringify(task), originalHash = await digest(task), metadata = { personId: p.id, teamId: t.teamId, transitionId: t.id, declarationHash: t.hash, eventId, replacementId, originalBody, originalHash, at: now, by: u.userId, reason: c.reason };
                        (t.appliedEffects ??= []).push({ personId: p.id, teamId: t.teamId, originalId: task.id, replacementId, originalHash, eventId, sourceOccurrenceId: source.id });
                        (task.transitionSupersessions ??= []).push(metadata);
                        (p.followUps ??= []).push({ id: replacementId, enrolmentId: e.id, packId: b.packId, title: 'Follow-up: ' + b.pack.name, due: new Date(Date.parse(source.confirmedAt) + b.manifest.schedule.followUpWithinDays * 86400000).toISOString().slice(0, 10), ownerId: task.ownerId, state: 'open', createdAt: now, createdBy: u.userId, transitionOrigin: { personId: p.id, teamId: t.teamId, sourceOccurrenceId: source.id, transitionId: t.id, declarationHash: t.hash, eventId, originalId: task.id, originalHash, installationId: b.id, manifestHash: b.manifestHash } });
                    }
            }
            p.version++;
        }
        (s.operations.teamPackAdoptions ??= []).push({ transitionId: t.id, teamId: t.teamId, packId: a.packId, version: b.version, installationId: b.id, manifestHash: b.manifestHash, at: now, by: u.userId, declarationHash: t.hash, eventId });
        t.applyEventId = eventId;
        t.state = 'applied';
    }
    t.version++;
    t.history.push({ id: t.applyEventId ?? uuid(), at: now, by: u.userId, kind: t.state, reason: c.reason, ...(c.planHash ? { planHash: c.planHash } : {}) });
    audit(s, u, m, 'installedTransition.' + c.type, t.id, c.reason, now);
    return { transitionId: t.id, state: t.state, version: t.version };
}
export function transitionRows(s, before) { const ids = new Set(transitionsOf(before).flatMap(t => t.history.map(h => h.id))); return transitionsOf(s).flatMap(t => t.history.filter(h => !ids.has(h.id)).map(h => ({ table: 'installed_pack_transition_events', keys: ['org_id', 'id'], append: true, values: { org_id: s.organisation.id, id: h.id, transition_id: t.id, actor_id: h.by, kind: h.kind, at: h.at, data: JSON.stringify({ event: h, declaration: transitionDeclaration(t), hash: t.hash, version: t.history.indexOf(h) + 1, state: h.kind, history: t.history.slice(0, t.history.indexOf(h) + 1), ...(t.reviewer ? { reviewer: t.reviewer, reviewerVersion: t.reviewerVersion, reviewedImpactHash: t.reviewedImpactHash } : {}), ...(h.kind === 'applied' ? { applier: h.by, effects: t.appliedEffects ?? [], personIds: t.appliedPersonIds ?? [] } : {}) }) } }))); }
