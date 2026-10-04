// Slice 10h read-audit completion contract: the remaining read paths (workspace snapshot loads, browser-reported record
// opens, patient searches and lists, aggregate views) are chained, single-event, fail-closed audit events written through
// the slice 6t access commit, and every access event names the acting membership's role, version and delegated authority.
// Runs the real migrations in an in-memory SQLite database through the minimal D1 shim of the 6t contract.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.read-audit-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, test) => { await assert.rejects(fn, test); passed++; };

class Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.db = d1.db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d1, this.sql, args); }
  exec() { this.d1.statements++; const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { this.d1.statements++; return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { this.d1.statements++; return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.batches = 0; this.statements = 0; this.trips = 0; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) { this.batches++; this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}

try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'access-audit', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'read-audit', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const load = async f => import(pathToFileURL(join(dir, f + '.js')));
  const store = await load('store'), chain = await load('audit-chain'), access = await load('access-audit'), ra = await load('read-audit'), types = await load('types');
  const { seedWorkspace } = await load('seed');
  const d1 = new D1();
  for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort())
    for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d1.db.exec(stmt);
  const now = '2026-10-02T09:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' }, clinActor = { userId: 'clin', displayName: 'Synthetic clinician', email: 'clin@example.invalid' };
  for (const [id, code, name] of [['owner', 'CODE0000000000000000000A', 'Synthetic owner'], ['clin', 'CODE0000000000000000000B', 'Synthetic clinician']]) d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(id, code, name, id + '@example.invalid', now);
  const sql = (q, ...a) => d1.db.prepare(q).all(...a);
  const count = (table, orgId) => sql(`SELECT count(*) AS n FROM ${table} WHERE org_id=?`, orgId)[0].n;
  const org = orgId => sql('SELECT revision,patient_revision FROM organisations WHERE id=?', orgId)[0];
  const A = 'org_read_audit_a', w = seedWorkspace(now);
  w.people.forEach((p, i) => { p.version = 1; p.teamId = i === 5 ? 'other' : 'default'; p.assignedTo = 'owner'; });
  const emergency = w.people[5]; emergency.exceptionalAccess = [{ id: 'grant-9', userId: 'owner', from: now, until: '2099-01-01T00:00:00.000Z', reason: 'Synthetic emergency reason long enough.' }];
  w.visits = w.people.slice(0, 3).map((p, i) => ({ id: `${A}-visit-${i}`, personId: p.id, version: 1, state: 'draft', facts: { date: '2026-10-01T08:00', systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic note SECRET-NOTE', source: 'measured' }, createdAt: now, aiResults: [], recordVersion: 1 }));
  const owner = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 7, teamIds: ['default'], createdAt: now };
  const clin = { userId: 'clin', accountCode: 'CODE0000000000000000000B', displayName: 'Synthetic clinician', role: 'clinician', isOwner: false, status: 'active', version: 2, teamIds: ['default'], createdAt: now };
  await store.createState(d1, { organisation: { id: A, name: 'Read audit contract organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'other', name: 'Other team', createdAt: now }], members: [owner, clin], invitations: [], workspace: w }, actor, 'createOrganisation');
  const state = async () => { const s = await store.readState(d1, A); return s; };
  const events = action => sql('SELECT * FROM audit_events WHERE org_id=? AND action=? ORDER BY seq', A, action);
  const names = w.people.map(p => p.name);

  // 1. One list: the server's access actions, the screen's list, the summary subset and the new names agree.
  const NEW = ['viewWorkspace', 'openRecord', 'searchPatients', 'listPatients', 'viewAggregate'];
  check(() => assert.deepEqual(Object.keys(access.ACCESS_ACTIONS).sort(), [...types.ACCESS_ACTION_NAMES].sort()));
  check(() => { for (const n of NEW) { assert.ok(Object.hasOwn(access.ACCESS_ACTIONS, n), n); assert.ok(types.ACCESS_ACTION_NAMES.includes(n), n); } });
  check(() => { assert.deepEqual([...chain.SUMMARY_ACCESS_ACTIONS].sort(), ['listPatients', 'searchPatients', 'viewAggregate', 'viewWorkspace']); for (const a of chain.SUMMARY_ACCESS_ACTIONS) assert.ok(types.ACCESS_ACTION_NAMES.includes(a)); assert.equal(chain.SUMMARY_ACCESS_ACTIONS.includes('openRecord'), false, 'an open names a patient and is not a summary'); });

  // 2. The workspace summary: scope size, records returned, paging window and emergency records; no names or notes.
  let s = await state(); const viewer = store.scope(s, 'owner');
  const sum = ra.workspaceSummary(s, viewer, 'workspace load', null, now);
  check(() => { assert.equal(sum.scopeSize, 6); assert.equal(sum.returned, 6); assert.equal(sum.visits, 3); assert.equal(sum.grants, 1); assert.match(sum.detail, /Workspace snapshot returned \(workspace load\): 6 patients in care scope; 6 records returned in full;/); assert.match(sum.detail, /1 record reached through emergency access grants\./); });
  check(() => { for (const n of names) assert.equal(sum.detail.includes(n), false, 'no patient name'); assert.equal(sum.detail.includes('SECRET-NOTE'), false); assert.equal(sum.detail.includes(w.people[0].id), false, 'no patient id'); });
  const pagedSum = ra.workspaceSummary(s, viewer, 'response to a command', { total: 1200, threshold: 500, window: 4 }, now);
  check(() => { assert.equal(pagedSum.scopeSize, 1200, 'scope size is the paged total, not the window'); assert.match(pagedSum.detail, /1200 patients in care scope; 6 records returned in full \(paged workspace: 4 opened, scope above the 500-patient paging threshold\)/); assert.match(pagedSum.detail, /response to a command/); });

  // 3. One load is one chained event, however many patients: no receipt, no record row, no revision change.
  const before = { audit: count('audit_events', A), receipts: count('command_receipts', A), revisions: count('record_revisions', A), org: org(A) };
  s = await state();
  d1.batches = 0; d1.statements = 0;
  const load1 = await ra.recordWorkspaceLoad(d1, s, actor, store.scope(s, 'owner'), 'workspace load', null, now);
  const auditCost = { batches: d1.batches, statements: d1.statements };
  const row = events('viewWorkspace')[0];
  check(() => { assert.equal(count('audit_events', A), before.audit + 1, 'one event for six patients'); assert.equal(count('command_receipts', A), before.receipts); assert.equal(count('record_revisions', A), before.revisions); assert.deepEqual(org(A), before.org); });
  check(() => { assert.equal(row.action, 'viewWorkspace'); assert.equal(row.person_id, null); assert.equal(row.actor_id, 'owner'); assert.equal(row.subject, A); assert.equal(row.role, 'clinician'); assert.ok(Number.isInteger(row.seq) && row.seq > 0); assert.match(row.hash, /^[0-9a-f]{64}$/); assert.equal(load1.scopeSize, 6); });
  check(() => { assert.equal(auditCost.batches, 1); assert.ok(auditCost.statements <= 3, JSON.stringify(auditCost)); });
  // The cost of the load itself, for comparison (a viewer-scoped read of the same organisation).
  d1.statements = 0; await store.readState(d1, A, undefined, 'owner'); const readStatements = d1.statements;
  let v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.head.hash, row.hash); });

  // 4. The cost does not grow with the scope: a state of 500 people costs the same one batch and at most three statements.
  const big = structuredClone(s); big.workspace.people = Array.from({ length: 500 }, (_, i) => ({ ...structuredClone(w.people[0]), id: `bulk-${i}`, assigned: true })); big.workspace.visits = []; big.workspace.referrals = []; big.workspace.submissions = [];
  d1.batches = 0; d1.statements = 0; await ra.recordWorkspaceLoad(d1, big, actor, store.scope({ ...big, workspace: { ...big.workspace, people: [] } }, 'owner'), 'workspace load', null, now);
  const bigCost = { batches: d1.batches, statements: d1.statements };
  check(() => { assert.equal(bigCost.batches, 1); assert.ok(bigCost.statements <= 3, JSON.stringify(bigCost)); assert.equal(events('viewWorkspace').length, 2); assert.match(events('viewWorkspace')[1].detail, /500 patients in care scope; 500 records returned in full/); });

  // 5. Authority: role, membership version and delegated authority are in the event, and so under the chain hash.
  check(() => { assert.match(row.detail, / Authority: role clinician \(organisation owner\), membership version 7; delegated authority in force: none\.$/); });
  check(() => assert.ok(chain.canonicalArray(row).includes(row.detail), 'the authority clause is part of the hashed content'));
  s = await state(); s.operations = { delegations: [{ id: 'del-1', version: 1, kind: 'reporting', grantorId: 'owner', delegateId: 'clin', teamIds: ['default'], from: '2026-09-30T00:00:00.000Z', until: '2026-10-20T00:00:00.000Z', reason: 'Synthetic reporting cover for the week.', createdAt: now }, { id: 'del-old', version: 1, kind: 'reporting', grantorId: 'owner', delegateId: 'clin', teamIds: ['default'], from: '2026-08-01T00:00:00.000Z', until: '2026-08-20T00:00:00.000Z', reason: 'Expired synthetic cover.', createdAt: now }, { id: 'del-revoked', version: 2, kind: 'reporting', grantorId: 'owner', delegateId: 'clin', teamIds: ['default'], from: '2026-09-30T00:00:00.000Z', until: '2026-10-20T00:00:00.000Z', reason: 'Revoked synthetic cover.', createdAt: now, revokedAt: now }] };
  const clinMember = store.scope(s, 'clin');
  const clause = access.authorityClause(s, clinMember, now);
  check(() => { assert.match(clause, /^ Authority: role clinician, membership version 2; delegated authority in force: reporting del-1 \(grantor owner, until 2026-10-20T00:00:00.000Z\)\.$/); assert.equal(clause.includes('del-old'), false, 'an expired delegation is not in force'); assert.equal(clause.includes('del-revoked'), false, 'a revoked delegation is not in force'); });
  check(() => assert.match(access.authorityClause(null, clinMember, now), /membership version 2; delegated authority: not consulted for this view/));
  const delegated = await ra.recordAggregateView(d1, s, clinActor, clinMember, 'operations and care report', 'Operations view read (JSON): 30-day window.', now);
  check(() => { const e = events('viewAggregate').at(-1); assert.match(e.detail, /delegated authority in force: reporting del-1/); assert.equal(e.actor_id, 'clin'); assert.equal(e.person_id, null); assert.equal(e.subject, 'operations and care report'); void delegated; });

  // 6. The 6t events carry the authority clause too (every access event does).
  s = await state();
  const older = await access.recordAccess(d1, s, actor, store.scope(s, 'owner'), { action: 'viewRecordHistory', subject: w.people[0].id, personId: w.people[0].id, detail: 'Revision history read: 2 revisions.' }, now);
  check(() => assert.match(older.detail, /^Revision history read: 2 revisions\. Authority: role clinician \(organisation owner\), membership version 7; delegated authority in force: none\.$/));

  // 7. Patient searches and lists: kind and result count; the search text has no way into the event.
  check(() => {
    assert.equal(ra.patientListDetail({ text: true, programme: false, later: false }, 3, 3), 'Patient search: text search (name, village or id); first page; 3 rows returned of 3 matching.');
    assert.equal(ra.patientListDetail({ text: true, programme: true, later: false }, 1, 1), 'Patient search: text search with programme filter; first page; 1 row returned of 1 matching.');
    assert.equal(ra.patientListDetail({ text: false, programme: true, later: true }, 50, null), 'Patient list: programme filter; later page; 50 rows returned.');
    assert.equal(ra.patientListDetail({ text: false, programme: false, later: false }, 0, 0), 'Patient list: browse; first page; 0 rows returned of 0 matching.');
    assert.equal(ra.patientListDetail.length, 3, 'the detail builder takes the kind, the row count and the total: no search text parameter');
  });
  const secret = 'SECRET-SEARCH-TEXT'; void secret;
  await ra.recordPatientList(d1, A, actor, { ...owner }, { text: true, programme: false, later: false }, 2, 2, now);
  await ra.recordPatientList(d1, A, actor, { ...owner }, { text: false, programme: false, later: true }, 50, null, now);
  await ra.recordWorkList(d1, A, actor, { ...owner }, 'submissions', true, false, 7, 7, now);
  s = await state();
  await ra.recordMatchSearch(d1, s, actor, store.scope(s, 'owner'), 2, false, now);
  check(() => {
    const search = events('searchPatients'), list = events('listPatients');
    assert.equal(search.length, 2); assert.equal(list.length, 2);
    assert.match(search[0].detail, /^Patient search: text search \(name, village or id\); first page; 2 rows returned of 2 matching\. Authority: role clinician \(organisation owner\), membership version 7; delegated authority: not consulted/);
    assert.match(search[1].detail, /^Patient search: duplicate check on registration \(name, age, sex, village and team entered; not recorded\); 2 candidates returned\. Authority:/);
    assert.match(list[0].detail, /^Patient list: browse; later page; 50 rows returned\./);
    assert.match(list[1].detail, /^Work list: submissions \(attention tab\); first page; 7 rows returned of 7\./);
    for (const e of [...search, ...list]) { assert.equal(e.person_id, null); assert.equal(e.actor_id, 'owner'); assert.equal(e.subject, A); assert.equal(JSON.stringify(e).includes(secret), false); for (const n of names) assert.equal(e.detail.includes(n), false); }
  });

  // 8. A browser-reported open: in scope only, one event, a second report within a minute is not recorded again, a later one is.
  s = await state(); const vm = store.scope(s, 'owner'), p0 = w.people[0].id;
  const o1 = await ra.recordRecordOpened(d1, s, actor, vm, p0, 'work list', now);
  check(() => { assert.equal(o1.recorded, true); const e = events('openRecord'); assert.equal(e.length, 1); assert.equal(e[0].person_id, p0); assert.equal(e[0].subject, p0); assert.match(e[0].detail, /^Record opened on screen from work list \(the record was already loaded in the browser; reported by the browser\)\. Authority: role clinician \(organisation owner\), membership version 7;/); assert.equal(e[0].detail.includes(names[0]), false); });
  const o2 = await ra.recordRecordOpened(d1, s, actor, vm, p0, 'patient list', '2026-10-02T09:00:30.000Z');
  check(() => { assert.equal(o2.recorded, false); assert.equal(o2.coalesced, true); assert.equal(events('openRecord').length, 1); });
  const o3 = await ra.recordRecordOpened(d1, s, actor, vm, p0, 'patient list', '2026-10-02T09:01:01.000Z');
  check(() => { assert.equal(o3.recorded, true); assert.equal(events('openRecord').length, 2); });
  const o4 = await ra.recordRecordOpened(d1, s, actor, vm, w.people[1].id, 'search', now);
  check(() => { assert.equal(o4.recorded, true, 'a different patient is not coalesced'); assert.equal(events('openRecord').length, 3); });
  const oEmergency = await ra.recordRecordOpened(d1, s, actor, vm, emergency.id, 'link', now);
  check(() => { assert.equal(oEmergency.recorded, true); assert.match(events('openRecord').at(-1).detail, /Through emergency access grant grant-9\./); });
  // Out of scope: another viewer (a clinician of the default team has no access to the 'other' team patient) is refused with 404 and nothing is written.
  const n0 = count('audit_events', A);
  await rejects(() => ra.recordRecordOpened(d1, s, clinActor, store.scope(s, 'clin'), emergency.id, 'link', now), e => e.status === 404);
  await rejects(() => ra.recordRecordOpened(d1, s, actor, vm, 'no-such-patient', 'link', now), e => e.status === 404);
  check(() => assert.equal(count('audit_events', A), n0, 'a refused open writes nothing'));
  check(() => assert.deepEqual(org(A), before.org, 'no read moved the organisation or patient revision'));

  // 9. The Activity log leaves summary events out unless asked; a patient event is always listed; only owners and administrators ever see summaries.
  const def = (await store.auditPage(d1, A, 'owner')).events.map(e => e.action), withSummaries = (await store.auditPage(d1, A, 'owner', null, true)).events.map(e => e.action);
  check(() => { for (const a of chain.SUMMARY_ACCESS_ACTIONS) assert.equal(def.includes(a), false, a + ' is not in the default page'); assert.ok(def.includes('openRecord'), 'a record open is listed'); assert.ok(def.includes('viewRecordHistory')); });
  check(() => { for (const a of ['viewWorkspace', 'searchPatients', 'listPatients', 'viewAggregate']) assert.ok(withSummaries.includes(a), a + ' is returned when asked'); });
  const clinSees = (await store.auditPage(d1, A, 'clin', null, true)).events.map(e => e.action);
  check(() => { for (const a of chain.SUMMARY_ACCESS_ACTIONS) assert.equal(clinSees.includes(a), false, 'a non-owner clinician never sees ' + a); });

  // 10. Fail closed: with the audit store refusing inserts, every new read is refused with the access message and writes nothing.
  const fault = () => d1.db.exec(`CREATE TRIGGER audit_fault BEFORE INSERT ON audit_events WHEN NEW.org_id='${A}' BEGIN SELECT RAISE(ABORT, 'Synthetic audit store failure'); END;`);
  const heal = () => d1.db.exec('DROP TRIGGER audit_fault;');
  const refused = e => { assert.equal(e.status, 503); assert.equal(e.message, access.ACCESS_REFUSED); return true; };
  fault();
  try {
    const snap = { audit: count('audit_events', A), receipts: count('command_receipts', A), org: org(A) };
    s = await state(); const fm = store.scope(s, 'owner');
    await rejects(() => ra.recordWorkspaceLoad(d1, s, actor, fm, 'workspace load', null, now), refused);
    await rejects(() => ra.recordRecordOpened(d1, s, actor, fm, w.people[2].id, 'link', now), refused);
    await rejects(() => ra.recordPatientList(d1, A, actor, owner, { text: true, programme: false, later: false }, 1, 1, now), refused);
    await rejects(() => ra.recordWorkList(d1, A, actor, owner, 'work', false, false, 1, 1, now), refused);
    await rejects(() => ra.recordMatchSearch(d1, s, actor, fm, 0, false, now), refused);
    await rejects(() => ra.recordAggregateView(d1, s, actor, fm, 'indicator results', 'x', now), refused);
    check(() => { assert.equal(count('audit_events', A), snap.audit); assert.equal(count('command_receipts', A), snap.receipts); assert.deepEqual(org(A), snap.org); });
  } finally { heal(); }
  s = await state(); await ra.recordWorkspaceLoad(d1, s, actor, store.scope(s, 'owner'), 'workspace load', null, now);
  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.firstBreak, null); });

  // 11. Every read path records before it returns, in source order, and the new route accepts POST only.
  const src = f => readFileSync(f, 'utf8'), at = (text, needle) => { const i = text.indexOf(needle); assert.ok(i >= 0, 'missing: ' + needle); return i; };
  const server = src('lib/saha/server.ts');
  check(() => { const f = server.slice(at(server, 'export async function loadFor')); const body = f.slice(0, at(f, '\n// The organisation a request acts in')); assert.ok(at(body, 'auditWindow(db(),state,u,scope(state,u.userId),paged.ids)') < at(body, 'recordWorkspaceLoad('), 'the window audit comes first'); assert.ok(at(body, 'recordWorkspaceLoad(') < at(body, 'return state;'), 'the load is recorded before the state is returned'); });
  check(() => { assert.match(server, /snapshotFor\(await loadFor\(u,request\?\.headers\.get\('x-saha-organisation'\),undefined,true,pagingRequest\(request\),'workspace load'\),u\)/); assert.match(server, /pagingRequest\(request\),'response to a command'\),u\)/); assert.match(server, /await recordWorkspaceLoad\(db\(\),state,u,m,'replay of a saved command',null\);return \{result:JSON\.parse\(old\.result\),snapshot:await snapshotFor\(state,u\),replayed:true\}/); });
  const dirSrc = src('lib/saha/patient-directory-server.ts');
  check(() => { assert.ok(at(dirSrc, 'await recordPatientList(') < at(dirSrc, 'return json(page);')); assert.match(dirSrc, /recordPatientList\(db\(\), orgId, u, member, \{ text: !!query\.q, programme: !!query\.programme, later: !!query\.cursor \}, page\.rows\.length, page\.total\)/, 'the recorder is given a boolean, never the search text'); });
  const wl = src('lib/saha/worklists-server.ts');
  check(() => assert.ok(at(wl, 'await recordWorkList(') < at(wl, 'return json(page);')));
  const cont = src('lib/saha/continuity-server.ts');
  check(() => assert.ok(at(cont, 'await recordMatchSearch(') < at(cont, 'return json(result);')));
  const ind = src('lib/saha/indicators-server.ts');
  check(() => assert.ok(at(ind, "await recordAggregateView(db(),s,u,m,'indicator results'") < at(ind, 'return json(shape(released));') && at(ind, "await recordAggregateView(db(),s,u,m,'indicator results'") < at(ind, 'if(previous){')));
  const ops = src('lib/saha/operations-server.ts');
  check(() => assert.ok(at(ops, "recordAggregateView(db(),s,u,m,'operations and care report'") < at(ops, 'return json(result);}')));
  const agg = src('lib/saha/aggregate-reports-server.ts');
  check(() => assert.ok(at(agg, "await recordAggregateView(db(),s,u,m,'aggregate report history'") < at(agg, 'return json({destinations,reports')));
  const route = src('app/api/record-opened/route.ts');
  check(() => { assert.match(route, /export async function POST/); assert.equal(/export async function (GET|PUT|PATCH|DELETE)/.test(route), false, 'POST only'); assert.match(src('lib/saha/monitoring.ts'), /'record-opened'/); });
  const opened = src('lib/saha/record-opened-server.ts');
  check(() => { assert.ok(at(opened, "origin !== new URL(request.url).origin") < at(opened, 'recordRecordOpened('), 'origin is checked before anything is read'); assert.match(opened, /Object\.keys\(body\)\.some\(k => !\['personId', 'source'\]\.includes\(k\)\)/); });
  check(() => { assert.ok(existsSync('app/api/record-opened/route.ts')); });

  // 12. The client opens a record only after the server has recorded the open (blocking, online) and says so when it cannot.
  const ws = src('app/workspace.tsx');
  check(() => { assert.match(ws, /const markOpened=async\(pid:string,source:string\):Promise<boolean>/); assert.match(ws, /const openPerson=async\(p:Person,source='other'\)=>\{if\(!await markOpened\(p\.id,source\)\)return;setSelected\(p\.id\)/); assert.match(ws, /if\(known&&!await markOpened\(pid,'link'\)\)return;/); assert.match(ws, /not in the organisation audit log/); });

  v = await chain.verifyChain(d1, A);
  check(() => { assert.equal(v.status, 'intact'); assert.equal(v.firstBreak, null); });
  const result = { suite: 'read-audit completion contract (slice 10h)', passed, workspaceLoadCost: { auditBatches: auditCost.batches, auditStatements: auditCost.statements, auditRoundTrips: 2, fiveHundredPeopleStatements: bigCost.statements, rowsWrittenPerLoad: 1, viewerScopedReadStatementsForComparison: readStatements }, completedAt: new Date().toISOString() };
  console.log(JSON.stringify(result));
  writeFileSync('tests/read-audit-completion-contract-result.json', JSON.stringify(result, null, 2) + '\n');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
