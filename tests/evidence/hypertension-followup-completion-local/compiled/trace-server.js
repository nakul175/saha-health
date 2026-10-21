import { identity, loadFor, json, db } from './server.js';
import { scope } from './store.js';
import { ACCESS_ACTION_NAMES } from './types.js';
import { assembleTrace, EXECUTION_ACTIONS, parseTraceQuery, traceLookups, traceTarget } from './trace.js';
// Slice 6y: read-only trace of one visit, programme submission or EHR publication for the viewer.
// Not a material read under slice 6t: it returns ids, states, times and command types, no clinical content.
const CHUNK = 40;
// Slice 6aa (seventh review, finding 8): newest first, so a long history keeps its latest events; reaching a limit is reported.
const EXECUTION_LIMIT = 300, ACCESS_LIMIT = 200;
const chunks = (xs) => { const out = []; for (let i = 0; i < xs.length; i += CHUNK)
    out.push(xs.slice(i, i + CHUNK)); return out; };
export async function traceRead(request) {
    const u = await identity(), q = parseTraceQuery(new URL(request.url).searchParams), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    const now = new Date().toISOString(), t = traceTarget(s, m, q, now), l = traceLookups(s, t, now), d = db(), orgId = s.organisation.id, cols = 'id,at,actor_name,role,action,subject,seq';
    let truncated = false;
    const audit = new Map(), add = (rows, limit) => { if (limit && rows.length >= limit)
        truncated = true; for (const r of rows)
        audit.set(r.id, r); };
    // Every event looked up here is linked to the patient (indexed by organisation, patient and time).
    const marks = (n) => Array(n).fill('?').join(',');
    // Subjects and ids are queried in chunks so a visit with many items stays under D1's bound-parameter limit.
    for (const part of chunks(l.subjects))
        add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND action IN (${marks(EXECUTION_ACTIONS.length)}) AND subject IN (${marks(part.length)}) ORDER BY at DESC, seq DESC LIMIT ${EXECUTION_LIMIT}`).bind(orgId, l.personId, ...EXECUTION_ACTIONS, ...part).all()).results, EXECUTION_LIMIT);
    if (l.access && l.visitId)
        add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND action IN (${marks(ACCESS_ACTION_NAMES.length)}) AND (subject=? OR instr(detail,?)>0) ORDER BY at DESC, seq DESC LIMIT ${ACCESS_LIMIT}`).bind(orgId, l.personId, ...ACCESS_ACTION_NAMES, l.visitId, l.visitId).all()).results, ACCESS_LIMIT);
    for (const ids of chunks(l.auditIds))
        add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND id IN (${marks(ids.length)})`).bind(orgId, l.personId, ...ids).all()).results);
    const receipts = [];
    for (const part of chunks(l.receipts))
        receipts.push(...(await d.prepare(`SELECT actor_id,key,created_at FROM command_receipts WHERE org_id=? AND (${part.map(() => '(actor_id=? AND key=?)').join(' OR ')})`).bind(orgId, ...part.flatMap(r => [r.actorId, r.key])).all()).results);
    return json(assembleTrace(s, m, t, [...audit.values()], receipts, now, truncated));
}
