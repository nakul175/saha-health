// Slice 4f pack installation contract: a strict data-only manifest schema and structural checks, conflicts with the
// compiled and installed catalogue, owner staging, independent clinician review of the exact manifest, owner activation,
// episodes opening only on activated versions, 4e migration to an installed version through a declared mapping, retirement
// without deletion, and persistence through the real store with an intact audit chain.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.pack-installation-contract-'));
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
  for (const f of ['pack-installation', 'programme-migration', 'programme-commands', 'environment', 'identity', 'operations', 'referral-rules', 'store', 'partition', 'access', 'core', 'fact-provenance', 'delegation', 'mis', 'programmes', 'seed', 'types', 'audit-chain'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const I = await import(pathToFileURL(join(dir, 'pack-installation.js')));
  const M = await import(pathToFileURL(join(dir, 'programme-migration.js')));
  const P = await import(pathToFileURL(join(dir, 'programmes.js')));
  const C = await import(pathToFileURL(join(dir, 'programme-commands.js')));
  const core = await import(pathToFileURL(join(dir, 'core.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const now = '2026-10-01T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const reviewerActor = { userId: 'clin2', displayName: 'Synthetic reviewer', email: 'clin2@example.invalid' };
  const owner = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  const reviewer = { ...owner, userId: 'clin2', accountCode: 'CODE0000000000000000000B', displayName: 'Synthetic reviewer', isOwner: false };
  const asha = { ...owner, userId: 'asha1', accountCode: 'CODE0000000000000000000C', displayName: 'Synthetic ASHA', role: 'asha', isOwner: false };
  const makeState = orgId => { const w = seedWorkspace(now); for (const p of w.people) { p.teamId = 'default'; p.assignedTo = 'owner'; p.enrolments = []; p.followUps = []; } w.visits = [];
    return { organisation: { id: orgId, name: 'Pack installation organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }], members: [owner, reviewer, asha], invitations: [], workspace: w }; };
  const child = () => ({ format: 'saha-pack-manifest-1', id: 'child_growth', version: 1, name: 'Child growth check', programme: 'Child health', purpose: 'Record a synthetic child growth check and a reported feeding concern.',
    questions: [{ id: 'weight', label: 'Weight', fact: 'weight', unit: 'kg', required: true }, { id: 'feeding_concern', label: 'Does the carer report a feeding concern?', options: ['Yes', 'No'], required: true }, { id: 'feeding_days', label: 'Days with the concern, reported', options: ['1-3', '4 or more'], when: { id: 'feeding_concern', value: 'Yes' }, required: false }],
    schedule: { followUpWithinDays: 30, note: 'illustrative' }, escalation: [{ id: 'feeding-concern', label: 'Reported feeding concern', condition: { questionId: 'feeding_concern', operator: 'eq', value: 'Yes' }, urgency: 'review' }, { id: 'low-weight', label: 'Low weight', condition: { questionId: 'weight', operator: 'lte', value: '7.5' }, urgency: 'urgent_review' }],
    changeNote: 'Synthetic illustrative pack for the installation workflow; not clinically approved.' });
  const maternal3 = () => { const v2 = P.packAt('maternal', 2); return { format: 'saha-pack-manifest-1', id: 'maternal', version: 3, name: 'Maternal care', programme: 'Maternal care', purpose: v2.purpose,
    questions: [...v2.questions.filter(q => q.id !== 'appointment_discussed').map(({ renamedFrom, ...q }) => q), { id: 'next_appointment_discussed', renamedFrom: 'appointment_discussed', label: 'Was the next care appointment discussed?', options: ['Yes', 'No'], required: true }, { id: 'birth_plan_discussed', label: 'Was a birth plan discussed?', options: ['Yes', 'No'], required: false }],
    schedule: { followUpWithinDays: 28 }, migratesFrom: [2], changeNote: 'Synthetic installed revision for the installation workflow; not clinically approved.' }; };
  const stage = (manifest, reason = 'Stage a synthetic pack for review') => ({ type: 'packInstallStage', manifest, reason });
  const parse = x => I.packManifestSchema.safeParse(x);
  const issues = x => I.manifestIssues(parse(x).data);

  // 1. The manifest schema is strict data: unknown keys, code-like fields and free-form expressions are refused.
  check(() => { assert.equal(parse(child()).success, true); assert.deepEqual(issues(child()), []); assert.deepEqual(issues(maternal3()), []); });
  check(() => { assert.equal(parse({ ...child(), script: 'alert(1)' }).success, false); assert.equal(parse({ ...child(), questions: [{ ...child().questions[0], expression: 'weight < 7' }] }).success, false); assert.equal(parse({ ...child(), escalation: [{ ...child().escalation[0], condition: { questionId: 'weight', operator: 'between', value: '1' } }] }).success, false); assert.equal(parse({ ...child(), format: 'other' }).success, false); assert.equal(parse({ ...child(), id: 'Child Growth' }).success, false); assert.equal(parse({ ...child(), programme: 'Oncology' }).success, false); assert.equal(parse({ ...child(), questions: [] }).success, false); });
  check(() => { const bad = (q, re) => assert.ok(issues({ ...child(), questions: [child().questions[0], q] }).some(m => re.test(m)), String(re));
    bad({ id: 'weeks', label: 'Weeks', fact: 'weeks', unit: 'days', required: true }, /recorded in weeks/); bad({ id: 'mixed', label: 'Mixed question', fact: 'weeks', unit: 'weeks', options: ['a', 'b'], required: true }, /either a measurement/); bad({ id: 'bp', label: 'Systolic', fact: 'systolic', unit: 'mmHg', required: true }, /fact key systolic/);
    bad({ id: 'later', label: 'Later question', options: ['A', 'B'], when: { id: 'unknown', value: 'Yes' }, required: true }, /earlier choice question/); bad({ id: 'weight', label: 'Weight again', fact: 'weight', unit: 'kg', required: true }, /more than once/); bad({ id: 'opt', label: 'Repeated options', options: ['A', 'A'], required: true }, /repeats an option/); bad({ id: 'opt', label: 'Unit on a choice', options: ['A', 'B'], unit: 'kg', required: true }, /cannot have a unit/); bad({ id: 'renamed', label: 'Renamed question', options: ['A', 'B'], renamedFrom: 'old', required: true }, /no reviewed mapping/); });
  check(() => { const rule = (condition, re) => assert.ok(issues({ ...child(), escalation: [{ id: 'r', label: 'Rule label', condition, urgency: 'review' }] }).some(m => re.test(m)), String(re));
    rule({ questionId: 'missing_q', operator: 'eq', value: 'Yes' }, /does not ask/); rule({ questionId: 'feeding_concern', operator: 'gte', value: '1' }, /only be compared with "eq"/); rule({ questionId: 'feeding_concern', operator: 'eq', value: 'Maybe' }, /does not offer/); rule({ questionId: 'weight', operator: 'gte', value: 'heavy' }, /needs a number/); rule({ questionId: 'weight', operator: 'missing', value: '1' }, /takes no value/);
    assert.ok(issues({ ...maternal3(), migratesFrom: [3] }).some(m => /earlier versions/.test(m))); });
  // The command bounds the manifest's size before anything else reads it.
  check(() => { assert.equal(I.packInstallationSchema.safeParse(stage(child())).success, true); assert.equal(I.packInstallationSchema.safeParse(stage({ ...child(), purpose: 'x'.repeat(8100) })).success, false); assert.equal(I.packInstallationSchema.safeParse({ type: 'packInstallStage', reason: 'No manifest at all here' }).success, false); assert.equal(I.packInstallationSchema.safeParse(stage(child(), 'short')).success, false); });

  // 2. Conflicts with the compiled catalogue and with other installations.
  let s = makeState('org_pi_a');
  const conflict = (m, re) => rejects(() => I.applyPackInstallation(makeState('org_pi_c'), stage(m), actor, owner, now), re);
  await conflict({ ...maternal3(), version: 2, migratesFrom: [1] }, /already in the catalogue/);
  await conflict({ ...child(), id: 'tb', name: 'TB screening', programme: 'TB screening', version: 1 }, /already in the catalogue/);
  await conflict({ ...maternal3(), programme: 'Child health' }, /cannot move it/);
  await conflict({ ...child(), version: 2, migratesFrom: [1] }, /new pack: its first version is v1/);
  await conflict({ ...child(), name: 'Maternal care' }, /already named/);
  await conflict({ ...child(), questions: [{ id: 'weight', label: 'Child weight', fact: 'weight', unit: 'kg', required: true }, ...child().questions.slice(1)] }, /defined differently by/);
  await conflict({ ...maternal3(), version: 4, migratesFrom: [3] }, /not an activated version/);
  await conflict({ ...maternal3(), questions: maternal3().questions.map(q => q.id === 'next_appointment_discussed' ? { ...q, renamedFrom: 'never_asked' } : q) }, /no mapped earlier version asks/);
  await rejects(() => I.applyPackInstallation(makeState('org_pi_c'), stage({ ...child(), questions: [{ id: 'weeks', label: 'Weeks', fact: 'weeks', unit: 'days', required: true }] }), actor, owner, now), /manifest is invalid: .*recorded in weeks/);

  // 3. Roles: only an owner stages, activates and retires; a clinician other than the uploader reviews. Rechecked on replay.
  for (const m of [reviewer, asha, { ...owner, status: 'suspended' }]) await rejects(() => I.applyPackInstallation(makeState('org_pi_c'), stage(child()), actor, m, now), /An organisation owner uploads/);
  const staged = await I.applyPackInstallation(s, stage(child()), actor, owner, now);
  const inst = () => s.operations.installedPacks.find(x => x.id === staged.installationId);
  check(() => { assert.equal(staged.state, 'staged'); assert.match(staged.manifestHash, /^[0-9a-f]{64}$/); assert.equal(inst().pack.installed.installationId, staged.installationId); assert.match(inst().pack.escalation, /Low weight: weight at or below 7.5 → urgent clinician review/); assert.match(inst().pack.schedule, /within 30 days.*nothing is scheduled automatically/); assert.match(s.workspace.audit.at(-1).detail, /staged for review.*Not clinically approved/); });
  await rejects(() => I.applyPackInstallation(s, stage(child()), actor, owner, now), /already in the catalogue or awaiting review/);
  // Nothing opens on a staged pack.
  await rejects(async () => C.programmeApply(s, { type: 'enrolProgramme', personId: 'p_meena', version: 1, packId: 'child_growth', episodeLabel: 'Synthetic child episode', startDate: null }, actor, owner), /Choose an available programme pack/);
  const review = (decision, extra = {}) => ({ type: 'packInstallReview', installationId: staged.installationId, manifestHash: staged.manifestHash, decision, reason: 'Structure and conflicts checked on synthetic data', ...extra });
  await rejects(() => I.applyPackInstallation(s, review('approve'), actor, owner, now), /different person from the one who uploaded/);
  await rejects(() => I.applyPackInstallation(s, review('approve'), { ...actor, userId: 'asha1' }, asha, now), /A clinician reviews/);
  check(() => { assert.throws(() => I.authorizePackInstallation(s, owner, review('approve')), /different person/); assert.throws(() => I.authorizePackInstallation(s, reviewer, { type: 'packInstallActivate', installationId: staged.installationId, manifestHash: staged.manifestHash, reason: 'Activate the reviewed pack' }), /An organisation owner/); assert.doesNotThrow(() => I.authorizePackInstallation(s, reviewer, review('approve'))); assert.doesNotThrow(() => I.authorizePackInstallation(s, asha, { type: 'other' })); });
  await rejects(() => I.applyPackInstallation(s, review('approve', { manifestHash: 'a'.repeat(64) }), reviewerActor, reviewer, now), /not the staged one/);
  const activate = (x, extra = {}) => ({ type: 'packInstallActivate', installationId: x.installationId, manifestHash: x.manifestHash, reason: 'Activate the reviewed synthetic pack', ...extra });
  await rejects(() => I.applyPackInstallation(s, activate(staged), actor, owner, now), /Only an approved pack/);
  const approved = await I.applyPackInstallation(s, review('approve'), reviewerActor, reviewer, now);
  check(() => { assert.equal(approved.state, 'approved'); assert.deepEqual(inst().history.map(h => h.state), ['staged', 'approved']); assert.equal(inst().review.by, 'clin2'); });
  // The reviewer's authority is checked again at activation.
  const demoted = structuredClone(s); demoted.members.find(m => m.userId === 'clin2').version = 2;
  await rejects(() => I.applyPackInstallation(demoted, activate(staged), actor, owner, now), /reviewer's authority changed/);
  await rejects(() => I.applyPackInstallation(s, activate(staged), reviewerActor, reviewer, now), /An organisation owner/);
  const activated = await I.applyPackInstallation(s, activate(staged), actor, owner, now);
  check(() => { assert.deepEqual([activated.state, activated.migrationAvailable], ['active', false]); assert.deepEqual(inst().history.map(h => h.state), ['staged', 'approved', 'active']); assert.ok(P.packIds(s).includes('child_growth')); assert.equal(P.adoptedVersion(s, 'child_growth'), 1); assert.equal(P.adoptedVersion({}, 'child_growth'), 0); assert.match(s.workspace.audit.at(-1).detail, /activated.*New episodes can now open on v1/); });

  // 4. Episodes open on the activated version and new visits capture its questions through the shared engine.
  let meena = s.workspace.people.find(p => p.id === 'p_meena');
  C.programmeApply(s, { type: 'enrolProgramme', personId: 'p_meena', version: meena.version, packId: 'child_growth', episodeLabel: 'Synthetic child episode', startDate: null }, actor, owner);
  check(() => { assert.deepEqual([meena.enrolments[0].packId, meena.enrolments[0].packVersion], ['child_growth', 1]); assert.ok(meena.programmes.includes('Child health')); assert.equal(P.captureFor(meena.enrolments).packs.length, 0, 'without the installed catalogue nothing is captured (and nothing crashes)'); assert.deepEqual(P.captureFor(meena.enrolments, P.installedPacks(s)).packs[0].pack.questions.map(q => q.id), ['weight', 'feeding_concern', 'feeding_days']); });
  const started = await core.apply(s.workspace, { type: 'startVisit', personId: 'p_meena' }, 'owner', { call: async () => { throw new Error('no external calls'); }, packs: P.installedPacks(s) }, now);
  const visit = s.workspace.visits.find(v => v.id === started.visitId);
  check(() => { assert.equal(visit.programmeCapture.packs[0].pack.installed.installationId, staged.installationId); assert.deepEqual(P.questions(visit.programmeCapture).map(q => q.id), ['weight', 'feeding_concern']); assert.deepEqual(P.questions({ ...visit.programmeCapture, answers: { feeding_concern: 'Yes' } }).map(q => q.id), ['weight', 'feeding_concern', 'feeding_days']); });

  // 5. A new version of a compiled pack: installed v3 maps from v2 only, so 4e migration moves v2 episodes and leaves v1 for manual action.
  const aarav = s.workspace.people.find(p => p.id === 'p_aarav'), farida = s.workspace.people.find(p => p.id === 'p_farida');
  aarav.enrolments.push({ id: 'e_aarav', packId: 'maternal', packVersion: 2, state: 'active', episodeLabel: 'Synthetic episode label', startDate: null, createdAt: now, createdBy: 'owner', registration: 'not_submitted' });
  farida.enrolments.push({ id: 'e_farida', packId: 'maternal', packVersion: 1, state: 'active', episodeLabel: 'Synthetic episode label', startDate: null, createdAt: now, createdBy: 'owner', registration: 'not_submitted' });
  const m3 = await I.applyPackInstallation(s, stage(maternal3(), 'Stage the synthetic maternal v3'), actor, owner, now);
  await I.applyPackInstallation(s, { type: 'packInstallReview', installationId: m3.installationId, manifestHash: m3.manifestHash, decision: 'approve', reason: 'Structure and mapping from v2 checked' }, reviewerActor, reviewer, now);
  check(() => { assert.equal(P.latestVersion('maternal', s), 2, 'an approved version is not in the catalogue until activated'); });
  const m3a = await I.applyPackInstallation(s, activate(m3), actor, owner, now);
  check(() => { assert.equal(m3a.migrationAvailable, true); assert.equal(P.latestVersion('maternal', s), 3); assert.equal(P.adoptedVersion(s, 'maternal'), 1, 'activation does not adopt; a reviewed migration does'); assert.match(s.workspace.audit.at(-1).detail, /stay where they are until a reviewed migration/); });
  const plan = await M.planProgrammeMigration(s, owner, 'maternal');
  check(() => { assert.equal(plan.targetVersion, 3); assert.deepEqual(plan.candidates.map(c => c.enrolmentId), ['e_aarav']); assert.deepEqual(plan.blocked.map(b => [b.enrolmentId, b.code]), [['e_farida', 'no-reviewed-mapping']]); const ch = plan.changes.find(c => c.fromVersion === 2); assert.deepEqual(ch.renamed, [{ from: 'appointment_discussed', to: 'next_appointment_discussed', relabelled: false }]); assert.deepEqual(ch.added, [{ id: 'birth_plan_discussed', required: false }]); assert.equal(ch.reviewedMapping, true); });
  const moved = await M.applyProgrammeMigration(s, { type: 'programmeMigrationApply', packId: 'maternal', targetVersion: 3, planHash: plan.planHash, reason: 'Move v2 maternal episodes to installed v3' }, actor, owner, now);
  check(() => { assert.deepEqual([moved.migrated, moved.blocked, moved.adopted], [1, 1, true]); assert.equal(aarav.enrolments[0].packVersion, 3); assert.equal(farida.enrolments[0].packVersion, 1); assert.equal(P.adoptedVersion(s, 'maternal'), 3); });
  await rejects(() => M.applyProgrammeMigration(s, { type: 'programmeMigrationApply', packId: 'unknown_pack', targetVersion: 1, planHash: plan.planHash, reason: 'Unknown pack migration attempt' }, actor, owner, now), /Choose a pack in this organisation's catalogue/);

  // 6. Retirement reverses activation without deleting: adoption falls back, pinned episodes keep the version, nothing new opens.
  const retire = (x, reason = 'Withdraw the synthetic version after review') => ({ type: 'packInstallRetire', installationId: x.installationId, reason });
  await rejects(() => I.applyPackInstallation(s, retire(m3), reviewerActor, reviewer, now), /An organisation owner/);
  const r3 = await I.applyPackInstallation(s, retire(m3), actor, owner, now);
  check(() => { assert.deepEqual([r3.state, r3.openEpisodes], ['retired', 1]); assert.equal(P.latestVersion('maternal', s), 2); assert.equal(P.adoptedVersion(s, 'maternal'), 2); assert.equal(s.operations.packVersions.maternal, 2); assert.equal(s.operations.installedPacks.length, 2, 'kept, not deleted'); assert.ok(P.packAt('maternal', 3, s), 'the retired version still resolves for pinned episodes'); assert.equal(P.captureFor(aarav.enrolments, P.installedPacks(s)).packs[0].pack.version, 3); assert.match(s.workspace.audit.at(-1).detail, /retired from active.*1 open episodes stay pinned to v3.*New episodes open on v2/); });
  const after = await M.planProgrammeMigration(s, owner, 'maternal');
  check(() => { assert.equal(after.targetVersion, 2); assert.equal(after.candidates.some(c => c.enrolmentId === 'e_aarav'), false, 'a retired version is never a migration source by default nor a target'); });
  await rejects(() => I.applyPackInstallation(s, retire(m3), actor, owner, now), /already closed/);
  await rejects(() => I.applyPackInstallation(s, activate(m3), actor, owner, now), /Only an approved pack/);
  await rejects(() => I.applyPackInstallation(s, stage({ ...maternal3() }), actor, owner, now), /already in the catalogue/);
  const childRetired = await I.applyPackInstallation(s, retire(staged), actor, owner, now);
  check(() => { assert.equal(childRetired.openEpisodes, 1); assert.equal(P.adoptedVersion(s, 'child_growth'), 0); assert.equal(P.packIds(s).includes('child_growth'), false); });
  meena.enrolments[0].state = 'closed';
  await rejects(async () => C.programmeApply(s, { type: 'enrolProgramme', personId: 'p_meena', version: meena.version, packId: 'child_growth', episodeLabel: 'Synthetic child episode', startDate: null }, actor, owner), /Choose an available programme pack/);
  // A rejected pack cannot be activated and its version may be staged again with corrections.
  const t = makeState('org_pi_r'), tStaged = await I.applyPackInstallation(t, stage(child()), actor, owner, now);
  await I.applyPackInstallation(t, { type: 'packInstallReview', installationId: tStaged.installationId, manifestHash: tStaged.manifestHash, decision: 'reject', reason: 'Labels need a second synthetic pass' }, reviewerActor, reviewer, now);
  await rejects(() => I.applyPackInstallation(t, activate(tStaged), actor, owner, now), /Only an approved pack/);
  const again = await I.applyPackInstallation(t, stage({ ...child(), purpose: 'Record a synthetic child growth check, second pass.' }), actor, owner, now);
  check(() => { assert.equal(again.state, 'staged'); assert.equal(t.operations.installedPacks.length, 2); assert.equal(JSON.stringify(t.operations).includes('Meena'), false, 'installation records hold no patient data'); });
  const many = makeState('org_pi_m'); many.operations = { installedPacks: Array.from({ length: I.MAX_INSTALLATIONS }, (_, i) => ({ id: 'x' + i, state: 'rejected', pack: { id: 'p' + i, version: 1, questions: [] } })) };
  await rejects(() => I.applyPackInstallation(many, stage(child()), actor, owner, now), /at most 12 pack installations/);
  const other = await I.applyPackInstallation(makeState('x'), { type: 'somethingElse' }, actor, owner, now);
  check(() => assert.equal(other, null, 'other commands are not handled'));

  // 7. Through the real store: stage, review and activate persist in the operations row with three chained audit events.
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  for (const m of [owner, reviewer, asha]) d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(m.userId, m.accountCode, m.displayName, m.userId + '@example.invalid', now);
  const B = 'org_pi_b'; await store.createState(d1, makeState(B), actor, 'createOrganisation');
  const load = async () => { const x = await store.readState(d1, B); store.scope(x, 'owner'); return x; };
  const commit = async (c, a = actor, m = owner) => { const before = await load(), next = structuredClone(before); const result = await I.applyPackInstallation(next, c, a, m); await store.persist(d1, before, next, a, c, crypto.randomUUID(), 'hash', result); return result; };
  const bStaged = await commit(stage(child()));
  await commit({ type: 'packInstallReview', installationId: bStaged.installationId, manifestHash: bStaged.manifestHash, decision: 'approve', reason: 'Structure and conflicts checked on synthetic data' }, reviewerActor, reviewer);
  await commit(activate(bStaged));
  const persisted = await load();
  check(() => { const x = persisted.operations.installedPacks[0]; assert.equal(x.state, 'active'); assert.deepEqual(x.history.map(h => h.state), ['staged', 'approved', 'active']); assert.ok(P.enrollableAt('child_growth', 1, persisted)); });
  const v = await chain.verifyChain(d1, B);
  check(() => { assert.equal(v.status, 'intact'); assert.deepEqual(d1.db.prepare("SELECT action FROM audit_events WHERE org_id=? AND action LIKE 'packInstall%' ORDER BY rowid").all(B).map(r => r.action), ['packInstallStage', 'packInstallReview', 'packInstallActivate']); });

  const result = { suite: 'pack installation contract (slice 4f)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/pack-installation-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
