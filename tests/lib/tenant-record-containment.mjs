// Test-only owned-process containment. No application response, identity, policy or storage mirror.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, openSync, closeSync, existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readExecutionProfile } from '../../scripts/execution-profile.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function inspectOwnedGroup(group) {
  // The short observer gets its own group, so observing the current driver group
  // cannot mistake that observer itself for a surviving migration process.
  const observed = spawnSync('ps', ['-eo', 'pid=,pgid=,ppid=,stat='], { encoding: 'utf8', detached: true, timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 8 << 20 });
  if (observed.error) throw observed.error;
  assert.equal(observed.status, 0, 'Owned process observation failed.'); assert.equal(observed.signal, null);
  const rows = observed.stdout.trim().split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)/.exec(line);
    return m && +m[2] === group ? [{ pid: +m[1], pgid: +m[2], ppid: +m[3], state: m[4] }] : [];
  });
  return { observerPid: observed.pid, observerDetached: true, exitCode: observed.status, signal: observed.signal, targetGroup: group, rows };
}
export const ownedGroupRows = group => inspectOwnedGroup(group).rows;
const groupRows = ownedGroupRows;

/** The only signal targets are the just-created child handle, or its registered detached group.
 * The handle/log streams exist before readiness. No process name or unrelated PID search is used. */
export async function runOwnedCommand(command, args, { cwd = process.cwd(), env = process.env, stdout, stderr, timeoutMs, graceMs = 1000, detached = true, onSpawn = () => {}, abortSignal } = {}) {
  assert.ok(['darwin', 'linux'].includes(process.platform), 'Owned POSIX process groups require macOS or Linux.');
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0, 'A finite command deadline is required.');
  assert.ok(Number.isInteger(graceMs) && graceMs > 0);
  assert.equal(abortSignal?.aborted ?? false, false, 'Do not spawn after supervisor cancellation.');
  // Refuse before creating any child when this environment cannot verify disposal.
  // Late inspection loss still fails/unverifies cleanup; it never permits a blind
  // signal to a stale group or an invented empty-group observation.
  if (detached) inspectOwnedGroup(-1);
  // Exclusive log files must exist before any child can start. Synchronous open failure
  // cannot leave an unrecorded process running; roll back only our newly opened handle.
  const descriptors = [];
  try { for (const file of [stdout, stderr]) descriptors.push(openSync(file, 'wx')); }
  catch (error) { for (const fd of descriptors) closeSync(fd); throw error; }
  const startedAt = new Date().toISOString(), started = performance.now();
  const record = { command, args, startedAt, pid: null, registeredGroup: null, cleanupScope: detached ? 'registered own process group' : 'direct child only; outer registered driver group contains descendants', timeoutMs, graceMs, timedOut: false, cancelled: false, exitCode: null, signal: null, spawnError: null, cleanupErrors: [], signals: [], outputErrors: [], groupBeforeCleanup: [], liveGroupAfterCleanup: null, zombieGroupAfterCleanup: [] };
  const streams = []; let child;
  try {
    for (const fd of descriptors) { const stream = createWriteStream(null, { fd, autoClose: true }); stream.on('error', error => record.outputErrors.push(String(error.message))); streams.push(stream); }
    child = spawn(command, args, { cwd, env, detached, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    record.spawnError = `synchronous ownership setup: ${String(error.message)}`;
    await Promise.all(streams.map(stream => new Promise(resolve => {
      if (stream.closed) return resolve();
      const limit = setTimeout(() => { record.outputErrors.push('setup log close deadline exceeded'); resolve(); }, 2000);
      stream.once('close', () => { clearTimeout(limit); resolve(); }); stream.destroy();
    })));
    for (const fd of descriptors.slice(streams.length)) { try { closeSync(fd); } catch (closeError) { record.cleanupErrors.push(String(closeError.message)); } }
    record.completedAt = new Date().toISOString(); record.ms = performance.now() - started; record.ok = false;
    return record;
  }
  record.pid = child.pid ?? null; record.registeredGroup = detached ? child.pid ?? null : null;
  const signalOwned = signal => {
    if (!child.pid) return;
    try { process.kill(detached ? -child.pid : child.pid, signal); record.signals.push(signal); }
    catch (error) { if (error.code !== 'ESRCH') record.cleanupErrors.push(String(error.message)); }
  };
  let force, pipeDeadline;
  let complete;
  const closed = new Promise(resolve => { complete = resolve; child.once('error', error => { record.spawnError = String(error.message); }); child.once('exit', (code, signal) => { record.exitCode = code; record.signal = signal; }); child.once('close', resolve); });
  const beginTermination = () => {
    if (force || pipeDeadline) return; // One bounded shutdown, even after repeated supervisor signals.
    signalOwned('SIGTERM');
    force = setTimeout(() => signalOwned('SIGKILL'), graceMs);
    // A descendant holding a pipe must not make the helper's close wait unbounded.
    // This is a failed attempt; the outer detached driver still cleans its own group.
    pipeDeadline = setTimeout(() => { record.cleanupErrors.push('stdio close deadline exceeded'); child.stdout.destroy(); child.stderr.destroy(); complete(); }, graceMs + 2000);
  };
  const cancellation = () => { record.cancelled = true; if (active) beginTermination(); };
  const timer = setTimeout(() => { record.timedOut = true; beginTermination(); }, timeoutMs);
  let active = true;
  try {
    const readableError = error => { record.outputErrors.push(`child pipe/log: ${String(error.message)}`); if (active) beginTermination(); };
    child.stdout.on('error', readableError); child.stderr.on('error', readableError);
    for (const stream of streams) stream.on('error', readableError);
    abortSignal?.addEventListener('abort', cancellation, { once: true });
    if (abortSignal?.aborted) cancellation();
    try { child.stdout.pipe(streams[0]); child.stderr.pipe(streams[1]); }
    catch (error) { record.outputErrors.push(`pipe setup: ${String(error.message)}`); beginTermination(); }
    try { onSpawn({ pid: child.pid ?? null, registeredGroup: record.registeredGroup }); }
    catch (error) { record.cleanupErrors.push(`handle registration: ${String(error.message)}`); beginTermination(); }
    await closed;
  } finally {
    active = false;
    clearTimeout(timer); clearTimeout(force); clearTimeout(pipeDeadline);
    // Child exit is not proof that its native descendants exited. Inspect and clean its own
    // original group only; after the first empty observation never signal that ID again.
    if (detached && child.pid) {
      try {
        const rows = groupRows(child.pid); record.groupBeforeCleanup = rows;
        let live = rows.filter(row => !row.state.startsWith('Z'));
        if (live.length) {
          signalOwned('SIGTERM');
          const deadline = performance.now() + graceMs;
          while (live.length && performance.now() < deadline) { await sleep(25); live = groupRows(child.pid).filter(row => !row.state.startsWith('Z')); }
          if (live.length) {
            signalOwned('SIGKILL');
            const killDeadline = performance.now() + 1000;
            while (live.length && performance.now() < killDeadline) { await sleep(25); live = groupRows(child.pid).filter(row => !row.state.startsWith('Z')); }
          }
        }
        const final = groupRows(child.pid); record.liveGroupAfterCleanup = final.filter(row => !row.state.startsWith('Z')); record.zombieGroupAfterCleanup = final.filter(row => row.state.startsWith('Z'));
      } catch (error) { record.cleanupErrors.push(String(error.message)); }
    } else record.liveGroupAfterCleanup = null; // Never claim descendant inspection for a direct-child migration command.
    await Promise.all(streams.map(stream => new Promise(resolve => {
      if (stream.closed) return resolve();
      const limit = setTimeout(() => { record.outputErrors.push('log close deadline exceeded'); stream.destroy(); resolve(); }, 2000);
      stream.once('close', () => { clearTimeout(limit); resolve(); }); stream.end();
    })));
    record.cancelled ||= abortSignal?.aborted ?? false;
    abortSignal?.removeEventListener('abort', cancellation);
  }
  record.completedAt = new Date().toISOString(); record.ms = performance.now() - started;
  record.ok = record.exitCode === 0 && record.signal === null && !record.timedOut && !record.cancelled && !record.spawnError && !record.outputErrors.length && !record.cleanupErrors.length && (!detached || (Array.isArray(record.liveGroupAfterCleanup) && record.liveGroupAfterCleanup.length === 0));
  return record;
}

export async function deadline(label, operation, timeoutMs) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms deadline`)), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}

export function fileTreePins(directory) {
  assert.ok(existsSync(directory), `Missing pinned directory: ${directory}`);
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name), stat = lstatSync(path);
    assert.equal(stat.isSymbolicLink(), false, `Do not follow an unreviewed fixture symlink: ${path}`);
    return stat.isDirectory() ? Object.entries(fileTreePins(path)) : [[path, sha256(readFileSync(path))]];
  }));
}
export function sourceCheckoutPins(extraFiles = []) {
  const metadataOptions = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' };
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], metadataOptions).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], metadataOptions).trim();
  assert.equal(execFileSync('git', ['diff', '--name-only'], metadataOptions), '', 'Tracked source differs from its exact checkout commit.');
  assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], metadataOptions), '', 'Staged source differs from its exact checkout commit.');
  const files = [...new Set([...execFileSync('git', ['ls-files', '-z'], metadataOptions).split('\0').filter(Boolean), ...extraFiles])].sort();
  const pins = Object.fromEntries(files.map(file => [file, sha256(readFileSync(resolve(file)))]));
  const profile = '.sites-runtime/execution-profile.json';
  const buildLocalSelection = { executionProfile: readExecutionProfile(), profileFile: profile, profileFilePresent: existsSync(profile), profileFileSha256: existsSync(profile) ? sha256(readFileSync(profile)) : null };
  assert.equal(buildLocalSelection.executionProfile, 'portable', 'This isolated CI/local fixture qualifies the existing portable profile only.');
  return { checkoutCommit: commit, checkoutTree: tree, files: pins, buildLocalSelection };
}
