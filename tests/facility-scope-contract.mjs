// Slice feat/r08 contract (BR-ID-02, BR-ID-04, BR-OPS-01): facility and geography/locality dimensions
// in the access policy. Verifies the scope predicate in access.ts honours the owner-managed facility/
// locality configuration when enforced, defaults to the existing team + assignment scope when not, and
// that the command path is owner-only, version-checked and audited. Pure functions only — no D1.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.facility-scope-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const throws = (fn, test) => { assert.throws(fn, test); passed++; };

const orgId = 'org_facility_scope';
const now = '2026-10-03T00:00:00.000Z';

const member = (over = {}) => ({ userId: 'u-owner', accountCode: 'CODE', displayName: 'Owner', role: 'supervisor', isOwner: true, status: 'active', version: 1, teamIds: ['team-a'], createdAt: now, ...over });
const person = (over = {}) => ({ id: 'p-1', name: 'Pat', age: 30, sex: 'Female', village: 'V', programmes: ['Maternal care'], task: 't', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'team-a', assignedTo: null, ...over });
const state = () => ({
  organisation: { id: orgId, name: 'Org', revision: 1, createdAt: now },
  teams: [{ id: 'team-a', name: 'Team A', createdAt: now }, { id: 'team-b', name: 'Team B', createdAt: now }],
  members: [member()],
  invitations: [],
  workspace: { schemaVersion: 1, revision: 1, role: 'supervisor', people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} },
});

try {
  for (const f of ['facility-scope', 'access', 'core', 'mis', 'adapter-operations', 'programmes', 'fact-provenance', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const fsMod = await import(pathToFileURL(join(dir, 'facility-scope.js')));
  const access = await import(pathToFileURL(join(dir, 'access.js')));

  const { defaultAccessScope, accessScope, applyFacilityScope, authorizeFacilityScope, facilityScopeView, scopeAllows, assignedFacilities, assignedLocalities, patientLocality } = fsMod;
  const owner = member();

  // 1. With no policy configured, allowed() is exactly the existing team + assignment scope.
  {
    const m = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    const pTeamA = person({ teamId: 'team-a', assignedTo: 'u-other' });
    const pTeamB = person({ id: 'p-2', teamId: 'team-b' });
    check(() => assert.equal(access.allowed(m, pTeamA), true, 'supervisor sees own team'));
    check(() => assert.equal(access.allowed(m, pTeamB), false, 'supervisor does not see other team'));
    const asha = member({ isOwner: false, role: 'asha', teamIds: ['team-a'] });
    check(() => assert.equal(access.allowed(asha, pTeamA), false, 'ASHA needs direct assignment'));
    check(() => assert.equal(access.allowed(asha, person({ teamId: 'team-a', assignedTo: 'u-owner' })), true, 'ASHA sees assigned patient'));
  }

  // 2. A configured-but-off policy behaves exactly as the default.
  {
    const s = state(); s.operations = { ...s.operations ?? { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }, accessScope: defaultAccessScope() };
    const m = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    check(() => assert.equal(access.allowed(m, person({ teamId: 'team-a' }), undefined, s.operations.accessScope), true));
    check(() => assert.equal(access.allowed(m, person({ id: 'p-2', teamId: 'team-b' }), undefined, s.operations.accessScope), false));
  }

  // 3. Owner-managed command path: add localities and facilities, then attach a team and enforce facility scope.
  const s = state();
  const u = { userId: 'u-owner', displayName: 'Owner', email: 'o@example.invalid' };
  let r = applyFacilityScope(s, { type: 'addLocality', version: 0, name: 'Rampur block' }, u, owner);
  check(() => assert.equal(r.version, 1));
  r = applyFacilityScope(s, { type: 'addFacility', version: 1, name: 'Rampur PHC', localityId: s.operations.accessScope.localities[0].id }, u, owner);
  check(() => assert.equal(r.version, 2));
  r = applyFacilityScope(s, { type: 'addFacility', version: 2, name: 'Distant CHC', localityId: null }, u, owner);
  check(() => assert.equal(r.version, 3));
  const phc = s.operations.accessScope.facilities.find(f => f.name === 'Rampur PHC').id;
  const chc = s.operations.accessScope.facilities.find(f => f.name === 'Distant CHC').id;
  r = applyFacilityScope(s, { type: 'setTeamLocation', version: 3, teamId: 'team-a', facilityId: phc, localityId: null }, u, owner);
  check(() => assert.equal(r.version, 4));
  r = applyFacilityScope(s, { type: 'setAccessScope', version: 4, enforceFacility: true, enforceLocality: false }, u, owner);
  check(() => assert.equal(r.version, 5));

  // 4. Facility enforcement: a member of team-a (scoped to Rampur PHC) sees a patient there, not elsewhere.
  {
    const m = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    const inFacility = person({ teamId: 'team-a', facilityId: phc });
    const outFacility = person({ id: 'p-2', teamId: 'team-a', facilityId: chc });
    check(() => assert.equal(access.allowed(m, inFacility, undefined, s.operations.accessScope), true, 'same facility'));
    check(() => assert.equal(access.allowed(m, outFacility, undefined, s.operations.accessScope), false, 'different facility denied'));
    check(() => assert.equal(access.allowed(m, person({ id: 'p-3', teamId: 'team-a' }), undefined, s.operations.accessScope), false, 'patient without a facility is denied (fail closed)'));
    check(() => assert.deepEqual([...assignedFacilities(m, s.operations.accessScope)], [phc], 'assigned facilities resolve via team'));
  }

  // 5. Member-level override widens that member's facility scope without changing the team.
  {
    s.members.push(member({ userId: 'u-clin', isOwner: false, role: 'clinician', teamIds: ['team-a'] }));
    const m = member({ userId: 'u-clin', isOwner: false, role: 'clinician', teamIds: ['team-a'] });
    check(() => assert.equal(access.allowed(m, person({ id: 'p-2', teamId: 'team-a', facilityId: chc }), undefined, s.operations.accessScope), false, 'before override denied'));
    applyFacilityScope(s, { type: 'setMemberLocation', version: 5, userId: 'u-clin', facilityId: chc, localityId: null }, u, owner);
    check(() => assert.equal(access.allowed(m, person({ id: 'p-2', teamId: 'team-a', facilityId: chc }), undefined, s.operations.accessScope), true, 'member override grants other facility'));
  }

  // 6. Locality enforcement resolves a patient's locality through their facility.
  {
    const s2 = state();
    let v = applyFacilityScope(s2, { type: 'addLocality', version: 0, name: 'North block' }, u, owner);
    v = applyFacilityScope(s2, { type: 'addFacility', version: v.version, name: 'North PHC', localityId: s2.operations.accessScope.localities[0].id }, u, owner);
    const northPhc = s2.operations.accessScope.facilities[0].id;
    applyFacilityScope(s2, { type: 'setTeamLocation', version: v.version, teamId: 'team-a', facilityId: northPhc, localityId: null }, u, owner);
    applyFacilityScope(s2, { type: 'setAccessScope', version: s2.operations.accessScope.version, enforceFacility: false, enforceLocality: true }, u, owner);
    const m = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    check(() => assert.equal(access.allowed(m, person({ teamId: 'team-a', facilityId: northPhc }), undefined, s2.operations.accessScope), true, 'facility-derived locality matches'));
    check(() => assert.equal(patientLocality(person({ teamId: 'team-a', facilityId: northPhc }), s2.operations.accessScope), s2.operations.accessScope.localities[0].id));
    check(() => assert.equal(access.allowed(m, person({ id: 'p-2', teamId: 'team-a', localityId: 'elsewhere' }), undefined, s2.operations.accessScope), false, 'different locality denied'));
  }

  // 7. Exceptional (emergency) access still bypasses the facility restriction for clinicians.
  {
    const m = member({ userId: 'u-clin2', isOwner: false, role: 'clinician', teamIds: ['team-a'] });
    const p = person({ id: 'p-9', teamId: 'team-a', facilityId: chc, exceptionalAccess: [{ id: 'g', userId: 'u-clin2', from: now, until: '2099-01-01T00:00:00.000Z', reason: 'Synthetic emergency reason long enough.' }] });
    check(() => assert.equal(access.allowed(m, p, now, s.operations.accessScope), true, 'emergency grant bypasses facility scope'));
  }

  // 8. Authorisation: only an owner may manage the policy; others are refused before any state changes.
  {
    const s3 = state();
    const nonOwner = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    throws(() => applyFacilityScope(s3, { type: 'addLocality', version: 0, name: 'X block' }, u, nonOwner), e => e.status === 403);
    check(() => assert.equal(accessScope(s3).localities.length, 0, 'nothing changed on refusal'));
  }

  // 9. Version conflict: a stale version is refused.
  {
    const s4 = state();
    applyFacilityScope(s4, { type: 'addLocality', version: 0, name: 'Y block' }, u, owner);
    throws(() => applyFacilityScope(s4, { type: 'addFacility', version: 0, name: 'Y PHC', localityId: null }, u, owner), e => e.status === 409);
  }

  // 10. Every mutation is audited and bumps the version exactly once.
  {
    const before = s.workspace.audit.length;
    const vBefore = s.operations.accessScope.version;
    applyFacilityScope(s, { type: 'addLocality', version: vBefore, name: 'Z block' }, u, owner);
    check(() => assert.equal(s.operations.accessScope.version, vBefore + 1));
    check(() => assert.equal(s.workspace.audit.length, before + 1));
    check(() => assert.equal(s.workspace.audit.at(-1).action, 'addLocality'));
  }

  // 11. Validation: duplicate names and unknown references are refused with clear errors.
  {
    const s5 = state();
    applyFacilityScope(s5, { type: 'addLocality', version: 0, name: 'Dup block' }, u, owner);
    throws(() => applyFacilityScope(s5, { type: 'addLocality', version: 1, name: 'dup block' }, u, owner), e => e.status === 409);
    throws(() => applyFacilityScope(s5, { type: 'addFacility', version: 1, name: 'Fac', localityId: 'missing' }, u, owner), e => e.status === 422);
    throws(() => applyFacilityScope(s5, { type: 'setTeamLocation', version: 1, teamId: 'team-a', facilityId: 'missing', localityId: null }, u, owner), e => e.status === 422);
    throws(() => applyFacilityScope(s5, { type: 'setAccessScope', version: 1, enforceFacility: true, enforceLocality: false }, u, owner), e => e.status === 422, 'no facility before enforcement');
  }

  // 12. The read view is owner-only: a non-owner gets the version and canManage=false, nothing else.
  {
    const viewOwner = facilityScopeView(s, owner);
    check(() => assert.equal(viewOwner.canManage, true));
    check(() => assert.ok(Array.isArray(viewOwner.facilities) && viewOwner.facilities.length >= 2));
    check(() => assert.ok(viewOwner.teamAssignments['team-a'].facilityName, 'team assignment decorated with a facility name'));
    const viewNonOwner = facilityScopeView(s, member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] }));
    check(() => assert.equal(viewNonOwner.canManage, false));
    check(() => assert.equal(viewNonOwner.facilities, undefined, 'non-owner sees no facility detail'));
  }

  // 13. scopeAllows is a pure, additive predicate: it never widens and is idempotent.
  {
    const m = member({ isOwner: false, role: 'supervisor', teamIds: ['team-a'] });
    const sc = s.operations.accessScope;
    check(() => assert.equal(scopeAllows(m, person({ teamId: 'team-a', facilityId: phc }), sc), true));
    check(() => assert.equal(scopeAllows(m, person({ teamId: 'team-a', facilityId: 'nope' }), sc), false));
  }

  const result = { suite: 'facility/geography access scope contract (slice feat/r08)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/facility-scope-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
