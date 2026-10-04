import type { D1Database } from '@cloudflare/workers-types';
import { persist, type Actor, type Row } from './store';
import { fail, uuid } from './core';
import { normallyAllowed } from './access';
import { PLACEHOLDER_NOTE } from './retention';
import { STALE_PLAN, authorizeDisposal, describe, disposalPlan, ensureDisposalEnvironment, waitingBatch } from './disposal';
import { ENTRY_COLUMNS, ZERO_HASH, batchEffects, entryHash, entryRow, sha256Text, type DisposalTable, type RegisterEntry } from './disposal-effects';
import type { Member, OrgState } from './types';

// Slice 14f: a second owner applies exactly the plan another owner prepared (see lib/saha/disposal.ts).
// The commit is one D1 batch under the organisation-wide guard: the plan record, the audit event, the command receipt, one
// register row per disposed record (chained), then the effect of each row (lib/saha/disposal-effects.ts). A teammate's
// change after the state was read refuses the whole batch (409); nothing is disposed and the plan stays waiting.
const GUARD = ' AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)';
const chunk = <T,>(xs: T[], n = 90) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
type Stored = Record<string, string | number | null>;

// The stored row(s) each planned item names, read before the commit. A revision item reads every revision of the patient.
async function storedContent(d: D1Database, orgId: string, items: { table: string; id: string }[]) {
  const out = new Map<string, { sha: string; rows: number }>(), key = (t: string, id: string) => `${t}|${id}`;
  const byTable = new Map<string, string[]>(); for (const i of items) byTable.set(i.table, [...(byTable.get(i.table) ?? []), i.id]);
  for (const [table, ids] of byTable) for (const part of chunk(ids)) {
    const column = table === 'record_revisions' ? 'person_id' : 'id', order = table === 'record_revisions' ? 'person_id,created_at,id' : 'id';
    const rows = (await d.prepare(`SELECT * FROM ${table} WHERE org_id=? AND ${column} IN (${part.map(() => '?').join(',')}) ORDER BY ${order}`).bind(orgId, ...part).all<Stored>()).results;
    const grouped = new Map<string, Stored[]>(); for (const r of rows) { const k = String(r[column]); grouped.set(k, [...(grouped.get(k) ?? []), r]); }
    for (const id of part) { const g = grouped.get(id) ?? []; out.set(key(table, id), { sha: await sha256Text(JSON.stringify(g)), rows: g.length }); }
  }
  return (t: string, id: string) => out.get(key(t, id))!;
}

export async function executeDisposal(d: D1Database, s: OrgState, c: any, u: Actor, m: Member, key: string, hash: string, environment: string) {
  authorizeDisposal(s, m, c); ensureDisposalEnvironment(environment);
  const at = new Date().toISOString(), b = waitingBatch(s, c.batchId, at);
  if (b.preparedBy === u.userId) fail(403, 'A second owner must apply this disposal plan. The owner who prepared it cannot apply it.');
  if (b.planHash !== c.planHash) fail(409, 'This plan hash does not match the waiting disposal plan. Review the plan and give its hash.');
  // The plan is computed again, as of its preparation time, over the records as they are now and in the preparing owner's
  // care scope; it must be identical. The applying owner must also have normal care scope over every planned patient.
  const preparer = s.members.find(x => x.userId === b.preparedBy && x.status === 'active' && x.isOwner);
  if (!preparer) fail(409, 'The owner who prepared this plan is no longer an active owner. Cancel it and prepare a new plan.');
  const again = await disposalPlan(s, preparer!, b.preparedAt);
  if (again.planHash !== b.planHash || again.policyVersion !== b.policyVersion) fail(409, STALE_PLAN);
  const people = new Map(s.workspace.people.map(p => [p.id, p])), items = b.items ?? [];
  if (items.some(i => { const p = people.get(i.personId); return !p || !normallyAllowed(m, p); })) fail(403, 'This plan includes records outside your care scope. An owner who can see every planned record must apply it.');
  const orgId = s.organisation.id, content = await storedContent(d, orgId, items);
  if (items.some(i => i.table !== 'record_revisions' && content(i.table, i.id).rows !== 1)) fail(409, STALE_PLAN);
  const policy = s.retention!.policies.find(p => p.version === b.policyVersion)!;
  const rule = (recordClass: string) => { const r = policy.rules.find(x => x.recordClass === recordClass)!; return JSON.stringify({ policyVersion: policy.version, recordClass, years: r.years, cutoff: again.cutoffs[recordClass as 'patient-record'], placeholder: true }); };
  const authority = JSON.stringify({ preparedBy: b.preparedBy, preparedAt: b.preparedAt, approvedBy: u.userId, planHash: b.planHash });
  const head = await d.prepare('SELECT seq,hash FROM disposals WHERE org_id=? ORDER BY seq DESC LIMIT 1').bind(orgId).first<{ seq: number; hash: string }>();
  let seq = head ? head.seq + 1 : 0, prev = head?.hash ?? ZERO_HASH, revisions = 0;
  const entries: RegisterEntry[] = [];
  for (const i of items) {
    const stored = content(i.table, i.id); if (i.table === 'record_revisions') revisions += stored.rows;
    const e: Omit<RegisterEntry, 'hash'> = { org_id: orgId, seq, id: uuid(), batch_id: b.id, record_class: i.recordClass, table_name: i.table as DisposalTable, record_id: i.id, person_id: i.personId, team_id: i.teamId, disposed_at: at, rule: rule(i.recordClass), authority, content_sha256: stored.sha, prev_hash: prev };
    const entry = { ...e, hash: await entryHash(e) }; entries.push(entry); prev = entry.hash; seq++;
  }
  const before = structuredClone(s), batch = s.retention!.disposals!.find(x => x.id === b.id)!;
  const counts = { ...b.counts, ...(revisions ? { revisions } : {}) };
  Object.assign(batch, { state: 'applied', approvedBy: u.userId, appliedAt: at, counts, register: { first: entries[0].seq, last: entries.at(-1)!.seq, head: prev, entries: entries.length, revisions } });
  delete batch.items;
  s.workspace.audit.push({ id: uuid(), at, actorId: u.userId, actor: u.displayName, role: m.role, action: 'disposalApply', subject: b.id, detail: `Disposal applied: ${describe(counts)}. Prepared by a different owner; plan hash ${b.planHash}. Disposal register entries ${entries[0].seq}–${entries.at(-1)!.seq}, head ${prev}. Audit events and command receipts are kept unchanged. ${PLACEHOLDER_NOTE}` });
  const rows: Row[] = entries.map(e => ({ table: 'disposals', values: entryRow(e), keys: ['org_id', 'seq'], append: true }));
  const result = { batchId: b.id, state: 'applied', counts, register: { first: entries[0].seq, last: entries.at(-1)!.seq, head: prev, entries: entries.length } };
  await persist(d, before, s, u, c, key, hash, result, rows, false, token => batchEffects(entries).map(x => d.prepare(x.sql + GUARD).bind(...x.binds, orgId, token)));
  return result;
}

export async function registerEntries(d: D1Database, orgId: string): Promise<RegisterEntry[]> {
  const out: RegisterEntry[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = (await d.prepare(`SELECT ${ENTRY_COLUMNS.join(',')} FROM disposals WHERE org_id=? ORDER BY seq LIMIT 1000 OFFSET ?`).bind(orgId, offset).all<RegisterEntry>()).results;
    out.push(...page); if (page.length < 1000) break;
  }
  return out;
}
