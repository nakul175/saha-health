// Slice R26 (BR-DATA-06) correction propagation: shadow comparisons are recomputed (amended) or invalidated
// (voided) instead of reviewed; released indicator figures are recomputed and marked affected; referral and
// follow-up tasks link their sources; internal outputs past the task cap that the server already recomputes stay
// recomputed (not reviewed); open correction tasks expose their follow-up/referral source links. External
// corrections are still never sent automatically.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.r26-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['types', 'programmes', 'mis', 'adapter-operations', 'core', 'fact-provenance', 'delegation', 'agent', 'task-limits', 'governance', 'capability-lifecycle', 'access', 'evaluation', 'ai-budget', 'referral-rules', 'shadow', 'continuity', 'indicators', 'correction-tasks'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const C = await import(pathToFileURL(join(dir, 'correction-tasks.js')));
  const S = await import(pathToFileURL(join(dir, 'shadow.js')));
  const I = await import(pathToFileURL(join(dir, 'indicators.js')));

  const now = '2026-10-01T06:00:00.000Z', confirmedAt = '2026-09-28T06:00:00.000Z', after = '2026-09-29T06:00:00.000Z';
  const actor = id => ({ userId: id, displayName: id.toUpperCase() });
  const shadowOutput = { proposals: [{ field: 'weight', value: '60', quote: 'w', start: 0, end: 1 }], highlights: [] };

  // One corrected visit, one shadow result, two releases and one episode-backed follow-up.
  const fresh = () => ({
    organisation: { id: 'org' },
    teams: [{ id: 't1', name: 'Team One' }],
    members: [{ userId: 'doc', displayName: 'DOC', accountCode: 'X', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now }],
    operations: { indicatorReleases: [{ at: after, k: 'series-hash-1' }, { at: confirmedAt, k: 'series-hash-2' }] },
    governance: { shadows: [{ id: 'sh1', entryId: 'cap', revision: 1, results: [{ visitId: 'v1', personId: 'p1', visitVersion: 3, at: after, status: 'compared', output: shadowOutput, fields: [] }] }], entries: [] },
    workspace: {
      role: 'clinician', audit: [], integrations: [], submissions: [],
      people: [{ id: 'p1', name: 'P1', age: 30, sex: 'Female', village: 'V', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, createdAt: now, version: 4, teamId: 't1', assignedTo: 'doc', assigned: true,
        enrolments: [{ id: 'e1', packId: 'maternal', packVersion: 1, state: 'active', episodeLabel: 'ANC', startDate: confirmedAt, createdAt: confirmedAt, createdBy: 'doc', registration: 'not_submitted' }],
        followUps: [{ id: 'f1', enrolmentId: 'e1', packId: 'maternal', title: 'Recheck', due: '2026-10-05', ownerId: 'doc', state: 'open', createdAt: after, createdBy: 'doc' }] }],
      visits: [{ id: 'v1', personId: 'p1', version: 3, recordVersion: 1, state: 'confirmed', confirmedAt, createdAt: confirmedAt, facts: { date: '2026-09-28', weight: '60', systolic: '', diastolic: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' },
        programmeCapture: { packs: [{ enrolmentId: 'e1' }], answers: {}, absence: {} } }],
      referrals: [{ id: 'r1', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'High BP', state: 'sent', createdAt: after }],
    },
  });

  // 1. Shadow comparison: recomputed for an amendment, invalidated for a void.
  check(() => {
    const amend = C.correctionTasks(fresh(), fresh().workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    const sh = amend.find(t => t.output.kind === 'shadow-comparison');
    assert.equal(sh.action, 'recomputed'); assert.equal(sh.state, 'done');
    assert.deepEqual(sh.output.recomputed, { outcome: 'recomputed', visitId: 'v1b' });
    assert.match(sh.instruction, /recomputed against the correction visit/);
    const voided = C.correctionTasks(fresh(), fresh().workspace.visits[0], 'void', actor('doc'), now, null);
    const vsh = voided.find(t => t.output.kind === 'shadow-comparison');
    assert.equal(vsh.action, 'invalidated'); assert.equal(vsh.state, 'done');
    assert.deepEqual(vsh.output.recomputed, { outcome: 'invalidated', visitId: null });
  });

  // 2. recompareShadow follows the amendment chain and invalidates a voided or missing visit.
  check(() => {
    const s = fresh();
    s.workspace.visits[0].supersededBy = 'v1b';
    s.workspace.visits.push({ id: 'v1b', personId: 'p1', version: 1, recordVersion: 1, state: 'confirmed', confirmedAt: now, createdAt: now, amendsVisitId: 'v1', facts: { date: '2026-10-01', weight: '61', systolic: '', diastolic: '', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' }, aiResults: [] });
    const r = s.governance.shadows[0].results[0];
    const rc = S.recompareShadow(s, r);
    assert.equal(rc.outcome, 'recomputed'); assert.equal(rc.visitId, 'v1b');
    assert.equal(rc.fields.find(x => x.field === 'weight').outcome, 'disagreement', 'recomputed against the corrected weight');
    s.workspace.visits.find(v => v.id === 'v1b').voidedAt = now;
    assert.equal(S.recompareShadow(s, r).outcome, 'invalidated');
    assert.equal(S.recompareShadow({ ...s, workspace: { ...s.workspace, visits: [] } }, r).outcome, 'invalidated', 'a gone visit is invalidated');
  });

  // 3. affectedReleases marks only the releases at or after the visit's confirmation.
  check(() => {
    const s = fresh();
    assert.deepEqual(I.affectedReleases(s, s.workspace.visits[0].confirmedAt), [{ at: after, k: 'series-hash-1' }, { at: confirmedAt, k: 'series-hash-2' }]);
    assert.deepEqual(I.affectedReleases(s, after), [{ at: after, k: 'series-hash-1' }]);
    assert.deepEqual(I.affectedReleases(s), []);
    assert.deepEqual(I.affectedReleases({ operations: {} }, confirmedAt), []);
  });

  // 4. The indicator-releases task is recomputed and marks the affected figures (ledger identity only).
  check(() => {
    const tasks = C.correctionTasks(fresh(), fresh().workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    const ir = tasks.find(t => t.output.kind === 'indicator-releases');
    assert.equal(ir.action, 'recomputed'); assert.equal(ir.state, 'done');
    assert.equal(ir.output.count, 2);
    assert.deepEqual(ir.output.releases, [{ at: after, k: 'series-hash-1' }, { at: confirmedAt, k: 'series-hash-2' }]);
    assert.doesNotMatch(JSON.stringify(ir), /"n"|"d"|"c"|"m"|"f":/, 'no cell or filter value leaks onto the task');
  });

  // 5. Follow-up and referral tasks link their sources.
  check(() => {
    const tasks = C.correctionTasks(fresh(), fresh().workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    const f = tasks.find(t => t.output.kind === 'follow-up');
    assert.deepEqual(f.output.sources.map(x => x.kind), ['enrolment', 'visit'], 'the episode and the visit that captured it');
    assert.equal(f.output.sources[0].refId, 'e1'); assert.equal(f.output.sources[1].refId, 'v1');
    assert.match(f.instruction, /depends on it/);
    const r = tasks.find(t => t.output.kind === 'referral');
    assert.deepEqual(r.output.sources, [{ kind: 'visit', refId: 'v1', visitId: 'v1', label: 'the visit that made the referral' }]);
  });

  // 6. openCorrectionTasks exposes the follow-up/referral source links.
  check(() => {
    const s = fresh();
    const tasks = C.correctionTasks(s, s.workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    s.workspace.visits[0].correctionTasks = tasks;
    const open = C.openCorrectionTasks(s, s.workspace.people[0]);
    const f = open.find(x => x.task.output.kind === 'follow-up');
    assert.ok(f.sources.length >= 1); assert.equal(f.sources[0].refId, 'e1'); assert.equal(f.sources[0].kind, 'enrolment');
    const r = open.find(x => x.task.output.kind === 'referral');
    assert.equal(r.sources[0].refId, 'v1'); assert.equal(r.sources[0].visitId, 'v1');
  });

  // 7. Internal outputs past the cap that the server already recomputes stay recomputed (a 'done' fold), while
  // open outputs still fold into one review task per kind.
  check(() => {
    const s = fresh();
    for (let i = 0; i < 70; i++) s.workspace.referrals.push({ id: 'rx' + i, personId: 'p1', visitId: 'v1', facility: 'F', reason: 'R', state: 'sent', createdAt: after });
    const tasks = C.correctionTasks(s, s.workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    const folded = tasks.filter(t => !t.output.refId && t.output.kind === 'referral');
    assert.equal(folded.length, 1); assert.equal(folded[0].state, 'open'); assert.equal(folded[0].action, 'review');
    assert.match(folded[0].instruction, /need review/);
    const listed = tasks.filter(t => t.output.kind === 'referral' && t.output.refId).length;
    assert.equal(listed + folded[0].output.count, s.workspace.referrals.filter(r => r.visitId === 'v1').length);
    const doneFold = tasks.filter(t => !t.output.refId && t.output.kind === 'shadow-comparison');
    assert.equal(doneFold.length, 1, 'the already-recomputed shadow comparison is folded as done, not review');
    assert.equal(doneFold[0].state, 'done'); assert.equal(doneFold[0].action, 'recomputed');
    assert.match(doneFold[0].instruction, /need no review/);
  });

  // 8. External corrections are still never sent automatically.
  check(() => {
    const s = fresh();
    s.workspace.integrations = [{ id: 'mc', kind: 'mis', mode: 'http', status: 'active', version: 1, mis: { corrections: true } }];
    s.workspace.submissions = [{ id: 's1', visitId: 'v1', personId: 'p1', connectorId: 'mc', connectorName: 'MC', state: 'accepted', mode: 'http', payloadHash: 'h', attempts: 1, message: '', receipt: 'R1', createdAt: confirmedAt, updatedAt: confirmedAt }];
    const tasks = C.correctionTasks(s, s.workspace.visits[0], 'amend', actor('doc'), now, 'v1b');
    const sub = tasks.find(t => t.output.kind === 'programme-submission');
    assert.equal(sub.action, 'send-correction'); assert.match(sub.instruction, /Nothing is sent automatically/);
  });

  writeFileSync('tests/r26-correction-propagation-contract-result.json', JSON.stringify({ passed, suite: 'r26-correction-propagation-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'r26-correction-propagation-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
