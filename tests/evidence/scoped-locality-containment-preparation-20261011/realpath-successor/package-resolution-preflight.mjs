import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Package loading only: no Miniflare constructor, Worker, port, build or D1 call.
const hash = value => createHash('sha256').update(value).digest('hex');
const [donor, output] = process.argv.slice(2);
const lexicalAnchor = resolve(donor, 'node_modules/wrangler/package.json');
const anchor = realpathSync(lexicalAnchor);
const receipt = {
  recordedAt: new Date().toISOString(),
  scope: 'Read-only installed-package resolution in the root donor checkout; not a native test or proof of an independent CI install',
  node: { executable: realpathSync(process.execPath), version: process.version },
  lexicalAnchor, realpathAnchor: anchor, modulesConstructed: 0,
  workerStarted: false, buildStarted: false, portBound: false, stateCreated: false,
};
const sourceFiles = ['tests/lib/scoped-locality-native-runtime.mjs', 'scripts/scoped-locality-runner.mjs'];
const own = resolve(donor, '..', 'saha-scoped-permissions-prep-20261011');
receipt.sourcePins = Object.fromEntries(sourceFiles.map(path => [path, hash(readFileSync(resolve(own, path)))]));
try {
  const old = createRequire(lexicalAnchor);
  receipt.lexicalResolution = { miniflare: old.resolve('miniflare'), workerd: old.resolve('workerd/package.json'), unexpectedlyResolved: true };
} catch (error) {
  receipt.lexicalResolution = { unexpectedlyResolved: false, code: error.code, message: error.message };
}
const require = createRequire(anchor);
receipt.packages = {};
for (const name of ['wrangler', 'miniflare', 'workerd']) {
  const file = realpathSync(name === 'wrangler' ? anchor : require.resolve(`${name}/package.json`));
  const bytes = readFileSync(file); const pkg = JSON.parse(bytes);
  assert.equal(pkg.name, name);
  receipt.packages[name] = { name: pkg.name, version: pkg.version, packageJson: file, packageJsonSha256: hash(bytes) };
}
receipt.miniflareEntry = realpathSync(require.resolve('miniflare'));
receipt.miniflareEntrySha256 = hash(readFileSync(receipt.miniflareEntry));
receipt.miniflareExportType = typeof require('miniflare').Miniflare;
assert.equal(receipt.miniflareExportType, 'function');
for (const pkg of Object.values(receipt.packages)) assert.equal(hash(readFileSync(pkg.packageJson)), pkg.packageJsonSha256);
receipt.sourcePinsAfter = Object.fromEntries(sourceFiles.map(path => [path, hash(readFileSync(resolve(own, path)))]));
assert.deepEqual(receipt.sourcePinsAfter, receipt.sourcePins);
receipt.resolutionSucceeded = true;
receipt.completedAt = new Date().toISOString();
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ resolutionSucceeded: true, lexicalFailed: !receipt.lexicalResolution.unexpectedlyResolved, versions: Object.fromEntries(Object.entries(receipt.packages).map(([key, value]) => [key, value.version])), nativeStarted: false }));
