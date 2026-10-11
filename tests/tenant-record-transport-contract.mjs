// Lightweight transport doubles only: no network, listener, Worker, D1 or build.
import nativeAssert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boundedTenantRequest, createBoundedTenantTransport } from './lib/tenant-record-transport.mjs';

const output = 'tests/reports/tenant-record-transport-contract'; mkdirSync(output, { recursive: true });
const resultPath = `${output}/result.json`, hash = value => createHash('sha256').update(value).digest('hex');
if (existsSync(resultPath)) writeFileSync(`${output}/prior-result.json`, readFileSync(resultPath));
const assertions = [], controls = [], expectedIds = Array.from({ length: 11 }, (_, i) => `TT-C${String(i + 1).padStart(2, '0')}`);
let activeId = 'setup', passed = 0, failed = 0;
const record = (method, outcome, error) => {
  assertions.push({ controlId: activeId, method, outcome, ...(error ? { error: String(error.stack ?? error) } : {}) });
  outcome === 'passed' ? passed++ : failed++;
};
const assert = Object.fromEntries(['ok', 'equal', 'deepEqual', 'match', 'rejects'].map(method => [method, (...args) => {
  try {
    const result = nativeAssert[method](...args);
    if (result?.then) return result.then(value => { record(method, 'passed'); return value; }, error => { record(method, 'failed', error); throw error; });
    record(method, 'passed'); return result;
  } catch (error) { record(method, 'failed', error); throw error; }
}]));
const result = { suite: 'unit/tenant-record-transport-contract', status: 'running', countKind: 'actual-assertion-calls',
  environment: 'Explicit in-process fetch/stream doubles; no actual HTTP or native Worker', nativeScenariosExecuted: 0,
  passed: 0, failed: 0, skipped: 0, controlCount: 0, controls, assertions,
  sourcePins: Object.fromEntries(['tests/tenant-record-transport-contract.mjs', 'tests/lib/tenant-record-transport.mjs'].map(file => [file, hash(readFileSync(file))])) };
const save = () => { result.passed = passed; result.failed = failed; result.controlCount = controls.length; writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n'); };
save();
const control = async (id, fn) => {
  activeId = id; const entry = { id, outcome: 'running', receipts: [] }; controls.push(entry); save();
  try { await fn(entry); entry.outcome = 'passed'; }
  catch (error) { entry.outcome = 'failed'; entry.error = String(error.stack ?? error); }
  save();
};
const observe = entry => receipt => entry.receipts.push(structuredClone(receipt));
const tick = () => new Promise(resolve => setImmediate(resolve));
const base = 'http://127.0.0.1:19991';

await control('TT-C01', async entry => {
  let actual;
  const api = createBoundedTenantTransport(base, { onEvidence: observe(entry), fetchImpl: async (url, init) => {
    actual = { url: String(url), ...init }; return new Response('{"error":"original conflict"}', { status: 409, headers: { 'cache-control': 'no-store' } });
  } });
  const response = await api.call({ headers: { 'oai-authenticated-user-id': 'synthetic-principal' } }, '/api/commands',
    { method: 'POST', org: 'synthetic-org', body: { type: 'fixture' }, headers: { 'Idempotency-Key': 'same-attempt' } });
  assert.equal(actual.url, `${base}/api/commands`); assert.equal(actual.method, 'POST'); assert.equal(actual.redirect, 'manual');
  assert.equal(actual.body, '{"type":"fixture"}'); assert.equal(actual.headers['x-saha-organisation'], 'synthetic-org');
  assert.equal(actual.headers['Idempotency-Key'], 'same-attempt'); assert.equal(actual.headers['Content-Type'], 'application/json');
  assert.equal(actual.headers['oai-authenticated-user-id'], 'synthetic-principal');
  assert.equal(response.status, 409); assert.deepEqual(response.json, { error: 'original conflict' });
  assert.equal(entry.receipts.at(-1).completeBody, true);
});
await control('TT-C02', async entry => {
  const bytes = Uint8Array.from([0, 255, 1, 128, 13]), response = await boundedTenantRequest(base, '/api/media/fixture', {}, {
    onEvidence: observe(entry), fetchImpl: async () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } }),
  });
  assert.deepEqual([...response.bytes], [...bytes]); assert.equal(response.status, 200);
  assert.equal(entry.receipts.at(-1).partialBodySha256, hash(bytes));
  assert.deepEqual([...Buffer.from(entry.receipts.at(-1).partialBodyBase64, 'base64')], [...bytes]);
});
await control('TT-C03', async entry => {
  let calls = 0, signal; const started = performance.now();
  await assert.rejects(boundedTenantRequest(base, '/api/workspace', {}, { timeoutMs: 20, onEvidence: observe(entry), fetchImpl: (_, init) => {
    calls++; signal = init.signal; return new Promise(() => {});
  } }), { code: 'TENANT_HTTP_TIMEOUT' });
  assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.ok(performance.now() - started < 2000);
  assert.equal(entry.receipts.at(-1).actualHttpStatus, null); assert.equal(entry.receipts.at(-1).completeBody, false);
});
await control('TT-C04', async entry => {
  const partial = 'partial synthetic response'; let cancelRequested = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(partial)); },
    pull() { return new Promise(() => {}); }, cancel() { cancelRequested = true; } });
  await assert.rejects(boundedTenantRequest(base, '/api/patients', {}, { timeoutMs: 20, onEvidence: observe(entry),
    fetchImpl: async () => new Response(body, { status: 200, headers: { 'cache-control': 'no-store' } }),
  }), { code: 'TENANT_HTTP_TIMEOUT' });
  await tick(); const last = entry.receipts.at(-1);
  assert.equal(last.actualHttpStatus, 200); assert.equal(last.status, 'failed'); assert.equal(last.completeBody, false);
  assert.equal(last.partialBodySha256, hash(partial)); assert.equal(last.headers['cache-control'], 'no-store');
  assert.equal(cancelRequested, true); assert.equal(last.cancelRequested, true);
});
await control('TT-C05', async entry => {
  let release, calls = 0;
  await assert.rejects(boundedTenantRequest(base, '/api/workspace', {}, { timeoutMs: 20, onEvidence: observe(entry), fetchImpl: () => {
    calls++; return new Promise(resolve => { release = resolve; });
  } }), { code: 'TENANT_HTTP_TIMEOUT' });
  release(new Response('{"late":true}', { status: 200 })); await tick();
  assert.equal(calls, 1); assert.equal(entry.receipts.at(-1).status, 'failed');
  assert.equal(entry.receipts.some(receipt => receipt.status === 'completed'), false);
});
await control('TT-C06', async entry => {
  let read = 0, release;
  const reader = { read() { if (read++ === 0) return Promise.resolve({ done: false, value: new TextEncoder().encode('before-timeout') });
    return new Promise(resolve => { release = resolve; }); }, cancel() { return new Promise(() => {}); }, releaseLock() {} };
  await assert.rejects(boundedTenantRequest(base, '/api/media/fixture', {}, { timeoutMs: 20, onEvidence: observe(entry), fetchImpl: async () => ({
    status: 200, headers: new Headers({ 'cache-control': 'no-store' }), body: { getReader: () => reader },
  }) }), { code: 'TENANT_HTTP_TIMEOUT' });
  release({ done: false, value: new TextEncoder().encode('after-timeout') }); await tick();
  assert.equal(entry.receipts.at(-1).status, 'failed'); assert.equal(entry.receipts.at(-1).completeBody, false);
  assert.equal(entry.receipts.at(-1).partialBodySha256, hash('before-timeout'));
  assert.equal(entry.receipts.some(receipt => receipt.status === 'completed'), false);
});
await control('TT-C07', async entry => {
  let read = 0, signal; const fault = Object.assign(new Error('controlled body fault'), { code: 'CONTROLLED_BODY_FAULT' });
  const reader = { read() { return read++ === 0 ? Promise.resolve({ done: false, value: new TextEncoder().encode('retained before fault') }) : Promise.reject(fault); },
    cancel() {}, releaseLock() {} };
  await assert.rejects(boundedTenantRequest(base, '/api/patients', {}, { onEvidence: observe(entry), fetchImpl: async (_, init) => {
    signal = init.signal; return { status: 202, headers: new Headers(), body: { getReader: () => reader } };
  } }), { code: 'CONTROLLED_BODY_FAULT' });
  assert.equal(signal.aborted, true); assert.equal(entry.receipts.at(-1).actualHttpStatus, 202);
  assert.equal(entry.receipts.at(-1).partialBodySha256, hash('retained before fault')); assert.equal(entry.receipts.at(-1).completeBody, false);
});
await control('TT-C08', async entry => {
  await assert.rejects(boundedTenantRequest(base, '/api/patients', {}, { maxResponseBytes: 4, onEvidence: observe(entry),
    fetchImpl: async () => new Response('12345678', { status: 403 }),
  }), { code: 'TENANT_RESPONSE_CUSTODY_LIMIT' });
  assert.equal(entry.receipts.at(-1).actualHttpStatus, 403); assert.equal(entry.receipts.at(-1).partialBodyBytes, 8);
  assert.equal(entry.receipts.at(-1).partialBodySha256, hash('12345678')); assert.equal(entry.receipts.at(-1).status, 'failed');
});
await control('TT-C09', async () => {
  let calls = 0; const fetchImpl = () => { calls++; throw new Error('Must never reach a foreign origin'); };
  await assert.rejects(boundedTenantRequest(base, '//example.invalid/api', {}, { fetchImpl }), /loopback/);
  await assert.rejects(boundedTenantRequest('https://127.0.0.1:19991', '/api', {}, { fetchImpl }), /loopback/);
  await assert.rejects(boundedTenantRequest(base, '/api', {}, { timeoutMs: 0, fetchImpl }), /deadline/);
  assert.equal(calls, 0);
});
await control('TT-C10', async entry => {
  let calls = 0;
  const response = await createBoundedTenantTransport(base, { onEvidence: observe(entry), fetchImpl: async () => {
    calls++; return new Response('original upstream failure text', { status: 503, headers: { 'cache-control': 'no-store' } });
  } }).get(null, '/api/patients');
  assert.equal(calls, 1); assert.equal(response.status, 503); assert.equal(response.text, 'original upstream failure text');
  assert.equal(response.json, null); assert.equal(entry.receipts.at(-1).completeBody, true);
});
await control('TT-C11', async entry => {
  // Every read resolves in the microtask queue. Small CPU work guarantees that
  // this responsive stream crosses the unchanged deadline before timers run.
  const headers = new Headers({ 'cache-control': 'no-store' });
  let reads = 0, cancelRequested = false, timerTurn = false;
  const timerProbe = setTimeout(() => { timerTurn = true; }, 0);
  const started = performance.now(), timeoutMs = 20;
  const reader = { read() {
    reads++;
    const until = performance.now() + 2;
    while (performance.now() < until) { /* Controlled in-process microtask CPU work only. */ }
    return Promise.resolve(reads <= 100 ? { done: false, value: Uint8Array.of(1) } : { done: true });
  }, cancel() { cancelRequested = true; }, releaseLock() {} };
  try {
    await assert.rejects(boundedTenantRequest(base, '/api/controlled-responsive-stream', {}, {
      timeoutMs, onEvidence: observe(entry), fetchImpl: async () => ({ status: 200, headers, body: { getReader: () => reader } }),
    }), { code: 'TENANT_HTTP_TIMEOUT' });
    entry.elapsedMs = performance.now() - started; entry.bodyReads = reads; entry.timerTurnAtRefusal = timerTurn;
    const last = entry.receipts.at(-1);
    assert.equal(timerTurn, false); assert.ok(reads > 0 && reads < 101); assert.ok(entry.elapsedMs >= timeoutMs && entry.elapsedMs < 2000);
    assert.equal(last.actualHttpStatus, 200); assert.equal(last.timedOut, true); assert.equal(last.status, 'failed');
    assert.equal(last.completeBody, false); assert.equal(last.partialBodyBytes, reads);
    assert.equal(cancelRequested, true); assert.equal(entry.receipts.some(receipt => receipt.status === 'completed'), false);
  } finally { clearTimeout(timerProbe); }
});
activeId = 'control-ledger-guard';
try {
  assert.deepEqual(controls.map(control => control.id), expectedIds);
  assert.equal(new Set(controls.map(control => control.id)).size, 11);
  assert.equal(controls.every(control => control.outcome === 'passed'), true);
} catch (error) { result.guardError = String(error.stack ?? error); }
result.status = controls.every(control => control.outcome === 'passed') && !result.guardError && failed === 0 ? 'passed' : 'failed';
result.controlCountKind = 'executed in-process transport controls'; save();
process.exitCode = result.status === 'passed' ? 0 : 1;
console.log(JSON.stringify({ suite: result.suite, status: result.status, countKind: result.countKind, passed, failed, skipped: 0,
  controlCount: controls.length, nativeScenariosExecuted: 0, resultFile: resultPath }));
