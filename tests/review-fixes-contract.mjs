// Slice 6p review-fixes contract: regressions for the defects an independent review found in slices
// 6m, 6j/6k, 2d, 1e and the audit-chain export after they were built. Each block reproduces the
// reviewer's scenario (/tmp/claude-0/review/*.mjs on 30 September 2026) and fails on the code before 6p.
//  1. Data exit: patient-linked entries inside organisation documents follow the exporter's care scope.
//  2. Export audit: a command saved while an export is built no longer discards the export.
//  3. Fixture migration revert: only records in the reverting owner's care scope are unmarked.
//  5. Delegation limit counts records in force; the sandbox provider role never sees patient events;
//     archive paths with '..' segments are refused.
// (4, the provider sandbox import oracle, is covered in provider-sandbox-contract and -smoke.)
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readTar, verifyFiles } from '../scripts/verify-export.mjs';

const dir = mkdtempSync(join(process.cwd(), '.review-fixes-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const statusOf = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); passed++; return e; } assert.fail(`expected ${code}`); };
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
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const migrated = () => { const d = new D1(); for (const file of migrations) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d.db.exec(stmt); return d; };
function reseal(files, path, bytes) {
  const out = new Map(files); out.set(path, Buffer.from(bytes));
  const manifest = JSON.parse(out.get('manifest.json').toString('utf8')), f = manifest.files.find(x => x.path === path);
  f.bytes = out.get(path).length; f.sha256 = sha(out.get(path));
  out.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  out.set('SHA256SUMS', Buffer.from([...out.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(out.get(p))}  ${p}`).join('\n') + '\n'));
  return out;
}
const jsonl = b => b.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'data-exit', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'export-audit', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'fixture-migration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const exit = await import(pathToFileURL(join(dir, 'data-exit.js')));
  const audit = await import(pathToFileURL(join(dir, 'export-audit.js')));
  const fm = await import(pathToFileURL(join(dir, 'fixture-migration.js')));
  const dg = await import(pathToFileURL(join(dir, 'delegation.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));

  // 1. Data exit: organisation documents no longer carry out-of-scope patients' entries.
  {
    const d1 = migrated(), now = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'x@example.invalid' };
    d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'x@example.invalid', now);
    const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
    const A = 'org_leak', w = seedWorkspace(now);
    const kamla = w.people.find(p => p.id === 'p_kamla'); kamla.teamId = 'north';
    const mine = w.people.find(p => p.id !== 'p_kamla').id;
    const safety = (id, personId, summary) => ({ id, personId, visitId: 'v-' + id, ownerId: 'owner', createdBy: 'owner', createdAt: now, version: 1, kind: 'harm', summary, state: 'open', evidence: { visitVersion: 1, recordVersion: 1, agentRuns: [], protocolCheckIds: [] } });
    const state = { organisation: { id: A, name: 'Leak org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [member], invitations: [], workspace: w,
      governance: { entries: [], evaluations: [], safety: [safety('sc1', 'p_kamla', 'SECRET-SAFETY: Kamla Devi heavy bleeding after AI advice'), safety('sc2', mine, 'In-scope synthetic safety case')],
        shadows: [{ id: 'sh', entryId: 'e', revision: 1, manifestHash: 'h', key: 'k', scope: 'organisation', teamIds: ['default', 'north'], startedAt: now, until: now, startedBy: 'owner', reason: 'r', state: 'active', version: 1, results: [{ visitId: 'v-k', personId: 'p_kamla', visitVersion: 1, at: now, status: 'compared', output: { note: 'SECRET-SHADOW Kamla Devi' } }, { visitId: 'v-m', personId: mine, visitVersion: 1, at: now, status: 'not-run', reason: 'no-consent' }] }] },
      outreach: { templates: [], plans: [{ id: 'pl', version: 1, title: 'North plan', date: '2026-10-01', teamId: 'north', criteria: 'x', createdAt: now, createdBy: 'owner', state: 'draft', items: [{ id: 'it', personId: 'p_kamla', ownerId: 'owner', reason: 'SECRET-OUTREACH-REASON overdue ANC', state: 'planned', events: [] }, { id: 'it2', personId: mine, ownerId: 'owner', reason: 'In-scope outreach', state: 'planned', events: [] }], history: [] }],
        messages: [{ id: 'm1', version: 1, planId: 'pl', itemId: 'it', personId: 'p_kamla', templateId: 't', templateVersion: 1, body: 'SECRET-MSG Dear Kamla Devi, your ANC visit', scheduledAt: now, createdAt: now, createdBy: 'owner', authorVersion: 1, state: 'draft', attempts: [] }] },
      retention: { policies: [], holds: [{ id: 'h1', scope: 'person', personId: 'p_kamla', reason: 'SECRET-HOLD litigation', reference: 'r', placedBy: 'owner', placedAt: now }, { id: 'h2', scope: 'organisation', reason: 'Organisation-wide hold', reference: 'r2', placedBy: 'owner', placedAt: now }] } };
    await store.createState(d1, state, actor, 'createOrganisation');
    const exporter = { userId: 'owner', name: 'Synthetic owner', accountCode: 'CODE0000000000000000000A' };
    const build = async m => { d1.db.prepare('UPDATE memberships SET role=? WHERE org_id=? AND user_id=?').run(m.role, A, 'owner'); return exit.buildExport(d1, { orgId: A, member: m, exporter, exportId: 'e-' + m.role, now: '2026-09-30T06:00:00.000Z', includeFhir: false, environment: 'synthetic' }); };
    const secrets = ['SECRET-SAFETY', 'SECRET-SHADOW', 'SECRET-MSG', 'SECRET-OUTREACH-REASON', 'SECRET-HOLD', 'Kamla Devi', 'p_kamla'];
    const leaks = files => [...files].flatMap(([p, b]) => secrets.filter(n => b.toString('utf8').includes(n)).map(n => `${n} in ${p}`));
    const built = await build(member), files = readTar(Buffer.from(built.archive));
    const doc = t => JSON.parse(jsonl(files.get(`tables/${t}.jsonl`))[0].data);
    check(() => assert.deepEqual(leaks(files), [], 'no trace of the out-of-scope patient anywhere in the archive'));
    check(() => { assert.equal(built.manifest.scope.patientsWithheld, 1); assert.equal(built.manifest.scope.entriesWithheld, 5); assert.equal(built.manifest.totals.withheldEntries, 5); assert.equal(built.manifest.scope.complete, false, 'withheld entries make the export incomplete'); });
    check(() => { const g = doc('governance'), o = doc('outreach'), r = doc('retention'); assert.deepEqual(g.safety.map(x => x.id), ['sc2']); assert.deepEqual(g.shadows[0].results.map(x => x.personId), [mine]); assert.deepEqual(o.plans[0].items.map(x => x.id), ['it2']); assert.equal(o.plans[0].title, 'North plan', 'plan headers are organisation entries'); assert.deepEqual(o.messages, []); assert.deepEqual(r.holds.map(x => x.id), ['h2'], 'organisation holds stay'); });
    check(() => { const f = built.manifest.files; assert.equal(f.find(x => x.table === 'governance').withheldEntries, 2); assert.equal(f.find(x => x.table === 'outreach').withheldEntries, 2); assert.equal(f.find(x => x.table === 'retention').withheldEntries, 1); assert.equal(f.find(x => x.table === 'operations').withheldEntries, 0); assert.match(f.find(x => x.table === 'governance').note, /2 patient-linked entries inside data are left out/); });
    const report = verifyFiles(files);
    check(() => assert.equal(report.ok, true, JSON.stringify(report.failures)));
    check(() => assert.ok(report.checks.find(c => c.name === 'relationships').detail.match(/references resolve/)));
    // The verifier now catches the pre-6p archive shape: an out-of-scope entry inside an organisation document.
    const rows = jsonl(files.get('tables/governance.jsonl')); const g = JSON.parse(rows[0].data); g.safety.push(safety('sc1', 'p_kamla', 'SECRET-SAFETY')); rows[0].data = JSON.stringify(g);
    const forged = verifyFiles(reseal(files, 'tables/governance.jsonl', rows.map(r => JSON.stringify(r) + '\n').join('')));
    check(() => { assert.equal(forged.ok, false); assert.ok(forged.failures.some(f => /relationships: .*governance\.data personId=p_kamla/.test(f)), JSON.stringify(forged.failures)); });
    const m2 = JSON.parse(files.get('manifest.json').toString('utf8')); m2.scope.complete = true; const f2 = new Map(files); f2.set('manifest.json', Buffer.from(JSON.stringify(m2, null, 2) + '\n'));
    f2.set('SHA256SUMS', Buffer.from([...f2.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(f2.get(p))}  ${p}`).join('\n') + '\n'));
    check(() => { const r = verifyFiles(f2); assert.equal(r.ok, false); assert.ok(r.failures.some(f => f.startsWith('totals')), 'a manifest claiming completeness with withheld entries fails'); });
    // Administrators and sandbox providers hold no patient scope: every patient-linked entry is withheld.
    for (const role of ['admin', 'provider']) {
      const b = await build({ ...member, role }), fs = readTar(Buffer.from(b.archive));
      check(() => { assert.equal(b.manifest.scope.patientsExported, 0, role); assert.equal(b.manifest.scope.entriesWithheld, 8, role); assert.equal(b.manifest.scope.complete, false); assert.deepEqual(leaks(fs), [], role); assert.equal(verifyFiles(fs).ok, true, role); });
    }
    d1.db.prepare('UPDATE memberships SET role=? WHERE org_id=? AND user_id=?').run('clinician', A, 'owner');
    // Archive paths: '..', '.' and empty segments are refused.
    check(() => { assert.equal(exit.safePath('tables/patients.jsonl'), true); for (const p of ['tables/../x', '../x', 'a//b', './x', 'tables/.', '/x', 'x/']) assert.equal(exit.safePath(p), false, p); });
    // scopeEntries keeps documents without patient links byte-identical (the data text is not re-serialised).
    check(() => { const ops = jsonl(files.get('tables/operations.jsonl')); const stored = d1.db.prepare('SELECT data FROM operations WHERE org_id=?').get(A); if (stored) assert.equal(ops[0].data, stored.data); });
  }

  // 2. Export audit: a patient save during the export no longer discards it; authority is re-checked.
  {
    const d1 = migrated(), now = new Date().toISOString(), actor = { userId: 'owner', displayName: 'Owner', email: 'x@example.invalid' };
    const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
    d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Owner', 'x@example.invalid', now);
    const A = 'org_race', w = seedWorkspace(now); for (const p of w.people) p.assignedTo = 'owner';
    await store.createState(d1, { organisation: { id: A, name: 'Race', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [member], invitations: [], workspace: w }, actor, 'createOrganisation');
    const load = async () => { const s = await store.readState(d1, A); store.scope(s, 'owner'); return s; };
    const concurrentSave = async village => { const part = await store.readState(d1, A, [w.people[0].id]); store.scope(part, 'owner'); const before = structuredClone(part); part.workspace.people.find(p => p.id === w.people[0].id).village = village; part.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Owner', actorId: 'owner', role: 'clinician', action: 'correctIdentity', subject: w.people[0].id, personId: w.people[0].id, detail: 'Synthetic concurrent save' }); return store.persist(d1, before, part, actor, { type: 'correctIdentity' }, 'k-' + crypto.randomUUID(), 'h', { ok: true }); };
    const owner = s => { const m = store.scope(s, 'owner'); if (!m.isOwner) { const e = new Error('Only an organisation owner can export.'); e.status = 403; throw e; } return m; };
    const record = (s, id, attempts) => audit.recordExportAudit(d1, { state: s, reload: load, authorize: owner, event: m => ({ id, at: now, actorId: 'owner', actor: 'Owner', role: m.role, action: 'organisationExport', subject: A, detail: `Export ${id}; archive SHA-256 ${'a'.repeat(64)}.` }), actor, type: 'organisationExport', key: 'export_' + id, hash: 'h', attempts });
    // Before 6p the export committed once against its start state: the reviewer's 409, kept as attempts=1.
    let s = await load(); await concurrentSave('Changed once');
    await statusOf(() => record(s, 'ev-single', 1), 409, /teammate changed this organisation/);
    s = await load(); await concurrentSave('Changed twice');
    const plan = await record(s, 'ev-retry');
    check(() => { assert.equal(plan.exportAttempts, 2, 'retried once on a fresh read'); assert.equal(d1.db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND id='ev-retry'").get(A).n, 1); assert.equal(d1.db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND id='ev-single'").get(A).n, 0); });
    check(() => assert.equal(JSON.parse(d1.db.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(A, w.people[0].id).data).village, 'Changed twice', 'the concurrent save is kept'));
    const v = await chain.verifyChain(d1, A);
    check(() => { assert.equal(v.status, 'intact', JSON.stringify(v)); assert.ok(v.head.seq >= 2); });
    // Authority is checked again on the fresh state: an owner demoted meanwhile gets no audit record and no export.
    s = await load();
    { const o = await load(), before = structuredClone(o); o.members[0].isOwner = false; o.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Owner', actorId: 'owner', role: 'clinician', action: 'updateMember', subject: 'owner', detail: 'Synthetic ownership removal' }); await store.persist(d1, before, o, actor, { type: 'updateMember' }, 'k-' + crypto.randomUUID(), 'h', { ok: true }); }
    await statusOf(() => record(s, 'ev-demoted'), 403, /owner/);
    check(() => assert.equal(d1.db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND id='ev-demoted'").get(A).n, 0));
    // Any conflict on every attempt is returned unchanged (bounded retries).
    let reloads = 0; s = await load(); const pristine = structuredClone(s);
    await concurrentSave('Changed thrice');
    await statusOf(() => audit.recordExportAudit(d1, { state: structuredClone(pristine), reload: async () => { reloads++; return structuredClone(pristine); }, authorize: x => store.scope(x, 'owner'), event: m => ({ id: 'ev-stale', at: now, actorId: 'owner', actor: 'Owner', role: m.role, action: 'organisationExport', subject: A, detail: 'x' }), actor, type: 'organisationExport', key: 'export_stale', hash: 'h' }), 409);
    check(() => assert.equal(reloads, audit.EXPORT_AUDIT_ATTEMPTS - 1));
    // The three export routes record their audit event through this helper and never call persist directly.
    check(() => { for (const f of ['data-exit-server', 'audit-chain-server', 'operations-server']) { const src = readFileSync(`lib/saha/${f}.ts`, 'utf8'); assert.match(src, /recordExportAudit\(db\(\),\{state:s,reload:\(\)=>loadFor\(u,orgId\)/, f); assert.doesNotMatch(src, /\bpersist\(/, f); } });
    // Slice 6q (second independent review): the audit-chain and operations export retries re-checked role and operator
    // status only. They now also refuse the export if the care scope or, for the operations CSV, the reporting reach changed.
    check(() => { audit.sameCareScope({ teamIds: ['a', 'b'] }, { teamIds: ['b', 'a'] }); audit.sameReach({ teams: ['a', 'b'], delegations: [{ id: 'd1' }] }, { teams: ['b', 'a'], delegations: [{ id: 'd1' }] }); });
    await statusOf(async () => audit.sameCareScope({ teamIds: ['a', 'b'] }, { teamIds: ['a'] }), 409, /care scope changed/);
    await statusOf(async () => audit.sameReach({ teams: ['a'], delegations: [{ id: 'd1' }] }, { teams: ['a'], delegations: [{ id: 'd2' }] }), 409, /reporting teams or delegations changed/);
    await statusOf(async () => audit.sameReach({ teams: ['a'], delegations: [] }, { teams: ['a', 'b'], delegations: [] }), 409, /reporting teams or delegations changed/);
    check(() => { const a = readFileSync('lib/saha/audit-chain-server.ts', 'utf8'), o = readFileSync('lib/saha/operations-server.ts', 'utf8'); assert.match(a, /const again=\(x:typeof s\)=>\{[^\n]*sameCareScope\(m,o\);return o;\};/); assert.match(o, /again=\(x:typeof s\)=>\{[^\n]*sameCareScope\(m,o\);if\(format==='csv'\)sameReach\(reach,reportingScope\(x,o\)\);return o;\};/); });
    // 5b. Audit-chain export visibility: the sandbox provider role, like administrators, sees patient events as digests only.
    d1.db.prepare('INSERT OR IGNORE INTO team_members (org_id,team_id,user_id) VALUES (?,?,?)').run(A, 'default', 'owner');
    const clin = await chain.exportRows(d1, A, { userId: 'owner', role: 'clinician' }, 0), prov = await chain.exportRows(d1, A, { userId: 'owner', role: 'provider' }, 0);
    check(() => { const linked = clin.lines.filter(l => l.event?.personId); assert.ok(linked.length >= 1, 'a clinician in the team sees patient-linked events'); assert.equal(prov.lines.filter(l => l.event?.personId).length, 0, 'a provider sees none'); assert.ok(prov.redacted >= linked.length); });
  }

  // 3. Fixture migration revert follows the reverting owner's care scope.
  {
    const now = '2026-09-30T08:00:00.000Z', w = seedWorkspace(now);
    w.people.forEach((p, i) => { p.teamId = i < 4 ? 'default' : 'north'; p.version = 1; });
    const owner = (userId, teamIds) => ({ userId, displayName: userId.toUpperCase(), role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds, createdAt: now });
    const A = owner('a', ['default', 'north']), B = owner('b', ['north']), C = owner('c', ['default']);
    const s = { organisation: { id: 'o', name: 'o', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'D' }, { id: 'north', name: 'N' }], members: [A, B, C], invitations: [], workspace: w };
    const u = m => ({ userId: m.userId, displayName: m.displayName });
    const flags = () => w.people.map(p => !!p.synthetic).join(',');
    // Reviewer's scenario: A marks team default only; B (north only) reverts. Before 6p: 6 reverted.
    { const only = structuredClone(s); only.members[0] = owner('a', ['default']); only.workspace.people.forEach(p => { p.teamId = 'default'; });
      const plan = await fm.planFixtureMarking(only, only.members[0]); const r = await fm.applyFixtureMark(only, { type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'Mark seeded fixtures now' }, u(A), only.members[0], now);
      await statusOf(() => fm.applyFixtureMark(only, { type: 'fixtureMarkRevert', batchId: r.batchId, reason: 'Reverse the batch please' }, u(B), B, now), 409, /No record marked by this batch is within your care scope/);
      check(() => { assert.equal(only.workspace.people.every(p => p.synthetic), true, 'every mark stays'); assert.equal(only.operations.fixtureBatches[0].revertedAt, undefined); }); }
    const plan = await fm.planFixtureMarking(s, A);
    const r = await fm.applyFixtureMark(s, { type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'Mark seeded fixtures now' }, u(A), A, now);
    check(() => assert.equal(r.marked, 6));
    const outside = structuredClone(w.people.slice(0, 4));
    const rb = await fm.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: r.batchId, reason: 'Reverse north records only' }, u(B), B, now);
    const batch = s.operations.fixtureBatches[0];
    check(() => { assert.deepEqual(rb, { batchId: r.batchId, reverted: 2, outOfScope: 4, complete: false }); assert.equal(flags(), 'true,true,true,true,false,false'); assert.equal(batch.revertedAt, undefined, 'partly reversed'); assert.equal(batch.reverted, 2); assert.deepEqual(batch.reverts.map(x => [x.by, x.reverted, x.outOfScope]), [['b', 2, 4]]); assert.match(s.workspace.audit.at(-1).detail, /partly reversed: 2 of 6 marks removed \(2 in this reverse\); 4 marked records outside the reverting owner's care scope keep their mark/); });
    check(() => assert.deepEqual(w.people.slice(0, 4), outside, 'records outside the reverting owner\'s scope are untouched'));
    await statusOf(() => fm.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: r.batchId, reason: 'Reverse north records again' }, u(B), B, now), 409, /No record marked by this batch is within your care scope/);
    const rc = await fm.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: r.batchId, reason: 'Reverse the default team remainder' }, u(C), C, now);
    check(() => { assert.deepEqual(rc, { batchId: r.batchId, reverted: 4, outOfScope: 0, complete: true }); assert.equal(flags(), 'false,false,false,false,false,false'); assert.equal(batch.revertedAt, now); assert.equal(batch.revertedBy, 'c'); assert.equal(batch.reverted, 6); assert.equal(batch.reverts.length, 2); });
    await statusOf(() => fm.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: r.batchId, reason: 'Reverse it a third time' }, u(A), A, now), 409, /already been reversed/);
  }

  // 5a. Delegation limit: only delegations still in force count; ended and revoked records stay stored.
  {
    const now = '2026-09-30T06:00:00.000Z', later = new Date(Date.parse(now) + 72 * 3600000).toISOString(), past = '2026-09-01T00:00:00.000Z';
    const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
    const s = { organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }], invitations: [],
      operations: { version: 1, maintenance: false, reason: '', updatedAt: now, incidents: [], rates: null, delegations: [] },
      members: [member('sup', 'supervisor', ['t1']), member('doc', 'clinician', ['t1'])],
      workspace: { schemaVersion: 1, revision: 1, role: 'supervisor', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [] } };
    const old = i => ({ id: 'old' + i, version: 2, kind: 'team-supervision', grantorId: 'sup', delegateId: 'gone' + i, teamIds: ['t1'], from: past, until: i % 2 ? past : later, reason: 'Synthetic historical delegation', createdAt: past, ...(i % 2 ? {} : { revokedAt: past, revokedBy: 'sup', revokeReason: 'Synthetic revocation' }) });
    for (let i = 0; i < dg.MAX_RECORDS; i++) s.operations.delegations.push(old(i));
    const as = id => { const m = s.members.find(x => x.userId === id); s.workspace.role = m.role; return m; };
    const grant = { type: 'delegationGrant', kind: 'team-supervision', delegateId: 'doc', teamIds: ['t1'], until: later, reason: 'Supervisor on leave this week' };
    const g = dg.applyDelegation(s, grant, { userId: 'sup', displayName: 'SUP' }, as('sup'), now);
    check(() => { assert.ok(g.delegationId, 'a grant succeeds after 200 ended or revoked records'); assert.equal(s.operations.delegations.length, dg.MAX_RECORDS + 1, 'old records are kept'); });
    const open = structuredClone(s); open.operations.delegations = Array.from({ length: dg.MAX_RECORDS }, (_, i) => ({ ...old(i), until: later, revokedAt: undefined, delegateId: 'gone' + i }));
    await statusOf(() => dg.applyDelegation(open, grant, { userId: 'sup', displayName: 'SUP' }, open.members[0], now), 422, /limit reached/);
    // Slice 6q (second independent review): ended and revoked records no longer count toward MAX_RECORDS, so the total
    // stored is capped separately (1,000); the refusal is clear and no stored record is deleted.
    check(() => assert.equal(dg.MAX_STORED, 1000));
    const full = structuredClone(s); full.operations.delegations = Array.from({ length: dg.MAX_STORED }, (_, i) => ({ ...old(i), until: past, revokedAt: undefined, delegateId: 'gone' + i }));
    await statusOf(async () => dg.applyDelegation(full, grant, { userId: 'sup', displayName: 'SUP' }, full.members[0], now), 422, /Stored delegation record limit reached \(1,000 records, kept as evidence\)/);
    check(() => assert.equal(full.operations.delegations.length, dg.MAX_STORED, 'no evidence deleted'));
    check(() => assert.equal(typeof allowed, 'function'));
  }
  const result = { suite: 'review fixes contract (slice 6p)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
