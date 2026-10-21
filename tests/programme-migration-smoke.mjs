import assert from 'node:assert/strict';
// Slice 4e: reviewed migration of open programme episodes over HTTP and local D1: who may read the dry run, what it
// lists (ids and counts, never names), stale plans refused, apply of that exact plan with one revision per episode
// and one counted audit event, replay, adoption for new episodes, and the blocked episode left for manual action.
export async function programmeMigrationSmoke({ get, post, check, accounts, org, sql, base }) {
  const { worker: w, supervisor: sv, admin: a, stranger: x, clinician: c } = accounts;
  const o = { headers: { 'oai-authenticated-user-id': `pm-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'pm-owner@example.invalid' }, state: null };
  await get(o, '/api/workspace');
  const mine = o.state.organisation.id;
  const read = async (who, orgId = mine, status = 200) => { const r = await fetch(`${base}/api/programme-migration`, { headers: { ...who.headers, 'x-saha-organisation': orgId } }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  for (const who of [w, sv, a]) await read(who, org, 403);
  await read(x, mine, 403);
  const clinicianView = await read(c, org);
  check(() => { assert.equal(clinicianView.canAdopt, false); assert.ok(clinicianView.catalogue.some(p => p.packId === 'maternal' && p.latestVersion === 2)); });
  // A fresh organisation: nothing open yet, but v2 exists and new episodes still open on v1.
  let view = await read(o);
  check(() => { const m = view.catalogue.find(p => p.packId === 'maternal'), plan = view.plans.find(p => p.packId === 'maternal'); assert.deepEqual([m.versions, m.adoptedVersion, m.latestVersion], [[1, 2], 1, 2]); assert.ok(plan); assert.equal(plan.candidates.length, 0); assert.equal(plan.adopts, true); assert.deepEqual(view.batches, []); });
  const person = id => o.state.people.find(p => p.id === id);
  const enrol = id => post(o, { type: 'enrolProgramme', personId: id, version: person(id).version, packId: 'maternal', episodeLabel: 'Synthetic migration episode', startDate: null }, 200, undefined, mine);
  for (const id of ['p_meena', 'p_aarav', 'p_farida']) await enrol(id);
  check(() => assert.ok(['p_meena', 'p_aarav', 'p_farida'].every(id => person(id).enrolments[0].packVersion === 1)));
  // Farida has an open visit capturing her v1 episode: she is listed for manual action.
  await post(o, { type: 'startVisit', personId: 'p_farida' }, 200, undefined, mine);
  view = await read(o);
  const plan = view.plans.find(p => p.packId === 'maternal');
  check(() => { assert.equal(plan.packId, 'maternal'); assert.deepEqual(plan.candidates.map(c => c.personId).sort(), ['p_aarav', 'p_meena']); assert.deepEqual(plan.blocked.map(b => [b.personId, b.code]), [['p_farida', 'open-visit']]); assert.equal(plan.outOfScope, 0); assert.equal(plan.changes[0].renamed[0].to, 'appointment_discussed'); const text = JSON.stringify(view); for (const n of ['Meena Devi', 'Aarav Singh', 'Farida Begum', 'Synthetic migration episode']) assert.equal(text.includes(n), false, n); });
  const cmd = (planHash, reason = 'Move open maternal episodes to v2') => ({ type: 'programmeMigrationApply', packId: 'maternal', targetVersion: 2, planHash, reason });
  // A care-role member without clinician or owner standing is refused; a change after the dry run makes it stale.
  await post(w, cmd(plan.planHash), 403, undefined, org);
  await post(o, { type: 'scheduleFollowUp', personId: 'p_meena', version: person('p_meena').version, enrolmentId: person('p_meena').enrolments[0].id, title: 'Synthetic follow-up', due: '2026-12-01', ownerId: o.state.user.userId }, 200, undefined, mine);
  await post(o, cmd(plan.planHash), 409, undefined, mine);
  view = await read(o);
  const key = crypto.randomUUID();
  const applied = await post(o, cmd(view.plans.find(p => p.packId === 'maternal').planHash), 200, key, mine);
  check(() => { assert.deepEqual(applied.result, { batchId: applied.result.batchId, migrated: 2, blocked: 1, outOfScope: 0, adopted: true }); assert.equal(person('p_meena').enrolments[0].packVersion, 2); assert.equal(person('p_meena').enrolments[0].migrations[0].from, 1); assert.equal(person('p_farida').enrolments[0].packVersion, 1); assert.equal(person('p_meena').followUps[0].state, 'open'); });
  check(() => { const r = sql.prepare("SELECT entity_id FROM record_revisions WHERE org_id=? AND action='programmeMigrationApply' AND reason='Move open maternal episodes to v2' ORDER BY entity_id").all(mine); assert.deepEqual(r.map(x => x.entity_id), ['p_aarav', 'p_meena']); const ev = sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='programmeMigrationApply'").all(mine); assert.equal(ev.length, 1); assert.match(ev[0].detail, /3 open episodes on older versions examined, 2 migrated, 1 left on their version for manual action/); });
  // Replaying the same operation key returns the stored result without a second batch.
  const replay = await post(o, cmd(view.plans.find(p => p.packId === 'maternal').planHash), 200, key, mine);
  check(() => { assert.equal(replay.replayed, true); assert.equal(replay.result.batchId, applied.result.batchId); assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='programmeMigrationApply'").get(mine).n, 1); });
  // New episodes now open on v2; the blocked episode is still listed; applying again finds nothing to do.
  await enrol('p_sunita');
  check(() => assert.equal(person('p_sunita').enrolments[0].packVersion, 2));
  view = await read(o);
  check(() => { const plan = view.plans.find(p => p.packId === 'maternal'); assert.equal(view.catalogue.find(p => p.packId === 'maternal').adoptedVersion, 2); assert.equal(plan.candidates.length, 0); assert.deepEqual(plan.blocked.map(b => b.personId), ['p_farida']); assert.equal(view.batches.length, 1); assert.equal(view.batches[0].migrated, 2); });
  await post(o, cmd(view.plans.find(p => p.packId === 'maternal').planHash, 'Nothing is left to migrate'), 409, undefined, mine);
  const chain = await (await fetch(`${base}/api/audit/chain`, { headers: { ...o.headers, 'x-saha-organisation': mine } })).json();
  check(() => assert.equal(chain.status, 'intact'));
}
