// Slice 0b-2 scoped-read contract: a viewer-scoped workspace read selects in SQL exactly the patients,
// visits, plans, results, submissions and referrals that the full read plus access.ts would show,
// for every role, including emergency-access grants. Real migrations, in-memory SQLite, D1 shim.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.scoped-read-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); passed++; };

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.batches++; this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

try {
  for (const f of ['store', 'partition', 'access', 'core', 'mis', 'programmes', 'seed', 'types', 'audit-chain'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = new Date().toISOString(), soon = new Date(Date.now() + 3600000).toISOString(), past = new Date(Date.now() - 3600000).toISOString();
  const users = [['owner', 'clinician', ['A'], true], ['asha', 'asha', ['A'], false], ['asha2', 'asha', ['A', 'B'], false], ['sup', 'supervisor', ['B'], false], ['docB', 'clinician', ['B'], false], ['docA', 'clinician', ['A'], false], ['admin', 'admin', [], false], ['gone', 'clinician', ['A'], false], ['supAll', 'supervisor', ['A', 'B'], false]];
  users.forEach(([u], i) => d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(u, `CODE${String(i).padStart(20, '0')}`, u.toUpperCase(), `${u}@example.invalid`, now));
  const members = users.map(([userId, role, teamIds, isOwner], i) => ({ userId, accountCode: `CODE${String(i).padStart(20, '0')}`, displayName: userId.toUpperCase(), role, isOwner, status: userId === 'gone' ? 'suspended' : 'active', version: 1, teamIds, createdAt: now }));
  const base = { age: 30, sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  const people = [];
  for (let i = 0; i < 12; i++) people.push({ ...base, id: `p${String(i).padStart(2, '0')}`, name: `Person ${i}`, teamId: i < 7 ? 'A' : 'B', assignedTo: i < 2 ? 'asha' : i === 2 ? 'asha2' : i === 8 ? 'asha2' : i < 7 ? 'owner' : null });
  // Emergency access on B patients: current for docA, expired for docA, closed for docA, current for an ASHA (never valid).
  people[9].exceptionalAccess = [{ id: 'g1', userId: 'docA', reason: 'x', from: past, until: soon }];
  people[10].exceptionalAccess = [{ id: 'g2', userId: 'docA', reason: 'x', from: past, until: past }, { id: 'g3', userId: 'docA', reason: 'x', from: past, until: soon, closedAt: now }];
  people[11].exceptionalAccess = [{ id: 'g4', userId: 'asha', reason: 'x', from: past, until: soon }];
  const visit = (i, n) => ({ id: `v${i}-${n}`, personId: people[i].id, version: 1, state: 'confirmed', facts: { date: '2026-09-29T08:00', systolic: '120', diastolic: '80', weight: '', temperature: '', weeks: '', coughDays: '', notes: `Synthetic ${i}-${n}`, source: 'measured' }, createdAt: `2026-09-2${n}T08:00:00.000Z`, aiResults: n ? [{ id: `ai${i}`, providerId: 'ai_summary', providerName: 'x', mode: 'demo', status: 'succeeded', text: 'Synthetic', createdAt: now, inputHash: 'h', reviewed: false }] : [], recordVersion: 1, ...(n ? { plan: { id: `plan${i}`, visitVersion: 1, consentVersion: 1, connectorVersions: {}, recipients: ['mis_maternal'], payloadHash: 'h', state: 'proposed', purpose: 'x', createdAt: now } } : {}) });
  const visits = people.flatMap((_, i) => [visit(i, 0), visit(i, 1)]);
  const submissions = people.filter((_, i) => i % 3 === 0).map(p => ({ id: `s-${p.id}`, visitId: `v${people.indexOf(p)}-0`, personId: p.id, connectorId: 'mis_maternal', connectorName: 'x', state: 'accepted', mode: 'demo', payloadHash: 'h', attempts: 1, message: 'x', createdAt: now, updatedAt: now }));
  const referrals = people.filter((_, i) => i % 4 === 1).map(p => ({ id: `r-${p.id}`, personId: p.id, visitId: `v${people.indexOf(p)}-0`, facility: 'F', reason: 'x', state: 'sent', createdAt: now }));
  const orgId = 'org_scoped_contract';
  const state = { organisation: { id: orgId, name: 'Scoped read contract', revision: 1, createdAt: now }, teams: [{ id: 'A', name: 'A', createdAt: now }, { id: 'B', name: 'B', createdAt: now }], members, invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people, visits, integrations: [], submissions, referrals, receipts: {}, audit: [] } };
  await store.createState(d1, state, { userId: 'owner', displayName: 'OWNER', email: 'owner@example.invalid' }, 'createOrganisation');
  const pick = (s, ids) => ({ people: s.workspace.people.filter(p => ids.has(p.id)), visits: s.workspace.visits.filter(v => ids.has(v.personId)), submissions: s.workspace.submissions.filter(x => ids.has(x.personId)), referrals: s.workspace.referrals.filter(x => ids.has(x.personId)) });
  const expected = { owner: 7, asha: 2, asha2: 2, sup: 5, docB: 5, docA: 8, supAll: 12 };
  for (const [user, count] of Object.entries(expected)) {
    const full = await store.readState(d1, orgId); store.scope(full, user);
    const scoped = await store.readState(d1, orgId, undefined, user); store.scope(scoped, user);
    const ids = new Set(full.workspace.people.filter(p => p.assigned).map(p => p.id));
    check(() => { assert.equal(ids.size, count, user); assert.deepEqual(scoped.workspace.people.map(p => p.id), [...ids].sort(), user); assert.ok(scoped.workspace.people.every(p => p.assigned), user); });
    check(() => assert.deepEqual(pick(scoped, ids), pick(full, ids), user + ' records equal'));
    check(() => { assert.deepEqual(scoped.members, full.members); assert.deepEqual(scoped.teams, full.teams); assert.deepEqual(scoped.organisation, full.organisation); assert.deepEqual(scoped.workspace.integrations, full.workspace.integrations); assert.equal(scoped.readOnlyFor, user); assert.equal(scoped.partition, undefined); });
  }
  const plans = await store.viewerScope(d1, orgId, 'supAll'), ashaPlan = await store.viewerScope(d1, orgId, 'asha'), supPlan = await store.viewerScope(d1, orgId, 'sup'), docPlan = await store.viewerScope(d1, orgId, 'docA');
  check(() => { assert.equal(plans, null, 'a viewer of every team uses the plain read'); assert.match(ashaPlan.sql, /assigned_to/); assert.doesNotMatch(supPlan.sql, /exceptionalAccess/); assert.match(docPlan.sql, /exceptionalAccess/); });
  const adminScoped = await store.readState(d1, orgId, undefined, 'admin');
  check(() => { assert.equal(adminScoped.workspace.people.length, 0); assert.equal(adminScoped.workspace.visits.length, 0); });
  const goneScoped = await store.readState(d1, orgId, undefined, 'gone');
  check(() => assert.equal(goneScoped.workspace.people.length, 0, 'suspended members see nothing'));
  const docA = await store.readState(d1, orgId, undefined, 'docA'), ashaRead = await store.readState(d1, orgId, undefined, 'asha');
  check(() => { assert.ok(docA.workspace.people.some(p => p.id === 'p09'), 'current grant included'); assert.equal(docA.workspace.people.some(p => p.id === 'p10'), false, 'expired and closed grants excluded'); assert.equal(ashaRead.workspace.people.some(p => p.id === 'p11'), false, 'an ASHA grant is never valid'); });
  // A partition read ignores the viewer; a scoped state cannot be persisted.
  const part = await store.readState(d1, orgId, ['p09'], 'asha');
  check(() => { assert.deepEqual(part.partition, ['p09']); assert.equal(part.readOnlyFor, undefined); });
  const sc = await store.readState(d1, orgId, undefined, 'owner');
  await rejects(() => store.persist(d1, sc, structuredClone(sc), { userId: 'owner', displayName: 'OWNER', email: 'x' }, { type: 'renameOrganisation' }, crypto.randomUUID(), 'h', {}), /cannot be persisted/);
  const result = { suite: 'scoped read contract (slice 0b-2)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/scoped-read-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
