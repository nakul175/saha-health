import { z } from 'zod';
import { apply, fail, person, uuid, visit } from './core.js';
import { ensurePatientIdentity } from './continuity.js';
import { ensureNotMerged } from './merge.js';
import { ensureExceptionalScope } from './exceptional.js';
import { ensureNotRestricted } from './rights.js';
const id = z.string().trim().min(1).max(200);
export const referralRequestSchema = z.discriminatedUnion('type', [z.object({
        type: z.literal('decideReferralRequest'), visitId: id, decision: z.enum(['refer', 'decline']),
        facility: z.string().trim().min(3).max(200).optional(), reason: z.string().trim().min(5, 'Give the reason in at least 5 characters.').max(1000),
    }).strict()]);
// Also applied when an idempotent request is replayed.
export function authorizeReferralRequest(s, m, c) {
    if (c.type !== 'decideReferralRequest')
        return;
    if (m.role !== 'clinician')
        fail(403, 'A clinician decides on referral requests.');
}
export async function applyReferralRequest(s, input, u, m, now = new Date().toISOString()) {
    const parsed = referralRequestSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data, w = s.workspace;
    authorizeReferralRequest(s, m, c);
    const v = visit(w, c.visitId), p = person(w, v.personId), r = v.referralRequest;
    if (!r)
        fail(404, 'This visit has no referral request.');
    // The same patient guards as creating a referral directly.
    const as = { type: 'createReferral', visitId: v.id };
    ensurePatientIdentity(s, as);
    ensureNotMerged(s, as);
    ensureExceptionalScope(s, m, as, now);
    ensureNotRestricted(s, as);
    if (r.decision)
        fail(409, `This request was already ${r.decision.decision}. Open the visit's referrals.`);
    if (v.voidedAt || v.supersededBy)
        fail(409, 'This visit was corrected or marked as wrong-patient. Review the current visit.');
    if (v.state !== 'confirmed')
        fail(409, 'Confirm the visit before acting on its referral request.');
    if (c.decision === 'decline' && c.facility)
        fail(422, 'A facility applies only when referring.');
    let referralId;
    if (c.decision === 'refer') {
        const before = w.audit.length, made = await apply(w, { type: 'createReferral', visitId: v.id, facility: c.facility ?? r.facility, reason: c.reason }, u.userId, { call: async () => fail(409, 'External calls unavailable') }, now);
        referralId = made.referralId;
        for (const a of w.audit.slice(before))
            Object.assign(a, { actorId: u.userId, actor: u.displayName, role: m.role, personId: p.id });
    }
    r.decision = { decision: c.decision === 'refer' ? 'referred' : 'declined', by: u.userId, at: now, reason: c.reason, ...(referralId ? { referralId } : {}) };
    // The visit's own version is not changed, so a prepared programme plan for this confirmed visit stays valid.
    w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'decideReferralRequest', subject: v.id, personId: p.id, detail: c.decision === 'refer' ? `Referral ${referralId} created from the field referral request (requested ${r.requestedAt} for ${r.facility}). Reason: ${c.reason}. No facility was contacted.` : `Field referral request (requested ${r.requestedAt} for ${r.facility}) declined. Reason: ${c.reason}.` });
    return { visitId: v.id, decision: r.decision.decision, referralId: referralId ?? null };
}
