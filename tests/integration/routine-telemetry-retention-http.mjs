// Publish only the actual native result after the owned build/runtime custody checks pass.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runOwnedCommand, sha256 } from '../lib/routine-retention/containment.mjs';

const reports = resolve('tests/reports');
mkdirSync(reports, { recursive: true });
const attempt = join(reports, `routine-telemetry-retention-${Date.now()}-${process.pid}`);
const canonical = join(reports, 'routine-telemetry-retention-result.json');
assert.equal(existsSync(attempt), false, 'Every native attempt must retain separate evidence.');
if (existsSync(canonical)) {
  copyFileSync(canonical, attempt + '-previous-result.json');
  unlinkSync(canonical);
}
const abort = new AbortController();
let command = null, ownedHandle = null, cancellationSignal = null;
const cancel = signal => { cancellationSignal = signal; abort.abort(new Error(`Routine retention suite cancelled: ${signal}`)); };
const term = () => cancel('SIGTERM'), interrupt = () => cancel('SIGINT');
process.on('SIGTERM', term); process.on('SIGINT', interrupt);
try {
  command = await runOwnedCommand(process.execPath, [resolve('scripts/routine-retention-runner.mjs')], {
    cwd: process.cwd(),
    env: { ...process.env, SAHA_ROUTINE_METRIC_RELEASE: 'root-reviewed-routine-native-lane-released',
      SAHA_ROUTINE_METRIC_PORT: process.env.SAHA_ROUTINE_METRIC_PORT ?? '21295', SAHA_ROUTINE_METRIC_OUTPUT: attempt },
    stdout: attempt + '-stdout.log', stderr: attempt + '-stderr.log',
    timeoutMs: 600000, graceMs: 10000, abortSignal: abort.signal,
    onSpawn: handle => { ownedHandle = handle; writeFileSync(attempt + '-wrapper-handle.json', JSON.stringify(handle, null, 2) + '\n', { flag: 'wx' }); },
  });
  writeFileSync(attempt + '-wrapper-command.json', JSON.stringify(command, null, 2) + '\n', { flag: 'wx' });
  assert.equal(command.ok, true, 'The owned canonical build and native qualification must exit successfully with no remaining owned processes.');
  assert.equal(abort.signal.aborted, false);
  const receiptFile = join(attempt, 'qualified-result.json');
  const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.status, 'actual native guard qualification passed');
  const nativeFile = join(attempt, 'native-evidence/result.json');
  const bytes = readFileSync(nativeFile);
  assert.equal(receipt.result.sha256, sha256(bytes), 'Canonical report must be the qualified current native result.');
  assert.equal(resolve(receipt.result.file), nativeFile);
  const result = JSON.parse(bytes);
  assert.equal(result.completedScenarios, 9);
  assert.equal(result.failed, 0); assert.equal(result.skipped, 0);
  assert.equal(result.checks.length, result.passed);
  assert.ok(result.checks.every(check => check.ok === true));
  writeFileSync(canonical, bytes, { flag: 'wx' });
  console.log(JSON.stringify({ suite: result.suite, passed: result.passed, failed: result.failed, skipped: result.skipped,
    completedAt: result.completedAt, attempt, qualifiedReceiptSHA256: sha256(readFileSync(receiptFile)) }));
} catch (error) {
  const failure = { at: new Date().toISOString(), attempt, name: error.name, message: String(error.message), stack: String(error.stack),
    command, ownedHandle, cancellationSignal, cancelled: abort.signal.aborted,
    passingCanonicalReportWritten: existsSync(canonical), formalAcceptanceClaim: false };
  writeFileSync(attempt + '-wrapper-failure.json', JSON.stringify(failure, null, 2) + '\n', { flag: 'wx' });
  throw error;
} finally {
  process.off('SIGTERM', term); process.off('SIGINT', interrupt);
}
