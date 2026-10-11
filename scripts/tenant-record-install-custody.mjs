// Dedicated isolated-CI custody, not an installer or a source-guard exemption.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { setImmediate as yieldSignals } from 'node:timers/promises';
import { runOwnedCommand, sourceCheckoutPins, sha256 } from '../tests/lib/tenant-record-containment.mjs';

export const WORKSPACE = 'pnpm-workspace.yaml';
export const PROJECT_STORE = '.sites-runtime/pnpm-store';
export const PARSER_PIN = { name: 'js-yaml', version: '4.1.1', packageJsonSha256: '8def73a82a4593800c08ae7f068016804d94ecadadd409a8042f1850cc5ce5a0' };
const policyStore = '${SITES_PNPM_SHARED_STORE:-.sites-runtime/pnpm-store}';
const gitOptions = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' };
const git = (args, binary = false) => {
  try { return execFileSync('git', args, { ...gitOptions, ...(binary ? { encoding: null } : {}) }); }
  catch (error) { error.gitObservation = { command: ['git', ...args], maxBuffer: gitOptions.maxBuffer, timeoutMs: gitOptions.timeout, killSignal: gitOptions.killSignal, code: error.code ?? null, status: error.status ?? null, signal: error.signal ?? null, stdout: error.stdout == null ? null : String(error.stdout), stderr: error.stderr == null ? null : String(error.stderr) }; throw error; }
};
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const recordFile = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function validateInstallMutation({ beforeConfig, afterConfig, report, installIdentity, lockSha256, changedPaths, stagedPaths, installerOK }) {
  assert.equal(installerOK, true, 'The unchanged installer must actually succeed before restoration.');
  assert.equal(plain(beforeConfig), true, 'The original workspace must parse as a mapping.');
  assert.equal(plain(afterConfig), true, 'The generated workspace must parse as a mapping.');
  assert.deepEqual(Object.keys(afterConfig).sort(), Object.keys(beforeConfig).sort(), 'No configuration key may appear or disappear.');
  assert.deepEqual(stagedPaths, [], 'Installation may not stage source changes.');
  assert.ok(Array.isArray(changedPaths) && changedPaths.every(file => file === WORKSPACE) && new Set(changedPaths).size === changedPaths.length, 'Only the declared workspace file may change; no source changes are ignored.');
  assert.equal(report?.version, 1); assert.equal(report.store_scope, 'project', 'This wrapper qualifies the isolated project-store installer selection only.');
  assert.equal(beforeConfig.storeDir, policyStore); assert.equal(beforeConfig.cacheDir, `${policyStore}/policy-cache`);
  assert.equal(afterConfig.storeDir, PROJECT_STORE); assert.equal(afterConfig.cacheDir, `${PROJECT_STORE}/policy-cache`);
  assert.equal(beforeConfig.packageImportMethod, 'clone-or-copy');
  for (const key of Object.keys(beforeConfig)) {
    if (key !== 'storeDir' && key !== 'cacheDir') assert.deepEqual(afterConfig[key], beforeConfig[key], `Installer changed undeclared policy/configuration: ${key}`);
  }
  assert.equal(installIdentity?.package_manager, 'pnpm@11.25.0');
  assert.equal(installIdentity.lockfile_sha256, lockSha256, 'Installed identity must name the exact original lockfile.');
  assert.equal(installIdentity.node, process.version); assert.equal(installIdentity.platform, `${process.platform}-${process.arch}`);
  return { allowedChanges: ['storeDir', 'cacheDir'], preservedKeys: Object.keys(beforeConfig).filter(key => !['storeDir', 'cacheDir'].includes(key)).sort(), storeScope: 'project' };
}

export function restoreExactWorkspace(file, savedBytes, expectedGeneratedSha256) {
  assert.equal(lstatSync(file).isFile(), true, 'Restore only the original regular workspace file.');
  assert.equal(lstatSync(file).isSymbolicLink(), false);
  assert.equal(sha256(readFileSync(file)), expectedGeneratedSha256, 'Workspace changed after validation; do not overwrite concurrent bytes.');
  writeFileSync(file, savedBytes); assert.equal(readFileSync(file).equals(savedBytes), true, 'Exact saved bytes were not restored.');
}

export function installedYamlParser(project = process.cwd()) {
  // Resolve from the real installed pnpm package, not a lexical node_modules path.
  const eslintFile = realpathSync(resolve(project, 'node_modules/eslint/package.json'));
  const eslintRequire = createRequire(eslintFile);
  const eslintrcEntry = realpathSync(eslintRequire.resolve('@eslint/eslintrc'));
  const eslintrcRequire = createRequire(eslintrcEntry);
  const packageFile = realpathSync(eslintrcRequire.resolve('js-yaml/package.json'));
  const entry = realpathSync(eslintrcRequire.resolve('js-yaml'));
  const pkg = json(packageFile);
  assert.equal(pkg.name, PARSER_PIN.name); assert.equal(pkg.version, PARSER_PIN.version);
  assert.equal(sha256(readFileSync(packageFile)), PARSER_PIN.packageJsonSha256, 'The existing pinned YAML parser package changed.');
  const parser = eslintrcRequire('js-yaml'); assert.equal(typeof parser.load, 'function');
  return { load: text => parser.load(text), identity: { ...PARSER_PIN, eslintPackageFile: eslintFile, eslintPackageJsonSha256: sha256(readFileSync(eslintFile)), eslintrcEntry, eslintrcEntrySha256: sha256(readFileSync(eslintrcEntry)), entry, entrySha256: sha256(readFileSync(entry)), packageFile } };
}

function runtimeIdentities() {
  const wranglerFile = realpathSync(resolve('node_modules/wrangler/package.json'));
  const require = createRequire(wranglerFile);
  return Object.fromEntries(['wrangler', 'miniflare', 'workerd'].map(name => {
    const file = name === 'wrangler' ? wranglerFile : realpathSync(require.resolve(`${name}/package.json`));
    return [name, { version: json(file).version, file, packageJsonSha256: sha256(readFileSync(file)) }];
  }));
}

export async function runInstallCustody() {
  const evidence = resolve(process.env.SAHA_TENANT_INSTALL_EVIDENCE ?? 'tests/reports/tenant-record-install-custody');
  assert.equal(existsSync(evidence), false, 'Never replace an earlier installer attempt.');
  mkdirSync(evidence, { recursive: true });
  const reportFile = join(evidence, 'installer-report.json'); writeFileSync(reportFile, '{}\n', { flag: 'wx' });
  const receipt = { kind: 'actual isolated CI installer custody', startedAt: new Date().toISOString(), ownerPid: process.pid, node: process.version, platform: process.platform, architecture: process.arch, commands: [], errors: [], restored: false, nativeScenariosRun: 0, formalAcceptanceClaim: false, status: 'started', phase: 'initial source guard' };
  const checkpoint = () => recordFile(join(evidence, 'receipt.json'), receipt);
  checkpoint();
  const cancellation = new AbortController();
  const cancel = signal => { receipt.cancellationSignals ??= []; receipt.cancellationSignals.push({ signal, at: new Date().toISOString() }); cancellation.abort(new Error(`Supervisor received ${signal}`)); process.exitCode = 1; };
  const term = () => cancel('SIGTERM'), int = () => cancel('SIGINT'); process.on('SIGTERM', term); process.on('SIGINT', int);
  try {
    const before = sourceCheckoutPins(); // The existing complete clean-source guard stays unchanged.
    receipt.before = before;
    assert.equal(process.env.SITES_PNPM_SHARED_STORE ?? '', '', 'No shared-store selection is qualified by this dedicated CI wrapper.');
    assert.equal(resolve(process.env.SITES_RUNTIME_ROOT ?? '.sites-runtime'), resolve('.sites-runtime'), 'No external runtime-root selection is qualified.');
    assert.equal(lstatSync(WORKSPACE).isSymbolicLink(), false);
    const saved = readFileSync(WORKSPACE), lockSha256 = sha256(readFileSync('pnpm-lock.yaml'));
    assert.equal(saved.equals(git(['show', `HEAD:${WORKSPACE}`], true)), true, 'Save the exact committed workspace bytes.');
    writeFileSync(join(evidence, 'workspace-before.yaml'), saved, { flag: 'wx' });
    receipt.workspaceBeforeSha256 = sha256(saved); receipt.lockSha256 = lockSha256;
    receipt.unchangedInstallerInputs = Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'scripts/install-pnpm.sh', 'scripts/pnpm-install.mjs', 'scripts/execution-profile.mjs'].map(file => [file, sha256(readFileSync(file))]));
    await yieldSignals(); assert.equal(cancellation.signal.aborted, false, 'Cancellation during initial source observations cannot start the installer.');
    receipt.phase = 'unchanged installer'; checkpoint();
    receipt.installer = await runOwnedCommand('npm', ['run', 'install:ci'], { stdout: join(evidence, 'install.stdout.log'), stderr: join(evidence, 'install.stderr.log'), timeoutMs: 600000, graceMs: 5000, env: { ...process.env, SITES_INSTALL_REPORT_PATH: reportFile }, abortSignal: cancellation.signal, onSpawn: handle => { receipt.commands.push({ phase: 'unchanged npm run install:ci', ...handle }); checkpoint(); } });
    // Keep the actual generated bytes/list/diff, even if validation will refuse them.
    receipt.changedPaths = git(['diff', '--name-only', '-z']).split('\0').filter(Boolean);
    receipt.stagedPaths = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
    writeFileSync(join(evidence, 'actual-post-install.diff'), git(['diff', '--binary', '--no-ext-diff']));
    const generated = readFileSync(WORKSPACE); writeFileSync(join(evidence, 'workspace-after.yaml'), generated, { flag: 'wx' });
    receipt.workspaceGeneratedSha256 = sha256(generated);
    receipt.afterInstallTrackedHashes = Object.fromEntries(Object.keys(before.files).map(file => [file, existsSync(file) ? sha256(readFileSync(file)) : null]));
    receipt.changedTrackedHashes = Object.keys(before.files).filter(file => before.files[file] !== receipt.afterInstallTrackedHashes[file]);
    assert.ok(receipt.changedTrackedHashes.every(file => file === WORKSPACE), 'Installation changed tracked input bytes beyond the declared workspace file.');
    receipt.installReport = json(reportFile); receipt.installIdentity = json('node_modules/.sites-install.json');
    receipt.profileAfterInstall = { filePresent: existsSync(before.buildLocalSelection.profileFile), sha256: existsSync(before.buildLocalSelection.profileFile) ? sha256(readFileSync(before.buildLocalSelection.profileFile)) : null };
    assert.equal(receipt.profileAfterInstall.filePresent, before.buildLocalSelection.profileFilePresent); assert.equal(receipt.profileAfterInstall.sha256, before.buildLocalSelection.profileFileSha256, 'Installation changed the execution profile.');
    const parser = installedYamlParser(); receipt.yamlParser = parser.identity; receipt.installedRuntime = runtimeIdentities();
    checkpoint();
    receipt.validation = validateInstallMutation({ beforeConfig: parser.load(saved.toString('utf8')), afterConfig: parser.load(generated.toString('utf8')), report: receipt.installReport, installIdentity: receipt.installIdentity, lockSha256, changedPaths: receipt.changedPaths, stagedPaths: receipt.stagedPaths, installerOK: receipt.installer.ok });
    await yieldSignals(); assert.equal(cancellation.signal.aborted, false, 'Cancellation cannot authorize restoration or success.');
    receipt.phase = 'exact restoration and complete source guard'; checkpoint();
    restoreExactWorkspace(WORKSPACE, saved, receipt.workspaceGeneratedSha256); receipt.restored = true;
    receipt.afterRestore = sourceCheckoutPins(); assert.deepEqual(receipt.afterRestore, before, 'The unchanged full clean-source guard must pass after exact restoration.');
    assert.deepEqual(runtimeIdentities(), receipt.installedRuntime, 'Restoration changed installed runtime identities.');
    assert.deepEqual(json('node_modules/.sites-install.json'), receipt.installIdentity);
    await yieldSignals(); assert.equal(cancellation.signal.aborted, false, 'Cancellation after source observations cannot publish success.');
    receipt.status = 'validated declared installer changes; original source bytes restored'; receipt.completedAt = new Date().toISOString(); checkpoint();
    console.log(JSON.stringify({ status: receipt.status, checkoutCommit: before.checkoutCommit, workspaceBeforeSha256: receipt.workspaceBeforeSha256, workspaceGeneratedSha256: receipt.workspaceGeneratedSha256, restored: true, nativeScenariosRun: 0 }));
  } catch (error) {
    receipt.errors.push({ name: error.name, message: String(error.message), code: error.code ?? null, status: error.status ?? null, signal: error.signal ?? null, stdout: error.stdout == null ? null : String(error.stdout), stderr: error.stderr == null ? null : String(error.stderr), ...(error.gitObservation ? { gitObservation: error.gitObservation } : {}) }); receipt.status = 'failed; no build or native authorization'; receipt.completedAt = new Date().toISOString(); checkpoint(); throw error;
  } finally { process.removeListener('SIGTERM', term); process.removeListener('SIGINT', int); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await runInstallCustody();
