// Slice 2j correction propagation contract: every downstream output of an amended or voided visit becomes an owned
// task; external outputs are never corrected automatically; tasks appear in the action plan and exception queue;
// closing needs evidence (a verified correction receipt or a reason), is audited and never changes the output.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.correction-tasks-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'correction-tasks', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'exceptions', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'indicators', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'referrals', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'correction-tasks.js')));
  const { actionPlan } = await import(pathToFileURL(join(dir, 'action-plan.js')));
  const { exceptionQueue, EXCEPTION_RULES_VERSION } = await import(pathToFileURL(join(dir, 'exceptions.js')));
  const now = '2026-10-01T06:00:00.000Z', confirmedAt = '2026-09-28T06:00:00.000Z', before = '2026-09-27T06:00:00.000Z', after = '2026-09-29T06:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, createdAt: now, version: 4, teamId: 't1' };
  const sub = (id, connectorId, state, over = {}) => ({ id, visitId: 'v1', personId: 'p1', connectorId, connectorName: connectorId.toUpperCase(), state, mode: 'http', payloadHash: 'h', attempts: 1, message: '', createdAt: confirmedAt, updatedAt: confirmedAt, ...over });
  const withdrawn = { version: 2, allowed: ['create', 'lookup'], aggregateOnly: false, setBy: 'own', setAt: before, reason: 'Synthetic withdrawal', history: [] };
  const fresh = () => ({
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'),
      member('own', 'clinician', { isOwner: true, teamIds: [] }), member('adm', 'admin', { isOwner: true, teamIds: [] })],
    operations: { indicatorReleases: [{ at: after }, { at: before }] },
    governance: { entries: [], evaluations: [], safety: [], shadows: [{ id: 'sh1', results: [{ visitId: 'v1', personId: 'p1', visitVersion: 3, at: after, status: 'compared' }, { visitId: 'v7', personId: 'p1', visitVersion: 1, at: after, status: 'compared' }] }] },
    workspace: { role: 'clinician', audit: [],
      integrations: [{ id: 'mc', kind: 'mis', mode: 'http', status: 'active', version: 1, mis: { corrections: true } }, { id: 'mn', kind: 'mis', mode: 'http', status: 'active', version: 1, mis: { corrections: false } },
        { id: 'mw', kind: 'mis', mode: 'http', status: 'active', version: 2, mis: { corrections: true }, operations: withdrawn }],
      submissions: [sub('s1', 'mc', 'accepted', { receipt: 'R1' }), sub('s2', 'mn', 'accepted', { receipt: 'R2' }), sub('s3', 'mw', 'accepted', { receipt: 'R3' }), sub('s4', 'mc', 'uncertain'), sub('s5', 'mc', 'queued'), sub('s6', 'mc', 'rejected'), sub('s7', 'mc', 'accepted', { visitId: 'v7', receipt: 'R7' })],
      people: [{ ...base, id: 'p1', name: 'P1', assignedTo: 'asha', assigned: true,
        ehr: { links: [], permissions: [], documents: [], operations: [{ id: 'e1', visitId: 'v1', state: 'accepted', receipt: 'DOC-1', at: after }, { id: 'e2', visitId: 'v1', state: 'uncertain', at: after }, { id: 'e3', visitId: 'v1', state: 'prepared', at: after }, { id: 'e4', visitId: 'v7', state: 'accepted', at: after }] },
        followUps: [{ id: 'f0', title: 'Older', due: '2026-10-05', ownerId: 'asha', state: 'open', createdAt: before, packId: 'maternal' }, { id: 'f1', title: 'Recheck', due: '2026-10-05', ownerId: 'asha', state: 'open', createdAt: after, packId: 'maternal' }, { id: 'f2', title: 'Done', due: '2026-10-05', ownerId: 'asha', state: 'completed', createdAt: after, packId: 'maternal' }] }],
      visits: [{ id: 'v1', personId: 'p1', version: 3, recordVersion: 1, state: 'confirmed', confirmedAt, createdAt: before, facts: {}, plan: { id: 'pl', state: 'approved' },
        protocolChecks: [{ id: 'c1', findings: [{ label: 'High BP', urgency: 'urgent_review' }], decision: { decision: 'accepted' } }, { id: 'c2', findings: [] }],
        agentRuns: [{ id: 'a1', task: 'extract', status: 'applied', provider: { name: 'Synthetic assistant' } }, { id: 'a2', task: 'summary', status: 'review', provider: { name: 'Synthetic assistant' } }],
        aiResults: [{ id: 'ai1', providerName: 'Demo', reviewed: true }, { id: 'ai2', providerName: 'Demo', reviewed: false }] },
        { id: 'v7', personId: 'p1', version: 1, recordVersion: 1, state: 'confirmed', confirmedAt: after, createdAt: after, facts: {} }],
      referrals: [{ id: 'r1', personId: 'p1', visitId: 'v1', facility: 'CHC', state: 'sent', createdAt: after }, { id: 'r2', personId: 'p1', visitId: 'v1', facility: 'PHC', state: 'completed', createdAt: after },
        { id: 'r3', personId: 'p1', visitId: 'v7', facility: 'DH', state: 'sent', createdAt: after, sources: [{ id: 'rs1', kind: 'visit', refId: 'v1', visitId: 'v1', sourceAt: confirmedAt, linkedAt: after, by: 'doc', note: 'Synthetic' }] }, { id: 'r4', personId: 'p1', visitId: 'v7', facility: 'DH', state: 'sent', createdAt: after }] },
  });
  const m = id => s.members.find(y => y.userId === id), u = id => ({ userId: id, displayName: id.toUpperCase() });
  let s = fresh();
  const v1 = () => s.workspace.visits.find(v => v.id === 'v1');
  const tasks = x.correctionTasks(s, v1(), 'amend', u('doc'), now, 'v1b');
  const by = id => tasks.find(t => t.output.refId === id), kinds = {};
  for (const t of tasks) kinds[t.output.kind] = (kinds[t.output.kind] ?? 0) + 1;

  // 1. Every downstream output of the amended version, and nothing else.
  check(() => {
    assert.deepEqual(kinds, { 'programme-submission': 5, 'ehr-publication': 3, plan: 1, referral: 2, 'follow-up': 1, 'protocol-evaluation': 2, 'assistant-result': 3, 'shadow-comparison': 1, 'worker-activity': 1, 'indicator-releases': 1 });
    for (const gone of ['s6', 's7', 'e4', 'r2', 'r4', 'f0', 'f2', 'ai2']) assert.equal(by(gone), undefined, gone);
    assert.ok(tasks.every(t => t.visitId === 'v1' && t.correctionVisitId === 'v1b' && t.cause === 'amend' && t.ownerId === 'doc' && t.createdBy === 'doc' && t.createdAt === now));
  });
  // 2. External outputs: correction path only where the destination supports it and its operation setting permits update.
  check(() => {
    assert.equal(by('s1').action, 'send-correction'); assert.equal(by('s1').external, true); assert.equal(by('s1').output.receipt, 'R1'); assert.match(by('s1').instruction, /Nothing is sent automatically/);
    assert.equal(by('s2').action, 'manual-correction'); assert.equal(by('s3').action, 'manual-correction', 'update withdrawn by the operation setting');
    assert.equal(by('s4').action, 'look-up-first'); assert.match(by('s4').instruction, /Never resend blindly/); assert.equal(by('s5').action, 'cancel-unsent');
    assert.equal(by('e1').action, 'manual-correction'); assert.equal(by('e2').action, 'look-up-first'); assert.equal(by('e3').action, 'invalidated'); assert.equal(by('e3').state, 'done');
    assert.ok(tasks.filter(t => t.external).every(t => t.state === 'open'));
  });
  // 3. Internal outputs: invalidated where the server already refuses them, recomputed where computed on read, review otherwise.
  check(() => {
    assert.equal(by('pl').action, 'invalidated'); assert.equal(by('c1').action, 'review'); assert.equal(by('c2').action, 'invalidated');
    assert.equal(by('a1').action, 'review'); assert.equal(by('a2').action, 'invalidated'); assert.equal(by('ai1').action, 'review');
    assert.equal(by('r1').action, 'review'); assert.equal(by('r3').action, 'review'); assert.equal(by('f1').action, 'review');
    assert.equal(by('sh1').action, 'recomputed'); assert.equal(by('sh1').state, 'done'); assert.deepEqual(by('sh1').output.recomputed, { outcome: 'recomputed', visitId: 'v1b' }, 'slice 13c: the reports re-derive it on read');
    const wa = tasks.find(t => t.output.kind === 'worker-activity'), ir = tasks.find(t => t.output.kind === 'indicator-releases');
    assert.equal(wa.action, 'recomputed'); assert.equal(wa.state, 'done'); assert.match(wa.instruction, /corrected/);
    assert.equal(ir.action, 'review', 'a released figure is not recalled; a person decides whether to reissue it'); assert.equal(ir.state, 'open');
    // Slice 13d (ninth review, finding 9): the task says only that figures were released since confirmation, not how many or which.
    assert.equal(ir.output.count, undefined); assert.equal(ir.output.releases, undefined); assert.match(ir.output.stateAtCorrection, /^figures released since confirmation \(2026-09-28\)$/);
    assert.doesNotMatch(JSON.stringify(ir), /indicatorReleases|"f":|\b1 release|\d+ released/);
    assert.equal(tasks.filter(t => t.state === 'open').length, 14); assert.equal(tasks.filter(t => t.state === 'done').length, 6);
  });
  // 3b. Slice R26 source links: a referral names the visit that made it or a linked source; a follow-up names its episode.
  check(() => {
    assert.deepEqual(by('r1').output.sources, [{ kind: 'visit', refId: 'v1', visitId: 'v1', label: 'the visit that made the referral' }]);
    assert.deepEqual(by('r3').output.sources, [{ kind: 'visit', refId: 'v1', visitId: 'v1', label: 'a visit named as a source' }]);
    assert.deepEqual(by('f1').output.sources, [], 'a follow-up with no recorded episode or capture visit has no source link');
  });
  // 4. A void has no correction path: the accepted submission becomes a manual reversal; nothing is recomputed as corrected.
  check(() => {
    const vt = x.correctionTasks(fresh(), fresh().workspace.visits[0], 'void', u('doc'), now, null);
    const s1 = vt.find(t => t.output.refId === 's1');
    assert.equal(s1.action, 'manual-correction'); assert.match(s1.instruction, /reverse or void/); assert.equal(vt.find(t => t.output.kind === 'worker-activity').instruction.includes('wrong-patient'), true);
    const vsh = vt.find(t => t.output.kind === 'shadow-comparison');
    assert.equal(vsh.action, 'invalidated', 'a shadow comparison of a wrong-patient visit is left out of the reports'); assert.deepEqual(vsh.output.recomputed, { outcome: 'invalidated', visitId: null }); assert.match(vsh.instruction, /wrong patient/);
    assert.ok(vt.every(t => t.cause === 'void' && t.correctionVisitId === null));
    const none = fresh(); none.operations = {}; const nt = x.correctionTasks(none, none.workspace.visits[0], 'amend', u('doc'), now, 'v1b');
    assert.equal(nt.find(t => t.output.kind === 'indicator-releases').state, 'done', 'no release, nothing to review');
  });
  v1().correctionTasks = tasks; v1().supersededBy = 'v1b';
  s.workspace.visits.push({ id: 'v1b', personId: 'p1', version: 2, recordVersion: 1, state: 'confirmed', confirmedAt: now, createdAt: now, facts: {}, amendsVisitId: 'v1' });
  const p1 = s.workspace.people[0];

  // 5. Action plan: one item per open task with owner, age, link and close permission; external first.
  check(() => {
    const plan = actionPlan(s, m('sup'), p1, now), items = plan.items.filter(i => i.kind === 'correction');
    assert.equal(items.length, 14, 'the affected indicator release stays open for review; the shadow comparison is recomputed on read');
    assert.ok(items.every(i => i.owner.userId === 'doc' && i.owner.eligible && !i.ownershipGap && i.correction.canClose && i.correction.ageDays === 0 && i.correction.href === '/?patient=p1&visit=v1'));
    const firstInternal = items.findIndex(i => !i.correction.external), lastExternal = items.map(i => i.correction.external).lastIndexOf(true);
    assert.ok(lastExternal < firstInternal, 'external tasks (urgent) are listed before internal ones');
    assert.equal(items.find(i => i.correction.taskId === by('s1').id).correction.receiptCloses, true);
    assert.equal(actionPlan(s, m('asha'), p1, '2026-10-04T06:00:00.000Z').items.find(i => i.kind === 'correction').correction.ageDays, 3);
  });
  // 6. Ownership gap when the correcting worker loses access.
  check(() => {
    m('doc').status = 'suspended';
    const items = actionPlan(s, m('sup'), p1, now).items.filter(i => i.kind === 'correction');
    assert.ok(items.every(i => i.ownershipGap && i.queue === 'Supervisors of Team One' && i.attention === 'escalated'));
    const q = exceptionQueue(s, m('sup'), now).items.filter(r => r.kind === 'correction-task');
    assert.ok(q.every(r => r.owner === 'Supervisors of Team One'));
    m('doc').status = 'active';
  });
  // 7. Exception queue: rows with owner, age, recovery and link; external rows high severity; rules 1.3.0; care workers refused.
  check(() => {
    const q = exceptionQueue(s, m('sup'), '2026-10-03T06:00:00.000Z'), rows = q.items.filter(r => r.kind === 'correction-task');
    assert.equal(EXCEPTION_RULES_VERSION, '1.3.0'); assert.equal(q.rulesVersion, '1.3.0'); assert.equal(rows.length, 14); assert.equal(q.counts['correction-task'], 14);
    assert.ok(rows.every(r => r.owner === 'DOC' && r.ageDays === 2 && r.link.href === '/?patient=p1&visit=v1' && /Close it from the patient's action plan/.test(r.recovery)));
    assert.equal(rows.filter(r => r.severity === 'high').length, 7); assert.equal(rows.filter(r => r.severity === 'normal').length, 7);
    const adm = exceptionQueue(s, m('adm'), now); assert.equal(adm.items.some(r => r.kind === 'correction-task'), false, 'administrators see delivery rows only');
    status(() => exceptionQueue(s, m('asha'), now), 403);
  });
  const close = (who, c, at = now) => x.applyCorrectionTask(s, { type: 'closeCorrectionTask', personId: 'p1', visitId: 'v1', ...c }, u(who), m(who), at);
  // 8. Close authority: administrators, other teams and an owner outside the patient's team are refused; scope is rechecked by authorizeCorrectionTask.
  check(() => {
    for (const who of ['adm', 'doc2', 'own']) status(() => close(who, { taskId: by('r1').id, reason: 'Synthetic closing reason' }), 403);
    status(() => x.authorizeCorrectionTask(s, m('doc2'), { type: 'closeCorrectionTask', personId: 'p1' }), 403);
    assert.equal(x.authorizeCorrectionTask(s, m('sup'), { type: 'closeCorrectionTask', personId: 'p1' }), undefined);
    assert.equal(x.applyCorrectionTask(s, { type: 'assignPlanItem' }, u('doc'), m('doc'), now), null, 'other commands are not handled');
    assert.equal(x.applyCorrectionTask(s, { type: 'closeCorrectionTask', personId: 'p1', visitId: 'v1', taskId: by('r1').id, reason: 'short' }, u('doc'), m('doc'), now), null, 'a short reason fails the schema');
  });
  // 9. Evidence: none, a receipt on a manual task, a receipt that is not a correction from this chain, a stale or unknown task.
  check(() => {
    status(() => close('doc', { taskId: by('r1').id }), 422);
    status(() => close('doc', { taskId: by('s2').id, receiptId: 'R2' }), 422);
    status(() => close('doc', { taskId: by('s1').id, receiptId: 'R1' }), 422);
    status(() => close('doc', { taskId: by('s1').id, receiptId: 'R7' }), 422);
    status(() => close('doc', { taskId: 'missing', reason: 'Synthetic closing reason' }), 404);
    status(() => close('doc', { taskId: by('e3').id, reason: 'Synthetic closing reason' }), 409);
    assert.equal(s.workspace.audit.length, 0, 'refusals write nothing');
  });
  // 10. A verified correction receipt closes the send-correction task; the original submission is untouched.
  check(() => {
    s.workspace.submissions.push(sub('s8', 'mn', 'accepted', { visitId: 'v1b', receipt: 'R-WRONG-DEST' }), sub('s9', 'mc', 'accepted', { visitId: 'v1b', receipt: 'R-CORR' }));
    status(() => close('doc', { taskId: by('s1').id, receiptId: 'R-WRONG-DEST' }), 422);
    const before = JSON.stringify(s.workspace.submissions.find(y => y.id === 's1'));
    const r = close('doc', { taskId: by('s1').id, receiptId: 'R-CORR' });
    assert.deepEqual(r, { taskId: by('s1').id, state: 'closed', verified: true });
    const t = v1().correctionTasks.find(y => y.id === by('s1').id);
    assert.equal(t.state, 'closed'); assert.deepEqual(t.closed, { by: 'doc', byName: 'DOC', at: now, verified: true, receiptId: 'R-CORR' });
    assert.equal(JSON.stringify(s.workspace.submissions.find(y => y.id === 's1')), before, 'the accepted submission is not rewritten');
    const a = s.workspace.audit.at(-1); assert.equal(a.action, 'closeCorrectionTask'); assert.equal(a.personId, 'p1'); assert.equal(a.subject, 'v1'); assert.match(a.detail, /receipt R-CORR verified.*not changed/);
    status(() => close('doc', { taskId: by('s1').id, reason: 'Synthetic second close attempt' }), 409);
  });
  // 11. Manual closure with a reason and destination reference; unsent delivery must be cancelled first; supervisor and assigned ASHA may close.
  check(() => {
    const r = close('sup', { taskId: by('s2').id, reference: 'MN-CASE-42', reason: 'Destination corrected the record by phone.' });
    assert.equal(r.verified, false); const t = v1().correctionTasks.find(y => y.id === by('s2').id);
    assert.equal(t.closed.reference, 'MN-CASE-42'); assert.equal(t.closed.reason, 'Destination corrected the record by phone.'); assert.match(s.workspace.audit.at(-1).detail, /Destination reference: MN-CASE-42/);
    status(() => close('doc', { taskId: by('s5').id, reason: 'Synthetic cancellation evidence' }), 409);
    s.workspace.submissions.find(y => y.id === 's5').state = 'cancelled';
    assert.equal(close('doc', { taskId: by('s5').id, reason: 'Unsent delivery cancelled.' }).state, 'closed');
    assert.equal(close('asha', { taskId: by('f1').id, reason: 'Follow-up still applies after the correction.' }).state, 'closed');
    assert.equal(actionPlan(s, m('sup'), p1, now).items.filter(i => i.kind === 'correction').length, 10);
    assert.equal(exceptionQueue(s, m('sup'), now).items.filter(i => i.kind === 'correction-task').length, 10);
    assert.equal(x.correctionsOf(s, 'v1').map(v => v.id).join(), 'v1b');
  });
  // 12. Too many downstream outputs. Slice 6ad (ninth review, finding 9) replaced the expected 422 refusal ("ask an
  // administrator", with no administrator path, so such a visit could never be corrected): the visit is corrected, and
  // internal outputs past the cap are folded into one review task per kind that counts them all.
  check(() => {
    const big = fresh(); for (let i = 0; i < 70; i++) big.workspace.referrals.push({ id: 'rx' + i, personId: 'p1', visitId: 'v1', facility: 'F', state: 'sent', createdAt: after });
    const tasks = x.correctionTasks(big, big.workspace.visits[0], 'amend', u('doc'), now, 'v1b');
    assert.ok(tasks.length <= 70, 'bounded: at most 60 tasks plus one per folded kind');
    const listed = tasks.filter(t => t.output.kind === 'referral' && t.output.refId).length, folded = tasks.filter(t => t.output.kind === 'referral' && !t.output.refId);
    assert.equal(folded.length, 1); assert.equal(listed + folded[0].output.count, big.workspace.referrals.filter(r => r.visitId === 'v1').length, 'every referral of the visit is listed or counted'); assert.equal(folded[0].state, 'open'); assert.match(folded[0].instruction, /listed here as one task/);
  });
  writeFileSync('tests/correction-tasks-contract-result.json', JSON.stringify({ passed, suite: 'correction-tasks-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'correction-tasks-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
