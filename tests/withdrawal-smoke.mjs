import assert from 'node:assert/strict';
// Slice 14c (R58): withdrawal (void) of accepted programme submissions through approval, against the two demonstration
// simulators, through the built Worker and local D1, in its own organisation so the shared one keeps its default operation
// settings. The maternal register accepts a withdrawal with its own receipt; the community MIS records it but loses the
// response, so it is uncertain until a lookup finds the receipt. The visit is first marked wrong-patient, so the withdrawal
// completes its correction tasks (slice 2j). EHR publications cannot be accepted here (external services are off); the EHR
// paths are covered by tests/withdrawal-contract.mjs with an injected FHIR transport.
export async function withdrawalSmoke({ get, post, check, sql, base }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `wd-${run}-${label}`, headers: { 'oai-authenticated-user-id': `wd-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': `Withdrawal%20${label}`, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
  const o = account('owner'), w = account('asha'), d = account('clinician'), x = account('other-team'), a = account('admin'), stranger = account('stranger');
  for (const who of [o, w, d, x, a, stranger]) await get(who);
  const org = o.state.organisation.id;
  const other = (await post(o, { type: 'createTeam', name: `Other ${run}` }, 200, undefined, org)).result.teamId;
  for (const [who, role, teams] of [[w, 'asha', ['default']], [d, 'clinician', ['default']], [x, 'clinician', [other]], [a, 'admin', []]]) {
    const inv = (await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: `Withdrawal ${role}`, role, teamIds: teams }, 200, undefined, org)).result;
    await post(who, { type: 'joinOrganisation', token: inv.token });
  }
  const send = (who, body, status = 200, key = crypto.randomUUID()) => post(who, body, status, key, org);
  const read = async (who, path, status = 200) => { const r = await fetch(`${base}${path}`, { headers: { ...who.headers, 'x-saha-organisation': org } }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  const refresh = async who => get(who, '/api/workspace', 200, org);
  const pid = 'p_meena';
  await refresh(o);
  await send(o, { type: 'assignPatient', personId: pid, version: o.state.people.find(p => p.id === pid).version, teamId: 'default', assignedTo: w.id, reason: 'Assign for the withdrawal exercise' });
  // The owner permits withdrawal (delete or void) on both simulators; the shared organisation is not touched.
  const allow = async (id, allowed) => { await refresh(o); const i = o.state.integrations.find(y => y.id === id); return send(o, { type: 'setAdapterOperations', integrationId: id, version: i.operations?.version ?? 0, allowed, aggregateOnly: false, reason: 'Synthetic partner agreement for withdrawals' }); };
  await allow('mis_maternal', ['create', 'update', 'delete', 'lookup']); await allow('mis_community', ['create', 'update', 'delete', 'lookup']);
  const visit = id => o.state.visits.find(v => v.id === id);
  const confirmed = async n => { await refresh(o); const id = (await send(o, { type: 'startVisit', personId: pid })).result.visitId; await send(o, { type: 'saveVisit', visitId: id, version: visit(id).version, facts: { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '', diastolic: '', weight: String(55 + n), temperature: '', weeks: '20', coughDays: '', notes: `Synthetic withdrawal visit ${n}`, source: 'measured' } }); await send(o, { type: 'confirmVisit', visitId: id, version: visit(id).version }); return id; };
  const deliver = async (vid, recipients) => { await send(o, { type: 'preparePlan', visitId: vid, recipients }); await send(o, { type: 'approvePlan', visitId: vid, planId: visit(vid).plan.id, payloadHash: visit(vid).plan.payloadHash }); await send(o, { type: 'executePlan', visitId: vid, planId: visit(vid).plan.id }); };
  // Visit A reaches both simulators; the community response is lost and reconciled by lookup.
  const va = await confirmed(1);
  await deliver(va, ['mis_maternal', 'mis_community']);
  const subOf = (vid, id) => o.state.submissions.find(y => y.visitId === vid && y.connectorId === id);
  await send(o, { type: 'reconcile', submissionId: subOf(va, 'mis_community').id });
  const sm = structuredClone(subOf(va, 'mis_maternal')), sc = structuredClone(subOf(va, 'mis_community'));
  check(() => { assert.equal(sm.state, 'accepted'); assert.equal(sc.state, 'accepted'); assert.ok(sm.receipt && sc.receipt); });
  const prep = (who, refId, status = 200, over = {}) => send(who, { type: 'prepareWithdrawal', personId: pid, target: 'programme-submission', refId, operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Recorded against the wrong person in the household', ...over }, status);
  // Who may prepare: an administrator, a clinician of another team and a non-member are refused; a short reason is invalid.
  await prep(a, sm.id, 403); await prep(x, sm.id, 403); await post(stranger, { type: 'prepareWithdrawal', personId: pid, target: 'programme-submission', refId: sm.id, operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Recorded against the wrong person' }, 403, crypto.randomUUID(), org);
  await prep(w, sm.id, 422, { reason: 'short' }); await prep(w, sm.id, 422, { operation: 'amend' });
  await send(w, { type: 'prepareWithdrawal', personId: pid, target: 'ehr-publication', refId: 'no-such-publication', operation: 'withdraw', reasonCode: 'wrong-patient', reason: 'Recorded against the wrong person' }, 404);
  // The clinician marks visit A as wrong-patient: each accepted submission becomes a send-withdrawal task.
  await refresh(d);
  await send(d, { type: 'voidVisit', visitId: va, version: d.state.visits.find(v => v.id === va).recordVersion, reason: 'Recorded against the wrong person in the household' });
  await refresh(o);
  const taskOf = id => visit(va).correctionTasks.find(t => t.output.refId === id);
  check(() => { for (const s of [sm, sc]) { const t = taskOf(s.id); assert.equal(t.action, 'send-withdrawal'); assert.equal(t.state, 'open'); assert.equal(t.external, true); assert.match(t.instruction, /Receipts tab/); } });
  // Maternal register: prepare (the ASHA), approve (the ASHA, bound to the payload hash), execute by the approver.
  const p1 = (await prep(w, sm.id)).result, wid = p1.withdrawalId;
  await refresh(o);
  const stored = () => visit(va).withdrawals.find(y => y.id === wid);
  check(() => { const s = stored(); assert.equal(s.state, 'prepared'); assert.equal(s.payloadHash, p1.payloadHash); assert.deepEqual(s.payload, { contract: 'saha-mis-v1', environment: 'synthetic', operation: 'withdraw', withdraws: { submissionKey: sm.id, receipt: sm.receipt }, reason: 'wrong-patient' }); assert.equal(s.bound.visitStatus, 'voided'); });
  await prep(d, sm.id, 409);
  await send(w, { type: 'approveWithdrawal', personId: pid, withdrawalId: wid, payloadHash: '0'.repeat(64) }, 409);
  await send(x, { type: 'approveWithdrawal', personId: pid, withdrawalId: wid, payloadHash: p1.payloadHash }, 403);
  await send(a, { type: 'approveWithdrawal', personId: pid, withdrawalId: wid, payloadHash: p1.payloadHash }, 403);
  await send(w, { type: 'executeWithdrawal', personId: pid, withdrawalId: wid }, 409);
  await send(w, { type: 'approveWithdrawal', personId: pid, withdrawalId: wid, payloadHash: p1.payloadHash });
  await send(d, { type: 'executeWithdrawal', personId: pid, withdrawalId: wid }, 409);
  const key = crypto.randomUUID(), e1 = await send(w, { type: 'executeWithdrawal', personId: pid, withdrawalId: wid }, 200, key);
  const replay = await send(w, { type: 'executeWithdrawal', personId: pid, withdrawalId: wid }, 200, key);
  const again = await send(w, { type: 'executeWithdrawal', personId: pid, withdrawalId: wid });
  await refresh(o);
  check(() => { assert.equal(e1.result.state, 'accepted'); assert.match(e1.result.receipt, /^SIM-W-[0-9A-F]{8}$/); assert.equal(replay.replayed, true); assert.deepEqual(replay.result, { withdrawalId: wid, state: 'sending' }, 'the same key replays the checkpoint receipt of that command and sends nothing'); assert.deepEqual(again.result, { withdrawalId: wid, state: 'accepted' }, 'a second press never sends again'); });
  check(() => { const s = stored(); assert.equal(s.state, 'accepted'); assert.equal(s.attempts, 1); assert.equal(s.receipt, e1.result.receipt); assert.deepEqual(s.events.map(e => e.state), ['prepared', 'approved', 'sending', 'accepted']); assert.ok(s.events.slice(1).every(e => e.ref?.auditId)); });
  check(() => { const t = taskOf(sm.id); assert.equal(t.state, 'closed'); assert.equal(t.closed.verified, true); assert.equal(t.closed.receiptId, e1.result.receipt); assert.deepEqual(e1.result.closedTasks, [t.id]); assert.equal(taskOf(sc.id).state, 'open'); });
  check(() => { assert.deepEqual(subOf(va, 'mis_maternal'), sm, 'the original submission and its receipt are kept unchanged'); });
  // Community MIS: the response is lost; execute again does nothing; only the lookup resolves it.
  const p2 = (await prep(d, sc.id, 200, { reasonCode: 'entered-in-error' })).result;
  await send(d, { type: 'approveWithdrawal', personId: pid, withdrawalId: p2.withdrawalId, payloadHash: p2.payloadHash });
  const e2 = await send(d, { type: 'executeWithdrawal', personId: pid, withdrawalId: p2.withdrawalId });
  const e2b = await send(d, { type: 'executeWithdrawal', personId: pid, withdrawalId: p2.withdrawalId });
  check(() => { assert.equal(e2.result.state, 'uncertain'); assert.equal(e2b.result.state, 'uncertain'); });
  await send(x, { type: 'lookupWithdrawal', personId: pid, withdrawalId: p2.withdrawalId }, 403);
  await send(d, { type: 'cancelWithdrawal', personId: pid, withdrawalId: p2.withdrawalId }, 409);
  const l2 = await send(w, { type: 'lookupWithdrawal', personId: pid, withdrawalId: p2.withdrawalId });
  await send(w, { type: 'lookupWithdrawal', personId: pid, withdrawalId: p2.withdrawalId }, 409);
  await refresh(o);
  check(() => { const s = visit(va).withdrawals.find(y => y.id === p2.withdrawalId); assert.equal(l2.result.state, 'accepted'); assert.equal(s.attempts, 1, 'sent once'); assert.equal(s.lookups, 1); assert.match(s.message, /found by lookup; nothing was sent again/); assert.equal(taskOf(sc.id).state, 'closed'); });
  check(() => { assert.deepEqual(subOf(va, 'mis_community'), sc); });
  // Trace: each withdrawal is its own thread with its receipt, linked to its commands and audit events.
  const tr = await read(o, `/api/trace?visit=${encodeURIComponent(va)}`);
  check(() => { assert.equal(tr.traceVersion, '1.2.0'); const ths = tr.threads.filter(t => t.kind === 'withdrawal'); assert.equal(ths.length, 2); assert.ok(ths.every(t => t.state === 'accepted' && /^SIM-W-/.test(t.receipt))); assert.ok(tr.events.some(e => e.action === 'withdrawalReceipt' && e.steps.includes('withdrawal:' + wid))); assert.ok(tr.events.some(e => e.action === 'approveWithdrawal')); });
  check(() => { const rows = sql.prepare("SELECT action,person_id FROM audit_events WHERE org_id=? AND subject=? ORDER BY seq").all(org, wid); assert.deepEqual(rows.map(r => r.action), ['prepareWithdrawal', 'approveWithdrawal', 'executeWithdrawal', 'withdrawalReceipt']); assert.ok(rows.every(r => r.person_id === pid)); });
  check(() => { const row = sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org, va), data = JSON.parse(row.data); assert.equal(data.withdrawals.length, 2); assert.equal(data.withdrawals.filter(y => y.state === 'accepted').length, 2); assert.ok(data.withdrawals.every(y => y.payload === undefined)); });
  check(() => { const row = sql.prepare('SELECT state,data FROM submissions WHERE org_id=? AND id=?').get(org, sm.id); assert.equal(row.state, 'accepted'); assert.equal(JSON.parse(row.data).receipt, sm.receipt); });
  // Visit B (current): a changed patient blocks approval; a permission withdrawn after approval closes it as not sent.
  const vb = await confirmed(2);
  await deliver(vb, ['mis_maternal']);
  const sb = subOf(vb, 'mis_maternal');
  const p3 = (await prep(w, sb.id, 200, { reasonCode: 'entered-in-error', reason: 'Sent to the register by mistake' })).result;
  await refresh(o);
  await send(o, { type: 'setConsent', personId: pid, purpose: 'exchange', active: true, version: o.state.people.find(p => p.id === pid).version });
  const stale = await send(w, { type: 'approveWithdrawal', personId: pid, withdrawalId: p3.withdrawalId, payloadHash: p3.payloadHash }, 409);
  check(() => assert.match(stale.error, /patient record or sharing permission changed/));
  await send(w, { type: 'cancelWithdrawal', personId: pid, withdrawalId: p3.withdrawalId });
  const p4 = (await prep(w, sb.id, 200, { reasonCode: 'entered-in-error', reason: 'Sent to the register by mistake' })).result;
  await send(w, { type: 'approveWithdrawal', personId: pid, withdrawalId: p4.withdrawalId, payloadHash: p4.payloadHash });
  await allow('mis_maternal', ['create', 'update', 'lookup']);
  const refused = await send(w, { type: 'executeWithdrawal', personId: pid, withdrawalId: p4.withdrawalId });
  await refresh(o);
  check(() => { const s = visit(vb).withdrawals.find(y => y.id === p4.withdrawalId); assert.equal(refused.result.refused, true); assert.equal(s.state, 'cancelled'); assert.equal(s.refusal.operation, 'delete'); assert.equal(s.refusal.stage, 'before-send'); assert.equal(s.attempts, 0); assert.equal(subOf(vb, 'mis_maternal').state, 'accepted'); });
  // Without the permission nothing can be prepared; the voided visit's task would stay manual.
  const none = await prep(w, sb.id, 409, { reasonCode: 'entered-in-error', reason: 'Sent to the register by mistake' });
  check(() => assert.match(none.error, /not permitted to delete or void records/));
}
