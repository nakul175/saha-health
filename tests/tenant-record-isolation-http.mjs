// APL-763 bounded supervisor for the real synthetic native tenant matrix.
// Existing CI supplies its canonical build. This entry neither builds nor substitutes HTTP responses.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, createConnection } from 'node:net';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deadline, runOwnedCommand, sourceCheckoutPins, fileTreePins, sha256 } from './lib/tenant-record-containment.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url))); process.chdir(root);
const expectedIds = Array.from({ length: 13 }, (_, i) => `TI-C${String(i + 1).padStart(2, '0')}`);
const ownFiles = ['tests/tenant-record-isolation-http.mjs', 'tests/integration/tenant-record-isolation-native.mjs',
  'tests/lib/tenant-record-isolation-prepared.mjs', 'tests/lib/tenant-record-transport.mjs',
  'tests/lib/tenant-record-containment.mjs', 'tests/lib/tenant-record-native-runtime.mjs',
  'docs/current/tenant-isolation-preparation/SPECIFICATION.json'];
const runId = randomUUID(), resultRoot = resolve('tests/reports/tenant-record-isolation-http'), out = join(resultRoot, runId);
mkdirSync(resultRoot, { recursive: true }); mkdirSync(out);
const stable = join(resultRoot, 'result.json'), nativeEvidence = join(out, 'native'), state = resolve('.wrangler', `tenant-record-isolation-${runId}-state`);
if (existsSync(stable)) writeFileSync(join(out, 'prior-result.json'), readFileSync(stable));
const report = { suite: 'integration/tenant-record-isolation-http', runId, status: 'running',
  countKind: 'actual-assertion-calls', assertionCount: 0, passed: 0, failed: 0, skipped: 0,
  assertionScope: 'Actual native driver own ledger; supervisor validation/error records are separate, never invented assertions.',
  scenarioCountKind: 'executed-scenarios', expectedCaseIds: expectedIds, caseIds: [], caseCount: 0,
  terminalCaseCount: 0, scenarioPassed: 0, scenarioFailed: 0, errors: [], commands: [],
  evidenceDirectory: out, state, formalAcceptance: 'Not run; full APL-150/APL-763 and hosted/RLS surfaces remain open.' };
const checkpoint = () => { const data = JSON.stringify(report, null, 2) + '\n'; writeFileSync(join(out, 'result.json'), data); writeFileSync(stable, data); };
checkpoint(); // Invalidate any old pass before setup, without discarding it.
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data, null, 2) + '\n');
const allocatePort = () => deadline('supervisor loopback port allocation', () => new Promise((done, failed) => {
  const server = createServer(); server.once('error', failed);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? failed(error) : done(port)); });
}), 2000);
const portFree = port => deadline('supervisor final loopback custody', () => new Promise(done => {
  const connection = createConnection(port, '127.0.0.1');
  connection.setTimeout(1000); const finish = value => { connection.destroy(); done(value); };
  connection.once('connect', () => finish(false)); connection.once('error', () => finish(true)); connection.once('timeout', () => finish(false));
}), 2000);
const cancellation = new AbortController();
const cancel = signal => {
  report.cancellationSignals ??= []; report.cancellationSignals.push({ signal, at: new Date().toISOString() });
  try { checkpoint(); } catch (error) { report.errors.push({ phase: 'cancellation-journal', error: String(error.stack ?? error) }); }
  cancellation.abort(new Error(`Tenant supervisor received ${signal}`)); process.exitCode = 1;
};
const onTerm = () => cancel('SIGTERM'), onInt = () => cancel('SIGINT');
process.on('SIGTERM', onTerm); process.on('SIGINT', onInt);
let before, distBefore, port;
try {
  assert.ok(existsSync('dist/server/wrangler.json'), 'Existing canonical CI build is required.');
  assert.equal(existsSync(state), false, 'Never remove or reuse existing native D1 state.');
  report.phase = 'pre-runtime complete source/build custody'; checkpoint();
  before = sourceCheckoutPins(ownFiles); distBefore = fileTreePins('dist');
  write('supervisor-source-build-before.json', { source: before, dist: distBefore });
  const spec = JSON.parse(readFileSync('docs/current/tenant-isolation-preparation/SPECIFICATION.json', 'utf8'));
  assert.deepEqual(spec.cases.map(entry => entry.id), expectedIds);
  for (const pin of [spec.testModulePin, spec.nativeRunnerPin, ...Object.values(spec.executionSourcePins ?? {})]) {
    assert.ok(pin?.path && pin?.sha256); assert.equal(sha256(readFileSync(pin.path)), pin.sha256, `Reviewed test source differs: ${pin.path}`);
  }
  report.phase = 'allocating owned loopback port'; checkpoint();
  port = await allocatePort(); report.port = port; report.phase = 'contained native attempt'; checkpoint();
  report.nativeCommand = await runOwnedCommand(process.execPath, ['tests/integration/tenant-record-isolation-native.mjs'], {
    cwd: root, timeoutMs: 300000, graceMs: 5000,
    stdout: join(out, 'native.stdout.log'), stderr: join(out, 'native.stderr.log'), abortSignal: cancellation.signal,
    env: { ...process.env, SAHA_TENANT_DRIVER_OWNER: 'root-reviewed-tenant-driver-in-owned-process-group', SAHA_TENANT_RUN_ID: runId,
      SAHA_TENANT_NATIVE_PORT: String(port), SAHA_TENANT_NATIVE_STATE: state, SAHA_TENANT_NATIVE_EVIDENCE: nativeEvidence },
    onSpawn: handle => { report.commands.push({ phase: 'native tenant driver', ...handle }); checkpoint(); },
  });
  checkpoint();
  const nativeResultFile = join(nativeEvidence, 'result.json');
  if (existsSync(nativeResultFile)) {
    const actualBytes = readFileSync(nativeResultFile), native = JSON.parse(actualBytes);
    writeFileSync(join(out, 'retained-native-result.json'), actualBytes);
    report.nativeResult = { file: nativeResultFile, sha256: sha256(actualBytes) };
    for (const field of ['passed', 'failed', 'skipped', 'assertionCount', 'caseIds', 'caseCount', 'terminalCaseCount', 'scenarioPassed', 'scenarioFailed']) report[field] = native[field];
    checkpoint();
    assert.equal(native.countKind, 'actual-assertion-calls');
    for (const key of ['passed', 'failed', 'skipped', 'assertionCount']) assert.ok(Number.isInteger(native[key]) && native[key] >= 0, `Missing truthful count ${key}`);
    assert.equal(native.assertionCount, native.passed + native.failed); assert.equal(native.failed, 0); assert.equal(native.skipped, 0);
    assert.deepEqual(native.caseIds, expectedIds); assert.equal(new Set(native.caseIds).size, 13);
    assert.equal(native.caseCount, 13); assert.equal(native.terminalCaseCount, 13); assert.equal(native.scenarioPassed, 13); assert.equal(native.scenarioFailed, 0);
    assert.equal(native.status, 'passed'); assert.equal(native.caseGuardPassed, true); assert.equal(native.sourceBuildCustodyPassed, true);
    assert.equal(native.runtimeDisposed, true); assert.equal(native.ownedPortFree, true); assert.deepEqual(native.errors, []);
    assert.equal(native.nativeLifecycle?.ready, true); assert.equal(native.nativeLifecycle?.disposed, true);
    assert.equal(native.nativeLifecycle?.migration?.ok, true); assert.equal(native.nativeLifecycle?.migrationDriverGroupMatched, true);
    assert.deepEqual(native.nativeLifecycle?.migrationDescendantsAfterExit, []); report.nativeGuardPassed = true;
  } else throw new Error('Native setup/execution produced no retained terminal result.');
  assert.equal(report.nativeCommand.ok, true, 'Actual child exit, deadline, cancellation, output and owned group disposal must all pass.');
  assert.deepEqual(report.nativeCommand.liveGroupAfterCleanup, []); report.ownedGroupDisposalPassed = true;
  assert.equal(cancellation.signal.aborted, false, 'A cancelled supervisor never qualifies.');
} catch (error) { report.errors.push({ phase: report.phase ?? 'bounded-supervisor', code: error.code ?? null,
  signal: error.signal ?? null, commandExitStatus: error.status ?? null, error: String(error.stack ?? error) }); }
finally {
  if (port) try { report.ownedPortFree = await portFree(port); assert.equal(report.ownedPortFree, true); }
  catch (error) { report.errors.push({ phase: 'owned-port-custody', error: String(error.stack ?? error) }); }
  if (before) try {
    const after = sourceCheckoutPins(ownFiles), distAfter = fileTreePins('dist'); write('supervisor-source-build-after.json', { source: after, dist: distAfter });
    assert.deepEqual(after, before, 'Source/selection changed during the contained native attempt.'); assert.deepEqual(distAfter, distBefore, 'Built application changed during the contained native attempt.');
    report.sourceBuildCustodyPassed = true;
  } catch (error) { report.errors.push({ phase: 'source-build-custody', error: String(error.stack ?? error) }); }
  report.status = report.nativeGuardPassed && report.ownedGroupDisposalPassed && report.sourceBuildCustodyPassed && report.ownedPortFree && !report.errors.length && !cancellation.signal.aborted ? 'passed' : 'failed';
  report.completedAt = new Date().toISOString(); checkpoint();
  process.removeListener('SIGTERM', onTerm); process.removeListener('SIGINT', onInt);
  process.exitCode = report.status === 'passed' ? 0 : 1;
  console.log(JSON.stringify({ suite: report.suite, status: report.status, countKind: report.countKind, passed: report.passed, failed: report.failed, skipped: report.skipped,
    assertionCount: report.assertionCount, scenarioCountKind: report.scenarioCountKind, caseCount: report.caseCount, terminalCaseCount: report.terminalCaseCount,
    scenarioPassed: report.scenarioPassed, scenarioFailed: report.scenarioFailed, caseIds: report.caseIds, errorCount: report.errors.length, evidenceDirectory: out }));
}
