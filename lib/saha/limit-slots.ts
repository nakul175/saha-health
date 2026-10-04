import type { D1Database } from '@cloudflare/workers-types';
import { uuid } from './core';
// Slice 14a: per-requester daily limits that hold under races (table limit_slots, migration 0018).
//
// Two limits bound what one person can learn by repeating a request: the ABHA review throttle (slice 6ab: one identity
// steward review per requester and holding record a day, and after ABHA_REVIEW_LIMIT of them every further link is refused
// the same way) and the indicator refusal limit (slices 13d/13f: at most REFUSALS_PER_DAY refused or partly withheld
// indicator queries a day). Both counted audit events before running the request and wrote the event afterwards, so
// parallel requests could all pass the count before any of them was recorded (reviews 10 and 13f).
//
// Now a request reserves a slot BEFORE it can learn anything (before the duplicate lookup, before the indicator query is
// run), in one statement that inserts the reservation only while fewer than the limit are counted. Counted are used slots
// inside the 24-hour window and reservations still in progress. So at any moment at most `limit` requests are either in
// progress or already counted, and a request that found nothing to count gives its reservation back. When the request
// learns something the limit protects, its reservation becomes a used slot: for an ABHA review under the holding record's
// id (the primary key makes it one per requester and record; a repeat gives its reservation back and records nothing), for
// an indicator refusal under its own id. A request with no slot is answered exactly as the limit answered before.
//
// A reservation that is neither used nor given back (the request was stopped in between) stops counting after
// PENDING_MS. D1 runs one statement at a time per database, and a batch is one transaction.
export type LimitKind = 'abhaReview' | 'indicatorRefusal';
export const LIMIT_WINDOW_MS = 86400000;
export const PENDING_MS = 10 * 60000;
export type LimitSpec = { orgId: string; actorId: string; kind: LimitKind; limit: number;
  // true: an event exactly 24 hours old still counts (the ABHA throttle read `at>=since`); false: it does not (`at>since`).
  inclusive: boolean };
export type Slot = {
  /** Count this request. `key` names what is counted (an ABHA holding record); a used slot under the same key in the window
   * makes this a repeat. Returns true when a new slot is counted, false for a repeat (the reservation is given back). */
  use: (key?: string) => Promise<boolean>;
};
const windowStart = (spec: LimitSpec, now: string) => new Date(Date.parse(now) - LIMIT_WINDOW_MS + (spec.inclusive ? 0 : 1)).toISOString();
const pendingStart = (now: string) => new Date(Date.parse(now) - PENDING_MS).toISOString();
// The rows that count: used slots inside the window and reservations younger than PENDING_MS.
export const COUNTED = "org_id=? AND actor_id=? AND kind=? AND ((state='used' AND at>=?) OR (state='pending' AND at>=?))";
export const RESERVE_SQL = `INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) SELECT ?,?,?,?,'pending',? WHERE (SELECT count(*) FROM limit_slots WHERE ${COUNTED})<?`;
const STALE_SQL = "DELETE FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? AND ((state='used' AND at<?) OR (state='pending' AND at<?))";
/** Reserve a slot, or null when `limit` are already counted. Rows that no longer count are removed in the same transaction. */
export async function reserveSlot(db: D1Database, spec: LimitSpec, now: string): Promise<string | null> {
  const key = 'pending:' + uuid(), since = windowStart(spec, now), pending = pendingStart(now), who = [spec.orgId, spec.actorId, spec.kind];
  const [, inserted] = await db.batch([
    db.prepare(STALE_SQL).bind(...who, since, pending),
    db.prepare(RESERVE_SQL).bind(...who, key, now, ...who, since, pending, spec.limit),
  ]);
  return inserted.meta.changes === 1 ? key : null;
}
/** Turn a reservation into a used slot under `key`; false when a used slot under `key` is already in the window (a repeat). */
export async function useSlot(db: D1Database, spec: LimitSpec, reservation: string, key: string, now: string): Promise<boolean> {
  const who = [spec.orgId, spec.actorId, spec.kind];
  const [, updated] = await db.batch([
    // A used slot under the same key from before the window no longer counts and makes way for this one.
    db.prepare("DELETE FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? AND slot_key=? AND state='used' AND at<?").bind(...who, key, windowStart(spec, now)),
    db.prepare("UPDATE OR IGNORE limit_slots SET slot_key=?,state='used',at=? WHERE org_id=? AND actor_id=? AND kind=? AND slot_key=? AND state='pending'").bind(key, now, ...who, reservation),
    // Still pending only when the update was ignored (a repeat): give the reservation back.
    db.prepare("DELETE FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? AND slot_key=? AND state='pending'").bind(...who, reservation),
  ]);
  return updated.meta.changes === 1;
}
export async function releaseSlot(db: D1Database, spec: LimitSpec, reservation: string) {
  await db.prepare("DELETE FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? AND slot_key=? AND state='pending'").bind(spec.orgId, spec.actorId, spec.kind, reservation).run();
}
/**
 * Run `body` holding a reservation, or answer with `refused` when none is available. The reservation is given back when
 * `body` ends without using it. A failed `use` keeps the reservation (it counts until it expires), so a request that
 * learned something is never left uncounted because a write failed.
 */
export async function withLimitSlot<T>(db: D1Database, spec: LimitSpec, body: (slot: Slot) => Promise<T>, refused: () => never, now = () => new Date().toISOString()): Promise<T> {
  const reservation = await reserveSlot(db, spec, now());
  if (!reservation) refused();
  let settled: Promise<boolean> | null = null;
  const slot: Slot = { use: key => (settled ??= useSlot(db, spec, reservation!, key ?? 'used:' + uuid(), now())) };
  try { return await body(slot); }
  finally { if (!settled) await releaseSlot(db, spec, reservation!).catch(() => { /* the reservation expires after PENDING_MS */ }); }
}
