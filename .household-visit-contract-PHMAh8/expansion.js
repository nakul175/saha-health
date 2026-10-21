import { z } from 'zod';
import { digest, fail, uuid } from './core.js';
import { operator } from './operations.js';
export const EXPANSION_CHECKS = ['workflow', 'integration', 'population', 'legal', 'capacity', 'rollback'];
const str = z.string().trim().min(3).max(200), note = z.string().trim().min(10).max(1000), id = z.string().min(1).max(200), version = z.number().int().positive();
export const expansionSpec = z.object({ kind: z.enum(['programme', 'ai', 'ehr', 'location']), name: str, jurisdiction: str, population: note, languages: z.array(z.enum(['en', 'hi'])).min(1).max(2).refine(x => new Set(x).size === x.length), purpose: note, localDifferences: note, dependencies: note, rollback: note }).strict();
const config = z.object({ format: z.literal('saha-expansion-proposal'), schema: z.literal(1), spec: expansionSpec }).strict();
export const expansionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('expansionCreate'), spec: expansionSpec, ownerId: id, reviewerId: id }).strict(),
    z.object({ type: z.literal('expansionImport'), pack: config, ownerId: id, reviewerId: id }).strict(),
    z.object({ type: z.literal('expansionEdit'), id, version, spec: expansionSpec, ownerId: id, reviewerId: id, reason: note }).strict(),
    z.object({ type: z.literal('expansionEvidence'), id, version, check: z.enum(EXPANSION_CHECKS), reference: str, findings: note }).strict(),
    z.object({ type: z.literal('expansionReview'), id, version, hash: z.string().length(64), reference: str, findings: note }).strict(),
    z.object({ type: z.literal('expansionWithdraw'), id, version, reason: note }).strict(),
    z.object({ type: z.literal('expansionActivate'), id, version }).strict(),
]);
function actors(s, ownerId, reviewerId, createdBy) { const owner = s.members.find(m => m.userId === ownerId && m.status === 'active' && operator(m)), reviewer = s.members.find(m => m.userId === reviewerId && m.status === 'active' && m.isOwner); if (!owner || !reviewer)
    fail(422, 'Choose an active operations owner and an organisation-owner reviewer.'); if (ownerId === reviewerId || reviewerId === createdBy)
    fail(422, 'The reviewer must be different from the proposer and accountable owner.'); }
export function expansionFor(s, id) { const x = s.expansions?.find(x => x.id === id); if (!x)
    fail(404, 'Expansion proposal not found.'); return x; }
export async function expansionStatus(s, x) {
    const owner = s.members.find(m => m.userId === x.ownerId), reviewer = s.members.find(m => m.userId === x.reviewerId);
    const hash = await digest({ spec: x.spec, owner: owner ? { id: owner.userId, version: owner.version, status: owner.status, role: owner.role, isOwner: owner.isOwner } : null, reviewer: reviewer ? { id: reviewer.userId, version: reviewer.version, status: reviewer.status, isOwner: reviewer.isOwner } : null, evidence: x.evidence });
    const specHash = await digest(x.spec), missing = EXPANSION_CHECKS.filter(check => !x.evidence.some(e => e.check === check && e.specHash === specHash));
    let authority = true;
    try {
        actors(s, x.ownerId, x.reviewerId, x.createdBy);
    }
    catch {
        authority = false;
    }
    return { hash, specHash, missing, reviewCurrent: x.state === 'reviewed' && x.review?.hash === hash && authority, canReview: authority && !missing.length && x.state !== 'withdrawn', liveEnabled: false, blockers: ['Real pilot exit and buyer/jurisdiction acceptance remain unresolved.', 'Recorded evidence is not independently verified.', 'Proposal review does not install a programme, activate a provider, connect an EHR or open a deployment.'] };
}
export function authorizeExpansion(s, m, c) { if (!c.type.startsWith('expansion'))
    return; if (!operator(m))
    fail(403, 'Operations access required.'); if (c.type === 'expansionReview' && expansionFor(s, c.id).reviewerId !== m.userId)
    fail(403, 'Only the named independent reviewer can record this review.'); }
export async function applyExpansion(s, input, u, m, now = new Date().toISOString()) {
    const parsed = expansionSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    authorizeExpansion(s, m, c);
    s.expansions ??= [];
    let x, result = { ok: true };
    if (c.type === 'expansionCreate' || c.type === 'expansionImport') {
        if (s.expansions.length >= 100)
            fail(422, 'Expansion proposal limit reached.');
        actors(s, c.ownerId, c.reviewerId, u.userId);
        const spec = c.type === 'expansionCreate' ? c.spec : c.pack.spec;
        x = { id: uuid(), version: 1, spec, ownerId: c.ownerId, reviewerId: c.reviewerId, createdBy: u.userId, createdAt: now, state: 'draft', evidence: [], history: [{ by: u.userId, at: now, action: c.type, reason: 'Synthetic proposal only; no clinical records, credentials or approvals copied.' }], ...(c.type === 'expansionImport' ? { sourceHash: await digest(c.pack) } : {}) };
        s.expansions.push(x);
        result = { proposalId: x.id };
    }
    else {
        x = expansionFor(s, c.id);
        if (x.version !== c.version)
            fail(409, 'The proposal changed. Refresh and review the current version.');
        if (c.type === 'expansionActivate')
            fail(409, 'Live expansion is unavailable. Complete the real pilot exit and buyer/jurisdiction approvals in an authorised deployment.');
        if (x.state === 'withdrawn')
            fail(409, 'Withdrawn proposals are immutable. Import a configuration-only copy to start again.');
        if (c.type === 'expansionEdit') {
            if (x.ownerId !== u.userId && !m.isOwner)
                fail(403, 'Only the accountable owner or organisation owner can edit the proposal.');
            actors(s, c.ownerId, c.reviewerId, x.createdBy);
            x.spec = c.spec;
            x.ownerId = c.ownerId;
            x.reviewerId = c.reviewerId;
            x.state = 'draft';
        }
        else if (c.type === 'expansionEvidence') {
            if (x.ownerId !== u.userId && !m.isOwner)
                fail(403, 'Only the accountable owner or organisation owner can add evidence.');
            if (x.evidence.length >= 60)
                fail(422, 'Evidence limit reached.');
            x.evidence.push({ id: uuid(), specHash: await digest(x.spec), check: c.check, reference: c.reference, findings: c.findings, by: u.userId, at: now });
            x.state = 'draft';
        }
        else if (c.type === 'expansionReview') {
            const status = await expansionStatus(s, x);
            if (!status.canReview)
                fail(409, 'Current accountable members and all six evidence categories are required.');
            if (c.hash !== status.hash)
                fail(409, 'The proposal or evidence changed. Review the current version.');
            x.review = { by: u.userId, memberVersion: m.version, hash: status.hash, reference: c.reference, findings: c.findings, at: now };
            x.state = 'reviewed';
        }
        else if (c.type === 'expansionWithdraw') {
            if (x.ownerId !== u.userId && !m.isOwner)
                fail(403, 'Only the accountable owner or organisation owner can withdraw the proposal.');
            x.state = 'withdrawn';
        }
        x.version++;
        x.history.push({ by: u.userId, at: now, action: c.type, reason: 'reason' in c ? c.reason : 'findings' in c ? c.findings : 'Proposal updated.' });
    }
    s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: s.organisation.id, detail: `Expansion proposal ${x.id}, version ${x.version}. Synthetic review only; no live capability activated.` });
    return result;
}
