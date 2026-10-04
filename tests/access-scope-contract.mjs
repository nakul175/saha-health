// Slice 13a: access scope everywhere — the pure parts, against the real transpiled modules.
// 1. Cross-site refusal: which API requests another website started are refused, and which endpoints are exempt.
// 2. The organisation's policy bound to its members: normallyAllowed applies facility/locality scope and a programme grant to
//    every member it judges once the state is bound, leaves unbound members on the plain team scope, and never widens.
// 3. The SQL pre-filter (policySql) selects exactly the patients the JavaScript policy allows, on a real SQLite database,
//    for every combination of facility, locality and programme policy over a grid of synthetic patients.
// 4. Purpose checkpoints: which purposes a grant permits, and that every mapped command exists and no lookup is mapped.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(process.cwd(), '.access-scope-contract-')), seen = new Set();
let passed = 0;
const check = fn => { fn(); passed++; }, checkAsync = async fn => { await fn(); passed++; };
function compile(name) {
  if (seen.has(name)) return; seen.add(name);
  let code = ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  code = code.replace(/from ['"](\.\/[^'"]+)['"]/g, (_, path) => {
    const rel = join(dirname(name), path);
    if (path.endsWith('.json')) { const file = join(dir, rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, readFileSync('lib/saha/' + rel)); return `from '${path}' with {type:'json'}`; }
    if (path.endsWith('.mjs')) { const file = join(dir, rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, readFileSync('lib/saha/' + rel)); return `from '${path}'`; }
    compile(rel); return `from '${path}.js'`;
  });
  const file = join(dir, name + '.js'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, code);
}
try {
  for (const m of ['cross-site', 'access', 'purpose-scope', 'facility-scope']) compile(m);
  const imp = n => import(pathToFileURL(join(dir, n + '.js')));
  const [X, A, P] = await Promise.all(['cross-site', 'access', 'purpose-scope'].map(imp));

  // 1. Cross-site refusal.
  const req = (path, headers = {}, method = 'GET') => new Request('https://saha.example.invalid' + path, { method, headers });
  check(() => {
    for (const [path, headers] of [['/api/workspace', { 'Sec-Fetch-Site': 'cross-site' }], ['/api/workspace', { 'Sec-Fetch-Site': 'same-site' }], ['/api/patients', { Origin: 'https://evil.example' }], ['/api/media/x', { Origin: 'null' }], ['/api/commands', { Origin: 'http://saha.example.invalid' }]])
      assert.ok(X.crossSiteReason(req(path, headers)), `${path} ${JSON.stringify(headers)} is refused`);
    for (const [path, headers] of [['/api/workspace', {}], ['/api/workspace', { 'Sec-Fetch-Site': 'same-origin' }], ['/api/workspace', { 'Sec-Fetch-Site': 'none' }], ['/api/workspace', { Origin: 'https://saha.example.invalid' }], ['/', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' }], ['/field/', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' }]])
      assert.equal(X.crossSiteReason(req(path, headers)), null, `${path} ${JSON.stringify(headers)} is allowed`);
    // Slice 13f (review finding 1): however the path is spelled, and whatever the path, only a page navigation is let through.
    for (const [path, headers, method] of [['/%61pi/workspace', { 'Sec-Fetch-Site': 'cross-site' }], ['/ap%69/patients', { Origin: 'https://evil.example' }], ['/API/workspace', { 'Sec-Fetch-Site': 'cross-site' }], ['//api//workspace', { 'Sec-Fetch-Site': 'same-site' }], ['/x/../api/workspace', { 'Sec-Fetch-Site': 'cross-site' }], ['/%2e%2e/api/workspace', { 'Sec-Fetch-Site': 'cross-site' }], ['/api%2Fworkspace', { 'Sec-Fetch-Site': 'cross-site' }], ['/%E0%A4%A/api', { 'Sec-Fetch-Site': 'cross-site' }], ['/%61pi/workspace', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' }], ['/', { 'Sec-Fetch-Site': 'cross-site' }], ['/field/', { Origin: 'https://evil.example' }], ['/', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' }, 'POST'], ['/%61pi/mis/callback', { 'Sec-Fetch-Site': 'cross-site' }, 'POST']])
      assert.ok(X.crossSiteReason(req(path, headers, method)), `${method ?? 'GET'} ${path} ${JSON.stringify(headers)} is refused`);
    assert.equal(X.routePath('/%61pi//x/./y/../workspace'), '/api/x/workspace');
    for (const path of ['/api/mis/callback', '/api/anaemia-connection-test', '/api/frontline-connection-test']) assert.equal(X.crossSiteReason(req(path, { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://partner.example' }, 'POST')), null, `${path} keeps its own authentication`);
  });
  await checkAsync(async () => {
    const r = await X.crossSiteRefusal(req('/api/workspace', { 'Sec-Fetch-Site': 'cross-site' }));
    assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await X.crossSiteRefusal(req('/api/workspace')), null);
  });

  // 2. The policy bound to members.
  const now = '2026-10-04T00:00:00.000Z';
  const member = (userId, role = 'clinician', extra = {}) => ({ userId, displayName: userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...extra });
  const person = (id, extra = {}) => ({ id, name: id, age: 30, sex: 'Female', village: 'V', programmes: ['General care'], teamId: 't1', assignedTo: 'asha', version: 1, ...extra });
  const scope = { version: 3, enforceFacility: true, enforceLocality: false, facilities: [{ id: 'f1', name: 'F1', localityId: 'l1' }, { id: 'f2', name: 'F2', localityId: 'l2' }, { id: 'f3', name: 'F3', localityId: null }], localities: [{ id: 'l1', name: 'L1' }, { id: 'l2', name: 'L2' }], teamAssignments: { t1: { facilityId: 'f1' } }, memberAssignments: {} };
  check(() => {
    const doc = member('doc'), s = { members: [doc, member('other')], operations: { accessScope: scope } };
    const atF1 = person('a', { facilityId: 'f1' }), atF2 = person('b', { facilityId: 'f2' }), none = person('c');
    assert.deepEqual([atF1, atF2, none].map(p => A.normallyAllowed(doc, p)), [true, true, true], 'an unbound member keeps the plain team scope');
    A.bindAccessPolicy(s);
    assert.deepEqual([atF1, atF2, none].map(p => A.normallyAllowed(doc, p)), [true, false, false], 'bound: facility scope applies, and fails closed for a patient with no facility');
    assert.deepEqual([atF1, atF2].map(p => A.normallyAllowed(s.members[1], p)), [true, false], 'it applies to any member of the bound state, not only the viewer');
    assert.equal(A.normallyAllowed(doc, person('d', { facilityId: 'f1', teamId: 't2' })), false, 'never widens: outside the team stays refused');
    s.operations.accessScope = { ...scope, enforceFacility: false };
    assert.equal(A.normallyAllowed(doc, atF2), true, 'the bound policy is read live: turning enforcement off takes effect at once');
    s.operations.accessScope = scope;
    assert.equal(A.allowed(doc, atF2, now), false);
    atF2.exceptionalAccess = [{ userId: 'doc', until: '2026-10-05T00:00:00.000Z', reason: 'x', grantedAt: now }];
    assert.equal(A.allowed(doc, atF2, now), true, 'an emergency-access grant is not narrowed by the policy');
  });
  check(() => {
    const asha = member('asha', 'asha'), s = { members: [asha], operations: { purposeGrants: [{ id: 'g', memberId: 'asha', programme: 'TB screening', purposes: [], version: 1, setBy: 'own', setAt: now, reason: 'x'.repeat(12) }] } };
    A.bindAccessPolicy(s);
    const tb = person('t', { programmes: ['TB screening', 'General care'] }), mat = person('m', { programmes: ['Maternal care', 'General care'] });
    assert.deepEqual([tb, mat].map(p => A.normallyAllowed(asha, p)), [true, false], 'a programme grant narrows normal access');
    assert.deepEqual([tb, mat].map(p => A.withinPolicy(asha, p)), [true, false], 'withinPolicy is the policy part only');
    s.operations.purposeGrants[0].revokedAt = now;
    assert.equal(A.normallyAllowed(asha, mat), true, 'a revoked grant no longer narrows');
  });
  check(() => {
    const doc = member('doc');
    A.bindAccessPolicy({ members: [doc], operations: { accessScope: { ...scope, enforceFacility: false } } });
    assert.equal(A.normallyAllowed(doc, person('x', { facilityId: 'f2' }), scope), false, 'an explicit scope argument still takes precedence');
  });

  // 3. policySql equals the JavaScript policy on a real SQLite database.
  check(() => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE patients (id TEXT PRIMARY KEY, data TEXT)');
    const patients = [];
    for (const facilityId of [undefined, 'f1', 'f2', 'f3', 'gone']) for (const localityId of [undefined, 'l1', 'l2']) for (const programmes of [['General care'], ['TB screening', 'General care'], ['Maternal care']]) {
      const p = person(`p${patients.length}`, { ...(facilityId ? { facilityId } : {}), ...(localityId ? { localityId } : {}), programmes }); patients.push(p);
      db.prepare('INSERT INTO patients VALUES (?,?)').run(p.id, JSON.stringify(p));
    }
    const members = [member('a', 'clinician'), member('b', 'clinician', { teamIds: ['t1', 't2'] }), member('c', 'clinician', { teamIds: ['t9'] }), member('own2', 'clinician', { teamIds: ['t1'] })];
    const scopes = [undefined,
      { ...scope, enforceFacility: true, enforceLocality: false },
      { ...scope, enforceFacility: false, enforceLocality: true },
      { ...scope, enforceFacility: true, enforceLocality: true },
      { ...scope, enforceFacility: false, enforceLocality: true, teamAssignments: { t1: { localityId: 'l2' } }, memberAssignments: { own2: { facilityId: 'f3' } } },
      { ...scope, enforceFacility: true, enforceLocality: false, teamAssignments: { t2: { facilityId: 'f2' } }, memberAssignments: { a: { facilityId: 'f2' } } }];
    const grantSets = [undefined, [{ id: 'g', memberId: 'a', programme: 'TB screening', purposes: [], version: 1, setBy: 'o', setAt: now, reason: 'x'.repeat(12) }, { id: 'h', memberId: 'b', programme: 'Maternal care', purposes: ['reporting'], version: 1, setBy: 'o', setAt: now, reason: 'x'.repeat(12) }]];
    let cases = 0;
    for (const sc of scopes) for (const grants of grantSets) for (const m of members) {
      const ops = { accessScope: sc, purposeGrants: grants }, sqlPolicy = A.policySql(m, ops);
      A.bindAccessPolicy({ members: [m], operations: ops });
      const expected = patients.filter(p => A.withinPolicy(m, p)).map(p => p.id).sort();
      const got = sqlPolicy ? db.prepare(`SELECT id FROM patients p WHERE ${sqlPolicy.sql} ORDER BY id`).all(...sqlPolicy.binds).map(r => r.id).sort() : patients.map(p => p.id).sort();
      assert.deepEqual(got, expected, JSON.stringify({ member: m.userId, sc: sc && [sc.enforceFacility, sc.enforceLocality], grants: !!grants }));
      if (!sc?.enforceFacility && !sc?.enforceLocality && !A.programmeScopeOf(m, grants)) assert.equal(sqlPolicy, null, 'nothing narrows: no predicate, so the plain team read applies');
      cases++;
    }
    assert.equal(cases, scopes.length * grantSets.length * members.length);
  });

  // 4. Purpose checkpoints.
  check(() => {
    const m = member('m'), grant = purposes => [{ id: 'g', memberId: 'm', programme: null, purposes, version: 1, setBy: 'o', setAt: now, reason: 'x'.repeat(12) }];
    assert.equal(A.purposePermits(m, 'reporting', undefined), true, 'no grant: every purpose');
    assert.equal(A.purposePermits(m, 'reporting', grant([])), true, 'a programme-only grant names no purposes: every purpose');
    assert.equal(A.purposePermits(m, 'ai-assistance', grant(['ai-assistance'])), true);
    assert.equal(A.purposePermits(m, 'reporting', grant(['ai-assistance'])), false);
    A.bindAccessPolicy({ members: [m], operations: { purposeGrants: grant(['care-coordination']) } });
    assert.equal(A.purposePermits(m, 'programme-delivery'), false, 'the bound grant is used when none is passed');
    assert.throws(() => P.ensurePurpose(m, 'programme-delivery'), e => e.status === 403 && /programme delivery \(mis\) is not one of them/.test(e.message));
    assert.doesNotThrow(() => P.ensurePurpose(m, 'care-coordination'));
    assert.doesNotThrow(() => P.ensurePurpose(m, undefined), 'a command with no purpose is not a flow');
  });
  check(() => {
    const catalogue = new Set(readFileSync('docs/current/COMMAND-CATALOGUE.csv', 'utf8').trim().split('\n').slice(1).map(l => l.split(',')[0]));
    for (const [command, purpose] of Object.entries(P.COMMAND_PURPOSE)) { assert.ok(catalogue.has(command), `${command} is a real command`); assert.ok(P.ACCESS_PURPOSES.includes(purpose), purpose); }
    for (const command of Object.keys(P.COMMAND_PURPOSE)) assert.doesNotMatch(command, /^lookup/, 'lookups resolve flows already started and are not stopped');
    for (const purpose of P.ACCESS_PURPOSES) assert.ok(Object.values(P.COMMAND_PURPOSE).includes(purpose) || ['household-sharing', 'patient-export'].includes(purpose), `${purpose} has a checkpoint`)  // household sharing and patient export (slice 14g: data exit, FHIR download) are route checkpoints, not commands;
  });

  writeFileSync('tests/access-scope-contract-result.json', JSON.stringify({ passed, suite: 'access-scope-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'access-scope-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
