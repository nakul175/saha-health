import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { suite } from './lib/report.mjs';

const report = suite('Frontline scoped follow-up projection and versioned proposal', 'tests/reports/frontline-followup-contract-result.json',
  { layer: 'unit', environment: 'Actual TypeScript helper, synthetic projection fixtures', limits: ['Display/command construction checks; server authorization and real browser state are separately exercised.'] });
const dir = mkdtempSync(join(process.cwd(), '.frontline-followup-unit-'));
try {
  for (const name of ['frontline-followup', 'household-visit-constants']) {
    const output = ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, name + '.js'), output);
  }
  const { followupSelector: select, frontlinePlan: project, frontlineReschedule: proposal, frontlineRecord, rescheduleAccepted } = await import(pathToFileURL(join(dir, 'frontline-followup.js')));
  const fixture = () => ({ household: { id: 'h1', version: 3 }, visitPlan: { householdVersion: 3,
    minDate: '2026-10-12', maxDate: '2027-01-10', members: [
      { personId: 'p1', items: [{ refs: [{ kind: 'follow-up', id: 'f1' }], owner: 'Assigned worker', attention: 'overdue', daysOverdue: 2 }] },
      { personId: 'p2', name: 'OTHER PERSON SECRET', items: [] }], visits: [
      { id: 's1', date: '2026-10-14', window: 'morning', state: 'planned', canReschedule: true, outsideScopeCovered: 0, replacesVisitId: null,
        covers: [{ personId: 'p1', version: 5, items: [{ kind: 'follow-up', id: 'f1', title: 'Existing follow-up', due: '2026-10-10', open: true, lateByDays: 4 }] },
          { personId: 'p2', version: 9, items: [{ kind: 'home-visit', id: 'p2', title: 'OTHER PRIVATE TITLE', due: 'Today', open: true, lateByDays: 0 }] }] },
      { id: 's2', date: '2026-10-13', window: 'evening', state: 'cancelled', canReschedule: false, outsideScopeCovered: 0, replacesVisitId: null,
        covers: [{ personId: 'p1', version: 5, items: [] }] }] } });
  await report.check('Exact selectors are accepted without granting authority', () => assert.deepEqual(select(new URLSearchParams('personId=p1&organisationId=o1')), { personId: 'p1', organisationId: 'o1' }));
  for (const [name, query] of [['missing organisation', 'personId=p1'], ['duplicate person', 'personId=p1&personId=p2&organisationId=o1'],
    ['duplicate organisation', 'personId=p1&organisationId=o1&organisationId=o2'], ['unknown selector', 'personId=p1&organisationId=o1&role=owner'],
    ['empty selector', 'personId=&organisationId=o1'], ['unbounded selector', `personId=${'p'.repeat(101)}&organisationId=o1`]]) {
    await report.check('Refuse ' + name, () => assert.equal(select(new URLSearchParams(query)), null));
  }
  await report.check('Explicit null household is distinct from empty visits', () => assert.deepEqual(project({ household: null }, 'p1'), { kind: 'no-household' }));
  await report.check('Missing plan is unavailable, not empty', () => assert.throws(() => project({ household: { id: 'h1', version: 3 } }, 'p1')));
  await report.check('Missing selected member refuses projection', () => assert.throws(() => project(fixture(), 'p99')));
  await report.check('Mismatched household versions refuse projection', () => { const f = fixture(); f.visitPlan.householdVersion++; assert.throws(() => project(f, 'p1')); });
  await report.check('Only the selected person’s planned item content is returned', () => { const p = project(fixture(), 'p1'); assert.equal(p.slots.length, 1); assert.equal(p.slots[0].items[0].title, 'Existing follow-up'); assert.doesNotMatch(JSON.stringify(p), /SECRET|PRIVATE TITLE/); });
  await report.check('Source due date, overdue state, owner and open status survive unchanged', () => { const i = project(fixture(), 'p1').slots[0].items[0]; assert.equal(i.due, '2026-10-10'); assert.equal(i.daysOverdue, 2); assert.equal(i.owner, 'Assigned worker'); assert.equal(i.open, true); });
  await report.check('Closed referenced work remains closed', () => { const f = fixture(); f.visitPlan.visits[0].covers[0].items[0].open = false; assert.equal(project(f, 'p1').slots[0].items[0].open, false); });
  await report.check('Valid empty planned list stays explicitly empty', () => { const f = fixture(); f.visitPlan.visits = []; assert.deepEqual(project(f, 'p1').slots, []); });
  await report.check('Duplicate slots refuse ambiguous projection', () => { const f = fixture(); f.visitPlan.visits.push(f.visitPlan.visits[0]); assert.throws(() => project(f, 'p1')); });
  await report.check('Duplicate cover refuses ambiguous versions', () => { const f = fixture(); f.visitPlan.visits[0].covers.push(f.visitPlan.visits[0].covers[0]); assert.throws(() => project(f, 'p1')); });
  await report.check('Projection leaves the input untouched', () => { const f = fixture(), before = JSON.stringify(f); project(f, 'p1'); assert.equal(JSON.stringify(f), before); });
  await report.check('Reschedule retains all covered person versions and the existing household version', () => { const c = proposal(project(fixture(), 'p1'), 's1', '2026-10-15', 'afternoon'); assert.deepEqual(c, { type: 'householdVisitReschedule', householdId: 'h1', version: 3, visitId: 's1', date: '2026-10-15', window: 'afternoon', personVersions: [{ personId: 'p1', version: 5 }, { personId: 'p2', version: 9 }] }); });
  await report.check('Noneligible slot cannot form a command', () => { const f = fixture(); f.visitPlan.visits[0].canReschedule = false; assert.throws(() => proposal(project(f, 'p1'), 's1', '2026-10-15', 'afternoon')); });
  await report.check('Unknown slot cannot form a command', () => assert.throws(() => proposal(project(fixture(), 'p1'), 'other', '2026-10-15', 'afternoon')));
  await report.check('Unchanged time cannot form a command', () => assert.throws(() => proposal(project(fixture(), 'p1'), 's1', '2026-10-14', 'morning')));
  await report.check('Out of range and invalid dates refuse', () => { for (const value of ['2026-10-11', '2027-01-11', '2026-02-30']) assert.throws(() => proposal(project(fixture(), 'p1'), 's1', value, 'afternoon')); });
  await report.check('Unknown window refuses without an invented timing policy', () => assert.throws(() => proposal(project(fixture(), 'p1'), 's1', '2026-10-15', 'night')));
  await report.check('Verified selected record projection excludes unrelated data', () => assert.deepEqual(frontlineRecord({ record: { id: 'p1', name: 'Selected', privateOther: 'SECRET' } }, 'p1'), { id: 'p1', name: 'Selected' }));
  await report.check('A different record cannot satisfy the URL selector', () => assert.throws(() => frontlineRecord({ record: { id: 'p2', name: 'Other' } }, 'p1'), /refused/));
  await report.check('A missing record never becomes an empty identity', () => assert.throws(() => frontlineRecord({}, 'p1')));
  await report.check('Accepted result requires the same previous-slot link and a real replacement identifier', () => {
    assert.deepEqual(rescheduleAccepted({ result: { visitId: 'new', replacesVisitId: 's1' } }, 's1'), { visitId: 'new', replacesVisitId: 's1' });
    assert.throws(() => rescheduleAccepted({ result: { visitId: 'new', replacesVisitId: 'other' } }, 's1'));
    assert.throws(() => rescheduleAccepted({ result: null }, 's1'));
  });
  await report.check('Visible cover count is not inferred to be the total when other covers are outside scope', () => {
    const f = fixture(); f.visitPlan.visits[0].outsideScopeCovered = 1; f.visitPlan.visits[0].canReschedule = false;
    const s = project(f, 'p1').slots[0]; assert.equal(s.personVersions.length, 2); assert.equal(s.hasOutsideScope, true);
    assert.equal(s.canReschedule, false); assert.doesNotMatch(JSON.stringify(s), /SECRET|PRIVATE TITLE/); assert.ok(!('outsideScopeCovered' in s));
  });
  await report.check('One visible covered person can still be a partially visible shared visit', () => {
    const f = fixture(); f.visitPlan.visits[0].covers = f.visitPlan.visits[0].covers.slice(0, 1); f.visitPlan.visits[0].outsideScopeCovered = 2;
    const s = project(f, 'p1').slots[0]; assert.equal(s.personVersions.length, 1); assert.equal(s.hasOutsideScope, true);
  });
  await report.check('An all-visible slot has no outside-scope limitation', () => assert.equal(project(fixture(), 'p1').slots[0].hasOutsideScope, false));
  await report.check('Missing outside-scope metadata is unavailable, not assumed to be zero', () => {
    const f = fixture(); delete f.visitPlan.visits[0].outsideScopeCovered; assert.throws(() => project(f, 'p1'));
  });
  await report.check('Invalid outside-scope metadata cannot fabricate a sharing claim', () => {
    for (const count of [-1, 0.5, '1']) { const f = fixture(); f.visitPlan.visits[0].outsideScopeCovered = count; assert.throws(() => project(f, 'p1')); }
  });
} finally { rmSync(dir, { recursive: true, force: true }); }
await report.finish();
