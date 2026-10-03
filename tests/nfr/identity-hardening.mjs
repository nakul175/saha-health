// Slice 11d: identity hardening (non-functional: security). Identity comes only from the one trusted provider chosen by SAHA_IDENTITY_PROVIDER
// (lib/saha/identity.ts). This suite checks, over HTTP against the built Worker:
//   A. default provider (Sites headers): a principal id starting `fixture:` cannot sign in, even for a real demonstration fixture member;
//      partial or empty headers and a stray Access token are refused;
//   B. Cloudflare Access provider on `wrangler dev` (tests/lib/worker.mjs, team and audience configured): Sites headers are ignored,
//      and a missing, malformed or unverifiable Cf-Access-Jwt-Assertion is refused (the key endpoint is unreachable locally, so it fails closed);
//   C. Cloudflare Access provider in Miniflare with a local key endpoint (outbound service, the same locally generated RSA key approach as
//      tests/identity-contract.mjs): a properly signed token IS accepted (positive control), and every wrong token is refused: wrong key,
//      tampered payload, alg none, HS256 confusion, expired, not yet valid, wrong audience, wrong issuer, missing claims, unknown key id;
//      the token is read only from the Cf-Access-Jwt-Assertion header; refused requests create no account;
//   D. a misconfigured provider answers 503 and never falls back to Sites headers;
//   and a runtime premise plus source guard for the defect this suite found (the Access key fetch used a redirect mode the Workers runtime refuses).
// Synthetic data only; local Workers only. A hosted Cloudflare Access sign-in is not exercised here.
import { startWorker, identity, client } from '../lib/worker.mjs';
import { startMiniflare, startInline } from '../lib/miniflare.mjs';
import { suite } from '../lib/report.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const P1 = process.env.SAHA_TEST_PORT ?? '8832', P2 = process.env.SAHA_TEST_PORT2 ?? '8833';
const r = suite('Identity hardening (non-functional: security)', 'tests/reports/identity-hardening-result.json', {
  layer: 'non-functional',
  limits: [
    'Local Workers only. A real Cloudflare Access application, its identity providers and its published keys are not exercised; the key endpoint is a local stand-in (Miniflare outbound service) serving a locally generated RSA key.',
    'Signature, issuer, audience and expiry checks run the real lib/saha/identity.ts inside the built Worker; the unit-level contract (tests/identity-contract.mjs) covers the same rules with an injected fetch.',
    'Only the Cf-Access-Jwt-Assertion header is honoured; this suite shows the Authorization header and the CF_Authorization cookie are not, which matches the Access model where Access sets the header after sign-in.',
    'Principals whose id starts `fixture:` are the only reserved prefix (open finding L3 of slice 10k); other reserved-looking ids are not refused.',
  ],
});

const team = 'synthetic-team.cloudflareaccess.com', aud = 'a'.repeat(64);
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const enc = obj => b64(new TextEncoder().encode(JSON.stringify(obj)));
const rsa = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const sign = async (claims, { kid = 'k1', alg = 'RS256', key } = {}) => { const h = enc({ alg, kid, typ: 'JWT' }), p = enc(claims); const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p)); return `${h}.${p}.${b64(new Uint8Array(sig))}`; };
const claims = (over = {}) => { const now = Math.floor(Date.now() / 1000); return { iss: `https://${team}`, aud: [aud], sub: 'synthetic-subject-1', email: 'access-user@example.invalid', name: 'Synthetic Access User', iat: now - 10, exp: now + 600, ...over }; };
const get = (base, path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' }).then(async x => ({ status: x.status, text: await x.text() }));
const refused = (x, what) => { if (x.status !== 401) throw new Error(`${what}: expected 401, got ${x.status} ${x.text.slice(0, 120)}`); if (/"people"|"organisation"/.test(x.text)) throw new Error(`${what}: 401 body carried workspace data`); };

const t0 = performance.now();

// ── A. default provider: Sites headers ────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const w = await startWorker({ port: P1, name: 'nfr-identity-sites' });
  try {
    const api = client(w.base), run = crypto.randomUUID().slice(0, 8), owner = identity('owner', run);
    const own = await api.get(owner, '/api/workspace'); const org = own.json.organisation.id;
    // The synthetic environment installs the demonstration package when the organisation is created, so the fixture: members already exist.
    const fixtures = own.json.members.filter(m => m.userId.startsWith('fixture:')).map(m => m.userId);
    await r.check('setup: the organisation holds real fixture: members created by the demonstration package', () => { if (fixtures.length < 2) throw new Error(`only ${fixtures.length} fixture members: ${fixtures}`); });
    const asFixture = (id, extra = {}) => ({ headers: { 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': 'fixture@example.invalid', ...extra } });
    await r.check('control: an ordinary Sites principal signs in (so the refusals below are caused by the id, not the request)', async () => { const x = await api.get(identity('control', run), '/api/workspace'); if (x.status !== 200) throw new Error(`${x.status}`); });
    await r.check(`a real fixture member id cannot sign in: workspace, patient list and a command are refused 401 (${fixtures.length} fixture ids)`, async () => {
      if (fixtures.length < 2) throw new Error('expected two fixture members');
      for (const id of fixtures) {
        refused(await api.call(asFixture(id), '/api/workspace', { org }), `workspace as ${id}`);
        refused(await api.call(asFixture(id), '/api/patients', { org }), `patients as ${id}`);
        refused(await api.call(asFixture(id), '/api/commands', { method: 'POST', org, body: { type: 'startVisit', personId: 'p_meena' } }), `command as ${id}`);
      }
    });
    await r.check('made-up fixture: ids, the bare prefix and an id ending in the prefix are handled: prefixed ids are refused; an id that merely contains the prefix is an ordinary id', async () => {
      for (const id of ['fixture:', 'fixture:anything', `fixture:${org}:clinician-author`]) refused(await api.call(asFixture(id), '/api/workspace'), id);
      const inner = await api.call(asFixture(`not-fixture:${run}`), '/api/workspace'); if (inner.status !== 200) throw new Error(`an id that only contains the prefix should be ordinary, got ${inner.status}`);
    });
    await r.check('partial or empty identity headers are refused: id without email, email without id, empty id, empty email', async () => {
      for (const h of [{ 'oai-authenticated-user-id': `solo-${run}` }, { 'oai-authenticated-user-email': 'solo@example.invalid' }, { 'oai-authenticated-user-id': '', 'oai-authenticated-user-email': 'solo@example.invalid' }, { 'oai-authenticated-user-id': `solo-${run}`, 'oai-authenticated-user-email': '' }])
        refused(await api.call({ headers: h }, '/api/workspace'), JSON.stringify(h));
    });
    await r.check('on the Sites provider a stray Cf-Access-Jwt-Assertion is not an identity', async () => refused(await api.call({ headers: { 'cf-access-jwt-assertion': `${enc({ alg: 'RS256', kid: 'k1' })}.${enc(claims())}.AAAA` } }, '/api/workspace'), 'access token on sites'));
    await r.check('the refused fixture requests changed nothing: the fixture members still exist and no fixture account was signed in as', async () => {
      const again = await api.get(owner, '/api/workspace', org); if (again.status !== 200) throw new Error(`${again.status}`);
      const fx = again.json.members.filter(m => m.userId.startsWith('fixture:')); if (fx.length !== 2) throw new Error(`${fx.length} fixture members`);
      if (again.json.visits.some(v => fx.some(f => v.createdBy === f.userId))) throw new Error('a fixture member acted');
    });
  } finally { await w.stop(); }
}

// Refusals that need no key endpoint: used on both the wrangler Worker (B) and the Miniflare Worker (C).
async function refusalSet(base, label, { bad }) {
  await r.check(`${label}: Sites identity headers are ignored (valid-looking id and email, no token) -> 401`, async () => {
    for (const path of ['/api/workspace', '/api/patients']) refused(await get(base, path, { 'oai-authenticated-user-id': 'spoofed-user', 'oai-authenticated-user-email': 'spoof@example.invalid' }), path);
    refused(await get(base, '/api/workspace', { 'oai-authenticated-user-id': 'access:synthetic-subject-1', 'oai-authenticated-user-email': 'access-user@example.invalid' }), 'sites header naming an access id');
  });
  await r.check(`${label}: no token, an empty token and anonymous POST /api/commands are refused -> 401`, async () => {
    refused(await get(base, '/api/workspace'), 'no token'); refused(await get(base, '/api/workspace', { 'cf-access-jwt-assertion': '' }), 'empty token');
    const post = await fetch(base + '/api/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ type: 'startVisit', personId: 'p_meena' }) });
    refused({ status: post.status, text: await post.text() }, 'anonymous command');
  });
  await r.check(`${label}: malformed tokens are refused -> 401 (${bad.length} shapes)`, async () => { for (const [what, token] of bad) refused(await get(base, '/api/workspace', { 'cf-access-jwt-assertion': token }), what); });
}
const malformed = [['not a jwt', 'garbage'], ['two parts', 'aaaa.bbbb'], ['four parts', 'a.b.c.d'], ['three non-base64 parts', '!!!.@@@.###'], ['valid base64, not json', `${b64(Buffer.from('nope'))}.${b64(Buffer.from('nope'))}.AAAA`], ['over 8192 characters', 'x'.repeat(9000)], ['whitespace only', '   ']];

// ── B. Cloudflare Access provider on wrangler dev ─────────────────────────────────────────────────────────────────────────────────────────
const pair = await rsa(), other = await rsa();
{
  const w = await startWorker({ port: P1, name: 'nfr-identity-access', fresh: false, vars: { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: team, SAHA_ACCESS_AUD: aud } });
  try {
    await refusalSet(w.base, 'B wrangler dev, Access provider', { bad: malformed });
    await r.check('B wrangler dev, Access provider: a well-formed token signed with an unknown key is refused -> 401 (the key endpoint is unreachable here, so verification fails closed)', async () => {
      refused(await get(w.base, '/api/workspace', { 'cf-access-jwt-assertion': await sign(claims(), { key: other.privateKey }) }), 'unverifiable token');
      refused(await get(w.base, '/api/workspace', { 'cf-access-jwt-assertion': await sign(claims(), { key: pair.privateKey }) }), 'well-formed token, keys unreachable');
    });
  } finally { await w.stop(); }
}

// ── runtime premise and source guard ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Found by this suite (2026-10-03): lib/saha/identity.ts fetched the Access keys with `redirect: 'error'`, which the Workers runtime refuses with a
// TypeError, so every Access sign-in was refused 401 (fail closed, but no one could sign in). Slice 11d changes that one option to 'manual'.
{
  const p = await startInline({
    port: P2,
    outboundService: () => new Response(null, { status: 302, headers: { location: 'https://elsewhere.invalid/keys' } }),
    script: `export default { async fetch() { const out = {}; for (const mode of ['error', 'manual', 'follow']) { try { const x = await fetch('https://synthetic-team.cloudflareaccess.com/cdn-cgi/access/certs', { redirect: mode }); out[mode] = { status: x.status, ok: x.ok }; } catch (e) { out[mode] = { thrown: e.name + ': ' + e.message }; } } return Response.json(out); } }`,
  });
  try {
    const out = await (await fetch(p.base)).json();
    await r.check("runtime premise: the Workers runtime refuses fetch redirect mode 'error' with a TypeError, and returns a redirect unfollowed (not ok) in mode 'manual'", () => {
      if (!/^TypeError.*redirect/i.test(out.error?.thrown ?? '')) throw new Error(`the runtime no longer refuses redirect 'error' (${JSON.stringify(out.error)}); this premise and the source guard below can be relaxed`);
      if (out.manual?.status !== 302 || out.manual?.ok !== false) throw new Error(`mode 'manual' returned ${JSON.stringify(out.manual)}, expected an unfollowed 302 that is not ok`);
    });
  } finally { await p.stop(); }
  await r.check("OPEN FINDING D-1: no Worker-side fetch in lib/saha passes redirect mode 'error' (the runtime refuses it, so the call would throw before sending)", () => {
    const hits = readdirSync('lib/saha').filter(f => f.endsWith('.ts') && /redirect\s*:\s*['"]error['"]/.test(readFileSync(join('lib/saha', f), 'utf8')));
    if (hits.length) throw new Error(`redirect 'error' remains in ${hits.map(f => 'lib/saha/' + f).join(', ')}: each outbound call (MIS, agent provider, EHR provider, external AI/EHR call) would throw a TypeError in the Workers runtime once its provider is enabled. Their contract tests inject a fetch that accepts the option, so they cannot see it. Not changed in this slice: the contract tests assert the option.`);
  });
}

// ── C. Cloudflare Access provider in Miniflare with a local key endpoint ──────────────────────────────────────────────────────────────────
{
  const jwk1 = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const keyset = [jwk1]; let keyFetches = 0, keysDown = false;
  const outbound = request => {
    const u = new URL(request.url);
    if (u.hostname === team && u.pathname === '/cdn-cgi/access/certs') { keyFetches++; return keysDown ? new Response('down', { status: 503 }) : Response.json({ keys: keyset }); }
    return new Response('outbound blocked by the test', { status: 502 });
  };
  const m = await startMiniflare({ port: P2, name: 'nfr-identity-mf', bindings: { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: team, SAHA_ACCESS_AUD: aud }, outboundService: outbound });
  try {
    const accounts = async () => (await (await m.mf.getD1Database('DB')).prepare('SELECT user_id FROM accounts ORDER BY user_id').all()).results.map(x => x.user_id);
    const token = async (over, opts = {}) => sign(claims(over), { key: pair.privateKey, ...opts });
    const ok = async (tk, extra = {}) => get(m.base, '/api/workspace', { 'cf-access-jwt-assertion': tk, ...extra });

    await r.check('C control: a properly signed token is accepted; the principal is access:<subject> and carries the token\'s name', async () => {
      const x = await ok(await token()); if (x.status !== 200) throw new Error(`${x.status} ${x.text.slice(0, 150)}`);
      const j = JSON.parse(x.text); if (j.user.userId !== 'access:synthetic-subject-1') throw new Error(`userId ${j.user.userId}`); if (j.user.displayName !== 'Synthetic Access User') throw new Error(`displayName ${j.user.displayName}`);
    });
    await r.check('C control: a properly signed token also authorises a command (POST /api/commands)', async () => {
      const first = JSON.parse((await ok(await token())).text), res = await fetch(m.base + '/api/commands', { method: 'POST', headers: { 'cf-access-jwt-assertion': await token(), 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'x-saha-organisation': first.organisation.id }, body: JSON.stringify({ type: 'createTeam', name: `Access team ${Date.now()}` }) });
      if (res.status !== 200) throw new Error(`${res.status} ${(await res.text()).slice(0, 150)}`);
    });
    await r.check('C the key endpoint answers are cached: repeated valid tokens do not refetch the keys on every request', async () => { const before = keyFetches; for (let i = 0; i < 5; i++) await ok(await token()); if (keyFetches - before > 0) throw new Error(`${keyFetches - before} refetches for 5 requests`); });

    await refusalSet(m.base, 'C Miniflare, Access provider', { bad: malformed });
    const wrong = [
      ['signed with a different key but the right key id', async () => token({}, { key: other.privateKey })],
      ['payload tampered after signing (subject changed)', async () => { const [h, , s] = (await token()).split('.'); return `${h}.${enc(claims({ sub: 'someone-else' }))}.${s}`; }],
      ['alg none with an empty signature', async () => `${enc({ alg: 'none', kid: 'k1' })}.${enc(claims())}.`],
      ['alg HS256 (algorithm confusion)', async () => `${enc({ alg: 'HS256', kid: 'k1' })}.${enc(claims())}.${b64(Buffer.from('x'.repeat(32)))}`],
      ['expired beyond the clock-skew allowance', async () => token({ exp: Math.floor(Date.now() / 1000) - 600 })],
      ['not valid yet (nbf in the future)', async () => token({ nbf: Math.floor(Date.now() / 1000) + 3600 })],
      ['wrong audience', async () => token({ aud: ['b'.repeat(64)] })],
      ['wrong issuer (another team)', async () => token({ iss: 'https://other-team.cloudflareaccess.com' })],
      ['missing subject', async () => token({ sub: undefined })],
      ['empty subject', async () => token({ sub: '' })],
      ['missing email', async () => token({ email: undefined })],
      ['email without @', async () => token({ email: 'not-an-email' })],
      ['missing expiry', async () => token({ exp: undefined })],
      ['unknown key id (forces one key refresh, still unknown)', async () => token({}, { kid: 'unknown-kid' })],
    ];
    await r.check(`C every wrong token is refused -> 401, with no workspace data (${wrong.length} cases)`, async () => { for (const [what, make] of wrong) refused(await ok(await make()), what); });
    await r.check('C the token is honoured only in Cf-Access-Jwt-Assertion: Authorization bearer and the CF_Authorization cookie are not identities', async () => {
      const tk = await token();
      refused(await get(m.base, '/api/workspace', { authorization: `Bearer ${tk}` }), 'authorization bearer'); refused(await get(m.base, '/api/workspace', { cookie: `CF_Authorization=${tk}` }), 'cookie');
    });
    await r.check('C a valid token with Sites headers naming someone else signs in as the token\'s subject, never as the header identity', async () => {
      const x = await ok(await token(), { 'oai-authenticated-user-id': 'someone-else', 'oai-authenticated-user-email': 'else@example.invalid' }); const j = JSON.parse(x.text);
      if (x.status !== 200 || j.user.userId !== 'access:synthetic-subject-1') throw new Error(`${x.status} ${j.user?.userId}`);
    });
    await r.check('C a token whose subject starts fixture: signs in only as access:fixture:<…>, which is no fixture member id', async () => {
      const x = await ok(await token({ sub: 'fixture:abc', email: 'fixture-sub@example.invalid' })), j = JSON.parse(x.text);
      if (x.status !== 200) throw new Error(`${x.status}`); if (j.user.userId.startsWith('fixture:') || !j.user.userId.startsWith('access:')) throw new Error(`userId ${j.user.userId}`);
    });
    await r.check('C key rotation: a token with a new key id is accepted after one refresh of the keys', async () => {
      const k2 = await rsa(); keyset.push({ ...(await crypto.subtle.exportKey('jwk', k2.publicKey)), kid: 'k2' });
      const before = keyFetches, x = await ok(await sign(claims({ sub: 'rotated-subject', email: 'rotated@example.invalid' }), { kid: 'k2', key: k2.privateKey }));
      if (x.status !== 200 || keyFetches !== before + 1) throw new Error(`${x.status}, refreshes ${keyFetches - before}`);
    });
    await r.check('C the key endpoint failing closes the door for unknown keys (503 from the endpoint -> 401) while a cached key still verifies', async () => {
      keysDown = true;
      try {
        refused(await ok(await token({}, { kid: 'k-not-cached' })), 'unknown key while endpoint down');
        const cached = await ok(await token()); if (cached.status !== 200) throw new Error(`cached key token: ${cached.status}`);
      } finally { keysDown = false; }
    });
    await r.check('C refused requests create no account: only the principals that presented a valid token exist', async () => {
      // Demonstration fixture members (`fixture:<org>:...`) are inserted by the demonstration package when an organisation is created; no request signs in as one.
      const rows = (await accounts()).filter(x => !x.startsWith('fixture:')), expected = new Set(['access:synthetic-subject-1', 'access:fixture:abc', 'access:rotated-subject']);
      const extra = rows.filter(x => !expected.has(x)); if (extra.length) throw new Error(`unexpected accounts: ${JSON.stringify(extra)}`);
      for (const e of expected) if (!rows.includes(e)) throw new Error(`missing account ${e}`);
    });
  } finally { await m.stop(); }
}

// ── D. misconfigured provider ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const [label, bindings] of [['Access provider without team domain or audience', { SAHA_IDENTITY_PROVIDER: 'cloudflare-access' }], ['Access provider with a team domain outside cloudflareaccess.com', { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: 'evil.example.com', SAHA_ACCESS_AUD: aud }], ['an unknown provider name', { SAHA_IDENTITY_PROVIDER: 'something-else' }]]) {
  const m = await startMiniflare({ port: P2, name: 'nfr-identity-misconfigured', fresh: false, bindings });
  try {
    await r.check(`D ${label}: 503 for valid Sites headers and for a signed token; never a fallback to Sites headers`, async () => {
      const sites = await get(m.base, '/api/workspace', { 'oai-authenticated-user-id': 'fallback-user', 'oai-authenticated-user-email': 'fallback@example.invalid' });
      if (sites.status !== 503) throw new Error(`Sites headers: expected 503, got ${sites.status} ${sites.text.slice(0, 100)}`);
      const tk = await get(m.base, '/api/workspace', { 'cf-access-jwt-assertion': await sign(claims(), { key: pair.privateKey }) });
      if (tk.status !== 503) throw new Error(`token: expected 503, got ${tk.status}`);
      if (/"people"|"organisation"/.test(sites.text + tk.text)) throw new Error('error body carried workspace data');
    });
  } finally { await m.stop(); }
}

await r.finish({ durationMs: Math.round(performance.now() - t0), team, audienceLength: aud.length });
