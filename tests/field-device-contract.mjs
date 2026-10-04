// Slice 14e contract (R73, R91; BR-REP-01, BR-SEC-03, BR-OFF-07): device copies due for removal, removal orders and receipts,
// field notebook sync failure reports, the Operations view and exception rows, device copies listed by consent withdrawals,
// and consent-withdrawal notices to destinations (send, lookup, record by hand). Runs the real modules, every lib/saha module
// transpiled, against an in-memory organisation state. Synthetic data only.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.field-device-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, pattern) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
const statusAsync = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); passed++; return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const [F, D, C, N, E, A, P] = await Promise.all(['field', 'field-device', 'consent', 'withdrawal-notices', 'exceptions', 'access', 'partition'].map(imp));

  const now = new Date().toISOString(), at = d => new Date(Date.parse(now) + d * 86400000).toISOString(), earlier = at(-2);
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: earlier, ...over });
  const base = { age: 30, sex: 'Other', village: 'Synthetic village', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: earlier, version: 1, teamId: 't1', assignedTo: 'asha' };
  const lease = (id, actorId, over = {}) => ({ id, actorId, memberVersion: 1, visitId: 'v-' + id, visitVersion: 1, identityHash: 'h', consentVersion: 1, expiresAt: at(1), status: 'active', packageHash: 'p', createdAt: earlier, ...over });
  const L = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const newState = () => ({
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: earlier }, teams: [{ id: 't1', name: 'One', createdAt: earlier }, { id: 't2', name: 'Two', createdAt: earlier }], invitations: [],
    members: [member('asha', 'asha', ['t1']), member('asha2', 'asha', ['t1']), member('doc', 'clinician', ['t1']), member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t2']), member('doc2', 'clinician', ['t2']), member('own', 'clinician', ['t2'], { isOwner: true }), member('adm', 'admin', [], { isOwner: false })],
    workspace: { schemaVersion: 1, revision: 1, role: 'asha', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [],
      people: [{ ...base, id: 'P', name: 'Patient Pesh', fieldLeases: [] }, { ...base, id: 'Q', name: 'Patient Quill', fieldLeases: [] }, { ...base, id: 'R', name: 'Patient Rowan', teamId: 't2', assignedTo: null, fieldLeases: [] }] },
  });
  const actor = id => ({ userId: id, displayName: id.toUpperCase(), email: 'x@example.invalid' });
  const as = (s, id) => { const m = s.members.find(x => x.userId === id); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = A.allowed(m, p); return m; };
  const person = (s, id) => s.workspace.people.find(p => p.id === id);

  // 1. When a device copy is due for removal (field.ts).
  {
    const s = newState(), p = person(s, 'P');
    p.fieldLeases.push(lease(L(1), 'asha'), lease(L(2), 'asha', { status: 'synced' }), lease(L(3), 'doc'));
    check(() => assert.deepEqual(p.fieldLeases.map(l => F.removalDue(s, p, l, now)), [null, null, null], 'current grants of workers with access are not due'));
    p.assignedTo = 'asha2';
    check(() => assert.deepEqual(p.fieldLeases.map(l => F.removalDue(s, p, l, now)), ['access-ended', 'access-ended', null], 'care transferred: the ASHA\'s copies are due; the clinician keeps team access'));
    p.assignedTo = 'asha';s.members.find(m => m.userId === 'doc').status = 'suspended';
    check(() => assert.equal(F.removalDue(s, p, p.fieldLeases[2], now), 'access-ended', 'a suspended member\'s copy is due'));
    s.members.find(m => m.userId === 'doc').status = 'active';
    p.restrictions = [{ requestId: 'rq', from: earlier, by: 'sup' }];
    check(() => assert.deepEqual(p.fieldLeases.map(l => F.removalDue(s, p, l, now)), [null, 'processing-restricted', null], 'restricted: an open current grant may still sync; a synced copy is due'));
    p.fieldLeases[0].expiresAt = at(-0.5);
    check(() => assert.equal(F.removalDue(s, p, p.fieldLeases[0], now), 'processing-restricted', 'restricted: an expired open grant is due'));
    p.restrictions[0].liftedAt = now;p.fieldLeases[0].expiresAt = at(1);
    check(() => assert.equal(F.removalDue(s, p, p.fieldLeases[1], now), null, 'a lifted restriction no longer orders removal'));
    p.mergedInto = { personId: 'Q', caseId: 'c', at: earlier };
    check(() => assert.ok(p.fieldLeases.every(l => F.removalDue(s, p, l, now) === 'record-merged'), 'a merged record\'s copies are due'));
    p.mergedInto.unmergedAt = now;
    check(() => assert.equal(F.removalDue(s, p, p.fieldLeases[0], now), null, 'an unmerged record is not'));
    p.fieldLeases[0].removal = { reason: 'grant-revoked', orderedAt: now, orderedBy: 'own' };
    check(() => { assert.equal(F.removalDue(s, p, p.fieldLeases[0], now), 'grant-revoked');assert.equal(F.pendingRemoval(s, p, p.fieldLeases[0], now), true);p.fieldLeases[0].removal.confirmedAt = now;assert.equal(F.pendingRemoval(s, p, p.fieldLeases[0], now), false, 'confirmed is no longer pending'); });
  }

  // 2. Revoking orders removal; preparing is refused while restricted; expired grants awaiting removal are kept (field.ts).
  {
    const s = newState(), p = person(s, 'P'), m = as(s, 'asha');
    const prepare = () => F.applyField(s, { type: 'prepareFieldVisit', personId: 'P', version: p.version }, actor('asha'), m, now);
    const g1 = (await prepare()).packet.payload.leaseId;
    await F.applyField(s, { type: 'revokeFieldLease', personId: 'P', leaseId: g1 }, actor('asha'), m, now);
    const l1 = p.fieldLeases.find(l => l.id === g1);
    check(() => { assert.equal(l1.status, 'revoked');assert.deepEqual(l1.removal, { reason: 'grant-revoked', orderedAt: now, orderedBy: 'asha' });assert.match(s.workspace.audit.at(-1).detail, /removes this grant's copy .* never reconnects keeps its encrypted copy/); });
    await statusAsync(() => F.applyField(s, { type: 'revokeFieldLease', personId: 'P', leaseId: g1 }, actor('asha'), m, now), 409, /already ordered/);
    const g2 = (await prepare()).packet.payload.leaseId, l2 = p.fieldLeases.find(l => l.id === g2);l2.status = 'synced';
    await F.applyField(s, { type: 'revokeFieldLease', personId: 'P', leaseId: g2 }, actor('asha'), m, now);
    check(() => { assert.equal(l2.status, 'synced', 'a synced grant keeps its state');assert.equal(l2.removal.reason, 'grant-revoked');assert.match(s.workspace.audit.at(-1).detail, /already synced/); });
    const other = as(s, 'asha2');await statusAsync(() => F.applyField(s, { type: 'revokeFieldLease', personId: 'P', leaseId: g2 }, actor('asha2'), other, now), 403);
    as(s, 'asha');l2.removal.confirmedAt = now;await statusAsync(() => F.applyField(s, { type: 'revokeFieldLease', personId: 'P', leaseId: g2 }, actor('asha'), m, now), 409, /already confirmed/);
    p.restrictions = [{ requestId: 'rq', from: earlier, by: 'sup' }];
    await statusAsync(() => prepare(), 409, /restricted .* no offline copy/);
    p.restrictions[0].liftedAt = now;
    // Expired grants: one awaiting removal (kept), one confirmed (dropped), one plain expired (dropped).
    p.fieldLeases.push(lease(L(11), 'asha', { expiresAt: at(-3), status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: at(-3), orderedBy: 'asha' } }), lease(L(12), 'asha', { expiresAt: at(-3), status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: at(-3), orderedBy: 'asha', confirmedAt: at(-2) } }), lease(L(13), 'asha', { expiresAt: at(-3) }));
    await prepare();
    check(() => { const ids = p.fieldLeases.map(l => l.id);assert.ok(ids.includes(L(11)), 'pending removal kept after expiry');assert.ok(!ids.includes(L(12)), 'confirmed removal pruned');assert.ok(!ids.includes(L(13)), 'plain expired grant pruned'); });
    for (let i = 0; i < F.HELD_REMOVALS + 5; i++) p.fieldLeases.push(lease(L(100 + i), 'asha', { expiresAt: at(-3), status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: at(-3), orderedBy: 'asha' } }));
    await prepare();
    check(() => assert.equal(p.fieldLeases.filter(l => l.expiresAt <= now).length, F.HELD_REMOVALS, 'held removals are bounded'));
  }

  // 3. Removal orders for one worker's notebooks (field-device.ts).
  {
    const s = newState(), p = person(s, 'P'), q = person(s, 'Q');
    p.fieldLeases.push(lease(L(1), 'asha'), lease(L(2), 'asha', { status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: now, orderedBy: 'asha' } }), lease(L(3), 'doc'));
    q.fieldLeases.push(lease(L(4), 'asha'));q.fieldRegistration = { id: 'reg-q', by: 'asha', capturedAt: earlier, syncedAt: earlier };
    check(() => assert.deepEqual(D.removalOrders(s, 'asha', now).map(o => [o.personId, o.scope, o.reason, o.leaseIds, o.registration, o.confirmed]), [['P', 'grant', 'grant-revoked', [L(2)], false, false]], 'only the revoked grant'));
    check(() => assert.deepEqual(D.removalOrders(s, 'doc', now), [], 'another worker gets none'));
    q.assignedTo = 'asha2';
    check(() => { const o = D.removalOrders(s, 'asha', now).find(x => x.personId === 'Q');assert.deepEqual([o.scope, o.reason, o.leaseIds, o.registration], ['person', 'access-ended', [L(4)], true], 'access ended: every copy of the patient, with the registration copy'); });
    check(() => assert.ok(!JSON.stringify(D.removalOrders(s, 'asha', now)).includes('Patient'), 'no names in orders'));
    q.assignedTo = 'asha';q.restrictions = [{ requestId: 'rq', from: earlier, by: 'sup' }];
    check(() => { const o = D.removalOrders(s, 'asha', now).find(x => x.personId === 'Q');assert.deepEqual([o.scope, o.reason, o.leaseIds, o.registration], ['grant', 'processing-restricted', [], true], 'restricted: the open grant may still sync; the registration copy is due'); });

    // 4. Receipts.
    const m = as(s, 'asha'), receipt = (over = {}) => ({ kind: 'removal-receipt', appVersion: 'field-14e', receiptId: '11111111-1111-4111-8111-111111111111', personId: 'P', leaseIds: [L(2)], registration: false, removed: { drafts: 1, unsynced: 1, media: 2, registrations: 0 }, ...over });
    check(() => assert.equal(D.removalReceiptSchema.safeParse(receipt({ extra: 1 })).success, false));
    check(() => assert.equal(D.removalReceiptSchema.safeParse(receipt({ removed: { drafts: 0, unsynced: 1, media: 0, registrations: 0 } })).success, false, 'unsynced counted among drafts'));
    check(() => assert.equal(D.removalReceiptSchema.safeParse(receipt({ leaseIds: ['not-a-uuid'] })).success, false));
    check(() => status(() => D.applyRemovalReceipt(s, actor('asha'), m, receipt({ personId: 'missing' }), now), 409, /no removal order/));
    check(() => status(() => D.applyRemovalReceipt(s, actor('asha'), m, receipt({ leaseIds: [L(1)] }), now), 409, /no removal order/));
    check(() => status(() => D.applyRemovalReceipt(s, actor('asha'), m, receipt({ registration: true }), now), 409));
    check(() => status(() => D.applyRemovalReceipt(s, actor('asha2'), as(s, 'asha2'), receipt(), now), 409, /no removal order/));
    check(() => status(() => D.applyRemovalReceipt(s, actor('asha'), as(s, 'asha'), receipt({ leaseIds: [] }), now), 422));
    check(() => assert.equal(p.fieldLeases[1].removal.confirmedAt, undefined, 'nothing recorded on refusal'));
    const r1 = D.applyRemovalReceipt(s, actor('asha'), as(s, 'asha'), receipt(), now);
    check(() => { const l = p.fieldLeases[1];assert.equal(l.removal.confirmedAt, now);assert.deepEqual(l.removal.receipt, { id: receipt().receiptId, at: now, drafts: 1, unsynced: 1, media: 2, registrations: 0, appVersion: 'field-14e' });assert.equal(l.removal.receipts, 1);assert.equal(r1.firstConfirmation, true); });
    check(() => { const a = s.workspace.audit.at(-1);assert.equal(a.action, 'confirmFieldRemoval');assert.equal(a.personId, 'P');assert.match(a.detail, /1 draft \(1 not synced\), 2 photo or voice notes/);assert.match(a.detail, /discarded on the device and cannot be recovered/);assert.ok(!a.detail.includes('Pesh')); });
    check(() => assert.equal(D.removalOrders(s, 'asha', now).find(o => o.personId === 'P').confirmed, true, 'the order shows confirmed and stays in force'));
    const later = at(0.01), r2 = D.applyRemovalReceipt(s, actor('asha'), as(s, 'asha'), receipt({ receiptId: '22222222-2222-4222-8222-222222222222', removed: { drafts: 0, unsynced: 0, media: 0, registrations: 0 } }), later);
    check(() => { const l = p.fieldLeases[1];assert.equal(l.removal.confirmedAt, now, 'first confirmation kept');assert.equal(l.removal.receipts, 2);assert.equal(l.removal.lastReceiptAt, later);assert.equal(r2.firstConfirmation, false); });
    q.assignedTo = 'asha2';delete q.restrictions;
    D.applyRemovalReceipt(s, actor('asha'), as(s, 'asha'), receipt({ personId: 'Q', leaseIds: [L(4)], registration: true, removed: { drafts: 1, unsynced: 0, media: 0, registrations: 1 } }), now);
    check(() => { assert.equal(q.fieldLeases[0].removal.reason, 'access-ended');assert.equal(q.fieldLeases[0].status, 'revoked', 'an open grant whose copy is gone can no longer sync');assert.deepEqual(q.fieldRegistration.deviceRemoval, { at: now, receiptId: receipt().receiptId, reason: 'access-ended' }); });
  }

  // 5. Sync failure reports.
  {
    const s = newState(), p = person(s, 'P');p.fieldLeases.push(lease(L(1), 'asha'), lease(L(2), 'doc'));
    const report = (over = {}, entry = {}) => ({ kind: 'sync-failures', appVersion: 'field-14e', reports: [{ step: 'draft', errorClass: 'conflict', grantId: L(1), count: 3, firstAt: at(-1), lastAt: now, ...entry }], ...over });
    for (const [bad, why] of [[report({ extra: 1 }), 'extra field'], [report({}, { note: 'free text' }), 'free text'], [report({}, { errorClass: 'oops' }), 'unknown class'], [report({}, { step: 'upload' }), 'unknown step'], [report({}, { count: 0 }), 'zero count'], [report({}, { count: 10001 }), 'count bound'], [report({}, { grantId: 'lease-1' }), 'grant id is a uuid'], [report({ reports: [] }), 'empty'], [report({ reports: Array(21).fill(report().reports[0]) }), 'entries bound'], [report({ appVersion: 'Field 14e!' }), 'version format']])
      check(() => assert.equal(D.syncReportSchema.safeParse(bad).success, false, why));
    check(() => assert.equal(D.syncReportSchema.safeParse(report({}, { grantId: null, step: 'registration', errorClass: 'network' })).success, true));
    check(() => status(() => D.syncReportRows(s, 'asha', report({}, { grantId: L(2) }), 'k', 'a', now), 422, /not one of your field grants/));
    check(() => status(() => D.syncReportRows(s, 'asha', report({}, { grantId: L(9) }), 'k', 'a', now), 422, /not one of your field grants/));
    check(() => status(() => D.syncReportRows(s, 'asha', report({}, { firstAt: now, lastAt: at(-1) }), 'k', 'a', now), 422, /first time before/));
    check(() => status(() => D.syncReportRows(s, 'asha', report({}, { lastAt: at(1) }), 'k', 'a', now), 422));
    check(() => status(() => D.syncReportRows(s, 'asha', report({}, { firstAt: at(-31) }), 'k', 'a', now), 422));
    const { rows, detail } = D.syncReportRows(s, 'asha', report({ reports: [report().reports[0], { step: 'registration', errorClass: 'network', grantId: null, count: 2, firstAt: at(-1), lastAt: now }] }), 'key-1', 'audit-1', now);
    check(() => { assert.deepEqual(rows.map(r => [r.id, r.person_id, r.lease_id, r.error_class, r.count, r.report_key]), [['audit-1:0', 'P', L(1), 'conflict', 3, 'key-1'], ['audit-1:1', null, null, 'network', 2, 'key-1']]);assert.match(detail, /conflict 3, network 2; steps draft, registration; 1 field grant/);assert.ok(!detail.includes('Pesh')); });

    // 6. The Operations view and exception rows.
    p.fieldLeases.push(lease(L(3), 'asha', { status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: earlier, orderedBy: 'asha' } }));
    const r = person(s, 'R');r.fieldLeases.push(lease(L(5), 'doc2', { status: 'revoked', removal: { reason: 'grant-revoked', orderedAt: earlier, orderedBy: 'doc2', confirmedAt: now, receipt: { id: 'x', at: now, drafts: 1, unsynced: 0, media: 0, registrations: 0, appVersion: 'field-14e' } } }));
    const stored = rows.map(x => ({ ...x, actor_id: 'asha', app_version: 'field-14e', received_at: now, audit_id: 'audit-1' }));
    check(() => status(() => D.fieldDeviceView(s, as(s, 'asha'), stored, now), 403));
    check(() => status(() => D.fieldDeviceView(s, as(s, 'doc'), stored, now), 403));
    const sup = D.fieldDeviceView(s, as(s, 'sup'), stored, now);
    check(() => { assert.deepEqual(sup.removals.items.map(x => [x.id, x.state, x.patient?.name ?? null]), [[L(3), 'pending', 'Patient Pesh']], 'team supervisor: own team\'s pending copy, named');assert.equal(sup.syncFailures.total, 2);assert.equal(sup.syncFailures.items[0].patient?.name ?? sup.syncFailures.items[1].patient?.name, 'Patient Pesh'); });
    const sup2 = D.fieldDeviceView(s, as(s, 'sup2'), stored, now);
    check(() => { assert.deepEqual(sup2.removals.items.map(x => [x.id, x.state, x.patient?.name]), [[L(5), 'confirmed', 'Patient Rowan']], 'the other team\'s supervisor sees only their team');assert.equal(sup2.syncFailures.total, 0); });
    const adm = D.fieldDeviceView(s, as(s, 'adm'), stored, now);
    check(() => { assert.equal(adm.removals.items.length, 2);assert.ok(adm.removals.items.every(x => x.patient === null), 'administrators see no patient');assert.equal(adm.removals.pending, 1);assert.equal(adm.removals.confirmed, 1);assert.equal(adm.syncFailures.total, 2);assert.ok(!JSON.stringify(adm).includes('Patient ')); });
    check(() => assert.equal(sup.syncFailures.items.find(x => x.grant)?.grantState, 'active'));
    const rows14 = E.exceptionQueue(s, as(s, 'sup'), now, stored);
    check(() => { assert.equal(rows14.rulesVersion, '1.4.0');assert.deepEqual(rows14.items.filter(x => x.kind.startsWith('field-')).map(x => [x.kind, x.owner]).sort(), [['field-copy-removal', 'ASHA'], ['field-sync-failure', 'ASHA']]);assert.match(rows14.items.find(x => x.kind === 'field-copy-removal').recovery, /never reconnects/);assert.match(rows14.items.find(x => x.kind === 'field-sync-failure').what, /3 failed sync attempts/); });
    check(() => assert.equal(E.exceptionQueue(s, as(s, 'sup'), now).items.filter(x => x.kind === 'field-sync-failure').length, 0, 'without reports, no sync failure rows'));
  }

  // 7. Consent withdrawals list device copies (kept) and the grant cannot sync under the old version.
  {
    const s = newState(), p = person(s, 'P'), m = as(s, 'asha');
    const grant = await F.applyField(s, { type: 'prepareFieldVisit', personId: 'P', version: p.version }, actor('asha'), m, now);
    const r = C.applyConsent(s, { type: 'withdrawConsent', personId: 'P', version: p.version, purpose: 'ai', channel: 'phone', reference: 'CALL-1', reason: 'Patient prefers no AI assistance' }, actor('asha'), as(s, 'asha'), now);
    const e = p.consentHistory.at(-1), item = e.items.find(i => i.kind === 'field-copy');
    check(() => { assert.equal(item.ref, grant.packet.payload.leaseId);assert.equal(item.disposition, 'kept');assert.match(item.detail, /cannot sync under the earlier permission version/);assert.equal(r.items, e.items.length); });
    const sync = { type: 'syncFieldVisit', personId: 'P', leaseId: grant.packet.payload.leaseId, packageHash: grant.packageHash, facts: grant.packet.payload.facts, answers: {}, absence: {} };
    await statusAsync(() => F.applyField(s, sync, actor('asha'), as(s, 'asha'), now), 409, /permission changed/);
    C.applyConsent(s, { type: 'withdrawConsent', personId: 'P', version: p.version, purpose: 'exchange', channel: 'phone', reference: 'CALL-2', reason: 'Patient asked to stop sharing records' }, actor('asha'), as(s, 'asha'), now);
    check(() => { assert.equal(p.consentHistory.at(-1).items.filter(i => i.kind === 'field-copy').length, 1);assert.deepEqual(N.withdrawalNoticesOf(p), [], 'nothing left Saha: no notice'); });
  }

  // 8. Consent-withdrawal notices to destinations.
  {
    const s = newState(), p = person(s, 'P');
    s.workspace.integrations = [
      { id: 'mis_maternal', name: 'Maternal & child register', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: [], behavior: 'accept' },
      { id: 'mis_community', name: 'Community health MIS', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: [], behavior: 'uncertain' },
      { id: 'mis_http', name: 'State MIS', kind: 'mis', mode: 'http', status: 'active', version: 1, description: '', programmes: [] },
      { id: 'ehr_http', name: 'District EHR', kind: 'ehr', mode: 'http', status: 'active', version: 1, description: '', programmes: [] },
      { id: 'abdm_mock', name: 'ABDM gateway (mock)', kind: 'abdm', mode: 'demo', status: 'active', version: 1, description: '', programmes: [] },
    ];
    const sub = (id, connectorId, state, over = {}) => ({ id, visitId: 'v1', personId: 'P', connectorId, connectorName: connectorId, state, mode: connectorId === 'mis_http' ? 'http' : 'demo', payloadHash: 'h', attempts: 1, message: '', createdAt: earlier, updatedAt: earlier, ...over });
    s.workspace.submissions = [sub('s1', 'mis_maternal', 'accepted', { receipt: 'SIM-1' }), sub('s2', 'mis_community', 'uncertain'), sub('s3', 'mis_http', 'accepted', { receipt: 'HTTP-1', delivery: { key: 's3-key', events: [] } }), sub('s4', 'mis_http', 'queued', { delivery: { key: 's4', events: [] } }), sub('s5', 'mis_maternal', 'accepted', { personId: 'Q', receipt: 'SIM-Q' })];
    p.ehr = { links: [{ id: 'l1', integrationId: 'ehr_http', status: 'active' }], permissions: [{ id: 'g1', linkId: 'l1', direction: 'write', status: 'active', expiresAt: at(30) }], documents: [], operations: [{ id: 'o1', linkId: 'l1', state: 'accepted', at: earlier, receipt: 'Bundle/1' }, { id: 'o2', linkId: 'l1', state: 'prepared', at: earlier }] };
    p.abdmConsents = [{ id: 'a1', purpose: 'CAREMGT', hiTypes: ['OPConsultation'], from: '2026-01-01', to: '2026-12-31', expiresAt: at(30), status: 'GRANTED', requestedBy: 'doc', requestedAt: earlier, abhaNumber: '91-0000-0000-0001' }];
    p.careContexts = [{ id: 'cc1', visitId: 'v1', display: 'Visit', hiType: 'OPConsultation', recordDate: earlier, linkedAt: earlier, linkedBy: 'doc', abhaNumber: 'x' }];
    C.applyConsent(s, { type: 'withdrawConsent', personId: 'P', version: p.version, purpose: 'exchange', channel: 'written', reference: 'FORM-9', reason: 'Patient withdrew permission to share records' }, actor('asha'), as(s, 'asha'), now);
    const list = N.withdrawalNoticesOf(p), by = id => list.find(n => n.destination.id === id);
    check(() => assert.deepEqual(list.map(n => [n.destination.id, n.path, n.state]).sort(), [['abdm_mock', 'gateway-record', 'recorded'], ['ehr_http', 'manual', 'manual'], ['mis_community', 'simulator', 'due'], ['mis_http', 'manual', 'manual'], ['mis_maternal', 'simulator', 'due']]));
    check(() => { assert.deepEqual(by('mis_maternal').holds.map(h => [h.ref, h.receipt]), [['s1', 'SIM-1']], 'only this person\'s records');assert.deepEqual(by('mis_http').holds.map(h => h.ref), ['s3'], 'a cancelled unsent delivery needs no notice');assert.deepEqual(by('ehr_http').holds.map(h => h.ref), ['o1']);assert.deepEqual(by('abdm_mock').holds.map(h => h.kind).sort(), ['abdm-care-context', 'abdm-consent']); });
    check(() => { const pl = by('mis_maternal').payload;assert.deepEqual(Object.keys(pl).sort(), ['contract', 'environment', 'noticeId', 'notifies', 'operation', 'permissionVersion', 'purpose', 'withdrawnAt']);assert.equal(pl.operation, 'consent-withdrawn');assert.deepEqual(pl.notifies, [{ submissionKey: 's1', receipt: 'SIM-1' }]);assert.ok(!JSON.stringify(list).includes('Pesh'), 'no name in any notice'); });
    check(() => assert.match(by('abdm_mock').message, /No ABDM service is contacted/));
    const run = (id, cmd, when = now) => N.applyWithdrawalNotice(s, cmd, actor(id), as(s, id), when);
    const send = (n, over = {}) => ({ type: 'sendWithdrawalNotice', personId: 'P', noticeId: n.id, version: n.version, ...over });
    // Who may act.
    for (const who of ['sup', 'adm', 'doc2', 'own']) await statusAsync(() => run(who, send(by('mis_maternal'))), 403);
    as(s, 'asha2');await statusAsync(() => run('asha2', send(by('mis_maternal'))), 403);
    await statusAsync(() => run('asha', send(by('mis_maternal'), { version: 99 })), 409, /changed since you opened/);
    await statusAsync(() => run('asha', send(by('mis_maternal'), { extra: 1 })), 422);
    await statusAsync(() => run('asha', { type: 'sendWithdrawalNotice', personId: 'P', noticeId: 'missing', version: 1 }), 404);
    await statusAsync(() => run('asha', send(by('mis_http'))), 409, /no notice message/);
    await statusAsync(() => run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: by('mis_maternal').id, version: by('mis_maternal').version, outcome: 'told', reference: 'REF-1', note: 'Called the register office' }), 409, /Send this notice/);
    check(() => assert.equal(s.workspace.audit.filter(a => a.action.endsWith('WithdrawalNotice')).length, 0, 'nothing recorded on refusal'));
    // The maternal register acknowledges.
    const ack = await run('asha', send(by('mis_maternal')));
    check(() => { const n = by('mis_maternal');assert.equal(n.state, 'acknowledged');assert.match(n.receipt, /^SIM-N-[0-9A-F]{8}$/);assert.equal(ack.receipt, n.receipt);assert.equal(n.attempts, 1);assert.match(n.payloadHash, /^[a-f0-9]{64}$/);assert.equal(s.workspace.audit.at(-1).action, 'sendWithdrawalNotice'); });
    await statusAsync(() => run('asha', send(by('mis_maternal'))), 409, /already acknowledged/);
    // The community MIS loses its response: lookup only, never a second send.
    await run('doc', send(by('mis_community')));
    check(() => { const n = by('mis_community');assert.equal(n.state, 'uncertain');assert.equal(n.receipt, undefined);assert.equal(n.attempts, 1); });
    await statusAsync(() => run('asha', send(by('mis_community'))), 409, /Look up its receipt; it is never sent again/);
    await statusAsync(() => run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: by('mis_community').id, version: by('mis_community').version, outcome: 'not-required', reference: 'REF-2', note: 'Trying to close an unknown outcome' }), 409, /Look up its receipt before/);
    const looked = await run('asha', { type: 'lookupWithdrawalNotice', personId: 'P', noticeId: by('mis_community').id, version: by('mis_community').version });
    check(() => { const n = by('mis_community');assert.equal(n.state, 'acknowledged');assert.equal(n.receipt, `SIM-N-${n.id.slice(0, 8).toUpperCase()}`);assert.equal(n.attempts, 1, 'not sent again');assert.equal(n.lookups, 1);assert.equal(looked.state, 'acknowledged'); });
    await statusAsync(() => run('asha', { type: 'lookupWithdrawalNotice', personId: 'P', noticeId: by('mis_community').id, version: by('mis_community').version }), 409, /Only a notice with an unknown outcome/);
    // Manual notices: recorded with a reference and a note.
    const ehr = by('ehr_http');
    await statusAsync(() => run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: ehr.id, version: ehr.version, outcome: 'told', reference: 'R', note: 'Told the EHR team by letter' }), 422);
    await statusAsync(() => run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: ehr.id, version: ehr.version, outcome: 'told', reference: 'LETTER-7', note: 'short' }), 422);
    await run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: ehr.id, version: ehr.version, outcome: 'told', reference: 'LETTER-7', note: 'Letter sent to the district EHR team' });
    check(() => { assert.equal(ehr.state, 'told');assert.deepEqual([ehr.outcome.by, ehr.outcome.reference], ['asha', 'LETTER-7']);assert.match(ehr.events.at(-1).detail, /LETTER-7/); });
    await statusAsync(() => run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: ehr.id, version: ehr.version, outcome: 'not-required', reference: 'LETTER-8', note: 'Recording a second outcome' }), 409, /already told/);
    // The exception queue lists the open ones, then nothing once recorded.
    check(() => assert.deepEqual(E.exceptionQueue(s, as(s, 'sup'), now).items.filter(x => x.kind === 'withdrawal-notice').map(x => x.what), ['State MIS: sharing withdrawal of ' + now.slice(0, 10) + ' to be told through its own process']));
    await run('asha', { type: 'recordWithdrawalNotice', personId: 'P', noticeId: by('mis_http').id, version: by('mis_http').version, outcome: 'not-required', reference: 'MIS-NOTE-1', note: 'The state MIS confirmed it deleted the record' });
    check(() => assert.equal(E.exceptionQueue(s, as(s, 'sup'), now).items.filter(x => x.kind === 'withdrawal-notice').length, 0));
    // A later withdrawal after a new grant: an open notice is updated, closed ones stay, a new one is added only where needed.
    C.applyConsent(s, { type: 'setConsent', personId: 'P', version: p.version, purpose: 'exchange', active: true }, actor('asha'), as(s, 'asha'), now);
    s.workspace.submissions.push(sub('s6', 'mis_maternal', 'accepted', { receipt: 'SIM-6' }), sub('s7', 'mis_http', 'accepted', { receipt: 'HTTP-7' }));
    s.workspace.integrations.find(i => i.id === 'abdm_mock').operations = { version: 2, allowed: ['create', 'update', 'lookup'], aggregateOnly: false, setBy: 'own', setAt: now, reason: 'Synthetic: delete withdrawn', history: [] };
    C.applyConsent(s, { type: 'withdrawConsent', personId: 'P', version: p.version, purpose: 'exchange', channel: 'phone', reference: 'CALL-3', reason: 'Patient again withdrew sharing permission' }, actor('asha'), as(s, 'asha'), at(0.01));
    const again = N.withdrawalNoticesOf(p);
    check(() => { const maternal = again.filter(n => n.destination.id === 'mis_maternal');assert.equal(maternal.length, 2, 'the acknowledged notice stays; a new one covers both deliveries');assert.deepEqual(maternal[1].holds.map(h => h.ref), ['s1', 's6']);assert.equal(maternal[1].state, 'due'); });
    check(() => { const abdm = again.filter(n => n.destination.id === 'abdm_mock').at(-1);assert.equal(abdm.state, 'manual', 'the gateway\'s delete operation withdrawn: a manual notice');assert.match(abdm.message, /was not told/); });
    // A due notice brought up to date by a later withdrawal changes version, so an earlier review no longer sends.
    const due = again.filter(n => n.destination.id === 'mis_maternal')[1], v0 = due.version;
    C.applyConsent(s, { type: 'setConsent', personId: 'P', version: p.version, purpose: 'exchange', active: true }, actor('asha'), as(s, 'asha'), now);
    C.applyConsent(s, { type: 'setConsent', personId: 'P', version: p.version, purpose: 'exchange', active: false }, actor('asha'), as(s, 'asha'), at(0.02));
    check(() => { assert.equal(N.withdrawalNoticesOf(p).filter(n => n.destination.id === 'mis_maternal').length, 2, 'the open notice is updated, not duplicated');assert.ok(due.version > v0);assert.match(due.message, /Updated by a later withdrawal/); });
    await statusAsync(() => run('asha', send(due, { version: v0 })), 409, /changed since you opened/);
    // Lookup refused when the destination's lookup operation is withdrawn: the outcome stays unknown.
    await run('asha', send(N.withdrawalNoticesOf(p).filter(n => n.destination.id === 'mis_community').at(-1) ?? due));
    const unknown = N.withdrawalNoticesOf(p).find(n => n.state === 'uncertain');
    if (unknown) {
      s.workspace.integrations.find(i => i.id === 'mis_community').operations = { version: 2, allowed: ['create'], aggregateOnly: false, setBy: 'own', setAt: now, reason: 'Synthetic: lookup withdrawn', history: [] };
      await statusAsync(() => run('asha', { type: 'lookupWithdrawalNotice', personId: 'P', noticeId: unknown.id, version: unknown.version }), 409, /outcome stays unknown/);
    }
    // Certified patient commands, and commands this module does not handle.
    check(() => { for (const t of ['sendWithdrawalNotice', 'lookupWithdrawalNotice', 'recordWithdrawalNotice', 'confirmFieldRemoval']) assert.ok(P.PATIENT_COMMANDS.has(t), t); });
    check(() => assert.equal(N.noticePath('programme', { kind: 'mis', mode: 'http' }), 'manual', 'HTTP programme connections stay manual until the slice 14c seam is used'));
  }

  writeFileSync('tests/field-device-contract-result.json', JSON.stringify({ passed, at: new Date().toISOString(), coverage: 'Slice 14e: device copies due for removal (revoked, access ended, merged, restricted), revocation orders, preparation refused while restricted, held removals bounded; removal orders and receipts; sync failure report schema, grant ownership and time window; Operations view scope and redaction; exception rows (rules 1.4.0); device copies listed by consent withdrawals; consent-withdrawal notices per destination with send, lookup and manual outcomes, refusals by role, scope and version. Unit level: no Worker, D1 or browser.' }, null, 2) + '\n');
  console.log(`${passed} field device and withdrawal notice contract checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
