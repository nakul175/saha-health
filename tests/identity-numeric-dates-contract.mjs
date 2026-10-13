// SAHA-012 / BR-ID-03 / ENG-BR-ID-03. Additive narrow validity checks, not formal recovery/MFA acceptance.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { credentialFixture, bindings, team } from './lib/identity-numeric-date-fixture.mjs';

const dir = mkdtempSync(join(tmpdir(), 'saha-numeric-date-contract-'));
const checks = [];
const check = async (name, run) => { try { await run(); checks.push({ name, status: 'pass' }); } catch (error) { checks.push({ name, status: 'fail', error: error.message }); } };
try {
  const source = process.env.SAHA_IDENTITY_SOURCE ?? 'lib/saha/identity.ts';
  writeFileSync(join(dir, 'identity.mjs'), ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const identity = await import(pathToFileURL(join(dir, 'identity.mjs')));
  const now = Date.parse('2026-10-12T00:00:00Z'), fixture = await credentialFixture(now / 1000);
  const config = identity.identityConfig(bindings);
  let keyFetches = 0;
  const deps = { now: () => now, fetch: async url => { assert.equal(url, `https://${team}/cdn-cgi/access/certs`); keyFetches++; return Response.json({ keys: [fixture.jwk] }); } };
  const resolve = token => identity.principalFromHeaders(new Headers({ 'cf-access-jwt-assertion': token, 'oai-authenticated-user-id': 'ignored-sites-user', 'oai-authenticated-user-email': 'ignored@example.invalid' }), config, deps);
  for (const [name, changes, raw] of fixture.permitted) await check(name, async () => {
    const result = await resolve(await fixture.sign(changes, raw));
    assert.equal(result?.userId, 'access:numeric-date-positive');
    assert.equal(result?.provider, 'cloudflare-access');
  });
  for (const [name, changes, raw] of fixture.refused) await check(name, async () => assert.equal(await resolve(await fixture.sign(changes, raw)), null));
  await check('key endpoint remains cached', () => assert.equal(keyFetches, 1));
  const report = { suite: 'Identity finite numeric-date contract', requirement: 'BR-ID-03', source, passed: checks.filter(c => c.status === 'pass').length, failed: checks.filter(c => c.status === 'fail').length, checks, completedAt: new Date().toISOString(), limits: ['Local cryptographic fixture only; formal recovery, MFA, revocation and hosted identity acceptance remain pending.'] };
  const output = process.env.SAHA_RESULT_FILE ?? 'tests/reports/identity-numeric-dates-contract-result.json';
  mkdirSync(join(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (report.failed) process.exitCode = 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
