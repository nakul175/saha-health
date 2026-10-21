import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.canonical-exchange-'));
let passed = 0; const failures = [];
const check = async (name, fn) => { try { await fn(); passed++; } catch (error) { failures.push(`${name}: ${error?.stack ?? error}`); } };
const rejects = async (fn, status, pattern) => { let error; try { await fn(); } catch (caught) { error = caught; } assert.ok(error, 'expected refusal'); assert.equal(error.status, status); assert.match(error.message, pattern); };

try {
  for (const source of ['core', 'types', 'programmes','installed-transition-authority', 'adapter-operations', 'mis', 'fact-provenance', 'canonical-exchange']) {
    const js = ts.transpileModule(readFileSync(`lib/saha/${source}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, `${source}.js`), js);
  }
  const C = await import(pathToFileURL(join(dir, 'canonical-exchange.js')));
  const now = '2026-10-16T09:30:00.000Z';
  const source = { system: 'saha', recordId: 'obs-bp-1', revision: 7, confirmedAt: '2026-10-16T09:00:00.000Z', confirmedBy: 'clinician-1', payload: { systolic: 120, diastolic: 80, unit: 'mm[Hg]' } };
  const makeRecord = () => C.createCanonicalRecord({ kind: 'observation', revision: 7, value: { systolic: 120, diastolic: 80 }, unit: 'mm[Hg]', source }, now);
  const authority = (destinationId, over = {}) => ({ destinationId, actorId: 'integration-owner', purpose: 'Share confirmed observation for continuing care', active: true, version: 3, expiresAt: '2026-10-17T09:30:00.000Z', allowedKinds: ['observation'], ...over });
  const mapping = (destinationId, version, map, over = {}) => ({ destinationId, version, active: true, canonicalKind: 'observation', sourceRevision: 7, map, ...over });

  await check('confirmed observation is copied into a canonical record without source loss', () => {
    const record = makeRecord();
    assert.equal(record.kind, 'observation'); assert.equal(record.source.revision, 7); assert.deepEqual(record.source.payload, source.payload);
    source.payload.systolic = 999; assert.equal(record.source.payload.systolic, 120, 'caller mutation cannot rewrite saved source');
    source.payload.systolic = 120;
  });

  await check('one canonical revision maps independently to two approved destinations with full lineage', async () => {
    const record = makeRecord();
    const requests = [
      { authority: authority('district'), mapping: mapping('district', 'district-bp-v2', r => ({ code: 'BP', value: r.value, unit: r.unit })) },
      { authority: authority('ehr'), mapping: mapping('ehr', 'fhir-r4-bp-v5', r => ({ resourceType: 'Observation', id: r.source.recordId, component: r.value })) },
    ];
    const outcomes = await C.mapCanonicalRecordToDestinations(record, requests, 'integration-owner', authority('x').purpose, now);
    assert.equal(outcomes.length, 2); assert.ok(outcomes.every(x => x.representation));
    for (const outcome of outcomes) {
      const result = outcome.representation;
      assert.equal(result.canonicalRecordId, record.id); assert.equal(result.canonicalRevision, 7);
      assert.equal(result.sourceSystem, 'saha'); assert.equal(result.sourceRecordId, 'obs-bp-1'); assert.equal(result.sourceRevision, 7);
      assert.match(result.payloadSha256, /^[a-f0-9]{64}$/); assert.equal(result.state, 'mapped');
    }
    assert.notEqual(outcomes[0].representation.mappingVersion, outcomes[1].representation.mappingVersion);
    assert.notDeepEqual(outcomes[0].representation.payload, outcomes[1].representation.payload);
  });

  await check('a failed destination is isolated while its sibling and canonical source remain intact', async () => {
    const record = makeRecord(); const before = structuredClone(record);
    const outcomes = await C.mapCanonicalRecordToDestinations(record, [
      { authority: authority('good'), mapping: mapping('good', 'v1', r => ({ bloodPressure: r.value })) },
      { authority: authority('bad'), mapping: mapping('bad', 'v9', () => { throw Error('incompatible'); }) },
    ], 'integration-owner', authority('x').purpose, now);
    assert.ok(outcomes[0].representation); assert.match(outcomes[1].error, /transformation failed/i); assert.deepEqual(record, before);
  });

  await check('missing, inactive and incompatible mappings refuse without a payload', async () => {
    const record = makeRecord();
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr'), mapping('ehr', 'v1', () => undefined), 'integration-owner', authority('x').purpose, now), 422, /no payload/);
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr'), mapping('ehr', 'v1', () => ({}), { active: false }), 'integration-owner', authority('x').purpose, now), 409, /inactive/);
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr'), mapping('ehr', 'v1', () => ({}), { sourceRevision: 6 }), 'integration-owner', authority('x').purpose, now), 409, /stale canonical revision/);
  });

  await check('destination-specific write authority and purpose are mandatory', async () => {
    const record = makeRecord(), m = mapping('ehr', 'v1', () => ({ ok: true }));
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr'), m, 'reader', authority('x').purpose, now), 403, /lacks destination-specific/);
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr'), m, 'integration-owner', 'A different use of the record', now), 403, /purpose/);
    await rejects(() => C.mapCanonicalRecord(record, authority('other'), m, 'integration-owner', authority('x').purpose, now), 403, /destination/);
  });

  await check('expired, withdrawn and wrong-kind authority refuse before transformation', async () => {
    const record = makeRecord(); let calls = 0; const m = mapping('ehr', 'v1', () => { calls++; return {}; });
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr', { expiresAt: now }), m, 'integration-owner', authority('x').purpose, now), 403, /inactive or expired/);
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr', { active: false }), m, 'integration-owner', authority('x').purpose, now), 403, /inactive or expired/);
    await rejects(() => C.mapCanonicalRecord(record, authority('ehr', { allowedKinds: ['condition'] }), m, 'integration-owner', authority('x').purpose, now), 403, /kind/);
    assert.equal(calls, 0, 'refused requests do not transform protected data');
  });

  await check('prepared representation is refused when authority changes before execution', async () => {
    const record = makeRecord(), a = authority('ehr'), m = mapping('ehr', 'v1', r => ({ value: r.value }));
    const result = await C.mapCanonicalRecord(record, a, m, 'integration-owner', a.purpose, now);
    await rejects(() => C.assertRepresentationCurrent(result, record, { ...a, version: 4 }, m, now), 403, /authority changed/);
  });

  await check('prepared representation is refused when canonical or mapping revision changes', async () => {
    const record = makeRecord(), a = authority('ehr'), m = mapping('ehr', 'v1', r => ({ value: r.value }));
    const result = await C.mapCanonicalRecord(record, a, m, 'integration-owner', a.purpose, now);
    await rejects(() => C.assertRepresentationCurrent(result, { ...record, revision: 8 }, a, m, now), 409, /canonical record changed/);
    await rejects(() => C.assertRepresentationCurrent(result, record, a, { ...m, version: 'v2' }, now), 409, /mapping changed/);
  });

  await check('mapping cannot mutate the stored canonical record', async () => {
    const record = makeRecord(), a = authority('ehr');
    const result = await C.mapCanonicalRecord(record, a, mapping('ehr', 'v1', r => { r.value.systolic = 130; return r.value; }), 'integration-owner', a.purpose, now);
    assert.equal(record.value.systolic, 120); assert.equal(result.payload.systolic, 130);
    result.payload.systolic = 140; assert.equal(record.value.systolic, 120);
  });

  await check('all ten required canonical representation kinds are explicit', () => {
    assert.deepEqual(C.CANONICAL_KINDS, ['person', 'encounter', 'observation', 'condition', 'service-request', 'care-plan', 'medication', 'diagnostic-result', 'document', 'provenance']);
  });

  await check('invalid and future source confirmations are refused', async () => {
    await rejects(() => Promise.resolve(C.createCanonicalRecord({ kind: 'observation', revision: 0, value: {}, unit: null, source }, now)), 422, /greater than 0/i);
    await rejects(() => Promise.resolve(C.createCanonicalRecord({ kind: 'observation', revision: 1, value: {}, unit: null, source: { ...source, confirmedAt: '2026-10-17T00:00:00.000Z' } }, now)), 422, /future/);
  });

  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`canonical exchange contract: ${passed}/${passed} checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
