// Pilot-envelope load probe (Slice 0). Synthetic data only, local Worker + local D1.
// Measures how the organisation-wide state model behaves as one organisation grows
// toward the BRD R1 planning envelope (100,000 people, 100 concurrent users, 50 req/s).
// It is a local engineering probe: hosted D1 latency, Worker memory limits and real
// network conditions differ. It never touches a hosted database.
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, existsSync, globSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const STATE = resolve(process.env.SAHA_LOAD_STATE ?? '.wrangler/load-state');
const PORT = Number(process.env.SAHA_LOAD_PORT ?? 8789);
const SIZES = (process.env.SAHA_LOAD_SIZES ?? '100,1000,5000,20000,50000,100000').split(',').map(Number);
const OUT = process.env.SAHA_LOAD_OUT ?? 'tests/load-envelope-result.json';
const base = `http://127.0.0.1:${PORT}`;
const stopAfterMs = 30000; // stop escalating once a single workspace read exceeds this
const READ_ONLY = process.env.SAHA_LOAD_MODE === 'read'; // size scaling only: no bursts or sustained phase
// Slice 0b-4: with SAHA_LOAD_WORKLISTS=1 every 10th person has an open follow-up, every 4th a programme submission and
// every 20th a referral, and the supervisor also reads the four server work lists.
const WORKLISTS = process.env.SAHA_LOAD_WORKLISTS === '1';

if (existsSync(STATE)) rmSync(STATE, { recursive: true, force: true });
for (const file of readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()) {
  execFileSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', STATE, '--file', join('drizzle', file)], { stdio: 'ignore' });
}

const isolated = mkdtempSync(join(tmpdir(), 'saha-load-worker-'));
cpSync('dist', join(isolated, 'dist'), { recursive: true });
const server = spawn(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'dev', '--config', join(isolated, 'dist/server/wrangler.json'), '--local', '--persist-to', STATE, '--name', 'saha-load-probe', '--ip', '127.0.0.1', '--port', String(PORT), '--inspector-port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_REGISTRY_PATH: join(isolated, 'registry'), MINIFLARE_REGISTRY_PATH: join(isolated, 'miniflare') } });
let log = '';
await new Promise((ok, bad) => {
  const t = setTimeout(() => bad(new Error('Worker did not start\n' + log.slice(-2000))), 60000);
  const on = c => { log += c.toString(); if (log.includes('Ready on')) { clearTimeout(t); ok(); } };
  server.stdout.on('data', on); server.stderr.on('data', on);
});

const owner = { 'oai-authenticated-user-id': `load-owner-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'load-owner@example.invalid' };
const ms = t => Math.round(performance.now() - t);
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };

async function read(org, who = owner) {
  const t = performance.now();
  try {
    const r = await fetch(base + '/api/workspace', { headers: { ...who, ...(org ? { 'x-saha-organisation': org } : {}) }, signal: AbortSignal.timeout(120000) });
    const text = await r.text();
    return { status: r.status, ms: ms(t), bytes: text.length, body: r.ok ? JSON.parse(text) : null };
  } catch (e) { return { status: 'error', ms: ms(t), bytes: 0, error: String(e.message ?? e) }; }
}
async function command(org, body) {
  const t = performance.now();
  try {
    const r = await fetch(base + '/api/commands', { method: 'POST', headers: { ...owner, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'x-saha-organisation': org, ...(process.env.SAHA_LOAD_DELTA === '1' ? { 'x-saha-response': 'delta' } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    const text = await r.text();
    return { status: r.status, ms: ms(t), bytes: text.length };
  } catch (e) { return { status: 'error', ms: ms(t), bytes: 0, error: String(e.message ?? e) }; }
}

const first = await read();
if (first.status !== 200) throw new Error('Owner workspace failed: ' + JSON.stringify(first));
const org = first.body.organisation.id;
const dbPath = globSync(join(STATE, 'v3/d1/**/*.sqlite')).filter(p => !p.endsWith('/metadata.sqlite'))[0];
const sql = new DatabaseSync(dbPath); sql.exec('PRAGMA busy_timeout=10000');
const template = JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? LIMIT 1').get(org).data);
let seeded = 0, cursor = 0; // cursor = next unseeded synthetic person used for new visits
function seedTo(n) {
  const now = '2026-09-20T08:00:00.000Z';
  const insP = sql.prepare('INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data) VALUES (?,?,?,?,?,?,?)');
  const insV = sql.prepare('INSERT INTO visits (org_id,id,person_id,version,record_version,state,data) VALUES (?,?,?,?,?,?,?)');
  const insS = sql.prepare('INSERT INTO submissions (org_id,id,visit_id,person_id,state,data) VALUES (?,?,?,?,?,?)');
  const insR = sql.prepare('INSERT INTO referrals (org_id,id,person_id,data) VALUES (?,?,?,?)');
  sql.exec('BEGIN');
  for (let i = seeded; i < n; i++) {
    const id = `load_p_${i}`, name = `Synthetic Person ${i}`;
    const person = { ...template, id, name, age: 20 + (i % 50), village: `Village ${i % 40}`, version: 1, teamId: 'default', assignedTo: owner['oai-authenticated-user-id'], ...(WORKLISTS && i % 10 === 0 ? { followUps: [{ id: `load_f_${i}`, enrolmentId: `load_e_${i}`, packId: 'maternal', title: 'Synthetic follow-up', due: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, ownerId: owner['oai-authenticated-user-id'], state: 'open', createdAt: now, createdBy: owner['oai-authenticated-user-id'] }] } : {}) };
    insP.run(org, id, 1, name, 'default', owner['oai-authenticated-user-id'], JSON.stringify(person));
    const vid = `load_v_${i}`;
    const facts = { date: '2026-09-20T08:00', systolic: '124', diastolic: '80', weight: '58', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic load record', source: 'measured' };
    insV.run(org, vid, id, 2, 1, 'confirmed', JSON.stringify({ id: vid, personId: id, version: 2, state: 'confirmed', facts, createdAt: now, confirmedAt: now, aiResults: [], recordVersion: 1 }));
    if (WORKLISTS && i % 4 === 0) { const state = ['accepted', 'uncertain', 'queued', 'rejected'][(i / 4) % 4]; insS.run(org, `load_s_${i}`, vid, id, state, JSON.stringify({ id: `load_s_${i}`, visitId: vid, personId: id, connectorId: 'mis', connectorName: 'Synthetic programme', state, mode: 'demo', payloadHash: 'h', attempts: 1, message: 'Synthetic receipt', createdAt: now, updatedAt: now })); }
    if (WORKLISTS && i % 20 === 0) insR.run(org, `load_r_${i}`, id, JSON.stringify({ id: `load_r_${i}`, personId: id, visitId: vid, facility: 'Synthetic PHC', reason: 'Synthetic referral', state: ['sent', 'scheduled', 'completed'][(i / 20) % 3], due: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, createdAt: now, version: 1 }));
  }
  sql.exec('COMMIT');
  seeded = n;
}
// Slice 0b-2: an ASHA assigned 50 people reads her own workspace at every size.
const asha = { 'oai-authenticated-user-id': `load-asha-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'load-asha@example.invalid' };
const post = (who, body, orgId) => fetch(base + '/api/commands', { method: 'POST', headers: { ...who, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), ...(orgId ? { 'x-saha-organisation': orgId } : {}) }, body: JSON.stringify(body) }).then(r => r.json());
const ashaHome = await fetch(base + '/api/workspace', { headers: asha }).then(r => r.json());
const invite = await post(owner, { type: 'createInvite', accountCode: ashaHome.user.accountCode, label: 'Load ASHA', role: 'asha', teamIds: ['default'] }, org);
await post(asha, { type: 'joinOrganisation', token: invite.result.token });
// Slice 0b-3: a supervisor of the whole team reads the full workspace, the paged workspace, the paged list and one detail.
const supervisor = { 'oai-authenticated-user-id': `load-supervisor-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'load-supervisor@example.invalid' };
const supervisorHome = await fetch(base + '/api/workspace', { headers: supervisor }).then(r => r.json());
const supervisorInvite = await post(owner, { type: 'createInvite', accountCode: supervisorHome.user.accountCode, label: 'Load supervisor', role: 'supervisor', teamIds: ['default'] }, org);
await post(supervisor, { type: 'joinOrganisation', token: supervisorInvite.result.token });
async function timed(path, who, extra = {}, body) {
  const t = performance.now();
  try { const r = await fetch(base + path, { ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), headers: { ...who, 'x-saha-organisation': org, ...(body ? { 'content-type': 'application/json' } : {}), ...extra }, signal: AbortSignal.timeout(120000) }); const text = await r.text(); return { status: r.status, ms: ms(t), bytes: text.length, body: r.ok ? JSON.parse(text) : null }; }
  catch (e) { return { status: 'error', ms: ms(t), bytes: 0, error: String(e.message ?? e) }; }
}
async function median3(path, who, extra, body) { const xs = []; for (let i = 0; i < 3; i++) xs.push(await timed(path, who, extra, body)); return { status: xs.map(r => r.status), p50Ms: pct(xs.map(r => r.ms), 50), maxMs: Math.max(...xs.map(r => r.ms)), responseKB: Math.round((xs.at(-1).bytes || 0) / 1024), people: xs.at(-1).body?.people?.length ?? xs.at(-1).body?.rows?.length ?? xs.at(-1).body?.delta?.people?.length ?? null, paging: xs.at(-1).body?.patientPaging ? { total: xs.at(-1).body.patientPaging.total } : undefined, listTotal: typeof xs.at(-1).body?.total === 'number' ? xs.at(-1).body.total : undefined }; }
async function supervisorReads() {
  const paged = { 'x-saha-patients': 'paged' };
  return {
    fullWorkspace: await median3('/api/workspace', supervisor),
    pagedWorkspace: await median3('/api/workspace', supervisor, paged),
    pagedWorkspaceWithWindow: await median3('/api/workspace', supervisor, { ...paged, 'x-saha-patient-window': Array.from({ length: 10 }, (_, i) => `load_p_${i}`).join(',') }),
    listFirstPage: await median3('/api/patients', supervisor),
    listSearch: await median3('/api/patients', supervisor, {}, { q: 'synthetic person 12' }),
    detail: await median3('/api/patients/detail?personId=load_p_5', supervisor),
    ...(WORKLISTS ? {
      worklistWork: await median3('/api/worklists?view=work', supervisor),
      worklistFollowUps: await median3('/api/worklists?view=followups', supervisor),
      worklistSubmissions: await median3('/api/worklists?view=submissions', supervisor),
      worklistReferrals: await median3('/api/worklists?view=referrals', supervisor),
      worklistLastPage: await median3(`/api/worklists?view=work&limit=100&cursor=n:${Math.max(0, seeded - 100)}`, supervisor),
    } : {}),
  };
}
let ashaAssigned = false;
function assignAsha() { if (ashaAssigned) return; const id = asha['oai-authenticated-user-id']; const up = sql.prepare("UPDATE patients SET assigned_to=?, data=json_set(data,'$.assignedTo',?) WHERE org_id=? AND id=?"); sql.exec('BEGIN'); for (let i = 0; i < 50; i++) up.run(id, id, org, `load_p_${100 + i}`); sql.exec('COMMIT'); ashaAssigned = true; }
// New visits target people who have only a confirmed visit, so startVisit is valid.
const nextPerson = () => `load_p_${cursor++}`;

async function burst(concurrency) {
  const results = await Promise.all(Array.from({ length: concurrency }, () => command(org, { type: 'startVisit', personId: nextPerson() })));
  const lat = results.map(r => r.ms);
  const count = s => results.filter(r => r.status === s).length;
  return { concurrency, accepted: count(200), conflicts: count(409), otherErrors: results.length - count(200) - count(409), p50Ms: pct(lat, 50), p95Ms: pct(lat, 95), maxMs: Math.max(...lat), sampleError: results.find(r => r.status !== 200 && r.status !== 409)?.error ?? null };
}

async function sustained(seconds, rps, writeShare) {
  const results = []; const started = performance.now(); const pending = [];
  for (let i = 0; i < seconds * rps; i++) {
    const due = started + (i * 1000) / rps; const wait = due - performance.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const isWrite = (i % Math.round(1 / writeShare)) === 0;
    pending.push((isWrite ? command(org, { type: 'startVisit', personId: nextPerson() }) : read(org)).then(r => results.push({ ...r, isWrite, body: undefined })));
  }
  await Promise.all(pending);
  const elapsed = (performance.now() - started) / 1000;
  const ok = results.filter(r => r.status === 200);
  const lat = results.map(r => r.ms);
  return { targetRps: rps, seconds, writeShare, requests: results.length, achievedRps: Math.round(results.length / elapsed * 10) / 10, ok: ok.length, conflicts: results.filter(r => r.status === 409).length, errors: results.filter(r => r.status !== 200 && r.status !== 409).length, p50Ms: pct(lat, 50), p95Ms: pct(lat, 95), maxMs: Math.max(...lat), wallSeconds: Math.round(elapsed) };
}

const steps = [];
let stoppedAt = null;
for (const n of SIZES) {
  seedTo(n);
  const warm = await read(org);
  const reads = [];
  for (let i = 0; i < 3; i++) reads.push(await read(org));
  const readStatus = [warm, ...reads].map(r => r.status);
  const single = await command(org, { type: 'startVisit', personId: nextPerson() });
  let ashaRead = null;
  if (n >= 150) { assignAsha(); const ar = []; for (let i = 0; i < 3; i++) ar.push(await read(org, asha)); ashaRead = { status: ar.map(r => r.status), p50Ms: pct(ar.map(r => r.ms), 50), maxMs: Math.max(...ar.map(r => r.ms)), responseKB: Math.round((ar.at(-1).bytes || 0) / 1024), patients: ar.at(-1).body?.people?.length ?? null }; }
  const supervisorRead = process.env.SAHA_LOAD_SUPERVISOR === '1' ? await supervisorReads() : null;
  const step = { people: n + 6, visits: n + 1, ...(supervisorRead ? { supervisorRead } : {}), workspaceRead: { status: readStatus, p50Ms: pct(reads.map(r => r.ms), 50), maxMs: Math.max(...reads.map(r => r.ms)), responseKB: Math.round((reads.at(-1).bytes || 0) / 1024), error: reads.find(r => r.error)?.error ?? null }, singleWrite: { status: single.status, ms: single.ms, responseKB: Math.round(single.bytes / 1024) }, ...(ashaRead ? { ashaRead } : {}) };
  const healthy = readStatus.every(s => s === 200) && step.workspaceRead.maxMs < stopAfterMs;
  if (healthy && !READ_ONLY) {
    step.burst10 = await burst(10);
    step.burst50 = await burst(50);
    if (step.workspaceRead.p50Ms < 2000) step.sustained = await sustained(15, 50, 0.3);
  }
  steps.push(step);
  console.log(JSON.stringify(step));
  if (!healthy) { stoppedAt = n + 6; break; }
}

const result = {
  probe: 'BRD R1 envelope load probe',
  release: process.env.SAHA_LOAD_RELEASE ?? 'Slice 0 baseline (R11 storage model)',
  environment: 'local Worker (wrangler dev --local) and local D1/SQLite; one owner account issuing concurrent commands',
  envelope: 'BRD v1.1 section 23: 200 workers, 100 concurrent users, 100,000 people, 2,000 encounters/day, 50 req/s for 30 minutes',
  steps,
  stoppedAtPeople: stoppedAt,
  limits: 'Local engineering probe. Hosted D1 latency, Worker memory/CPU limits, network, multi-account sessions and 30-minute duration were not tested. Concurrency is from one account; the organisation revision guard makes the result the same for many accounts.',
  completedAt: new Date().toISOString()
};
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
server.kill('SIGTERM');
setTimeout(() => { rmSync(isolated, { recursive: true, force: true }); rmSync(STATE, { recursive: true, force: true }); process.exit(0); }, 1500);
