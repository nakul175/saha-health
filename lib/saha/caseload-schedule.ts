// Slice 1f: due scheduled caseload transfers apply when Saha is next used at or after their effective time.
//
// The Worker has no background timer in this deployment (as for slice 6v alert delivery), so every organisation load for
// a read or a command first asks one indexed question: is any scheduled transfer of this organisation due, for a caller
// who is an active member? Only then is the organisation loaded in full, the due transfers applied or held (lib/saha/
// caseload.ts applyDueTransfers) and the result committed with the organisation-wide revision guard. A concurrent
// evaluation that loaded the same revision cannot commit, so each transfer is applied or held exactly once; the loser
// leaves the outcome to the winner. Application is best effort: if it fails the read or command continues, and the next
// use tries again. With nobody using Saha nothing is applied, so the application time depends on traffic. A Cloudflare
// Cron Trigger calling applyDueCaseloads for each organisation every few minutes would bound that delay; it is not
// configured here.
import type { D1Database } from '@cloudflare/workers-types';
import { AppError, digest, uuid } from './core';
import { persist, readState } from './store';
import { applyDueTransfers, SCHEDULER } from './caseload';
export async function applyDueCaseloads(d: D1Database, orgId: string, userId: string, now = new Date().toISOString()) {
  const due = await d.prepare("SELECT 1 AS due FROM caseload_transfers WHERE org_id=? AND state='scheduled' AND json_extract(data,'$.effectiveAt')<=? AND EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active') LIMIT 1").bind(orgId, now, orgId, userId).first();
  if (!due) return null;
  try {
    const state = await readState(d, orgId), before = structuredClone(state);
    // Maintenance pauses automatic application; it resumes on the first use after maintenance ends.
    if (state.operations?.maintenance) return null;
    const outcomes = applyDueTransfers(state, now);
    if (!outcomes.length) return null;
    const result = { automatic: true, outcomes };
    await persist(d, before, state, SCHEDULER, { type: 'caseloadAutoApply' }, `caseload-auto-${uuid()}`, await digest(result), result);
    return outcomes;
  } catch (e) {
    // A 409 means another request committed first (possibly this same application); the next use re-evaluates.
    if (!(e instanceof AppError && e.status === 409)) console.error('Scheduled caseload application failed', e instanceof Error ? e.name : 'unknown');
    return null;
  }
}
