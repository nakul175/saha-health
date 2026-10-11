import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Execute the real production monitoring/identity modules. Only the Workers env
// binding and D1 transport are controlled Node collaborators; no writer logic is
// copied into this fixture. Native/hosted/device qualification is separate.
const originalRoutes = JSON.parse(readFileSync('tests/fixtures/request-metric-routes-main.json', 'utf8'));
const moduleInputs = Object.fromEntries(['monitoring', 'identity', 'request-metric-routes'].filter(name => existsSync(`lib/saha/${name}.ts`)).map(name => [name, readFileSync(`lib/saha/${name}.ts`, 'utf8')]));
const sourceHashes = Object.fromEntries(Object.entries(moduleInputs).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')]));
const driverSha256 = createHash('sha256').update(readFileSync('tests/request-metric-privacy-contract.mjs')).digest('hex');
const fixtureSha256 = createHash('sha256').update(readFileSync('tests/fixtures/request-metric-routes-main.json')).digest('hex');
const directory = mkdtempSync(join(tmpdir(), 'saha-metric-contract-'));
const runtime = { SAHA_IDENTITY_PROVIDER: 'sites-chatgpt' };
globalThis.sahaMetricContractEnvironment = runtime;
writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n');
writeFileSync(join(directory, 'test-env.js'), 'export const env=globalThis.sahaMetricContractEnvironment;\n');
for (const [name, source] of Object.entries(moduleInputs)) {
  const transformed = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace("from 'cloudflare:workers'", "from './test-env.js'")
    .replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${path.endsWith('.js') ? path : path + '.js'}'`);
  writeFileSync(join(directory, name + '.js'), transformed);
}

const results = [];
const realLog = console.log, realError = console.error;
const capturedLogs = [], capturedErrors = [];
console.log = (...values) => capturedLogs.push(values);
console.error = (...values) => capturedErrors.push(values);
let measured;
const statusOf = response => response.status;
const sentinel = 'SYNTHETIC-NARRATIVE-AND-CREDENTIAL-PRIVATE-441';
const headers = () => new Headers({
  'oai-authenticated-user-id': 'synthetic-metric-actor',
  'oai-authenticated-user-email': 'metric-fixture@example.invalid',
  'x-saha-organisation': 'synthetic-metric-organisation',
  authorization: 'Bearer ' + sentinel,
});
let statements = [], batches = [], actions = 0;
function reset() {
  capturedLogs.length = 0; capturedErrors.length = 0;
  statements = []; batches = []; actions = 0;
  runtime.SAHA_IDENTITY_PROVIDER = 'sites-chatgpt';
  delete runtime.SAHA_ACCESS_TEAM_DOMAIN; delete runtime.SAHA_ACCESS_AUD;
  runtime.DB = {
    prepare(sql) {
      const statement = { sql, args: [], bind(...args) { this.args = args; return this; }, async first() { return { active_org_id: 'synthetic-active-organisation' }; } };
      statements.push(statement); return statement;
    },
    async batch(batch) { batches.push(batch); return batch.map(() => ({ success: true, meta: { changes: 1 } })); },
  };
}
const insert = () => statements.find(x => x.sql.startsWith('INSERT INTO request_metrics'));
const envelope = () => {
  assert.equal(capturedLogs.length, 1);
  assert.equal(capturedLogs[0].length, 1);
  return JSON.parse(capturedLogs[0][0]);
};
async function run(label, route, options = {}) {
  reset();
  const request = options.request ?? new Request('https://synthetic.invalid/api/media/patient-private?notes=' + sentinel, { headers: headers() });
  const response = options.response ?? new Response(sentinel, { status: options.status ?? 200 });
  const returned = await measured(request, route, async () => { actions++; return response; });
  assert.strictEqual(returned, response, 'the original response object is preserved');
  assert.equal(actions, 1, 'no action or command retry');
  assert.equal(statusOf(returned), options.status ?? 200);
  const event = envelope();
  assert.deepEqual(Object.keys(event), ['event', 'requestId', 'route', 'status', 'durationMs']);
  assert.equal(event.event, 'saha_request'); assert.equal(event.route, label);
  assert.equal(event.status, statusOf(response));
  assert.match(event.requestId, /^[a-f0-9-]{36}$/); assert.equal(returned.headers.get('X-Saha-Request-Id'), event.requestId);
  assert.equal(returned.headers.get('Referrer-Policy'), 'no-referrer');
  assert.ok(Number.isInteger(event.durationMs) && event.durationMs >= 0);
  assert.equal(insert().args[2], label); assert.equal(insert().args[3], statusOf(response));
  assert.equal(insert().args[4], event.durationMs); assert.equal(insert().args[5], event.durationMs);
  assert.ok(!JSON.stringify(capturedLogs).includes(sentinel));
  assert.ok(!JSON.stringify(capturedErrors).includes(sentinel));
  assert.ok(!JSON.stringify(insert().args).includes(sentinel));
  return { request, response, returned, event };
}
async function check(label, action) {
  try { await action(); results.push({ label, passed: true }); }
  catch (failure) { results.push({ label, passed: false, error: String(failure) }); }
}

try {
  ({ measured } = await import(pathToFileURL(join(directory, 'monitoring.js')).href));
  for (const route of originalRoutes.routes) await check(`M1 original route ${route}`, () => run(route, route));
  const rejected = [
    ['URL/path/query', 'https://synthetic.invalid/api/patients/private?notes=' + sentinel],
    ['patient object key', 'patient-private-441'], ['narrative', sentinel],
    ['recording marker', 'RAWRECORDING-' + sentinel], ['credential', 'Bearer ' + sentinel],
    ['known route with sensitive suffix', 'patients/' + sentinel],
    ['query on known route', 'patients?token=' + sentinel], ['linebreak', 'patients\n' + sentinel],
    ['oversized', 'x'.repeat(100_000) + sentinel], ['case variant', 'PATIENTS'],
    ['whitespace', ' patients '], ['empty', ''], ['null', null], ['undefined', undefined],
    ['array', ['patients', sentinel]], ['number', 441],
    ['coercion must not run', { toString() { throw new Error('Do not coerce ' + sentinel); } }],
  ];
  for (const [label, route] of rejected) await check(`M2 unclassified ${label}`, () => run('unclassified', route));
  for (const status of [403, 409, 422, 503]) await check(`M3 original refusal/error ${status}`, () => run('patients', 'patients', { status }));
  await check('M3 metrics upsert and prune semantics unchanged', async () => {
    await run('commands', 'commands');
    assert.equal(batches.length, 1); assert.equal(batches[0].length, 2);
    assert.match(insert().sql, /count=count\+1,total_ms=total_ms\+excluded.total_ms,max_ms=max\(max_ms,excluded.max_ms\)/);
    assert.match(insert().sql, /WHERE EXISTS \(SELECT 1 FROM memberships WHERE org_id=\? AND user_id=\? AND status='active'\)/);
    assert.deepEqual(insert().args.slice(6), ['synthetic-metric-organisation', 'synthetic-metric-actor']);
    assert.match(batches[0][1].sql, /DELETE FROM request_metrics WHERE org_id=\? AND route NOT LIKE 'burden:%' AND bucket<\?/);
    assert.match(batches[0][1].sql, /AND EXISTS \(SELECT 1 FROM memberships WHERE org_id=\? AND user_id=\? AND status='active'\)/);
    assert.deepEqual(batches[0][1].args.slice(2), ['synthetic-metric-organisation', 'synthetic-metric-actor']);
    const cutoff = Date.parse(batches[0][1].args[1]); assert.ok(Math.abs(Date.now() - cutoff - 30 * 86400000) < 5000);
  });
  for (const identity of ['anonymous', 'fixture:reserved', 'system', 'system:reserved']) await check(`M4 no authenticated metric for ${identity}`, async () => {
    reset(); const h = headers(); if (identity === 'anonymous') h.delete('oai-authenticated-user-id'); else h.set('oai-authenticated-user-id', identity);
    const response = await measured(new Request('https://synthetic.invalid/', { headers: h }), 'patients', async () => new Response('denied', { status: 401 }));
    assert.equal(response.status, 401); assert.equal(statements.length, 0); assert.equal(batches.length, 0);
    assert.equal(envelope().route, 'patients'); assert.ok(!JSON.stringify(capturedLogs).includes(sentinel));
  });
  await check('M4 selected Access provider ignores public Sites headers', async () => {
    reset(); runtime.SAHA_IDENTITY_PROVIDER = 'cloudflare-access';
    runtime.SAHA_ACCESS_TEAM_DOMAIN = 'synthetic-fixture.cloudflareaccess.com'; runtime.SAHA_ACCESS_AUD = 'a'.repeat(32);
    await measured(new Request('https://synthetic.invalid/', { headers: headers() }), 'patients', async () => new Response('denied', { status: 401 }));
    assert.equal(statements.length, 0); assert.equal(batches.length, 0); assert.equal(envelope().route, 'patients');
  });
  await check('M4 invalid identity configuration gives no authenticated metric', async () => {
    reset(); runtime.SAHA_IDENTITY_PROVIDER = 'invalid-' + sentinel;
    await measured(new Request('https://synthetic.invalid/', { headers: headers() }), 'patients', async () => new Response('denied', { status: 503 }));
    assert.equal(statements.length, 0); assert.equal(batches.length, 0); assert.ok(!JSON.stringify(capturedLogs).includes(sentinel));
  });
  await check('M4 account default organisation uses existing identity lookup', async () => {
    reset(); const h = headers(); h.delete('x-saha-organisation');
    await measured(new Request('https://synthetic.invalid/', { headers: h }), 'patients', async () => new Response('ok'));
    assert.deepEqual(statements[0].args, ['synthetic-metric-actor']); assert.equal(insert().args[0], 'synthetic-active-organisation');
    assert.ok(!JSON.stringify(capturedLogs).includes('synthetic-active-organisation'));
  });
  await check('M5 failed metrics storage logs only fixed message and preserves response', async () => {
    reset(); runtime.DB.batch = async () => { throw new Error(sentinel); };
    const original = new Response(sentinel, { status: 409 });
    const response = await measured(new Request('https://synthetic.invalid/', { headers: headers() }), 'patients', async () => original);
    assert.strictEqual(response, original); assert.equal(await response.text(), sentinel);
    assert.deepEqual(capturedErrors, [['Saha request metrics unavailable']]); assert.ok(!JSON.stringify(capturedLogs).includes(sentinel));
  });
  await check('M5 unused request body is drained without logging it', async () => {
    const request = new Request('https://synthetic.invalid/', { method: 'POST', headers: headers(), body: sentinel });
    await run('commands', 'commands', { request, status: 422 }); assert.equal(request.bodyUsed, true);
  });
  await check('M5 action rejection propagates before metrics/logging', async () => {
    reset(); const original = new Error(sentinel);
    await assert.rejects(measured(new Request('https://synthetic.invalid/', { headers: headers() }), 'patients', async () => { throw original; }), error => error === original);
    assert.equal(statements.length, 0); assert.equal(capturedLogs.length, 0); assert.equal(capturedErrors.length, 0);
  });
  await check('M6 exact executed inputs remain unchanged after run', async () => {
    for (const [name, hash] of Object.entries(sourceHashes)) assert.equal(createHash('sha256').update(readFileSync(`lib/saha/${name}.ts`)).digest('hex'), hash);
    assert.equal(createHash('sha256').update(readFileSync('tests/request-metric-privacy-contract.mjs')).digest('hex'), driverSha256);
    assert.equal(createHash('sha256').update(readFileSync('tests/fixtures/request-metric-routes-main.json')).digest('hex'), fixtureSha256);
  });
} finally {
  console.log = realLog; console.error = realError;
  delete globalThis.sahaMetricContractEnvironment;
  rmSync(directory, { recursive: true, force: true });
}
const report = {
  suite: 'runtime request metric privacy contract', passed: results.filter(x => x.passed).length,
  failed: results.filter(x => !x.passed).length, skipped: 0, checks: results,
  completedAt: new Date().toISOString(), originalRoutes: originalRoutes.routes.length,
  sourceHashes, driverSha256, fixtureSha256,
  limits: ['Actual production monitoring/identity function; explicit controlled Node Workers-env/D1/log collaborators. Not native HTTP, hosted telemetry, handset durability, full story or formal acceptance. No application action or command implementation is substituted.'],
};
const resultPath = resolve(process.env.SAHA_METRIC_CONTRACT_RESULT ?? 'tests/request-metric-privacy-contract-result.json');
mkdirSync(join(resultPath, '..'), { recursive: true }); writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ suite: report.suite, passed: report.passed, failed: report.failed, resultPath }));
if (report.failed) process.exitCode = 1;
