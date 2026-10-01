// Slice 7c contract: the pinned outbound FHIR rule set and its regression corpus. Each corpus case is
// one deliberate violation of a single rule applied to a document built by the product itself.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.fhir-validate-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['fhir-validate', 'fhir-document', 'adapter-operations','core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const V = await import(pathToFileURL(join(dir, 'fhir-validate.js')));
  const D = await import(pathToFileURL(join(dir, 'fhir-document.js')));
  const person = { id: 'p_1', name: 'Validation Synthetic', sex: 'Female' };
  const visit = { id: 'v1', facts: { date: '2026-09-01T09:30', source: 'measured', notes: 'Synthetic note', weight: '61.5', systolic: '118', diastolic: '76', temperature: '37.1', weeks: '', coughDays: '' } };
  const make = () => D.fhirDocument(person, visit, 'Synthetic organisation', 'Synthetic clinician', 'doc-1', 'ext-1');
  check(() => assert.deepEqual([V.VALIDATION_RULESET.id, V.VALIDATION_RULESET.version, V.VALIDATION_RULESET.fhirVersion], ['saha-fhir-r4-document-structure', '1.0.0', '4.0.1']));
  check(() => { assert.equal(V.VALIDATION_RULESET.profilePackage, null); assert.equal(V.VALIDATION_RULESET.terminology, null); });
  const stamp = V.validateOutbound(make(), 'ext-1', '2026-09-30T00:00:00.000Z');
  check(() => assert.deepEqual({ ...stamp, warnings: undefined }, { ruleset: 'saha-fhir-r4-document-structure', version: '1.0.0', fhirVersion: '4.0.1', checkedAt: '2026-09-30T00:00:00.000Z', warnings: undefined }));
  check(() => assert.ok(stamp.warnings.some(w => /Full FHIR and ABDM profile validation has not been performed/.test(w))));
  const obs = b => b.entry.find(e => e.resource.resourceType === 'Observation');
  const corpus = [
    ['not a document (Bundle.type)', b => { b.type = 'collection'; }, /document Bundle with identifier and timestamp/],
    ['bdl-9 identifier system missing', b => { delete b.identifier.system; }, /document Bundle with identifier and timestamp/],
    ['bdl-10 timestamp missing', b => { delete b.timestamp; }, /document Bundle with identifier and timestamp/],
    ['bdl-11 Composition not first', b => { b.entry.push(b.entry.shift()); }, /first resource must be a final Composition/],
    ['bdl-7 duplicate fullUrl', b => { b.entry[2].fullUrl = b.entry[1].fullUrl; }, /Duplicate document resource references/],
    ['unresolved reference', b => { obs(b).resource.subject.reference = 'urn:uuid:00000000-0000-4000-8000-000000000000'; }, /not resolved inside the bundle/],
    ['wrong UCUM unit', b => { obs(b).resource.valueQuantity.code = 'g'; }, /Observation units or values/],
    ['negative value', b => { obs(b).resource.valueQuantity.value = -1; }, /Observation units or values/],
    ['observation time without zone', b => { obs(b).resource.effectiveDateTime = '2026-09-01T09:30:00'; }, /time and timezone/],
    ['contained resource', b => { obs(b).resource.contained = [{ resourceType: 'Patient', id: 'x' }]; }, /Unsupported document resource/],
    ['unsupported resource type', b => { b.entry.push({ fullUrl: 'urn:uuid:11111111-1111-4111-8111-111111111111', resource: { resourceType: 'MedicationRequest', id: 'm1' } }); }, /Unsupported document resource/],
    ['second Patient', b => { const p = b.entry.find(e => e.resource.resourceType === 'Patient'); b.entry.push({ fullUrl: 'urn:uuid:22222222-2222-4222-8222-222222222222', resource: { ...p.resource, id: 'other' } }); }, /Exactly one Composition and one Patient/],
    ['Composition not final', b => { b.entry[0].resource.status = 'preliminary'; }, /first resource must be a final Composition/],
    ['empty section', b => { b.entry[0].resource.section = [{ title: 'Empty' }]; }, /Empty document section/],
  ];
  for (const [name, mutate, reason] of corpus) {
    const b = make(); mutate(b);
    let error; try { V.validateOutbound(b, 'ext-1'); } catch (e) { error = e; }
    check(() => { assert.ok(error, name + ' must be refused'); assert.equal(error.status, 422, name); assert.match(error.message, /^Document failed saha-fhir-r4-document-structure 1\.0\.0: /, name); assert.match(error.message, reason, name); assert.match(error.message, /Nothing was sent\.$/, name); });
  }
  let mismatch; try { V.validateOutbound(make(), 'someone-else'); } catch (e) { mismatch = e; }
  check(() => assert.match(mismatch.message, /Document patient does not match/));
  // Non-validation errors are not relabelled.
  let other; try { V.validateOutbound(new Proxy({}, { get() { throw new TypeError('boom'); } })); } catch (e) { other = e; }
  check(() => { assert.ok(other instanceof TypeError); });
  const result = { suite: 'Outbound FHIR validation contract (slice 7c)', passed, corpus: corpus.length, completedAt: new Date().toISOString() };
  writeFileSync('tests/fhir-validate-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
