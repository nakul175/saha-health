import { z } from 'zod';
import { digest, fail, uuid } from './core.js';
import { allowedFor, normallyAllowed, purposePermits } from './access.js';
import { conditionMet } from './programmes.js';
import { installationsOf } from './pack-installation.js';
export const INSTALLED_WORK_NOTICE = 'Opt-in installed synthetic configuration; independent governance review is not clinical approval. No external messages or diagnosis.';
export const policiesOf = (s) => s.operations?.installedWorkPolicies ?? [];
export const occurrencesOf = (p) => p.installedWork ?? [];
const id = z.string().min(1).max(100), hash = z.string().regex(/^[a-f0-9]{64}$/), reason = z.string().trim().min(10).max(500);
export const installedWorkSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('propose'), installationId: id, manifestHash: hash, teamId: id, effectiveAt: z.string().datetime(), anchor: z.literal('confirmedAt'), reason }).strict(),
    z.object({ type: z.literal('review'), policyId: id, version: z.number().int().positive(), hash, decision: z.enum(['approve', 'reject']), reason }).strict(),
    z.object({ type: z.literal('activate'), policyId: id, version: z.number().int().positive(), hash, reason }).strict(),
    z.object({ type: z.literal('suspend'), policyId: id, version: z.number().int().positive(), hash, reason }).strict(),
    z.object({ type: z.literal('decide'), personId: id, personVersion: z.number().int().positive(), occurrenceId: id, version: z.number().int().positive(), visitVersion: z.number().int().positive(), sourceStatus: z.enum(['current', 'review-required']), currentSourceHash: hash, decision: z.enum(['acknowledge', 'resolve']), reason }).strict()
]);
function care(s, m, p) { if (!normallyAllowed(m, p) || !allowedFor(m, p, s.operations?.purposeGrants, 'care-coordination'))
    fail(403, 'Current normal care scope and care-coordination purpose are required.'); }
function teamMember(m, team) { return m.status === 'active' && ['asha', 'clinician', 'supervisor'].includes(m.role) && m.teamIds.includes(team); }
export function governanceGate(s, m, t) { if (!teamMember(m, t) || !purposePermits(m, 'care-coordination', s.operations?.purposeGrants))
    fail(403, 'Current team care authority and care-coordination purpose are required.'); for (const p of s.workspace.people.filter(p => p.teamId === t))
    care(s, m, p); }
export function policyAuthority(s, x) { const proposer = s.members.find(m => m.userId === x.proposer), reviewer = s.members.find(m => m.userId === x.reviewer); return !!proposer?.isOwner && purposePermits(proposer, 'care-coordination', s.operations?.purposeGrants) && proposer.version === x.proposerVersion && teamMember(proposer, x.teamId) && !!reviewer && reviewer.role === 'clinician' && purposePermits(reviewer, 'care-coordination', s.operations?.purposeGrants) && reviewer.userId !== proposer.userId && reviewer.version === x.reviewerVersion && teamMember(reviewer, x.teamId) && s.workspace.people.filter(p => p.teamId === x.teamId).every(p => normallyAllowed(proposer, p) && normallyAllowed(reviewer, p) && allowedFor(proposer, p, s.operations?.purposeGrants, 'care-coordination') && allowedFor(reviewer, p, s.operations?.purposeGrants, 'care-coordination')); }
function activeInstallation(s, x) { const i = installationsOf(s).find(i => i.id === x.installationId && i.manifestHash === x.manifestHash); if (!i || i.state !== 'active')
    fail(409, 'The exact installed manifest is not active.'); return i; }
const canonical = (x) => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
export async function visitSource(v) { return digest(canonical({ format: 'saha-installed-work-source-v1', version: v.version, state: v.state, confirmedAt: v.confirmedAt ?? null, facts: v.facts, programmeCapture: v.programmeCapture ?? null, voidedAt: v.voidedAt ?? null, supersededBy: v.supersededBy ?? null })); }
export function transitionReviewPending(x) { return x.history.at(-1)?.kind === 'transition-review-required'; }
export function installedSourceStatus(x, v, currentHash) { return currentHash === x.sourceHash && x.sourceHashVersion === 1 && !v.voidedAt && !v.supersededBy && !transitionReviewPending(x) ? 'current' : 'review-required'; }
export function installedWorkRows(s, before) { const old = new Set([...policiesOf(before).flatMap(x => x.history.map(h => h.id)), ...before.workspace.people.flatMap(p => occurrencesOf(p).flatMap(x => x.history.map(h => h.id)))]); return [...policiesOf(s).flatMap(x => x.history.map(h => ({ entity: x.id, person: null, event: h, kind: h.state }))), ...s.workspace.people.flatMap(p => occurrencesOf(p).flatMap(x => x.history.map(h => ({ entity: x.id, person: p.id, event: h, kind: h.kind }))))].filter(x => !old.has(x.event.id)).map(x => ({ table: 'installed_pack_work_events', keys: ['org_id', 'id'], append: true, values: { org_id: s.organisation.id, id: x.event.id, entity_id: x.entity, person_id: x.person, actor_id: x.event.by, kind: x.kind, at: x.event.at, data: JSON.stringify(x.event) } })); }
const audit = (s, u, m, action, subject, detail, at, personId) => s.workspace.audit.push({ id: uuid(), at, actorId: u.userId, actor: u.displayName, role: m?.role ?? 'supervisor', action, subject, ...(personId ? { personId } : {}), detail });
export async function applyInstalledWork(s, c, u, m, now = new Date().toISOString()) {
    if (c.type === 'decide') {
        const p = s.workspace.people.find(p => p.id === c.personId);
        if (!p)
            fail(403, 'Current normal care scope and care-coordination purpose are required.');
        care(s, m, p);
        if (p.version !== c.personVersion || p.mergedInto)
            fail(409, 'Patient context changed or merged. Refresh the current record before deciding.');
        const x = occurrencesOf(p).find(x => x.id === c.occurrenceId);
        if (!x || x.kind !== 'escalation')
            fail(404, 'Escalation not found.');
        const v = s.workspace.visits.find(v => v.id === x.visitId);
        if (!v)
            fail(409, 'Original source is unavailable.');
        if (m.role !== 'clinician' || m.userId === v.patientCheck?.by)
            fail(403, 'An independent currently scoped clinician decides this escalation.');
        const currentHash = await visitSource(v);
        const current = installedSourceStatus(x, v, currentHash);
        if (x.version !== c.version || v.version !== c.visitVersion || current !== c.sourceStatus || currentHash !== c.currentSourceHash)
            fail(409, 'Care work or its source changed. Refresh before deciding.');
        if (x.state === 'resolved')
            fail(409, 'Resolved escalation history is immutable.');
        if (c.decision === 'acknowledge' && x.state === 'acknowledged' && !transitionReviewPending(x))
            fail(409, 'This escalation is already acknowledged; its unresolved evidence remains.');
        x.state = c.decision === 'resolve' ? 'resolved' : 'acknowledged';
        x.sourceStatus = currentHash === x.sourceHash && x.sourceHashVersion === 1 && !v.voidedAt && !v.supersededBy ? 'current' : 'review-required';
        x.version++;
        x.history.push({ id: uuid(), at: now, by: u.userId, kind: c.decision, reason: c.reason });
        p.version++;
        audit(s, u, m, 'installedWork.decide', x.id, c.decision + ': ' + c.reason, now, p.id);
        return { occurrenceId: x.id, state: x.state };
    }
    governanceGate(s, m, c.teamId ?? policiesOf(s).find(x => x.id === c.policyId)?.teamId ?? '');
    if (c.type === 'propose') {
        if (!m.isOwner)
            fail(403, 'Only a current care owner proposes execution.');
        const i = activeInstallation(s, c);
        if (!s.teams.some(t => t.id === c.teamId))
            fail(422, 'Choose a current team.');
        if (policiesOf(s).length >= 40)
            fail(422, 'Execution policy history limit reached.');
        const x = { id: uuid(), version: 1, installationId: i.id, manifestHash: i.manifestHash, teamId: c.teamId, effectiveAt: c.effectiveAt, anchor: 'confirmedAt', hash: '', state: 'proposed', proposer: u.userId, proposerVersion: m.version, history: [] };
        x.hash = await digest({ format: 'saha-installed-execution-policy-v1', installationId: x.installationId, manifestHash: x.manifestHash, teamId: x.teamId, effectiveAt: x.effectiveAt, anchor: x.anchor, proposer: x.proposer, proposerVersion: x.proposerVersion });
        if (policiesOf(s).some(y => y.hash === x.hash))
            fail(409, 'This exact execution proposal already has retained history. Review that policy.');
        x.history.push({ id: uuid(), at: now, by: u.userId, state: x.state, reason: c.reason });
        s.operations.installedWorkPolicies = [...policiesOf(s), x];
        audit(s, u, m, 'installedWork.propose', x.id, c.reason, now);
        return { policyId: x.id, hash: x.hash, version: x.version };
    }
    const x = policiesOf(s).find(x => x.id === c.policyId);
    if (!x)
        fail(404, 'Policy not found.');
    if (x.version !== c.version || x.hash !== c.hash)
        fail(409, 'Execution policy changed.');
    if (c.type === 'review') {
        if (m.role !== 'clinician' || m.userId === x.proposer)
            fail(403, 'A different current clinician reviews the exact policy.');
        if (x.state !== 'proposed')
            fail(409, 'Only a new proposal can be reviewed.');
        activeInstallation(s, x);
        const owner = s.members.find(y => y.userId === x.proposer);
        if (!owner?.isOwner || owner.version !== x.proposerVersion || !teamMember(owner, x.teamId))
            fail(409, 'Original proposal authority changed.');
        governanceGate(s, owner, x.teamId);
        x.reviewer = u.userId;
        x.reviewerVersion = m.version;
        x.state = c.decision === 'approve' ? 'approved' : 'rejected';
    }
    else {
        if (!m.isOwner)
            fail(403, 'Only a current care owner changes execution activation.');
        if (c.type === 'activate') {
            if (x.state !== 'approved' || !policyAuthority(s, x))
                fail(409, 'Fresh independent approval is required.');
            activeInstallation(s, x);
            governanceGate(s, s.members.find(m => m.userId === x.proposer), x.teamId);
            governanceGate(s, s.members.find(m => m.userId === x.reviewer), x.teamId);
            if (policiesOf(s).some(y => y.id !== x.id && y.state === 'active' && y.teamId === x.teamId && y.installationId === x.installationId))
                fail(409, 'Suspend the previous policy explicitly before activating another.');
            x.state = 'active';
            x.activatedAt = now;
        }
        else {
            if (!['active', 'approved'].includes(x.state))
                fail(409, 'Policy is not active or approved.');
            x.state = 'suspended';
        }
    }
    x.version++;
    x.history.push({ id: uuid(), at: now, by: u.userId, state: x.state, reason: c.reason });
    audit(s, u, m, 'installedWork.' + c.type, x.id, c.reason, now);
    return { policyId: x.id, hash: x.hash, version: x.version, state: x.state };
}
export async function materialiseInstalledWork(s, u, visitId, now = new Date().toISOString(), limit = 20) {
    let created = 0, invalidated = 0;
    const all = s.workspace.visits.filter(v => !visitId || v.id === visitId).sort((a, b) => a.id.localeCompare(b.id)), cursor = s.operations?.installedWorkCursor ?? '', ordered = visitId ? all : [...all.filter(v => v.id > cursor), ...all.filter(v => v.id <= cursor)], visits = ordered.slice(0, 20);
    for (const v of visits) {
        const previousCursor = s.operations?.installedWorkCursor ?? '';
        if (!visitId && policiesOf(s).length)
            s.operations.installedWorkCursor = v.id;
        const stop = () => { if (!visitId && policiesOf(s).length)
            s.operations.installedWorkCursor = previousCursor; return { created, invalidated }; };
        const p = s.workspace.people.find(p => p.id === v.personId);
        if (!p)
            continue;
        const sourceHash = await visitSource(v);
        for (const x of occurrencesOf(p).filter(x => x.visitId === v.id && x.sourceStatus === 'current'))
            if (sourceHash !== x.sourceHash || x.sourceHashVersion !== 1 || v.voidedAt || v.supersededBy) {
                if (created + invalidated >= limit)
                    return stop();
                x.sourceStatus = 'review-required';
                x.version++;
                x.history.push({ id: uuid(), at: now, by: u.userId, kind: 'source-review-required', reason: 'Original confirmed source changed, voided or superseded; prior work and unresolved escalation retained.' });
                p.version++;
                invalidated++;
                audit(s, u, s.members.find(m => m.userId === u.userId) ?? null, 'installedWork.sourceReview', x.id, 'Original rule evidence requires current independent review.', now, p.id);
            }
        if (p.mergedInto || v.state !== 'confirmed' || !v.confirmedAt || !Number.isFinite(Date.parse(v.confirmedAt)) || Date.parse(v.confirmedAt) > Date.parse(now) || v.imported || v.voidedAt || v.supersededBy)
            continue;
        for (const policy of policiesOf(s).filter(x => x.state === 'active' && x.teamId === p.teamId && Date.parse(x.effectiveAt) <= Date.parse(v.confirmedAt) && !!x.activatedAt && Date.parse(x.activatedAt) <= Date.parse(v.confirmedAt) && policyAuthority(s, x))) {
            const i = installationsOf(s).find(i => i.id === policy.installationId && i.manifestHash === policy.manifestHash && i.state === 'active');
            if (!i)
                continue;
            const a = s.members.find(m => m.userId === policy.proposer), b = s.members.find(m => m.userId === policy.reviewer);
            if (!normallyAllowed(a, p) || !normallyAllowed(b, p) || !allowedFor(a, p, s.operations?.purposeGrants, 'care-coordination') || !allowedFor(b, p, s.operations?.purposeGrants, 'care-coordination'))
                continue;
            const capture = v.programmeCapture?.packs.find(x => x.pack.installed?.installationId === i.id && x.pack.installed.manifestHash === i.manifestHash && x.pack.id === i.packId && x.pack.version === i.version);
            if (!capture)
                continue;
            const episode = p.enrolments?.find(e => e.id === capture.enrolmentId && e.state === 'active' && e.packId === i.packId && e.packVersion === i.version);
            if (!episode)
                continue;
            const rules = [...(i.manifest.schedule ? [{ id: 'schedule', label: 'Follow-up: ' + i.pack.name, urgency: 'review', days: i.manifest.schedule.followUpWithinDays, kind: 'follow-up' }] : []), ...(i.manifest.escalation ?? []).filter(r => conditionMet(v, r.condition)).map(r => ({ ...r, days: 0, kind: 'escalation' }))];
            for (const rule of rules) {
                const id = await digest({ org: s.organisation.id, person: p.id, episode: episode.id, visit: v.id, sourceHash, policy: policy.id, policyHash: policy.hash, rule: rule.id, kind: rule.kind });
                if (occurrencesOf(p).some(x => x.id === id || (x.visitId === v.id && x.policyId === policy.id && x.ruleId === rule.id && x.kind === rule.kind)))
                    continue;
                if (created + invalidated >= limit)
                    return stop();
                if (occurrencesOf(p).length >= 200)
                    fail(422, 'Installed work evidence limit reached; no source confirmation was committed.');
                const owner = s.members.find(m => m.userId === p.assignedTo && ['asha', 'clinician'].includes(m.role) && normallyAllowed(m, p)) ?? a;
                const x = { id, version: 1, policyId: policy.id, policyHash: policy.hash, installationId: i.id, manifestHash: i.manifestHash, packId: i.packId, packVersion: i.version, episodeId: episode.id, visitId: v.id, visitVersion: v.version, sourceHash, sourceHashVersion: 1, confirmedAt: v.confirmedAt, kind: rule.kind, ruleId: rule.id, title: rule.label, urgency: rule.urgency, due: new Date(Date.parse(v.confirmedAt) + rule.days * 86400000).toISOString().slice(0, 10), ownerId: owner.userId, state: 'open', sourceStatus: 'current', history: [{ id: uuid(), at: now, by: u.userId, kind: 'created', reason: 'Exact independently reviewed execution policy and captured installed rule.' }] };
                (p.installedWork ??= []).push(x);
                if (x.kind === 'follow-up')
                    (p.followUps ??= []).push({ id: x.id, enrolmentId: episode.id, packId: i.packId, title: x.title, due: x.due, ownerId: owner.userId, state: 'open', createdAt: now, createdBy: u.userId });
                p.version++;
                created++;
                audit(s, u, s.members.find(m => m.userId === u.userId) ?? null, 'installedWork.create', x.id, 'Confirmed source ' + v.id + '; installed rule ' + rule.id + '; independent policy ' + policy.id, now, p.id);
            }
        }
    }
    return { created, invalidated };
}
