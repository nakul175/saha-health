// Slice 0c identity contract: provider selection and Cloudflare Access token verification with a
// locally generated RSA key and an injected key endpoint. No network or real identity provider.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'saha-identity-contract-'));
let passed = 0;
const check = async fn => { await fn(); passed++; };
try {
  writeFileSync(join(dir, 'identity.js'), ts.transpileModule(readFileSync('lib/saha/identity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const id = await import(pathToFileURL(join(dir, 'identity.js')));
  const team = 'synthetic-team.cloudflareaccess.com', aud = 'a'.repeat(64);
  const env = { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: team, SAHA_ACCESS_AUD: aud };
  const cfg = id.identityConfig(env);
  const headers = obj => ({ get: n => obj[n.toLowerCase()] ?? null });
  const b64 = bytes => Buffer.from(bytes).toString('base64url');
  const enc = obj => b64(new TextEncoder().encode(JSON.stringify(obj)));
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  let fetches = 0;
  const fakeFetch = async url => { fetches++; assert.equal(url, `https://${team}/cdn-cgi/access/certs`); return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }); };
  const now = Date.parse('2026-09-30T00:00:00Z'), deps = { fetch: fakeFetch, now: () => now };
  const sign = async (claims, { kid = 'k1', alg = 'RS256', key = pair.privateKey } = {}) => { const h = enc({ alg, kid, typ: 'JWT' }), p = enc(claims); const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p)); return `${h}.${p}.${b64(new Uint8Array(sig))}`; };
  const base = { iss: `https://${team}`, aud: [aud], sub: 'synthetic-subject-1', email: 'worker@example.invalid', name: 'Synthetic Worker', amr: ['pwd', 'mfa'], jti: 'synthetic-credential-1', iat: now / 1000 - 10, exp: now / 1000 + 600 };
  const principal = async (token, extra = {}) => id.principalFromHeaders(headers({ 'cf-access-jwt-assertion': token, ...extra }), cfg, deps);

  await check(() => { assert.deepEqual(id.identityConfig({}), { provider: 'sites-chatgpt' }); assert.equal(cfg.teamDomain, team); assert.equal(cfg.error, undefined); });
  await check(() => { assert.ok(id.identityConfig({ ...env, SAHA_ACCESS_TEAM_DOMAIN: 'evil.example.com' }).error); assert.ok(id.identityConfig({ ...env, SAHA_ACCESS_AUD: 'short' }).error); assert.ok(id.identityConfig({ SAHA_IDENTITY_PROVIDER: 'other' }).error); });
  await check(async () => { const p = await principal(await sign(base)); assert.deepEqual(p, { userId: 'access:synthetic-subject-1', displayName: 'Synthetic Worker', email: 'worker@example.invalid', fullName: 'Synthetic Worker', provider: 'cloudflare-access', authentication: { mfa: true, issuedAt: now / 1000 - 10, credentialId: 'synthetic-credential-1' } }); });
  await check(async () => { await principal(await sign(base)); assert.equal(fetches, 1, 'keys are cached'); });
  await check(async () => assert.equal(await principal(await sign({ ...base, aud: ['b'.repeat(64)] })), null));
  await check(async () => assert.equal(await principal(await sign({ ...base, iss: 'https://other.cloudflareaccess.com' })), null));
  await check(async () => assert.equal(await principal(await sign({ ...base, exp: now / 1000 - 120 })), null));
  await check(async () => assert.equal(await principal(await sign({ ...base, nbf: now / 1000 + 600 })), null));
  await check(async () => assert.equal(await principal(await sign(base, { key: other.privateKey })), null));
  await check(async () => assert.equal(await principal(await sign(base, { kid: 'unknown' })), null));
  await check(async () => { const [h, p] = (await sign(base)).split('.'); assert.equal(await principal(`${enc({ alg: 'none', kid: 'k1' })}.${p}.`), null); assert.equal(await principal(`${h}.${p}`), null); });
  await check(async () => { const [h, , s] = (await sign(base)).split('.'); assert.equal(await principal(`${h}.${enc({ ...base, sub: 'someone-else' })}.${s}`), null); });
  await check(async () => assert.equal(await principal(await sign({ ...base, email: 'not-an-email' })), null));
  // Provider exclusivity: Sites headers are ignored behind Access, and Access tokens are ignored on Sites.
  const sitesHeaders = { 'oai-authenticated-user-id': 'spoofed', 'oai-authenticated-user-email': 'spoof@example.invalid' };
  await check(async () => assert.equal(await id.principalFromHeaders(headers(sitesHeaders), cfg, deps), null));
  await check(async () => { const p = await id.principalFromHeaders(headers({ ...sitesHeaders, 'cf-access-jwt-assertion': await sign(base) }), id.identityConfig({}), deps); assert.equal(p.userId, 'spoofed'); assert.equal(p.provider, 'sites-chatgpt'); });
  await check(async () => { const p = id.sitesPrincipal(headers({ ...sitesHeaders, 'oai-authenticated-user-full-name': 'Synthetic%20Name', 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' })); assert.equal(p.displayName, 'Synthetic Name'); assert.equal(id.sitesPrincipal(headers({})), null); });
  // Slice 13d (round-10 review L3): automated actors' ids are reserved, as fixture ids are.
  await check(() => { for (const reserved of ['system', 'system:notification-simulator', 'system:anything', 'fixture:org:author']) assert.equal(id.sitesPrincipal(headers({ ...sitesHeaders, 'oai-authenticated-user-id': reserved })), null, reserved); for (const ok of ['systemic', 'sys', 'r1-system']) assert.equal(id.sitesPrincipal(headers({ ...sitesHeaders, 'oai-authenticated-user-id': ok })).userId, ok, ok); });
  // Key endpoint failure fails closed.
  await check(async () => { id.clearAccessKeyCache(); assert.equal(await id.principalFromHeaders(headers({ 'cf-access-jwt-assertion': await sign(base) }), cfg, { now: () => now, fetch: async () => new Response('down', { status: 503 }) }), null); });
  await check(() => { assert.equal(id.signOutPath(cfg), `https://${team}/cdn-cgi/access/logout`); assert.equal(id.signOutPath(id.identityConfig({})), '/signout-with-chatgpt?return_to=%2F'); });
  const result = { suite: 'identity contract (slice 0c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/identity-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
