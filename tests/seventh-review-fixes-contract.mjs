// Slice 6aa seventh-review-fixes contract: regressions for defects a seventh independent review found in round-3 slices
// 6w, 2h and 6y (reproductions in /tmp/claude-0/review7/*.mjs, 2 October 2026 UTC). Each numbered block fails on the
// code before 6aa; run it from an export of the base tree with REPORT_ALL=1 to list every failing check.
//  1. Indicator differencing: a different grouping, an exclusion definition or the cohort total no longer bypasses it.
//  1p. Property: random query sequences over a small synthetic population never release a nested pair whose
//      difference is a group of 1 to 4 (checked by an independent oracle over the plain synthetic records).
//  2. A different query window never replaces a protecting release, and nested windows are compared.
//  4. The differencing ledger is bounded by serialized size well under D1's 2 MB value limit.
//  5. Record import accepts identifiers only from listed issuers and refuses ABHA-like values under any issuer.
//  7. A redacted (out-of-scope) trace says whether a receipt exists, never the receipt itself.
//  8. Trace lookups keep the newest events and say when a list was cut.
// (Findings 3 and 6 are HTTP behaviour: tests/patient-directory-smoke.mjs and tests/record-import-smoke.mjs.)
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.seventh-review-fixes-contract-'));
let passed = 0;
const failed = [];
const fail = (name, e) => { if (process.env.REPORT_ALL) { failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); return; } e.message = `${name}: ${e.message}`; throw e; };
const check = (name, fn) => { try { fn(); passed++; } catch (e) { fail(name, e); } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { fail(name, e); } };

try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    if (f !== 'server.ts') writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'server.js'), `export const harness = {};
export async function identity() { return null; }
export function db() { return null; }
export function rawRuntime() { return {}; }
export function runtime() { return {}; }
export async function loadFor() { return null; }
export function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }`);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  let propertyStats = null;
  const I = await load('indicators'), D = await load('indicator-differencing');
  const now = new Date(), iso = now.toISOString(), day = 86400000, ago = d => new Date(now - d * day).toISOString();
  const m = { userId: 'sup', status: 'active', role: 'supervisor', isOwner: false, teamIds: ['t1', 't2'] };
  // The server's path: candidates and population built by the same functions, hashed by a plain salted string here.
  const h = async x => 'h:' + x;
  const hasPopulation = typeof I.releasePopulation === 'function' && typeof I.releaseCandidates === 'function';
  async function record(s, ledger, q) {
    const run = I.indicatorRun(s, m, q, now);
    const cands = hasPopulation ? await I.releaseCandidates(run.series, q, 'viewer', iso, h)
      : run.series.map(sr => { const f = {}; for (const k of ['team', 'village', 'programme']) if (q[k]) f[k] = k + ':' + q[k]; for (const [k, v] of Object.entries(sr.f)) f[k] = k + ':' + v; return { isCohort: sr.key === 'cohort', ids: sr.ids, release: { v: 'viewer', at: iso, k: 'series:' + sr.key, f, c: sr.cells, ...(sr.m ? { m: sr.m } : {}) } }; });
    const population = hasPopulation ? await I.releasePopulation(s, h, now) : undefined;
    const { accepted, refused } = D.screenReleases(ledger, cands, 5, iso, population);
    if (refused.some(c => c.isCohort)) return { ledger, refused: 'cohort', run };
    const w = new Set(refused.flatMap(c => c.ids)), released = new Set(accepted.flatMap(c => c.ids).filter(id => !w.has(id)));
    return { ledger: D.pruneLedger([...ledger, ...accepted.map(c => c.release)], iso), run, out: run.result.results.map(r => released.has(r.id + '@' + r.version) || r.refused ? r : { ...r, rows: [], refused: 'differencing' }) };
  }
  const withheld = x => x.refused === 'cohort' || x.out?.[0]?.refused === 'differencing';
  const person = (i, x) => ({ id: 'p' + i, name: 'S' + i, age: 30, sex: 'Female', village: 'V', programmes: ['Maternal care'], teamId: 't1', assigned: true, version: 1, createdAt: iso, followUps: [], enrolments: [], ...x });
  const state = (people, w = {}, ops) => ({ organisation: { id: 'o' }, teams: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }], members: [], ...(ops ? { operations: ops } : {}), workspace: { people, visits: [], submissions: [], referrals: [], audit: [], ...w } });

  // 1. (review7 diff-bypass A) 30 people, 20 in V; 6 provisional, 5 of them in V.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, { village: i < 20 ? 'V' : 'W', ...(i < 5 || i === 25 ? { identityReview: { state: 'provisional' } } : {}) }));
    const s = state(people);
    const a = await record(s, [], { ids: ['identity-provisional'], days: 30, group: 'none' });
    check('1 control: the all-village count is released', () => assert.equal(a.out[0].rows[0].value, 6));
    const b = await record(s, a.ledger, { ids: ['identity-provisional'], days: 30, group: 'none', village: 'V' });
    check('1 control: village V with the same grouping is withheld', () => assert.equal(withheld(b), true));
    for (const g of ['village', 'team', 'age-band', 'programme']) {
      const c = await record(s, a.ledger, { ids: ['identity-provisional'], days: 30, group: g, village: 'V' });
      check(`1 grouping by ${g} with village V is withheld too`, () => assert.equal(withheld(c), true, JSON.stringify(c.out?.[0]?.rows)));
    }
    // The other order: a grouped figure first (village V shown as a grouped cell), then the total over all villages.
    const c = await record(s, [], { ids: ['identity-provisional'], days: 30, group: 'village', village: 'V' });
    const d = await record(s, c.ledger, { ids: ['identity-provisional'], days: 30, group: 'none' });
    check('1 a grouped cell then the ungrouped total is compared (a grouped cell counts as a filter)', () => { assert.equal(withheld(c), false); assert.equal(withheld(d), true); });
  }
  // 1. (review7 diff-excl) 30 people, 2 provisional; an owner definition excluding provisional identities.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, i < 2 ? { identityReview: { state: 'provisional' } } : {}));
    const spec = { title: 'Patients, verified identities', unit: 'count', numerator: 'patients', denominator: null, filters: {}, exclude: ['identity-provisional'], exclusionsNote: 'x', owner: 'o', cadence: 'Monthly', minimumCohort: 5 };
    const s = state(people, {}, { indicatorDefinitions: [{ id: 'verified-patients', version: 1, status: 'active', spec, reason: 'r', by: 'o', byName: 'O', at: iso }] });
    const r = await record(s, [], { ids: ['verified-patients'], days: 30, group: 'none' });
    check('1 cohort total minus an exclusion definition in one request is withheld', () => assert.equal(r.refused === 'cohort' || r.out[0].refused === 'differencing', true, JSON.stringify(r.out?.[0])));
    const r2 = await record(s, [], { ids: ['identity-provisional', 'verified-patients'], days: 30, group: 'none' });
    check('1 and alongside the provisional count', () => assert.equal(r2.refused === 'cohort' || r2.out.some(x => x.refused === 'differencing'), true));
  }
  // 2. (review7 diff-bypass B) patients seen over 30 days vs 9 days: one person seen only 10 days ago.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, { village: i < 20 ? 'V' : 'W' }));
    const visits = [...Array.from({ length: 20 }, (_, i) => ({ id: 'v' + i, personId: 'p' + i, state: 'confirmed', confirmedAt: ago(2), createdAt: iso, facts: {} })), { id: 'vw', personId: 'p25', state: 'confirmed', confirmedAt: ago(10), createdAt: iso, facts: {} }];
    const s = state(people, { visits });
    const d30 = await record(s, [], { ids: ['patients-seen'], days: 30, group: 'none' });
    const d9 = await record(s, d30.ledger, { ids: ['patients-seen'], days: 9, group: 'none' });
    check('2 nested windows are compared: 30 days then 9 days is withheld', () => { assert.equal(withheld(d30), false); assert.equal(withheld(d9), true); });
  }
  // 2. (review7 diff-days) referrals: all/30d 7, V/30d withheld; all/7d must not replace the 30-day release.
  {
    const people = Array.from({ length: 30 }, (_, i) => person(i, { village: i < 20 ? 'V' : 'W' }));
    const referrals = [...[0, 1, 2, 3, 4, 5].map(i => ({ id: 'r' + i, personId: 'p' + i, visitId: 'v', facility: 'F', reason: 'x', state: 'created', createdAt: ago(2) })), { id: 'rw', personId: 'p25', visitId: 'v', facility: 'F', reason: 'x', state: 'created', createdAt: ago(20) }];
    const s = state(people, { referrals }), R = 'referrals-completed';
    const p30 = await record(s, [], { ids: [R], days: 30, group: 'none' });
    await checkAsync('2 control: V over 30 days after all over 30 days is withheld', async () => assert.equal(withheld(await record(s, p30.ledger, { ids: [R], days: 30, group: 'none', village: 'V' })), true));
    const p7 = await record(s, p30.ledger, { ids: [R], days: 7, group: 'none' });
    const v30 = await record(s, p7.ledger, { ids: [R], days: 30, group: 'none', village: 'V' });
    check('2 a 7-day query does not replace the 30-day release', () => assert.equal(withheld(v30), true, JSON.stringify(v30.out?.[0]?.rows)));
    check('2 both windows stay in the ledger', () => assert.equal(p7.ledger.filter(r => r.k === p30.ledger.find(x => x.m)?.k).length >= 2 || withheld(p7), true));
  }

  // 1p. Property test.
  {
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = xs => xs[Math.floor(rand() * xs.length)];
    const villages = ['A', 'B', 'C'], progs = ['Maternal care', 'NCD screening'];
    const ownerSpec = (id, x) => ({ id, version: 1, status: 'active', reason: 'r', by: 'o', byName: 'O', at: iso, spec: { title: id, unit: 'count', numerator: 'patients', denominator: null, filters: {}, exclude: [], exclusionsNote: 'x', owner: 'o', cadence: 'Monthly', minimumCohort: 5, ...x } });
    const defs = [ownerSpec('verified', { exclude: ['identity-provisional'] }), ownerSpec('women', { filters: { sex: 'Female' } }), ownerSpec('maternal-patients', { filters: { programme: 'Maternal care' } })];
    const ids = ['identity-provisional', 'patients-seen', 'visits-confirmed', 'referrals-completed', 'verified', 'women', 'maternal-patients'];
    let releasedPairs = 0, violations = [], queries = 0, withheldCount = 0;
    for (let trial = 0; trial < 24; trial++) {
      const n = 26 + Math.floor(rand() * 18);
      const people = Array.from({ length: n }, (_, i) => person(i, { village: pick(villages), teamId: pick(['t1', 't2']), sex: rand() < 0.6 ? 'Female' : 'Male', age: pick([8, 15, 30, 60]), programmes: rand() < 0.15 ? [...progs] : [pick(progs)], ...(rand() < 0.15 ? { identityReview: { state: 'provisional' } } : {}) }));
      const visits = people.flatMap((p, i) => rand() < 0.7 ? [{ id: 'v' + i, personId: p.id, state: 'confirmed', confirmedAt: ago(pick([1, 5, 12, 25])), createdAt: iso, facts: {} }] : []);
      const referrals = people.flatMap((p, i) => rand() < 0.3 ? [{ id: 'r' + i, personId: p.id, visitId: 'v', facility: 'F', reason: 'x', state: rand() < 0.5 ? 'completed' : 'created', createdAt: ago(pick([2, 10, 20])) }] : []);
      const s = state(people, { visits, referrals }, { indicatorDefinitions: defs });
      let ledger = [];
      const shown = []; // {measure, people:Set, since, value}
      const oracleSet = (q, def, group, cell) => people.filter(p => (!q.team || p.teamId === q.team) && (!q.village || p.village === q.village) && (!q.programme || p.programmes.includes(q.programme))
        && (!def || ((!def.spec.filters.sex || p.sex === def.spec.filters.sex) && (!def.spec.filters.programme || p.programmes.includes(def.spec.filters.programme)) && !(def.spec.exclude.includes('identity-provisional') && p.identityReview?.state === 'provisional')))
        && (group === 'none' || labels(p, group).includes(cell))).map(p => p.id);
      // Independent of lib/saha: the grouping labels and windowed measures as documented in slice 6d/6s.
      const labels = (p, g) => g === 'team' ? [p.teamId === 't1' ? 'T1' : 'T2'] : g === 'village' ? [p.village] : g === 'programme' ? (p.programmes.length ? p.programmes : ['None']) : [p.age < 10 ? '0–9' : p.age < 18 ? '10–17' : p.age < 50 ? '18–49' : '50+'];
      const WINDOWED = new Set(['patients-seen', 'visits-confirmed', 'referrals-created', 'referrals-completed']);
      const measureOf = id => { const d = defs.find(x => x.id === id); if (d) return [d.spec.numerator, null, d]; const b = { 'identity-provisional': ['identity-provisional', null], 'patients-seen': ['patients-seen', 'patients'], 'visits-confirmed': ['visits-confirmed', null], 'referrals-completed': ['referrals-completed', 'referrals-created'] }[id]; return [...b, null]; };
      for (let step = 0; step < 14; step++) {
        const q = { ids: [pick(ids), ...(rand() < 0.3 ? [pick(ids)] : [])].filter((x, i, a) => a.indexOf(x) === i), days: pick([7, 9, 30]), group: pick(['none', 'none', 'village', 'team', 'programme', 'age-band']), ...(rand() < 0.4 ? { village: pick(villages) } : {}), ...(rand() < 0.2 ? { team: pick(['t1', 't2']) } : {}), ...(rand() < 0.2 ? { programme: pick(progs) } : {}) };
        let r; try { r = await record(s, ledger, q); } catch { continue; }
        queries++;
        if (r.refused) { withheldCount++; continue; }
        ledger = r.ledger;
        const since = r.run.result.window.since;
        shown.push({ measure: 'patients', people: new Set(oracleSet(q, null, 'none', 'All')), since: '', value: r.run.result.cohort.people });
        for (const x of r.out) {
          if (x.refused) { withheldCount++; continue; }
          const [num, den, def] = measureOf(x.id);
          for (const row of x.rows) if (!row.suppressed) {
            const set = new Set(oracleSet(q, def, q.group, row.group)), win = mm => WINDOWED.has(mm) ? since : '';
            shown.push({ measure: num, people: set, since: win(num), value: row.numerator });
            if (den && row.denominator !== null) shown.push({ measure: den, people: set, since: win(den), value: row.denominator });
          }
        }
      }
      // Oracle: any two released figures of the same measure whose populations and windows nest differ by 0 or >= 5.
      const sub = (a, b) => [...a].every(x => b.has(x));
      for (const a of shown) for (const b of shown) {
        if (a === b || a.measure !== b.measure || !sub(a.people, b.people) || !(a.since >= b.since)) continue;
        releasedPairs++;
        const diff = b.value - a.value;
        if (diff > 0 && diff < 5) violations.push({ trial, measure: a.measure, diff, a: a.value, b: b.value });
      }
    }
    check('1p the property run released and compared nested pairs', () => { assert.ok(releasedPairs > 50, `only ${releasedPairs} nested pairs`); assert.ok(queries > 200); });
    check('1p no released nested pair differs by 1 to 4', () => assert.deepEqual(violations.slice(0, 5), [], `${violations.length} violations`));
    propertyStats = { trials: 24, queries, withheldResults: withheldCount, nestedReleasedPairs: releasedPairs, violations: violations.length };
  }
  check('1 the residual risk is stated to owners in the registry and with every result', () => { const srv = readFileSync('lib/saha/indicators-server.ts', 'utf8'); assert.ok(srv.includes('protection:RESIDUAL_RISK') && srv.includes('limits:RESIDUAL_RISK')); assert.match(readFileSync('app/indicator-registry-panel.tsx', 'utf8'), /cat\.canMaintain&&cat\.protection/); assert.match(D.RESIDUAL_RISK, /two people combining/); });
  // 4. Ledger bounded by serialized size (review7 ledger-size: ~2.9 KB per grouped release over 60 villages).
  {
    const hh = i => i.toString(16).padStart(20, '0');
    const rel = (v, i) => ({ v, at: iso, k: hh(i % 8), f: { village: hh(1000 + i) }, c: Object.fromEntries(Array.from({ length: 60 }, (_, g) => [hh(5000 + g), 20])), m: Object.fromEntries(Array.from({ length: 60 }, (_, g) => [hh(5000 + g), [3, 20]])) });
    const own = Array.from({ length: 399 }, (_, i) => rel('viewer', i)), bytes = new TextEncoder().encode(JSON.stringify(own)).length;
    check('4 the byte bounds sit well under D1\'s 2 MB value limit', () => { assert.equal(typeof D.LEDGER_BYTES, 'number'); assert.ok(D.LEDGER_BYTES <= 1_000_000 && D.VIEWER_LEDGER_BYTES < D.LEDGER_BYTES); });
    check('4 one viewer with 399 grouped releases (over 1 MB) is refused more', () => { assert.ok(bytes > 1_000_000, String(bytes)); assert.equal(D.ledgerFull(own, [rel('viewer', 399)], iso), true); });
    const many = ['a', 'b', 'c', 'd', 'e'].flatMap(v => Array.from({ length: 80 }, (_, i) => rel(v, i)));
    check('4 the organisation ledger is refused before it reaches the byte bound', () => assert.equal(D.ledgerFull(many, [rel('f', 0)], iso), true));
    check('4 a small ledger is not full', () => assert.equal(D.ledgerFull(own.slice(0, 20), [rel('viewer', 21)], iso), false));
    check('4 a ledger write D1 refuses is answered as a full ledger (429), not a raw 500', () => { const src = readFileSync('lib/saha/indicators-server.ts', 'utf8'); assert.match(src, /catch\{fail\(429,LEDGER_FULL_MESSAGE\);\}/); });
  }
  // 5. Record import issuers.
  {
    const R = await load('record-import');
    const st = { organisation: { id: 'o' }, teams: [{ id: 'default', name: 'Default' }], members: [], invitations: [], workspace: { people: [{ id: 'p1', name: 'Synthetic One', age: 30, sex: 'Female', village: 'V', programmes: ['General care'], teamId: 'default', assigned: true, version: 1, createdAt: iso, followUps: [], enrolments: [], identifiers: [] }], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } };
    const owner = { userId: 'own', status: 'active', role: 'clinician', isOwner: true, teamIds: ['default'] };
    const plan = await R.planRecordImport(st, owner, 'identifiers', ['person,issuer,identifier', 'p1,abha_number,12345678901234', 'p1,healthid,12-3456-7890-1234', 'p1,abhaid,99999999999999', 'p1,local_mrn,M-1', 'p1,rch,12345678901234', 'p1,nikshay,7654321'].join('\n'), 'synthetic', iso);
    const rows = Object.fromEntries(plan.rows.map(r => [r.row, r]));
    check('5 ABHA-like issuers are refused whatever their name', () => { for (const n of [1, 2, 3]) { assert.equal(rows[n].status, 'rejected'); assert.match(rows[n].reasons[0], /ABHA/); } });
    check('5 an unlisted issuer is refused', () => { assert.equal(rows[4].status, 'rejected'); assert.match(rows[4].reasons.join(' '), /Issuer must be one of: rch, nikshay/); });
    check('5 a 14-digit value is refused under a listed issuer too', () => { assert.equal(rows[5].status, 'rejected'); assert.match(rows[5].reasons[0], /ABHA/); });
    check('5 a listed issuer with a valid value is still accepted', () => assert.equal(rows[6].status, 'accepted', JSON.stringify(rows[6])));
  }
  // 7 and 8. Trace.
  {
    const T = await load('trace');
    const p = { id: 'p1', name: 'Synthetic', teamId: 't9', assigned: false, version: 1, followUps: [], enrolments: [] };
    const s = { organisation: { id: 'o' }, teams: [], members: [], workspace: { people: [p], visits: [], integrations: [], referrals: [], audit: [], receipts: {}, submissions: [{ id: 's1', visitId: 'v1', personId: 'p1', connectorId: 'demo', connectorName: 'Demo', state: 'accepted', mode: 'demo', payloadHash: 'x', receipt: 'SIM-RECEIPT-77', attempts: 1, message: '', createdAt: iso, updatedAt: iso }] } };
    const adm = { userId: 'adm', status: 'active', role: 'admin', isOwner: false, teamIds: [] };
    const target = { scope: 'redacted', person: p, visit: null, focus: 'submission:s1', threadIds: ['submission:s1'], redactedKind: 'submission' };
    const red = T.assembleTrace(s, adm, target, [], [], iso);
    check('7 a redacted trace does not carry the destination receipt', () => { assert.equal(JSON.stringify(red).includes('SIM-RECEIPT-77'), false); assert.equal(red.threads[0].receipt, null); });
    check('7 it says whether a receipt exists', () => assert.equal(red.threads[0].receiptExists, true));
    const full = T.assembleTrace(s, adm, { ...target, scope: 'full', threadIds: [] }, [], [], iso);
    check('7 a full trace keeps the receipt', () => { assert.equal(full.threads[0].receipt, 'SIM-RECEIPT-77'); assert.equal(full.threads[0].receiptExists, true); });
    const srv = readFileSync('lib/saha/trace-server.ts', 'utf8');
    check('8 lookups keep the newest events (descending order at the limit)', () => { const limited = srv.match(/ORDER BY [^`]*LIMIT/g) ?? []; assert.equal(limited.length, 2); assert.ok(limited.every(x => /ORDER BY at DESC/.test(x)), limited.join(' | ')); });
    check('8 reaching a limit is reported as truncated', () => { assert.match(srv, /truncated=true/); assert.equal(T.assembleTrace(s, adm, target, [], [], iso, true).truncated, true); assert.equal(red.truncated, false); });
  }
  if (failed.length) { console.log(JSON.stringify({ failed }, null, 1)); process.exitCode = 1; }
  const result = { suite: 'seventh review fixes contract (slice 6aa)', passed, failed: failed.length, property: propertyStats, completedAt: new Date().toISOString() };
  writeFileSync('tests/seventh-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
