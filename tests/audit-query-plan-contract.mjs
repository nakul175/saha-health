// Slice 13e (round-11 O-4): a workspace load slowed down as the organisation's audit log grew (1,000 loads took 21.5 s, then
// 37.4 s after 8,000 loads). Each load reads the organisation's newest audit events, and several routes count one person's
// recent events of one kind (rate limits and repeat-read windows). The only indexes were (org_id, person_id, at) and
// (org_id, seq), so the newest-events read sorted the whole log on every load and the counts scanned it.
// Migration 0017 adds (org_id, at) and (org_id, actor_id, action, at). Checked on the real migrations in SQLite:
// 1. each query below appears in the source as written here;
// 2. its plan uses an index on audit_events and never sorts the whole log for the newest-events read;
// 3. the newest-events read and a rate-limit count take about as long at 40,000 events as at 5,000 (recorded; asserted loosely).
// SQLite's planner is the one D1 uses, but hosted D1 timing was not measured.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

let passed = 0;
const check = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const db = new DatabaseSync(':memory:');
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
for (const f of migrations) for (const s of readFileSync('drizzle/' + f, 'utf8').split('--> statement-breakpoint')) if (s.trim()) db.exec(s);
db.exec('PRAGMA foreign_keys=OFF'); // synthetic events for one organisation, without the rest of its records

// [source file, the query as written there (or a part that identifies it), the query planned here]
const QUERIES = {
  newestEvents: ['lib/saha/store.ts', "' ORDER BY at DESC LIMIT 250'", "SELECT * FROM audit_events WHERE org_id=? ORDER BY at DESC LIMIT 250", ['org']],
  activityPage: ['lib/saha/store.ts', 'ORDER BY a.at DESC,a.id DESC LIMIT 101', "SELECT a.* FROM audit_events a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=? AND m.status='active' WHERE a.org_id=? AND a.person_id IS NULL ORDER BY a.at DESC,a.id DESC LIMIT 101", ['u1', 'org']],
  repeatReadWindow: ['lib/saha/access-audit.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND at>=? AND person_id IN", "SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND at>=? AND person_id IN (?,?,?)", ['org', 'u1', 'S', 'p1', 'p2', 'p3']],
  searchLimit: ['lib/saha/identifier-search-server.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action IN ('identifierSearch','identifierSearchMiss') AND at>=?", "SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action IN ('identifierSearch','identifierSearchMiss') AND at>=?", ['org', 'u1', 'S']],
  missLimit: ['lib/saha/identifier-search-server.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierSearchMiss' AND at>=?", "SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierSearchMiss' AND at>=?", ['org', 'u1', 'S']],
  abhaReviews: ['lib/saha/server.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action='abhaLinkReview' AND at>=?", "SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='abhaLinkReview' AND at>=?", ['org', 'u1', 'S']],
  conflictReviews: ['lib/saha/crosswalk-server.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierConflictReview' AND at>=?", "SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierConflictReview' AND at>=?", ['org', 'u1', 'S']],
  aggregateViews: ['lib/saha/indicators-server.ts', "FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND at>?", "SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND at>? AND (subject=? OR (subject='indicator results' AND detail NOT LIKE '%released, 0 withheld%'))", ['org', 'u1', 'S', 'x']],
  retentionDue: ['lib/saha/retention-server.ts', "FROM audit_events WHERE org_id=? AND at<?", "SELECT count(*) AS n FROM audit_events WHERE org_id=? AND at<?", ['org', 'S']],
};
const plan = q => db.prepare('EXPLAIN QUERY PLAN ' + q).all().map(r => r.detail);

check('migration 0017 adds the two indexes', () => {
  assert.ok(migrations.includes('0017_audit_time_indexes.sql'));
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit_events'").all().map(r => r.name);
  for (const n of ['audit_org_time', 'audit_org_actor_action_time']) assert.ok(names.includes(n), n);
});
for (const [name, [file, inSource, q]] of Object.entries(QUERIES)) check(`${name}: the query is in ${file} and uses an index`, () => {
  assert.ok(readFileSync(file, 'utf8').includes(inSource.replace(/^'|'$/g, '')), 'query text not found in source');
  const p = plan(q), audit = p.filter(d => /audit_events| a /.test(d) || /\ba\b USING/.test(d));
  assert.ok(audit.length && audit.every(d => /USING (COVERING )?INDEX audit_org_(time|actor_action_time|person_time|seq)/.test(d)), JSON.stringify(p));
  assert.ok(!p.some(d => d === 'USE TEMP B-TREE FOR ORDER BY'), 'sorts the whole log: ' + JSON.stringify(p));
});
check('the newest-events read and the search limit use the new indexes', () => {
  assert.ok(plan(QUERIES.newestEvents[2]).some(d => d.includes('INDEX audit_org_time')));
  assert.ok(plan(QUERIES.searchLimit[2]).some(d => d.includes('INDEX audit_org_actor_action_time')));
  assert.ok(plan(QUERIES.abhaReviews[2]).some(d => d.includes('INDEX audit_org_actor_action_time')));
});

// 3. Cost against log size.
const cols = db.prepare('PRAGMA table_info(audit_events)').all().map(c => c.name);
const ins = db.prepare(`INSERT INTO audit_events (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`), t0 = Date.parse('2026-08-01T00:00:00Z');
let n = 0;
const grow = to => { db.exec('BEGIN'); for (; n < to; n++) { const v = { org_id: 'org', id: 'e' + n, person_id: n % 3 ? 'p' + (n % 500) : null, actor_id: 'u' + (n % 8), actor_name: 'Synthetic', role: 'asha', action: ['viewWorkspace', 'viewPatientRecord', 'identifierSearch', 'saveVisit'][n % 4], subject: 's', detail: 'Synthetic event', at: new Date(t0 + n * 60000).toISOString(), seq: n, prev_hash: 'h', hash: 'h' + n }; ins.run(...cols.map(c => v[c] ?? null)); } db.exec('COMMIT'); };
const since = () => new Date(t0 + (n - 1440) * 60000).toISOString();
const time = ([, , q, args]) => { const s = db.prepare(q), a = args.map(x => x === 'S' ? since() : x); s.all(...a); const st = performance.now(); for (let i = 0; i < 40; i++) s.all(...a); return (performance.now() - st) / 40; };
grow(5000); const small = { newest: time(QUERIES.newestEvents), search: time(QUERIES.searchLimit) };
grow(40000); const large = { newest: time(QUERIES.newestEvents), search: time(QUERIES.searchLimit) };
const ratio = { newest: +(large.newest / small.newest).toFixed(2), search: +(large.search / small.search).toFixed(2) };
check('eight times the events: the per-load read and the count cost about the same', () => {
  assert.ok(ratio.newest < 3, JSON.stringify({ small, large }));
  assert.ok(large.search < 2, `the search limit count took ${large.search.toFixed(2)} ms at 40,000 events`);
});

const r = { passed, suite: 'audit-query-plan-contract', ms: { at5000: small, at40000: large }, ratio, completedAt: new Date().toISOString() };
writeFileSync('tests/audit-query-plan-contract-result.json', JSON.stringify(r, null, 2) + '\n');
console.log(JSON.stringify({ passed, suite: 'audit-query-plan-contract', ratio }));
