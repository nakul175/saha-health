// APL-763: actual synthetic cases, never a formal or hosted acceptance claim.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownedTenantRuntime } from '../lib/tenant-record-native-runtime.mjs';
import { deadline, inspectOwnedGroup } from '../lib/tenant-record-containment.mjs';
import { createTenantAssertionLedger, prepareTenantCollisionFixture, runTenantIsolationMatrix } from '../lib/tenant-record-isolation-prepared.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
process.chdir(root);
if (process.env.SAHA_TENANT_DRIVER_OWNER !== 'root-reviewed-tenant-driver-in-owned-process-group') throw new Error('Use the bounded tenant supervisor; direct native startup is refused');
const ledger = createTenantAssertionLedger(), assert = ledger.assertions;
const expectedIds = Array.from({ length: 13 }, (_, i) => `TI-C${String(i + 1).padStart(2, '0')}`);
const hash = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)).digest('hex');
const runId = process.env.SAHA_TENANT_RUN_ID, resultRoot = 'tests/reports/tenant-record-isolation-http', out = resolve(process.env.SAHA_TENANT_NATIVE_EVIDENCE ?? '');
if (!/^[a-f0-9-]{36}$/.test(runId ?? '') || !out.startsWith(resolve(resultRoot) + '/') || existsSync(out)) throw new Error('A fresh supervisor-owned native evidence directory and run UUID are required');
mkdirSync(resultRoot, { recursive: true }); mkdirSync(out);
mkdirSync(join(out, 'transport'));
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');
const report = { suite: 'integration/tenant-record-isolation-http', runId, countKind: 'actual-assertion-calls', scenarioCountKind: 'executed-scenarios',
  passed: 0, failed: 0, skipped: 0, assertionCount: 0, expectedCaseIds: expectedIds, caseIds: [], caseCount: 0, terminalCaseCount: 0, scenarioPassed: 0, scenarioFailed: 0,
  status: 'running', errors: [], formalAcceptance: 'Not run; full parent story and RLS/hosted surfaces remain open.',
  mode: process.env.GITHUB_ACTIONS === 'true' ? 'Existing isolated GitHub CI' : 'Owned synthetic local runtime',
  evidenceDirectory: out, setupCompleted: false, runtimeDisposed: false, ownedPortFree: false };
const checkpoint = () => {
  const measured = ledger.snapshot(); report.passed = measured.passed; report.failed = measured.failed; report.assertionCount = measured.assertionCount;
  save('assertion-ledger.json', measured); save('result.json', report); };
checkpoint(); // A stale prior pass can never survive a new setup failure.
const walk = dir => readdirSync(dir).sort().flatMap(name => {
  const file = join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file];
});
const filePins = files => Object.fromEntries(files.sort().map(file => {
  const bytes = readFileSync(file); return [relative(root, resolve(file)), { sha256: hash(bytes), bytes: bytes.length }];
}));
const metadataOptions = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' };
const custody = () => ({ source: filePins(execFileSync('git', ['ls-files', '-z'], metadataOptions).split('\0').filter(Boolean)),
  build: filePins(walk('dist')), gitHead: execFileSync('git', ['rev-parse', 'HEAD'], metadataOptions).trim(),
  limit: 'Observed source/build input custody, not a rebuild or cryptographic compiler attestation. Existing CI must supply the build step.' });
const portFree = port => new Promise(done => {
  const connection = createConnection(port, '127.0.0.1');
  connection.setTimeout(1000); const finish = free => { connection.destroy(); done(free); };
  connection.once('connect', () => finish(false)); connection.once('error', () => finish(true)); connection.once('timeout', () => finish(false));
});
const validateCases = matrix => {
  assert.equal(matrix.caseCount, 13, 'Exactly 13 declared scenarios must execute');
  assert.equal(matrix.cases.length, 13); assert.equal(new Set(matrix.cases.map(x => x.id)).size, 13);
  assert.deepEqual(matrix.cases.map(x => x.id), expectedIds, 'Missing, repeated, reordered or invented scenario');
  for (const entry of matrix.cases) {
    assert.ok(['passed', 'failed'].includes(entry.outcome), `Nonterminal scenario ${entry.id}`);
    for (const field of ['beforeProtectedSha256', 'afterProtectedSha256']) {
      assert.ok(matrix.stateObjects[entry[field]], `Missing protected witness ${entry.id}/${field}`);
      assert.equal(hash(matrix.stateObjects[entry[field]]), entry[field], 'Protected witness hash mismatch');
    }
    for (const field of ['beforeForeignAuditSha256', 'afterForeignAuditSha256']) {
      assert.ok(matrix.auditObjects[entry[field]], `Missing foreign audit witness ${entry.id}/${field}`);
      assert.equal(hash(matrix.auditObjects[entry[field]]), entry[field], 'Foreign audit witness hash mismatch');
    }
    assert.equal(entry.beforeProtectedSha256, entry.afterProtectedSha256, `Protected side effect ${entry.id}`);
    if (!['TI-C02', 'TI-C10'].includes(entry.id)) assert.equal(entry.beforeForeignAuditSha256, entry.afterForeignAuditSha256, `Foreign audit changed ${entry.id}`);
    assert.ok(entry.responses.length > 0, `No actual response retained for ${entry.id}`);
    for (const response of entry.responses) {
      assert.equal(hash(response.body), response.bodySha256, 'Response body hash mismatch');
      if (response.rawBytesSha256) assert.equal(hash(Buffer.from(response.rawBytesBase64, 'base64')), response.rawBytesSha256, 'Raw media byte hash mismatch');
      assert.ok(/(?:^|,)\s*no-store(?:\s*(?:,|$))/i.test(response.headers['cache-control'] ?? ''), 'Protected response missing no-store');
    }
    assert.equal(entry.outcome, 'passed', `Actual scenario failed ${entry.id}: ${entry.error ?? entry.sideEffectError ?? 'unknown'}`);
  }
  // Validate actual ledger states independently of helper aggregate counters.
  assert.equal(matrix.cases.filter(x => x.outcome === 'passed').length, 13);
  assert.equal(matrix.cases.filter(x => x.outcome === 'failed').length, 0);
  assert.equal(matrix.passed, 13); assert.equal(matrix.failed, 0); assert.equal(matrix.skipped, 0);
};

let runtime, db, before, port, state, leaseFile, leaseOwned = false;
try {
  assert.ok(existsSync('dist/server/wrangler.json'), 'Build must exist before this actual integration suite');
  const spec = JSON.parse(readFileSync('docs/current/tenant-isolation-preparation/SPECIFICATION.json', 'utf8'));
  assert.deepEqual(spec.cases.map(x => x.id), expectedIds);
  assert.equal(hash(readFileSync(spec.testModulePin.path)), spec.testModulePin.sha256, 'Prepared helper differs from reviewed contract');
  assert.equal(hash(readFileSync(spec.nativeRunnerPin.path)), spec.nativeRunnerPin.sha256, 'Native runner differs from reviewed contract');
  // Refuse unreviewed changes to the original identity/scoping/audit and D1 test mechanism.
  for (const [file, pin] of Object.entries(spec.sourcePins).filter(([file]) => file.startsWith('lib/') || file.startsWith('tests/lib/') || file.startsWith('requirements/') || file === 'tests/regression-baseline.json')) {
    assert.equal(hash(readFileSync(file)), pin.sha256, `Frozen authority/oracle input changed: ${file}`);
  }
  const initialGroup = inspectOwnedGroup(process.pid);
  assert.ok(initialGroup.rows.some(row => row.pid === process.pid && row.pgid === process.pid && !row.state.startsWith('Z')), 'Only the actual registered detached driver may start the native fixture');
  save('registered-native-group-before.json', initialGroup);
  before = custody(); save('source-build-before.json', before);
  port = Number(process.env.SAHA_TENANT_NATIVE_PORT);
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536, 'Use only the supervisor allocated loopback port');
  state = resolve(process.env.SAHA_TENANT_NATIVE_STATE ?? '');
  assert.equal(state, resolve('.wrangler', `tenant-record-isolation-${runId}-state`), 'Use only this supervisor-owned fresh state');
  assert.ok(!existsSync(state), 'Never reset an existing D1 state');
  mkdirSync('.wrangler', { recursive: true });
  leaseFile = resolve('.wrangler', `tenant-record-isolation-${runId}.lease.json`);
  const fd = openSync(leaseFile, 'wx'); leaseOwned = true;
  try { writeFileSync(fd, JSON.stringify({ runId, pid: process.pid, port, state, status: 'owned', startedAt: new Date().toISOString() }, null, 2) + '\n'); } finally { closeSync(fd); }
  report.ownedResources = { port, state: relative(root, state), lease: relative(root, leaseFile) }; checkpoint();
  assert.ok(await portFree(port), 'Allocated loopback port became occupied; no competing process may be stopped');
  runtime = ownedTenantRuntime({ port, state, evidence: out, bindings: { SAHA_EXTERNAL_APIS_ENABLED: 'false' } });
  await runtime.start();
  assert.equal(new URL(runtime.base).hostname, '127.0.0.1');
  db = await deadline('owned native D1 handle', () => runtime.mf.getD1Database('DB'), 10000);
  const fixture = await prepareTenantCollisionFixture({ base: runtime.base, db, syntheticOnly: true, assertions: assert,
    onEvidence: value => save('fixture-evidence.json', value),
    onTransportEvidence: value => save(`transport/${value.requestId}.json`, value) });
  report.setupCompleted = true; checkpoint();
  ledger.setPhase('scenarios');
  const matrix = await runTenantIsolationMatrix(fixture, { syntheticOnly: true, assertions: assert, onEvidence: value => {
    save('matrix-evidence.json', value);
    if (value.cases.length) ledger.setPhase(`scenario-${value.cases.at(-1).id}`);
    report.caseIds = value.cases.map(x => x.id); report.caseCount = value.cases.length;
    report.terminalCaseCount = value.cases.filter(x => ['passed', 'failed'].includes(x.outcome)).length;
    report.scenarioPassed = value.cases.filter(x => x.outcome === 'passed').length;
    report.scenarioFailed = value.cases.filter(x => x.outcome === 'failed').length; checkpoint();
  } });
  save('matrix-evidence.json', matrix);
  report.caseIds = matrix.cases.map(x => x.id); report.caseCount = matrix.cases.length;
  report.terminalCaseCount = matrix.cases.filter(x => ['passed', 'failed'].includes(x.outcome)).length;
  report.scenarioPassed = matrix.cases.filter(x => x.outcome === 'passed').length;
  report.scenarioFailed = matrix.cases.filter(x => x.outcome === 'failed').length;
  checkpoint(); ledger.setPhase('case-ledger-guard'); validateCases(matrix); report.caseGuardPassed = true;
} catch (error) {
  report.errors.push({ phase: report.setupCompleted ? 'scenario-or-custody' : 'setup', code: error.code ?? null,
    signal: error.signal ?? null, commandExitStatus: error.status ?? null, error: String(error?.stack ?? error) });
  checkpoint();
} finally {
  ledger.setPhase('custody-and-disposal');
  if (db) try {
    const rows = {};
    for (const table of ['patients', 'visits', 'media', 'command_receipts', 'memberships', 'team_members', 'organisations', 'audit_events']) rows[table] = (await deadline(`final D1 custody ${table}`, () => db.prepare(`SELECT * FROM ${table}`).all(), 5000)).results;
    save('native-d1-final-rows.json', rows);
  } catch (error) { report.errors.push({ phase: 'final-d1-custody', error: String(error?.stack ?? error) }); }
  if (runtime) try { await runtime.stop(); report.runtimeDisposed = runtime.lifecycle.disposed; report.nativeLifecycle = runtime.lifecycle; }
  catch (error) { report.errors.push({ phase: 'owned-runtime-disposal', error: String(error?.stack ?? error) }); }
  if (port) try { report.ownedPortFree = await portFree(port); assert.ok(report.ownedPortFree, 'Owned loopback port still occupied after disposal'); }
  catch (error) { report.errors.push({ phase: 'owned-port-custody', error: String(error?.stack ?? error) }); }
  if (state && existsSync(state)) try { save('native-d1-final-file-pins.json', filePins(walk(state))); }
  catch (error) { report.errors.push({ phase: 'final-native-file-custody', error: String(error?.stack ?? error) }); }
  if (before) try {
    const after = custody(); save('source-build-after.json', after);
    assert.deepEqual(after.source, before.source, 'Source changed during scenario execution');
    assert.deepEqual(after.build, before.build, 'Built application changed during scenario execution');
    assert.equal(after.gitHead, before.gitHead, 'Git source changed during scenario execution'); report.sourceBuildCustodyPassed = true;
  } catch (error) { report.errors.push({ phase: 'source-build-custody', error: String(error?.stack ?? error) }); }
  if (leaseOwned) try {
    const lease = JSON.parse(readFileSync(leaseFile, 'utf8')); assert.equal(lease.runId, runId); assert.equal(lease.pid, process.pid);
    lease.status = report.runtimeDisposed && report.ownedPortFree ? 'disposed-state-retained' : 'failed-state-retained';
    lease.completedAt = new Date().toISOString(); writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n'); save('owned-resource-lease.json', lease);
  } catch (error) { report.errors.push({ phase: 'owned-lease-custody', error: String(error?.stack ?? error) }); }
  report.status = report.caseGuardPassed && report.sourceBuildCustodyPassed && report.runtimeDisposed && report.ownedPortFree && !report.errors.length && ledger.snapshot().failed === 0 ? 'passed' : 'failed';
  checkpoint(); process.exitCode = report.status === 'passed' ? 0 : 1;
  // Actual local assertion-call counts and scenario outcomes are separate; neither is formal acceptance.
  console.log(JSON.stringify({ suite: report.suite, status: report.status, countKind: report.countKind,
    passed: report.passed, failed: report.failed, skipped: report.skipped, scenarioCountKind: report.scenarioCountKind,
    scenarioPassed: report.scenarioPassed, scenarioFailed: report.scenarioFailed, caseCount: report.caseCount,
    caseIds: report.caseIds, terminalCaseCount: report.terminalCaseCount, assertionCount: report.assertionCount, errorCount: report.errors.length, evidenceDirectory: out }));
}
