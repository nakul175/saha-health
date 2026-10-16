import assert from 'node:assert/strict';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const out = await mkdtemp(path.join(tmpdir(), 'saha-encounter-summary-'));
try {
  const source = await readFile('lib/saha/encounter-summary.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await writeFile(path.join(out, 'summary.mjs'), compiled);
  const { encounterSummary, updateEncounterFact } = await import(pathToFileURL(path.join(out, 'summary.mjs')));
  const facts = { date: '2026-10-16T09:00', systolic: '120', diastolic: '80', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic measured observation', source: 'measured', provenance: { weight: { source: 'declined' }, temperature: { source: 'unknown' } } };
  const visit = { id: 'v1', personId: 'p1', version: 4, recordVersion: 2, state: 'confirmed', facts, createdAt: '2026-10-16T09:00:00Z', aiResults: [{ id: 'a1', providerId: 'assistant', providerName: 'Synthetic assistant', mode: 'demo', status: 'succeeded', text: 'Consider follow-up', createdAt: '2026-10-16T09:01:00Z', inputHash: 'hash', reviewed: false }] };
  const person = { programmes: ['General care'] };
  const summary = encounterSummary(visit, person);
  assert.deepEqual(summary.confirmed.map(x => x.id), ['date', 'bloodPressure', 'notes']);
  assert.deepEqual(summary.missing.map(x => [x.id, x.value]), [['weight', 'declined'], ['temperature', 'unknown']]);
  assert.equal(summary.uncertain.length, 0);
  assert.match(summary.proposedActions[0].value, /not a confirmed observation/);
  assert.equal(summary.nextRequiredStep, 'Complete Weight.');

  const reported = encounterSummary({ ...visit, state: 'draft', facts: { ...facts, date: 'uncertain date', source: 'reported' }, aiResults: [] }, person);
  assert.ok(reported.uncertain.some(x => x.id === 'date'));
  assert.ok(!reported.confirmed.some(x => x.id === 'date'));

  const before = structuredClone(facts);
  const corrected = updateEncounterFact(facts, 'notes', 'Corrected note');
  assert.equal(corrected.notes, 'Corrected note');
  assert.equal(corrected.date, before.date);
  assert.deepEqual(corrected.provenance, before.provenance);
  assert.deepEqual(facts, before);
  assert.equal(visit.personId, 'p1');
  console.log('encounter summary contract: 12 assertions passed');
} finally { await rm(out, { recursive: true, force: true }); }
