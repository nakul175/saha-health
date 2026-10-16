// Slice 6ac contract: source freshness, late arrivals and the data-still-syncing warning beside indicator results.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.indicator-freshness-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'indicator-freshness', 'indicators', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'indicator-freshness.js')));
  const now = new Date('2026-09-30T06:00:00.000Z'), since = '2026-09-01T00:00:00.000Z', until = now.toISOString(), old = '2026-01-01T08:00:00.000Z';
  const hrs = (iso, h) => new Date(Date.parse(iso) + h * 3600000).toISOString();
  const base = { age: 30, sex: 'Female', task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: old, version: 1, assignedTo: 'asha', assigned: true, programmes: ['General care'] };
  const person = (id, teamId, village, over = {}) => ({ ...base, id, name: `Name ${id}`, village, teamId, ...over });
  const visit = (id, personId, over = {}) => ({ id, personId, version: 1, state: 'confirmed', facts: { date: '2026-09-20T10:00' }, createdAt: '2026-09-20T10:05:00.000Z', confirmedAt: '2026-09-20T10:10:00.000Z', aiResults: [], recordVersion: 1, ...over });
  const member = (userId, teamIds) => ({ userId, displayName: userId, role: 'supervisor', isOwner: false, status: 'active', version: 1, teamIds, createdAt: old });

  // 1. Described times: a date, a local date-time read as UTC, and nothing usable.
  check(() => {
    assert.equal(x.describedTime('2026-09-20'), '2026-09-20T00:00:00.000Z');
    assert.equal(x.describedTime('2026-09-20T10:00'), '2026-09-20T10:00:00.000Z');
    assert.equal(x.describedTime(''), null); assert.equal(x.describedTime('not a date'), null);
  });
  // 2. The late threshold is strictly more than 72 hours; a record with no described time is never late.
  check(() => {
    const d = '2026-09-20T10:00:00.000Z';
    assert.equal(x.isLate({ arrival: hrs(d, 72), described: d }), false);
    assert.equal(x.isLate({ arrival: hrs(d, 72.02), described: d }), true);
    assert.equal(x.isLate({ arrival: hrs(d, 500), described: null }), false);
  });
  // 3. Records are classified by source: online confirmed visits, field syncs (grant stamp and offline registration),
  // imports (patients, enrolments, identifiers) and accepted programme receipts; voided, superseded and online drafts are not records.
  const p1 = person('a1', 't1', 'Alpur', { imported: { batchId: 'b', row: 1, at: '2026-09-10T00:00:00.000Z', by: 'u', planHash: 'h' }, enrolments: [{ id: 'e1', packId: 'maternal', state: 'active', startDate: '2026-08-01', imported: { batchId: 'b2', row: 1, planHash: 'h', at: '2026-09-11T00:00:00.000Z', by: 'u' } }], identifiers: [{ issuer: 'rch', value: '1', verified: false, recordedAt: '2026-09-12T00:00:00.000Z', recordedBy: 'u', source: 'import', imported: { batchId: 'b3', row: 1, planHash: 'h' } }] });
  const p2 = person('a2', 't1', 'Alpur', { fieldRegistration: { id: 'reg-1', by: 'asha', capturedAt: '2026-09-15T08:00:00.000Z', syncedAt: '2026-09-25T08:00:00.000Z' } });
  const s1 = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team one' }, { id: 't2', name: 'Team two' }], members: [], workspace: { people: [p1, p2], referrals: [], audit: [],
    visits: [visit('v1', 'a1'), visit('v2', 'a1', { facts: { date: '2026-09-01T10:00' }, confirmedAt: '2026-09-21T10:00:00.000Z' }), visit('v3', 'a1', { state: 'draft', confirmedAt: undefined }), visit('v4', 'a1', { voidedAt: '2026-09-22T00:00:00.000Z' }), visit('v5', 'a1', { supersededBy: 'v1' }),
      visit('v6', 'a1', { state: 'draft', confirmedAt: undefined, fieldSync: { leaseId: 'l1', at: '2026-09-23T10:00:00.000Z' }, facts: { date: '2026-09-23T09:00' } }), visit('v7', 'a2', { state: 'draft', confirmedAt: undefined, fieldRegistrationId: 'reg-1', facts: { date: '2026-09-15T08:00' } })],
    submissions: [{ id: 's1', personId: 'a1', state: 'accepted', receipt: 'R1', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' }, { id: 's2', personId: 'a1', state: 'uncertain', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }, { id: 's3', personId: 'a1', state: 'accepted', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }] } };
  check(() => {
    const r = x.sourceRecords(s1, [p1, p2]);
    assert.deepEqual(r['online-visits'].map(v => v.arrival), ['2026-09-20T10:10:00.000Z', '2026-09-21T10:00:00.000Z']);
    assert.deepEqual(r['field-syncs'], [{ arrival: '2026-09-23T10:00:00.000Z', described: '2026-09-23T09:00:00.000Z' }, { arrival: '2026-09-25T08:00:00.000Z', described: '2026-09-15T08:00:00.000Z' }]);
    assert.deepEqual(r.imports, [{ arrival: '2026-09-10T00:00:00.000Z', described: null }, { arrival: '2026-09-11T00:00:00.000Z', described: '2026-08-01T00:00:00.000Z' }, { arrival: '2026-09-12T00:00:00.000Z', described: null }]);
    assert.deepEqual(r['programme-receipts'], [{ arrival: '2026-09-09T00:00:00.000Z', described: '2026-09-02T00:00:00.000Z' }]);
    assert.deepEqual(x.sourceRecords(s1, [p2])['online-visits'], [], 'records of people outside the set are not counted');
  });
  // 4. Bands: 0 to 4 are one band, so neither zero nor a small count is told apart; no exact count is ever returned.
  check(() => {
    assert.deepEqual([0, 1, 4, 5, 19, 20, 99, 100, 5000].map(x.band), ['fewer than 5', 'fewer than 5', 'fewer than 5', '5–19', '5–19', '20–99', '20–99', '100 or more', '100 or more']);
  });
  // 5. The late share needs 20 records with a described time and neither 1 to 4 late nor 1 to 4 on time; nearest 10 points.
  check(() => {
    assert.equal(x.lateShare(5, 19), null); assert.equal(x.lateShare(3, 40), null); assert.equal(x.lateShare(37, 40), null);
    assert.equal(x.lateShare(0, 20), 0); assert.equal(x.lateShare(20, 20), 100); assert.equal(x.lateShare(7, 20), 40); assert.equal(x.lateShare(13, 40), 30);
  });
  // 6. Per-source freshness: latest record to the hour, banded arrivals and late records, share withheld with a reason.
  check(() => {
    const f = x.freshnessOf(x.sourceRecords(s1, [p1, p2]), since, until);
    assert.deepEqual(f.map(r => r.source), ['online-visits', 'field-syncs', 'imports', 'programme-receipts']);
    const on = f[0]; assert.equal(on.latestAt, '2026-09-21T10:00:00.000Z'); assert.equal(on.arrivals, 'fewer than 5'); assert.equal(on.late, 'fewer than 5'); assert.equal(on.lateShare, null); assert.match(on.lateShareNote, /fewer than 20/);
    assert.equal(f[1].latestAt, '2026-09-25T08:00:00.000Z');
    // 25 online visits, 10 of them confirmed more than 72 hours after the visit date: share stated as 40%.
    const many = Array.from({ length: 25 }, (_, i) => ({ arrival: '2026-09-20T10:10:00.000Z', described: i < 10 ? '2026-09-10T10:00:00.000Z' : '2026-09-20T10:00:00.000Z' }));
    const g = x.freshnessOf({ 'online-visits': many, 'field-syncs': [], imports: [], 'programme-receipts': [] }, since, until)[0];
    assert.equal(g.arrivals, '20–99'); assert.equal(g.late, '5–19'); assert.equal(g.lateShare, 40); assert.equal(g.lateShareNote, null);
    const outside = x.freshnessOf({ 'online-visits': many, 'field-syncs': [], imports: [], 'programme-receipts': [] }, '2026-09-25T00:00:00.000Z', until)[0];
    assert.equal(outside.arrivals, 'fewer than 5'); assert.equal(outside.latestAt, '2026-09-20T10:00:00.000Z', 'latest record is stated even outside the window');
  });
  // 7. Team level only: the viewer's teams (or the one named), village and programme never applied, and no names, ids or villages.
  const people = [...Array.from({ length: 12 }, (_, i) => person(`t1-${i}`, 't1', i < 6 ? 'Alpur' : 'Bedi')), ...Array.from({ length: 6 }, (_, i) => person(`t2-${i}`, 't2', 'Chak'))];
  const leases = (status, createdAt) => [{ id: 'l-' + status + createdAt, actorId: 'asha', memberVersion: 1, visitId: 'v', visitVersion: 1, identityHash: 'h', consentVersion: 1, expiresAt: hrs(createdAt, 24), status, packageHash: 'p', createdAt }];
  people[0].fieldLeases = leases('active', hrs(now.toISOString(), -13));
  people[1].fieldLeases = leases('active', hrs(now.toISOString(), -2));
  people[2].fieldLeases = leases('synced', hrs(now.toISOString(), -30));
  people[12].fieldLeases = leases('revoked', hrs(now.toISOString(), -30));
  const s2 = { organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team one' }, { id: 't2', name: 'Team two' }, { id: 't3', name: 'Team three' }], members: [], workspace: { people, referrals: [], audit: [], submissions: [], visits: people.map((p, i) => visit('v' + i, p.id)) } };
  check(() => {
    const f = x.teamFreshness(s2, member('sup', ['t1', 't2']), {}, { since, until }, now);
    assert.deepEqual(f.teams.map(t => t.team), ['Team one', 'Team two']);
    assert.deepEqual(x.teamFreshness(s2, member('sup', ['t1', 't2']), { team: 't2' }, { since, until }, now).teams.map(t => t.team), ['Team two']);
    assert.deepEqual(x.teamFreshness(s2, member('sup', ['t1']), { team: 't3' }, { since, until }, now).teams, [], 'a team the viewer does not belong to is never reported');
    const text = JSON.stringify(f);
    for (const leak of ['Alpur', 'Bedi', 'Chak', 't1-0', 'Name ', 'asha', 'v0']) assert.ok(!text.includes(leak), `freshness output must not contain ${leak}`);
    assert.ok(!/"\d+"|:\d+[,}]/.test(JSON.stringify(f.teams)), 'no exact count appears in the team figures');
  });
  // 8. Data still syncing: only active grants prepared more than 12 hours ago; synced, revoked and recent grants do not warn.
  check(() => {
    const f = x.teamFreshness(s2, member('sup', ['t1', 't2']), {}, { since, until }, now);
    assert.equal(f.teams[0].syncing.grants, 'fewer than 5'); assert.match(f.teams[0].syncing.message, /Data still syncing/);
    assert.equal(f.teams[1].syncing, null);
    assert.equal(x.unsyncedGrants(people, now), 1);
  });
  // 9. Late arrivals since the viewer's previous release: only late, confirmed, live visits in the cohort that arrived after it and
  // inside the window; banded; not applicable to measures without a visit source; no previous release states that instead.
  const def = (numerator, denominator = null, filters = {}, exclude = []) => ({ spec: { numerator, denominator, filters, exclude } });
  const last = '2026-09-20T00:00:00.000Z';
  const lateVisits = people.slice(0, 12).map((p, i) => visit('lv' + i, p.id, { facts: { date: '2026-09-10T10:00' }, confirmedAt: i < 6 ? '2026-09-25T10:00:00.000Z' : '2026-09-15T10:00:00.000Z', sex: undefined }));
  const s3 = { ...s2, workspace: { ...s2.workspace, visits: [...lateVisits, visit('ontime', 't1-0', { facts: { date: '2026-09-25T09:00' }, confirmedAt: '2026-09-25T10:00:00.000Z' }), visit('voided', 't1-1', { facts: { date: '2026-09-01T09:00' }, confirmedAt: '2026-09-25T10:00:00.000Z', voidedAt: '2026-09-26T00:00:00.000Z' })] } };
  check(() => {
    assert.deepEqual(x.lateSinceRelease(s3, people, def('followups-open'), since, until, last).applicable, false);
    const none = x.lateSinceRelease(s3, people, def('visits-confirmed'), since, until, null); assert.equal(none.count, null); assert.match(none.note, /No earlier release/);
    const r = x.lateSinceRelease(s3, people, def('visits-confirmed'), since, until, last);
    assert.equal(r.count, '5–19'); assert.equal(r.since, '2026-09-20T00:00:00.000Z');
    assert.equal(x.lateSinceRelease(s3, people, def('patients-seen', 'patients'), since, until, last).count, '5–19', 'a proportion over people with a visit source applies');
    assert.equal(x.lateSinceRelease(s3, people, def('referrals-created'), since, until, last).applicable, true);
    assert.equal(x.lateSinceRelease(s3, people, def('visits-confirmed'), since, until, '2026-09-26T00:00:00.000Z').count, 'fewer than 5', 'nothing after a later release');
    assert.equal(x.lateSinceRelease(s3, people, def('visits-confirmed', null, { sex: 'Male' }), since, until, last).count, 'fewer than 5', 'the definition cohort narrows the count');
    assert.equal(x.lateSinceRelease(s3, people, def('visits-confirmed'), '2026-09-26T00:00:00.000Z', until, last).count, 'fewer than 5', 'only arrivals inside the window');
  });
  // Slice 13d (tenth review): a correction of an earlier visit keeps the old described time but is not a late arrival.
  check(() => {
    const corrected = { ...s3, workspace: { ...s3.workspace, visits: s3.workspace.visits.map(v => ['lv0', 'lv1'].includes(v.id) ? { ...v, amendsVisitId: 'original-' + v.id } : v) } };
    assert.equal(x.lateSinceRelease(corrected, people, def('visits-confirmed'), since, until, last).count, 'fewer than 5', 'six late visits, two of them corrections: four count');
  });
  const result = { suite: 'indicator freshness contract (slice 6ac)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/indicator-freshness-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
