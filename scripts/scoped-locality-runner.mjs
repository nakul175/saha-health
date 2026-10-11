// APL-194 additive guarded entry. This runner creates evidence from an actual fresh
// canonical build, never from a caller-authored success assertion or reused dist.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { runOwnedCommand, sourceCheckoutPins, fileTreePins, sha256, validateLocalityResult } from '../tests/lib/scoped-locality-containment.mjs';

export const RELEASE = 'root-scoped-locality-contract-reviewed-native-lane-released';
export const DEFAULT_RESULT = 'tests/reports/scoped-locality-native-current.json';
const OWN_FILES = ['scripts/scoped-locality-runner.mjs', 'tests/scoped-locality-native-current.mjs', 'tests/scoped-locality-containment-contract.mjs', 'tests/lib/scoped-locality-containment.mjs', 'tests/lib/scoped-locality-native-runtime.mjs', 'tests/integration/scoped-locality-policy-http.mjs', 'docs/current/saha-011/POLICY-AXIS-MATRIX.json', 'docs/current/saha-011/SPECIFICATION.md', '.github/workflows/scoped-permission-checks.yml'];
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const diff = (a, b) => Object.keys({ ...a, ...b }).filter(file => a[file] !== b[file]);

function installedPackages() {
  // Read the actual installed package consumed by Wrangler, not a lexically selected
  // pnpm-store candidate. Full lock and package manifest hashes are also source inputs.
  const require = createRequire(realpathSync(resolve('node_modules/wrangler/package.json')));
  return Object.fromEntries(['wrangler', 'miniflare', 'workerd'].map(name => {
    const file = name === 'wrangler' ? realpathSync('node_modules/wrangler/package.json') : require.resolve(`${name}/package.json`);
    const bytes = readFileSync(file), pkg = JSON.parse(bytes);
    return [name, { version: pkg.version, packageJsonSha256: sha256(bytes), resolvedPackageJson: file }];
  }));
}

export async function runScopedLocality() {
  assert.equal(process.env.SAHA_SCOPED_LOCALITY_RELEASE, RELEASE, 'Root-reviewed source and exclusive local allocation (or isolated CI job) are required.');
  const port = Number(process.env.SAHA_TEST_PORT);
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536, 'An explicit allocated loopback port is required.');
  const output = resolve(process.env.SAHA_SCOPED_LOCALITY_RUN_EVIDENCE ?? 'tests/reports/scoped-locality-native-run');
  const resultFile = resolve(process.env.SAHA_SCOPED_LOCALITY_RESULT ?? DEFAULT_RESULT);
  const state = resolve(process.env.SAHA_SCOPED_LOCALITY_STATE ?? join(output, 'fresh-state'));
  assert.equal(existsSync(output), false, 'Never overwrite an earlier attempt.');
  assert.equal(existsSync(resultFile), false, 'Never overwrite an earlier result.');
  assert.equal(existsSync(state), false, 'Never remove or reuse another native database.');
  assert.equal(existsSync('dist'), false, 'This guarded entry requires a fresh checkout without dist; it does not reuse or delete a build.');
  mkdirSync(output, { recursive: true });
  const receipt = { kind: 'actual scoped-locality launcher attempt', startedAt: new Date().toISOString(), ownerPid: process.pid, node: process.version, platform: process.platform, architecture: process.arch, port, output, state, resultFile, commands: [], errors: [], formalAcceptanceClaim: false, status: 'started' };
  const checkpoint = () => writeFileSync(join(output, 'runner-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  checkpoint(); // Log paths and process metadata exist before waiting for any child.
  const cancellation = new AbortController();
  const cancel = signal => {
    receipt.cancellationSignals ??= []; receipt.cancellationSignals.push({ signal, at: new Date().toISOString() });
    try { checkpoint(); } catch (error) { receipt.errors.push({ name: error.name, message: `cancellation journal: ${String(error.message)}` }); }
    cancellation.abort(new Error(`Supervisor received ${signal}`)); process.exitCode = 1;
  };
  const sigterm = () => cancel('SIGTERM'), sigint = () => cancel('SIGINT');
  // Keep handling repeated signals until registered child-group cleanup has finished.
  process.on('SIGTERM', sigterm); process.on('SIGINT', sigint);
  try {
    const matrixFile = 'docs/current/saha-011/POLICY-AXIS-MATRIX.json';
    const matrix = JSON.parse(readFileSync(matrixFile, 'utf8'));
    const before = sourceCheckoutPins(OWN_FILES);
    const selected = Object.fromEntries(Object.entries(matrix.sourcePins).map(([file, pin]) => { const actual = sha256(readFileSync(file)); assert.equal(actual, pin.sha256, `Reviewed policy/source changed: ${file}; review and rebind before running.`); return [file, actual]; }));
    receipt.checkoutCommit = before.checkoutCommit; receipt.checkoutTree = before.checkoutTree; receipt.policyBaselineCommit = matrix.sourceCommit;
    receipt.installedPackages = installedPackages();
    receipt.build = await runOwnedCommand('npm', ['run', 'build'], {
      stdout: join(output, 'build.stdout.log'), stderr: join(output, 'build.stderr.log'), timeoutMs: 240000, graceMs: 5000,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      abortSignal: cancellation.signal,
      onSpawn: handle => { receipt.commands.push({ phase: 'fresh canonical build', ...handle }); checkpoint(); },
    });
    checkpoint(); assert.equal(receipt.build.ok, true, 'Canonical build must actually exit zero with no signal/timeout/log error/live owned descendants.');
    const after = sourceCheckoutPins(OWN_FILES);
    assert.deepEqual(after, before, 'The actual complete checkout inputs changed while building.');
    assert.deepEqual(installedPackages(), receipt.installedPackages, 'The actual installed runtime package identities changed while building.');
    assert.ok(existsSync('dist/server/wrangler.json'), 'Canonical build did not produce its native configuration.');
    const distPins = fileTreePins('dist');
    const associationFile = join(output, 'actual-build-association.json');
    const association = { kind: 'observed canonical build association; not approval', recordedAt: new Date().toISOString(), policyBaselineCommit: matrix.sourceCommit, checkoutCommit: before.checkoutCommit, checkoutTree: before.checkoutTree, sourcePins: selected, inputBefore: before, inputAfter: after, installedPackages: receipt.installedPackages, distPins, command: receipt.build, formalAcceptanceClaim: false };
    write(associationFile, association);
    receipt.buildAssociation = { file: associationFile, sha256: sha256(readFileSync(associationFile)) };
    const nativeEvidence = join(output, 'native');
    receipt.native = await runOwnedCommand(process.execPath, ['tests/integration/scoped-locality-policy-http.mjs'], {
      stdout: join(output, 'native.stdout.log'), stderr: join(output, 'native.stderr.log'), timeoutMs: 210000, graceMs: 5000,
      env: { ...process.env, SAHA_TEST_PORT: String(port), SAHA_SCOPED_LOCALITY_STATE: state, SAHA_SCOPED_LOCALITY_EVIDENCE: nativeEvidence, SAHA_SCOPED_LOCALITY_BUILD_RECEIPT: associationFile, SAHA_SCOPED_LOCALITY_BUILD_RECEIPT_SHA256: receipt.buildAssociation.sha256 },
      abortSignal: cancellation.signal,
      onSpawn: handle => { receipt.commands.push({ phase: 'contained native locality driver', ...handle }); checkpoint(); },
    });
    checkpoint(); assert.equal(receipt.native.ok, true, 'Native driver must actually exit zero and leave no live process in its registered own group.');
    const actual = JSON.parse(readFileSync(join(nativeEvidence, 'result.json'), 'utf8'));
    const passed = validateLocalityResult(actual);
    assert.deepEqual(sourceCheckoutPins(OWN_FILES), before, 'Source inputs changed during native execution.');
    assert.deepEqual(fileTreePins('dist'), distPins, 'Built application changed during native execution.');
    assert.deepEqual(installedPackages(), receipt.installedPackages, 'Installed runtime package identities changed during native execution.');
    assert.equal(sha256(readFileSync(associationFile)), receipt.buildAssociation.sha256, 'Observed build association changed during execution.');
    assert.equal(cancellation.signal.aborted, false, 'A cancelled supervisor cannot publish a passing report.');
    receipt.status = 'bounded native test passed'; receipt.completedAt = new Date().toISOString(); checkpoint();
    mkdirSync(resolve(resultFile, '..'), { recursive: true });
    write(resultFile, { ...actual, suite: 'Scoped locality native current (APL-194)', passed, runnerReceipt: join(output, 'runner-receipt.json'), runnerReceiptSha256: sha256(readFileSync(join(output, 'runner-receipt.json'))), actualCheckoutCommit: before.checkoutCommit, actualCheckoutTree: before.checkoutTree, policyBaselineCommit: matrix.sourceCommit, scope: 'Eight existing locality groups only; no full-parent, hosted, physical or formal acceptance.' });
    console.log(JSON.stringify({ suite: 'Scoped locality native current (APL-194)', passed, failed: 0, skipped: 0, actualCheckoutCommit: before.checkoutCommit }));
  } catch (error) {
    receipt.errors.push({ name: error.name, message: String(error.message), ...(error.gitObservation ? { gitObservation: error.gitObservation } : {}) }); receipt.status = 'failed'; receipt.completedAt = new Date().toISOString(); checkpoint();
    // Preserve any real child result unchanged. A setup/timeout/custody failure is a
    // launcher failure and cannot be converted into a counted native scenario pass.
    throw error;
  } finally {
    process.removeListener('SIGTERM', sigterm); process.removeListener('SIGINT', sigint);
  }
}
