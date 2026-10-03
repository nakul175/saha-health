// Slice 11d: Worker memory growth per workspace load (non-functional). The built Worker runs in Miniflare with NO inspector attached (the
// local `wrangler dev` keeps request data for its inspector and grows about 270 KB per load, slice 10k, which would hide the Worker's own
// behaviour). Rounds of 1,000 owner workspace loads at concurrency 4 (three rounds by default; SAHA_NFR_ROUNDS, SAHA_NFR_LOADS and SAHA_NFR_CONCURRENCY change that); the resident memory of this
// instance's workerd processes (found by parent process, never by name) is read from /proc/<pid>/status after each round, split into anonymous
// memory (heap and native allocations), file-backed memory (the binary and the mapped SQLite database) and the local database's size on disk.
// Every workspace load appends one chained access-audit event (slice 10h), so the local database grows with the loads by design.
// The suite reports the growth per load for each round and whether it levels off (rounds after the first averaging 10 KB per load or less), and fails only if the LAST round grows by more than a generous
// threshold, so a large new leak is caught. It never claims a plateau it did not see.
// Limits: resident memory of a local workerd process, a seeded six-patient organisation, one identity, one route. It does not measure Cloudflare's
// 128 MB isolate limit and cannot prove the absence of a leak.
import { startMiniflare } from '../lib/miniflare.mjs';
import { identity } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';
import { existsSync } from 'node:fs';

const PORT = process.env.SAHA_TEST_PORT ?? '8834';
const ROUNDS = +(process.env.SAHA_NFR_ROUNDS ?? 3), LOADS = +(process.env.SAHA_NFR_LOADS ?? 1000), CONCURRENCY = +(process.env.SAHA_NFR_CONCURRENCY ?? 4), WARMUP = 100;
const THRESHOLD_KB_PER_LOAD = 150; // fail only when the last round grows by more than this per request
const PLATEAU_KB_PER_LOAD = 10;    // "levels off" means the last round grew by no more than this per load
const r = suite('Memory growth per workspace load (non-functional)', 'tests/reports/memory-growth-result.json', {
  layer: 'non-functional',
  environment: 'built Worker in Miniflare (no inspector), local D1, synthetic data',
  limits: [
    'Resident memory of the local workerd process(es) of one Miniflare instance, not Cloudflare isolate memory (128 MB limit) which has not been measured.',
    'One identity loading one route (GET /api/workspace) in a six-patient organisation; other routes and larger organisations are not covered.',
    'RSS is noisy (allocator and garbage-collection timing; V8 collects when it needs to, so a growing resident size is not by itself a leak). The suite fails only on a growth above the threshold in the last round, and it states "levels off" only when rounds 2 onward averaged no more than 10 KB per load.',
    'The sponsor-facing figure for `wrangler dev` (about 270 KB per load) is the inspector retaining request data, which this suite deliberately excludes.',
  ],
});

if (!existsSync('/proc/self/status')) { r.skip('memory growth', 'no /proc on this platform; resident memory is read from /proc/<pid>/status'); await r.finish(); process.exit(0); }

const t0 = performance.now();
const m = await startMiniflare({ port: PORT, name: 'nfr-memory', bindings: { SAHA_ENVIRONMENT: 'synthetic' } });
try {
  const who = identity('owner', crypto.randomUUID().slice(0, 8));
  const load = async () => { const x = await fetch(m.base + '/api/workspace', { headers: who.headers }); const body = await x.arrayBuffer(); return { status: x.status, bytes: body.byteLength }; };
  const burst = async (n) => { let i = 0, bad = 0, bytes = 0; await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < n) { i++; const x = await load(); if (x.status !== 200) bad++; bytes = Math.max(bytes, x.bytes); } })); return { bad, bytes }; };
  // median of three samples after a short idle, per component
  const sample = async () => { const xs = []; for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 400)); xs.push({ ...m.workerdMemKb(), db: Math.round(m.stateBytes() / 1024) }); } const med = k => xs.map(x => x[k]).sort((a, b) => a - b)[1]; return { rss: med('rss'), anon: med('anon'), file: med('file'), db: med('db') }; };
  const mb = kb => +(kb / 1024).toFixed(1);

  const pids = m.workerdPids();
  await r.check(`the Worker's own workerd process was identified by parent pid (${pids.join(', ') || 'none'}), not by name`, () => { if (!pids.length) throw new Error('no workerd descendant of this process'); });
  const first = await load();
  await r.check('the first workspace load succeeds (the local organisation is created)', () => { if (first.status !== 200) throw new Error(`status ${first.status}`); });
  const cold = m.workerdMemKb();
  const warm = await burst(WARMUP);
  const start = await sample();
  console.log(`workerd RSS: after first load ${mb(cold.rss)} MB (anon ${mb(cold.anon)}, file ${mb(cold.file)}), after ${WARMUP} warm-up loads ${mb(start.rss)} MB (anon ${mb(start.anon)}, file ${mb(start.file)}); local database ${mb(start.db)} MB; workspace ${first.bytes} bytes`);
  const rounds = []; let prev = start;
  for (let k = 1; k <= ROUNDS; k++) {
    const tr = performance.now(), res = await burst(LOADS), end = await sample();
    const per = key => +((end[key] - prev[key]) / LOADS).toFixed(2);
    rounds.push({ round: k, loads: LOADS, rssStartMb: mb(prev.rss), rssEndMb: mb(end.rss), growthKb: end.rss - prev.rss, kbPerLoad: per('rss'), anonKbPerLoad: per('anon'), fileKbPerLoad: per('file'), databaseKbPerLoad: per('db'), anonEndMb: mb(end.anon), fileEndMb: mb(end.file), databaseEndMb: mb(end.db), failedLoads: res.bad, seconds: +((performance.now() - tr) / 1000).toFixed(1) });
    const x = rounds.at(-1);
    console.log(`round ${k}: ${LOADS} loads in ${x.seconds} s, RSS ${x.rssStartMb} -> ${x.rssEndMb} MB, growth ${x.kbPerLoad} KB per load (anon ${x.anonKbPerLoad}, file-backed ${x.fileKbPerLoad}; local database ${x.databaseKbPerLoad} KB per load, now ${x.databaseEndMb} MB), ${res.bad} failed`);
    prev = end;
  }
  // Round 1 includes heap warm-up, so the verdict reads the rounds after it: "levels off" needs their mean growth to be 10 KB per load or less.
  // V8 grows its heap in steps, so single rounds are noisy; the per-round values are always printed and stored.
  const last = rounds.at(-1), firstRound = rounds[0], tail = rounds.slice(1), tailMean = tail.length ? +(tail.reduce((a, x) => a + x.kbPerLoad, 0) / tail.length).toFixed(2) : firstRound.kbPerLoad;
  const quiet = tail.filter(x => x.kbPerLoad <= PLATEAU_KB_PER_LOAD).length;
  const levelsOff = tailMean <= PLATEAU_KB_PER_LOAD, slowing = tailMean < firstRound.kbPerLoad * 0.5;
  const verdict = levelsOff ? `levels off: rounds 2 to ${ROUNDS} grew ${tailMean} KB per load on average (round 1: ${firstRound.kbPerLoad})`
    : slowing ? `slowing but not levelled off within ${ROUNDS * LOADS} loads: ${rounds.map(x => x.kbPerLoad).join(', ')} KB per load by round; rounds 2 to ${ROUNDS} averaged ${tailMean} (above ${PLATEAU_KB_PER_LOAD}), ${quiet} of ${tail.length} of them at or below ${PLATEAU_KB_PER_LOAD}`
    : `not slowing within ${ROUNDS * LOADS} loads: ${rounds.map(x => x.kbPerLoad).join(', ')} KB per load by round`;
  console.log(`growth ${verdict}`);
  await r.check(`all ${ROUNDS * LOADS + WARMUP + 1} workspace loads returned 200`, () => { const bad = rounds.reduce((a, x) => a + x.failedLoads, 0) + warm.bad; if (bad) throw new Error(`${bad} loads failed`); });
  for (const x of rounds) r.measure(`KB per load, round ${x.round} (${x.loads} loads)`, x.kbPerLoad, { unit: 'KB', ...(x.round === ROUNDS ? { budget: THRESHOLD_KB_PER_LOAD } : {}) });
  r.measure('anonymous (heap and native) KB per load, last round', last.anonKbPerLoad, { unit: 'KB' });
  r.measure('file-backed KB per load, last round', last.fileKbPerLoad, { unit: 'KB' });
  r.measure('local database KB written per load, last round', last.databaseKbPerLoad, { unit: 'KB' });
  r.measure('mean KB per load over rounds 2 to the last', tailMean, { unit: 'KB' });
  r.measure('seconds for 1,000 loads, round 1', firstRound.seconds, { unit: 's' });
  r.measure('seconds for 1,000 loads, last round', last.seconds, { unit: 's' });
  r.measure('workerd RSS after the last round', last.rssEndMb, { unit: 'MB' });
  r.measure(`total RSS growth over ${ROUNDS} rounds`, +(last.rssEndMb - rounds[0].rssStartMb).toFixed(1), { unit: 'MB' });
  await r.finish({ verdict, levelsOff, slowing, tailMeanKbPerLoad: tailMean, thresholdKbPerLoad: THRESHOLD_KB_PER_LOAD, plateauKbPerLoad: PLATEAU_KB_PER_LOAD, rounds, rssAfterFirstLoadMb: mb(cold.rss), rssAfterWarmupMb: mb(start.rss), workspaceBytes: first.bytes, concurrency: CONCURRENCY, workerdPids: pids, durationMs: Math.round(performance.now() - t0) });
} catch (e) {
  console.error(e); await r.check('suite setup', () => { throw e; }); await r.finish();
} finally { await m.stop(); }
