// Separate deterministic synthetic causal control. Never reconstructs the absent
// private before/after basis of the historical original load failure.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { connect } from 'node:net';
import { startMiniflare } from '../lib/miniflare.mjs';
import { identity, client } from '../lib/worker.mjs';
import { reportSourceRefusal } from '../lib/report-source-refusal.mjs';

const folder = resolve(process.env.SAHA_REPORT_DRIFT_EVIDENCE ?? 'tests/reports/report-source-drift-new-control');
const state = resolve(process.env.SAHA_REPORT_DRIFT_STATE ?? '.wrangler/report-source-drift-new-control');
assert.equal(process.env.SAHA_NFR_FIXTURE_RELEASE, 'ui-measurements-disposed-and-reviewed', 'No Worker before independent fixture review and UI timing disposal');
assert.ok(!existsSync(folder) && !existsSync(state), 'Use NEW evidence and owned D1 state; no previous fixture is erased');
mkdirSync(folder, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFileSync(join(folder, name), JSON.stringify(value, null, 2) + '\n');
save('SOURCE-PINS.json', Object.fromEntries(['lib/saha/operations-server.ts', 'lib/saha/access-audit.ts', 'lib/saha/store.ts',
  'tests/lib/report-source-refusal.mjs', 'tests/integration/report-source-drift-native.mjs'].map(path => [path, hash(readFileSync(path))])));
const port = process.env.SAHA_TEST_PORT ?? '21423';
const worker = await startMiniflare({ port, name: 'nfr-report-source-drift', state, bindings: { SAHA_ENVIRONMENT: 'synthetic' } });
let passed = 0, error = null, database = null;
const check = fn => { fn(); passed++; };
try {
  const api = client(worker.base), who = identity('source-drift-owner'), initial = await api.get(who, '/api/workspace');
  assert.equal(initial.status, 200, initial.text);
  const org = initial.json.organisation.id, personId = initial.json.people[0].id;
  database = await worker.mf.getD1Database('DB');
  const row = () => database.prepare('SELECT id,version,data FROM patients WHERE org_id=? AND id=?').bind(org, personId).first();
  const rows = table => database.prepare(`SELECT * FROM ${table} WHERE org_id=? ORDER BY rowid`).bind(org).all().then(x => x.results);
  const stable = await api.get(who, '/api/operations', org);
  check(() => { assert.equal(stable.status, 200, stable.text); assert.equal(stable.headers.get('cache-control'), 'no-store'); });
  const before = { patient: await row(), memberships: await rows('memberships'), visits: await rows('visits'), receipts: await rows('command_receipts'), audit: await rows('audit_events') };
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  await database.prepare('CREATE TABLE saha_nfr_drift_fixture (n INTEGER NOT NULL)').run();
  await database.prepare('INSERT INTO saha_nfr_drift_fixture(n) VALUES (0)').run();
  // This one-shot fixture trigger changes an actual current source version only
  // after the exact aggregate access event, before the unchanged final guard.
  // It is local test state, never an applied migration or production trigger.
  await database.prepare(`CREATE TRIGGER saha_nfr_one_source_drift AFTER INSERT ON audit_events
    WHEN NEW.org_id=${quote(org)} AND NEW.action='viewAggregate' AND NEW.subject='operations and care report'
      AND (SELECT n FROM saha_nfr_drift_fixture)=0
    BEGIN
      UPDATE patients SET data=json_set(data,'$.version',version+1),version=version+1
        WHERE org_id=NEW.org_id AND id=${quote(personId)};
      UPDATE saha_nfr_drift_fixture SET n=n+1;
    END`).run();
  const refused = await api.get(who, '/api/operations', org), after = await row();
  save('ACTUAL-CAUSAL-RESPONSE.json', { status: refused.status, text: refused.text, bodySha256: hash(refused.text),
    cacheControl: refused.headers.get('cache-control'), before, actualPatientAfter: after,
    exactFixtureCount: await database.prepare('SELECT n FROM saha_nfr_drift_fixture').first() });
  check(() => { assert.equal(refused.status, 409, refused.text); assert.equal(reportSourceRefusal(refused, '/api/operations'), true); });
  check(() => {
    assert.equal(after.version, before.patient.version + 1); assert.equal(JSON.parse(after.data).version, after.version);
    const a = JSON.parse(after.data), b = JSON.parse(before.patient.data); delete a.version; delete b.version; assert.deepEqual(a, b);
  });
  check(() => { assert.deepEqual(Object.keys(refused.json), ['error']); assert.equal(refused.json.report, undefined); });
  check(() => { for (const marker of [org, personId, ...initial.json.people.map(p => p.name)]) assert.ok(!refused.text.includes(marker)); });
  const fresh = await api.get(who, '/api/operations', org), count = await database.prepare('SELECT n FROM saha_nfr_drift_fixture').first();
  check(() => { assert.equal(fresh.status, 200, fresh.text); assert.equal(fresh.headers.get('cache-control'), 'no-store'); assert.equal(count.n, 1); });
  check(() => assert.equal(reportSourceRefusal(fresh, '/api/operations'), false));
  const final = { memberships: await rows('memberships'), visits: await rows('visits'), receipts: await rows('command_receipts'), audit: await rows('audit_events') };
  check(() => { assert.deepEqual(final.memberships, before.memberships); assert.deepEqual(final.visits, before.visits); assert.deepEqual(final.receipts, before.receipts); });
  check(() => { assert.ok(final.audit.length > before.audit.length); assert.deepEqual(final.audit.slice(0,before.audit.length),before.audit); });
  const chain = await api.get(who, '/api/audit/chain', org);
  check(() => { assert.equal(chain.status, 200, chain.text); assert.equal(chain.json.status, 'intact'); });
  save('RESULT.json', { passed, failed: 0, actualNativeD1: true, actualBuiltHttp: true, exactSyntheticSourceVersionChange: true,
    stableBeforeStatus: stable.status, refusedAfterOneSourceDriftStatus: refused.status, freshStableAfterStatus: fresh.status,
    clinicalHistoryAndReceiptsUntouched: true, immutableAuditPrefixRetained: true, chainStatus: chain.json.status,
    limits: ['Separate deterministic synthetic causal control, not the missing historical original load basis.',
      'The local one-shot schema trigger changes current patient version;33 applied migrations and all application sources stay unchanged.',
      'No physical/R1/finalheadCI or full bounded-burst liveness qualification.'] });
} catch (failure) {
  error = String(failure); save('RESULT.json', { passed, failed: 1, error, actualNativeD1: true }); throw failure;
} finally {
  const cleanup = { trigger: 'saha_nfr_one_source_drift', attempted: database !== null, dropped: false, error: null };
  if (database) {
    try { await database.prepare('DROP TRIGGER IF EXISTS saha_nfr_one_source_drift').run(); cleanup.dropped = true; }
    catch (failure) { cleanup.error = String(failure); }
  }
  let stopError = null;
  try { await worker.stop(); } catch (failure) { stopError = String(failure); }
  const ownedPortObservedFree = await new Promise(resolve => {
    const socket = connect(Number(port), '127.0.0.1'), timer = setTimeout(() => { socket.destroy(); resolve(null); },1500);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(false); });
    socket.once('error', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
  });
  save('DISPOSAL-ATTEMPT.json', { ownedWorkerStopCompleted: stopError === null, stopError, ownedPortObservedFree, port,
    originalFailure: error, ownedTriggerCleanup: cleanup, historicalRowsDeleted: false });
  // Preserve the original assertion/HTTP failure. Cleanup still records its own
  // failure and fails a previously successful control; it never replaces the
  // original exception or deletes audit, receipt or clinical history.
  if (!error && (cleanup.error || stopError || ownedPortObservedFree !== true)) {
    const cleanupFailure = `Owned causal-control cleanup failed: ${JSON.stringify({cleanup,stopError,ownedPortObservedFree})}`;
    save('RESULT.json', { passed, failed: 1, error: cleanupFailure, actualNativeD1: true, originalChecksFinished: true });
    throw new Error(cleanupFailure);
  }
}
