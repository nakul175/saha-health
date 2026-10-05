import type { D1Database } from '@cloudflare/workers-types';
import { AppError, fail } from './core';
import { persist, type Actor } from './store';
import type { DelegationUse } from './delegation';
import type { Audit, Member, OrgState } from './types';
// Slice 6p (independent review): an export's own audit event is written through `persist`, so the
// audit hash chain stays intact. The export is built from the state and tables read at its start; a
// command saved by a teammate meanwhile makes the commit guard refuse that state (409). Only the
// audit-event commit is then retried: the current state is read again, the exporter's authority is
// checked again on it, and the same event (same id and detail, carrying the checksums of the content
// actually exported) is committed on the fresh state. Any other error, a failed authority check, or a
// conflict on every attempt is returned unchanged and the export is not delivered.
export const EXPORT_AUDIT_ATTEMPTS = 3;
export const EXPORT_REFUSED = 'Saha could not record this export in the audit log, so the export was not delivered. Try again; if this continues, tell your organisation owner.';
export async function recordExportAudit(db: D1Database, opts: {
  state: OrgState; reload: () => Promise<OrgState>; authorize: (s: OrgState) => Member; event: (m: Member) => Audit;
  authorityDelegations?: (s: OrgState, m: Member) => readonly DelegationUse[];
  actor: Actor; type: string; key: string; hash: string; result?: unknown; attempts?: number;
}) {
  const limit = opts.attempts ?? EXPORT_AUDIT_ATTEMPTS;
  let s = opts.state;
  for (let attempt = 1; ; attempt++) {
    const m = opts.authorize(s), before = structuredClone(s);
    s.workspace.audit.push(opts.event(m));
    try { const plan = await persist(db, before, s, opts.actor, { type: opts.type, authorityDelegations: opts.authorityDelegations?.(s, m) }, opts.key, opts.hash, opts.result ?? { ok: true }); return { ...plan, exportAttempts: attempt }; }
    catch (e) {
      // Slice 6t: an audit store failure (anything not an application error) refuses the export with a clear message.
      if (!(e instanceof AppError)) { console.error('Export audit not recorded', e instanceof Error ? e.name : 'unknown'); fail(503, EXPORT_REFUSED); }
      if (e.status !== 409 || attempt >= limit) throw e; s = await opts.reload();
    }
  }
}
// Slice 6q (second independent review): on the retry, the audit-chain and operations exports check the care scope
// (sorted team ids) and, for the operations CSV, the reporting reach (teams and delegation ids) again, as the
// data-exit route already did; a change refuses the export (409) and nothing is delivered.
export const scopeKey = (m: { teamIds: string[] }) => [...m.teamIds].sort().join();
export const reachKey = (r: { teams: string[]; delegations: { id: string }[] }) => [...r.teams].sort().join() + '|' + r.delegations.map(d => d.id).sort().join();
export function sameCareScope(before: { teamIds: string[] }, now: { teamIds: string[] }) { if (scopeKey(before) !== scopeKey(now)) fail(409, 'Your care scope changed while the export was prepared. Export again.'); }
export function sameReach(before: { teams: string[]; delegations: { id: string }[] }, now: { teams: string[]; delegations: { id: string }[] }) { if (reachKey(before) !== reachKey(now)) fail(409, 'Your reporting teams or delegations changed while the export was prepared. Export again.'); }
