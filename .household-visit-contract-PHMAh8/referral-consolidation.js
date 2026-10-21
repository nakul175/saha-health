import { declaredNeed } from './programmes.js';
import { z } from 'zod';
import { fail, person, uuid, visit } from './core.js';
import { normallyAllowed } from './access.js';
import { TERMINAL } from './referral-rules.js';
import { MAX_PACK_REQUESTS, MAX_REQUESTS_PER_COMMAND, NEED_IDS, NEED_LABEL, needKey } from './referral-needs.js';
// Slice 10f: cross-pack referral consolidation (BR-PROG-05 acceptance: one visit does not duplicate a referral merely
// because two programme packs identify it; BR-CARE-05). A worker records, for each programme episode that was part of a
// confirmed visit, the referral need it raised. Requests that name the same need (code, or the named need for "other"),
// the same facility, the same person and the same confirmed visit become ONE referral that links every asking episode as a
// source (slice 4d) and records which packs asked. A different need or facility stays its own referral; closed referrals
// are never reopened; referrals without a recorded need (created before this slice) are never merged.
const id = z.string().trim().min(1).max(200);
const request = z.object({
    enrolmentId: id, declarationId: id.optional(), need: z.enum(NEED_IDS), needLabel: z.string().trim().min(3).max(100).optional(),
    facility: z.string().trim().min(3).max(200), reason: z.string().trim().min(5, 'Give the reason in at least 5 characters.').max(1000),
}).strict().refine(r => (r.need === 'other') === !!r.needLabel, { message: 'Name the need when it is "other", and only then.' });
export const programmeReferralSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('createProgrammeReferrals'), visitId: id, requests: z.array(request).min(1).max(MAX_REQUESTS_PER_COMMAND) }).strict(),
]);
// Same people as creating a referral directly: a care worker with normal (not emergency) access. Also applied when an idempotent request is replayed.
export function authorizeProgrammeReferrals(s, m, c) {
    if (c?.type !== 'createProgrammeReferrals')
        return;
    if (!['asha', 'clinician'].includes(m.role))
        fail(403, 'A care role is required to record programme referral needs.');
    const v = s.workspace.visits.find(x => x.id === c.visitId);
    if (!v)
        fail(404, 'Visit not found.');
    const p = s.workspace.people.find(x => x.id === v.personId);
    if (!p || !normallyAllowed(m, p))
        fail(403, 'This patient is outside your care scope.');
}
export function applyProgrammeReferrals(s, input, u, m, now = new Date().toISOString()) {
    const parsed = programmeReferralSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data, w = s.workspace;
    authorizeProgrammeReferrals(s, m, c);
    const v = visit(w, c.visitId), p = person(w, v.personId);
    if (v.voidedAt || v.supersededBy)
        fail(409, 'This visit was corrected or marked as wrong-patient. Open the current visit.');
    if (v.state !== 'confirmed')
        fail(409, 'Confirm the visit before recording a referral need.');
    if (p.mergedInto)
        fail(409, 'This record was merged into another record. Record new care on the surviving record.');
    if (p.identityReview?.state === 'provisional')
        fail(409, 'Patient identity is unresolved. Keep this as a draft and request clinician identity review.');
    const packs = v.programmeCapture?.packs ?? [];
    if (!packs.length)
        fail(422, 'This visit has no programme packs. Use a single referral instead.');
    // Group the requests by need. One request per programme episode and need.
    const groups = new Map();
    const seen = new Set();
    for (const req of c.requests) {
        const cap = packs.find(x => x.enrolmentId === req.enrolmentId);
        if (!cap || !p.enrolments?.some(e => e.id === req.enrolmentId))
            fail(422, 'Each programme episode must be one that was part of this visit.');
        const declaration = declaredNeed(cap.pack, req.declarationId, v);
        if (cap.pack.referralNeeds && !declaration)
            fail(422, 'Choose an eligible referral need explicitly declared by this pinned programme pack.');
        if (!declaration && req.declarationId)
            fail(422, 'This legacy pack has no declared referral contract.');
        if (declaration && (declaration.need !== req.need || (declaration.need === 'other' && declaration.needLabel !== req.needLabel)))
            fail(422, 'The referral request must retain the declared need.');
        const declarationGroup = declaration ? (declaration.compatibilityKey ? 'compatible:' + declaration.compatibilityKey : 'individual:' + req.enrolmentId + ':' + declaration.id) : 'legacy';
        const label = req.need === 'other' ? req.needLabel.replace(/\s+/g, ' ').trim() : NEED_LABEL[req.need], key = needKey(req.need, label, req.facility) + '|' + declarationGroup;
        if (seen.has(key + '#' + req.enrolmentId))
            fail(422, 'Name each programme episode once for each need.');
        seen.add(key + '#' + req.enrolmentId);
        const g = groups.get(key) ?? { code: req.need, label, facility: req.facility.replace(/\s+/g, ' ').trim(), reasonFirst: req.reason, declarationGroup, ...(declaration ? { compatibilityKey: declaration.compatibilityKey } : {}), urgency: declaration?.urgency ?? 'routine', asks: [] };
        if (declaration && ['routine', 'urgent', 'emergency'].indexOf(declaration.urgency) > ['routine', 'urgent', 'emergency'].indexOf(g.urgency))
            g.urgency = declaration.urgency;
        g.asks.push({ req, enrolmentId: req.enrolmentId });
        groups.set(key, g);
    }
    const date = (v.confirmedAt ?? v.createdAt).slice(0, 10), out = [];
    for (const [key, g] of groups) {
        let r = w.referrals.find(x => x.personId === p.id && x.visitId === v.id && !TERMINAL.has(x.state) && x.need && needKey(x.need.code, x.need.label, x.facility) + '|' + (x.need.declarationGroup ?? 'legacy') === key);
        const created = !r;
        if (!r) {
            r = { id: uuid(), personId: p.id, visitId: v.id, facility: g.facility, reason: g.reasonFirst, state: 'draft', version: 1, createdAt: now, ...(g.declarationGroup !== 'legacy' ? { urgency: g.urgency } : {}), need: { code: g.code, label: g.label, ...(g.declarationGroup !== 'legacy' ? { declarationGroup: g.declarationGroup, compatibilityKey: g.compatibilityKey } : {}) } };
            w.referrals.push(r);
        }
        const asked = [];
        if (['routine', 'urgent', 'emergency'].indexOf(g.urgency) > ['routine', 'urgent', 'emergency'].indexOf(r.urgency ?? 'routine'))
            r.urgency = g.urgency;
        for (const { req, enrolmentId } of g.asks) {
            if ((r.packRequests ?? []).some(x => x.enrolmentId === enrolmentId))
                continue;
            if ((r.packRequests ?? []).length >= MAX_PACK_REQUESTS)
                fail(422, 'A referral can record at most 20 programme requests.');
            const cap = packs.find(x => x.enrolmentId === enrolmentId), e = p.enrolments.find(x => x.id === enrolmentId);
            // The asking episode is linked as a source of the referral (slice 4d), reusing a link already made for it.
            let src = (r.sources ??= []).find(x => x.kind === 'programme-episode' && x.refId === e.id);
            if (!src) {
                if (r.sources.length >= 20)
                    fail(422, 'A referral can have at most 20 linked sources.');
                src = { id: uuid(), kind: 'programme-episode', refId: e.id, sourceAt: e.createdAt, linkedAt: now, by: u.userId, note: `Asked for by ${cap.pack.name} v${cap.pack.version}: ${g.label}.` };
                r.sources.push(src);
            }
            (r.packRequests ??= []).push({ id: uuid(), enrolmentId: e.id, packId: cap.pack.id, packVersion: cap.pack.version, packName: cap.pack.name, episodeLabel: e.episodeLabel, reason: req.reason, sourceId: src.id, requestedBy: u.userId, requestedAt: now, ...(cap.pack.referralNeeds ? { declaration: { id: req.declarationId, compatibilityKey: g.compatibilityKey ?? null, urgency: declaredNeed(cap.pack, req.declarationId, v).urgency, manifestHash: cap.pack.installed.manifestHash } } : {}) });
            asked.push(`${cap.pack.name} v${cap.pack.version}`);
        }
        if (!created && asked.length)
            r.version = (r.version ?? 1) + 1;
        out.push({ referralId: r.id, outcome: created ? 'created' : asked.length ? 'consolidated' : 'unchanged', need: g.label, facility: r.facility, packs: (r.packRequests ?? []).map(x => `${x.packName} v${x.packVersion}`) });
        if (created || asked.length)
            w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id,
                detail: `${created ? 'One referral to' : 'Referral to'} ${r.facility} ${created ? 'prepared' : 'extended'} for "${g.label}" from the confirmed visit of ${date}: asked for by ${asked.join(' and ')}${created || (r.packRequests ?? []).length === asked.length ? '' : `; now asked for by ${(r.packRequests ?? []).length} programme episodes`}. ${created ? 'Programmes that raised the same need share this one referral. ' : 'No second referral was created. '}No facility was contacted.` });
    }
    if (out.every(x => x.outcome === 'unchanged'))
        fail(409, 'Every request was already recorded on an open referral.');
    return { visitId: v.id, referrals: out, created: out.filter(x => x.outcome === 'created').length, consolidated: out.filter(x => x.outcome === 'consolidated').length, unchanged: out.filter(x => x.outcome === 'unchanged').length };
}
