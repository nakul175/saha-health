// Slice 6j: tamper-evident audit chain (BR-SEC-08, NFR-10).
//
// Each organisation has one linear chain over its audit events. Every event written through
// `persist` or `createState` receives the next sequence number, the previous event's hash and
// its own hash:
//   content = SHA-256(JSON.stringify([org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at]))
//   hash    = SHA-256(JSON.stringify(['saha-audit-chain-v1',seq,prev_hash,content]))
// Sequence 0 is the organisation's genesis marker. Events written before the chain existed keep
// null chain columns and are never rewritten; the genesis marker records their count, the last
// one (time and id) and a digest over them, so later changes to them are also detected.
// A unique index on (org_id, seq) makes a fork impossible: two commits that read the same head
// cannot both insert the next sequence number, and the loser's whole batch rolls back.
export const CHAIN_VERSION = 'saha-audit-chain-v1';
export const GENESIS_PREV = '0'.repeat(64);
export const GENESIS_ID = 'audit-chain-genesis';
export const GENESIS_ACTION = 'auditChainGenesis';
export const PRIOR_PAGE = 500;
export const VERIFY_PAGE = 1000;
export const VERIFY_LIMIT = 100000;
// Clock regressions larger than this between consecutive chained events are reported (not a break).
export const SKEW_MS = 5 * 60 * 1000;
// Slice 6t: the command type of an access-audit commit. It appends audit events only (no receipt, no
// record rows) and does not move the organisation or patient revisions; see lib/saha/access-audit.ts.
export const ACCESS_AUDIT = 'recordAccess';
// Slice 10h: access events that summarise a whole read (a workspace load, a search, a list page, an aggregate view) rather
// than name one patient. They carry no patient id, so only owners and administrators see them in the Activity log, and the
// default log page leaves them out (`GET /api/audit?summaries=1` asks for them) so routine loads do not bury other events.
// They stay in the audit chain and in every export of it. Kept here (not in types.ts) so the store needs no new module.
export const SUMMARY_ACCESS_ACTIONS = ['viewWorkspace', 'searchPatients', 'listPatients', 'viewAggregate'];
// Slice 10b: side tables an access-audit commit may also append to in the same batch (the notification message log: one
// message row per audit event, committed together so a message never exists without its audit event, or the reverse).
export const ACCESS_SIDE_TABLES = new Set(['notification_messages']);
const hex = (b) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
export const canonicalArray = (e) => [e.org_id, e.id, e.person_id ?? null, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at];
export const contentDigest = (e) => sha256(JSON.stringify(canonicalArray(e)));
export const linkHash = (seq, prev, content) => sha256(JSON.stringify([CHAIN_VERSION, seq, prev, content]));
export async function chainHead(db, orgId) {
    const r = await db.prepare('SELECT seq,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq DESC LIMIT 1').bind(orgId).first();
    return r ? { seq: Number(r.seq), hash: r.hash } : null;
}
// Digest over events without chain columns, in (at, id) order, one hash step per page.
export async function sealPrior(db, orgId) {
    let digest = await sha256(JSON.stringify([CHAIN_VERSION, 'prior', orgId])), count = 0, lastAt = null, lastId = null;
    for (;;) {
        const page = (await db.prepare(`SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at FROM audit_events WHERE org_id=? AND seq IS NULL${lastAt !== null ? ' AND (at>? OR (at=? AND id>?))' : ''} ORDER BY at,id LIMIT ${PRIOR_PAGE}`).bind(orgId, ...(lastAt !== null ? [lastAt, lastAt, lastId] : [])).all()).results;
        if (!page.length)
            break;
        digest = await sha256(JSON.stringify([digest, page.map(canonicalArray)]));
        count += page.length;
        lastAt = page.at(-1).at;
        lastId = page.at(-1).id;
        if (page.length < PRIOR_PAGE)
            break;
    }
    return { count, lastAt, lastId, digest };
}
export const genesisDetail = (p) => `Audit chain started (${CHAIN_VERSION}). Earlier events sealed without rewriting: count=${p.count}; last=${p.lastAt ?? 'none'}|${p.lastId ?? 'none'}; digest=${p.digest}; page=${PRIOR_PAGE}.`;
export function parseGenesis(detail) {
    const m = /count=(\d+); last=([^|;]*)\|([^;]*); digest=([0-9a-f]{64}); page=(\d+)\./.exec(detail);
    if (!m || Number(m[5]) !== PRIOR_PAGE)
        return null;
    return { count: Number(m[1]), lastAt: m[2] === 'none' ? null : m[2], lastId: m[3] === 'none' ? null : m[3], digest: m[4] };
}
export const genesisEvent = (orgId, at, prior) => ({ org_id: orgId, id: GENESIS_ID, person_id: null, actor_id: 'system', actor_name: 'Saha audit chain', role: 'system', action: GENESIS_ACTION, subject: orgId, detail: genesisDetail(prior), at });
// Assigns chain columns to the audit rows of one commit, in their order, after `head`.
// Returns the genesis row to insert first when the organisation has no chain yet.
export async function linkRows(db, orgId, rows, now) {
    const audit = rows.filter(r => r.table === 'audit_events');
    if (!audit.length)
        return { base: null, genesis: null };
    const base = await chainHead(db, orgId);
    let seq = base ? base.seq : -1, prev = base ? base.hash : GENESIS_PREV, genesis = null;
    const assign = async (v) => { seq++; v.seq = seq; v.prev_hash = prev; v.hash = await linkHash(seq, prev, await contentDigest(v)); prev = v.hash; };
    if (!base) {
        const g = { ...genesisEvent(orgId, now, await sealPrior(db, orgId)) };
        await assign(g);
        genesis = { table: 'audit_events', values: g, keys: ['org_id', 'id'], append: true };
    }
    const cols = Object.keys(audit[0].values).join(',');
    for (const r of audit) {
        if (Object.keys(r.values).join(',') !== cols)
            throw new Error('Audit rows must share one column set.');
        await assign(r.values);
    }
    if (genesis)
        genesis.values = Object.fromEntries(Object.keys(audit[0].values).map(k => [k, genesis.values[k] ?? null]));
    return { base, genesis };
}
// After a failed batch: did another commit extend the chain since `base` was read?
export async function chainMoved(db, orgId, base) {
    const now = await chainHead(db, orgId);
    return (now?.seq ?? -1) !== (base?.seq ?? -1);
}
// Slice 13e (round-11 O-1): a commit that lost the race for the chain head waits before it is rebuilt on the new head: a random
// time up to 10 ms x 2^attempt (20, 40, 80, 160, 320 ms), so a burst of readers on one organisation does not retry in lockstep
// and exhaust its attempts. Bounded: at most about 620 ms in all before a commit gives up.
export const CHAIN_BACKOFF_MAX_MS = 320;
export const chainBackoffMs = (attempt) => Math.floor(Math.random() * (Math.min(CHAIN_BACKOFF_MAX_MS, 10 * 2 ** attempt) + 1));
export const chainBackoff = (attempt) => new Promise(resolve => setTimeout(resolve, chainBackoffMs(attempt)));
// Access-only reads may lose to every other reader in a 24-request burst. Allow
// that many collision rebuilds without expanding clinical writers' six attempts.
// Maximum access sleep: 20 + 22 * 25 = 570 ms (shared writers retain 620 ms).
// This bounds sleep only; database/network/hash time and hosted capacity are separate.
export const ACCESS_CHAIN_ATTEMPTS = 24;
export const ACCESS_CHAIN_BACKOFF_MAX_MS = 25;
export const accessChainBackoffMs = (attempt) => Math.floor(Math.random() * (Math.min(ACCESS_CHAIN_BACKOFF_MAX_MS, 10 * 2 ** attempt) + 1));
export const accessChainBackoff = (attempt) => new Promise(resolve => setTimeout(resolve, accessChainBackoffMs(attempt)));
// Recognise only the sequence UNIQUE error observed in Node SQLite and local
// native D1. Unknown failures, other constraints and trigger lookalikes fail closed.
// D1 wraps its error in Error.cause; inspect at most three distinct Error objects.
export function isAuditSequenceConflict(error) {
    const seen = new Set();
    for (let current = error, depth = 0; depth < 3 && current instanceof Error && !seen.has(current); depth++) {
        seen.add(current);
        const fault = current;
        if (fault.errcode !== undefined && fault.errcode !== 2067)
            return false;
        const sqlite = fault.errcode === 2067 && /^UNIQUE constraint failed: audit_events\.org_id, audit_events\.seq$/.test(fault.message);
        const nativeD1 = /^(?:D1_ERROR: )?UNIQUE constraint failed: audit_events\.org_id, audit_events\.seq: SQLITE_CONSTRAINT \(extended: SQLITE_CONSTRAINT_UNIQUE\)$/.test(fault.message);
        if (sqlite || nativeD1)
            return true;
        current = fault.cause;
    }
    return false;
}
// Walks the chain in sequence order and reports the first break. Content is never returned.
// Slice 6w (fifth review, finding 8): verification can start from an anchor (a checkpoint the owner kept, or the
// last checkpoint issued and recorded in the chain): the event at the anchor must still hold the anchor's hash,
// and every later event must link from it. Events before the anchor are not re-read (`fromAnchor` says so).
export async function verifyChain(db, orgId, limit = VERIFY_LIMIT, checkedAt = new Date().toISOString(), anchor = null) {
    const priorEvents = Number((await db.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NULL').bind(orgId).first())?.n ?? 0);
    const out = { chainVersion: CHAIN_VERSION, status: 'intact', events: 0, priorEvents, head: null, genesisAt: null, firstBreak: null, clockRegressions: { count: 0, largestMs: 0, firstSeq: null }, checkedAt };
    let expected = 0, prev = GENESIS_PREV, lastAt = null;
    const broken = (seq, id, reason) => { out.status = 'broken'; out.firstBreak = { seq, id, reason }; return out; };
    if (anchor) {
        const a = await db.prepare('SELECT id,hash,at FROM audit_events WHERE org_id=? AND seq=?').bind(orgId, anchor.seq).first();
        if (!a)
            return broken(anchor.seq, null, `The anchor event ${anchor.seq} is missing from the chain.`);
        if (a.hash !== anchor.hash)
            return broken(anchor.seq, a.id, 'The event at the anchor no longer holds the anchor hash.');
        out.fromAnchor = { seq: anchor.seq, hash: anchor.hash };
        expected = anchor.seq + 1;
        prev = anchor.hash;
        lastAt = a.at;
        out.head = { seq: anchor.seq, hash: a.hash, at: a.at };
    }
    for (;;) {
        const page = (await db.prepare(`SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL AND seq>=? ORDER BY seq LIMIT ${VERIFY_PAGE}`).bind(orgId, expected).all()).results;
        if (!page.length)
            break;
        for (const e of page) {
            const seq = Number(e.seq);
            if (seq !== expected)
                return broken(expected, null, `Event ${expected} is missing from the chain.`);
            if (seq === 0) {
                if (e.action !== GENESIS_ACTION || e.id !== GENESIS_ID)
                    return broken(0, e.id, 'The first chained event is not the genesis marker.');
                const g = parseGenesis(e.detail);
                if (!g)
                    return broken(0, e.id, 'The genesis marker cannot be read.');
                out.genesisAt = e.at;
                if (g.count !== priorEvents)
                    return broken(0, e.id, `Events without chain fields changed since the chain started (${g.count} sealed, ${priorEvents} now).`);
                if ((await sealPrior(db, orgId)).digest !== g.digest)
                    return broken(0, e.id, 'An event sealed by the genesis marker was altered.');
            }
            if (e.prev_hash !== prev)
                return broken(seq, e.id, 'The link to the previous event does not match.');
            if (await linkHash(seq, prev, await contentDigest(e)) !== e.hash)
                return broken(seq, e.id, 'The event content or its hash was altered.');
            if (lastAt && Date.parse(lastAt) - Date.parse(e.at) > SKEW_MS) {
                const ms = Date.parse(lastAt) - Date.parse(e.at);
                out.clockRegressions.count++;
                out.clockRegressions.largestMs = Math.max(out.clockRegressions.largestMs, ms);
                out.clockRegressions.firstSeq ??= seq;
            }
            lastAt = e.at;
            prev = e.hash;
            expected++;
            out.events++;
            out.head = { seq, hash: e.hash, at: e.at };
            if (out.events >= limit) {
                const more = await db.prepare('SELECT 1 AS x FROM audit_events WHERE org_id=? AND seq>? LIMIT 1').bind(orgId, seq).first();
                if (more) {
                    out.status = 'incomplete';
                    return out;
                }
            }
        }
        if (page.length < VERIFY_PAGE)
            break;
    }
    if (!out.events && !anchor)
        out.status = 'not-started';
    return out;
}
// The most recent checkpoint issued and recorded in the chain (its detail names the event and hash).
export async function lastRecordedCheckpoint(db, orgId) {
    const r = await db.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='auditChainCheckpoint' AND seq IS NOT NULL ORDER BY seq DESC LIMIT 1").bind(orgId).first();
    const m = r ? /event (\d+), hash ([0-9a-f]{64})/.exec(r.detail) : null;
    return m ? { seq: Number(m[1]), hash: m[2] } : null;
}
export const EXPORT_LIMIT = 5000;
export const HASHING = "content = SHA-256 of JSON.stringify([org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at]); hash = SHA-256 of JSON.stringify(['saha-audit-chain-v1',seq,prev_hash,content]); seq 0 is the genesis marker with prev_hash of 64 zeros.";
// Chained events from `from`, at most `limit`. Patient-linked events are included in full only
// (slice 6p: never for the administrator or sandbox provider roles, which hold no patient scope)
// when the exporter has patient scope (the activity log rule); otherwise only their digests.
export async function exportRows(db, orgId, viewer, from, limit = EXPORT_LIMIT) {
    const rows = (await db.prepare(`SELECT a.org_id,a.id,a.person_id,a.actor_id,a.actor_name,a.role,a.action,a.subject,a.detail,a.at,a.seq,a.prev_hash,a.hash,CASE WHEN a.person_id IS NULL THEN 1 WHEN ? NOT IN ('admin','provider') AND EXISTS (SELECT 1 FROM patients p JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=? WHERE p.org_id=a.org_id AND p.id=a.person_id AND (?<>'asha' OR p.assigned_to=?)) THEN 1 ELSE 0 END AS visible FROM audit_events a WHERE a.org_id=? AND a.seq IS NOT NULL AND a.seq>=? ORDER BY a.seq LIMIT ?`).bind(viewer.role, viewer.userId, viewer.role, viewer.userId, orgId, from, limit + 1).all()).results;
    const more = rows.length > limit, page = rows.slice(0, limit), lines = [];
    for (const e of page) {
        const content = await contentDigest(e), base = { type: 'event', seq: Number(e.seq), id: e.id, prevHash: e.prev_hash, hash: e.hash, content };
        lines.push(e.visible ? { ...base, event: { personId: e.person_id, actorId: e.actor_id, actorName: e.actor_name, role: e.role, action: e.action, subject: e.subject, detail: e.detail, at: e.at } } : { ...base, redacted: 'Patient-linked event outside the exporter\'s patient scope; content digest only.' });
    }
    return { lines, more, redacted: page.filter(e => !e.visible).length, to: page.length ? Number(page.at(-1).seq) : null };
}
// Recomputes an export line's hash from its fields; an auditor can do the same offline.
export async function checkExportLine(orgId, line) {
    const content = line.event ? await contentDigest({ org_id: orgId, id: line.id, person_id: line.event.personId, actor_id: line.event.actorId, actor_name: line.event.actorName, role: line.event.role, action: line.event.action, subject: line.event.subject, detail: line.event.detail, at: line.event.at }) : line.content;
    return content === line.content && await linkHash(line.seq, line.prevHash, content) === line.hash;
}
// Slice 6t: a chain-head checkpoint for external anchoring. An owner or administrator downloads the head
// (sequence, hash, time) of an intact chain and keeps it outside Saha (a ticket, a signed email, a
// notary or a public log). Because every hash commits to all events before it, finding the same hash at
// the same sequence later proves nothing up to that point changed, even if someone with database access
// rewrote a whole suffix and recomputed its hashes (which verification alone cannot detect).
export const CHECKPOINT_FORMAT = 'saha-audit-checkpoint-v1';
export const checkpointDigest = (c) => sha256(JSON.stringify([CHECKPOINT_FORMAT, c.organisationId, c.seq, c.hash, c.at, c.issuedAt]));
export function parseCheckpointRef(text) {
    const m = /^(\d{1,9}):([0-9a-f]{64})$/.exec(text.trim());
    return m ? { seq: Number(m[1]), hash: m[2] } : null;
}
export async function checkCheckpoint(db, orgId, seq, hash) {
    const r = await db.prepare('SELECT hash FROM audit_events WHERE org_id=? AND seq=?').bind(orgId, seq).first();
    const result = !r ? 'not-reached' : r.hash === hash ? 'matches' : 'differs';
    const meaning = { matches: 'The chain still holds this hash at this sequence number: nothing up to the checkpoint has changed since it was taken.', differs: 'The chain holds a different hash at this sequence number: events up to the checkpoint were changed, removed or replaced since it was taken.', 'not-reached': 'The chain has no event with this sequence number: it was never reached, or later events were removed.' }[result];
    return { seq, hash, result, meaning };
}
// Slice r06 (BR-SEC-08): a signed chain-head checkpoint and a scheduled chain verification.
//
// The unsigned checkpoint (CHECKPOINT_FORMAT, slice 6t) proves the head to someone who trusts that they
// downloaded it from Saha. The signed checkpoint adds an HMAC-SHA256 signature over the compact head summary
// (organisation + sequence + head hash), so a copy kept outside Saha can be checked against the deployment's
// signing secret without trusting the transport. The key is a server secret (SAHA_AUDIT_SIGNING_KEY); the key
// id is fixed until a rotation scheme exists. The signature is over the same fields the unsigned checkpoint
// hashes, so a signed checkpoint still names exactly one chain head.
export const SIGNED_CHECKPOINT_FORMAT = 'saha-audit-checkpoint-signed-v1';
export const SIGNED_CHECKPOINT_KEY_ID = 'saha-audit-signing-key-v1';
// The exact bytes signed: the compact summary only, so the signature never covers itself or the key id.
export const signedCheckpointContent = (c) => JSON.stringify([SIGNED_CHECKPOINT_FORMAT, c.organisationId, c.seq, c.hash, c.at, c.issuedAt]);
async function hmacHex(secret, text) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
export async function signCheckpoint(c, secret, keyId = SIGNED_CHECKPOINT_KEY_ID) {
    return { ...c, keyId, signature: await hmacHex(secret, signedCheckpointContent(c)) };
}
export async function verifyCheckpointSignature(signed, secret) {
    return (await hmacHex(secret, signedCheckpointContent(signed))) === signed.signature;
}
// The scheduled (cron) chain verification. It recomputes the chain from a stored anchor (the head of the last
// recorded verification) rather than from the genesis every time, so a busy organisation is verified cheaply and
// a tampered suffix is found even when nobody uses Saha. The result is recorded in the organisation's operations
// record (operations.auditChain) through the normal commit; the anchor is advanced when it is recorded, so each
// recorded run only walks events after the previous record.
export const SCHEDULED_VERIFY_VERSION = '1.0.0';
// Decides whether to record this verification and builds the record. A record is written on the first run, when a
// break first appears, when the status changes, and otherwise at most once per heartbeat; a steady intact state
// does not move the organisation revision or lengthen the chain every run. `recordNow` is false when the anchor
// should be kept as it is (the next run re-verifies the same range, which is still bounded and correct).
export function planScheduledVerification(previous, verification, now, heartbeatMs) {
    const head = verification.head;
    const anchor = previous?.anchor ?? null;
    let because = null;
    if (!previous)
        because = 'first';
    else if (verification.status === 'broken' && previous.status !== 'broken')
        because = 'break';
    else if (verification.status !== previous.status)
        because = 'changed';
    else if (Date.parse(now) - Date.parse(previous.verifiedAt) >= heartbeatMs)
        because = 'heartbeat';
    const record = {
        version: SCHEDULED_VERIFY_VERSION,
        verifiedFrom: anchor,
        anchor: head ? { seq: head.seq, hash: head.hash } : null,
        verifiedAt: now,
        status: verification.status,
        events: verification.events,
        priorEvents: verification.priorEvents,
        head,
        firstBreak: verification.firstBreak,
        recordedBecause: because ?? 'heartbeat',
    };
    return { record, recordNow: because !== null };
}
