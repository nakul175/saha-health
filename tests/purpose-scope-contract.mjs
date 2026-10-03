import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// Slice r09: programme and purpose dimensions in the access policy (BR-ID-02, BR-DATA-10).
const dir = mkdtempSync(join(process.cwd(), '.purpose-scope-')); let passed = 0; const failures = [];
const check = async (name, f) => { try { await f(); passed++; } catch (e) { failures.push(name + ': ' + (e?.message ?? e)); } };
const rejects = async (f, status, re) => { let err; try { await f(); } catch (e) { err = e; } assert.ok(err, 'expected a refusal'); assert.equal(err.status, status, err.message); if (re) assert.match(err.message, re); return err; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types']) {
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  }
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const A = await imp('access'), P = await imp('purpose-scope');

  const member = (userId, extra = {}) => ({ userId, displayName: userId + ' name', accountCode: 'ACCT', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: new Date().toISOString(), ...extra });
  const person = (id, teamId, programmes, extra = {}) => ({ id, name: 'Person ' + id, teamId, programmes, version: 1, ...extra });
  const owner = member('own', { isOwner: true });
  const worker = member('worker');
  const supervisor = member('sup', { role: 'supervisor' });
  const admin = member('adm', { role: 'admin' });
  const provider = member('prov', { role: 'provider' });
  const state = (members) => ({ organisation: { id: 'org', revision: 1 }, members, teams: [{ id: 't1', name: 'Team' }], workspace: { role: 'clinician', people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [] } });

  // 1. The scope check defaults to current behaviour when no grant is set, and narrows when one is.
  await check('default equals allowed', () => {
    const p = person('p1', 't1', ['Maternal care', 'General care']);
    const p2 = person('p2', 't2', ['TB screening', 'General care']);
    assert.equal(A.allowedFor(worker, p, undefined), A.allowed(worker, p));
    assert.equal(A.allowedFor(worker, p2, undefined), A.allowed(worker, p2));
    assert.equal(A.allowedFor(worker, p, []), true);
    assert.equal(A.allowedFor(worker, p2, []), false);
  });
  await check('programme tag narrows record scope', () => {
    const grants = [{ id: 'g1', memberId: 'worker', programme: 'Maternal care', purposes: [], version: 1, setBy: 'own', setAt: 'now', reason: 'x'.repeat(12) }];
    const maternal = person('p1', 't1', ['Maternal care', 'General care']);
    const tb = person('p2', 't1', ['TB screening', 'General care']);
    assert.equal(A.allowedFor(worker, maternal, grants), true);
    assert.equal(A.allowedFor(worker, tb, grants), false);
    assert.equal(A.programmeScopeOf(worker, grants), 'Maternal care');
    assert.equal(A.programmeScopeOf(supervisor, grants), null);
  });
  await check('purpose tag narrows data flows only', () => {
    const grants = [{ id: 'g2', memberId: 'worker', programme: null, purposes: ['ai-assistance'], version: 1, setBy: 'own', setAt: 'now', reason: 'x'.repeat(12) }];
    const p = person('p1', 't1', ['General care']);
    assert.equal(A.allowedFor(worker, p, grants), true, 'a plain read is not narrowed by a purpose-only grant');
    assert.equal(A.allowedFor(worker, p, grants, 'ai-assistance'), true);
    assert.equal(A.allowedFor(worker, p, grants, 'reporting'), false);
    assert.equal(A.allowedFor(worker, p, grants, 'programme-delivery'), false);
  });
  await check('programme and purpose together intersect, and revoked grants are ignored', () => {
    const grants = [{ id: 'g3', memberId: 'worker', programme: 'Maternal care', purposes: ['reporting'], version: 1, setBy: 'own', setAt: 'now', reason: 'x'.repeat(12), revokedAt: 'later', revokedBy: 'own', revokeReason: 'y'.repeat(12) }];
    const maternal = person('p1', 't1', ['Maternal care', 'General care']);
    const tb = person('p2', 't1', ['TB screening', 'General care']);
    assert.equal(A.allowedFor(worker, maternal, grants, 'reporting'), true, 'revoked grant no longer narrows');
    assert.equal(A.allowedFor(worker, tb, grants, 'reporting'), true);
    const active = [{ id: 'g4', memberId: 'worker', programme: 'Maternal care', purposes: ['reporting'], version: 1, setBy: 'own', setAt: 'now', reason: 'x'.repeat(12) }];
    assert.equal(A.allowedFor(worker, maternal, active, 'reporting'), true);
    assert.equal(A.allowedFor(worker, maternal, active, 'ai-assistance'), false, 'programme matches but the purpose does not');
    assert.equal(A.allowedFor(worker, tb, active, 'reporting'), false, 'purpose matches but the programme does not');
  });
  await check('never widens: an out-of-scope member stays out', () => {
    const p = person('p1', 't2', ['General care']);
    assert.equal(A.allowedFor(worker, p, []), false);
    assert.equal(A.allowedFor(worker, p, [{ id: 'g', memberId: 'worker', programme: null, purposes: ['ai-assistance'], version: 1, setBy: 'own', setAt: 'now', reason: 'x'.repeat(12) }]), false);
  });

  // 2. Owner-managed, versioned, audited, additive command path.
  await check('command path owner-only and schema-checked', async () => {
    const s = state([owner, worker, supervisor, admin, provider]);
    const cmd = { type: 'setAccessPurpose', memberId: 'worker', version: 0, programme: 'Maternal care', purposes: [], reason: 'Narrow to the maternal programme only.' };
    assert.equal(P.applyPurposeScope(s, { type: 'configureMis' }, owner, owner), null, 'foreign commands return null');
    await rejects(() => P.applyPurposeScope(s, cmd, owner, worker), 403, /Only an organisation owner/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, programme: null }, owner, owner), 422, /programme, at least one purpose/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, purposes: ['ai-assistance', 'ai-assistance'] }, owner, owner), 422, /List each purpose once/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, memberId: 'nobody' }, owner, owner), 422, /active member/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, memberId: 'own' }, owner, owner), 422, /own scope/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, memberId: 'adm' }, owner, owner), 422, /no patient scope/);
    await rejects(() => P.applyPurposeScope(s, { ...cmd, memberId: 'prov' }, owner, owner), 422, /no patient scope/);
    const r = P.applyPurposeScope(s, cmd, owner, owner);
    assert.deepEqual(r, { grantId: s.operations.purposeGrants[0].id, version: 1 });
    const g = s.operations.purposeGrants[0];
    assert.equal(g.memberId, 'worker'); assert.equal(g.programme, 'Maternal care'); assert.deepEqual(g.purposes, []); assert.equal(g.setBy, 'own'); assert.equal(g.version, 1);
    assert.equal(s.workspace.audit.at(-1).action, 'setAccessPurpose');
    assert.match(s.workspace.audit.at(-1).detail, /narrowed to programme Maternal care/);
    await rejects(() => P.applyPurposeScope(s, cmd, owner, owner), 409, /already has an active programme\/purpose scope/);
  });
  await check('revoke is versioned, audited and additive', async () => {
    const s = state([owner, worker]);
    const g = P.applyPurposeScope(s, { type: 'setAccessPurpose', memberId: 'worker', version: 0, programme: null, purposes: ['reporting'], reason: 'Reporting only access.' }, owner, owner);
    await rejects(() => P.applyPurposeScope(s, { type: 'revokeAccessPurpose', grantId: g.grantId, version: 9, reason: 'Wrong version sent.' }, owner, owner), 409, /changed/);
    const r = P.applyPurposeScope(s, { type: 'revokeAccessPurpose', grantId: g.grantId, version: 1, reason: 'No longer needed.' }, owner, owner);
    assert.deepEqual(r, { grantId: g.grantId, version: 2 });
    const stored = s.operations.purposeGrants[0];
    assert.equal(stored.version, 2); assert.ok(stored.revokedAt); assert.equal(stored.revokedBy, 'own'); assert.equal(stored.revokeReason, 'No longer needed.');
    assert.equal(s.workspace.audit.at(-1).action, 'revokeAccessPurpose');
    await rejects(() => P.applyPurposeScope(s, { type: 'revokeAccessPurpose', grantId: g.grantId, version: 2, reason: 'Revoked once already.' }, owner, owner), 409, /already revoked/);
    assert.equal(P.grantFor(s, worker), undefined, 'a revoked grant no longer narrows');
    await rejects(() => P.applyPurposeScope(s, { type: 'revokeAccessPurpose', grantId: 'missing', version: 1, reason: 'Grant is not found.' }, owner, owner), 404, /not found/);
  });
  await check('replay authorisation matches the apply rule', () => {
    const s = state([owner, worker]);
    P.authorizePurposeScope(s, owner, { type: 'setAccessPurpose' }); // owner passes
    let err; try { P.authorizePurposeScope(s, worker, { type: 'setAccessPurpose' }); } catch (e) { err = e; }
    assert.ok(err); assert.equal(err.status, 403);
    assert.doesNotThrow(() => P.authorizePurposeScope(s, worker, { type: 'saveVisit' })); // not our command
  });

  // 3. The read view is scoped to the viewer.
  await check('view is scoped: owners see all, members see their own', () => {
    const s = state([owner, worker, supervisor]);
    P.applyPurposeScope(s, { type: 'setAccessPurpose', memberId: 'worker', version: 0, programme: 'TB screening', purposes: [], reason: 'TB team scope only.' }, owner, owner);
    const ownerView = P.purposeScopeView(s, owner);
    assert.equal(ownerView.grants.length, 1);
    assert.equal(ownerView.grants[0].memberId, 'worker');
    assert.equal(ownerView.grants[0].state, 'active');
    assert.ok(ownerView.grantable.some(x => x.userId === 'worker'));
    const workerView = P.purposeScopeView(s, worker);
    assert.equal(workerView.grants.length, 1, 'a member sees their own grant');
    const supView = P.purposeScopeView(s, supervisor);
    assert.equal(supView.grants.length, 0, 'an unrelated member sees no grant');
    assert.equal(workerView.programmes.length, 5);
    assert.equal(workerView.purposes.length, 5);
  });
  await check('no secrets in the stored setting', () => {
    const s = state([owner, worker]);
    P.applyPurposeScope(s, { type: 'setAccessPurpose', memberId: 'worker', version: 0, programme: null, purposes: ['ai-assistance'], reason: 'AI-assisted flows only.' }, owner, owner);
    assert.equal(JSON.stringify(s).includes('SAHA_'), false);
  });

  assert.deepEqual(failures, []);
  writeFileSync('tests/purpose-scope-contract-result.json', JSON.stringify({ suite: 'purpose-scope-contract', passed, failed: 0, at: new Date().toISOString() }, null, 1) + '\n');
  console.log(JSON.stringify({ suite: 'purpose-scope-contract', passed }));
} catch (e) { console.error(e); console.error(failures.join('\n')); process.exitCode = 1; } finally { rmSync(dir, { recursive: true, force: true }); }
