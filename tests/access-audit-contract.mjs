// Slice 6t access audit contract: material reads and external requests are chained audit events written
// through `persist` as append-only access commits; when the audit store cannot be written (fault injected
// with a SQLite trigger), reads, commands, exports and external requests do not proceed. Runs the real
// migrations in an in-memory SQLite database through the minimal D1 shim of the storage contract.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.access-audit-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, test) => { await assert.rejects(fn, test); passed++; };

class Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.db = d1.db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d1, this.sql, args); }
  exec() { this.d1.statements++; const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { this.d1.statements++; return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { this.d1.statements++; return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; this.statements = 0; this.beforeBatch = null; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    if (this.beforeBatch) { const f = this.beforeBatch; this.beforeBatch = null; await f(); }
    this.batches++; this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}

try {
  for (const f of ['store', 'partition', 'access', 'adapter-operations','core', 'fact-provenance', 'mis', 'programmes', 'seed', 'types', 'audit-chain', 'access-audit', 'export-audit'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const access = await import(pathToFileURL(join(dir, 'access-audit.js')));
  const exportAudit = await import(pathToFileURL(join(dir, 'export-audit.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-10-01T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const count = (table, orgId) => sql(`SELECT count(*) AS n FROM ${table} WHERE org_id=?`, orgId)[0].n;
  const org = orgId => sql('SELECT revision,patient_revision FROM organisations WHERE id=?', orgId)[0];
  const A = 'org_access_a', w = seedWorkspace(now);
  for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; }
  w.visits = w.people.slice(0, 2).map((p, i) => ({ id: `${A}-visit-${i}`, personId: p.id, version: 1, state: 'draft', facts: { date: '2026-09-30T08:00', systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic note SECRET-NOTE', source: 'measured' }, createdAt: now, aiResults: [], recordVersion: 1 }));
  const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  await store.createState(d1, { organisation: { id: A, name: 'Access audit contract organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'other', name: 'Other team', createdAt: now }], members: [member], invitations: [], workspace: w }, actor, 'createOrganisation');
  const load = async ids => { const s = await store.readState(d1, A, ids); store.scope(s, 'owner'); return s; };
  const pid = w.people[0].id, other = w.people[1].id;
  const read = (s, extra = {}) => access.recordAccess(d1, s, actor, store.scope(s, 'owner'), { action: 'viewRecordHistory', subject: pid, personId: pid, detail: 'Revision history read: 2 revisions.', ...extra });
  const save = (s, weight) => { const after = structuredClone(s); const v = after.workspace.visits.find(x => x.id === `${A}-visit-0`); v.facts = { ...v.facts, weight }; v.version++; after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'saveVisit', subject: v.id, personId: pid, detail: `Weight ${weight}` }); return after; };
  const commit = (before, after, type = 'saveVisit') => store.persist(d1, before, after, actor, { type }, crypto.randomUUID(), 'hash', { ok: true });

  // 1. The action list is one list (server and Activity log filter agree).
  check(() => assert.deepEqual(Object.keys(access.ACCESS_ACTIONS).sort(), [...access.ACCESS_ACTION_NAMES].sort()));

  // 2. One read appends exactly one chained event: no receipt, no record rows, no revision change.
  let s = await load([pid]);
  const before = { audit: count('audit_events', A), receipts: count('command_receipts', A), revisions: count('record_revisions', A), org: org(A), patient: sql('SELECT rev,version FROM patients WHERE org_id=? AND id=?', A, pid)[0] };
  d1.batches = 0; d1.statements = 0;
  const ev = await read(s);
  const cost = { batches: d1.batches, statements: d1.statements };
  const row = sql('SELECT * FROM audit_events WHERE org_id=? AND id=?', A, ev.id)[0];
  check(() => { assert.equal(count('audit_events', A), before.audit + 1); assert.equal(count('command_receipts', A), before.receipts); assert.equal(count('record_revisions', A), before.revisions); });
  check(() => { assert.deepEqual(org(A), before.org, 'organisation and patient revisions unchanged'); assert.deepEqual(sql('SELECT rev,version FROM patients WHERE org_id=? AND id=?', A, pid)[0], before.patient); });
  check(() => { assert.equal(row.action, 'viewRecordHistory'); assert.equal(row.person_id, pid); assert.equal(row.actor_id, 'owner'); assert.ok(Number.isInteger(row.seq) && row.seq > 0); assert.match(row.hash, /^[0-9a-f]{64}$/); });
  check(() => assert.equal(JSON.stringify(row).includes('SECRET-NOTE'), false, 'no clinical content in the event'));
  // Cost: the chain head read plus one batch of two statements (the token update and the insert).
  check(() => { assert.equal(cost.batches, 1); assert.ok(cost.statements <= 3, JSON.stringify(cost)); });
  let v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.head.hash, row.hash); });

  // 3. A read never makes a teammate's command conflict: a command loaded before the read still commits.
  const full = await load(), part = await load([pid]);
  await read(s); await read(s, { action: 'viewMedia', subject: 'media-1', detail: 'Visit media opened.' });
  await commit(full, save(full, '61'));
  check(() => assert.equal(JSON.parse(sql('SELECT data FROM visits WHERE org_id=? AND id=?', A, `${A}-visit-0`)[0].data).facts.weight, '61', 'organisation-wide command loaded before two reads committed'));
  const part2 = await load([pid]); await read(part2); await commit(part2, save(part2, '62'));
  check(() => assert.equal(JSON.parse(sql('SELECT data FROM visits WHERE org_id=? AND id=?', A, `${A}-visit-0`)[0].data).facts.weight, '62', 'patient-scoped command loaded before a read committed'));
  void part;

  // 4. A read that loses the chain race is rebuilt on the new head (no fork, both kept).
  s = await load([other]);
  d1.beforeBatch = async () => { const x = await load([pid]); await commit(x, save(x, '63')); };
  const raced = await read(s, { subject: other, personId: other });
  v = await chain.verifyChain(d1, A);
  const tail = sql('SELECT action,id FROM audit_events WHERE org_id=? AND seq IS NOT NULL ORDER BY seq DESC LIMIT 2', A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(tail[0].id, raced.id); assert.equal(tail[1].action, 'saveVisit'); });

  // 5. An access commit carries audit events only; anything else is refused before any write.
  s = await load([pid]);
  const smuggle = structuredClone(s); smuggle.workspace.people.find(p => p.id === pid).village = 'Smuggled';
  smuggle.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'x', actorId: 'owner', role: 'clinician', action: 'viewRecordHistory', subject: pid, personId: pid, detail: 'x' });
  const batches0 = d1.batches;
  await rejects(() => store.persist(d1, s, smuggle, actor, { type: chain.ACCESS_AUDIT }, 'k', '', null), /only append audit events/);
  check(() => { assert.equal(d1.batches, batches0); assert.notEqual(JSON.parse(sql('SELECT data FROM patients WHERE org_id=? AND id=?', A, pid)[0].data).village, 'Smuggled'); });

  // 6. Emergency access is named in the event detail; normal access adds nothing.
  const outsider = { ...member, userId: 'clin-2', isOwner: false, teamIds: ['other'] }, target = structuredClone(w.people[0]);
  target.exceptionalAccess = [{ id: 'grant-1', userId: 'clin-2', from: now, until: '2099-01-01T00:00:00.000Z', reason: 'Synthetic emergency reason long enough.' }];
  check(() => { assert.match(access.accessRoute(outsider, target, now), /emergency access grant grant-1/); assert.equal(access.accessRoute(member, target, now), ''); });

  // 7. Fault injection: the audit store refuses every insert for this organisation.
  const fault = () => d1.db.exec(`CREATE TRIGGER audit_fault BEFORE INSERT ON audit_events WHEN NEW.org_id='${A}' BEGIN SELECT RAISE(ABORT, 'Synthetic audit store failure'); END;`);
  const heal = () => d1.db.exec('DROP TRIGGER audit_fault;');
  const status503 = message => e => { assert.equal(e.status, 503); assert.equal(e.message, message); return true; };
  fault();
  try {
    const snapshot = { audit: count('audit_events', A), receipts: count('command_receipts', A), revisions: count('record_revisions', A), org: org(A), visit: sql('SELECT data FROM visits WHERE org_id=? AND id=?', A, `${A}-visit-0`)[0].data };
    // a. A material read is refused with a clear message (the caller never returns the content).
    s = await load([pid]);
    await rejects(() => read(s), status503(access.ACCESS_REFUSED));
    // b. A privileged or clinical change is not committed without its audit event (the whole batch rolls back).
    s = await load([pid]);
    await rejects(() => commit(s, save(s, '99')), /Synthetic audit store failure/);
    const f = await load(); const team = structuredClone(f); team.teams.push({ id: 'team-x', name: 'X', createdAt: now }); team.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'createTeam', subject: 'team-x', detail: 'Team created' });
    await rejects(() => commit(f, team, 'createTeam'), /Synthetic audit store failure/);
    // c. An export whose audit event cannot be written is refused with a clear message (not delivered).
    s = await load();
    await rejects(() => exportAudit.recordExportAudit(d1, { state: s, reload: () => load(), authorize: x => store.scope(x, 'owner'), event: m => ({ id: 'export-1', at: now, actorId: 'owner', actor: 'Synthetic owner', role: m.role, action: 'organisationExport', subject: A, detail: 'Export x' }), actor, type: 'organisationExport', key: 'export_1', hash: 'h' }), status503(exportAudit.EXPORT_REFUSED));
    // d. An external request whose audit event cannot be written is never sent (the server's order: audit, then send).
    let sent = 0; const send = async () => { await read(await load([pid]), { action: 'externalRequest', detail: 'runAI: request to synthetic provider about to be sent.' }); sent++; };
    await rejects(send, status503(access.ACCESS_REFUSED));
    check(() => assert.equal(sent, 0));
    check(() => { assert.equal(count('audit_events', A), snapshot.audit); assert.equal(count('command_receipts', A), snapshot.receipts); assert.equal(count('record_revisions', A), snapshot.revisions); assert.deepEqual(org(A), snapshot.org); assert.equal(sql('SELECT data FROM visits WHERE org_id=? AND id=?', A, `${A}-visit-0`)[0].data, snapshot.visit); assert.equal(sql("SELECT count(*) AS n FROM teams WHERE org_id=? AND id='team-x'", A)[0].n, 0); });
  } finally { heal(); }
  // e. Once the store recovers, reads and commands work again and the chain is intact.
  s = await load([pid]); await read(s); s = await load([pid]); await commit(s, save(s, '64'));
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.firstBreak, null); });

  // 8. Every material read and external request records its event before the content or the request leaves.
  const src = f => readFileSync(f, 'utf8');
  const before_ = (text, a, b, label) => { const i = text.indexOf(a), j = text.indexOf(b, i); assert.ok(i >= 0, `${label}: ${a} missing`); assert.ok(j > i, `${label}: ${b} must follow ${a}`); };
  check(() => { const t = src('lib/saha/patient-directory-server.ts'); before_(t.slice(t.indexOf('export async function patientDetailRead')), "action: 'viewPatientRecord'", 'return json(', 'patient detail'); });
  check(() => { const t = src('lib/saha/server.ts'); before_(t.slice(t.indexOf('export async function patientHistory')), "action:'viewRecordHistory'", 'return {', 'history'); });
  check(() => { const t = src('lib/saha/media-server.ts'); before_(t.slice(t.indexOf('export async function mediaFile')), "action:'viewMedia'", 'return new Response(', 'media'); });
  check(() => { const t = src('lib/saha/abdm-server.ts'); before_(t, "action:'viewExternalRecords'", 'return json(view)', 'ABDM received records'); });
  check(() => { const t = src('app/api/fhir/[id]/route.ts'); before_(t, "action:'downloadFhir'", 'return new Response(', 'FHIR download'); });
  check(() => { const t = src('lib/saha/server.ts'); before_(t.slice(t.indexOf('export async function externalCall')), 'if(beforeSend)await beforeSend();', 'fetch(i.endpoint', 'external AI request'); assert.match(t, /externalCall\(i,p,key,\(\)=>externalRequestAudit\(state,u,m,c,i\)\)/); });
  check(() => { const t = src('lib/saha/ehr-execution.ts'), r = t.slice(t.indexOf("if(c.type==='retrieveEhrDocument')")); before_(r, "action:'externalRequest'", 'await transport(', 'EHR retrieval'); });

  // 9. Measured cost on a read (in-memory SQLite, so a lower bound for D1): average milliseconds per audited read.
  s = await load([pid]); const t0 = performance.now(), N = 200;
  for (let i = 0; i < N; i++) await read(s);
  const perRead = (performance.now() - t0) / N;
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.ok(perRead < 50, `average ${perRead} ms`); });

  // 10. Chain-head checkpoint for external anchoring: the digest recomputes offline; a checkpoint keeps matching as
  // the chain grows; a suffix rewritten with recomputed hashes still verifies intact but no longer matches.
  const { createHash } = await import('node:crypto'), sha = t => createHash('sha256').update(t).digest('hex');
  const head = (await chain.verifyChain(d1, A)).head, point = { organisationId: A, seq: head.seq, hash: head.hash, at: head.at, issuedAt: now };
  check(() => assert.equal(chain.CHECKPOINT_FORMAT, 'saha-audit-checkpoint-v1'));
  const digestOk = (await chain.checkpointDigest(point)) === sha(JSON.stringify(['saha-audit-checkpoint-v1', A, head.seq, head.hash, head.at, now]));
  check(() => assert.ok(digestOk, 'checkpoint digest recomputes offline'));
  check(() => { assert.deepEqual(chain.parseCheckpointRef(`${head.seq}:${head.hash}`), { seq: head.seq, hash: head.hash }); assert.equal(chain.parseCheckpointRef('12:abc'), null); assert.equal(chain.parseCheckpointRef(`x:${head.hash}`), null); });
  s = await load([pid]); await read(s); await read(s);
  let cp = await chain.checkCheckpoint(d1, A, head.seq, head.hash);
  check(() => assert.equal(cp.result, 'matches', 'still matches after later events'));
  const beyond = await chain.checkCheckpoint(d1, A, head.seq + 1000, head.hash), wrong = await chain.checkCheckpoint(d1, A, head.seq, 'f'.repeat(64));
  check(() => { assert.equal(beyond.result, 'not-reached'); assert.equal(wrong.result, 'differs'); });
  // Someone with database access rewrites the checkpointed event and every later hash consistently.
  d1.db.exec('DROP TRIGGER audit_events_no_update; DROP TRIGGER audit_events_no_delete;');
  try {
    const rows = sql('SELECT * FROM audit_events WHERE org_id=? AND seq IS NOT NULL AND seq>=? ORDER BY seq', A, head.seq);
    let prev = rows[0].prev_hash;
    for (const r of rows) { const e = r.seq === head.seq ? { ...r, detail: r.detail + ' (rewritten)' } : r; const content = await chain.contentDigest(e); const hash = await chain.linkHash(r.seq, prev, content); d1.db.prepare('UPDATE audit_events SET detail=?,prev_hash=?,hash=? WHERE org_id=? AND id=?').run(e.detail, prev, hash, A, r.id); prev = hash; }
  } finally { d1.db.exec("CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END; CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;"); }
  v = await chain.verifyChain(d1, A); cp = await chain.checkCheckpoint(d1, A, head.seq, head.hash);
  check(() => { assert.equal(v.status, 'intact', 'a consistently rewritten suffix verifies intact on its own'); assert.equal(cp.result, 'differs', 'the external checkpoint detects it'); });

  const result = { suite: 'access audit contract (slice 6t)', passed, readCost: { batches: cost.batches, statements: cost.statements, rowsWritten: 1, averageMsInMemory: Number(perRead.toFixed(3)), reads: N }, completedAt: new Date().toISOString() };
  writeFileSync('tests/access-audit-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
