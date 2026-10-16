// Slice 2h contract: controlled import of programme enrolments and external identifiers for existing people
// (BR-DATA-11), on the slice 2f pattern. Person resolution by Saha id or exact external identifier with a neutral
// reason outside scope; pack and version rules (compiled or activated, adopted by default); refusal of an already open
// episode; identifier formats for known issuers, ABHA refused, organisation-wide uniqueness with neutral wording outside
// scope; plan hash binding; apply of the exact plan with lineage and one counted audit event; the rejection report
// (row numbers and reasons only, formula-escaped cells, manifest verified by verifyExportCsv).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.record-import-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'import-rejections', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'patient-import', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'contact-import', 'record-import', 'referral-needs', 'referral-request', 'referral-rules', 'report-export', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'team-pack-adoption', 'installed-transition-authority', 'programme-completion', 'types', 'visit-import'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const R = await import(pathToFileURL(join(dir, 'record-import.js')));
  const X = await import(pathToFileURL(join(dir, 'import-rejections.js')));
  const E = await import(pathToFileURL(join(dir, 'report-export.js')));
  const P = await import(pathToFileURL(join(dir, 'patient-import.js')));
  const now = '2026-10-02T08:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: `Name ${userId}`, accountCode: 'C'.repeat(24), role, isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now, ...extra });
  const owner = member('owner', 'clinician', { isOwner: true }), sup = member('sup', 'supervisor');
  const person = (id, name, teamId = 'default', extra = {}) => ({ id, name, age: 40, sex: 'Female', village: 'Lakeside', programmes: ['General care'], task: '', due: '', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId, assignedTo: null, ...extra });
  const ident = (issuer, value) => ({ issuer, value, verified: false, recordedAt: now, recordedBy: 'owner', source: 'import', imported: { batchId: 'b0', row: 1, planHash: '0'.repeat(64) } });
  const episode = (packId, packVersion = 1) => ({ id: 'e-' + packId, packId, packVersion, state: 'active', episodeLabel: 'Existing synthetic episode', startDate: null, createdAt: now, createdBy: 'owner', registration: 'not_submitted' });
  const weight = { id: 'weight', label: 'Weight', unit: 'kg', fact: 'weight', required: true };
  const installed = (id, version, state) => ({ id: `inst-${id}-${version}`, state, pack: { id, version, name: `Synthetic ${id}`, programme: 'Child health', purpose: 'Synthetic installed pack for testing.', questions: [weight], installed: { installationId: `inst-${id}-${version}`, manifestHash: 'a'.repeat(64) } } });
  const state = () => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner, sup], invitations: [],
    operations: { installedPacks: [installed('child', 1, 'active'), installed('teen', 1, 'approved'), installed('child', 2, 'retired')] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [
      person('p1', 'Synthetic Person One', 'default', { identifiers: [ident('rch', '111122223333')] }),
      person('p2', 'Synthetic Other Team', 'north', { identifiers: [ident('nikshay', '1234567')] }),
      person('p3', 'Synthetic Person Three', 'default', { enrolments: [episode('maternal')] }),
      person('p4', 'Synthetic Merged', 'default', { mergedInto: { personId: 'p1', caseId: 'c1', at: now, by: 'owner' } }),
      person('p5', 'Synthetic Person Five', 'default', { identifiers: [ident('rch', '555566667777')] })], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  // 1. Schema, header and size rules.
  check(() => { assert.equal(R.recordImportInput.safeParse({ kind: 'notes', csv: 'a' }).success, false, 'an unknown kind is refused (visits became a kind in slice 10i; see visit-import-contract.mjs)'); assert.equal(R.recordImportInput.safeParse({ kind: 'enrolments', csv: 'x'.repeat(16001) }).success, false); assert.equal(R.recordImportSchema.safeParse({ type: 'recordImportApply', kind: 'identifiers', csv: 'a', planHash: 'a'.repeat(64), reason: 'short' }).success, false); });
  const EH = 'person,pack,version,episode_label,start_date', IH = 'person,issuer,identifier';
  await rejects(() => R.planRecordImport(state(), owner, 'enrolments', 'person,pack,version,episode_label\np1,tb,,Label', 'synthetic', now), 422, /Missing: start_date/);
  await rejects(() => R.planRecordImport(state(), owner, 'identifiers', IH + ',name\np1,rch,1,x', 'synthetic', now), 422, /Not recognised: 1 column/);
  await rejects(() => R.planRecordImport(state(), owner, 'identifiers', IH, 'synthetic', now), 422, /no rows/);
  await rejects(() => R.planRecordImport(state(), owner, 'identifiers', [IH, ...Array.from({ length: 101 }, () => 'p1,rch,111122223333')].join('\n'), 'synthetic', now), 422, /At most 100 rows/);
  // 2. The same importers as slice 2f.
  for (const m of [member('asha', 'asha'), member('ao', 'asha', { isOwner: true }), member('clin', 'clinician'), member('adm', 'admin', { isOwner: true, teamIds: [] }), member('sus', 'supervisor', { status: 'suspended' })])
    await rejects(() => R.planRecordImport(state(), m, 'enrolments', EH + '\np1,tb,,Label ok,', 'synthetic', now), 403, /Only an owner or supervisor/);
  // 3. Enrolment rows.
  const efile = [EH,
    'p1,tb,,TB screening episode,2026-09-01',
    'rch:111122223333,hypertension,1,Hypertension follow-up,',
    'p3,maternal,,Second maternal episode,',
    'p2,tb,,Other team episode,',
    'nosuch,tb,,Unknown record episode,',
    'p1,maternal,7,Unknown version episode,',
    'p1,unknownpack,,Unknown pack episode,',
    'p1,TB,,Repeated TB episode,',
    'p4,tb,,Merged record episode,',
    'p1,maternal,2,Future episode,2999-01-01',
    'nikshay:1234567,tb,,Identifier outside scope,',
    'p1,maternal,2,Named compiled version,2026-08-01',
    'p5,child,,Installed pack episode,',
    'p5,teen,,Approved but not active,',
    'p3,child,2,Retired installed version,',
    'p3,tb,,x,'].join('\n');
  const eplan = await R.planRecordImport(state(), owner, 'enrolments', efile, 'synthetic', now), E1 = Object.fromEntries(eplan.rows.map(r => [r.row, r]));
  check(() => { assert.deepEqual(eplan.counts, { rows: 16, accepted: 4, rejected: 12 }); assert.deepEqual(eplan.rows.filter(r => r.status === 'accepted').map(r => r.row), [1, 2, 12, 13]); });
  check(() => { assert.equal(E1[2].personId, 'p1', 'matched by an exact external identifier'); assert.equal(eplan.accepted.find(a => a.row === 1).packVersion, 1, 'adopted version by default'); assert.equal(eplan.accepted.find(a => a.row === 12).packVersion, 2, 'a named compiled version'); assert.equal(eplan.accepted.find(a => a.row === 13).packVersion, 1, 'an activated installed pack'); });
  check(() => { assert.match(E1[3].reasons[0], /already has an open episode of this pack/); assert.match(E1[6].reasons[0], /compiled or activated version/); assert.match(E1[7].reasons[0], /not in this organisation's catalogue/); assert.match(E1[8].reasons[0], /Row 1 in this file already opens this pack/); assert.match(E1[9].reasons[0], /merged into another record/); assert.match(E1[10].reasons[0], /cannot be in the future/); assert.match(E1[14].reasons[0], /not in this organisation's catalogue/); assert.match(E1[15].reasons[0], /compiled or activated version/); assert.match(E1[16].reasons[0], /Episode label is required/); });
  check(() => { for (const r of [4, 5, 11]) { assert.deepEqual(E1[r].reasons, ['No record in the teams you may import into matches this person.'], `row ${r} neutral`); assert.equal(E1[r].personId, undefined, `row ${r} names no record`); } });
  check(() => { const text = JSON.stringify(R.publicRecordPlan(eplan)); for (const x of ['TB screening episode', 'Synthetic Person', 'Lakeside', '111122223333', '1234567', 'p2']) assert.equal(text.includes(x), false, x); assert.equal(R.publicRecordPlan(eplan).accepted, undefined); });
  // 4. The plan hash.
  const again = await R.planRecordImport(state(), owner, 'enrolments', efile, 'synthetic', now);
  check(() => assert.equal(again.planHash, eplan.planHash));
  const bumped = state(); bumped.workspace.people[0].version = 2;
  const bumpedPlan = await R.planRecordImport(bumped, owner, 'enrolments', efile, 'synthetic', now);
  check(() => assert.notEqual(bumpedPlan.planHash, eplan.planHash, 'record versions bound'));
  const other = state(); other.workspace.people[1].version = 9;
  const otherPlan = await R.planRecordImport(other, owner, 'enrolments', efile, 'synthetic', now);
  check(() => assert.equal(otherPlan.planHash, eplan.planHash, 'records outside the matched teams do not bind the plan'));
  const envPlan = await R.planRecordImport(state(), owner, 'enrolments', efile, 'staging', now);
  check(() => assert.notEqual(envPlan.planHash, eplan.planHash, 'environment bound'));
  // 5. Apply exactly the plan.
  const actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'o@example.invalid' };
  const apply = (s, kind, csv, planHash, over = {}, env = { SAHA_ENVIRONMENT: 'synthetic' }, m = owner) => R.applyRecordImport(s, { type: 'recordImportApply', kind, csv, planHash, reason: 'Synthetic batch import for testing', ...over }, actor, m, env, now);
  check(() => assert.equal(R.recordImportSchema.safeParse({ type: 'patientImportApply' }).success, false));
  assert.equal(await R.applyRecordImport(state(), { type: 'saveVisit' }, actor, owner, {}, now), null); passed++;
  await rejects(() => apply(bumped, 'enrolments', efile, eplan.planHash), 409, /changed since the dry run/);
  await rejects(() => apply(state(), 'enrolments', efile, eplan.planHash, {}, { SAHA_ENVIRONMENT: 'nonsense' }), 409, /not configured correctly/);
  await rejects(() => apply(state(), 'enrolments', efile, eplan.planHash, {}, undefined, member('clin', 'clinician')), 403, /Only an owner or supervisor/);
  await rejects(() => apply(state(), 'identifiers', efile, eplan.planHash), 422, /header must name exactly/);
  const s = state(), done = await apply(s, 'enrolments', efile, eplan.planHash);
  check(() => { assert.deepEqual(done.counts, { rows: 16, accepted: 4, rejected: 12, source: 16, parsed: 16, duplicates: 2, merged: 0, applied: 4, records: 2 }); assert.deepEqual(done.rows, [1, 2, 12, 13]); assert.equal(JSON.stringify(done).includes('p1'), false, 'result carries no record ids'); });
  check(() => { const p1 = s.workspace.people[0]; assert.deepEqual(p1.enrolments.map(e => [e.packId, e.packVersion, e.state, e.registration]), [['tb', 1, 'active', 'not_submitted'], ['hypertension', 1, 'active', 'not_submitted'], ['maternal', 2, 'active', 'not_submitted']]); assert.ok(p1.enrolments.every(e => e.imported.planHash === eplan.planHash && e.imported.by === 'owner' && e.createdBy === 'owner')); assert.deepEqual(p1.enrolments.map(e => e.imported.row), [1, 2, 12]); assert.deepEqual(p1.programmes, ['General care', 'TB screening', 'Chronic care', 'Maternal care']); assert.equal(p1.enrolments[0].startDate, '2026-09-01'); assert.equal(p1.enrolments[1].startDate, null); });
  check(() => { const p5 = s.workspace.people[4]; assert.equal(p5.enrolments[0].packId, 'child'); assert.ok(p5.programmes.includes('Child health')); assert.equal(s.workspace.people[2].enrolments.length, 1, 'the open maternal episode is not duplicated'); });
  check(() => { assert.equal(s.workspace.audit.length, 1); const a = s.workspace.audit[0]; assert.equal(a.action, 'recordImportApply'); assert.equal(a.subject, 'org'); assert.match(a.detail, /\(enrolments\) batch .* 16 rows, 4 episodes opened \(official registration not submitted\) on 2 records, 12 rejected/); for (const x of ['TB screening episode', 'Synthetic Person', '111122223333']) assert.equal(a.detail.includes(x), false, x); });
  await rejects(() => apply(s, 'enrolments', efile, eplan.planHash), 409, /changed since the dry run/);
  const replan = await R.planRecordImport(s, owner, 'enrolments', efile, 'synthetic', now);
  check(() => assert.equal(replan.counts.accepted, 0, 'the applied episodes are now open'));
  await rejects(() => apply(s, 'enrolments', efile, replan.planHash), 409, /no rows to apply/);
  // SAHA-030: the batch register reconciles source/parsed/accepted/rejected/duplicate/merged totals and unchanged
  // imported enrolments have a separate reversal dry run. Dependent care work refuses the whole reversal.
  check(() => { const b=s.operations.legacyImportBatches[0];assert.deepEqual({kind:b.kind,source:b.sourceRows,parsed:b.parsedRows,accepted:b.accepted,rejected:b.rejected,duplicates:b.duplicateCandidates,merged:b.merged},{kind:'enrolments',source:16,parsed:16,accepted:4,rejected:12,duplicates:2,merged:0}); });
  const importedEpisode=s.workspace.people[0].enrolments[0];s.workspace.visits.push({id:'dependent',personId:'p1',version:1,state:'draft',facts:{},createdAt:now,aiResults:[],recordVersion:1,programmeCapture:{packs:[{enrolmentId:importedEpisode.id,pack:{}}]}});
  await rejects(()=>R.planLegacyImportReversal(s,owner,'enrolments',done.batchId,'synthetic'),409,/dependent work/);s.workspace.visits.pop();
  const er=await R.planLegacyImportReversal(s,owner,'enrolments',done.batchId,'synthetic');
  const erDone=await R.applyRecordImport(s,{type:'recordImportReverse',kind:'enrolments',batchId:done.batchId,planHash:er.planHash,reason:'Reverse synthetic failed legacy batch'},actor,owner,{SAHA_ENVIRONMENT:'synthetic'},now);
  check(()=>{assert.equal(erDone.counts.applied,4);assert.ok(s.workspace.people.flatMap(p=>p.enrolments??[]).filter(e=>e.imported?.batchId===done.batchId).every(e=>e.state==='closed'&&e.imported.reversal));assert.equal(s.operations.legacyImportBatches[0].reversal.reversed,4);assert.equal(s.workspace.audit.at(-1).action,'recordImportReverse');});
  await rejects(()=>R.planLegacyImportReversal(s,owner,'enrolments',done.batchId,'synthetic'),409,/already has a recorded reversal/);
  // 6. Identifier rows.
  // Slice 6aa (seventh review, finding 5): issuers are an allowlist, so the rows that test uniqueness and scope use listed
  // issuers (rch, nikshay) instead of the unlisted ehr_local and local_mrn; their assertions are unchanged.
  const ifile = [IH,
    'p1,nikshay,7654321',
    'p3,rch,123456789012',
    'p1,rch,999988887777',
    'p1,rch,111122223333',
    'p3,nikshay,1234567',
    'p3,rch,555566667777',
    'p1,abha,12345678901234',
    'p3,rch,12345',
    'p3,BAD ISSUER,123',
    'p5,nikshay,7654321',
    'p3,rch,123456789013',
    'p1,local_mrn,=SUM(A1)',
    'p2,nikshay,2222333',
    'p4,local_mrn,M-1'].join('\n');
  const iplan = await R.planRecordImport(state(), owner, 'identifiers', ifile, 'synthetic', now), I1 = Object.fromEntries(iplan.rows.map(r => [r.row, r]));
  check(() => { assert.deepEqual(iplan.counts, { rows: 14, accepted: 2, rejected: 12 }); assert.deepEqual(iplan.rows.filter(r => r.status === 'accepted').map(r => r.row), [1, 2]); });
  check(() => { assert.match(I1[3].reasons[0], /different identifier from this issuer/); assert.match(I1[4].reasons[0], /already recorded on this record/); assert.match(I1[7].reasons[0], /ABHA numbers and addresses are linked through ABHA verification/); assert.match(I1[8].reasons[0], /An RCH ID is 12 digits/); assert.match(I1[9].reasons[0], /Issuer must be a short lower-case code/); assert.match(I1[10].reasons[0], /Row 1 in this file already carries this identifier/); assert.match(I1[11].reasons[0], /Row 2 in this file already gives this record an identifier from this issuer/); assert.match(I1[12].reasons[0], /Identifier must be 1 to 64/); assert.match(I1[14].reasons[0], /merged into another record/); });
  check(() => { assert.deepEqual(I1[5].reasons, ['This identifier cannot be recorded here. Ask an identity steward to review before importing it.'], 'neutral outside scope'); assert.equal(I1[5].conflict, undefined); assert.equal(JSON.stringify(I1[5]).includes('p2'), false); });
  check(() => { assert.match(I1[6].reasons[0], /already recorded on another record you can see/); assert.deepEqual(I1[6].conflict, { personId: 'p5', version: 1 }); assert.deepEqual(I1[13].reasons, ['No record in the teams you may import into matches this person.']); });
  check(() => { const text = JSON.stringify(R.publicRecordPlan(iplan)); for (const x of ['7654321', '123456789012', 'X-1', '12345678901234', 'SUM(A1)', 'Synthetic Person']) assert.equal(text.includes(x), false, x); });
  // A supervisor without care scope in the north team gets the neutral reason too; with the north team, the ABHA-style wording names the record.
  { const st = state(), north = member('sup2', 'supervisor', { teamIds: ['default', 'north'] }); st.members.push(north);
    const p = await R.planRecordImport(st, north, 'identifiers', IH + '\np3,nikshay,1234567', 'synthetic', now);
    check(() => { assert.match(p.rows[0].reasons[0], /another record you can see/); assert.deepEqual(p.rows[0].conflict, { personId: 'p2', version: 1 }); }); }
  const si = state(), idone = await apply(si, 'identifiers', ifile, iplan.planHash);
  check(() => { assert.deepEqual(idone.counts, { rows: 14, accepted: 2, rejected: 12, source: 14, parsed: 14, duplicates: 6, merged: 0, applied: 2, records: 2 }); const p1 = si.workspace.people[0], p3 = si.workspace.people[2]; assert.deepEqual(p1.identifiers.map(i => [i.issuer, i.value]), [['rch', '111122223333'], ['nikshay', '7654321']]); assert.deepEqual(p3.identifiers.map(i => [i.issuer, i.value, i.verified, i.source, i.imported.row]), [['rch', '123456789012', false, 'import', 2]]); });
  check(() => { const a = si.workspace.audit[0]; assert.match(a.detail, /\(identifiers\) batch .* 14 rows, 2 identifiers recorded \(not verified with the issuer\) on 2 records, 12 rejected/); for (const x of ['7654321', '123456789012']) assert.equal(a.detail.includes(x), false, x); });
  // An imported identifier then matches its record in a later enrolment import.
  const later = await R.planRecordImport(si, owner, 'enrolments', EH + '\nnikshay:7654321,tb,,Matched by imported identifier,\nRCH:123456789012,tb,,Matched by imported identifier,', 'synthetic', now);
  check(() => { assert.equal(later.rows[0].personId, 'p1'); assert.equal(later.rows[1].personId, 'p3', 'the issuer is matched case-insensitively'); assert.equal(later.counts.accepted, 2); });
  // Identifier values are masked in snapshots and history like ABHA numbers; the stored record keeps them.
  { const A = await import(pathToFileURL(join(dir, 'abdm.js'))), p1 = si.workspace.people[0], red = A.redactAbha(p1);
    check(() => { assert.deepEqual(red.identifiers.map(i => i.value), ['XXXXXXXX3333', 'XXX4321']); assert.equal(p1.identifiers[1].value, '7654321'); const rev = A.redactRevision({ entityType: 'person', data: p1, changes: [] }); assert.equal(JSON.stringify(rev).includes('7654321'), false); assert.equal(A.maskIdentifier('X-1'), 'XXX'); }); }
  const importedIdentifier=si.workspace.people[0].identifiers.at(-1),ref=R.identifierRef?.(importedIdentifier)??`import:${importedIdentifier.imported.batchId}:${importedIdentifier.imported.row}`;
  si.workspace.people[0].identifiers.push({issuer:importedIdentifier.issuer,value:importedIdentifier.value,verified:false,recordedAt:now,recordedBy:'owner',source:'crosswalk',id:'changed',kind:'correct',corrects:ref,origin:'programme-system',verification:'unverified',reason:'Synthetic changed identity'});
  await rejects(()=>R.planLegacyImportReversal(si,owner,'identifiers',idone.batchId,'synthetic'),409,/corrected or withdrawn/);si.workspace.people[0].identifiers.pop();
  const ir=await R.planLegacyImportReversal(si,owner,'identifiers',idone.batchId,'synthetic'),irDone=await R.applyRecordImport(si,{type:'recordImportReverse',kind:'identifiers',batchId:idone.batchId,planHash:ir.planHash,reason:'Reverse synthetic failed identifier batch'},actor,owner,{SAHA_ENVIRONMENT:'synthetic'},now);
  check(()=>{assert.equal(irDone.counts.applied,2);assert.equal(si.workspace.people.flatMap(p=>p.identifiers??[]).filter(e=>e.kind==='withdraw'&&e.corrects?.startsWith('import:')).length,2);assert.equal(si.operations.legacyImportBatches[0].reversal.reversed,2);});
  // 7. Replay recheck.
  check(() => { assert.throws(() => R.authorizeRecordImport(state(), member('asha', 'asha', { isOwner: true }), { type: 'recordImportApply' }), e => e.status === 403); R.authorizeRecordImport(state(), sup, { type: 'recordImportApply' }); R.authorizeRecordImport(state(), member('asha', 'asha'), { type: 'other' }); });
  // 8. Rejection report: row numbers and reasons only, formula-escaped, manifest verified.
  const report = await X.rejectionReport(R.publicRecordPlan(iplan), { exportId: 'export-1', kind: 'identifiers', role: 'clinician', generatedAt: now });
  const verified = await E.verifyExportCsv(report.csv);
  check(() => { assert.equal(verified.ok, true, JSON.stringify(verified.problems)); assert.equal(verified.sha256, report.sha256); assert.equal(report.listed, 12); assert.equal(report.reconciled, true); });
  check(() => { const lines = report.csv.split('\r\n'); assert.ok(lines.includes('"Report definition","saha-import-rejections","1.0.0"')); assert.ok(lines.includes('"Status","Dry-run rejection report; nothing was imported by this download"')); assert.ok(lines.some(l => l.startsWith('"5","Rejected","This identifier cannot be recorded here.'))); assert.equal(lines.some(l => l.startsWith('"1",')), false, 'accepted rows are not listed'); });
  check(() => { for (const x of ['7654321', '123456789012', 'X-1', 'SUM(A1)', 'Synthetic Person', 'p2', 'p5']) assert.equal(report.csv.includes(x), false, x); });
  { const crafted = await X.rejectionReport({ import: 'x', planHash: 'h', counts: { rows: 1, accepted: 0 }, rows: [{ row: 1, status: 'rejected', reasons: ['=HYPERLINK("https://example.invalid")', '+1\nsecond line'] }] }, { exportId: 'e', kind: 'people', role: 'supervisor', generatedAt: now });
    check(() => { assert.ok(crafted.csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'), 'formula escaped'); assert.ok(crafted.csv.includes('"\'+1 second line"'), 'line breaks flattened and formula escaped'); }); }
  { const bad = await X.rejectionReport({ import: 'x', planHash: 'h', counts: { rows: 3, accepted: 0 }, rows: [{ row: 1, status: 'rejected', reasons: ['A reason'] }] }, { exportId: 'e', kind: 'people', role: 'supervisor', generatedAt: now });
    check(() => { assert.equal(bad.reconciled, false); assert.equal(bad.csv.includes('"Rows not accepted","3","1","Distinct row numbers listed above","no"'), true); }); }
  // The people import (slice 2f) dry run has the same report: possible duplicates are listed as such.
  { const header = 'name,age,sex,village,programme,team', pfile = [header, 'Synthetic Person One,40,Female,Lakeside,General care,Care team', 'Bad Age,abc,Female,Riverside,General care,Care team', 'New Synthetic Person,30,Male,Riverside,General care,Care team'].join('\n');
    const pp = P.publicPlan(await P.planImport(state(), owner, pfile, 'synthetic', now)), pr = await X.rejectionReport(pp, { exportId: 'e2', kind: 'people', role: 'clinician', generatedAt: now });
    check(() => { assert.ok(pr.csv.includes('"1","Possible duplicate","Possible match with 1 existing record you can see.')); assert.ok(pr.csv.includes('"2","Rejected","Age must be a whole number')); assert.equal(pr.listed, 2); for (const x of ['Synthetic Person One', 'Lakeside', 'Riverside', 'New Synthetic']) assert.equal(pr.csv.includes(x), false, x); }); }
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/record-import-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Enrolment and identifier import (slice 2h): kinds, header and size limits, importer authority as slice 2f (ASHA including an ASHA owner, clinician, administrator owner, suspended supervisor refused), person resolution by Saha id or exact identifier with one neutral reason for unknown and out-of-scope records, adopted, named compiled and activated installed pack versions, approved-only and retired versions and unknown packs refused, open-episode and in-file duplicates refused, merged records, future and invalid dates, identifier issuer and format checks (RCH, Ni-kshay), ABHA refused, organisation-wide identifier uniqueness with a neutral reason outside scope and a named conflict inside scope, in-file duplicates, no names, labels or identifier values in the plan, plan hash bound to record versions, rows and environment, apply of the exact plan with lineage, programmes and one counted audit event and no record ids in the result, replay authority, and the rejection report (definition, status, row numbers and reasons only, formula escaping, control total, manifest verified, people dry run duplicates listed).' }, null, 2) + '\n');
console.log(`${passed} record import contract checks passed`);
