// Slice 6d indicator contract: catalogue, authority, cohort protection, suppression and interpretation.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.indicators-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['indicators', 'continuity', 'referral-rules', 'core', 'access', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'indicators.js')));
  const now = new Date('2026-09-30T06:00:00.000Z'), recent = '2026-09-28T08:00:00.000Z', old = '2026-01-01T08:00:00.000Z';
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: old, ...over });
  const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', assigned: true };
  const people = [];
  const add = (n, village, over = {}) => { for (let i = 0; i < n; i++) people.push({ ...base, id: `${village}-${i}`, name: `${village} ${i}`, village, teamId: 't1', programmes: ['General care'], ...over }); };
  add(10, 'Alpur'); add(7, 'Bedi'); add(2, 'Chak', { programmes: ['Maternal care'], enrolments: [{ id: 'e', packId: 'maternal', state: 'active' }] });
  people.push({ ...base, id: 'merged', name: 'Merged', village: 'Alpur', teamId: 't1', programmes: ['General care'], mergedInto: { personId: 'Alpur-0' } });
  people.push({ ...base, id: 'hidden', name: 'Hidden', village: 'Alpur', teamId: 't2', programmes: ['General care'], assigned: false });
  const visits = people.map(p => ({ id: 'v-' + p.id, personId: p.id, state: 'confirmed', createdAt: recent, confirmedAt: p.village === 'Bedi' && p.id.endsWith('6') ? old : recent }));
  people[0].followUps = [{ id: 'f0', state: 'open', due: '2026-09-01', ownerId: 'asha' }, { id: 'f1', state: 'open', due: '2026-12-01', ownerId: 'gone' }];
  const s = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team one' }, { id: 't2', name: 'Team two' }], invitations: [], outreach: { plans: [], templates: [], messages: [] },
    members: [member('sup', 'supervisor', ['t1']), member('own', 'clinician', ['t1'], { isOwner: true }), member('doc', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('adm', 'admin', [], { isOwner: true })],
    workspace: { people, visits, submissions: [], referrals: [{ id: 'r1', personId: 'Alpur-1', createdAt: recent, state: 'completed' }, { id: 'r2', personId: 'Alpur-2', createdAt: recent, state: 'sent' }], integrations: [], audit: [] } };
  const M = id => s.members.find(m => m.userId === id);
  const q = (over = {}) => ({ ids: ['visits-confirmed'], days: 30, group: 'none', ...over });
  check(() => { for (const u of ['asha', 'adm', 'doc']) status(() => x.indicatorQuery(s, M(u), q(), now), 403); x.indicatorQuery(s, M('own'), q(), now); });
  check(() => { status(() => x.indicatorQuery(s, M('sup'), q({ ids: ['free-sql'] }), now), 422); status(() => x.indicatorQuery(s, M('sup'), q({ ids: [] }), now), 422); status(() => x.indicatorQuery(s, M('sup'), q({ days: 0 }), now), 422); status(() => x.indicatorQuery(s, M('sup'), q({ group: 'patient' }), now), 422); status(() => x.indicatorQuery(s, M('sup'), q({ team: 't2' }), now), 403); });
  check(() => { const e = status(() => x.indicatorQuery(s, M('sup'), q({ village: 'Chak' }), now), 422); assert.match(e.message, /fewer than 5/); });
  const all = x.indicatorQuery(s, M('sup'), q(), now);
  check(() => { assert.equal(all.cohort.people, 19, 'merged and out-of-scope records excluded'); assert.equal(all.results[0].rows[0].value, 18, 'one visit confirmed outside the window'); assert.equal(all.minimumCell, 5); assert.equal(all.latestSourceRecord, recent); });
  const byVillage = x.indicatorQuery(s, M('sup'), q({ group: 'village' }), now).results[0].rows;
  check(() => { const r = Object.fromEntries(byVillage.map(v => [v.group, v])); assert.equal(r.Chak.suppressed, true); assert.equal(r.Bedi.suppressed, true, 'complementary suppression'); assert.equal(r.Alpur.value, 10); assert.equal(r.Chak.value, null); });
  const prop = x.indicatorQuery(s, M('sup'), q({ ids: ['followups-overdue', 'patients-seen', 'referrals-completed'] }), now).results;
  check(() => { assert.equal(prop[0].rows[0].suppressed, true, 'one of two overdue is suppressed'); const seen = prop[1].rows[0]; assert.equal(seen.suppressed, true, 'complement of 1 unseen suppressed'); assert.equal(prop[2].rows[0].suppressed, true); });
  const zero = x.indicatorQuery(s, M('sup'), q({ ids: ['submissions-unresolved', 'maternal-episodes', 'open-work-unowned'], group: 'programme' }), now).results;
  check(() => { assert.deepEqual(zero[0].rows.map(r => [r.group, r.value]), [['General care', 0], ['Maternal care', 0]], 'zero is never suppressed'); assert.equal(zero[1].rows.find(r => r.group === 'Maternal care').suppressed, true); assert.equal(zero[2].rows.find(r => r.group === 'General care').suppressed, true, 'one unowned item is small'); });
  check(() => { const i = x.interpret('Overdue follow-ups by village last 14 days'); assert.deepEqual([i.ids, i.group, i.days, i.understood], [['followups-overdue'], 'village', 14, true]); const j = x.interpret('How many maternal episodes by team this month?'); assert.deepEqual([j.ids, j.group, j.days], [['maternal-episodes'], 'team', 30]); const k = x.interpret('show me the salary table'); assert.equal(k.understood, false); assert.deepEqual(k.ids, []); });
  check(() => { const c = x.catalogue(); assert.equal(c.length, 8); assert.ok(c.every(d => d.version === 1 && d.owner && d.exclusions && !('compute' in d) && !('keywords' in d))); });
  const result = { suite: 'indicator contract (slice 6d)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/indicators-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
