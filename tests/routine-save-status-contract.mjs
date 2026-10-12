// BR-UX-06: a server acknowledgement must never acknowledge later input, device durability or destinations.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const dir = mkdtempSync('.routine-save-status-'), checks = [];
const check = (fn, name) => { fn(); checks.push(name); };
try {
  writeFileSync(join(dir, 'status.mjs'), ts.transpileModule(readFileSync('lib/saha/routine-save-status.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { routineSaveStatus } = await import(pathToFileURL(join(dir, 'status.mjs')).href);
  const draft = { version: 3, state: 'draft' }, confirmed = { version: 4, state: 'confirmed' };
  const get = (visit, flags = {}) => routineSaveStatus({ visit, dirty: false, busy: false, uncertain: false, ...flags });
  check(() => assert.match(get(null).record, /No server draft loaded/), 'No draft cannot claim a server save');
  check(() => assert.match(get(draft).record, /version 3: draft awaiting review/), 'Saved draft is separate from confirmed encounter');
  check(() => assert.match(get(confirmed).record, /version 4: confirmed encounter/), 'Confirmation retains actual server revision');
  check(() => assert.match(get({ ...confirmed, voidedAt: '2026-10-12T00:00:00Z' }).record, /voided record/), 'Voided history cannot display confirmed-current status');
  check(() => assert.match(get({ ...confirmed, supersededBy: 'replacement' }).record, /superseded record/), 'Superseded history cannot display confirmed-current status');
  check(() => assert.match(get(draft, { dirty: true }).entries, /Unsaved changes/), 'Editing after readback is not a new server acknowledgement');
  check(() => assert.match(get(draft, { busy: true, dirty: true }).entries, /Operation in progress/), 'In-flight operation is not confirmed success');
  check(() => assert.match(get(draft, { uncertain: true, busy: true, dirty: true }).entries, /Write outcome unresolved/), 'Unresolved attempt takes precedence and directs exact recovery');
  check(() => assert.match(get(draft).device, /does not save a durable copy/), 'No acknowledgement of absent local persistence');
  check(() => assert.match(get(confirmed).destination, /not loaded.*No submission or acceptance is claimed/), 'Confirmed local record does not imply external destination state');
  for (const visit of [null, draft, confirmed, { ...confirmed, voidedAt: '2026-10-12T00:00:00Z' }, { ...confirmed, supersededBy: 'replacement' }]) for (const dirty of [false, true]) {
    check(() => {
      const input = { visit, dirty, busy: false, uncertain: false }, before = JSON.stringify(input);
      const result = routineSaveStatus(input);
      assert.equal(JSON.stringify(input), before); assert.deepEqual(Object.keys(result).sort(), ['destination', 'device', 'entries', 'record']);
      assert.ok(Object.values(result).every(x => typeof x === 'string' && x.trim()));
      assert.doesNotMatch(JSON.stringify(result), /replacement/);
    }, 'Display projection is nonmutating and preserves separation ' + (visit?.state ?? 'none') + ' dirty=' + dirty);
  }
  mkdirSync('tests/reports', { recursive: true });
  const report = { suite: 'Connected routine lifecycle save-state contract', passed: checks.length, failed: 0, checks, completedAt: new Date().toISOString(), limits: 'Presentation contract only, not formal cancellation/destination/device/UAT acceptance.' };
  writeFileSync('tests/reports/routine-save-status-contract-result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { rmSync(dir, { recursive: true, force: true }); }
