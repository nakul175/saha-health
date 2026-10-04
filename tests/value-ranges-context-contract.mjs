// Slice r24 contract (BR-DATA-05): further alternative units (blood pressure kPa, gestational age weeks + days) and the
// age/sex/pregnancy-specific placeholder value-range mechanism. Units are converted by `checkFacts` with the entered
// value kept (the same contract as slice 2i); ranges can be keyed by an optional age/sex/pregnancy context, and when no
// context is supplied or no population group matches, the slice 2i `saha-value-ranges-0.1.0` behaviour applies unchanged.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.value-ranges-context-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refuses = (fn, status, pattern) => { assert.throws(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const C = await import(pathToFileURL(join(dir, 'core.js')));
  const now = '2026-10-01T06:00:00.000Z', visitAt = '2026-10-01T04:00', at = Date.parse(now);
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  // 1. Further units: kilopascals (blood pressure) and weeks + days (gestational age) convert, keeping the entered value.
  check(() => { assert.equal(P.convertEntered('systolic', { value: '16', unit: 'kPa' }), '120'); assert.equal(P.convertEntered('diastolic', { value: '10', unit: 'kPa' }), '75'); });
  check(() => { assert.equal(P.convertWeeksDays('20+3'), '20.43'); assert.equal(P.convertWeeksDays('40+0'), '40'); assert.equal(P.convertWeeksDays('20+7'), null); assert.equal(P.convertWeeksDays('abc'), null); });
  check(() => { assert.equal(P.convertEntered('weeks', { value: '20+3', unit: 'wk+d' }), '20.43'); assert.equal(P.convertEntered('weeks', { value: '20+3', unit: 'wk' }), null); assert.equal(P.convertEntered('systolic', { value: '16', unit: 'mmHg' }), null); assert.equal(P.convertEntered('systolic', { value: '16', unit: 'psi' }), null); });
  const kpa = C.checkFacts({ ...base, entered: { systolic: { value: '16', unit: 'kPa' }, diastolic: { value: '10', unit: 'kPa' } } }, at);
  check(() => { assert.equal(kpa.systolic, '120'); assert.equal(kpa.diastolic, '75'); assert.deepEqual(kpa.entered.systolic, { value: '16', unit: 'kPa' }); assert.deepEqual(kpa.entered.diastolic, { value: '10', unit: 'kPa' }); });
  const wd = C.checkFacts({ ...base, entered: { weeks: { value: '20+3', unit: 'wk+d' } } }, at);
  check(() => { assert.equal(wd.weeks, '20.43'); assert.deepEqual(wd.entered.weeks, { value: '20+3', unit: 'wk+d' }); });
  check(() => assert.equal(C.factsSchema.safeParse({ ...base, entered: { systolic: { value: '16', unit: 'kPa' }, diastolic: { value: '10', unit: 'kPa' } } }).success, true));
  check(() => assert.equal(C.factsSchema.safeParse({ ...base, entered: { weeks: { value: '20+3', unit: 'wk+d' } } }).success, true));
  check(() => { assert.equal(C.factsSchema.safeParse({ ...base, entered: { systolic: { value: '16', unit: 'psi' } } }).success, false); assert.equal(C.factsSchema.safeParse({ ...base, entered: { weeks: { value: '20+3', unit: 'months' } } }).success, false); });
  refuses(() => C.checkFacts({ ...base, systolic: '119', entered: { systolic: { value: '16', unit: 'kPa' }, diastolic: { value: '10', unit: 'kPa' } } }, at), 422, /does not match the entered 16 kPa/);
  refuses(() => C.checkFacts({ ...base, entered: { weeks: { value: '20+9', unit: 'wk+d' } } }, at), 422, /enter a positive number in weeks \+ days/);
  check(() => { assert.equal(P.enteredText({ value: '16', unit: 'kPa' }), '16 kPa'); assert.equal(P.enteredText({ value: '20+3', unit: 'wk+d' }), '20+3 weeks + days'); assert.equal(P.enteredText({ value: '154', unit: 'lb' }), '154 lb'); });
  check(() => { const t = P.tidyValues({ ...base, entered: { systolic: { value: '16', unit: 'kPa' }, diastolic: { value: '10', unit: 'kPa' } } }); assert.equal(t.systolic, '120'); assert.equal(t.diastolic, '75'); assert.deepEqual(t.entered.systolic, { value: '16', unit: 'kPa' }); });
  // 2. Population-specific ranges: versioned, labelled, keyed by age/sex/pregnancy, defaulting to the slice 2i ranges.
  check(() => { assert.equal(P.POPULATION_RANGES.version, 'saha-value-ranges-0.2.0'); assert.equal(P.POPULATION_RANGES.status, 'engineering placeholder — not clinically approved'); assert.equal(P.POPULATION_RANGES.groups.length, 2); });
  check(() => { assert.equal(P.valueTier('weight', '180'), 'reason'); assert.equal(P.valueTier('systolic', '150'), 'expected'); });
  check(() => { assert.equal(P.valueTier('systolic', '120', { age: 5 }), 'expected'); assert.equal(P.valueTier('systolic', '125', { age: 5 }), 'reason'); assert.equal(P.valueTier('weight', '80', { age: 5 }), 'reason'); assert.equal(P.valueTier('weight', '180', { age: 5 }), 'clinician'); });
  check(() => { assert.equal(P.valueTier('systolic', '150', { pregnant: true }), 'reason'); assert.equal(P.valueTier('diastolic', '92', { pregnant: true }), 'reason'); assert.equal(P.valueTier('weight', '180', { age: 30, sex: 'Female', pregnant: false }), 'reason'); });
  check(() => { const child = P.rangeSelection({ age: 5 }); assert.equal(child.version, 'saha-value-ranges-0.2.0'); assert.deepEqual(child.fields.systolic.expected, [90, 120]); assert.deepEqual(child.fields.weight.confirm, [0.5, 100]); assert.deepEqual(child.fields.temperature.expected, [34, 41]); assert.deepEqual(child.fields.coughDays.confirm, [0, 730]); });
  check(() => { const adult = P.rangeSelection({ age: 30, sex: 'Female', pregnant: false }); assert.equal(adult.version, 'saha-value-ranges-0.1.0'); assert.deepEqual(adult.fields.weight.expected, [2, 150]); assert.deepEqual(adult.fields.systolic.expected, [70, 200]); });
  check(() => assert.equal(P.rangeProblem({ ...base, systolic: '150', diastolic: '90' }), null, 'default ranges accept 150 mmHg'));
  check(() => assert.match(P.rangeProblem({ ...base, systolic: '150', diastolic: '90' }, { pregnant: true }), /Systolic blood pressure 150 mmHg is outside the expected range 90–140 mmHg \(engineering placeholder/));
  check(() => { assert.deepEqual(P.rangeContextFor({ age: 30, sex: 'Female', programmes: ['General care'] }), { age: 30, sex: 'Female', pregnant: false }); assert.deepEqual(P.rangeContextFor({ age: 28, sex: 'Female', programmes: ['Maternal care'] }), { age: 28, sex: 'Female', pregnant: true }); assert.deepEqual(P.rangeContextFor({ age: 30, sex: 'Female', programmes: ['General care'], enrolments: [{ packId: 'maternal', state: 'active' }] }), { age: 30, sex: 'Female', pregnant: true }); assert.deepEqual(P.rangeContextFor({ age: 30, sex: 'Female', programmes: ['General care'], enrolments: [{ packId: 'maternal', state: 'closed' }] }), { age: 30, sex: 'Female', pregnant: false }); assert.equal(P.rangeContextFor(undefined), undefined); });
  // checkFacts honours the context: a value in the default range but outside the pregnancy range needs a reason.
  check(() => C.checkFacts({ ...base, systolic: '150', diastolic: '90' }, at));
  refuses(() => C.checkFacts({ ...base, systolic: '150', diastolic: '90' }, at, { pregnant: true }), 422, /Systolic blood pressure 150 mmHg is outside the expected range 90–140 mmHg/);
  check(() => C.checkFacts({ ...base, systolic: '150', diastolic: '90', unusual: { systolic: 'Synthetic raised blood pressure, rechecked.' } }, at, { pregnant: true }));
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/value-ranges-context-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Further units and population-specific ranges: kilopascals for blood pressure and weeks + days for gestational age converted by checkFacts with the entered value kept (schema, mismatch and bad-value refusals, entered text and tidying); the age/sex/pregnancy placeholder range mechanism (version, label, paediatric and pregnancy groups, fallback to saha-value-ranges-0.1.0 when no context or no match), context-aware valueTier, rangeSelection and rangeProblem, the rangeContextFor helper, and checkFacts honouring a pregnancy context.' }, null, 2) + '\n');
console.log(`${passed} value ranges context contract checks passed`);
