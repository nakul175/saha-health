// SAHA-053 / BR-AI-02: unchanged declared age ranges, unknown age must not be coerced into eligibility.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync('.capability-age-'), checks = [];
const output = process.env.SAHA_AGE_REPORT ?? 'tests/reports/capability-age-boundary-result.json';
let failure;
const check = (name, fn) => { fn(); checks.push(name); };
try {
  for (const file of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync('lib/saha/' + file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const { checkCapability } = await import(pathToFileURL(join(dir, 'governance.js')).href);
  const { agentApply, AGENT_VERSION } = await import(pathToFileURL(join(dir, 'agent.js')).href);
  const now = new Date().toISOString(), today = now.slice(0, 10), tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const owner = { userId: 'synthetic-author', role: 'clinician', status: 'active', teamIds: ['team'], version: 1, isOwner: true };
  const reviewer = { ...owner, userId: 'synthetic-reviewer', isOwner: false };
  const member = { ...owner, userId: 'synthetic-asha', role: 'asha', isOwner: false };
  const actor = { userId: member.userId, displayName: 'Synthetic worker' };
  const person = { id: 'synthetic-person', name: 'Synthetic Person', village: 'Synthetic Village', version: 1, consentVersion: 1, aiConsent: true, teamId: 'team', assignedTo: member.userId, assigned: true, age: 32, programmes: ['General care'] };
  const visit = { id: 'synthetic-visit', personId: person.id, version: 1, recordVersion: 1, state: 'draft', facts: { date: now.slice(0, 16), notes: 'Synthetic current note', weight: '58' }, agentRuns: [] };
  // A declared fixture only: no provider configuration, token, external call or real clinical approval.
  const provider = { id: 'synthetic-provider', name: 'Uninvoked synthetic peer', mode: 'http', model: 'fixture-version', version: 1, available: true, reason: 'In-memory contract fixture only' };
  const context = { language: 'en', setting: 'community', device: 'browser' };
  const spec = { kind: 'capability', key: 'fixture-cap', title: 'Synthetic capability', ownerId: owner.userId, teamIds: ['team'], effectiveFrom: today, reviewBy: tomorrow, changeSummary: 'Synthetic fixture only.', providerId: provider.id, model: provider.model, agentVersion: AGENT_VERSION, purpose: 'documentary-evidence', ageMin: 18, ageMax: 60, roles: ['asha', 'clinician'], populations: ['General care'], languages: ['en'], settings: ['community'], devices: ['browser'], tasks: ['extract', 'summary'], inputQuality: 'validated-text', excludedUses: 'No clinical decisions authorised.', supportContact: 'Synthetic owner', hostingRegion: 'No external invocation', retentionTerms: 'Synthetic fixture only.', trainingUse: 'not-authorised', agreementReference: 'FIXTURE-NOT-APPROVAL', dailyCallLimit: 2, dailyTokenBudget: 12000 };
  const entry = { id: 'synthetic-cap', revision: 1, version: 3, spec, manifestHash: 'fixture-hash', createdBy: owner.userId, createdAt: now, state: 'active', history: [], review: { by: reviewer.userId, memberVersion: 1, ownerVersion: 1, authorVersion: 1, dependencyStamp: '[]', evaluationId: 'fixture-evaluation' } };
  const state = { members: [owner, reviewer, member], workspace: { people: [person], visits: [visit], referrals: [], audit: [], role: 'asha', integrations: [] }, governance: { entries: [entry], evaluations: [{ id: 'fixture-evaluation', manifestHash: entry.manifestHash, state: 'completed', metrics: { passed: true } }], safety: [] } };
  for (const age of [18, 32, 60]) check('Explicit in-range age ' + age + ' retains declared eligibility', () => assert.equal(checkCapability(state, member, { ...person, age }, provider, 'extract', context, AGENT_VERSION).id, entry.id));
  for (const age of [17, 61]) check('Explicit outside-range age ' + age + ' remains refused', () => assert.throws(() => checkCapability(state, member, { ...person, age }, provider, 'extract', context, AGENT_VERSION), /outside/));
  const malformed = [[undefined, 'unknown'], [NaN, 'NaN'], [Infinity, 'positive infinity'], [-Infinity, 'negative infinity'], ['32', 'numeric text'], ['unknown', 'text'], [null, 'null'], [{}, 'object']];
  // Continue recording every failed case against the untouched predecessor, rather than hide all but its first failure.
  const bad = [];
  for (const [age, label] of malformed) {
    try { check('Unknown/non-numeric age refused: ' + label, () => assert.throws(() => checkCapability(state, member, { ...person, age }, provider, 'extract', context, AGENT_VERSION), /outside/)); }
    catch (e) { bad.push({ name: label, error: String(e) }); }
  }
  if (bad.length) { failure = { passed: checks.length, failed: bad.length, failures: bad }; throw new Error('Age eligibility admitted ' + bad.length + ' malformed cases'); }
  const unrestricted = structuredClone(state); unrestricted.governance.entries[0].spec.ageMin = 0; unrestricted.governance.entries[0].spec.ageMax = 120;
  check('Unknown age is refused even when all numeric ages fit', () => assert.throws(() => checkCapability(unrestricted, member, { ...person, age: null }, provider, 'extract', context, AGENT_VERSION), /outside/));
  for (const [age, label] of malformed) {
    const candidate = structuredClone(state); candidate.workspace.people[0].age = age; const before = structuredClone(candidate);
    await assert.rejects(() => agentApply(candidate, { type: 'prepareAgent', visitId: visit.id, version: 1, providerId: provider.id, task: 'extract', input: 'Weight 58 kg', context }, actor, member, [provider]), /outside/);
    check('Actual preparation refuses ' + label + ' without run/audit/state mutation', () => assert.deepEqual(candidate, before));
  }
  const allowed = structuredClone(state); const prepared = await agentApply(allowed, { type: 'prepareAgent', visitId: visit.id, version: 1, providerId: provider.id, task: 'extract', input: 'Weight 58 kg', context }, actor, member, [provider]);
  check('Valid known age still prepares one bounded pending request', () => { assert.ok(prepared.runId); assert.equal(allowed.workspace.visits[0].agentRuns.length, 1); assert.equal(allowed.workspace.visits[0].agentRuns[0].status, 'pending'); assert.equal(allowed.workspace.visits[0].agentRuns[0].callCount, 0); });
  check('Source fixture and capability manifest are unchanged', () => { assert.deepEqual(state.workspace.people[0], person); assert.deepEqual(state.governance.entries[0], entry); });
} catch (e) { failure ??= { passed: checks.length, failed: 1, error: String(e.stack ?? e) }; throw e; }
finally {
  mkdirSync('tests/reports', { recursive: true });
  const report = { suite: 'Capability explicit age boundary contract', passed: checks.length, failed: 0, checks, ...failure, completedAt: new Date().toISOString(), limits: 'Actual current capability gate/preparation functions on synthetic in-memory fixtures; no external invocation, HTTP/hosting, clinical approval or full-story acceptance.' };
  writeFileSync(output, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  rmSync(dir, { recursive: true, force: true });
}
