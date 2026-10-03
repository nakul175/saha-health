// Slice 11d: performance budgets (non-functional). A moderate synthetic organisation (about 200 patients seeded through the controlled
// patient import, then confirmed visits and referrals), then 30 sequential requests per route or command, reported as p50 and p95.
// The budgets are deliberately generous (reads p95 <= 1500 ms, commands p95 <= 2500 ms): they guard against a large regression, they are not
// service levels. The numbers come from a local `wrangler dev` Worker (workerd) with a local D1 on a 2-core machine shared with other jobs; they
// are not Cloudflare numbers and say nothing about production latency, cold starts or D1 round trips from the edge.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { startWorker } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';
import { buildWorld, facts } from '../lib/nfr-world.mjs';

const PORT = process.env.SAHA_TEST_PORT ?? '8831';
const PEOPLE = Math.max(100, Math.round(+(process.env.SAHA_NFR_PEOPLE ?? 200) / 100) * 100); // imported in batches of 100 (the import limit)
const N = 30, READ_BUDGET = 1500, COMMAND_BUDGET = 2500, WORKSPACE_BYTES_BUDGET = 4 * 1024 * 1024;
const r = suite('Performance budgets (non-functional)', 'tests/reports/performance-budgets-result.json', {
  layer: 'non-functional',
  limits: [
    'Local wrangler dev Worker (workerd) with a local D1 on a 2-core machine shared with other jobs; these are not Cloudflare numbers and not service levels. Budgets guard against large regressions only.',
    `One organisation of about ${PEOPLE + 9} patients; Cloudflare D1 round trips from the edge, cold starts, concurrent users and the 128 MB isolate limit are not represented.`,
    `${N} sequential requests per measurement after 3 warm-up requests; p95 of 30 samples is the second-slowest request, so it is a noisy statistic on a shared machine.`,
    'The first reads of a request path also write read-audit events, as in normal use; they are part of the measured cost.',
  ],
});

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const alpha = i => { let s = ''; i++; while (i > 0) { s = String.fromCharCode(96 + ((i - 1) % 26 + 1)) + s; i = Math.floor((i - 1) / 26); } return s; };
const syll = ['ka', 'ra', 'mi', 'su', 'na', 'vi', 'de', 'lo', 'ha', 'ta', 'pe', 'zu', 'ga', 'bo', 'fi', 'yo'];
const word = () => Array.from({ length: 3 }, () => syll[Math.floor(Math.random() * syll.length)]).join('');

const t0 = performance.now();
const worker = await startWorker({ port: PORT, name: 'nfr-performance' });
try {
  const world = await buildWorld(worker.base);
  const { api, who, org } = world;
  console.log(`world built in ${Math.round(performance.now() - t0)} ms`);

  // ── seed ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const tSeed = performance.now(), tag = world.run;
  const imported = [];
  for (let b = 0; b < PEOPLE / 100; b++) {
    const rows = Array.from({ length: 100 }, (_, i) => { const k = b * 100 + i, name = `${word()}${alpha(k)} ${word()}`; imported.push(name); return `${name},${5 + (k * 7) % 70},${k % 2 ? 'Female' : 'Male'},Perf village ${tag}-${k},${['General care', 'Chronic care', 'Maternal care'][k % 3]},default`; });
    const csv = ['name,age,sex,village,programme,team', ...rows].join('\n');
    const dry = await api.call(who.owner, '/api/patient-import', { method: 'POST', body: { csv }, org });
    if (dry.status !== 200 || dry.json.counts.accepted !== 100) throw new Error(`import dry run ${b}: ${dry.status} ${JSON.stringify(dry.json?.counts ?? dry.text.slice(0, 200))}`);
    await world.cmd('owner', { type: 'patientImportApply', csv, planHash: dry.json.planHash, reason: 'Synthetic import for the performance budgets' }, { org });
  }
  world.patientNames.push(...imported);
  let owner = await world.load('owner', org);
  const imports = owner.people.filter(p => p.imported).slice(0, 100); // first 30 for ASHA 1 to visit, the next 33 for the owner's visit lifecycle measurements
  const assignTo = async (p, l) => { const fresh = (await world.load('owner', org)).people.find(x => x.id === p.id); await world.cmd('owner', { type: 'assignPatient', personId: p.id, version: fresh.version, teamId: 'default', assignedTo: who[l].id, reason: 'Synthetic assignment for the performance budgets' }, { org }); };
  for (const p of imports.slice(0, 30)) await assignTo(p, 'asha1');
  const confirmVisit = async (l, personId) => {
    const started = await world.cmd(l, { type: 'startVisit', personId }, { org }), visitId = started.result.visitId;
    const saved = await world.cmd(l, { type: 'saveVisit', visitId, version: 1, facts: facts() }, { org });
    const v = saved.snapshot.visits.find(x => x.id === visitId), p = saved.snapshot.people.find(x => x.id === personId);
    await world.cmd(l, { type: 'confirmVisit', visitId, version: v.version, patientCheck: { personId, personVersion: p.version, confirmed: true } }, { org });
    return visitId;
  };
  const seededVisits = [];
  for (const p of imports.slice(0, 30)) seededVisits.push(await confirmVisit('asha1', p.id));
  owner = await world.load('owner', org);
  console.log(`seeded ${owner.people.length} patients and ${owner.visits.length} confirmed visits in ${Math.round(performance.now() - tSeed)} ms`);
  await r.check(`seed: the organisation holds at least ${PEOPLE} patients and 30 confirmed visits`, () => { if (owner.people.length < PEOPLE) throw new Error(`${owner.people.length} patients`); if (owner.visits.filter(v => v.state === 'confirmed').length < 30) throw new Error('too few confirmed visits'); });

  // ── measurement helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const table = [];
  const run = async (label, kind, fn, { budget = kind === 'read' ? READ_BUDGET : COMMAND_BUDGET } = {}) => {
    for (let i = 0; i < 3; i++) await fn(-1 - i); // warm-up (not measured)
    const ms = [], statuses = new Set(); let bytes = 0;
    for (let i = 0; i < N; i++) { const x = await fn(i); statuses.add(x.status); ms.push(x.ms); bytes = Math.max(bytes, Buffer.byteLength(x.text ?? '')); }
    const row = { label, kind, p50: Math.round(pct(ms, 0.5)), p95: Math.round(pct(ms, 0.95)), max: Math.round(Math.max(...ms)), bytes, statuses: [...statuses] };
    table.push(row);
    await r.check(`${label}: every one of ${N} requests succeeded (status ${row.statuses.join('/')})`, () => { if (row.statuses.some(s => s < 200 || s >= 300)) throw new Error(`statuses ${row.statuses}`); });
    r.measure(`p50 ms ${label}`, row.p50); r.measure(`p95 ms ${label}`, row.p95, { budget });
    return row;
  };

  // ── reads ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const personForReads = imports[0].id, visitForReads = seededVisits[0];
  const GETS = [
    ['/api/workspace', 'owner'], ['/api/workspace', 'asha1'], ['/api/workspace', 'supervisor'], ['/api/workspace', 'admin'],
    ['/api/patients', 'owner'], ['/api/patients', 'asha1'], [`/api/patients/detail?personId=${personForReads}`, 'owner'],
    ['/api/worklists?view=work', 'owner'], ['/api/worklists?view=work', 'asha1'], ['/api/worklists?view=followups', 'owner'], ['/api/worklists?view=submissions', 'owner'], ['/api/worklists?view=referrals', 'owner'],
    [`/api/history?personId=${personForReads}`, 'owner'], [`/api/action-plan?personId=${personForReads}`, 'owner'], [`/api/household?personId=${personForReads}`, 'owner'], [`/api/rights?personId=${personForReads}`, 'owner'], [`/api/identity-cases?personId=${personForReads}`, 'owner'],
    [`/api/trace?visit=${visitForReads}`, 'owner'], [`/api/governance?visitId=${visitForReads}`, 'owner'], [`/api/fhir/${visitForReads}?organisationId=${org}`, 'asha1'],
    ['/api/audit', 'owner'], ['/api/audit/chain', 'owner'], ['/api/operations', 'owner'], ['/api/indicators', 'owner'], ['/api/caseload', 'owner'], ['/api/continuity', 'owner'],
    ['/api/referral-requests', 'owner'], ['/api/referral-escalations', 'owner'], ['/api/exceptions', 'owner'], ['/api/outreach', 'owner'], ['/api/pilot', 'owner'], ['/api/delegations', 'owner'], ['/api/alerts', 'owner'],
    ['/api/aggregate-reports', 'owner'], ['/api/incentive-claims', 'owner'], ['/api/worker-activity', 'owner'], ['/api/provider-sandbox', 'owner'], ['/api/data-exit', 'owner'],
  ];
  for (const [path, l] of GETS) {
    await run(`GET ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').replace(/org_[0-9a-f]+/, '<org>')} as ${l}`, 'read', () => api.call(who[l], path, { org }));
  }

  // ── workspace response size ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const l of ['owner', 'asha1', 'admin']) {
    const x = await api.call(who[l], '/api/workspace', { org });
    const raw = Buffer.byteLength(x.text), gz = gzipSync(x.text).length;
    console.log(`workspace as ${l}: ${raw} bytes (${gz} gzip), ${x.json.people.length} people, ${x.json.visits.length} visits`);
    r.measure(`bytes /api/workspace as ${l} (${x.json.people.length} people, ${x.json.visits.length} visits)`, raw, { unit: 'bytes', budget: l === 'owner' ? WORKSPACE_BYTES_BUDGET : undefined });
    r.measure(`bytes /api/workspace as ${l} gzip`, gz, { unit: 'bytes' });
  }

  // ── commands ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  let n = 0;
  const cmdOwner = body => api.command(who.owner, body, org);
  await run('POST createPerson (owner)', 'command', async () => { const i = ++n; const name = `${word()}${alpha(1000 + i)} ${word()}`; world.patientNames.push(name); return cmdOwner({ type: 'createPerson', name, age: 20 + (i % 50), sex: 'Female', village: `Perf created ${tag}-${i}`, programme: 'General care', teamId: 'default' }); });
  const forVisits = imports.slice(30, 63); // fresh patients for the visit lifecycle (owner is a clinician in the team); 3 warm-up + 30 measured = 33 per stage
  const started = [];
  let vi = 0;
  await run('POST startVisit (owner)', 'command', async () => { const p = forVisits[vi++]; const x = await cmdOwner({ type: 'startVisit', personId: p.id }); if (x.json?.result) started.push({ personId: p.id, visitId: x.json.result.visitId }); return x; });
  let si = 0; const saved = [];
  await run('POST saveVisit (owner)', 'command', async () => { const s = started[si++]; const x = await cmdOwner({ type: 'saveVisit', visitId: s.visitId, version: 1, facts: facts() }); if (x.json?.snapshot) saved.push({ ...s, version: x.json.snapshot.visits.find(v => v.id === s.visitId).version, personVersion: x.json.snapshot.people.find(p => p.id === s.personId).version }); return x; });
  let ci = 0; const confirmed = [];
  await run('POST confirmVisit (owner)', 'command', async () => { const s = saved[ci++]; const x = await cmdOwner({ type: 'confirmVisit', visitId: s.visitId, version: s.version, patientCheck: { personId: s.personId, personVersion: s.personVersion, confirmed: true } }); if (x.status === 200) confirmed.push(s); return x; });
  let ri = 0;
  await run('POST createReferral (owner)', 'command', async () => { const s = confirmed[ri++]; return cmdOwner({ type: 'createReferral', visitId: s.visitId, facility: 'Synthetic clinic', reason: 'Synthetic referral for the performance budgets' }); });
  const replayKey = crypto.randomUUID(), replayBody = { type: 'createTeam', name: `Perf replay ${tag}` };
  await api.call(who.owner, '/api/commands', { method: 'POST', body: replayBody, org, headers: { 'Idempotency-Key': replayKey } });
  await run('POST replay of a saved command (same Idempotency-Key)', 'command', () => api.call(who.owner, '/api/commands', { method: 'POST', body: replayBody, org, headers: { 'Idempotency-Key': replayKey } }));
  let ii = 0;
  await run('POST /api/patient-import dry run, 100 rows (owner)', 'command', async () => { const k = ii++; const rows = Array.from({ length: 100 }, (_, i) => `${word()}${alpha(5000 + k * 100 + i)} ${word()},${5 + (i * 7) % 70},Male,Perf dry ${tag}-${k}-${i},General care,default`); return api.call(who.owner, '/api/patient-import', { method: 'POST', body: { csv: ['name,age,sex,village,programme,team', ...rows].join('\n') }, org }); });
  await run('POST /api/patients search by name (owner)', 'read', () => api.call(who.owner, '/api/patients', { method: 'POST', body: { q: 'ka' }, org }));

  // ── report ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const widest = Math.max(...table.map(t => t.label.length));
  console.log('\nlatency (ms), ' + N + ' sequential requests each, local Worker, 2-core shared machine:\n' + 'measurement'.padEnd(widest) + '    p50    p95    max   bytes');
  for (const t of table) console.log(t.label.padEnd(widest) + String(t.p50).padStart(7) + String(t.p95).padStart(7) + String(t.max).padStart(7) + String(t.bytes).padStart(9));
  const slow = [...table].sort((a, b) => b.p95 - a.p95).slice(0, 5).map(t => `${t.label} p95 ${t.p95} ms`);
  console.log(`\nslowest by p95: ${slow.join('; ')}`);
  await r.finish({ people: owner.people.length, visits: owner.visits.length, samplesPerMeasurement: N, budgets: { readP95Ms: READ_BUDGET, commandP95Ms: COMMAND_BUDGET, workspaceOwnerBytes: WORKSPACE_BYTES_BUDGET }, latency: table, durationMs: Math.round(performance.now() - t0) });
} catch (e) {
  console.error(e); await r.check('suite setup', () => { throw e; }); await r.finish();
} finally { await worker.stop(); }
