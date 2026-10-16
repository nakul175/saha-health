// Slice 6s indicator registry contract: versioned owner-maintained definitions, reproduction by version,
// definition cohort minimums, and differencing protection across one viewer's recent queries.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.indicator-registry-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'indicator-differencing', 'indicator-registry', 'indicators', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'indicators.js')));
  const reg = await import(pathToFileURL(join(dir, 'indicator-registry.js')));
  const dif = await import(pathToFileURL(join(dir, 'indicator-differencing.js')));
  const now = new Date('2026-09-30T06:00:00.000Z'), recent = '2026-09-28T08:00:00.000Z', old = '2026-01-01T08:00:00.000Z';
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: old, ...over });
  const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', assigned: true };
  const people = [];
  const add = (n, village, over = {}) => { for (let i = 0; i < n; i++) people.push({ ...base, id: `${village}-${i}`, name: `${village} ${i}`, village, teamId: 't1', programmes: ['General care'], ...over }); };
  add(10, 'Alpur'); add(7, 'Bedi', { age: 60 }); add(2, 'Chak', { programmes: ['Maternal care'], identityReview: { state: 'provisional' } });
  const visits = people.map(p => ({ id: 'v-' + p.id, personId: p.id, state: 'confirmed', createdAt: recent, confirmedAt: recent }));
  const s = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team one' }], invitations: [], outreach: { plans: [], templates: [], messages: [] },
    members: [member('sup', 'supervisor', ['t1']), member('own', 'clinician', ['t1'], { isOwner: true }), member('admown', 'admin', [], { isOwner: true })],
    workspace: { people, visits, submissions: [], referrals: [], integrations: [], audit: [] } };
  const M = id => s.members.find(m => m.userId === id), U = id => ({ userId: id, displayName: id, email: `${id}@example.invalid` });
  const spec = (over = {}) => ({ title: 'Older adults seen', unit: 'proportion', numerator: 'patients-seen', denominator: 'patients', filters: { ageBand: '50+' }, exclude: [], exclusionsNote: 'Merged records', owner: 'Programme manager', cadence: 'Monthly', minimumCohort: 5, ...over });
  const applyReleased=(state,input,actor,member,at='2026-09-29T10:00:00.000Z')=>{const r=reg.applyIndicatorRegistry(state,input,actor,member,at);if(!r||r.status!=='proposed')return r;const reviewed=reg.applyIndicatorRegistry(state,{type:'reviewIndicatorDefinition',id:r.id,expectedVersion:r.version,expectedGovernanceVersion:r.governanceVersion,decision:'approve',reason:'Independent synthetic fixture governance review'},U('sup'),M('sup'),at);reg.applyIndicatorRegistry(state,{type:'releaseIndicatorDefinition',id:r.id,expectedVersion:r.version,expectedGovernanceVersion:reviewed.governanceVersion,reviewEventId:reviewed.eventId,effectiveAt:at,reason:'Synthetic fixture reviewed release'},actor,member,at);return {id:r.id,version:r.version,status:input.type==='retireIndicatorDefinition'?'retired':'active'};};
  const cmd = (type, over = {}) => ({ type, id: 'older-seen', reason: 'Quarterly review of older adult coverage', ...over });
  const q = (ids, over = {}) => ({ ids, days: 30, group: 'none', ...over });

  // Built-in catalogue definitions are the registry's version 1 entries.
  check(() => { const r = x.registryRecords(s); assert.equal(r.length, 16); assert.ok(r.every(d => d.version === 1 && d.builtIn && d.by === 'built-in' && d.status === 'active')); assert.equal(x.catalogue(s).length, 16); });
  // Only an active owner maintains the registry; the same check runs on replay.
  check(() => { status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec() }), U('sup'), M('sup')), 403); status(() => reg.authorizeIndicatorRegistry(s, { ...M('own'), isOwner: false }, { type: 'retireIndicatorDefinition' }), 403); status(() => reg.authorizeIndicatorRegistry(s, { ...M('own'), status: 'suspended' }, { type: 'addIndicatorDefinition' }), 403); assert.equal(applyReleased(s, { type: 'opsMaintenance' }, U('own'), M('own')), null); });
  // Definitions use the fixed vocabulary only.
  check(() => {
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec({ denominator: null }) }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec({ unit: 'count' }) }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec({ numerator: 'patient-names' }) }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: { ...spec(), sql: 'select * from patients' } }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec({ filters: { village: 'Chak' } }) }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec({ minimumCohort: 3 }) }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { spec: spec(), reason: 'short' }), U('own'), M('own')), 422);
    status(() => applyReleased(s, cmd('addIndicatorDefinition', { id: 'visits-confirmed', spec: spec() }), U('own'), M('own')), 409);
  });
  // Add, then a result names the definition and version it used.
  const added = applyReleased(s, cmd('addIndicatorDefinition', { spec: spec() }), U('own'), M('own'), '2026-09-29T10:00:00.000Z');
  const first = x.indicatorQuery(s, M('sup'), q(['older-seen', 'visits-confirmed']), now);
  check(() => { assert.deepEqual(added, { id: 'older-seen', version: 1, status: 'active' }); const r = first.results[0]; assert.equal(r.version, 1); assert.equal(r.definition.id, 'older-seen'); assert.match(r.definition.canonical, /"ageBand":"50\+"/); assert.equal(r.rows[0].numerator, 7); assert.equal(r.rows[0].denominator, 7); assert.equal(s.workspace.audit.at(-1).action, 'indicatorDefinition'); });
  // Revise appends version 2; version 1 is unchanged and still reproduces the earlier result.
  const v1 = JSON.stringify(x.registryRecords(s).find(r => r.id === 'older-seen'));
  check(() => { status(() => applyReleased(s, cmd('reviseIndicatorDefinition', { expectedVersion: 2, spec: spec() }), U('own'), M('own')), 409); const r = applyReleased(s, cmd('reviseIndicatorDefinition', { expectedVersion: 1, spec: spec({ filters: {}, title: 'Adults seen' }) }), U('own'), M('own')); assert.equal(r.version, 2); assert.equal(JSON.stringify(x.registryRecords(s).find(d => d.id === 'older-seen' && d.version === 1)), v1); });
  check(() => { const cur = x.indicatorQuery(s, M('sup'), q(['older-seen']), now).results[0]; assert.equal(cur.version, 2); assert.equal(cur.rows[0].denominator, 19); const again = x.indicatorQuery(s, M('sup'), q(['older-seen@1', 'visits-confirmed@1']), now); assert.deepEqual(again.results, first.results, 'an earlier result is reproduced from its recorded versions'); status(() => x.indicatorQuery(s, M('sup'), q(['older-seen@9']), now), 422); status(() => x.indicatorQuery(s, M('sup'), q(['older-seen@1;drop']), now), 422); });
  // A definition's own minimum cohort and exclusions apply after its filters.
  check(() => {
    applyReleased(s, cmd('reviseIndicatorDefinition', { expectedVersion: 2, spec: spec({ filters: {}, exclude: ['identity-provisional'], minimumCohort: 12 }) }), U('own'), M('own'));
    const all = x.indicatorQuery(s, M('sup'), q(['older-seen']), now).results[0]; assert.equal(all.rows[0].denominator, 17, 'provisional identities excluded');
    const bedi = x.indicatorQuery(s, M('sup'), q(['older-seen'], { village: 'Bedi' }), now).results[0]; assert.equal(bedi.refused, 'cohort'); assert.deepEqual(bedi.rows, []);
  });
  // Retiring stops current use, keeps every version reproducible and leaves the catalogue.
  check(() => {
    applyReleased(s, cmd('retireIndicatorDefinition', { expectedVersion: 3 }), U('own'), M('own'));
    const e = status(() => x.indicatorQuery(s, M('sup'), q(['older-seen']), now), 422); assert.match(e.message, /retired/);
    assert.deepEqual(x.indicatorQuery(s, M('sup'), q(['older-seen@1']), now).results[0].rows, first.results[0].rows);
    assert.ok(!x.catalogue(s).some(d => d.id === 'older-seen')); status(() => applyReleased(s, cmd('reviseIndicatorDefinition', { expectedVersion: 4, spec: spec() }), U('own'), M('own')), 409);
    status(() => x.indicatorQuery(s, M('sup'), q(['older-seen@4']), now), 422);
  });
  // A built-in can be revised by an owner; its version 1 stays reproducible; the interpreter follows the registry.
  check(() => {
    applyReleased(s, { type: 'reviseIndicatorDefinition', id: 'visits-confirmed', expectedVersion: 1, spec: { title: 'Confirmed visits, maternal care', unit: 'count', numerator: 'visits-confirmed', denominator: null, filters: { programme: 'Maternal care' }, exclude: [], exclusionsNote: 'Voided and superseded visits', owner: 'Maternal programme lead', cadence: 'Weekly', minimumCohort: 5 }, reason: 'Programme asked for a maternal-only count' }, U('own'), M('own'));
    assert.equal(x.indicatorQuery(s, M('sup'), q(['visits-confirmed']), now).results[0].refused, 'cohort');
    assert.equal(x.indicatorQuery(s, M('sup'), q(['visits-confirmed@1']), now).results[0].rows[0].value, 19);
    applyReleased(s, { type: 'retireIndicatorDefinition', id: 'corrections', expectedVersion: 1, reason: 'Superseded by the audit view' }, U('own'), M('own'));
    assert.deepEqual(x.interpret('visit corrections last week', s).ids, ['visits-confirmed']);
  });
  // Series carry per-cell people counts only, never patient identifiers.
  check(() => { const run = x.indicatorRun(s, M('sup'), q(['patients-seen'], { group: 'village' }), now); assert.deepEqual(run.series.find(r => r.key === 'cohort').cells, { All: 19 }); const v = run.series.find(r => r.key !== 'cohort'); assert.deepEqual(v.cells, { Alpur: 10, Bedi: 7, Chak: 2 }); assert.deepEqual(v.ids, ['patients-seen@1']); assert.ok(!/Alpur-\d|Bedi \d|"name"/.test(JSON.stringify(run.series))); });
  // Differencing: a parent cohort minus a child (or the sum of its one-filter children) leaving 1..4 people is caught.
  const R = (f, c, over = {}) => ({ v: 'viewer', at: '2026-09-30T05:00:00.000Z', k: 'series', f, c, ...over });
  const at = '2026-09-30T06:00:00.000Z';
  check(() => {
    const total = R({}, { All: 19 }), alpur = R({ village: 'A' }, { All: 10 }), bedi = R({ village: 'B' }, { All: 7 }), nearly = R({ village: 'AB' }, { All: 17 });
    assert.equal(dif.differencingRisk([total], alpur, 5, at), null, 'remainder of 9 is safe');
    assert.equal(dif.differencingRisk([total, alpur], bedi, 5, at), 2, 'total minus two villages leaves two people');
    assert.equal(dif.differencingRisk([total], nearly, 5, at), 2, 'one filter differing reveals two');
    assert.equal(dif.differencingRisk([nearly], total, 5, at), 2, 'order does not matter');
    assert.equal(dif.differencingRisk([alpur], bedi, 5, at), null, 'disjoint cohorts without their parent');
    assert.equal(dif.differencingRisk([total], R({ team: 'T' }, { All: 19 }), 5, at), null, 'remainder of zero is safe');
  });
  check(() => {
    const total = R({}, { All: 19 }), nearly = R({ village: 'AB' }, { All: 17 });
    assert.equal(dif.differencingRisk([{ ...total, v: 'other' }], nearly, 5, at), null, 'another viewer');
    assert.equal(dif.differencingRisk([{ ...total, k: 'other-series' }], nearly, 5, at), null, 'another series');
    assert.equal(dif.differencingRisk([{ ...total, at: '2026-09-20T05:00:00.000Z' }], nearly, 5, at), null, 'outside the seven-day window');
    assert.equal(dif.differencingRisk([R({ team: 'T' }, { All: 19 })], R({ team: 'T', programme: 'P' }, { All: 16 }), 5, at), 3, 'nested inside another filter');
    assert.equal(dif.differencingRisk([R({}, { x: 12, y: 9 })], R({ village: 'A' }, { x: 12, y: 6 }), 5, at), 3, 'per grouped cell');
    assert.equal(dif.differencingRisk([R({}, { All: 19 })], R({ village: 'A', team: 'T' }, { All: 17 }), 5, at), null, 'two filters apart is not a one-filter child');
    // Slice 6w: this assertion tested the defect itself (count eviction kept the newest LEDGER_LIMIT entries and
    // dropped protecting entries inside the window). It is replaced: pruning is by time only, every one of the
    // 500 in-window releases is kept, and a repeat of the same viewer, series and filters replaces its older release.
    const many = Array.from({ length: 600 }, (_, i) => R({ village: String(i) }, { All: 5 }, { at: i < 100 ? '2026-09-01T00:00:00.000Z' : at }));
    assert.equal(dif.pruneLedger(many, at).length, 500);
    assert.equal(dif.pruneLedger([...many, R({ village: '599' }, { All: 6 })], at).length, 500);
  });
  const result = { suite: 'indicator registry contract (slice 6s)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/indicator-registry-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
