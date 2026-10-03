// Slice r21 contract (BR-DATA-02, BR-DATA-05, BR-INT-11): coded FHIR provenance for the server-recorded
// measurement author, clinician review and supervisor sign-off, and the structured (non-note) extension that
// carries unusual-value overrides — all inside a document that still passes the pinned rule set
// `saha-fhir-r4-document-structure` (id, version, basis and regression corpus unchanged).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.fhir-provenance-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['fhir-validate', 'fhir-document', 'adapter-operations', 'core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const D = await import(pathToFileURL(join(dir, 'fhir-document.js')));
  const V = await import(pathToFileURL(join(dir, 'fhir-validate.js')));

  const now = '2026-10-02T06:00:00.000Z', visitAt = '2026-10-02T04:00';
  const base = { date: visitAt, systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' };
  const asha = { userId: 'asha-1', name: 'Synthetic ASHA', accountCode: 'A'.repeat(24), role: 'asha', at: now };
  const person = { id: 'psyn', name: 'Synthetic Provenance Person', sex: 'Female' };
  const visit = (facts, extra = {}) => ({ id: 'v-syn', personId: person.id, version: 3, state: 'confirmed', facts, recordVersion: 2, aiResults: [], ...extra });

  // 1. The pinned rule set is unchanged.
  check(() => assert.deepEqual([V.VALIDATION_RULESET.id, V.VALIDATION_RULESET.version, V.VALIDATION_RULESET.fhirVersion], ['saha-fhir-r4-document-structure', '1.0.0', '4.0.1']));
  check(() => assert.equal(V.VALIDATION_RULESET.profilePackage, null));

  // 2. Synchronous sign-off resolution: current, withdrawn, stale version, non-confirmed.
  const signOffs = [{ id: 'so-1', by: 'sup-1', byName: 'Name sup-1', accountCode: 'D'.repeat(24), role: 'supervisor', at: '2026-10-02T08:00:00.000Z', visitVersion: 3, contentHash: 'x'.repeat(64) }];
  const baseRich = visit({ ...base, weight: '61' }, { signOffs });
  check(() => assert.equal(D.currentSignOffSync(baseRich).id, 'so-1'));
  check(() => assert.equal(D.currentSignOffSync({ ...baseRich, signOffWithdrawals: [{ id: 'w1', signOffId: 'so-1', by: 'sup-2', byName: 'x', accountCode: 'e'.repeat(24), role: 'supervisor', at: now, reason: 'Withdrawn for review.' }] }), null));
  check(() => assert.equal(D.currentSignOffSync({ ...baseRich, version: 4 }), null));
  check(() => assert.equal(D.currentSignOffSync({ ...baseRich, state: 'draft' }), null));
  check(() => assert.equal(D.signOffAgent(baseRich).type, 'attester'));
  check(() => assert.equal(D.signOffAgent({ ...baseRich, version: 4 }), null));

  // 3. A rich visit: unusual weight (entered in lb, beyond the confirmation range, clinician-confirmed),
  // an unusual systolic (reason tier), authors, a disputed weight review and a supervisor sign-off.
  const facts = { ...base, weight: '400.07', systolic: '210', diastolic: '90', provenance: { weight: { source: 'measured' } }, entered: { weight: { value: '882', unit: 'lb' } }, unusual: { weight: 'Synthetic scale reading repeated twice.', systolic: 'Repeated after rest.' } };
  const weightOverride = { id: 'ov-w', field: 'weight', value: '400.07', unit: 'kg', entered: { value: '882', unit: 'lb' }, reason: 'Synthetic scale reading repeated twice.', tier: 'clinician', expected: [2, 150], confirm: [0.5, 300], rangesVersion: 'saha-value-ranges-0.1.0', by: asha, at: now, visitId: 'v-syn' };
  const systolicOverride = { id: 'ov-s', field: 'systolic', value: '210', unit: 'mmHg', reason: 'Repeated after rest.', tier: 'reason', expected: [70, 200], confirm: [50, 260], rangesVersion: 'saha-value-ranges-0.1.0', by: asha, at: now, visitId: 'v-syn' };
  const confirmation = { id: 'oc-w', overrideId: 'ov-w', field: 'weight', by: 'clin-2', byName: 'Name clin-2', accountCode: 'C'.repeat(24), at: now, visitId: 'v-syn', note: 'Discussed with the synthetic ASHA.' };
  const rich = visit(facts, {
    factAuthors: { weight: asha, bloodPressure: asha },
    factReviews: [
      { id: 'fr-1', measure: 'weight', state: 'verified', by: 'clin-1', byName: 'Name clin-1', at: now },
      { id: 'fr-2', measure: 'weight', state: 'disputed', by: 'clin-3', byName: 'Name clin-3', at: '2026-10-02T07:00:00.000Z', reason: 'Scale not zeroed before weighing.' },
    ],
    valueOverrides: [systolicOverride, weightOverride],
    overrideConfirmations: [confirmation],
    signOffs,
  });

  // 4. The pure helpers.
  const agents = D.observationAgents(rich, 'weight');
  check(() => assert.deepEqual(agents.map(a => a.type), ['author', 'verifier']));
  check(() => assert.equal(agents[0].userId, 'asha-1'));
  check(() => assert.deepEqual([agents[1].userId, agents[1].state], ['clin-3', 'disputed']));
  check(() => assert.deepEqual(D.observationAgents(rich, 'temperature'), []));
  check(() => assert.equal(D.overrideExtension(visit({ ...base, weight: '50' }), 'weight'), null));
  check(() => assert.equal(D.overrideExtension(rich, 'diastolic'), null, 'an in-range value has no override extension'));

  // 5. The document carries Provenance resources and structured override extensions, and still validates.
  const doc = D.fhirDocument(person, rich, 'Synthetic organisation', 'Synthetic confirmer');
  const stamp = V.validateOutbound(doc, person.id);
  check(() => assert.equal(stamp.ruleset, 'saha-fhir-r4-document-structure'));
  check(() => assert.equal(stamp.version, '1.0.0'));
  const res = doc.entry.map(e => e.resource);
  const wt = res.find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '29463-7');
  const sys = res.find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '8480-6');
  const dia = res.find(r => r.resourceType === 'Observation' && r.code.coding[0].code === '8462-4');
  const provs = res.filter(r => r.resourceType === 'Provenance');
  check(() => assert.equal(provs.length, 4, 'weight, systolic, diastolic and the visit sign-off'));

  // The weight observation's structured override extension.
  check(() => { assert.ok(wt.extension, 'weight observation carries an extension'); assert.equal(wt.extension[0].url, 'urn:saha:fhir:unusual-value'); });
  const sub = u => wt.extension[0].extension.find(x => x.url === u);
  check(() => assert.equal(sub('enteredValue').valueString, '882'));
  check(() => assert.equal(sub('enteredUnit').valueString, 'lb'));
  check(() => assert.equal(sub('reason').valueString, 'Synthetic scale reading repeated twice.'));
  check(() => assert.equal(sub('tier').valueCode, 'clinician'));
  check(() => assert.equal(sub('rangesVersion').valueString, 'saha-value-ranges-0.1.0'));
  check(() => assert.equal(sub('expectedRange').valueString, '2..150'));
  check(() => assert.equal(sub('confirmRange').valueString, '0.5..300'));
  check(() => assert.equal(sub('recordedBy').valueString, 'Synthetic ASHA'));
  check(() => assert.equal(sub('recordedByRole').valueCode, 'asha'));
  check(() => assert.equal(sub('recordedAt').valueDateTime, now));
  check(() => assert.equal(sub('confirmation').extension.find(x => x.url === 'confirmedBy').valueString, 'Name clin-2'));
  check(() => assert.equal(sub('confirmation').extension.find(x => x.url === 'note').valueString, 'Discussed with the synthetic ASHA.'));

  // The systolic override extension (reason tier, no confirmation).
  check(() => { assert.equal(sys.extension[0].url, 'urn:saha:fhir:unusual-value'); assert.equal(sys.extension[0].extension.find(x => x.url === 'tier').valueCode, 'reason'); assert.equal(sys.extension[0].extension.some(x => x.url === 'confirmation'), false); });
  check(() => assert.equal(dia.extension, undefined, 'diastolic is in range and has no extension'));

  // The weight observation's Provenance: author reuses the performer Practitioner, the verifier is an
  // identifier+display reference (no new Practitioner), and the verification state is coded.
  const wtEntry = doc.entry.find(e => e.resource.resourceType === 'Observation' && e.resource.code.coding[0].code === '29463-7');
  const wtProv = provs.find(pr => pr.target.some(t => t.reference === wtEntry.fullUrl));
  check(() => assert.ok(wtProv, 'the weight observation has a Provenance'));
  const authorAgent = wtProv.agent.find(a => a.type.coding[0].code === 'author');
  const verifierAgent = wtProv.agent.find(a => a.type.coding[0].code === 'verifier');
  check(() => assert.equal(authorAgent.who.reference, wtEntry.resource.performer[0].reference, 'author references the existing performer'));
  check(() => assert.equal(authorAgent.role[0].coding[0].code, 'asha'));
  check(() => assert.equal(authorAgent.extension.find(x => x.url === 'urn:saha:fhir:recorded-at').valueDateTime, now));
  check(() => assert.deepEqual([verifierAgent.who.identifier.value, verifierAgent.who.display], ['clin-3', 'Name clin-3']));
  check(() => assert.equal(verifierAgent.role[0].coding[0].code, 'clinician'));
  check(() => assert.equal(verifierAgent.extension.find(x => x.url === 'urn:saha:fhir:verification').valueCode, 'disputed'));
  check(() => assert.equal(verifierAgent.extension.find(x => x.url === 'reason').valueString, 'Scale not zeroed before weighing.'));

  // The visit-level sign-off Provenance targets the Composition.
  const compEntry = doc.entry[0];
  check(() => assert.equal(compEntry.resource.resourceType, 'Composition'));
  const signOffProv = provs.find(pr => pr.target.some(t => t.reference === compEntry.fullUrl));
  check(() => assert.ok(signOffProv, 'a visit-level sign-off Provenance targets the Composition'));
  check(() => assert.equal(signOffProv.agent[0].type.coding[0].code, 'attester'));
  check(() => assert.equal(signOffProv.agent[0].who.identifier.value, 'sup-1'));
  check(() => assert.equal(signOffProv.agent[0].role[0].coding[0].code, 'supervisor'));

  // No verifier or sign-off Practitioner resources are added: the document keeps two Practitioners.
  check(() => assert.equal(res.filter(r => r.resourceType === 'Practitioner').length, 2, 'author Practitioner plus the composition author'));

  // 6. An ordinary visit is unchanged: no Provenance, no extension, one Practitioner, still valid.
  const plain = D.fhirDocument(person, visit({ ...base, weight: '50', temperature: '37' }), 'Synthetic organisation', 'Synthetic confirmer');
  V.validateOutbound(plain, person.id);
  const plainRes = plain.entry.map(e => e.resource);
  check(() => assert.equal(plainRes.some(r => r.resourceType === 'Provenance'), false));
  check(() => assert.equal(plainRes.filter(r => r.resourceType === 'Observation').every(o => !o.extension), true));
  check(() => assert.equal(plainRes.filter(r => r.resourceType === 'Practitioner').length, 1, 'only the composition author'));

  // 7. The rule set's refusals are unchanged: an unsupported resource type is still refused.
  const bad = structuredClone(doc);
  bad.entry.push({ fullUrl: 'urn:uuid:00000000-0000-4000-8000-000000000000', resource: { resourceType: 'MedicationRequest', id: 'm1' } });
  let error; try { V.validateOutbound(bad, person.id); } catch (e) { error = e; }
  check(() => { assert.ok(error, 'an unsupported resource type is still refused'); assert.equal(error.status, 422); assert.match(error.message, /^Document failed saha-fhir-r4-document-structure 1\.0\.0: Unsupported document resource/); });

  // An unresolved Provenance target is still refused (references must resolve).
  const dangling = structuredClone(doc);
  const dp = dangling.entry.find(e => e.resource.resourceType === 'Provenance');
  dp.resource.target[0].reference = 'urn:uuid:00000000-0000-4000-8000-000000000000';
  let derror; try { V.validateOutbound(dangling, person.id); } catch (e) { derror = e; }
  check(() => { assert.ok(derror); assert.match(derror.message, /not resolved inside the bundle/); });
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/fhir-provenance-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Coded FHIR provenance (slice r21): the pinned rule set is unchanged; the sync sign-off resolution (current, withdrawn, stale, non-confirmed); observation agents (author + latest verifier with state and reason); the structured override extension (entered value/unit, reason, tier, ranges version and ranges, recorder, confirmation) for an unusual value and none for an in-range one; a document with per-observation Provenance (author reusing the performer, verifier as an identifier+display reference, coded verification state) and a visit-level sign-off Provenance targeting the Composition, all passing the unchanged validator; ordinary visits unchanged; and the rule set still refusing unsupported and unresolved resources.' }, null, 2) + '\n');
console.log(`${passed} fhir provenance contract checks passed`);
