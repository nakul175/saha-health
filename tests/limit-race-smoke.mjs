import assert from 'node:assert/strict';
// Slice 14a: the two per-requester daily limits hold under races, through the built Worker and local D1, each in its own
// organisation so the shared test organisation is not throttled.
// 1. ABHA review throttle (review 10): parallel abhaLink requests by one requester for numbers held by records outside
//    their scope record exactly ABHA_REVIEW_LIMIT (3) review events, one per holding record, and every later link is refused
//    the same way. Parallel requests for one held number record one event. Reservations of requests that found no
//    out-of-scope duplicate are released.
// 2. Indicator refusal limit (13d/13f): parallel refused queries are answered as refusals exactly up to REFUSALS_PER_DAY (20)
//    in 24 hours; the rest are refused with 429 and recorded nothing.
// 3. A partial differencing withhold (some results released, some withheld because they would combine with the viewer's
//    recent queries) is recorded as an `indicator refusal` event and counted, for the on-screen view and the CSV export.
// Synthetic data only. The 6ab, 13d and 13f checks of the sequential behaviour stay in eighth-review-smoke.mjs and
// review-leftovers-smoke.mjs.
export const ABHA_LIMIT = 3, REFUSAL_LIMIT = 20;
export async function limitRaceSmoke({ get, post, check, base, sql }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `limit-${run}-${label}`, headers: { 'oai-authenticated-user-id': `limit-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid` }, state: null });
  const raw = async (who, org, path, init = {}) => { const r = await fetch(base + path, { ...init, headers: { ...who.headers, 'x-saha-organisation': org, ...(init.headers ?? {}) } }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: r.status, json, text, headers: r.headers }; };
  const command = (who, org, body) => raw(who, org, '/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) });
  const slots = (org, actor, kind) => { const rows = sql.prepare('SELECT state, count(*) AS n FROM limit_slots WHERE org_id=? AND actor_id=? AND kind=? GROUP BY state').all(org, actor, kind); const n = s => rows.find(r => r.state === s)?.n ?? 0; return { used: n('used'), pending: n('pending') }; };
  const tally = rs => rs.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});

  // 1. ABHA review throttle.
  {
    const o = account('abha-owner'), w = account('asha'), w2 = account('asha2'), w3 = account('asha3');
    for (const a of [o, w, w2, w3]) await get(a);
    const org = (await post(o, { type: 'createOrganisation', name: `Limit race ABHA ${run}` })).result.organisationId;
    await post(o, { type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip: false, hiu: false }, facilityId: 'FAC-SYNTH-14A', approvals: [{ module: 'abha', reference: 'APPROVAL-SYNTH-14A' }], reason: 'Synthetic mock gateway for the 14a race checks' }, 200, crypto.randomUUID(), org);
    for (const who of [w, w2, w3]) { const inv = (await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: 'Limit ASHA', role: 'asha', teamIds: ['default'] }, 200, crypto.randomUUID(), org)).result; await post(who, { type: 'joinOrganisation', token: inv.token }); }
    const person = id => o.state.people.find(p => p.id === id);
    let made = 0; // distinct names and ages, so registration's duplicate check does not hold a new record for review
    const make = async label => { const k = made++; return (await post(o, { type: 'createPerson', name: `Limit ${label} ${run} ${String.fromCharCode(65 + k)}${k}`, age: 18 + k * 4, sex: 'Female', village: `Limit village ${run}`, programme: 'General care', teamId: 'default' }, 200, crypto.randomUUID(), org)).result.personId; };
    const digits = String(parseInt(run, 16)).padStart(12, '0').slice(-12), number = k => `7${k}-${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
    const held = [0, 1, 2, 3, 4, 5].map(number), free = [6, 7, 8].map(number), holders = [];
    for (const n of held) { const h = await make('holder'); await post(o, { type: 'abhaLink', personId: h, version: person(h).version, abhaNumber: n, otp: '123456' }, 200, crypto.randomUUID(), org); holders.push(h); }
    const own = async (who, label) => { const p = await make(label); await post(o, { type: 'assignPatient', personId: p, version: person(p).version, teamId: 'default', assignedTo: who.id, reason: 'Synthetic assignment for the 14a race checks' }, 200, crypto.randomUUID(), org); return p; };
    const mine = await own(w, 'own record'), mine2 = await own(w2, 'own record 2'), mine3 = [];
    for (let i = 0; i < 6; i++) mine3.push(await own(w3, 'own record 3' + i));
    const versionOf = async (who, id) => (await get(who, '/api/workspace', 200, org)).people.find(p => p.id === id).version;
    const link = (who, personId, version, abhaNumber) => command(who, org, { type: 'abhaLink', personId, version, abhaNumber, otp: '123456' });
    const reviews = who => sql.prepare("SELECT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='abhaLinkReview'").all(org, who.id).map(r => r.person_id);
    check(() => assert.equal(person(holders[0]).abha?.state, 'linked', 'the holding records are linked by the owner'));

    // Six parallel links for six numbers held outside the ASHA's scope.
    const v = await versionOf(w, mine), burst = await Promise.all(held.map(n => link(w, mine, v, n)));
    const refusal = burst[0].json?.error;
    check(() => assert.deepEqual(tally(burst), { 422: held.length }, JSON.stringify(burst.map(r => [r.status, r.json?.error?.slice(0, 60)]))));
    check(() => assert.ok(burst.every(r => r.json?.error === refusal) && /could not be linked/.test(refusal), 'every answer is the same ordinary link refusal'));
    check(() => { const e = reviews(w); assert.equal(e.length, ABHA_LIMIT, `exactly ${ABHA_LIMIT} review events under the race, not ${e.length}`); assert.equal(new Set(e).size, ABHA_LIMIT, 'one per holding record'); assert.ok(e.every(id => holders.includes(id))); });
    check(() => assert.deepEqual(slots(org, w.id, 'abhaReview'), { used: ABHA_LIMIT, pending: 0 }, 'three counted reservations, none left pending'));
    const after = await link(w, mine, await versionOf(w, mine), free[0]);
    check(() => { assert.equal(after.status, 422); assert.equal(after.json.error, refusal, 'a number nobody holds is refused the same way once the limit is reached'); assert.equal(reviews(w).length, ABHA_LIMIT, 'a throttled refusal records nothing'); });
    const wState = await get(w, '/api/workspace', 200, org);
    check(() => assert.notEqual(wState.people.find(p => p.id === mine).abha?.state, 'linked', 'nothing was linked'));

    // Four parallel links for ONE held number by another ASHA: one review event (one per requester and holding record a day).
    const v2 = await versionOf(w2, mine2), same = await Promise.all([0, 1, 2, 3].map(() => link(w2, mine2, v2, held[0])));
    check(() => assert.deepEqual(tally(same), { 422: 4 }));
    check(() => assert.deepEqual(reviews(w2), [holders[0]], 'one review event for one holding record under the race'));
    check(() => assert.deepEqual(slots(org, w2.id, 'abhaReview'), { used: 1, pending: 0 }, 'the repeats hold no reservation afterwards'));
    await link(w2, mine2, await versionOf(w2, mine2), held[1]);
    check(() => assert.equal(reviews(w2).length, 2));
    const ok = await link(w2, mine2, await versionOf(w2, mine2), free[1]);
    check(() => assert.equal(ok.status, 200, 'control: with two holding records reviewed, a free number still links: ' + JSON.stringify(ok.json).slice(0, 200)));

    // Mixed burst by a third ASHA, one request per own record: two free numbers and four held numbers. Whatever the interleaving,
    // at most three review events, every held number refused the same way, a free number either linked or refused the same way
    // (a 409 if another commit in the organisation won), and no reservation left behind.
    const v3 = await Promise.all(mine3.map(id => versionOf(w3, id)));
    const mixed = await Promise.all([link(w3, mine3[0], v3[0], free[2]), link(w3, mine3[1], v3[1], number(9)), ...held.slice(2).map((n, i) => link(w3, mine3[i + 2], v3[i + 2], n))]);
    check(() => assert.ok(mixed.slice(2).every(r => r.status === 422 && r.json.error === refusal), JSON.stringify(mixed.map(r => r.status))));
    check(() => assert.ok(mixed.slice(0, 2).every(r => r.status === 200 || (r.status === 422 && r.json.error === refusal) || r.status === 409), JSON.stringify(mixed.slice(0, 2).map(r => [r.status, r.json?.error]))));
    check(() => { const e = reviews(w3); assert.ok(e.length <= ABHA_LIMIT && new Set(e).size === e.length, JSON.stringify(e)); const s = slots(org, w3.id, 'abhaReview'); assert.equal(s.pending, 0); assert.equal(s.used, e.length, 'each counted reservation has its review event'); });
  }

  // 2. Indicator refusal limit: 17 refusals one at a time, then eight at once; exactly three more are answered as refusals.
  {
    const o = account('ind-owner');
    await get(o);
    const org = (await post(o, { type: 'createOrganisation', name: `Limit race indicators ${run}` })).result.organisationId;
    for (let i = 0; i < 9; i++) await post(o, { type: 'createPerson', name: `Limit Ind ${run} ${String.fromCharCode(65 + i)}${i}`, age: 22 + i * 4, sex: 'Female', village: i < 7 ? `Race North ${run}` : `Race South ${run}`, programme: 'General care', teamId: 'default' }, 200, crypto.randomUUID(), org);
    const query = q => raw(o, org, '/api/indicators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
    const south = { ids: 'visits-confirmed', days: '30', group: 'none', village: `Race South ${run}` };
    const refusals = () => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND subject='indicator refusal'").get(org, o.id).n;
    for (let i = 0; i < REFUSAL_LIMIT - 3; i++) { const r = await query(south); if (r.status !== 422) throw new Error(`setup refusal ${i}: ${r.status} ${r.text.slice(0, 200)}`); }
    check(() => assert.equal(refusals(), REFUSAL_LIMIT - 3));
    const burst = await Promise.all(Array.from({ length: 8 }, () => query(south)));
    const t = tally(burst);
    check(() => assert.deepEqual(t, { 422: 3, 429: 5 }, `exactly three refusals answered under the race: ${JSON.stringify(t)}`));
    check(() => { assert.ok(burst.filter(r => r.status === 422).every(r => /cohort has fewer than 5/.test(r.json.error))); assert.ok(burst.filter(r => r.status === 429).every(r => /reached 20 in the last 24 hours/.test(r.json.error))); });
    check(() => assert.equal(refusals(), REFUSAL_LIMIT, `the refusal events stop at ${REFUSAL_LIMIT}`));
    check(() => assert.deepEqual(slots(org, o.id, 'indicatorRefusal'), { used: REFUSAL_LIMIT, pending: 0 }));
    const next = await query({ ids: 'visits-confirmed', days: '30', group: 'none' });
    check(() => { assert.equal(next.status, 429, 'a query that would be released is refused once the limit is reached'); assert.equal(refusals(), REFUSAL_LIMIT); });
    const cat = await raw(o, org, '/api/indicators');
    check(() => assert.equal(cat.status, 200, 'the catalogue stays readable'));
  }

  // 3. A partial differencing withhold, on screen and in a CSV export: 7 Female and 2 Male people; a definition counting
  //    everybody and one counting women, asked together. The second would reveal the 2 men, so it alone is withheld.
  {
    const o = account('part-owner');
    await get(o);
    const org = (await post(o, { type: 'createOrganisation', name: `Limit race partial ${run}` })).result.organisationId;
    for (let i = 0; i < 9; i++) await post(o, { type: 'createPerson', name: `Limit Part ${run} ${String.fromCharCode(65 + i)}${i}`, age: 24 + i * 4, sex: i < 7 ? 'Female' : 'Male', village: `Part village ${run}`, programme: 'General care', teamId: 'default' }, 200, crypto.randomUUID(), org);
    const def = (id, title, filters) => post(o, { type: 'addIndicatorDefinition', id, spec: { title, unit: 'count', numerator: 'patients', denominator: null, filters, exclude: [], exclusionsNote: 'None', owner: 'Programme manager', cadence: 'Monthly', minimumCohort: 5 }, reason: 'Synthetic definitions for the 14a partial withhold check' }, 200, crypto.randomUUID(), org);
    const all = `everyone-${run}`, women = `women-${run}`;
    await def(all, `Everyone ${run}`, {}); await def(women, `Women ${run}`, { sex: 'Female' });
    const query = q => raw(o, org, '/api/indicators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
    const both = { ids: `${all},${women}`, days: '30', group: 'none' };
    const events = () => sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND subject='indicator refusal' ORDER BY at,seq").all(org, o.id).map(r => r.detail);
    const view = await query(both);
    check(() => { assert.equal(view.status, 200, view.text.slice(0, 300)); const [a, b] = view.json.results; assert.equal(a.id, all); assert.ok(!a.refused && a.rows.length === 1 && a.rows[0].value === 9, JSON.stringify(a.rows)); assert.equal(b.id, women); assert.equal(b.refused, 'differencing'); assert.deepEqual(b.rows, []); });
    check(() => { const e = events(); assert.equal(e.length, 1, 'the partial withhold is recorded'); assert.match(e[0], /^Indicator query partly withheld: 1 result withheld because, together with this viewer's queries of the last seven days, it would reveal a group of fewer than 5 people\. Filters set: none\. Authority: /); });
    check(() => assert.deepEqual(slots(org, o.id, 'indicatorRefusal'), { used: 1, pending: 0 }, 'and counted toward the limit'));
    const csv = await query({ ...both, format: 'csv' });
    check(() => { assert.equal(csv.status, 200, csv.text.slice(0, 300)); assert.match(csv.headers.get('content-type'), /^text\/csv/); assert.match(csv.text, /"Withheld","Differencing protection"/); assert.ok(csv.text.includes(`"Indicator","${all}","Version"`), 'the released result is in the file'); });
    check(() => { const e = events(); assert.equal(e.length, 2, 'the CSV export with a partial withhold is recorded'); assert.match(e[1], /^Indicator query partly withheld \(CSV export\): 1 result withheld /); });
    check(() => assert.deepEqual(slots(org, o.id, 'indicatorRefusal'), { used: 2, pending: 0 }, 'and counted'));
    // Counted toward the same limit: 17 cohort refusals bring the viewer to 19; one more partial view is the 20th; then 429.
    for (let i = 0; i < REFUSAL_LIMIT - 3; i++) { const r = await query({ ids: 'visits-confirmed', days: '30', group: 'none', village: `Elsewhere ${run}` }); if (r.status !== 422) throw new Error(`setup refusal ${i}: ${r.status} ${r.text.slice(0, 200)}`); }
    const twentieth = await query(both);
    check(() => { assert.equal(twentieth.status, 200); assert.equal(twentieth.json.results[1].refused, 'differencing'); assert.equal(events().length, REFUSAL_LIMIT); });
    const limited = await query({ ...both, format: 'csv' });
    check(() => { assert.equal(limited.status, 429, 'after 20 refusals, partial withholds included, the CSV export is refused'); assert.match(limited.json.error, /reached 20 in the last 24 hours/); assert.equal(events().length, REFUSAL_LIMIT); });
  }
}
