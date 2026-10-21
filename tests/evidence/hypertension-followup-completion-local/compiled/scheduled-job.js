import { materialiseInstalledWork, installedWorkRows } from './installed-pack-work.js';
import { sampleAvailability } from './availability.js';
import { AppError, digest, uuid } from './core.js';
import { persist, persistScheduledRecord, readState } from './store.js';
import { applyDueTransfers, dueTransfers, SCHEDULER } from './caseload.js';
import { evaluateDelivery } from './alert-delivery-server.js';
import { ALERT_RULES_VERSION } from './alerts.js';
import { DELIVERY_RULES_VERSION } from './alert-delivery.js';
import { environmentOf } from './environment.js';
import { linkTrace } from './trace.js';
import { JOB_ACTOR, markTimedOut, REVIEW_ACTION, timedOutRequests } from './scheduled-review.js';
import { planScheduledVerification, verifyChain } from './audit-chain.js';
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
// oldest effective time first; the rest follow in a rotation that continues from where the last run stopped (slice 13d), so
// every organisation is reached in turn. Only that cursor is carried between runs: a transfer or request that was not
// reached is still due, and is found again.
// The recorded evaluation (`operations.scheduledJob`) is written when alerts changed and otherwise at most once every
// `heartbeatMinutes`, so a steady state does not move the organisation revision or the audit chain every five minutes.
// A run refuses to start in an environment that is not configured correctly (slice 6n).
export const SCHEDULED_JOB_VERSION = '1.0.0';
export const CRON = '*/5 * * * *';
export const JOB_LIMITS = { organisations: 20, transfers: 10, reviews: 25, queries: 800, milliseconds: 20000, heartbeatMinutes: 60 };
// Counts every statement a run issues (a batch counts one per statement, as Cloudflare does) so a run can stop in time.
class Counted {
    inner;
    tally;
    constructor(inner, tally) {
        this.inner = inner;
        this.tally = tally;
    }
    bind(...values) { return new Counted(this.inner.bind(...values), this.tally); }
    first(column) { this.tally.queries++; return this.inner.first(column); }
    all() { this.tally.queries++; return this.inner.all(); }
    run() { this.tally.queries++; return this.inner.run(); }
    raw(options) { this.tally.queries++; return this.inner.raw(options); }
}
export function counted(d, tally) {
    return { prepare: (query) => new Counted(d.prepare(query), tally), batch: (statements) => { tally.queries += statements.length; return d.batch(statements.map(x => (x instanceof Counted ? x.inner : x))); } };
}
// The organisations to visit, in order: due caseload transfers first (oldest effective time), then everyone else in a
// rotation. Slice 13d (round-10 review M2): the rotation continues from a stored cursor (the last organisation a run
// actually reached, table scheduled_cursor) instead of moving with the clock, so a run stopped early by its statement or
// time bound leaves no organisation behind, and it pages by id with no upper bound (the earlier query read at most 1,000).
export const CURSOR_JOB = 'scheduled-job';
export async function organisationQueue(d, now, perRun) {
    // Slice 13f (review finding 5): an organisation in maintenance is not due: its transfers wait, so it would otherwise stay
    // first in every queue and could use up the run without the rotation moving.
    const due = (await d.prepare("SELECT org_id AS id,min(json_extract(data,'$.effectiveAt')) AS due FROM caseload_transfers WHERE state='scheduled' AND json_extract(data,'$.effectiveAt')<=? AND NOT EXISTS (SELECT 1 FROM operations o WHERE o.org_id=caseload_transfers.org_id AND json_extract(o.data,'$.maintenance')=1) GROUP BY org_id ORDER BY due,org_id LIMIT ?").bind(now, perRun).all()).results.map(r => r.id);
    let cursor = '';
    try {
        cursor = (await d.prepare('SELECT last_org FROM scheduled_cursor WHERE job=?').bind(CURSOR_JOB).first())?.last_org ?? '';
    }
    catch {
        cursor = '';
    }
    const ids = async (sql, n) => n > 0 ? (await d.prepare(sql).bind(cursor, n).all()).results.map(r => r.id) : [];
    const after = await ids('SELECT id FROM organisations WHERE id>? ORDER BY id LIMIT ?', perRun);
    const rotation = [...after, ...(after.length < perRun ? await ids('SELECT id FROM organisations WHERE id<=? ORDER BY id LIMIT ?', perRun - after.length) : [])];
    const first = new Set(due);
    return { ids: [...due, ...rotation.filter(id => !first.has(id))], rotation };
}
const problem = (step, e) => `${step}: ${e instanceof AppError ? (e.status === 409 ? 'conflict, retried next run' : `refused (${e.status})`) : e instanceof Error ? e.name : 'unknown'}`;
async function processOrganisation(d, orgId, now, lim, env) {
    const out = { organisationId: orgId, maintenance: false, transfers: null, reviews: null, alerts: null, chain: null, recorded: false, problems: [] };
    let s;
    try {
        s = await readState(d, orgId);
    }
    catch (e) {
        out.problems.push(problem('read', e));
        return out;
    }
    // Maintenance pauses automatic application (slice 1f) and every write to the organisation record; alerts are still evaluated.
    out.maintenance = !!s.operations?.maintenance;
    if (!out.maintenance) {
        // Reviewed installed work has bounded, idempotent recovery independent of traffic/AI.
        try {
            const before = structuredClone(s);
            const result = await materialiseInstalledWork(s, JOB_ACTOR, undefined, now, 20);
            if (result.created + result.invalidated || JSON.stringify(s.operations) !== JSON.stringify(before.operations))
                await persist(d, before, s, JOB_ACTOR, { type: 'installedWork.recover' }, 'installed-work-' + uuid(), await digest(result), result, installedWorkRows(s, before));
            out.installedWork = result;
        }
        catch (e) {
            out.problems.push(problem('installed-work', e));
        }
        try {
            s = await readState(d, orgId);
        }
        catch (e) {
            out.problems.push(problem('read', e));
            return out;
        }
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
            }
            catch (e) {
                out.problems.push(problem('transfers', e));
            }
            // The state in memory may hold changes that were not committed; read the committed organisation again.
            try {
                s = await readState(d, orgId);
            }
            catch (e) {
                out.problems.push(problem('read', e));
                return out;
            }
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
            }
            catch (e) {
                out.problems.push(problem('reviews', e));
            }
            try {
                s = await readState(d, orgId);
            }
            catch (e) {
                out.problems.push(problem('read', e));
                return out;
            }
        }
    }
    // 3. Operational alerts and in-app delivery, evaluated whether or not anyone is using Saha.
    try {
        const ev = await evaluateDelivery(d, s, now, env), changed = ev.opened + ev.closed + ev.escalated;
        out.alerts = { opened: ev.opened, closed: ev.closed, escalated: ev.escalated, recipients: ev.recipients };
        const previous = s.operations?.scheduledJob;
        const because = !previous ? 'first' : changed ? 'changed' : Date.parse(now) - Date.parse(previous.evaluatedAt) >= lim.heartbeatMinutes * 60000 ? 'heartbeat' : null;
        if (because && !out.maintenance)
            out.recorded = await recordEvaluation(d, orgId, previous, { version: SCHEDULED_JOB_VERSION, evaluatedAt: now, alertRules: ALERT_RULES_VERSION, deliveryRules: DELIVERY_RULES_VERSION, opened: ev.opened, closed: ev.closed, escalated: ev.escalated, recipients: ev.recipients, recordedBecause: because });
    }
    catch (e) {
        out.problems.push(problem('alerts', e));
    }
    // 4. Audit chain verification from the stored anchor (slice r06, BR-SEC-08): a tampered suffix is found without
    // traffic, and the intact head is advanced as the anchor for the next run. Recording follows the planner (first,
    // break, status change, or hourly heartbeat), so a steady intact state does not move the revision every run.
    try {
        const previous = s.operations?.auditChain;
        const verification = await verifyChain(d, orgId, undefined, now, previous?.anchor ?? null);
        const { record, recordNow } = planScheduledVerification(previous, verification, now, lim.heartbeatMinutes * 60000);
        out.chain = { verified: true, status: verification.status, events: verification.events, recorded: false };
        if (recordNow && !out.maintenance)
            out.chain.recorded = await recordChainVerification(d, orgId, previous, record);
    }
    catch (e) {
        out.problems.push(problem('chain', e));
    }
    if (s.operations?.availability?.enabled) {
        try {
            const fresh = await readState(d, orgId, []);
            out.availability = await sampleAvailability(d, fresh, 'scheduler', JOB_ACTOR, null, now, env);
        }
        catch (e) {
            out.problems.push(problem('availability', e));
        }
    }
    return out;
}
// The evaluation record: when the scheduled job last evaluated this organisation's alerts, and what changed. It is
// part of the operations record (`operations.scheduledJob`), with an audit event. Slice 13d (round-10 L1): it is written by
// `persistScheduledRecord`, which does not move the organisation revision, so a command a person prepared just before it
// no longer gets a 409. It is written only if the stored record is still the one this run read, and not in maintenance.
async function recordEvaluation(d, orgId, previous, record) {
    const n = record.recipients;
    return persistScheduledRecord(d, orgId, 'scheduledJob', previous, record, { id: uuid(), at: record.evaluatedAt, actorId: JOB_ACTOR.userId, actor: JOB_ACTOR.displayName, role: 'system', action: 'scheduledAlertEvaluation', subject: orgId, detail: `Operational alerts evaluated by the scheduled job (alert rules ${record.alertRules}, delivery rules ${record.deliveryRules}): ${record.opened} opened, ${record.closed} closed, ${record.escalated} escalated for ${n} recipient${n === 1 ? '' : 's'}. Recorded because ${record.recordedBecause === 'first' ? 'this was the first scheduled evaluation' : record.recordedBecause === 'changed' ? 'alerts changed' : 'the previous record was an hour old'}. In-app only; nothing was sent outside Saha.` });
}
// Slice r06: the scheduled audit-chain verification record (operations.auditChain). Written when the planner says so, it
// stores the verified chain head as the anchor the next run starts from, so each run only walks events after the previous
// record. A broken chain is recorded immediately; its detail carries the first break. Slice 13d: written like the evaluation
// record above, without moving the organisation revision.
async function recordChainVerification(d, orgId, previous, record) {
    const n = record.events;
    const detail = record.status === 'broken'
        ? `Audit chain scheduled verification: BROKEN${record.firstBreak ? ` at event ${record.firstBreak.seq} (${record.firstBreak.reason})` : ''}.`
        : `Audit chain scheduled verification: ${record.status}, ${n} chained event${n === 1 ? '' : 's'}${record.verifiedFrom ? ` from the stored anchor at event ${record.verifiedFrom.seq}` : ' from the start'}, head at event ${record.head?.seq ?? 'none'}.`;
    return persistScheduledRecord(d, orgId, 'auditChain', previous, record, { id: uuid(), at: record.verifiedAt, actorId: JOB_ACTOR.userId, actor: JOB_ACTOR.displayName, role: 'system', action: 'auditChainScheduledVerification', subject: orgId, detail });
}
export async function runScheduled(database, env, now = new Date().toISOString(), over = {}, clock = Date.now) {
    const lim = { ...JOB_LIMITS, ...over }, run = { refused: null, at: now, stoppedBy: 'complete', organisations: [], notReached: 0, queries: 0 };
    // An environment that is not configured correctly is never worked on: fixtures, live calls and writes are all refused there (slice 6n).
    if (environmentOf(env).name === 'misconfigured') {
        run.refused = 'The environment is not configured correctly (SAHA_ENVIRONMENT).';
        run.stoppedBy = 'refused';
        return run;
    }
    const tally = { queries: 0 }, d = counted(database, tally), started = clock();
    const { ids: queue, rotation } = await organisationQueue(d, now, lim.organisations);
    let reached = null;
    for (const orgId of queue) {
        if (run.organisations.length >= lim.organisations) {
            run.stoppedBy = 'organisations';
            break;
        }
        // The statement and time bounds are checked between organisations, never before the first: a run always makes progress.
        if (run.organisations.length && tally.queries >= lim.queries) {
            run.stoppedBy = 'queries';
            break;
        }
        if (run.organisations.length && clock() - started >= lim.milliseconds) {
            run.stoppedBy = 'time';
            break;
        }
        run.organisations.push(await processOrganisation(d, orgId, now, lim, env));
    }
    // Slice 13f (review finding 5): the cursor moves to the end of the rotation's processed prefix, in rotation order, so an
    // organisation that was also due (processed first) cannot move it past rotation members this run did not reach.
    const processed = new Set(run.organisations.map(o => o.organisationId));
    for (const id of rotation) {
        if (!processed.has(id))
            break;
        reached = id;
    }
    // The cursor moves only past organisations this run actually reached.
    if (reached) {
        try {
            await d.prepare('INSERT INTO scheduled_cursor (job,last_org,updated_at) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET last_org=excluded.last_org,updated_at=excluded.updated_at').bind(CURSOR_JOB, reached, now).run();
        }
        catch {
            console.error('Scheduled job cursor not saved');
        }
    }
    const total = (await d.prepare('SELECT count(*) AS n FROM organisations').first())?.n ?? queue.length;
    run.notReached = Math.max(0, total - run.organisations.length);
    run.queries = tally.queries;
    // The queue holds only one run's worth of organisations, so reaching its end with others left is the organisation bound.
    if (run.stoppedBy === 'complete' && run.notReached > 0 && run.organisations.length >= lim.organisations)
        run.stoppedBy = 'organisations';
    return run;
}
