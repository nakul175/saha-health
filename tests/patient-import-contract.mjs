// Slice 2f contract: controlled patient import (BR-DATA-11). CSV parsing and header rules, importer authority, row
// classification (accepted, rejected with reasons, possible duplicates against permitted records and earlier rows),
// a plan hash bound to the rows and record versions, apply of that exact plan with lineage, environment marking and
// one counted audit event, and no names in the dry run.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.patient-import-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['patient-import', 'core', 'access', 'continuity', 'delegation', 'environment', 'identity', 'referral-rules', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const I = await import(pathToFileURL(join(dir, 'patient-import.js')));
  const now = '2026-09-30T08:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: `Name ${userId}`, accountCode: 'C'.repeat(24), role, isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now, ...extra });
  const owner = member('owner', 'clinician', { isOwner: true }), sup = member('sup', 'supervisor');
  const person = (id, name, age, village, teamId = 'default', version = 1) => ({ id, name, age, sex: 'Female', village, programmes: ['General care'], task: '', due: '', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version, teamId, assignedTo: null });
  const state = () => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner, sup], invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [person('p1', 'Existing Synthetic Person', 40, 'Lakeside'), person('p2', 'Other Team Person', 30, 'Hilltop', 'north')], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  // 1. CSV parsing.
  check(() => assert.deepEqual(I.parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n\n,\n'), [['a', 'b'], ['x, y', 'say "hi"']]));
  await rejects(async () => I.parseCsv('a,b\n"open,1'), 422, /unclosed quoted field/);
  const header = 'name,age,sex,village,programme,team';
  const file = [header,
    'Asha Synthetic One,34,female,Riverside,Maternal care,Care team',
    '"Synthetic, Two",61,Male,Riverside,chronic care,default',
    'Bad Age,abc,Female,Riverside,General care,Care team',
    'Bad Sex,20,F,Riverside,General care,Care team',
    'Unknown Team,20,Female,Riverside,General care,Nowhere',
    'Outside Scope,20,Female,Riverside,General care,North team',
    'Short Row,20,Female',
    'Existing Synthetic Person,41,Female,Lakeside,General care,Care team',
    'Asha Synthetic One,35,Female,Riverside,General care,Care team',
    ',20,Female,Riverside,General care,Care team'].join('\n');
  // 2. Header and size rules.
  await rejects(() => I.planImport(state(), owner, 'name,age,sex,village,programme\nA,1,Female,V,General care', 'synthetic', now), 422, /Missing: team/);
  await rejects(() => I.planImport(state(), owner, header + ',notes\nA,1,Female,V,General care,default,x', 'synthetic', now), 422, /Not recognised: 1 column/);
  await rejects(() => I.planImport(state(), owner, 'name,name,age,sex,village,programme,team\n', 'synthetic', now), 422, /exactly these columns once each/);
  await rejects(() => I.planImport(state(), owner, header, 'synthetic', now), 422, /no rows/);
  await rejects(() => I.planImport(state(), owner, [header, ...Array.from({ length: 101 }, (_, n) => `P${n},20,Female,V,General care,default`)].join('\n'), 'synthetic', now), 422, /At most 100 rows/);
  check(() => { assert.equal(I.patientImportSchema.safeParse({ type: 'patientImportApply', csv: 'x'.repeat(16001), planHash: 'a'.repeat(64), reason: 'Long enough reason' }).success, false); assert.equal(I.patientImportSchema.safeParse({ type: 'patientImportApply', csv: header, planHash: 'a'.repeat(64), reason: 'short' }).success, false); });
  // 3. Importer authority: owners and supervisors with a care or supervisor role, for teams they belong to.
  for (const m of [member('asha', 'asha'), member('clin', 'clinician'), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('sus', 'supervisor', { status: 'suspended' })])
    await rejects(() => I.planImport(state(), m, file, 'synthetic', now), 403, /Only an owner or supervisor/);
  // 4. Row classification, without names.
  const plan = await I.planImport(state(), owner, file, 'synthetic', now);
  const byRow = Object.fromEntries(plan.rows.map(r => [r.row, r]));
  check(() => { assert.deepEqual(plan.counts, { rows: 10, accepted: 2, rejected: 6, duplicates: 2 }); assert.equal(byRow[1].status, 'accepted'); assert.equal(byRow[2].status, 'accepted'); assert.equal(byRow[2].teamId, 'default'); });
  check(() => { assert.match(byRow[3].reasons[0], /Age must be a whole number/); assert.match(byRow[4].reasons[0], /Sex must be/); assert.match(byRow[5].reasons[0], /not a team of this organisation/); assert.match(byRow[6].reasons[0], /outside the teams you may import into/); assert.match(byRow[7].reasons[0], /has 3 fields/); assert.match(byRow[10].reasons[0], /Name is required/); });
  check(() => { assert.equal(byRow[8].status, 'duplicate'); assert.deepEqual(byRow[8].candidates, [{ personId: 'p1', version: 1 }]); assert.match(byRow[8].reasons[0], /Possible match with 1 existing record/); });
  check(() => { assert.equal(byRow[9].status, 'duplicate'); assert.equal(byRow[9].duplicateOfRow, 1); assert.match(byRow[9].reasons[0], /duplicate of row 1/); });
  check(() => { const text = JSON.stringify(I.publicPlan(plan)); for (const name of ['Asha Synthetic One', 'Synthetic, Two', 'Existing Synthetic Person', 'Riverside', 'Lakeside']) assert.equal(text.includes(name), false, name); assert.equal(I.publicPlan(plan).accepted, undefined); });
  // 5. The plan hash is stable and bound to the file and to record versions in the named teams.
  const again = await I.planImport(state(), owner, file, 'synthetic', now);
  check(() => assert.equal(again.planHash, plan.planHash));
  const bumped = state(); bumped.workspace.people[0].version = 2;
  const bumpedPlan = await I.planImport(bumped, owner, file, 'synthetic', now);
  check(() => assert.notEqual(bumpedPlan.planHash, plan.planHash, 'record version bound'));
  const otherTeam = state(); otherTeam.workspace.people[1].version = 5;
  const otherPlan = await I.planImport(otherTeam, owner, file, 'synthetic', now);
  check(() => assert.equal(otherPlan.planHash, plan.planHash, 'records outside the named teams do not bind the plan'));
  const edited = await I.planImport(state(), owner, file.replace('Riverside,Maternal', 'Riverbank,Maternal'), 'synthetic', now);
  check(() => assert.notEqual(edited.planHash, plan.planHash, 'row values bound'));
  // 6. Apply only that plan.
  const actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'o@example.invalid' };
  const apply = (s, over = {}, env = { SAHA_ENVIRONMENT: 'synthetic' }, m = owner) => I.applyPatientImport(s, { type: 'patientImportApply', csv: file, planHash: plan.planHash, reason: 'Synthetic batch import for testing', ...over }, actor, m, env, now);
  const other = await I.applyPatientImport(state(), { type: 'saveVisit' }, actor, owner, {}, now);
  check(() => assert.equal(other, null, 'other commands are not handled'));
  await rejects(() => apply(bumped), 409, /changed since the dry run/);
  await rejects(() => apply(state(), {}, { SAHA_ENVIRONMENT: 'nonsense' }), 409, /not configured correctly/);
  await rejects(() => apply(state(), {}, undefined, member('clin', 'clinician')), 403, /Only an owner or supervisor/);
  await rejects(() => apply(state(), {}, { SAHA_ENVIRONMENT: 'staging' }), 409, /changed since the dry run/);
  const s = state(), done = await apply(s);
  check(() => { assert.deepEqual(done.counts, { rows: 10, accepted: 2, rejected: 6, duplicates: 2, created: 2 }); assert.deepEqual(done.created.map(c => c.row), [1, 2]); assert.equal(done.markedSynthetic, true); assert.equal(s.workspace.people.length, 4); });
  check(() => { const made = s.workspace.people.slice(2); assert.deepEqual(made.map(p => p.name), ['Asha Synthetic One', 'Synthetic, Two']); assert.deepEqual(made[0].programmes, ['Maternal care', 'General care']); assert.equal(made[1].sex, 'Male'); assert.deepEqual(made[1].programmes, ['Chronic care', 'General care']); assert.ok(made.every(p => p.synthetic === true && p.teamId === 'default' && p.assignedTo === null && p.version === 1 && p.identityReview.state === 'local' && p.imported.batchId === done.batchId && p.imported.planHash === plan.planHash)); assert.deepEqual(made.map(p => p.imported.row), [1, 2]); });
  check(() => { assert.equal(s.workspace.audit.length, 1); const a = s.workspace.audit[0]; assert.equal(a.action, 'patientImportApply'); assert.equal(a.subject, 'org'); assert.match(a.detail, /10 rows, 2 people created and marked synthetic, 6 rejected, 2 possible duplicates left for review/); assert.equal(a.detail.includes('Asha Synthetic One'), false); });
  // Re-applying the same plan is refused: the created people now make the rows possible duplicates.
  await rejects(() => apply(s), 409, /changed since the dry run/);
  const replan = await I.planImport(s, owner, file, 'synthetic', now);
  check(() => { assert.equal(replan.counts.accepted, 0); assert.equal(replan.counts.duplicates, 4); });
  // Staging: created people are not marked synthetic; a supervisor may import into their own team.
  const stagingPlan = await I.planImport(state(), sup, file, 'staging', now), st = state();
  const stDone = await I.applyPatientImport(st, { type: 'patientImportApply', csv: file, planHash: stagingPlan.planHash, reason: 'Synthetic staging import check' }, { userId: 'sup', displayName: 'Sup', email: 's@example.invalid' }, sup, { SAHA_ENVIRONMENT: 'staging' }, now);
  check(() => { assert.equal(stDone.markedSynthetic, false); assert.equal(st.workspace.people.slice(2).some(p => p.synthetic), false); assert.equal(stDone.created.length, 2); });
  const nothing = await I.planImport(state(), owner, [header, 'Bad Age,abc,Female,Riverside,General care,Care team'].join('\n'), 'synthetic', now);
  await rejects(() => I.applyPatientImport(state(), { type: 'patientImportApply', csv: [header, 'Bad Age,abc,Female,Riverside,General care,Care team'].join('\n'), planHash: nothing.planHash, reason: 'Nothing to create here' }, actor, owner, { SAHA_ENVIRONMENT: 'synthetic' }, now), 409, /no rows to create/);
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/patient-import-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Patient import: RFC 4180 parsing (quotes, doubled quotes, CRLF, BOM, blank lines, unclosed quote), exact header, row and size limits, importer authority (ASHA, clinician, administrator owner and suspended supervisor refused), row classification with reasons (age, sex, unknown team, team outside scope, field count, empty name), possible duplicates against permitted records and earlier rows, no names in the dry run, plan hash bound to rows and to record versions in the named teams, apply refusals (stale plan, misconfigured environment, non-importer, other environment, nothing to create), creation of exactly the accepted rows with lineage, local identity review and synthetic marking in the synthetic environment only, one counted audit event without names, repeat apply refused.' }, null, 2) + '\n');
console.log(`${passed} patient import contract checks passed`);
