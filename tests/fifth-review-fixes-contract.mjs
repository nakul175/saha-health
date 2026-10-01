// Slice 6w fifth-review-fixes contract: regressions for defects a fifth independent review found in round-1 slices
// 0b-4, 4e, 6s and 6t (reproductions in /tmp/claude-0/review5/*.mjs, 1 October 2026 UTC). Each numbered block fails on
// the code before 6w; run it from an export of the base tree with REPORT_ALL=1 to list every failing check.
//  1. Differencing compares numerators, denominators and denominator minus numerator, not only people.
//  2. The differencing ledger is pruned by time only; a full ledger refuses new releases instead of evicting.
//  3. Definition filters (sex, age band, programme) are nesting dimensions: complementary definitions are compared.
//  4. An indicator view moves no revision and writes no command receipt; GET does not run queries; the CSV export
//     is an access-audit event; commands that save the operations row keep the stored ledger.
//  5. The programme migration dry run shows a clinician counts within their scope and only their own batches.
//  6. Data exit leaves the differencing ledger out; the verifier rejects an archive that carries it.
//  7. Paged workspace window records not opened through the detail route are audited before they are returned.
//  8. A checkpoint can be issued past the full-verification limit by verifying from an anchor.
//  9. A work-list cursor carries the view's total; a changed list restarts at the first page.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const sha = b => createHash('sha256').update(b).digest('hex');

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.fifth-review-fixes-contract-'));
let passed = 0;
const failed = [];
const fail = (name, e) => { if (process.env.REPORT_ALL) { failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); return; } e.message = `${name}: ${e.message}`; throw e; };
const check = (name, fn) => { try { fn(); passed++; } catch (e) { fail(name, e); } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { fail(name, e); } };

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

try {
  // Every library module is transpiled; `server` (the Next.js runtime) is replaced by a stub over the test database.
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    if (f !== 'server.ts') writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'server.js'), `import { readState, scope } from './store.js';
export const harness = { d1: null, user: null, orgId: null };
export async function identity() { return harness.user; }
export async function loadFor(u) { const s = await readState(harness.d1, harness.orgId); scope(s, u.userId); return s; }
export function db() { return harness.d1; }
export function rawRuntime() { return {}; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const I = await load('indicators'), D = await load('indicator-differencing'), { harness } = await load('server');
  const now = new Date(), iso = now.toISOString();
  // Releases built as the server builds them (hashing left out: equality is what the check uses).
  const releasesOf = (q, run, viewer = 'viewer') => run.series.map(sr => ({ isCohort: sr.key === 'cohort', ids: sr.ids, release: { v: viewer, at: iso, k: 'series:' + sr.key, f: { ...Object.fromEntries(['team', 'village', 'programme'].filter(k => q[k]).map(k => [k, k + ':' + q[k]])), ...Object.fromEntries(Object.entries(sr.f ?? {}).map(([k, v]) => [k, k + ':' + v])) }, c: sr.cells, ...(sr.m ? { m: sr.m } : {}) } }));
  const screen = (ledger, cands) => D.screenReleases ? D.screenReleases(ledger, cands, 5, iso) : { accepted: cands.filter(c => c.isCohort || D.differencingRisk(ledger, c.release, 5, iso) === null), refused: cands.filter(c => !c.isCohort && D.differencingRisk(ledger, c.release, 5, iso) !== null) };
  const record = (s, m, ledger, q) => { const run = I.indicatorRun(s, m, q, now), cands = releasesOf(q, run), { accepted, refused } = screen(ledger, cands);
    if (refused.some(c => c.isCohort)) return { ledger, refused: 'cohort' };
    const withheld = new Set(refused.flatMap(c => c.ids)), released = new Set(accepted.flatMap(c => c.ids).filter(id => !withheld.has(id)));
    return { ledger: D.pruneLedger([...ledger, ...accepted.map(c => c.release)], iso), out: run.result.results.map(r => released.has(r.id + '@' + r.version) || r.refused ? r : { ...r, rows: [], refused: 'differencing' }) }; };
  const person = (i, over = {}) => ({ id: 'p' + String(i).padStart(2, '0'), name: 'Synthetic ' + i, age: 30, sex: i % 2 ? 'Female' : 'Male', village: 'V', programmes: ['Maternal care'], teamId: 't1', assignedTo: null, assigned: true, version: 1, createdAt: iso, followUps: [], enrolments: [], ...over });
  const sup = { userId: 'sup', status: 'active', role: 'supervisor', isOwner: false, teamIds: ['t1'] };

  // 1. Numerators: 30 people (20 in V), 6 provisional identities (5 in V). All villages then V would reveal 1 outside V.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, { village: i < 20 ? 'V' : 'W', ...(i < 5 || i === 25 ? { identityReview: { state: 'provisional' } } : {}) }));
    const s = { organisation: { id: 'o' }, teams: [{ id: 't1', name: 'T1' }], members: [], workspace: { people, visits: [], submissions: [], referrals: [], audit: [] } };
    const a = record(s, sup, [], { ids: ['identity-provisional'], days: 30, group: 'none' });
    const b = record(s, sup, a.ledger, { ids: ['identity-provisional'], days: 30, group: 'none', village: 'V' });
    check('1 the parent count is released', () => assert.equal(a.out[0].rows[0].value, 6));
    check('1 the child whose numerator differs by 1 is withheld', () => { assert.equal(b.out[0].refused, 'differencing'); assert.deepEqual(b.out[0].rows, []); });
    check('1 a numerator remainder of 1 is a risk on its own', () => { const r = (f, c, m) => ({ v: 'x', at: iso, k: 'k', f, c, m }); assert.equal(D.differencingRisk([r({}, { All: 30 }, { All: [6, 0] })], r({ village: 'V' }, { All: 20 }, { All: [5, 0] }), 5, iso), 1); });
    check('1 denominator minus numerator is compared too', () => { const r = (f, c, m) => ({ v: 'x', at: iso, k: 'k', f, c, m }); assert.equal(D.differencingRisk([r({}, { All: 30 }, { All: [20, 30] })], r({ village: 'V' }, { All: 20 }, { All: [18, 20] }), 5, iso), 2); });
  }

  // 2. Eviction: parent released, 250 unrelated queries, then the child that differs from the parent by 3 people.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, { village: i < 27 ? 'V' : 'W' }));
    const s = { organisation: { id: 'o' }, teams: [{ id: 't1', name: 'T1' }], members: [], workspace: { people, visits: [], submissions: [], referrals: [], audit: [] } };
    let L = record(s, sup, [], { ids: ['visits-confirmed'], days: 30, group: 'none' }).ledger;
    for (let i = 0; i < 250; i++) L = record(s, sup, L, { ids: ['visits-confirmed'], days: 30, group: 'none', team: 't1' }).ledger;
    const child = record(s, sup, L, { ids: ['visits-confirmed'], days: 30, group: 'none', village: 'V' });
    check('2 the protecting parent is still in the ledger after 250 queries', () => assert.ok(L.some(r => r.k === 'series:cohort' && !r.f.village && !r.f.team)));
    check('2 the child is still refused', () => assert.equal(child.refused ?? child.out[0].refused, 'cohort'));
    check('2 nothing inside the window is dropped for space', () => { const many = Array.from({ length: 900 }, (_, i) => ({ v: 'x', at: iso, k: 'k', f: { village: String(i) }, c: { All: 5 } })); assert.equal(D.pruneLedger(many, iso).length, 900); });
    check('2 a viewer at the bound is refused new releases', () => { assert.equal(typeof D.ledgerFull, 'function'); const many = Array.from({ length: D.VIEWER_LEDGER_LIMIT }, (_, i) => ({ v: 'x', at: iso, k: 'k', f: { village: String(i) }, c: { All: 5 } })); assert.equal(D.ledgerFull(many, [{ v: 'x', at: iso, k: 'k', f: { village: 'new' }, c: { All: 5 } }], iso), true); assert.equal(D.ledgerFull(many, [{ v: 'y', at: iso, k: 'k', f: {}, c: { All: 5 } }], iso), false, 'another viewer is not affected'); });
  }

  // 3. Complementary definitions: people, female, male (22 = 10 + 10 + 2 "Other") in one query.
  {
    const sexes = [...Array(10).fill('Female'), ...Array(10).fill('Male'), 'Other', 'Other'];
    const people = sexes.map((sex, i) => person(i, { sex }));
    const spec = f => ({ title: 'People ' + JSON.stringify(f), unit: 'count', numerator: 'patients', denominator: null, filters: f, exclude: [], exclusionsNote: '', owner: 'Owner', cadence: 'Monthly', minimumCohort: 5 });
    const rec = (id, f) => ({ id, version: 1, status: 'active', spec: spec(f), reason: 'synthetic test', by: 'o', byName: 'O', at: iso });
    const s = { organisation: { id: 'o' }, teams: [{ id: 't1', name: 'T1' }], members: [], operations: { indicatorDefinitions: [rec('people-all', {}), rec('people-f', { sex: 'Female' }), rec('people-m', { sex: 'Male' })] }, workspace: { people, visits: [], submissions: [], referrals: [], audit: [] } };
    const one = record(s, sup, [], { ids: ['people-all', 'people-f', 'people-m'], days: 30, group: 'none' });
    check('3 one of the complementary definitions is withheld in a single query', () => { const shown = one.out.filter(r => !r.refused).map(r => r.id); assert.deepEqual(shown, ['people-all', 'people-f']); });
    const first = record(s, sup, [], { ids: ['people-all', 'people-f'], days: 30, group: 'none' }), second = record(s, sup, first.ledger, { ids: ['people-m'], days: 30, group: 'none' });
    check('3 and across queries', () => assert.equal(second.out[0].refused, 'differencing'));
    check('3 definition filters travel as dimensions, not in the series key', () => { const run = I.indicatorRun(s, sup, { ids: ['people-f'], days: 30, group: 'none' }, now); const sr = run.series.find(x => x.key !== 'cohort'); assert.deepEqual(sr.f, { sex: 'Female' }); assert.ok(!sr.key.includes('Female')); });
  }

  // Server-level checks run over the real migrations in an in-memory database.
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const store = await load('store'), access = await load('access-audit'), chain = await load('audit-chain');
  const { seedWorkspace } = await load('seed');
  const at = '2026-10-01T00:00:00.000Z', A = 'org_fifth_review';
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  for (const [id, name] of [['owner', 'Synthetic owner'], ['clin', 'Synthetic clinician']]) d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(id, (id.toUpperCase() + '0'.repeat(24)).slice(0, 24), name, `${id}@example.invalid`, at);
  const owner = { userId: 'owner', accountCode: 'OWNER0000000000000000000', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: at };
  const clin = { userId: 'clin', accountCode: 'CLIN00000000000000000000', displayName: 'Synthetic clinician', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: at };
  const w = seedWorkspace(at);
  for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; p.enrolments = []; p.followUps = []; }
  const episode = id => ({ id, packId: 'maternal', packVersion: 1, state: 'active', episodeLabel: 'Synthetic episode label', startDate: null, createdAt: at, createdBy: 'owner', registration: 'not_submitted' });
  w.people.forEach((p, i) => p.enrolments.push(episode('e_' + p.id)));
  w.people[0].teamId = 'north';
  const ownerActor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' }, clinActor = { userId: 'clin', displayName: 'Synthetic clinician', email: 'clin@example.invalid' };
  await store.createState(d1, { organisation: { id: A, name: 'Fifth review organisation', revision: 1, createdAt: at }, teams: [{ id: 'default', name: 'Care team', createdAt: at }, { id: 'north', name: 'North team', createdAt: at }], members: [owner, clin], invitations: [], workspace: w }, ownerActor, 'createOrganisation');
  harness.d1 = d1; harness.orgId = A;
  const org = () => sql('SELECT revision,patient_revision FROM organisations WHERE id=?', A)[0];
  const receipts = () => sql('SELECT count(*) AS n FROM command_receipts WHERE org_id=?', A)[0].n;

  // 4. Indicator views and the ledger.
  {
    const IS = await load('indicators-server');
    harness.user = ownerActor;
    const post = body => IS.indicatorsPost(new Request('http://saha.test/api/indicators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const before = { org: org(), receipts: receipts() };
    const r = await post({ ids: 'visits-confirmed', days: 30, group: 'none' });
    await checkAsync('4 the query is answered', async () => assert.equal(r.status, 200));
    check('4 the view moves no revision and writes no command receipt', () => { assert.deepEqual(org(), before.org); assert.equal(receipts(), before.receipts); });
    check('4 the ledger is recorded in the operations row', () => { const data = JSON.parse(sql('SELECT data FROM operations WHERE org_id=?', A)[0].data); assert.ok(data.indicatorReleases.length >= 2); });
    const csv = await post({ ids: 'visits-confirmed', days: 30, group: 'none', format: 'csv' });
    check('4 the CSV export is an access-audit event, still without a revision change or receipt', () => { assert.equal(csv.status, 200); const e = sql("SELECT action,person_id FROM audit_events WHERE org_id=? AND action='indicatorExport'", A); assert.equal(e.length, 1); assert.deepEqual(org(), before.org); assert.equal(receipts(), before.receipts); });
    await checkAsync('4 GET does not run a query', async () => { let status = 200; try { const g = await IS.indicatorsRead(new Request('http://saha.test/api/indicators?ids=visits-confirmed&days=30&group=none')); status = g.status; } catch (e) { status = e.status; } assert.equal(status, 405); });
    await checkAsync('4 a command that saves the operations row keeps the stored ledger', async () => {
      const stored = JSON.parse(sql('SELECT data FROM operations WHERE org_id=?', A)[0].data).indicatorReleases;
      d1.db.prepare('UPDATE organisations SET last_command=? WHERE id=?').run('tok', A);
      await d1.batch(store.guarded(d1, A, 'tok', [{ table: 'operations', values: { org_id: A, data: JSON.stringify({ version: 7, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }) }, keys: ['org_id'], append: false }]));
      const after = JSON.parse(sql('SELECT data FROM operations WHERE org_id=?', A)[0].data);
      assert.equal(after.version, 7); assert.deepEqual(after.indicatorReleases, stored);
    });
  }

  // 5. Programme migration dry run for a clinician (owner sees organisation-wide counts).
  {
    const PM = await load('programme-migration-server');
    const read = async user => { harness.user = user; return (await PM.programmeMigrationRead(new Request('http://saha.test/api/programme-migration'))).json(); };
    const own = await read(ownerActor);
    check('5 the owner sees the out-of-scope count', () => { const p = own.plans.find(x => x.packId === 'maternal'); assert.equal(p.outOfScope, 1); });
    // A batch applied by the owner is in the history; the clinician must not see it or organisation-wide counts.
    const s = await store.readState(d1, A); s.operations = { ...(s.operations ?? {}), programmeMigrations: [{ id: 'b1', packId: 'maternal', fromVersions: [1], toVersion: 2, planHash: 'x', at, by: 'owner', reason: 'Synthetic', examined: 7, migrated: 6, blocked: 0, outOfScope: 1, adopted: true, previousAdopted: 1 }] };
    d1.db.prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO UPDATE SET data=excluded.data').run(A, JSON.stringify(s.operations));
    const mine = await read(clinActor);
    check('5 a clinician sees no out-of-scope count', () => { const p = mine.plans.find(x => x.packId === 'maternal'); assert.equal(p.outOfScope, null); assert.equal(p.examined, p.candidates.length + p.blocked.length); });
    check('5 a clinician sees only batches they applied', () => assert.deepEqual(mine.batches, []));
  }

  // 6. Data exit leaves the ledger out; the verifier rejects an archive carrying it.
  {
    const exit = await load('data-exit'), { readTar, verifyFiles } = await import(pathToFileURL(join(process.cwd(), 'scripts/verify-export.mjs')));
    d1.db.prepare("UPDATE operations SET data=json_set(data,'$.indicatorReleases',json(?)) WHERE org_id=?").run(JSON.stringify([{ v: 'abc', at, k: 'k', f: {}, c: { g: 3 } }]), A);
    const built = await exit.buildExport(d1, { orgId: A, member: owner, exporter: { userId: 'owner', name: 'Synthetic owner', accountCode: owner.accountCode }, exportId: 'export-fifth', now: '2026-10-01T06:00:00.000Z', includeFhir: false, environment: 'synthetic' });
    const files = readTar(Buffer.from(built.archive)), ops = String(files.get('tables/operations.jsonl') ?? '');
    check('6 the operations row is exported without the ledger', () => { assert.ok(ops.length > 0); assert.ok(!ops.includes('indicatorReleases')); });
    check('6 the verifier names the protection-state check', () => { const r = verifyFiles(files); assert.ok(r.checks.some(c => c.name === 'protection-state' && c.ok)); });
    check('6 an archive carrying the ledger fails the verifier', () => {
      const lines = ops.trim().split('\n').map(l => JSON.parse(l)); lines[0].data = JSON.stringify({ ...JSON.parse(lines[0].data), indicatorReleases: [{ v: 'abc' }] });
      // Resealed (manifest entry and SHA256SUMS rebuilt), as a forger with the archive alone could.
      const forged = new Map(files); forged.set('tables/operations.jsonl', Buffer.from(lines.map(l => JSON.stringify(l) + '\n').join('')));
      const manifest = JSON.parse(forged.get('manifest.json').toString('utf8')), f = manifest.files.find(x => x.path === 'tables/operations.jsonl');
      f.bytes = forged.get(f.path).length; f.sha256 = sha(forged.get(f.path)); forged.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
      forged.set('SHA256SUMS', Buffer.from([...forged.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(forged.get(p))}  ${p}`).join('\n') + '\n'));
      const r = verifyFiles(forged); assert.ok(r.checks.some(c => c.name === 'protection-state' && !c.ok));
    });
  }

  // 7. Window records not opened through the detail route are audited before they are returned.
  {
    const s = await store.readState(d1, A); store.scope(s, 'clin');
    const pid = w.people[1].id, events = () => sql("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id='clin' AND action='viewPatientRecord' AND person_id=?", A, pid)[0].n;
    await checkAsync('7 a window id not opened before is recorded as a record view', async () => { assert.equal(typeof access.auditWindow, 'function'); const kept = await access.auditWindow(d1, s, clinActor, store.scope(s, 'clin'), [pid]); assert.deepEqual(kept, [pid]); assert.equal(events(), 1); });
    await checkAsync('7 a window id opened in the period is not recorded again', async () => { await access.auditWindow(d1, s, clinActor, store.scope(s, 'clin'), [pid]); assert.equal(events(), 1); });
    await checkAsync('7 if the event cannot be written, the unrecorded id is left out of the window', async () => {
      const other = w.people[2].id;
      d1.db.exec("CREATE TRIGGER fifth_fail BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'injected audit failure'); END");
      const kept = await access.auditWindow(d1, s, clinActor, store.scope(s, 'clin'), [pid, other]);
      d1.db.exec('DROP TRIGGER fifth_fail');
      assert.deepEqual(kept, [pid]);
    });
  }

  // 8. A checkpoint past the full-verification limit is verified from an anchor.
  {
    const full = await chain.verifyChain(d1, A);
    const small = await chain.verifyChain(d1, A, 2);
    check('8 a limited verification is incomplete', () => assert.equal(small.status, 'incomplete'));
    await checkAsync('8 verification from an anchor reaches the head', async () => { const anchor = { seq: small.head.seq, hash: small.head.hash }; const v = await chain.verifyChain(d1, A, undefined, undefined, anchor); assert.equal(v.status, 'intact'); assert.deepEqual(v.head, full.head); assert.deepEqual(v.fromAnchor, anchor); });
    await checkAsync('8 a wrong anchor hash is a break', async () => { const v = await chain.verifyChain(d1, A, undefined, undefined, { seq: small.head.seq, hash: '0'.repeat(64) }); assert.equal(v.status, 'broken'); });
    await checkAsync('8 no recorded checkpoint gives no anchor', async () => { assert.equal(typeof chain.lastRecordedCheckpoint, 'function'); assert.equal(await chain.lastRecordedCheckpoint(d1, A), null); });
  }

  // 9. Work-list cursor stability.
  {
    const WL = await load('worklists');
    const people = Array.from({ length: 6 }, (_, i) => ({ id: 'q' + i, name: 'S' + i, age: 30, sex: 'Female', village: 'V', programmes: [], task: '', due: '2026-10-0' + (i + 1), status: 'due', merged: false }));
    const url = q => new URL('http://saha.test/api/worklists?view=work&limit=2' + (q ? '&' + q : ''));
    const first = WL.worklistPage({ people, submissions: [], referrals: [] }, WL.worklistQuery(url()));
    check('9 the cursor carries the total', () => assert.equal(first.nextCursor, 'n:2:6'));
    const changed = WL.worklistPage({ people: people.slice(1), submissions: [], referrals: [] }, WL.worklistQuery(url('cursor=' + encodeURIComponent(first.nextCursor))));
    check('9 a changed list restarts at the first page', () => { assert.equal(changed.restarted, true); assert.deepEqual(changed.rows.map(r => r.id), WL.worklistPage({ people: people.slice(1), submissions: [], referrals: [] }, WL.worklistQuery(url())).rows.map(r => r.id)); });
    const same = WL.worklistPage({ people, submissions: [], referrals: [] }, WL.worklistQuery(url('cursor=' + encodeURIComponent(first.nextCursor))));
    check('9 an unchanged list continues', () => { assert.equal(same.restarted, undefined); assert.equal(same.rows.length, 2); assert.ok(!first.rows.some(r => same.rows.some(x => x.id === r.id))); });
  }

  if (failed.length) { console.log(JSON.stringify({ failed }, null, 1)); process.exitCode = 1; }
  const result = { suite: 'fifth review fixes contract (slice 6w)', passed, failed: failed.length, completedAt: new Date().toISOString() };
  writeFileSync('tests/fifth-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
