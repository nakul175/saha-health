// Access-only audit liveness/fault contract (BR-SEC-08, NFR-10). Synthetic in-memory real migrations.
// Keeps the existing audit-contention-contract unchanged. The first check is the same 24x5 zero-refusal
// oracle under the valid zero-jitter endpoint; this fails on the preserved six-attempt source.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const dir = mkdtempSync(join(process.cwd(), '.audit-access-contention-contract-'));
const started = performance.now();
let passed = 0, seed = 7, sample = null, sampled = 0;
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const roundTrip = () => new Promise(r => setTimeout(r, 1 + Math.floor(rand() * 3)));
const random = Math.random;
Math.random = function backoffOnlySample() {
  if (sample !== null && /at (?:Module\.)?(?:accessChainBackoffMs|chainBackoffMs) \(.*\/.audit-access-contention-contract-[^/]+\/audit-chain\.js:\d+:\d+\)/.test(new Error().stack ?? '')) { sampled++; return sample; }
  return random();
};
const withSample = async (value, fn) => { sample = value; try { return await fn(); } finally { sample = null; } };
class Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.db = d1.db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d1, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { await roundTrip(); return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { await roundTrip(); return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { await roundTrip(); return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; this.failedBatches = 0; this.beforeBatch = null; this.lastFailure = null; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    await roundTrip(); this.batches++;
    if (this.beforeBatch) await this.beforeBatch();
    this.db.exec('BEGIN');
    try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); this.failedBatches++; this.lastFailure = e; throw e; }
  }
}
let d1;
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const store = await load('store'), access = await load('access-audit'), chain = await load('audit-chain'), { seedWorkspace } = await load('seed');
  d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-10-04T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const sql = (q, ...args) => d1.db.prepare(q).all(...args);
  const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  const make = async id => {
    const w = seedWorkspace(now); for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; }
    await store.createState(d1, { organisation: { id, name: 'Synthetic ' + id, revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [member], invitations: [], workspace: w }, actor, 'createOrganisation');
    const pid = w.people[0].id, state = await store.readState(d1, id, [pid]); store.scope(state, 'owner');
    return { id, pid, state, count: () => sql('SELECT count(*) AS n FROM audit_events WHERE org_id=?', id)[0].n };
  };
  const write = (f, detail) => access.recordAccess(d1, f.state, actor, store.scope(f.state, 'owner'), { action: 'viewRecordHistory', subject: f.pid, personId: f.pid, detail });
  const verify = async f => {
    const rows = sql('SELECT seq,prev_hash,hash FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq', f.id);
    rows.forEach((r, i) => { assert.equal(r.seq, i); if (i) assert.equal(r.prev_hash, rows[i - 1].hash); });
    assert.equal((await chain.verifyChain(d1, f.id)).status, 'intact'); return rows.length;
  };
  const snapshot = f => ({ org: sql('SELECT revision,patient_revision FROM organisations WHERE id=?', f.id)[0], patients: sql('SELECT id,rev FROM patients WHERE org_id=? ORDER BY id', f.id), receipts: sql('SELECT * FROM command_receipts WHERE org_id=? ORDER BY actor_id,key', f.id) });
  const f = await make('org_access_zero'), initial = snapshot(f), before = f.count();
  let refused = 0;
  await withSample(0, async () => {
    for (let b = 0; b < 5; b++) { const results = await Promise.allSettled(Array.from({ length: 24 }, (_, i) => write(f, `Synthetic access-zero ${b}-${i}.`))); refused += results.filter(r => r.status === 'rejected').length; }
  });
  const adverse = { readers: 24, bursts: 5, requested: 120, refused, recorded: f.count() - before, raceLosses: d1.failedBatches, actualSequenceError: d1.lastFailure && { message: d1.lastFailure.message, errcode: d1.lastFailure.errcode }, chainRows: await verify(f), sampledBackoffs: sampled, elapsedMs: performance.now() - started };
  console.log('ACCESS_ZERO_OBSERVATION ' + JSON.stringify(adverse));
  await check('24 readers x5 at valid zero endpoint: every audited read succeeds', () => { assert.equal(refused, 0, `${refused} of 120 reads refused`); assert.equal(adverse.recorded, 120); assert.ok(adverse.raceLosses > 0); assert.ok(adverse.sampledBackoffs > 0); });
  await check('each intended access exists exactly once with intact chain', async () => { for (let b = 0; b < 5; b++) for (let i = 0; i < 24; i++) assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND detail LIKE ?', f.id, `Synthetic access-zero ${b}-${i}.%`)[0].n, 1); await verify(f); });
  await check('access retries do not move revisions, mutate patients or create receipts', () => assert.deepEqual(snapshot(f), initial));
  await check('access sleep budget570ms and shared clinical policy6/320 remain bounded', async () => {
    assert.equal(chain.ACCESS_CHAIN_ATTEMPTS, 24); assert.equal(chain.ACCESS_CHAIN_BACKOFF_MAX_MS, 25);
    assert.equal(store.CHAIN_ATTEMPTS, 6); assert.equal(chain.CHAIN_BACKOFF_MAX_MS, 320);
    const accessMax = await withSample(1 - Number.EPSILON, async () => Array.from({ length: 23 }, (_, i) => chain.accessChainBackoffMs(i + 1)));
    assert.deepEqual(accessMax, [20, ...Array(22).fill(25)]); assert.equal(accessMax.reduce((a, b) => a + b, 0), 570);
    const sharedMax = await withSample(1 - Number.EPSILON, async () => Array.from({ length: 5 }, (_, i) => chain.chainBackoffMs(i + 1)));
    assert.deepEqual(sharedMax, [20, 40, 80, 160, 320]); assert.equal(sharedMax.reduce((a, b) => a + b, 0), 620);
  });
  await check('only exact tested sequence-unique faults qualify; unknown, id, trigger and cycles do not', () => {
    const sqlite = Object.assign(new Error('UNIQUE constraint failed: audit_events.org_id, audit_events.seq'), { code: 'ERR_SQLITE_ERROR', errcode: 2067 });
    const native = new Error('D1_ERROR: UNIQUE constraint failed: audit_events.org_id, audit_events.seq: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)');
    assert.equal(chain.isAuditSequenceConflict(sqlite), true); assert.equal(chain.isAuditSequenceConflict(native), true);
    assert.equal(chain.isAuditSequenceConflict(new Error('D1_ERROR', { cause: sqlite })), true);
    const rejects = [new Error('race'), new Error('SQLITE_CONSTRAINT'), new Error(sqlite.message), new Error('UNIQUE constraint failed: audit_events.org_id, audit_events.seq: SQLITE_CONSTRAINT'), new Error('D1_ERROR: UNIQUE constraint failed: audit_events.org_id, audit_events.seq'), new Error('UNIQUE constraint failed: audit_events.org_id, audit_events.id'), new Error('UNIQUE constraint failed: audit_events.org_id, audit_events.seq, audit_events.id'), new Error('prefix UNIQUE constraint failed: audit_events.org_id, audit_events.seq'), Object.assign(new Error(sqlite.message), { errcode: 1811 }), { message: sqlite.message }];
    const cyclic = new Error('unknown'); cyclic.cause = cyclic; rejects.push(cyclic);
    for (const e of rejects) assert.equal(chain.isAuditSequenceConflict(e), false);
  });
  const compete = async (g, detail) => { const saved = d1.beforeBatch; d1.beforeBatch = null; try { await write(g, detail); } finally { d1.beforeBatch = saved; } };
  await check('generic database fault fails closed after one batch with unchanged head', async () => {
    const g = await make('org_access_generic'), prior = g.count(); let calls = 0;
    d1.beforeBatch = () => { calls++; throw new Error('synthetic disk failure'); };
    try { await assert.rejects(write(g, 'Synthetic forbidden generic.'), e => e.status === 503); } finally { d1.beforeBatch = null; }
    assert.equal(calls, 1); assert.equal(g.count(), prior); await verify(g);
  });
  await check('generic database fault is never retried even after a valid competing commit', async () => {
    const g = await make('org_access_generic_moved'), prior = g.count(); let calls = 0;
    d1.beforeBatch = async () => { calls++; await compete(g, 'Synthetic competing generic.'); throw new Error('synthetic disk failure'); };
    try { await assert.rejects(write(g, 'Synthetic forbidden moved generic.'), e => e.status === 503); } finally { d1.beforeBatch = null; }
    assert.equal(calls, 1); assert.equal(g.count(), prior + 1); assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND detail LIKE ?', g.id, 'Synthetic forbidden moved generic.%')[0].n, 0); await verify(g);
  });
  await check('trigger lookalike is never retried even when the chain moved', async () => {
    const g = await make('org_access_trigger'), prior = g.count(); let calls = 0;
    d1.db.exec(`CREATE TRIGGER audit_access_lookalike BEFORE INSERT ON audit_events WHEN NEW.org_id='${g.id}' AND NEW.detail LIKE 'Synthetic forbidden trigger.%' BEGIN SELECT RAISE(ABORT,'UNIQUE constraint failed: audit_events.org_id, audit_events.seq'); END;`);
    d1.beforeBatch = async () => { calls++; await compete(g, 'Synthetic competing trigger.'); };
    try { await assert.rejects(write(g, 'Synthetic forbidden trigger.'), e => e.status === 503); } finally { d1.beforeBatch = null; d1.db.exec('DROP TRIGGER audit_access_lookalike'); }
    assert.equal(calls, 1); assert.equal(g.count(), prior + 1); assert.equal(d1.lastFailure.errcode, 1811); await verify(g);
  });
  await check('unsupported bare and generic constraint messages stop after one moved-head fault', async () => {
    const messages = ['UNIQUE constraint failed: audit_events.org_id, audit_events.seq', 'UNIQUE constraint failed: audit_events.org_id, audit_events.seq: SQLITE_CONSTRAINT'];
    for (const [i, message] of messages.entries()) {
      const g = await make(`org_access_unknown_${i}`), prior = g.count(); let calls = 0;
      d1.beforeBatch = async () => { calls++; await compete(g, 'Synthetic competing unknown.'); throw new Error(message); };
      try { await assert.rejects(write(g, 'Synthetic forbidden unknown.'), e => e.status === 503); } finally { d1.beforeBatch = null; }
      assert.equal(calls, 1); assert.equal(g.count(), prior + 1); assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND detail LIKE ?', g.id, 'Synthetic forbidden unknown.%')[0].n, 0); await verify(g);
    }
  });
  await check('persistent genuine sequence collisions stop at24 and append no rejected access', async () => {
    const g = await make('org_access_persistent'), prior = g.count(); let calls = 0;
    d1.beforeBatch = async () => { calls++; await compete(g, `Synthetic competing persistent ${calls}.`); };
    try { await withSample(0, () => assert.rejects(write(g, 'Synthetic forbidden persistent.'), e => e.status === 503)); } finally { d1.beforeBatch = null; }
    assert.equal(calls, 24); assert.equal(g.count(), prior + 24); assert.equal(sql('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND detail LIKE ?', g.id, 'Synthetic forbidden persistent.%')[0].n, 0); assert.equal(d1.lastFailure.errcode, 2067); await verify(g);
  });
  const mutation = g => { const after = structuredClone(g.state); after.organisation.name = 'Synthetic changed'; after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: actor.displayName, actorId: actor.userId, role: 'clinician', action: 'syntheticMutation', subject: g.id, detail: 'Synthetic clinical control.' }); return after; };
  await check('ordinary clinical staleCAS fails without retry or any dependent write', async () => {
    const g = await make('org_clinical_stale'), after = mutation(g), prior = g.count(), batches = d1.batches;
    d1.db.prepare('UPDATE organisations SET revision=revision+1 WHERE id=?').run(g.id); const current = snapshot(g);
    await assert.rejects(store.persist(d1, g.state, after, actor, { type: 'syntheticMutation' }, 'synthetic-stale-key', 'hash', null), e => e.status === 409);
    assert.equal(d1.batches - batches, 1); assert.equal(g.count(), prior); assert.deepEqual(snapshot(g), current); assert.equal(sql('SELECT name FROM organisations WHERE id=?', g.id)[0].name, 'Synthetic ' + g.id); await verify(g);
  });
  await check('ordinary clinical sequence collisions still stop at shared6 attempts', async () => {
    const g = await make('org_clinical_collision'), after = mutation(g), prior = g.count(); let calls = 0;
    d1.beforeBatch = async () => { calls++; await compete(g, `Synthetic competing clinical ${calls}.`); };
    try { await withSample(0, () => assert.rejects(store.persist(d1, g.state, after, actor, { type: 'syntheticMutation' }, 'synthetic-clinical-key', 'hash', null), e => e.status === 409)); } finally { d1.beforeBatch = null; }
    assert.equal(calls, 6); assert.equal(g.count(), prior + 6); assert.equal(sql('SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND key=?', g.id, 'synthetic-clinical-key')[0].n, 0); assert.equal(sql('SELECT name FROM organisations WHERE id=?', g.id)[0].name, 'Synthetic ' + g.id); await verify(g);
  });
  const result = { passed, suite: 'audit-access-contention-contract', adverse, sampledBackoffs: sampled, elapsedMs: performance.now() - started, completedAt: new Date().toISOString(), scope: 'Synthetic in-memory; no hosted capacity, human acceptance or current-authority revalidation claim' };
  writeFileSync('tests/audit-access-contention-contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { Math.random = random; d1?.db.close(); rmSync(dir, { recursive: true, force: true }); }
