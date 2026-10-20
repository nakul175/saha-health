import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const directory = mkdtempSync(join(process.cwd(), '.approved-source-library-'));
const checks = [];
const check = (name, run) => { run(); checks.push(name); };
try {
  for (const sourceFile of readdirSync('lib/saha').filter(file => file.endsWith('.ts'))) {
    const file = sourceFile.replace(/\.ts$/, '');
    const output = ts.transpileModule(readFileSync(`lib/saha/${file}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(directory, `${file}.js`), output);
  }
  const { approvedSourceLibrary } = await import(pathToFileURL(join(directory, 'approved-source-library.js')));
  const now = '2026-10-16T08:00:00.000Z';
  const owner = { userId: 'owner', displayName: 'Clinical owner', role: 'clinician', status: 'active', teamIds: ['team-a'], version: 1, isOwner: true };
  const reviewer = { ...owner, userId: 'reviewer', displayName: 'Independent reviewer', isOwner: false };
  const asha = { ...owner, userId: 'asha', displayName: 'ASHA worker', role: 'asha', isOwner: false };
  const admin = { ...owner, userId: 'admin', displayName: 'Administrator', role: 'admin', isOwner: false };
  const common = { revision: 1, version: 2, createdBy: 'owner', createdAt: '2026-10-01T00:00:00.000Z', state: 'active', history: [] };
  const sourceSpec = { kind: 'source', key: 'maternal-guidance', title: 'Synthetic maternal guidance', ownerId: 'owner', teamIds: ['team-a'], effectiveFrom: '2026-10-01', reviewBy: '2027-10-01', changeSummary: 'Synthetic source fixture for approved-library behaviour.', publisher: 'Synthetic public health publisher', edition: '2026.1', url: 'https://example.invalid/guidance/2026-1', applicability: 'Synthetic team A maternal-care rehearsal only.', summary: 'Synthetic recommendation source; no clinical approval is implied.' };
  const source = { ...common, id: 'source-current', spec: sourceSpec, manifestHash: 'source-hash', review: { by: 'reviewer', memberVersion: 1, ownerVersion: 1, authorVersion: 1, at: '2026-10-02T00:00:00.000Z', reference: 'SYNTHETIC-REVIEW', findings: 'Fixture review only.', dependencyStamp: '[]' } };
  const serviceSpec = { kind: 'service', key: 'fixture-service', title: 'Synthetic referral service', ownerId: 'owner', teamIds: ['team-a'], effectiveFrom: '2026-10-01', reviewBy: '2027-10-01', changeSummary: 'Synthetic service dependency for source library tests.', location: 'Synthetic site', services: 'Fixture-only follow-up service.', contactRoute: 'NO-EXTERNAL-CONTACT', constraints: 'No actual referral or external delivery.', verifiedOn: '2026-10-01', verificationReference: 'SYNTHETIC-SERVICE' };
  const service = { ...common, id: 'service', spec: serviceSpec, manifestHash: 'service-hash', review: { ...source.review, dependencyStamp: '[]' } };
  const protocolSpec = { kind: 'protocol', key: 'maternal-protocol', title: 'Maternal care recommendation', ownerId: 'owner', teamIds: ['team-a'], effectiveFrom: '2026-10-01', reviewBy: '2027-10-01', changeSummary: 'Synthetic programme and role binding for source library tests.', programme: 'Maternal care', ageMin: 10, ageMax: 60, roles: ['asha', 'clinician'], sourceIds: [source.id], maxObservationAgeHours: 24, rules: [{ id: 'review', label: 'Review current evidence', condition: { field: 'weight', operator: 'missing', value: '' }, urgency: 'review', action: 'Ask a clinician to review current evidence.', serviceId: service.id }], transition: 'new-reviews-only' };
  const dependencyStamp = JSON.stringify([source, service].map(entry => ({ id: entry.id, version: entry.version, manifestHash: entry.manifestHash })));
  const protocol = { ...common, id: 'protocol', spec: protocolSpec, manifestHash: 'protocol-hash', review: { ...source.review, dependencyStamp } };
  const state = { members: [owner, reviewer, asha, admin], workspace: { people: [], visits: [], referrals: [], audit: [], integrations: [] }, governance: { entries: [source, service, protocol], evaluations: [], safety: [] } };

  const ashaView = approvedSourceLibrary(state, asha, 'Maternal care', now);
  check('Current approved source is returned for applicable programme and role', () => assert.equal(ashaView.rows.length, 1));
  check('Publisher, edition, effective date and local applicability are preserved', () => assert.deepEqual({ publisher: ashaView.rows[0].publisher, edition: ashaView.rows[0].edition, effectiveFrom: ashaView.rows[0].effectiveFrom, applicability: ashaView.rows[0].applicability }, { publisher: sourceSpec.publisher, edition: sourceSpec.edition, effectiveFrom: sourceSpec.effectiveFrom, applicability: sourceSpec.applicability }));
  check('Recommendation links to exact source and reviewer', () => { assert.equal(ashaView.rows[0].sourceUrl, sourceSpec.url); assert.deepEqual(ashaView.rows[0].reviewer, { id: reviewer.userId, name: reviewer.displayName }); assert.equal(ashaView.rows[0].programmes[0].protocolManifestHash, protocol.manifestHash); });
  check('Unrelated programme receives no guidance', () => assert.equal(approvedSourceLibrary(state, asha, 'TB screening', now).rows.length, 0));
  check('Administrative role cannot read care guidance', () => assert.throws(() => approvedSourceLibrary(state, admin, undefined, now), /current care role/));

  source.state = 'suspended';
  check('Suspended source cannot be offered as current advice', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  source.state = 'active'; source.spec.reviewBy = '2026-10-15';
  check('Expired source cannot be offered as current advice', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  source.spec.reviewBy = '2027-10-01'; reviewer.version = 2;
  check('Changed reviewer authority makes source unavailable', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  reviewer.version = 1; protocol.state = 'suspended';
  check('Source is not advice without a current programme protocol', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  protocol.state = 'active'; protocol.spec.roles = ['clinician'];
  check('Role-inapplicable guidance is withheld', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  check('Role-applicable clinician guidance remains available', () => assert.equal(approvedSourceLibrary(state, owner, 'Maternal care', now).rows.length, 1));
  protocol.spec.roles = ['asha', 'clinician']; source.review.by = source.createdBy;
  check('Self-reviewed source is never offered as current advice', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  source.review.by = reviewer.userId; asha.teamIds = ['team-b'];
  check('Out-of-scope team receives no source metadata', () => assert.equal(approvedSourceLibrary(state, asha, 'Maternal care', now).rows.length, 0));
  asha.teamIds = ['team-a'];
  const before = JSON.stringify(state); approvedSourceLibrary(state, asha, 'Maternal care', now);
  check('Read projection has no side effects', () => assert.equal(JSON.stringify(state), before));

  writeFileSync('tests/approved-source-library-contract-result.json', JSON.stringify({ passed: checks.length, failed: 0, checks, formalAcceptance: false, clinicalApproval: false, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`${checks.length} approved source library checks passed`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
