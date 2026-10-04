// Slice 13e (round-11 O-1): audited reads under contention. Every material read first appends a chained audit event; when
// several commits race for the same chain head, all but one fail on the chain's unique sequence and are rebuilt on the new
// head, up to CHAIN_ATTEMPTS times. The retries were immediate, so a burst of readers on one organisation retried in lockstep
// and a read could exhaust its attempts and be refused (503, nothing shown). The retries now wait a short random time that
// grows with each attempt (`chainBackoff`).
// Model: the real migrations in an in-memory SQLite database behind a D1 shim that adds 1-3 ms to every round trip, so
// concurrent requests interleave as they would against a remote database; 24 readers at once on one organisation, five times.
// Checked: every read is recorded exactly once, the chain stays intact (consecutive sequence, each event linked to the one
// before), and the backoff is bounded and grows with the attempt. Not a measurement of hosted D1.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.audit-contention-contract-'));
let passed = 0;
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
let seed = 7; const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const roundTrip = () => new Promise(r => setTimeout(r, 1 + Math.floor(rand() * 3)));
class Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.db = d1.db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d1, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { await roundTrip(); return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { await roundTrip(); return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { await roundTrip(); return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; this.failedBatches = 0; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    await roundTrip(); this.batches++; this.db.exec('BEGIN');
    try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); this.failedBatches++; throw e; }
  }
}
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const store = await import(pathToFileURL(join(dir, 'store.js'))), access = await import(pathToFileURL(join(dir, 'access-audit.js'))), chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-10-04T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const A = 'org_contention', w = seedWorkspace(now);
  for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; }
  const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  await store.createState(d1, { organisation: { id: A, name: 'Contention contract organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [member], invitations: [], workspace: w }, actor, 'createOrganisation');
  const pid = w.people[0].id, READERS = 24, BURSTS = 5;

  await check('the backoff is bounded, starts small and grows with the attempt', async () => {
    assert.equal(typeof chain.chainBackoffMs, 'function');
    for (let attempt = 1; attempt < store.CHAIN_ATTEMPTS; attempt++) {
      const xs = Array.from({ length: 200 }, () => chain.chainBackoffMs(attempt));
      assert.ok(xs.every(x => Number.isInteger(x) && x >= 0 && x <= chain.CHAIN_BACKOFF_MAX_MS), 'within bounds');
      assert.ok(Math.max(...xs) <= Math.min(chain.CHAIN_BACKOFF_MAX_MS, 10 * 2 ** attempt), 'grows with the attempt');
    }
    const total = Array.from({ length: store.CHAIN_ATTEMPTS - 1 }, (_, i) => Math.min(chain.CHAIN_BACKOFF_MAX_MS, 10 * 2 ** (i + 1))).reduce((a, b) => a + b, 0);
    assert.ok(total <= 1000, `the longest total wait before giving up is ${total} ms`);
  });
  let refused = 0, recorded = 0;
  for (let b = 0; b < BURSTS; b++) {
    const s = await store.readState(d1, A, [pid]); store.scope(s, 'owner');
    const before = sql('SELECT count(*) AS n FROM audit_events WHERE org_id=?', A)[0].n;
    const results = await Promise.allSettled(Array.from({ length: READERS }, (_, i) => access.recordAccess(d1, s, actor, store.scope(s, 'owner'), { action: 'viewRecordHistory', subject: pid, personId: pid, detail: `Synthetic contended read ${b}-${i}.` })));
    refused += results.filter(r => r.status === 'rejected').length;
    recorded += sql('SELECT count(*) AS n FROM audit_events WHERE org_id=?', A)[0].n - before;
  }
  await check(`${READERS} readers at once, ${BURSTS} times: every read is recorded and none is refused`, () => {
    assert.equal(refused, 0, `${refused} of ${READERS * BURSTS} reads refused`);
    assert.equal(recorded, READERS * BURSTS);
    assert.ok(d1.failedBatches > 0, 'the readers did race for the chain head');
  });
  await check('the chain stays intact: consecutive sequence, each event linked to the one before', async () => {
    const rows = sql('SELECT seq,prev_hash,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq', A);
    rows.forEach((r, i) => { assert.equal(r.seq, i); if (i) assert.equal(r.prev_hash, rows[i - 1].hash); });
    const v = await chain.verifyChain(d1, A); assert.equal(v.status, 'intact');
  });

  writeFileSync('tests/audit-contention-contract-result.json', JSON.stringify({ passed, suite: 'audit-contention-contract', readers: READERS, bursts: BURSTS, raceLosses: d1.failedBatches, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'audit-contention-contract', raceLosses: d1.failedBatches }));
} finally { rmSync(dir, { recursive: true, force: true }); }
