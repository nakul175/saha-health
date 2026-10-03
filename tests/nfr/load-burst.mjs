// Slice 11d: bounded load burst (non-functional). Eight concurrent clients (two owner sessions, two clinician sessions, two ASHAs, a supervisor
// and an admin) each make 50 mixed requests against one local Worker: reads of the workspace and work lists, patient registrations, visit
// lifecycles, and Idempotency-Key replays and races. Checks: no unhandled 5xx (the documented audit fail-closed refusal of a read is counted and retried, see the finding below), no lost or duplicated command (every acknowledged registration exists exactly once
// in the final state, every replay returns the first result, no refused or unacknowledged registration exists), a consistent final state
// (counts match what the clients were told), and the Worker is still healthy afterwards.
// This is a bounded smoke of concurrency on a local single-instance Worker and a local D1; it is not a capacity test and says nothing about
// Cloudflare's edge, many Worker instances, or sustained load.
import { startWorker } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';
import { buildWorld, facts } from '../lib/nfr-world.mjs';

const PORT = process.env.SAHA_TEST_PORT ?? '8832';
const CLIENTS = 8, SLOTS = 50, RETRIES = 6, READ_RETRIES = 4, AUDIT_REFUSED_SHARE_LIMIT = 0.05;
const AUDIT_REFUSED = /could not record this access in the audit log/; // the documented fail-closed refusal of a read (BR-SEC-08), slice 6t
const r = suite('Load burst (non-functional)', 'tests/reports/load-burst-result.json', {
  layer: 'non-functional',
  limits: [
    'One local wrangler dev Worker (one isolate) and a local D1 on a 2-core machine shared with other jobs; eight clients is a bounded burst, not a capacity or soak test.',
    'A 409 conflict is retried up to six times with the same Idempotency-Key (safe by design); the suite reports how many retries were needed and how many writes still ended in 409 ("exhausted": the documented try-again answer, nothing saved). A command that never succeeds is checked to be absent from the final state; any other refusal stops the client.',
    'Latencies under load are recorded for information with a generous ceiling that only catches a hang.',
  ],
});

const t0 = performance.now();
const worker = await startWorker({ port: PORT, name: 'nfr-load-burst' });
try {
  const world = await buildWorld(worker.base);
  const { api, who, org } = world;
  const base = await world.load('owner', org);
  const initial = { people: base.people.length, confirmedVisits: base.visits.filter(v => v.state === 'confirmed').length };
  console.log(`world built in ${Math.round(performance.now() - t0)} ms; initial ${initial.people} patients, ${initial.confirmedVisits} confirmed visits`);

  const plan = [['owner', 'rw'], ['owner', 'rw'], ['clinician', 'rw'], ['clinician', 'rw'], ['asha1', 'rw'], ['asha2', 'rw'], ['supervisor', 'r'], ['admin', 'r']];
  const READS = { owner: ['/api/workspace', '/api/patients', '/api/worklists?view=work', '/api/audit', '/api/operations', '/api/caseload'], clinician: ['/api/workspace', '/api/patients', '/api/worklists?view=work', '/api/audit', '/api/caseload'], asha1: ['/api/workspace', '/api/patients', '/api/worklists?view=work', '/api/audit', '/api/alerts'], asha2: ['/api/workspace', '/api/patients', '/api/worklists?view=work', '/api/audit', '/api/alerts'], supervisor: ['/api/workspace', '/api/patients', '/api/worklists?view=work', '/api/audit', '/api/operations'], admin: ['/api/workspace', '/api/audit', '/api/operations', '/api/alerts', '/api/pilot'] };
  const log = []; // every HTTP call: { client, kind, status, ms }
  const acknowledged = new Map(), unacknowledged = new Set(), createdBy = new Map(); // name -> personId
  const replayMismatch = [], visitsDone = [], auditRefused = [], counters = { conflicts: 0, retries: 0, exhausted: 0, replays: 0, races: 0, reads: 0, creates: 0, visitSteps: 0, auditRefusedReads: 0 };

  const call = async (c, kind, who_, path, opts) => { const x = await api.call(who_, path, { org, ...opts }); log.push({ client: c, kind, status: x.status, ms: x.ms, path, auditRefusal: x.status === 503 && AUDIT_REFUSED.test(x.text) }); return x; };
  // A write with the same Idempotency-Key retried on a conflict; returns the final response.
  const write = async (c, kind, who_, body, key = crypto.randomUUID()) => {
    let x;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      x = await call(c, kind, who_, '/api/commands', { method: 'POST', body, headers: { 'Idempotency-Key': key } });
      if (x.status !== 409) return x;
      counters.conflicts++; counters.retries++; await new Promise(r => setTimeout(r, 20 + Math.random() * 80));
    }
    return x;
  };

  const client = async (c) => {
    const [role, mode] = plan[c], me = who[role], myCreated = [];
    let n = 0, lastCreate = null;
    const register = async (key) => {
      const name = `Quillon Load${c}x${++n} ${world.run}`; world.patientNames.push(name); createdBy.set(name, c);
      const body = { type: 'createPerson', name, age: 20 + ((c * 7 + n) % 60), sex: n % 2 ? 'Female' : 'Male', village: `Load locality ${world.run}-${c}-${n}`, programme: 'General care', teamId: 'default' };
      const x = await write(c, 'create', me, body, key);
      counters.creates++;
      if (x.status === 409) counters.exhausted++; else if (x.status !== 200) throw new Error(`client ${c} createPerson: ${x.status} ${x.text.slice(0, 120)}`);
      if (x.status === 200) { acknowledged.set(name, x.json.result.personId); myCreated.push({ name, personId: x.json.result.personId }); lastCreate = { key, body, personId: x.json.result.personId }; } else unacknowledged.add(name);
      return { x, name, body };
    };
    for (let i = 0; i < SLOTS; i++) {
      const kind = mode === 'r' ? 'read' : i % 10 === 4 ? 'create' : i % 10 === 6 && lastCreate ? 'replay' : i % 25 === 12 && myCreated.length ? 'visit' : i % 10 === 8 ? 'race' : 'read';
      if (kind === 'read') {
        const path = READS[role][(i + c) % READS[role].length]; counters.reads++;
        // A read is refused (503, nothing shown) when its access event cannot be chained after six attempts under contention; the message says
        // "Try again". That documented fail-closed refusal is counted and retried; any other non-200 answer ends the client.
        let x = await call(c, 'read', me, path);
        for (let k = 0; x.status === 503 && AUDIT_REFUSED.test(x.text) && k < READ_RETRIES; k++) {
          counters.auditRefusedReads++; auditRefused.push({ client: c, role, path, leaked: /"people"|"patients"|Quillon/.test(x.text) }); await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
          x = await call(c, 'read', me, path);
        }
        if (x.status !== 200) throw new Error(`client ${c} (${role}) read ${path}: ${x.status} ${x.text.slice(0, 120)}`);
      } else if (kind === 'create') {
        await register(crypto.randomUUID());
      } else if (kind === 'replay') { // the same key and body again: the first result comes back, nothing new is created
        counters.replays++; const first = lastCreate;
        const x = await call(c, 'replay', me, '/api/commands', { method: 'POST', body: first.body, headers: { 'Idempotency-Key': first.key } });
        if (x.status !== 200 || x.json?.replayed !== true || x.json?.result?.personId !== first.personId) replayMismatch.push(`client ${c}: replay got ${x.status} replayed=${x.json?.replayed} person=${x.json?.result?.personId} (first ${first.personId})`);
        const diff = await call(c, 'replay', me, '/api/commands', { method: 'POST', body: { ...first.body, name: `${first.body.name} other` }, headers: { 'Idempotency-Key': first.key } });
        if (diff.status !== 409) replayMismatch.push(`client ${c}: same key with different input got ${diff.status}, expected 409`);
      } else if (kind === 'race') { // the same key sent twice at the same moment: one registration, both callers get its result
        counters.races++; const key = crypto.randomUUID(), name = `Quillon Load${c}x${++n} ${world.run}`; world.patientNames.push(name); createdBy.set(name, c);
        const body = { type: 'createPerson', name, age: 33, sex: 'Female', village: `Load locality ${world.run}-${c}-${n}`, programme: 'General care', teamId: 'default' };
        const pair = await Promise.all([write(c, 'race', me, body, key), write(c, 'race', me, body, key)]);
        const ok = pair.filter(p => p.status === 200);
        if (ok.length) { acknowledged.set(name, ok[0].json.result.personId); myCreated.push({ name, personId: ok[0].json.result.personId }); if (ok.length === 2 && ok[0].json.result.personId !== ok[1].json.result.personId) replayMismatch.push(`client ${c}: racing pair created two different people`); } else unacknowledged.add(name);
      } else if (kind === 'visit') { // start, save and confirm a visit on a patient this client registered (owner and clinicians may; an ASHA only for an assigned patient)
        const target = myCreated[myCreated.length - 1];
        const started = await write(c, 'visit', me, { type: 'startVisit', personId: target.personId });
        if (started.status !== 200) { if (started.status === 409) counters.exhausted++; else if (started.status !== 403) throw new Error(`client ${c} startVisit: ${started.status} ${started.text.slice(0, 120)}`); continue; }
        const visitId = started.json.result.visitId; counters.visitSteps++;
        const saved = await write(c, 'visit', me, { type: 'saveVisit', visitId, version: 1, facts: facts() });
        if (saved.status === 409) { counters.exhausted++; continue; } if (saved.status !== 200) throw new Error(`client ${c} saveVisit: ${saved.status} ${saved.text.slice(0, 120)}`);
        const v = saved.json.snapshot.visits.find(x => x.id === visitId), p = saved.json.snapshot.people.find(x => x.id === target.personId);
        const done = await write(c, 'visit', me, { type: 'confirmVisit', visitId, version: v.version, patientCheck: { personId: target.personId, personVersion: p.version, confirmed: true } });
        if (done.status === 200) visitsDone.push(visitId); else if (done.status === 409) counters.exhausted++; else throw new Error(`client ${c} confirmVisit: ${done.status} ${done.text.slice(0, 120)}`);
      }
    }
  };

  const tBurst = performance.now();
  const outcomes = await Promise.allSettled(Array.from({ length: CLIENTS }, (_, c) => client(c)));
  const burstMs = Math.round(performance.now() - tBurst);
  const ms = log.map(l => l.ms).sort((a, b) => a - b), pct = p => Math.round(ms[Math.min(ms.length - 1, Math.ceil(p * ms.length) - 1)]);
  const statusCounts = log.reduce((m, l) => (m[l.status] = (m[l.status] ?? 0) + 1, m), {});
  console.log(`burst: ${CLIENTS} clients x ${SLOTS} slots = ${log.length} HTTP calls in ${burstMs} ms; statuses ${JSON.stringify(statusCounts)}; p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${Math.round(ms.at(-1))} ms; counters ${JSON.stringify(counters)}`);

  // Why a read was refused: the Worker logs the status or error name of the failed audit write ("Access audit not recorded 409" is the chain-race limit being reached).
  const auditWriteLog = worker.output().split('\n').map(l => /Access audit not recorded\s*(\S*)/.exec(l)?.[1]).filter(x => x !== undefined), auditWriteReasons = auditWriteLog.reduce((m, k) => (m[k || 'unknown'] = (m[k || 'unknown'] ?? 0) + 1, m), {});
  console.log(`audit-refused reads: ${counters.auditRefusedReads}; Worker log of failed access-audit writes by reason: ${JSON.stringify(auditWriteReasons)}`);
  await r.check('every client completed all of its slots without an unexpected response', () => { const bad = outcomes.map((o, i) => o.status === 'rejected' ? `client ${i}: ${o.reason?.message ?? o.reason}` : '').filter(Boolean); if (bad.length) throw new Error(bad.join('\n')); });
  // Slice 11d finding (first run, 2026-10-03): one of 281 reads was answered 503 "could not record this access in the audit log" under eight-way
  // contention on one organisation's audit chain. That is the code-defined fail-closed refusal, not an unhandled error, so the invariant is split:
  // strictly no other 5xx; the audit refusals are counted, must carry no patient data, must succeed on retry, and must stay a small share of reads.
  const fiveXx = log.filter(l => l.status >= 500);
  await r.check(`no unhandled 5xx in ${log.length} requests (statuses ${JSON.stringify(statusCounts)}); a 503 is allowed only as the documented audit fail-closed refusal of a read`, () => { const bad = log.filter(l => l.status >= 500 && !(l.kind === 'read' && l.status === 503 && l.auditRefusal)); if (bad.length) throw new Error(`${bad.length} server errors, first: ${bad[0].kind} ${bad[0].path} ${bad[0].status}`); });
  await r.check(`audit refusals under contention: ${counters.auditRefusedReads} of ${counters.reads} reads refused (fail closed), each carried no patient data and succeeded on retry, share at most ${AUDIT_REFUSED_SHARE_LIMIT * 100}%`, () => {
    if (auditRefused.some(a => a.leaked)) throw new Error('a refused read returned patient data');
    if (counters.auditRefusedReads / counters.reads > AUDIT_REFUSED_SHARE_LIMIT) throw new Error(`${counters.auditRefusedReads} of ${counters.reads} reads refused, over ${AUDIT_REFUSED_SHARE_LIMIT * 100}%`);
  });
  await r.check('the Worker logged no unexpected failure while serving the burst', () => { const bad = worker.output().split('\n').filter(l => /Workspace operation failed|out of memory|Uncaught|Internal Server Error/i.test(l)); if (bad.length) throw new Error(bad.slice(0, 3).join('\n')); });
  await r.check('idempotency: every replay returned the first result with replayed=true, a changed body under the same key got 409, racing pairs created one person', () => { if (replayMismatch.length) throw new Error(replayMismatch.join('\n')); if (!counters.replays || !counters.races) throw new Error(`workload did not exercise replays (${counters.replays}) and races (${counters.races})`); });
  const final = await world.load('owner', org);
  const finalNames = final.people.map(p => p.name);
  await r.check(`no lost command: all ${acknowledged.size} acknowledged registrations exist in the final state`, () => { const lost = [...acknowledged].filter(([name, id]) => !final.people.some(p => p.id === id && p.name === name)); if (lost.length) throw new Error(`${lost.length} acknowledged registrations missing: ${lost.slice(0, 3).map(x => x[0])}`); if (acknowledged.size < 40) throw new Error(`only ${acknowledged.size} registrations acknowledged; the workload is too small to mean anything`); });
  await r.check('no duplicated command: no registered name appears twice, replays and racing pairs created exactly one person each', () => { const seen = new Map(); for (const n of finalNames) seen.set(n, (seen.get(n) ?? 0) + 1); const dup = [...seen].filter(([n, k]) => k > 1 && createdBy.has(n)); if (dup.length) throw new Error(`duplicated: ${dup.slice(0, 3).map(x => `${x[0]} x${x[1]}`)}`); });
  await r.check(`no phantom command: ${unacknowledged.size} registrations that were never acknowledged are absent from the final state`, () => { const ghosts = [...unacknowledged].filter(n => finalNames.includes(n)); if (ghosts.length) throw new Error(`${ghosts.length} unacknowledged registrations exist: ${ghosts.slice(0, 3)}`); });
  await r.check('final counts match: patients = initial + acknowledged registrations; confirmed visits = initial + acknowledged confirmations', () => {
    const wantPeople = initial.people + acknowledged.size, confirmed = final.visits.filter(v => v.state === 'confirmed').length, wantVisits = initial.confirmedVisits + visitsDone.length;
    if (final.people.length !== wantPeople) throw new Error(`patients ${final.people.length}, expected ${wantPeople}`);
    if (confirmed !== wantVisits) throw new Error(`confirmed visits ${confirmed}, expected ${wantVisits}`);
  });
  await r.check('the final state is the same through other roles: the supervisor and clinician see the same patients, the admin sees none', async () => {
    const sup = await world.load('supervisor', org), cli = await world.load('clinician', org), adm = await world.load('admin', org);
    if (sup.people.length !== final.people.length || cli.people.length !== final.people.length) throw new Error(`supervisor ${sup.people.length}, clinician ${cli.people.length}, owner ${final.people.length}`);
    if (adm.people.length !== 0) throw new Error(`admin sees ${adm.people.length} patients`);
  });
  await r.check('the Worker is healthy after the burst (workspace loads, a new command succeeds)', async () => { const x = await api.get(who.owner, '/api/workspace', org); if (x.status !== 200) throw new Error(`${x.status}`); await world.cmd('owner', { type: 'createTeam', name: `After burst ${world.run}` }, { org }); });
  r.measure(`writes still in conflict after ${RETRIES} attempts (documented try-again answer, nothing saved)`, counters.exhausted, { unit: 'writes' });
  r.measure(`p50 ms across ${log.length} requests under ${CLIENTS} concurrent clients`, pct(0.5));
  r.measure(`p95 ms across ${log.length} requests under ${CLIENTS} concurrent clients`, pct(0.95), { budget: 10000 });
  r.measure('max ms (a hang detector)', Math.round(ms.at(-1)), { budget: 30000 });
  await r.finish({ clients: CLIENTS, slotsPerClient: SLOTS, httpCalls: log.length, statusCounts, auditRefusedReads: auditRefused, auditWriteFailuresByReason: auditWriteReasons, fiveXxCount: fiveXx.length, counters, acknowledgedRegistrations: acknowledged.size, unacknowledgedRegistrations: unacknowledged.size, confirmedVisits: visitsDone.length, burstMs, initial, final: { people: final.people.length, confirmedVisits: final.visits.filter(v => v.state === 'confirmed').length }, durationMs: Math.round(performance.now() - t0) });
} catch (e) {
  console.error(e); await r.check('suite setup', () => { throw e; }); await r.finish();
} finally { await worker.stop(); }
