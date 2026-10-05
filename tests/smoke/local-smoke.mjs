import {acquireSyntheticSource} from '../lib/clinical-source-fixture.mjs';
// Slice 11b: local smoke. "Is the build alive and are the main paths intact?" in well under 90 seconds.
// One built Worker (dist/), one fresh migrated local D1, synthetic people only. It walks the path a new organisation takes:
// anonymous refusal, a new owner's home organisation and demonstration clinical package, invitations, an ASHA's visit from
// first save to programme receipts, a supervisor's reach, a stranger's refusal, and a sweep of every GET route in
// docs/current/HTTP-ROUTES.csv. It is not the full HTTP suite (node tests/run-api-smoke.mjs, 4,599 assertions) and proves no acceptance case.
//
//   npm run build && SAHA_TEST_PORT=8811 node tests/smoke/local-smoke.mjs
//
// SAHA_SMOKE_VARS='{"SAHA_DEMONSTRATION_PACKAGE":"manual"}' passes extra Worker variables, to show that the checks notice a different
// configuration (the demonstration package off, another environment). The suite expects the default: no variables set.
//
// The identity headers below model the trusted Sites dispatcher of an isolated local process. They are never sent anywhere else.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { client, identity, startWorker } from '../lib/worker.mjs';
import { migrateOnce } from '../lib/migrate.mjs'; // one wrangler call for all migrations (see that file for why startWorker's own fresh state is not used)
import { suite } from '../lib/report.mjs';

process.chdir(resolve(fileURLToPath(new URL('../..', import.meta.url))));
const PORT = process.env.SAHA_TEST_PORT ?? '8790';
const wall = performance.now();
const seconds = () => Math.round((performance.now() - wall) / 100) / 10;

const r = suite('Smoke (local)', 'tests/reports/smoke-local-result.json', {
  layer: 'smoke',
  limits: [
    'A smoke test: about 30 checks over the main paths, not the 4,599-assertion HTTP suite and not an acceptance test. No formal acceptance case is promoted by it.',
    'One run of one built Worker (wrangler dev, local D1, synthetic data). It does not exercise the hosted Cloudflare deployment, real providers or a browser.',
    'The visit flow uses the two demonstration destinations (simulator, no network): one answers "accepted" with a receipt, the other is the deliberate "uncertain" case. Nothing leaves the process.',
    'The page check reads the server-rendered shell only. The sidebar environment banner is drawn by the browser after sign-in; the UI suite covers it.',
  ],
});

const need = (res, status, what) => assert.equal(res.status, status, `${what}: expected HTTP ${status}, got ${res.status} ${res.text.slice(0, 240)}`);
const SIGN_IN = /sign in/i;
// Query strings the GET routes need so that the owner (and an anonymous caller) reach the handler rather than a missing-parameter answer.
const recipes = (visitId, org) => ({
  '/api/media': `?visitId=${encodeURIComponent(visitId)}`,
  '/api/inbound-conflicts': '?personId=p_meena',
  '/api/imported-evidence': '?personId=p_meena',
  '/api/abdm': '?personId=p_meena', '/api/action-plan': '?personId=p_meena', '/api/history': '?personId=p_meena', '/api/household': '?personId=p_meena',
  '/api/identity-cases': '?personId=p_meena', '/api/patients/detail': '?personId=p_meena', '/api/trace': `?visit=${visitId}`, '/api/fhir/[id]': `?organisationId=${org}`,
  '/api/work-burden/support': `?visitId=${encodeURIComponent(visitId)}`,
});
// Routes that cannot be exercised in this run, with the reason. Anything else that answers 4xx without a parameter recipe is skipped and reported too.
const unsuppliable = { '/api/media/[id]': 'needs the id of an uploaded media file; this run uploads none' };

const state = resolve('.wrangler/saha-smoke-local-state');
let worker = null, timings = {};
try {
  const t0 = performance.now();
  const migrations = migrateOnce(state);
  timings.migrateMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  const vars = process.env.SAHA_SMOKE_VARS ? JSON.parse(process.env.SAHA_SMOKE_VARS) : {};
  worker = await startWorker({ port: PORT, name: 'saha-smoke-local', state, fresh: false, vars });
  timings.workerStartMs = Math.round(performance.now() - t1);
  const c = client(worker.base);

  const run = crypto.randomUUID().slice(0, 8);
  const who = Object.fromEntries([['owner', 'Smoke Owner'], ['asha', 'Smoke Asha'], ['supervisor', 'Smoke Supervisor'], ['stranger', 'Smoke Stranger']].map(([k, n]) => [k, { ...identity(k, run, n), snap: null }]));
  const { owner, asha, supervisor, stranger } = who;
  let org = '', visitId = '', plan = null;
  const load = async (a, orgId) => { const res = await c.get(a, '/api/workspace', orgId); need(res, 200, `${a.label} workspace`); a.snap = res.json; return res.json; };
  const cmd = async (a, body, status = 200) => { const res = await c.command(a, body, org); need(res, status, `${a.label} ${body.type}`); if (status === 200) a.snap = res.json.snapshot; return res; };
  const visit = a => a.snap.visits.find(v => v.id === visitId);
  await load(stranger); // the stranger's own account (and home organisation) exists before any cross-organisation attempt

  // ---- Anonymous callers ----------------------------------------------------------------------------------------------------
  await r.check('anonymous GET /api/workspace is refused: 401 with a sign-in message', async () => {
    const res = await c.get(null, '/api/workspace'); need(res, 401, 'anonymous workspace'); assert.match(res.json.error, SIGN_IN);
  });
  await r.check('anonymous POST /api/commands is refused: 401 with a sign-in message', async () => {
    const res = await c.command(null, { type: 'createTeam', name: 'Anonymous team' }); need(res, 401, 'anonymous command'); assert.match(res.json.error, SIGN_IN);
  });
  await r.check('a reserved fixture identity cannot sign in (401)', async () => {
    const res = await c.get({ headers: { 'oai-authenticated-user-id': 'fixture:smoke:author', 'oai-authenticated-user-email': 'fixture@example.invalid' } }, '/api/workspace'); need(res, 401, 'fixture identity');
  });
  await r.check('anonymous page request is redirected to sign-in (307), not served the application', async () => {
    const res = await c.call(null, '/'); need(res, 307, 'anonymous page'); assert.equal(res.headers.get('location'), '/signin-with-chatgpt?return_to=%2F'); assert.ok(!/Connected care workspace/.test(res.text));
  });

  // ---- A new owner ---------------------------------------------------------------------------------------------------------
  await r.check('page shell renders for a signed-in user: HTML, title, no-store, synthetic footer notice', async () => {
    const res = await c.call(owner, '/'); need(res, 200, 'owner page');
    assert.match(res.headers.get('content-type'), /^text\/html/); assert.match(res.headers.get('cache-control'), /no-store/);
    assert.match(res.text, /<title>Saha · Health Workspace<\/title>/); assert.match(res.text, /Synthetic demonstration · not for patient care/);
  });
  await r.check('a new owner gets a home organisation, owner membership and six synthetic people in the default team', async () => {
    const s = await load(owner); org = s.organisation.id;
    assert.match(org, /^org_[0-9a-f]{32}$/); assert.equal(s.organisation.name, 'Rampur care organisation');
    assert.equal(s.membership.isOwner, true); assert.equal(s.membership.status, 'active'); assert.equal(s.canManage, true);
    assert.deepEqual(s.teams.map(t => t.id), ['default']);
    assert.deepEqual(s.people.map(p => p.id).sort(), ['p_aarav', 'p_farida', 'p_kamla', 'p_meena', 'p_rajesh', 'p_sunita']);
    assert.ok(s.people.every(p => p.name && p.village && p.version >= 1));
  });
  await r.check('the deployment is synthetic: workspace and /api/environment agree, external services off', async () => {
    assert.equal(owner.snap.environment, 'synthetic', 'workspace environment'); assert.equal(owner.snap.externalApisEnabled, false, 'external services switch');
    const e = await c.get(owner, '/api/environment', org); need(e, 200, 'environment');
    assert.equal(e.json.environment, 'synthetic', 'environment'); assert.equal(e.json.label, 'Synthetic development and demonstration environment');
    assert.equal(e.json.policy.fixtures, true); assert.equal(e.json.live.allowed, false); assert.equal(e.json.counts.error ?? 0, 0);
  });
  await r.check('the demonstration clinical package installed itself: 7 governance entries, all active, usable, no issues', async () => {
    const g = await c.get(owner, '/api/governance', org); need(g, 200, 'governance');
    assert.equal(g.json.entries.length, 7, `governance entries (the package installs automatically in the synthetic environment)`);
    for (const e of g.json.entries) { assert.equal(e.state, 'active', e.spec.title); assert.equal(e.usable, true, e.spec.title); assert.deepEqual(e.issues, [], e.spec.title); }
    const kinds = k => g.json.entries.filter(e => e.spec.kind === k).length;
    assert.deepEqual([kinds('protocol'), kinds('service'), kinds('source')], [2, 3, 2], 'protocols, services, sources');
    assert.deepEqual(g.json.entries.filter(e => e.spec.kind === 'protocol').map(e => e.spec.title).sort(),
      ['Antenatal blood pressure (demonstration, not clinically approved)', 'Presumptive TB: cough duration (demonstration, not clinically approved)']);
    const a = owner.snap.audit.find(x => x.action === 'installDemonstrationPackage'); assert.ok(a, 'the install is audited'); assert.match(a.detail, /Not clinically approved/);
  });

  // ---- Invitations and scope -------------------------------------------------------------------------------------------------
  let ashaToken = '';
  await r.check('the owner invites an ASHA and a supervisor by account code, and both join the same organisation', async () => {
    for (const [a, role] of [[asha, 'asha'], [supervisor, 'supervisor']]) {
      await load(a);
      const inv = await cmd(owner, { type: 'createInvite', accountCode: a.snap.user.accountCode, label: `Smoke ${role}`, role, teamIds: ['default'] });
      assert.match(inv.json.result.token, /^[0-9a-f]{64}$/); if (role === 'asha') ashaToken = inv.json.result.token;
      const joined = await cmd(a, { type: 'joinOrganisation', token: inv.json.result.token }); assert.equal(joined.json.result.organisationId, org);
    }
    await load(owner);
    const roleOf = a => owner.snap.members.find(m => m.userId === a.id);
    assert.deepEqual([roleOf(asha)?.role, roleOf(asha)?.status, roleOf(supervisor)?.role, roleOf(supervisor)?.status], ['asha', 'active', 'supervisor', 'active']);
  });
  await r.check('an invitation cannot be reused, and another account cannot use it (403)', async () => {
    need(await c.command(asha, { type: 'joinOrganisation', token: ashaToken }, org), 403, 'reused invitation');
    need(await c.command(stranger, { type: 'joinOrganisation', token: ashaToken }, org), 403, "someone else's invitation");
  });
  await r.check('the ASHA sees nobody until the owner assigns a person, then exactly that person', async () => {
    await load(asha, org); assert.equal(asha.snap.role, 'asha'); assert.equal(asha.snap.people.length, 0);
    const meena = owner.snap.people.find(p => p.id === 'p_meena');
    await cmd(owner, { type: 'assignPatient', personId: 'p_meena', version: meena.version, teamId: 'default', assignedTo: asha.id, reason: 'Smoke test assignment' });
    await load(asha, org); assert.deepEqual(asha.snap.people.map(p => p.id), ['p_meena']);
  });
  await r.check('the ASHA cannot start a visit or read the history of a person who is not assigned (403)', async () => {
    need(await c.command(asha, { type: 'startVisit', personId: 'p_rajesh' }, org), 403, 'visit for unassigned person');
    need(await c.get(asha, '/api/history?personId=p_rajesh', org), 403, 'history of unassigned person');
  });

  // ---- The visit, from first save to receipts -----------------------------------------------------------------------------------
  await r.check('the ASHA starts a visit: a draft, version 1, for the assigned person', async () => {
    const s = await cmd(asha, { type: 'startVisit', personId: 'p_meena' }); visitId = s.json.result.visitId;
    assert.match(visitId, /^[0-9a-f-]{36}$/); assert.equal(visit(asha).personId, 'p_meena'); assert.equal(visit(asha).state, 'draft'); assert.equal(visit(asha).version, 1);
  });
  await r.check('saving blood pressure 152/114 with the other required facts stores them exactly (version 2, still a draft)', async () => {
    const facts = { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '152', diastolic: '114', weight: '57.5', temperature: '', weeks: '24', coughDays: '', notes: 'Synthetic smoke visit.', source: 'measured' };
    await cmd(asha, { type: 'saveVisit', visitId, version: visit(asha).version, facts });
    assert.deepEqual(visit(asha).facts, facts); assert.equal(visit(asha).version, 2); assert.equal(visit(asha).state, 'draft');
  });
  await r.check('the clinical review gives the urgent danger-sign finding and routes it to the CHC/FRU', async () => {
    const g = await c.get(asha, `/api/governance?visitId=${visitId}`, org); need(g, 200, 'clinical review');
    assert.equal(g.json.preview.protocols.length, 1, 'protocols applying to the visit'); assert.deepEqual(g.json.preview.unknowns, [], 'unknowns');
    assert.deepEqual(g.json.preview.findings.map(f => f.urgency).sort(), ['review', 'review', 'urgent_review']);
    const urgent = g.json.preview.findings.filter(f => f.urgency === 'urgent_review'); assert.equal(urgent.length, 1);
    assert.equal(urgent[0].ruleId, 'diastolic-above-110'); assert.match(urgent[0].action, /danger sign: refer to the CHC\/FRU immediately/);
    assert.equal(urgent[0].service.title, 'Kheda CHC / First Referral Unit (synthetic)'); assert.ok(urgent[0].sources.length > 0, 'the finding cites its sources');
  });
  await r.check('confirming needs the patient check: none is 422, a stale one is 409; the right one confirms the visit', async () => {
    await cmd(asha, { type: 'checkProtocol', visitId, version: visit(asha).version });
    const p = () => asha.snap.people.find(x => x.id === 'p_meena');
    need(await c.command(asha, { type: 'confirmVisit', visitId, version: visit(asha).version }, org), 422, 'confirm without patient check');
    need(await c.command(asha, { type: 'confirmVisit', visitId, version: visit(asha).version, patientCheck: { personId: 'p_meena', personVersion: p().version - 1, confirmed: true } }, org), 409, 'confirm with stale patient check');
    await cmd(asha, { type: 'confirmVisit', visitId, version: visit(asha).version, patientCheck: { personId: 'p_meena', personVersion: p().version, confirmed: true } });
    assert.equal(visit(asha).state, 'confirmed'); assert.ok(visit(asha).confirmedAt); assert.equal(visit(asha).facts.diastolic, '114');
  });
  await r.check('the programme plan is prepared for both demonstration destinations, and cannot run before it is approved (409)', async () => {
    await cmd(asha, { type: 'preparePlan', visitId, recipients: ['mis_maternal', 'mis_community'] }); plan = visit(asha).plan;
    assert.equal(plan.state, 'proposed'); assert.deepEqual(plan.recipients, ['mis_maternal', 'mis_community']); assert.match(plan.payloadHash, /^[0-9a-f]{64}$/);
    need(await c.command(asha, { type: 'executePlan', visitId, planId: plan.id }, org), 409, 'execute before approval');
    need(await c.command(asha, { type: 'approvePlan', visitId, planId: plan.id, payloadHash: 'deadbeef' }, org), 409, 'approve a different payload');
  });
  await r.check('approving and running the plan sends to the demonstration destinations; receipts exist, the lost response is "uncertain"', async () => {
    await cmd(asha, { type: 'approvePlan', visitId, planId: plan.id, payloadHash: plan.payloadHash }); assert.equal(visit(asha).plan.state, 'approved');
    await cmd(asha, { type: 'executePlan', visitId, planId: plan.id });
    const subs = asha.snap.submissions.filter(s => s.visitId === visitId); assert.equal(subs.length, 2);
    const by = id => subs.find(s => s.connectorId === id);
    assert.equal(by('mis_maternal').state, 'accepted'); assert.match(by('mis_maternal').receipt, /^SIM-[0-9A-F]+$/);
    assert.equal(by('mis_community').state, 'uncertain'); assert.ok(!by('mis_community').receipt); assert.match(by('mis_community').message, /do not resend/i);
    assert.ok(subs.every(s => s.mode === 'demo' && s.attempts === 1 && s.payloadHash === plan.payloadHash));
    assert.equal(visit(asha).plan.state, 'completed');
  });
  await r.check('running the plan again does not send again (still two submissions, one attempt each)', async () => {
    await cmd(asha, { type: 'executePlan', visitId, planId: plan.id });
    const subs = asha.snap.submissions.filter(s => s.visitId === visitId); assert.equal(subs.length, 2); assert.ok(subs.every(s => s.attempts === 1));
  });
  await r.check("the owner's audit trail records the whole visit under the ASHA's role", async () => {
    await load(owner, org);
    const acts = new Set(owner.snap.audit.filter(a => a.role === 'asha').map(a => a.action));
    for (const a of ['startVisit', 'saveVisit', 'checkProtocol', 'confirmVisit', 'preparePlan', 'approvePlan', 'executePlan']) assert.ok(acts.has(a), `audit has ${a}`);
  });

  // ---- Supervisor -------------------------------------------------------------------------------------------------------------
  await r.check('the supervisor reads operations (aggregate, owner-only detail withheld) and sees the uncertain destination alert', async () => {
    await load(supervisor, org); assert.equal(supervisor.snap.role, 'supervisor'); assert.equal(supervisor.snap.canManage, false);
    const ops = await c.get(supervisor, '/api/operations', org); need(ops, 200, 'supervisor operations');
    assert.equal(ops.json.report.patients, 6); assert.equal(ops.json.operations, null); assert.equal(ops.json.telemetry, null);
    assert.ok(Array.isArray(ops.json.alerts)); assert.ok(ops.json.alerts.some(a => a.id === 'destination-uncertain'), 'the uncertain submission raises an alert');
    const al = await c.get(supervisor, '/api/alerts', org); need(al, 200, 'supervisor alerts'); assert.ok(Array.isArray(al.json.items)); assert.equal(typeof al.json.rules.alerts, 'string');
  });
  await r.check('the supervisor and the ASHA are refused owner-only commands (403) and nothing is created', async () => {
    const invitationsBefore = (await load(owner, org)).invitations.length;
    for (const a of [supervisor, asha]) {
      for (const body of [{ type: 'createTeam', name: 'Smoke team' }, { type: 'createInvite', accountCode: stranger.snap.user.accountCode, label: 'x', role: 'clinician', teamIds: ['default'] }, { type: 'installDemonstrationPackage' }]) {
        const res = await c.command(a, body, org); need(res, 403, `${a.label} ${body.type}`); assert.match(res.json.error, /owner/i);
      }
    }
    await load(owner, org); assert.deepEqual(owner.snap.teams.map(t => t.id), ['default']); assert.equal(owner.snap.invitations.length, invitationsBefore, 'a refused command created an invitation');
    need(await c.command(supervisor, { type: 'startVisit', personId: 'p_meena' }, org), 403, 'supervisor starts a visit');
  });

  // ---- A stranger --------------------------------------------------------------------------------------------------------------
  await r.check("a stranger is refused another organisation's workspace, patients, governance, FHIR and commands (403)", async () => {
    for (const path of ['/api/workspace', '/api/patients', '/api/governance', '/api/operations', `/api/fhir/${visitId}?organisationId=${org}`]) need(await c.get(stranger, path, org), 403, `stranger GET ${path}`);
    need(await c.command(stranger, { type: 'startVisit', personId: 'p_meena' }, org), 403, 'stranger command');
  });
  await r.check("the stranger's own home organisation is separate: different id, six synthetic people, none of the owner's visits", async () => {
    const s = await load(stranger); assert.notEqual(s.organisation.id, org); assert.equal(s.people.length, 6); assert.equal(s.visits.length, 0); assert.equal(s.submissions.length, 0);
  });

  // ---- Every GET route -------------------------------------------------------------------------------------------------------
  const csv = readFileSync('docs/current/HTTP-ROUTES.csv', 'utf8').trim().split('\n'), header = csv.shift();
  assert.equal(header, 'method,route,source', 'HTTP-ROUTES.csv columns changed; update the smoke');
  const gets = csv.map(l => l.split(',')).filter(x => x[0] === 'GET').map(x => x[1]);
  const query = {...recipes(visitId, org), '/api/clinical-sources':await acquireSyntheticSource(c,owner,org,'smoke-control')}, pathOf = route => route.replace('[id]', visitId) + (query[route] ?? '');
  const sweep = [];
  await r.check(`all ${gets.length} GET routes in HTTP-ROUTES.csv refuse an anonymous caller (401)`, async () => {
    const wrong = [];
    for (const route of gets) { const res = await c.get(null, pathOf(route)); if (res.status !== 401) wrong.push(`${res.status} ${route}`); }
    assert.equal(wrong.length, 0, `routes that did not answer 401 to an anonymous caller: ${wrong.join('; ')}`);
  });
  await r.check(`every GET route in HTTP-ROUTES.csv answers the owner without a 5xx (200 wherever it can be called)`, async () => {
    const bad = [];
    for (const route of gets) {
      const res = await c.get(owner, pathOf(route), org); sweep.push({ route, path: pathOf(route), status: res.status, ms: Math.round(res.ms) });
      if (res.status >= 500) bad.push(`${res.status} ${route}`);
      // Slice 11g (test review M6): an owner 4xx on a route that needs no parameters is a failure, not a skip.
      else if (res.status !== 200 && !(route in unsuppliable) && !(route in query)) bad.push(`${res.status} (expected 200 without parameters) ${route} ${res.json?.error ?? ''}`);
      else if (res.status !== 200 && !(route in unsuppliable)) bad.push(`${res.status} (expected 200) ${route} ${res.json?.error ?? ''}`);
    }
    assert.equal(bad.length, 0, `routes that failed: ${bad.join('; ')}`);
  });
  for (const row of sweep) if (row.skipped) r.skip(`GET ${row.route}`, row.skipped);
  for (const route of gets.filter(x => x in unsuppliable)) r.skip(`GET ${route}`, unsuppliable[route]);
  await r.check('the Worker logged no 5xx response and no unhandled workspace error during the run', async () => {
    const log = worker.output(); const events = [...log.matchAll(/"event":"saha_request"[^\n]*"status":(\d{3})/g)].map(m => +m[1]);
    assert.ok(events.length > 40, `expected request log lines, saw ${events.length}`); assert.equal(events.filter(s => s >= 500).length, 0, 'a 5xx was logged');
    assert.ok(!/Workspace operation failed|Uncaught|Unhandled/.test(log), 'unexpected error text in the Worker output');
  });

  // Slice 11g (test review M6): the target stays 90 s; the check fails only beyond 180 s so a loaded runner does not fail a functional smoke.
  r.measure('whole run, Worker start included (target 90 s)', seconds(), { unit: 's', budget: 180 });
  timings.totalSeconds = seconds();
  await r.finish({ timings, migrations, workerVars: vars, sweep, skippedRoutes: [...sweep.filter(x => x.skipped).map(x => ({ route: x.route, reason: x.skipped })), ...gets.filter(x => x in unsuppliable).map(x => ({ route: x, reason: unsuppliable[x] }))] });
  console.log(`SMOKE (local) ${r.failed ? 'FAIL' : 'PASS'} in ${timings.totalSeconds} s (migrate ${timings.migrateMs} ms, Worker start ${timings.workerStartMs} ms)`);
} catch (e) {
  // A failure before or between checks still leaves a report that says so.
  await r.check('the suite ran to the end (setup or an unexpected error stopped it)', async () => { throw e; });
  timings.totalSeconds = seconds(); await r.finish({ timings });
  console.log(`SMOKE (local) FAIL in ${timings.totalSeconds} s: ${String(e?.message ?? e).split('\n')[0]}`);
} finally {
  if (worker) await worker.stop();
}
