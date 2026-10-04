import assert from 'node:assert/strict';
// Slice 14e (R73, R91): field notebook sync failure reports, removal of device copies (revocation, care transfer, processing
// restriction) with receipts, the Operations view and exception rows, and consent-withdrawal notices to the demonstration
// programme destinations, through the built Worker and local D1, in its own organisation. Synthetic data only.
export async function fieldDeviceSmoke({ get, post, check, base, sql }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `fd-${run}-${label}`, headers: { 'oai-authenticated-user-id': `fd-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': `Device%20${label}`, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
  const o = account('owner'), w = account('asha'), w2 = account('asha2'), sup = account('supervisor'), adm = account('admin'), doc = account('clinician'), x = account('stranger');
  for (const a of [o, w, w2, sup, adm, doc, x]) await get(a);
  const org = o.state.organisation.id;
  for (const [who, role, teams] of [[w, 'asha', ['default']], [w2, 'asha', ['default']], [sup, 'supervisor', ['default']], [adm, 'admin', []], [doc, 'clinician', ['default']]]) {
    const inv = (await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: `Device ${role}`, role, teamIds: teams }, 200, undefined, org)).result;
    await post(who, { type: 'joinOrganisation', token: inv.token });
  }
  // One request to /api/field-device, counted with its expected status.
  const device = async (who, method, body, status, { key = crypto.randomUUID(), view = null, headers = {} } = {}) => {
    const r = await fetch(base + '/api/field-device' + (view ? `?view=${view}` : ''), { method, headers: { ...who.headers, 'x-saha-organisation': org, ...(body !== undefined ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;try { json = await r.json(); } catch {}
    check(() => assert.equal(r.status, status, JSON.stringify({ method, view, body: body?.kind, expected: status, actual: r.status, json })));
    return json;
  };
  const exceptions = async who => { const r = await fetch(base + '/api/exceptions', { headers: { ...who.headers, 'x-saha-organisation': org } });const j = await r.json();check(() => assert.equal(r.status, 200));return j; };
  const pid = (await post(o, { type: 'createPerson', name: `Device Synthetic ${run}`, age: 31, sex: 'Female', village: 'Device synthetic locality', programme: 'Maternal care', teamId: 'default' }, 200, undefined, org)).result.personId;
  const person = who => who.state.people.find(p => p.id === pid);
  await post(o, { type: 'assignPatient', personId: pid, version: person(o).version, teamId: 'default', assignedTo: w.id, reason: 'Synthetic field assignment' }, 200, undefined, org);
  await get(w, '/api/workspace', 200, org);
  const prepare = async who => (await post(who, { type: 'prepareFieldVisit', personId: pid, version: person(who).version }, 200, undefined, org)).result.packet.payload.leaseId;
  const g1 = await prepare(w);

  // 1. Sync failure reports: counts only, the worker's own grants only, one audit event, replay by key.
  const report = (over = {}, entry = {}) => ({ kind: 'sync-failures', appVersion: 'field-14e', reports: [{ step: 'draft', errorClass: 'conflict', grantId: g1, count: 3, firstAt: new Date(Date.now() - 3600000).toISOString(), lastAt: new Date().toISOString(), ...entry }], ...over });
  const key = crypto.randomUUID();
  let r = await device(w, 'POST', report(), 200, { key });check(() => assert.equal(r.recorded, 1));
  r = await device(w, 'POST', report(), 200, { key });check(() => assert.equal(r.replayed, true));
  await device(w, 'POST', report({}, { grantId: null, step: 'registration', errorClass: 'network', count: 2 }), 200);
  check(() => { const rows = sql.prepare('SELECT * FROM field_sync_reports WHERE org_id=? ORDER BY received_at,id').all(org);assert.equal(rows.length, 2);assert.deepEqual([rows[0].person_id, rows[0].lease_id, rows[0].error_class, rows[0].count], [pid, g1, 'conflict', 3]);assert.equal(rows[1].person_id, null);assert.ok(!JSON.stringify(rows).includes('Device Synthetic'), 'no name stored'); });
  check(() => { const ev = sql.prepare("SELECT * FROM audit_events WHERE org_id=? AND action='fieldSyncReport' ORDER BY at").all(org);assert.equal(ev.length, 2, 'one audit event per report, none for the replay');assert.equal(ev[0].person_id, null);assert.match(ev[0].detail, /no patient details/);assert.ok(ev[0].hash, 'chained'); });
  await device(w2, 'POST', report(), 422);
  for (const who of [sup, adm]) await device(who, 'POST', report({}, { grantId: null }), 403);
  await device(x, 'POST', report({}, { grantId: null }), 403);
  await device(w, 'POST', report({ extra: 1 }), 422);
  await device(w, 'POST', report({}, { errorClass: 'Patient said no' }), 422);
  await device(w, 'POST', report(), 400, { key: 'x' });
  await device(w, 'POST', report(), 403, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  await device(w, 'POST', report(), 415, { headers: { 'Content-Type': 'text/plain' } });
  check(() => assert.equal(sql.prepare('SELECT count(*) AS n FROM field_sync_reports WHERE org_id=?').get(org).n, 2, 'nothing stored on refusal'));
  // The open grant with a report is an exception row for the team's supervisor.
  let ex = await exceptions(sup);
  check(() => { const row = ex.items.find(i => i.id === 'field-sync-failure:' + g1);assert.ok(row);assert.equal(row.patient.id, pid);assert.match(row.recovery, /compares the draft/);assert.equal(ex.rulesVersion, '1.4.0'); });

  // 2. Revocation orders removal; the notebook removes the copy and confirms with a receipt.
  let orders = await device(w, 'GET', undefined, 200);check(() => assert.deepEqual(orders.removals, []));
  await post(w, { type: 'revokeFieldLease', personId: pid, leaseId: g1 }, 200, undefined, org);
  orders = await device(w, 'GET', undefined, 200);
  check(() => { assert.equal(orders.removals.length, 1);const o1 = orders.removals[0];assert.deepEqual([o1.personId, o1.scope, o1.reason, o1.leaseIds, o1.confirmed], [pid, 'grant', 'grant-revoked', [g1], false]);assert.ok(!JSON.stringify(orders).includes('Device Synthetic')); });
  r = await device(w2, 'GET', undefined, 200);check(() => assert.deepEqual(r.removals, [], 'another worker\'s notebook gets no order'));
  await device(w, 'GET', undefined, 422, { view: 'other' });
  await device(w, 'GET', undefined, 403, { view: 'operations' });
  let view = await device(sup, 'GET', undefined, 200, { view: 'operations' });
  check(() => { const row = view.removals.items.find(i => i.id === g1);assert.equal(row.state, 'pending');assert.equal(row.patient.name, `Device Synthetic ${run}`);assert.equal(view.syncFailures.total, 2); });
  view = await device(adm, 'GET', undefined, 200, { view: 'operations' });
  check(() => { assert.ok(view.removals.items.every(i => i.patient === null), 'administrators see no patient');assert.ok(!JSON.stringify(view).includes('Device Synthetic')); });
  check(() => assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='viewAggregate' AND subject='field device operations'").get(org).n >= 2, 'the Operations view is a recorded read'));
  ex = await exceptions(sup);check(() => assert.ok(ex.items.some(i => i.id === 'field-copy-removal:' + g1)));
  const receipt = (over = {}) => ({ kind: 'removal-receipt', appVersion: 'field-14e', receiptId: crypto.randomUUID(), personId: pid, leaseIds: [g1], registration: false, removed: { drafts: 1, unsynced: 1, media: 1, registrations: 0 }, ...over });
  const rk = crypto.randomUUID(), rb = receipt();
  await device(w2, 'POST', rb, 409);
  await device(w, 'POST', receipt({ leaseIds: [crypto.randomUUID()] }), 409);
  await device(w, 'POST', receipt({ removed: { drafts: 0, unsynced: 1, media: 0, registrations: 0 } }), 422);
  r = await device(w, 'POST', rb, 200, { key: rk });check(() => { assert.deepEqual(r.confirmed, [g1]);assert.equal(r.firstConfirmation, true); });
  r = await device(w, 'POST', rb, 200, { key: rk });check(() => assert.equal(r.replayed, true));
  await device(w, 'POST', receipt(), 409, { key: rk });
  check(() => { const data = JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org, pid).data);const l = data.fieldLeases.find(x => x.id === g1);assert.equal(l.removal.reason, 'grant-revoked');assert.ok(l.removal.confirmedAt);assert.deepEqual([l.removal.receipt.drafts, l.removal.receipt.unsynced, l.removal.receipt.media], [1, 1, 1]);assert.equal(l.removal.receipts, 1); });
  check(() => { const ev = sql.prepare("SELECT * FROM audit_events WHERE org_id=? AND action='confirmFieldRemoval'").all(org);assert.equal(ev.length, 1);assert.equal(ev[0].person_id, pid);assert.match(ev[0].detail, /cannot be recovered/); });
  view = await device(sup, 'GET', undefined, 200, { view: 'operations' });check(() => assert.equal(view.removals.items.find(i => i.id === g1).state, 'confirmed'));
  ex = await exceptions(sup);check(() => assert.ok(!ex.items.some(i => i.id === 'field-copy-removal:' + g1), 'a confirmed removal leaves the queue'));

  // 3. Care transferred: the worker's copies are due (person-wide) without any stored order; the worker confirms though
  // they no longer have access to the record.
  await get(w, '/api/workspace', 200, org);const g2 = await prepare(w);
  await get(o, '/api/workspace', 200, org);
  await post(o, { type: 'assignPatient', personId: pid, version: person(o).version, teamId: 'default', assignedTo: w2.id, reason: 'Synthetic care handover' }, 200, undefined, org);
  orders = await device(w, 'GET', undefined, 200);
  check(() => { const o2 = orders.removals.find(x => x.personId === pid);assert.deepEqual([o2.scope, o2.reason, o2.confirmed], ['person', 'access-ended', false]);assert.ok(o2.leaseIds.includes(g2) && o2.leaseIds.includes(g1)); });
  await post(w, { type: 'syncFieldVisit', personId: pid, leaseId: g2, packageHash: '0'.repeat(64), facts: { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '', diastolic: '', weight: '60', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured' }, answers: {}, absence: {} }, 403, undefined, org);
  r = await device(w, 'POST', receipt({ leaseIds: orders.removals.find(x => x.personId === pid).leaseIds, removed: { drafts: 1, unsynced: 0, media: 0, registrations: 0 } }), 200);
  check(() => assert.equal(r.firstConfirmation, true));
  check(() => { const data = JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org, pid).data);assert.equal(data.fieldLeases.find(x => x.id === g2).removal.reason, 'access-ended'); });

  // 4. Processing restricted: no new grant; an open grant may still sync, then its copy is due.
  await get(w2, '/api/workspace', 200, org);
  const g3 = await prepare(w2);
  const rq = (await post(w2, { type: 'rightsCreate', personId: pid, kind: 'restriction', channel: 'written', requester: 'self', identityCheck: 'SYNTH-ID-1', detail: 'Patient asked to restrict processing of the record' }, 200, undefined, org)).result.requestId;
  const version = sql.prepare('SELECT version FROM rights_requests WHERE org_id=? AND id=?').get(org, rq).version;
  await post(w2, { type: 'rightsClose', requestId: rq, version, outcome: 'fulfilled', response: 'Processing restricted as the patient asked', evidence: 'SYNTH-EV-1' }, 200, undefined, org);
  await post(w2, { type: 'prepareFieldVisit', personId: pid, version: person(w2).version }, 409, undefined, org);
  orders = await device(w2, 'GET', undefined, 200);check(() => assert.deepEqual(orders.removals, [], 'an open current grant is not due under a restriction'));
  await post(w2, { type: 'revokeFieldLease', personId: pid, leaseId: g3 }, 200, undefined, org);
  orders = await device(w2, 'GET', undefined, 200);check(() => assert.equal(orders.removals[0].reason, 'grant-revoked'));

  // 5. Consent-withdrawal notices to the demonstration programme destinations.
  const nid = (await post(o, { type: 'createPerson', name: `Notice Synthetic ${run}`, age: 27, sex: 'Female', village: 'Notice synthetic locality', programme: 'Maternal care', teamId: 'default' }, 200, undefined, org)).result.personId;
  const np = who => who.state.people.find(p => p.id === nid), visitOf = (who, id) => who.state.visits.find(v => v.id === id);
  await post(o, { type: 'setConsent', personId: nid, purpose: 'exchange', active: true, version: np(o).version }, 200, undefined, org);
  const vid = (await post(o, { type: 'startVisit', personId: nid }, 200, undefined, org)).result.visitId;
  await post(o, { type: 'saveVisit', visitId: vid, version: visitOf(o, vid).version, facts: { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '', diastolic: '', weight: '55', temperature: '', weeks: '22', coughDays: '', notes: 'Synthetic notice visit', source: 'measured' } }, 200, undefined, org);
  await post(o, { type: 'confirmVisit', visitId: vid, version: visitOf(o, vid).version }, 200, undefined, org);
  await post(o, { type: 'preparePlan', visitId: vid, recipients: ['mis_maternal', 'mis_community'] }, 200, undefined, org);
  const plan = visitOf(o, vid).plan;
  await post(o, { type: 'approvePlan', visitId: vid, planId: plan.id, payloadHash: plan.payloadHash }, 200, undefined, org);
  await post(o, { type: 'executePlan', visitId: vid, planId: plan.id }, 200, undefined, org);
  await post(o, { type: 'withdrawConsent', personId: nid, version: np(o).version, purpose: 'exchange', channel: 'written', reference: 'FORM-N1', reason: 'Patient withdrew permission to share records' }, 200, undefined, org);
  const notice = id => (np(o).withdrawalNotices ?? []).find(n => n.destination.id === id);
  check(() => { assert.deepEqual(['mis_maternal', 'mis_community'].map(id => [notice(id)?.path, notice(id)?.state]), [['simulator', 'due'], ['simulator', 'due']]);assert.ok(!JSON.stringify(np(o).withdrawalNotices).includes('Notice Synthetic')); });
  const send = (n, over = {}) => ({ type: 'sendWithdrawalNotice', personId: nid, noticeId: n.id, version: n.version, ...over });
  const maternal = notice('mis_maternal'), community = notice('mis_community');
  await get(sup, '/api/workspace', 200, org);await post(sup, send(maternal), 403, undefined, org);
  await post(adm, send(maternal), 403, undefined, org);
  await post(x, send(maternal), 403, undefined, org);
  await get(w, '/api/workspace', 200, org);await post(w, send(maternal), 403, undefined, org);
  await post(o, send(maternal, { version: maternal.version + 1 }), 409, undefined, org);
  const sk = crypto.randomUUID();
  r = await post(o, send(maternal), 200, sk, org);check(() => { assert.equal(r.result.state, 'acknowledged');assert.match(r.result.receipt, /^SIM-N-/);assert.equal(notice('mis_maternal').state, 'acknowledged'); });
  const replay = await post(o, send(maternal), 200, sk, org);check(() => { assert.equal(replay.replayed, true);assert.equal(replay.result.receipt, r.result.receipt); });
  await post(o, send(notice('mis_maternal')), 409, undefined, org);
  r = await post(o, send(community), 200, undefined, org);check(() => assert.equal(r.result.state, 'uncertain'));
  await post(o, send(notice('mis_community')), 409, undefined, org);
  ex = await exceptions(sup);check(() => { const row = ex.items.find(i => i.id === 'withdrawal-notice:' + community.id);assert.ok(row);assert.equal(row.severity, 'high');assert.match(row.recovery, /never sent again/); });
  await post(o, { type: 'recordWithdrawalNotice', personId: nid, noticeId: community.id, version: notice('mis_community').version, outcome: 'not-required', reference: 'REF-N', note: 'Attempting to close an unknown outcome' }, 409, undefined, org);
  r = await post(o, { type: 'lookupWithdrawalNotice', personId: nid, noticeId: community.id, version: notice('mis_community').version }, 200, undefined, org);
  check(() => { assert.equal(r.result.state, 'acknowledged');const n = notice('mis_community');assert.equal(n.attempts, 1, 'sent once');assert.equal(n.lookups, 1); });
  ex = await exceptions(sup);check(() => assert.ok(!ex.items.some(i => i.kind === 'withdrawal-notice' && i.id.endsWith(community.id))));
  check(() => { const ev = sql.prepare("SELECT action FROM audit_events WHERE org_id=? AND person_id=? AND action LIKE '%WithdrawalNotice' ORDER BY at").all(org, nid).map(e => e.action);assert.deepEqual(ev, ['sendWithdrawalNotice', 'sendWithdrawalNotice', 'lookupWithdrawalNotice']); });
}
