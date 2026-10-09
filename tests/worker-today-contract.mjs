// Tests the new presentation adapter only; not server authorisation or end-to-end saves.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const src = readFileSync('public/worker-today/model.js', 'utf8');
const { readWork, personPath, findPeople } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const base = () => ({ environment: 'synthetic', role: 'asha',
  user: { userId: 'synthetic-asha' }, membership: { userId: 'synthetic-asha', role: 'asha', status: 'active', displayName: 'Sunita' },
  organisation: { id: 'synthetic-org', name: 'Synthetic district' },
  people: [{ id: 'p-1', assigned: true, name: 'Meena', village: 'Demo village', task: 'Routine follow-up', due: 'Today', status: 'due' },
    { id: 'p-2', assigned: true, name: 'Meena', village: 'Another demo village', task: 'Visit', due: 'Tomorrow', status: 'in_progress' },
    { id: 'p-3', assigned: true, name: 'Rani', village: 'Demo', task: 'Visit', due: '', status: 'completed' },
    { id: 'hidden', assigned: false, name: 'Excluded record' }] });
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
check('Assigned records only', () => assert.deepEqual(readWork(base()).people.map(p => p.id), ['p-1', 'p-2', 'p-3']));
check('Open work excludes completed without losing people', () => assert.deepEqual(readWork(base()).work.map(p => p.id), ['p-1', 'p-2']));
check('Equal names stay distinct', () => assert.equal(findPeople(readWork(base()).people, 'Meena').length, 2));
check('Source ordering retained', () => { const x = base(); x.people.reverse(); assert.equal(readWork(x).work[0].id, 'p-2'); });
check('Valid empty response', () => assert.equal(readWork({ ...base(), people: [] }).work.length, 0));
for (const environment of ['production', 'staging', 'misconfigured', undefined]) check('Refuses environment ' + environment, () => assert.throws(() => readWork({ ...base(), environment })));
for (const role of ['admin', 'clinician', 'provider']) check('Refuses preview for ' + role, () => assert.throws(() => readWork({ ...base(), role })));
check('Inactive membership refused', () => { const x = base(); x.membership.status = 'suspended'; assert.throws(() => readWork(x)); });
check('Changed user binding refused', () => { const x = base(); x.user.userId = 'different'; assert.throws(() => readWork(x)); });
check('Paged snapshot refused as incomplete', () => assert.throws(() => readWork({ ...base(), patientPaging: { total: 700, window: [] } })));
check('Maintenance refused', () => assert.throws(() => readWork({ ...base(), maintenance: { active: true } })));
check('Malformed people refused', () => assert.throws(() => readWork({ ...base(), people: null })));
check('Duplicate record IDs refused', () => { const x = base(); x.people[1].id = 'p-1'; assert.throws(() => readWork(x)); });
check('Missing status refused', () => { const x = base(); delete x.people[0].status; assert.throws(() => readWork(x)); });
check('Source input is not mutated', () => { const x = base(), before = JSON.stringify(x); readWork(x); assert.equal(JSON.stringify(x), before); });
check('Patient query is encoded without extra parameters', () => { const u = new URL(personPath('a&visit=evil#x'), 'https://example.test'); assert.equal(u.searchParams.get('patient'), 'a&visit=evil#x'); assert.equal(u.searchParams.size, 1); assert.equal(u.origin, 'https://example.test'); });
check('URL-looking identifier cannot navigate externally', () => assert.ok(personPath('https://evil.test').startsWith('/app?patient=')));
check('Empty identifier refused', () => assert.throws(() => personPath('')));
check('Search is case insensitive and contextual', () => assert.equal(findPeople(readWork(base()).people, 'ANOTHER')[0].id, 'p-2'));
check('Adapter output excludes unneeded record payloads', () => { const x = base(); x.people[0].privateNotes = 'not needed'; assert.equal(JSON.stringify(readWork(x)).includes('not needed'), false); });
const result = { kind: 'Presentation adapter only', passed: checks.length, failed: 0, skipped: 0, checks };
mkdirSync('tests/reports', { recursive: true });
writeFileSync('tests/reports/worker-today-contract-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
