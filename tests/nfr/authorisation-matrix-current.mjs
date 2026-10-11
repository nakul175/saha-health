import {acquireSyntheticSource} from '../lib/clinical-source-fixture.mjs';
import assert from 'node:assert/strict';
// Slice 11d: authorisation matrix (non-functional: security). One organisation with an owner, an admin, a supervisor, two ASHAs (each
// assigned different patients), a clinician and a stranger with their own organisation. Every GET route in docs/current/HTTP-ROUTES.csv is
// requested as every role and anonymously, and a representative set of POST /api/commands commands is sent as every role.
// Invariants (each is a check; a failure is a possible security defect to report, never to fix from here):
//   (i)   no route returns 5xx for any role;                                  (ii)  anonymous gets 401 on every /api/ route;
//   (iii) the stranger never gets 2xx, and no response carries this organisation's data, when it sends this organisation's id;
//   (iv)  an ASHA asking for another ASHA's patient gets 403 or 404 and sees none of that patient's data on any route;
//   (v)   the admin (no patient scope) never receives a patient name;        (vi)  no response carries an invitation token or its stored hash;
//   (vii) every API response is Cache-Control: no-store (identity-dependent data must not be cached);
//   (viii) suspending a member stops access on the next request (every route, and commands), measured from acknowledgement to first denial.
// Synthetic data only; a local built Worker with local D1. Run twice by the slice: the status grid carries a hash for comparison.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { identity } from '../lib/worker.mjs';
import { startMiniflare } from '../lib/miniflare.mjs';
import { suite } from '../lib/report.mjs';
import { buildWorld, ROLES, pngBytes } from '../lib/nfr-world.mjs';

const PORT = process.env.SAHA_TEST_PORT ?? '8831';
const r = suite('Authorisation matrix (non-functional: security)', 'tests/reports/authorisation-matrix-current-result.json', {
  layer: 'non-functional',
  limits: [
    'Local built Worker with the Sites dispatcher header model; this proves server-side authorisation of the implemented routes, not the hosted Cloudflare Access sign-in (see identity-hardening).',
    'Requests are built from the route parameters read from the route readers in lib/saha/*-server.ts; a route reader that adds a parameter must be added to ROUTE_PARAMS here (the suite fails on an unclassified route).',
    'Seven roles in one organisation: owner (clinician with owner authority), admin, supervisor, two ASHAs, clinician, and a stranger. The provider role, delegation and emergency-access paths are not exercised here.',
    'A response is judged by status and by searching its text for synthetic patient names and identifiers; a leak of an unnamed derived value (a count, a village) would not be found.',
    'Commands: a representative set (27 rows in the command table) across patient, organisation, owner-only, import and identity families, not the 211 command names in docs/current/COMMAND-CATALOGUE.csv; the role refusals are asserted; for owner-only commands whose valid input needs configuration this suite does not build, the owner receives a validation or state answer (404, 409 or 422), which is recorded but not judged.',
  ],
});

const ROUTES = readFileSync('docs/current/HTTP-ROUTES.csv', 'utf8').trim().split('\n').slice(1).map(l => { const [method, route, source] = l.split(','); return { method, route, source }; });

// Documented query parameters per GET route (read from the route readers). kind: which resource the request names.
const PERSON = ['/api/abdm', '/api/action-plan', '/api/household', '/api/identity-cases', '/api/history', '/api/patients/detail'];
const ROUTE_PARAMS = {
  '/api/today': w => [{ q: '' }, { q: `?personId=${w.people.a2}`, kind: 'person' }],
  '/api/media': w => [{ q: `?visitId=${w.visits.v2}`, kind: 'visit' }],
  '/api/inbound-conflicts': w => [{ q: `?personId=${w.people.a2}`, kind: 'clinical-source-person' }],
  '/api/indicator-figures': () => [{ q: '' }],
  '/api/reporting-completeness': () => [{ q: '' }],
  '/api/installed-pack-work': w => [{q:''},{q:`?personId=${w.people.a2}`,kind:'person'}],
  '/api/installed-pack-transition': () => [{q:''}], // migration 0032: audited read of reviewed programme transitions; every principal is checked for patient, token and organisation leakage like the other GET routes
  '/api/imported-evidence': w => [{ q: `?personId=${w.people.a2}`, kind: 'clinical-source-person' }],
  '/api/clinical-sources': w => [{q:w.sourceQuery}],
  ...Object.fromEntries(PERSON.map(p => [p, w => [{ q: `?personId=${w.people.a2}`, kind: 'person' }]])),
  '/api/rights': w => [{ q: '' }, { q: `?personId=${w.people.a2}`, kind: 'person' }],
  '/api/work-burden/support': w => [{ q: `?visitId=${w.visits.v2}`, kind: 'visit' }],
  '/api/work-burden/attribution': () => [{ q: '' }],
  '/api/trace': w => [{ q: `?visit=${w.visits.v2}`, kind: 'visit' }],
  '/api/governance': w => [{ q: '' }, { q: `?visitId=${w.visits.v2}`, kind: 'visit' }],
  '/api/fhir/[id]': w => [{ path: `/api/fhir/${w.visits.v2}`, q: `?organisationId=${w.org}`, kind: 'visit' }],
  '/api/media/[id]': w => [{ path: `/api/media/${w.mediaId}`, q: `?organisationId=${w.org}`, kind: 'media' }],
  // Routes with no resource parameter (or only optional filters): requested bare.
  ...Object.fromEntries(['/api/work-burden/policy', '/api/work-burden', '/api/availability', '/api/value-range-protocols', '/api/aggregate-reports', '/api/alerts', '/api/anaemia-provider', '/api/audit/chain', '/api/audit', '/api/caseload', '/api/continuity', '/api/data-exit', '/api/delegations', '/api/environment', '/api/exceptional', '/api/exceptions', '/api/expansion', '/api/facility-scope', '/api/fixture-migration', '/api/frontline-providers', '/api/incentive-claims', '/api/indicators', '/api/notification-channel', '/api/operations', '/api/outreach', '/api/pack-installations', '/api/patients', '/api/pilot', '/api/programme-migration', '/api/provider-sandbox', '/api/purpose-scope', '/api/reassignment', '/api/referral-escalations', '/api/referral-requests', '/api/retention', '/api/worker-activity', '/api/worklists', '/api/workspace'].map(p => [p, () => [{ q: '' }]])),
};
const PRINCIPALS = ['anonymous', ...ROLES];
const ABBR = { anonymous: 'anon', owner: 'owner', admin: 'admin', supervisor: 'super', asha1: 'asha1', asha2: 'asha2', clinician: 'clin', stranger: 'strngr' };

const t0 = performance.now();
const worker = await startMiniflare({ port: PORT, name: 'nfr-authorisation-current' });
let world;
try {
  world = await buildWorld(worker.base, { connectionClose: true });
  world.sourceQuery=await acquireSyntheticSource(world.api,world.who.owner,world.org,'role-control');
  const { api, who, org } = world;
  console.log(`world built in ${Math.round(performance.now() - t0)} ms (7 roles, 3 patients, 2 confirmed visits, 1 draft visit with media)`);
  const as = l => (l === 'anonymous' ? null : who[l]);
  const ids = x => Object.values(x);

  // What each principal must never see. ASHA 1's resources are hidden from ASHA 2 and the reverse.
  const markers = { // this organisation's data, for the stranger
    org: [org, world.orgName, ...world.patientNames.slice(0, 3), ...ids(world.people), ...ids(world.visits), world.mediaId, ...ROLES.filter(l => l !== 'stranger').flatMap(l => [who[l].id, who[l].headers['oai-authenticated-user-email']])],
  };
  const hidden = {
    asha1: [world.quillon('Beta'), world.quillon('Gamma'), world.people.a2, world.people.a2b, world.visits.v2, world.visits.draft2, world.mediaId],
    asha2: [world.quillon('Alpha'), world.people.a1, world.visits.v1],
  };
  // Invitation secrets: the one-time tokens and their stored verifiers (the server hashes JSON.stringify(token) with SHA-256, lib/saha/core.ts digest).
  const secrets = [...world.inviteTokens, ...world.inviteTokens.map(t => createHash('sha256').update(JSON.stringify(t)).digest('hex'))];
  const found = (text, needles) => needles.filter(n => text.toLowerCase().includes(n.toLowerCase()));
  const where = (value, needles, path = '$', out = []) => { // JSON paths whose string values contain a needle (first few), for a precise report
    if (out.length >= 3) return out;
    if (typeof value === 'string') { if (found(value, needles).length) out.push(path); } else if (Array.isArray(value)) value.some((x, i) => where(x, needles, `${path}[${i}]`, out).length >= 3); else if (value && typeof value === 'object') Object.entries(value).some(([k, x]) => where(x, needles, `${path}.${k}`, out).length >= 3);
    return out;
  };

  const keyPaths = (value, re, path = '$', out = []) => { // JSON paths of keys matching re
    if (out.length >= 3) return out;
    if (Array.isArray(value)) value.some((x, i) => keyPaths(x, re, `${path}[${i}]`, out).length >= 3); else if (value && typeof value === 'object') for (const [k, x] of Object.entries(value)) { if (re.test(k)) out.push(`${path}.${k}`); else keyPaths(x, re, `${path}.${k}`, out); if (out.length >= 3) break; }
    return out;
  };

  // ── Route × role grid ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const cases = []; const unclassified = [];
  for (const { route } of ROUTES.filter(x => x.method === 'GET')) {
    const make = ROUTE_PARAMS[route]; if (!make) { unclassified.push(route); continue; }
    for (const c of make(world)) cases.push({ route, path: (c.path ?? route) + c.q, kind: c.kind ?? 'plain', cells: {} });
  }
  for (const c of cases) {
    for (const p of PRINCIPALS) {
      const res = await api.call(as(p), c.path, { org });
      const text = res.text, parsed = res.json;
      c.cells[p] = { status: res.status, bytes: text.length, ms: Math.round(res.ms), cache: res.headers.get('cache-control'),
        patientNames: found(text, world.patientNames), orgMarkers: found(text, markers.org), hidden: p === 'asha1' || p === 'asha2' ? found(text, hidden[p]) : [],
        tokenHash: [...found(text, secrets).map(x => `${x.slice(0, 8)}…`), ...(parsed ? keyPaths(parsed, /token_?hash/i) : []), ...(/token_?hash["']?\s*[:=,]\s*["']?[0-9a-f]{64}/i.test(text) ? ['(a token_hash value)'] : [])], paths: parsed ? where(parsed, p === 'stranger' ? markers.org : p.startsWith('asha') ? hidden[p] : world.patientNames) : [] };
    }
  }
  const grid = cases.map(c => ({ route: c.route, request: c.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').replace(/org_[0-9a-f]+/, '<org>'), kind: c.kind, status: Object.fromEntries(PRINCIPALS.map(p => [p, c.cells[p].status])) }));
  const hash = createHash('sha256').update(JSON.stringify(grid.map(g => [g.request, ...PRINCIPALS.map(p => g.status[p])]))).digest('hex').slice(0, 16);
  console.log('\nGET route x role (status):\n' + 'request'.padEnd(36) + PRINCIPALS.map(p => ABBR[p].padStart(7)).join(''));
  for (const g of grid) console.log(g.request.padEnd(36) + PRINCIPALS.map(p => String(g.status[p]).padStart(7)).join(''));
  console.log(`grid hash ${hash} (${cases.length} requests x ${PRINCIPALS.length} principals = ${cases.length * PRINCIPALS.length})\n`);

  const fmt = (c, p, extra = '') => `${c.route} as ${p}: ${c.cells[p].status}${extra}`;
  const violations = (pick) => cases.flatMap(c => PRINCIPALS.flatMap(p => { const v = pick(c, p); return v ? [fmt(c, p, ` ${v}`)] : []; }));
  const none = (list, what) => { if (list.length) throw new Error(`${what}: ${list.length} violation(s)\n  ` + list.slice(0, 12).join('\n  ')); };

  await r.check('route catalogue is fully classified (every GET route in HTTP-ROUTES.csv has documented parameters here)', () => none(unclassified, `unclassified GET routes: ${unclassified.join(', ')}`));
  await r.check(`grid is complete: ${cases.length} requests x ${PRINCIPALS.length} principals, every cell has a status`, () => { if (cases.length < 40) throw new Error(`only ${cases.length} cases`); none(violations((c, p) => (Number.isInteger(c.cells[p].status) ? '' : 'no status')), 'cells'); });
  // Today deliberately has an ASHA-only contract: owner authority cannot widen it.
  await r.check('control: owner gets 2xx on legacy routes and 403 on the ASHA-only Today route', () => none(violations((c, p) => p === 'owner' && (c.route === '/api/today' ? c.cells[p].status !== 403 : !(c.cells[p].status >= 200 && c.cells[p].status < 300)) ? 'unexpected owner status for declared role contract' : ''), 'owner control'));
  await r.check('Today list allows both active ASHAs and refuses all other roles; ASHA 2 opens its own record', () => {
    const list = cases.find(c => c.route === '/api/today' && c.kind === 'plain');
    const detail = cases.find(c => c.route === '/api/today' && c.kind === 'person');
    assert.ok(list && detail);
    for (const p of ROLES) assert.equal(list.cells[p].status, p.startsWith('asha') ? 200 : 403, fmt(list, p));
    assert.equal(detail.cells.asha2.status, 200);
    assert.ok([403, 404].includes(detail.cells.asha1.status));
  });
  await r.check('control: for every ASHA-readable route naming a resource of ASHA 2, ASHA 2 gets 200 (so ASHA 1\'s refusal is a scope refusal, not a malformed request)', () => none(violations((c, p) => p === 'asha2' && c.kind !== 'plain' && c.kind !== 'clinical-source-person' && c.cells[p].status !== 200 ? 'expected 200' : ''), 'asha2 control'));
  await r.check('clinical source history permits scoped clinicians and refuses both ASHAs including the assigned ASHA', () => { const c=cases.find(c=>c.route==='/api/imported-evidence');assert.ok(c);for(const p of ['owner','clinician'])assert.equal(c.cells[p].status,200,fmt(c,p));for(const p of ['asha1','asha2'])assert.equal(c.cells[p].status,403,fmt(c,p)); });
  await r.check('inbound conflict history permits scoped care clinicians and supervisor and refuses ASHAs and administrator', () => { const c=cases.find(c=>c.route==='/api/inbound-conflicts');assert.ok(c);for(const p of ROLES)assert.equal(c.cells[p].status,['owner','clinician','supervisor'].includes(p)?200:403,fmt(c,p)); });
  await r.check('frozen figure metadata permits current reporting owner/supervisor and refuses other roles', () => { const c=cases.find(c=>c.route==='/api/indicator-figures');assert.ok(c);for(const p of ROLES)assert.equal(c.cells[p].status,['owner','supervisor'].includes(p)?200:403,fmt(c,p)); });
  await r.check('(i) no route returns 5xx for any role or anonymously', () => none(violations((c, p) => c.cells[p].status >= 500 ? 'server error' : ''), '5xx'));
  await r.check('(ii) anonymous gets 401 on every GET /api/ route', () => none(violations((c, p) => p === 'anonymous' && c.cells[p].status !== 401 ? 'expected 401' : ''), 'anonymous'));
  await r.check('(iii-a) the stranger never gets 2xx for this organisation (every GET route refuses with 403)', () => none(violations((c, p) => p === 'stranger' && c.cells[p].status !== 403 ? 'expected 403' : ''), 'stranger status'));
  await r.check('(iii-b) no response to the stranger (success or error) carries this organisation\'s id, name, patients, visits, media or members', () => none(violations((c, p) => p === 'stranger' && c.cells[p].orgMarkers.length ? `leaked ${JSON.stringify(c.cells[p].orgMarkers)} at ${c.cells[p].paths.join(',')}` : ''), 'stranger leak'));
  await r.check('(iv-a) ASHA 1 asking for ASHA 2\'s patient, visit or media gets 403 or 404 on every such route', () => none(violations((c, p) => p === 'asha1' && c.kind !== 'plain' && ![403, 404].includes(c.cells[p].status) ? 'expected 403 or 404' : ''), 'asha1 refusal'));
  await r.check('(iv-b) on every route, ASHA 1 never receives ASHA 2\'s patient names, patient ids, visit ids or media id, and ASHA 2 never receives ASHA 1\'s', () => none(violations((c, p) => c.cells[p].hidden.length ? `saw another ASHA's ${JSON.stringify(c.cells[p].hidden)} at ${c.cells[p].paths.join(',') || 'response text'}` : ''), 'cross-ASHA leak'));
  await r.check('(v-a) the admin (no patient scope) never receives a patient name on any route', () => none(violations((c, p) => p === 'admin' && c.cells[p].patientNames.length ? `leaked ${JSON.stringify(c.cells[p].patientNames)} at ${c.cells[p].paths.join(',')}` : ''), 'admin names'));
  await r.check('(v-b) the admin gets 403 or 404 on every route that names a patient, visit or media item', () => none(violations((c, p) => p === 'admin' && c.kind !== 'plain' && ![403, 404].includes(c.cells[p].status) ? 'expected 403 or 404' : ''), 'admin refusal'));
  await r.check('(vi) no response carries an invitation token or its stored hash (searched by value, for every principal)', () => none(violations((c, p) => c.cells[p].tokenHash.length ? `invitation secret in the response: ${c.cells[p].tokenHash.join(',')}` : ''), 'token hash'));
  await r.check('(vii) every API response is Cache-Control: no-store', () => none(violations((c, p) => !/no-store/.test(c.cells[p].cache ?? '') ? `cache-control: ${c.cells[p].cache}` : ''), 'caching'));

  await r.check('work-burden policy requires current care membership for every role', () => { const c=cases.find(x=>x.route==='/api/work-burden/policy'); for(const p of ROLES) assert.equal(c.cells[p].status,['owner','asha1','asha2','clinician'].includes(p)?200:403,p); });
  await r.check('work-burden report is operations-only for every current role', () => { const c=cases.find(x=>x.route==='/api/work-burden'); for(const p of ROLES) assert.equal(c.cells[p].status,['owner','admin'].includes(p)?200:403,p); });
  await r.check('availability report is operations-only for every current role', () => { const c=cases.find(x=>x.route==='/api/availability'); for(const p of ROLES) assert.equal(c.cells[p].status,['owner','admin'].includes(p)?200:403,p); });
  await r.check('value range publication report is owner/clinician-only for every current role', () => { const c=cases.find(x=>x.route==='/api/value-range-protocols'); for(const p of ROLES) assert.equal(c.cells[p].status,['owner','clinician'].includes(p)?200:403,p); });

  // ── Anonymous on the non-GET routes ─────────────────────────────────────────────────────────────────────────────────────────────────
  const png = new Uint8Array(2048); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const anonRows = [];
  for (const { method, route } of ROUTES.filter(x => x.method !== 'GET')) {
    const path = route.replace('[id]', 'abc12345') + (route === '/api/media' ? '?visitId=abc12345&purpose=wound-or-skin' : '');
    const body = route === '/api/commands' ? { type: 'startVisit', personId: 'abc12345' } : route === '/api/record-opened' ? { personId: 'abc12345' } : route === '/api/media/[id]' ? { reason: 'Synthetic reason' } : route === '/api/media' ? undefined : {};
    const key = crypto.randomUUID();
    const res = route === '/api/media'
      ? await fetch(worker.base + path, { method, headers: { Connection: 'close', 'Content-Type': 'image/png', 'Idempotency-Key': key, 'x-saha-organisation': org }, body: png }).then(async x => ({ status: x.status, text: await x.text() }))
      : await api.call(null, path, { method, body, org, headers: { 'Idempotency-Key': key } });
    anonRows.push({ method, route, status: res.status, error: res.text.slice(0, 90) });
  }
  console.log('Anonymous on non-GET routes:\n' + anonRows.map(x => `${x.method.padEnd(7)}${x.route.padEnd(28)}${x.status}  ${x.error}`).join('\n') + '\n');
  // /api/mis/callback is a webhook authenticated by an HMAC signature and a per-organisation grant, not by a signed-in identity
  // (lib/saha/mis-callback.ts authenticateCallback), so an unsigned anonymous call is refused by validation or signature rather than 401.
  // The synthetic reminder callback likewise requires a signature and exact organisation grant;
  // malformed input can be refused before authentication. Both exceptions must independently refuse it.
  const WEBHOOK = new Set(['/api/mis/callback', '/api/reminder-optout/callback']);
  await r.check('(ii) anonymous gets 401 on every POST and DELETE /api/ route, except signature-authenticated callbacks', () => none(anonRows.filter(x => !WEBHOOK.has(x.route) && x.status !== 401).map(x => `${x.method} ${x.route}: ${x.status} ${x.error}`), 'anonymous non-GET'));
  await r.check('(ii) the MIS webhook refuses an unsigned anonymous call (4xx, never 2xx or 5xx)', () => { const x = anonRows.find(y => y.route === '/api/mis/callback'); if (!x || x.status < 400 || x.status >= 500) throw new Error(`/api/mis/callback: ${x?.status}`); });
  await r.check('(ii) the reminder callback refuses an unsigned anonymous call (4xx, never 2xx or 5xx)', () => { const x = anonRows.find(y => y.route === '/api/reminder-optout/callback'); if (!x || x.status < 400 || x.status >= 500) throw new Error(`/api/reminder-optout/callback: ${x?.status}`); });

  // ── Search and write routes other than /api/commands ───────────────────────────────────────────────────────────────────────────────────
  const ownerSnap = await world.load('owner', org), a2 = ownerSnap.people.find(p => p.id === world.people.a2);
  const post = (l, path, body) => api.call(as(l), path, { method: 'POST', body, org });
  const statuses = {}; // label -> role -> status, for the report
  const sweep = async (label, make) => { statuses[label] = {}; const out = {}; for (const l of ROLES) { const x = await make(l); statuses[label][l] = x.status; out[l] = x; } return out; };
  await r.check('POST /api/record-opened: ASHA 2, the owner, the clinician and the supervisor may report opening ASHA 2\'s patient; ASHA 1, the admin and the stranger are refused', async () => {
    const x = await sweep('POST /api/record-opened', l => post(l, '/api/record-opened', { personId: world.people.a2 }));
    const bad = [...['asha2', 'owner', 'clinician', 'supervisor'].filter(l => x[l].status !== 200).map(l => `${l} got ${x[l].status}`), ...['asha1'].filter(l => ![403, 404].includes(x[l].status)).map(l => `${l} got ${x[l].status}`), ...['admin'].filter(l => ![403, 404].includes(x[l].status)).map(l => `${l} got ${x[l].status}`), ...(x.stranger.status !== 403 ? [`stranger got ${x.stranger.status}`] : [])];
    if (bad.length) throw new Error(bad.join('; '));
  });
  await r.check('POST /api/patients (name search): each role finds only the patients it may see; the admin and the stranger find none', async () => {
    const x = await sweep('POST /api/patients {q}', l => post(l, '/api/patients', { q: 'quillon' }));
    const bad = [];
    for (const l of ROLES) if (x[l].status >= 500) bad.push(`${l} ${x[l].status}`);
    if (x.asha1.status !== 200 || !x.asha1.text.includes(world.quillon('Alpha'))) bad.push(`control: asha1 should find own patient (${x.asha1.status})`);
    if (found(x.asha1.text, hidden.asha1).length) bad.push(`asha1 found another ASHA's patient ${JSON.stringify(found(x.asha1.text, hidden.asha1))}`);
    if (found(x.asha2.text, hidden.asha2).length) bad.push(`asha2 found another ASHA's patient ${JSON.stringify(found(x.asha2.text, hidden.asha2))}`);
    if (x.admin.status === 200 && found(x.admin.text, world.patientNames).length) bad.push(`admin found ${JSON.stringify(found(x.admin.text, world.patientNames))}`);
    if (x.stranger.status !== 403 || found(x.stranger.text, markers.org).length) bad.push(`stranger got ${x.stranger.status}`);
    if (bad.length) throw new Error(bad.join('; '));
  });
  await r.check('POST /api/patient-matches: asking with ASHA 2\'s patient\'s exact name and locality reveals the match only to roles in scope; ASHA 1, the admin and the stranger learn nothing', async () => {
    const body = { name: a2.name, age: a2.age, sex: a2.sex, village: a2.village, teamId: 'default' };
    const x = await sweep('POST /api/patient-matches', l => post(l, '/api/patient-matches', body));
    const bad = [];
    for (const l of ['asha2', 'owner']) if (x[l].status !== 200 || !(x[l].json?.candidates ?? []).some(c => c.id === world.people.a2)) bad.push(`control: ${l} should see the match (${x[l].status})`);
    if (x.asha1.status === 200 && (x.asha1.json?.candidates ?? []).length) bad.push(`asha1 was shown ${x.asha1.json.candidates.length} candidate(s): ${found(x.asha1.text, [a2.name, a2.id])}`);
    if (![403, 404, 200].includes(x.asha1.status)) bad.push(`asha1 got ${x.asha1.status}`);
    for (const l of ['admin', 'stranger']) if (x[l].status === 200 || found(x[l].text, [a2.name, a2.id]).length) bad.push(`${l} got ${x[l].status} ${found(x[l].text, [a2.name, a2.id])}`);
    for (const l of ROLES) if (x[l].status >= 500) bad.push(`${l} ${x[l].status}`);
    if (bad.length) throw new Error(bad.join('; '));
  });
  await r.check('POST /api/media and DELETE /api/media/<id> on ASHA 2\'s draft visit: ASHA 1, the admin and the stranger are refused, and ASHA 2\'s media survives', async () => {
    const upload = l => fetch(`${worker.base}/api/media?visitId=${encodeURIComponent(world.visits.draft2)}&purpose=wound-or-skin`, { method: 'POST', headers: { Connection: 'close', ...as(l).headers, 'Content-Type': 'image/png', 'Idempotency-Key': crypto.randomUUID(), 'x-saha-organisation': org }, body: pngBytes(2048, 5) }).then(async x => ({ status: x.status, text: await x.text() }));
    const remove = l => api.call(as(l), `/api/media/${world.mediaId}`, { method: 'DELETE', body: { reason: 'Synthetic removal attempt' }, org });
    const bad = [];
    for (const l of ['asha1', 'admin', 'stranger']) { const u = await upload(l), d = await remove(l); if (![403, 404].includes(u.status)) bad.push(`${l} upload got ${u.status}`); if (![403, 404].includes(d.status)) bad.push(`${l} delete got ${d.status}`); }
    const still = await fetch(`${worker.base}/api/media/${world.mediaId}?organisationId=${org}`, { headers: { ...who.asha2.headers, Connection: 'close' } });
    if (still.status !== 200) bad.push(`ASHA 2's media is gone or unreadable: ${still.status}`);
    if (bad.length) throw new Error(bad.join('; '));
  });

  // ── POST /api/commands ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  let n = 0; const stamp = () => `${world.run}-${++n}`;
  const rand24 = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const ctx = { opsVersion: 0 };
  const freshPatient = async (assignee) => {
    const id = await world.mk(`Quillon Cmd ${stamp()}`);
    if (assignee) { const p = (await world.load('owner', org)).people.find(x => x.id === id); await world.cmd('owner', { type: 'assignPatient', personId: id, version: p.version, teamId: 'default', assignedTo: who[assignee].id, reason: 'Synthetic assignment for the command matrix' }, { org }); }
    const p = (await world.load('owner', org)).people.find(x => x.id === id);
    return { id, version: p.version };
  };
  const ownerView = async () => world.load('owner', org);
  const ALL = ROLES, NOT = (...x) => ALL.filter(l => !x.includes(l));
  // ok: roles that must get 2xx. no: roles that must be refused (status noStatus, default 403). notRefused: roles that must not be refused (state may still say 404/409/422).
  // Everything else is recorded and must not be 5xx. Refusals asserted are the ones the code defines (comments name where).
  const SPECS = [
    { id: 'startVisit', family: 'patient', ok: ['asha2', 'owner', 'clinician'], no: ['admin', 'supervisor', 'asha1', 'stranger'], make: async () => ({ type: 'startVisit', personId: (await freshPatient('asha2')).id }) }, // core.care(): asha or clinician; person(): assigned
    { id: 'setConsent', family: 'patient', ok: ['asha2', 'owner', 'clinician'], no: ['admin', 'supervisor', 'asha1', 'stranger'], make: async () => { const p = await freshPatient('asha2'); return { type: 'setConsent', personId: p.id, purpose: 'ai', active: false, version: p.version }; } }, // consent.authorizeConsent
    { id: 'correctIdentity', family: 'patient', ok: ['asha2', 'owner', 'clinician'], no: ['admin', 'supervisor', 'asha1', 'stranger'], make: async () => { const p = await freshPatient('asha2'), name = `Quillon Fixed ${stamp()}`; world.patientNames.push(name); return { type: 'correctIdentity', personId: p.id, version: p.version, name, age: 41, sex: 'Female', village: world.village(), reason: 'Synthetic identity correction for the command matrix' }; } }, // platform clinical()
    { id: 'createPerson', family: 'patient', ok: ['owner', 'clinician'], no: ['admin', 'supervisor', 'stranger'], make: async () => { const name = `Quillon Reg ${stamp()}`; world.patientNames.push(name); return { type: 'createPerson', name, age: 30, sex: 'Male', village: world.village(), programme: 'General care', teamId: 'default' }; } }, // continuity.reviewRegistration: asha or clinician; server: team membership, not admin
    { id: 'assignPatient', family: 'patient', ok: ['owner', 'supervisor'], no: ['admin', 'asha1', 'asha2', 'clinician', 'stranger'], make: async () => { const p = await freshPatient(null); return { type: 'assignPatient', personId: p.id, version: p.version, teamId: 'default', assignedTo: who.asha2.id, reason: 'Synthetic assignment for the command matrix' }; } }, // platform: owner or supervisor or delegated supervision
    { id: 'createReferral', family: 'patient', ok: ['asha2'], no: ['admin', 'supervisor', 'asha1', 'stranger'], make: async () => ({ type: 'createReferral', visitId: world.visits.v2, facility: 'Synthetic clinic', reason: 'Synthetic referral for the command matrix' }) }, // care role, visit in scope
    { id: 'createTeam', family: 'organisation', ok: ['owner'], no: NOT('owner'), make: async role => ({ type: 'createTeam', name: `Matrix team ${role} ${world.run}` }) }, // platform manage(): owner only
    { id: 'createInvite', family: 'organisation', ok: ['owner'], no: NOT('owner'), make: async () => ({ type: 'createInvite', accountCode: rand24(), label: 'Matrix invitation', role: 'asha', teamIds: ['default'] }) },
    { id: 'revokeInvite', family: 'organisation', ok: ['owner'], no: NOT('owner'), make: async () => { const i = await world.cmd('owner', { type: 'createInvite', accountCode: rand24(), label: 'Matrix to revoke', role: 'asha', teamIds: ['default'] }, { org }); return { type: 'revokeInvite', inviteId: i.result.invitationId }; } },
    { id: 'updateMember', family: 'organisation', ok: ['owner'], no: NOT('owner'), make: async () => { const m = (await ownerView()).members.find(x => x.userId === who.asha1.id); return { type: 'updateMember', userId: m.userId, version: m.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'active', reason: 'Synthetic no-op membership update' }; } },
    { id: 'renameOrganisation', family: 'organisation', ok: ['owner'], no: NOT('owner'), make: async () => ({ type: 'renameOrganisation', name: world.orgName, version: (await ownerView()).organisation.revision }) },
    { id: 'removeMember', family: 'organisation', ok: ['owner'], no: NOT('owner'), // caseload: owner only; the owner removes a throw-away member, everyone else names ASHA 1 (refused before anything changes)
      make: async role => {
        const m = (await ownerView()).members.find(x => x.userId === who.asha1.id);
        if (role !== 'owner') return { type: 'removeMember', userId: m.userId, version: m.version, reason: 'Synthetic removal attempt' };
        const t = identity(`temp${stamp().replace(/\W/g, '')}`, world.run);
        const w0 = await api.get(t, '/api/workspace'); const inv = await world.cmd('owner', { type: 'createInvite', accountCode: w0.json.user.accountCode, label: 'Throw-away', role: 'asha', teamIds: ['default'] }, { org });
        await api.command(t, { type: 'joinOrganisation', token: inv.result.token }, w0.json.organisation.id);
        const tm = (await ownerView()).members.find(x => x.userId === t.id); return { type: 'removeMember', userId: tm.userId, version: tm.version, reason: 'Synthetic removal of a throw-away member' };
      } },
    { id: 'opsRates', family: 'owner-only', ok: ['owner'], no: NOT('owner'), ops: true, make: async () => ({ type: 'opsRates', version: ctx.opsVersion, input: 1, output: 2 }) }, // operations: owner only (the admin is an operator but not an owner)
    { id: 'opsMaintenance', family: 'owner-only', ok: ['owner'], no: NOT('owner'), ops: true, make: async () => ({ type: 'opsMaintenance', version: ctx.opsVersion, active: false, reason: 'Synthetic matrix: keep running' }) },
    { id: 'opsBudget', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'opsBudget', version: ctx.opsVersion, capabilityKey: 'no-such-capability', monthlyUsd: 5, reason: 'Synthetic matrix budget' }) },
    { id: 'opsInvoiceReconcile', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'opsInvoiceReconcile', version: ctx.opsVersion, csv: 'not,a,real,invoice', thresholdPercent: 5, reason: 'Synthetic matrix invoice' }) },
    { id: 'configureEhr', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'configureEhr', integrationId: 'ehr_fhir', version: 1, read: true, write: false }) },
    { id: 'probeEhr', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'probeEhr', integrationId: 'ehr_fhir', version: 1 }) },
    { id: 'activateEhr', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'activateEhr', integrationId: 'ehr_fhir', version: 1 }) },
    { id: 'setEhrLookupPolicy', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'setEhrLookupPolicy', integrationId: 'ehr_fhir', version: 0, authoritative: false, consistencySeconds: 0, ownerId: null, reason: 'Synthetic matrix lookup policy' }) },
    { id: 'activateMis', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'activateMis', integrationId: 'mis_maternal', version: 1 }) },
    { id: 'testMis', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'testMis', integrationId: 'mis_maternal', version: 1 }) },
    { id: 'setAdapterOperations', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'setAdapterOperations', integrationId: 'ehr_fhir', version: 0, allowed: [], aggregateOnly: true, reason: 'Synthetic matrix adapter operations' }) },
    { id: 'enableAgentContract', family: 'owner-only', ok: [], notRefused: ['owner'], no: NOT('owner'), make: async () => ({ type: 'enableAgentContract', integrationId: 'ai_summary', version: 1, model: 'synthetic-model' }) },
    { id: 'patientImportApply', family: 'import', ok: [], notRefused: ['owner', 'supervisor'], no: ['admin', 'asha1', 'asha2', 'clinician', 'stranger'], make: async () => ({ type: 'patientImportApply', csv: `name,age,sex,village,programme,team\nQuillon Imp ${stamp()},30,Male,Nfr synthetic locality,General care,default`, planHash: 'a'.repeat(64), reason: 'Synthetic import for the command matrix' }) }, // patient-import mayImport(): owner or supervisor
    { id: 'joinOrganisation (unknown token)', family: 'identity', ok: [], no: ALL, noStatus: [404], make: async () => ({ type: 'joinOrganisation', token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '') }) },
    { id: 'switchOrganisation (to this organisation)', family: 'identity', ok: [], no: ['stranger'], make: async () => ({ type: 'switchOrganisation', organisationId: org }) },
  ];

  const cmdGrid = [];
  for (const spec of SPECS) {
    const order = [...spec.ok, ...ALL.filter(l => !spec.ok.includes(l))];
    const cells = {};
    for (const role of order) {
      const body = await spec.make(role);
      const res = await api.command(who[role], body, org);
      if (spec.ops && role === 'owner' && res.status === 200) ctx.opsVersion++;
      cells[role] = { status: res.status, error: res.status >= 400 ? (res.json?.error ?? res.text).slice(0, 100) : '', leaked: found(res.text, role === 'admin' || role === 'stranger' ? world.patientNames : role === 'asha1' || role === 'asha2' ? hidden[role] : []) };
    }
    cmdGrid.push({ id: spec.id, family: spec.family, status: Object.fromEntries(ALL.map(l => [l, cells[l].status])), cells });
    const noStatus = spec.noStatus ?? [403];
    await r.check(`command ${spec.id} (${spec.family}): ${spec.no.length ? `refused for ${spec.no.length} role(s); ` : ''}${spec.ok.length ? `succeeds for ${spec.ok.join(', ')}; ` : ''}${spec.notRefused?.length ? `not refused for ${spec.notRefused.join(', ')}; ` : ''}no 5xx anywhere`, () => {
      const bad = [];
      for (const l of spec.no) if (!noStatus.includes(cells[l].status)) bad.push(`${l} got ${cells[l].status} (expected ${noStatus.join('/')}) ${cells[l].error}`);
      for (const l of spec.ok) if (!(cells[l].status >= 200 && cells[l].status < 300)) bad.push(`${l} expected 2xx, got ${cells[l].status} ${cells[l].error}`);
      for (const l of spec.notRefused ?? []) if (cells[l].status === 403 || cells[l].status >= 500) bad.push(`${l} expected not-refused, got ${cells[l].status} ${cells[l].error}`);
      for (const l of ALL) { if (cells[l].status >= 500) bad.push(`${l} got ${cells[l].status}`); if (cells[l].leaked.length) bad.push(`${l} response carried ${JSON.stringify(cells[l].leaked)}`); }
      if (bad.length) throw new Error(bad.join('\n  '));
    });
  }
  console.log('\nPOST /api/commands (status by role):\n' + 'command'.padEnd(46) + ALL.map(l => ABBR[l].padStart(7)).join(''));
  for (const g of cmdGrid) console.log(g.id.padEnd(46) + ALL.map(l => String(g.status[l]).padStart(7)).join(''));
  const refusedCells = cmdGrid.flatMap(g => ALL.filter(l => g.status[l] === 403).map(l => `${g.id}/${l}: ${g.cells[l].error}`));
  console.log(`\n${refusedCells.length} refusals recorded; sample reasons:\n  ${refusedCells.filter((_, i) => i % 9 === 0).join('\n  ')}`);

  // Replayed commands are re-authorised: the stranger cannot replay the owner's idempotency key into this organisation.
  await r.check('a stranger cannot reuse the owner\'s idempotency key to read or repeat the owner\'s command', async () => {
    const key = crypto.randomUUID(), body = { type: 'createTeam', name: `Replay probe ${world.run}` };
    const first = await api.call(who.owner, '/api/commands', { method: 'POST', body, org, headers: { 'Idempotency-Key': key } });
    if (first.status !== 200) throw new Error(`owner create: ${first.status}`);
    const stolen = await api.call(who.stranger, '/api/commands', { method: 'POST', body, org, headers: { 'Idempotency-Key': key } });
    if (stolen.status !== 403) throw new Error(`stranger replay: expected 403, got ${stolen.status} ${stolen.text.slice(0, 120)}`);
    if (found(stolen.text, markers.org).length) throw new Error('stranger replay response carried organisation data');
  });
  // Cross-organisation: the owner's membership gives no authority over a different organisation the owner does not belong to.
  await r.check('a header naming a different organisation never lends this organisation\'s authority (owner of this organisation, other organisation id)', async () => {
    const other = world.snap.stranger.organisation.id;
    const read = await api.get(who.owner, '/api/workspace', other); if (read.status !== 403) throw new Error(`workspace: expected 403, got ${read.status}`);
    const write = await api.command(who.owner, { type: 'createTeam', name: `Cross org ${world.run}` }, other); if (write.status !== 403) throw new Error(`command: expected 403, got ${write.status}`);
  });

  // Revocation: membership is read on every request (no session cache), so suspension must stop access on the very next request.
  await r.check('(viii) suspending a member stops access on the next request: every GET route and a command are refused for the suspended ASHA, and access returns when reactivated', async () => {
    const m = (await world.load('owner', org)).members.find(x => x.userId === who.asha1.id);
    const before = await api.get(who.asha1, '/api/workspace', org); if (before.status !== 200) throw new Error(`control before suspension: ${before.status}`);
    const sus = await api.command(who.owner, { type: 'updateMember', userId: m.userId, version: m.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'suspended', reason: 'Synthetic suspension for the revocation check' }, org);
    const ackedAt = performance.now(); if (sus.status !== 200) throw new Error(`suspend: ${sus.status} ${sus.text.slice(0, 120)}`);
    const first = await api.get(who.asha1, '/api/workspace', org); const firstDenialMs = Math.round(performance.now() - ackedAt);
    if (first.status !== 403) throw new Error(`first request after the suspension acknowledgement: expected 403, got ${first.status}`);
    r.measure('ms from suspension acknowledgement to the first denied request (BRD limit 5 minutes)', firstDenialMs, { budget: 5 * 60 * 1000 });
    const allowed = [];
    for (const c of cases) { const x = await api.call(who.asha1, c.path, { org }); if (x.status >= 200 && x.status < 300) allowed.push(`${c.path} ${x.status}`); }
    const cmd = await api.command(who.asha1, { type: 'startVisit', personId: world.people.a1 }, org); if (cmd.status >= 200 && cmd.status < 300) allowed.push(`startVisit ${cmd.status}`);
    const mid = (await world.load('owner', org)).members.find(x => x.userId === who.asha1.id);
    const back = await api.command(who.owner, { type: 'updateMember', userId: mid.userId, version: mid.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'active', reason: 'Synthetic reactivation after the revocation check' }, org); if (back.status !== 200) throw new Error(`reactivate: ${back.status} ${back.text.slice(0, 120)}`);
    const after = await api.get(who.asha1, '/api/workspace', org); if (after.status !== 200) throw new Error(`access did not return after reactivation: ${after.status}`);
    if (allowed.length) throw new Error(`a suspended member was served: ${allowed.slice(0, 5).join('; ')}`);
  });

  await r.finish({ otherRoutes: statuses, gridHash: hash, requests: cases.length * PRINCIPALS.length, principals: PRINCIPALS, matrix: grid, anonymousNonGet: anonRows, commandMatrix: cmdGrid.map(g => ({ command: g.id, family: g.family, status: g.status, refusals: Object.fromEntries(Object.entries(g.cells).filter(([, c]) => c.status === 403).map(([l, c]) => [l, c.error])) })), durationMs: Math.round(performance.now() - t0) });
} catch (e) {
  console.error(e); process.exitCode = 1;
  await r.check('suite setup', () => { throw e; }); await r.finish();
} finally { await worker.stop(); }
