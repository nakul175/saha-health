// BR-ID-02 / BR-SEC-08: synthetic final-disclosure checkpoint, real applied SQLite migrations.
// This additive contract does not replace native HTTP, old drivers, or formal acceptance.
// Database mutations occur after a captured active member, immediately before the one read batch.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.routine-read-guard-contract-'));
const started = performance.now(), cases = [], fixtures = [];
let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; cases.push({ name, passed: true }); }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
};
const convertIntegers = rows => rows.map(row => Object.fromEntries(Object.entries(row)
  .map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])));
const readRows = (db, sql, ...values) => {
  const statement = db.prepare(sql); statement.setReadBigInts(true);
  return convertIntegers(statement.all(...values));
};
const snapshot = db => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all().map(({ name }) => [name, readRows(db, `SELECT * FROM "${name}"`)]));

class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  exec() {
    assert.match(this.sql, /^\s*SELECT\b/i, 'The disclosure guard must only read.');
    return { results: readRows(this.database.db, this.sql, ...this.values), meta: { changes: 0 } };
  }
  first() { throw new Error('Unexpected separate first() read outside the final batch.'); }
  all() { throw new Error('Unexpected separate all() read outside the final batch.'); }
  run() { throw new Error('Unexpected mutation outside the final batch.'); }
}
class D1 {
  constructor(db) { this.db = db; this.calls = 0; this.beforeBatch = null; this.beforeRead = null; this.returned = null; this.queries = []; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    this.calls++;
    await Promise.resolve();
    if (this.beforeBatch) this.beforeBatch();
    this.beforeRead = snapshot(this.db);
    this.queries = statements.map(statement => statement.sql);
    this.db.exec('BEGIN');
    try { const rows = statements.map(statement => statement.exec()); this.db.exec('COMMIT'); this.returned = rows; return rows; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
const at = '2026-10-11T00:00:00.000Z', privateSentinel = 'SYNTHETIC_PRIVATE_NAME_OR_FACT';
const scope = (overrides = {}) => ({ enforceFacility: false, enforceLocality: false,
  facilities: [{ id: 'f-a', localityId: 'l-a' }, { id: 'f-b', localityId: 'l-b' }],
  teamAssignments: {}, memberAssignments: {}, ...overrides });
const grant = (programme = null, overrides = {}) => ({ id: 'g-current', memberId: 'asha', programme,
  purposes: ['reporting'], version: 1, setBy: 'other', setAt: at, reason: 'Synthetic policy fixture.', ...overrides });

try {
  for (const file of readdirSync('lib/saha').filter(file => file.endsWith('.ts'))) {
    const code = ts.transpileModule(readFileSync(join('lib/saha', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), code);
  }
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const { assertAssignedRead } = await import(pathToFileURL(join(dir, 'routine-read-guard.js')));
  const migrations = readdirSync('drizzle').filter(file => /^\d{4}_.*\.sql$/.test(file)).sort();
  const fixture = () => {
    const db = new DatabaseSync(':memory:'); fixtures.push(db);
    for (const file of migrations) for (const sql of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint'))
      if (sql.trim()) db.exec(sql);
    db.exec('PRAGMA foreign_keys=ON');
    for (const id of ['asha', 'other']) db.prepare('INSERT INTO accounts(user_id,account_code,display_name,email,created_at) VALUES(?,?,?,?,?)')
      .run(id, `CODE-${id}`, privateSentinel, `${id}@example.invalid`, at);
    for (const org of ['org-a', 'org-b']) {
      db.prepare('INSERT INTO organisations(id,name,revision,last_command,created_at,patient_revision) VALUES(?,?,?,?,?,?)')
        .run(org, privateSentinel, 7, 'synthetic fixture', at, 9);
      db.prepare('INSERT INTO memberships(org_id,user_id,role,is_owner,status,version,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(org, 'asha', 'asha', 0, 'active', 1, at);
      for (const team of ['care', 'outside']) db.prepare('INSERT INTO teams(org_id,id,name,created_at) VALUES(?,?,?,?)')
        .run(org, team, `${org}-${team}`, at);
      db.prepare('INSERT INTO team_members(org_id,team_id,user_id) VALUES(?,?,?)').run(org, 'care', 'asha');
    }
    const addPatient = (id, team, assigned, programmes, org = 'org-a') => db.prepare('INSERT INTO patients(org_id,id,version,name,team_id,assigned_to,data,rev) VALUES(?,?,?,?,?,?,?,?)')
      .run(org, id, 4, privateSentinel, team, assigned, JSON.stringify({ id, name: privateSentinel, programmes, facilityId: 'f-a', observations: privateSentinel }), 3);
    addPatient('p-a', 'care', 'asha', ['Maternal care']); addPatient('p-b', 'care', 'asha', ['Chronic care']);
    addPatient('p-hidden', 'care', 'other', ['Maternal care']); addPatient('p-outside', 'outside', 'asha', ['Maternal care']);
    addPatient('p-b-only', 'care', 'asha', ['Maternal care'], 'org-b');
    for (const [org, id, person] of [['org-a', 'v-a', 'p-a'], ['org-a', 'v-b', 'p-b'], ['org-b', 'v-b-only', 'p-b-only']])
      db.prepare('INSERT INTO visits(org_id,id,person_id,version,record_version,state,data) VALUES(?,?,?,?,?,?,?)')
        .run(org, id, person, 7, 5, 'draft', JSON.stringify({ id, personId: person, version: 7, state: 'draft', facts: privateSentinel, notes: privateSentinel }));
    db.prepare('INSERT INTO operations(org_id,data) VALUES(?,?)').run('org-a', JSON.stringify({ version: 4, unrelatedPrivateFacts: privateSentinel }));
    // Retained legacy immutable evidence and a saved receipt make a read-side-effect check substantive.
    db.prepare('INSERT INTO audit_events(org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run('org-a', 'prior-audit', 'p-a', 'asha', privateSentinel, 'asha', 'syntheticFixture', 'p-a', 'Synthetic prior evidence.', at);
    db.prepare('INSERT INTO command_receipts(actor_id,key,org_id,hash,result,person_id,created_at) VALUES(?,?,?,?,?,?,?)')
      .run('asha', 'prior-key', 'org-a', 'synthetic-hash', '{"visitId":"v-a"}', 'p-a', at);
    db.prepare('INSERT INTO record_revisions(id,org_id,person_id,entity_type,entity_id,version,actor_id,actor_name,action,reason,data,changes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('prior-revision', 'org-a', 'p-a', 'visit', 'v-a', 5, 'asha', privateSentinel, 'syntheticFixture', 'Synthetic prior revision.', '{}', '[]', at);
    const actor = { userId: 'asha', accountCode: 'CODE-asha', displayName: privateSentinel,
      role: 'asha', isOwner: false, status: 'active', version: 1, teamIds: ['care'], createdAt: at };
    const d1 = new D1(db);
    const setPolicy = value => db.prepare('UPDATE operations SET data=? WHERE org_id=?').run(JSON.stringify(value), 'org-a');
    const patient = (id, change) => {
      const row = db.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get('org-a', id);
      db.prepare('UPDATE patients SET data=? WHERE org_id=? AND id=?').run(JSON.stringify({ ...JSON.parse(row.data), ...change }), 'org-a', id);
    };
    const visitData = change => {
      const row = db.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get('org-a', 'v-a');
      db.prepare('UPDATE visits SET data=? WHERE org_id=? AND id=?').run(JSON.stringify({ ...JSON.parse(row.data), ...change }), 'org-a', 'v-a');
    };
    const run = async (selection = { personId: 'p-a' }, visit, status, beforeBatch) => {
      d1.calls = 0; d1.beforeBatch = beforeBatch ?? null; d1.returned = null;
      const capturedActor = structuredClone(actor);
      if (status !== undefined) await assert.rejects(() => assertAssignedRead(d1, actor, 'org-a', selection, visit), error => error.status === status);
      else await assertAssignedRead(d1, actor, 'org-a', selection, visit);
      assert.equal(d1.calls, 1, 'One consistent final read batch, without a later hydrated read.');
      assert.deepEqual(actor, capturedActor, 'The captured member must not be mutated.');
      assert.deepEqual(snapshot(db), d1.beforeRead, 'Disclosure checkpoint must preserve every migrated table, revision, receipt and audit.');
      assert.equal(JSON.stringify(d1.returned).includes(privateSentinel), false, 'Final scope rows must not disclose names or clinical facts.');
      return d1;
    };
    return { db, d1, actor, run, setPolicy, patient, visitData };
  };

  await check('active captured membership: exact person, unsorted exact Today ids, draft and version witness remain allowed', async () => {
    const f = fixture(); await f.run(); await f.run({ ids: ['p-b', 'p-a'] });
    await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', currentDraft: true, minimumVersion: 7 });
  });
  await check('membership revoked immediately before final batch refuses captured active member', async () => {
    const f = fixture(); await f.run(undefined, undefined, 403, () => f.db.prepare("UPDATE memberships SET status='suspended',version=2 WHERE org_id='org-a' AND user_id='asha'").run());
  });
  await check('membership removed immediately before final batch refuses captured active member', async () => {
    const f = fixture(); await f.run(undefined, undefined, 403, () => f.db.prepare("DELETE FROM memberships WHERE org_id='org-a' AND user_id='asha'").run());
  });
  await check('late role change to clinician/admin/provider refuses even with current owner flag', async () => {
    for (const role of ['clinician', 'admin', 'provider']) { const f = fixture(); await f.run(undefined, undefined, 403, () =>
      f.db.prepare("UPDATE memberships SET role=?,is_owner=1,version=2 WHERE org_id='org-a' AND user_id='asha'").run(role)); }
  });
  await check('current ASHA owner has assigned scope only and no unassigned-person bypass', async () => {
    const f = fixture(); f.db.prepare("UPDATE memberships SET is_owner=1,version=2 WHERE org_id='org-a' AND user_id='asha'").run();
    await f.run(); await f.run({ personId: 'p-hidden' }, undefined, 404); await f.run({ ids: ['p-a', 'p-b', 'p-hidden'] }, undefined, 409);
  });
  await check('new valid membership version keeps authority; account home change cannot change pinned organisation', async () => {
    const f = fixture(); await f.run(undefined, undefined, undefined, () => {
      f.db.prepare("UPDATE memberships SET version=8 WHERE org_id='org-a' AND user_id='asha'").run();
      f.db.prepare("UPDATE accounts SET active_org_id='org-b' WHERE user_id='asha'").run();
    });
  });
  await check('current team removal refuses despite captured old team ids', async () => {
    const f = fixture(); await f.run(undefined, undefined, 404, () => f.db.prepare("DELETE FROM team_members WHERE org_id='org-a' AND user_id='asha'").run());
  });
  await check('late patient assignment removal or reassignment refuses current person', async () => {
    for (const assigned of [null, 'other']) { const f = fixture(); await f.run(undefined, undefined, 404, () =>
      f.db.prepare("UPDATE patients SET assigned_to=? WHERE org_id='org-a' AND id='p-a'").run(assigned)); }
  });
  await check('late patient team change refuses current person', async () => {
    const f = fixture(); await f.run(undefined, undefined, 404, () => f.db.prepare("UPDATE patients SET team_id='outside' WHERE org_id='org-a' AND id='p-a'").run());
  });
  await check('same-count Today substitution refuses exact old ids', async () => {
    const f = fixture(); await f.run({ ids: ['p-a', 'p-b'] }, undefined, 409, () => {
      f.db.prepare("UPDATE patients SET assigned_to='other' WHERE org_id='org-a' AND id='p-a'").run();
      f.db.prepare("UPDATE patients SET assigned_to='asha' WHERE org_id='org-a' AND id='p-hidden'").run();
      assert.equal(f.db.prepare("SELECT count(*) AS n FROM patients WHERE org_id='org-a' AND assigned_to='asha' AND team_id='care'").get().n, 2);
    });
  });
  await check('newly readable row, disappearing row and duplicate expected id each refuse Today', async () => {
    const added = fixture(); await added.run({ ids: ['p-a', 'p-b'] }, undefined, 409, () => added.db.prepare("UPDATE patients SET assigned_to='asha' WHERE org_id='org-a' AND id='p-hidden'").run());
    const removed = fixture(); await removed.run({ ids: ['p-a', 'p-b'] }, undefined, 409, () => removed.db.prepare("UPDATE patients SET assigned_to=NULL WHERE org_id='org-a' AND id='p-b'").run());
    const duplicate = fixture(); await duplicate.run({ ids: ['p-a', 'p-a'] }, undefined, 409);
  });
  await check('merged person is unavailable; missing organisation and cross-tenant person do not resolve elsewhere', async () => {
    const merged = fixture(); merged.patient('p-a', { mergedInto: 'p-b' }); await merged.run(undefined, undefined, 404);
    const absent = fixture(); await absent.run({ personId: 'p-b-only' }, undefined, 404);
    const f = fixture(); const before = snapshot(f.db);
    await assert.rejects(() => assertAssignedRead(f.d1, f.actor, 'missing-org', { personId: 'p-a' }), error => error.status === 404);
    assert.equal(f.d1.calls, 1); assert.deepEqual(snapshot(f.db), before);
  });
  await check('new programme restriction and programme removed before batch refuse current person', async () => {
    const restricted = fixture(); await restricted.run(undefined, undefined, 404, () => restricted.setPolicy({ purposeGrants: [grant('Chronic care')] }));
    const removed = fixture(); removed.setPolicy({ purposeGrants: [grant('Maternal care')] });
    await removed.run(undefined, undefined, 404, () => removed.patient('p-a', { programmes: ['Chronic care'] }));
  });
  await check('matching programme grant and purpose-only grant preserve ordinary read access', async () => {
    const programme = fixture(); programme.setPolicy({ purposeGrants: [grant('Maternal care')] }); await programme.run();
    const purpose = fixture(); purpose.setPolicy({ purposeGrants: [grant(null)] }); await purpose.run(); await purpose.run({ ids: ['p-a', 'p-b'] });
  });
  await check('revoked grant history does not narrow reads; appended current replacement still narrows', async () => {
    const old = grant('Chronic care', { id: 'g-old', revokedAt: at }); const f = fixture(); f.setPolicy({ purposeGrants: [old] }); await f.run();
    f.setPolicy({ purposeGrants: [old, grant('Chronic care')] }); await f.run(undefined, undefined, 404); await f.run({ personId: 'p-b' });
  });
  await check('late facility scope loss refuses matching captured record', async () => {
    const f = fixture(); f.setPolicy({ accessScope: scope({ enforceFacility: true, memberAssignments: { asha: { facilityId: 'f-a' } } }) }); await f.run();
    await f.run(undefined, undefined, 404, () => f.setPolicy({ accessScope: scope({ enforceFacility: true, memberAssignments: { asha: { facilityId: 'f-b' } } }) }));
  });
  await check('facility scope through current team permits; removed team assignment denies even owner', async () => {
    const f = fixture(); f.setPolicy({ accessScope: scope({ enforceFacility: true, teamAssignments: { care: { facilityId: 'f-a' } } }) }); await f.run();
    await f.run(undefined, undefined, 404, () => { f.setPolicy({ accessScope: scope({ enforceFacility: true }) }); f.db.prepare("UPDATE memberships SET is_owner=1 WHERE org_id='org-a' AND user_id='asha'").run(); });
  });
  await check('locality derived from member facility and patient facility permits; changed facility locality denies', async () => {
    const f = fixture(); f.setPolicy({ accessScope: scope({ enforceLocality: true, memberAssignments: { asha: { facilityId: 'f-a' } } }) }); await f.run();
    await f.run(undefined, undefined, 404, () => f.patient('p-a', { facilityId: 'f-b' }));
  });
  await check('direct team locality and own member locality permit; explicit patient locality takes precedence', async () => {
    for (const assignment of ['team', 'member']) { const f = fixture(); f.patient('p-a', { localityId: 'l-a' });
      f.setPolicy({ accessScope: scope({ enforceLocality: true, ...(assignment === 'team' ? { teamAssignments: { care: { localityId: 'l-a' } } } : { memberAssignments: { asha: { localityId: 'l-a' } } }) }) });
      await f.run(); await f.run(undefined, undefined, 404, () => f.patient('p-a', { localityId: 'l-b' })); }
  });
  await check('enforced facility/locality without current assignment denies, both dimensions stay additive', async () => {
    for (const enabled of [{ enforceFacility: true }, { enforceLocality: true }]) { const f = fixture(); f.setPolicy({ accessScope: scope(enabled) }); await f.run(undefined, undefined, 404); }
    const f = fixture(); f.setPolicy({ accessScope: scope({ enforceFacility: true, enforceLocality: true, memberAssignments: { asha: { facilityId: 'f-a', localityId: 'l-b' } } }) });
    await f.run(); await f.run(undefined, undefined, 404, () => f.patient('p-a', { localityId: 'outside-locality' }));
  });
  await check('absent operations, empty object and null critical containers retain legitimate legacy behavior', async () => {
    const absent = fixture(); absent.db.prepare("DELETE FROM operations WHERE org_id='org-a'").run(); await absent.run();
    for (const value of [{}, { accessScope: null, purposeGrants: null }]) { const f = fixture(); f.setPolicy(value); await f.run(); }
  });
  await check('non-object operations roots fail closed503', async () => {
    for (const value of [null, [], 'broken', 7, false]) { const f = fixture(); f.setPolicy(value); await f.run(undefined, undefined, 503); }
  });
  await check('malformed critical facility policy containers and flags fail closed503', async () => {
    const values = [false, [], 'broken', {}, scope({ enforceFacility: 'false' }), scope({ facilities: {} }),
      scope({ teamAssignments: [] }), scope({ memberAssignments: null }), scope({ memberAssignments: { asha: { facilityId: 1 } } }),
      scope({ facilities: [{ id: 'f-a', localityId: 3 }] })];
    for (const value of values) { const f = fixture(); f.setPolicy({ accessScope: value }); await f.run(undefined, undefined, 503); }
  });
  await check('malformed purpose grant container, member, programme and revocation fields fail closed503', async () => {
    for (const value of [{}, 'broken', [null], [grant('Unknown programme')], [grant(null, { memberId: 3 })], [grant(null, { revokedAt: false })]]) {
      const f = fixture(); f.setPolicy({ purposeGrants: value }); await f.run(undefined, undefined, 503);
    }
  });
  await check('malformed patient programme scope fails closed503; missing/null/empty programme is a valid unrestricted legacy row', async () => {
    for (const value of [{}, 'Maternal care', 3, [null], ['Maternal care', 3]]) { const f = fixture(); f.patient('p-a', { programmes: value }); await f.run(undefined, undefined, 503); }
    for (const value of [null, []]) { const f = fixture(); f.patient('p-a', { programmes: value }); await f.run(); }
    const absent = fixture(); const row = JSON.parse(absent.db.prepare("SELECT data FROM patients WHERE org_id='org-a' AND id='p-a'").get().data); delete row.programmes;
    absent.db.prepare("UPDATE patients SET data=? WHERE org_id='org-a' AND id='p-a'").run(JSON.stringify(row)); await absent.run();
  });
  await check('indexed visit ownership beats contradictory JSON ownership and rejects native reassignment', async () => {
    const f = fixture(); f.visitData({ personId: 'p-b' }); await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a' });
    f.visitData({ personId: 'p-a' }); await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a' }, 404, () =>
      f.db.prepare("UPDATE visits SET person_id='p-b' WHERE org_id='org-a' AND id='v-a'").run());
  });
  await check('missing, cross-tenant, wrong selected person and Today visit selections refuse404', async () => {
    for (const visit of [{ id: 'missing', personId: 'p-a' }, { id: 'v-b-only', personId: 'p-a' }, { id: 'v-a', personId: 'p-b' }]) {
      const f = fixture(); await f.run({ personId: 'p-a' }, visit, 404);
    }
    const today = fixture(); await today.run({ ids: ['p-a', 'p-b'] }, { id: 'v-a', personId: 'p-a' }, 404);
  });
  await check('current draft state is indexed; late confirmed native state refuses even with draft JSON', async () => {
    const f = fixture(); await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', currentDraft: true }, 409, () =>
      f.db.prepare("UPDATE visits SET state='confirmed' WHERE org_id='org-a' AND id='v-a'").run());
    await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 7 });
  });
  await check('late voided or superseded draft metadata refuses409', async () => {
    for (const value of [{ voidedAt: at }, { supersededBy: 'v-new' }]) { const f = fixture(); await f.run({ personId: 'p-a' },
      { id: 'v-a', personId: 'p-a', currentDraft: true }, 409, () => f.visitData(value)); }
  });
  await check('version witness uses indexed version, not JSON; higher current safe version is allowed', async () => {
    const f = fixture(); f.visitData({ version: 100 }); await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 8 }, 409);
    f.db.prepare("UPDATE visits SET version=2147483650 WHERE org_id='org-a' AND id='v-a'").run();
    await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 2147483650 });
    await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 7 });
  });
  await check('zero, negative, fractional, nonfinite and unsafe requested witness refuse409', async () => {
    for (const minimumVersion of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) { const f = fixture();
      await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion }, 409); }
  });
  await check('native current zero or unsafe version cannot satisfy a valid witness', async () => {
    for (const version of [0, 9007199254740992n]) { const f = fixture(); f.db.prepare("UPDATE visits SET version=? WHERE org_id='org-a' AND id='v-a'").run(version);
      await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 1 }, 409); }
  });
  await check('scope or exact visit version changed immediately before refusal witness batch is observed', async () => {
    const membership = fixture(); await membership.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 7 }, 403,
      () => membership.db.prepare("UPDATE memberships SET status='suspended' WHERE org_id='org-a' AND user_id='asha'").run());
    const version = fixture(); await version.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', minimumVersion: 7 }, 409,
      () => version.db.prepare("UPDATE visits SET version=6 WHERE org_id='org-a' AND id='v-a'").run());
  });
  await check('positive and refused checkpoints preserve nonempty immutable evidence and minimal final projections', async () => {
    const f = fixture(); const before = snapshot(f.db); const d1 = await f.run({ personId: 'p-a' }, { id: 'v-a', personId: 'p-a', currentDraft: true, minimumVersion: 7 });
    assert.equal(d1.queries.length, 6); assert.equal(d1.returned[4].results.length, 1); assert.equal(d1.returned[5].results.length, 1);
    assert.deepEqual(snapshot(f.db), before); assert.equal(before.audit_events.length, 1); assert.equal(before.record_revisions.length, 1); assert.equal(before.command_receipts.length, 1);
    await f.run({ personId: 'p-hidden' }, undefined, 404); assert.deepEqual(snapshot(f.db), before);
  });
  const result = { passed, failed: 0, actualNodeSqlite: true, appliedMigrations: migrations.length,
    immediateBeforeBatchInterposition: true, allMigratedTableEquality: true, onlyOneScopeReadBatch: true,
    noNamesFactsInScopeRows: true, durationMs: Math.round(performance.now() - started), cases,
    scope: 'Additive final-batch unit contract with real applied SQLite migrations and D1-compatible batch adapter. Captured member plus native row/policy interposition. No HTTP/provider, post-snapshot revocation guarantee, acceptance or production qualification.' };
  writeFileSync('tests/routine-read-guard-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed, failed: 0, durationMs: result.durationMs }));
} finally { for (const db of fixtures) db.close(); rmSync(dir, { recursive: true, force: true }); }
