// Slice 1 household contract: sensitive classes and disclosure rules, independent of HTTP timing.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.household-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const h = await import(pathToFileURL(join(dir, 'household.js')));
  const now = '2026-09-30T00:00:00.000Z', later = '2026-12-01T00:00:00.000Z', earlier = '2026-09-01T00:00:00.000Z';
  const base = { sex: 'Unknown', village: 'Synthetic', task: 'Home visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 't', assignedTo: 'w' };
  const head = { ...base, id: 'head', name: 'Head', age: 45, programmes: ['General care'] };
  const mother = { ...base, id: 'mother', name: 'Mother', age: 28, programmes: ['Maternal care', 'General care'], followUps: [{ id: 'f1', enrolmentId: 'e1', packId: 'maternal', title: 'Antenatal check', due: '2026-10-10', ownerId: 'w', state: 'open' }] };
  const teen = { ...base, id: 'teen', name: 'Teen', age: 15, programmes: ['TB screening'] };
  const child = { ...base, id: 'child', name: 'Child', age: 4, programmes: ['Child health'], status: 'completed' };
  const household = { id: 'h', version: 1, label: 'Synthetic', teamId: 't', createdAt: now, createdBy: 'w', members: ['head', 'mother', 'teen', 'child'].map(personId => ({ personId, relationship: 'other', from: '2026-09-01', addedBy: 'w', addedAt: now })) };
  const state = { workspace: { people: [head, mother, teen, child], visits: [], referrals: [{ id: 'r1', personId: 'teen', visitId: 'v', facility: 'F', reason: 'Synthetic', state: 'sent', createdAt: now }], submissions: [], audit: [] }, households: [household] };
  const grant = (over = {}) => ({ id: 'g', proxyPersonId: 'head', relationship: 'parent', purposes: ['care-coordination'], classes: [], evidence: 'SYNTH', from: earlier, expiresAt: later, grantedBy: 'w', grantedAt: earlier, ...over });
  const members = (purpose = 'care-coordination') => h.shareable(state, household, head, purpose, now).members;

  check(() => { assert.deepEqual(h.sensitiveClasses(mother), ['maternal']); assert.deepEqual(h.sensitiveClasses(teen), ['tb', 'adolescent']); assert.deepEqual(h.sensitiveClasses(child), ['child']); assert.deepEqual(h.sensitiveClasses(head), []); });
  check(() => { const items = h.openItems(state, teen); assert.deepEqual(items.find(i => i.kind === 'referral').classes, ['tb', 'adolescent'], 'referral reasons carry every class'); });
  check(() => assert.deepEqual(members().map(m => m.personId), ['head'], 'no grants: only the recipient'));
  mother.proxies = [grant()];
  check(() => { const m = members().find(m => m.personId === 'mother'); assert.ok(m); assert.deepEqual(m.items.map(i => i.title), ['Home visit']); });
  mother.proxies = [grant({ classes: ['maternal'] })];
  check(() => assert.deepEqual(members().find(m => m.personId === 'mother').items.map(i => i.title), ['Antenatal check', 'Home visit']));
  check(() => assert.equal(members('appointments').some(m => m.personId === 'mother'), false, 'purpose must match'));
  mother.proxies = [grant({ classes: ['maternal'], expiresAt: '2026-09-29T00:00:00.000Z' })];
  check(() => assert.equal(members().some(m => m.personId === 'mother'), false, 'expired grants are ignored'));
  mother.proxies = [grant({ classes: ['maternal'], revokedAt: earlier })];
  check(() => assert.equal(members().some(m => m.personId === 'mother'), false, 'revoked grants are ignored'));
  mother.proxies = [grant({ classes: ['maternal'], proxyPersonId: 'teen' })];
  check(() => assert.equal(members().some(m => m.personId === 'mother'), false, 'a grant to someone else does not cover the recipient'));
  teen.proxies = [grant({ classes: ['tb'] })];
  check(() => { const m = members().find(m => m.personId === 'teen'); assert.ok(m); assert.deepEqual(m.items, [], 'adolescent class not granted: teen items withheld'); });
  teen.proxies = [grant({ classes: ['tb', 'adolescent'] })];
  check(() => assert.deepEqual(members().find(m => m.personId === 'teen').items.map(i => i.kind).sort(), ['referral', 'visit']));
  household.members.find(x => x.personId === 'teen').to = '2026-09-20';
  check(() => assert.equal(members().some(m => m.personId === 'teen'), false, 'former members are not included'));
  const result = { suite: 'household contract (slice 1)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/household-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
