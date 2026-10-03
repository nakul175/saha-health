// Slice 2i contract: units and unusual values (BR-DATA-05): the placeholder ranges configuration, unit conversion with
// the original kept, range refusals and reasons in the shared facts check, override recording with who/when/why and
// audit, the clinician confirmation command (role, scope, state, version, current override, tier and self rules),
// confirmVisit blocked until confirmed, correction drafts keeping history, both FHIR exports under the pinned validator,
// and the field notebook's mirrored ranges.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.value-override-contract-'));
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
  const now = '2026-10-01T06:00:00.000Z', visitAt = '2026-10-01T04:00', at = Date.parse(now);
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  // 1. The configuration is versioned and labelled as an engineering placeholder; each expected range sits inside its confirmation range.
  check(() => { assert.equal(P.VALUE_RANGES.version, 'saha-value-ranges-0.1.0'); assert.equal(P.VALUE_RANGES.status, 'engineering placeholder — not clinically approved'); assert.deepEqual(Object.keys(P.VALUE_RANGES.fields), ['systolic', 'diastolic', 'weight', 'temperature', 'weeks', 'coughDays']); });
  check(() => { for (const r of Object.values(P.VALUE_RANGES.fields)) assert.ok(r.confirm[0] <= r.expected[0] && r.expected[1] <= r.confirm[1], r.label); });
  check(() => { assert.equal(P.valueTier('weight', '60'), 'expected'); assert.equal(P.valueTier('weight', '180'), 'reason'); assert.equal(P.valueTier('weight', '400'), 'clinician'); assert.equal(P.valueTier('weight', ''), 'expected'); assert.equal(P.valueTier('systolic', '45'), 'clinician'); });
  // 2. Conversions: stated units only, the original kept, nothing guessed.
  check(() => { assert.equal(P.convertEntered('weight', { value: '154', unit: 'lb' }), '69.85'); assert.equal(P.convertEntered('temperature', { value: '98.6', unit: 'degF' }), '37'); assert.equal(P.convertEntered('coughDays', { value: '2', unit: 'wk' }), '14'); });
  check(() => { assert.equal(P.convertEntered('weight', { value: '154', unit: 'kg' }), null); assert.equal(P.convertEntered('weight', { value: '-3', unit: 'lb' }), null); assert.equal(P.convertEntered('temperature', { value: '20', unit: 'degF' }), null, 'below absolute zero in °C is not a value'); });
  const entered = C.checkFacts({ ...base, entered: { weight: { value: '154', unit: 'lb' }, temperature: { value: '98.6', unit: 'degF' }, coughDays: { value: '2', unit: 'wk' } }, provenance: { weight: { source: 'reported' } } }, at);
  check(() => { assert.equal(entered.weight, '69.85'); assert.equal(entered.temperature, '37'); assert.equal(entered.coughDays, '14'); assert.deepEqual(entered.entered.weight, { value: '154', unit: 'lb' }); assert.deepEqual(entered.provenance, { weight: { source: 'reported' } }, 'a converted value counts as recorded'); });
  check(() => assert.equal(C.checkFacts({ ...base, weight: '69.85', entered: { weight: { value: '154', unit: 'lb' } } }, at).weight, '69.85', 'a matching base value is accepted'));
  refuses(() => C.checkFacts({ ...base, weight: '70', entered: { weight: { value: '154', unit: 'lb' } } }, at), 422, /does not match the entered 154 lb/);
  refuses(() => C.checkFacts({ ...base, entered: { weight: { value: 'heavy', unit: 'lb' } } }, at), 422, /enter a positive number in lb/);
  check(() => { assert.equal(C.factsSchema.safeParse({ ...base, entered: { weight: { value: '154', unit: 'kg' } } }).success, false); assert.equal(C.factsSchema.safeParse({ ...base, entered: { systolic: { value: '16', unit: 'psi' } } }).success, false, 'an unknown unit for blood pressure is refused (kPa is accepted since slice r24)'); assert.equal(C.factsSchema.safeParse({ ...base, unusual: { pulse: 'Synthetic reason text' } }).success, false); });
  const legacy = { ...base, weight: '60', systolic: '120', diastolic: '80' };
  check(() => assert.deepEqual(C.checkFacts(structuredClone(legacy), at), legacy, 'facts without units or reasons are stored as sent'));
  // 3. Range refusals and reasons.
  refuses(() => C.checkFacts({ ...base, weight: '180' }, at), 422, /Weight 180 kg is outside the expected range 2–150 kg \(engineering placeholder — not clinically approved\)/);
  refuses(() => C.checkFacts({ ...base, weight: '180', unusual: { weight: 'short' } }, at), 422, /at least 10 characters/);
  refuses(() => C.checkFacts({ ...base, weight: '60', unusual: { weight: 'Reason for a usual value' } }, at), 422, /a reason applies only to a value outside/);
  refuses(() => C.checkFacts({ ...base, unusual: { weight: 'Reason without any value' } }, at), 422, /a reason applies only/);
  refuses(() => C.checkFacts({ ...base, entered: { temperature: { value: '108', unit: 'degF' } } }, at), 422, /Temperature 42.2 °C is outside/);
  check(() => assert.equal(C.checkFacts({ ...base, weight: '180', unusual: { weight: 'Synthetic heavy adult, weighed twice.' } }, at).unusual.weight, 'Synthetic heavy adult, weighed twice.'));
  check(() => assert.equal(P.rangeProblem({ ...base, systolic: '210', diastolic: '90' }).startsWith('Systolic blood pressure 210 mmHg'), true));
  check(() => { const t = P.tidyValues({ ...base, weight: '60', entered: { temperature: { value: '100.4', unit: 'degF' }, weight: { value: ' ', unit: 'lb' } }, unusual: { weight: 'Not needed here', systolic: '' } }); assert.equal(t.temperature, '38'); assert.deepEqual(Object.keys(t.entered), ['temperature']); assert.equal(t.unusual, undefined); });
  // 4. Override recording after a command: who/when/why, audit, append-only history.
  const member = (userId, role, teamIds = ['default']) => ({ userId, displayName: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now });
  const actor = id => ({ userId: id, displayName: 'Name ' + id, email: id + '@example.invalid' });
  const person = { id: 'p1', name: 'Synthetic Person', age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: '', due: '', status: 'in_progress', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'default', assignedTo: 'asha-1' };
  const visit = (id, facts, extra = {}) => ({ id, personId: 'p1', version: 2, state: 'draft', facts, createdAt: now, aiResults: [], recordVersion: 2, ...extra });
  const state = (visits, role = 'clinician') => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care', createdAt: now }], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role, people: [structuredClone(person)], visits, integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  const unusual = C.checkFacts({ ...base, entered: { weight: { value: '882', unit: 'lb' } }, systolic: '210', diastolic: '90', unusual: { weight: 'Synthetic scale reading repeated twice.', systolic: 'Repeated after rest; same synthetic reading.' } }, at);
  const s0 = state([visit('v1', structuredClone(base))]), s1 = structuredClone(s0); s1.workspace.visits[0].facts = unusual; s1.workspace.visits[0].version = 3;
  F.recordFactAuthors(s0, s1, actor('asha-1'), member('asha-1', 'asha'), now);
  const ov = () => s1.workspace.visits[0].valueOverrides;
  check(() => { assert.equal(ov().length, 2); const w = ov().find(o => o.field === 'weight'); assert.equal(w.value, '400.07'); assert.equal(w.unit, 'kg'); assert.deepEqual(w.entered, { value: '882', unit: 'lb' }); assert.equal(w.tier, 'clinician'); assert.equal(w.by.userId, 'asha-1'); assert.equal(w.by.role, 'asha'); assert.equal(w.at, now); assert.equal(w.rangesVersion, 'saha-value-ranges-0.1.0'); assert.deepEqual(w.expected, [2, 150]); });
  check(() => { assert.equal(ov().find(o => o.field === 'systolic').tier, 'reason'); const a = s1.workspace.audit.at(-1); assert.equal(a.action, 'recordUnusualValue'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /Weight 400.07 kg \(entered as 882 lb\) outside 2–150 kg, beyond 0.5–300 kg so a clinician must confirm it; reason: Synthetic scale/); });
  const s2 = structuredClone(s1); s2.workspace.visits[0].facts.notes = 'Edited notes only.'; F.recordFactAuthors(s1, s2, actor('asha-1'), member('asha-1', 'asha'), now);
  check(() => { assert.equal(s2.workspace.visits[0].valueOverrides.length, 2, 'unchanged values append nothing'); assert.equal(s2.workspace.audit.length, 1); });
  const s3 = structuredClone(s2); s3.workspace.visits[0].facts.unusual.systolic = 'Third reading after ten minutes rest.'; F.recordFactAuthors(s2, s3, actor('asha-1'), member('asha-1', 'asha'), '2026-10-01T06:05:00.000Z');
  check(() => { const o = s3.workspace.visits[0].valueOverrides; assert.equal(o.length, 3, 'a changed reason is appended'); assert.equal(P.currentOverride(s3.workspace.visits[0], 'systolic').reason, 'Third reading after ten minutes rest.'); assert.equal(o[0].reason, 'Repeated after rest; same synthetic reading.', 'earlier kept'); });
  // 5. confirmVisit is blocked until a clinician confirms the value beyond the confirmation range.
  check(() => assert.deepEqual(P.unconfirmedValues(s3.workspace.visits[0]).map(x => [x.field, x.need]), [['weight', 'clinician']]));
  const confirmCmd = s => ({ type: 'confirmVisit', visitId: 'v1', version: s.workspace.visits[0].version, patientCheck: { personId: 'p1', personVersion: 1, confirmed: true } });
  { const w = structuredClone(s3.workspace); w.role = 'asha'; await assert.rejects(() => C.apply(w, confirmCmd(s3), 'asha-1', { call: async () => null }, now), e => e.status === 409 && /Weight: a clinician who did not record this unusual value must confirm it/.test(e.message)); passed++; }
  { const w = structuredClone(s3.workspace); w.role = 'asha'; w.visits[0].facts.unusual = {}; await assert.rejects(() => C.apply(w, confirmCmd(s3), 'asha-1', { call: async () => null }, now), e => e.status === 409 && /save the unusual value with a reason/.test(e.message)); passed++; }
  // 6. The clinician confirmation command.
  const fresh = () => structuredClone(s3), wo = ov().find(o => o.field === 'weight'), so = P.currentOverride(s3.workspace.visits[0], 'systolic');
  const cmd = (x = {}) => ({ type: 'confirmUnusualValue', visitId: 'v1', version: 3, field: 'weight', overrideId: wo.id, ...x });
  check(() => assert.equal(F.applyFactReview(fresh(), { type: 'saveVisit' }, actor('clin-1'), member('clin-1', 'clinician'), now), null));
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('asha-2'), member('asha-2', 'asha'), now), 403, /clinician with current care scope is required to confirm an unusual value/);
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /clinician with current care scope/);
  refuses(() => F.applyFactReview(fresh(), cmd(), actor('clin-2'), member('clin-2', 'clinician', ['north']), now), 403, /outside your care scope/);
  { const c = fresh(); c.workspace.visits[0].state = 'confirmed'; refuses(() => F.applyFactReview(c, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /on the draft, before the visit is confirmed/); }
  { const c = fresh(); c.workspace.visits[0].supersededBy = 'v9'; refuses(() => F.applyFactReview(c, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /wrong-patient/); }
  refuses(() => F.applyFactReview(fresh(), cmd({ version: 2 }), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /changed/);
  refuses(() => F.applyFactReview(fresh(), cmd({ overrideId: 'stale' }), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /no longer the current one/);
  refuses(() => F.applyFactReview(fresh(), cmd({ field: 'systolic', overrideId: so.id }), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /needs only the recorder's reason/);
  { const c = fresh(); c.workspace.visits[0].valueOverrides.forEach(o => { o.by = { ...o.by, userId: 'clin-1' }; }); refuses(() => F.applyFactReview(c, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 403, /different clinician must confirm an unusual value you recorded/); }
  check(() => assert.equal(F.factReviewSchema.safeParse(cmd({ extra: 1 })).success, false));
  const done = fresh(), r = F.applyFactReview(done, cmd({ note: 'Discussed with the synthetic ASHA.' }), actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => { const v = done.workspace.visits[0]; assert.equal(r.overrideId, wo.id); assert.equal(v.overrideConfirmations.length, 1); assert.equal(v.overrideConfirmations[0].by, 'clin-1'); assert.equal(v.overrideConfirmations[0].note, 'Discussed with the synthetic ASHA.'); assert.equal(v.version, 3, 'visit version unchanged'); assert.deepEqual(v.facts, s3.workspace.visits[0].facts, 'facts unchanged'); });
  check(() => { const a = done.workspace.audit.at(-1); assert.equal(a.action, 'confirmUnusualValue'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /Weight 400.07 kg \(outside 0.5–300 kg\) confirmed by a clinician who did not record it; facts unchanged/); });
  refuses(() => F.applyFactReview(done, cmd(), actor('clin-3'), member('clin-3', 'clinician'), now), 409, /already confirmed/);
  check(() => assert.deepEqual(P.unconfirmedValues(done.workspace.visits[0]), []));
  { const w = structuredClone(done.workspace); w.role = 'asha'; await C.apply(w, confirmCmd(done), 'asha-1', { call: async () => null }, now); check(() => assert.equal(w.visits[0].state, 'confirmed')); }
  // A changed value needs its own override and confirmation; the earlier confirmation stays in history.
  { const c = structuredClone(done), c2 = structuredClone(c); c2.workspace.visits[0].facts = C.checkFacts({ ...c.workspace.visits[0].facts, weight: '', entered: { weight: { value: '880', unit: 'lb' } } }, at); F.recordFactAuthors(c, c2, actor('asha-1'), member('asha-1', 'asha'), now);
    check(() => { const v = c2.workspace.visits[0]; assert.equal(v.facts.weight, '399.16'); assert.equal(v.valueOverrides.length, 4); assert.equal(v.overrideConfirmations.length, 1); assert.deepEqual(P.unconfirmedValues(v).map(x => x.need), ['clinician']); }); }
  // 7. Correction drafts start from the corrected visit's history: unchanged values keep their override and confirmation.
  const conf = structuredClone(done); conf.workspace.visits[0].state = 'confirmed';
  const amended = structuredClone(conf); amended.workspace.visits.push(visit('v2', structuredClone(conf.workspace.visits[0].facts), { version: 1, recordVersion: 1, amendsVisitId: 'v1' })); amended.workspace.visits[0].supersededBy = 'v2';
  F.recordFactAuthors(conf, amended, actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => { const v2 = amended.workspace.visits[1]; assert.equal(v2.valueOverrides.length, 3); assert.equal(v2.overrideConfirmations.length, 1); assert.deepEqual(P.unconfirmedValues(v2), []); assert.equal(v2.valueOverrides[0].visitId, 'v1', 'history names the visit it was recorded on'); });
  // 8. FHIR: notes carry the entered unit and the override; the pinned rule set still passes; visits without either are unchanged.
  const doc = D.fhirDocument(person, conf.workspace.visits[0], 'Synthetic organisation', 'Synthetic confirmer');
  const stamp = V.validateOutbound(doc, person.id);
  check(() => { assert.equal(stamp.ruleset, 'saha-fhir-r4-document-structure'); assert.equal(stamp.version, '1.1.0'); });
  const res = doc.entry.map(e => e.resource), wt = res.find(x => x.resourceType === 'Observation' && x.code.coding[0].code === '29463-7');
  check(() => { assert.equal(wt.valueQuantity.value, 400.07); assert.equal(wt.valueQuantity.code, 'kg'); assert.match(wt.note[0].text, /Entered as 882 lb; converted by Saha\. Unusual value \(saha-value-ranges-0\.1\.0, engineering placeholder — not clinically approved\): outside 2–150 kg; reason: Synthetic scale reading repeated twice\. Confirmed by Name clin-1 \(clinician\), 2026-10-01 06:00 UTC\./); });
  check(() => { const sys = res.find(x => x.resourceType === 'Observation' && x.code.coding[0].code === '8480-6'); assert.match(sys.note[0].text, /Unusual value .*outside 70–200 mmHg; reason: Third reading/); assert.doesNotMatch(sys.note[0].text, /Confirmed by|pending/); });
  const plain = D.fhirDocument(person, visit('v8', { ...base, weight: '50' }, { state: 'confirmed' }), 'Synthetic organisation', 'Synthetic confirmer'); V.validateOutbound(plain, person.id);
  check(() => assert.equal(plain.entry.map(e => e.resource).find(x => x.resourceType === 'Observation').note[0].text, 'Recorded source: measured (visit-level). Synthetic record.', 'unchanged without units or overrides'));
  const ex = X.fhirExample(person, conf.workspace.visits[0]).entry.map(e => e.resource);
  check(() => { assert.match(ex.find(x => x.id === 'v1-weight').note[0].text, /Entered as 882 lb; converted by Saha\./); assert.match(ex.find(x => x.id === 'v1-bp').note[0].text, /Unusual value .*outside 70–200 mmHg/); });
  check(() => assert.match(P.unusualNoteText(s3.workspace.visits[0], 'weight'), /Clinician confirmation pending\./));
  // History and conflict views render the new facts entries as text (never as objects).
  check(() => { assert.equal(P.factEntryText('entered', { weight: { value: '154', unit: 'lb' }, temperature: { value: '98.6', unit: 'degF' } }), 'Weight: 154 lb; Temperature: 98.6 °F'); assert.equal(P.factEntryText('unusual', { systolic: 'Repeated after rest.' }), 'Systolic blood pressure: Repeated after rest.'); assert.equal(P.factEntryText('weight', '60'), '60'); assert.match(P.factEntryText('provenance', { weight: { source: 'reported' } }), /^Weight: Reported/); });
  // 9. The field notebook mirrors the configuration exactly.
  const app = readFileSync('public/field/app.js', 'utf8'), mirror = JSON.parse(app.match(/const VALUE_RANGES=(\{.*?\}\}\});/)[1]);
  check(() => assert.deepEqual(mirror, JSON.parse(JSON.stringify(P.VALUE_RANGES))));
  check(() => { for (const [k, u] of Object.entries(P.ALT_UNITS)) assert.ok(app.includes(`${k}:{unit:'${u.unit}'`) && app.includes(`decimals:${u.decimals}`), k); });
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/value-override-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Units and unusual values: placeholder ranges configuration (version, label, nesting, tiers); stated-unit conversion with the original kept and mismatches, bad values and unsupported units refused; facts without units unchanged; range refusals, short and misplaced reasons; tidying; override recording with who/when/why, ranges version and audit, nothing appended for unchanged values, changed reasons appended; confirmVisit blocked until confirmed and without a reason; the clinician confirmation command (role, scope, state, supersession, version, current override, tier, self and repeat refusals; appended with audit; facts and visit version unchanged); a changed value needing a new confirmation; correction drafts keeping history; FHIR document and example notes under the pinned validator and unchanged output without units or overrides; the notebook mirror of the ranges.' }, null, 2));
console.log(`${passed} value override contract checks passed`);
