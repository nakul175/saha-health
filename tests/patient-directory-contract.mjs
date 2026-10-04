// Slice 0b-3 patient-directory contract: the paged, searchable list returns exactly the patients the
// full read plus access.ts shows for every viewer (emergency grants included), in name order across pages;
// the paging decision, windowed read, request parsing and client merge behave as documented.
// Real migrations, in-memory SQLite, D1 shim (as tests/scoped-read-contract.mjs).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.patient-directory-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };

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
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'delta', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'patient-directory', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const pd = await import(pathToFileURL(join(dir, 'patient-directory.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const access = await import(pathToFileURL(join(dir, 'access.js')));
  const { mergeDelta } = await import(pathToFileURL(join(dir, 'delta.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = new Date().toISOString(), soon = new Date(Date.now() + 3600000).toISOString(), past = new Date(Date.now() - 3600000).toISOString();
  const users = [['owner', 'clinician', ['A'], true], ['asha', 'asha', ['A'], false], ['asha2', 'asha', ['A', 'B'], false], ['sup', 'supervisor', ['B'], false], ['docB', 'clinician', ['B'], false], ['docA', 'clinician', ['A'], false], ['admin', 'admin', [], false], ['gone', 'clinician', ['A'], false], ['supAll', 'supervisor', ['A', 'B'], false]];
  users.forEach(([u], i) => d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(u, `CODE${String(i).padStart(20, '0')}`, u.toUpperCase(), `${u}@example.invalid`, now));
  const members = users.map(([userId, role, teamIds, isOwner], i) => ({ userId, accountCode: `CODE${String(i).padStart(20, '0')}`, displayName: userId.toUpperCase(), role, isOwner, status: userId === 'gone' ? 'suspended' : 'active', version: 1, teamIds, createdAt: now }));
  const base = { age: 30, sex: 'Unknown', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  // Names deliberately out of id order, with duplicates, so ordering by (name, id) is exercised.
  const names = ['Mira', 'Anil', 'Zoya', 'Anil', 'Kavya', 'Bela', 'Dev', 'Esha', 'Anil', 'Farah', 'Gita', 'Hari', 'Ira', 'Jai'];
  const people = names.map((name, i) => ({ ...base, id: `p${String(i).padStart(2, '0')}`, name, village: `Village ${i % 3}`, programmes: [i % 2 ? 'Chronic care' : 'Maternal care'], teamId: i < 8 ? 'A' : 'B', assignedTo: i < 2 ? 'asha' : i === 2 ? 'asha2' : i === 9 ? 'asha2' : i < 8 ? 'owner' : null }));
  people[10].exceptionalAccess = [{ id: 'g1', userId: 'docA', reason: 'x', from: past, until: soon }];
  people[11].exceptionalAccess = [{ id: 'g2', userId: 'docA', reason: 'x', from: past, until: past }, { id: 'g3', userId: 'docA', reason: 'x', from: past, until: soon, closedAt: now }];
  people[12].exceptionalAccess = [{ id: 'g4', userId: 'asha', reason: 'x', from: past, until: soon }];
  const state = { organisation: { id: 'org1', name: 'Directory contract', revision: 1, createdAt: now }, teams: [{ id: 'A', name: 'A', createdAt: now }, { id: 'B', name: 'B', createdAt: now }], members, invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people, visits: [], integrations: [], submissions: [], referrals: [], receipts: {}, audit: [] } };
  await store.createState(d1, state, { userId: 'owner', displayName: 'OWNER', email: 'owner@example.invalid' }, 'seed');
  const ordered = xs => [...xs].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(p => p.id);
  const walk = async (m, extra = {}, limit = 3) => { const out = []; let cursor = null, pages = 0, total; do { const page = await pd.patientPage(d1, 'org1', m, { q: '', programme: '', limit, cursor, ...extra }, now); if (pages === 0) total = page.total; else assert.equal(page.total, null); out.push(...page.rows); cursor = page.nextCursor ? pd.pageQuery(new URL(`https://saha.invalid/api/patients?cursor=${encodeURIComponent(page.nextCursor)}`)).cursor : null; pages++; } while (cursor && pages < 50); return { ids: out.map(r => r.id), rows: out, total, pages }; };

  // Parity with access.ts for every viewer, across pages of three, in (name, id) order.
  for (const m of members) {
    const expected = ordered(people.filter(p => access.allowed(m, p, now)));
    const got = await walk(m);
    check(() => { assert.deepEqual(got.ids, expected, m.userId); assert.equal(got.total, m.status === 'active' ? expected.length : got.total, m.userId); });
  }
  const docA = members.find(m => m.userId === 'docA'), sup = members.find(m => m.userId === 'sup'), supAll = members.find(m => m.userId === 'supAll'), asha = members.find(m => m.userId === 'asha'), owner = members.find(m => m.userId === 'owner');
  check(() => assert.deepEqual((people.filter(p => access.allowed(docA, p, now))).map(p => p.id).sort(), ['p00', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p10']));
  // Emergency-access rows are flagged; owner authority adds nothing outside the owner's team.
  const docRows = await walk(docA);
  check(() => { assert.deepEqual(docRows.rows.filter(r => r.exceptional).map(r => r.id), ['p10']); assert.equal(docRows.rows.find(r => r.id === 'p10').teamId, 'B'); });
  const ownerRows = await walk(owner);
  check(() => assert.ok(ownerRows.ids.every(id => people.find(p => p.id === id).teamId === 'A')));
  // Search and programme filter stay inside scope.
  const anil = await walk(supAll, { q: 'anil' });
  check(() => assert.deepEqual(anil.ids, ['p01', 'p03', 'p08']));
  const anilSup = await walk(sup, { q: 'anil' });
  check(() => assert.deepEqual(anilSup.ids, ['p08']));
  const byVillage = await walk(supAll, { q: 'village 2' });
  check(() => assert.deepEqual(byVillage.ids.sort(), people.filter(p => p.village === 'Village 2').map(p => p.id).sort()));
  const byId = await walk(docA, { q: 'p10' });
  check(() => assert.deepEqual(byId.ids, ['p10']));
  const chronicB = await walk(sup, { programme: 'Chronic care' });
  check(() => assert.deepEqual(chronicB.ids, ordered(people.filter(p => p.teamId === 'B' && p.programmes.includes('Chronic care')))));
  const none = await walk(asha, { q: 'zoya' });
  check(() => { assert.deepEqual(none.ids, []); assert.equal(none.total, 0); });

  // Paging decision: at or below the threshold nobody is paged.
  for (const u of ['owner', 'supAll', 'docA', 'asha', 'admin']) { const w = await pd.pagedWindow(d1, 'org1', u, ['p00']); check(() => assert.equal(w, null, u)); }
  // Add 500 synthetic people to team A: team-A viewers above the threshold are paged, ASHAs never.
  const ins = d1.db.prepare('INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data,rev) VALUES (?,?,?,?,?,?,?,0)');
  d1.db.exec('BEGIN'); for (let i = 0; i < 500; i++) { const p = { ...base, id: `f${String(i).padStart(3, '0')}`, name: `Filler ${i}`, village: 'Filler', teamId: 'A', assignedTo: i < 5 ? 'asha' : null }; ins.run('org1', p.id, 1, p.name, 'A', p.assignedTo, JSON.stringify(p)); } d1.db.exec('COMMIT');
  const wDoc = await pd.pagedWindow(d1, 'org1', 'docA', ['p00', 'p10', 'p11', 'p08', 'nope']);
  check(() => { assert.equal(wDoc.total, 509); assert.deepEqual([...wDoc.ids].sort(), ['p00', 'p10']); });
  const wOwner = await pd.pagedWindow(d1, 'org1', 'owner', []);
  check(() => assert.deepEqual(wOwner, { ids: [], total: 508 }));
  const wAll = await pd.pagedWindow(d1, 'org1', 'supAll', ['p13']);
  check(() => assert.deepEqual(wAll, { ids: ['p13'], total: 514 }));
  for (const u of ['asha', 'asha2', 'sup', 'docB', 'admin', 'gone']) { const w = await pd.pagedWindow(d1, 'org1', u, ['p00']); check(() => assert.equal(w, null, u)); }
  const bigWalk = await walk(docA, {}, 100);
  check(() => { assert.equal(bigWalk.ids.length, 509); assert.equal(bigWalk.total, 509); assert.equal(bigWalk.pages, 6); assert.equal(new Set(bigWalk.ids).size, 509); });

  // Windowed read: exactly the named patients (or none), read-only, not a command partition.
  const win = await store.readState(d1, 'org1', ['p00', 'p10'], 'docA', true);
  check(() => { assert.deepEqual(win.workspace.people.map(p => p.id), ['p00', 'p10']); assert.equal(win.readOnlyFor, 'docA'); assert.equal(win.partition, undefined); assert.equal(win.teams.length, 2); });
  const empty = await store.readState(d1, 'org1', [], 'docA', true);
  check(() => { assert.equal(empty.workspace.people.length, 0); assert.equal(empty.readOnlyFor, 'docA'); });
  const plain = await store.readState(d1, 'org1', [], undefined);
  check(() => { assert.equal(plain.workspace.people.length, 514); assert.equal(plain.readOnlyFor, undefined); });
  await assert.rejects(() => store.persist(d1, empty, empty, { userId: 'docA', displayName: 'DOCA', email: 'x' }, { type: 'noop' }, 'k', 'h', {}), /viewer-scoped read cannot be persisted/); passed++;

  // Request parsing.
  const req = h => new Request('https://saha.invalid/api/workspace', { headers: h });
  check(() => assert.equal(pd.pagingRequest(req({})), null));
  check(() => assert.deepEqual(pd.pagingRequest(req({ 'x-saha-patients': 'paged' })), { window: [] }));
  check(() => assert.deepEqual(pd.pagingRequest(req({ 'x-saha-patients': 'paged', 'x-saha-patient-window': 'a, b,a,,c' })), { window: ['a', 'b', 'c'] }));
  check(() => assert.equal(pd.pagingRequest(req({ 'x-saha-patient-window': 'a' })), null));
  status(() => pd.pagingRequest(req({ 'x-saha-patients': 'paged', 'x-saha-patient-window': Array.from({ length: 51 }, (_, i) => `p${i}`).join(',') })), 400);
  status(() => pd.pagingRequest(req({ 'x-saha-patients': 'paged', 'x-saha-patient-window': "p1,p2' OR 1=1" })), 400);
  const url = q => new URL(`https://saha.invalid/api/patients${q}`);
  check(() => assert.deepEqual(pd.pageQuery(url('?q=%20Anil%20&limit=500')), { q: 'anil', programme: '', limit: 100, cursor: null }));
  check(() => assert.equal(pd.pageQuery(url('?limit=0')).limit, 50));
  // Slice 6q (second independent review): the pre-6q cursor carried the patient's name; it is now refused, and the
  // opaque cursor carries the patient id only (resolved to its sort position in the viewer's scope on the server).
  status(() => pd.pageQuery(url(`?cursor=${encodeURIComponent(JSON.stringify(['Anil', 'p01']))}`)), 400);
  check(() => assert.equal(pd.pageQuery(url('?cursor=after%3Ap01')).cursor, 'p01'));
  check(() => assert.deepEqual(pd.pageQuery({ q: ' Anil ', cursor: 'after:p01', limit: 500 }), { q: 'anil', programme: '', limit: 100, cursor: 'p01' }, 'a POST body is read the same way'));
  status(() => pd.pageQuery({ q: ['Anil'] }), 400);
  status(() => pd.pageQuery(url('?cursor=%5B1%2C2%5D')), 400);
  status(() => pd.pageQuery(url('?cursor=nope')), 400);
  status(() => pd.pageQuery(url(`?q=${'x'.repeat(81)}`)), 400);
  status(() => pd.patientId('bad id'), 400);

  // Client merge: a paged snapshot keeps its paging and adds merged patients to the window;
  // an unpaged snapshot gains no paging field.
  const snap = (ids, paging) => ({ organisation: { id: 'org1' }, people: ids.map(id => ({ id })), visits: [], submissions: [], referrals: [], ...(paging ? { patientPaging: paging } : {}) });
  const merged = mergeDelta(snap(['p00'], { total: 509, threshold: 500, window: ['p00'] }), snap(['p10']), ['p10']);
  check(() => { assert.deepEqual(merged.people.map(p => p.id), ['p00', 'p10']); assert.deepEqual(merged.patientPaging, { total: 509, threshold: 500, window: ['p00', 'p10'] }); });
  const gone = mergeDelta(merged, snap([]), ['p10']);
  check(() => { assert.deepEqual(gone.people.map(p => p.id), ['p00']); assert.deepEqual(gone.patientPaging.window, ['p00']); });
  check(() => assert.equal(Object.hasOwn(mergeDelta(snap(['p00']), snap(['p01']), ['p01']), 'patientPaging'), false));

  writeFileSync('tests/patient-directory-contract-result.json', JSON.stringify({ suite: 'patient directory contract (slice 0b-3)', passed, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
