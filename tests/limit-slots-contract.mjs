// Slice 14a: per-requester daily limits that hold under races (lib/saha/limit-slots.ts, migration 0018).
// The ABHA review throttle (6ab) and the indicator refusal limit (13d/13f) counted audit events and wrote the event after the
// request had run, so parallel requests could all pass the count first (review 10; 13d and 13f limits). A request now
// reserves a slot before it can learn anything, in one statement that inserts only while fewer than the limit are counted.
// Model: the real migrations in an in-memory SQLite database behind a D1 shim that adds 1-3 ms to every round trip (as in
// audit-contention-contract.mjs), so concurrent requests interleave as they would against a remote database. Checked:
//  1. migration 0018 makes the table and carries the last day's counted events into it;
//  2. the reservation is atomic: N parallel reservations with limit L give exactly L (a two-statement count-then-insert
//     under the same load gives more, so the model can tell);
//  3. the ABHA pattern: parallel requests for distinct holders record exactly L reviews; parallel requests for one holder
//     record one; mixed requests never count more than L, never leave a reservation behind, and once L are counted every
//     reservation is refused;
//  4. the window (inclusive for the ABHA throttle, exclusive for indicator refusals), expiry of abandoned reservations,
//     a holder reviewed again after the window, a failed write keeping the reservation, a failed request giving it back;
//  5. the guard and the clean-up use the table's primary key;
//  6. the server routes use it: abhaLink and indicator queries reserve before the lookup or query, and every recorded
//     review or refusal is counted first.
// Not a measurement of hosted D1, which runs one statement at a time per database; the HTTP checks are in limit-race-smoke.mjs.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.limit-slots-contract-'));
let passed = 0;
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
let seed = 14; const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const roundTrip = () => new Promise(r => setTimeout(r, 1 + Math.floor(rand() * 3)));
class Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.db = d1.db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d1, this.sql, args); }
  exec() { if (this.d1.failNext?.(this.sql)) throw new Error('injected D1 failure'); const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { await roundTrip(); return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { await roundTrip(); return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { await roundTrip(); return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.failNext = null; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) { await roundTrip(); this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const migrate = (db, files) => { for (const f of files) for (const s of readFileSync('drizzle/' + f, 'utf8').split('--> statement-breakpoint')) if (s.trim()) db.exec(s); };
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const L = await import(pathToFileURL(join(dir, 'limit-slots.js')));
  const { ABHA_REVIEW_LIMIT } = await import(pathToFileURL(join(dir, 'abdm.js')));
  const now = new Date().toISOString(), ago = ms => new Date(Date.parse(now) - ms).toISOString();
  const org = (db, id) => db.prepare("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,'createOrganisation',?)").run(id, 'Synthetic ' + id, now);

  // 1. Migration 0018 and its carry-over of the last day's events.
  await check('migration 0018 is the last migration, makes limit_slots and carries the last day of counted events into it', () => {
    assert.equal(migrations.at(-1), '0018_limit_slots.sql');
    const db = new DatabaseSync(':memory:'); migrate(db, migrations.slice(0, -1)); org(db, 'org_m');
    const cols = db.prepare('PRAGMA table_info(audit_events)').all().map(c => c.name);
    const ev = (id, action, subject, personId, actor, at) => { const v = { org_id: 'org_m', id, person_id: personId, actor_id: actor, actor_name: 'Synthetic', role: 'asha', action, subject, detail: 'Synthetic event', at }; db.prepare(`INSERT INTO audit_events (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(c => v[c] ?? null)); };
    ev('e1', 'abhaLinkReview', 'h1', 'h1', 'u1', ago(3600000)); ev('e2', 'abhaLinkReview', 'h1', 'h1', 'u1', ago(1800000)); ev('e3', 'abhaLinkReview', 'h2', 'h2', 'u1', ago(7200000));
    ev('e4', 'abhaLinkReview', 'h3', 'h3', 'u1', ago(2 * 86400000)); ev('e5', 'abhaLinkReview', 'h4', 'h4', 'u2', ago(60000));
    for (let i = 0; i < 3; i++) ev('r' + i, 'viewAggregate', 'indicator refusal', null, 'u1', ago(600000 * (i + 1)));
    ev('r9', 'viewAggregate', 'indicator refusal', null, 'u1', ago(90000000)); ev('v1', 'viewAggregate', 'indicator results', null, 'u1', ago(60000));
    migrate(db, migrations.slice(-1));
    const rows = db.prepare('SELECT actor_id,kind,slot_key,state,at FROM limit_slots ORDER BY actor_id,kind,slot_key').all();
    assert.deepEqual(rows.filter(r => r.kind === 'abhaReview').map(r => [r.actor_id, r.slot_key, r.state]), [['u1', 'h1', 'used'], ['u1', 'h2', 'used'], ['u2', 'h4', 'used']]);
    assert.equal(rows.find(r => r.slot_key === 'h1').at, ago(1800000), 'the latest review of a holder');
    assert.deepEqual(rows.filter(r => r.kind === 'indicatorRefusal').map(r => r.slot_key), ['event:r0', 'event:r1', 'event:r2']);
    assert.deepEqual(db.prepare('PRAGMA table_info(limit_slots)').all().filter(c => c.pk).map(c => c.name), ['org_id', 'actor_id', 'kind', 'slot_key']);
  });

  const d1 = new D1(); migrate(d1.db, migrations);
  let orgs = 0; const fresh = (kind = 'abhaReview', limit = ABHA_REVIEW_LIMIT, inclusive = kind === 'abhaReview') => { const id = 'org_' + (++orgs); org(d1.db, id); return { orgId: id, actorId: 'asha-1', kind, limit, inclusive }; };
  const rows = spec => d1.db.prepare('SELECT slot_key,state,at FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=?').all(spec.orgId, spec.actorId, spec.kind);
  const count = (spec, state) => rows(spec).filter(r => r.state === state).length;
  const sleep = () => new Promise(r => setTimeout(r, Math.floor(rand() * 8)));

  // 2. Atomic reservation.
  await check('a reservation succeeds only while fewer than the limit are counted', async () => {
    const spec = fresh(), got = [];
    for (let i = 0; i < 4; i++) got.push(await L.reserveSlot(d1, spec, now));
    assert.ok(got.slice(0, 3).every(k => /^pending:/.test(k)) && got[3] === null, JSON.stringify(got));
    await L.releaseSlot(d1, spec, got[0]);
    assert.ok(await L.reserveSlot(d1, spec, now), 'a released reservation makes room');
  });
  await check('40 parallel reservations with a limit of 3 give exactly 3, and 60 with a limit of 20 give exactly 20', async () => {
    for (const [n, kind, limit] of [[40, 'abhaReview', 3], [60, 'indicatorRefusal', 20]]) {
      const spec = fresh(kind, limit), got = await Promise.all(Array.from({ length: n }, () => L.reserveSlot(d1, spec, now)));
      assert.equal(got.filter(Boolean).length, limit); assert.equal(count(spec, 'pending'), limit);
    }
  });
  await check('control: a count followed by a separate insert lets parallel requests through together under the same load', async () => {
    const spec = fresh(), naive = async () => { const n = (await d1.prepare('SELECT count(*) AS n FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=?').bind(spec.orgId, spec.actorId, spec.kind).first()).n; if (n >= spec.limit) return false; await d1.prepare("INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) VALUES (?,?,?,?,'pending',?)").bind(spec.orgId, spec.actorId, spec.kind, crypto.randomUUID(), now).run(); return true; };
    const got = await Promise.all(Array.from({ length: 40 }, naive));
    assert.ok(got.filter(Boolean).length > spec.limit, `the naive guard admitted ${got.filter(Boolean).length}`);
  });

  // 3. The ABHA pattern through withLimitSlot: a request reserves, looks up after a delay, and keeps its slot for a holder.
  const abhaRequest = (spec, holder, log) => L.withLimitSlot(d1, spec, async slot => { await sleep(); if (holder === null) { log.push('free'); return 'linked'; } const fresh = await slot.use(holder); if (fresh) log.push('review:' + holder); return 'refused'; }, () => { throw Object.assign(new Error('throttled'), { throttled: true }); }).catch(e => { if (e.throttled) return 'throttled'; throw e; });
  await check('12 parallel requests for 12 distinct holders: exactly 3 reviews, the rest refused without a slot, nothing left pending', async () => {
    const spec = fresh(), log = [], out = await Promise.all(Array.from({ length: 12 }, (_, i) => abhaRequest(spec, 'holder-' + i, log)));
    assert.equal(log.length, 3, JSON.stringify(log)); assert.equal(out.filter(x => x === 'throttled').length, 9);
    assert.equal(count(spec, 'used'), 3); assert.equal(count(spec, 'pending'), 0);
    assert.deepEqual(rows(spec).map(r => r.slot_key).sort(), log.map(x => x.slice(7)).sort(), 'each used slot is named by its holding record');
    assert.equal(await abhaRequest(spec, null, []), 'throttled', 'after three, even a free number is refused');
  });
  await check('8 parallel requests for one holder: one review; the repeats give their reservations back', async () => {
    const spec = fresh(), log = []; await Promise.all(Array.from({ length: 8 }, () => abhaRequest(spec, 'holder-x', log)));
    assert.deepEqual(log, ['review:holder-x']); assert.equal(count(spec, 'used'), 1); assert.equal(count(spec, 'pending'), 0);
    const later = []; await abhaRequest(spec, 'holder-y', later); await abhaRequest(spec, 'holder-x', later);
    assert.deepEqual(later, ['review:holder-y'], 'a second holder is reviewed; the first is not reviewed again the same day');
  });
  await check('mixed bursts (free and held numbers, 30 requests, 5 times): never more than 3 counted at any moment, reviews at most 3, nothing left pending', async () => {
    for (let k = 0; k < 5; k++) {
      const spec = fresh(), log = []; let peak = 0;
      const watch = setInterval(() => { peak = Math.max(peak, rows(spec).length); }, 1);
      const out = await Promise.all(Array.from({ length: 30 }, (_, i) => abhaRequest(spec, i % 3 === 0 ? null : 'h' + (i % 7), log)));
      clearInterval(watch);
      const reviews = log.filter(x => x.startsWith('review:'));
      assert.ok(peak <= 3, `peak ${peak}`); assert.ok(reviews.length <= 3 && new Set(reviews).size === reviews.length, JSON.stringify(reviews));
      assert.equal(count(spec, 'pending'), 0); assert.equal(count(spec, 'used'), reviews.length);
      assert.ok(out.includes('throttled'), 'some requests met a full limit');
      if (reviews.length === 3) assert.equal(await L.reserveSlot(d1, spec, now), null);
    }
  });

  // 4. Window, expiry, failures.
  await check('the window: a slot exactly 24 hours old counts for the ABHA throttle (at>=) and not for indicator refusals (at>)', async () => {
    for (const [kind, inclusive, counts] of [['abhaReview', true, true], ['indicatorRefusal', false, false]]) {
      const spec = fresh(kind, 1, inclusive);
      d1.db.prepare("INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) VALUES (?,?,?,?,'used',?)").run(spec.orgId, spec.actorId, kind, 'old', ago(L.LIMIT_WINDOW_MS));
      assert.equal(await L.reserveSlot(d1, spec, now) === null, counts, kind);
    }
    const spec = fresh('abhaReview', 1);
    d1.db.prepare("INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) VALUES (?,?,?,?,'used',?)").run(spec.orgId, spec.actorId, spec.kind, 'older', ago(L.LIMIT_WINDOW_MS + 1));
    assert.ok(await L.reserveSlot(d1, spec, now), 'one millisecond older no longer counts');
    assert.ok(!rows(spec).some(r => r.slot_key === 'older'), 'and is removed by the next reservation');
  });
  await check('an abandoned reservation stops counting after PENDING_MS and is removed', async () => {
    const spec = fresh('abhaReview', 1);
    d1.db.prepare("INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) VALUES (?,?,?,?,'pending',?)").run(spec.orgId, spec.actorId, spec.kind, 'pending:young', ago(L.PENDING_MS - 1000));
    assert.equal(await L.reserveSlot(d1, spec, now), null, 'a reservation in progress counts');
    d1.db.prepare("UPDATE limit_slots SET at=? WHERE org_id=?").run(ago(L.PENDING_MS + 1), spec.orgId);
    assert.ok(await L.reserveSlot(d1, spec, now)); assert.ok(!rows(spec).some(r => r.slot_key === 'pending:young'));
  });
  await check('a holder reviewed more than a day ago is reviewed again', async () => {
    const spec = fresh();
    d1.db.prepare("INSERT INTO limit_slots (org_id,actor_id,kind,slot_key,state,at) VALUES (?,?,?,?,'used',?)").run(spec.orgId, spec.actorId, spec.kind, 'holder-old', ago(L.LIMIT_WINDOW_MS + 60000));
    const log = []; await abhaRequest(spec, 'holder-old', log);
    assert.deepEqual(log, ['review:holder-old']); assert.equal(rows(spec).find(r => r.slot_key === 'holder-old').at >= now, true);
  });
  await check('a failed write when counting keeps the reservation counted; a request that fails gives it back', async () => {
    const spec = fresh('abhaReview', 1);
    d1.failNext = sql => /^UPDATE OR IGNORE limit_slots/.test(sql);
    await assert.rejects(L.withLimitSlot(d1, spec, async slot => { await slot.use('h'); }, () => { throw new Error('throttled'); }), /injected D1 failure/);
    d1.failNext = null;
    assert.equal(count(spec, 'pending'), 1, 'not given back'); assert.equal(await L.reserveSlot(d1, spec, now), null);
    const other = fresh('abhaReview', 1);
    await assert.rejects(L.withLimitSlot(d1, other, async () => { throw new Error('request failed'); }, () => { throw new Error('throttled'); }), /request failed/);
    assert.equal(rows(other).length, 0, 'given back');
  });
  await check('counting twice in one request counts once', async () => {
    const spec = fresh('indicatorRefusal', 20, false);
    await L.withLimitSlot(d1, spec, async slot => { assert.equal(await slot.use(), true); assert.equal(await slot.use(), true); }, () => { throw new Error('throttled'); });
    assert.equal(count(spec, 'used'), 1); assert.equal(count(spec, 'pending'), 0);
  });

  // 5. Plans.
  await check('the guard, the clean-up and the use statement read the primary key, not the whole table', () => {
    const plan = q => d1.db.prepare('EXPLAIN QUERY PLAN ' + q).all().map(r => r.detail);
    const qs = [L.RESERVE_SQL, `SELECT count(*) FROM limit_slots WHERE ${L.COUNTED}`, "DELETE FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? AND ((state='used' AND at<?) OR (state='pending' AND at<?))", "UPDATE OR IGNORE limit_slots SET slot_key=?,state='used',at=? WHERE org_id=? AND actor_id=? AND kind=? AND slot_key=? AND state='pending'"];
    for (const q of qs) { const p = plan(q).filter(d => /limit_slots/.test(d)); assert.ok(p.length && p.every(d => /USING (COVERING )?INDEX sqlite_autoindex_limit_slots_1|USING PRIMARY KEY/.test(d)), q + ' ' + JSON.stringify(p)); }
  });

  // 6. The routes.
  await check('source: abhaLink reserves before the duplicate lookup and records a review only for a newly counted holder', () => {
    const src = readFileSync('lib/saha/server.ts', 'utf8'), fn = src.slice(src.indexOf('async function abdmWithStewardReview'), src.indexOf('async function dispatchCommand'));
    assert.match(src, /const ABHA_REVIEW_SLOTS=\{kind:'abhaReview',limit:ABHA_REVIEW_LIMIT,inclusive:true\}/);
    assert.ok(fn.indexOf('withLimitSlot(') < fn.indexOf('try{return applyAbdm(state,c,u,m);}'), 'the reservation comes before the lookup');
    assert.match(fn, /review=await slot\.use\(e\.heldBy\)/); assert.match(fn, /if\(review\)try\{await recordAccesses/);
    assert.doesNotMatch(fn, /FROM audit_events/, 'the throttle no longer counts audit events');
  });
  await check('source: an indicator query reserves before it is run and counts every refusal before recording it', () => {
    const src = readFileSync('lib/saha/indicators-server.ts', 'utf8');
    assert.match(src, /REFUSAL_SLOTS=\{kind:'indicatorRefusal',limit:REFUSALS_PER_DAY,inclusive:false\}/);
    assert.ok(src.indexOf('return withLimitSlot(db(),{orgId:s.organisation.id,actorId:u.userId,...REFUSAL_SLOTS}') < src.indexOf('try{run=indicatorRun(s,m,q);}'));
    const records = src.split('recordAggregateView(db(),').slice(1).filter(x => x.includes('REFUSAL_SUBJECT')).length, counted = (src.match(/await counted\(\);await recordAggregateView\(db\(\),(s|state),u,m,REFUSAL_SUBJECT/g) ?? []).length;
    assert.equal(records, 3); assert.equal(counted, 3, 'whole refusal, cohort refusal and partial withhold are each counted first');
    assert.doesNotMatch(src, /FROM audit_events/, 'the limit no longer counts audit events');
  });
} finally { rmSync(dir, { recursive: true, force: true }); }
const r = { passed, suite: 'limit-slots-contract', completedAt: new Date().toISOString() };
writeFileSync('tests/limit-slots-contract-result.json', JSON.stringify(r, null, 2) + '\n');
console.log(JSON.stringify(r));
