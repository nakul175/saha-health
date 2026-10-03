// Slice 10a local served-Worker check (not part of the contract loop; run through the build queue, see SLICE-10A doc).
// Serves the built Worker with wrangler's scheduled-test support (`--test-scheduled`), on a local D1/SQLite database with
// synthetic data, and calls the scheduled handler the way a Cloudflare Cron Trigger does. It proves, on the real built entry
// and the real D1 binding, that: the handler is exported and runs; a due caseload transfer is applied with no one using Saha
// and the scheduled job is named in the audit trail; alerts are evaluated and the evaluation is recorded; a request
// to the Worker still serves; and a misconfigured environment is refused without touching the database.
// Usage: SAHA_TEST_PORT=8811 node tests/scheduled-local-check.mjs   (after `npm run build`)
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const PORT = process.env.SAHA_TEST_PORT ?? '8811', base = `http://127.0.0.1:${PORT}`, state = resolve('.wrangler/sched-state');
const isolated = mkdtempSync(join(tmpdir(), 'saha-sched-')), wrangler = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];
cpSync('dist', join(isolated, 'dist'), { recursive: true });
// miniflare's static-assets router has no `scheduled` handler (a scheduled test against a Worker with assets fails with an
// exception outcome), so the isolated copy of the configuration drops the assets binding. Requests to the API and the
// scheduled handler do not use it; the deployed Worker keeps its assets.
const configPath = join(isolated, 'dist/server/wrangler.json'), config = JSON.parse(readFileSync(configPath, 'utf8'));
delete config.assets; writeFileSync(configPath, JSON.stringify(config));
rmSync(state, { recursive: true, force: true });
for (const m of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) {
  const r = spawnSync(process.execPath, [...wrangler, 'd1', 'execute', 'DB', '--local', '--config', join(isolated, 'dist/server/wrangler.json'), '--persist-to', state, '--file', join('drizzle', m)], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('Migration failed', m, r.stdout?.slice(-800), r.stderr?.slice(-800)); process.exit(1); }
}

let passed = 0, output = '', server = null;
const steps = [];
const check = (name, fn) => { fn(); passed++; steps.push(name); };
const checkAsync = async (name, fn) => { await fn(); passed++; steps.push(name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function start(vars = []) {
  output = '';
  server = spawn(process.execPath, [...wrangler, 'dev', '--config', join(isolated, 'dist/server/wrangler.json'), '--local', '--persist-to', state, '--test-scheduled', '--name', 'saha-scheduled-check', '--ip', '127.0.0.1', '--port', PORT, '--inspector-port', '0', ...vars.flatMap(v => ['--var', v])], { env: { ...process.env, WRANGLER_REGISTRY_PATH: join(isolated, 'registry'), MINIFLARE_REGISTRY_PATH: join(isolated, 'miniflare') } });
  server.stdout.on('data', c => { output += c; }); server.stderr.on('data', c => { output += c; });
  for (let i = 0; i < 90 && !output.includes('Ready on'); i++) await sleep(1000);
  assert.ok(output.includes('Ready on'), 'the Worker started: ' + output.slice(-1500));
}
async function stop() { if (!server) return; const s = server; server = null; await new Promise(r => { s.on('exit', r); s.kill('SIGTERM'); setTimeout(r, 8000); }); await sleep(1500); }
let lastBody = '';
const trigger = async () => { const r = await fetch(`${base}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent('*/5 * * * *')}`); lastBody = await r.text(); if (r.status !== 200) console.error('Scheduled endpoint answered', r.status, lastBody.slice(0, 300)); return r.status; };
const logLines = () => [...output.matchAll(/\{"event":"saha_scheduled"[^\n]*\}/g)].map(m => JSON.parse(m[0]));
const sqliteFiles = () => { const d = join(state, 'v3/d1/miniflare-D1DatabaseObject'); return existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite').map(f => join(d, f)) : []; };
const rows = q => { const [file] = sqliteFiles(); assert.ok(file, 'the local D1 file exists'); const db = new DatabaseSync(file); try { db.exec('PRAGMA busy_timeout=5000'); return db.prepare(q).all(); } finally { db.close(); } };
const who = label => ({ id: `s10a-${label}`, headers: { 'oai-authenticated-user-id': `s10a-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': 'Synthetic%20' + label, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
async function get(a, path = '/api/workspace') { const r = await fetch(base + path, { headers: a.headers }); const j = await r.json(); assert.equal(r.status, 200, path + ' ' + JSON.stringify(j).slice(0, 300)); if (path === '/api/workspace') a.state = j; return j; }
async function post(a, body) { const r = await fetch(base + '/api/commands', { method: 'POST', headers: { ...a.headers, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'x-saha-organisation': a.state.organisation.id }, body: JSON.stringify(body) }); const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(body).slice(0, 200) + ' ' + JSON.stringify(j).slice(0, 300)); a.state = j.snapshot; return j; }

try {
  await start();
  await checkAsync('the built Worker still serves requests with the custom entry', async () => { const r = await fetch(base + '/api/workspace'); assert.equal(r.status, 401, 'identity is still required'); });
  await checkAsync('the scheduled handler runs on an empty database and logs fixed counters only', async () => {
    assert.equal(await trigger(), 200);
    for (let i = 0; i < 20 && !logLines().length; i++) await sleep(250);
    const l = logLines().at(-1); assert.ok(l, 'a saha_scheduled log line: ' + output.slice(-800));
    assert.deepEqual([l.event, l.cron, l.organisations, l.stoppedBy, l.transfers, l.reviews, l.problems], ['saha_scheduled', '*/5 * * * *', 0, 'complete', 0, 0, 0]);
    assert.deepEqual(Object.keys(l), ['event', 'cron', 'organisations', 'notReached', 'stoppedBy', 'transfers', 'reviews', 'problems', 'queries', 'durationMs']);
  });

  const o = who('owner'), w = who('worker'), c = who('clinician');
  for (const a of [o, w, c]) await get(a);
  const org = o.state.organisation.id;
  for (const [target, role] of [[w, 'asha'], [c, 'clinician']]) { const i = (await post(o, { type: 'createInvite', accountCode: target.state.user.accountCode, label: role, role, teamIds: ['default'] })).result; await post(target, { type: 'joinOrganisation', token: i.token }); }
  await get(o);
  let p = o.state.people.find(x => x.id === 'p_meena'); await post(o, { type: 'assignPatient', personId: p.id, version: p.version, teamId: 'default', assignedTo: w.id, reason: 'Synthetic assignment for the scheduled check' });
  const effectiveAt = new Date(Date.now() + 20000).toISOString();
  await post(o, { type: 'caseloadTransfer', teamId: 'default', fromUserId: w.id, toUserId: c.id, personIds: ['p_meena'], effectiveAt, reason: 'Synthetic leave cover for the scheduled check' });
  await checkAsync('a transfer scheduled for a few seconds ahead is not applied early, even when the job runs', async () => {
    assert.equal(await trigger(), 200); await sleep(1500);
    await get(o); assert.equal(o.state.people.find(x => x.id === 'p_meena').assignedTo, w.id);
    assert.equal(rows(`SELECT count(*) AS n FROM audit_events WHERE org_id='${org}' AND action='caseloadAutoApply'`)[0].n, 0);
  });
  while (Date.now() < Date.parse(effectiveAt) + 1500) await sleep(250);
  const before = logLines().length;
  await checkAsync('once due, the scheduled job applies the transfer with nobody using Saha and names itself in the audit trail', async () => {
    assert.equal(await trigger(), 200);
    for (let i = 0; i < 40 && logLines().length === before; i++) await sleep(250);
    const l = logLines().at(-1); assert.ok(l.organisations >= 1 && l.transfers >= 1, JSON.stringify(l));
    const a = rows(`SELECT actor_id,actor_name,role FROM audit_events WHERE org_id='${org}' AND action='caseloadAutoApply'`); assert.equal(a.length, 1); assert.deepEqual([a[0].actor_id, a[0].actor_name, a[0].role], ['system', 'Saha scheduled transfer', 'system']);
    await get(o); assert.equal(o.state.people.find(x => x.id === 'p_meena').assignedTo, c.id);
  });
  await checkAsync('alerts are evaluated by the job and the evaluation is recorded through the normal commit', async () => {
    const a = rows(`SELECT actor_id,actor_name,detail FROM audit_events WHERE org_id='${org}' AND action='scheduledAlertEvaluation'`);
    assert.equal(a.length, 1); assert.equal(a[0].actor_id, 'system'); assert.equal(a[0].actor_name, 'Saha scheduled job'); assert.match(a[0].detail, /In-app only; nothing was sent outside Saha/);
  });
  await checkAsync('a repeat run does not apply or record again within the hour', async () => {
    const n = logLines().length; assert.equal(await trigger(), 200); for (let i = 0; i < 40 && logLines().length === n; i++) await sleep(250);
    assert.equal(rows(`SELECT count(*) AS n FROM audit_events WHERE org_id='${org}' AND action IN ('caseloadAutoApply','scheduledAlertEvaluation')`)[0].n, 2);
  });
  await checkAsync('the job made no outbound request', async () => {
    assert.ok(!/fetch failed|ENOTFOUND|ECONNREFUSED/.test(output), 'no network error in the Worker output');
  });
  const auditCount = rows('SELECT count(*) AS n FROM audit_events')[0].n, revisions = JSON.stringify(rows('SELECT id,revision,patient_revision FROM organisations ORDER BY id'));
  await stop();

  // A misconfigured environment: the job refuses before touching anything.
  await start(['SAHA_ENVIRONMENT:prod']);
  await checkAsync('a misconfigured environment is refused with a fixed message and the database is untouched', async () => {
    assert.equal(await trigger(), 200); for (let i = 0; i < 40 && !output.includes('Scheduled job refused'); i++) await sleep(250);
    assert.ok(output.includes('Scheduled job refused: environment is not configured correctly'), output.slice(-800));
    assert.equal(rows('SELECT count(*) AS n FROM audit_events')[0].n, auditCount); assert.equal(JSON.stringify(rows('SELECT id,revision,patient_revision FROM organisations ORDER BY id')), revisions);
  });
} catch (e) {
  const at = output.indexOf('Ready on'); console.error('Worker output at the failure:\n' + output.slice(at < 0 ? 0 : at).slice(-4000));
  throw e;
} finally {
  await stop();
  rmSync(isolated, { recursive: true, force: true });
}
const result = { suite: 'Scheduled job local served-Worker check (slice 10a)', passed, steps, port: PORT, completedAt: new Date().toISOString() };
mkdirSync('tests/evidence/slice-10a', { recursive: true });
writeFileSync('tests/evidence/slice-10a/scheduled-local-check.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
