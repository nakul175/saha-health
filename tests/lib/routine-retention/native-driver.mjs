// Actual built routine endpoints + native D1; run only through the separately reviewed owned CLI.
// No response/request retry, clinical command under test, external backend or hosted request.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 as hash, deadline } from './containment.mjs';
import { ownedRoutineRuntime } from './native-runtime.mjs';
import { boundedTenantRequest } from './transport.mjs';

assert.equal(process.env.SAHA_ROUTINE_METRIC_RELEASE, 'root-reviewed-routine-native-lane-released', 'Explicit reviewed owned runtime lease required.');
const port = Number(process.env.SAHA_ROUTINE_METRIC_PORT);
assert.ok(Number.isSafeInteger(port) && port > 1024 && port < 65536);
const folder = resolve(process.env.SAHA_ROUTINE_METRIC_OUTPUT);
const state = resolve(process.env.SAHA_ROUTINE_METRIC_STATE);
assert.ok(existsSync(folder), 'Outer CLI must own the new evidence directory before launch.');
assert.equal(existsSync(state), false, 'Never delete/reuse local state.');
assert.equal(existsSync(join(folder, 'result.json')), false, 'Never overwrite an existing native result.');
const walk = dir => readdirSync(dir).sort().flatMap(name => {
  const path = join(dir, name), stat = lstatSync(path); assert.equal(stat.isSymbolicLink(), false, 'No unreviewed build symlink.');
  return stat.isDirectory() ? walk(path) : [path];
});
const manifest = dir => Object.fromEntries(walk(dir).map(path => [relative(process.cwd(), path), hash(readFileSync(path))]));
const external = ["tests/lib/routine-retention/containment.mjs", "tests/lib/routine-retention/native-runtime.mjs", "tests/lib/routine-retention/transport.mjs", "tests/lib/routine-retention/native-driver.mjs", "scripts/routine-retention-runner.mjs", "tests/integration/routine-telemetry-retention-http.mjs"].map(file => resolve(file));
const sourceFiles = [...new Set([...execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 20000, killSignal: 'SIGKILL' }).split('\0').filter(Boolean).map(file => resolve(file)), ...external,
  ...(existsSync('.sites-runtime/execution-profile.json') ? [resolve('.sites-runtime/execution-profile.json')] : [])])].sort();
const sourcePins = () => Object.fromEntries(sourceFiles.map(file => [file, hash(readFileSync(file))]));
const initialSources = sourcePins(), initialBuild = manifest('dist');
const selfFile = new URL(import.meta.url), driverSHA256 = hash(readFileSync(selfFile));
const associationFile = resolve(process.env.SAHA_ROUTINE_METRIC_BUILD_ASSOCIATION);
const associationSHA256 = hash(readFileSync(associationFile));
const association = JSON.parse(readFileSync(associationFile, 'utf8'));
assert.equal(association.status, 'actual canonical build completed with unchanged complete recorded inputs');
assert.deepEqual(association.afterInputs, initialSources, 'Runtime source must equal the actual complete canonical build input set.');
assert.deepEqual(association.dist, initialBuild, 'Runtime uses exactly the canonical built output.');
assert.equal(association.buildCommand.ok, true);
const initialCompilerReceipts = manifest('.sites-runtime/bundle-provenance');
assert.deepEqual(association.compilerReceipts, initialCompilerReceipts);
assert.ok(Object.keys(initialCompilerReceipts).length > 0, 'Actual compiler receipt set is required.');
const { readExecutionProfile } = await import(pathToFileURL(resolve('scripts/execution-profile.mjs')).href);
const executionProfileFile = resolve('.sites-runtime/execution-profile.json');
const captureExecutionProfile = () => ({ file: executionProfileFile, present: existsSync(executionProfileFile),
  sha256: existsSync(executionProfileFile) ? hash(readFileSync(executionProfileFile)) : null,
  effectiveProfile: readExecutionProfile() });
const initialProfile = captureExecutionProfile();
assert.equal(initialProfile.effectiveProfile, 'portable');
assert.deepEqual(association.beforeProfile, initialProfile);
assert.deepEqual(association.afterProfile, initialProfile);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const { identity } = await import(pathToFileURL(resolve('tests/lib/worker.mjs')).href);
const { suite } = await import(pathToFileURL(resolve('tests/lib/report.mjs')).href);
const report = suite('Routine telemetry tenant retention guard', join(folder, 'result.json'), {
  layer: 'integration', limits: ['Actual built loopback routine GET/POST with native migrated disposable D1 and synthetic principals.',
    'Only telemetry authority/retention and absence of clinical mutation; no full story, NFR, hosting, human/domain or formal UAT pass.',
    'Source/build hashes plus outer actual canonical-build association record applicability; independent review remains separate.'],
});
const checks = [], observations = [], setup = [], custodyErrors = [];
let worker, db, restoreMembership, disposed = false, unexpectedOutbound = 0, journalSequence = 0, terminalFailure = null;
const errorShape = error => ({ name: error?.name, message: String(error?.message ?? error), stack: String(error?.stack ?? ''), code: error?.code ?? null });
const custodyFailure = (phase, error) => custodyErrors.push({ phase, ...errorShape(error) });
const save = phase => {
  const record = { phase, at: new Date().toISOString(), setup, observations, custodyErrors };
  const bytes = JSON.stringify(record, null, 2) + '\n';
  writeFileSync(join(folder, 'observations.json'), bytes);
  writeFileSync(join(folder, `checkpoint-${String(++journalSequence).padStart(5, '0')}.json`), bytes, { flag: 'wx' });
};
const safeSave = phase => { try { save(phase); } catch (error) { custodyFailure(phase, error); } };
const check = async (label, assertion) => { checks.push(label); await report.check(label, assertion); };
const listening = () => deadline('owned loopback port observation', () => new Promise((yes, no) => {
  const socket = createConnection({ host: '127.0.0.1', port });
  const timer = setTimeout(() => { socket.destroy(); no(new Error('Owned port observation exceeded 1500ms')); }, 1500);
  socket.once('connect', () => { clearTimeout(timer); socket.destroy(); yes(true); });
  socket.once('error', error => { clearTimeout(timer); socket.destroy(); if (error.code === 'ECONNREFUSED') yes(false); else no(error); });
}), 2000);
const query = (label, operation) => deadline(`native D1 ${label}`, operation, 20000);
const rows = async () => (await query('metric rows', () => db.prepare('SELECT * FROM request_metrics ORDER BY org_id,bucket,route,status').all())).results;
const clinical = async () => ({
  patients: (await query('patient rows', () => db.prepare('SELECT * FROM patients ORDER BY org_id,id').all())).results,
  visits: (await query('visit rows', () => db.prepare('SELECT * FROM visits ORDER BY org_id,id').all())).results,
  receipts: (await query('receipt rows', () => db.prepare('SELECT * FROM command_receipts ORDER BY actor_id,key').all())).results,
});
const auditRows = async () => (await query('audit rows', () => db.prepare('SELECT * FROM audit_events ORDER BY org_id,id').all())).results;
const snapshot = async () => ({ metrics: await rows(), clinical: await clinical(), audit: await auditRows() });
const fingerprint = value => hash(JSON.stringify(value));
const hasProtectedContent = body => Boolean(body?.person || body?.context || body?.visit || JSON.stringify(body).includes('p_meena'));
const raw = async (who, path, { method = 'GET', org, body } = {}, record) => {
  const headers = new Headers(who?.headers ?? {});
  if (org !== undefined) headers.set('x-saha-organisation', org);
  if (body !== undefined) { headers.set('content-type', 'application/json'); headers.set('idempotency-key', crypto.randomUUID()); }
  record.request = { method, path, selectedOrganisation: org ?? null, bodySHA256: body === undefined ? null : hash(body) };
  save('request declared before dispatch');
  try {
    const response = await boundedTenantRequest(worker.base, path, { method, headers, body }, {
      timeoutMs: 20000, onEvidence: partial => { record.transportReceipt = partial; save('actual response transport progress'); },
    });
    record.response = { method, path, selectedOrganisation: org ?? null, status: response.status,
      headers: Object.fromEntries(response.headers), text: response.text, json: response.json, bodySHA256: hash(response.bytes) };
    save('complete actual response retained'); return record.response;
  } catch (error) {
    if (error.transportReceipt) record.transportReceipt = error.transportReceipt;
    const partial = record.transportReceipt;
    record.response = { method, path, selectedOrganisation: org ?? null, status: partial?.actualHttpStatus ?? null,
      headers: partial?.headers ?? null, partialBodyBase64: partial?.partialBodyBase64 ?? null,
      bodySHA256: partial?.partialBodySha256 ?? null, bodyComplete: partial?.completeBody ?? false, transportFailure: errorShape(error) };
    safeSave('failed actual response/partial custody retained'); throw error;
  }
};
const setupRequest = async (label, who, path, options = {}) => {
  const record = { label, phase: 'declared before setup dispatch' }; setup.push(record); save('setup request declared');
  const response = await raw(who, path, options, record);
  assert.equal(response.status, 200, response.text); record.phase = 'completed'; save('setup request completed'); return response.json;
};
const setupCommand = (label, who, body, org) => setupRequest(label, who, '/api/commands', { method: 'POST', body: JSON.stringify(body), org });

try {
  worker = ownedRoutineRuntime({ port, state, evidence: folder,
    bindings: { SAHA_IDENTITY_PROVIDER: 'sites-chatgpt', SAHA_ENVIRONMENT: 'synthetic', SAHA_EXTERNAL_APIS_ENABLED: 'false' },
    outboundService: () => { unexpectedOutbound++; throw new Error('Unexpected outbound request forbidden by synthetic fixture.'); } });
  await worker.start();
  db = await query('actual native handle', () => worker.mf.getD1Database('DB'));
  const run = crypto.randomUUID().slice(0, 8);
  const ownerA = identity('metric-owner-a', run), ownerB = identity('metric-owner-b', run), asha = identity('metric-asha', run);
  const own = await setupRequest('Owner A synthetic workspace', ownerA, '/api/workspace');
  const foreign = await setupRequest('Owner B synthetic workspace', ownerB, '/api/workspace');
  const account = await setupRequest('ASHA synthetic account', asha, '/api/workspace');
  const orgA = own.organisation.id, orgB = foreign.organisation.id;
  const invite = await setupCommand('Existing invitation command', ownerA,
    { type: 'createInvite', accountCode: account.user.accountCode, label: 'Synthetic telemetry scope ASHA', role: 'asha', teamIds: ['default'] }, orgA);
  await setupCommand('Join only organisation A', asha, { type: 'joinOrganisation', token: invite.result.token });
  const person = (await setupRequest('Assigned-person preparation read', ownerA, '/api/workspace', { org: orgA })).people.find(p => p.id === 'p_meena');
  assert.ok(person, 'Existing synthetic person fixture is present.');
  await setupCommand('Assign existing synthetic person', ownerA, { type: 'assignPatient', personId: person.id,
    version: person.version, teamId: 'default', assignedTo: asha.id, reason: 'Synthetic telemetry authority fixture assignment' }, orgA);
  await check('Fixture has distinct organisations and no ASHA membership in B', async () => {
    assert.notEqual(orgA, orgB);
    assert.equal((await query('foreign member count', () => db.prepare('SELECT count(*) n FROM memberships WHERE org_id=? AND user_id=?').bind(orgB, asha.id).first())).n, 0);
    const member = await query('own membership', () => db.prepare('SELECT role,status FROM memberships WHERE org_id=? AND user_id=?').bind(orgA, asha.id).first());
    assert.deepEqual(member, { role: 'asha', status: 'active' });
  });
  const old = '2000-01-01T00:00:00.000Z', current = new Date().toISOString().slice(0, 13) + ':00:00.000Z';
  const seed = async () => {
    for (const org of [orgA, orgB]) for (const [bucket, route] of [[old, 'patients'], [old, 'burden:retention-fixture'], [current, 'history']]) {
      await query('seed disclosed retention rows', () => db.prepare('INSERT INTO request_metrics(org_id,bucket,route,status,count,total_ms,max_ms) VALUES (?,?,?,200,7,11,3) ON CONFLICT(org_id,bucket,route,status) DO UPDATE SET count=7,total_ms=11,max_ms=3')
        .bind(org, bucket, route).run());
    }
  };
  const runCase = async ({ id, method = 'GET', path, selectedOrg, expectedStatus, body, permitted = false, route, suspend = false, who = asha }) => {
    const observation = { id, phase: 'declared before setup', completed: false }; observations.push(observation); save('case declared');
    await seed();
    if (suspend) {
      const originalMember = await query('original membership', () => db.prepare('SELECT * FROM memberships WHERE org_id=? AND user_id=?').bind(orgA, asha.id).first());
      restoreMembership = async () => {
        await query('restore synthetic membership', () => db.prepare('UPDATE memberships SET status=? WHERE org_id=? AND user_id=?').bind(originalMember.status, orgA, asha.id).run());
        assert.deepEqual(await query('restored full member row', () => db.prepare('SELECT * FROM memberships WHERE org_id=? AND user_id=?').bind(orgA, asha.id).first()), originalMember);
        observation.membershipRestored = true;
      };
      observation.originalMembership = originalMember; save('synthetic original membership retained before suspend');
      await query('suspend only synthetic local member', () => db.prepare("UPDATE memberships SET status='suspended' WHERE org_id=? AND user_id=?").bind(orgA, asha.id).run());
    }
    observation.before = await snapshot();
    observation.beforeHashes = { metrics: fingerprint(observation.before.metrics), clinical: fingerprint(observation.before.clinical), audit: fingerprint(observation.before.audit) };
    observation.phase = 'before snapshot retained before request'; save(observation.phase);
    let response;
    try { response = await raw(who, path, { method, org: selectedOrg, body }, observation); }
    finally {
      try { observation.after = await snapshot(); observation.afterHashes = { metrics: fingerprint(observation.after.metrics), clinical: fingerprint(observation.after.clinical), audit: fingerprint(observation.after.audit) }; }
      catch (error) { observation.afterSnapshotFailure = errorShape(error); custodyFailure(id + ' after snapshot', error); }
      try { if (restoreMembership) { await restoreMembership(); restoreMembership = undefined; } }
      catch (error) { observation.membershipRestoreFailure = errorShape(error); custodyFailure(id + ' membership restore', error); }
      safeSave('case after/failure/membership custody retained');
    }
    const before = observation.before, after = observation.after;
    assert.ok(after, 'Missing actual after snapshot cannot pass.');
    observation.phase = 'all terminal raw observations retained'; observation.completed = true; save(observation.phase);
    await check(id + ' exact real HTTP status', () => assert.equal(response.status, expectedStatus, response.text));
    await check(id + ' no-store and real request correlation headers', () => {
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.match(response.headers['x-saha-request-id'] ?? '', /^[a-f0-9-]{36}$/);
    });
    await check(id + ' no clinical/receipt mutation', () => assert.deepEqual(after.clinical, before.clinical));
    await check(id + ' prior immutable audit rows retained', () => {
      const map = new Map(after.audit.map(row => [row.org_id + '/' + row.id, JSON.stringify(row)]));
      assert.ok(before.audit.every(row => map.get(row.org_id + '/' + row.id) === JSON.stringify(row)));
    });
    if (!permitted) {
      await check(id + ' no authenticated metric insertion/increment/pruning', () => assert.deepEqual(after.metrics, before.metrics));
      await check(id + ' refusal contains no protected person/visit context', () => assert.equal(hasProtectedContent(response.json), false));
    } else {
      await check(id + ' authorized own old non-burden metric pruned', () => assert.equal(after.metrics.some(row => row.org_id === orgA && row.bucket === old && row.route === 'patients'), false));
      await check(id + ' own old burden and recent metric rows retained exactly', () => {
        for (const beforeRow of before.metrics.filter(row => row.org_id === orgA && (row.route === 'burden:retention-fixture' || row.route === 'history'))) {
          assert.deepEqual(after.metrics.find(row => row.org_id === beforeRow.org_id && row.bucket === beforeRow.bucket && row.route === beforeRow.route && row.status === beforeRow.status), beforeRow);
        }
      });
      await check(id + ' all foreign metrics unchanged', () => assert.deepEqual(after.metrics.filter(row => row.org_id === orgB), before.metrics.filter(row => row.org_id === orgB)));
      await check(id + ' own response counter increments exactly once', () => {
        const prior = before.metrics.filter(row => row.org_id === orgA && row.route === route && row.status === expectedStatus && row.bucket !== old).reduce((n, row) => n + row.count, 0);
        const saved = after.metrics.filter(row => row.org_id === orgA && row.route === route && row.status === expectedStatus && row.bucket !== old).reduce((n, row) => n + row.count, 0);
        assert.equal(saved, prior + 1);
      });
      if (expectedStatus === 200) await check(id + ' real assigned person readback', () => {
        assert.equal(response.json.organisationId, orgA); assert.equal(response.json.person.id, 'p_meena');
      });
    }
  };
  const invalid = JSON.stringify({ fixtureInvalid: true });
  const boundUnapplied = JSON.stringify({ personId: 'p_meena', command: { type: 'saveVisit', visitId: 'v_synthetic_nonexistent', version: 1 } });
  await runCase({ id: 'foreign-get-query', path: '/api/routine-visit?organisationId=' + encodeURIComponent(orgB), expectedStatus: 400 });
  await runCase({ id: 'foreign-post-query', method: 'POST', path: '/api/routine-visit?organisationId=' + encodeURIComponent(orgB), body: invalid, expectedStatus: 400 });
  await runCase({ id: 'foreign-get-header', path: '/api/routine-visit?personId=p_meena', selectedOrg: orgB, expectedStatus: 403 });
  await runCase({ id: 'foreign-post-header', method: 'POST', path: '/api/routine-visit', selectedOrg: orgB, body: boundUnapplied, expectedStatus: 403 });
  await runCase({ id: 'suspended-get', path: '/api/routine-visit?personId=p_meena', selectedOrg: orgA, expectedStatus: 403, suspend: true });
  await runCase({ id: 'suspended-post', method: 'POST', path: '/api/routine-visit', selectedOrg: orgA, body: boundUnapplied, expectedStatus: 403, suspend: true });
  await runCase({ id: 'anonymous-foreign-get', who: null, path: '/api/routine-visit?personId=p_meena', selectedOrg: orgB, expectedStatus: 401 });
  await runCase({ id: 'own-get', path: '/api/routine-visit?personId=p_meena', selectedOrg: orgA, expectedStatus: 200, permitted: true, route: 'patients' });
  await runCase({ id: 'own-post-invalid', method: 'POST', path: '/api/routine-visit', selectedOrg: orgA, body: invalid, expectedStatus: 422, permitted: true, route: 'commands' });
} catch (error) {
  terminalFailure = errorShape(error); safeSave('terminal failure retained');
  await check('Fixture reached all declared actual native scenarios', () => { throw error; });
} finally {
  // None of the journal/report write operations below can precede owned runtime disposal.
  try { if (restoreMembership) { await restoreMembership(); restoreMembership = undefined; } }
  catch (error) { custodyFailure('final synthetic membership restore', error); }
  try { if (worker) { await worker.stop(); disposed = worker.lifecycle.disposed === true; } }
  catch (error) { disposed = worker?.lifecycle.disposed === true; custodyFailure('native disposal/evidence', error); }
  let portFree = false;
  try { portFree = !(await listening()); } catch (error) { custodyFailure('post-disposal port observation', error); }
  safeSave('owned disposal attempted before final evidence');
  await check('Owned native runtime stopped and port released', () => {
    assert.equal(worker?.lifecycle.ready, true); assert.equal(disposed, true); assert.equal(portFree, true);
    assert.equal(worker?.lifecycle.migration?.ok, true); assert.equal(worker?.lifecycle.migrationDriverGroupMatched, true);
    assert.deepEqual(worker?.lifecycle.migrationDescendantsAfterExit, []);
    assert.equal(existsSync(state), true, 'Retain actual owned D1 and failed attempts; no state deletion.');
  });
  await check('All nine actual native scenarios completed without external requests', () => {
    assert.equal(observations.filter(x => x.completed).length, 9); assert.equal(unexpectedOutbound, 0); assert.equal(terminalFailure, null);
  });
  await check('Source/build/driver custody remained unchanged', () => {
    assert.deepEqual(sourcePins(), initialSources); assert.deepEqual(manifest('dist'), initialBuild);
    assert.equal(hash(readFileSync(selfFile)), driverSHA256); assert.equal(hash(readFileSync(associationFile)), associationSHA256);
    assert.deepEqual(manifest('.sites-runtime/bundle-provenance'), initialCompilerReceipts);
    assert.deepEqual(captureExecutionProfile(), initialProfile, 'Execution profile presence/content/effective selection changed during native execution.');
  });
  await check('All custody operations retained evidence and membership restoration', () => assert.deepEqual(custodyErrors, []));
  await report.finish({ actualBuiltRoutineHttp: observations.some(x => x.response?.status !== null && x.response?.status !== undefined), actualNativeD1: Boolean(db),
    declaredScenarios: 9, completedScenarios: observations.filter(x => x.completed).length,
    source: { head, initialWorkingTreeStatus: status, files: initialSources }, driverSHA256,
    build: { files: initialBuild, manifestSHA256: fingerprint(initialBuild), actualAssociation: associationFile, actualAssociationSHA256: associationSHA256, compilerReceipts: initialCompilerReceipts, executionProfile: initialProfile },
    pid: process.pid, port, nativeLifecycle: worker?.lifecycle ?? null,
    observationsFile: join(folder, 'observations.json'), observationsSHA256: hash(readFileSync(join(folder, 'observations.json'))),
    unexpectedOutbound, custodyErrors, terminalFailure, cleanup: { miniflareDisposed: disposed, ownedStateRetained: existsSync(state), portFree }, formalAcceptanceClaim: false });
}
