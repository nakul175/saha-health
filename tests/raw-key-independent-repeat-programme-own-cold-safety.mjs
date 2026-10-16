// Slice 6z sixth-review-fixes contract: regressions for defects a sixth independent review found in round-2 slices
// 6u, 4f, 6v and 2g (reproductions in /tmp/claude-0/review6/*.mjs, 1 October 2026 UTC). Each numbered block fails on the
// code before 6z; run it from an export of the base tree with REPORT_ALL=1 to list every failing check.
//  1. Question ids naming Object.prototype members are refused, and answers/absences are read as own properties only.
//  2. An organisation acknowledgement clears only the views that show it; escalation is suppressed only when all do.
//  3. Escalation notifications are tied to the guarded escalation update; restore never re-opens a closed occurrence.
//  4. On visits with no recorded author, the confirmer and the programme saver cannot verify or sign off their own work.
//  5. An ABHA held by an out-of-scope record is refused exactly like a gateway refusal; the server records it for a steward.
//  6. Data exit exports only the exporter's own alert notifications.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { readTar } from '../scripts/verify-export.mjs';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.sixth-review-fixes-contract-'));
let passed = 0;
const failed = [];
const fail = (name, e) => { if (process.env.REPORT_ALL) { failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); return; } e.message = `${name}: ${e.message}`; throw e; };
const check = (name, fn) => { try { fn(); passed++; } catch (e) { fail(name, e); } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { fail(name, e); } };
const thrown = fn => { try { fn(); } catch (e) { return e; } return null; };
const thrownAsync = async fn => { try { await fn(); } catch (e) { return e; } return null; };

let hook = null;
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
  // A test may run another evaluation just before this batch commits (a concurrent Worker instance).
  async batch(statements) { if (hook) { const h = hook; hook = null; await h(); } this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const migrated = () => { const d = new D1(); for (const file of migrations) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d.db.exec(stmt); return d; };

try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    if (f !== 'server.ts') writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'server.js'), `export const harness = { d1: null, user: null, orgId: null };
export async function identity() { return harness.user; }
export async function activeOrg() { return harness.orgId; }
export function db() { return harness.d1; }
export async function loadFor() { throw new Error('loadFor is not used by this harness'); }
export function rawRuntime() { return {}; }
export function runtime() { return {}; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const now = new Date().toISOString();
  const member = x => ({ status: 'active', version: 1, isOwner: false, displayName: x.userId, accountCode: 'CODE' + x.userId, createdAt: now, teamIds: ['t1'], ...x });

  // 1. Reserved question ids.
  {
    const P = await load('pack-installation'), G = await load('programmes','installed-transition-authority'), C = await load('programme-commands'), F = await load('fact-provenance'), I = await load('indicators');
    const manifest = qid => ({ format: 'saha-pack-manifest-1', id: 'childcare', version: 1, name: 'Child care', programme: 'Child health', purpose: 'Synthetic child health checks.', changeNote: 'First synthetic version.', questions: [{ id: qid, label: 'Danger signs present?', required: true, options: ['Yes', 'No'] }] });
    for (const id of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable'])
      check(`1 the manifest schema refuses question id ${id}`, () => assert.equal(P.packManifestSchema.safeParse(manifest(id)).success, false));
    check('1 an ordinary id is still accepted (control)', () => assert.equal(P.packManifestSchema.safeParse(manifest('danger_signs')).success, true));
    check('1 an escalation rule or show-when condition cannot name a reserved id either', () => { const m = manifest('danger_signs'); m.questions.push({ id: 'referred', label: 'Referred?', required: true, options: ['Yes', 'No'], when: { id: 'toString', value: 'Yes' } }); assert.equal(P.packManifestSchema.safeParse(m).success, false); });
    check('1 no compiled pack uses a reserved id', () => { for (const p of G.PACKS) for (const q of p.questions) assert.ok(!G.RESERVED_QUESTION_IDS.has(q.id), q.id); });
    // A pack carrying such ids (built without the schema, as a stored or compiled pack could be) is still read safely.
    const pack = { id: 'legacy', version: 1, name: 'Legacy', programme: 'Child health', purpose: 'p', questions: [{ id: 'constructor', label: 'Danger signs present?', required: true, options: ['Yes', 'No'] }, { id: 'toString', label: 'Referred?', required: true, options: ['Yes', 'No'] }, { id: 'valueOf', label: 'When referred', required: true, options: ['Yes', 'No'], when: { id: 'hasOwnProperty', value: 'Yes' } }] };
    const capture = (answers = {}, absence = {}) => ({ packs: [{ enrolmentId: 'e', pack }], answers, absence });
    const v = { facts: { notes: '' }, programmeCapture: capture() };
    check('1 required questions named after prototype members stay unresolved without answers', () => assert.deepEqual(G.unresolved(v).map(q => q.id), ['constructor', 'toString']));
    check('1 a show-when condition on a prototype name is not satisfied by a built-in', () => assert.deepEqual(G.questions(v.programmeCapture).map(q => q.id), ['constructor', 'toString']));
    check('1 an answer and an absence reason resolve them', () => assert.deepEqual(G.unresolved({ ...v, programmeCapture: capture({ constructor: 'No' }, { toString: 'Unknown' }) }), []));
    check('1 own() reads only own properties', () => { assert.equal(G.own({}, 'constructor'), undefined); assert.equal(G.own({ constructor: 'Yes' }, 'constructor'), 'Yes'); });
    const state = () => ({ organisation: { id: 'o' }, members: [], teams: [{ id: 't1' }], workspace: { people: [{ id: 'p1', teamId: 't1', assigned: true, version: 1, name: 'X' }], visits: [{ id: 'v1', personId: 'p1', version: 1, state: 'draft', facts: { notes: 'n' }, programmeCapture: capture() }], referrals: [], submissions: [], integrations: [], audit: [] } });
    const s = state(), asha = member({ userId: 'asha', role: 'asha' });
    check('1 an absence reason for a question named constructor is accepted', () => { C.programmeApply(s, { type: 'saveProgrammeAnswers', visitId: 'v1', version: 1, answers: {}, absence: { constructor: 'Unknown', toString: 'Declined' } }, { userId: 'asha', displayName: 'ASHA' }, asha); assert.deepEqual(G.unresolved(s.workspace.visits[0]), []); });
    check('1 entry keys and authors are own properties only', () => { const c = { notes: '', answers: {}, absence: { constructor: 'Unknown' } }; assert.deepEqual(F.answerKeys(c), ['constructor']); assert.equal(F.entryAuthor({}, 'answer:constructor'), undefined); assert.equal(F.entryAuthor({ answerAuthors: {} }, 'answer:toString'), undefined); });
    check('1 programme code reads answers through own()', () => { for (const f of ['lib/saha/programmes.ts', 'lib/saha/indicators.ts', 'lib/saha/programme-commands.ts', 'app/programmes.tsx', 'app/entry-verification-panel.tsx']) assert.ok(!/\b(answers|absence)\[(q\.id|key|k|q\.when\.id)\]/.test(readFileSync(f, 'utf8').replace(/answerAuthors\[k\]=/g, '')), f); });
    void I;
  }

  // 2. Acknowledgement views differ by scope.
  {
    const A = await load('alerts'), D = await load('alert-delivery');
    const T = Date.now(), old = new Date(T - 10 * 3600e3).toISOString(), at = new Date(T - 60e3).toISOString(), iso = new Date(T).toISOString();
    const ownerA = member({ userId: 'ownerA', role: 'clinician', isOwner: true, teamIds: ['t1'] }), ownerB = member({ userId: 'ownerB', role: 'clinician', isOwner: true, teamIds: ['t2'] }), admin = member({ userId: 'adm', role: 'admin', teamIds: [] });
    const run = (countA, countB) => {
      const acks = [{ alertId: 'destination-uncertain', count: countA, userId: 'ownerA', by: 'A', at, note: 'looking', scope: 'organisation' }];
      const view = (m, n) => ({ member: m, alerts: A.alertsFor({ report: { backlog: { unresolvedSubmissions: n, unresolvedEhr: 0, overdueReferrals: 0, overdueFollowUps: 0, undatedReferrals: 0 } }, budgets: null, invoices: null, telemetry: null, operations: null, acknowledgements: acks, viewerId: m.userId, now: iso }) });
      return D.planDelivery({ present: D.presentFrom([view(ownerA, countA), view(ownerB, countB)]), open: [{ id: 'occ1', alertId: 'destination-uncertain', scopeKey: 'org', owner: 'operations', severity: 'high', title: 't', openedAt: old, escalatedAt: null }], acknowledgements: acks, members: [ownerA, ownerB, admin], now: iso });
    };
    const split = run(3, 5);
    check('2 the occurrence is not cleared while another owner\'s view is unacknowledged', () => assert.deepEqual(split.clear, []));
    check('2 only the acknowledging owner\'s notification is cleared', () => assert.deepEqual(split.clearFor, [{ occurrenceId: 'occ1', userId: 'ownerA' }]));
    check('2 the other owner\'s notification is restored if cleared', () => assert.deepEqual(split.restore, ['occ1']));
    check('2 an overdue partly acknowledged occurrence escalates as unacknowledged', () => { assert.equal(split.escalate.length, 1); assert.equal(split.escalate[0].reason, 'unacknowledged'); assert.match(split.escalate[0].detail, /every owning member's own view/); assert.ok(!/\b5\b|\b3\b/.test(split.escalate[0].detail), 'no counts in the detail'); });
    const same = run(4, 4);
    check('2 control: when every view shows the acknowledgement the occurrence clears and does not escalate', () => { assert.deepEqual(same.clear, ['occ1']); assert.deepEqual(same.clearFor, []); assert.equal(same.escalate.length, 0); });
  }

  // 3 and 6 use the server module over a migrated database.
  const { harness } = await load('server'), S = await load('alert-delivery-server'), X = await load('data-exit');
  // 3. Concurrent evaluations.
  {
    const d = migrated(); harness.d1 = d; d.db.exec("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES ('o','Synthetic',1,'legacy','2026-10-01T00:00:00Z')");
    const T0 = Date.parse('2026-10-01T08:00:00Z'), iso = t => new Date(t).toISOString();
    const sup = member({ userId: 'sup1', role: 'supervisor', teamIds: ['t1'] }), own = member({ userId: 'own1', role: 'clinician', isOwner: true, teamIds: ['t2'] });
    const state = open => ({ organisation: { id: 'o' }, teams: [{ id: 't1' }, { id: 't2' }], members: [sup, own], operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, acknowledgements: [] },
      workspace: { people: [{ id: 'p1', teamId: 't1', version: 1, name: 'X', followUps: [], enrolments: [] }], visits: [], submissions: [], audit: [], integrations: [], referrals: [{ id: 'r1', personId: 'p1', visitId: 'v', facility: 'F', reason: 'r', state: open ? 'sent' : 'completed', createdAt: iso(T0 - 9e8), due: '2026-09-01' }] } });
    await S.evaluateDelivery(d, state(true), iso(T0));
    // A plans an escalation on stale state; B closes the occurrence just before A's batch commits.
    hook = async () => { await S.evaluateDelivery(d, state(false), iso(T0 + 5 * 3600e3)); };
    await S.evaluateDelivery(d, state(true), iso(T0 + 5 * 3600e3));
    const occ = d.db.prepare('SELECT id,closed_at,escalated_at FROM alert_occurrences').all(), lvl2 = d.db.prepare('SELECT occurrence_id,cleared_at FROM alert_notifications WHERE level=2').all();
    check('3 the scenario closed the occurrence before the stale escalation was written', () => { assert.ok(occ.length >= 1); assert.ok(occ.every(o => o.closed_at)); });
    check('3 no escalation notification exists for an occurrence that was never escalated', () => assert.deepEqual(lvl2.filter(n => !occ.find(o => o.id === n.occurrence_id)?.escalated_at), []));
    // Restore guard: an acknowledged-cleared notification of a closed occurrence is not re-opened by a stale evaluation.
    const d2 = migrated(); harness.d1 = d2; d2.db.exec("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES ('o','Synthetic',1,'legacy','2026-10-01T00:00:00Z')");
    await S.evaluateDelivery(d2, state(true), iso(T0));
    const o2 = d2.db.prepare('SELECT id FROM alert_occurrences').get();
    d2.db.prepare("UPDATE alert_notifications SET cleared_at=?,cleared_reason='acknowledged' WHERE occurrence_id=?").run(iso(T0 + 60e3), o2.id);
    hook = async () => { d2.db.prepare('UPDATE alert_occurrences SET closed_at=? WHERE id=?').run(iso(T0 + 120e3), o2.id); };
    await S.evaluateDelivery(d2, state(true), iso(T0 + 120e3));
    check('3 restore never re-opens notifications of an occurrence closed concurrently', () => assert.deepEqual(d2.db.prepare('SELECT cleared_reason FROM alert_notifications WHERE occurrence_id=? AND cleared_at IS NULL').all(o2.id), []));
    check('3 source: escalation inserts select the occurrence escalated in this evaluation', () => assert.match(readFileSync('lib/saha/alert-delivery-server.ts', 'utf8'), /SELECT \?,\?,o\.id,\?,2,[^']*o\.closed_at IS NULL AND o\.escalated_at=\? AND o\.escalation_reason=\?/));
  }

  // 4. Visits recorded before slice 2g (no per-entry authors).
  {
    const V = await load('visit-signoff'), FV = await load('fact-verification');
    const c1 = member({ userId: 'c1', role: 'clinician' }), c2 = member({ userId: 'c2', role: 'clinician' }), sup = member({ userId: 's1', role: 'supervisor' }), sup2 = member({ userId: 's2', role: 'supervisor' });
    const mk = () => ({ organisation: { id: 'o' }, teams: [{ id: 't1' }], members: [c1, c2, sup, sup2], operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }, workspace: { people: [{ id: 'p1', teamId: 't1', assigned: true, version: 1, name: 'X' }],
      visits: [{ id: 'v1', personId: 'p1', version: 3, recordVersion: 4, state: 'confirmed', facts: { date: now, notes: 'Synthetic note written by C1', systolic: '', diastolic: '', weight: '61', temperature: '', weeks: '', coughDays: '', source: 'measured' },
        patientCheck: { personId: 'p1', personVersion: 1, by: 'c1', at: now }, programmeCapture: { packs: [{ enrolmentId: 'e1', pack: { id: 'tb', version: 1, questions: [] } }], answers: { q: 'Yes' }, absence: {}, savedBy: 's1', savedAt: now }, createdAt: now, aiResults: [] }], submissions: [], referrals: [], audit: [] } });
    const verify = (who, m, entry) => thrownAsync(() => V.applySignOff(mk(), { type: 'verifyEntry', visitId: 'v1', recordVersion: 4, entry, decision: 'verified' }, { userId: who, displayName: who }, m, now));
    await checkAsync('4 the confirmer cannot verify unattributed notes', async () => assert.equal((await verify('c1', c1, 'notes'))?.status, 403));
    await checkAsync('4 the confirmer cannot verify an unattributed answer', async () => assert.equal((await verify('c1', c1, 'answer:q'))?.status, 403));
    await checkAsync('4 control: another clinician can verify them', async () => { assert.equal(await verify('c2', c2, 'notes'), null); assert.equal(await verify('c2', c2, 'answer:q'), null); });
    const sign = (who, m) => thrownAsync(() => V.applySignOff(mk(), { type: 'signOffVisit', visitId: 'v1', recordVersion: 4 }, { userId: who, displayName: who }, m, now));
    await checkAsync('4 the supervisor who saved the programme answers cannot sign off', async () => assert.equal((await sign('s1', sup))?.status, 403));
    await checkAsync('4 control: another supervisor can sign off', async () => assert.equal(await sign('s2', sup2), null));
    check('4 the confirmer cannot verify an unattributed measurement', () => assert.equal(thrown(() => FV.applyFactReview(mk(), { type: 'verifyFact', visitId: 'v1', recordVersion: 4, measure: 'weight', decision: 'verified' }, { userId: 'c1', displayName: 'c1' }, c1, now))?.status, 403));
    check('4 control: another clinician can verify it', () => assert.equal(thrown(() => FV.applyFactReview(mk(), { type: 'verifyFact', visitId: 'v1', recordVersion: 4, measure: 'weight', decision: 'verified' }, { userId: 'c2', displayName: 'c2' }, c2, now)), null));
  }

  // 5. ABHA duplicate outside the requester's scope.
  {
    const B = await load('abdm'), AC = await load('access'), AA = await load('access-audit');
    const own = member({ userId: 'own', role: 'clinician', isOwner: true }), asha = member({ userId: 'asha', role: 'asha' });
    const P_ = (id, x) => ({ id, name: 'Synthetic ' + id, age: 40, sex: 'Female', village: 'V', programmes: ['General care'], version: 1, teamId: 't1', status: 'due', due: 'Today', assignedTo: null, createdAt: now, ...x });
    const mk = (theirs = true) => { const s = { organisation: { id: 'o' }, members: [own, asha], teams: [{ id: 't1' }], workspace: { people: [P_('mine', { assignedTo: 'asha' }), P_('theirs', { assignedTo: 'other', ...(theirs ? { abha: { state: 'linked', number: '91-1234-5678-9012', at: now, by: 'x', history: [] } } : {}) })], visits: [], referrals: [], submissions: [], integrations: [], audit: [] } };
      B.applyAbdm(s, { type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip: false, hiu: false }, facilityId: 'FAC-SYNTH', approvals: [{ module: 'abha', reference: 'APPROVAL-SYNTH' }], reason: 'Synthetic mock gateway configuration' }, { userId: 'own', displayName: 'Owner' }, own, now);
      for (const p of s.workspace.people) p.assigned = AC.allowed(asha, p); return s; };
    const link = { type:'abhaLink', demographicMatch:'matched', confirmed:true, personId: 'mine', version: 1, abhaNumber: '91-1234-5678-9012', otp: B.MOCK_OTP };
    const held = thrown(() => B.applyAbdm(mk(), link, { userId: 'asha', displayName: 'ASHA' }, asha, now));
    const badOtp = thrown(() => B.applyAbdm(mk(false), { ...link, otp: '000000' }, { userId: 'asha', displayName: 'ASHA' }, asha, now));
    check('5 the out-of-scope refusal has the same status and text as a gateway refusal', () => { assert.equal(held.status, badOtp.status); assert.equal(held.message, badOtp.message); assert.equal(held.message, B.LINK_REFUSED); });
    check('5 the refusal carries both record ids for the server only', () => { assert.ok(held instanceof B.AbhaHeldElsewhere); assert.equal(held.personId, 'mine'); assert.equal(held.heldBy, 'theirs'); assert.ok(!held.message.includes('theirs')); });
    check('5 the steward review event is a recorded audit action', () => { assert.ok(AA.ACCESS_ACTIONS.abhaLinkReview); assert.ok(AA.ACCESS_ACTION_NAMES.includes('abhaLinkReview')); });
    check('5 source: the server records the steward event on the holding record and returns the ordinary refusal', () => { const src = readFileSync('lib/saha/server.ts', 'utf8'); assert.match(src, /const abdm=await abdmWithStewardReview\(state,c,u,m,key\)/); assert.match(src, /action:'abhaLinkReview',subject:e\.heldBy,personId:e\.heldBy/); assert.match(src, /fail\(422,LINK_REFUSED\)/); });
  }

  // 6. Data exit and other members' alert notifications.
  {
    const d = migrated(); d.db.exec("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES ('o','Synthetic',1,'legacy','2026-10-01T00:00:00Z')");
    d.db.exec("INSERT INTO alert_occurrences (org_id,id,alert_id,scope_key,owner_role,severity,title,opened_at) VALUES ('o','occ1','destination-uncertain','org','operations','high','Programme updates need confirmation','2026-10-01T01:00:00Z')");
    for (const [id, user, count] of [['n-own', 'ownerA', 3], ['n-other', 'ownerB', 5], ['n-admin', 'adm', 2]]) d.db.prepare("INSERT INTO alert_notifications (org_id,id,occurrence_id,user_id,level,alert_id,scope_key,owner_role,severity,title,count,detail,delivered_at) VALUES ('o',?,'occ1',?,1,'destination-uncertain','org','operations','high','t',?,NULL,'2026-10-01T01:00:00Z')").run(id, user, count);
    const ownerA = member({ userId: 'ownerA', role: 'clinician', isOwner: true });
    const built = await X.buildExport(d, { orgId: 'o', member: ownerA, exporter: { userId: 'ownerA', displayName: 'Owner A' }, exportId: 'export-6z', now: '2026-10-01T06:00:00.000Z', includeFhir: false, environment: 'synthetic' });
    const files = readTar(Buffer.from(built.archive)), rows = files.get('tables/alert_notifications.jsonl').toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)), manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
    check('6 only the exporter\'s own notifications are exported', () => assert.deepEqual(rows.map(r => r.id), ['n-own']));
    check('6 the manifest counts the other members\' rows left out', () => { const f = manifest.files.find(x => x.table === 'alert_notifications'); assert.equal(f.rows, 1); assert.equal(f.otherMembersRows, 2); });
    check('6 occurrences (no counts) are still exported', () => assert.equal(files.get('tables/alert_occurrences.jsonl').toString('utf8').split('\n').filter(Boolean).length, 1));
    check('6 leaving other inboxes out does not mark patient scope incomplete', () => assert.equal(manifest.totals.withheld, 0));
  }

  if (failed.length) { console.log(JSON.stringify({ failed }, null, 1)); process.exitCode = 1; }
  const result = { suite: 'sixth review fixes contract (slice 6z)', passed, failed: failed.length, completedAt: new Date().toISOString() };
  writeFileSync('tests/evidence/programme-raw-key-independent/legacy/safety.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
