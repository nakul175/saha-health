import type { D1Database } from '@cloudflare/workers-types';
import { AppError } from './core';
import { persist, type Actor } from './store';
import type { Audit, Member, OrgState } from './types';
// Slice 6p (independent review): an export's own audit event is written through `persist`, so the
// audit hash chain stays intact. The export is built from the state and tables read at its start; a
// command saved by a teammate meanwhile makes the commit guard refuse that state (409). Only the
// audit-event commit is then retried: the current state is read again, the exporter's authority is
// checked again on it, and the same event (same id and detail, carrying the checksums of the content
// actually exported) is committed on the fresh state. Any other error, a failed authority check, or a
// conflict on every attempt is returned unchanged and the export is not delivered.
export const EXPORT_AUDIT_ATTEMPTS = 3;
export async function recordExportAudit(db: D1Database, opts: {
  state: OrgState; reload: () => Promise<OrgState>; authorize: (s: OrgState) => Member; event: (m: Member) => Audit;
  actor: Actor; type: string; key: string; hash: string; result?: unknown; attempts?: number;
}) {
  const limit = opts.attempts ?? EXPORT_AUDIT_ATTEMPTS;
  let s = opts.state;
  for (let attempt = 1; ; attempt++) {
    const m = opts.authorize(s), before = structuredClone(s);
    s.workspace.audit.push(opts.event(m));
    try { const plan = await persist(db, before, s, opts.actor, { type: opts.type }, opts.key, opts.hash, opts.result ?? { ok: true }); return { ...plan, exportAttempts: attempt }; }
    catch (e) { if (!(e instanceof AppError) || e.status !== 409 || attempt >= limit) throw e; s = await opts.reload(); }
  }
}
