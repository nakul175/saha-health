// Slice 1e delegation contract: who may delegate what to whom, expiry, revocation, enforcement and audit.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.delegation-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'delegation.js')));
  const r = await import(pathToFileURL(join(dir, 'rights.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', at = h => new Date(Date.parse(now) + h * 3600000).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 40, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }, { id: 't2', name: 'Two', createdAt: now }], invitations: [],
    operations: { version: 1, maintenance: false, reason: '', updatedAt: now, incidents: [], rates: null },
    members: [member('own', 'clinician', ['t1', 't2'], { isOwner: true }), member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t2']), member('doc', 'clinician', ['t1']), member('doc2', 'clinician', ['t2']), member('asha', 'asha', ['t1']), member('adm', 'admin', [], { isOwner: true })],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [],
      people: [{ ...base, id: 'P', name: 'Patient P', teamId: 't1', assignedTo: 'asha' }, { ...base, id: 'Q', name: 'Patient Q', teamId: 't2', assignedTo: null }] },
  };
  const M = id => s.members.find(m => m.userId === id), P = s.workspace.people[0], Q = s.workspace.people[1];
  const as = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = allowed(m, p); return m; };
  const actor = userId => ({ userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' });
  const apply = (userId, cmd, when = now) => x.applyDelegation(s, cmd, actor(userId), as(userId), when);
  const grant = (over = {}) => ({ type: 'delegationGrant', kind: 'team-supervision', delegateId: 'doc', teamIds: ['t1'], until: at(72), reason: 'Supervisor on leave this week', ...over });
  const D = id => s.operations.delegations.find(d => d.id === id);

  // Who may delegate, and to whom.
  check(() => { status(() => apply('doc', grant({ delegateId: 'doc2' })), 403); status(() => apply('asha', grant()), 403); status(() => apply('adm', grant()), 403); status(() => apply('sup', grant({ teamIds: ['t2'] })), 403); status(() => apply('sup', grant({ kind: 'reporting', delegateId: 'doc' })), 403); });
  check(() => { status(() => apply('sup', grant({ delegateId: 'asha' })), 422); status(() => apply('sup', grant({ delegateId: 'doc2' })), 422); status(() => apply('sup', grant({ delegateId: 'sup2' })), 422); status(() => apply('sup', grant({ delegateId: 'sup' })), 422); status(() => apply('sup', grant({ delegateId: 'ghost' })), 422); status(() => apply('sup', grant({ delegateId: 'own' })), 422); });
  check(() => { status(() => apply('sup', grant({ until: at(-1) })), 422); status(() => apply('sup', grant({ until: at(24 * 31) })), 422); status(() => apply('own', grant({ kind: 'reporting', delegateId: 'asha' })), 422); status(() => apply('own', grant({ kind: 'reporting', delegateId: 'adm' })), 422); status(() => apply('own', grant({ teamIds: ['t9'] })), 403); });
  check(() => { assert.equal(apply('sup', { ...grant(), reason: 'short' }), null, 'schema requires a reason'); assert.equal(apply('sup', { ...grant(), teamIds: ['t1', 't1'] }), null); assert.equal(apply('sup', { type: 'rightsCreate' }), null); assert.equal(s.operations.delegations, undefined, 'nothing recorded on refusal'); assert.equal(s.workspace.audit.length, 0); });

  // Before a grant, a clinician is not a team steward.
  check(() => { assert.equal(x.supervises(s, M('doc'), 't1', now), false); assert.equal(x.supervises(s, M('sup'), 't1', now), true); assert.equal(x.supervises(s, M('own'), 't2', now), true); assert.equal(x.supervises(s, M('adm'), 't1', now), false); assert.equal(s.delegationUsed, undefined, 'own authority is not recorded as delegated'); });
  const g1 = apply('sup', grant());
  const d1 = D(g1.delegationId);
  check(() => { assert.equal(d1.grantorId, 'sup'); assert.equal(d1.delegateId, 'doc'); assert.equal(d1.from, now); assert.equal(d1.until, at(72)); assert.equal(d1.version, 1); const a = s.workspace.audit.at(-1); assert.equal(a.action, 'delegationGrant'); assert.equal(a.subject, d1.id); assert.match(a.detail, /Team supervision delegated to DOC for One until 2026-10-03 06:00 UTC\. Supervisor on leave/); });
  check(() => { status(() => apply('sup', grant()), 409); status(() => apply('own', grant()), 409); });

  // Enforcement: supervision in force for the team only, recorded once, and ended by time.
  check(() => { assert.equal(x.supervises(s, M('doc'), 't1', at(1)), true); assert.equal(x.supervises(s, M('doc'), 't2', at(1)), false); assert.equal(x.supervises(s, M('doc'), 't1', at(1)), true); assert.deepEqual(s.delegationUsed.map(u => u.id), [d1.id]); assert.equal(x.supervises(s, M('doc'), 't1', at(72)), false, 'ends at its end time'); assert.equal(x.supervises(s, M('doc'), 't1', at(-1)), false, 'not before it starts'); });
  check(() => { x.delegationAudit(s, actor('doc'), M('doc'), 'rightsAssign', 'P', at(1)); const a = s.workspace.audit.at(-1); assert.equal(a.action, 'delegatedAuthority'); assert.equal(a.subject, d1.id); assert.equal(a.personId, 'P'); assert.match(a.detail, /rightsAssign carried out under team supervision delegated by SUP, in force until 2026-10-03 06:00 UTC/); assert.equal(s.delegationUsed, undefined); });
  // A delegation never outlives the grantor's own authority or the delegate's eligibility.
  check(() => { M('sup').role = 'clinician'; assert.equal(x.supervises(s, M('doc'), 't1', at(1), false), false); M('sup').role = 'supervisor'; M('sup').status = 'suspended'; assert.equal(x.supervises(s, M('doc'), 't1', at(1), false), false); M('sup').status = 'active'; M('doc').teamIds = ['t2']; assert.equal(x.supervises(s, M('doc'), 't1', at(1), false), false); M('doc').teamIds = ['t1']; assert.equal(x.supervises(s, M('doc'), 't1', at(1), false), true); });

  // The rights stewardship checks use the delegation.
  s.rightsRequests = [];
  const rq = r.applyRights(s, { type: 'rightsCreate', personId: 'P', kind: 'access', channel: 'in-person', requester: 'self', identityCheck: 'ANC card seen', detail: 'Wants a copy of her visit records' }, actor('asha'), as('asha'), at(1));
  delete s.delegationUsed;
  r.applyRights(s, { type: 'rightsAssign', requestId: rq.requestId, version: 1, ownerId: 'doc', note: 'Delegate assigns to self for cover' }, actor('doc'), as('doc'), at(1));
  check(() => { assert.equal(s.rightsRequests[0].ownerId, 'doc'); assert.deepEqual(s.delegationUsed.map(u => u.id), [d1.id]); delete s.delegationUsed; status(() => r.applyRights(s, { type: 'rightsAssign', requestId: rq.requestId, version: 2, ownerId: 'asha', note: 'Assignment after the delegation ended' }, actor('doc'), as('doc'), at(80)), 403); });
  check(() => { const v = r.rightsView(s, as('doc'), 'P', at(1)); assert.equal(v.requests[0].canAssign, true); assert.equal(r.rightsView(s, as('doc'), 'P', at(80)).requests[0].canAssign, false); });

  // Reporting-only access: aggregates for the delegated teams, never widening a clinician's own report.
  check(() => { status(() => x.reportingScope(s, M('doc2'), now), 403); status(() => x.reportingScope(s, M('asha'), now), 403); const sup = x.reportingScope(s, M('sup'), now); assert.equal(sup.own, true); assert.deepEqual(sup.teams, ['t1']); assert.equal(sup.include(Q), false); });
  const g2 = apply('own', grant({ kind: 'reporting', delegateId: 'doc2', teamIds: ['t1'], reason: 'Programme review needs team One figures' }));
  const g3 = apply('own', grant({ kind: 'reporting', delegateId: 'sup', teamIds: ['t2'], reason: 'Cross-team review for the district' }));
  check(() => { const doc2 = x.reportingScope(s, M('doc2'), at(1)); assert.equal(doc2.own, false); assert.deepEqual(doc2.teams, ['t1']); assert.equal(doc2.include(P), true); assert.equal(doc2.include(Q), false, 'the delegate\'s own team is not added'); assert.deepEqual(doc2.delegations.map(d => d.id), [g2.delegationId]); });
  check(() => { const sup = x.reportingScope(s, M('sup'), at(1)); assert.deepEqual(sup.teams.sort(), ['t1', 't2']); assert.equal(sup.include(Q), true); assert.equal(x.supervises(s, M('doc2'), 't1', at(1), false), false, 'reporting grants no supervision'); status(() => x.reportingScope(s, M('doc2'), at(80)), 403); });

  // Revocation: grantor, delegate or owner; version and state checks.
  check(() => { status(() => apply('doc2', { type: 'delegationRevoke', delegationId: g1.delegationId, version: 1, reason: 'Not mine to revoke' }), 403); status(() => apply('sup2', { type: 'delegationRevoke', delegationId: g1.delegationId, version: 1, reason: 'Not mine to revoke' }), 403); status(() => apply('sup', { type: 'delegationRevoke', delegationId: 'none', version: 1, reason: 'Unknown delegation' }), 404); status(() => apply('sup', { type: 'delegationRevoke', delegationId: g1.delegationId, version: 2, reason: 'Stale version test' }), 409); });
  apply('doc', { type: 'delegationRevoke', delegationId: g1.delegationId, version: 1, reason: 'Supervisor returned early' }, at(2));
  check(() => { assert.equal(d1.revokedAt, at(2)); assert.equal(d1.revokedBy, 'doc'); assert.equal(d1.version, 2); assert.match(s.workspace.audit.at(-1).detail, /revoked by the delegate\. Supervisor returned early/); assert.equal(x.supervises(s, M('doc'), 't1', at(3)), false); status(() => apply('sup', { type: 'delegationRevoke', delegationId: g1.delegationId, version: 2, reason: 'Revoking a second time' }, at(3)), 409); });
  check(() => { apply('adm', { type: 'delegationRevoke', delegationId: g3.delegationId, version: 1, reason: 'Owner ends the cross-team review' }, at(2)); assert.equal(D(g3.delegationId).revokedBy, 'adm'); status(() => apply('own', { type: 'delegationRevoke', delegationId: g2.delegationId, version: 1, reason: 'Revoking after it ended' }, at(80)), 409); });
  check(() => { const g4 = apply('sup', grant({ reason: 'A new cover period after revocation' }), at(3)); assert.ok(g4.delegationId, 'a revoked delegation no longer blocks a new one'); });

  // Bounds and views.
  check(() => { s.teams.push({ id: 't3', name: 'Three', createdAt: now }); M('own').teamIds.push('t3'); s.members.push(member('doc3', 'clinician', ['t1', 't2', 't3'])); for (const [k, t] of [['team-supervision', 't1'], ['team-supervision', 't2'], ['reporting', 't1'], ['reporting', 't2'], ['reporting', 't3']]) apply('own', grant({ kind: k, delegateId: 'doc3', teamIds: [t], reason: 'Filling the delegation limit' }), at(3)); status(() => apply('sup', grant({ delegateId: 'doc3', reason: 'Would duplicate a team' }), at(3)), 409); status(() => apply('own', grant({ delegateId: 'doc3', teamIds: ['t3'], reason: 'A sixth delegation in force' }), at(3)), 422); });
  check(() => { const v = x.delegationView(s, as('doc'), at(3)); assert.ok(v.delegations.every(d => d.grantorId === 'doc' || d.delegateId === 'doc')); assert.equal(v.grantable.length, 0); const o = x.delegationView(s, as('own'), at(3)); assert.equal(o.delegations.length, s.operations.delegations.length); assert.deepEqual(o.grantable.map(g => g.kind), ['team-supervision', 'reporting']); assert.ok(o.delegations.some(d => d.state === 'revoked')); const sv = x.delegationView(s, as('sup'), at(3)); assert.deepEqual(sv.grantable.map(g => g.kind), ['team-supervision']); assert.deepEqual(sv.grantable[0].delegates.map(d => d.userId).sort(), ['doc', 'doc3']); });
  check(() => { assert.equal(x.holds(M('adm'), 'reporting', []), false); assert.equal(x.qualifies(M('sup'), 'reporting', ['t2']), true); assert.equal(x.qualifies(M('sup'), 'team-supervision', ['t1']), false); assert.equal(x.MAX_DAYS, 30); });

  const result = { suite: 'delegation contract (slice 1e)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/delegation-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
