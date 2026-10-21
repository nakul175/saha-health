// Slice 2d fixture-marking migration contract: dry-run counts and reasons, a plan hash bound to record
// versions, apply of that exact plan, batch record and audit, reversal, revision lineage through the real
// store and migrations with an intact audit chain, and the slice 6n barrier covering the marked records.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.fixture-migration-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, e => pattern.test(e.message)); passed++; };
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
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'fixture-migration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const F = await import(pathToFileURL(join(dir, 'fixture-migration.js')));
  const E = await import(pathToFileURL(join(dir, 'environment.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const now = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const owner = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  // Fixtures seeded before slice 6n: unmarked. Kamla is in another team, Rajesh was renamed, Sunita is already marked.
  const makeState = orgId => { const w = seedWorkspace(now); for (const p of w.people) { p.teamId = 'default'; p.assignedTo = 'owner'; }
    w.people.find(p => p.id === 'p_kamla').teamId = 'north'; w.people.find(p => p.id === 'p_rajesh').name = 'Rajesh Kumar Singh'; w.people.find(p => p.id === 'p_sunita').synthetic = true;
    w.people.push({ ...structuredClone(w.people[0]), id: 'p_registered', name: 'Registered Person' });
    return { organisation: { id: orgId, name: 'Migration organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner], invitations: [], workspace: w }; };

  // 1. Dry run: counts, reasons and ids only.
  let s = makeState('org_mig_a'), plan = await F.planFixtureMarking(s, owner);
  check(() => { assert.equal(plan.migration, 'mark-seeded-fixtures-v1'); assert.equal(plan.examined, 7); assert.equal(plan.fixtureIds, 6); assert.deepEqual(plan.candidates.map(c => c.personId).sort(), ['p_aarav', 'p_farida', 'p_meena']); assert.deepEqual(plan.rejected.map(r => r.personId), ['p_rajesh']); assert.match(plan.rejected[0].reason, /review before marking/); assert.equal(plan.alreadyMarked, 1); assert.equal(plan.outOfScope, 1); assert.match(plan.planHash, /^[0-9a-f]{64}$/); });
  check(() => { const text = JSON.stringify(plan); for (const name of ['Meena Devi', 'Rajesh Kumar', 'Aarav Singh', 'Kamla Devi']) assert.equal(text.includes(name), false, name); });
  // 2. The plan hash is stable and bound to record versions.
  const again = await F.planFixtureMarking(makeState('org_mig_a'), owner);
  check(() => assert.equal(again.planHash, plan.planHash));
  const bumped = makeState('org_mig_a'); bumped.workspace.people.find(p => p.id === 'p_meena').version = 2;
  const bumpedPlan = await F.planFixtureMarking(bumped, owner);
  check(() => assert.notEqual(bumpedPlan.planHash, plan.planHash));
  await rejects(() => F.applyFixtureMark(bumped, { type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'Mark fixtures seeded before 6n' }, actor, owner, now), /Records changed since the dry run/);
  // 3. Only owners; command validation.
  await rejects(() => F.applyFixtureMark(makeState('org_mig_a'), { type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'Mark fixtures seeded before 6n' }, actor, { ...owner, isOwner: false }, now), /Only an organisation owner/);
  check(() => { assert.equal(F.fixtureMarkSchema.safeParse({ type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'short' }).success, false); assert.equal(F.fixtureMarkSchema.safeParse({ type: 'fixtureMarkApply', planHash: 'x', reason: 'Long enough reason' }).success, false); });
  const other = await F.applyFixtureMark(makeState('x'), { type: 'somethingElse' }, actor, owner, now);
  check(() => assert.equal(other, null, 'other commands are not handled'));
  // 4. Apply marks exactly the plan's records and records a batch and an audit event.
  const applied = await F.applyFixtureMark(s, { type: 'fixtureMarkApply', planHash: plan.planHash, reason: 'Mark fixtures seeded before 6n' }, actor, owner, now);
  const byId = id => s.workspace.people.find(p => p.id === id);
  check(() => { assert.equal(applied.marked, 3); assert.equal(applied.rejected, 1); for (const id of ['p_meena', 'p_aarav', 'p_farida']) { assert.equal(byId(id).synthetic, true); assert.equal(byId(id).syntheticMark.batchId, applied.batchId); } for (const id of ['p_rajesh', 'p_kamla', 'p_registered']) assert.equal(byId(id).synthetic, undefined); assert.equal(byId('p_sunita').syntheticMark, undefined); });
  check(() => { const b = s.operations.fixtureBatches[0]; assert.deepEqual({ marked: b.marked, rejected: b.rejected, alreadyMarked: b.alreadyMarked, outOfScope: b.outOfScope, examined: b.examined, planHash: b.planHash }, { marked: 3, rejected: 1, alreadyMarked: 1, outOfScope: 1, examined: 7, planHash: plan.planHash }); const a = s.workspace.audit.at(-1); assert.equal(a.action, 'fixtureMarkApply'); assert.match(a.detail, /7 records examined, 3 marked as synthetic fixtures, 1 rejected for review, 1 already marked, 1 outside the owner's care scope/); assert.ok(a.detail.includes(plan.planHash)); });
  // 5. The slice 6n barrier now covers the marked records.
  check(() => { assert.throws(() => E.ensureEnvironment(s, { type: 'executeEhrPublish', personId: 'p_meena', operationId: 'o', hash: 'h' }, { SAHA_ENVIRONMENT: 'production' }), /Synthetic fixture records/); assert.doesNotThrow(() => E.ensureEnvironment(s, { type: 'executeEhrPublish', personId: 'p_rajesh', operationId: 'o', hash: 'h' }, { SAHA_ENVIRONMENT: 'production' })); });
  // 6. A second dry run finds nothing left; applying it is refused.
  const after = await F.planFixtureMarking(s, owner);
  check(() => { assert.equal(after.candidates.length, 0); assert.equal(after.alreadyMarked, 4); assert.equal(after.rejected.length, 1); });
  await rejects(() => F.applyFixtureMark(s, { type: 'fixtureMarkApply', planHash: after.planHash, reason: 'Nothing left to mark' }, actor, owner, now), /found no records to mark/);
  // 7. Reversal removes this batch's marks only, once; the dry run then matches the original plan again.
  const reverted = await F.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: applied.batchId, reason: 'Reverse to review the rejected record first' }, actor, owner, now);
  check(() => { assert.equal(reverted.reverted, 3); for (const id of ['p_meena', 'p_aarav', 'p_farida']) { assert.equal(byId(id).synthetic, undefined); assert.equal(byId(id).syntheticMark, undefined); } assert.equal(byId('p_sunita').synthetic, true, 'marks from seeding are not touched'); assert.ok(s.operations.fixtureBatches[0].revertedAt); assert.match(s.workspace.audit.at(-1).detail, /3 of 3 marks removed/); });
  await rejects(() => F.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: applied.batchId, reason: 'Reverse a second time' }, actor, owner, now), /already been reversed/);
  await rejects(() => F.applyFixtureMark(s, { type: 'fixtureMarkRevert', batchId: 'missing', reason: 'Reverse a missing batch' }, actor, owner, now), /batch not found/);
  const replanned = await F.planFixtureMarking(s, owner);
  check(() => assert.equal(replanned.planHash, plan.planHash, 'with unchanged versions the reversed state gives the original plan'));

  // 8. Through the real store: one revision per marked record with the reason (lineage), an intact chain, and reversal.
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const B = 'org_mig_b'; await store.createState(d1, makeState(B), actor, 'createOrganisation');
  const load = async () => { const x = await store.readState(d1, B); store.scope(x, 'owner'); return x; };
  const commit = async c => { const before = await load(), next = structuredClone(before); const result = await F.applyFixtureMark(next, c, actor, owner); await store.persist(d1, before, next, actor, c, crypto.randomUUID(), 'hash', result); return result; };
  const bPlan = await F.planFixtureMarking(await load(), owner);
  const bApplied = await commit({ type: 'fixtureMarkApply', planHash: bPlan.planHash, reason: 'Mark fixtures seeded before 6n' });
  const revisions = action => d1.db.prepare('SELECT entity_id,reason,changes FROM record_revisions WHERE org_id=? AND action=? ORDER BY entity_id').all(B, action);
  check(() => { const r = revisions('fixtureMarkApply'); assert.deepEqual(r.map(x => x.entity_id), ['p_aarav', 'p_farida', 'p_meena']); assert.ok(r.every(x => x.reason === 'Mark fixtures seeded before 6n')); assert.ok(r.every(x => JSON.parse(x.changes).some(c => c.field === 'synthetic' && c.after === 'true'))); });
  check(() => { const rows = d1.db.prepare('SELECT id,version,data FROM patients WHERE org_id=? ORDER BY id').all(B); const meena = rows.find(r => r.id === 'p_meena'); assert.equal(JSON.parse(meena.data).syntheticMark.batchId, bApplied.batchId); assert.equal(meena.version, 2, 'marking is a new record version'); assert.equal(JSON.parse(rows.find(r => r.id === 'p_rajesh').data).synthetic, undefined); });
  // The persisted plan no longer matches: versions moved, so an old dry run cannot be replayed.
  await rejects(() => commit({ type: 'fixtureMarkApply', planHash: bPlan.planHash, reason: 'Replay the old dry run' }), /Records changed since the dry run|found no records/);
  await commit({ type: 'fixtureMarkRevert', batchId: bApplied.batchId, reason: 'Reverse through the store' });
  check(() => { assert.equal(revisions('fixtureMarkRevert').length, 3); assert.equal(d1.db.prepare("SELECT count(*) AS n FROM patients WHERE org_id=? AND json_extract(data,'$.syntheticMark') IS NOT NULL").get(B).n, 0); const ops = JSON.parse(d1.db.prepare('SELECT data FROM operations WHERE org_id=?').get(B).data); assert.equal(ops.fixtureBatches[0].reverted, 3); assert.equal(JSON.stringify(ops).includes('p_meena'), false, 'batch records hold counts, not record ids'); });
  const v = await chain.verifyChain(d1, B);
  check(() => { assert.equal(v.status, 'intact'); assert.deepEqual(d1.db.prepare("SELECT action FROM audit_events WHERE org_id=? AND action LIKE 'fixtureMark%' ORDER BY seq").all(B).map(r => r.action), ['fixtureMarkApply', 'fixtureMarkRevert']); });

  const result = { suite: 'fixture migration contract (slice 2d)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/fixture-migration-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
