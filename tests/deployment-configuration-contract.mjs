import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.deployment-configuration-'));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; };
const refuses = async (name, fn, status, pattern) => check(name, async () => { let error; try { await fn(); } catch (e) { error = e; } assert.ok(error, 'expected refusal'); assert.equal(error.status, status); if (pattern) assert.match(error.message, pattern); });
try {
  for (const file of readdirSync('lib/saha').filter(x => x.endsWith('.ts'))) writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync('lib/saha/' + file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const D = await import(pathToFileURL(join(dir, 'deployment-configuration.js')));
  const now = '2026-10-20T10:00:00.000Z';
  const owner = { userId: 'owner-a', displayName: 'Owner A', accountCode: 'OWNER', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['team-a'], createdAt: now, language: 'en' };
  const reviewer = { userId: 'reviewer-a', displayName: 'Reviewer A', accountCode: 'REVIEWER', role: 'admin', isOwner: false, status: 'active', version: 3, teamIds: [], createdAt: now, language: 'hi' };
  const worker = { userId: 'worker-a', displayName: 'Worker A', accountCode: 'WORKER', role: 'asha', isOwner: false, status: 'active', version: 2, teamIds: ['team-a'], createdAt: now, language: 'en' };
  const actor = m => ({ userId: m.userId, displayName: m.displayName, email: `${m.userId}@example.invalid` });
  const makeState = (id = 'org-a') => ({
    organisation: { id, name: id === 'org-a' ? 'Tenant A' : 'Tenant B', revision: 4, createdAt: now },
    teams: [{ id: 'team-a', name: 'Team A', createdAt: now }], members: [structuredClone(owner), structuredClone(reviewer), structuredClone(worker)], invitations: [],
    operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, memberLanguages: { [reviewer.userId]: { language: 'hi', version: 1, at: now } }, accessScope: { version: 2, enforceFacility: false, enforceLocality: false, localities: [{ id: 'loc-a', name: 'Block A', createdAt: now }], facilities: [{ id: 'fac-a', name: 'PHC A', localityId: 'loc-a', createdAt: now }], teamAssignments: {}, memberAssignments: {}, updatedAt: now, updatedBy: owner.userId } },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [{ id: 'p1', name: 'Synthetic Person', age: 30, sex: 'Female', village: 'Village', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'team-a', assignedTo: worker.userId }], visits: [], integrations: [{ id: 'mis-a', name: 'Synthetic MIS', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: 'Synthetic only', programmes: ['General care'] }], submissions: [], referrals: [], audit: [], receipts: {} },
  });
  const settings = s => ({ organisationId: s.organisation.id, localityIds: ['loc-a'], facilityIds: ['fac-a'], roles: ['clinician', 'admin', 'asha'], programmes: ['General care'], languages: ['en', 'hi'], providerEligibility: [{ integrationId: 'mis-a', eligible: true }], limits: { activeMembers: 3, patientRecords: 2, externalConnections: 1 } });
  const stage = (s, m = owner, over = {}) => D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationStage', version: s.operations.deploymentConfiguration?.version ?? 0, settings: settings(s), reason: 'Synthetic tenant configuration qualification.', ...over }, actor(m), m, now);

  await check('foreign command ignored', async () => assert.equal(await D.applyDeploymentConfiguration(makeState(), { type: 'saveVisit' }, actor(owner), owner, now), null));
  await refuses('ordinary worker cannot stage', () => stage(makeState(), worker), 403, /deployment operations authority/);
  await refuses('admin cannot stage', () => stage(makeState(), reviewer), 403, /Only an organisation owner/);
  await refuses('wrong tenant id refused', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), organisationId: 'org-b' } }); }, 422, /selected organisation/);
  await refuses('unknown locality refused', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), localityIds: ['missing'] } }); }, 422, /current localities/);
  await refuses('facility locality must be included', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), localityIds: [] } }); }, 422, /locality of every/);
  await refuses('active roles cannot be omitted', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), roles: ['clinician', 'admin'] } }); }, 422, /every role/);
  await refuses('used programme cannot be omitted', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), programmes: ['Maternal care'] } }); }, 422, /every programme/);
  await refuses('selected language cannot be omitted', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), languages: ['en'] } }); }, 422, /every language/);
  await refuses('every provider has explicit eligibility', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), providerEligibility: [] } }); }, 422, /every current provider/);
  await refuses('member limit below use refused', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), limits: { ...settings(s).limits, activeMembers: 2 } } }); }, 422, /below current use/);
  await refuses('record limit below use refused', () => { const s = makeState(); return stage(s, owner, { settings: { ...settings(s), limits: { ...settings(s).limits, patientRecords: 0 } } }); }, 422, /greater than or equal|Too small/);

  const s = makeState(), staged = await stage(s);
  await check('staging records immutable source and audit', () => { const r = s.operations.deploymentConfiguration.revisions[0]; assert.equal(staged.version, 1); assert.equal(r.state, 'staged'); assert.match(r.sourceHash, /^[a-f0-9]{64}$/); assert.equal(s.workspace.audit.at(-1).action, 'deploymentConfigurationStage'); });
  s.organisation.revision++;
  await check('persistence revision advance does not fabricate source drift', () => assert.equal(s.operations.deploymentConfiguration.revisions[0].state, 'staged'));
  await refuses('stale lifecycle version refused', () => D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationReview', version: 0, revisionId: staged.revisionId, decision: 'approve', reason: 'Independent synthetic review approval.' }, actor(reviewer), reviewer, now), 409, /changed/);
  await refuses('proposer cannot self-review', () => D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationReview', version: 1, revisionId: staged.revisionId, decision: 'approve', reason: 'Self review must be refused.' }, actor(owner), owner, now), 403, /different deployment operator/);
  const reviewed = await D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationReview', version: 1, revisionId: staged.revisionId, decision: 'approve', reason: 'Independent synthetic review approval.' }, actor(reviewer), reviewer, now);
  await check('independent review is version and source bound', () => { const r = s.operations.deploymentConfiguration.revisions[0]; assert.equal(reviewed.version, 2); assert.equal(r.state, 'approved'); assert.equal(r.review.by, reviewer.userId); assert.equal(r.review.sourceHash, r.sourceHash); });
  await refuses('reviewer cannot activate own decision', () => D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationActivate', version: 2, revisionId: staged.revisionId, reviewId: s.operations.deploymentConfiguration.revisions[0].review.id, reason: 'Self activation must be refused.' }, actor(reviewer), reviewer, now), 403, /Only an organisation owner|reviewer cannot activate/);
  const active = await D.applyDeploymentConfiguration(s, { type: 'deploymentConfigurationActivate', version: 2, revisionId: staged.revisionId, reviewId: s.operations.deploymentConfiguration.revisions[0].review.id, reason: 'Activate exact reviewed synthetic settings.' }, actor(owner), owner, now);
  await check('exact reviewed revision activates', () => { assert.equal(active.version, 3); assert.equal(s.operations.deploymentConfiguration.activeRevisionId, staged.revisionId); assert.equal(D.activeDeploymentConfiguration(s).state, 'active'); assert.equal(s.workspace.audit.at(-1).action, 'deploymentConfigurationActivate'); });
  await refuses('active programme boundary enforced', () => D.enforceDeploymentConfiguration(s, { type: 'createPerson', programme: 'Maternal care' }), 409, /programme is not enabled/);
  await refuses('active language boundary enforced', () => D.enforceDeploymentConfiguration(s, { type: 'setMyLanguage', language: 'bn' }), 409, /language is not enabled/);
  await refuses('active provider eligibility enforced', () => { const x = structuredClone(s); x.operations.deploymentConfiguration.revisions[0].settings.providerEligibility[0].eligible = false; return D.enforceDeploymentConfiguration(x, { type: 'activateMis', integrationId: 'mis-a' }); }, 409, /provider is not eligible/);
  await refuses('active patient limit enforced', () => { const x = structuredClone(s); x.workspace.people.push({ ...x.workspace.people[0], id: 'p2' }); return D.enforceDeploymentConfiguration(x, { type: 'createPerson', programme: 'General care' }); }, 409, /patient-record limit/);
  await check('saved command replay is not blocked by a reached capacity limit', () => { const x = structuredClone(s); x.workspace.people.push({ ...x.workspace.people[0], id: 'p2' }); assert.doesNotThrow(() => D.enforceDeploymentConfiguration(x, { type: 'createPerson', programme: 'General care' }, true)); });
  await refuses('active member limit enforced on join', () => D.enforceDeploymentConfiguration(s, { type: 'joinOrganisation' }), 409, /member limit/);
  await refuses('active connection limit enforced', () => D.enforceDeploymentConfiguration(s, { type: 'registerIntegration' }), 409, /external-connection limit/);
  await refuses('active facility boundary enforced', () => D.enforceDeploymentConfiguration(s, { type: 'setTeamLocation', facilityId: 'fac-b', localityId: null }), 409, /facility is not enabled/);
  await check('allowed active settings permit operation', () => assert.doesNotThrow(() => D.enforceDeploymentConfiguration(s, { type: 'createPerson', programme: 'General care' })));
  await check('other tenant remains unchanged', () => { const other = makeState('org-b'); assert.equal(other.operations.deploymentConfiguration, undefined); assert.equal(other.workspace.audit.length, 0); assert.equal(D.activeDeploymentConfiguration(other), null); });

  await refuses('reference drift blocks review', async () => { const x = makeState(); const r = await stage(x); x.workspace.integrations[0].version++; return D.applyDeploymentConfiguration(x, { type: 'deploymentConfigurationReview', version: 1, revisionId: r.revisionId, decision: 'approve', reason: 'Review after provider drift must fail.' }, actor(reviewer), reviewer, now); }, 409, /Referenced organisation settings changed/);
  await refuses('authority drift blocks activation', async () => { const x = makeState(); const r = await stage(x); await D.applyDeploymentConfiguration(x, { type: 'deploymentConfigurationReview', version: 1, revisionId: r.revisionId, decision: 'approve', reason: 'Independent review before authority drift.' }, actor(reviewer), reviewer, now); x.members.find(m => m.userId === reviewer.userId).version++; return D.applyDeploymentConfiguration(x, { type: 'deploymentConfigurationActivate', version: 2, revisionId: r.revisionId, reviewId: x.operations.deploymentConfiguration.revisions[0].review.id, reason: 'Activation after reviewer drift must fail.' }, actor(owner), owner, now); }, 409, /Reviewer authority changed/);
  await check('read view exposes configuration metadata without patient rows', () => { const v = D.deploymentConfigurationView(s, owner); assert.equal(v.organisation.id, 'org-a'); assert.equal(v.currentUse.patientRecords, 1); assert.equal('people' in v, false); assert.equal(JSON.stringify(v).includes('Synthetic Person'), false); });
  await check('read view accepts a count-only patient total', () => { const x = structuredClone(s); x.workspace.people = []; const v = D.deploymentConfigurationView(x, owner, 7); assert.equal(v.currentUse.patientRecords, 7); assert.equal(JSON.stringify(v).includes('Synthetic Person'), false); });
  await refuses('non-operations read refused', () => D.deploymentConfigurationView(s, worker), 403, /deployment operations authority/);

  const result = { suite: 'deployment-configuration-contract', passed, failed: 0, at: new Date().toISOString(), limits: 'Synthetic in-memory tenant/configuration contract; no real provider activation, hosting change, domain approval or formal acceptance.' };
  writeFileSync('tests/deployment-configuration-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
