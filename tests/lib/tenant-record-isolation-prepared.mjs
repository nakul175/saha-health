// APL-763 preparation only. Importing this module starts no Worker and runs no tests.
// Execution requires an externally owned, isolated, synthetic loopback Worker and D1.
import nativeAssert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { identity } from './worker.mjs';
import { pngBytes } from './nfr-world.mjs';
import { createBoundedTenantTransport } from './tenant-record-transport.mjs';

const hash = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)).digest('hex');
const localOrigin = (base, assert = nativeAssert) => {
  const u = new URL(base);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname), 'Synthetic loopback only');
  assert.equal(u.protocol, 'http:');
  assert.equal(u.pathname, '/');
  assert.ok(!u.username && !u.password && !u.search && !u.hash);
  return u.origin;
};
const requireStatus = (r, status, assert) => { assert.equal(r.status, status, r.text); return r; };
const responseEvidence = r => ({ status: r.status, bodySha256: hash(r.text), ...(r.bytes ? { rawBytesSha256: hash(r.bytes), rawBytesBase64: Buffer.from(r.bytes).toString('base64') } : {}), body: r.text,
  headers: Object.fromEntries(['cache-control', 'content-type', 'content-disposition', 'x-saha-export-id', 'x-saha-content-sha256', 'x-saha-manifest-sha256'].map(k => [k, r.headers.get(k)])) });

/** Only this new helper/CLI opts into these counters; Node assertions are never mutated. */
export function createTenantAssertionLedger() {
  const records = [];
  let phase = 'setup', passed = 0, failed = 0;
  const assertions = Object.fromEntries(['ok', 'equal', 'notEqual', 'deepEqual'].map(method => [method, (...args) => {
    const label = args[method === 'ok' ? 1 : 2];
    try {
      nativeAssert[method](...args);
      passed++; records.push({ method, phase, outcome: 'passed', ...(label === undefined ? {} : { label: String(label) }) });
    } catch (error) {
      failed++; records.push({ method, phase, outcome: 'failed', ...(label === undefined ? {} : { label: String(label) }), error: String(error?.stack ?? error) });
      throw error;
    }
  }]));
  return { assertions, setPhase: value => { phase = value; },
    snapshot: () => ({ countKind: 'actual-assertion-calls', passed, failed, assertionCount: records.length, records }) };
}

/** Fixture construction is not an acceptance result. Every record is newly synthetic. */
export async function prepareTenantCollisionFixture({ base, db, syntheticOnly, onEvidence, onTransportEvidence, requestTimeoutMs = 15000, assertions = nativeAssert }) {
  const assert = assertions, must = (r, status) => requireStatus(r, status, assert);
  assert.equal(syntheticOnly, true, 'Caller must establish the owned synthetic runtime');
  const rawApi = createBoundedTenantTransport(localOrigin(base, assert), { timeoutMs: requestTimeoutMs, onEvidence: onTransportEvidence }), run = randomUUID().slice(0, 8);
  const owners = { A: identity('tenant-isolation-a', run), B: identity('tenant-isolation-b', run) };
  const orgs = {}, people = {}, visits = {}, media = {}, bytes = {};
  const markers = { A: `Canary-locality-A-${run}`, B: `Canary-locality-B-${run}` };
  const names = { A: `Synthetic-name-canary-A-${run}`, B: `Synthetic-name-canary-B-${run}` };
  const canaries = { A: [names.A, markers.A], B: [names.B, markers.B] };
  const setupEvidence = { run, orgs, people, visits, media, names, markers, canaries, responses: [] };
  const captureSetup = (r, step) => { setupEvidence.responses.push({ step, ...responseEvidence(r) }); onEvidence?.(setupEvidence); return r; };
  const api = {
    get: async (...args) => captureSetup(await rawApi.get(...args), args[1]),
    command: async (...args) => captureSetup(await rawApi.command(...args), args[1].type),
  };
  onEvidence?.(setupEvidence);
  for (const side of ['A', 'B']) {
    const home = must(await api.get(owners[side], '/api/workspace'), 200).json;
    orgs[side] = home.organisation.id;
    const r = must(await api.command(owners[side], {
      type: 'createPerson', name: names[side],
      age: side === 'A' ? 13 : 87, sex: 'Other', village: markers[side],
      programme: 'General care', teamId: 'default',
    }, orgs[side]), 200);
    people[side] = r.json.result.personId;
  }
  assert.notEqual(orgs.A, orgs.B);
  assert.notEqual(people.A, people.B);
  // The current D1 schema allows (org_id,id) collisions. Copy every actual column,
  // preserving the original B record, and change only the new fixture's id/data.id.
  // This is explicit local fixture seeding, never an application or migration change.
  const original = await db.prepare('SELECT * FROM patients WHERE org_id=? AND id=?').bind(orgs.B, people.B).first();
  assert.ok(original);
  const data = { ...JSON.parse(original.data), id: people.A };
  const clone = { ...original, id: people.A, data: JSON.stringify(data) };
  const columns = Object.keys(clone);
  assert.ok(columns.every(x => /^[a-z_]+$/.test(x)));
  await db.prepare(`INSERT INTO patients (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).bind(...columns.map(x => clone[x])).run();
  const duplicate = await db.prepare('SELECT org_id,id FROM patients WHERE id=? ORDER BY org_id').bind(people.A).all();
  assert.equal(duplicate.results.length, 2);
  for (const side of ['A', 'B']) {
    const begun = must(await api.command(owners[side], { type: 'startVisit', personId: people.A }, orgs[side]), 200);
    visits[side] = begun.json.result.visitId;
    bytes[side] = pngBytes(2048, side === 'A' ? 3 : 7);
    const response = await rawApi.request(`/api/media?visitId=${encodeURIComponent(visits[side])}&purpose=wound-or-skin`, {
      method: 'POST', headers: { ...owners[side].headers, 'x-saha-organisation': orgs[side],
        'Content-Type': 'image/png', 'Idempotency-Key': randomUUID() }, body: bytes[side], redirect: 'manual',
    });
    const text = response.text;
    captureSetup({ status: response.status, text, headers: response.headers }, `uploadMedia-${side}`);
    const body = JSON.parse(text);
    assert.equal(response.status, 200, JSON.stringify(body));
    media[side] = body.mediaId;
  }
  assert.notEqual(media.A, media.B);
  assert.notEqual(hash(Buffer.from(bytes.A).toString('base64')), hash(Buffer.from(bytes.B).toString('base64')));
  onEvidence?.(setupEvidence);
  return { base: localOrigin(base, assert), api: rawApi, db, run, owners, orgs, people, sharedPersonId: people.A, visits, media, bytes, markers, names, canaries };
}

/** No product repairs or retries. Every case retains its own before/after evidence. */
export async function runTenantIsolationMatrix(fixture, { syntheticOnly, onEvidence, assertions = nativeAssert }) {
  const assert = assertions, must = (r, status) => requireStatus(r, status, assert);
  assert.equal(syntheticOnly, true);
  localOrigin(fixture.base, assert);
  const { db, owners, orgs, people, sharedPersonId, media, bytes, markers, names, canaries } = fixture;
  const cases = [];
  const stateObjects = {};
  const auditObjects = {};
  let activeCase;
  const emitEvidence = () => onEvidence?.({ cases, stateObjects, auditObjects });
  const protectedState = async () => {
    const state = {};
    for (const table of ['patients', 'visits', 'media', 'command_receipts', 'memberships', 'team_members']) {
      const rows = (await db.prepare(`SELECT * FROM ${table} WHERE org_id IN (?,?)`).bind(orgs.A, orgs.B).all()).results;
      state[table] = rows.map(row => JSON.stringify(row)).sort();
    }
    state.organisationRevisions = (await db.prepare('SELECT id,revision FROM organisations WHERE id IN (?,?) ORDER BY id').bind(orgs.A, orgs.B).all()).results;
    return state;
  };
  const audit = async org => (await db.prepare('SELECT * FROM audit_events WHERE org_id=? ORDER BY id').bind(org).all()).results;
  const capture = r => {
    activeCase?.responses.push(responseEvidence(r));
    emitEvidence();
    // Retain the actual response before asserting the original protected-API cache contract.
    assert.ok(/(?:^|,)\s*no-store(?:\s*(?:,|$))/i.test(r.headers.get('cache-control') ?? ''),
      `Protected response lacks no-store: ${r.status} ${r.headers.get('cache-control')}`);
    return r;
  };
  const api = {
    get: async (...args) => capture(await fixture.api.get(...args)),
    call: async (...args) => capture(await fixture.api.call(...args)),
  };
  const noCanary = (r, side = 'B') => {
    for (const marker of canaries[side]) assert.ok(!r.text.includes(marker), `Foreign name/locality canary disclosed: ${side} ${marker}`);
  };
  const noArchive = r => {
    assert.ok(!/application\/x-tar/i.test(r.headers.get('content-type') ?? ''));
    assert.equal(r.headers.get('content-disposition'), null);
    assert.equal(r.headers.get('x-saha-export-id'), null);
    assert.equal(r.headers.get('x-saha-content-sha256'), null);
    assert.equal(r.headers.get('x-saha-manifest-sha256'), null);
  };
  const check = async (id, fn, { protectForeign = false } = {}) => {
    const before = await protectedState(), auditBefore = await audit(orgs.B);
    const entry = { id, outcome: 'running', responses: [], beforeProtectedSha256: hash(before), beforeForeignAuditSha256: hash(auditBefore) };
    stateObjects[hash(before)] = before; auditObjects[hash(auditBefore)] = auditBefore;
    cases.push(entry);
    activeCase = entry;
    emitEvidence();
    try {
      const response = await fn();
      if (response) entry.response = responseEvidence(response);
      entry.outcome = 'passed';
    } catch (error) {
      entry.outcome = 'failed'; entry.error = String(error?.stack ?? error);
      // Retain all later independent observations. Failure is never converted to PASS.
    } finally {
      try {
        const after = await protectedState(), auditAfter = await audit(orgs.B);
        entry.afterProtectedSha256 = hash(after); entry.afterForeignAuditSha256 = hash(auditAfter);
        stateObjects[hash(after)] = after; auditObjects[hash(auditAfter)] = auditAfter;
        assert.deepEqual(after, before, 'Read/refusal altered records, receipts, memberships or revisions');
        if (protectForeign) assert.deepEqual(auditAfter, auditBefore, 'Foreign tenant audit changed on a refused or tenant-A-only request');
      } catch (error) {
        entry.outcome = 'failed'; entry.sideEffectError = String(error?.stack ?? error);
      }
      activeCase = undefined;
      emitEvidence();
    }
  };
  await check('TI-C01', async () => {
    const r = must(await api.get(owners.A, `/api/patients/detail?personId=${sharedPersonId}`, orgs.A), 200);
    const p = r.json.delta.people.find(p => p.id === sharedPersonId);
    assert.equal(p.name, names.A); assert.equal(p.village, markers.A); assert.equal(p.age, 13); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C02', async () => {
    const r = must(await api.get(owners.B, `/api/patients/detail?personId=${sharedPersonId}`, orgs.B), 200);
    const p = r.json.delta.people.find(p => p.id === sharedPersonId);
    assert.equal(p.name, names.B); assert.equal(p.village, markers.B); assert.equal(p.age, 87); noCanary(r, 'A'); return r;
  });
  await check('TI-C03', async () => {
    const r = must(await api.get(owners.A, `/api/patients/detail?personId=${sharedPersonId}`, orgs.B), 403);
    noCanary(r); assert.equal(r.json?.delta, undefined); return r;
  }, { protectForeign: true });
  await check('TI-C04', async () => {
    const r = must(await api.get(owners.A, `/api/patients/detail?personId=${people.B}`, orgs.A), 404);
    noCanary(r); assert.equal(r.json?.delta, undefined); return r;
  }, { protectForeign: true });
  await check('TI-C05', async () => {
    const r = must(await api.call(owners.A, '/api/patients', { method: 'POST', org: orgs.A, body: { q: markers.B } }), 200);
    assert.deepEqual(r.json.rows, []); assert.equal(r.json.total, 0); assert.equal(r.json.nextCursor, null); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C06', async () => {
    const r = must(await api.call(owners.A, '/api/patients', { method: 'POST', org: orgs.B, body: { q: markers.B } }), 403);
    assert.equal(r.json?.rows, undefined); assert.equal(r.json?.total, undefined); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C07', async () => {
    const r = must(await api.get(owners.A, '/api/data-exit?fhir=0&format=tar', orgs.B), 403);
    noCanary(r); noArchive(r); return r;
  }, { protectForeign: true });
  const file = async (who, id, queryOrg, headerOrg) => {
    const r = await fixture.api.request(`/api/media/${id}?organisationId=${encodeURIComponent(queryOrg)}`, {
      headers: { ...(who?.headers ?? {}), 'x-saha-organisation': headerOrg }, redirect: 'manual',
    });
    const buffer = Buffer.from(r.bytes);
    return capture({ status: r.status, text: buffer.toString('utf8'), bytes: buffer, headers: r.headers });
  };
  await check('TI-C08', async () => {
    const r = await file(owners.A, media.B, orgs.B, orgs.A); must(r, 403);
    assert.ok(!r.bytes.equals(Buffer.from(bytes.B))); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C09', async () => {
    // Current mediaFile explicitly chooses organisationId query before header.
    // This valid A query must select A bytes; do not invent a new conflict policy.
    const r = await file(owners.A, media.A, orgs.A, orgs.B); must(r, 200);
    assert.ok(r.bytes.equals(Buffer.from(bytes.A))); assert.ok(!r.bytes.equals(Buffer.from(bytes.B))); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C10', async () => {
    const r = await file(owners.B, media.B, orgs.B, orgs.A); must(r, 200);
    assert.ok(r.bytes.equals(Buffer.from(bytes.B))); assert.ok(!r.bytes.equals(Buffer.from(bytes.A))); noCanary(r, 'A'); return r;
  });
  await check('TI-C11', async () => {
    const r = await file(null, media.B, orgs.B, orgs.A); must(r, 401);
    assert.ok(!r.bytes.equals(Buffer.from(bytes.B))); noCanary(r); return r;
  }, { protectForeign: true });
  await check('TI-C12', async () => {
    const r = must(await api.get(owners.A, `/api/media/${media.B}?organisationId=${encodeURIComponent(orgs.A)}`, orgs.A), 404);
    noCanary(r); assert.ok(!Buffer.from(r.text).equals(Buffer.from(bytes.B))); return r;
  }, { protectForeign: true });
  await check('TI-C13', async () => {
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    await db.prepare(`CREATE TRIGGER tenant_isolation_prepared_audit_fault BEFORE INSERT ON audit_events WHEN NEW.org_id=${quote(orgs.A)} AND NEW.action='viewPatientRecord' AND NEW.person_id=${quote(sharedPersonId)} BEGIN SELECT RAISE(ABORT,'synthetic tenant-isolation audit fault'); END`).run();
    try {
      const r = must(await api.get(owners.A, `/api/patients/detail?personId=${sharedPersonId}`, orgs.A), 503);
      assert.equal(r.json?.delta, undefined); noCanary(r, 'A'); noCanary(r); return r;
    } finally { await db.prepare('DROP TRIGGER tenant_isolation_prepared_audit_fault').run(); }
  }, { protectForeign: true });
  return { scope: 'Prepared APL-763 two-tenant scalar/collision/media/export/refusal witness; not full story acceptance',
    caseCount: cases.length, passed: cases.filter(x => x.outcome === 'passed').length,
    failed: cases.filter(x => x.outcome === 'failed').length, skipped: 0, cases, stateObjects, auditObjects,
    limits: ['Owned local Sites-dispatcher header model only; not public-header or hosted identity acceptance.',
      'Fixture directly seeds one synthetic composite-key patient collision; no production or migration change.',
      'Current D1 application authorization and composite keys are assessed; PostgreSQL RLS remains unverified.',
      'Name/locality canaries and exact positive age/count/media bytes are covered; no blanket clinical-note, arbitrary derived-field or partial-string disclosure coverage is claimed.',
      'No provider, backup, future index, asynchronous-service, formal human or hosted acceptance.'] };
}
