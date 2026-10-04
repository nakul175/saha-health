// Slice 10f contract: household visit slots (planning only, per-member scope) and cross-pack referral consolidation.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.household-visit-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, msg) => { try { fn(); } catch (e) { assert.equal(e.status, code, `${msg ?? ''} ${e.message}`); return e; } assert.fail(`expected ${code}${msg ? ': ' + msg : ''}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'data-exit', 'delegation', 'disposal-effects', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-consolidation', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const hv = await import(pathToFileURL(join(dir, 'household-visit.js')));
  const rc = await import(pathToFileURL(join(dir, 'referral-consolidation.js')));
  const ap = await import(pathToFileURL(join(dir, 'action-plan.js')));
  const exit = await import(pathToFileURL(join(dir, 'data-exit.js')));
  const now = '2026-10-02T06:00:00.000Z', ago = n => new Date(Date.parse(now) - n * 86400000).toISOString().slice(0, 10), ahead = n => ago(-n);
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, createdAt: now, version: 4, teamId: 't1' };
  const fu = (id, over = {}) => ({ id, enrolmentId: 'e1', packId: 'maternal', title: 'Home visit', due: ago(3), ownerId: 'asha', state: 'open', createdAt: now, createdBy: 'asha', ...over });
  const enrol = (id, packId, label, over = {}) => ({ id, packId, packVersion: 1, state: 'active', episodeLabel: label, startDate: null, createdAt: '2026-09-20T05:00:00.000Z', createdBy: 'doc', registration: 'not_submitted', ...over });
  const pack = (id, name) => ({ id, version: 1, name, programme: 'General care', purpose: 'Synthetic', questions: [] });
  const s = {
    organisation: { id: 'org' }, teams: [{ id: 't1', name: 'Team One' }, { id: 't2', name: 'Team Two' }], invitations: [],
    members: [member('asha', 'asha'), member('asha2', 'asha'), member('doc', 'clinician'), member('doc2', 'clinician', { teamIds: ['t2'] }), member('sup', 'supervisor'), member('adm', 'admin', { isOwner: true, teamIds: [] })],
    households: [{ id: 'h1', version: 3, label: 'Synthetic household', teamId: 't1', createdAt: now, createdBy: 'asha', members: ['p1', 'p2', 'p3', 'p4'].map((personId, i) => ({ personId, relationship: 'other', from: '2026-09-01', addedBy: 'asha', addedAt: now, ...(personId === 'p4' ? { to: '2026-09-20' } : {}) })) }],
    workspace: { role: 'asha', audit: [], submissions: [], integrations: [],
      people: [
        { ...base, id: 'p1', name: 'Alpha One', assignedTo: 'asha', assigned: true, householdId: 'h1', enrolments: [enrol('e1', 'maternal', 'Synthetic pregnancy'), enrol('e2', 'tb', 'Synthetic TB screening'), enrol('e3', 'hypertension', 'Synthetic hypertension')],
          followUps: [fu('fA', { title: 'Weigh at clinic' }), fu('fB', { title: 'Medicine check', due: ahead(5) }), fu('fC', { title: 'Done already', state: 'completed' })] },
        { ...base, id: 'p2', name: 'Bravo Two', assignedTo: 'asha', assigned: true, householdId: 'h1', enrolments: [enrol('e4', 'maternal', 'Synthetic second pregnancy')], followUps: [fu('fD', { title: 'Immunisation card', enrolmentId: 'e4', due: ahead(1) })] },
        { ...base, id: 'p3', name: 'Charlie Three SECRET', assignedTo: 'asha2', assigned: true, householdId: 'h1', followUps: [fu('fE', { title: 'Charlie private follow-up', ownerId: 'asha2' })] },
        { ...base, id: 'p4', name: 'Delta Four', assignedTo: 'asha', assigned: true, followUps: [fu('fF', { title: 'Delta follow-up' })] },
        { ...base, id: 'p5', name: 'Echo Five', assignedTo: 'asha', assigned: true, teamId: 't2', mergedInto: { personId: 'p1' }, followUps: []}],
      visits: [
        { id: 'v1', personId: 'p1', state: 'confirmed', createdAt: '2026-09-25T05:00:00.000Z', confirmedAt: '2026-09-25T06:00:00.000Z',
          programmeCapture: { packs: [{ enrolmentId: 'e1', pack: pack('maternal', 'Maternal care') }, { enrolmentId: 'e2', pack: pack('tb', 'TB screening') }, { enrolmentId: 'e3', pack: pack('hypertension', 'Hypertension follow-up') }], answers: {}, absence: {} } },
        { id: 'v2', personId: 'p1', state: 'draft', createdAt: '2026-09-28T05:00:00.000Z', programmeCapture: { packs: [{ enrolmentId: 'e1', pack: pack('maternal', 'Maternal care') }], answers: {}, absence: {} } },
        { id: 'v3', personId: 'p1', state: 'confirmed', createdAt: '2026-09-27T05:00:00.000Z', confirmedAt: '2026-09-27T06:00:00.000Z', voidedAt: now, programmeCapture: { packs: [{ enrolmentId: 'e1', pack: pack('maternal', 'Maternal care') }], answers: {}, absence: {} } },
        { id: 'v4', personId: 'p1', state: 'confirmed', createdAt: '2026-09-29T05:00:00.000Z', confirmedAt: '2026-09-29T06:00:00.000Z' },
        { id: 'v5', personId: 'p2', state: 'confirmed', createdAt: '2026-09-26T05:00:00.000Z', confirmedAt: '2026-09-26T06:00:00.000Z', programmeCapture: { packs: [{ enrolmentId: 'e4', pack: pack('maternal', 'Maternal care') }], answers: {}, absence: {} } }],
      referrals: [
        { id: 'rA', personId: 'p1', visitId: 'v1', facility: 'CHC', reason: 'BP review', state: 'sent', createdAt: '2026-09-25T06:10:00.000Z', ownerId: 'asha', due: ago(1), urgency: 'urgent', version: 1 },
        { id: 'rC', personId: 'p3', visitId: 'v9', facility: 'DH Secret', reason: 'Charlie', state: 'sent', createdAt: now, ownerId: 'asha2', due: ahead(1), version: 1 }] },
    governance: { entries: [], evaluations: [], safety: [] }, outreach: { plans: [], templates: [], messages: [] },
  };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id), H = () => s.households[0];
  const view = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = m.role !== 'admin' && m.teamIds.includes(p.teamId) && (m.role !== 'asha' || p.assignedTo === userId); return m; };
  const actor = userId => ({ userId, displayName: userId.toUpperCase(), email: 'x' });
  const plan = userId => hv.householdVisitPlan(s, view(userId), H(), now);
  const sched = (userId, over = {}) => hv.applyHouseholdVisit(s, { type: 'householdVisitSchedule', householdId: 'h1', version: H().version, date: ahead(2), window: 'morning', covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }, { kind: 'referral', id: 'rA' }] }, { personId: 'p2', items: [{ kind: 'follow-up', id: 'fD' }] }], ...over }, actor(userId), view(userId), now);
  const cancel = (userId, visitId, over = {}) => hv.applyHouseholdVisit(s, { type: 'householdVisitCancel', householdId: 'h1', version: H().version, visitId, reason: 'rescheduled', ...over }, actor(userId), view(userId), now);
  const memberOf = (pl, id) => pl.members.find(x => x.personId === id);
  const snapshotDue = () => JSON.stringify([...P('p1').followUps, ...P('p2').followUps].map(f => [f.id, f.due, f.state, f.ownerId]));

  // 1. The plan: each in-scope member's open follow-ups, referrals and routine visit in one place; out-of-scope members counted, never named.
  check(() => {
    const pl = plan('asha'), json = JSON.stringify(pl);
    assert.deepEqual(pl.members.map(x => x.personId), ['p1', 'p2']); assert.equal(pl.outsideScope, 1, 'p3 is outside the ASHA scope and counted; the former member p4 is not counted');
    assert.ok(!/Charlie|p3|DH Secret|asha2/.test(json), 'nothing about the out-of-scope member appears');
    const a = memberOf(pl, 'p1').items;
    assert.deepEqual(a.map(i => i.key).sort(), ['follow-up:fA', 'follow-up:fB', 'home-visit:p1', 'referral:rA'].sort(), 'closed follow-up excluded; referral and routine visit included');
    assert.equal(a.find(i => i.key === 'follow-up:fA').attention, 'overdue'); assert.equal(a.find(i => i.key === 'follow-up:fA').daysOverdue, 3);
    assert.equal(a.find(i => i.key === 'follow-up:fB').attention, 'upcoming'); assert.deepEqual(a.find(i => i.key === 'follow-up:fA').programmes, ['Maternal care']);
    assert.equal(pl.canSchedule, true); assert.equal(plan('doc').outsideScope, 0); assert.deepEqual(plan('doc').members.map(x => x.personId), ['p1', 'p2', 'p3'], 'a clinician of the team sees every current member');
    assert.equal(plan('asha2').members.length, 1); assert.equal(plan('asha2').outsideScope, 2);
    assert.deepEqual(pl.visits, [], 'no slot yet');
  });
  // 2. Follow-ups from several programme episodes with the same title, date and owner are one line with every source.
  check(() => {
    P('p2').followUps.push(fu('fD2', { title: 'Immunisation card', enrolmentId: 'e5', packId: 'tb', due: ahead(1) }));
    const line = memberOf(plan('asha'), 'p2').items.find(i => i.key.startsWith('follow-up:fD'));
    assert.deepEqual(line.refs.map(r => r.id).sort(), ['fD', 'fD2']); assert.deepEqual(line.programmes.sort(), ['Maternal care', 'TB screening']);
    P('p2').followUps.pop();
  });
  // 3. Refusals for incomplete or free-text input, authority and scope.
  check(() => {
    assert.equal(sched('asha', { covers: [] }), null, 'not this schema'); assert.equal(sched('asha', { note: 'bring the card' }), null, 'no free text is accepted'); assert.equal(sched('asha', { window: 'midnight' }), null);
    assert.equal(sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA', note: 'x' }] }] }), null);
    status(() => sched('adm'), 403, 'administrator'); status(() => sched('doc2'), 403, 'clinician of another team'); status(() => sched('sup'), 403, 'supervisor is not a care role');
    status(() => hv.authorizeHouseholdVisit(s, view('adm'), { type: 'householdVisitSchedule', householdId: 'h1' }), 403, 'rechecked on replay'); status(() => hv.authorizeHouseholdVisit(s, view('doc2'), { type: 'householdVisitCancel', householdId: 'h1' }), 403);
    status(() => hv.authorizeHouseholdVisit(s, view('asha'), { type: 'householdVisitSchedule', householdId: 'nope' }), 404);
    const scopeMsg = status(() => sched('asha', { covers: [{ personId: 'p3', items: [{ kind: 'follow-up', id: 'fE' }] }] }), 422, 'member outside scope').message;
    assert.equal(status(() => sched('asha', { covers: [{ personId: 'zzz', items: [{ kind: 'follow-up', id: 'fE' }] }] }), 422, 'not a member').message, scopeMsg, 'outside scope and not a member read the same');
    assert.equal(status(() => sched('asha', { covers: [{ personId: 'p4', items: [{ kind: 'follow-up', id: 'fF' }] }] }), 422, 'former member').message, scopeMsg);
    status(() => sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fD' }] }] }), 422, 'item of another member');
    status(() => sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fC' }] }] }), 409, 'closed follow-up');
    status(() => sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }, { kind: 'follow-up', id: 'fA' }] }] }), 422, 'repeated item');
    status(() => sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }] }, { personId: 'p1', items: [{ kind: 'follow-up', id: 'fB' }] }] }), 422, 'repeated member');
    status(() => sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'home-visit', id: 'p2' }] }] }), 422, 'routine visit of another person');
    status(() => sched('asha', { date: ago(1) }), 422, 'past date'); status(() => sched('asha', { date: ahead(91) }), 422, 'too far ahead'); status(() => sched('asha', { version: 99 }), 409, 'stale household');
    assert.equal(H().visits?.length ?? 0, 0, 'refusals wrote nothing'); assert.equal(s.workspace.audit.length, 0);
  });
  // 4. Scheduling one slot covering two members; each member keeps their own due dates, owners and open items.
  let slotId;
  check(() => {
    const before = snapshotDue(), v0 = H().version, r = sched('asha');
    assert.equal(r.members, 2); assert.equal(r.items, 3); slotId = r.visitId; assert.equal(H().version, v0 + 1); assert.equal(snapshotDue(), before, 'due dates, owners and states are unchanged');
    assert.equal(H().visits.length, 1); assert.deepEqual(Object.keys(H().visits[0]).sort(), ['covers', 'createdAt', 'createdBy', 'date', 'id', 'state', 'window', 'workerId'], 'a slot holds references, a date and a window only');
    assert.equal(s.workspace.audit.length, 2, 'one audit line per covered member');
    const [a1, a2] = s.workspace.audit; assert.equal(a1.personId, 'p1'); assert.equal(a2.personId, 'p2');
    assert.ok(a1.detail.includes('Weigh at clinic') && a1.detail.includes('Referral to CHC') && !/Immunisation|Bravo/.test(a1.detail), 'p1 line names only p1 items');
    assert.ok(a2.detail.includes('Immunisation card') && !/Weigh|Alpha|CHC/.test(a2.detail), 'p2 line names only p2 items');
    assert.equal(P('p1').followUps.find(f => f.id === 'fA').state, 'open'); assert.equal(R_('rA').state, 'sent');
  });
  function R_(id) { return s.workspace.referrals.find(r => r.id === id); }
  // 5. The slot shows per member with its own items, late flags and what is still open; items show as covered in the plan.
  check(() => {
    const pl = plan('asha'), slot = pl.visits[0];
    assert.equal(pl.visits.length, 1); assert.equal(slot.date, ahead(2)); assert.equal(slot.window, 'morning'); assert.equal(slot.state, 'planned'); assert.equal(slot.when, 'upcoming'); assert.equal(slot.worker, 'ASHA'); assert.equal(slot.outsideScopeCovered, 0);
    const a = slot.covers.find(x => x.personId === 'p1'), fA = a.items.find(i => i.id === 'fA'), rA = a.items.find(i => i.id === 'rA');
    assert.equal(fA.lateByDays, 5, 'due 3 days ago, slot 2 days ahead: late by 5 days, not silently on time'); assert.equal(rA.lateByDays, 3); assert.equal(a.stillOpen, 2);
    assert.equal(slot.covers.find(x => x.personId === 'p2').items[0].lateByDays, 1, 'due tomorrow, slot in two days: one day late');
    assert.equal(memberOf(pl, 'p1').items.find(i => i.key === 'follow-up:fA').covered.visitId, slotId); assert.equal(memberOf(pl, 'p1').items.find(i => i.key === 'follow-up:fB').covered, null);
    assert.equal(slot.canCancel, true); assert.equal(plan('sup').visits[0].canCancel, true, 'a supervisor of the team may cancel'); assert.equal(plan('doc').visits[0].canCancel, false);
  });
  // 6. A different slot cannot cover an item a planned slot already covers; other items of the same members can be planned.
  check(() => {
    status(() => sched('asha', { date: ahead(4), covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }] }] }), 409, 'already covered');
    const r2 = sched('doc', { date: ahead(4), window: 'afternoon', covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fB' }, { kind: 'home-visit', id: 'p1' }] }, { personId: 'p3', items: [{ kind: 'follow-up', id: 'fE' }, { kind: 'referral', id: 'rC' }] }] });
    assert.equal(r2.members, 2);
    // The ASHA sees the slot only for the member inside scope, and a count for the other; the other member's worker sees only theirs.
    const pl = plan('asha'), json = JSON.stringify(pl), second = pl.visits.find(x => x.id === r2.visitId);
    assert.deepEqual(second.covers.map(x => x.personId), ['p1']); assert.equal(second.outsideScopeCovered, 1); assert.ok(!/Charlie|DH Secret|fE|rC/.test(json), 'the out-of-scope member is not named or itemised');
    const other = plan('asha2'); assert.deepEqual(other.visits.map(x => x.id), [r2.visitId], 'asha2 sees only the slot that covers their member'); assert.deepEqual(other.visits[0].covers.map(x => x.personId), ['p3']); assert.equal(other.visits[0].outsideScopeCovered, 1);
    assert.ok(!/Alpha|Bravo|Medicine check|Weigh at clinic/.test(JSON.stringify(other)), 'no fact about p1 or p2 is visible to a worker who cannot see them');
    s.slot2 = r2.visitId;
  });
  // 7. Completion conditions stay with each item: closing one item leaves the slot and the other items open.
  check(() => {
    P('p1').followUps.find(f => f.id === 'fA').state = 'completed';
    const slot = plan('asha').visits.find(x => x.id === slotId), a = slot.covers.find(x => x.personId === 'p1');
    assert.equal(a.items.find(i => i.id === 'fA').open, false); assert.equal(a.stillOpen, 1); assert.equal(slot.covers.find(x => x.personId === 'p2').stillOpen, 1); assert.equal(slot.state, 'planned');
    P('p1').followUps.find(f => f.id === 'fA').state = 'open';
  });
  // 8. A member who leaves the household is flagged on the slot, not hidden.
  check(() => {
    const m = H().members.find(x => x.personId === 'p2'); m.to = '2026-10-02';
    const pl = plan('asha'); assert.deepEqual(pl.members.map(x => x.personId), ['p1'], 'a former member is no longer in the plan'); assert.equal(pl.visits.find(x => x.id === slotId).covers.find(x => x.personId === 'p2').left, true);
    delete m.to;
  });
  // 9. Cancellation: the planner or a steward, with a closed reason; items stay open and can be planned again.
  check(() => {
    assert.equal(cancel('asha', slotId, { reason: 'because I said so' }), null, 'free-text reason is not this schema');
    status(() => cancel('asha2', slotId), 403, 'asha2 did not plan it and is not a steward'); status(() => cancel('doc', slotId), 403, 'a clinician who did not plan it');
    status(() => cancel('asha', slotId, { version: 1 }), 409, 'stale'); status(() => cancel('asha', 'nope'), 404);
    const before = snapshotDue(), n = s.workspace.audit.length, r = cancel('asha', slotId, { reason: 'household-unavailable' });
    assert.equal(r.state, 'cancelled'); assert.equal(snapshotDue(), before); assert.equal(s.workspace.audit.length, n + 2);
    status(() => cancel('asha', slotId), 409, 'already cancelled'); status(() => cancel('sup', slotId), 409);
    const cancelled = plan('asha').visits.find(x => x.id === slotId); assert.equal(cancelled.state, 'cancelled'); assert.equal(cancelled.cancelReason, 'household-unavailable'); assert.equal(cancelled.canCancel, false);
    assert.equal(memberOf(plan('asha'), 'p1').items.find(i => i.key === 'follow-up:fA').covered, null, 'a cancelled slot no longer covers the item');
    const again = sched('asha', { covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }] }] }); assert.equal(again.items, 1);
    const stewardCancel = cancel('sup', again.visitId, { reason: 'no-longer-needed' }); assert.equal(stewardCancel.state, 'cancelled', 'a supervisor of the team cancels a slot they did not plan');
  });
  // 10. Limits, a merged record and an unmatched claim.
  check(() => {
    H().members.push({ personId: 'p5', relationship: 'other', from: '2026-09-01', addedBy: 'asha', addedAt: now });
    const pl = plan('doc'); assert.equal(memberOf(pl, 'p5'), undefined, 'p5 is in another team, so counted'); assert.equal(pl.outsideScope, 1);
    H().members.pop();
    P('p2').mergedInto = { personId: 'p1' }; assert.equal(memberOf(plan('asha'), 'p2').merged, true); assert.deepEqual(memberOf(plan('asha'), 'p2').items, []);
    status(() => sched('asha', { covers: [{ personId: 'p2', items: [{ kind: 'follow-up', id: 'fD' }] }] }), 409, 'merged record'); delete P('p2').mergedInto;
    H().visits = Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, date: ahead(20), window: 'any', workerId: 'asha', covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'none' + i }] }], state: 'planned', createdAt: now, createdBy: 'asha' }));
    status(() => sched('asha', { date: ahead(30), covers: [{ personId: 'p2', items: [{ kind: 'follow-up', id: 'fD' }] }] }), 422, 'ten planned at once');
    H().visits = [];
  });

  // ---- Cross-pack referral consolidation ----
  const consolidate = (userId, requests, visitId = 'v1') => rc.applyProgrammeReferrals(s, { type: 'createProgrammeReferrals', visitId, requests }, actor(userId), view(userId), now);
  const ask = (enrolmentId, over = {}) => ({ enrolmentId, need: 'blood-pressure-review', facility: 'CHC Synthetic', reason: 'Raised at the visit', ...over });
  const mine = (visitId = 'v1') => s.workspace.referrals.filter(r => r.visitId === visitId && r.need);
  // 11. Two packs identify the same need at one visit: one referral, both packs linked and recorded.
  check(() => {
    assert.equal(rc.applyProgrammeReferrals(s, { type: 'createProgrammeReferrals', visitId: 'v1', requests: [] }, actor('asha'), view('asha'), now), null); assert.equal(consolidate('asha', [ask('e1', { note: 'x' })]), null, 'unknown field');
    assert.equal(consolidate('asha', [ask('e1', { need: 'other' })]), null, '"other" needs a name'); assert.equal(consolidate('asha', [ask('e1', { needLabel: 'Anything' })]), null, 'a name only for "other"');
    const n0 = s.workspace.referrals.length, r = consolidate('asha', [ask('e1'), ask('e2', { facility: '  chc   SYNTHETIC ', reason: 'TB programme also saw high pressure' })]);
    assert.equal(r.created, 1); assert.equal(r.consolidated, 0); assert.equal(s.workspace.referrals.length, n0 + 1, 'one referral, not two'); assert.deepEqual(r.referrals[0].packs, ['Maternal care v1', 'TB screening v1']);
    const ref = R_(r.referrals[0].referralId); assert.equal(ref.visitId, 'v1'); assert.equal(ref.state, 'draft'); assert.equal(ref.version, 1); assert.deepEqual(ref.need, { code: 'blood-pressure-review', label: 'Blood pressure review' });
    assert.equal(ref.facility, 'CHC Synthetic'); assert.equal(ref.reason, 'Raised at the visit');
    assert.deepEqual(ref.sources.map(x => [x.kind, x.refId]), [['programme-episode', 'e1'], ['programme-episode', 'e2']], 'both pack sources linked (slice 4d)');
    assert.deepEqual(ref.packRequests.map(x => [x.packId, x.packVersion, x.enrolmentId, x.reason, x.sourceId === ref.sources.find(y => y.refId === x.enrolmentId).id]), [['maternal', 1, 'e1', 'Raised at the visit', true], ['tb', 1, 'e2', 'TB programme also saw high pressure', true]]);
    assert.equal(s.workspace.audit.at(-1).action, 'createProgrammeReferrals'); assert.match(s.workspace.audit.at(-1).detail, /asked for by Maternal care v1 and TB screening v1/); assert.match(s.workspace.audit.at(-1).detail, /No facility was contacted/);
    assert.equal(s.workspace.audit.at(-1).personId, 'p1');
  });
  // 12. The plan names the asking packs on the referral's sources.
  check(() => {
    const item = ap.actionPlan(s, view('asha'), P('p1'), now).items.find(i => i.kind === 'referral' && i.reason.includes('Raised at the visit'));
    assert.deepEqual(item.sources.map(x => x.label.replace(/ · .*/, '')), ['Referral', 'Asked by Maternal care v1', 'Asked by TB screening v1']);
  });
  // 13. Distinct needs and distinct facilities stay distinct referrals.
  check(() => {
    const n0 = mine().length, r = consolidate('asha', [ask('e3', { need: 'nutrition-review', reason: 'Weight loss reported' }), ask('e3', { facility: 'District Hospital Synthetic' })]);
    assert.equal(r.created, 2); assert.equal(mine().length, n0 + 2); assert.equal(new Set(r.referrals.map(x => x.referralId)).size, 2);
    assert.deepEqual(r.referrals.map(x => x.need).sort(), ['Blood pressure review', 'Nutrition review']);
  });
  // 14. A later request from a third episode for the same need joins the open referral; repeating it changes nothing.
  check(() => {
    const first = mine().find(r => r.facility === 'CHC Synthetic' && r.need.code === 'blood-pressure-review'), n0 = s.workspace.referrals.length, a0 = s.workspace.audit.length;
    const r = consolidate('doc', [ask('e3', { facility: 'chc synthetic', reason: 'Hypertension programme asks too' })]);
    assert.equal(r.consolidated, 1); assert.equal(r.created, 0); assert.equal(r.referrals[0].referralId, first.id); assert.equal(s.workspace.referrals.length, n0); assert.equal(first.version, 2);
    assert.deepEqual(first.packRequests.map(x => x.packId), ['maternal', 'tb', 'hypertension']); assert.equal(first.sources.length, 3); assert.equal(s.workspace.audit.length, a0 + 1);
    status(() => consolidate('doc', [ask('e3', { facility: 'chc synthetic' })]), 409, 'every request already recorded'); assert.equal(first.version, 2); assert.equal(s.workspace.audit.length, a0 + 1);
    const mixed = consolidate('asha', [ask('e1'), ask('e1', { need: 'tb-testing', reason: 'Cough reported' })]); assert.deepEqual(mixed.referrals.map(x => x.outcome).sort(), ['created', 'unchanged']);
  });
  // 15. A referral already linked manually to the episode is reused as the source; closed referrals are not reopened; legacy referrals are never merged.
  check(() => {
    const legacy = R_('rA'); assert.equal(legacy.need, undefined);
    const r = consolidate('asha', [ask('e1', { facility: 'CHC', need: 'danger-sign-review', reason: 'Danger sign discussed' })]); assert.notEqual(r.referrals[0].referralId, 'rA', 'a referral without a recorded need is never merged'); assert.equal(r.created, 1);
    const target = R_(r.referrals[0].referralId); target.sources.length = 0; target.sources.push({ id: 'manual', kind: 'programme-episode', refId: 'e2', sourceAt: '2026-09-20T05:00:00.000Z', linkedAt: now, by: 'doc', note: 'Linked by hand' });
    const j = consolidate('asha', [ask('e2', { facility: 'CHC', need: 'danger-sign-review', reason: 'TB danger sign' })]); assert.equal(j.consolidated, 1); assert.equal(target.sources.length, 1, 'the existing link is reused, not duplicated'); assert.equal(target.packRequests.at(-1).sourceId, 'manual');
    target.state = 'completed';
    const again = consolidate('asha', [ask('e3', { facility: 'CHC', need: 'danger-sign-review', reason: 'Raised again' })]); assert.equal(again.created, 1); assert.notEqual(again.referrals[0].referralId, target.id, 'a closed referral is not reopened');
  });
  // 16. "Other" needs match on their normalised name.
  check(() => {
    const r = consolidate('asha', [ask('e1', { need: 'other', needLabel: 'Eye   check', facility: 'Eye Clinic' }), ask('e2', { need: 'other', needLabel: 'eye check', facility: 'eye clinic' }), ask('e3', { need: 'other', needLabel: 'Dental check', facility: 'Eye Clinic' })]);
    assert.equal(r.created, 2); assert.deepEqual(r.referrals.map(x => x.packs.length).sort(), [1, 2]);
  });
  // 17. Refusals: authority, scope, visit state, packs and episodes.
  check(() => {
    status(() => consolidate('adm', [ask('e1')]), 403, 'administrator'); status(() => consolidate('sup', [ask('e1')]), 403, 'supervisor is not a care role'); status(() => consolidate('asha2', [ask('e1')]), 403, 'ASHA not assigned');
    status(() => consolidate('doc2', [ask('e1')]), 403, 'another team');
    status(() => rc.authorizeProgrammeReferrals(s, view('asha2'), { type: 'createProgrammeReferrals', visitId: 'v1' }), 403, 'rechecked on replay'); rc.authorizeProgrammeReferrals(s, view('asha'), { type: 'createProgrammeReferrals', visitId: 'v1' });
    status(() => consolidate('asha', [ask('e1')], 'v2'), 409, 'draft visit'); status(() => consolidate('asha', [ask('e1')], 'v3'), 409, 'voided visit'); status(() => consolidate('asha', [ask('e1')], 'v4'), 422, 'visit without packs');
    status(() => consolidate('asha', [ask('e4')]), 422, 'episode of another person'); status(() => consolidate('asha', [ask('nope')]), 422, 'unknown episode');
  });
  check(() => {
    const r = consolidate('asha', [ask('e4', { facility: 'CHC Two' })], 'v5'); assert.equal(r.created, 1); assert.equal(R_(r.referrals[0].referralId).personId, 'p2');
    status(() => consolidate('asha', [ask('e1', { facility: 'F Dup' }), ask('e1', { facility: 'f  dup' })]), 422, 'one request per episode and need');
    P('p1').identityReview = { state: 'provisional' }; status(() => consolidate('asha', [ask('e1', { facility: 'F Prov' })]), 409, 'provisional identity'); delete P('p1').identityReview;
    P('p1').mergedInto = { personId: 'p4' }; status(() => consolidate('asha', [ask('e1', { facility: 'F Merged' })]), 409, 'merged record'); delete P('p1').mergedInto;
    const n0 = s.workspace.referrals.length; assert.equal(consolidate('asha', Array.from({ length: 13 }, (_, i) => ask('e1', { facility: 'Facility ' + i }))), null, 'more than 12 requests is not this schema'); assert.equal(s.workspace.referrals.length, n0);
  });
  // 18. Data exit: the household row is exported with the exporter's patient scope, so slot entries for members outside it are left out and counted.
  check(() => {
    H().visits = []; const made = sched('doc', { date: ahead(6), window: 'any', covers: [{ personId: 'p1', items: [{ kind: 'follow-up', id: 'fA' }] }, { personId: 'p3', items: [{ kind: 'follow-up', id: 'fE' }] }] }), slot = H().visits.find(v => v.id === made.visitId); assert.ok(slot, 'a stored slot covering p1 and p3');
    const scoped = exit.scopeEntries(JSON.parse(JSON.stringify(H())), id => id !== 'p3', exit.PATIENT_ID_LISTS, exit.PATIENT_ID_MAPS), out = scoped.value;
    const kept = out.visits.find(v => v.id === slot.id); assert.deepEqual(kept.covers.map(c => c.personId), ['p1']); assert.ok(scoped.withheld >= 2, 'the p3 cover and the p3 membership are withheld');
    assert.ok(!JSON.stringify(out).includes('fE') && !JSON.stringify(out).includes('"p3"'), 'nothing about p3 survives in the exported household row');
  });
  const result = { suite: 'household visit and referral consolidation contract (slice 10f)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/household-visit-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (e) { console.error('CONTRACT FAIL', e); process.exitCode = 1; } finally { rmSync(dir, { recursive: true, force: true }); }
