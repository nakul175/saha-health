// BR-AI-03: existing evidence separated from clinical deployment; no provider/model command.
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runOwnedCommand } from '../lib/routine-retention/containment.mjs';
const out = resolve(process.env.SAHA_DEPLOY_REVIEW_OWNED_OUTPUT ?? 'tests/reports/deployment-evidence-review-owned-' + Date.now()); mkdirSync(out, { recursive: true });
const result = await runOwnedCommand(process.execPath, [resolve('tests/lib/deployment-evidence-review-browser-driver.mjs')], { cwd: process.cwd(), env: { ...process.env, SAHA_DEPLOY_REVIEW_NATIVE_OUTPUT: join(out, 'native') }, stdout: join(out, 'stdout.log'), stderr: join(out, 'stderr.log'), timeoutMs: 180000, graceMs: 10000, onSpawn: handle => writeFileSync(join(out, 'registered-handle.json'), JSON.stringify(handle, null, 2) + '\n', { flag: 'wx' }) });
writeFileSync(join(out, 'command.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
assert.equal(result.ok, true, 'Owned native driver and group must qualify.');
const observed = JSON.parse(readFileSync(join(out, 'native/result.json'))); assert.equal(observed.failed, 0); assert.equal(observed.skipped, 0);
console.log(JSON.stringify({ passed: observed.passed, failed: 0, skipped: 0, out }));
