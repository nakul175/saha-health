// APL-194 / BR-ID-02: the missing native locality-policy boundary.
// Preparation only until root allocates the exclusive native lane. No provider, browser,
// policy mirror, public identity override or hosted endpoint is used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { identity } from '../lib/worker.mjs';
import { ownedLocalityRuntime } from '../lib/scoped-locality-native-runtime.mjs';
import { sourceCheckoutPins } from '../lib/scoped-locality-containment.mjs';
import { suite } from '../lib/report.mjs';

const RELEASE = 'root-scoped-locality-contract-reviewed-native-lane-released';
if (process.env.SAHA_SCOPED_LOCALITY_RELEASE !== RELEASE) throw new Error('Prepared contract only: root must review and allocate the exclusive native lane.');
const port = Number(process.env.SAHA_TEST_PORT);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536, 'Root must allocate an explicit fresh loopback port.');
const evidence = resolve(process.env.SAHA_SCOPED_LOCALITY_EVIDENCE ?? 'tests/reports/scoped-locality-policy');
const state = resolve(process.env.SAHA_SCOPED_LOCALITY_STATE ?? `.wrangler/scoped-locality-${crypto.randomUUID()}`);
assert.equal(existsSync(state), false, 'Never reuse or remove another run’s database.');
assert.equal(existsSync(evidence), false, 'Never overwrite retained evidence.');
mkdirSync(evidence, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
let matrix = null;
const sourcePins = {};
const contractPins = {};
const r = suite('Scoped locality native HTTP qualification (APL-194)', join(evidence, 'result.json'), {
  layer: 'integration',
  environment: 'Own loopback built Worker, fresh disposable native D1, local trusted synthetic identity',
  limits: ['Prepared current-policy coverage only; not full BR-ID-02/TC-BR-ID-02-A/B acceptance.', 'Sequential requests do not prove a mid-await revocation race.', 'Configured organisation-local references are not an institutionally validated geography directory.', 'Four synthetic draft visits prove scoped visit joins; submissions/referrals have no nonempty fixture here and are not qualified.', 'No combined facility/programme, export/tool/provider/physical/hosted acceptance.'],
});
let worker, org, north, south, northFacility, southFacility, scopeVersion = 0;
const run = crypto.randomUUID().slice(0, 8), owner = identity('geo-owner', run), clinician = identity('geo-clinician', run);
const ALL = ['p_aarav', 'p_farida', 'p_kamla', 'p_meena', 'p_rajesh', 'p_sunita'];
const NORTH = ['p_farida', 'p_meena'], SOUTH = ['p_aarav', 'p_rajesh'];
const UNION = [...NORTH, ...SOUTH].sort();
const nativeResponses = [], sideEffectChecks = [], transportErrors = [], custodyErrors = [];
let buildPins = null, workerDisposed = false;
const fixtureVisits = new Map();
let names = new Map();

async function call(who, path, opts = {}) {
  // Real local HTTP, with a deadline through complete body consumption. This is a transport
  // adapter only: authoritative backend status/body are never replaced or manufactured.
  const { method = 'GET', body, organisation = org, headers = {} } = opts;
  const url = new URL(path, worker.base);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.origin, worker.base);
  const requestHeaders = { ...(who?.headers ?? {}), ...(organisation ? { 'x-saha-organisation': organisation } : {}), ...headers };
  if (body !== undefined) { requestHeaders['Content-Type'] = 'application/json'; requestHeaders['Idempotency-Key'] ??= crypto.randomUUID(); }
  const requestBody = body === undefined ? undefined : JSON.stringify(body), started = performance.now();
  const observation = { method, path, actor: who?.id ?? null, organisation: organisation ?? null, requestBodySha256: requestBody === undefined ? null : sha(requestBody), key: requestHeaders['Idempotency-Key'] ?? null };
  try {
    const response = await fetch(url, { method, headers: requestHeaders, body: requestBody, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    nativeResponses.push({ ...observation, status: response.status, bodySha256: sha(text), cacheControl: response.headers.get('cache-control'), ms: performance.now() - started });
    return { status: response.status, headers: response.headers, text, json };
  } catch (error) {
    transportErrors.push({ ...observation, errorName: error?.name ?? 'Error', message: String(error?.message ?? error), ms: performance.now() - started });
    throw error;
  }
}
async function step(name, fn) {
  await r.check(name, fn);
  if (r.failed) throw new Error(`Stop dependent scenarios after recorded failure: ${name}`);
}
async function command(who, body, expected = 200, key = crypto.randomUUID()) {
  const result = await call(who, '/api/commands', { method: 'POST', body, headers: { 'Idempotency-Key': key } });
  assert.equal(result.status, expected, `${body.type}: ${result.status} ${result.text.slice(0, 160)}`);
  return result.json;
}
async function policy(body, expected = 200) {
  const result = await command(owner, { ...body, version: scopeVersion }, expected);
  if (expected === 200) scopeVersion = result.result.version;
  return result;
}
async function workspace(who = clinician) {
  const result = await call(who, '/api/workspace');
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  return result;
}
function ids(rows) { return rows.map(p => p.id).sort(); }
function noOutsideNames(result, permitted) {
  for (const [id, name] of names) if (!permitted.includes(id)) assert.equal(result.text.includes(name), false, `Out-of-locality name disclosed: ${id}`);
}
async function exactViews(expected) {
  const w = await workspace();
  assert.deepEqual(ids(w.json.people), expected);
  assert.deepEqual(ids(w.json.visits), [...fixtureVisits].filter(([personId]) => expected.includes(personId)).map(([, visitId]) => visitId).sort(), 'Nonempty joined draft visit IDs stay within the literal permitted person set.');
  assert.ok(w.json.submissions.every(v => expected.includes(v.personId)), 'Joined submissions stay within the exact permitted set.');
  assert.ok(w.json.referrals.every(v => expected.includes(v.personId)), 'Joined referrals stay within the exact permitted set.');
  noOutsideNames(w, expected);
  const list = await call(clinician, '/api/patients');
  assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'no-store');
  assert.deepEqual(ids(list.json.rows), expected); assert.equal(list.json.total, expected.length);
  noOutsideNames(list, expected);
  const search = await call(clinician, '/api/patients', { method: 'POST', body: { q: names.get('p_meena') } });
  assert.equal(search.status, 200); assert.equal(search.headers.get('cache-control'), 'no-store');
  assert.deepEqual(ids(search.json.rows), expected.includes('p_meena') ? ['p_meena'] : []);
  noOutsideNames(search, expected);
}
function sqliteFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? sqliteFiles(join(dir, x.name)) : x.name.endsWith('.sqlite') ? [join(dir, x.name)] : []);
}
function filePins(dir) {
  return Object.fromEntries(readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? Object.entries(filePins(join(dir, x.name))) : [[join(dir, x.name), sha(readFileSync(join(dir, x.name)))]]));
}
function recordError(phase, error) { custodyErrors.push({ phase, errorName: error?.name ?? 'Error', message: String(error?.message ?? error) }); }
function database() {
  const files = sqliteFiles(state).filter(file => file.replaceAll('\\', '/').includes('/d1/'));
  assert.equal(files.length, 1, 'Use the actual fresh native D1 database, never a mirror.');
  return new DatabaseSync(files[0], { readOnly: true });
}
function clinicalSnapshot(db) {
  return Object.fromEntries(['patients', 'visits', 'submissions', 'referrals'].map(table => [table, db.prepare(`SELECT * FROM ${table} WHERE org_id=? ORDER BY id`).all(org)]));
}
async function deniedWrite(personId) {
  const db = database(), key = `geo-refused-${crypto.randomUUID()}`;
  try {
    const before = sha(JSON.stringify(clinicalSnapshot(db)));
    assert.equal(db.prepare('SELECT count(*) n FROM command_receipts WHERE actor_id=? AND key=?').get(clinician.id, key).n, 0);
    const result = await call(clinician, '/api/commands', { method: 'POST', body: { type: 'startVisit', personId }, headers: { 'Idempotency-Key': key } });
    assert.equal(result.status, 403); assert.equal(result.headers.get('cache-control'), 'no-store');
    noOutsideNames(result, []);
    const after = sha(JSON.stringify(clinicalSnapshot(db)));
    assert.equal(after, before, 'Refused new command does not mutate any clinical row.');
    assert.equal(db.prepare('SELECT count(*) n FROM command_receipts WHERE actor_id=? AND key=?').get(clinician.id, key).n, 0, 'Refused command creates no receipt.');
    sideEffectChecks.push({ personId, key, beforeClinicalSha256: before, afterClinicalSha256: after, receiptCount: 0, status: result.status });
  } finally { db.close(); }
}
async function deniedDetail(personId) {
  const result = await call(clinician, `/api/patients/detail?personId=${personId}`);
  assert.equal(result.status, 404); assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.json?.delta, undefined); noOutsideNames(result, []);
}

try {
  for (const file of ['docs/current/saha-011/POLICY-AXIS-MATRIX.json', 'docs/current/saha-011/SPECIFICATION.md']) contractPins[file] = sha(readFileSync(file));
  matrix = JSON.parse(readFileSync('docs/current/saha-011/POLICY-AXIS-MATRIX.json', 'utf8'));
  for (const [file, pin] of Object.entries(matrix.sourcePins)) {
    sourcePins[file] = sha(readFileSync(file));
    assert.equal(sourcePins[file], pin.sha256, `Frozen source changed: ${file}; rebind and review before execution.`);
  }
  sourcePins['tests/integration/scoped-locality-policy-http.mjs'] = sha(readFileSync('tests/integration/scoped-locality-policy-http.mjs'));
  const buildReceipt = process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT;
  assert.ok(buildReceipt && process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT_SHA256, 'The guarded CLI must retain its observed actual fresh canonical build association.');
  assert.equal(sha(readFileSync(buildReceipt)), process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT_SHA256, 'Reviewed build receipt changed.');
  contractPins[buildReceipt] = process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT_SHA256;
  assert.ok(existsSync('dist/server/wrangler.json'), 'Use the guarded CLI actual fresh canonical build.');
  buildPins = filePins('dist');
  const association = JSON.parse(readFileSync(buildReceipt, 'utf8'));
  assert.equal(association.policyBaselineCommit, matrix.sourceCommit, 'Policy baseline and actual checkout revision are separate.');
  assert.equal(association.kind, 'observed canonical build association; not approval');
  assert.deepEqual(association.inputBefore, association.inputAfter, 'Actual canonical build inputs changed.');
  assert.equal(association.command?.command, 'npm'); assert.deepEqual(association.command?.args, ['run', 'build']);
  assert.equal(association.command?.exitCode, 0); assert.equal(association.command?.signal, null);
  assert.equal(association.command?.timedOut, false); assert.equal(association.command?.ok, true);
  assert.deepEqual(association.command?.liveGroupAfterCleanup, [], 'Actual canonical build group was not fully disposed.');
  const checkout = sourceCheckoutPins(Object.keys(association.inputBefore.files));
  assert.deepEqual(checkout, association.inputBefore, 'Native execution is not on the actual complete built checkout.');
  assert.equal(association.checkoutCommit, checkout.checkoutCommit); assert.equal(association.checkoutTree, checkout.checkoutTree);
  assert.deepEqual(association.sourcePins, Object.fromEntries(Object.entries(sourcePins).filter(([file]) => file !== 'tests/integration/scoped-locality-policy-http.mjs')), 'Build receipt must contain the exact observed selected production/helper source hashes.');
  assert.deepEqual(association.distPins, buildPins, 'Build receipt must contain the exact complete measured dist hashes.');
  // The cleanup handle is assigned synchronously before migration or readiness can reject.
  worker = ownedLocalityRuntime({ state, port, evidence });
  await worker.start();
  assert.equal(new URL(worker.base).hostname, '127.0.0.1');
  await step('GEO-01 existing owner references and versioned setup', async () => {
    const initialOwner = await workspace(owner);
    org = initialOwner.json.organisation.id;
    const initialClinician = await call(clinician, '/api/workspace', { organisation: null });
    assert.equal(initialClinician.status, 200, 'Bootstrap the clinician’s own account before requesting a foreign organisation.');
    const invite = await command(owner, { type: 'createInvite', accountCode: initialClinician.json.user.accountCode, label: 'Synthetic locality clinician', role: 'clinician', teamIds: ['default'] });
    await command(clinician, { type: 'joinOrganisation', token: invite.result.token });
    const before = await workspace(owner); assert.deepEqual(ids(before.json.people), ALL);
    names = new Map(before.json.people.map(p => [p.id, p.name]));
    await policy({ type: 'addLocality', name: 'Synthetic north locality' });
    await policy({ type: 'addLocality', name: 'Synthetic south locality' });
    let view = await call(owner, '/api/facility-scope'); assert.equal(view.status, 200);
    north = view.json.localities.find(x => x.name === 'Synthetic north locality').id;
    south = view.json.localities.find(x => x.name === 'Synthetic south locality').id;
    await policy({ type: 'addFacility', name: 'Synthetic north facility', localityId: north });
    await policy({ type: 'addFacility', name: 'Synthetic south facility', localityId: south });
    view = await call(owner, '/api/facility-scope');
    northFacility = view.json.facilities.find(x => x.name === 'Synthetic north facility').id;
    southFacility = view.json.facilities.find(x => x.name === 'Synthetic south facility').id;
    await policy({ type: 'setTeamLocation', teamId: 'default', facilityId: null, localityId: north });
    for (const [personId, facilityId, localityId] of [['p_meena', northFacility, null], ['p_rajesh', northFacility, south], ['p_farida', southFacility, north], ['p_aarav', southFacility, null]]) {
      const patient = (await workspace(owner)).json.people.find(x => x.id === personId);
      await command(owner, { type: 'assignPatient', personId, version: patient.version, teamId: 'default', assignedTo: null, facilityId, localityId, reason: 'Synthetic existing-policy locality fixture.' });
      const started = await command(owner, { type: 'startVisit', personId });
      assert.ok(started.result.visitId); fixtureVisits.set(personId, started.result.visitId);
    }
    const policyBefore = (await call(owner, '/api/facility-scope')).text;
    await command(owner, { type: 'setTeamLocation', version: scopeVersion, teamId: 'default', facilityId: null, localityId: 'unknown-locality' }, 422);
    await command(owner, { type: 'setTeamLocation', version: scopeVersion - 1, teamId: 'default', facilityId: null, localityId: south }, 409);
    assert.equal((await call(owner, '/api/facility-scope')).text, policyBefore, 'Invalid and stale policy commands leave the versioned policy unchanged.');
  });
  await step('GEO-02 enforcement off preserves original team visibility', async () => exactViews(ALL));
  await step('GEO-03 effective north locality uses explicit locality before facility fallback', async () => {
    await policy({ type: 'setAccessScope', enforceFacility: false, enforceLocality: true });
    await exactViews(NORTH);
    const metadata = await call(clinician, '/api/facility-scope');
    assert.equal(metadata.status, 200); assert.deepEqual(metadata.json, { canManage: false, version: scopeVersion });
  });
  await step('GEO-04 guessed ID and new write refuse without clinical mutation; permitted control works', async () => {
    await deniedDetail('p_rajesh'); await deniedWrite('p_rajesh');
    const detail = await call(clinician, '/api/patients/detail?personId=p_meena');
    assert.equal(detail.status, 200); assert.deepEqual(ids(detail.json.delta.people), ['p_meena']);
    const started = await command(clinician, { type: 'startVisit', personId: 'p_meena' }); assert.equal(started.result.visitId, fixtureVisits.get('p_meena'), 'Permitted start resolves the existing synthetic draft.');
  });
  await step('GEO-05 sequential team locality change re-evaluates originally permitted IDs', async () => {
    await policy({ type: 'setTeamLocation', teamId: 'default', facilityId: null, localityId: south });
    await exactViews(SOUTH); await deniedDetail('p_meena'); await deniedWrite('p_meena');
  });
  await step('GEO-06 enforced locality without a member or team assignment fails closed', async () => {
    await policy({ type: 'setTeamLocation', teamId: 'default', facilityId: null, localityId: null });
    await exactViews([]); await deniedDetail('p_meena'); await deniedWrite('p_meena');
  });
  await step('GEO-07 direct member plus team localities form the existing union', async () => {
    await policy({ type: 'setTeamLocation', teamId: 'default', facilityId: null, localityId: south });
    await policy({ type: 'setMemberLocation', userId: clinician.id, facilityId: null, localityId: north });
    await exactViews(UNION); await deniedDetail('p_kamla'); await deniedWrite('p_kamla');
  });
  await step('GEO-08 disabling locality enforcement restores only the original base scope', async () => {
    await policy({ type: 'setAccessScope', enforceFacility: false, enforceLocality: false }); await exactViews(ALL);
  });
} catch (error) {
  recordError('setup or dependent scenario', error);
  await r.check('native setup/execution completed without unhandled error', () => { throw error; });
} finally {
  if (worker) {
    await r.check('owned native Worker disposes after the attempt', async () => { await worker.stop(); workerDisposed = true; });
    try { writeFileSync(join(evidence, 'worker.log'), worker.output()); } catch (error) { recordError('save Worker log after disposal attempt', error); }
  }
  const changed = Object.entries(sourcePins).filter(([file, digest]) => {
    try { return sha(readFileSync(file)) !== digest; } catch (error) { recordError(`source stability ${file}`, error); return true; }
  }).map(([file]) => file);
  await r.check('frozen source and test bytes remain unchanged through execution', () => assert.deepEqual(changed, []));
  const changedContracts = Object.entries(contractPins).filter(([file, digest]) => {
    try { return sha(readFileSync(file)) !== digest; } catch (error) { recordError(`contract stability ${file}`, error); return true; }
  }).map(([file]) => file);
  await r.check('reviewed criteria, matrix and build receipt stay unchanged through execution', () => assert.deepEqual(changedContracts, []));
  let changedBuild = null;
  if (buildPins !== null) {
    try {
      const after = filePins('dist');
      changedBuild = Object.keys({ ...buildPins, ...after }).filter(file => buildPins[file] !== after[file]);
    } catch (error) { recordError('complete built fixture stability', error); changedBuild = ['unreadable built fixture']; }
  }
  if (buildPins) await r.check('reviewed built fixture bytes remain unchanged through execution', () => assert.deepEqual(changedBuild, []));
  for (const [name, rows] of [['native-response-observations', nativeResponses], ['side-effect-observations', sideEffectChecks], ['transport-errors', transportErrors]]) {
    try { writeFileSync(join(evidence, `${name}.json`), JSON.stringify(rows, null, 2) + '\n'); } catch (error) { recordError(`save ${name}`, error); }
  }
  await r.check('custody operations complete without missing evidence', () => assert.deepEqual(custodyErrors, []));
  await r.finish({ sourceBase: matrix?.sourceCommit ?? null, sourcePins, contractPins, buildPins, buildReceipt: process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT ?? null, buildReceiptSha256: process.env.SAHA_SCOPED_LOCALITY_BUILD_RECEIPT_SHA256 ?? null, ownState: state, node: process.version, workerPort: port, nativeResponses: nativeResponses.length, sideEffectChecks: sideEffectChecks.length, transportErrors: transportErrors.length, custodyErrors, fixtureVisits: Object.fromEntries(fixtureVisits), sourceChanged: changed, contractChanged: changedContracts, buildChanged: changedBuild, workerDisposed, nativeLifecycle: worker?.lifecycle ?? null, minimumScenarioChecks: 8, formalAcceptanceClaim: false });
}
