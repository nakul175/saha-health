import assert from 'node:assert/strict';
// Slice 13a: access scope everywhere, through the built Worker and local D1, in its own organisation so the shared test
// organisation is never narrowed.
// 1. API requests another website started are refused before the application runs (reads included); same-origin requests and
//    the server-to-server endpoints are unaffected.
// 2. Facility scope (slice R08) narrows the viewer-scoped workspace read, the patient list (SQL pre-filter) and commands.
// 3. A programme grant (slice R09) narrows the same reads and commands; an emergency-access grant is not narrowed.
// 4. A purpose grant (slice R09) stops commands and routes of other purposes at their checkpoint, and nothing else.
export async function accessScopeSmoke({ get, post, check, base }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `scope-${run}-${label}`, headers: { 'oai-authenticated-user-id': `scope-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': `Scope%20${label}`, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
  const o = account('owner'), c = account('clinician'), s = account('supervisor'), c2 = account('clinician2');
  for (const a of [o, c, s, c2]) await get(a);
  const org = o.state.organisation.id;
  for (const [who, role] of [[c, 'clinician'], [s, 'supervisor'], [c2, 'clinician']]) {
    const inv = (await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: `Scope ${role}`, role, teamIds: ['default'] }, 200, undefined, org)).result;
    await post(who, { type: 'joinOrganisation', token: inv.token });
  }
  const raw = async (who, path, init = {}) => { const r = await fetch(base + path, { ...init, headers: { ...(who?.headers ?? {}), 'x-saha-organisation': org, ...(init.headers ?? {}) } }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: r.status, json, headers: r.headers }; };
  const ids = who => who.state.people.map(p => p.id).sort();
  const all = ['p_aarav', 'p_farida', 'p_kamla', 'p_meena', 'p_rajesh', 'p_sunita'];
  await get(c, '/api/workspace', 200, org);
  check(() => assert.deepEqual(ids(c), all, 'before any policy the clinician sees the whole default team'));

  // 1. Requests another website started.
  for (const [what, headers] of [['Sec-Fetch-Site cross-site', { 'Sec-Fetch-Site': 'cross-site' }], ['Sec-Fetch-Site same-site', { 'Sec-Fetch-Site': 'same-site' }], ['a foreign Origin', { Origin: 'https://evil.example' }], ['an opaque Origin', { Origin: 'null' }]]) {
    const r = await raw(c, '/api/workspace', { headers });
    check(() => { assert.equal(r.status, 403, what); assert.match(r.json.error, /another website/, what); assert.equal(r.headers.get('access-control-allow-origin'), null); assert.equal(r.headers.get('access-control-allow-credentials'), null); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(JSON.stringify(r.json), /Meena|p_meena/); });
  }
  const cmd = await raw(c, '/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'Sec-Fetch-Site': 'cross-site' }, body: JSON.stringify({ type: 'startVisit', personId: 'p_meena' }) });
  check(() => { assert.equal(cmd.status, 403); assert.match(cmd.json.error, /another website/); });
  for (const headers of [{ 'Sec-Fetch-Site': 'same-origin' }, { 'Sec-Fetch-Site': 'none' }, { Origin: base }, {}]) {
    const r = await raw(c, '/api/workspace', { headers });
    check(() => assert.equal(r.status, 200, JSON.stringify(headers)));
  }
  const callback = await raw(null, '/api/mis/callback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
  check(() => { assert.ok(callback.status >= 400); assert.doesNotMatch(JSON.stringify(callback.json ?? {}), /another website/, 'the signed MIS callback keeps its own checks'); });
  // fetch() always sends its own Sec-Fetch-Mode (cors), so a browser navigation is sent with node:http.
  const { request: httpRequest } = await import('node:http');
  const navigate = path => new Promise((resolve, reject) => { const q = httpRequest(base + path, { headers: { ...c.headers, 'x-saha-organisation': org, 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); q.on('error', reject); q.end(); });
  const page = await navigate('/');
  check(() => assert.notEqual(page, 403, 'following a link to the workspace from another site still works'));
  const apiNav = await navigate('/%61pi/workspace');
  check(() => assert.equal(apiNav, 403, 'a navigation to an encoded API path is refused'));
  // Slice 13f (review finding 1): an encoded API path is refused too; the router would have decoded it to /api/workspace.
  for (const path of ['/%61pi/workspace', '/ap%69/workspace', '/x/../api/workspace']) {
    const r = await raw(c, path, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    check(() => { assert.equal(r.status, 403, path); assert.doesNotMatch(JSON.stringify(r.json ?? {}), /p_meena|Meena/, path); });
  }
  const encodedSame = await raw(c, '/%61pi/workspace', { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  check(() => assert.notEqual(encodedSame.status, 403, 'the same encoded path from Saha itself is not refused by this gate'));

  // 2. Facility scope: Meena is at the team's facility, Rajesh at another, the rest have none.
  let v = 0;
  const scopeCmd = async body => { const r = await post(o, { ...body, version: v }, 200, undefined, org); v = r.result.version; return r; };
  await scopeCmd({ type: 'addFacility', name: 'Rampur sub-centre', localityId: null });
  await scopeCmd({ type: 'addFacility', name: 'Kheda sub-centre', localityId: null });
  const fs = (await raw(o, '/api/facility-scope')).json, f1 = fs.facilities.find(f => f.name === 'Rampur sub-centre').id, f2 = fs.facilities.find(f => f.name === 'Kheda sub-centre').id;
  await scopeCmd({ type: 'setTeamLocation', teamId: 'default', facilityId: f1, localityId: null });
  await get(o, '/api/workspace', 200, org);
  for (const [pid, fid] of [['p_meena', f1], ['p_rajesh', f2]]) { const p = o.state.people.find(x => x.id === pid); await post(o, { type: 'assignPatient', personId: pid, version: p.version, teamId: 'default', assignedTo: null, facilityId: fid, reason: 'Synthetic facility for the scope check' }, 200, undefined, org); }
  await scopeCmd({ type: 'setAccessScope', enforceFacility: true, enforceLocality: false });
  await get(c, '/api/workspace', 200, org);
  check(() => assert.deepEqual(ids(c), ['p_meena'], 'facility scope narrows the viewer-scoped workspace read (SQL pre-filter)'));
  const list = await raw(c, '/api/patients');
  check(() => { assert.equal(list.status, 200); assert.deepEqual(list.json.rows.map(r => r.id), ['p_meena'], 'and the patient list'); assert.equal(list.json.total, 1); });
  await post(c, { type: 'startVisit', personId: 'p_rajesh' }, 403, undefined, org);
  await post(c, { type: 'startVisit', personId: 'p_farida' }, 403, undefined, org);
  const detail = await raw(c, '/api/patients/detail?personId=p_rajesh');
  check(() => assert.notEqual(detail.status, 200, 'patient detail outside the facility is refused'));
  // Slice 13f (review finding 6): a patient cannot be assigned to a worker whose facility does not cover them.
  // (Meena is the one patient the owner sees here; moving her to the other facility while assigning her to a worker at this
  // facility would leave her assigned to someone who cannot see her.)
  { await get(o, '/api/workspace', 200, org); const p = o.state.people.find(x => x.id === 'p_meena'); const r = await post(o, { type: 'assignPatient', personId: 'p_meena', version: p.version, teamId: 'default', assignedTo: c.id, facilityId: f2, reason: 'Synthetic out-of-facility assignment' }, 422, undefined, org); check(() => assert.match(r.error, /facility, locality or programme assignment/)); }
  await scopeCmd({ type: 'setAccessScope', enforceFacility: false, enforceLocality: false });
  await get(c, '/api/workspace', 200, org);
  check(() => assert.deepEqual(ids(c), all, 'turning enforcement off restores the team scope'));

  // 3. A programme grant narrows the clinician to TB screening (Sunita only).
  await post(o, { type: 'setAccessPurpose', memberId: c.id, version: 0, programme: 'TB screening', purposes: [], reason: 'Synthetic TB-only access for the scope check' }, 200, undefined, org);
  await get(c, '/api/workspace', 200, org);
  check(() => assert.deepEqual(ids(c), ['p_sunita'], 'the programme grant narrows the workspace read'));
  const tb = await raw(c, '/api/patients');
  check(() => assert.deepEqual(tb.json.rows.map(r => r.id), ['p_sunita'], 'and the patient list'));
  await post(c, { type: 'startVisit', personId: 'p_meena' }, 403, undefined, org);
  const started = await post(c, { type: 'startVisit', personId: 'p_sunita' }, 200, undefined, org);
  check(() => assert.ok(started.result.visitId, 'in-programme work is unaffected'));

  // 4. A purpose grant: the supervisor may only start AI-assistance flows.
  await post(o, { type: 'setAccessPurpose', memberId: s.id, version: 0, programme: null, purposes: ['ai-assistance'], reason: 'Synthetic purpose limit for the scope check' }, 200, undefined, org);
  await get(s, '/api/workspace', 200, org);
  check(() => assert.deepEqual(ids(s), all, 'a purpose-only grant leaves record scope unchanged'));
  const refused = await post(s, { type: 'preparePlan', visitId: 'v_missing', recipients: ['mis_community'] }, 403, undefined, org);
  check(() => assert.match(refused.error, /programme delivery \(mis\) is not one of them/));
  const indicators = await raw(s, '/api/indicators?indicator=visits');
  check(() => { assert.equal(indicators.status, 403, 'computing indicator figures is a reporting flow'); assert.match(indicators.json.error, /reporting/i); });
  const ownerIndicators = await raw(o, '/api/indicators?indicator=visits');
  check(() => assert.doesNotMatch(ownerIndicators.json?.error ?? '', /limits your access/, 'a member without a grant is unaffected'));
}
