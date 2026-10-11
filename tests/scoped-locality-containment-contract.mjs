// BR-ID-02 / APL-194: lightweight real process/lifecycle controls only.
// No application build, Worker, browser, network, policy fixture or native D1 is started.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';
import { suite } from './lib/report.mjs';
import { runOwnedCommand, deadline, GEO_LABELS, CUSTODY_LABELS, validateLocalityResult, sha256 } from './lib/scoped-locality-containment.mjs';
import { ownedLocalityRuntime } from './lib/scoped-locality-native-runtime.mjs';

const resultFile = resolve(process.env.SAHA_SCOPED_CONTAINMENT_RESULT ?? 'tests/reports/scoped-locality-containment-contract.json');
assert.equal(existsSync(resultFile), false, 'Retain the prior result; choose a new explicit output for a new attempt.');
const evidence = resolve(process.env.SAHA_SCOPED_CONTAINMENT_EVIDENCE ?? `tests/reports/scoped-locality-containment-attempt-${crypto.randomUUID()}`);
assert.equal(existsSync(evidence), false, 'Never overwrite a retained lifecycle attempt.'); mkdirSync(evidence, { recursive: true });
const INPUTS = ['tests/scoped-locality-containment-contract.mjs', 'tests/lib/scoped-locality-containment.mjs', 'tests/lib/scoped-locality-native-runtime.mjs', 'tests/lib/report.mjs', 'scripts/execution-profile.mjs', 'scripts/scoped-locality-runner.mjs', '.github/workflows/scoped-permission-checks.yml'];
const inputHashes = Object.fromEntries(INPUTS.map(file => [file, sha256(readFileSync(file))]));
const receipts = [];
let caseId = 0;
const own = async (code, options = {}) => {
  const name = String(++caseId).padStart(2, '0');
  const record = await runOwnedCommand(process.execPath, ['-e', code], { stdout: join(evidence, `${name}.stdout.log`), stderr: join(evidence, `${name}.stderr.log`), timeoutMs: 3000, graceMs: 200, ...options });
  receipts.push({ ...record, stdoutFile: join(evidence, `${name}.stdout.log`), stderrFile: join(evidence, `${name}.stderr.log`) });
  return record;
};
const r = suite('Scoped locality containment controls (APL-194)', resultFile, { layer: 'unit', environment: 'Actual short-lived owned Node child processes; no application runtime', limits: ['These controls qualify launcher failure handling only.', 'No eight-group native policy result, parent acceptance or hosted execution is claimed.'] });
const validShape = () => ({ passed: 13, failed: 0, skipped: 0, checks: [...GEO_LABELS, ...CUSTODY_LABELS].map(label => ({ label, ok: true })), minimumScenarioChecks: 8, workerDisposed: true, nativeLifecycle: { ready: true, disposed: true, migration: { ok: true }, migrationFiles: 16, migrationDriverGroupMatched: true, migrationDescendantsAfterExit: [] }, sourceChanged: [], contractChanged: [], buildChanged: [], custodyErrors: [], transportErrors: 0, formalAcceptanceClaim: false });
await r.check('complete structured shape is accepted by the validator only', () => assert.equal(validateLocalityResult(validShape()), 13));
await r.check('missing integer counts are refused', () => { const x = validShape(); delete x.passed; assert.throws(() => validateLocalityResult(x)); });
await r.check('nonzero failure and skip counts are refused', () => { for (const field of ['failed', 'skipped']) { const x = validShape(); x[field] = 1; assert.throws(() => validateLocalityResult(x)); } });
await r.check('inflated counts and missing or duplicate GEO groups are refused', () => {
  const inflated = validShape(); inflated.passed++; assert.throws(() => validateLocalityResult(inflated));
  const missing = validShape(); missing.checks.shift(); missing.passed--; assert.throws(() => validateLocalityResult(missing));
  const duplicate = validShape(); duplicate.checks[0].label = duplicate.checks[1].label; assert.throws(() => validateLocalityResult(duplicate));
});
await r.check('missing setup, cleanup, source, contract or build custody is refused', () => {
  for (const field of ['sourceChanged', 'contractChanged', 'buildChanged', 'custodyErrors', 'workerDisposed']) { const x = validShape(); delete x[field]; assert.throws(() => validateLocalityResult(x)); }
  for (const field of ['ready', 'disposed', 'migration', 'migrationFiles', 'migrationDriverGroupMatched', 'migrationDescendantsAfterExit']) { const x = validShape(); delete x.nativeLifecycle[field]; assert.throws(() => validateLocalityResult(x)); }
});
await r.check('transport error and inappropriate formal acceptance claims are refused', () => {
  for (const [field, value] of [['transportErrors', 1], ['formalAcceptanceClaim', true], ['minimumScenarioChecks', 7]]) { const x = validShape(); x[field] = value; assert.throws(() => validateLocalityResult(x)); }
});
await r.check('actual zero exit retains full output and registered own group cleanup', async () => {
  const record = await own("process.stdout.write('x'.repeat(100000)); process.stderr.write('actual-stderr');");
  assert.equal(record.ok, true); assert.equal(record.exitCode, 0); assert.equal(record.signal, null);
  assert.equal(readFileSync(receipts.at(-1).stdoutFile, 'utf8'), 'x'.repeat(100000));
  assert.equal(readFileSync(receipts.at(-1).stderrFile, 'utf8'), 'actual-stderr'); assert.deepEqual(record.liveGroupAfterCleanup, []);
});
await r.check('actual nonzero exit is a failure with retained real stderr', async () => {
  const record = await own("console.error('native-control-exit-seven'); process.exit(7);");
  assert.equal(record.ok, false); assert.equal(record.exitCode, 7); assert.match(readFileSync(receipts.at(-1).stderrFile, 'utf8'), /native-control-exit-seven/);
});
await r.check('actual missing executable yields a recorded failure without an unhandled child error', async () => {
  const record = await runOwnedCommand(join(evidence, 'nonexistent-executable'), [], { stdout: join(evidence, 'missing.stdout.log'), stderr: join(evidence, 'missing.stderr.log'), timeoutMs: 1000, graceMs: 100 });
  receipts.push(record); assert.equal(record.ok, false); assert.match(record.spawnError, /ENOENT/); assert.equal(record.pid, null);
});
await r.check('synchronous invalid spawn setup is recorded without an owned process or open log handles', async () => {
  const out = join(evidence, 'invalid.stdout.log'), err = join(evidence, 'invalid.stderr.log');
  const record = await runOwnedCommand(null, [], { stdout: out, stderr: err, timeoutMs: 1000, graceMs: 100 });
  receipts.push(record); assert.equal(record.ok, false); assert.equal(record.pid, null); assert.match(record.spawnError, /synchronous ownership setup/);
});
await r.check('preexisting exclusive log refuses before spawning', async () => {
  const file = join(evidence, 'existing.log'); writeFileSync(file, 'preserved'); let spawned = false;
  await assert.rejects(runOwnedCommand(process.execPath, ['-e', 'process.exit(0)'], { stdout: file, stderr: join(evidence, 'never.log'), timeoutMs: 1000, onSpawn: () => { spawned = true; } }));
  assert.equal(spawned, false); assert.equal(readFileSync(file, 'utf8'), 'preserved');
});
await r.check('deliberately injected launcher pipe setup fault terminates its actual child and fails', async () => {
  const original = Readable.prototype.pipe; Readable.prototype.pipe = function () { throw new Error('owned-control-pipe-setup-fault'); };
  try { const record = await own('setInterval(()=>{},1000)'); assert.equal(record.ok, false); assert.ok(record.outputErrors.some(error => error.includes('owned-control-pipe-setup-fault'))); assert.deepEqual(record.liveGroupAfterCleanup, []); }
  finally { Readable.prototype.pipe = original; }
});
await r.check('actual registration callback failure terminates only the new child and records failure', async () => {
  const record = await own('setInterval(()=>{}, 1000)', { onSpawn: () => { throw new Error('registration-control-error'); } });
  assert.equal(record.ok, false); assert.ok(record.cleanupErrors.some(error => error.includes('registration-control-error'))); assert.deepEqual(record.liveGroupAfterCleanup, []);
});
await r.check('actual ignored TERM reaches KILL within a finite deadline', async () => {
  const record = await own("process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);", { timeoutMs: 200, graceMs: 100 });
  assert.equal(record.ok, false); assert.equal(record.timedOut, true); assert.ok(record.signals.includes('SIGTERM')); assert.ok(record.signals.includes('SIGKILL'));
  assert.equal(record.signal, 'SIGKILL'); assert.deepEqual(record.liveGroupAfterCleanup, []); assert.ok(record.ms < 5000);
});
await r.check('actual AbortSignal cancellation terminates the registered child group and refuses success', async () => {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 150);
  try { const record = await own('setInterval(()=>{},1000)', { abortSignal: abort.signal }); assert.equal(record.cancelled, true); assert.equal(record.ok, false); assert.deepEqual(record.liveGroupAfterCleanup, []); }
  finally { clearTimeout(timer); }
});
await r.check('actual supervisor TERM cancels and disposes its separately detached registered child', async () => {
  const inner = join(evidence, 'cancelled-supervisor-inner.json');
  const helper = new URL('./lib/scoped-locality-containment.mjs', import.meta.url).href;
  const code = `const {runOwnedCommand}=await import(${JSON.stringify(helper)}); const {writeFileSync}=await import('node:fs'); const a=new AbortController(); process.on('SIGTERM',()=>a.abort()); const r=await runOwnedCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{stdout:${JSON.stringify(join(evidence, 'inner.stdout.log'))},stderr:${JSON.stringify(join(evidence, 'inner.stderr.log'))},timeoutMs:5000,graceMs:100,abortSignal:a.signal});writeFileSync(${JSON.stringify(inner)},JSON.stringify(r));process.exitCode=1;`;
  const record = await own(code, { timeoutMs: 400, graceMs: 1000 });
  assert.equal(record.ok, false); assert.equal(record.timedOut, true); assert.deepEqual(record.liveGroupAfterCleanup, []);
  const actual = JSON.parse(readFileSync(inner, 'utf8')); assert.equal(actual.cancelled, true); assert.equal(actual.ok, false); assert.deepEqual(actual.liveGroupAfterCleanup, []); receipts.push({ nestedSupervisorChild: actual });
});
await r.check('actual exited parent orphan is cleaned only within its registered group', async () => {
  const record = await own("const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); process.exit(0);");
  assert.equal(record.exitCode, 0); assert.ok(record.groupBeforeCleanup.some(row => row.pid !== record.pid && !row.state.startsWith('Z')));
  assert.ok(record.signals.includes('SIGTERM')); assert.deepEqual(record.liveGroupAfterCleanup, []);
});
await r.check('actual independent sentinel group remains alive during timeout cleanup', async () => {
  let ready; const registration = new Promise(resolve => { ready = resolve; });
  const sentinel = own('setTimeout(()=>process.exit(0),1200)', { timeoutMs: 3000, onSpawn: ready });
  const handle = await registration;
  const timed = await own('setInterval(()=>{},1000)', { timeoutMs: 150, graceMs: 100 });
  assert.equal(timed.timedOut, true); assert.equal(process.kill(handle.pid, 0), true, 'Observation only; no signal sent to the other group.');
  const sentinelResult = await sentinel; assert.equal(sentinelResult.ok, true); assert.deepEqual(sentinelResult.signals, []);
});
await r.check('direct-child migration records its incomplete descendant scope honestly', async () => {
  const record = await own('process.exit(0)', { detached: false });
  assert.equal(record.ok, true); assert.equal(record.registeredGroup, null); assert.equal(record.liveGroupAfterCleanup, null); assert.match(record.cleanupScope, /outer registered driver group/);
});
await r.check('actual own-group observation excludes only its separately grouped observer', async () => {
  const observedFile = join(evidence, 'own-group-observation.json'), helper = new URL('./lib/scoped-locality-containment.mjs', import.meta.url).href;
  const code = `const {inspectOwnedGroup}=await import(${JSON.stringify(helper)}); const {writeFileSync}=await import('node:fs'); writeFileSync(${JSON.stringify(observedFile)},JSON.stringify({pid:process.pid,observation:inspectOwnedGroup(process.pid)}));`;
  const record = await own(code); assert.equal(record.ok, true);
  const actual = JSON.parse(readFileSync(observedFile, 'utf8')); assert.equal(actual.observation.observerDetached, true); assert.equal(actual.observation.exitCode, 0);
  assert.deepEqual(actual.observation.rows.map(row => row.pid), [actual.pid]); assert.notEqual(actual.observation.observerPid, actual.pid);
});
await r.check('pending readiness promises have a finite rejection deadline', async () => {
  const started = performance.now(); await assert.rejects(deadline('never-ready-control', () => new Promise(() => {}), 25), /deadline/); assert.ok(performance.now() - started < 1000);
});
await r.check('initially existing native state is refused without modifying it', () => {
  const state = join(evidence, 'existing-state'); mkdirSync(state); const file = join(state, 'preserved'); writeFileSync(file, 'untouched');
  assert.throws(() => ownedLocalityRuntime({ state, evidence, port: 9436 }), /initially absent/); assert.equal(readFileSync(file, 'utf8'), 'untouched');
});
await r.check('deliberately unavailable journal cannot precede disposal of the unstarted owned fixture', async () => {
  const dir = join(evidence, 'journal-control'); mkdirSync(dir);
  const fixture = ownedLocalityRuntime({ state: join(evidence, 'unstarted-state'), evidence: dir, port: 9436 });
  renameSync(dir, join(evidence, 'retained-journal-control'));
  await assert.rejects(fixture.stop(), /evidence could not be retained/); assert.equal(fixture.lifecycle.disposed, true); assert.equal(fixture.lifecycle.ready, false);
});
const afterHashes = Object.fromEntries(INPUTS.map(file => [file, sha256(readFileSync(file))]));
await r.check('control driver helper runner and workflow inputs stay byte-exact through execution', () => assert.deepEqual(afterHashes, inputHashes));
writeFileSync(join(evidence, 'process-receipts.json'), JSON.stringify(receipts, null, 2) + '\n');
await r.finish({ evidence, inputHashes, afterHashes, attemptRecords: receipts.length, actualPIDRecords: receipts.filter(row => Number.isInteger(row.pid ?? row.nestedSupervisorChild?.pid)).length, processReceiptsSha256: sha256(readFileSync(join(evidence, 'process-receipts.json'))), applicationRuntimeStarted: false, localityScenarioExecutionClaim: false, formalAcceptanceClaim: false });
