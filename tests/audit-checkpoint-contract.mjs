// Slice r06 contract: signed audit-chain checkpoints (HMAC-SHA256 over the compact head summary) and the
// scheduled chain verification that recomputes the chain from a stored anchor and records the result in the
// organisation record. Runs the real modules over the real migrations in an in-memory database. No network.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const lib = 'lib/saha', dir = mkdtempSync(join(process.cwd(), '.audit-checkpoint-contract-'));
let passed = 0;
const check = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

// The scheduled job calls no external service: any outbound fetch fails the suite.
let fetches = 0;
globalThis.fetch = () => { fetches++; throw new Error('The scheduled job must never call an external service.'); };

try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts') && f !== 'server.ts'))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  // `server` (the Next.js runtime) is replaced by a stub: the job takes the database binding as an argument.
  writeFileSync(join(dir, 'server.js'), `export async function identity() { throw new Error('not used'); }
export async function activeOrg() { throw new Error('not used'); }
export function db() { throw new Error('not used'); }
export async function loadFor() { throw new Error('not used'); }
export function rawRuntime() { return {}; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const chain = await load('audit-chain'), J = await load('scheduled-job'), store = await load('store');

  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const created = '2026-10-03T06:00:00.000Z';
  const env = { SAHA_ENVIRONMENT: 'synthetic' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', created);
  const actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: created };

  const makeOrg = async (id, operations) => {
    const s = { organisation: { id, name: 'Synthetic ' + id, revision: 1, createdAt: created }, teams: [{ id: 'default', name: 'Care team', createdAt: created }], members: [member], invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [], visits: [], submissions: [], referrals: [], integrations: [], receipts: {}, audit: [] }, ...(operations ? { operations } : {}) };
    await store.createState(d1, s, actor, 'createOrganisation');
    return id;
  };
  const chained = orgId => sql('SELECT * FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq', orgId);
  // Simulates someone with raw database access: the append-only triggers are dropped for one edit.
  const tamper = (q, ...a) => { d1.db.exec('DROP TRIGGER audit_events_no_update; DROP TRIGGER audit_events_no_delete;'); try { d1.db.prepare(q).run(...a); } finally { d1.db.exec("CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END; CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;"); } };

  // ---- 1. Signed checkpoint (pure, no database) ----
  const secret = 'correct-horse-battery-staple';
  const point = { organisationId: 'org_sign', seq: 7, hash: 'a'.repeat(64), at: created, issuedAt: '2026-10-03T06:01:00.000Z' };
  const signed = await chain.signCheckpoint(point, secret);
  check('1 the signature is a 64-hex HMAC over the compact summary', () => {
    assert.match(signed.signature, /^[0-9a-f]{64}$/);
    assert.equal(signed.keyId, chain.SIGNED_CHECKPOINT_KEY_ID);
    assert.equal(signed.organisationId, 'org_sign'); assert.equal(signed.seq, 7); assert.equal(signed.hash, 'a'.repeat(64)); assert.equal(signed.at, created);
  });
  await checkAsync('1 the signature verifies with the correct key', async () => assert.equal(await chain.verifyCheckpointSignature(signed, secret), true));
  await checkAsync('1 a wrong key fails', async () => assert.equal(await chain.verifyCheckpointSignature(signed, 'wrong-key'), false));
  await checkAsync('1 any tampered field fails to verify', async () => {
    const changes = { organisationId: 'org_other', seq: 8, hash: 'b'.repeat(64), at: '2026-10-03T06:00:01.000Z', issuedAt: '2026-10-03T06:01:01.000Z' };
    for (const [field, value] of Object.entries(changes)) assert.equal(await chain.verifyCheckpointSignature({ ...signed, [field]: value }, secret), false, field);
  });
  check('1 the signed content covers the summary only, never the signature or key id', () => {
    const c = chain.signedCheckpointContent(point);
    assert.ok(!c.includes('signature')); assert.ok(!c.includes(chain.SIGNED_CHECKPOINT_KEY_ID));
    assert.equal(c, chain.signedCheckpointContent({ ...point }), 'deterministic');
  });

  // ---- 2. planScheduledVerification (pure) ----
  const V = (status, seq, extra = {}) => ({ chainVersion: 'saha-audit-chain-v1', status, events: seq + 1, priorEvents: 0, head: status === 'not-started' ? null : { seq, hash: 'h'.repeat(64), at: created }, genesisAt: created, firstBreak: null, clockRegressions: { count: 0, largestMs: 0, firstSeq: null }, checkedAt: created, ...extra });
  const prev = (over = {}) => ({ version: '1.0.0', verifiedFrom: null, anchor: { seq: 5, hash: 'h'.repeat(64) }, verifiedAt: '2026-10-03T06:05:00.000Z', status: 'intact', events: 6, priorEvents: 0, head: { seq: 5, hash: 'h'.repeat(64), at: created }, firstBreak: null, recordedBecause: 'first', ...over });
  check('2 the first run records with the head as the stored anchor', () => {
    const { record, recordNow } = chain.planScheduledVerification(undefined, V('intact', 5), '2026-10-03T06:05:00.000Z', 3600000);
    assert.equal(recordNow, true); assert.equal(record.recordedBecause, 'first'); assert.equal(record.verifiedFrom, null);
    assert.deepEqual(record.anchor, { seq: 5, hash: 'h'.repeat(64) });
  });
  check('2 a first break is recorded immediately', () => {
    const { record, recordNow } = chain.planScheduledVerification(prev(), V('broken', 6, { firstBreak: { seq: 6, id: 'x', reason: 'content altered' } }), '2026-10-03T06:06:00.000Z', 3600000);
    assert.equal(recordNow, true); assert.equal(record.recordedBecause, 'break'); assert.equal(record.status, 'broken');
    assert.deepEqual(record.verifiedFrom, { seq: 5, hash: 'h'.repeat(64) });
  });
  check('2 a status change is recorded as changed', () => {
    const { record, recordNow } = chain.planScheduledVerification(prev(), V('incomplete', 6), '2026-10-03T06:06:00.000Z', 3600000);
    assert.equal(recordNow, true); assert.equal(record.recordedBecause, 'changed'); assert.equal(record.status, 'incomplete');
  });
  check('2 a steady intact state is not recorded within the heartbeat', () => {
    const { recordNow } = chain.planScheduledVerification(prev(), V('intact', 5), '2026-10-03T06:10:00.000Z', 3600000);
    assert.equal(recordNow, false);
  });
  check('2 the heartbeat records again after the interval', () => {
    const { record, recordNow } = chain.planScheduledVerification(prev(), V('intact', 5), '2026-10-03T07:06:00.000Z', 3600000);
    assert.equal(recordNow, true); assert.equal(record.recordedBecause, 'heartbeat');
  });

  // ---- 3. The scheduled step verifies from the stored anchor and records the result ----
  const A = await makeOrg('org_chain_r06');
  const run1 = await J.runScheduled(d1, env, '2026-10-03T06:05:00.000Z', { organisations: 1 });
  const o1 = run1.organisations.find(o => o.organisationId === A);
  await checkAsync('3 the first run verifies intact and records the anchor', async () => {
    assert.ok(o1.chain.verified); assert.equal(o1.chain.status, 'intact'); assert.equal(o1.chain.recorded, true);
    const s = await store.readState(d1, A);
    assert.equal(s.operations.auditChain.status, 'intact'); assert.equal(s.operations.auditChain.recordedBecause, 'first');
    assert.equal(s.operations.auditChain.version, '1.0.0');
    assert.deepEqual(s.operations.auditChain.anchor, { seq: s.operations.auditChain.head.seq, hash: s.operations.auditChain.head.hash });
    assert.equal(s.operations.auditChain.verifiedFrom, null);
    assert.equal(sql("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='auditChainScheduledVerification'", A)[0].n, 1);
    assert.ok(chained(A).at(-1).detail.includes('Audit chain scheduled verification: intact'));
  });
  await checkAsync('3 a steady state is verified again but not recorded within the hour', async () => {
    const rev = sql('SELECT revision FROM organisations WHERE id=?', A)[0].revision;
    const run2 = await J.runScheduled(d1, env, '2026-10-03T06:10:00.000Z', { organisations: 1 });
    const o2 = run2.organisations.find(o => o.organisationId === A);
    assert.equal(o2.chain.verified, true); assert.equal(o2.chain.status, 'intact'); assert.equal(o2.chain.recorded, false);
    assert.equal(sql('SELECT revision FROM organisations WHERE id=?', A)[0].revision, rev);
    assert.equal(sql("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='auditChainScheduledVerification'", A)[0].n, 1);
  });
  await checkAsync('3 a tampered suffix is detected and recorded as broken', async () => {
    const last = chained(A).at(-1);
    tamper('UPDATE audit_events SET detail=? WHERE org_id=? AND id=?', 'Rewritten outside the application', A, last.id);
    const run3 = await J.runScheduled(d1, env, '2026-10-03T06:11:00.000Z', { organisations: 1 });
    const o3 = run3.organisations.find(o => o.organisationId === A);
    assert.equal(o3.chain.status, 'broken');
    const s = await store.readState(d1, A);
    assert.equal(s.operations.auditChain.status, 'broken'); assert.equal(s.operations.auditChain.recordedBecause, 'break');
    assert.ok(s.operations.auditChain.firstBreak); assert.equal(s.operations.auditChain.firstBreak.id, last.id);
    assert.equal(sql("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='auditChainScheduledVerification'", A)[0].n, 2);
  });
  await checkAsync('3 the verification records no event content', async () => {
    const s = await store.readState(d1, A);
    assert.equal(JSON.stringify(s.operations.auditChain).includes('Rewritten'), false, 'the record carries no event detail');
  });
  check('3 the job called no external service', () => assert.equal(fetches, 0));

  const result = { suite: 'audit checkpoint signing + scheduled verification contract (slice r06)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/audit-checkpoint-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
