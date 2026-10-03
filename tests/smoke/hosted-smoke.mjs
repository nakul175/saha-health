// Slice 11b: post-deploy smoke for the hosted synthetic staging site (Cloudflare Worker behind Cloudflare Access).
//
//   node tests/smoke/hosted-smoke.mjs                       (base URL: SAHA_HOSTED_URL, default https://saha-staging.nakul17.workers.dev)
//   CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... node tests/smoke/hosted-smoke.mjs
//   SAHA_TEST_PORT=8811 node tests/smoke/hosted-smoke.mjs --self-test   (local: proves the checks pass on a good site and fail on a bad one)
//
// What it asks of the real site, in two tiers.
//  1. Anonymous (always): Cloudflare Access must stand in front of the page, /api/workspace and /api/commands (a redirect to the team
//     domain in deploy/cloudflare-staging.json, never a 200 and never app data); the Sites dispatcher identity headers, a garbage or unsigned
//     Cf-Access-Jwt-Assertion, a garbage CF_Authorization cookie and a made-up service token must all be refused; TLS must verify; plain HTTP
//     must not serve the app; refusals must grant no cross-origin access.
//  2. With CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (an Access service token, created by the sponsor in Cloudflare Zero Trust and
//     allowed by a Service Auth policy on the application): Access must admit the token, and the app's own answer is recorded exactly.
//     lib/saha/identity.ts requires a verified JWT with BOTH `sub` and `email`. Cloudflare issues a service token's JWT with an empty `sub`
//     and no `email` (a `common_name` instead), so the app is expected to refuse it with 401. That is reported as it is; the suite does not
//     treat it as a failure of the deploy, because it is how the app is built, and it never changes the app.
//
// It never sends the local dispatcher headers as a way in; it sends them only to prove they are refused. Synthetic data only. The one request
// that could write (a forged-identity GET /api/workspace would create a synthetic home organisation if it were wrongly accepted) is a failure
// condition, not an expected path. Exit code: 0 pass, 1 fail, 2 not executed (the site could not be reached from this machine).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import tls from 'node:tls';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suite } from '../lib/report.mjs';

process.chdir(resolve(fileURLToPath(new URL('../..', import.meta.url))));
const DEPLOY = JSON.parse(readFileSync('deploy/cloudflare-staging.json', 'utf8'));
const DEFAULT_URL = `https://${DEPLOY.workerName}.nakul17.workers.dev`;
const REDIRECTS = [301, 302, 303, 307, 308];
const REFUSALS = [...REDIRECTS, 401, 403];
// What only a signed-in workspace shows. In JSON: the workspace's own keys. In HTML: the footer the workspace shell renders. (Not the page title, and not
// `schemaVersion` in HTML: even the app's "Sign-in required" page carries both, the second in the platform's artifact metadata inside the page's data.)
const WORKSPACE_JSON = /schemaVersion|"organisation"|"people"|"members"/, WORKSPACE_HTML = /Connected care workspace/;
const leaksData = res => (/json/.test(res.headers.get('content-type') ?? '') || /^\s*[{[]/.test(res.text) ? WORKSPACE_JSON : WORKSPACE_HTML).test(res.text);
const SERVICE_TOKEN_SKIP = 'CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET are not set. They need a Cloudflare Access service token (Zero Trust, Access, Service Auth) that the sponsor creates, plus a Service Auth policy on the Saha application.';

const sh = (cmd, args, timeout = 10000) => new Promise(done => execFile(cmd, args, { timeout }, (error, stdout, stderr) => done({ code: error ? (error.code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) })));

/**
 * Run every check against one site. Returns the finished report. `reportFile` is where it is written; `exitCodes: false` leaves process.exitCode alone
 * (the self-test runs this on purpose against bad sites).
 */
async function hostedRun({ base, team = DEPLOY.accessTeamDomain, aud = DEPLOY.accessAud, token = null, reportFile, name = 'Smoke (hosted)', exitCodes = true }) {
  base = base.replace(/\/$/, '');
  const url = new URL(base), https = url.protocol === 'https:', started = performance.now(), took = () => Math.round((performance.now() - started) / 100) / 10;
  const r = suite(name, reportFile, {
    layer: 'smoke',
    environment: `hosted synthetic staging at ${base} (Cloudflare Workers, D1, Cloudflare Access), synthetic data only`,
    limits: [
      'Anonymous tier: what a visitor and an attacker without credentials can see. It proves the front door (Access) is closed and forged identities are refused; it cannot see inside the app.',
      'The app sets Cache-Control: no-store and X-Content-Type-Options: nosniff on its JSON answers and no-store on the page. It sets no HSTS, CSP, frame or referrer headers (Cloudflare may add some), so only the two it sets are asserted, and only when the app answers (service-token tier).',
      'The service-token tier needs credentials the sponsor must create. Without them it is reported as skipped, with the reason.',
      'One pass is a snapshot. It reads no Worker log, runs no scheduled job, writes no records on purpose and does not test Access policy membership (who may sign in is kept in Cloudflare, not in Git).',
    ],
  });
  const hit = async (path, { method = 'GET', headers = {}, body, timeout = 8000, absolute } = {}) => {
    const t = performance.now(), res = await fetch(absolute ?? base + path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    return { status: res.status, headers: res.headers, text: (await res.text()).slice(0, 4000), location: res.headers.get('location'), ms: Math.round(performance.now() - t) };
  };
  const brief = res => `${res.status}${res.location ? ` -> ${res.location.slice(0, 120)}` : ''} ${res.text.replace(/\s+/g, ' ').slice(0, 140)}`;
  const forged = { 'oai-authenticated-user-id': 't-hosted-smoke-forged', 'oai-authenticated-user-email': 'forged-hosted-smoke@example.invalid', 'oai-authenticated-user-full-name': 'Forged%20Smoke', 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  // Well formed, plausible claims, signature that cannot verify: what an attacker without the Access signing key can make.
  const unsignedJwt = `${b64({ alg: 'RS256', kid: 'smoke-forged-key', typ: 'JWT' })}.${b64({ sub: 'forged-sub', email: 'forged-hosted-smoke@example.invalid', aud: [aud || 'x'], iss: `https://${team}`, iat: 1, exp: 4102444800 })}.AAAA`;
  const noData = (res, what) => assert.ok(!leaksData(res), `${what}: the response carries application content: ${brief(res)}`);
  const accessRedirect = (res, what) => {
    assert.ok(REDIRECTS.includes(res.status), `${what}: expected a redirect to Cloudflare Access, got ${brief(res)}`); noData(res, what);
    const to = new URL(res.location ?? '', base);
    assert.equal(to.protocol, 'https:', `${what}: Access redirect is not https: ${res.location}`);
    assert.equal(to.host, team, `${what}: redirected to ${to.host}, expected the Access team domain ${team}`);
    assert.ok(to.pathname.startsWith('/cdn-cgi/access/'), `${what}: unexpected Access path ${to.pathname}`);
    return to;
  };
  // Refused: content-free first (the worst failure is leaked data), then an Access redirect, a 401/403, or the app's own fail-closed page.
  const refused = (res, what) => {
    noData(res, what);
    const failClosedPage = res.status === 200 && /Sign-in required/.test(res.text);
    assert.ok(REFUSALS.includes(res.status) || failClosedPage, `${what}: expected a refusal (Access redirect, 401, 403 or the "Sign-in required" page), got ${brief(res)}`);
    if (REDIRECTS.includes(res.status)) assert.equal(new URL(res.location ?? '', base).host, team, `${what}: redirected somewhere other than Access: ${res.location}`);
  };
  const post = (headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ type: '__smoke_not_a_command' }) });

  // Reachability gate. A site that cannot be reached, or an answer that is not from the site, is "not executed": never a pass and never a fail of the app.
  const gate = async () => {
    let first;
    try { first = await hit('/'); } catch (e) {
      const curl = await sh('curl', ['-sS', '-o', '/dev/null', '-D', '-', '--max-time', '8', `${base}/`]);
      const why = /CONNECT tunnel failed/.test(curl.stderr + curl.stdout) ? 'an HTTPS proxy refused the connection (egress policy)' : curl.code === 6 ? 'DNS lookup failed' : curl.code === 7 ? 'connection refused' : curl.code === 28 ? 'timed out' : 'the request failed';
      return { ok: false, reason: `${why}: fetch said "${e.cause?.message ?? e.message}"; curl exit ${curl.code} ${curl.stderr.trim().split('\n').pop()}`, curl: { code: curl.code, stderr: curl.stderr.trim().slice(-300) } };
    }
    const deny = first.headers.get('x-deny-reason'), notEdge = !first.headers.get('cf-ray') && !/cloudflare/i.test(first.headers.get('server') ?? '');
    // Not the site: also ask curl, which goes through the machine's proxy settings, so a proxy refusal and a gateway answer can be told apart from an application answer.
    const curl = deny || /Host not in allowlist/i.test(first.text) || notEdge ? await sh('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '8', `${base}/`]) : null;
    const curlInfo = curl && { code: curl.code, status: curl.stdout.trim().slice(-3), stderr: curl.stderr.trim().slice(-300) };
    if (deny || /Host not in allowlist/i.test(first.text)) return { ok: false, curl: curlInfo, reason: `the egress gateway of this machine answered ${first.status} (x-deny-reason: ${deny ?? 'none'}): "${first.text.replace(/\s+/g, ' ').slice(0, 140)}". This is the gateway, not the application${curlInfo ? ` (curl: exit ${curlInfo.code}${curlInfo.stderr ? `, ${curlInfo.stderr.split('\n').pop()}` : `, HTTP ${curlInfo.status}`})` : ''}`, response: { status: first.status, deny } };
    if (notEdge) return { ok: false, curl: curlInfo, reason: `the answer (${first.status}) did not come from the Cloudflare edge (no cf-ray, no "server: cloudflare"), so it is not evidence about the hosted site`, response: { status: first.status } };
    return { ok: true, first };
  };
  const reach = await gate();
  if (!reach.ok) {
    r.skip('hosted run', `not executed: ${reach.reason}`);
    const out = await r.finish({ executed: false, verdict: 'not-executed', base, reachability: reach, seconds: took() });
    if (exitCodes) process.exitCode = 2;
    return { ...out, verdict: 'NOT EXECUTED', line: `HOSTED SMOKE NOT EXECUTED ${base}: ${reach.reason}` };
  }

  // Fire every independent probe at once so the whole run stays well inside the 20 s budget; each check then reads its own answer.
  const P = {
    page: Promise.resolve(reach.first), workspace: hit('/api/workspace'), commands: hit('/api/commands', post()),
    cors: hit('/api/workspace', { headers: { Origin: 'https://evil.example' } }),
    forgedWorkspace: hit('/api/workspace', { headers: forged }), forgedPage: hit('/', { headers: forged }), forgedCommand: hit('/api/commands', post(forged)),
    garbageJwt: hit('/api/workspace', { headers: { ...forged, 'Cf-Access-Jwt-Assertion': 'garbage' } }), garbageJwtPage: hit('/', { headers: { ...forged, 'Cf-Access-Jwt-Assertion': 'garbage' } }),
    unsignedJwt: hit('/api/workspace', { headers: { 'Cf-Access-Jwt-Assertion': unsignedJwt } }), unsignedJwtPage: hit('/', { headers: { 'Cf-Access-Jwt-Assertion': unsignedJwt } }),
    cookie: hit('/api/workspace', { headers: { Cookie: 'CF_Authorization=garbage.garbage.garbage; CF_AppSession=garbage' } }),
    badToken: hit('/api/workspace', { headers: { 'CF-Access-Client-Id': 'smoke-invalid.access', 'CF-Access-Client-Secret': '0'.repeat(64) } }),
    plain: https ? hit('/', { absolute: `http://${url.host}/`, timeout: 6000 }).catch(e => ({ networkError: e.cause?.code ?? e.message })) : null,
  };
  for (const p of Object.values(P)) p?.catch?.(() => {}); // each is awaited by its check; this only keeps an early failure from being reported twice
  let cert = null;
  const tlsProbe = https ? new Promise(done => {
    const s = tls.connect({ host: url.hostname, port: +(url.port || 443), servername: url.hostname, rejectUnauthorized: true, timeout: 8000 }, () => { cert = { authorized: s.authorized, protocol: s.getProtocol(), peer: s.getPeerCertificate(), identity: undefined }; cert.identity = tls.checkServerIdentity(url.hostname, cert.peer); s.end(); done(cert); });
    s.on('error', e => done({ error: e.code ?? e.message })); s.on('timeout', () => { s.destroy(); done({ error: 'timeout' }); });
  }) : null;

  // ---- Anonymous tier -------------------------------------------------------------------------------------------------------------
  if (https) await r.check('TLS: the certificate verifies for the host, the protocol is TLS 1.2 or 1.3, and it is valid for at least 7 more days', async () => {
    const c = await tlsProbe; assert.ok(!c.error, `TLS connection failed: ${c.error}`); assert.equal(c.authorized, true, 'certificate not trusted');
    assert.equal(c.identity, undefined, `certificate does not match ${url.hostname}: ${c.identity?.message}`); assert.match(c.protocol, /^TLSv1\.[23]$/, `protocol ${c.protocol}`);
    const days = (Date.parse(c.peer.valid_to) - Date.now()) / 864e5; assert.ok(days >= 7, `certificate expires in ${days.toFixed(1)} days`);
  }); else r.skip('TLS certificate and protocol', `${base} is not https`);
  await r.check(`the page (GET /) is held by Cloudflare Access: a redirect to ${team}, no application content`, async () => { accessRedirect(await P.page, 'GET /'); });
  await r.check(`GET /api/workspace is held by Cloudflare Access: a redirect to ${team}, no application data`, async () => { accessRedirect(await P.workspace, 'GET /api/workspace'); });
  await r.check('POST /api/commands without credentials is refused (Access redirect, 401 or 403) and nothing is processed', async () => { refused(await P.commands, 'POST /api/commands'); });
  await r.check('refusals grant no cross-origin access: no Access-Control-Allow-Origin on the anonymous answers', async () => {
    for (const [what, p] of [['GET /api/workspace with a foreign Origin', P.cors], ['GET /api/workspace', P.workspace], ['GET /', P.page]]) { const res = await p; assert.equal(res.headers.get('access-control-allow-origin'), null, `${what} answers Access-Control-Allow-Origin: ${res.headers.get('access-control-allow-origin')}`); }
  });
  await r.check('forged Sites dispatcher identity headers do not get in: page, /api/workspace and a command are all refused', async () => {
    refused(await P.forgedWorkspace, 'GET /api/workspace with oai-authenticated-user-* headers'); refused(await P.forgedPage, 'GET / with oai-authenticated-user-* headers');
    refused(await P.forgedCommand, 'POST /api/commands with oai-authenticated-user-* headers');
  });
  await r.check('a garbage Cf-Access-Jwt-Assertion (with forged identity headers) does not get in', async () => { refused(await P.garbageJwt, 'GET /api/workspace with a garbage JWT'); refused(await P.garbageJwtPage, 'GET / with a garbage JWT'); });
  await r.check('a well-formed but unsigned Cf-Access-Jwt-Assertion claiming a valid email, audience and issuer does not get in', async () => { refused(await P.unsignedJwt, 'GET /api/workspace with an unsigned JWT'); refused(await P.unsignedJwtPage, 'GET / with an unsigned JWT'); });
  await r.check('a garbage CF_Authorization cookie and a made-up service token do not get in', async () => { refused(await P.cookie, 'GET /api/workspace with a garbage CF_Authorization cookie'); refused(await P.badToken, 'GET /api/workspace with an invalid service token'); });
  if (https) await r.check('plain HTTP does not serve the application: it redirects to https (this host or the Access team domain), or does not answer', async () => {
    const res = await P.plain; if (res.networkError) return; // port 80 closed or filtered: nothing served
    assert.ok(REDIRECTS.includes(res.status), `http:// answered ${brief(res)}`); const to = new URL(res.location ?? '', `http://${url.host}/`); assert.equal(to.protocol, 'https:', `redirected to ${res.location}`); noData(res, 'http://');
  }); else r.skip('plain HTTP is not served', `${base} is not https`);

  // ---- Service-token tier -----------------------------------------------------------------------------------------------------------
  let outcome = 'not run (no service token)';
  if (!token) {
    for (const label of ['Access admits the service token and the app\'s answer is recorded', 'the app\'s own response headers (Cache-Control no-store, X-Content-Type-Options nosniff)', 'the page for the service identity (HTML, no-store; synthetic notice or sign-in notice, never data)', 'the hosted environment is synthetic with external services off (only when the app accepts the identity)']) r.skip(label, SERVICE_TOKEN_SKIP);
  } else {
    const auth = { 'CF-Access-Client-Id': token.id, 'CF-Access-Client-Secret': token.secret };
    const [ws, page] = await Promise.all([hit('/api/workspace', { headers: auth }), hit('/', { headers: auth })]);
    let accepted = false, body = null;
    await r.check("Access admits the service token (the answer comes from the Worker, not Access), and the app's answer is recorded", async () => {
      assert.ok(!REDIRECTS.includes(ws.status), `Access redirected the service token to login (${brief(ws)}): the token is not valid for this application, or no Service Auth policy includes it`);
      assert.ok(/json/.test(ws.headers.get('content-type') ?? ''), `Access answered ${brief(ws)} instead of the Worker: the token was not admitted (invalid, expired, or not in a Service Auth policy)`);
      try { body = JSON.parse(ws.text); } catch { throw new Error(`the answer is not JSON: ${brief(ws)}`); }
      if (ws.status === 200) { accepted = true; outcome = 'the app accepted the service identity (200)'; assert.ok(body.schemaVersion && body.organisation?.id, 'a 200 without a workspace'); }
      else { assert.equal(ws.status, 401, `unexpected app answer ${brief(ws)}`); assert.match(body.error ?? '', /sign in/i); outcome = `Access admitted the token and the app refused the identity with 401 "${body.error}" (expected: a service token's JWT has no email claim, and lib/saha/identity.ts requires sub and email)`; }
    });
    await r.check("the app's own response headers on /api/workspace: Cache-Control no-store and X-Content-Type-Options nosniff", async () => { assert.match(ws.headers.get('cache-control') ?? '', /no-store/); assert.equal(ws.headers.get('x-content-type-options'), 'nosniff'); });
    await r.check('the page for the service identity is HTML with no-store and shows the synthetic notice (accepted) or the sign-in notice (refused), never data', async () => {
      assert.equal(page.status, 200, `GET / answered ${brief(page)}`); assert.match(page.headers.get('content-type') ?? '', /^text\/html/); assert.match(page.headers.get('cache-control') ?? '', /no-store/);
      assert.ok(/Synthetic demonstration · not for patient care/.test(page.text) || /Sign-in required/.test(page.text), 'neither the synthetic notice nor the sign-in notice is in the page'); assert.ok(!/"people"|"members"/.test(page.text));
    });
    if (accepted) await r.check('the hosted environment is synthetic with external services off', async () => { assert.equal(body.environment, 'synthetic'); assert.equal(body.externalApisEnabled, false); });
    else r.skip('the hosted environment is synthetic with external services off', `the app refused the service identity (${ws.status}), so there is no workspace to inspect`);
  }

  // Evidence only, not asserted: whether the Access login redirect's `kid` equals accessAud was not confirmed from Cloudflare's documentation (read 3 October 2026),
  // so a mismatch is recorded for a person to look at after the first real run rather than failing a deploy.
  const accessRedirectInfo = await P.workspace.then(res => { const to = new URL(res.location ?? '', base); return { status: res.status, host: to.host, path: to.pathname, kid: to.searchParams.get('kid'), kidEqualsConfiguredAud: to.searchParams.get('kid') === aud }; }).catch(() => null);
  const seconds = took();
  await r.check('the whole run finished within 20 seconds', async () => assert.ok(seconds <= 20, `${seconds} s`));
  const out = await r.finish({ executed: true, verdict: r.failed ? 'fail' : 'pass', base, seconds, serviceTokenOutcome: outcome, teamDomain: team, accessRedirect: accessRedirectInfo, tokenTier: token ? 'run' : 'skipped' });
  const line = `HOSTED SMOKE ${r.failed ? 'FAIL' : 'PASS'} ${base}: ${out.passed} passed, ${out.failed} failed, ${out.skipped} skipped in ${seconds} s${token ? `; service token: ${outcome}` : '; service-token tier skipped (no credentials)'}`;
  return { ...out, verdict: r.failed ? 'FAIL' : 'PASS', line };
}

// ---- Self-test: the same checks against local stand-ins for the edge ----------------------------------------------------------------
// A small HTTP server plays Cloudflare's edge in front of a real built Worker. With `access` on it does what Access does (redirect anyone without a
// valid service token to the team domain; ignore oai-* headers and a client-supplied Cf-Access-Jwt-Assertion; pass an admitted service token through
// with a JWT it cannot sign). With it off the Worker is exposed directly. The scenarios prove the checks can pass and can fail.
function edge({ port, origin, access, team, aud, deny = false, tokenAnswer = 'forward' }) {
  const good = { id: 'selftest-id', secret: 'selftest-secret' }, cf = { server: 'cloudflare', 'cf-ray': 'selftest-0123456789abcdef-BOM' };
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks), h = req.headers;
    const send = (status, headers, text) => { res.writeHead(status, { ...cf, ...headers, connection: 'close', 'content-length': Buffer.byteLength(text) }); res.end(text); };
    if (deny) return send(403, { 'content-type': 'text/plain', 'x-deny-reason': 'host_not_allowed' }, 'Host not in allowlist: saha-staging.example. Add this host to your network egress settings to allow access.');
    const admitted = h['cf-access-client-id'] === good.id && h['cf-access-client-secret'] === good.secret;
    if (access && !admitted) {
      if (h['cf-access-client-id'] || h['cf-access-client-secret']) return send(403, { 'content-type': 'text/html' }, '<html>Forbidden</html>');
      return send(302, { location: `https://${team}/cdn-cgi/access/login/${h.host}?kid=${aud}&redirect_url=${encodeURIComponent(req.url)}` }, '');
    }
    if (admitted && tokenAnswer === 'canned200') {
      const json = JSON.stringify({ schemaVersion: 1, environment: 'synthetic', externalApisEnabled: false, organisation: { id: 'org_selftest' } });
      return send(200, req.url.startsWith('/api/') ? { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } : { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, must-revalidate' }, req.url.startsWith('/api/') ? json : '<html><footer>Synthetic demonstration · not for patient care</footer></html>');
    }
    const headers = Object.fromEntries(Object.entries(h).filter(([k]) => !['host', 'connection', 'content-length', 'transfer-encoding'].includes(k)));
    if (access && admitted) headers['cf-access-jwt-assertion'] = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InNlbGZ0ZXN0In0.eyJzdWIiOiIifQ.AAAA'; // Access signs this; the stand-in cannot
    const up = await fetch(origin + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body, redirect: 'manual' });
    const out = Buffer.from(await up.arrayBuffer()), outHeaders = Object.fromEntries([...up.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k)));
    res.writeHead(up.status, { ...cf, ...outHeaders, connection: 'close', 'content-length': out.length }); res.end(out); // no keep-alive: the next scenario reuses this port
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ close: () => new Promise(c => server.close(c)), url: `http://127.0.0.1:${port}`, token: good })));
}

async function selfTest() {
  const { startWorker } = await import('../lib/worker.mjs'), { migrateOnce } = await import('../lib/migrate.mjs');
  const port = Number(process.env.SAHA_TEST_PORT ?? 8790), team = DEPLOY.accessTeamDomain, aud = DEPLOY.accessAud || 'a'.repeat(64);
  const st = suite('Smoke (hosted) self-test', 'tests/reports/smoke-hosted-selftest-result.json', {
    layer: 'smoke', environment: 'local: a stand-in Cloudflare edge in front of the built Worker (cloudflare-access mode, and the default Sites mode), synthetic data',
    limits: ['The edge is a stand-in written for this test, not Cloudflare. It shows the checks react correctly to good and bad sites; it does not show how the real Access behaves (the real redirect shape, kid parameter, service-token handling).', 'TLS and plain-HTTP checks are skipped here (local stand-ins speak http).', 'The service token 200 branch is exercised with a canned answer, not the real app: the real app refuses a service token (no email claim).'],
  });
  const labelsFailed = out => out.checks.filter(c => c.ok === false).map(c => c.label);
  // A scenario may fail its checks on purpose; the console says so (and the verdict of the self-test is what counts), and the exit code is left alone.
  const scenario = async (title, opts) => {
    const prev = process.exitCode, err = console.error, out_ = console.log;
    console.error = m => out_(`  (expected in "${title}") ${String(m).replace(/^FAIL /, 'failed: ').slice(0, 150)}`); console.log = () => {};
    try { return await hostedRun({ name: `self-test: ${title}`, reportFile: `tests/reports/smoke-hosted-selftest-${title.replace(/\W+/g, '-')}.json`, team, aud, exitCodes: false, ...opts }); }
    finally { console.error = err; console.log = out_; process.exitCode = prev; }
  };
  const worker = async (n, vars) => { const state = resolve(`.wrangler/saha-smoke-hosted-${n}-state`); migrateOnce(state); return startWorker({ port: port + n, name: `saha-smoke-hosted-${n}`, state, fresh: false, vars }); };

  // 1) The deployed shape: Access in front of a Worker that trusts only Access.
  let w = await worker(1, { SAHA_IDENTITY_PROVIDER: 'cloudflare-access', SAHA_ACCESS_TEAM_DOMAIN: team, SAHA_ACCESS_AUD: aud, SAHA_ENVIRONMENT: 'synthetic' });
  let e = await edge({ port: port + 3, origin: w.base, access: true, team, aud });
  let out;
  try {
    out = await scenario('good site no token', { base: e.url });
    await st.check('good site, anonymous tier: every check passes, the service-token tier is skipped with a reason', async () => { assert.equal(out.failed, 0, labelsFailed(out).join(' | ')); assert.ok(out.passed >= 9); assert.ok(out.checks.filter(c => c.ok === null && /service token/i.test(c.skipped)).length >= 4); assert.match(out.line, /^HOSTED SMOKE PASS/); });
    out = await scenario('good site service token', { base: e.url, token: { id: e.token.id, secret: e.token.secret } });
    await st.check('good site with a service token: Access admits it, the real app refuses it with 401, and that is recorded (not a failure)', async () => { assert.equal(out.failed, 0, labelsFailed(out).join(' | ')); assert.match(out.serviceTokenOutcome, /app refused the identity with 401/); assert.ok(out.checks.some(c => c.ok === null && /synthetic with external services off/.test(c.label))); });
    out = await scenario('wrong service token', { base: e.url, token: { id: 'wrong', secret: 'wrong' } });
    await st.check('a service token Access does not admit is a failure that says so', async () => { assert.ok(out.failed >= 1); assert.ok(out.checks.some(c => c.ok === false && /not admitted|redirected|Access answered/.test(c.error ?? ''))); });
  } finally { await e.close(); }
  // 2) Access removed: only the app stands in the way. Forged headers must still be refused; the Access-redirect checks must fail.
  e = await edge({ port: port + 3, origin: w.base, access: false, team, aud });
  try {
    out = await scenario('access missing app in access mode', { base: e.url });
    await st.check('Access missing, app in cloudflare-access mode: the redirect checks fail, but forged identity headers, garbage and unsigned JWTs are still refused by the app', async () => {
      const bad = labelsFailed(out); assert.ok(bad.some(l => /GET \/api\/workspace is held by Cloudflare Access/.test(l)), 'the Access check must fail'); assert.ok(bad.some(l => /^the page \(GET \/\) is held/.test(l)));
      for (const must of [/forged Sites dispatcher/, /garbage Cf-Access-Jwt-Assertion/, /unsigned Cf-Access-Jwt-Assertion/, /garbage CF_Authorization/]) assert.ok(!bad.some(l => must.test(l)), `the app should have refused: ${bad.join(' | ')}`);
    });
  } finally { await e.close(); await w.stop(); }
  // 3) The dangerous mistake: the Sites dispatcher identity provider (headers trusted) exposed publicly with no Access in front.
  w = await worker(2, {});
  e = await edge({ port: port + 3, origin: w.base, access: false, team, aud });
  try {
    out = await scenario('dispatcher headers exposed', { base: e.url });
    await st.check('dispatcher-header identity exposed with no Access: forged identity headers get in, and the suite FAILS on exactly that', async () => {
      const bad = labelsFailed(out); assert.equal(out.verdict, 'FAIL'); assert.ok(bad.some(l => /forged Sites dispatcher/.test(l)), `forged-header check should fail: ${bad.join(' | ')}`);
      assert.ok(bad.some(l => /garbage Cf-Access-Jwt-Assertion/.test(l)), 'the garbage-JWT check carries the forged headers and should fail too'); assert.ok(bad.some(l => /held by Cloudflare Access/.test(l)));
      assert.ok((out.checks.find(c => /forged Sites dispatcher/.test(c.label))?.error ?? '').includes('application content'), 'the failure message names the leaked content');
    });
  } finally { await e.close(); await w.stop(); }
  // 4) The accepted-identity branch of the service-token tier (canned answer).
  w = null; e = await edge({ port: port + 3, origin: 'http://127.0.0.1:1', access: true, team, aud, tokenAnswer: 'canned200' });
  try {
    out = await scenario('service token accepted', { base: e.url, token: { id: e.token.id, secret: e.token.secret } });
    await st.check('if the app accepts the service identity (canned 200): workspace shape, headers, page and synthetic environment are checked', async () => {
      const t = ['hosted environment is synthetic with external services off']; assert.equal(out.failed, 0, labelsFailed(out).join(' | ')); assert.match(out.serviceTokenOutcome, /accepted the service identity/); assert.ok(out.checks.some(c => c.ok === true && c.label.includes(t[0])));
    });
  } finally { await e.close(); }
  // 5) Not executed: an unreachable site, and the sandbox gateway's "host_not_allowed" answer, must never read as a pass.
  const refusedPort = port + 3; // nothing listens here now
  out = await scenario('unreachable', { base: `http://127.0.0.1:${refusedPort}` });
  await st.check('an unreachable site is NOT EXECUTED, with a reason and curl classification, never a pass', async () => { assert.equal(out.verdict, 'NOT EXECUTED'); assert.equal(out.passed, 0); assert.equal(out.executed, false); assert.match(out.line, /connection refused|request failed|timed out/); assert.equal(out.reachability?.curl?.code, 7); });
  e = await edge({ port: port + 3, origin: 'http://127.0.0.1:1', access: true, team, aud, deny: true });
  try {
    out = await scenario('gateway denial', { base: e.url });
    await st.check("an egress gateway's 403 host_not_allowed is NOT EXECUTED (it is not the app's answer and not a pass of 'refused')", async () => { assert.equal(out.verdict, 'NOT EXECUTED'); assert.match(out.line, /egress gateway/); assert.equal(out.passed, 0); });
  } finally { await e.close(); }
  await st.finish(); console.log(`HOSTED SMOKE SELF-TEST ${st.failed ? 'FAIL' : 'PASS'}`);
}

if (process.argv.includes('--self-test')) {
  await selfTest().catch(e => { console.error(e); process.exitCode = 1; });
} else {
  const base = process.env.SAHA_HOSTED_URL || DEFAULT_URL, id = process.env.CF_ACCESS_CLIENT_ID, secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!!id !== !!secret) { console.error('Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or neither.'); process.exitCode = 1; }
  else {
    const out = await hostedRun({ base, token: id && secret ? { id, secret } : null, reportFile: 'tests/reports/smoke-hosted-result.json' }).catch(e => { console.error(e); process.exitCode = 1; return null; });
    if (out) console.log(out.line);
  }
}
