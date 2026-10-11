// Lightweight configuration/file custody controls only; the actual installer runs in isolated CI.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { suite } from './lib/report.mjs';
import { sha256 } from './lib/scoped-locality-containment.mjs';
import { installedYamlParser, validateInstallMutation, restoreExactWorkspace, WORKSPACE, PROJECT_STORE } from '../scripts/scoped-locality-install-custody.mjs';

const resultFile = resolve(process.env.SAHA_SCOPED_INSTALL_CONTROL_RESULT ?? 'tests/reports/scoped-locality-install-custody-contract.json');
const evidence = resolve(process.env.SAHA_SCOPED_INSTALL_CONTROL_EVIDENCE ?? `tests/reports/scoped-locality-install-controls-${crypto.randomUUID()}`);
assert.equal(existsSync(resultFile), false, 'Retain the prior control report.'); assert.equal(existsSync(evidence), false, 'Retain the prior control evidence.'); mkdirSync(evidence, { recursive: true });
const INPUTS = ['scripts/scoped-locality-install-custody.mjs', 'tests/scoped-locality-install-custody-contract.mjs', 'tests/lib/scoped-locality-containment.mjs', 'tests/lib/report.mjs', 'scripts/install-pnpm.sh', 'scripts/pnpm-install.mjs', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', '.github/workflows/scoped-permission-checks.yml'];
const inputHashes = Object.fromEntries(INPUTS.map(file => [file, sha256(readFileSync(file))]));
const parser = installedYamlParser(process.env.SAHA_SCOPED_INSTALL_PARSER_PROJECT ?? process.cwd());
const originalBytes = readFileSync(WORKSPACE), beforeConfig = parser.load(originalBytes.toString('utf8'));
const lockSha256 = sha256(readFileSync('pnpm-lock.yaml'));
const valid = () => ({ beforeConfig: structuredClone(beforeConfig), afterConfig: { ...structuredClone(beforeConfig), storeDir: PROJECT_STORE, cacheDir: `${PROJECT_STORE}/policy-cache` }, report: { version: 1, store_scope: 'project' }, installIdentity: { package_manager: 'pnpm@11.25.0', lockfile_sha256: lockSha256, node: process.version, platform: `${process.platform}-${process.arch}` }, lockSha256, changedPaths: [WORKSPACE], stagedPaths: [], installerOK: true });
const r = suite('Scoped locality installer custody controls (APL-194)', resultFile, { layer: 'unit', environment: 'Existing pinned YAML parser and temporary regular files; no installer, build, Worker, browser, D1 or outbound request', limits: ['Parsed configuration fixtures do not assert an actual installer run.', 'The genuine first dedicated CI failure is retained; native policy and formal acceptance remain separate.'] });
await r.check('the actual original policy parses with the already installed pinned YAML parser', () => { assert.equal(beforeConfig.minimumReleaseAge, 10080); assert.equal(beforeConfig.strictDepBuilds, true); assert.equal(beforeConfig.trustLockfile, false); });
await r.check('only declared project store and cache substitutions are accepted', () => { const output = validateInstallMutation(valid()); assert.deepEqual(output.allowedChanges, ['storeDir', 'cacheDir']); assert.ok(output.preservedKeys.includes('allowBuilds')); });
await r.check('an unsuccessful unchanged installer cannot authorize restoration', () => { const x = valid(); x.installerOK = false; assert.throws(() => validateInstallMutation(x)); });
await r.check('missing or unsupported installer report is refused', () => { for (const report of [null, {}, { version: 2, store_scope: 'project' }, { version: 1, store_scope: 'workspace' }, { version: 1, store_scope: 'unknown' }]) { const x = valid(); x.report = report; assert.throws(() => validateInstallMutation(x)); } });
await r.check('null scalar or array workspace configurations are refused', () => { for (const field of ['beforeConfig', 'afterConfig']) for (const value of [null, [], 'policy']) { const x = valid(); x[field] = value; assert.throws(() => validateInstallMutation(x)); } });
await r.check('extra and deleted configuration keys are refused', () => { const extra = valid(); extra.afterConfig.unreviewed = true; assert.throws(() => validateInstallMutation(extra)); const missing = valid(); delete missing.afterConfig.strictDepBuilds; assert.throws(() => validateInstallMutation(missing)); });
await r.check('every original security or other non-store value is protected', () => { for (const key of Object.keys(beforeConfig).filter(key => !['storeDir', 'cacheDir'].includes(key))) { const x = valid(); x.afterConfig[key] = null; assert.throws(() => validateInstallMutation(x), undefined, key); } });
await r.check('nested build allowances and override values are protected', () => { const allowance = valid(); allowance.afterConfig.allowBuilds.workerd = false; assert.throws(() => validateInstallMutation(allowance)); const override = valid(); override.afterConfig.overrides['miniflare>sharp'] = '0.0.0'; assert.throws(() => validateInstallMutation(override)); });
await r.check('a changed original store policy cannot be silently normalized', () => { for (const key of ['storeDir', 'cacheDir']) { const x = valid(); x.beforeConfig[key] = 'other'; assert.throws(() => validateInstallMutation(x)); } });
await r.check('unexpected generated store or cache paths are refused', () => { for (const key of ['storeDir', 'cacheDir']) { const x = valid(); x.afterConfig[key] = '/shared/unreviewed'; assert.throws(() => validateInstallMutation(x)); } });
await r.check('any additional tracked mutation is refused rather than ignored', () => { const x = valid(); x.changedPaths.push('pnpm-lock.yaml'); assert.throws(() => validateInstallMutation(x)); });
await r.check('staged changes and duplicate changed-path observations are refused', () => { const staged = valid(); staged.stagedPaths = [WORKSPACE]; assert.throws(() => validateInstallMutation(staged)); const duplicate = valid(); duplicate.changedPaths.push(WORKSPACE); assert.throws(() => validateInstallMutation(duplicate)); });
await r.check('missing wrong-manager or wrong-lock installed identities are refused', () => { for (const identity of [null, {}, { ...valid().installIdentity, package_manager: 'npm' }, { ...valid().installIdentity, lockfile_sha256: '0'.repeat(64) }]) { const x = valid(); x.installIdentity = identity; assert.throws(() => validateInstallMutation(x)); } });
await r.check('installed runtime identity must use the actual Node and platform', () => { for (const field of ['node', 'platform']) { const x = valid(); x.installIdentity[field] = 'unobserved'; assert.throws(() => validateInstallMutation(x)); } });
await r.check('the YAML parser refuses duplicate keys and malformed policy syntax', () => { assert.throws(() => parser.load('strictDepBuilds: true\nstrictDepBuilds: false\n')); assert.throws(() => parser.load('allowBuilds: [\n')); });
await r.check('actual temporary-file restoration returns exact original bytes including comments', () => { const file = join(evidence, 'restorable.yaml'), generated = Buffer.from('generated-config\n'); writeFileSync(file, generated, { flag: 'wx' }); restoreExactWorkspace(file, originalBytes, sha256(generated)); assert.equal(readFileSync(file).equals(originalBytes), true); });
await r.check('a concurrent generated-file change is refused and retained', () => { const file = join(evidence, 'changed-after-validation.yaml'); writeFileSync(file, 'concurrent\n', { flag: 'wx' }); assert.throws(() => restoreExactWorkspace(file, originalBytes, sha256(Buffer.from('earlier\n')))); assert.equal(readFileSync(file, 'utf8'), 'concurrent\n'); });
await r.check('a symlink is refused without replacing it or its target', () => { const target = join(evidence, 'link-target.yaml'), link = join(evidence, 'workspace-link.yaml'); writeFileSync(target, 'target\n', { flag: 'wx' }); symlinkSync(target, link); assert.throws(() => restoreExactWorkspace(link, originalBytes, sha256(Buffer.from('target\n')))); assert.equal(readFileSync(target, 'utf8'), 'target\n'); });
await r.check('missing files and directories cannot be treated as restorable workspaces', () => { assert.throws(() => restoreExactWorkspace(join(evidence, 'absent.yaml'), originalBytes, '')); assert.throws(() => restoreExactWorkspace(evidence, originalBytes, '')); });
const cli = resolve('scripts/scoped-locality-install-custody.mjs');
const gitOptions = { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 };
function setupFailureControl(name, prepare) {
  const cwd = join(evidence, name); mkdirSync(cwd);
  execFileSync('git', ['init', '--quiet'], { ...gitOptions, cwd }); prepare?.(cwd);
  const attempt = join(cwd, 'attempt'); let failure;
  try { execFileSync(process.execPath, [cli], { ...gitOptions, stdio: ['ignore', 'pipe', 'pipe'], cwd, env: { ...process.env, SAHA_SCOPED_INSTALL_EVIDENCE: attempt } }); }
  catch (error) { failure = error; }
  assert.ok(failure, 'The real wrapper must refuse this initial setup before any installer command.'); assert.equal(failure.status, 1); assert.equal(failure.signal, null);
  writeFileSync(join(cwd, 'actual-cli.stdout.log'), failure.stdout ?? ''); writeFileSync(join(cwd, 'actual-cli.stderr.log'), failure.stderr ?? '');
  const receipt = JSON.parse(readFileSync(join(attempt, 'receipt.json'), 'utf8'));
  assert.equal(receipt.status, 'failed; no build or native authorization'); assert.equal(receipt.phase, 'initial source guard'); assert.deepEqual(receipt.commands, []); assert.equal(receipt.restored, false); assert.equal(receipt.nativeScenariosRun, 0);
  return receipt;
}
await r.check('actual missing-HEAD Git setup failure retains full command bounds and stderr before spawning an installer', () => {
  const receipt = setupFailureControl('missing-head'); const observed = receipt.errors[0].gitObservation;
  assert.deepEqual(observed.command, ['git', 'rev-parse', 'HEAD']); assert.equal(observed.status, 128); assert.equal(observed.maxBuffer, 16 * 1024 * 1024); assert.equal(observed.timeoutMs, 20000); assert.equal(observed.killSignal, 'SIGKILL'); assert.ok(observed.stderr.includes('HEAD'));
});
await r.check('actual dirty temporary checkout failure retains an initial receipt without restoring or installing anything', () => {
  const receipt = setupFailureControl('dirty-checkout', cwd => {
    const file = join(cwd, 'control.txt'); writeFileSync(file, 'committed fixture\n');
    execFileSync('git', ['add', 'control.txt'], { ...gitOptions, cwd });
    execFileSync('git', ['-c', 'user.name=synthetic-fixture', '-c', 'user.email=fixture@invalid', 'commit', '--quiet', '-m', 'disposable control fixture'], { ...gitOptions, cwd });
    writeFileSync(file, 'retained changed fixture\n');
  });
  assert.ok(receipt.errors[0].message.includes('Tracked source differs')); assert.equal(readFileSync(join(evidence, 'dirty-checkout/control.txt'), 'utf8'), 'retained changed fixture\n');
});
const afterHashes = Object.fromEntries(INPUTS.map(file => [file, sha256(readFileSync(file))]));
await r.check('installer policy source and control inputs remain unchanged through these controls', () => assert.deepEqual(afterHashes, inputHashes));
writeFileSync(join(evidence, 'input-custody.json'), JSON.stringify({ inputHashes, afterHashes, parser: parser.identity }, null, 2) + '\n');
const result = await r.finish({ evidence, inputHashes, afterHashes, parser: parser.identity, minimumChecks: 22, actualInstallerExecuted: false, applicationRuntimeStarted: false, nativeScenariosRun: 0, formalAcceptanceClaim: false });
assert.equal(result.checks.length, 22, 'All twenty-two additive custody controls must execute.'); assert.equal(result.skipped, 0, 'Missing or skipped custody controls cannot pass.');
