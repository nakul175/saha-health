import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Read-only Git metadata only. Use the exact private production-test helper literal,
// with the genuine Node child-process function; no application or policy is loaded.
const [own, donor, evidence] = process.argv.slice(2).map(path => resolve(path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const helper = readFileSync(resolve(own, 'tests/lib/scoped-locality-containment.mjs'), 'utf8');
const begin = helper.indexOf('function observeGit(args) {');
const end = helper.indexOf('export function sourceCheckoutPins', begin);
assert.ok(begin >= 0 && end > begin);
const literal = helper.slice(begin, end);
const observeGit = new Function('execFileSync', `${literal}\nreturn observeGit;`)(execFileSync);
const receipt = { startedAt: new Date().toISOString(), scope: 'Exact extracted metadata helper plus genuine read-only Git process; not sourceCheckoutPins clean-checkout qualification or native execution', donor, node: process.version, executable: process.execPath, helperSha256: hash(helper), helperLiteralSha256: hash(literal), extraction: { beginOffset: begin, endOffset: end }, bounds: { maxBuffer: 16777216, timeoutMs: 20000, killSignal: 'SIGKILL' }, runtimeStarted: false };
process.chdir(donor);
try {
  const before = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  receipt.before = { unexpectedlySucceeded: true, bytes: Buffer.byteLength(before), sha256: hash(before) };
} catch (error) {
  const stdout = error.stdout == null ? Buffer.alloc(0) : Buffer.from(error.stdout);
  const stderr = error.stderr == null ? Buffer.alloc(0) : Buffer.from(error.stderr);
  writeFileSync(resolve(evidence, 'before.stdout.bin'), stdout, { flag: 'wx' });
  writeFileSync(resolve(evidence, 'before.stderr.bin'), stderr, { flag: 'wx' });
  receipt.before = { unexpectedlySucceeded: false, code: error.code, status: error.status, signal: error.signal, message: error.message, capturedStdoutBytes: stdout.length, capturedStdoutSha256: hash(stdout), capturedStderrSha256: hash(stderr) };
}
const after = observeGit(['ls-files', '-z']);
writeFileSync(resolve(evidence, 'after.filenames.bin'), after, { flag: 'wx' });
const independent = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 16777216, timeout: 20000, killSignal: 'SIGKILL' });
assert.deepEqual(Buffer.from(after), independent);
const names = after.split('\0'); assert.equal(names.pop(), '');
receipt.after = { bytes: Buffer.byteLength(after), filenames: names.length, uniqueFilenames: new Set(names).size, sha256: hash(after), independentRawGitSha256: hash(independent), exactFullOutputMatches: true, noNamesFilteredOrOmitted: true };
try {
  observeGit(['--git-dir=' + resolve(evidence, 'initially-absent-gitdir'), 'rev-parse', 'HEAD']);
  throw new Error('Missing Git directory unexpectedly succeeded');
} catch (error) {
  assert.ok(error.gitObservation, 'Retain real bounded Git failure fields');
  assert.notEqual(error.gitObservation.status, 0);
  assert.match(error.gitObservation.stderr, /not a git repository/);
  receipt.realFailureControl = error.gitObservation;
}
assert.equal(hash(readFileSync(resolve(own, 'tests/lib/scoped-locality-containment.mjs'))), receipt.helperSha256);
receipt.sourceUnchanged = true; receipt.completedAt = new Date().toISOString();
writeFileSync(resolve(evidence, 'GIT-ENUMERATION-PREFLIGHT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ originalDefaultFailed: !receipt.before.unexpectedlySucceeded, afterBytes: receipt.after.bytes, filenames: names.length, exactFullOutput: true, realFailureRetained: true, runtimeStarted: false }));
