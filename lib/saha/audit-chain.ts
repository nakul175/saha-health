import type { D1Database } from '@cloudflare/workers-types';
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
type Value = string | number | null;
export type ChainRow = { table: string; values: Record<string, Value>; keys: string[]; append?: boolean };
export type EventRow = { org_id: string; id: string; person_id: string | null; actor_id: string; actor_name: string; role: string; action: string; subject: string; detail: string; at: string; seq?: number | null; prev_hash?: string | null; hash?: string | null };
export type Head = { seq: number; hash: string } | null;
export type Prior = { count: number; lastAt: string | null; lastId: string | null; digest: string };
export type Break = { seq: number; id: string | null; reason: string };
export type Verification = { chainVersion: string; status: 'intact' | 'broken' | 'not-started' | 'incomplete'; events: number; priorEvents: number; head: { seq: number; hash: string; at: string } | null; genesisAt: string | null; firstBreak: Break | null; clockRegressions: { count: number; largestMs: number; firstSeq: number | null }; checkedAt: string };

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
export const canonicalArray = (e: EventRow) => [e.org_id, e.id, e.person_id ?? null, e.actor_id, e.actor_name, e.role, e.action, e.subject, e.detail, e.at];
export const contentDigest = (e: EventRow) => sha256(JSON.stringify(canonicalArray(e)));
export const linkHash = (seq: number, prev: string, content: string) => sha256(JSON.stringify([CHAIN_VERSION, seq, prev, content]));

export async function chainHead(db: D1Database, orgId: string): Promise<Head> {
  const r = await db.prepare('SELECT seq,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq DESC LIMIT 1').bind(orgId).first<{ seq: number; hash: string }>();
  return r ? { seq: Number(r.seq), hash: r.hash } : null;
}

// Digest over events without chain columns, in (at, id) order, one hash step per page.
export async function sealPrior(db: D1Database, orgId: string): Promise<Prior> {
  let digest = await sha256(JSON.stringify([CHAIN_VERSION, 'prior', orgId])), count = 0, lastAt: string | null = null, lastId: string | null = null;
  for (;;) {
    const page: EventRow[] = (await db.prepare(`SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at FROM audit_events WHERE org_id=? AND seq IS NULL${lastAt !== null ? ' AND (at>? OR (at=? AND id>?))' : ''} ORDER BY at,id LIMIT ${PRIOR_PAGE}`).bind(orgId, ...(lastAt !== null ? [lastAt, lastAt, lastId] : [])).all<EventRow>()).results;
    if (!page.length) break;
    digest = await sha256(JSON.stringify([digest, page.map(canonicalArray)]));
    count += page.length; lastAt = page.at(-1)!.at; lastId = page.at(-1)!.id;
    if (page.length < PRIOR_PAGE) break;
  }
  return { count, lastAt, lastId, digest };
}

export const genesisDetail = (p: Prior) => `Audit chain started (${CHAIN_VERSION}). Earlier events sealed without rewriting: count=${p.count}; last=${p.lastAt ?? 'none'}|${p.lastId ?? 'none'}; digest=${p.digest}; page=${PRIOR_PAGE}.`;
export function parseGenesis(detail: string): Prior | null {
  const m = /count=(\d+); last=([^|;]*)\|([^;]*); digest=([0-9a-f]{64}); page=(\d+)\./.exec(detail);
  if (!m || Number(m[5]) !== PRIOR_PAGE) return null;
  return { count: Number(m[1]), lastAt: m[2] === 'none' ? null : m[2], lastId: m[3] === 'none' ? null : m[3], digest: m[4] };
}
export const genesisEvent = (orgId: string, at: string, prior: Prior): EventRow => ({ org_id: orgId, id: GENESIS_ID, person_id: null, actor_id: 'system', actor_name: 'Saha audit chain', role: 'system', action: GENESIS_ACTION, subject: orgId, detail: genesisDetail(prior), at });

// Assigns chain columns to the audit rows of one commit, in their order, after `head`.
// Returns the genesis row to insert first when the organisation has no chain yet.
export async function linkRows(db: D1Database, orgId: string, rows: ChainRow[], now: string): Promise<{ base: Head; genesis: ChainRow | null }> {
  const audit = rows.filter(r => r.table === 'audit_events');
  if (!audit.length) return { base: null, genesis: null };
  const base = await chainHead(db, orgId);
  let seq = base ? base.seq : -1, prev = base ? base.hash : GENESIS_PREV, genesis: ChainRow | null = null;
  const assign = async (v: Record<string, Value>) => { seq++; v.seq = seq; v.prev_hash = prev; v.hash = await linkHash(seq, prev, await contentDigest(v as unknown as EventRow)); prev = v.hash; };
  if (!base) { const g: Record<string, Value> = { ...genesisEvent(orgId, now, await sealPrior(db, orgId)) }; await assign(g); genesis = { table: 'audit_events', values: g, keys: ['org_id', 'id'], append: true }; }
  const cols = Object.keys(audit[0].values).join(',');
  for (const r of audit) { if (Object.keys(r.values).join(',') !== cols) throw new Error('Audit rows must share one column set.'); await assign(r.values); }
  if (genesis) genesis.values = Object.fromEntries(Object.keys(audit[0].values).map(k => [k, genesis!.values[k] ?? null]));
  return { base, genesis };
}
// After a failed batch: did another commit extend the chain since `base` was read?
export async function chainMoved(db: D1Database, orgId: string, base: Head) {
  const now = await chainHead(db, orgId);
  return (now?.seq ?? -1) !== (base?.seq ?? -1);
}

// Walks the chain in sequence order and reports the first break. Content is never returned.
export async function verifyChain(db: D1Database, orgId: string, limit = VERIFY_LIMIT, checkedAt = new Date().toISOString()): Promise<Verification> {
  const priorEvents = Number((await db.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NULL').bind(orgId).first<{ n: number }>())?.n ?? 0);
  const out: Verification = { chainVersion: CHAIN_VERSION, status: 'intact', events: 0, priorEvents, head: null, genesisAt: null, firstBreak: null, clockRegressions: { count: 0, largestMs: 0, firstSeq: null }, checkedAt };
  let expected = 0, prev = GENESIS_PREV, lastAt: string | null = null;
  const broken = (seq: number, id: string | null, reason: string) => { out.status = 'broken'; out.firstBreak = { seq, id, reason }; return out; };
  for (;;) {
    const page = (await db.prepare(`SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL AND seq>=? ORDER BY seq LIMIT ${VERIFY_PAGE}`).bind(orgId, expected).all<EventRow>()).results;
    if (!page.length) break;
    for (const e of page) {
      const seq = Number(e.seq);
      if (seq !== expected) return broken(expected, null, `Event ${expected} is missing from the chain.`);
      if (seq === 0) {
        if (e.action !== GENESIS_ACTION || e.id !== GENESIS_ID) return broken(0, e.id, 'The first chained event is not the genesis marker.');
        const g = parseGenesis(e.detail);
        if (!g) return broken(0, e.id, 'The genesis marker cannot be read.');
        out.genesisAt = e.at;
        if (g.count !== priorEvents) return broken(0, e.id, `Events without chain fields changed since the chain started (${g.count} sealed, ${priorEvents} now).`);
        if ((await sealPrior(db, orgId)).digest !== g.digest) return broken(0, e.id, 'An event sealed by the genesis marker was altered.');
      }
      if (e.prev_hash !== prev) return broken(seq, e.id, 'The link to the previous event does not match.');
      if (await linkHash(seq, prev, await contentDigest(e)) !== e.hash) return broken(seq, e.id, 'The event content or its hash was altered.');
      if (lastAt && Date.parse(lastAt) - Date.parse(e.at) > SKEW_MS) { const ms = Date.parse(lastAt) - Date.parse(e.at); out.clockRegressions.count++; out.clockRegressions.largestMs = Math.max(out.clockRegressions.largestMs, ms); out.clockRegressions.firstSeq ??= seq; }
      lastAt = e.at; prev = e.hash!; expected++; out.events++;
      out.head = { seq, hash: e.hash!, at: e.at };
      if (out.events >= limit) { const more = await db.prepare('SELECT 1 AS x FROM audit_events WHERE org_id=? AND seq>? LIMIT 1').bind(orgId, seq).first(); if (more) { out.status = 'incomplete'; return out; } }
    }
    if (page.length < VERIFY_PAGE) break;
  }
  if (!out.events) out.status = 'not-started';
  return out;
}

export const EXPORT_LIMIT = 5000;
export const HASHING = "content = SHA-256 of JSON.stringify([org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at]); hash = SHA-256 of JSON.stringify(['saha-audit-chain-v1',seq,prev_hash,content]); seq 0 is the genesis marker with prev_hash of 64 zeros.";
// Chained events from `from`, at most `limit`. Patient-linked events are included in full only
// when the exporter has patient scope (the activity log rule); otherwise only their digests.
export async function exportRows(db: D1Database, orgId: string, viewer: { userId: string; role: string }, from: number, limit = EXPORT_LIMIT) {
  const rows = (await db.prepare(`SELECT a.org_id,a.id,a.person_id,a.actor_id,a.actor_name,a.role,a.action,a.subject,a.detail,a.at,a.seq,a.prev_hash,a.hash,CASE WHEN a.person_id IS NULL THEN 1 WHEN ?<>'admin' AND EXISTS (SELECT 1 FROM patients p JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=? WHERE p.org_id=a.org_id AND p.id=a.person_id AND (?<>'asha' OR p.assigned_to=?)) THEN 1 ELSE 0 END AS visible FROM audit_events a WHERE a.org_id=? AND a.seq IS NOT NULL AND a.seq>=? ORDER BY a.seq LIMIT ?`).bind(viewer.role, viewer.userId, viewer.role, viewer.userId, orgId, from, limit + 1).all<EventRow & { visible: number }>()).results;
  const more = rows.length > limit, page = rows.slice(0, limit), lines: Record<string, unknown>[] = [];
  for (const e of page) {
    const content = await contentDigest(e), base = { type: 'event', seq: Number(e.seq), id: e.id, prevHash: e.prev_hash, hash: e.hash, content };
    lines.push(e.visible ? { ...base, event: { personId: e.person_id, actorId: e.actor_id, actorName: e.actor_name, role: e.role, action: e.action, subject: e.subject, detail: e.detail, at: e.at } } : { ...base, redacted: 'Patient-linked event outside the exporter\'s patient scope; content digest only.' });
  }
  return { lines, more, redacted: page.filter(e => !e.visible).length, to: page.length ? Number(page.at(-1)!.seq) : null };
}
// Recomputes an export line's hash from its fields; an auditor can do the same offline.
export async function checkExportLine(orgId: string, line: any): Promise<boolean> {
  const content = line.event ? await contentDigest({ org_id: orgId, id: line.id, person_id: line.event.personId, actor_id: line.event.actorId, actor_name: line.event.actorName, role: line.event.role, action: line.event.action, subject: line.event.subject, detail: line.event.detail, at: line.event.at }) : line.content;
  return content === line.content && await linkHash(line.seq, line.prevHash, content) === line.hash;
}
