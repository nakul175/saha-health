// Slice 2a reuse-metering contract: reproducible opportunities, reuse, blocked reuse, repeated entry and corrections.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.reuse-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['indicators', 'continuity', 'referral-rules', 'core', 'access', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'indicators.js')));
  const P = await import(pathToFileURL(join(dir, 'programmes.js')));
  const now = new Date('2026-09-30T06:00:00.000Z'), recent = '2026-09-28T08:00:00.000Z';
  const enrol = packId => ({ id: 'e-' + packId, packId, packVersion: 1, state: 'active', episodeLabel: 'Synthetic', startDate: null, createdAt: recent, createdBy: 'w', registration: 'not_submitted' });
  const capture = (...packs) => P.captureFor(packs.map(enrol));
  const facts = (over = {}) => ({ date: '2026-09-28T08:00', systolic: '130', diastolic: '', weight: '58', temperature: '', weeks: '20', coughDays: '', notes: 'Synthetic', source: 'measured', ...over });
  const two = capture('maternal', 'hypertension'), three = capture('maternal', 'hypertension', 'tb');
  check(() => assert.deepEqual(x.reuseOf({ facts: facts(), programmeCapture: { ...two, answers: {}, absence: {} } }), { opportunities: 3, reused: 2, blocked: 0 }, 'weight, systolic and diastolic shared by two packs; diastolic empty'));
  check(() => assert.deepEqual(x.reuseOf({ facts: facts(), programmeCapture: { ...two, answers: {}, absence: { diastolic: 'Not measured' } } }), { opportunities: 3, reused: 2, blocked: 1 }));
  check(() => assert.deepEqual(x.reuseOf({ facts: facts({ diastolic: '84' }), programmeCapture: { ...three, answers: {}, absence: {} } }), { opportunities: 4, reused: 4, blocked: 0 }, 'weight shared by three packs counts twice'));
  check(() => { assert.deepEqual(x.reuseOf({ facts: facts(), programmeCapture: capture('tb') }), { opportunities: 0, reused: 0, blocked: 0 }); assert.deepEqual(x.reuseOf({ facts: facts() }), { opportunities: 0, reused: 0, blocked: 0 }); });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['Maternal care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: recent, version: 1, teamId: 't1', assignedTo: 'asha', assigned: true };
  const people = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `p${i}`, name: `P${i}` }));
  const visits = people.flatMap((p, i) => { const v = { id: `v${i}`, personId: p.id, state: 'confirmed', facts: facts(), createdAt: recent, confirmedAt: recent, programmeCapture: { ...two, answers: {}, absence: { diastolic: 'Not measured' } } };
    return i < 5 ? [v, { ...v, id: `v${i}b`, confirmedAt: '2026-09-28T09:00:00.000Z' }, { id: `v${i}c`, personId: p.id, state: 'draft', facts: facts(), createdAt: recent, amendsVisitId: `v${i}` }] : [v, { ...v, id: `v${i}x`, voidedAt: recent }]; });
  const s = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'One' }], invitations: [], outreach: { plans: [], templates: [], messages: [] }, members: [{ userId: 'sup', displayName: 'SUP', role: 'supervisor', isOwner: false, status: 'active', version: 1, teamIds: ['t1'] }], workspace: { people, visits, submissions: [], referrals: [], integrations: [], audit: [] } };
  const res = x.indicatorQuery(s, s.members[0], { ids: ['reuse-shared-answers', 'reuse-blocked', 'repeat-entry', 'corrections'], days: 30, group: 'none' }, now).results;
  const row = id => res.find(r => r.id === id).rows[0];
  check(() => { assert.deepEqual([row('reuse-shared-answers').numerator, row('reuse-shared-answers').denominator], [22, 33], 'eleven counted visits, voided excluded'); assert.equal(row('reuse-shared-answers').value, 66.7); });
  check(() => { assert.equal(row('reuse-blocked').value, 11); assert.equal(row('repeat-entry').value, 5, 'second identical same-day visit per person'); assert.equal(row('corrections').value, 6, 'five correction drafts and one voided visit'); });
  check(() => { const c = x.catalogue(); assert.equal(c.length, 12); assert.ok(['reuse-shared-answers', 'reuse-blocked', 'repeat-entry', 'corrections'].every(id => c.some(d => d.id === id && d.version === 1))); assert.deepEqual(x.interpret('How much reuse of shared answers last month').ids, ['reuse-shared-answers']); });
  const result = { suite: 'reuse metering contract (slice 2a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/reuse-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
