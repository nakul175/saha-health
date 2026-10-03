import type { D1Database } from '@cloudflare/workers-types';
import { AppError, digest, uuid } from './core';
import { persist, readState } from './store';
import { applyDueTransfers, dueTransfers, SCHEDULER } from './caseload';
import { evaluateDelivery } from './alert-delivery-server';
import { ALERT_RULES_VERSION } from './alerts';
import { DELIVERY_RULES_VERSION } from './alert-delivery';
import { environmentOf } from './environment';
import { defaultOperations } from './operations';
import { linkTrace } from './trace';
import { JOB_ACTOR, markTimedOut, REVIEW_ACTION, timedOutRequests } from './scheduled-review';
import { planScheduledVerification, verifyChain, type ScheduledVerificationRecord } from './audit-chain';
import type { OrgState, Role } from './types';
// Slice 10a: scheduled trigger (Cloudflare Cron) foundation (BR-ID-04, BR-OPS-04, NFR-18).
//
// Until now Saha did work "when someone uses it": a due caseload transfer applied on the first use after its effective
// time (slice 1f), alerts were recomputed on reads and after commands (slices 6g, 6v), and a request that never got its
// answer was noticed when a page showing it was opened. The Worker's `scheduled` handler (worker/index.ts) now calls
// `runScheduled` every five minutes (a Cron Trigger, `triggers.crons` in the hosted configuration). For each
// organisation in turn, oldest due first, it
//   1. applies due scheduled caseload transfers through the existing all-or-nothing path (slice 6ae), at most
//      `transfers` a run; a refused transfer is held whole, as before;
//   2. marks provider and destination requests past their time limit as needing review (scheduled-review.ts), at most
//      `reviews` a run; it never retries or resends and never calls a provider or a destination;
//   3. evaluates the organisation's operational alerts and in-app delivery (slice 6v), independent of traffic, and
//      records the evaluation (see below). Nothing is emailed, texted or sent outside Saha.
// Every change to the organisation record goes through `persist` (the revision guard, record revisions, the audit chain
// and a command receipt), with audit events that name the scheduled job as the actor. The alert occurrences and
// notifications are written by the same in-app delivery writer the reads use (slice 6v): it lives outside the
// organisation record, writes only changes and is idempotent. The job calls no external service: its only inputs are
// the database binding and the environment variables.
//
// Bounded and resumable. A run touches at most `organisations` organisations and stops starting new ones once it has
// issued `queries` database statements (Cloudflare counts each statement of a batch toward a per-invocation limit: 50 on
// the free plan, 1,000 on the paid plan) or run for `milliseconds`. Organisations with a due transfer come first,
// oldest effective time first; the rest follow in a rotation that moves each run, so every organisation is reached in
// turn. Nothing is carried between runs: a transfer or request that was not reached is still due, and is found again.
// The recorded evaluation (`operations.scheduledJob`) is written when alerts changed and otherwise at most once every
// `heartbeatMinutes`, so a steady state does not move the organisation revision or the audit chain every five minutes.
// A run refuses to start in an environment that is not configured correctly (slice 6n).
export const SCHEDULED_JOB_VERSION = '1.0.0';
export const CRON = '*/5 * * * *';
export const JOB_LIMITS = { organisations: 20, transfers: 10, reviews: 25, queries: 800, milliseconds: 20000, heartbeatMinutes: 60 };
export type JobLimits = typeof JOB_LIMITS;
export type JobRecord = { version: string; evaluatedAt: string; alertRules: string; deliveryRules: string; opened: number; closed: number; escalated: number; recipients: number; recordedBecause: 'first' | 'changed' | 'heartbeat' };
export type OrganisationOutcome = {
  organisationId: string; maintenance: boolean;
  transfers: { applied: number; held: number; deferred: number } | null;
  reviews: { marked: number; deferred: number } | null;
  alerts: { opened: number; closed: number; escalated: number; recipients: number } | null;
  chain: { verified: boolean; status: string | null; events: number; recorded: boolean } | null;
  recorded: boolean; problems: string[];
};
export type JobRun = { refused: string | null; at: string; stoppedBy: 'complete' | 'organisations' | 'queries' | 'time' | 'refused'; organisations: OrganisationOutcome[]; notReached: number; queries: number };
type Env = Record<string, string | undefined>;

// Counts every statement a run issues (a batch counts one per statement, as Cloudflare does) so a run can stop in time.
class Counted {
  constructor(readonly inner: any, readonly tally: { queries: number }) {}
  bind(...values: unknown[]) { return new Counted(this.inner.bind(...values), this.tally); }
  first(column?: string) { this.tally.queries++; return this.inner.first(column); }
  all() { this.tally.queries++; return this.inner.all(); }
  run() { this.tally.queries++; return this.inner.run(); }
  raw(options?: unknown) { this.tally.queries++; return this.inner.raw(options); }
}
export function counted(d: D1Database, tally: { queries: number }): D1Database {
  return { prepare: (query: string) => new Counted(d.prepare(query), tally), batch: (statements: unknown[]) => { tally.queries += statements.length; return d.batch(statements.map(x => (x instanceof Counted ? x.inner : x)) as never); } } as unknown as D1Database;
}

// The organisations to visit, in order: due caseload transfers first (oldest effective time), then everyone else in a
// rotation that advances with the clock, so a run that cannot reach every organisation reaches different ones next time.
export async function organisationQueue(d: D1Database, now: string, perRun: number) {
  const rows = (await d.prepare("SELECT o.id AS id,(SELECT min(json_extract(t.data,'$.effectiveAt')) FROM caseload_transfers t WHERE t.org_id=o.id AND t.state='scheduled' AND json_extract(t.data,'$.effectiveAt')<=?) AS due FROM organisations o ORDER BY o.id LIMIT 1000").bind(now).all<{ id: string; due: string | null }>()).results;
  const due = rows.filter(r => r.due).sort((a, b) => a.due!.localeCompare(b.due!) || a.id.localeCompare(b.id)), rest = rows.filter(r => !r.due);
  const offset = rest.length ? (Math.floor(Date.parse(now) / 300000) * perRun) % rest.length : 0;
  return [...due, ...rest.slice(offset), ...rest.slice(0, offset)].map(r => r.id);
}

const problem = (step: string, e: unknown) => `${step}: ${e instanceof AppError ? (e.status === 409 ? 'conflict, retried next run' : `refused (${e.status})`) : e instanceof Error ? e.name : 'unknown'}`;

async function processOrganisation(d: D1Database, orgId: string, now: string, lim: JobLimits): Promise<OrganisationOutcome> {
  const out: OrganisationOutcome = { organisationId: orgId, maintenance: false, transfers: null, reviews: null, alerts: null, chain: null, recorded: false, problems: [] };
  let s: OrgState;
  try { s = await readState(d, orgId); } catch (e) { out.problems.push(problem('read', e)); return out; }
  // Maintenance pauses automatic application (slice 1f) and every write to the organisation record; alerts are still evaluated.
  out.maintenance = !!s.operations?.maintenance;
  if (!out.maintenance) {
    // 1. Due scheduled caseload transfers, applied or held by the existing path (slice 6ae).
    const due = dueTransfers(s, now);
    if (due.length) {
      const before = structuredClone(s);
      try {
        const outcomes = applyDueTransfers(s, now, lim.transfers);
        if (outcomes.length) {
          const result = { automatic: true, scheduledJob: true, outcomes };
          await persist(d, before, s, SCHEDULER, { type: 'caseloadAutoApply' }, `caseload-auto-${uuid()}`, await digest(result), result);
          out.transfers = { applied: outcomes.filter(x => x.state === 'applied').length, held: outcomes.filter(x => x.state === 'held').length, deferred: due.length - outcomes.length };
        }
      } catch (e) { out.problems.push(problem('transfers', e)); }
      // The state in memory may hold changes that were not committed; read the committed organisation again.
      try { s = await readState(d, orgId); } catch (e) { out.problems.push(problem('read', e)); return out; }
    }
    // 2. Requests past their time limit are marked as needing review. Nothing is retried or resent.
    const late = timedOutRequests(s, now);
    if (late.length) {
      const before = structuredClone(s);
      try {
        const marked = markTimedOut(s, late.slice(0, lim.reviews), now);
        if (marked.length) {
          const key = `scheduled-review-${uuid()}`;
          linkTrace(before, s, REVIEW_ACTION, key, JOB_ACTOR.userId, now);
          const result = { scheduledJob: true, marked: marked.map(x => ({ kind: x.kind, id: x.id })) };
          await persist(d, before, s, JOB_ACTOR, { type: REVIEW_ACTION }, key, await digest(result), result);
          out.reviews = { marked: marked.length, deferred: late.length - marked.length };
        }
      } catch (e) { out.problems.push(problem('reviews', e)); }
      try { s = await readState(d, orgId); } catch (e) { out.problems.push(problem('read', e)); return out; }
    }
  }
  // 3. Operational alerts and in-app delivery, evaluated whether or not anyone is using Saha.
  try {
    const ev = await evaluateDelivery(d, s, now), changed = ev.opened + ev.closed + ev.escalated;
    out.alerts = { opened: ev.opened, closed: ev.closed, escalated: ev.escalated, recipients: ev.recipients };
    const previous = (s.operations as { scheduledJob?: JobRecord } | undefined)?.scheduledJob;
    const because = !previous ? 'first' : changed ? 'changed' : Date.parse(now) - Date.parse(previous.evaluatedAt) >= lim.heartbeatMinutes * 60000 ? 'heartbeat' : null;
    if (because && !out.maintenance) out.recorded = await recordEvaluation(d, orgId, { version: SCHEDULED_JOB_VERSION, evaluatedAt: now, alertRules: ALERT_RULES_VERSION, deliveryRules: DELIVERY_RULES_VERSION, opened: ev.opened, closed: ev.closed, escalated: ev.escalated, recipients: ev.recipients, recordedBecause: because });
  } catch (e) { out.problems.push(problem('alerts', e)); }
  // 4. Audit chain verification from the stored anchor (slice r06, BR-SEC-08): a tampered suffix is found without
  // traffic, and the intact head is advanced as the anchor for the next run. Recording follows the planner (first,
  // break, status change, or hourly heartbeat), so a steady intact state does not move the revision every run.
  try {
    const previous = (s.operations as { auditChain?: ScheduledVerificationRecord } | undefined)?.auditChain;
    const verification = await verifyChain(d, orgId, undefined, now, previous?.anchor ?? null);
    const { record, recordNow } = planScheduledVerification(previous, verification, now, lim.heartbeatMinutes * 60000);
    out.chain = { verified: true, status: verification.status, events: verification.events, recorded: false };
    if (recordNow && !out.maintenance) out.chain.recorded = await recordChainVerification(d, orgId, record);
  } catch (e) { out.problems.push(problem('chain', e)); }
  return out;
}

// The evaluation record: when the scheduled job last evaluated this organisation's alerts, and what changed. It is
// part of the operations record (`operations.scheduledJob`), written through the normal commit with an audit event.
async function recordEvaluation(d: D1Database, orgId: string, record: JobRecord) {
  const fresh = await readState(d, orgId);
  if (fresh.operations?.maintenance) return false;
  const before = structuredClone(fresh), ops = (fresh.operations ??= defaultOperations()) as { scheduledJob?: JobRecord };
  ops.scheduledJob = record;
  const n = record.recipients;
  fresh.workspace.audit.push({ id: uuid(), at: record.evaluatedAt, actorId: JOB_ACTOR.userId, actor: JOB_ACTOR.displayName, role: 'system' as Role, action: 'scheduledAlertEvaluation', subject: orgId, detail: `Operational alerts evaluated by the scheduled job (alert rules ${record.alertRules}, delivery rules ${record.deliveryRules}): ${record.opened} opened, ${record.closed} closed, ${record.escalated} escalated for ${n} recipient${n === 1 ? '' : 's'}. Recorded because ${record.recordedBecause === 'first' ? 'this was the first scheduled evaluation' : record.recordedBecause === 'changed' ? 'alerts changed' : 'the previous record was an hour old'}. In-app only; nothing was sent outside Saha.` });
  await persist(d, before, fresh, JOB_ACTOR, { type: 'scheduledAlertEvaluation' }, `scheduled-alerts-${uuid()}`, await digest(record), record);
  return true;
}

// Slice r06: the scheduled audit-chain verification record (operations.auditChain). Written through the normal commit
// when the planner says so, it stores the verified chain head as the anchor the next run starts from, so each run only
// walks events after the previous record. A broken chain is recorded immediately; its detail carries the first break.
async function recordChainVerification(d: D1Database, orgId: string, record: ScheduledVerificationRecord) {
  const fresh = await readState(d, orgId);
  if (fresh.operations?.maintenance) return false;
  const before = structuredClone(fresh), ops = (fresh.operations ??= defaultOperations()) as { auditChain?: ScheduledVerificationRecord };
  ops.auditChain = record;
  const n = record.events;
  const detail = record.status === 'broken'
    ? `Audit chain scheduled verification: BROKEN${record.firstBreak ? ` at event ${record.firstBreak.seq} (${record.firstBreak.reason})` : ''}.`
    : `Audit chain scheduled verification: ${record.status}, ${n} chained event${n === 1 ? '' : 's'}${record.verifiedFrom ? ` from the stored anchor at event ${record.verifiedFrom.seq}` : ' from the start'}, head at event ${record.head?.seq ?? 'none'}.`;
  fresh.workspace.audit.push({ id: uuid(), at: record.verifiedAt, actorId: JOB_ACTOR.userId, actor: JOB_ACTOR.displayName, role: 'system' as Role, action: 'auditChainScheduledVerification', subject: orgId, detail });
  await persist(d, before, fresh, JOB_ACTOR, { type: 'auditChainScheduledVerification' }, `scheduled-chain-${uuid()}`, await digest(record), record);
  return true;
}

export async function runScheduled(database: D1Database, env: Env, now = new Date().toISOString(), over: Partial<JobLimits> = {}, clock: () => number = Date.now): Promise<JobRun> {
  const lim = { ...JOB_LIMITS, ...over }, run: JobRun = { refused: null, at: now, stoppedBy: 'complete', organisations: [], notReached: 0, queries: 0 };
  // An environment that is not configured correctly is never worked on: fixtures, live calls and writes are all refused there (slice 6n).
  if (environmentOf(env).name === 'misconfigured') { run.refused = 'The environment is not configured correctly (SAHA_ENVIRONMENT).'; run.stoppedBy = 'refused'; return run; }
  const tally = { queries: 0 }, d = counted(database, tally), started = clock();
  const queue = await organisationQueue(d, now, lim.organisations);
  for (const orgId of queue) {
    if (run.organisations.length >= lim.organisations) { run.stoppedBy = 'organisations'; break; }
    // The statement and time bounds are checked between organisations, never before the first: a run always makes progress.
    if (run.organisations.length && tally.queries >= lim.queries) { run.stoppedBy = 'queries'; break; }
    if (run.organisations.length && clock() - started >= lim.milliseconds) { run.stoppedBy = 'time'; break; }
    run.organisations.push(await processOrganisation(d, orgId, now, lim));
  }
  run.notReached = queue.length - run.organisations.length; run.queries = tally.queries;
  return run;
}
