import assert from 'node:assert/strict';
// Slice 2d: the fixture-marking migration over HTTP and local D1: dry run, apply of that exact plan,
// revisions and audit, stale plans refused, reversal, and owner-only access.
export async function fixtureMigrationSmoke({ get, post, check, accounts, org, sql, base }) {
  const { worker: w, supervisor: sv, admin: a, stranger: x } = accounts;
  // A new account stands in for one created before slice 6n: its seeded fixtures lose their marks.
  const o = { headers: { 'oai-authenticated-user-id': `mig-${crypto.randomUUID()}`, 'oai-authenticated-user-email': 'mig-owner@example.invalid' }, state: null };
  await get(o, '/api/workspace');
  const mine = o.state.organisation.id;
  sql.prepare("UPDATE patients SET data=json_remove(data,'$.synthetic') WHERE org_id=?").run(mine);
  await get(o, '/api/workspace', 200, mine);
  const read = async (who, orgId = mine, status = 200) => { const r = await fetch(`${base}/api/fixture-migration`, { headers: { ...who.headers, 'x-saha-organisation': orgId } }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  for (const who of [w, sv, a, x]) await read(who, org, 403);
  // One fixture renamed through the normal correction command is rejected for review.
  const rajesh = o.state.people.find(p => p.id === 'p_rajesh');
  await post(o, { type: 'correctIdentity', personId: rajesh.id, version: rajesh.version, name: 'Rajesh Kumar Singh', age: rajesh.age, sex: rajesh.sex, village: rajesh.village, reason: 'Synthetic correction before the migration' }, 200, undefined, mine);
  let view = await read(o);
  check(() => { const d = view.dryRun; assert.equal(d.migration, 'mark-seeded-fixtures-v1'); assert.equal(d.candidates.length, 5); assert.deepEqual(d.rejected.map(r => r.personId), ['p_rajesh']); assert.equal(d.alreadyMarked, 0); assert.equal(d.outOfScope, 0); assert.deepEqual(view.batches, []); assert.equal(JSON.stringify(view).includes('Meena Devi'), false); });
  // Non-owners cannot apply; a stale plan is refused.
  const plan = view.dryRun.planHash;
  const inv = (await post(o, { type: 'createInvite', accountCode: sv.state.user.accountCode, label: 'Migration supervisor', role: 'supervisor', teamIds: ['default'] }, 200, undefined, mine)).result;
  await post(sv, { type: 'joinOrganisation', token: inv.token });
  await post(sv, { type: 'fixtureMarkApply', planHash: plan, reason: 'Supervisor attempt to migrate' }, 403, undefined, mine);
  const meena = o.state.people.find(p => p.id === 'p_meena');
  await post(o, { type: 'correctIdentity', personId: meena.id, version: meena.version, name: meena.name, age: meena.age + 1, sex: meena.sex, village: meena.village, reason: 'Synthetic age correction after the dry run' }, 200, undefined, mine);
  await post(o, { type: 'fixtureMarkApply', planHash: plan, reason: 'Apply an outdated dry run' }, 409, undefined, mine);
  view = await read(o);
  const applied = await post(o, { type: 'fixtureMarkApply', planHash: view.dryRun.planHash, reason: 'Mark fixtures seeded before 6n' }, 200, undefined, mine);
  check(() => { assert.equal(applied.result.marked, 5); assert.equal(applied.result.rejected, 1); assert.equal(o.state.people.filter(p => p.synthetic).length, 5); assert.equal(o.state.people.find(p => p.id === 'p_rajesh').synthetic, undefined); });
  check(() => { const r = sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND action='fixtureMarkApply' AND reason='Mark fixtures seeded before 6n'").get(mine).n; assert.equal(r, 5); const a = sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='fixtureMarkApply'").get(mine); assert.match(a.detail, /5 marked as synthetic fixtures, 1 rejected for review/); });
  view = await read(o);
  check(() => { assert.equal(view.dryRun.candidates.length, 0); assert.equal(view.dryRun.alreadyMarked, 5); assert.equal(view.batches.length, 1); assert.equal(view.batches[0].marked, 5); });
  await post(o, { type: 'fixtureMarkApply', planHash: view.dryRun.planHash, reason: 'Nothing is left to mark' }, 409, undefined, mine);
  // Reversal of the batch, once.
  const reverted = await post(o, { type: 'fixtureMarkRevert', batchId: applied.result.batchId, reason: 'Reverse the batch for review' }, 200, undefined, mine);
  check(() => { assert.equal(reverted.result.reverted, 5); assert.equal(o.state.people.filter(p => p.synthetic).length, 0); });
  await post(o, { type: 'fixtureMarkRevert', batchId: applied.result.batchId, reason: 'Reverse the batch again' }, 409, undefined, mine);
  view = await read(o);
  check(() => { assert.equal(view.dryRun.candidates.length, 5); assert.ok(view.batches[0].revertedAt); assert.equal(view.batches[0].reverted, 5); });
  const chain = await (await fetch(`${base}/api/audit/chain`, { headers: { ...o.headers, 'x-saha-organisation': mine } })).json();
  check(() => assert.equal(chain.status, 'intact'));
  await post(sv, { type: 'switchOrganisation', organisationId: org });
}
