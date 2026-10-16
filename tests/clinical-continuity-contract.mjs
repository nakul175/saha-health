import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

let passed = 0;
const check = (fn) => { fn(); passed++; };
const source = readFileSync('lib/saha/clinical-continuity.ts', 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'saha-continuity-'));
const out = join(dir, 'clinical-continuity.mjs');
writeFileSync(out, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { clinicalContinuity } = await import(out);

const local = { id: 'local', name: 'Local record assistant', mode: 'local', model: 'rules', version: 1, available: true, reason: 'Rules only.' };
const unavailable = { id: 'external', name: 'External assistant', mode: 'openai', model: 'fixed', version: 1, available: false, reason: 'Provider unavailable.' };
const draft = { state: 'draft', programmeCapture: { packs: [{ enrolmentId: 'synthetic', pack: { name: 'Synthetic pinned pack', version: 4 } }], answers: {}, absence: {} } };
const before = JSON.stringify(draft);
const outage = clinicalContinuity([local, unavailable], draft);

check(() => assert.equal(outage.assistance, 'unavailable'));
check(() => assert.deepEqual(outage.unavailable, [{ id: 'external', name: 'External assistant', reason: 'Provider unavailable.' }]));
check(() => assert.equal(outage.items.find(x => x.id === 'capture')?.available, true));
check(() => assert.match(outage.items.find(x => x.id === 'capture')?.detail ?? '', /does not wait for an assistant/));
check(() => assert.match(outage.items.find(x => x.id === 'protocol')?.detail ?? '', /Synthetic pinned pack version 4/));
check(() => assert.equal(outage.items.find(x => x.id === 'referral')?.available, true));
check(() => assert.equal(outage.items.find(x => x.id === 'urgent-work')?.available, true));
check(() => assert.match(outage.notice, /No AI result was created/));
check(() => assert.equal(JSON.stringify(draft), before, 'continuity inspection has no record side effect'));

const noPack = clinicalContinuity([local, unavailable], { state: 'draft' });
check(() => assert.equal(noPack.items.find(x => x.id === 'protocol')?.available, false));
check(() => assert.match(noPack.items.find(x => x.id === 'protocol')?.detail ?? '', /does not invent guidance/));
const closed = clinicalContinuity([local, unavailable], { state: 'draft', supersededBy: 'next' });
check(() => assert.equal(closed.items.find(x => x.id === 'capture')?.available, false));
check(() => assert.equal(closed.items.find(x => x.id === 'referral')?.available, false));
const healthy = clinicalContinuity([local, { ...unavailable, available: true }], draft);
check(() => assert.equal(healthy.assistance, 'available'));

const ui = readFileSync('app/agent-panel.tsx', 'utf8');
check(() => assert.match(ui, /Assistant unavailable · manual workflow continues/));
check(() => assert.match(ui, /role="status"/));
check(() => assert.match(ui, /continuity\.items\.map/));

console.log(`${passed} clinical continuity checks passed`);
