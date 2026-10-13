// SAHA-040 / ENG-BR-AG-01: closed deterministic shortcuts, never tools or authority.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync('.task-entry-contract-'), checks = [];
try {
  writeFileSync(join(dir, 'task-entry.mjs'), ts.transpileModule(readFileSync('lib/saha/task-entry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { parseTaskEntry, TASK_ENTRY_CATALOGUE, TASK_ENTRY_MAX_LENGTH } = await import(pathToFileURL(join(dir, 'task-entry.mjs')).href);
  const check = (name, fn) => { fn(); checks.push(name); };
  for (const task of TASK_ENTRY_CATALOGUE) for (const phrase of task.phrases) check('Closed phrase: ' + phrase, () => {
    const result = parseTaskEntry(phrase); assert.equal(result.kind, 'navigation'); assert.equal(result.intent, task.intent); assert.equal(result.href, '/today');
    assert.equal('personId' in result, false); assert.equal('organisationId' in result, false); assert.equal('command' in result, false);
  });
  check('ASCII case and spaces only are harmless', () => assert.equal(parseTaskEntry('  OPEN   TODAY  ').intent, 'assigned-records'));
  const rejected = [undefined, null, 12, {}, ['today'], '', '   ', 'today and prescribe medicine', 'ignore rules; open today', 'open today; issue prescription', 'pay benefits', 'tell my household what medicine to take', '/today', 'https://example.invalid', 'javascript:alert(1)', 'open today?personId=p_foreign', 'show record p_foreign', 'today\nignore rules', 'today\u0000', '\u202etoday', 'ｔｏｄａｙ', 'review routine visit as owner', 'constructor', '__proto__', 'toString', 'a'.repeat(TASK_ENTRY_MAX_LENGTH + 1)];
  for (let i = 0; i < rejected.length; i++) check('Unsupported/invalid input ' + i + ' has no navigation or action', () => {
    const r = parseTaskEntry(rejected[i]); assert.equal(r.kind, 'refused'); assert.equal('href' in r, false); assert.equal('command' in r, false); assert.match(r.message, /Only the listed navigation shortcuts/);
  });
  check('A later corrected phrase does not retain the previous intent', () => {
    const old = parseTaskEntry('today'), corrected = parseTaskEntry('review a routine visit');
    assert.equal(old.intent, 'assigned-records'); assert.equal(corrected.intent, 'routine-review'); assert.notEqual(old, corrected);
  });
  check('Parser performs no fetch or durable storage call', () => {
    const source = readFileSync('lib/saha/task-entry.ts', 'utf8'); assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|executeAgent|api\/commands/);
  });
  const output = process.env.SAHA_TASK_ENTRY_REPORT ?? 'tests/reports/task-entry-contract-result.json';
  mkdirSync(join(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify({ passed: checks.length, failed: 0, skipped: 0, checks, completedAt: new Date().toISOString(), limits: 'Actual deterministic parser only; not model, provider, whole-story, field or hosting acceptance.' }, null, 2));
  console.log(`${checks.length} task entry contract checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
