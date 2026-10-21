// Slice 0a storage contract: patient-partitioned reads and the two commit guards, run against
// the real migrations in an in-memory SQLite database through a minimal D1-compatible shim.
// Deterministic interleavings that HTTP timing cannot guarantee are exercised here.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.storage-contract-'));
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
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const w = seedWorkspace(now);
  for (const p of w.people) { p.version = 1; p.teamId = 'default'; p.assignedTo = 'owner'; }
  w.visits = w.people.slice(0, 3).map((p, i) => ({ id: `visit-${i}`, personId: p.id, version: 1, state: 'draft', facts: { date: '2026-09-29T08:00', systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' }, createdAt: now, aiResults: [], recordVersion: 1 }));
  const orgId = 'org_storage_contract';
  const state = { organisation: { id: orgId, name: 'Storage contract organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [{ userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now }], invitations: [], workspace: w };
  await store.createState(d1, state, actor, 'createOrganisation');
  const [a, b, c] = w.people.map(p => p.id);
  const org = () => d1.db.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(orgId);
  const rev = id => d1.db.prepare('SELECT rev FROM patients WHERE org_id=? AND id=?').get(orgId, id).rev;
  const visitData = id => JSON.parse(d1.db.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(orgId, id).data);
  const load = async ids => { const s = await store.readState(d1, orgId, ids); store.scope(s, 'owner'); return s; };
  const save = (s, visitId, weight) => { const after = structuredClone(s); const v = after.workspace.visits.find(x => x.id === visitId); v.facts = { ...v.facts, weight }; v.version++; after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'saveVisit', subject: visitId, detail: '' }); return after; };
  const commit = (before, after, type = 'saveVisit') => store.persist(d1, before, after, actor, { type }, crypto.randomUUID(), 'hash', { ok: true });

  // Partitioned reads return only the named patients and their records.
  const full = await load(), part = await load([a]);
  check(() => { assert.equal(full.workspace.people.length, w.people.length); assert.equal(full.partition, undefined); });
  check(() => { assert.deepEqual(part.workspace.people.map(p => p.id), [a]); assert.deepEqual(part.workspace.visits.map(v => v.id), ['visit-0']); assert.deepEqual(part.partition, [a]); assert.equal(part.patientRevs[a], 0); });
  check(() => { assert.deepEqual(part.members, full.members); assert.deepEqual(part.teams, full.teams); assert.equal(part.organisation.patientRevision, 0); });

  // Guard selection.
  const plan = (before, after, type, team = false) => store.commitPlan(before, after, type, store.rowsForState(after, before, actor, type, '', now), team, false);
  check(() => assert.deepEqual(plan(part, save(part, 'visit-0', '51'), 'saveVisit').patients, [a]));
  check(() => assert.equal(plan(part, save(part, 'visit-0', '51'), 'createPerson').patients, null));
  check(() => assert.equal(plan(full, save(full, 'visit-0', '51'), 'saveVisit').patients, null));
  check(() => { const after = save(part, 'visit-0', '51'); after.teams.push({ id: 'new', name: 'New team', createdAt: now }); assert.match(plan(part, after, 'saveVisit').reason, /teams/); });
  check(() => assert.equal(plan(part, save(part, 'visit-0', '51'), 'saveVisit', true).patients, null));

  // Two patients committed from states read before either commit: both succeed.
  const pa = await load([a]), pb = await load([b]), o0 = org();
  await commit(pa, save(pa, 'visit-0', '51'));
  await commit(pb, save(pb, 'visit-1', '61'));
  check(() => { const o1 = org(); assert.equal(o1.revision, o0.revision); assert.equal(o1.patient_revision, o0.patient_revision + 2); assert.equal(rev(a), 1); assert.equal(rev(b), 1); assert.equal(rev(c), 0); });
  check(() => { assert.equal(visitData('visit-0').facts.weight, '51'); assert.equal(visitData('visit-1').facts.weight, '61'); });

  // Same patient from the same read: the second commit is refused and writes nothing.
  const s1 = await load([a]), s2 = await load([a]);
  await commit(s1, save(s1, 'visit-0', '52'));
  const revisionsBefore = d1.db.prepare('SELECT count(*) AS n FROM record_revisions').get().n, receiptsBefore = d1.db.prepare('SELECT count(*) AS n FROM command_receipts').get().n;
  await rejects(() => commit(s2, save(s2, 'visit-0', '99')), /patient record/);
  check(() => { assert.equal(visitData('visit-0').facts.weight, '52'); assert.equal(rev(a), 2); assert.equal(d1.db.prepare('SELECT count(*) AS n FROM record_revisions').get().n, revisionsBefore); assert.equal(d1.db.prepare('SELECT count(*) AS n FROM command_receipts').get().n, receiptsBefore); });

  // An organisation-level commit invalidates a patient-scoped write read before it.
  const stale = await load([c]), orgRead = await load();
  const withTeam = structuredClone(orgRead); withTeam.teams.push({ id: 'team-2', name: 'Second care team', createdAt: now });
  await commit(orgRead, withTeam, 'createTeam');
  check(() => assert.equal(org().revision, o0.revision + 1));
  await rejects(() => commit(stale, save(stale, 'visit-2', '71')), /patient record/);
  check(() => assert.equal(visitData('visit-2').facts.weight, ''));

  // An organisation-wide commit read before a patient-scoped commit is refused (it may have
  // decided from the patient data that has since changed).
  const wide = await load(), narrow = await load([b]);
  await commit(narrow, save(narrow, 'visit-1', '62'));
  const wideAfter = structuredClone(wide); wideAfter.teams.push({ id: 'team-3', name: 'Third care team', createdAt: now });
  await rejects(() => commit(wide, wideAfter, 'createTeam'), /organisation/);
  check(() => assert.equal(d1.db.prepare("SELECT count(*) AS n FROM teams WHERE org_id=? AND id='team-3'").get(orgId).n, 0));

  // An uncertified command on a partitioned read still takes the organisation-wide guard.
  const u1 = await load([c]), u2 = await load([b]);
  await commit(u1, save(u1, 'visit-2', '72'), 'reportSafety');
  await rejects(() => commit(u2, save(u2, 'visit-1', '63'), 'reportSafety'), /organisation/);

  // Diffing is linear: 20,000 people with one change.
  const big = structuredClone(full); big.workspace.people = Array.from({ length: 20000 }, (_, i) => ({ ...w.people[0], id: `bulk-${i}`, name: `Bulk ${i}` }));
  const bigAfter = structuredClone(big); bigAfter.workspace.people[19999].village = 'Changed';
  const t = performance.now(); const rows = store.rowsForState(bigAfter, big, actor, 'correctIdentity', '', now); const elapsed = performance.now() - t;
  check(() => { assert.equal(rows.filter(r => r.table === 'patients').length, 1); assert.ok(elapsed < 5000, `diff took ${elapsed} ms`); });

  const result = { suite: 'storage contract (slice 0a)', passed, diffMsFor20000People: Math.round(elapsed), completedAt: new Date().toISOString() };
  writeFileSync('tests/storage-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
