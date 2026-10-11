// Bounded actual build/native supervisor. No native result is inferred from prepared source.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, writeFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256, runOwnedCommand } from '../tests/lib/routine-retention/containment.mjs';

assert.equal(process.env.SAHA_ROUTINE_METRIC_RELEASE, 'root-reviewed-routine-native-lane-released', 'Root source review + explicit owned heavy lease required.');
const port = Number(process.env.SAHA_ROUTINE_METRIC_PORT);
assert.ok(Number.isSafeInteger(port) && port > 1024 && port < 65536, 'No implicit port allocation.');
assert.ok(process.env.SAHA_ROUTINE_METRIC_OUTPUT);
const folder = resolve(process.env.SAHA_ROUTINE_METRIC_OUTPUT);
assert.equal(existsSync(folder), false, 'Preserve prior attempts; choose a new exact attempt directory.');
mkdirSync(folder, { recursive: true });
const nativeFolder = join(folder, 'native-evidence'), state = join(folder, 'owned-d1-state');
mkdirSync(nativeFolder);
const write = (path, object) => writeFileSync(path, JSON.stringify(object, null, 2) + '\n', { flag: 'wx' });
const receipt = { startedAt: new Date().toISOString(), supervisorPid: process.pid, port, state,
  status: 'preparing exact source', commands: [], cancelled: false, failures: [], formalAcceptanceClaim: false };
const checkpoint = () => writeFileSync(join(folder, 'runner-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
const cancellation = new AbortController();
const cancel = signal => { receipt.cancelled = true; receipt.cancellationSignal = signal;
  try { checkpoint(); } catch (error) { receipt.failures.push({ phase: 'cancellation evidence', message: String(error.message) }); }
  cancellation.abort(new Error(`Owned supervisor cancelled by ${signal}`)); };
const term = () => cancel('SIGTERM'), interrupt = () => cancel('SIGINT');
process.on('SIGTERM', term); process.on('SIGINT', interrupt);
const external = ["tests/lib/routine-retention/containment.mjs", "tests/lib/routine-retention/native-runtime.mjs", "tests/lib/routine-retention/transport.mjs", "tests/lib/routine-retention/native-driver.mjs", "scripts/routine-retention-runner.mjs", "tests/integration/routine-telemetry-retention-http.mjs"].map(file => resolve(file));
const walk = dir => readdirSync(dir).sort().flatMap(name => {
  const path = join(dir, name), stat = lstatSync(path); assert.equal(stat.isSymbolicLink(), false);
  return stat.isDirectory() ? walk(path) : [path];
});
let sourceFiles;
const inputs = () => Object.fromEntries(sourceFiles.map(file => [file, sha256(readFileSync(file))]));
const distPins = () => Object.fromEntries(walk('dist').map(file => [relative(process.cwd(), file), sha256(readFileSync(file))]));
const packages = () => {
  const require = createRequire(realpathSync('node_modules/wrangler/package.json'));
  const files = { wrangler: realpathSync('node_modules/wrangler/package.json'), miniflare: require.resolve('miniflare/package.json'), workerd: require.resolve('workerd/package.json'),
    react: resolve('node_modules/react/package.json'), reactDom: resolve('node_modules/react-dom/package.json'), rsc: resolve('node_modules/react-server-dom-webpack/package.json') };
  return Object.fromEntries(Object.entries(files).map(([name, path]) => { const value = JSON.parse(readFileSync(path, 'utf8')); return [name, { path, name: value.name, version: value.version, sha256: sha256(readFileSync(path)) }]; }));
};
const { readExecutionProfile } = await import(pathToFileURL(resolve('scripts/execution-profile.mjs')).href);
const executionProfileFile = resolve('.sites-runtime/execution-profile.json');
const captureExecutionProfile = () => ({ file: executionProfileFile, present: existsSync(executionProfileFile),
  sha256: existsSync(executionProfileFile) ? sha256(readFileSync(executionProfileFile)) : null,
  effectiveProfile: readExecutionProfile() });
const scenarioIds = ['foreign-get-query', 'foreign-post-query', 'foreign-get-header', 'foreign-post-header', 'suspended-get', 'suspended-post', 'anonymous-foreign-get', 'own-get', 'own-post-invalid'];
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' });
try {
  checkpoint();
  receipt.status = 'enumerating complete tracked source'; checkpoint();
  const trackedSourceNames = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' });
  const trackedFiles = trackedSourceNames.split('\0').filter(Boolean);
  sourceFiles = [...new Set([...trackedFiles.map(file => resolve(file)), ...external,
    ...(existsSync('.sites-runtime/execution-profile.json') ? [resolve('.sites-runtime/execution-profile.json')] : [])])].sort();
  receipt.trackedSourceEnumeration = { fileNames: trackedFiles.length, bytes: Buffer.byteLength(trackedSourceNames, 'utf8'), sha256: sha256(trackedSourceNames) };
  receipt.recordedInputFileCount = sourceFiles.length;
  receipt.sourceEnumerationBounds = { maxBufferBytes: 16 * 1024 * 1024, timeoutMs: 20000, killSignal: 'SIGKILL', exclusionOrTruncation: false };
  checkpoint();
  const sourceHead = git(['rev-parse', 'HEAD']).trim(), sourceTree = git(['rev-parse', 'HEAD^{tree}']).trim();
  receipt.sourceHead = sourceHead; receipt.sourceTree = sourceTree;
  const beforeInputs = inputs(), beforePackages = packages(), beforeProfile = captureExecutionProfile();
  assert.equal(beforeProfile.effectiveProfile, 'portable', 'Only the declared portable build profile is qualified.');
  const workingTreeBefore = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  receipt.beforeInputs = beforeInputs; receipt.beforePackages = beforePackages; receipt.beforeProfile = beforeProfile; checkpoint();
  receipt.status = 'fresh canonical build running'; checkpoint();
  const buildCommand = await runOwnedCommand('npm', ['run', 'build'], {
    cwd: process.cwd(), env: process.env, stdout: join(folder, 'build.stdout.log'), stderr: join(folder, 'build.stderr.log'),
    timeoutMs: 240000, graceMs: 5000, abortSignal: cancellation.signal,
    onSpawn: handle => { receipt.buildHandle = handle; checkpoint(); },
  });
  receipt.commands.push(buildCommand); checkpoint(); assert.equal(buildCommand.ok, true, 'Actual canonical build must succeed and its owned group be observed empty.');
  const afterInputs = inputs(), afterPackages = packages(), afterProfile = captureExecutionProfile();
  assert.equal(afterProfile.effectiveProfile, 'portable');
  assert.deepEqual(afterProfile, beforeProfile, 'Execution profile presence/content/effective selection changed during build.');
  assert.deepEqual(afterInputs, beforeInputs, 'Complete recorded source inputs changed during build.');
  assert.deepEqual(afterPackages, beforePackages, 'Selected actual native/framework package identities changed during build.');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }), workingTreeBefore);
  assert.equal(git(['rev-parse', 'HEAD']).trim(), sourceHead, 'Recorded Git head changed.');
  assert.equal(git(['rev-parse', 'HEAD^{tree}']).trim(), sourceTree, 'Recorded Git tree changed.');
  const dist = distPins(); assert.ok(existsSync('dist/server/wrangler.json'));
  const compilerReceipts = Object.fromEntries(walk('.sites-runtime/bundle-provenance').map(file => [relative(process.cwd(), file), sha256(readFileSync(file))]));
  assert.ok(Object.keys(compilerReceipts).length > 0);
  const association = { status: 'actual canonical build completed with unchanged complete recorded inputs', recordedAt: new Date().toISOString(),
    sourceHead, sourceTree, workingTreeBefore, beforeInputs, afterInputs, beforePackages, afterPackages, beforeProfile, afterProfile,
    dist, buildCommand, compilerReceipts,
    formalAcceptanceClaim: false };
  const associationFile = join(folder, 'actual-build-association.json'); write(associationFile, association);
  receipt.buildAssociation = { file: associationFile, sha256: sha256(readFileSync(associationFile)) };
  receipt.status = 'actual native nine-case driver running'; checkpoint();
  const nativeCommand = await runOwnedCommand(process.execPath, [resolve('tests/lib/routine-retention/native-driver.mjs')], {
    cwd: process.cwd(), env: { ...process.env, SAHA_ROUTINE_METRIC_OUTPUT: nativeFolder, SAHA_ROUTINE_METRIC_STATE: state, SAHA_ROUTINE_METRIC_BUILD_ASSOCIATION: associationFile },
    stdout: join(folder, 'native.stdout.log'), stderr: join(folder, 'native.stderr.log'), timeoutMs: 300000, graceMs: 5000,
    abortSignal: cancellation.signal, onSpawn: handle => { receipt.nativeHandle = handle; checkpoint(); },
  });
  receipt.commands.push(nativeCommand); checkpoint();
  assert.equal(nativeCommand.ok, true, 'Actual native exit/log/cancellation/owned-group cleanup must all succeed.');
  const result = JSON.parse(readFileSync(join(nativeFolder, 'result.json'), 'utf8'));
  assert.ok(Number.isInteger(result.passed) && Number.isInteger(result.failed) && Number.isInteger(result.skipped));
  assert.equal(result.failed, 0); assert.equal(result.skipped, 0); assert.equal(result.checks.length, result.passed);
  assert.ok(result.checks.every(check => check.ok === true));
  for (const id of scenarioIds) {
    assert.equal(result.checks.filter(check => check.label === id + ' exact real HTTP status' && check.ok === true).length, 1);
  }
  assert.equal(result.completedScenarios, 9); assert.equal(result.actualBuiltRoutineHttp, true); assert.equal(result.actualNativeD1, true);
  assert.equal(result.cleanup.miniflareDisposed, true); assert.equal(result.cleanup.ownedStateRetained, true); assert.equal(result.cleanup.portFree, true);
  assert.equal(result.unexpectedOutbound, 0); assert.deepEqual(result.custodyErrors, []); assert.equal(result.terminalFailure, null); assert.equal(result.formalAcceptanceClaim, false);
  assert.deepEqual(inputs(), beforeInputs); assert.deepEqual(packages(), beforePackages); assert.deepEqual(distPins(), dist);
  const finalProfile = captureExecutionProfile(); assert.equal(finalProfile.effectiveProfile, 'portable');
  assert.deepEqual(finalProfile, beforeProfile, 'Execution profile presence/content/effective selection changed during native execution.');
  receipt.finalProfile = finalProfile;
  assert.equal(git(['rev-parse', 'HEAD']).trim(), sourceHead, 'Recorded Git head changed.');
  assert.equal(git(['rev-parse', 'HEAD^{tree}']).trim(), sourceTree, 'Recorded Git tree changed.');
  assert.equal(sha256(readFileSync(associationFile)), receipt.buildAssociation.sha256);
  assert.deepEqual(Object.fromEntries(walk('.sites-runtime/bundle-provenance').map(file => [relative(process.cwd(), file), sha256(readFileSync(file))])), compilerReceipts);
  assert.equal(receipt.cancelled, false);
  receipt.status = 'actual native guard qualification passed'; receipt.result = { file: join(nativeFolder, 'result.json'), sha256: sha256(readFileSync(join(nativeFolder, 'result.json'))),
    passed: result.passed, failed: result.failed, skipped: result.skipped, completedScenarios: result.completedScenarios };
  checkpoint(); write(join(folder, 'qualified-result.json'), receipt);
} catch (error) {
  const failurePhase = receipt.status; receipt.status = 'FAILED';
  receipt.failures.push({ phase: failurePhase, name: error.name, code: error.code ?? null, signal: error.signal ?? null,
    commandExitStatus: error.status ?? null, message: String(error.message), stack: String(error.stack) });
  try { checkpoint(); } catch (writeError) { console.error('Actual runner evidence write failed after owned command cleanup:', writeError); }
  throw error;
} finally {
  // All command-specific failures clean only their registered owned group before returning here.
  process.off('SIGTERM', term); process.off('SIGINT', interrupt);
}
