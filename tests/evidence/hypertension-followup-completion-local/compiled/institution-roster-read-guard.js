import { z } from 'zod';
import { fail } from './core.js';
import { dueTransfers, MAX_TRANSFER, MAX_TRANSFERS } from './caseload.js';
const status = z.enum(['scheduled', 'held', 'applied', 'cancelled']), ref = z.string().min(1).max(200), version = z.number().int().positive();
const transfer = z.object({ id: ref, version, state: status, teamId: ref, fromUserId: ref, toUserId: ref, personIds: z.array(ref).min(1).max(MAX_TRANSFER).refine(x => new Set(x).size === x.length), effectiveAt: z.string().datetime(), createdAt: z.string().datetime(), createdBy: z.string().min(1), reason: z.string().min(1) }).passthrough();
const rows = z.array(z.object({ id: ref, version, state: status, team_id: ref, data: z.string() }).strict()).max(MAX_TRANSFERS);
export const INSTITUTION_TRANSFER_PROOF_SQL = 'SELECT id,version,state,team_id,data FROM caseload_transfers WHERE org_id=? ORDER BY id LIMIT 501';
// A read must not call the mutating scheduler. The original scheduled/time predicate
// is evaluated on its bounded current recorded context. Due/held assignments must
// be resolved through the existing authoritative Today/steward flow before disclosure.
export function institutionTransferReadProof(source, visibleIds, now) {
    const raw = rows.safeParse(source);
    if (!raw.success)
        fail(503, 'Current assignment transfer context is unavailable.');
    let transfers;
    try {
        transfers = raw.data.map(r => { const t = transfer.parse(JSON.parse(r.data)); if (t.id !== r.id || t.version !== r.version || t.state !== r.state || t.teamId !== r.team_id || new Date(t.effectiveAt).toISOString() !== t.effectiveAt || new Date(t.createdAt).toISOString() !== t.createdAt)
            throw Error('Unbound transfer context.'); return t; });
    }
    catch {
        fail(503, 'Current assignment transfer context is unavailable.');
    }
    const affected = transfers.filter(t => t.personIds.some(id => visibleIds.includes(id)));
    if (affected.some(t => t.state === 'held') || dueTransfers({ caseloads: affected }, now).length)
        fail(409, 'An assignment transfer is due or held. Return to Today and refresh current authority before reopening this review.');
    return { fingerprint: JSON.stringify(raw.data.filter(r => affected.some(t => t.id === r.id))), refreshAt: affected.filter(t => t.state === 'scheduled').map(t => t.effectiveAt).sort()[0] ?? null };
}
export function institutionAllTransferProof(source, now) { institutionTransferReadProof(source, [], now); const parsed = rows.parse(source); const ids = [...new Set(parsed.flatMap(r => JSON.parse(r.data).personIds))]; return institutionTransferReadProof(source, ids, now); }
