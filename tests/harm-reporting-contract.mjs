import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.harm-reporting-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refused = async (fn, status, pattern) => {
  try { await fn(); } catch (error) {
    assert.equal(error.status, status, error.message);
    assert.match(error.message, pattern);
    passed++;
    return;
  }
  assert.fail(`expected ${status}`);
};

try {
  for (const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types']) {
    const output = ts.transpileModule(readFileSync(`lib/saha/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, `${file}.js`), output);
  }
  const { applyGovernance } = await import(pathToFileURL(join(dir, 'governance.js')));
  const now = '2026-10-16T09:00:00.000Z';
  const actor = member => ({ userId: member.userId, displayName: member.displayName });
  const member = (userId, role, teamIds = ['team-a']) => ({ userId, displayName: `Synthetic ${userId}`, accountCode: userId, role, status: 'active', teamIds, version: 1, isOwner: false });
  const reporter = member('asha-a', 'asha'), outsider = member('asha-b', 'asha', ['team-b']), supervisor = member('sup-a', 'supervisor');
  const owner = member('clin-a', 'clinician'), backup = member('clin-b', 'clinician'), admin = member('admin', 'admin');
  const person = { id: 'person-a', name: 'Synthetic Person', age: 32, sex: 'Unknown', village: 'Fixture', programmes: ['General care'], task: '', due: '', status: 'in_progress', aiConsent: true, exchangeConsent: true, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'team-a', assignedTo: reporter.userId };
  const run = { id: 'run-a', actorId: reporter.userId, provider: { id: 'local', name: 'Local fixture', model: 'rules', mode: 'local' }, status: 'review', createdAt: now, callCount: 1, governance: { id: 'cap-a', version: 3, manifestHash: 'a'.repeat(64) } };
  const visit = { id: 'visit-a', personId: person.id, version: 4, recordVersion: 7, state: 'draft', facts: { date: '2026-10-16T09:00', notes: '' }, agentRuns: [run], protocolChecks: [] };
  const capability = { id: 'cap-a', revision: 3, version: 5, manifestHash: 'a'.repeat(64), createdBy: owner.userId, createdAt: now, state: 'active', history: [], spec: { kind: 'capability', key: 'fixture-capability', title: 'Synthetic capability', ownerId: owner.userId, teamIds: ['team-a'], effectiveFrom: '2026-01-01', reviewBy: '2027-01-01', changeSummary: 'Synthetic fixture only.', providerId: 'local', model: 'rules', agentVersion: 'fixture', purpose: 'documentary-evidence', ageMin: 0, ageMax: 120, roles: ['asha'], languages: ['en'], settings: ['community'], devices: ['browser'], tasks: ['extract'], excludedUses: 'No clinical decision.', supportContact: 'Fixture owner', hostingRegion: 'Local', retentionTerms: 'Fixture only.', trainingUse: 'not-authorised', agreementReference: 'FIXTURE', dailyCallLimit: 10, dailyTokenBudget: 6000 } };
  const state = { organisation: { id: 'org' }, teams: [{ id: 'team-a', name: 'Team A' }, { id: 'team-b', name: 'Team B' }], members: [reporter, outsider, supervisor, owner, backup, admin], workspace: { people: [person], visits: [visit], referrals: [], audit: [], integrations: [] }, governance: { entries: [capability], evaluations: [], safety: [] } };
  const command = (input, who = reporter, at = now) => applyGovernance(state, input, actor(who), who, at);
  const body = { type: 'reportSafety', visitId: visit.id, version: visit.version, ownerId: owner.userId, kind: 'misleading-output', summary: 'Synthetic misleading output retained during provider failure.', entryId: capability.id, hold: false };

  // A permitted encounter worker can file while the provider is unavailable: reporting is a local governed write.
  const opened = await command(body);
  const safety = state.governance.safety.find(row => row.id === opened.caseId);
  check(() => {
    assert.equal(safety.state, 'open');
    assert.equal(safety.ownerId, owner.userId);
    assert.deepEqual(safety.evidence.agentRuns.map(row => row.id), [run.id]);
    assert.deepEqual(safety.evidence.affectedReview.agentRunIds, [run.id]);
    assert.equal(safety.evidence.package.manifestHash, capability.manifestHash);
    assert.equal(safety.evidence.visitVersion, 4);
    assert.equal(safety.evidence.recordVersion, 7);
    assert.deepEqual(safety.actions.map(row => row.kind), ['opened']);
  });

  // Patient scope and care-role checks fail before any second case or package mutation.
  const before = state.governance.safety.length;
  await refused(() => command({ ...body, summary: 'Synthetic out of scope report must be refused.' }, outsider), 403, /Patient access/);
  await refused(() => command({ ...body, summary: 'Synthetic supervisor report must be refused.' }, supervisor), 403, /care role/);
  await refused(() => command({ ...body, summary: 'Synthetic administrator report must be refused.' }, admin), 403, /Patient access/);
  check(() => assert.equal(state.governance.safety.length, before));

  // Only a scoped clinician may initiate a hold; its exact package version and affected run remain in the case.
  await refused(() => command({ ...body, summary: 'A worker cannot place the capability on hold.', hold: true }), 403, /clinician/);
  const held = await command({ ...body, summary: 'Clinician places a synthetic safety hold for affected-case review.', hold: true }, owner, '2026-10-16T09:01:00.000Z');
  const heldCase = state.governance.safety.find(row => row.id === held.caseId);
  check(() => {
    assert.equal(capability.state, 'suspended');
    assert.equal(heldCase.evidence.package.state, 'active');
    assert.equal(heldCase.evidence.package.version, 5);
    assert.deepEqual(heldCase.evidence.affectedReview.visitIds, [visit.id]);
  });

  // Assignment and resolution append accountability; stale and repeated changes are refused.
  await refused(() => command({ type: 'assignSafety', caseId: opened.caseId, version: 99, ownerId: backup.userId, reason: 'Stale assignment attempt.' }, owner), 409, /changed/);
  await command({ type: 'assignSafety', caseId: opened.caseId, version: 1, ownerId: backup.userId, reason: 'Backup clinician owns the containment follow-up.' }, owner, '2026-10-16T09:02:00.000Z');
  await refused(() => command({ type: 'resolveSafety', caseId: opened.caseId, version: 2, reason: 'Original owner cannot close after reassignment.', reference: 'FIXTURE-OLD' }, owner), 403, /current clinical case owner/);
  await command({ type: 'resolveSafety', caseId: opened.caseId, version: 2, reason: 'Synthetic evidence reviewed and containment follow-up recorded.', reference: 'FIXTURE-RESOLUTION' }, backup, '2026-10-16T09:03:00.000Z');
  check(() => {
    assert.equal(safety.state, 'closed');
    assert.equal(safety.version, 3);
    assert.deepEqual(safety.actions.map(row => row.kind), ['opened', 'assigned', 'resolved']);
    assert.equal(safety.actions[1].fromOwnerId, owner.userId);
    assert.equal(safety.actions[1].toOwnerId, backup.userId);
    assert.equal(safety.actions[2].reference, 'FIXTURE-RESOLUTION');
  });
  await refused(() => command({ type: 'resolveSafety', caseId: opened.caseId, version: 3, reason: 'Closed cases remain immutable.', reference: 'FIXTURE-REPEAT' }, backup), 409, /closed/);

  writeFileSync('tests/harm-reporting-contract-result.json', `${JSON.stringify({ passed, suite: 'harm-reporting-contract', completedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(JSON.stringify({ passed }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
