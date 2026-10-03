// Slice 2e contract: per-measurement author from the server identity and clinician verification (BR-DATA-02):
// author stamping rules, the verify/dispute command's role, scope, state, version and self rules, append-only
// reviews, and both FHIR exports under the pinned outbound validator.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.fact-verification-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refuses = (fn, status, pattern) => { assert.throws(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fact-verification', 'fhir', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const F = await import(pathToFileURL(join(dir, 'fact-verification.js')));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const C = await import(pathToFileURL(join(dir, 'core.js')));
  const D = await import(pathToFileURL(join(dir, 'fhir-document.js')));
  const V = await import(pathToFileURL(join(dir, 'fhir-validate.js')));
  const X = await import(pathToFileURL(join(dir, 'fhir.js')));
  const now = '2026-09-30T06:00:00.000Z', visitAt = '2026-09-30T04:00';
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  const asha = { userId: 'asha-1', name: 'Synthetic ASHA', accountCode: 'A'.repeat(24), role: 'asha', at: now };
  // 1. Author stamping: changed measurements credited to the actor; unchanged keep; older facts never guessed.
  const f1 = { ...base, weight: '60', systolic: '120', diastolic: '80', provenance: { temperature: { source: 'declined' } } };
  const a1 = P.stampAuthors(undefined, f1, undefined, asha);
  check(() => { assert.deepEqual(Object.keys(a1).sort(), ['bloodPressure', 'temperature', 'weight']); assert.equal(a1.weight.userId, 'asha-1'); assert.equal(a1.temperature.role, 'asha'); });
  const clin = { userId: 'clin-1', name: 'Synthetic clinician', accountCode: 'B'.repeat(24), role: 'clinician', at: '2026-09-30T07:00:00.000Z' };
  const a2 = P.stampAuthors(f1, { ...f1, weight: '61', notes: 'Edited notes' }, a1, clin);
  check(() => { assert.equal(a2.weight.userId, 'clin-1'); assert.equal(a2.bloodPressure.userId, 'asha-1'); assert.equal(a2.temperature.userId, 'asha-1'); });
  const a3 = P.stampAuthors(f1, { ...f1, systolic: '', diastolic: '', provenance: undefined }, a1, clin);
  check(() => { assert.deepEqual(Object.keys(a3), ['weight']); assert.equal(a3.weight.userId, 'asha-1'); }, 'cleared measurements lose their author');
  const a4 = P.stampAuthors(f1, { ...f1, provenance: { temperature: { source: 'not-asked' } } }, a1, clin);
  check(() => assert.equal(a4.temperature.userId, 'clin-1', 'a changed missing reason is re-credited'));
  const old = { ...base, weight: '55', temperature: '37' };
  const a5 = P.stampAuthors(old, { ...old, temperature: '37.4' }, undefined, clin);
  check(() => { assert.deepEqual(Object.keys(a5), ['temperature']); assert.equal(a5.weight, undefined, 'older weight is not attributed to the saver'); });
  check(() => assert.equal(P.stampAuthors(undefined, base, undefined, clin), undefined));
  check(() => { assert.equal(P.authorText(undefined), 'not recorded'); assert.match(P.authorText(asha), /^Synthetic ASHA \(ASHA worker\), saved 2026-09-30 06:00 UTC$/); });
  // Clients cannot send authors: the facts object is strict and a command-level field is dropped.
  check(() => assert.equal(C.factsSchema.safeParse({ ...f1, factAuthors: { weight: asha } }).success, false));
  check(() => { const r = C.commandSchema.safeParse({ type: 'saveVisit', visitId: 'v', version: 1, facts: f1, factAuthors: { weight: asha } }); assert.equal(r.success, true); assert.equal(r.data.factAuthors, undefined); });
  // 2. recordFactAuthors over whole states, including a correction draft that copies facts.
  const member = (userId, role, teamIds = ['default']) => ({ userId, displayName: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now });
  const person = { id: 'p1', name: 'Synthetic Person', age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: '', due: '', status: 'completed', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'default', assignedTo: 'asha-1' };
  const visit = (id, facts, extra = {}) => ({ id, personId: 'p1', version: 3, state: 'confirmed', facts, createdAt: now, aiResults: [], recordVersion: 2, ...extra });
  const state = (visits, role = 'clinician') => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care', createdAt: now }], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role, people: [structuredClone(person)], visits, integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  const before = state([visit('v1', f1, { factAuthors: a1 })]);
  const after = structuredClone(before); after.workspace.visits.push(visit('v2', structuredClone(f1), { state: 'draft', amendsVisitId: 'v1', version: 1, recordVersion: 1 })); after.workspace.visits[0].supersededBy = 'v2';
  F.recordFactAuthors(before, after, { userId: 'clin-1', displayName: 'Synthetic clinician', email: 'c@example.invalid' }, member('clin-1', 'clinician'), now);
  check(() => { assert.deepEqual(after.workspace.visits[1].factAuthors, a1, 'copied facts keep their authors'); assert.deepEqual(after.workspace.visits[0].factAuthors, a1); });
  const edited = structuredClone(after); edited.workspace.visits[1].facts.weight = '62';
  F.recordFactAuthors(after, edited, { userId: 'clin-1', displayName: 'Synthetic clinician', email: 'c@example.invalid' }, member('clin-1', 'clinician'), now);
  check(() => { const au = edited.workspace.visits[1].factAuthors; assert.equal(au.weight.userId, 'clin-1'); assert.equal(au.weight.name, 'Synthetic clinician'); assert.equal(au.weight.role, 'clinician'); assert.equal(au.bloodPressure.userId, 'asha-1'); });
  // 3. The verify/dispute command.
  const actor = id => ({ userId: id, displayName: `Name ${id}`, email: `${id}@example.invalid` });
  const fresh = () => state([visit('v1', structuredClone(f1), { factAuthors: structuredClone(a1) })]);
  const cmd = over => ({ type: 'verifyFact', visitId: 'v1', recordVersion: 2, measure: 'weight', decision: 'verified', ...over });
  check(() => assert.equal(F.applyFactReview(fresh(), { type: 'saveVisit' }, actor('clin-1'), member('clin-1', 'clinician'), now), null));
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('asha-2'), member('asha-2', 'asha'), now), 403, /clinician with current care scope/);
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /clinician with current care scope/);
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('clin-2'), member('clin-2', 'clinician', ['north']), now), 403, /outside your care scope/);
  const unassigned = fresh(); unassigned.workspace.people[0].assigned = false;
  refuses(() => F.applyFactReview(unassigned, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 403, /not assigned/);
  const draft = fresh(); draft.workspace.visits[0].state = 'draft';
  refuses(() => F.applyFactReview(draft, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /confirmed visit/);
  const voided = fresh(); voided.workspace.visits[0].voidedAt = now;
  refuses(() => F.applyFactReview(voided, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /wrong-patient/);
  refuses(() => F.applyFactReview(fresh(), cmd({ recordVersion: 1 }), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /changed/);
  refuses(() => F.applyFactReview(fresh(), cmd({ measure: 'weeks' }), actor('clin-1'), member('clin-1', 'clinician'), now), 422, /Gestational age was not recorded/);
  refuses(() => F.applyFactReview(fresh(), cmd({ decision: 'disputed', reason: 'short' }), actor('clin-1'), member('clin-1', 'clinician'), now), 422, /at least 10 characters/);
  const own = fresh(); own.workspace.visits[0].factAuthors.weight = { ...clin };
  refuses(() => F.applyFactReview(own, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 403, /different clinician/);
  check(() => assert.equal(F.factReviewSchema.safeParse(cmd({ measure: 'pulse' })).success, false));
  check(() => assert.equal(F.factReviewSchema.safeParse(cmd({ extra: 1 })).success, false));
  const s = fresh(), done = F.applyFactReview(s, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => { const v = s.workspace.visits[0]; assert.equal(done.state, 'verified'); assert.equal(v.factReviews.length, 1); assert.equal(v.factReviews[0].by, 'clin-1'); assert.equal(v.factReviews[0].byName, 'Name clin-1'); assert.equal(v.version, 3, 'visit version unchanged'); assert.deepEqual(v.facts, f1, 'facts unchanged'); });
  check(() => { const a = s.workspace.audit.at(-1); assert.equal(a.action, 'verifyFact'); assert.equal(a.personId, 'p1'); assert.equal(a.subject, 'v1'); assert.match(a.detail, /Weight verified/); });
  refuses(() => F.applyFactReview(s, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /already verified/);
  F.applyFactReview(s, cmd({ decision: 'disputed', reason: 'Scale was not zeroed before weighing.' }), actor('clin-3'), member('clin-3', 'clinician'), '2026-09-30T08:00:00.000Z');
  check(() => { const v = s.workspace.visits[0]; assert.deepEqual(v.factReviews.map(r => r.state), ['verified', 'disputed'], 'appended, never rewritten'); assert.equal(P.factReview(v, 'weight').state, 'disputed'); assert.equal(P.factReview(v, 'temperature'), null); assert.match(P.reviewText(P.factReview(v, 'weight')), /^disputed by Name clin-3 \(clinician\), 2026-09-30 08:00 UTC: Scale was not zeroed/); });
  F.applyFactReview(s, cmd({ measure: 'temperature' }), actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => assert.equal(P.factReview(s.workspace.visits[0], 'temperature').state, 'verified', 'a recorded missing reason can be verified'));
  // 4. FHIR: the recorder is the performer; notes carry recorder and verification; the pinned validator passes.
  const v = s.workspace.visits[0];
  const doc = D.fhirDocument(person, v, 'Synthetic organisation', 'Synthetic confirmer');
  const stamp = V.validateOutbound(doc, person.id);
  check(() => { assert.equal(stamp.ruleset, 'saha-fhir-r4-document-structure'); assert.equal(stamp.version, '1.0.0'); });
  const res = doc.entry.map(e => e.resource), byUrl = new Map(doc.entry.map(e => [e.fullUrl, e.resource]));
  const weight = res.find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '29463-7');
  check(() => { const perf = byUrl.get(weight.performer[0].reference); assert.equal(perf.resourceType, 'Practitioner'); assert.equal(perf.name[0].text, 'Synthetic ASHA'); });
  check(() => { assert.match(weight.note[0].text, /Recorded by: Synthetic ASHA \(ASHA worker\), saved 2026-09-30 06:00 UTC\./); assert.match(weight.note[0].text, /Verification: disputed by Name clin-3/); });
  check(() => { const sys = res.find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '8480-6'); assert.match(sys.note[0].text, /Verification: unverified\./); assert.equal(res.filter(r => r.resourceType === 'Practitioner').length, 2, 'author plus one recorder'); });
  const partial = structuredClone(v); delete partial.factAuthors.weight;
  const doc2 = D.fhirDocument(person, partial, 'Synthetic organisation', 'Synthetic confirmer'); V.validateOutbound(doc2, person.id);
  check(() => { const w2 = doc2.entry.map(e => e.resource).find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '29463-7'); assert.match(w2.note[0].text, /Recorded by: not recorded\./); assert.equal(doc2.entry.find(e => e.fullUrl === w2.performer[0].reference).resource.name[0].text, 'Synthetic confirmer'); });
  const older = visit('v9', { ...base, weight: '50' });
  const doc3 = D.fhirDocument(person, older, 'Synthetic organisation', 'Synthetic confirmer'); V.validateOutbound(doc3, person.id);
  check(() => { const w3 = doc3.entry.map(e => e.resource).find(r => r.resourceType === 'Observation'); assert.equal(w3.note[0].text, 'Recorded source: measured (visit-level). Synthetic record.', 'older visits unchanged'); });
  const example = X.fhirExample(person, v);
  check(() => { const w4 = example.entry.map(e => e.resource).find(r => r.id === 'v1-weight'); assert.match(w4.note[0].text, /Recorded by: Synthetic ASHA/); assert.match(w4.note[0].text, /Verification: disputed/); });
  check(() => { const w5 = X.fhirExample(person, older).entry.map(e => e.resource).find(r => r.id === 'v9-weight'); assert.equal(w5.note[0].text.includes('Recorded by'), false); });
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/fact-verification-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Per-measurement author and verification: stamping from the server identity (changed measurements credited, unchanged kept, cleared dropped, older facts never guessed, correction drafts keep copied authors), strict facts refusing client authors, the verify/dispute command (role, scope, assignment, state, void, version, measurement, reason and self refusals; append-only reviews, latest wins; audit; facts and visit version unchanged), FHIR document performer and notes under the pinned validator, older visits unchanged, and the FHIR example notes.' }, null, 2) + '\n');
console.log(`${passed} fact verification contract checks passed`);
