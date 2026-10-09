import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir = mkdtempSync(join(process.cwd(), '.worker-day-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const name of ['worker-day', 'worklist-views', 'referral-rules']) {
    const text = ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, name + '.mjs'), text.replace(/from '(\.\/[^']+)\.js'/g, "from '$1.mjs'"));
  }
  const { workerDayEnabled: enabled, workerDayRecords: records } = await import(pathToFileURL(join(dir, 'worker-day.mjs')));
  const { visitCompare } = await import(pathToFileURL(join(dir, 'worklist-views.mjs')));
  const person = (id, name, more = {}) => ({ id, name, assigned: true, due: 'Today', status: 'due', ...more });
  const data = { role: 'asha', membership: { status: 'active' }, environment: 'synthetic', people: [person('b', 'Meena'), person('a', 'Meena'), person('z', 'Hidden', { assigned: false }), person('c', 'Closed', { status: 'completed' }), person('d', 'Merged', { mergedInto: { personId: 'a' } })] };
  check(() => assert.equal(enabled(true, true, data), true));
  check(() => assert.equal(enabled(false, true, data), false));
  check(() => assert.equal(enabled(true, false, data), false));
  check(() => assert.equal(enabled(true, true, null), false));
  check(() => assert.equal(enabled(true, true, { ...data, role: 'clinician' }), false));
  check(() => assert.equal(enabled(true, true, { ...data, membership: { status: 'suspended' } }), false));
  for (const environment of ['staging', 'production', 'misconfigured']) check(() => assert.equal(enabled(true, true, { ...data, environment }), false));
  check(() => assert.equal(enabled(true, true, { ...data, environment: 'training' }), true));
  check(() => assert.equal(records({ ...data, patientPaging: { total: 400 } }), null));
  check(() => assert.deepEqual(records({ ...data, people: [] }), []));
  const original = JSON.stringify(data);
  check(() => assert.deepEqual(records(data).map(p => p.id), ['a', 'b', 'c']));
  check(() => assert.deepEqual(records(data), data.people.filter(p => p.assigned && !p.mergedInto).sort(visitCompare)));
  check(() => assert.equal(JSON.stringify(data), original));
  check(() => assert.equal(records({ ...data, environment: 'production' }), null));
  console.log(JSON.stringify({ passed, failed: 0, scope: 'Pure presentation contract; not server authorisation, browser or physical-device qualification.' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
