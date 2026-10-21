import { AppError, digest, uuid } from './core.js';
import { persist, readState } from './store.js';
import { applyDueTransfers, SCHEDULER } from './caseload.js';
export async function applyDueCaseloads(d, orgId, userId, now = new Date().toISOString()) {
    // Slice 13d (tenth review): maintenance is checked in the same indexed question, so a due transfer during maintenance no longer
    // makes every request read the whole organisation only to stop.
    const due = await d.prepare("SELECT 1 AS due FROM caseload_transfers WHERE org_id=? AND state='scheduled' AND json_extract(data,'$.effectiveAt')<=? AND EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active') AND NOT EXISTS (SELECT 1 FROM operations WHERE org_id=? AND json_extract(data,'$.maintenance')=1) LIMIT 1").bind(orgId, now, orgId, userId, orgId).first();
    if (!due)
        return null;
    try {
        const state = await readState(d, orgId), before = structuredClone(state);
        // Maintenance pauses automatic application; it resumes on the first use after maintenance ends.
        if (state.operations?.maintenance)
            return null;
        const outcomes = applyDueTransfers(state, now);
        if (!outcomes.length)
            return null;
        const result = { automatic: true, outcomes };
        await persist(d, before, state, SCHEDULER, { type: 'caseloadAutoApply' }, `caseload-auto-${uuid()}`, await digest(result), result);
        return outcomes;
    }
    catch (e) {
        // A 409 means another request committed first (possibly this same application); the next use re-evaluates.
        if (!(e instanceof AppError && e.status === 409))
            console.error('Scheduled caseload application failed', e instanceof Error ? e.name : 'unknown');
        return null;
    }
}
