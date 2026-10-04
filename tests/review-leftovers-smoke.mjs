import assert from 'node:assert/strict';
// Slice 13d: review leftovers through the built Worker and local D1, in its own organisation of known shape (7 people in one
// village and 2 in another, as in the indicator-registry smoke).
// Ninth review, finding 8: a refused indicator query is recorded (an aggregate-view event naming the refusal and which filters
// were set, never their values): both the refusal of a combination with the viewer's earlier queries and the refusal of a
// cohort below the minimum. Refused or partly withheld queries are limited to REFUSALS_PER_DAY per viewer per 24 hours.
export async function reviewLeftoversSmoke({ get, post, check, base, sql }) {
  const run = crypto.randomUUID().slice(0, 8), o = { id: `leftover-${run}-owner`, headers: { 'oai-authenticated-user-id': `leftover-${run}-owner`, 'oai-authenticated-user-email': 'owner@example.invalid' }, state: null };
  await get(o);
  const org = (await post(o, { type: 'createOrganisation', name: `Leftovers ${run}` })).result.organisationId;
  for (let i = 0; i < 9; i++) await post(o, { type: 'createPerson', name: `Leftover Synthetic ${run} ${String.fromCharCode(65 + i)}${i}`, age: 20 + i * 5, sex: 'Female', village: i < 7 ? `Left North ${run}` : `Left South ${run}`, programme: 'General care', teamId: 'default' }, 200, crypto.randomUUID(), org);
  const query = async (q, status) => { const r = await fetch(`${base}/api/indicators`, { method: 'POST', headers: { ...o.headers, 'Content-Type': 'application/json', 'x-saha-organisation': org }, body: JSON.stringify(q) }); const j = await r.json(); check(() => assert.equal(r.status, status, JSON.stringify(j).slice(0, 300))); return j; };
  const refusals = () => sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND subject='indicator refusal' ORDER BY at,seq").all(org, o.id);
  const total = await query({ ids: 'visits-confirmed', days: '30', group: 'none' }, 200);
  check(() => assert.equal(total.cohort.people, 9));
  check(() => assert.equal(refusals().length, 0, 'a released query is not a refusal'));
  const north = await query({ ids: 'visits-confirmed', days: '30', group: 'none', village: `Left North ${run}` }, 422);
  check(() => assert.match(north.error, /Together with your indicator queries .* fewer than 5 people/));
  check(() => { const e = refusals(); assert.equal(e.length, 1, 'the combination refusal is recorded'); assert.match(e[0].detail, /^Indicator query refused whole: .*Filters set: village; nothing was shown\. Authority: /); assert.ok(!e[0].detail.includes('Left North'), 'no filter value'); });
  const south = await query({ ids: 'visits-confirmed', days: '30', group: 'none', village: `Left South ${run}` }, 422);
  check(() => assert.match(south.error, /cohort has fewer than 5/));
  check(() => { const e = refusals(); assert.equal(e.length, 2, 'the cohort refusal is recorded'); assert.match(e[1].detail, /^Indicator query refused: the cohort is below the minimum of 5 people\. Filters set: village; nothing was shown\. Authority: /); assert.ok(!e[1].detail.includes('Left South')); });
  for (let i = 2; i < 20; i++) await query({ ids: 'visits-confirmed', days: '30', group: 'none', village: `Left South ${run}` }, 422);
  check(() => assert.equal(refusals().length, 20));
  const limited = await query({ ids: 'visits-confirmed', days: '30', group: 'none' }, 429);
  check(() => assert.match(limited.error, /refused or partly withheld to protect small groups reached 20 in the last 24 hours/));
  check(() => assert.equal(refusals().length, 20, 'a query stopped by the limit is not counted again'));
  const catalogue = await fetch(`${base}/api/indicators`, { headers: { ...o.headers, 'x-saha-organisation': org } });
  check(() => assert.equal(catalogue.status, 200, 'the catalogue (no figures) is still readable'));
}
