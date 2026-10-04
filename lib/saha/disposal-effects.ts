// Slice 14f: the disposal register (migration 0021) — the row format, its hash chain and the stored effect of each entry.
//
// One module, used unchanged by the Worker, which applies a disposal (lib/saha/disposal-server.ts), and by
// scripts/recovery.mjs, which re-applies the register to a restored database so that a backup taken before a disposal does
// not bring the disposed content back. It has no imports and only erasable TypeScript, so Node can load it directly.
//
// An entry names one record and what was done to it, never its content: the organisation, its place in the register (seq),
// the batch, the record class and stored table, the record id, the patient and team it belonged to, the time, the rule
// (schedule version, class, years, cutoff) and authority (preparing and approving owners, plan hash) as JSON text, and the
// SHA-256 of the stored row(s) removed. Each entry is chained to the one before it, as the audit chain is:
//   content = SHA-256(JSON.stringify([org_id,id,batch_id,record_class,table_name,record_id,person_id,team_id,disposed_at,rule,authority,content_sha256]))
//   hash    = SHA-256(JSON.stringify(['saha-disposal-chain-v1',seq,prev_hash,content]))   (seq 0 links to 64 zeros)
export const REGISTER_FORMAT = 'saha-disposal-register-v1';
export const DISPOSAL_CHAIN = 'saha-disposal-chain-v1';
export const ZERO_HASH = '0'.repeat(64);
export const DISPOSAL_TABLES = ['patients', 'visits', 'plans', 'ai_results', 'submissions', 'referrals', 'media', 'record_revisions'] as const;
export type DisposalTable = typeof DISPOSAL_TABLES[number];
export const ENTRY_COLUMNS = ['org_id', 'seq', 'id', 'batch_id', 'record_class', 'table_name', 'record_id', 'person_id', 'team_id', 'disposed_at', 'rule', 'authority', 'content_sha256', 'prev_hash', 'hash'] as const;
export type RegisterEntry = {
  org_id: string; seq: number; id: string; batch_id: string; record_class: string; table_name: DisposalTable; record_id: string;
  person_id: string | null; team_id: string | null; disposed_at: string; rule: string; authority: string; content_sha256: string; prev_hash: string; hash: string;
};
export type Effect = { sql: string; binds: (string | number | null)[] };

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const sha256Text = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
export const entryContent = (e: Omit<RegisterEntry, 'hash' | 'prev_hash' | 'seq'>) => JSON.stringify([e.org_id, e.id, e.batch_id, e.record_class, e.table_name, e.record_id, e.person_id ?? null, e.team_id ?? null, e.disposed_at, e.rule, e.authority, e.content_sha256]);
export const contentDigest = (e: Omit<RegisterEntry, 'hash' | 'prev_hash' | 'seq'>) => sha256Text(entryContent(e));
export async function entryHash(e: Omit<RegisterEntry, 'hash'>) { return sha256Text(JSON.stringify([DISPOSAL_CHAIN, e.seq, e.prev_hash, await contentDigest(e)])); }

// Checks one organisation's entries in seq order from 0: contiguous, linked and unaltered. Returns the head.
export async function verifyRegister(entries: RegisterEntry[]): Promise<{ ok: boolean; problem: string | null; head: { seq: number; hash: string } | null }> {
  let prev = ZERO_HASH, org: string | null = null;
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (org === null) org = e.org_id; else if (e.org_id !== org) return { ok: false, problem: `entry ${e.seq} belongs to another organisation`, head: null };
    if (e.seq !== i) return { ok: false, problem: `entry ${i} is missing`, head: null };
    if (!(DISPOSAL_TABLES as readonly string[]).includes(e.table_name)) return { ok: false, problem: `entry ${i} names an unknown table`, head: null };
    if (e.prev_hash !== prev) return { ok: false, problem: `entry ${i}: link to the previous entry does not match`, head: null };
    if (await entryHash(e) !== e.hash) return { ok: false, problem: `entry ${i}: content or hash altered`, head: null };
    prev = e.hash;
  }
  const last = sorted.at(-1);
  return { ok: true, problem: null, head: last ? { seq: last.seq, hash: last.hash } : null };
}

// What a revision of a disposed patient keeps: its row (id, entity, version, actor, action, time) with this content.
// Migration 0021 refuses any other update of a revision, and this one unless the register holds the named entry.
export const revisionTombstone = (e: Pick<RegisterEntry, 'id' | 'batch_id' | 'disposed_at'>) => JSON.stringify({ disposed: true, entry: e.id, batch: e.batch_id, at: e.disposed_at });
export const REVISION_REASON = 'Content disposed under the retention schedule; see the disposal register.';
export const mediaDisposal = (e: Pick<RegisterEntry, 'id' | 'batch_id' | 'disposed_at'>) => JSON.stringify({ at: e.disposed_at, batch: e.batch_id, entry: e.id, reason: 'Disposed under the retention schedule.' });
const MEDIA_INDEX = "(SELECT j.key FROM json_each(visits.data,'$.media') j WHERE json_extract(j.value,'$.id')=?)";

// The stored effect of one entry. Every statement ends in a WHERE clause, so the Worker can append its commit guard.
//  - a patient record and its visits, plans, AI results, submissions and referrals: the row is deleted (the register entry
//    is its tombstone);
//  - media (of a disposed patient, or visit media past its own schedule): the content is erased and the row kept as a
//    tombstone (type, size, SHA-256, purpose, time); visit media also marks the visit's media reference removed;
//  - the patient's revision history (record_id is the patient id): every revision row is kept with its content replaced
//    by the tombstone above, its change list emptied and its reason replaced.
// Audit events and command receipts are never touched: the audit chain still verifies after a disposal.
export function effects(e: RegisterEntry): Effect[] {
  switch (e.table_name) {
    case 'patients': case 'visits': case 'plans': case 'ai_results': case 'submissions': case 'referrals':
      return [{ sql: `DELETE FROM ${e.table_name} WHERE org_id=? AND id=?`, binds: [e.org_id, e.record_id] }];
    case 'media': {
      const erase: Effect = { sql: "UPDATE media SET data='',deleted_at=COALESCE(deleted_at,?) WHERE org_id=? AND id=?", binds: [e.disposed_at, e.org_id, e.record_id] };
      if (e.record_class !== 'visit-media') return [erase];
      return [{
        sql: `UPDATE visits SET data=json_set(data,'$.media['||${MEDIA_INDEX}||'].removedAt',?,'$.media['||${MEDIA_INDEX}||'].disposal',json(?)) WHERE org_id=? AND id=(SELECT visit_id FROM media WHERE org_id=? AND id=?) AND EXISTS (SELECT 1 FROM json_each(visits.data,'$.media') j WHERE json_extract(j.value,'$.id')=? AND json_extract(j.value,'$.removedAt') IS NULL)`,
        binds: [e.record_id, e.disposed_at, e.record_id, mediaDisposal(e), e.org_id, e.org_id, e.record_id, e.record_id],
      }, erase];
    }
    case 'record_revisions':
      return [{ sql: "UPDATE record_revisions SET data=?,changes='[]',reason=? WHERE org_id=? AND person_id=?", binds: [revisionTombstone(e), REVISION_REASON, e.org_id, e.record_id] }];
    default:
      throw new Error('Unknown disposal table.');
  }
}
// The same effects for one batch of entries of one organisation, with the deletions and media erasures grouped into
// statements of up to 80 identifiers (the Worker's commit); revision tombstones and media references stay one per entry.
// tests/disposal-contract.mjs checks that applying these and applying effects() entry by entry leave identical tables.
const DELETED = ['patients', 'visits', 'plans', 'ai_results', 'submissions', 'referrals'] as const;
export function batchEffects(entries: RegisterEntry[]): Effect[] {
  if (new Set(entries.map(e => e.org_id)).size > 1) throw new Error('A disposal batch belongs to one organisation.');
  const out: Effect[] = [], org = entries[0]?.org_id, groups = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 80) }, (_, i) => xs.slice(i * 80, i * 80 + 80));
  for (const table of DELETED) for (const ids of groups(entries.filter(e => e.table_name === table).map(e => e.record_id))) out.push({ sql: `DELETE FROM ${table} WHERE org_id=? AND id IN (${ids.map(() => '?').join(',')})`, binds: [org, ...ids] });
  for (const e of entries.filter(e => e.table_name === 'media' && e.record_class === 'visit-media')) out.push(effects(e)[0]);
  const media = new Map<string, string[]>(); for (const e of entries.filter(e => e.table_name === 'media')) media.set(e.disposed_at, [...(media.get(e.disposed_at) ?? []), e.record_id]);
  for (const [at, all] of media) for (const ids of groups(all)) out.push({ sql: `UPDATE media SET data='',deleted_at=COALESCE(deleted_at,?) WHERE org_id=? AND id IN (${ids.map(() => '?').join(',')})`, binds: [at, org, ...ids] });
  for (const e of entries.filter(e => e.table_name === 'record_revisions')) out.push(...effects(e));
  return out;
}
// The register row as stored (column order of ENTRY_COLUMNS).
export const entryRow = (e: RegisterEntry) => Object.fromEntries(ENTRY_COLUMNS.map(c => [c, e[c] ?? null])) as Record<typeof ENTRY_COLUMNS[number], string | number | null>;
