// Slice 10i contract: controlled import of historical visits with clinical content (BR-DATA-11), kind `visits` of the slice 2h
// record import. Importers (owner or clinician), person resolution within normal care scope with one neutral reason for unknown
// and out-of-scope records, units stated and converted by the slice 2i rules, unusual values (reason needed; beyond the
// confirmation range refused), sources, duplicates, a plan hash bound to the file digest and the matched records, apply creating
// confirmed visits marked IMPORTED with lineage and nothing else, the guard that keeps imported visits read-only history, and the
// exclusion of imported visits from indicators and work statistics.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.visit-import-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for(const f of readdirSync('lib/saha').filter(x=>x.endsWith('.ts')).map(x=>x.slice(0,-3)))
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  const R = await load('record-import'), V = await load('visit-import'), G = await load('imported-visits'), X = await load('import-rejections'), E = await load('report-export'), F = await load('fact-verification'), I = await load('indicators'), W = await load('worklist-views'), FP = await load('fact-provenance');
  const now = '2026-10-02T08:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: `Name ${userId}`, accountCode: 'C'.repeat(24), role, isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now, ...extra });
  const owner = member('owner', 'clinician', { isOwner: true }), clin = member('clin', 'clinician'), supOwner = member('supo', 'supervisor', { isOwner: true }), sup = member('sup', 'supervisor');
  const person = (id, name, teamId = 'default', extra = {}) => ({ id, name, age: 40, sex: 'Female', village: 'Lakeside', programmes: ['General care'], task: '', due: '', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId, assignedTo: null, ...extra });
  const old = { id: 'v-old', personId: 'p6', version: 2, recordVersion: 1, state: 'confirmed', facts: { date: '2026-07-01T00:00', systolic: '', diastolic: '', weight: '60', temperature: '', weeks: '', coughDays: '', notes: 'Earlier import', source: 'reported' }, createdAt: now, confirmedAt: now, aiResults: [], imported: { batchId: 'b0', row: 1, at: now, by: 'owner', byName: 'Name owner', role: 'clinician', planHash: '0'.repeat(64), fileDigest: '1'.repeat(64), sourceSystem: 'Legacy HMIS' } };
  const state = () => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner, clin, supOwner, sup], invitations: [],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [
      person('p1', 'Synthetic Person One', 'default', { identifiers: [{ issuer: 'rch', value: '111122223333', verified: false, recordedAt: now, recordedBy: 'owner', source: 'import', imported: { batchId: 'b0', row: 1, planHash: '0'.repeat(64) } }] }),
      person('p2', 'Synthetic Other Team', 'north'),
      person('p3', 'Synthetic Restricted', 'default', { restrictions: [{ id: 'r1', scope: 'processing', reason: 'Synthetic', requestedAt: now }] }),
      person('p4', 'Synthetic Provisional', 'default', { identityReview: { state: 'provisional', by: 'owner', at: now, reason: 'Synthetic', candidateCount: 1 } }),
      person('p5', 'Synthetic Merged', 'default', { mergedInto: { personId: 'p1', caseId: 'c1', at: now, by: 'owner' } }),
      person('p6', 'Synthetic Person Six', 'default'),
      person('p7', 'Synthetic Person Seven', 'default', { assignedTo: 'asha1' })], visits: [structuredClone(old)], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  // The file format: every column named once; cells quoted when needed.
  const H = V.VISIT_COLUMNS, q = x => /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x, line = o => H.map(c => q(o[c] ?? '')).join(','), csv = rows => [H.join(','), ...rows.map(line)].join('\n');
  const w = (over = {}) => ({ person: 'p1', visit_date: '2026-08-01', source_system: 'Legacy HMIS', weight: '70', weight_unit: 'kg', weight_source: 'measured', ...over });
  check(() => { assert.equal(H.length, 21); assert.equal(R.recordImportInput.safeParse({ kind: 'visits', csv: 'a' }).success, true, 'visits is an import kind'); assert.equal(R.recordImportInput.safeParse({ kind: 'notes', csv: 'a' }).success, false); assert.equal(R.recordImportSchema.safeParse({ type: 'recordImportApply', kind: 'visits', csv: 'a', planHash: 'a'.repeat(64), reason: 'Synthetic batch import' }).success, true); assert.equal(X.REJECTION_KINDS.includes('visits'), true); });
  const rows = [
    /* 1 */ w({ systolic: '120', diastolic: '80', bp_unit: 'mmHg', bp_source: 'measured', notes: 'Synthetic historical note one' }),
    /* 2 */ w({ visit_date: '2026-08-02T09:30', source_system: 'LEGACY hmis', weight: '154', weight_unit: 'lb', weight_source: 'reported', temperature: '98.6', temperature_unit: 'degF', temperature_source: 'measured', cough_duration: '2', cough_unit: 'weeks', cough_source: 'reported' }),
    /* 3 */ w({ person: 'nosuch' }),
    /* 4 */ w({ person: 'p2' }),
    /* 5 */ w({ visit_date: '2026-08-03', weight_unit: 'stone' }),
    /* 6 */ w({ visit_date: '2026-08-04', weight_unit: '' }),
    /* 7 */ w({ visit_date: '2026-08-05', weight_source: '' }),
    /* 8 */ w({ visit_date: '2026-08-06', weight: '200' }),
    /* 9 */ w({ visit_date: '2026-08-07', weight: '200', override_reason: 'Source record states 200 kg; recorded in clinic' }),
    /* 10 */ w({ visit_date: '2026-08-08', weight: '400', override_reason: 'Source record states 400 kg; recorded in clinic' }),
    /* 11 */ w({ visit_date: '2026-08-09', override_reason: 'There is nothing unusual here at all' }),
    /* 12 */ w({ person: 'p6', visit_date: '2026-07-01', source_system: 'legacy  hmis' }),
    /* 13 */ w({ systolic: '120', diastolic: '80', bp_unit: 'mmHg', bp_source: 'measured', notes: 'Synthetic historical note one' }),
    /* 14 */ w({ visit_date: '2999-01-01' }),
    /* 15 */ w({ visit_date: '1999-12-31' }),
    /* 16 */ w({ visit_date: '2026-02-30' }),
    /* 17 */ { person: 'p1', visit_date: '2026-08-10', source_system: 'Legacy HMIS' },
    /* 18 */ w({ person: 'p3', visit_date: '2026-08-11' }),
    /* 19 */ w({ person: 'p4', visit_date: '2026-08-11' }),
    /* 20 */ w({ person: 'p5', visit_date: '2026-08-11' }),
    /* 21 raw short row below */ null,
    /* 22 */ w({ visit_date: '2026-08-12', weight_source: 'declined' }),
    /* 23 */ { person: 'p1', visit_date: '2026-08-13', source_system: 'Legacy HMIS', weight_source: 'declined', notes: 'Weighing declined by the person' },
    /* 24 */ { person: 'p1', visit_date: '2026-08-14', source_system: 'Legacy HMIS', systolic: '120', bp_unit: 'mmHg', bp_source: 'measured' },
    /* 25 */ w({ visit_date: '2026-08-15', weight: '7O' }),
    /* 26 */ w({ visit_date: '2026-08-16', weight_unit: 'constructor' }),
    /* 27 */ w({ person: 'rch:111122223333', visit_date: '2026-08-17', weight: '71' }),
    /* 28 */ { person: 'p1', visit_date: '2026-08-18', source_system: 'Legacy HMIS', temperature: '37.2', temperature_unit: 'C', temperature_source: 'measured' },
    /* 29 */ { person: 'p1', visit_date: '2026-08-19', source_system: 'Legacy HMIS', systolic: '210', diastolic: '130', bp_unit: 'mmHg', bp_source: 'measured', override_reason: 'Confirmed in the source record by repeat reading' },
    /* 30 */ w({ visit_date: '2026-08-20', notes: 'Bad\u0001note' }),
    /* 31 */ w({ person: 'p6', visit_date: '2026-07-02', weight: '61', notes: 'Synthetic note for record six' }),
  ];
  const lines = rows.map(r => r === null ? 'p1,2026-08-11,Legacy HMIS' : line(r));
  const file = [H.join(','), ...lines].join('\n');
  const plan = async (st = state(), m = owner, text = file, env = 'synthetic') => R.planRecordImport(st, m, 'visits', text, env, now);
  // 1. Header and size rules.
  await rejects(() => R.planRecordImport(state(), owner, 'visits', H.slice(1).join(',') + '\n1', 'synthetic', now), 422, /Missing: person/);
  await rejects(() => R.planRecordImport(state(), owner, 'visits', H.join(',') + ',name\n' + '1', 'synthetic', now), 422, /Not recognised: 1 column/);
  await rejects(() => R.planRecordImport(state(), owner, 'visits', H.join(','), 'synthetic', now), 422, /no rows/);
  await rejects(() => R.planRecordImport(state(), owner, 'visits', [H.join(','), ...Array.from({ length: 101 }, () => line(w()))].join('\n'), 'synthetic', now), 422, /At most 100 rows/);
  await rejects(() => R.planRecordImport(state(), owner, 'enrolments', file, 'synthetic', now), 422, /header must name exactly/);
  // 2. Importers: an owner or a clinician. Everyone else is refused, on the server.
  check(() => { assert.equal(V.mayImportVisits(owner), true); assert.equal(V.mayImportVisits(clin), true); assert.equal(V.mayImportVisits(supOwner), true); for (const m of [sup, member('asha', 'asha'), member('ao', 'asha', { isOwner: true }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('sus', 'clinician', { status: 'suspended' }), member('prov', 'provider'), member('lost', 'clinician', { teamIds: [] })]) assert.equal(V.mayImportVisits(m), false, m.userId); });
  for (const m of [sup, member('asha', 'asha'), member('ao', 'asha', { isOwner: true }), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('sus', 'clinician', { status: 'suspended' }), member('prov', 'provider')])
    await rejects(() => plan(state(), m), 403, /Only an organisation owner or a clinician can import visits/);
  check(() => { assert.throws(() => R.authorizeRecordImport(state(), sup, { type: 'recordImportApply', kind: 'visits' }), e => e.status === 403); R.authorizeRecordImport(state(), clin, { type: 'recordImportApply', kind: 'visits' }); R.authorizeRecordImport(state(), supOwner, { type: 'recordImportApply', kind: 'visits' }); assert.throws(() => R.authorizeRecordImport(state(), clin, { type: 'recordImportApply', kind: 'enrolments' }), e => e.status === 403, 'a clinician without supervision still cannot import enrolments'); });
  // 3. Row classification.
  const p = await plan(), r = Object.fromEntries(p.rows.map(x => [x.row, x]));
  check(() => { assert.deepEqual(p.counts, { rows: 31, accepted: 8, rejected: 23 }); assert.deepEqual(p.rows.filter(x => x.status === 'accepted').map(x => x.row), [1, 2, 9, 23, 27, 28, 29, 31]); assert.equal(p.fileDigest, createHash('sha256').update(file).digest('hex')); });
  check(() => { assert.deepEqual(r[3].reasons, ['No record in the teams you may import into matches this person.']); assert.deepEqual(r[4].reasons, r[3].reasons, 'unknown and out-of-scope records are indistinguishable'); assert.equal(r[3].personId, undefined); assert.equal(r[4].personId, undefined); });
  check(() => { assert.match(r[5].reasons[0], /Weight: the unit is not supported; use kg or lb/); assert.match(r[6].reasons[0], /Weight: state the unit \(kg or lb\); a unit is never assumed/); assert.match(r[7].reasons[0], /Weight: state the source, measured or reported/); assert.match(r[8].reasons[0], /Weight is outside the expected range 2–150 kg \(engineering placeholder — not clinically approved\) and the row has no override_reason of at least 10 characters/); });
  check(() => { assert.match(r[10].reasons[0], /Weight is beyond the confirmation range 0\.5–300 kg .* no step for a clinician's confirmation/); assert.match(r[11].reasons[0], /override_reason applies only to a row with a value outside the expected range/); assert.match(r[12].reasons[0], /already exists for this record/); assert.deepEqual(r[12].duplicateOf, { visitId: 'v-old' }); assert.match(r[13].reasons[0], /Row 1 in this file already imports a visit for this record, source system and date/); });
  check(() => { assert.match(r[14].reasons[0], /cannot be in the future/); assert.match(r[15].reasons[0], /cannot be before 2000-01-01/); assert.match(r[16].reasons[0], /real date written YYYY-MM-DD/); assert.match(r[17].reasons[0], /no measurement and no notes/); assert.match(r[18].reasons[0], /restricted for this record under a rights request/); assert.match(r[19].reasons[0], /identity review is provisional/); assert.match(r[20].reasons.join(' '), /merged into another record/); assert.match(r[21].reasons[0], /Row 21 has 3 fields; the header has 21/); });
  check(() => { assert.match(r[22].reasons[0], /needs the source measured or reported/); assert.match(r[24].reasons.join(' '), /both readings/); assert.match(r[25].reasons[0], /Weight: enter a positive number/); assert.match(r[26].reasons[0], /unit is not supported/); assert.match(r[30].reasons[0], /control characters/); });
  check(() => { assert.equal(r[27].personId, 'p1', 'matched by an exact external identifier'); assert.equal(r[1].personId, 'p1'); assert.equal(r[1].version, 1); });
  // What the dry run returns: row numbers, ids, versions, counts and reasons; never clinical values, notes, names or source systems.
  check(() => { const text = JSON.stringify(R.publicRecordPlan(p)); for (const x of ['Synthetic historical note', 'Weighing declined', 'Legacy HMIS', 'Synthetic Person', 'Lakeside', '111122223333', 'record six', 'override_reason":"']) assert.equal(text.includes(x), false, x); assert.equal(R.publicRecordPlan(p).accepted, undefined); assert.equal(R.publicRecordPlan(p).fileDigest, p.fileDigest); });
  // The facts apply would store: stated units converted by the slice 2i rules, with the entered value, sources, reasons.
  const acc = n => p.accepted.find(a => a.row === n).facts;
  check(() => { const f = acc(2); assert.equal(f.date, '2026-08-02T09:30'); assert.equal(f.weight, '69.85'); assert.deepEqual(f.entered.weight, { value: '154', unit: 'lb' }); assert.equal(f.temperature, '37'); assert.deepEqual(f.entered.temperature, { value: '98.6', unit: 'degF' }); assert.equal(f.coughDays, '14'); assert.deepEqual(f.entered.coughDays, { value: '2', unit: 'wk' }); assert.deepEqual(f.provenance, { weight: { source: 'reported' }, temperature: { source: 'measured' }, coughDays: { source: 'reported' } }); assert.equal(f.source, 'reported', 'the visit-level source is the weaker claim; each measurement states its own'); });
  check(() => { const f = acc(1); assert.equal(f.date, '2026-08-01T00:00', 'a date alone is stored as 00:00'); assert.deepEqual([f.systolic, f.diastolic, f.weight, f.notes], ['120', '80', '70', 'Synthetic historical note one']); assert.equal(f.unusual, undefined); assert.deepEqual(acc(9).unusual, { weight: 'Source record states 200 kg; recorded in clinic' }); assert.deepEqual(acc(29).unusual, { systolic: 'Confirmed in the source record by repeat reading', diastolic: 'Confirmed in the source record by repeat reading' }); assert.deepEqual(acc(23).provenance, { weight: { source: 'declined' } }); assert.equal(acc(23).weight, ''); assert.equal(acc(28).temperature, '37.2'); assert.equal(acc(28).entered, undefined, 'a value in the base unit is not an entered conversion'); });
  // 4. The plan hash: bound to the file as sent, matched records, existing imported visits, the importer and the environment.
  const again = await plan();
  check(() => assert.equal(again.planHash, p.planHash));
  const trailing = await plan(state(), owner, file + '\n');
  check(() => { assert.deepEqual(trailing.counts, p.counts); assert.notEqual(trailing.planHash, p.planHash, 'the file digest is bound'); assert.notEqual(trailing.fileDigest, p.fileDigest); });
  const bumpedPlan = await (async () => { const st = state(); st.workspace.people[0].version = 2; return plan(st); })();
  check(() => assert.notEqual(bumpedPlan.planHash, p.planHash, 'a matched record version is bound'));
  const unrelated = await (async () => { const st = state(); st.workspace.people[6].version = 9; st.workspace.people[1].version = 9; return plan(st); })();
  check(() => assert.equal(unrelated.planHash, p.planHash, 'records the file does not match do not bind the plan'));
  const withVisit = await (async () => { const st = state(), v = structuredClone(old); v.id = 'v-new'; v.personId = 'p1'; v.facts.date = '2026-08-01T00:00'; st.workspace.visits.push(v); return plan(st); })();
  check(() => { assert.notEqual(withVisit.planHash, p.planHash); assert.equal(withVisit.rows[0].status, 'rejected', 'row 1 is now a duplicate of an existing imported visit'); assert.deepEqual(withVisit.rows[0].duplicateOf, { visitId: 'v-new' }); });
  const voided = await (async () => { const st = state(); st.workspace.visits[0].voidedAt = now; st.workspace.visits[0].voidReason = 'Synthetic'; return plan(st); })();
  check(() => assert.equal(voided.rows[11].status, 'accepted', 'a voided imported visit no longer blocks the same source, record and date'));
  const envPlan = await plan(state(), owner, file, 'staging');
  check(() => assert.notEqual(envPlan.planHash, p.planHash, 'environment bound'));
  const byClin = await plan(state(), clin);
  check(() => { assert.deepEqual(byClin.counts, p.counts); assert.notEqual(byClin.planHash, p.planHash, 'importer bound'); });
  // A clinician of another team resolves only that team's records.
  { const north = member('north', 'clinician', { teamIds: ['north'] }), np = await plan(state(), north, csv([w({ person: 'p2', visit_date: '2026-08-01' }), w({ person: 'p1', visit_date: '2026-08-01' })])); check(() => { assert.deepEqual(np.rows.map(x => x.status), ['accepted', 'rejected']); assert.deepEqual(np.rows[1].reasons, r[3].reasons); }); }
  // 5. Apply exactly the plan.
  const actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'o@example.invalid' };
  const apply = (st, csvText, planHash, over = {}, env = { SAHA_ENVIRONMENT: 'synthetic' }, m = owner, kind = 'visits') => R.applyRecordImport(st, { type: 'recordImportApply', kind, csv: csvText, planHash, reason: 'Synthetic historical visit import for testing', ...over }, actor, m, env, now);
  const stale = state(); stale.workspace.people[0].version = 2;
  await rejects(() => apply(stale, file, p.planHash), 409, /changed since the dry run/);
  await rejects(() => apply(state(), file, p.planHash, {}, { SAHA_ENVIRONMENT: 'nonsense' }), 409, /not configured correctly/);
  await rejects(() => apply(state(), file, p.planHash, {}, undefined, member('asha', 'asha')), 403, /Only an organisation owner or a clinician/);
  await rejects(() => apply(state(), file, p.planHash, {}, undefined, sup), 403, /Only an organisation owner or a clinician/);
  check(() => assert.equal(R.recordImportSchema.safeParse({ type: 'recordImportApply', kind: 'visits', csv: 'a', planHash: 'a'.repeat(64), reason: 'short' }).success, false, 'a reason of at least 10 characters is required'));
  await rejects(() => apply(state(), file + '\n', p.planHash), 409, /changed since the dry run/);
  const s = state(), before = structuredClone(s), done = await apply(s, file, p.planHash);
  check(() => { assert.deepEqual(done.counts, { rows: 31, accepted: 8, rejected: 23, applied: 8, records: 2 }); assert.deepEqual(done.rows, [1, 2, 9, 23, 27, 28, 29, 31]); assert.equal(done.kind, 'visits'); });
  const made = s.workspace.visits.filter(v => v.imported && v.id !== 'v-old');
  check(() => { assert.equal(s.workspace.visits.length, before.workspace.visits.length + 8); assert.equal(made.length, 8); assert.deepEqual(made.map(v => v.imported.row), [1, 2, 9, 23, 27, 28, 29, 31]); const text = JSON.stringify(done); for (const v of made) assert.equal(text.includes(v.id), false, 'result carries no visit ids'); assert.equal(text.includes('p1'), false); });
  const digest = createHash('sha256').update(file).digest('hex');
  check(() => { for (const v of made) { assert.equal(v.state, 'confirmed'); assert.equal(v.version, 1); assert.equal(v.createdAt, now); assert.equal(v.confirmedAt, now); assert.deepEqual(v.aiResults, []); assert.equal(v.plan, undefined, 'no plan'); assert.equal(v.programmeCapture, undefined, 'no programme answers'); assert.equal(v.patientCheck, undefined, 'no patient check by a clinician'); assert.equal(v.signOffs, undefined, 'no sign-off'); assert.equal(v.factReviews, undefined, 'no clinician verification'); assert.equal(v.referralRequest, undefined); const i = v.imported; assert.deepEqual([i.by, i.byName, i.role, i.at, i.planHash, i.fileDigest], ['owner', 'Synthetic owner', 'clinician', now, p.planHash, digest]); assert.match(i.batchId, /^[0-9a-f-]{36}$/); assert.equal(i.batchId, made[0].imported.batchId); } assert.equal(made.find(v => v.imported.row === 31).personId, 'p6'); assert.equal(made.find(v => v.imported.row === 2).imported.sourceSystem, 'LEGACY hmis', 'the source system is kept as written'); });
  check(() => { assert.deepEqual(s.workspace.people, before.workspace.people, 'the import does not change any person: no version, programme, enrolment, assignment or status'); assert.equal(s.workspace.submissions.length, 0); assert.equal(s.workspace.referrals.length, 0); assert.equal(s.workspace.people.some(x => (x.enrolments ?? []).length || (x.followUps ?? []).length), false, 'no enrolment or follow-up'); assert.deepEqual(s.workspace.visits.find(v => v.id === 'v-old'), before.workspace.visits[0]); });
  check(() => { assert.equal(s.workspace.audit.length, 1); const a = s.workspace.audit[0]; assert.equal(a.action, 'recordImportApply'); assert.equal(a.subject, 'org'); assert.match(a.detail, /\(visits\) batch .* 31 rows, 8 visits created as confirmed IMPORTED records on 2 records \(no clinician sign-off implied; no enrolment, submission, referral or plan created\), 23 rejected/); assert.ok(a.detail.includes(`file SHA-256 ${digest}`)); for (const x of ['Synthetic historical note', 'Legacy HMIS', 'Weighing declined', '69.85']) assert.equal(a.detail.includes(x), false, x); });
  await rejects(() => apply(s, file, p.planHash), 409, /changed since the dry run/);
  const replan = await plan(s);
  check(() => { assert.equal(replan.counts.accepted, 0, 'every row is now a duplicate or still rejected'); for (const n of [1, 2, 9, 23, 27, 28, 29, 31]) assert.match(replan.rows[n - 1].reasons[0], /already exists for this record|Row \d+ in this file/); });
  await rejects(() => apply(s, file, replan.planHash), 409, /no rows to apply/);
  // The server then credits each value to the importer and records the reasons for unusual values (slice 2i), without any confirmation.
  F.recordFactAuthors(before, s, actor, owner, now);
  check(() => { const heavy = made.find(v => v.imported.row === 9), bp = made.find(v => v.imported.row === 29); assert.equal(heavy.valueOverrides.length, 1); assert.deepEqual([heavy.valueOverrides[0].field, heavy.valueOverrides[0].tier, heavy.valueOverrides[0].by.userId, heavy.valueOverrides[0].reason], ['weight', 'reason', 'owner', 'Source record states 200 kg; recorded in clinic']); assert.equal(bp.valueOverrides.length, 2); assert.equal(heavy.overrideConfirmations, undefined); assert.deepEqual(FP.unconfirmedValues(heavy), [], 'a reason-tier value needs no confirmation'); assert.equal(heavy.factAuthors.weight.userId, 'owner'); assert.equal(made.find(v => v.imported.row === 23).factReviews, undefined); });
  // 6. Replay authority and the rejection report for visits.
  const report = await X.rejectionReport(R.publicRecordPlan(p), { exportId: 'export-1', kind: 'visits', role: 'clinician', generatedAt: now }), verified = await E.verifyExportCsv(report.csv);
  check(() => { assert.equal(verified.ok, true, JSON.stringify(verified.problems)); assert.equal(report.listed, 23); assert.equal(report.reconciled, true); for (const x of ['Synthetic historical note', 'Legacy HMIS', 'Weighing declined', 'Synthetic Person', 'p1', 'v-old']) assert.equal(report.csv.includes(x), false, x); assert.ok(report.csv.includes('"3","Rejected","No record in the teams you may import into matches this person."')); });
  // 7. Imported visits are read-only history: every command naming a visit is refused, except the explicit allowances.
  const imported = made[0], own = { ...structuredClone(old), id: 'v-own', personId: 'p6', imported: undefined };
  s.workspace.visits.push(own);
  const naming = command => ({ type: command, visitId: imported.id, ...(command === 'abdmCareContextLink' ? { personId: 'p1', visitIds: [imported.id] } : {}) });
  check(() => { for (const t of G.BLOCKED_ON_IMPORTED) { const c = t === 'abdmCareContextLink' ? { type: t, personId: 'p1', visitIds: [imported.id] } : t === 'linkReferralSource' ? { type: t, referralId: 'r', kind: 'visit', sourceId: imported.id } : naming(t); assert.throws(() => G.ensureNotImported(s, c), e => e.status === 409 && /imported from another system/.test(e.message), t); if (t !== 'abdmCareContextLink' && t !== 'linkReferralSource') G.ensureNotImported(s, { ...c, visitId: 'v-own' }); } });
  check(() => { for (const t of G.ALLOWED_ON_IMPORTED) G.ensureNotImported(s, naming(t)); G.ensureNotImported(s, { type: 'startVisit', personId: 'p1' }); G.ensureNotImported(s, { type: 'linkReferralSource', referralId: 'r', kind: 'protocol-evaluation', sourceId: imported.id }); assert.equal(G.BLOCKED_ON_IMPORTED.size >= 25, true); });
  // Completeness: every command in the code base that names a visit is classified, so a new one cannot ship unclassified.
  { const metadataOnly = new Set(['work-support-server.ts']); assert.doesNotMatch(readFileSync('lib/saha/platform.ts','utf8'), /from ['"]\.\/work-support-server['"]/, 'Support metadata must not become an unclassified clinical command'); const named = new Set(); for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts') && !metadataOnly.has(f))) for (const m of readFileSync(`lib/saha/${f}`, 'utf8').matchAll(/z\.object\(\{type:z\.literal\('([A-Za-z]+)'\)([^\n]*?)\}\)(?:\.strict\(\))?,?(?:\n|$)/g)) if (/\bvisitIds?\s*:/.test(m[2])) named.add(m[1]);
    check(() => { assert.ok(named.size >= 25, `found ${named.size} commands naming a visit`); const missing = [...named].filter(t => !G.BLOCKED_ON_IMPORTED.has(t) && !G.ALLOWED_ON_IMPORTED.has(t)); assert.deepEqual(missing, [], 'every command naming a visit is blocked or explicitly allowed for an imported visit'); }); }
  // 8. Imported visits are not counted as visits recorded in Saha.
  check(() => { assert.equal(W.workStats([], [{ state: 'confirmed' }, { state: 'confirmed', imported: { batchId: 'b' } }], []).confirmed, 1); });
  { const recent = '2026-09-28T08:00:00.000Z', people = Array.from({ length: 6 }, (_, i) => person(`q${i}`, `Q${i}`, 't1', { assignedTo: 'asha', createdAt: recent }));
    const facts = { date: '2026-09-28T08:00', systolic: '130', diastolic: '', weight: '58', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic', source: 'measured' };
    const visits = people.flatMap((x, i) => [{ id: `v${i}`, personId: x.id, state: 'confirmed', facts, createdAt: recent, confirmedAt: recent }, { id: `i${i}`, personId: x.id, state: 'confirmed', facts: { ...facts, date: '2020-01-01T00:00' }, createdAt: recent, confirmedAt: recent, imported: { batchId: 'b' } }]);
    const st = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'One' }], invitations: [], outreach: { plans: [], templates: [], messages: [] }, members: [{ userId: 'sup', displayName: 'SUP', role: 'supervisor', isOwner: false, status: 'active', version: 1, teamIds: ['t1'] }], workspace: { people, visits, submissions: [], referrals: [], integrations: [], audit: [] } };
    const res = I.indicatorQuery(st, st.members[0], { ids: ['visits-confirmed', 'patients-seen'], days: 30, group: 'none' }, new Date('2026-09-30T06:00:00.000Z')).results;
    check(() => assert.equal(res.find(x => x.id === 'visits-confirmed').rows[0].value, 6, 'twelve confirmed visits, six of them imported and not counted')); }
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/visit-import-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Historical visit import (slice 10i, kind visits of the record import): importers (owner or clinician; ASHA, non-owner supervisor, administrator, suspended and provider refused), a 31-row file classified into 8 accepted and 23 rejected rows (unknown and out-of-scope person with one neutral reason, unsupported, missing and prototype-key units, missing and contradictory sources, unusual values with and without a reason, beyond the confirmation range, reason without an unusual value, duplicates of an imported visit and within the file, future, early and impossible dates, restricted, provisional and merged records, field count, control characters, a person by external identifier), conversions by the slice 2i rules, no clinical values or names in the dry run, plan hash bound to the file digest, matched records, existing imported visits, importer and environment, apply of exactly the plan creating confirmed IMPORTED visits with lineage and a file digest, no change to any person and no enrolment, submission, referral, plan, sign-off or verification, one counted audit event, repeat refused, overrides recorded by the importer, rejection report, the read-only guard over every command naming a visit with a completeness check, and exclusion from indicators and work statistics.' }, null, 2) + '\n');
console.log(`${passed} visit import contract checks passed`);
