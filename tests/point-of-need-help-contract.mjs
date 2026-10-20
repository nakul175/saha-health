// SAHA-156 / CWO-023: optional, source-bound procedural help without authority or clinical invention.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync('.point-of-need-help-'), checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
try {
  writeFileSync(join(dir, 'help.mjs'), ts.transpileModule(readFileSync('lib/saha/point-of-need-help.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const { pointOfNeedHelp, POINT_OF_NEED_HELP_SOURCE } = await import(pathToFileURL(join(dir, 'help.mjs')).href);
  const available = step => pointOfNeedHelp({ task: 'routine-visit', step, actorRole: 'asha' });
  const steps = ['time', 'fact:bloodPressure', 'fact:weight', 'fact:temperature', 'fact:weeks', 'fact:coughDays', 'notes', 'programme:cough', 'programme-save', 'facts-save', 'review'];
  for (const step of steps) check('Approved routine step is discoverable: ' + step, () => {
    const result = available(step);
    assert.equal(result.kind, 'available'); assert.equal(result.source.id, POINT_OF_NEED_HELP_SOURCE.id);
    assert.ok(result.instructions.length >= 2); assert.match(result.manualPath, /continue the current form/);
  });
  check('Help provenance is fixed and non-clinical', () => {
    assert.deepEqual(POINT_OF_NEED_HELP_SOURCE, {
      id: 'saha-routine-task-guidance', label: 'Saha routine-task guidance', version: '1.0',
      provenance: 'Internal procedural guidance; no external provider or clinical content.',
    });
  });
  for (const role of ['clinician', 'supervisor', 'admin', 'provider', '', 'owner']) check('Out-of-scope actor is refused without catalogue disclosure: ' + role, () => {
    const result = pointOfNeedHelp({ task: 'routine-visit', step: 'fact:weight', actorRole: role });
    assert.deepEqual(Object.keys(result).sort(), ['kind', 'manualPath', 'message']); assert.equal(result.kind, 'refused');
  });
  for (const task of ['other', '', 'routine-visit?person=p_foreign']) check('Irrelevant task is refused: ' + task, () => {
    const result = pointOfNeedHelp({ task, step: 'fact:weight', actorRole: 'asha' });
    assert.equal(result.kind, 'refused'); assert.equal('source' in result, false); assert.equal('instructions' in result, false);
  });
  for (const step of ['fact:pulse', 'programme:', 'destination-send', '__proto__', '']) check('Unapproved help context is refused: ' + step, () => {
    const result = available(step); assert.equal(result.kind, 'refused'); assert.doesNotMatch(JSON.stringify(result), /blood pressure|programme question/i);
  });
  check('Unavailable source never fabricates replacement content or success', () => {
    const result = pointOfNeedHelp({ task: 'routine-visit', step: 'notes', actorRole: 'asha', sourceAvailable: false });
    assert.equal(result.kind, 'unavailable'); assert.equal('instructions' in result, false);
    assert.match(result.message, /unavailable/); assert.match(result.message, /No replacement content or completion status/);
  });
  check('Help carries no person, organisation, assignment or write payload', () => {
    const result = available('fact:weight'), serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /personId|organisationId|assignedTo|patient|api\/commands|fetch|saveVisit|confirmVisit/);
  });
  check('Successive step lookups do not mutate or retain previous help', () => {
    const first = available('time'), second = available('notes');
    assert.notEqual(first, second); assert.equal(first.title, 'Observation time and source'); assert.equal(second.title, 'Visit notes');
    assert.equal(first.title, 'Observation time and source');
  });
  check('Implementation performs no network, durable storage or dynamic code execution', () => {
    const source = readFileSync('lib/saha/point-of-need-help.ts', 'utf8') + readFileSync('app/point-of-need-help.tsx', 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|WebSocket|eval\s*\(|new Function|api\/commands/);
  });
  mkdirSync('tests/evidence/saha-156-point-of-need-help', { recursive: true });
  const report = { suite: 'SAHA-156 point-of-need help contract', passed: checks.length, failed: 0, skipped: 0, checks,
    completedAt: new Date().toISOString(), limits: 'Synthetic source and component contract. No clinical content, physical device, formal acceptance, CI, merge or deployment claim.' };
  writeFileSync('tests/evidence/saha-156-point-of-need-help/contract-result.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { rmSync(dir, { recursive: true, force: true }); }
