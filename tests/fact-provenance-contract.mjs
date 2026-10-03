// Slice 2c contract: source and observation time for each measurement (BR-DATA-02), the shared fact checks,
// the fallback for older visits, the demo summary, and both FHIR exports under the pinned outbound validator.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.fact-provenance-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refuses = (fn, pattern) => { assert.throws(fn, e => e.status === 422 && pattern.test(e.message)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const C = await import(pathToFileURL(join(dir, 'core.js')));
  const D = await import(pathToFileURL(join(dir, 'fhir-document.js')));
  const V = await import(pathToFileURL(join(dir, 'fhir-validate.js')));
  const X = await import(pathToFileURL(join(dir, 'fhir.js')));
  const hour = 3600000, minute = t => new Date(t).toISOString().slice(0, 16);
  const visitAt = minute(Date.now() - 2 * hour), earlier = minute(Date.now() - 26 * hour), future = minute(Date.now() + hour);
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  const facts = over => ({ ...base, ...over });
  // Schema: old facts stay valid; per-measurement entries are optional, strict and bounded.
  check(() => assert.equal(C.factsSchema.safeParse(base).success, true, 'facts without provenance remain valid'));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ weight: '61', provenance: { weight: { source: 'reported', at: earlier } } })).success, true));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ provenance: { weight: { source: 'declined' }, temperature: { source: 'not-asked' }, weeks: { source: 'unknown' }, coughDays: { source: 'not-applicable' } } })).success, true, 'four distinct missing reasons'));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ provenance: { pulse: { source: 'measured' } } })).success, false, 'unknown measurement refused'));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ provenance: { weight: { source: 'guessed' } } })).success, false, 'unknown source refused'));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ provenance: { weight: { source: 'measured', at: '2026-09-30' } } })).success, false, 'time needs minutes'));
  check(() => assert.equal(C.factsSchema.safeParse(facts({ provenance: { weight: { source: 'measured', extra: 1 } } })).success, false, 'entries are strict'));
  check(() => assert.deepEqual([...P.FACT_SOURCES], ['measured', 'reported', 'not-asked', 'declined', 'unknown', 'not-applicable']));
  // Shared checks: a value is measured or reported; a missing reason applies to a blank value; no future times.
  check(() => C.checkFacts(facts({ weight: '61', provenance: { weight: { source: 'reported', at: earlier }, temperature: { source: 'declined' } } })));
  refuses(() => C.checkFacts(facts({ weight: '61', provenance: { weight: { source: 'declined' } } })), /Weight: a recorded value must be measured or reported/);
  refuses(() => C.checkFacts(facts({ provenance: { temperature: { source: 'measured' } } })), /Temperature: enter the value, or choose why it is missing/);
  refuses(() => C.checkFacts(facts({ provenance: { weeks: { source: 'unknown', at: earlier } } })), /Gestational age: a time applies only to a recorded value/);
  refuses(() => C.checkFacts(facts({ systolic: '120', diastolic: '80', provenance: { bloodPressure: { source: 'measured', at: future } } })), /Blood pressure: observation time cannot be in the future/);
  refuses(() => C.checkFacts(facts({ date: future })), /Observation time cannot be in the future/);
  refuses(() => C.checkFacts(facts({ systolic: '120' })), /both blood pressure readings/);
  // Fallback for visits saved before per-measurement entries existed.
  check(() => assert.deepEqual(P.factProvenance(facts({ weight: '61' }), 'weight'), { source: 'measured', at: visitAt, own: false }));
  check(() => assert.deepEqual(P.factProvenance(facts({ weight: '61', provenance: { weight: { source: 'reported' } } }), 'weight'), { source: 'reported', at: visitAt, own: true }, 'own source, visit time'));
  check(() => assert.equal(P.measureOf('systolic'), 'bloodPressure'));check(() => assert.equal(P.measureOf('notes'), null));
  // Tidying drops entries that carry no information and keeps contradictions for the server to refuse.
  check(() => assert.deepEqual(P.tidyProvenance(facts({ provenance: { weight: { source: 'measured', at: earlier }, temperature: { source: 'declined', at: earlier } } })).provenance, { temperature: { source: 'declined' } }));
  check(() => assert.equal('provenance' in P.tidyProvenance(facts({ provenance: { weight: { source: 'reported' } } })), false));
  check(() => assert.deepEqual(P.tidyProvenance(facts({ weight: '61', provenance: { weight: { source: 'declined' } } })).provenance, { weight: { source: 'declined' } }));
  check(() => assert.equal(P.provenanceText({ weight: { source: 'reported', at: earlier } }), `Weight: Reported by person / carer at ${earlier.replace('T', ' ')} UTC`));
  // Demo summary: per-measurement source and time, missing reasons stated, old visits unchanged.
  const mixed = facts({ systolic: '150', diastolic: '96', weight: '61', weeks: '20', provenance: { weight: { source: 'reported', at: earlier }, weeks: { source: 'reported' }, temperature: { source: 'declined' } } });
  const text = C.summary(mixed);
  check(() => assert.match(text, /Blood pressure: 150\/96 mmHg \(measured\)\./));
  check(() => assert.match(text, new RegExp(`Weight: 61 kg \\(reported, ${earlier.replace('T', ' ')} UTC\\)\\.`)));
  check(() => assert.match(text, /Gestational age reported: 20 weeks \(reported\)\./));
  check(() => assert.match(text, /Not recorded: temperature \(declined\)\./));
  check(() => assert.equal(C.summary(facts({ weight: '61' })), `Visit notes: Synthetic visit.\nWeight: 61 kg (measured).\nObservation time: ${visitAt.replace('T', ' ')}. No diagnosis or treatment recommendation generated.`, 'old visits keep the earlier text'));
  // FHIR document: each observation has its own time and source; reported values carry a method; the validator passes.
  const person = { id: 'p_synthetic', name: 'Synthetic Provenance Person', sex: 'Female' };
  const visit = f => ({ id: 'v-synthetic', personId: person.id, facts: f });
  const doc = D.fhirDocument(person, visit(mixed), 'Synthetic organisation', 'Synthetic worker');
  const obs = doc.entry.map(e => e.resource).filter(r => r.resourceType === 'Observation'), byCode = c => obs.find(o => o.code.coding[0].code === c);
  check(() => assert.equal(byCode('29463-7').effectiveDateTime, new Date(earlier + 'Z').toISOString(), 'weight at its own time'));
  check(() => assert.equal(byCode('29463-7').method.text, 'Reported by the person or carer; not measured during the visit'));
  check(() => assert.match(byCode('29463-7').note[0].text, /^Recorded source: reported\./));
  check(() => { const s = byCode('8480-6'); assert.equal(s.effectiveDateTime, new Date(visitAt + 'Z').toISOString()); assert.equal(s.method, undefined); assert.match(s.note[0].text, /measured \(visit-level\)/); });
  check(() => assert.equal(byCode('8310-5'), undefined, 'a declined temperature is not an observation'));
  const narrative = doc.entry[0].resource.section[0].text.div;
  check(() => assert.match(narrative, /Temperature: not recorded \(declined\)\./));check(() => assert.match(narrative, /Reported gestational age: 20 weeks \(reported, /));
  check(() => { const stamp = V.validateOutbound(doc, 'p-synthetic'); assert.equal(stamp.ruleset, 'saha-fhir-r4-document-structure'); });
  check(() => { const summary = D.inspectDocument(doc, 'p-synthetic'); assert.ok(summary.dates.includes(new Date(earlier + 'Z').toISOString()), 'the reader sees the earlier time'); assert.equal(summary.observations.find(o => o.code === '29463-7').date, new Date(earlier + 'Z').toISOString()); });
  const old = D.fhirDocument(person, visit(facts({ weight: '61', temperature: '37.1' })), 'Synthetic organisation', 'Synthetic worker');
  check(() => { const o = old.entry.map(e => e.resource).filter(r => r.resourceType === 'Observation'); assert.equal(o.length, 2); assert.ok(o.every(x => x.effectiveDateTime === new Date(visitAt + 'Z').toISOString() && !x.method)); V.validateOutbound(old, 'p-synthetic'); });
  // FHIR example download: the same per-observation time and method.
  const example = X.fhirExample(person, visit(mixed)), ex = example.entry.map(e => e.resource);
  check(() => { const w = ex.find(r => r.id === 'v-synthetic-weight'); assert.equal(w.effectiveDateTime, new Date(earlier + 'Z').toISOString()); assert.ok(w.method); assert.match(w.note[0].text, /^Source: reported\./); });
  check(() => { const bp = ex.find(r => r.id === 'v-synthetic-bp'); assert.equal(bp.effectiveDateTime, new Date(visitAt + 'Z').toISOString()); assert.match(bp.note[0].text, /visit-level/); });
  check(() => assert.equal(ex.some(r => r.id === 'v-synthetic-temperature'), false));
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/fact-provenance-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Per-measurement source and time: schema (optional, strict, six sources, minute times), shared fact checks (value must be measured or reported, missing reasons only for blank values, no time on a blank value, no future times), fallback to the visit-level source and time, tidying of entries without information, history text, demo summary with per-measurement sources and missing reasons and unchanged text for older visits, FHIR document per-observation effectiveDateTime, method for reported values and narrative missing reasons under the pinned outbound validator, reader dates, and the FHIR example download.' }, null, 2) + '\n');
console.log(`${passed} fact provenance contract checks passed`);
