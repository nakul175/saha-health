import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {};
for (const file of ['scripts/security-gate.mjs', 'scripts/lib/security-audit-response.mjs', 'tests/security-audit-response-contract.mjs', 'tests/fixtures/security-audit-error-response.json', 'tests/fixtures/security-audit-supported-pnpm.json']) {
  if (existsSync(join(root, file))) pins[file] = hash(readFileSync(join(root, file)));
}
const executedGateSource = resolve(process.env.SAHA_AUDIT_GATE_SOURCE ?? join(root, 'scripts/security-gate.mjs'));
pins.executedGateSource = hash(readFileSync(executedGateSource));
const resultPath = resolve(process.env.SAHA_AUDIT_RESPONSE_RESULT ?? join(root, 'tests/security-audit-response-contract-result.json'));
const clone = value => JSON.parse(JSON.stringify(value));
const zero = () => ({ info: 0, low: 0, moderate: 0, high: 0, critical: 0 });
const report = advisories => ({ advisories: Object.fromEntries(advisories.map((a, i) => [String(i + 1), a])), metadata: { vulnerabilities: advisories.reduce((counts, a) => { counts[a.severity]++; return counts; }, zero()), dependencies: 1, devDependencies: 0, optionalDependencies: 0, totalDependencies: 1 } });
const advisory = (severity = 'high', dev = true, module = 'synthetic-runtime-dependency') => ({ id: 1001, title: 'Synthetic advisory fixture', module_name: module, severity, vulnerable_versions: '<1.0.1', findings: [{ dev, version: '1.0.0', paths: ['synthetic-fixture'] }] });
const empty = report([]);
const high = report([advisory()]);
const critical = report([advisory('critical')]);
const cases = [];
const add = (name, value, expected, extra = {}) => cases.push({ name, raw: typeof value === 'string' ? value : JSON.stringify(value), expected, exit: 1, ...extra });
const invalid = (name, mutate) => { const value = clone(high); mutate(value); add(name, value, 'unavailable'); };
add('complete-empty-audit', empty, 'pass', { exit: 0 });
add('complete-empty-extra-unused-fields', { ...empty, extraUnused: { trace: 'synthetic-only' } }, 'pass', { exit: 0 });
add('expected-nonzero-high-unshipped', high, 'pass');
add('expected-nonzero-high-declared-shipped', high, 'blocked', { shipped: true });
add('critical-development-still-blocks', critical, 'blocked');
add('critical-declared-shipped-still-blocks', critical, 'blocked', { shipped: true });
add('supported-real-pnpm-envelope-fixture', readFileSync(join(root, 'tests/fixtures/security-audit-supported-pnpm.json'), 'utf8'), 'pass');
add('exact-actual-fetch-error-json', readFileSync(join(root, 'tests/fixtures/security-audit-error-response.json'), 'utf8'), 'unavailable');
add('error-plus-complete-envelope', { ...empty, error: { message: 'SYNTHETIC_RAW_DIAGNOSTIC_MARKER' } }, 'unavailable');
add('null-top-level', null, 'unavailable');
add('array-top-level', [], 'unavailable');
add('empty-object-no-audit', {}, 'unavailable');
add('missing-advisory-map', { metadata: empty.metadata }, 'unavailable');
add('array-advisory-map', { ...empty, advisories: [] }, 'unavailable');
add('null-advisory-map', { ...empty, advisories: null }, 'unavailable');
add('missing-metadata', { advisories: {} }, 'unavailable');
add('null-metadata', { ...empty, metadata: null }, 'unavailable');
add('array-metadata', { ...empty, metadata: [] }, 'unavailable');
add('missing-counters', { ...empty, metadata: {} }, 'unavailable');
add('null-counters', { ...empty, metadata: { vulnerabilities: null } }, 'unavailable');
add('array-counters', { ...empty, metadata: { vulnerabilities: [] } }, 'unavailable');
for (const severity of Object.keys(zero())) invalid('missing-counter-' + severity, value => { delete value.metadata.vulnerabilities[severity]; });
invalid('negative-counter', value => { value.metadata.vulnerabilities.high = -1; });
invalid('fractional-counter', value => { value.metadata.vulnerabilities.high = 0.5; });
invalid('string-counter', value => { value.metadata.vulnerabilities.high = '1'; });
invalid('null-counter', value => { value.metadata.vulnerabilities.high = null; });
invalid('unsafe-large-counter', value => { value.metadata.vulnerabilities.high = Number.MAX_SAFE_INTEGER + 1; });
invalid('incomplete-critical-map', value => { value.advisories = {}; value.metadata.vulnerabilities = { ...zero(), critical: 1 }; });
invalid('counter-zero-hides-high-map', value => { value.metadata.vulnerabilities.high = 0; });
invalid('unsupported-severity', value => { value.advisories['1'].severity = 'unknown'; });
invalid('null-advisory', value => { value.advisories['1'] = null; });
invalid('array-advisory', value => { value.advisories['1'] = []; });
invalid('missing-module-name', value => { delete value.advisories['1'].module_name; });
invalid('non-string-module-name', value => { value.advisories['1'].module_name = 7; });
invalid('empty-module-name', value => { value.advisories['1'].module_name = ''; });
invalid('missing-vulnerable-versions', value => { delete value.advisories['1'].vulnerable_versions; });
invalid('non-string-vulnerable-versions', value => { value.advisories['1'].vulnerable_versions = {}; });
invalid('missing-advisory-id', value => { delete value.advisories['1'].id; });
invalid('object-advisory-id', value => { value.advisories['1'].id = {}; });
invalid('empty-advisory-id', value => { value.advisories['1'].id = ''; });
invalid('negative-advisory-id', value => { value.advisories['1'].id = -1; });
invalid('missing-advisory-title', value => { delete value.advisories['1'].title; });
invalid('non-string-advisory-title', value => { value.advisories['1'].title = []; });
invalid('array-finding', value => { value.advisories['1'].findings = [[]]; });
add('supported-string-advisory-id', report([{ ...advisory(), id: 'synthetic-advisory-1001' }]), 'pass');
add('supported-extra-unused-advisory-fields', report([{ ...advisory(), unused: { note: 'synthetic-only' } }]), 'pass');
invalid('missing-findings', value => { delete value.advisories['1'].findings; });
invalid('null-findings', value => { value.advisories['1'].findings = null; });
invalid('empty-findings', value => { value.advisories['1'].findings = []; });
invalid('object-findings', value => { value.advisories['1'].findings = {}; });
invalid('null-finding', value => { value.advisories['1'].findings = [null]; });
invalid('missing-dev-flag', value => { delete value.advisories['1'].findings[0].dev; });
invalid('non-boolean-dev-flag', value => { value.advisories['1'].findings[0].dev = 'true'; });
add('multiple-findings-count-advisory-once', report([{ ...advisory(), findings: [{ dev: true }, { dev: false }] }]), 'pass');
add('malformed-json-does-not-echo-marker', '{ "SYNTHETIC_RAW_DIAGNOSTIC_MARKER":', 'unavailable');
add('absent-audit-output', '', 'unavailable');
add('unexpected-exit-valid-stdout', empty, 'unavailable', { exit: 2 });
add('signal-with-valid-stdout', empty, 'unavailable', { signal: true });
add('spawn-unavailable-prior-passed-report', empty, 'unavailable', { noCommand: true });
add('list-failed-tool-raw-marker', empty, 'unavailable', { listFailure: true, listRaw: 'SYNTHETIC_RAW_DIAGNOSTIC_MARKER', listExit: 2 });
add('list-malformed-json-marker', empty, 'unavailable', { listFailure: true, listRaw: '{ "SYNTHETIC_RAW_DIAGNOSTIC_MARKER":', listExit: 0 });
add('list-no-output', empty, 'unavailable', { listFailure: true, listRaw: '', listExit: 0 });
add('list-signal-valid-output', empty, 'unavailable', { listFailure: true, listSignal: true });
add('list-unsupported-root', empty, 'unavailable', { listFailure: true, listRaw: '{}', listExit: 0 });

// Additional consumed dependency-tree cases retain every original 68-case oracle.
const invalidList = (name, tree) => add(name, empty, 'unavailable', { listFailure: true, listRaw: JSON.stringify(tree), listExit: 0 });
invalidList('list-null-dependencies', [{ dependencies: null }]);
invalidList('list-array-dependencies', [{ dependencies: [] }]);
invalidList('list-string-dependencies', [{ dependencies: 'synthetic-list-marker' }]);
invalidList('list-null-package-info', [{ dependencies: { package: null } }]);
invalidList('list-array-package-info', [{ dependencies: { package: [] } }]);
invalidList('list-missing-package-version', [{ dependencies: { package: {} } }]);
invalidList('list-non-string-package-version', [{ dependencies: { package: { version: 1 } } }]);
invalidList('list-empty-package-version', [{ dependencies: { package: { version: '' } } }]);
invalidList('list-null-nested-dependencies', [{ dependencies: { package: { version: '1.0.0', dependencies: null } } }]);
invalidList('list-array-nested-dependencies', [{ dependencies: { package: { version: '1.0.0', dependencies: [] } } }]);
invalidList('list-missing-nested-package-version', [{ dependencies: { package: { version: '1.0.0', dependencies: { nested: {} } } } }]);
invalidList('list-object-wrapped-array-index', { 0: { dependencies: {} } });
add('list-supported-no-production-dependencies', empty, 'pass', { exit: 0, listRaw: '[{}]', components: 0 });
add('list-supported-nested-dependencies', empty, 'pass', { exit: 0, listRaw: JSON.stringify([{ dependencies: { package: { version: '1.0.0', dependencies: { nested: { version: '2.0.0' } } } } }]), components: 2 });



const parent = mkdtempSync(join(tmpdir(), 'saha-audit-response-'));
const observations = [];
let passed = 0, failed = 0;
const check = (label, f) => {
  try { f(); passed++; return { label, status: 'passed' }; }
  catch (error) { failed++; return { label, status: 'failed', error: String(error.message) }; }
};
try {
  for (const [index, c] of cases.entries()) {
    const cwd = join(parent, String(index)); mkdirSync(join(cwd, 'dist'), { recursive: true }); mkdirSync(join(cwd, 'bin'));
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'synthetic-audit-fixture', version: '1.0.0' }));
    writeFileSync(join(cwd, 'dist', 'worker.js'), c.shipped ? '/* node_modules/synthetic-runtime-dependency/index.js */' : '/* declared synthetic empty worker */');
    const selectedReport = join(cwd, 'dist', 'security-gate.json');
    writeFileSync(selectedReport, JSON.stringify({ passed: true, history: 'prior fixture run; must become unavailable' }));
    const trace = join(cwd, 'trace.jsonl'), config = join(cwd, 'case.json');
    writeFileSync(config, JSON.stringify({ raw: c.raw, exit: c.exit, signal: c.signal ?? false, listRaw: c.listRaw, listExit: c.listExit, listSignal: c.listSignal ?? false, trace }));
    const stub = join(cwd, 'bin', 'corepack');
    writeFileSync(stub, `#!/usr/bin/env node
import { readFileSync, appendFileSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
const config = JSON.parse(readFileSync(process.env.SAHA_AUDIT_FIXTURE_CONFIG, 'utf8'));
const args = process.argv.slice(2); const list = args.includes('list');
const stdout = list ? config.listRaw ?? JSON.stringify([{ dependencies: { 'synthetic-runtime-dependency': { version: '1.0.0' } } }]) : config.raw;
const configuredExit = list ? config.listExit ?? 0 : config.exit;
const configuredSignal = list ? config.listSignal : config.signal;
appendFileSync(config.trace, JSON.stringify({ args, stdoutSha256: createHash('sha256').update(stdout).digest('hex'), signal: configuredSignal, configuredExit }) + '\\n');
writeSync(1, stdout);
if (configuredSignal) process.kill(process.pid, 'SIGTERM');
else process.exit(configuredExit);
`);
    chmodSync(stub, 0o755);
    const run = spawnSync(process.execPath, [executedGateSource], {
      cwd, env: { PATH: c.noCommand ? join(cwd, 'unavailable') : join(cwd, 'bin') + ':' + dirname(process.execPath), SAHA_AUDIT_FIXTURE_CONFIG: config }, encoding: 'utf8', timeout: 12000,
    });
    let actual; let reportReadError = null;
    try { actual = JSON.parse(readFileSync(selectedReport, 'utf8')); } catch (error) { reportReadError = String(error.message); }
    const output = (run.stdout ?? '') + (run.stderr ?? '');
    const commandTrace = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    const verdicts = [];
    verdicts.push(check(c.name + ':native-process-completed', () => { assert.equal(run.signal, null); assert.equal(run.error, undefined); assert.notEqual(run.status, null); }));
    verdicts.push(check(c.name + ':process-release-decision', () => { if (c.expected === 'pass') assert.equal(run.status, 0, output); else assert.notEqual(run.status, 0, output); }));
    verdicts.push(check(c.name + ':report-current-decision', () => { assert.equal(reportReadError, null); assert.equal(actual.passed, c.expected === 'pass'); assert.equal(actual.history, undefined, 'prior passed report still selected'); }));
    verdicts.push(check(c.name + ':availability-and-policy', () => {
      if (c.expected === 'unavailable') { assert.equal(actual.auditAvailable, false); assert.equal(actual.counts, null); assert.equal(actual.passed, false); }
      else { assert.deepEqual(actual.counts, JSON.parse(c.raw).metadata.vulnerabilities); assert.equal(actual.blocking.length > 0, c.expected === 'blocked'); assert.equal(actual.productionComponents, c.components ?? 1); }
    }));
    verdicts.push(check(c.name + ':no-raw-diagnostic-disclosure', () => { assert.ok(!output.includes('SYNTHETIC_RAW_DIAGNOSTIC_MARKER')); assert.ok(!JSON.stringify(actual).includes('SYNTHETIC_RAW_DIAGNOSTIC_MARKER')); if (c.expected === 'unavailable') assert.equal(run.stderr.trim(), 'Dependency audit unavailable; failing closed.'); }));
    verdicts.push(check(c.name + ':actual-subprocess-contract', () => {
      if (c.noCommand) assert.deepEqual(commandTrace, []);
      else if (c.listFailure) assert.deepEqual(commandTrace.map(x => x.args), [['pnpm', 'list', '--prod', '--json', '--depth', 'Infinity']]);
      else { assert.deepEqual(commandTrace.map(x => x.args), [['pnpm', 'list', '--prod', '--json', '--depth', 'Infinity'], ['pnpm', 'audit', '--json']]); assert.equal(commandTrace[1].stdoutSha256, hash(c.raw)); }
    }));
    observations.push({ name: c.name, expected: c.expected, process: { status: run.status, signal: run.signal, error: run.error ? String(run.error) : null }, report: actual ?? null, reportReadError, stdout: run.stdout, stderr: run.stderr, commandTrace, rawAuditSha256: hash(c.raw), verdicts });
  }
} finally {
  rmSync(parent, { recursive: true, force: true });
}
const afterPins = Object.fromEntries(Object.keys(pins).map(file => [file, hash(readFileSync(file === 'executedGateSource' ? executedGateSource : join(root, file)))]));
const sourceStability = check('executed-inputs-byte-stable', () => assert.deepEqual(afterPins, pins));
const result = { generatedAt: new Date().toISOString(), passed, failed, skipped: 0, cases: cases.length, node: process.version, scope: 'Actual production gate process with explicitly controlled subprocess stdout/exit and disposable synthetic dist; no real registry/production bundle/hosted acceptance', inputHashes: pins, afterInputHashes: afterPins, inputsStable: JSON.stringify(afterPins) === JSON.stringify(pins), actualCommandEntrypoint: true, executedGateSource, executedGateSourceSha256: pins.executedGateSource, subprocessTransport: 'test-only corepack executable; exact declared pnpm argv and raw stdout hash observed', cleanup: { temporaryFixturesRemoved: !existsSync(parent) }, sourceStability, observations };
mkdirSync(dirname(resultPath), { recursive: true }); writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed, failed, skipped: 0, cases: cases.length, result: resultPath }));
process.exitCode = failed ? 1 : 0;
