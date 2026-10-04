// Slice 10c incentive claims contract: schedule, eligibility, no double claiming, role steps, immutability, digest chain,
// corrections as new linked claims, scope and the CSV. The chain is recomputed here with node:crypto, not with module code.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.incentive-claims-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const acheck = async fn => { await fn(); passed++; };
const status = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
const sha = t => createHash('sha256').update(t).digest('hex');
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'incentives', 'incentives-view', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'incentives.js'))), v = await import(pathToFileURL(join(dir, 'incentives-view.js')));
  const NOW = '2026-10-02T06:00:00.000Z', ago = d => new Date(Date.parse(NOW) - d * 86400000).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'CODE-' + userId.toUpperCase(), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: ago(100), ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic locality', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: ago(100), version: 1 };
  const visit = (id, personId, by, days, over = {}) => ({ id, personId, version: 3, recordVersion: 1, state: 'confirmed', facts: {}, aiResults: [], createdAt: ago(days), confirmedAt: ago(days), patientCheck: { personId, personVersion: 1, by, at: ago(days) }, ...over });
  const sub = (id, visitId, personId, state, receipt) => ({ id, visitId, personId, connectorId: 'mis', connectorName: 'MIS', state, mode: 'demo', payloadHash: 'h', attempts: 1, message: '', createdAt: ago(1), updatedAt: ago(1), ...(receipt ? { receipt } : {}) });
  const event = (by, days, state, visitId) => ({ at: ago(days), by, state, note: 'Synthetic outcome note', reference: 'REF-' + days, ...(visitId ? { visitId } : {}) });
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: ago(100) }, teams: [{ id: 't1', name: 'One', createdAt: ago(100) }, { id: 't2', name: 'Two', createdAt: ago(100) }], invitations: [],
    operations: { version: 1, maintenance: false, reason: '', updatedAt: ago(1), incidents: [], rates: null },
    members: [member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t1']), member('own', 'clinician', ['t1', 't2'], { isOwner: true }), member('doc', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('asha2', 'asha', ['t1']), member('ashab', 'asha', ['t2']), member('adm', 'admin', [], { isOwner: true }), member('prov', 'provider', [])],
    outreach: { templates: [], messages: [], plans: [{ id: 'op', version: 3, title: 'Round', date: ago(2).slice(0, 10), teamId: 't1', criteria: 'x', createdAt: ago(5), createdBy: 'sup', state: 'scheduled', history: [], items: [
      { id: 'i1', personId: 'P2', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 1, 'completed', 'v8')] },
      { id: 'i2', personId: 'P', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 1, 'completed')] },
      { id: 'i3', personId: 'P', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 1, 'completed', 'v4')] },
      { id: 'i4', personId: 'R', ownerId: 'asha2', reason: 'x', state: 'completed', events: [event('asha2', 1, 'completed', 'v9')] }] }] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [],
      people: [{ ...base, id: 'P', name: 'Patient P', teamId: 't1', assignedTo: 'asha' }, { ...base, id: 'P2', name: 'Patient P2', teamId: 't1', assignedTo: 'asha' }, { ...base, id: 'Q', name: 'Patient Q', teamId: 't2', assignedTo: 'ashab' }, { ...base, id: 'R', name: 'Patient R', teamId: 't1', assignedTo: 'asha2' }],
      visits: [visit('v1', 'P', 'asha', 2), visit('v2', 'P', 'asha', 3), visit('v3', 'P2', 'asha', 4), visit('v4', 'P', 'asha', 5, { voidedAt: ago(1), voidReason: 'Recorded against the wrong person' }), visit('v5', 'P', 'asha', 6, { supersededBy: 'v10' }), visit('v6', 'P', 'asha', 1, { state: 'draft', confirmedAt: undefined }), visit('v7', 'P', 'asha', 40), visit('v8', 'P2', 'asha', 1), visit('v9', 'R', 'asha2', 2), visit('v10', 'P', 'doc', 2), visit('vq', 'Q', 'ashab', 2)],
      submissions: [sub('s1', 'v1', 'P', 'accepted', 'SIM-1'), sub('s2', 'v2', 'P', 'rejected')] },
  };
  const M = id => s.members.find(m => m.userId === id), U = id => ({ userId: id, displayName: M(id).displayName, email: id + '@example.invalid' });
  let clock = NOW;
  const run = (who, cmd, at = clock) => x.applyIncentives(s, cmd, U(who), M(who), at);
  const view = (who, q = {}) => v.incentiveView(s, M(who), NOW, q);
  const SCHEDULE = { type: 'setIncentiveSchedule', expectedVersion: 0, label: 'Synthetic placeholder schedule', lines: [{ kind: 'visit-confirmed', amount: 10 }, { kind: 'visit-submitted', amount: 15 }, { kind: 'outreach-completed', amount: 20 }], reason: 'Placeholder amounts to test the claim workflow' };

  // The schedule: owner only, versioned, validated, labelled synthetic.
  await acheck(async () => { for (const who of ['sup', 'doc', 'asha', 'sup2']) await status(() => run(who, SCHEDULE), 403); await status(() => run('own', { ...SCHEDULE, expectedVersion: 1 }), 409); });
  await acheck(async () => {
    for (const bad of [{ lines: [{ kind: 'visit-confirmed', amount: 10 }, { kind: 'visit-confirmed', amount: 12 }] }, { lines: [{ kind: 'visit-confirmed', amount: 0 }] }, { lines: [{ kind: 'visit-confirmed', amount: x.MAX_AMOUNT + 1 }] }, { lines: [{ kind: 'visit-confirmed', amount: 1.5 }] }, { lines: [{ kind: 'home-delivery', amount: 5 }] }, { lines: [] }, { label: '=cmd' }, { reason: 'too short' }])
      await status(() => run('own', { ...SCHEDULE, ...bad }), 422);
    await status(() => run('own', { ...SCHEDULE, extra: 1 }), 422);
  });
  await acheck(async () => { await status(() => run('asha', { type: 'prepareIncentiveClaim', teamId: 't1', from: ago(10).slice(0, 10), to: NOW.slice(0, 10) }), 409, /has not set a synthetic incentive schedule/); });
  await acheck(async () => { const r = await run('own', SCHEDULE); assert.equal(r.version, 1); assert.equal(x.incentiveState(s).schedules[0].lines.length, 3); assert.match(s.workspace.audit.at(-1).detail, /Placeholder amounts; no payment is made or implied/); });
  await acheck(async () => { await status(() => run('own', SCHEDULE), 409, /schedule changed/); const r = await run('own', { ...SCHEDULE, expectedVersion: 1, label: 'Second placeholder schedule', lines: [{ kind: 'visit-confirmed', amount: 10 }, { kind: 'visit-submitted', amount: 15 }, { kind: 'outreach-completed', amount: 20 }] }); assert.equal(r.version, 2); });
  // Who prepares, and the period.
  const period = { from: ago(30).slice(0, 10), to: NOW.slice(0, 10) }, PREP = { type: 'prepareIncentiveClaim', teamId: 't1', ...period };
  await acheck(async () => { for (const who of ['sup', 'doc', 'own', 'adm', 'prov']) await status(() => run(who, PREP), 403); await status(() => run('ashab', PREP), 403); await status(() => run('asha', { ...PREP, teamId: 't2' }), 403); });
  await acheck(async () => {
    await status(() => run('asha', { ...PREP, from: NOW.slice(0, 10), to: ago(1).slice(0, 10) }), 422, /end on or after/);
    await status(() => run('asha', { ...PREP, to: new Date(Date.parse(NOW) + 86400000).toISOString().slice(0, 10) }), 422, /future/);
    await status(() => run('asha', { ...PREP, from: ago(40).slice(0, 10) }), 422, /at most 31 days/);
    await status(() => run('asha', { ...PREP, from: '2026-02-30', to: '2026-03-01' }), 422);
    await status(() => run('asha', { ...PREP, from: ago(200).slice(0, 10), to: ago(100).slice(0, 10) }), 422, /at most 31 days/);
    await status(() => run('asha', { ...PREP, from: ago(120).slice(0, 10), to: ago(100).slice(0, 10) }), 422, /No eligible/);
  });
  // Eligibility: exactly the claimant's own current confirmed activity inside her scope, priced by the schedule.
  const preview = (await view('asha', { from: period.from, to: period.to, team: 't1' })).eligible;
  check(() => { assert.deepEqual(preview.lines.map(l => [l.ref, l.kind, l.amount]).sort(), [['i1', 'outreach-completed', 20], ['v1', 'visit-submitted', 15], ['v2', 'visit-confirmed', 10], ['v3', 'visit-confirmed', 10]]); assert.equal(preview.total, 55); assert.equal(preview.lines.find(l => l.ref === 'v1').receipt, 'SIM-1'); assert.equal(preview.lines.find(l => l.ref === 'i1').evidenceVisitId, 'v8'); });
  check(() => { const refs = preview.lines.map(l => l.ref); for (const no of ['v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'vq', 'i2', 'i3', 'i4']) assert.equal(refs.includes(no), false, `${no} is not eligible`); });
  // The schedule decides what is claimable: without an outreach price the evidence visit is claimed as a visit.
  check(() => { const sched = { ...x.currentSchedule(x.incentiveState(s)), lines: [{ kind: 'visit-confirmed', amount: 7 }] }, f = x.eligibleActivity(s, M('asha'), 't1', period.from, period.to, sched, NOW); assert.deepEqual(f.rows.map(r => [r.ref, r.kind]).sort(), [['v1', 'visit-confirmed'], ['v2', 'visit-confirmed'], ['v3', 'visit-confirmed'], ['v8', 'visit-confirmed']]); assert.equal(f.skipped.notInSchedule, 1, 'the outreach item is not priced'); });
  let claimA;
  await acheck(async () => { const r = await run('asha', PREP); claimA = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.equal(r.number, 1); assert.equal(r.lines, 4); assert.equal(r.total, 55); assert.equal(claimA.state, 'submitted'); assert.equal(claimA.scheduleVersion, 2); assert.deepEqual(claimA.history.map(h => h.action), ['submitted']); });
  // No double claiming: nothing of claim 1 is offered or accepted again, by anyone, in any period.
  await acheck(async () => { await status(() => run('asha', PREP), 422, /No eligible/); await status(() => run('asha', { ...PREP, from: ago(3).slice(0, 10) }), 422, /No eligible/); const again = (await view('asha', { from: period.from, to: period.to, team: 't1' })).eligible; assert.equal(again.lines.length, 0); assert.equal(again.skipped.alreadyClaimed, 4); });
  check(() => { const f = x.eligibleActivity(s, M('asha2'), 't1', period.from, period.to, x.currentSchedule(x.incentiveState(s)), NOW); assert.deepEqual(f.rows.map(r => r.ref), ['i4'], 'only her own outreach item, on her own patient'); });
  // An evidence visit is on one live claim only: an outreach completion resting on an already claimed visit is not offered.
  check(() => { const k = x.claimedKeys(x.incentiveState(s)); assert.ok(k.has('visit:v1') && k.has('visit:v8') && k.has('item:i1') && !k.has('visit:v9')); const item = { id: 'i5', personId: 'P2', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 0.5, 'completed', 'v3')] }; s.outreach.plans[0].items.push(item); const f = x.eligibleActivity(s, M('asha'), 't1', period.from, period.to, x.currentSchedule(x.incentiveState(s)), NOW); assert.equal(f.rows.some(r => r.ref === 'i5'), false); assert.equal(f.skipped.alreadyClaimed >= 1, true); s.outreach.plans[0].items.pop(); });
  // Role steps. Verification: a supervisor of the claimant's team, never the claimant or the preparer.
  const V = (claim, over = {}) => ({ type: 'verifyIncentiveClaim', claimId: claim.id, version: claim.version, decision: 'verified', note: 'Checked against the visit records', ...over });
  const D = (claim, over = {}) => ({ type: 'decideIncentiveClaim', claimId: claim.id, version: claim.version, decision: 'approved', note: 'Approved for the synthetic record', ...over });
  await acheck(async () => { for (const who of ['asha', 'asha2', 'ashab', 'doc', 'adm', 'prov']) await status(() => run(who, V(claimA)), 403); await status(() => run('own', D(claimA)), 409, /Only a verified claim/); await status(() => run('sup', V(claimA, { version: 9 })), 409, /changed/); });
  await acheck(async () => { await status(() => run('sup', V(claimA, { decision: 'returned', note: 'too short' })), 422, /at least 10 characters/); await status(() => run('sup', V(claimA, { note: '=SUM(1)' })), 422); });
  // Evidence that stops standing blocks verification and approval; returning releases the lines.
  await acheck(async () => {
    const vis = s.workspace.visits.find(x2 => x2.id === 'v2'); vis.voidedAt = ago(0.2); vis.voidReason = 'Late wrong-patient finding';
    const e = await status(() => run('sup', V(claimA)), 409, /no longer has current evidence \(The visit was marked as recorded against the wrong patient on 2026-10-02\.\)/); assert.ok(!/Late wrong-patient finding/.test(e.message), 'free text is not echoed');
    assert.equal((await view('asha')).claims[0].staleCount, 1); assert.match((await view('asha')).claims[0].lines.find(l => l.ref === 'v2').stale, /wrong patient/);
    await run('sup', V(claimA, { decision: 'returned', note: 'Visit v2 was marked wrong patient' }));
    assert.equal(x.incentiveState(s).claims[0].state, 'returned'); assert.equal(x.claimedKeys(x.incentiveState(s)).size, 0, 'a returned claim releases its lines');
    await status(() => run('sup', V(x.incentiveState(s).claims[0])), 409, /Only a submitted claim/);
    vis.voidedAt = undefined; vis.voidReason = undefined;
  });
  let claimB;
  await acheck(async () => { const r = await run('asha', PREP); claimB = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.equal(r.number, 2); assert.equal(r.total, 55); assert.deepEqual(claimB.lines.map(l => l.ref).sort(), ['i1', 'v1', 'v2', 'v3'].sort()); });
  await acheck(async () => { await status(() => run('sup', { type: 'withdrawIncentiveClaim', claimId: claimB.id, version: claimB.version, reason: 'Not the preparer of the claim' }), 403); await run('asha', { type: 'withdrawIncentiveClaim', claimId: claimB.id, version: claimB.version, reason: 'Preparing again with a corrected period' }); assert.equal(claimB.state, 'withdrawn'); await status(() => run('asha', { type: 'withdrawIncentiveClaim', claimId: claimB.id, version: claimB.version, reason: 'Withdrawing a second time' }), 409); });
  let claim1;
  await acheck(async () => { const r = await run('asha', PREP); claim1 = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.equal(r.number, 3); });
  await acheck(async () => {
    // Owners and supervisors of the team supervise it; a verifier is never the approver.
    await run('sup', V(claim1)); assert.equal(claim1.state, 'verified'); assert.equal(claim1.verified.byCode, 'CODE-SUP');
    for (const who of ['sup', 'sup2', 'asha', 'doc', 'prov']) await status(() => run(who, D(claim1)), 403);
    await status(() => run('own', D(claim1, { version: 1 })), 409, /changed/); await status(() => run('own', D(claim1, { decision: 'returned', note: 'no' })), 422, /at least 10 characters/);
    await status(() => run('sup', V(claim1)), 409, /Only a submitted claim/);
  });
  // Approval: chain entry 1, stored immutably with a digest recomputed here independently.
  const offline = (c, seq, prev) => { const ch = c.chain, content = sha(JSON.stringify(['saha-incentive-claim-content-v1', c.id, c.number, c.type, c.corrects ?? null, c.teamId, c.claimantCode, c.preparedByCode, c.period.from, c.period.to, c.scheduleVersion, c.createdAt, c.lines.map(l => [l.id, l.kind, l.ref, l.evidenceVisitId, l.subject, l.at, l.amount, l.receipt ?? null, l.reverses?.claimId ?? null, l.reverses?.lineId ?? null, l.reverses?.reason ?? null]), c.total, c.verified?.byCode ?? null, c.verified?.at ?? null, c.verified?.note ?? null, ch.byCode, ch.at])); return { content, digest: sha(JSON.stringify(['saha-incentive-claim-v1', seq, prev, content])) }; };
  await acheck(async () => {
    const r = await run('own', D(claim1)); assert.equal(r.seq, 1); assert.equal(claim1.state, 'approved');
    const o = offline(claim1, 1, '0'.repeat(64)); assert.equal(claim1.chain.prev, '0'.repeat(64)); assert.equal(claim1.chain.content, o.content); assert.equal(claim1.chain.digest, o.digest); assert.equal(r.digest, o.digest);
    assert.equal(claim1.lines.every(l => l.subject === sha(JSON.stringify(['saha-incentive-subject', 'org', l.personId]))), true);
    assert.deepEqual(claim1.history.map(h => h.action), ['submitted', 'verified', 'approved']); assert.match(s.workspace.audit.at(-1).detail, /approved and stored immutably as chain entry 1; digest [0-9a-f]{64}\. 55 SYN\. No payment is made or implied\./);
    const c = await x.verifyClaimChain(s); assert.deepEqual([c.status, c.approved, c.head.seq, c.head.digest], ['intact', 1, 1, o.digest]);
  });
  // Immutable once approved: every command is refused, and the stored content cannot change unnoticed.
  await acheck(async () => {
    const frozen = JSON.stringify(claim1);
    await status(() => run('asha', { type: 'withdrawIncentiveClaim', claimId: claim1.id, version: claim1.version, reason: 'Withdraw an approved claim' }), 409, /immutable/);
    await status(() => run('sup', V(claim1)), 409, /immutable/); await status(() => run('own', D(claim1, { decision: 'returned', note: 'Return an approved claim' })), 409, /immutable/);
    assert.equal(JSON.stringify(claim1), frozen);
  });
  // A second claim extends the chain; tampering is reported at the right sequence.
  let claim2;
  await acheck(async () => {
    s.workspace.visits.push(visit('v11', 'P2', 'asha', 0.1)); s.workspace.visits.push(visit('v12', 'P', 'asha', 0.05));
    const r = await run('asha', { ...PREP, from: NOW.slice(0, 10) }); claim2 = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.deepEqual(claim2.lines.map(l => l.ref).sort(), ['v11', 'v12']); assert.equal(claim2.total, 20);
    await run('sup2', V(claim2, { note: '' })); await run('own', D(claim2));
    const o = offline(claim2, 2, claim1.chain.digest); assert.equal(claim2.chain.seq, 2); assert.equal(claim2.chain.prev, claim1.chain.digest); assert.equal(claim2.chain.digest, o.digest);
    assert.equal((await x.verifyClaimChain(s)).status, 'intact');
  });
  await acheck(async () => {
    const original = JSON.stringify(s.operations.incentives), restore = () => { s.operations.incentives = JSON.parse(original); [claim1, claim2] = s.operations.incentives.claims.filter(c => c.state === 'approved'); };
    const broken = async (mutate, seq, reason) => { mutate(); const c = await x.verifyClaimChain(s); assert.equal(c.status, 'broken'); assert.equal(c.firstBreak.seq, seq); assert.match(c.firstBreak.reason, reason); restore(); assert.equal((await x.verifyClaimChain(s)).status, 'intact'); };
    await broken(() => { s.operations.incentives.claims.find(c => c.number === 3).lines[0].amount += 1; }, 1, /total does not match|content was altered/);
    await broken(() => { const c = s.operations.incentives.claims.find(c => c.number === 3); c.lines[0].amount += 1; c.total += 1; }, 1, /content was altered/);
    await broken(() => { s.operations.incentives.claims.find(c => c.number === 3).lines[0].personId = 'Q'; }, 1, /patient reference was altered/);
    await broken(() => { s.operations.incentives.claims.find(c => c.number === 3).verified.note = 'Changed afterwards'; }, 1, /content was altered/);
    await broken(() => { const c = s.operations.incentives.claims.find(c => c.number === 3); c.chain.content = sha('forged'); }, 1, /content was altered/);
    await broken(() => { const c = s.operations.incentives.claims.find(c => c.number === 3); c.chain.digest = sha('forged'); }, 1, /digest does not match/);
    await broken(() => { s.operations.incentives.claims.find(c => c.number === 4).chain.prev = sha('other'); }, 2, /link to the previous claim/);
    await broken(() => { s.operations.incentives.claims = s.operations.incentives.claims.filter(c => c.number !== 3); }, 1, /Sequence 1 is missing/);
    await broken(() => { s.operations.incentives.claims.find(c => c.number === 3).state = 'returned'; }, 1, /without being an approved claim/);
  });
  // Corrections are new linked claims. Voiding a source visit marks the approved line stale and changes nothing stored.
  let corr;
  await acheck(async () => {
    const vis = s.workspace.visits.find(x2 => x2.id === 'v2'); vis.voidedAt = ago(0.1); vis.voidReason = 'Wrong patient';
    const before = JSON.stringify(claim1), line = claim1.lines.find(l => l.ref === 'v2');
    const a = (await view('asha')).claims.find(c => c.number === 3); assert.equal(a.state, 'approved'); assert.equal(a.staleCount, 1); assert.equal(a.actions.correct, true); assert.equal(a.lines.find(l => l.ref === 'v2').stale.includes('wrong patient'), true);
    for (const who of ['asha2', 'doc', 'adm', 'prov', 'ashab']) await status(() => run(who, { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'The visit was marked wrong patient' }] }), 403);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: 'nope', reason: 'The visit was marked wrong patient' }] }), 404);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'short' }] }), 422);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'The visit was marked wrong patient' }, { lineId: line.id, reason: 'The visit was marked wrong patient' }] }), 422, /each line once/i);
    const r = await run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'The visit was marked wrong patient' }] });
    corr = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.equal(corr.type, 'correction'); assert.equal(corr.corrects, claim1.id); assert.equal(corr.total, -10); assert.equal(corr.lines[0].amount, -10); assert.equal(corr.lines[0].kind, 'reversal'); assert.equal(corr.lines[0].reverses.lineId, line.id); assert.equal(corr.state, 'submitted');
    assert.equal(JSON.stringify(claim1), before, 'the original claim is unchanged');
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'The visit was marked wrong patient' }] }), 409, /already reversed/);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: corr.id, reversals: [{ lineId: corr.lines[0].id, reason: 'Reverse the reversal line' }] }), 409, /Only an approved claim/);
    assert.deepEqual((await view('asha')).claims.find(c => c.number === 3).correctedBy, [corr.number]); assert.equal((await view('asha')).claims.find(c => c.number === 3).lines.find(l => l.ref === 'v2').reversed, true);
  });
  await acheck(async () => {
    await run('sup', V(corr)); await run('own', D(corr));
    const o = offline(corr, 3, claim2.chain.digest); assert.equal(corr.chain.seq, 3); assert.equal(corr.chain.digest, o.digest); assert.equal((await x.verifyClaimChain(s)).status, 'intact');
    const net = x.incentiveState(s).claims.filter(c => c.state === 'approved' && c.claimantId === 'asha').reduce((n, c) => n + c.total, 0); assert.equal(net, 55 - 10 + 20);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: corr.id, reversals: [{ lineId: corr.lines[0].id, reason: 'Reverse the reversal line' }] }), 422, /cannot itself be reversed/);
    await status(() => run('asha', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: claim1.lines.find(l => l.ref === 'v2').id, reason: 'The visit was marked wrong patient' }] }), 409, /already reversed/);
  });
  // A supervisor can start a correction; another person verifies it, and the owner approves.
  await acheck(async () => {
    const line = claim1.lines.find(l => l.ref === 'v3'), r = await run('sup', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'Supervisor found the visit was not eligible' }] });
    const c = x.incentiveState(s).claims.find(c => c.id === r.claimId); assert.equal(c.claimantId, 'asha'); assert.equal(c.preparedBy, 'sup'); assert.equal(c.claimantCode, 'CODE-ASHA'); assert.equal(c.preparedByCode, 'CODE-SUP');
    await status(() => run('sup', V(c)), 403, /prepared/); await status(() => run('asha', V(c)), 403);
    await run('sup2', V(c)); await status(() => run('sup', D(c)), 403); await run('own', D(c)); assert.equal(c.chain.seq, 4); assert.equal((await x.verifyClaimChain(s)).status, 'intact');
  });
  // The owner may prepare a correction too, but cannot then verify or approve it; withdrawing it releases the reversal.
  await acheck(async () => {
    const line = claim1.lines.find(l => l.ref === 'v1'), r = await run('own', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'The owner reverses this line' }] }), c = x.incentiveState(s).claims.find(c => c.id === r.claimId);
    await status(() => run('own', V(c)), 403, /prepared/); await run('sup', V(c)); await status(() => run('own', D(c)), 403, /different person/);
    await status(() => run('sup2', { type: 'withdrawIncentiveClaim', claimId: c.id, version: c.version, reason: 'Not the preparer of this correction' }), 403);
    await run('own', { type: 'withdrawIncentiveClaim', claimId: c.id, version: c.version, reason: 'Withdrawn by the preparer' }); assert.equal(c.state, 'withdrawn');
    const again = await run('sup', { type: 'prepareIncentiveCorrection', claimId: claim1.id, reversals: [{ lineId: line.id, reason: 'Reverse the line again after withdrawal' }] }); assert.ok(again.claimId, 'a withdrawn correction releases its reversal');
    x.incentiveState(s).claims.find(c => c.id === again.claimId).state = 'withdrawn';
  });
  // Scope: who sees which claims, and names only inside the viewer's own care scope.
  await acheck(async () => {
    assert.deepEqual((await view('asha')).claims.map(c => c.number).sort((a, b) => a - b), x.incentiveState(s).claims.map(c => c.number).sort((a, b) => a - b), 'the claimant sees her claims and corrections of them');
    assert.deepEqual((await view('asha2')).claims, []); assert.equal((await view('asha2')).canPrepare, true);
    assert.equal((await view('sup')).claims.length, x.incentiveState(s).claims.length); assert.deepEqual((await view('sup')).supervises.map(t => t.id), ['t1']);
    await status(() => view('doc'), 403); await status(() => view('prov'), 403); assert.deepEqual((await view('ashab')).claims, []);
    const adm = (await view('adm')); assert.equal(adm.claims.length, x.incentiveState(s).claims.length); assert.ok(adm.claims.every(c => c.lines.every(l => l.patient === null && !('personId' in l))), 'an administrator owner holds no patient scope');
    const own = (await view('own')).claims.find(c => c.number === 3); assert.ok(own.lines.some(l => l.patient === 'Patient P'));
    const mine = (await view('asha')).claims.find(c => c.number === 3); assert.ok(mine.lines.some(l => l.patient === 'Patient P' && l.personId === 'P'));
    s.workspace.people.find(p => p.id === 'P').assignedTo = 'asha2'; assert.ok((await view('asha')).claims.find(c => c.number === 3).lines.filter(l => l.personId !== 'P2').every(l => l.patient === null && !('personId' in l)), 'a patient moved to another worker leaves her scope'); s.workspace.people.find(p => p.id === 'P').assignedTo = 'asha';
    assert.ok(!JSON.stringify((await view('asha'))).includes('Synthetic locality') && !JSON.stringify(s.workspace.audit.filter(a => /Incentive|incentive/.test(a.detail))).includes('Patient P'), 'no village in the view and no patient name in the audit text');
    for (const a of s.workspace.audit) assert.equal(a.personId, undefined, 'incentive audit events are organisation-level');
  });
  // Notices, definitions, scope text.
  await acheck(async () => { const w = (await view('own')); assert.match(w.notice, /^SYNTHETIC\./); assert.match(w.notice, /not an incentive rate of any government or programme/); assert.match(w.notice, /no payment is made, scheduled or implied/); assert.equal(w.unit, 'SYN'); assert.deepEqual(w.kinds.map(k => k.id), ['visit-confirmed', 'visit-submitted', 'outreach-completed']); assert.equal(w.schedule.current.version, 2); assert.equal(w.schedule.history.length, 2); assert.equal((await view('sup')).schedule.history, undefined); assert.equal(w.chain.status, 'intact'); assert.equal(w.chain.approved, 4); assert.ok(!/₹|INR|Rs\./.test(JSON.stringify(w)), 'no currency'); });
  // CSV of approved claims with the digest.
  await acheck(async () => {
    const f = await v.incentiveCsv(s, M('own'), NOW, 'export-1', 'OWN'), lines = f.csv.trimEnd().split('\r\n'), table = lines.slice(lines.findIndex(l => l.startsWith('"claim_number"')) + 1, -2).map(l => JSON.parse('[' + l + ']'));
    assert.equal(f.claims, 4); assert.equal(table.length, f.rows); assert.equal(lines.at(-2), `"Manifest","Data rows",${f.rows}`); const body = lines.slice(0, -2).join('\r\n') + '\r\n'; assert.equal(lines.at(-1), `"Manifest","Content SHA-256","${sha(body)}"`); assert.equal(f.sha256, sha(body));
    assert.match(lines[1], /SYNTHETIC/); assert.ok(!/Patient |Synthetic locality|"P2?"|asha"/.test(f.csv), 'no patient name, village or identifier');
    const H = lines[lines.findIndex(l => l.startsWith('"claim_number"'))].split(',').map(c => JSON.parse(c)), col = (row, n) => row[H.indexOf(n)];
    assert.ok(table.some(r => col(r, 'amount_syn') === -10), 'negative amounts are written exactly'); assert.ok(table.every(r => typeof col(r, 'amount_syn') === 'number'));
    // Every claim's digest recomputes from its rows alone.
    const byClaim = Map.groupBy(table, r => col(r, 'claim_id')); let prev = '0'.repeat(64), seq = 0;
    for (const rows of [...byClaim.values()].sort((a, b) => col(a[0], 'chain_seq') - col(b[0], 'chain_seq'))) {
      const r0 = rows[0], c = { id: col(r0, 'claim_id'), number: col(r0, 'claim_number'), type: col(r0, 'claim_type'), corrects: col(r0, 'corrects_claim_id') || null, teamId: col(r0, 'team_id'), claimantCode: col(r0, 'claimant_code'), preparedByCode: col(r0, 'prepared_by_code'), period: { from: col(r0, 'period_from'), to: col(r0, 'period_to') }, scheduleVersion: col(r0, 'schedule_version'), createdAt: col(r0, 'prepared_at'), total: col(r0, 'claim_total_syn'), verified: { byCode: col(r0, 'verified_by_code') || null, at: col(r0, 'verified_at') || null, note: col(r0, 'verification_note') ?? '' }, chain: { byCode: col(r0, 'approved_by_code'), at: col(r0, 'approved_at') },
        lines: rows.map(r => ({ id: col(r, 'line_id'), kind: col(r, 'line_kind'), ref: col(r, 'source_ref'), evidenceVisitId: col(r, 'evidence_visit_id'), subject: col(r, 'subject_reference'), at: col(r, 'activity_at'), amount: col(r, 'amount_syn'), receipt: col(r, 'receipt') || undefined, reverses: col(r, 'reverses_line_id') ? { claimId: col(r, 'reverses_claim_id'), lineId: col(r, 'reverses_line_id'), reason: col(r, 'reversal_reason') } : undefined })) };
      seq++; assert.equal(col(r0, 'chain_seq'), seq); assert.equal(col(r0, 'previous_digest'), prev); const o = offline(c, seq, prev); assert.equal(col(r0, 'content_digest'), o.content); assert.equal(col(r0, 'claim_digest'), o.digest); prev = o.digest; assert.equal(c.total, c.lines.reduce((n, l) => n + l.amount, 0));
    }
    assert.equal(seq, 4);
    // Supervisors export the approved claims of their teams; an ASHA, a clinician, a provider do not; nothing approved is a 404.
    assert.equal((await v.incentiveCsv(s, M('sup'), NOW, 'export-2', 'SUP')).claims, 4); for (const who of ['asha', 'doc', 'prov', 'ashab']) await status(() => v.incentiveCsv(s, M(who), NOW, 'e', 'X'), 403);
    const keep = s.operations.incentives.claims; s.operations.incentives.claims = keep.filter(c => c.state !== 'approved'); await status(() => v.incentiveCsv(s, M('own'), NOW, 'e', 'X'), 404); s.operations.incentives.claims = keep;
  });
  // Actions offered follow the same rules the server enforces.
  await acheck(async () => { const c = (await view('own')).claims.find(c => c.number === 3); assert.deepEqual(c.actions, { withdraw: false, verify: false, decide: false, correct: true }); assert.equal((await view('asha2')).canPrepare, true); assert.equal((await view('adm')).canPrepare, false); assert.equal((await view('own')).canExport, true); assert.equal((await view('asha')).canExport, false); });
  // Bounds: a claim holds at most MAX_LINES; stored state is bounded.
  await acheck(async () => {
    for (let n = 0; n < x.MAX_LINES + 1; n++) s.workspace.visits.push(visit('bulk' + n, 'R', 'asha2', 0.1));
    await status(() => run('asha2', { ...PREP, from: NOW.slice(0, 10) }), 422, new RegExp(`at most ${x.MAX_LINES}`));
    s.workspace.visits = s.workspace.visits.filter(v2 => !v2.id.startsWith('bulk')); s.workspace.visits.push(visit('one', 'R', 'asha2', 0.1));
    const pad = 'x'.repeat(10000); for (let n = 0; n < 60; n++) s.operations.incentives.claims.push({ id: 'pad' + n, number: 100 + n, type: 'claim', teamId: 't1', claimantId: 'z', claimantName: pad, state: 'withdrawn', lines: [], history: [] });
    await status(() => run('asha2', { ...PREP, from: NOW.slice(0, 10) }), 422, /stored claim limit/);
  });
  // Replayed commands are authorised again, so a role change takes effect on replay.
  check(() => { assert.throws(() => x.authorizeIncentives(s, M('doc'), PREP), e => e.status === 403); assert.throws(() => x.authorizeIncentives(s, { ...M('asha'), status: 'suspended' }, PREP), e => e.status === 403); assert.doesNotThrow(() => x.authorizeIncentives(s, M('asha'), PREP)) });
  assert.equal(await x.applyIncentives(s, { type: 'startVisit', personId: 'P' }, U('asha'), M('asha'), NOW), null, 'other commands are not handled here');
  const result = { suite: 'incentive claims contract (slice 10c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/incentive-claims-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
