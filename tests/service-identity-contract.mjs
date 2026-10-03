// Slice feat/r13 (BR-ID-09) contract: owner-managed service identities for connectors and agents,
// with a named owner, an expiry and a single connector/agent scope; external-call paths may only
// reference a valid, unexpired, correctly-scoped identity (fail closed).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.service-identity-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['types', 'programmes', 'adapter-operations', 'core', 'fact-provenance', 'mis', 'access', 'referral-rules', 'identity', 'service-identity', 'operations'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const si = await import(pathToFileURL(join(dir, 'service-identity.js')));
  const identity = await import(pathToFileURL(join(dir, 'identity.js')));
  const operations = await import(pathToFileURL(join(dir, 'operations.js')));

  const now = '2026-10-03T00:00:00.000Z';
  const future = '2099-01-01T00:00:00.000Z';
  const past = '2000-01-01T00:00:00.000Z';
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const integration = (id, kind, over = {}) => ({ id, name: id.toUpperCase(), kind, mode: 'demo', status: 'active', version: 1, description: '', programmes: ['General care'], ...over });
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now },
    teams: [{ id: 't1', name: 'One', createdAt: now }],
    invitations: [],
    members: [
      member('own', 'clinician', ['t1'], { isOwner: true }),
      member('adm', 'admin', [], { isOwner: false }),
      member('doc', 'clinician', ['t1'], { isOwner: false }),
      member('ghost', 'clinician', ['t1'], { status: 'suspended' }),
    ],
    workspace: {
      schemaVersion: 1, revision: 1, role: 'clinician', receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [],
      integrations: [
        integration('mis1', 'mis'),
        integration('ehr1', 'ehr'),
        integration('abdm1', 'abdm'),
        integration('ai1', 'ai'),
        integration('mis2', 'mis', { status: 'suspended' }),
      ],
    },
  };
  const M = id => s.members.find(m => m.userId === id);
  const actor = id => ({ userId: id, displayName: id.toUpperCase(), email: 'x@example.invalid' });
  const apply = (userId, cmd) => si.applyServiceIdentity(s, cmd, actor(userId), M(userId));
  const create = (over = {}) => ({ type: 'serviceIdentityCreate', version: s.operations?.version ?? 0, name: 'Programme connector', kind: 'connector', targetId: 'mis1', ownerId: 'own', expiresAt: future, ...over });

  // A service identity is distinct from human principals: the schema accepts only the two new commands.
  check(() => {
    assert.ok(operations.operationsSchema.safeParse(create()).success, 'create command parses through operationsSchema');
    assert.equal(operations.operationsSchema.safeParse({ type: 'serviceIdentityCreate', version: 0, name: 'x', kind: 'connector', targetId: 'mis1', ownerId: 'own', expiresAt: future }).success, false, 'name too short refused');
    assert.equal(operations.operationsSchema.safeParse({ type: 'serviceIdentityCreate', version: 0, name: 'Good name', kind: 'robot', targetId: 'mis1', ownerId: 'own', expiresAt: future }).success, false, 'unknown kind refused');
  });

  // Only an owner may create or revoke; a non-owner command is refused before any state changes.
  check(() => {
    status(() => apply('doc', create()), 403);
    status(() => apply('adm', create()), 403);
    assert.equal(s.operations, undefined, 'nothing recorded on refusal');
    assert.equal(s.workspace.audit.length, 0);
  });

  // Creating a connector identity records owner, scope and expiry.
  const r1 = apply('own', create());
  check(() => {
    assert.ok(r1.serviceIdentityId, 'returns an id');
    const list = s.operations.serviceIdentities;
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Programme connector');
    assert.equal(list[0].kind, 'connector');
    assert.equal(list[0].targetId, 'mis1');
    assert.equal(list[0].ownerId, 'own');
    assert.equal(list[0].ownerName, 'OWN');
    assert.equal(list[0].status, 'active');
    assert.equal(list[0].expiresAt, future);
    assert.equal(s.operations.version, 1);
    assert.equal(s.workspace.audit.at(-1).action, 'serviceIdentityCreate');
    assert.match(s.workspace.audit.at(-1).detail, /accountable owner OWN; expires 2099-01-01/);
  });

  // Scope and target checks at creation.
  check(() => {
    status(() => apply('own', create({ name: 'Unknown target', targetId: 'nope' })), 422);
    status(() => apply('own', create({ name: 'Suspended connector', targetId: 'mis2' })), 422);
    status(() => apply('own', create({ name: 'Agent on a connector', kind: 'agent', targetId: 'mis1' })), 422);
    status(() => apply('own', create({ name: 'Connector on an agent', kind: 'connector', targetId: 'ai1' })), 422);
    status(() => apply('own', create({ name: 'Past expiry', expiresAt: past })), 422);
    status(() => apply('own', create({ name: 'Bad owner', ownerId: 'ghost' })), 422);
    status(() => apply('own', create({ name: 'Missing owner', ownerId: 'nobody' })), 422);
    status(() => apply('own', create({ name: 'Duplicate', ...{ name: 'Programme connector' } })), 409);
    status(() => apply('own', create({ name: 'Stale version', version: 99 })), 409);
  });

  // An agent identity for an AI provider is allowed.
  check(() => {
    const a = apply('own', { type: 'serviceIdentityCreate', version: s.operations.version, name: 'Evidence assistant', kind: 'agent', targetId: 'ai1', ownerId: 'own', expiresAt: future });
    assert.ok(a.serviceIdentityId);
    assert.equal(s.operations.serviceIdentities.at(-1).kind, 'agent');
  });

  // Enforcement: only a valid, unexpired, correctly-scoped identity may be referenced.
  const conn = s.operations.serviceIdentities.find(x => x.name === 'Programme connector');
  const agentId = s.operations.serviceIdentities.find(x => x.name === 'Evidence assistant');
  check(() => {
    assert.equal(si.requireServiceIdentity(s, conn.id, 'connector', 'mis1', now).id, conn.id, 'valid connector identity passes');
    assert.equal(si.requireServiceIdentity(s, agentId.id, 'agent', 'ai1', now).id, agentId.id, 'valid agent identity passes');
    status(() => si.requireServiceIdentity(s, 'missing', 'connector', 'mis1', now), 404);
    status(() => si.requireServiceIdentity(s, conn.id, 'agent', 'mis1', now), 403);
    status(() => si.requireServiceIdentity(s, conn.id, 'connector', 'ehr1', now), 403);
    status(() => si.requireServiceIdentity(s, conn.id, 'connector', 'mis1', '2100-01-01T00:00:00.000Z'), 403, 'expired');
  });

  // The boolean form mirrors the throwing form, and the identity predicate judges the record alone.
  check(() => {
    assert.equal(si.validServiceIdentity(s, conn.id, 'connector', 'mis1', now), true);
    assert.equal(si.validServiceIdentity(s, conn.id, 'agent', 'mis1', now), false);
    assert.equal(si.validServiceIdentity(s, conn.id, 'connector', 'mis1', '2100-01-01T00:00:00.000Z'), false, 'expired is invalid');
    assert.equal(identity.serviceIdentityIsValid({ ...conn, expiresAt: future }, now), true);
    assert.equal(identity.serviceIdentityIsValid({ ...conn, expiresAt: past }, now), false);
    assert.equal(identity.serviceIdentityIsValid({ ...conn, status: 'revoked' }, now), false);
  });

  // Revocation stops the identity's references without touching the other identity.
  check(() => {
    status(() => apply('doc', { type: 'serviceIdentityRevoke', version: s.operations.version, id: conn.id }), 403);
    const r = apply('own', { type: 'serviceIdentityRevoke', version: s.operations.version, id: conn.id });
    assert.equal(r.revoked, true);
    const revoked = s.operations.serviceIdentities.find(x => x.id === conn.id);
    assert.equal(revoked.status, 'revoked');
    assert.ok(revoked.revokedAt);
    assert.equal(revoked.revokedBy, 'own');
    status(() => si.requireServiceIdentity(s, conn.id, 'connector', 'mis1', now), 403, 'revoked identity is refused');
    assert.equal(si.requireServiceIdentity(s, agentId.id, 'agent', 'ai1', now).id, agentId.id, 'the other identity is unaffected');
    status(() => apply('own', { type: 'serviceIdentityRevoke', version: s.operations.version, id: conn.id }), 409, 'revoke again');
    status(() => apply('own', { type: 'serviceIdentityRevoke', version: s.operations.version, id: 'none' }), 404);
  });

  // The 100-identity bound is enforced.
  check(() => {
    s.operations.serviceIdentities = Array.from({ length: 100 }, (_, i) => ({ id: 'si-' + i, name: 'filler-' + i, kind: 'connector', targetId: 'mis1', ownerId: 'own', ownerName: 'OWN', createdAt: now, createdBy: 'own', expiresAt: future, status: 'active' }));
    status(() => apply('own', { type: 'serviceIdentityCreate', version: s.operations.version, name: 'One too many', kind: 'connector', targetId: 'mis1', ownerId: 'own', expiresAt: future }), 422);
  });

  // applyOperations delegates service-identity commands to the same lifecycle.
  check(() => {
    const fresh = {
      organisation: { id: 'org2', name: 'Synthetic 2', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }], invitations: [],
      members: [member('own', 'clinician', ['t1'], { isOwner: true })],
      workspace: { schemaVersion: 1, revision: 1, role: 'clinician', receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [], integrations: [integration('mis1', 'mis')] },
    };
    const res = operations.applyOperations(fresh, { type: 'serviceIdentityCreate', version: 0, name: 'Via operations', kind: 'connector', targetId: 'mis1', ownerId: 'own', expiresAt: future }, actor('own'), M('own'));
    assert.ok(res.serviceIdentityId, 'applyOperations returns the create result');
    assert.equal(fresh.operations.serviceIdentities.length, 1);
  });

  const result = { suite: 'service identity contract (slice feat/r13)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/service-identity-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
