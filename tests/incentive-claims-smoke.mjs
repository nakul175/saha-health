import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Slice 10c: synthetic worker incentive claims through the built Worker and local D1: the owner's placeholder schedule, an
// ASHA's claim from her own confirmed activity, supervisor verification, owner approval into a digest chain, immutability,
// a linked correction, the CSV with its digest, scope, and tamper detection. Nothing is paid and no real rate is used.
const sha = t => createHash('sha256').update(t).digest('hex');
export async function incentiveClaimsSmoke({ get, post, check, accounts, org, sql, base }) {
  const { owner: o, worker: other, supervisor: s, admin: a, clinician: c, stranger: x } = accounts;
  const tag = crypto.randomUUID().slice(0, 6), village = `Incentive locality ${tag}`, name = `Incentive Synthetic ${tag}`;
  // A fresh ASHA of the default team, so the claim holds only this exercise's activity and not what the shared worker account
  // confirmed in earlier modules (a claim holds at most 60 lines). The shared worker account is the "other ASHA" below.
  const w = { id: `r1-inc10c-${tag}`, headers: { 'oai-authenticated-user-id': `r1-inc10c-${tag}`, 'oai-authenticated-user-email': `inc10c-${tag}@example.invalid`, 'oai-authenticated-user-full-name': 'Incentive%20ASHA', 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null };
  const read = async (who, q = '', status = 200) => { const r = await fetch(`${base}/api/incentive-claims${q}`, { headers: { ...who.headers, 'x-saha-organisation': org } }); const text = await r.text(); check(() => assert.equal(r.status, status, text.slice(0, 300))); return { r, text, json: () => JSON.parse(text) }; };
  const view = async (who, q = '') => (await read(who, q)).json();
  const as = (who, body, status = 200, key = crypto.randomUUID()) => post(who, body, status, key, org);
  await get(null, '/api/incentive-claims', 401);
  await get(w);
  const invite = await post(o, { type: 'createInvite', accountCode: w.state.user.accountCode, label: 'asha', role: 'asha', teamIds: ['default'] }, 200, crypto.randomUUID(), org);
  await post(w, { type: 'joinOrganisation', token: invite.result.token }, 200);
  await get(o, '/api/workspace', 200, org);
  // Who may read at all: an ASHA, a team supervisor and an owner; not a clinician without a delegation, an administrator, a stranger.
  await read(c, '', 403); await read(a, '', 403); await read(x, '', 403);
  const before = await view(w);
  check(() => { assert.match(before.notice, /^SYNTHETIC\./); assert.match(before.notice, /not an incentive rate of any government or programme/); assert.equal(before.unit, 'SYN'); assert.equal(before.canPrepare, false, 'no schedule yet'); assert.equal(before.schedule.current, null); });
  // The schedule: owner only, validated, versioned, replay-safe.
  const schedule = { type: 'setIncentiveSchedule', expectedVersion: 0, label: 'Synthetic placeholder schedule', lines: [{ kind: 'visit-confirmed', amount: 10 }, { kind: 'visit-submitted', amount: 15 }, { kind: 'outreach-completed', amount: 20 }], reason: 'Placeholder amounts to test the claim workflow' };
  await as(w, schedule, 403); await as(s, schedule, 403); await as(c, schedule, 403);
  await as(o, { ...schedule, lines: [{ kind: 'visit-confirmed', amount: 0 }] }, 422); await as(o, { ...schedule, lines: [{ kind: 'visit-confirmed', amount: 5000 }] }, 422); await as(o, { ...schedule, lines: [{ kind: 'visit-confirmed', amount: 5 }, { kind: 'visit-confirmed', amount: 6 }] }, 422); await as(o, { ...schedule, label: '=1+1' }, 422); await as(o, { ...schedule, expectedVersion: 4 }, 409);
  // Before a schedule exists no claim can be prepared.
  const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10), period = { from: yesterday, to: today };
  await as(w, { type: 'prepareIncentiveClaim', teamId: 'default', ...period }, 409);
  const key = crypto.randomUUID(), set = await as(o, schedule, 200, key), replay = await as(o, schedule, 200, key);
  check(() => { assert.equal(set.result.version, 1); assert.equal(replay.replayed, true); });
  // A patient, an outreach round and four visits confirmed by the ASHA; one goes to the programme register.
  const pid = (await as(o, { type: 'createPerson', name, age: 27, sex: 'Female', village, programme: 'Maternal care', teamId: 'default' })).result.personId;
  await as(o, { type: 'assignPatient', personId: pid, version: o.state.people.find(p => p.id === pid).version, teamId: 'default', assignedTo: w.id, reason: 'Assign for the incentive claims exercise' });
  const planId = (await as(s, { type: 'outreachCreate', title: `Incentive round ${tag}`, date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), teamId: 'default', ownerId: w.id, personIds: [pid], criteria: 'Synthetic case for the incentive claims exercise.' })).result.planId;
  await as(s, { type: 'outreachTransition', planId, version: 1, state: 'scheduled', reason: 'Schedule the incentive claims round' });
  const facts = n => ({ date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '', diastolic: '', weight: String(50 + n), temperature: '', weeks: '18', coughDays: '', notes: `Synthetic incentive visit ${n}`, source: 'measured' });
  const visit = id => w.state.visits.find(v => v.id === id);
  const confirmed = async n => { await get(w, '/api/workspace', 200, org); const id = (await as(w, { type: 'startVisit', personId: pid })).result.visitId; await as(w, { type: 'saveVisit', visitId: id, version: visit(id).version, facts: facts(n) }); await as(w, { type: 'confirmVisit', visitId: id, version: visit(id).version }); return id; };
  const va = await confirmed(1), vb = await confirmed(2), vc = await confirmed(3), vd = await confirmed(4);
  await as(w, { type: 'preparePlan', visitId: va, recipients: ['mis_maternal'] }); const plan = visit(va).plan;
  await as(w, { type: 'approvePlan', visitId: va, planId: plan.id, payloadHash: plan.payloadHash }); await as(w, { type: 'executePlan', visitId: va, planId: plan.id });
  const report = await get(s, '/api/outreach', 200, org), item = report.plans.find(p => p.id === planId).items[0];
  await as(w, { type: 'outreachRecord', planId, itemId: item.id, version: report.plans.find(p => p.id === planId).version, state: 'completed', note: 'Visit completed in the household', reference: `INC-${tag}`, visitId: vd });
  // Eligibility preview for the ASHA: her own confirmed activity, priced by the schedule; the evidence visit of the outreach item is one line only.
  const q = `?from=${period.from}&to=${period.to}&team=default`, mine = lines => lines.filter(l => l.patient === name);
  let pre = (await view(w, q)).eligible;
  check(() => { const l = mine(pre.lines); assert.deepEqual(l.map(r => [r.kind, r.amount]).sort(), [['outreach-completed', 20], ['visit-confirmed', 10], ['visit-confirmed', 10], ['visit-submitted', 15]]); assert.equal(l.find(r => r.ref === va).kind, 'visit-submitted'); assert.match(l.find(r => r.ref === va).receipt, /^SIM-/); assert.equal(l.some(r => r.ref === vd), false, 'the outreach evidence visit is not also a visit line'); assert.equal(l.find(r => r.kind === 'outreach-completed').evidenceVisitId, vd); assert.equal(pre.total, pre.lines.reduce((n, r) => n + r.amount, 0)); assert.equal(JSON.stringify(pre).includes(village), false, 'no locality'); });
  assert.equal((await view(s, q)).eligible, null, 'only an ASHA is shown an eligibility preview');
  await read(w, '?from=2026-13-01&to=2026-13-02&team=default', 422); await read(w, `?from=${today}&to=${yesterday}&team=default`, 422); await read(w, '?format=xml', 422);
  // Preparing a claim: only the ASHA, only her teams, a valid period.
  const prep = (over = {}) => ({ type: 'prepareIncentiveClaim', teamId: 'default', ...period, ...over });
  await as(o, prep(), 403); await as(s, prep(), 403); await as(c, prep(), 403); await as(a, prep(), 403); await as(x, prep(), 403); await as(w, prep({ teamId: o.state.teams.find(t => t.name === 'North team').id }), 403);
  await as(w, prep({ from: today, to: yesterday }), 422); await as(w, prep({ from: '2026-01-01', to: today }), 422);
  const pkey = crypto.randomUUID(), made = await as(w, prep(), 200, pkey), again = await as(w, prep(), 200, pkey);
  const first = made.result;
  check(() => { assert.equal(again.replayed, true); assert.equal(again.result.claimId, first.claimId); assert.ok(first.lines >= 4); assert.equal(first.total >= 55, true); });
  // No double claiming: every line of that claim is taken.
  await as(w, prep(), 422);
  let v = await view(w), claim = v.claims.find(r => r.id === first.claimId);
  check(() => { assert.equal(claim.state, 'submitted'); assert.equal(claim.type, 'claim'); assert.equal(claim.total, first.total); assert.equal(claim.lines.length, first.lines); assert.deepEqual(mine(claim.lines).map(l => l.amount).sort((p, q2) => p - q2), [10, 10, 15, 20]); assert.ok(claim.lines.every(l => l.evidenceVisitId && l.ref)); assert.ok(mine(claim.lines).every(l => l.personId === pid)); assert.equal(claim.actions.withdraw, true); assert.equal(claim.actions.verify, false); assert.equal(JSON.stringify(v).includes(village), false); });
  check(() => assert.equal((v.eligible), null));
  // Another ASHA of the same team sees none of this claim, none of this patient's activity, and cannot act on the claim.
  const ov = await view(other, q);
  check(() => { assert.equal(ov.claims.some(r => r.id === first.claimId), false); assert.equal(mine(ov.eligible.lines).length, 0); });
  await as(other, { type: 'withdrawIncentiveClaim', claimId: first.claimId, version: 1, reason: 'Not my claim to withdraw' }, 403);
  // Role steps. Nobody verifies or approves out of turn.
  const V = (cl, over = {}) => ({ type: 'verifyIncentiveClaim', claimId: cl.id, version: cl.version, decision: 'verified', note: 'Checked against the visit records', ...over });
  const D = (cl, over = {}) => ({ type: 'decideIncentiveClaim', claimId: cl.id, version: cl.version, decision: 'approved', note: 'Approved for the synthetic record', ...over });
  await as(w, V(claim), 403); await as(c, V(claim), 403); await as(a, V(claim), 403); await as(x, V(claim), 403); await as(o, D(claim), 409); await as(s, V(claim, { version: 9 }), 409); await as(s, V(claim, { decision: 'returned', note: 'short' }), 422);
  // Evidence that stops standing blocks verification: the owner marks one visit as recorded against the wrong patient.
  await get(o, '/api/workspace', 200, org); await as(o, { type: 'voidVisit', visitId: vb, version: o.state.visits.find(r => r.id === vb).recordVersion, reason: 'Recorded against the wrong person in the household' });
  v = await view(s); claim = v.claims.find(r => r.id === first.claimId);
  check(() => { assert.equal(claim.staleCount, 1); assert.match(claim.lines.find(l => l.ref === vb).stale, /wrong patient/); assert.equal(claim.actions.verify, true); });
  const stale = await as(s, V(claim), 409); check(() => { assert.match(stale.error, /no longer has current evidence/); assert.equal(stale.error.includes('Recorded against the wrong person'), false); });
  await as(s, V(claim, { decision: 'returned', note: 'One visit was marked wrong patient' }));
  v = await view(w); claim = v.claims.find(r => r.id === first.claimId);
  check(() => { assert.equal(claim.state, 'returned'); assert.deepEqual(claim.history.map(h => h.action), ['submitted', 'returned by the supervisor']); });
  // A returned claim releases its lines: the ASHA prepares again, without the wrong-patient visit.
  const second = (await as(w, prep())).result; v = await view(w); let claim2 = v.claims.find(r => r.id === second.claimId);
  check(() => { assert.equal(claim2.number, claim.number + 1); assert.equal(claim2.lines.some(l => l.ref === vb), false); assert.equal(claim2.total, first.total - 10); assert.equal(claim2.lines.length, first.lines - 1); });
  // Withdrawn by the preparer only; then prepared once more.
  await as(s, { type: 'withdrawIncentiveClaim', claimId: claim2.id, version: claim2.version, reason: 'Not the preparer of this claim' }, 403);
  await as(w, { type: 'withdrawIncentiveClaim', claimId: claim2.id, version: claim2.version, reason: 'Withdrawn to prepare it again' });
  const third = (await as(w, prep())).result; v = await view(w); let claim3 = v.claims.find(r => r.id === third.claimId);
  check(() => { assert.equal(claim3.lines.length, claim2.lines.length); assert.equal(v.claims.find(r => r.id === second.claimId).state, 'withdrawn'); });
  // Verified by the supervisor, approved by the owner (a different person), stored with a chained digest.
  await as(s, V(claim3)); v = await view(o); claim3 = v.claims.find(r => r.id === third.claimId);
  check(() => { assert.equal(claim3.state, 'verified'); assert.equal(claim3.verified.by, s.state.user.displayName); assert.equal(claim3.actions.decide, true); assert.equal(claim3.actions.verify, false); });
  await as(s, D(claim3), 403); await as(w, D(claim3), 403); await as(c, D(claim3), 403); await as(o, D(claim3, { version: 1 }), 409); await as(o, D(claim3, { decision: 'returned', note: 'no' }), 422);
  const approved = await as(o, D(claim3));
  const priorHead = v.chain.head?.digest ?? '0'.repeat(64), priorSeq = v.chain.head?.seq ?? 0;
  check(() => { assert.equal(approved.result.state, 'approved'); assert.equal(approved.result.seq, priorSeq + 1); assert.match(approved.result.digest, /^[0-9a-f]{64}$/); });
  v = await view(o); claim3 = v.claims.find(r => r.id === third.claimId);
  check(() => { assert.equal(claim3.chain.digest, approved.result.digest); assert.equal(claim3.chain.prev, priorHead); assert.equal(v.chain.status, 'intact'); assert.equal(v.chain.head.digest, claim3.chain.digest); assert.deepEqual(claim3.history.map(h => h.action), ['submitted', 'verified', 'approved']); });
  // Immutable once approved.
  const frozen = JSON.stringify(claim3);
  await as(w, { type: 'withdrawIncentiveClaim', claimId: claim3.id, version: claim3.version, reason: 'Withdrawing an approved claim' }, 409); await as(s, V(claim3), 409); await as(o, D(claim3, { decision: 'returned', note: 'Return an approved claim' }), 409);
  assert.equal(JSON.stringify((await view(o)).claims.find(r => r.id === third.claimId)), frozen);
  // A correction is a new linked claim. Voiding another source visit makes its approved line stale; the original is untouched.
  await get(o, '/api/workspace', 200, org); await as(o, { type: 'voidVisit', visitId: vc, version: o.state.visits.find(r => r.id === vc).recordVersion, reason: 'Late wrong-patient finding for the third visit' });
  v = await view(w); claim3 = v.claims.find(r => r.id === third.claimId); const line = claim3.lines.find(l => l.ref === vc);
  check(() => { assert.equal(claim3.state, 'approved'); assert.equal(claim3.staleCount, 1); assert.ok(line.stale); assert.equal(claim3.actions.correct, true); });
  const corr = (cl, lineId, reason = 'The visit was marked wrong patient') => ({ type: 'prepareIncentiveCorrection', claimId: cl.id, reversals: [{ lineId, reason }] });
  await as(c, corr(claim3, line.id), 403); await as(a, corr(claim3, line.id), 403); await as(other, corr(claim3, line.id), 403); await as(w, corr(claim3, 'nope'), 404); await as(w, corr(claim3, line.id, 'short'), 422);
  const cr = (await as(w, corr(claim3, line.id))).result; await as(w, corr(claim3, line.id), 409);
  v = await view(w); const c1 = v.claims.find(r => r.id === cr.claimId);
  check(() => { assert.equal(c1.type, 'correction'); assert.equal(c1.corrects, claim3.id); assert.equal(c1.correctsNumber, claim3.number); assert.equal(c1.total, -10); assert.equal(c1.lines[0].amount, -10); assert.equal(c1.lines[0].kind, 'reversal'); assert.equal(c1.lines[0].reverses.lineId, line.id); assert.deepEqual(v.claims.find(r => r.id === third.claimId).correctedBy, [c1.number]); const stored = r => JSON.stringify([r.number, r.type, r.state, r.version, r.total, r.period, r.scheduleVersion, r.chain, r.history, r.verified, r.lines.map(l => [l.id, l.kind, l.ref, l.amount])]); assert.equal(stored(v.claims.find(r => r.id === third.claimId)), stored(JSON.parse(frozen)), 'the original claim record is unchanged'); });
  await as(s, V(c1)); const c1v = (await view(o)).claims.find(r => r.id === cr.claimId); const done = await as(o, D(c1v));
  check(() => { assert.equal(done.result.seq, approved.result.seq + 1); });
  v = await view(o); const c2 = v.claims.find(r => r.id === cr.claimId);
  check(() => { assert.equal(c2.chain.prev, claim3.chain.digest); assert.equal(v.chain.status, 'intact'); assert.equal(v.chain.approved >= 2, true); });
  await as(w, corr(c2, c2.lines[0].id, 'Reverse the reversal line'), 422);
  // Scope: names only inside the viewer's own care scope; an administrator owner would hold none.
  check(() => { const own = v.claims.find(r => r.id === third.claimId); assert.ok(mine(own.lines).length >= 1, 'the owner is a care-team member and sees names in the team'); });
  // CSV of approved claims with the digest: owner and supervisor, never the ASHA, a clinician or a stranger.
  await read(w, '?format=csv', 403); await read(c, '?format=csv', 403); await read(a, '?format=csv', 403); await read(x, '?format=csv', 403);
  const csv = await read(o, '?format=csv'), sup = await read(s, '?format=csv');
  const lines = csv.text.trimEnd().split('\r\n'), head = lines.findIndex(l => l.startsWith('"claim_number"')), H = lines[head].split(',').map(h => JSON.parse(h)), table = lines.slice(head + 1, -2).map(l => JSON.parse('[' + l + ']')), col = (r, n) => r[H.indexOf(n)];
  check(() => { assert.match(csv.r.headers.get('content-type'), /text\/csv/); assert.match(csv.r.headers.get('content-disposition'), /saha-synthetic-incentive-claims\.csv/); assert.equal(csv.r.headers.get('x-saha-content-sha256'), sha(lines.slice(0, -2).join('\r\n') + '\r\n')); assert.equal(lines.at(-1), `"Manifest","Content SHA-256","${csv.r.headers.get('x-saha-content-sha256')}"`); assert.match(lines[1], /SYNTHETIC/); assert.equal(csv.text.includes(name), false); assert.equal(csv.text.includes(village), false); assert.equal(csv.text.includes(pid), false, 'no patient identifier'); assert.ok(table.some(r => col(r, 'amount_syn') === -10)); assert.ok(sup.text.includes('"Manifest"')); });
  const offline = (rows, prev) => { const r0 = rows[0], cc = n => col(r0, n), content = sha(JSON.stringify(['saha-incentive-claim-content-v1', cc('claim_id'), cc('claim_number'), cc('claim_type'), cc('corrects_claim_id') || null, cc('team_id'), cc('claimant_code'), cc('prepared_by_code'), cc('period_from'), cc('period_to'), cc('schedule_version'), cc('prepared_at'), rows.map(r => [col(r, 'line_id'), col(r, 'line_kind'), col(r, 'source_ref'), col(r, 'evidence_visit_id'), col(r, 'subject_reference'), col(r, 'activity_at'), col(r, 'amount_syn'), col(r, 'receipt') || null, col(r, 'reverses_claim_id') || null, col(r, 'reverses_line_id') || null, col(r, 'reversal_reason') || null]), cc('claim_total_syn'), cc('verified_by_code') || null, cc('verified_at') || null, cc('verification_note') ?? null, cc('approved_by_code'), cc('approved_at')])); return { content, digest: sha(JSON.stringify(['saha-incentive-claim-v1', cc('chain_seq'), prev, content])) }; };
  check(() => { const groups = new Map(); for (const r of table) groups.set(col(r, 'claim_id'), [...(groups.get(col(r, 'claim_id')) ?? []), r]); const ordered = [...groups.values()].sort((p, q2) => col(p[0], 'chain_seq') - col(q2[0], 'chain_seq')); assert.ok(ordered.length >= 2); for (const rows of ordered) { const prev = col(rows[0], 'previous_digest'), o2 = offline(rows, prev); assert.equal(col(rows[0], 'content_digest'), o2.content); assert.equal(col(rows[0], 'claim_digest'), o2.digest); assert.equal(col(rows[0], 'claim_total_syn'), rows.reduce((n, r) => n + col(r, 'amount_syn'), 0)); } for (let i = 1; i < ordered.length; i++) if (col(ordered[i][0], 'chain_seq') === col(ordered[i - 1][0], 'chain_seq') + 1) assert.equal(col(ordered[i][0], 'previous_digest'), col(ordered[i - 1][0], 'claim_digest')); });
  // The export is recorded in the audit chain; the incentive audit text carries no patient name or locality.
  check(() => { const e = sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='incentiveExport'").all(org); assert.ok(e.length >= 2); assert.match(e[0].detail, /Incentive claims CSV [0-9a-f-]{36}: \d+ approved claims?, \d+ data rows; SHA-256 [0-9a-f]{64}/); const all = sql.prepare("SELECT detail,person_id FROM audit_events WHERE org_id=? AND action IN ('setIncentiveSchedule','prepareIncentiveClaim','prepareIncentiveCorrection','withdrawIncentiveClaim','verifyIncentiveClaim','decideIncentiveClaim','incentiveExport')").all(org); assert.ok(all.length >= 10); for (const r of all) { assert.equal(r.person_id, null); assert.equal(r.detail.includes(name) || r.detail.includes(village), false); } assert.ok(all.some(r => /approved and stored immutably as chain entry \d+; digest [0-9a-f]{64}/.test(r.detail))); });
  // Tamper evidence: a changed stored amount is reported at its sequence; restoring it restores the chain.
  const row = sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org), original = row.data, data = JSON.parse(original), target = data.incentives.claims.find(r => r.id === third.claimId);
  target.lines[0].amount += 1; sql.prepare('UPDATE operations SET data=? WHERE org_id=?').run(JSON.stringify(data), org);
  v = await view(o);
  check(() => { assert.equal(v.chain.status, 'broken'); assert.equal(v.chain.firstBreak.seq, target.chain.seq); assert.match(v.chain.firstBreak.reason, /total does not match|content was altered/); });
  sql.prepare('UPDATE operations SET data=? WHERE org_id=?').run(original, org);
  v = await view(o); check(() => assert.equal(v.chain.status, 'intact'));
  // A schedule change is a new version; earlier claims keep the version they were prepared on.
  await as(o, { ...schedule, expectedVersion: 1, label: 'Second placeholder schedule', lines: [{ kind: 'visit-confirmed', amount: 12 }], reason: 'A second set of placeholder amounts' });
  v = await view(o); check(() => { assert.equal(v.schedule.current.version, 2); assert.equal(v.schedule.history.length, 2); assert.equal(v.claims.find(r => r.id === third.claimId).scheduleVersion, 1); assert.equal(v.claims.find(r => r.id === third.claimId).lines.length, claim3.lines.length) });
  assert.equal((await view(s)).schedule.history, undefined, 'the schedule history is the owner\'s');
  // Slice 10k (combined review, finding H1): the Operations view returns an allow-list of the operations document, so an
  // administrator (no patient scope) and an owner never receive the claims, their patient ids or evidence visit ids there.
  for (const who of [o, a]) { const ops = await get(who, '/api/operations?format=json', 200, org); check(() => { assert.equal(ops.operations.incentives, undefined, 'claims are read through their own scoped route'); assert.equal(JSON.stringify(ops.operations).includes(pid), false, 'no patient id in the operations document'); assert.deepEqual(Object.keys(ops.operations).filter(k => !['version', 'maintenance', 'reason', 'updatedAt', 'incidents', 'rates', 'budgets', 'staffIds'].includes(k)), []); }); }
}
