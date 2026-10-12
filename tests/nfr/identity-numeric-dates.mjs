// SAHA-012 / ENG-BR-ID-03: real built application and disposable synthetic D1.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { startMiniflare } from '../lib/miniflare.mjs';
import { credentialFixture, bindings, team } from '../lib/identity-numeric-date-fixture.mjs';

const output = process.env.SAHA_RESULT_FILE ?? 'tests/reports/identity-numeric-dates-http-result.json';
const port = Number(process.env.SAHA_TEST_PORT ?? '21533');
const state = resolve(join(tmpdir(), `saha-numeric-dates-${randomUUID()}`));
const checks = [], responses = [];
const check = async (name, run) => { try { await run(); checks.push({ name, status: 'pass' }); } catch (error) { checks.push({ name, status: 'fail', error: error.message }); } };
const sourceSha256 = createHash('sha256').update(readFileSync('lib/saha/identity.ts')).digest('hex');
let worker, before, after, disposed = false, fatal;
try {
  const fixture = await credentialFixture(Math.floor(Date.now() / 1000));
  worker = await startMiniflare({ port, name: 'identity-numeric-dates', state, bindings, outboundService: request => {
    const url = new URL(request.url);
    if (url.origin === `https://${team}` && url.pathname === '/cdn-cgi/access/certs') return Response.json({ keys: [fixture.jwk] });
    return new Response('Only the local synthetic key fixture is available.', { status: 502 });
  } });
  const database = await worker.mf.getD1Database('DB');
  const snapshot = async () => {
    const names = (await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_*' ORDER BY name").all()).results.map(row => row.name);
    const tables = {};
    for (const name of names) {
      const rows = (await database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()).results;
      const sorted = rows.map(row => JSON.stringify(row)).sort();
      tables[name] = { rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(sorted)).digest('hex') };
    }
    return tables;
  };
  const request = async (token, path, method = 'GET') => {
    const response = await fetch(worker.base + path, { method, redirect: 'manual', headers: {
      'cf-access-jwt-assertion': token, 'oai-authenticated-user-id': 'ignored-sites-principal', 'oai-authenticated-user-email': 'ignored@example.invalid',
      ...(method === 'POST' ? { 'content-type': 'application/json', 'idempotency-key': randomUUID() } : {}),
    }, ...(method === 'POST' ? { body: JSON.stringify({ type: 'createTeam', name: 'Should never be created' }) } : {}) });
    const text = await response.text();
    return { status: response.status, text };
  };
  for (const [name, changes, raw] of fixture.permitted.slice(0, 3)) await check('HTTP control: ' + name, async () => {
    const response = await request(await fixture.sign(changes, raw), '/api/workspace');
    assert.equal(response.status, 200);
    const body = JSON.parse(response.text);
    assert.equal(body.user.userId, 'access:numeric-date-positive');
    responses.push({ name, path: '/api/workspace', status: response.status });
  });
  before = await snapshot();
  for (const [name, changes, raw] of fixture.refused) {
    // Unit checks fix the exact clock. HTTP requires validity failures far outside the
    // allowance so real elapsed request time cannot turn a future-token control valid.
    const patch = name === 'future activation outside allowance' ? { nbf: Math.floor(Date.now() / 1000) + 3600 } : changes;
    const token = await fixture.sign({ ...patch, sub: 'numeric-date-refusal' }, raw);
    for (const [path, method] of [['/api/workspace', 'GET'], ['/api/patients', 'GET'], ['/api/commands', 'POST']]) await check(`HTTP refusal: ${name} ${method} ${path}`, async () => {
      const response = await request(token, path, method);
      responses.push({ name, path, method, status: response.status });
      assert.equal(response.status, 401, response.text.slice(0, 150));
      assert.doesNotMatch(response.text, /"(?:people|organisation|members|visits|receipts)"/);
    });
  }
  after = await snapshot();
  await check('Every application table is unchanged by all refused requests', () => { assert.ok(Object.keys(before).length > 20); assert.deepEqual(after, before); });
  await check('No refused principal account was created', async () => {
    const row = await database.prepare('SELECT COUNT(*) AS n FROM accounts WHERE user_id = ?').bind('access:numeric-date-refusal').first();
    assert.equal(row.n, 0);
  });
} catch (error) { fatal = error.stack; checks.push({ name: 'Runtime execution', status: 'fail', error: error.message }); }
finally {
  if (worker) { try { await worker.stop(); disposed = true; } catch (error) { checks.push({ name: 'Owned runtime disposal', status: 'fail', error: error.message }); } }
  rmSync(state, { recursive: true, force: true });
  const report = { suite: 'Identity finite numeric-date built Worker', requirement: 'BR-ID-03', sourceSha256, port, passed: checks.filter(c => c.status === 'pass').length, failed: checks.filter(c => c.status === 'fail').length, checks, responses, before, after, disposed, fatal, completedAt: new Date().toISOString(), limits: ['Synthetic local key endpoint and local D1 only; no hosted sign-in, recovery/MFA, real provider, physical-device or formal acceptance.'] };
  mkdirSync(join(output, '..'), { recursive: true });
  const { writeFileSync } = await import('node:fs'); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ suite: report.suite, passed: report.passed, failed: report.failed, disposed, fatal }));
  if (report.failed) process.exitCode = 1;
}
