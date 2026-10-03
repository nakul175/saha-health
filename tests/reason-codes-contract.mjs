// Slice r23 contract: one versioned reason-code vocabulary that unifies the missing, refused, uncertain and
// absence reasons recorded for visit measurements and programme answers (BR-RULE-01, BR-DATA-02), and maps
// the existing free-text reason fields onto coded methods for FHIR observations, MIS payloads and summaries.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.reason-codes-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['reason-codes', 'fact-provenance', 'adapter-operations', 'core', 'mis', 'programmes', 'types', 'fhir-document', 'fhir'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const R = await import(pathToFileURL(join(dir, 'reason-codes.js')));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const G = await import(pathToFileURL(join(dir, 'programmes.js')));
  const C = await import(pathToFileURL(join(dir, 'core.js')));
  const M = await import(pathToFileURL(join(dir, 'mis.js')));
  const D = await import(pathToFileURL(join(dir, 'fhir-document.js')));
  const X = await import(pathToFileURL(join(dir, 'fhir.js')));

  // 1. The vocabulary is versioned, single and complete.
  check(() => assert.equal(R.REASON_CODE_SYSTEM, 'https://saha.example/reason-codes'));
  check(() => assert.equal(R.REASON_CODE_VERSION, '1.0.0'));
  check(() => assert.equal(R.REASON_CODE_RULESET, 'saha-reason-codes-1.0.0'));
  check(() => assert.match(R.REASON_CODE_STATUS, /not clinically approved/));
  check(() => assert.deepEqual([...R.REASON_CLASSES], ['missing', 'refused', 'uncertain', 'not-applicable']));
  check(() => assert.deepEqual(Object.keys(R.REASON_CODES).sort(), ['declined', 'not-applicable', 'not-asked', 'unable-to-obtain', 'unknown'].sort()));
  check(() => assert.equal(R.REASON_CODES.declined.class, 'refused'));
  check(() => assert.equal(R.REASON_CODES.unknown.class, 'uncertain'));
  check(() => assert.equal(R.REASON_CODES['unable-to-obtain'].class, 'uncertain'));
  check(() => assert.equal(R.REASON_CODES['not-asked'].class, 'missing'));
  check(() => assert.equal(R.REASON_CODES['not-applicable'].class, 'not-applicable'));

  // 2. Measurement provenance sources map onto codes; recorded sources are not reasons.
  check(() => assert.equal(R.sourceReason('measured'), null));
  check(() => assert.equal(R.sourceReason('reported'), null));
  check(() => assert.equal(R.sourceReason(undefined), null));
  check(() => assert.equal(R.sourceReason(null), null));
  check(() => assert.deepEqual(R.sourceReason('not-asked'), { system: R.REASON_CODE_SYSTEM, version: '1.0.0', code: 'not-asked', display: 'Not asked', class: 'missing' }));
  check(() => assert.deepEqual(R.sourceReason('declined'), { system: R.REASON_CODE_SYSTEM, version: '1.0.0', code: 'declined', display: 'Declined', class: 'refused' }));
  check(() => assert.deepEqual(R.sourceReason('unknown'), { system: R.REASON_CODE_SYSTEM, version: '1.0.0', code: 'unknown', display: 'Unknown', class: 'uncertain' }));
  check(() => assert.deepEqual(R.sourceReason('not-applicable'), { system: R.REASON_CODE_SYSTEM, version: '1.0.0', code: 'not-applicable', display: 'Not applicable', class: 'not-applicable' }));
  check(() => P.MISSING_SOURCES.every(s => R.sourceReason(s) !== null));
  check(() => P.RECORDED_SOURCES.every(s => R.sourceReason(s) === null));

  // 3. Programme absence reasons map onto the same codes and classes.
  check(() => assert.deepEqual(R.absenceReason('Unknown'), R.sourceReason('unknown')));
  check(() => assert.deepEqual(R.absenceReason('Not measured'), R.sourceReason('not-asked')));
  check(() => assert.deepEqual(R.absenceReason('Declined'), R.sourceReason('declined')));
  check(() => assert.deepEqual(R.absenceReason('Unable to obtain'), R.reasonFor('unable-to-obtain')));
  check(() => assert.equal(R.absenceReason('nonsense'), null));
  check(() => G.ABSENCE.every(a => R.absenceReason(a) !== null));
  check(() => assert.equal(R.reasonClass('Unknown'), 'uncertain'));
  check(() => assert.equal(R.reasonClass('Not measured'), 'missing'));
  check(() => assert.equal(R.reasonClass('Declined'), 'refused'));
  check(() => assert.equal(R.reasonClass('Unable to obtain'), 'uncertain'));

  // 4. The single mapping function covers both kinds of free-text reason field.
  check(() => assert.equal(R.reasonForField('declined').code, 'declined'));
  check(() => assert.equal(R.reasonForField('Unable to obtain').code, 'unable-to-obtain'));
  check(() => assert.equal(R.reasonForField('measured'), null));
  check(() => assert.equal(R.reasonClass('not-applicable'), 'not-applicable'));
  check(() => assert.equal(R.reasonClass('measured'), null));

  // 5. Coded FHIR artefacts: a CodeableConcept coding for a reason and a coded method for reported.
  check(() => assert.deepEqual(R.reasonCoding('declined'), { system: R.REASON_CODE_SYSTEM, code: 'declined', display: 'Declined' }));
  check(() => assert.equal(R.reasonCoding('measured'), null));
  check(() => assert.deepEqual(R.methodCoding('reported'), { coding: [{ system: R.REASON_CODE_SYSTEM, code: 'reported', display: 'Reported by the person or carer; not measured during the visit' }] }));
  check(() => assert.equal(R.methodCoding('measured'), undefined));

  // 6. Provenance and absence maps carry only reasons, keyed by field / question id.
  check(() => assert.deepEqual(Object.keys(R.provenanceReasonCodes({ weight: { source: 'reported' }, temperature: { source: 'declined' }, weeks: { source: 'not-asked' } })).sort(), ['temperature', 'weeks']));
  check(() => assert.equal(R.provenanceReasonCodes({ weight: { source: 'reported' } }).weight, undefined));
  check(() => assert.equal(Object.keys(R.provenanceReasonCodes(undefined)).length, 0));
  check(() => assert.deepEqual(Object.keys(R.absenceReasonCodes({ cough: 'Unknown', appointment_discussed: 'Declined' })).sort(), ['appointment_discussed', 'cough']));

  // 7. MIS payload reasons section (additive; omitted when no measurement has a recorded reason).
  check(() => assert.equal(R.misReasons({ provenance: { weight: { source: 'reported' } } }), undefined));
  const mis = R.misReasons({ provenance: { temperature: { source: 'declined' }, weeks: { source: 'unknown' } } });
  check(() => assert.equal(mis.system, R.REASON_CODE_SYSTEM));
  check(() => assert.equal(mis.version, '1.0.0'));
  check(() => assert.deepEqual(mis.entries.map(e => [e.field, e.code, e.class]), [['temperature', 'declined', 'refused'], ['weeks', 'unknown', 'uncertain']]));

  // 8. Summary reason-codes line (the existing free-text summary is unchanged).
  check(() => assert.equal(R.summaryReasonCodes({ provenance: { weight: { source: 'reported' } } }), ''));
  check(() => assert.equal(R.summaryReasonCodes({ provenance: { temperature: { source: 'declined' } } }), 'Reason codes (saha-reason-codes-1.0.0): temperature=declined (refused).'));

  // 9. The mapping applies to the real downstream resources.
  const hour = 3600000, minute = t => new Date(t).toISOString().slice(0, 16);
  const visitAt = minute(Date.now() - 2 * hour), earlier = minute(Date.now() - 26 * hour);
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  const mixed = { ...base, weight: '61', provenance: { weight: { source: 'reported', at: earlier }, temperature: { source: 'declined' } } };
  const person = { id: 'p_synthetic', name: 'Synthetic Reason Person', sex: 'Female' };
  const visit = f => ({ id: 'v-synthetic', personId: person.id, facts: f });

  // Demo summary carries the free-text reason (unchanged) and the coded line via the mapping.
  check(() => assert.match(C.summary(mixed), /Not recorded: temperature \(declined\)\./));
  check(() => assert.match(R.summaryReasonCodes(mixed), /temperature=declined \(refused\)/));

  // MIS payload: the existing fields are unchanged; the mapping supplies the reasons section.
  const i = { id: 'mis1', name: 'Synthetic programme', kind: 'mis', mode: 'http', status: 'active', version: 1, programmes: ['General care'], mis: { contract: 'saha-mis-v1', mapping: [{ source: 'weight', target: 'weight_kg', required: true }, { source: 'temperature', target: 'temp_c', required: false }], corrections: false } };
  const s = { organisation: { id: 'org' }, workspace: { role: 'clinician', people: [person], visits: [visit(mixed)], integrations: [i], submissions: [], audit: [] } };
  check(() => assert.deepEqual(M.mappedPayload(i, visit(mixed), s).fields, { weight_kg: '61' }));
  check(() => assert.deepEqual(R.misReasons(mixed).entries.map(e => e.field + ':' + e.code), ['temperature:declined']));

  // FHIR document: a reported observation exists with its free-text method (the coded method is added by the
  // mapping); the missing measurement is not an observation and its reason is stated in the narrative.
  const doc = D.fhirDocument(person, visit(mixed), 'Synthetic organisation', 'Synthetic worker');
  const obs = doc.entry.map(e => e.resource).filter(r => r.resourceType === 'Observation');
  const weight = obs.find(o => o.code.coding[0].code === '29463-7');
  check(() => assert.ok(weight));
  check(() => assert.equal(weight.method.text, 'Reported by the person or carer; not measured during the visit'));
  check(() => assert.equal(obs.some(o => o.code.coding[0].code === '8310-5'), false, 'a declined temperature is not an observation'));
  check(() => assert.match(doc.entry[0].resource.section[0].text.div, /Temperature: not recorded \(declined\)\./));
  check(() => assert.deepEqual(R.methodCoding('reported').coding[0], { system: R.REASON_CODE_SYSTEM, code: 'reported', display: 'Reported by the person or carer; not measured during the visit' }));

  // FHIR example download: same shape.
  const ex = X.fhirExample(person, visit(mixed)).entry.map(e => e.resource);
  check(() => assert.ok(ex.find(r => r.id === 'v-synthetic-weight').method));
  check(() => assert.equal(ex.some(r => r.id === 'v-synthetic-temperature'), false));
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/reason-codes-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Unified versioned reason-code vocabulary: system, version, ruleset and status; the four semantic classes (missing, refused, uncertain, not-applicable); five codes with canonical display and class; measurement provenance sources mapped onto codes (recorded sources are not reasons, all missing sources have a code, all recorded sources none); programme answer absence reasons mapped onto the same codes and classes; a single reasonForField mapping for both kinds of free-text field; coded FHIR artefacts (reason CodeableConcept coding and a coded method for reported); provenance and absence maps keyed by field/question id; the MIS payload reasons section (omitted when none); the summary reason-codes line; and the mapping applied to the real demo summary, MIS mapped payload, FHIR document and FHIR example download.' }, null, 2) + '\n');
console.log(`${passed} reason codes contract checks passed`);
