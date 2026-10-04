// Slice 14f disposal contract: the disposal plan (dry run) and its two-owner approval, the guarded commit that disposes exactly
// the plan through the real store and migrations (SQLite through the D1 shim of the storage contract), the disposal register
// and its chain, revision tombstones and the append-only triggers of migration 0021, re-application of the register by the
// restore tool (scripts/recovery.mjs), and the data exit and offline verifier marking disposed records. Synthetic data only.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { readTar, verifyFiles, registerContent } from '../scripts/verify-export.mjs';
import { createBackup, restoreBackup, reapplyRegisters, parseArgs } from '../scripts/recovery.mjs';

const dir = mkdtempSync(join(process.cwd(), '.disposal-contract-'));
let passed = 0;
const check = (name, fn) => { try { fn(); } catch (e) { e.message = `${name}: ${e.message}`; throw e; } passed++; };
const acheck = async (name, fn) => { try { await fn(); } catch (e) { e.message = `${name}: ${e.message}`; throw e; } passed++; };
const status = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
const sha = b => createHash('sha256').update(b).digest('hex');
class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor(path = ':memory:') { this.db = new DatabaseSync(path); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const migrate = (d, upTo = Infinity) => { for (const file of migrations.filter(f => Number(f.slice(0, 4)) <= upTo)) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d.db.exec(stmt); return d; };
const jsonl = b => b.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
function reseal(files, path, bytes, rows) {
  const out = new Map(files); out.set(path, Buffer.from(bytes));
  const manifest = JSON.parse(out.get('manifest.json').toString('utf8')), f = manifest.files.find(x => x.path === path);
  if (f) { if (rows !== undefined) { manifest.totals.rows += rows - f.rows; f.rows = rows; } f.bytes = out.get(path).length; f.sha256 = sha(out.get(path)); }
  out.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  out.set('SHA256SUMS', Buffer.from([...out.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(out.get(p))}  ${p}`).join('\n') + '\n'));
  return out;
}

try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts') && f !== 'server.ts'))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'server.js'), 'export function db() { throw new Error("not used"); }\nexport async function identity() { throw new Error("not used"); }\nexport async function loadFor() { throw new Error("not used"); }\nexport function rawRuntime() { return {}; }\nexport function json() { throw new Error("not used"); }\n');
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const [store, Ret, Disp, Exec, Eff, chain, exit, seed] = await Promise.all(['store', 'retention', 'disposal', 'disposal-execution', 'disposal-effects', 'audit-chain', 'data-exit', 'seed'].map(load));

  // A synthetic organisation in a migrated database. Two care teams; Kamla is in the north team.
  const now = new Date().toISOString(), OLD = '2010-01-01T00:00:00.000Z', OLDV = '2011-03-01T00:00:00.000Z', ORG = 'org_disposal_contract';
  const d1 = migrate(new D1());
  const member = (userId, role, teamIds, isOwner = true) => ({ userId, accountCode: userId.toUpperCase().padEnd(24, '0'), displayName: `Member ${userId}`, role, isOwner, status: 'active', version: 1, teamIds, createdAt: OLD });
  const members = [member('own1', 'clinician', ['default']), member('own2', 'clinician', ['default', 'north']), member('own3', 'clinician', ['north']), member('sup', 'supervisor', ['default'], false), member('adm', 'admin', [])];
  for (const m of members) d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(m.userId, m.accountCode, m.displayName, `${m.userId}@example.invalid`, OLD);
  const w = seed.seedWorkspace(OLD), P = id => w.people.find(p => p.id === id);
  for (const p of w.people) { p.createdAt = OLD; p.assignedTo = null; }
  P('p_kamla').teamId = 'north';
  const facts = { date: '2011-03-01T08:00', systolic: '118', diastolic: '76', weight: '57', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic old visit.', source: 'measured' };
  const mediaRef = (id, at) => ({ id, purpose: 'wound-or-skin', mime: 'image/png', size: 600, sha256: 'c2hh', at, by: 'own1' });
  w.visits = [
    { id: 'v-meena-old', personId: 'p_meena', version: 2, recordVersion: 1, state: 'confirmed', facts, createdAt: OLDV, confirmedAt: OLDV, media: [mediaRef('md-meena', OLDV)], plan: { id: 'pl-meena', state: 'completed', visitVersion: 2, consentVersion: 1, connectorVersions: {}, recipients: [], payloadHash: 'h', purpose: 'Synthetic', createdAt: OLDV }, aiResults: [{ id: 'ai-meena', providerId: 'ai_summary', providerName: 'Visit summariser', mode: 'demo', status: 'succeeded', text: 'Synthetic summary', createdAt: OLDV, inputHash: 'h', reviewed: true }] },
    { id: 'v-rajesh-old', personId: 'p_rajesh', version: 2, recordVersion: 1, state: 'confirmed', facts, createdAt: OLDV, confirmedAt: OLDV, media: [mediaRef('md-rajesh', OLDV)], aiResults: [] },
    { id: 'v-rajesh-new', personId: 'p_rajesh', version: 1, recordVersion: 1, state: 'draft', facts, createdAt: now, aiResults: [] },
    { id: 'v-aarav-old', personId: 'p_aarav', version: 2, recordVersion: 1, state: 'confirmed', facts, createdAt: OLDV, confirmedAt: OLDV, aiResults: [] },
  ];
  w.submissions = [
    { id: 'sub-meena', visitId: 'v-meena-old', personId: 'p_meena', connectorId: 'mis_maternal', connectorName: 'Maternal & child register', state: 'accepted', mode: 'demo', payloadHash: 'h', receipt: 'SIM-1', attempts: 1, message: 'Accepted', createdAt: OLDV, updatedAt: OLDV },
    { id: 'sub-aarav', visitId: 'v-aarav-old', personId: 'p_aarav', connectorId: 'mis_community', connectorName: 'Community health MIS', state: 'uncertain', mode: 'demo', payloadHash: 'h', attempts: 1, message: 'No confirmed response', createdAt: OLDV, updatedAt: OLDV },
  ];
  w.referrals = [{ id: 'ref-meena', personId: 'p_meena', visitId: 'v-meena-old', facility: 'Synthetic PHC', reason: 'Synthetic', state: 'completed', createdAt: OLDV }];
  const rules = [['patient-record', 10, true], ['programme-receipt', 10], ['audit-event', 10], ['outreach-message', 10], ['rights-request', 10], ['field-package', 10], ['visit-media', 5, true]].map(([recordClass, years, dispose]) => dispose ? { recordClass, years, dispose } : { recordClass, years });
  const state = { organisation: { id: ORG, name: 'Disposal contract organisation', revision: 1, createdAt: OLD }, teams: [{ id: 'default', name: 'Care team', createdAt: OLD }, { id: 'north', name: 'North team', createdAt: OLD }], members, invitations: [], workspace: w,
    outreach: { plans: [], templates: [], messages: [{ id: 'msg-farida', personId: 'p_farida', createdAt: OLD }] },
    retention: { policies: [{ version: 1, rules, basis: 'Synthetic placeholder schedule for the contract', setBy: 'own1', setAt: OLD }], holds: [{ id: 'hold-sunita', scope: 'person', personId: 'p_sunita', reason: 'Synthetic legal matter', reference: 'CASE-1', placedBy: 'own1', placedAt: OLD }] } };
  await store.createState(d1, state, { userId: 'own1', displayName: 'Member own1', email: 'own1@example.invalid' }, 'createOrganisation');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, 7)]);
  for (const [id, personId, visitId] of [['md-meena', 'p_meena', 'v-meena-old'], ['md-rajesh', 'p_rajesh', 'v-rajesh-old']]) d1.db.prepare('INSERT INTO media (org_id,id,person_id,visit_id,mime,size,sha256,purpose,created_at,deleted_at,data) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(ORG, id, personId, visitId, 'image/png', png.length, createHash('sha256').update(png).digest('base64'), 'wound-or-skin', OLDV, null, png.toString('base64'));
  const actor = id => ({ userId: id, displayName: `Member ${id}`, email: `${id}@example.invalid` });
  const loadState = async userId => { const s = await store.readState(d1, ORG); const m = store.scope(s, userId); return { s, m }; };
  const count = (table, extra = '', ...binds) => d1.db.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=?${extra}`).get(ORG, ...binds).n;
  // An organisation-level command (prepare, cancel, retention) applied and committed as the server does.
  const command = async (userId, c, environment = 'synthetic') => { const { s, m } = await loadState(userId), before = structuredClone(s); const r = (await Disp.applyDisposal(s, c, actor(userId), m, environment)) ?? Ret.applyRetention(s, c, actor(userId), m); if (r === null) return null; await store.persist(d1, before, s, actor(userId), c, crypto.randomUUID(), 'h', r); return r; };
  const apply = async (userId, c, environment = 'synthetic') => { const { s, m } = await loadState(userId); return Exec.executeDisposal(d1, s, c, actor(userId), m, crypto.randomUUID(), 'h', environment); };

  // 1. Rules, authority and environment.
  await acheck('a rule can allow disposal only for patient records and visit media', async () => { const { s, m } = await loadState('own1'); assert.equal(Ret.applyRetention(s, { type: 'retentionPolicySet', rules: [{ recordClass: 'audit-event', years: 10, dispose: true }], basis: 'Synthetic placeholder schedule' }, actor('own1'), m), null); });
  await acheck('only owners prepare, apply or cancel', async () => { const { s, m } = await loadState('sup'); await status(() => Disp.applyDisposal(s, { type: 'disposalPrepare' }, actor('sup'), m, 'synthetic'), 403); await status(() => Exec.executeDisposal(d1, s, { type: 'disposalApply', batchId: 'x', planHash: 'a'.repeat(64) }, actor('sup'), m, 'k', 'h', 'synthetic'), 403); });
  await acheck('disposal is refused outside the synthetic and training environments', async () => { for (const env of ['staging', 'production', 'misconfigured']) await status(() => command('own1', { type: 'disposalPrepare' }, env), 409, /synthetic and training/); });
  await acheck('an administrator-role owner has no patient scope, so nothing is planned', async () => { await status(() => command('adm', { type: 'disposalPrepare' }), 422, /Nothing can be disposed/); });

  // 2. The plan: identifiers and counts only; held, out-of-scope, linked and recent records are kept.
  let { s, m } = await loadState('own1');
  const plan = await Disp.disposalPlan(s, m, now);
  const ids = t => plan.items.filter(i => i.table === t).map(i => i.id);
  check('the plan lists the old patient and its records, and old visit media of a recent patient', () => {
    assert.deepEqual(ids('patients'), ['p_meena']); assert.deepEqual(ids('visits'), ['v-meena-old']); assert.deepEqual(ids('plans'), ['pl-meena']); assert.deepEqual(ids('ai_results'), ['ai-meena']);
    assert.deepEqual(ids('submissions'), ['sub-meena']); assert.deepEqual(ids('referrals'), ['ref-meena']); assert.deepEqual(ids('record_revisions'), ['p_meena']);
    assert.deepEqual(plan.items.filter(i => i.table === 'media').map(i => [i.recordClass, i.id]), [['patient-record', 'md-meena'], ['visit-media', 'md-rajesh']]);
    assert.deepEqual(plan.counts, { patients: 1, visits: 1, plans: 1, ai_results: 1, submissions: 1, referrals: 1, media: 1, visitMedia: 1 });
  });
  check('held, out-of-scope, unresolved and referenced patients are kept and counted', () => {
    assert.equal(plan.excluded.held, 1); assert.equal(plan.excluded.outsideAuthority, 1); assert.equal(plan.excluded.organisationHold, false);
    assert.deepEqual(plan.excluded.blocked, { 'unresolved programme send': 1, 'referenced by outreach': 1 });
    assert.ok(!ids('patients').some(x => ['p_sunita', 'p_kamla', 'p_aarav', 'p_farida', 'p_rajesh'].includes(x)));
  });
  check('the plan carries no names or clinical content', () => { const text = JSON.stringify(plan); for (const word of ['Meena', 'Rajesh', 'Synthetic old visit', 'Synthetic summary']) assert.ok(!text.includes(word), word); assert.match(plan.planHash, /^[0-9a-f]{64}$/); });
  await acheck('the plan is deterministic, and depends on its time, the scope and the holds', async () => {
    assert.equal((await Disp.disposalPlan(s, m, now)).planHash, plan.planHash);
    assert.notEqual((await Disp.disposalPlan(s, m, '2021-06-01T00:00:00.000Z')).planHash, plan.planHash);
    const wide = await Disp.disposalPlan(s, s.members.find(x => x.userId === 'own2'), now); assert.ok(wide.items.some(i => i.id === 'p_kamla')); assert.notEqual(wide.planHash, plan.planHash);
    const held = structuredClone(s); held.retention.holds.push({ id: 'h-org', scope: 'organisation', reason: 'Synthetic inquiry', reference: 'REG-1', placedBy: 'own1', placedAt: now });
    store.scope(held, 'own1'); const none = await Disp.disposalPlan(held, held.members.find(x => x.userId === 'own1'), now); assert.equal(none.items.length, 0); assert.equal(none.excluded.organisationHold, true);
  });
  await acheck('a plan holds at most 200 records; the rest is deferred', async () => {
    const big = structuredClone(s); big.workspace.visits.find(v => v.id === 'v-rajesh-old').media = Array.from({ length: 205 }, (_, i) => mediaRef(`md-many-${String(i).padStart(3, '0')}`, OLDV));
    store.scope(big, 'own1'); const p = await Disp.disposalPlan(big, big.members.find(x => x.userId === 'own1'), now);
    assert.equal(p.items.length, 200); assert.equal(p.excluded.media.deferred, 205 - (200 - 8), 'eight records of the old patient, then media up to 200');
  });

  // 3. Prepare (one owner); the plan waits for a second owner.
  const prepared = await command('own1', { type: 'disposalPrepare' });
  check('preparing records the plan, identifiers only, and changes no record', () => {
    assert.match(prepared.planHash, /^[0-9a-f]{64}$/); assert.deepEqual(prepared.items.map(i => i.id), plan.items.map(i => i.id), 'the same records as the dry run (the hash also binds the preparation time)');
    assert.equal(count('patients'), 6); assert.equal(count('disposals'), 0);
    const e = d1.db.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='disposalPrepare'").get(ORG); assert.match(e.detail, /Plan hash [0-9a-f]{64}/); assert.ok(!e.detail.includes('Meena'));
  });
  await acheck('a second plan cannot be prepared while one waits', async () => { await status(() => command('own2', { type: 'disposalPrepare' }), 409, /already waiting/); });
  await acheck('the review shows the waiting plan to owners, with identifiers in their own scope only', async () => {
    ({ s } = await loadState('own2'));
    const v2 = Ret.retentionReview(s, s.members.find(x => x.userId === 'own2'), { total: 0, pastSchedule: 0 }, now), b2 = v2.disposals[0];
    assert.equal(b2.state, 'prepared'); assert.equal(b2.canApply, true); assert.equal(b2.items.length, plan.items.length); assert.match(v2.disposal, /second owner/);
    ({ s } = await loadState('own1')); assert.equal(Ret.retentionReview(s, s.members.find(x => x.userId === 'own1'), { total: 0, pastSchedule: 0 }, now).disposals[0].canApply, false);
    ({ s } = await loadState('own3')); const b3 = Ret.retentionReview(s, s.members.find(x => x.userId === 'own3'), { total: 0, pastSchedule: 0 }, now).disposals[0]; assert.equal(b3.items.length, 0); assert.equal(b3.itemsOutsideYourScope, plan.items.length);
  });

  // 4. Apply: refused to the preparer, a wrong hash, a stale plan, an approver without scope, and outside synthetic.
  const ok = { type: 'disposalApply', batchId: prepared.batchId, planHash: prepared.planHash };
  await acheck('the preparing owner cannot apply their own plan', async () => { await status(() => apply('own1', ok), 403, /second owner/); });
  await acheck('a plan hash that does not match is refused', async () => { await status(() => apply('own2', { ...ok, planHash: 'b'.repeat(64) }), 409, /does not match/); });
  await acheck('an approver without care scope over every planned record is refused', async () => { await status(() => apply('own3', ok), 403, /outside your care scope/); });
  await acheck('apply is refused outside the synthetic and training environments', async () => { await status(() => apply('own2', ok, 'production'), 409); });
  const hold = await command('own2', { type: 'retentionHoldPlace', scope: 'person', personId: 'p_meena', reason: 'Synthetic matter placed after the plan', reference: 'CASE-2' });
  await acheck('a hold placed after the plan makes it stale: nothing is disposed', async () => { await status(() => apply('own2', ok), 409, /changed since it was prepared/); assert.equal(count('patients'), 6); assert.equal(count('disposals'), 0); });
  await command('own2', { type: 'retentionHoldRelease', holdId: hold.holdId, reason: 'Synthetic matter closed again' });

  // 5. Apply by a second owner: exactly the plan, in one guarded commit.
  const pre = join(dir, 'pre-disposal.sqlite'); d1.db.exec(`VACUUM INTO '${pre}'`);
  const before = { revisions: d1.db.prepare('SELECT id FROM record_revisions WHERE org_id=? AND person_id=? ORDER BY id').all(ORG, 'p_meena').map(r => r.id), audit: count('audit_events'), receipts: count('command_receipts'), allRevisions: count('record_revisions') };
  check('the patient has revisions with content before disposal', () => { assert.ok(before.revisions.length >= 1); assert.ok(d1.db.prepare('SELECT data FROM record_revisions WHERE org_id=? AND person_id=?').all(ORG, 'p_meena').some(r => r.data.includes('Meena Devi'))); });
  const applied = await apply('own2', ok);
  check('the planned records are gone from their tables; nothing else is', () => {
    for (const [t, id] of [['patients', 'p_meena'], ['visits', 'v-meena-old'], ['plans', 'pl-meena'], ['ai_results', 'ai-meena'], ['submissions', 'sub-meena'], ['referrals', 'ref-meena']]) assert.equal(count(t, ' AND id=?', id), 0, t);
    assert.equal(count('patients'), 5); assert.equal(count('visits'), 3); assert.equal(count('submissions'), 1);
  });
  check('media content is erased and its row kept as a tombstone; visit media is marked on its visit', () => {
    for (const id of ['md-meena', 'md-rajesh']) { const r = d1.db.prepare('SELECT data,deleted_at,sha256,size FROM media WHERE org_id=? AND id=?').get(ORG, id); assert.equal(r.data, ''); assert.ok(r.deleted_at); assert.ok(r.sha256); assert.equal(r.size, png.length); }
    const v = JSON.parse(d1.db.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(ORG, 'v-rajesh-old').data); assert.ok(v.media[0].removedAt); assert.equal(v.media[0].disposal.batch, prepared.batchId);
  });
  check('every revision of the patient is kept with its content replaced by a tombstone', () => {
    const rows = d1.db.prepare('SELECT * FROM record_revisions WHERE org_id=? AND person_id=? ORDER BY id').all(ORG, 'p_meena'), entry = d1.db.prepare("SELECT id FROM disposals WHERE org_id=? AND table_name='record_revisions'").get(ORG).id;
    assert.deepEqual(rows.map(r => r.id), before.revisions); assert.equal(count('record_revisions'), before.allRevisions);
    for (const r of rows) { assert.deepEqual(JSON.parse(r.data), { disposed: true, entry, batch: prepared.batchId, at: JSON.parse(r.data).at }); assert.equal(r.changes, '[]'); assert.match(r.reason, /disposed under the retention schedule/); assert.ok(!JSON.stringify(r).includes('Meena')); }
  });
  await acheck('audit events and receipts are kept; one audit event and one receipt are added; the audit chain verifies', async () => {
    assert.equal(count('audit_events'), before.audit + 1); assert.equal(count('command_receipts'), before.receipts + 1);
    assert.ok(count('audit_events', ' AND person_id=?', 'p_meena') >= 1, 'events about the disposed patient remain');
    assert.equal((await chain.verifyChain(d1, ORG)).status, 'intact');
    const e = d1.db.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='disposalApply'").get(ORG); assert.match(e.detail, /Disposal applied: 1 patient record, 1 visit, 1 plan, 1 AI result, 1 programme submission, 1 referral, 1 media item of those patients, 1 visit media item past its own schedule, \d+ revisions?\./); assert.ok(!e.detail.includes('Meena'));
  });
  let register = d1.db.prepare(`SELECT ${Eff.ENTRY_COLUMNS.join(',')} FROM disposals WHERE org_id=? ORDER BY seq`).all(ORG).map(r => ({ ...r }));
  await acheck('the register holds one chained entry per disposed record, with rule, authority and content hash', async () => {
    assert.equal(register.length, 9); assert.deepEqual(register.map(e => e.seq), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const v = await Eff.verifyRegister(register); assert.equal(v.ok, true, v.problem); assert.equal(v.head.hash, applied.register.head);
    for (const e of register) { assert.match(e.content_sha256, /^[0-9a-f]{64}$/); assert.equal(JSON.parse(e.authority).approvedBy, 'own2'); assert.equal(JSON.parse(e.authority).preparedBy, 'own1'); assert.equal(JSON.parse(e.rule).placeholder, true); }
    const tampered = structuredClone(register); tampered[3].record_id = 'other'; assert.match((await Eff.verifyRegister(tampered)).problem, /entry 3: content or hash altered/);
    assert.match((await Eff.verifyRegister(register.slice(1))).problem, /entry 0 is missing/);
  });
  check('the register and revisions stay append-only', () => {
    assert.throws(() => d1.db.prepare('UPDATE disposals SET record_id=? WHERE org_id=?').run('x', ORG), /append-only/);
    assert.throws(() => d1.db.prepare('DELETE FROM disposals WHERE org_id=?').run(ORG), /append-only/);
    assert.throws(() => d1.db.prepare("UPDATE record_revisions SET reason='x' WHERE org_id=? AND person_id=?").run(ORG, 'p_rajesh'), /append-only/);
    assert.throws(() => d1.db.prepare("UPDATE record_revisions SET data=?,changes='[]' WHERE org_id=? AND person_id=?").run(JSON.stringify({ disposed: true, entry: register[0].id }), ORG, 'p_rajesh'), /append-only/, 'a tombstone needs the register entry of that patient');
    assert.throws(() => d1.db.prepare('DELETE FROM record_revisions WHERE org_id=?').run(ORG), /append-only/);
  });
  await acheck('the plan record is applied, its identifiers dropped; applying it again is refused', async () => {
    const b = (await loadState('own2')).s.retention.disposals.find(x => x.id === prepared.batchId);
    assert.equal(b.state, 'applied'); assert.equal(b.items, undefined); assert.equal(b.approvedBy, 'own2'); assert.equal(b.register.entries, 9); assert.ok(b.counts.revisions >= 1);
    await status(() => apply('own2', ok), 409, /already applied/);
  });
  await acheck('the workspace no longer holds the disposed patient; others are unchanged', async () => {
    const { s: after } = await loadState('own2'); assert.ok(!after.workspace.people.some(p => p.id === 'p_meena')); assert.equal(after.workspace.people.length, 5);
    assert.ok(after.workspace.visits.find(v => v.id === 'v-rajesh-old').media[0].removedAt);
    const v = Ret.retentionReview(after, after.members.find(x => x.userId === 'own2'), { total: 0, pastSchedule: 0 }, now, new Set(['p_meena'])); assert.equal(v.review.find(r => r.recordClass === 'visit-media').total, 0);
  });

  // 6. Grouped and entry-by-entry effects leave identical tables (the Worker groups; the restore tool goes entry by entry).
  await acheck('grouped effects equal entry-by-entry effects', async () => {
    const dump = db => Object.fromEntries(['patients', 'visits', 'plans', 'ai_results', 'submissions', 'referrals', 'media', 'record_revisions'].map(t => [t, db.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all().map(r => JSON.stringify(r)).sort()]));
    writeFileSync(join(dir, 'a.sqlite'), readFileSync(pre)); writeFileSync(join(dir, 'b.sqlite'), readFileSync(pre));
    const A = new DatabaseSync(join(dir, 'a.sqlite')), B = new DatabaseSync(join(dir, 'b.sqlite'));
    for (const [db, run] of [[A, es => es.flatMap(e => Eff.effects(e))], [B, es => Eff.batchEffects(es)]]) { db.exec('BEGIN'); for (const e of register) db.prepare(`INSERT INTO disposals (${Eff.ENTRY_COLUMNS.join(',')}) VALUES (${Eff.ENTRY_COLUMNS.map(() => '?').join(',')})`).run(...Eff.ENTRY_COLUMNS.map(c => e[c])); for (const x of run(register)) db.prepare(x.sql).run(...x.binds); db.exec('COMMIT'); }
    assert.deepEqual(dump(A), dump(B)); const live = dump(d1.db); for (const t of ['patients', 'plans', 'ai_results', 'submissions', 'referrals', 'record_revisions']) assert.deepEqual(dump(A)[t], live[t], t);
    A.close(); B.close();
  });

  // 7. Restore: a backup taken before the disposal, restored with the register, holds no disposed content.
  const registerFile = join(dir, 'register.json'), pass = randomBytes(24).toString('hex'), backup = join(dir, 'pre.sahabackup');
  writeFileSync(registerFile, JSON.stringify({ format: Eff.REGISTER_FORMAT, organisationId: ORG, generatedAt: now, entries: register, head: { seq: 8, hash: applied.register.head } }));
  await createBackup(pre, backup, pass);
  const restored = join(dir, 'restored.sqlite'), revived = join(dir, 'revived.sqlite');
  const r = await restoreBackup(backup, restored, pass, { registers: [registerFile] });
  await acheck('restoring with the register re-applies every disposal before the database is written', async () => {
    assert.equal(r.verified, true); assert.equal(r.disposalRegister.reapplied, 9); assert.equal(r.disposalRegister.alreadyPresent, 0); assert.notEqual(r.sha256, r.backupSha256);
    const db = new DatabaseSync(restored, { readOnly: true }), q = (sql, ...b) => db.prepare(sql).all(...b).map(x => JSON.stringify(x)).sort();
    for (const t of ['patients', 'visits', 'plans', 'ai_results', 'submissions', 'referrals', 'record_revisions', 'disposals']) assert.deepEqual(q(`SELECT * FROM ${t} WHERE org_id=?`, ORG), d1.db.prepare(`SELECT * FROM ${t} WHERE org_id=?`).all(ORG).map(x => JSON.stringify(x)).sort(), t);
    assert.deepEqual(q("SELECT id,data,deleted_at FROM media WHERE org_id=? AND data=''", ORG).length, 2);
    assert.ok(readFileSync(pre).includes('Meena Devi'), 'the backup source holds the name'); assert.ok(!readFileSync(restored).includes('Meena Devi'), 'the disposed name is not in the restored database file, not even in free pages');
    db.close();
  });
  await acheck('restoring without the register brings the disposed records back (why the tool requires a choice)', async () => {
    const x = await restoreBackup(backup, revived, pass); assert.equal(x.disposalRegister, 'not applied');
    const db = new DatabaseSync(revived, { readOnly: true }); assert.equal(db.prepare('SELECT count(*) AS n FROM patients WHERE org_id=? AND id=?').get(ORG, 'p_meena').n, 1); db.close();
  });
  check('the restore command requires the register or an explicit choice to restore without it', () => {
    assert.throws(() => parseArgs(['restore', 'a', 'b', '--passphrase-stdin']), /must re-apply the disposal register/);
    assert.deepEqual(parseArgs(['restore', 'a', 'b', '--passphrase-stdin', '--without-disposal-register']).registers, []);
    assert.equal(parseArgs(['restore', 'a', 'b', '--disposal-register', 'r1.json', '--passphrase-stdin', '--disposal-register', 'r2.json']).registers.length, 2);
    assert.throws(() => parseArgs(['backup', 'a', 'b', '--passphrase-stdin', '--disposal-register', 'r.json']), /Usage/);
    assert.throws(() => parseArgs(['restore', 'a', 'b', '--passphrase-stdin', '--without-disposal-register', '--disposal-register', 'r.json']), /Usage/);
  });
  await acheck('a tampered or conflicting register is refused and nothing is written', async () => {
    const bad = JSON.parse(readFileSync(registerFile, 'utf8')); bad.entries[2].record_id = 'p_rajesh'; writeFileSync(join(dir, 'bad.json'), JSON.stringify(bad));
    await assert.rejects(() => restoreBackup(backup, join(dir, 'bad.sqlite'), pass, { registers: [join(dir, 'bad.json')] }), /does not verify/); assert.equal(existsSync(join(dir, 'bad.sqlite')), false);
    const other = JSON.parse(readFileSync(registerFile, 'utf8')); other.organisationId = 'org_other'; writeFileSync(join(dir, 'other.json'), JSON.stringify(other));
    await assert.rejects(() => restoreBackup(backup, join(dir, 'other.sqlite'), pass, { registers: [join(dir, 'other.json')] }), /another organisation/);
    const copy = join(dir, 'conflict.sqlite'); writeFileSync(copy, readFileSync(restored));
    const forged = await (async () => { const e = { ...register[0], id: 'forged', record_id: 'p_rajesh' }; e.hash = await Eff.entryHash(e); const next = register.slice(1).map(x => ({ ...x })); let prev = e.hash; for (const x of next) { x.prev_hash = prev; x.hash = await Eff.entryHash(x); prev = x.hash; } return [e, ...next]; })();
    writeFileSync(join(dir, 'forged.json'), JSON.stringify({ format: Eff.REGISTER_FORMAT, organisationId: ORG, entries: forged }));
    await assert.rejects(() => reapplyRegisters(copy, [join(dir, 'forged.json')]), /entry 0 differs from the one in the backup/);
  });
  await acheck('a register the backup already holds is recognised and not applied twice', async () => { const copy = join(dir, 'again.sqlite'); writeFileSync(copy, readFileSync(restored)); const x = await reapplyRegisters(copy, [registerFile]); assert.equal(x.alreadyPresent, 9); assert.equal(x.reapplied, 0); });
  await acheck('a backup from before migration 0021 is refused with the steps to follow', async () => { const old = migrate(new D1(join(dir, 'old.sqlite')), 17); old.db.close(); await assert.rejects(() => reapplyRegisters(join(dir, 'old.sqlite'), [registerFile]), /before the disposal register existed/); });

  // 8. A second disposal continues the register chain.
  await command('own1', { type: 'retentionHoldRelease', holdId: 'hold-sunita', reason: 'Synthetic legal matter closed' });
  const second = await command('own1', { type: 'disposalPrepare' });
  await acheck('a cancelled plan cannot be applied; a new plan continues the register', async () => {
    assert.ok(second.items.some(i => i.id === 'p_sunita'));
    assert.equal(await command('own2', { type: 'disposalCancel', batchId: second.batchId, reason: 'short' }), null, 'a cancel needs a reason of ten characters');
    await command('own2', { type: 'disposalCancel', batchId: second.batchId, reason: 'Synthetic cancellation for the contract' });
    await status(() => apply('own2', { type: 'disposalApply', batchId: second.batchId, planHash: second.planHash }), 409, /already cancelled/);
    const wide = await command('own2', { type: 'disposalPrepare' }); assert.ok(wide.items.some(i => i.id === 'p_kamla'));
    await status(() => apply('own1', { type: 'disposalApply', batchId: wide.batchId, planHash: wide.planHash }), 403, /outside your care scope/);
    await command('own1', { type: 'disposalCancel', batchId: wide.batchId, reason: 'Applying owner lacks the north team' });
    const third = await command('own1', { type: 'disposalPrepare' });
    await apply('own2', { type: 'disposalApply', batchId: third.batchId, planHash: third.planHash });
    register = d1.db.prepare(`SELECT ${Eff.ENTRY_COLUMNS.join(',')} FROM disposals WHERE org_id=? ORDER BY seq`).all(ORG).map(r => ({ ...r }));
    assert.ok(register.length > 9); assert.equal(register[9].prev_hash, register[8].hash); assert.equal((await Eff.verifyRegister(register)).ok, true);
    assert.equal(count('patients', ' AND id=?', 'p_sunita'), 0); assert.equal((await chain.verifyChain(d1, ORG)).status, 'intact');
  });
  await acheck('an expired plan cannot be applied and does not block a new one', async () => {
    const { s: st, m: mm } = await loadState('own1'), later = new Date(Date.now() + 73 * 3600000).toISOString();
    st.retention.disposals.push({ id: 'old-plan', state: 'prepared', planHash: 'c'.repeat(64), policyVersion: 1, preparedBy: 'own2', preparedAt: now, expiresAt: now, counts: {}, excluded: {}, items: [] });
    await status(() => Disp.waitingBatch(st, 'old-plan', later), 409, /expired/);
    await status(() => Disp.applyDisposal(st, { type: 'disposalPrepare' }, actor('own1'), mm, 'synthetic', later), 422, /Nothing can be disposed/);
    assert.equal(st.retention.disposals.find(b => b.id === 'old-plan').state, 'expired');
  });

  // 9. Data exit marks disposed records; the offline verifier checks the register and that disposed records carry no content.
  const exporter = id => ({ orgId: ORG, member: members.find(x => x.userId === id), exporter: { userId: id, name: `Member ${id}`, accountCode: 'X' }, exportId: `export-${id}`, now: new Date().toISOString(), includeFhir: false, environment: 'synthetic' });
  const built = await exit.buildExport(d1, exporter('own2')), files = readTar(Buffer.from(built.archive)), t = n => jsonl(files.get(`tables/${n}.jsonl`)), report = verifyFiles(files);
  check('the export lists the register and resolves references to disposed records', () => {
    assert.equal(report.ok, true, JSON.stringify(report.failures)); assert.match(report.checks.find(c => c.name === 'disposal-register').detail, /entries, head .* disposed patients and their records carry no content/);
    assert.equal(built.manifest.disposal.registerEntries, register.length); assert.equal(built.manifest.disposal.disposedPatientsInScope, 2);
    assert.ok(!t('patients').some(p => ['p_meena', 'p_sunita'].includes(p.id))); assert.equal(t('disposals').length, register.length);
    assert.ok(t('record_revisions').filter(r => r.person_id === 'p_meena').every(r => JSON.parse(r.data).disposed === true));
    const digests = t('audit_events').filter(e => e.withheld && /disposed patient/.test(e.withheld)); assert.ok(digests.length >= 2); assert.equal(built.manifest.disposal.auditDigestsOfDisposedPatients, digests.length);
    assert.ok(!files.get('tables/audit_events.jsonl').toString('utf8').includes('Meena Devi'));
  });
  await acheck('register entries outside the exporter\'s scope are digests; chains verify', async () => {
    const b3 = await exit.buildExport(d1, exporter('own3')), f3 = readTar(Buffer.from(b3.archive)), r3 = verifyFiles(f3);
    assert.equal(r3.ok, true, JSON.stringify(r3.failures)); assert.ok(jsonl(f3.get('tables/disposals.jsonl')).every(e => e.withheld && !e.record_id));
  });
  check('a forged register entry or disposed content left in the export fails the verifier', () => {
    const regs = t('disposals'); regs[1].record_id = 'v-forged';
    let x = verifyFiles(reseal(files, 'tables/disposals.jsonl', regs.map(e => JSON.stringify(e) + '\n').join(''))); assert.equal(x.ok, false); assert.match(x.failures.join(' '), /disposal-register: entry 1: content or hash altered/);
    const people = t('patients'); people.push({ ...people[0], id: 'p_meena' });
    x = verifyFiles(reseal(files, 'tables/patients.jsonl', people.map(e => JSON.stringify(e) + '\n').join(''), people.length)); assert.equal(x.ok, false); assert.match(x.failures.join(' '), /still carry content: patient p_meena/);
  });
  await acheck('the verifier restates the register content digest exactly', async () => { for (const e of register.slice(0, 3)) assert.equal(registerContent(e), await Eff.contentDigest(e)); });

  const result = { suite: 'disposal contract (slice 14f)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/disposal-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
