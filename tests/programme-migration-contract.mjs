// Slice 4e programme-pack migration contract: what a newer pack version changes, a dry run over open episodes on
// older versions in the reviewer's care scope (candidates, blocked with reasons, out of scope), a plan hash bound
// to record versions, apply of that exact plan with episode history and adoption for new episodes, confirmed visits
// untouched, and revision lineage through the real store and migrations with an intact audit chain.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.programme-migration-contract-'));
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
  for (const f of ['programme-migration', 'programme-commands', 'environment', 'identity', 'operations', 'referral-rules', 'store', 'partition', 'access', 'adapter-operations','core', 'fact-provenance', 'delegation', 'mis', 'programmes', 'seed', 'types', 'audit-chain'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const M = await import(pathToFileURL(join(dir, 'programme-migration.js')));
  const P = await import(pathToFileURL(join(dir, 'programmes.js')));
  const C = await import(pathToFileURL(join(dir, 'programme-commands.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const now = '2026-10-01T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const owner = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  const v1 = P.packAt('maternal', 1), v2 = P.packAt('maternal', 2);
  const episode = (id, packId = 'maternal', packVersion = 1, state = 'active') => ({ id, packId, packVersion, state, episodeLabel: 'Synthetic episode label', startDate: null, createdAt: now, createdBy: 'owner', registration: 'not_submitted' });
  const capture = (enrolmentId, pack) => ({ packs: [{ enrolmentId, pack: structuredClone(pack) }], answers: { maternal_contact: 'Yes' }, absence: {} });
  // Meena and Aarav can move; Farida has an open visit capturing her episode; Rajesh's processing is restricted;
  // Kamla is in another team; Sunita's maternal episode is closed and her TB pack has no newer version.
  const makeState = orgId => { const w = seedWorkspace(now); for (const p of w.people) { p.teamId = 'default'; p.assignedTo = 'owner'; p.enrolments = []; p.followUps = []; }
    const by = id => w.people.find(p => p.id === id);
    by('p_meena').enrolments.push(episode('e_meena')); by('p_meena').followUps.push({ id: 't_meena', enrolmentId: 'e_meena', packId: 'maternal', title: 'Synthetic follow-up', due: '2026-10-10', ownerId: 'owner', state: 'open', createdAt: now, createdBy: 'owner' });
    by('p_aarav').enrolments.push(episode('e_aarav'));
    by('p_farida').enrolments.push(episode('e_farida'));
    by('p_rajesh').enrolments.push(episode('e_rajesh')); by('p_rajesh').restrictions = [{ requestId: 'r1', from: now, by: 'owner' }];
    by('p_kamla').enrolments.push(episode('e_kamla')); by('p_kamla').teamId = 'north';
    by('p_sunita').enrolments.push(episode('e_sunita_old', 'maternal', 1, 'closed'), episode('e_sunita_tb', 'tb'));
    w.visits = [
      { id: 'v_meena', personId: 'p_meena', version: 2, state: 'confirmed', facts: {}, createdAt: now, aiResults: [], recordVersion: 1, programmeCapture: capture('e_meena', v1) },
      { id: 'v_farida', personId: 'p_farida', version: 1, state: 'draft', facts: {}, createdAt: now, aiResults: [], recordVersion: 1, programmeCapture: capture('e_farida', v1) },
    ];
    return { organisation: { id: orgId, name: 'Pack migration organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner], invitations: [], workspace: w }; };

  // 1. The catalogue and what v2 changes against v1.
  check(() => { assert.equal(P.latestVersion('maternal'), 2); assert.equal(P.latestVersion('tb'), 1); assert.equal(P.adoptedVersion({}, 'maternal'), 1); assert.equal(P.adoptedVersion({ operations: { packVersions: { maternal: 9 } } }, 'maternal'), 1, 'an unknown adopted version falls back to v1'); });
  const diff = M.packChanges(v1, v2);
  check(() => { assert.equal(diff.reviewedMapping, true); assert.deepEqual(diff.added, [{ id: 'danger_signs_reviewed', required: true }]); assert.deepEqual(diff.removed, []); assert.deepEqual(diff.renamed, [{ from: 'maternal_contact', to: 'appointment_discussed', relabelled: true }]); assert.deepEqual(diff.redefined, []); assert.equal(diff.schedule.changed, true); assert.equal(diff.schedule.from, null); assert.equal(diff.escalation.changed, true); assert.match(diff.note, /not clinically approved/); });
  // Reversal is not a reviewed mapping: v1 declares no mapping from v2, and the renamed question reads as removed and added.
  const back = M.packChanges(v2, v1);
  check(() => { assert.equal(back.reviewedMapping, false); assert.deepEqual(back.removed.sort(), ['appointment_discussed', 'danger_signs_reviewed']); assert.deepEqual(back.added, [{ id: 'maternal_contact', required: true }]); });

  // 2. Dry run: counts, blocked reasons, ids only.
  let s = makeState('org_pm_a');
  check(() => assert.deepEqual(M.migratablePacks(s), ['maternal']));
  let plan = await M.planProgrammeMigration(s, owner, 'maternal');
  check(() => { assert.equal(plan.targetVersion, 2); assert.equal(plan.adoptedVersion, 1); assert.equal(plan.adopts, true); assert.equal(plan.examined, 5); assert.equal(plan.outOfScope, 1); assert.deepEqual(plan.candidates.map(c => c.enrolmentId).sort(), ['e_aarav', 'e_meena']); assert.deepEqual(Object.fromEntries(plan.blocked.map(b => [b.enrolmentId, b.code])), { e_farida: 'open-visit', e_rajesh: 'restricted' }); assert.match(plan.planHash, /^[0-9a-f]{64}$/); assert.equal(plan.changes.length, 1); });
  check(() => { const meena = plan.candidates.find(c => c.enrolmentId === 'e_meena'); assert.deepEqual({ openFollowUps: meena.openFollowUps, keptVisits: meena.keptVisits, fromVersion: meena.fromVersion, version: meena.version }, { openFollowUps: 1, keptVisits: 1, fromVersion: 1, version: 1 }); assert.match(plan.blocked.find(b => b.code === 'open-visit').reason, /confirm or discard it/); });
  check(() => { const text = JSON.stringify(plan); for (const name of ['Meena Devi', 'Aarav Singh', 'Farida Begum', 'Rajesh Kumar', 'Kamla Devi', 'Synthetic episode label']) assert.equal(text.includes(name), false, name); });
  // Defensive blockers: an episode version missing from the catalogue, and a target without a reviewed mapping.
  check(() => { const p = s.workspace.people.find(x => x.id === 'p_aarav'); assert.equal(M.episodeBlocker(s, p, { id: 'e_aarav', packVersion: 0 }, v2).code, 'unknown-version'); assert.equal(M.episodeBlocker(s, p, { id: 'e_aarav', packVersion: 1 }, { ...v2, migratesFrom: [] }).code, 'no-reviewed-mapping'); assert.equal(M.episodeBlocker(s, p, { id: 'e_aarav', packVersion: 1 }, v2), null); assert.equal(M.episodeBlocker(s, { ...p, mergedInto: { personId: 'p_meena', caseId: 'k1', at: now } }, { id: 'e_aarav', packVersion: 1 }, v2).code, 'merged', 'a merged record is left to the merge impact queue'); });

  // 3. The plan hash is stable and bound to record versions; stale plans, wrong targets and other roles are refused.
  const again = await M.planProgrammeMigration(makeState('org_pm_a'), owner, 'maternal');
  check(() => assert.equal(again.planHash, plan.planHash));
  const bumped = makeState('org_pm_a'); bumped.workspace.people.find(p => p.id === 'p_meena').version = 2;
  const bumpedPlan = await M.planProgrammeMigration(bumped, owner, 'maternal');
  check(() => assert.notEqual(bumpedPlan.planHash, plan.planHash));
  const cmd = (planHash, extra = {}) => ({ type: 'programmeMigrationApply', packId: 'maternal', targetVersion: 2, planHash, reason: 'Move open maternal episodes to v2', ...extra });
  await rejects(() => M.applyProgrammeMigration(bumped, cmd(plan.planHash), actor, owner, now), /Episodes changed since the dry run/);
  await rejects(() => M.applyProgrammeMigration(makeState('org_pm_a'), cmd(plan.planHash, { targetVersion: 1 }), actor, owner, now), /different version is now the latest/);
  for (const role of ['asha', 'supervisor', 'admin']) await rejects(() => M.applyProgrammeMigration(makeState('org_pm_a'), cmd(plan.planHash), actor, { ...owner, isOwner: false, role }, now), /Only an organisation owner or a clinician/);
  await rejects(() => M.applyProgrammeMigration(makeState('org_pm_a'), cmd(plan.planHash), actor, { ...owner, status: 'suspended' }, now), /Only an organisation owner or a clinician/);
  check(() => { assert.equal(M.programmeMigrationSchema.safeParse(cmd(plan.planHash, { reason: 'short' })).success, false); assert.equal(M.programmeMigrationSchema.safeParse(cmd('x')).success, false); assert.equal(M.programmeMigrationSchema.safeParse(cmd(plan.planHash, { packId: 'Child pack' })).success, false, 'slice 4f: any pack id slug parses; an id outside the catalogue is refused on apply'); assert.equal(M.programmeMigrationSchema.safeParse({ ...cmd(plan.planHash), extra: 1 }).success, false); });
  const other = await M.applyProgrammeMigration(makeState('x'), { type: 'somethingElse' }, actor, owner, now);
  check(() => assert.equal(other, null, 'other commands are not handled'));
  // A clinician who is not an owner sees only their care scope and does not change the version new episodes open on.
  const north = { ...owner, userId: 'north-clinician', isOwner: false, teamIds: ['north'] };
  const northPlan = await M.planProgrammeMigration(makeState('org_pm_a'), north, 'maternal');
  check(() => { assert.deepEqual(northPlan.candidates.map(c => c.enrolmentId), ['e_kamla']); assert.equal(northPlan.outOfScope, 4); assert.equal(northPlan.adopts, false); assert.match(northPlan.adoptionNote, /until an owner applies/); });
  const ns = makeState('org_pm_a'), northApplied = await M.applyProgrammeMigration(ns, cmd(northPlan.planHash), { ...actor, userId: 'north-clinician' }, north, now);
  check(() => { assert.deepEqual([northApplied.migrated, northApplied.adopted], [1, false]); assert.equal(ns.operations.packVersions, undefined); assert.equal(ns.workspace.people.find(p => p.id === 'p_kamla').enrolments[0].packVersion, 2); assert.equal(ns.workspace.people.find(p => p.id === 'p_meena').enrolments[0].packVersion, 1); });

  // 4. Apply moves exactly the plan's episodes, keeps visits and follow-ups, adopts v2 and records one batch and audit event.
  const visitBefore = structuredClone(s.workspace.visits);
  const applied = await M.applyProgrammeMigration(s, cmd(plan.planHash), actor, owner, now);
  const by = id => s.workspace.people.find(p => p.id === id);
  check(() => { assert.deepEqual({ migrated: applied.migrated, blocked: applied.blocked, outOfScope: applied.outOfScope, adopted: applied.adopted }, { migrated: 2, blocked: 2, outOfScope: 1, adopted: true }); assert.equal(JSON.stringify(applied).includes('p_'), false, 'the stored result carries counts, not record ids'); });
  check(() => { for (const id of ['p_meena', 'p_aarav']) { const e = by(id).enrolments[0]; assert.equal(e.packVersion, 2); assert.deepEqual({ ...e.migrations[0], at: undefined }, { batchId: applied.batchId, from: 1, to: 2, at: undefined, by: 'owner', reason: 'Move open maternal episodes to v2', planHash: plan.planHash }); assert.deepEqual(by(id).packMigration, { batchId: applied.batchId, enrolmentId: e.id, packId: 'maternal', from: 1, to: 2, at: now }); assert.equal(by(id).version, 2); } for (const id of ['p_farida', 'p_rajesh', 'p_kamla']) { assert.equal(by(id).enrolments[0].packVersion, 1); assert.equal(by(id).enrolments[0].migrations, undefined); assert.equal(by(id).version, 1); } assert.equal(by('p_sunita').enrolments[0].packVersion, 1, 'closed episodes keep their version'); });
  check(() => { assert.deepEqual(s.workspace.visits, visitBefore, 'no visit is rewritten'); assert.equal(s.workspace.visits.find(v => v.id === 'v_meena').programmeCapture.packs[0].pack.version, 1); assert.equal(by('p_meena').followUps[0].state, 'open'); });
  check(() => { assert.equal(s.operations.packVersions.maternal, 2); const b = s.operations.programmeMigrations[0]; assert.deepEqual({ packId: b.packId, fromVersions: b.fromVersions, toVersion: b.toVersion, examined: b.examined, migrated: b.migrated, blocked: b.blocked, outOfScope: b.outOfScope, adopted: b.adopted, previousAdopted: b.previousAdopted, planHash: b.planHash }, { packId: 'maternal', fromVersions: [1], toVersion: 2, examined: 5, migrated: 2, blocked: 2, outOfScope: 1, adopted: true, previousAdopted: 1, planHash: plan.planHash }); const a = s.workspace.audit.at(-1); assert.equal(a.action, 'programmeMigrationApply'); assert.match(a.detail, /5 open episodes on older versions examined, 2 migrated, 2 left on their version for manual action, 1 outside the applier's care scope\. New episodes now open on v2 \(previously v1\)/); });
  // New episodes now open on v2 and a new visit captures the v2 questions.
  check(() => { const p = by('p_aarav'); p.enrolments = []; C.programmeApply(s, { type: 'enrolProgramme', personId: 'p_aarav', version: p.version, packId: 'maternal', episodeLabel: 'Synthetic second episode', startDate: null }, actor, owner); assert.equal(p.enrolments[0].packVersion, 2); assert.ok(P.captureFor(p.enrolments).packs[0].pack.questions.some(q => q.id === 'danger_signs_reviewed')); });
  // 5. A second dry run lists only the blocked episodes; once Farida's visit is confirmed she becomes a candidate.
  const after = await M.planProgrammeMigration(s, owner, 'maternal');
  check(() => { assert.equal(after.candidates.length, 0); assert.equal(after.blocked.length, 2); assert.equal(after.adopts, false); assert.match(after.adoptionNote, /already open on v2/); });
  await rejects(() => M.applyProgrammeMigration(s, cmd(after.planHash), actor, owner, now), /found nothing to migrate/);
  s.workspace.visits.find(v => v.id === 'v_farida').state = 'confirmed';
  const later = await M.planProgrammeMigration(s, owner, 'maternal');
  check(() => { assert.deepEqual(later.candidates.map(c => c.enrolmentId), ['e_farida']); assert.notEqual(later.planHash, after.planHash); assert.equal(later.candidates[0].keptVisits, 1); });

  // 6. Through the real store: one revision per migrated episode with the reason and versions, visits untouched, chain intact.
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner@example.invalid', now);
  const B = 'org_pm_b'; await store.createState(d1, makeState(B), actor, 'createOrganisation');
  const load = async () => { const x = await store.readState(d1, B); store.scope(x, 'owner'); return x; };
  const commit = async c => { const before = await load(), next = structuredClone(before); const result = await M.applyProgrammeMigration(next, c, actor, owner); await store.persist(d1, before, next, actor, c, crypto.randomUUID(), 'hash', result); return result; };
  const bPlan = await M.planProgrammeMigration(await load(), owner, 'maternal');
  const visitRevisions = () => d1.db.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_type='visit'").get(B).n;
  const visitsBefore = visitRevisions();
  const bApplied = await commit(cmd(bPlan.planHash));
  const revisions = d1.db.prepare("SELECT entity_id,reason,changes,data FROM record_revisions WHERE org_id=? AND action='programmeMigrationApply' ORDER BY entity_id").all(B);
  check(() => { assert.deepEqual(revisions.map(r => r.entity_id), ['p_aarav', 'p_meena']); assert.ok(revisions.every(r => r.reason === 'Move open maternal episodes to v2')); for (const r of revisions) { const ch = JSON.parse(r.changes); assert.ok(ch.some(c => c.field === 'packMigration.from' && c.after === '1')); assert.ok(ch.some(c => c.field === 'packMigration.to' && c.after === '2')); assert.equal(JSON.parse(r.data).enrolments[0].migrations[0].batchId, bApplied.batchId); } });
  check(() => { assert.equal(visitRevisions(), visitsBefore, 'no visit revision is written'); const v = JSON.parse(d1.db.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(B, 'v_meena').data); assert.equal(v.programmeCapture.packs[0].pack.version, 1); const ops = JSON.parse(d1.db.prepare('SELECT data FROM operations WHERE org_id=?').get(B).data); assert.equal(ops.packVersions.maternal, 2); assert.equal(ops.programmeMigrations[0].migrated, 2); assert.equal(JSON.stringify(ops).includes('p_meena'), false, 'batch records hold counts, not record ids'); });
  // The persisted versions moved, so the old dry run cannot be replayed.
  await rejects(() => commit(cmd(bPlan.planHash, { reason: 'Replay the old dry run' })), /Episodes changed since the dry run/);
  const v = await chain.verifyChain(d1, B);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(d1.db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='programmeMigrationApply'").get(B).n, 1); });

  const result = { suite: 'programme migration contract (slice 4e)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/programme-migration-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
