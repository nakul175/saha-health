// Slice 14d contract (R90, BR-SEC-02): notice versions and permission expiry.
// The registry command (owner only, next version only, effective-date rules, bounds, never edited), the standing of a
// permission evaluated on read (not given, in force, expired, needs renewal after a material notice), the terms recorded
// when a permission is given or renewed (notice version and language, server-set expiry, audit event), and the checks that
// stop a lapsed permission from authorising its purpose (AI assistance, programme delivery, the record assistant, contact).
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.consent-notices-contract-'));
let passed = 0;
const check = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const checkAsync = async (name, fn) => { try { await fn(); passed++; } catch (e) { e.message = `${name}: ${e.message}`; throw e; } };
const status = (fn, code, pattern) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
// A refused command may have changed the in-memory state before refusing; the server discards that state, so do the same.
let s;
const refused = (fn, code, pattern) => { const saved = structuredClone(s); try { return status(fn, code, pattern); } finally { s = saved; } };
const statusAsync = async (fn, code, pattern) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const load = name => import(pathToFileURL(join(dir, name + '.js')));
  const core = await load('core'), consent = await load('consent'), N = await load('consent-notices'), mis = await load('mis'), agent = await load('agent'), outreach = await load('outreach');
  const { allowed } = await load('access');
  const DAY = 86400000, now = '2026-10-04T06:00:00.000Z', at = ms => new Date(Date.parse(now) + ms).toISOString();
  const fail = core.fail;
  let n = 0; const uuid = () => `id-${++n}`;
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', consentVersion: 1, assigned: false, createdAt: now, version: 1, teamId: 't1', assignedTo: 'asha' };
  const fresh = () => ({
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }], invitations: [],
    members: [member('own', 'clinician', { isOwner: true }), member('asha', 'asha'), member('doc', 'clinician'), member('sup', 'supervisor'), member('adm', 'admin', { teamIds: [] }), member('doc2', 'clinician', { teamIds: ['t2'] })],
    workspace: { schemaVersion: 1, revision: 1, role: 'asha', integrations: [{ id: 'demo-ai', name: 'Demo summary', kind: 'ai', mode: 'demo', status: 'active', version: 1, description: '', programmes: [], capability: 'summary' }], receipts: {}, audit: [], referrals: [], submissions: [],
      people: [{ ...base, id: 'P', name: 'Patient P', aiConsent: false, exchangeConsent: false }, { ...base, id: 'L', name: 'Legacy L', aiConsent: true, exchangeConsent: true }],
      visits: [{ id: 'v1', personId: 'P', version: 2, state: 'confirmed', createdAt: now, recordVersion: 1, aiResults: [], facts: { date: '2026-10-04T05:00', systolic: '', diastolic: '', weight: '58', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit', source: 'measured' } }] },
  });
  s = fresh();
  const M = id => s.members.find(m => m.userId === id), P = () => s.workspace.people.find(p => p.id === 'P'), L = () => s.workspace.people.find(p => p.id === 'L');
  const as = id => { const m = M(id); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = allowed(m, p); return m; };
  const actor = id => ({ userId: id, displayName: id.toUpperCase(), email: 'x@example.invalid' });
  const publish = (id, over = {}, when = now) => N.applyConsentNotice(s, { type: 'publishConsentNotice', purpose: 'ai', version: 1, effectiveFrom: when, material: false, summary: 'First reviewed notice for AI assistance', review: 'Synthetic review REF-1', texts: { en: 'Saha can use an AI tool to summarise your confirmed visit facts. You can say no and care continues.', hi: 'सहा आपकी पुष्टि हुई विज़िट जानकारी का सारांश बनाने के लिए एआई उपकरण का उपयोग कर सकता है। आप मना कर सकते हैं।' }, ...over }, actor(id), as(id), fail, uuid, when);
  const give = (id, over = {}, when = now) => consent.applyConsent(s, { type: 'setConsent', personId: 'P', purpose: 'ai', active: true, version: P().version, ...over }, actor(id), as(id), when);
  const standing = (p, purpose, when = now) => core.consentStanding(p, purpose, when, core.noticesOf(s));

  // ---- The registry command ----
  check('publish: only an active owner (also the replay check in authorizeConsent)', () => {
    for (const id of ['asha', 'doc', 'sup', 'adm']) status(() => publish(id), 403, /owner/);
    status(() => consent.authorizeConsent(s, M('sup'), { type: 'publishConsentNotice' }), 403);
    M('own').status = 'suspended'; status(() => consent.authorizeConsent(s, M('own'), { type: 'publishConsentNotice' }), 403); M('own').status = 'active';
    consent.authorizeConsent(s, M('own'), { type: 'publishConsentNotice' });
    assert.equal(core.noticesOf(s).length, 0);
  });
  check('publish: other commands are not handled', () => { assert.equal(N.applyConsentNotice(s, { type: 'setSpeechPolicy' }, actor('own'), as('own'), fail, uuid, now), null); });
  check('publish: schema refusals', () => {
    status(() => publish('own', { purpose: 'contact' }), 422);
    status(() => publish('own', { texts: {} }), 422, /English or Hindi/);
    status(() => publish('own', { texts: { en: 'Too short' } }), 422, /at least 40/);
    status(() => publish('own', { texts: { en: 'x'.repeat(N.MAX_NOTICE_CHARS + 1) } }), 422);
    status(() => publish('own', { texts: { en: 'A notice with a control character \u0007 inside it, long enough to pass.' } }), 422, /control/);
    status(() => publish('own', { summary: 'short' }), 422);
    status(() => publish('own', { review: '' }), 422);
    status(() => publish('own', { extra: 1 }), 422);
    status(() => publish('own', { effectiveFrom: 'not a date at all' }), 422, /date and time/);
  });
  check('publish: effective time rules', () => {
    status(() => publish('own', { effectiveFrom: at(-10 * 60000) }), 422, /past/);
    status(() => publish('own', { effectiveFrom: at(91 * DAY) }), 422, /90 days/);
    assert.equal(core.noticesOf(s).length, 0, 'refused publications record nothing');
  });
  let v1;
  check('publish: version 1 within the clock allowance takes effect now, recorded and audited', () => {
    const r = publish('own', { effectiveFrom: at(-2 * 60000) });
    const list = core.noticesOf(s); v1 = list[0];
    assert.equal(r.version, 1); assert.equal(r.effectiveFrom, now); assert.equal(list.length, 1); assert.equal(v1.purpose, 'ai'); assert.equal(v1.material, false); assert.equal(v1.publishedBy, 'own'); assert.ok(v1.texts.en && v1.texts.hi);
    const a = s.workspace.audit.at(-1); assert.equal(a.action, 'publishConsentNotice'); assert.equal(a.subject, 'org'); assert.match(a.detail, /Optional AI assistance notice version 1 published \(English and Hindi\)/); assert.match(a.detail, /Not a material change/); assert.match(a.detail, /Synthetic review REF-1/);
  });
  check('publish: only the next version (stale and skipped versions refused)', () => {
    status(() => publish('own', { version: 1 }), 409, /version 1/); status(() => publish('own', { version: 3 }), 409);
    status(() => publish('own', { purpose: 'exchange', version: 2 }), 409, /version 0/);
  });
  const frozen = JSON.stringify(core.noticesOf(s)[0]);
  check('publish: a scheduled version 2 never changes version 1 and cannot start before it', () => {
    const r = publish('own', { version: 2, material: true, summary: 'Adds a second AI provider; material change', effectiveFrom: at(7 * DAY), texts: { en: 'Saha can use two AI tools to summarise your confirmed visit facts. You can say no and care continues.' } });
    assert.equal(r.version, 2); assert.equal(JSON.stringify(core.noticesOf(s)[0]), frozen, 'version 1 is unchanged');
    status(() => publish('own', { version: 3, effectiveFrom: at(DAY) }), 422, /before version 2/);
    assert.equal(core.noticeInForce(core.noticesOf(s), 'ai', now).version, 1, 'version 2 is scheduled, not in force');
    assert.equal(core.noticeInForce(core.noticesOf(s), 'ai', at(7 * DAY)).version, 2);
    assert.equal(core.noticeInForce(core.noticesOf(s), 'exchange', now), null);
    assert.deepEqual(N.noticesView(s).map(x => x.version), [1, 2]);
  });
  check('publish: the registry is bounded', () => {
    const saved = s.operations.consentNotices; s.operations.consentNotices = Array.from({ length: N.MAX_NOTICE_VERSIONS }, (_, i) => ({ ...saved[0], id: 'f' + i, purpose: 'exchange', version: i + 1 }));
    status(() => publish('own', { purpose: 'exchange', version: N.MAX_NOTICE_VERSIONS + 1 }), 422, /at most 20/); s.operations.consentNotices = saved;
  });

  // ---- Giving a permission records its terms ----
  check('give: with a notice in force, the command must name it', () => {
    refused(() => give('asha'), 409, /current optional ai assistance notice \(version 1\)/);
    refused(() => give('asha', { notice: { id: 'nope', language: 'en' } }), 409, /now version 1/);
    refused(() => give('asha', { notice: { id: v1.id } }), 422);
    refused(() => give('asha', { notice: { id: v1.id, language: 'en', extra: 1 } }), 422);
    assert.equal(P().aiConsent, false); assert.equal(P().consentHistory, undefined);
  });
  check('give: a stale patient version and a role without care are refused as before', () => { status(() => give('asha', { version: 99, notice: { id: v1.id, language: 'hi' } }), 409); status(() => give('sup', { notice: { id: v1.id, language: 'hi' } }), 403); status(() => give('doc2', { notice: { id: v1.id, language: 'hi' } }), 403); });
  check('give: the notice version, language and server-set expiry are recorded and audited', () => {
    const before = s.workspace.audit.length, r = give('asha', { notice: { id: v1.id, language: 'hi' } }), e = P().consentHistory.at(-1);
    assert.equal(r.action, 'granted'); assert.deepEqual(e.notice, { id: v1.id, version: 1, language: 'hi' }); assert.equal(e.expiresAt, at(365 * DAY)); assert.equal(e.renews, undefined);
    const added = s.workspace.audit.slice(before); assert.deepEqual(added.map(a => a.action), ['consentTerms', 'setConsent']);
    assert.equal(added[0].personId, 'P'); assert.match(added[0].detail, /given under notice version 1 \(Hindi\), in force since 2026-10-04; expires 2027-10-04 \(365 days\)\./);
    assert.deepEqual(standing(P(), 'ai'), { purpose: 'ai', state: 'in-force', eventId: e.id, grantedAt: now, expiresAt: at(365 * DAY), notice: e.notice, since: null, current: { id: v1.id, version: 1 } });
  });
  check('give: the client cannot set the expiry; giving again while in force is a renewal', () => {
    const first = P().consentHistory.at(-1); give('asha', { notice: { id: v1.id, language: 'hi' }, expiresAt: at(9999 * DAY) });
    const e = P().consentHistory.at(-1); assert.equal(e.expiresAt, at(365 * DAY)); assert.deepEqual(e.renews, { eventId: first.id, state: 'in-force' }); assert.match(s.workspace.audit.at(-2).detail, /renews the permission of 2026-10-04\./);
  });
  check('give: without any notice published, the permission is recorded with no notice and the purpose period', () => {
    const r = consent.applyConsent(s, { type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P().version }, actor('doc'), as('doc'), now), e = P().consentHistory.at(-1);
    assert.equal(r.purpose, 'exchange'); assert.equal(e.notice, null); assert.equal(e.expiresAt, at(180 * DAY)); assert.match(s.workspace.audit.at(-2).detail, /no notice is published for this purpose; expires 2027-04-02 \(180 days\)/);
    refused(() => consent.applyConsent(s, { type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P().version, notice: { id: v1.id, language: 'en' } }, actor('doc'), as('doc'), now), 409, /No external record sharing notice is in force/);
  });
  check('give: the notice must have text in the language named', () => {
    const one = publish('own', { purpose: 'exchange', version: 1, texts: { en: 'Saha can share your confirmed visit record with a programme system you agree to. You can say no.' } });
    refused(() => consent.applyConsent(s, { type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P().version, notice: { id: one.noticeId, language: 'hi' } }, actor('doc'), as('doc'), now), 422, /no Hindi text/);
  });
  check('give: automated contact has no notice registry', () => { status(() => consent.grantTerms(s, P(), { purpose: 'contact', id: 'x' }, { id: v1.id, language: 'en' }, now), 422, /no versioned notice/); });

  // ---- Standing, evaluated on read ----
  check('standing: not given, and a permission recorded before this slice', () => {
    assert.equal(standing({ ...base, id: 'Z', aiConsent: false, exchangeConsent: false }, 'ai').state, 'not-granted');
    const legacy = standing(L(), 'exchange'); assert.equal(legacy.state, 'in-force'); assert.equal(legacy.expiresAt, null); assert.equal(legacy.eventId, null);
    const old = { ...L(), consentHistory: [{ id: 'old', purpose: 'exchange', action: 'granted', at: '2026-01-01T00:00:00.000Z', items: [] }] };
    assert.equal(standing(old, 'exchange', at(5000 * DAY)).state, 'in-force', 'a slice 6o grant without an expiry does not expire');
    const off = { ...L(), consentHistory: [{ id: 'w', purpose: 'ai', action: 'withdrawn', at: now, items: [] }] };
    assert.equal(standing(off, 'ai').state, 'in-force', 'a switched-on permission whose last event is a withdrawal is treated as recorded before this slice');
  });
  check('standing: expiry is exact and needs no timer', () => {
    // Without the registry (the material version 2 would otherwise ask for renewal first).
    assert.equal(core.consentStanding(P(), 'ai', at(365 * DAY - 1)).state, 'in-force');
    const e = core.consentStanding(P(), 'ai', at(365 * DAY)); assert.equal(e.state, 'expired'); assert.equal(e.since, at(365 * DAY));
    assert.equal(core.consentInForce(P(), 'ai', at(400 * DAY), core.noticesOf(s)), false);
    assert.match(core.lapseMessage(e), /AI assistance permission expired on 2027-10-04\. Renew it with the person under Permissions/);
    assert.equal(core.lapseMessage(standing(P(), 'ai')), null);
  });
  check('standing: a material version needs renewal once it takes effect; a non-material one does not', () => {
    assert.equal(standing(P(), 'ai', at(7 * DAY - 1)).state, 'in-force');
    const r = standing(P(), 'ai', at(7 * DAY)); assert.equal(r.state, 'renewal-needed'); assert.equal(r.since, at(7 * DAY)); assert.equal(r.current.version, 2);
    assert.match(core.lapseMessage(r), /earlier notice, and a material change took effect on 2026-10-11/);
    assert.equal(standing(L(), 'ai', at(7 * DAY)).state, 'renewal-needed', 'a permission recorded before any notice needs renewal too');
    assert.equal(standing(P(), 'exchange', at(DAY)).state, 'in-force', 'exchange version 1 is not material: earlier permissions stay in force');
    assert.equal(standing(P(), 'ai', at(400 * DAY)).state, 'expired', 'expiry is reported first');
  });
  check('standing: a renewal under the material version is in force again, and records what it renews', () => {
    const later = at(7 * DAY), v2 = core.noticeInForce(core.noticesOf(s), 'ai', later);
    refused(() => give('asha', { notice: { id: v1.id, language: 'en' } }, later), 409, /now version 2/);
    refused(() => give('asha', { notice: { id: v2.id, language: 'hi' } }, later), 422, /no Hindi text/);
    const prior = P().consentHistory.filter(e => e.purpose === 'ai').at(-1);
    give('asha', { notice: { id: v2.id, language: 'en' } }, later);
    const e = P().consentHistory.at(-1); assert.deepEqual(e.renews, { eventId: prior.id, state: 'renewal-needed' }); assert.equal(e.notice.version, 2); assert.equal(e.expiresAt, at(372 * DAY));
    assert.match(s.workspace.audit.at(-2).detail, /renews the permission of 2026-10-04, which needed renewal after a material notice change\./);
    assert.equal(standing(P(), 'ai', later).state, 'in-force');
  });
  check('standing: renewing after expiry is recorded as such', () => {
    const late = at(800 * DAY), inForce = core.noticeInForce(core.noticesOf(s), 'ai', late);
    assert.equal(standing(P(), 'ai', late).state, 'expired');
    give('asha', { notice: { id: inForce.id, language: 'en' } }, late);
    assert.equal(P().consentHistory.at(-1).renews.state, 'expired'); assert.match(s.workspace.audit.at(-2).detail, /which had expired\./);
  });
  check('withdrawal: needs no notice, is recorded for an expired permission, and leaves nothing in force', () => {
    const late = at(2000 * DAY); assert.equal(standing(P(), 'exchange', late).state, 'expired');
    const r = consent.applyConsent(s, { type: 'withdrawConsent', personId: 'P', version: P().version, purpose: 'exchange', channel: 'in-person', reference: 'FORM-14D', reason: 'Patient no longer wants records shared' }, actor('doc'), as('doc'), late);
    assert.equal(r.action, 'withdrawn'); assert.equal(standing(P(), 'exchange', late).state, 'not-granted'); assert.equal(P().consentHistory.at(-1).expiresAt, undefined);
  });
  check('history bound keeps the latest decision of every purpose', () => {
    const p = { ...base, id: 'H', aiConsent: true, exchangeConsent: true, consentHistory: [] };
    consent.recordConsent(p, { purpose: 'exchange', action: 'granted', at: now, by: 'a', byName: 'A', role: 'asha', channel: 'switch', reference: '', reason: '', fromVersion: 1, toVersion: 2, items: [], expiresAt: at(DAY) });
    for (let i = 0; i < consent.MAX_HISTORY + 10; i++) consent.recordConsent(p, { purpose: 'ai', action: 'granted', at: now, by: 'a', byName: 'A', role: 'asha', channel: 'switch', reference: '', reason: '', fromVersion: i, toVersion: i + 1, items: [] });
    assert.equal(p.consentHistory.length, consent.MAX_HISTORY); assert.equal(p.consentHistory[0].purpose, 'exchange');
    assert.equal(core.consentStanding(p, 'exchange', at(2 * DAY)).state, 'expired', 'the exchange grant was kept, so it still expires');
  });

  // ---- A lapsed permission stops authorising everywhere it is checked ----
  // These checks read the clock themselves (as on the server), so this part uses the real time.
  s = fresh(); n = 100;
  const rnow = new Date().toISOString(), ago = ms => new Date(Date.now() - ms).toISOString(), ahead = ms => new Date(Date.now() + ms).toISOString();
  publish('own', {}, rnow);
  const grantP = (purpose, when = rnow) => consent.applyConsent(s, { type: 'setConsent', personId: 'P', purpose, active: true, version: P().version, ...(purpose === 'ai' ? { notice: { id: core.noticeInForce(core.noticesOf(s), 'ai', when).id, language: 'en' } } : {}) }, actor('asha'), as('asha'), when);
  grantP('ai'); grantP('exchange');
  const lastOf = purpose => P().consentHistory.filter(x => x.purpose === purpose).at(-1);
  const ext = () => ({ call: async () => assert.fail('no provider call'), notices: core.noticesOf(s) });
  await checkAsync('legacy AI assistance (core runAI): in force works; expired refused with the lapse', async () => {
    as('asha'); const v = s.workspace.visits[0], cmd = () => ({ type: 'runAI', visitId: 'v1', providerId: 'demo-ai', version: v.version, consentVersion: P().consentVersion, approved: true });
    const ok = await core.apply(s.workspace, cmd(), 'asha', ext(), rnow); assert.ok(ok.resultId);
    const later = new Date(Date.parse(lastOf('ai').expiresAt) + 1000).toISOString();
    await statusAsync(() => core.apply(s.workspace, cmd(), 'asha', ext(), later), 409, /AI assistance permission expired on/);
    await statusAsync(() => core.apply(s.workspace, cmd(), 'asha', { call: ext().call }, later), 409, /expired/);
  });
  check('record assistant (agent eligible): refused while expired or awaiting renewal', () => {
    const v = s.workspace.visits[0], provider = { id: 'local', available: true };
    assert.equal(agent.eligible(s, as('asha'), v, provider).id, 'P');
    const e = lastOf('ai'), keep = e.expiresAt; e.expiresAt = ago(1000);
    status(() => agent.eligible(s, as('asha'), v, provider), 409, /expired/); e.expiresAt = keep;
    publish('own', { version: 2, material: true, summary: 'Material change to the AI notice text' }, new Date().toISOString());
    status(() => agent.eligible(s, as('asha'), v, provider), 409, /material change/);
    grantP('ai', new Date().toISOString()); assert.equal(agent.eligible(s, as('asha'), v, provider).id, 'P');
  });
  check('programme delivery (mis deliveryCurrent): an expired sharing permission stops an unsent delivery', () => {
    s.workspace.integrations.push({ id: 'mis1', name: 'Programme', kind: 'mis', mode: 'http', status: 'active', version: 1, description: '', programmes: ['General care'], endpoint: 'https://programme.example/v1', credentialBinding: 'SAHA_MIS_TEST' });
    const sub = { id: 'sub1', visitId: 'v1', personId: 'P', connectorId: 'mis1', connectorName: 'Programme', state: 'queued', mode: 'http', payloadHash: 'h', attempts: 0, message: '', createdAt: rnow, updatedAt: rnow, delivery: { key: 'sub1', actorId: 'asha', connectorVersion: 1, personVersion: P().version, consentVersion: P().consentVersion, visitVersion: 2, expiresAt: ahead(DAY), events: [] } };
    s.workspace.submissions.push(sub);
    status(() => mis.deliveryCurrent(s, sub, actor('asha'), as('asha'), {}), 409, /External programme credentials|disabled|credential/i);
    lastOf('exchange').expiresAt = ago(1000);
    status(() => mis.deliveryCurrent(s, sub, actor('asha'), as('asha'), {}), 409, /External record sharing permission expired/);
  });
  await checkAsync('automated contact: expires, is renewed by saving the preferences with permission, and is not extended by other edits', async () => {
    const prefs = { method: 'sms', destination: 'TEST-14D-001', ownership: 'personal', language: 'hi', timezone: 'UTC', from: '00:00', to: '23:59', permission: true, privateContact: false, reference: 'SYN-14D' };
    const save = (over = {}, when = now) => outreach.applyOutreach(s, { type: 'setContactPreferences', personId: 'P', version: P().version, preferences: { ...prefs, ...over } }, actor('asha'), as('asha'), when);
    await save(); const g = P().consentHistory.at(-1);
    assert.equal(g.purpose, 'contact'); assert.equal(g.action, 'granted'); assert.equal(g.expiresAt, at(365 * DAY)); assert.equal(g.notice, undefined);
    assert.equal(s.workspace.audit.at(-2).action, 'consentTerms'); assert.match(s.workspace.audit.at(-2).detail, /Automated contact permission: no versioned notice for this purpose; expires 2027-10-04/);
    const count = P().consentHistory.length; await save({ from: '01:00' }, at(DAY)); assert.equal(P().consentHistory.length, count, 'a preference edit while in force records no new decision');
    assert.equal(core.consentStanding(P(), 'contact', at(365 * DAY)).state, 'expired');
    assert.match(core.lapseMessage(core.consentStanding(P(), 'contact', at(365 * DAY))), /Renew it by saving the contact preferences with permission/);
    await save({}, at(366 * DAY)); const r = P().consentHistory.at(-1);
    assert.equal(r.action, 'granted'); assert.deepEqual(r.renews, { eventId: g.id, state: 'expired' }); assert.equal(r.expiresAt, at(731 * DAY));
    await save({ permission: false }, at(367 * DAY)); assert.equal(P().consentHistory.at(-1).action, 'withdrawn'); assert.equal(core.consentStanding(P(), 'contact', at(367 * DAY)).state, 'not-granted');
  });

  const result = { suite: 'consent notices and expiry contract (slice 14d)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/consent-notices-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
