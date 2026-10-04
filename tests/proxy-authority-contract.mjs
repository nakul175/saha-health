// Slice 14b proxy authority contract (R12: BR-ID-07, BR-SEC-04, BR-SEC-02): purpose-limited, expiring proxy grants with a
// typed relationship and an authority basis, enforced at every use (household sharing, consent decisions, rights requests),
// clinician capacity records, representative authority on consent events and rights requests, and one audit event per use.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.proxy-authority-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, pattern) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); if (pattern) assert.match(e.message, pattern); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of readdirSync(lib).filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '') + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const [H, C, R, A, Mg] = await Promise.all(['household', 'consent', 'rights', 'access', 'merge'].map(imp));

  const now = '2026-10-04T06:00:00.000Z', at = d => new Date(Date.parse(now) + d * 86400000).toISOString(), earlier = at(-10);
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: earlier, ...over });
  const base = { sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: earlier, version: 1, teamId: 't1', assignedTo: 'asha' };
  const P = { ...base, id: 'P', name: 'Adult P', age: 40, householdId: 'h1' }, Kid = { ...base, id: 'K', name: 'Child K', age: 12, householdId: 'h1' }, Rep = { ...base, id: 'H', name: 'Relative H', age: 45, householdId: 'h1' };
  const Teen = { ...base, id: 'T', name: 'Teen T', age: 16, householdId: 'h1' }, Q = { ...base, id: 'Q', name: 'Other team Q', age: 50, teamId: 't2', assignedTo: null };
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: earlier }, teams: [{ id: 't1', name: 'One', createdAt: earlier }, { id: 't2', name: 'Two', createdAt: earlier }], invitations: [],
    members: [member('doc', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('sup', 'supervisor', ['t1']), member('doc2', 'clinician', ['t2']), member('adm', 'admin', [], { isOwner: true })],
    households: [{ id: 'h1', version: 1, label: 'Synthetic', teamId: 't1', createdAt: earlier, createdBy: 'asha', members: ['P', 'K', 'H', 'T'].map(personId => ({ personId, relationship: 'other', from: '2026-09-01', addedBy: 'asha', addedAt: earlier })) }],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [], visits: [], submissions: [], people: [P, Kid, Rep, Teen, Q] },
  };
  const M = id => s.members.find(m => m.userId === id);
  const as = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = A.allowed(m, p); return m; };
  const actor = userId => ({ userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' });
  const hh = (userId, cmd, when = now) => { const m = as(userId); return H.applyHousehold(s, cmd, actor(userId), m, when); };
  const consent = (userId, cmd, when = now) => { const m = as(userId); return C.applyConsent(s, cmd, actor(userId), m, when); };
  const rights = (userId, cmd, when = now) => { const m = as(userId); return R.applyRights(s, cmd, actor(userId), m, when); };
  const grantCmd = (over = {}) => ({ type: 'proxyGrant', personId: 'P', version: P.version, proxyPersonId: 'H', relationship: 'sibling', authority: 'nominated', purposes: ['consent-decisions', 'rights-requests', 'appointments'], classes: [], evidence: 'SYNTH-NOMINATION-1', expiresAt: at(60), ...over });
  const g = (over = {}) => ({ id: 'x', proxyPersonId: 'H', relationship: 'parent', authority: 'parent-of-minor', purposes: ['consent-decisions'], classes: [], evidence: 'E', from: earlier, expiresAt: at(30), grantedBy: 'asha', grantedAt: earlier, ...over });
  const audits = action => s.workspace.audit.filter(a => a.action === action);

  // 1. grantState: every reason a grant is not in force, and in force under each authority.
  check(() => {
    assert.equal(H.grantState(Kid, g(), now), 'in-force');
    assert.equal(H.grantState(Kid, g({ revokedAt: earlier }), now), 'revoked');
    assert.equal(H.grantState(Kid, g({ from: at(1) }), now), 'not-started');
    assert.equal(H.grantState(Kid, g({ expiresAt: now }), now), 'expired', 'expiry is exclusive');
    assert.equal(H.grantState(Kid, g({ relationship: 'head' }), now), 'no-relationship', 'a household role is not a relationship between people');
    assert.equal(H.grantState(Kid, g({ authority: undefined }), now), 'no-authority', 'a grant recorded before slice 14b is not in force');
    assert.equal(H.grantState(Kid, g({ relationship: 'grandparent' }), now), 'not-a-parent');
    assert.equal(H.grantState({ ...Kid, age: 18 }, g(), now), 'parent-authority-ended');
    assert.equal(H.grantState(Kid, g({ authority: 'nominated' }), now), 'nomination-by-minor');
    assert.equal(H.grantState(P, g({ authority: 'nominated', relationship: 'sibling' }), now), 'in-force');
    assert.equal(H.grantState(Kid, g({ authority: 'legal-guardian', relationship: 'other-relative' }), now), 'in-force');
    assert.equal(H.grantState(P, g({ authority: 'legal-guardian', relationship: 'other' }), now), 'in-force');
  });
  check(() => {
    const cr = g({ authority: 'capacity-representative', relationship: 'child' });
    assert.equal(H.grantState(P, cr, now), 'capacity-not-recorded', 'never recorded as lacking capacity');
    const lacks = { id: 'c1', state: 'lacks-capacity', at: at(-20), by: 'doc', role: 'clinician', evidence: 'E', note: 'n' }, has = { ...lacks, id: 'c2', state: 'has-capacity', at: at(-1) };
    assert.equal(H.grantState({ ...P, capacity: [lacks] }, cr, now), 'in-force');
    assert.equal(H.grantState({ ...P, capacity: [lacks, has] }, cr, now), 'capacity-regained');
    assert.equal(H.grantState({ ...P, capacity: [lacks, has, { ...lacks, id: 'c3', at: at(-0.5) }] }, cr, now), 'capacity-regained', 'a later finding of incapacity does not revive the grant');
    assert.equal(H.capacityOf(P), 'not-recorded');
    for (const st of ['revoked', 'not-started', 'expired', 'no-relationship', 'no-authority', 'not-a-parent', 'parent-authority-ended', 'nomination-by-minor', 'capacity-not-recorded', 'capacity-regained']) assert.ok(H.grantRefusal(st, g({ revokedAt: earlier }), Kid).length > 20, st);
  });

  // 2. requireProxy: missing grant, wrong representative, purpose, and in force.
  Kid.proxies = [g({ id: 'gk' })];
  check(() => {
    status(() => H.requireProxy(Kid, 'missing', 'consent-decisions', now), 422, /needs a proxy grant/);
    status(() => H.requireProxy(Kid, undefined, 'consent-decisions', now), 422);
    status(() => H.requireProxy(Kid, 'gk', 'consent-decisions', now, 'T'), 422, /different representative/);
    status(() => H.requireProxy(Kid, 'gk', 'rights-requests', now), 422, /does not cover rights requests/);
    status(() => H.requireProxy(Kid, 'gk', 'consent-decisions', at(31)), 422, /expired/);
    assert.equal(H.requireProxy(Kid, 'gk', 'consent-decisions', now, 'H').id, 'gk');
  });

  // 3. proxyGrant: authority, relationship, start, expiry, overlap, role, scope and version.
  check(() => {
    assert.equal(hh('asha', grantCmd({ authority: undefined })), null, 'authority is required by the schema');
    assert.equal(hh('asha', grantCmd({ relationship: 'head' })), null, 'a household role is not accepted');
    assert.equal(hh('asha', grantCmd({ purposes: ['marketing'] })), null);
    status(() => hh('sup', grantCmd()), 403);
    status(() => hh('adm', grantCmd()), 403);
    status(() => hh('doc2', grantCmd()), 403, /not assigned/);
    status(() => hh('asha', grantCmd({ version: 9 })), 409);
    status(() => hh('asha', grantCmd({ startsAt: at(-2) })), 422, /start from today/);
    status(() => hh('asha', grantCmd({ startsAt: at(91), expiresAt: at(120) })), 422, /within 90 days/);
    status(() => hh('asha', grantCmd({ startsAt: at(10), expiresAt: at(9) })), 422, /after the start/);
    status(() => hh('asha', grantCmd({ startsAt: at(10), expiresAt: at(376) })), 422, /within 365 days/);
    status(() => hh('asha', grantCmd({ authority: 'parent-of-minor', relationship: 'parent' })), 422, /turns 18/);
    status(() => hh('asha', grantCmd({ personId: 'K', version: Kid.version, authority: 'parent-of-minor', relationship: 'grandparent' })), 422, /parent/);
    status(() => hh('asha', grantCmd({ personId: 'K', version: Kid.version, authority: 'nominated' })), 422, /18 or older/);
    status(() => hh('asha', grantCmd({ authority: 'capacity-representative' })), 422, /lacks capacity/);
    status(() => hh('asha', grantCmd({ proxyPersonId: 'T' })), 422, /representative who decides/);
    assert.equal(P.proxies, undefined, 'refused grants record nothing');
  });
  // A minor may still receive appointment information (no acting purpose).
  const teenShare = hh('asha', grantCmd({ proxyPersonId: 'T', purposes: ['appointments'] }));
  const first = hh('asha', grantCmd());
  check(() => {
    const gr = P.proxies.find(x => x.id === first.grantId);
    assert.equal(gr.authority, 'nominated'); assert.equal(gr.relationship, 'sibling'); assert.equal(gr.from, now); assert.equal(first.from, now);
    assert.ok(teenShare.grantId);
    const a = audits('proxyGrant').at(-1); assert.match(a.detail, /record H; the person's sibling; nominated by the person; grant .* in force 2026-10-04 to 2026-12-03/);
    status(() => hh('asha', grantCmd({ version: P.version })), 409, /already covers/);
  });
  const renewal = hh('asha', grantCmd({ version: P.version, startsAt: at(60), expiresAt: at(200) }));
  check(() => {
    const r = P.proxies.find(x => x.id === renewal.grantId);
    assert.equal(r.from, at(60), 'a renewal may start when the current grant ends');
    assert.equal(H.grantState(P, r, now), 'not-started');
    status(() => H.requireProxy(P, r.id, 'consent-decisions', now), 422, /starts on 2026-12-03/);
    assert.equal(H.requireProxy(P, r.id, 'consent-decisions', at(61)).id, r.id);
  });

  // 4. capacityRecord: clinician only, adults only, version, append-only, and ending a capacity representative's grant.
  check(() => {
    const cap = { type: 'capacityRecord', personId: 'P', version: P.version, state: 'lacks-capacity', evidence: 'CAP-1', note: 'Assessed for the decision to share records' };
    status(() => hh('asha', cap), 403, /clinician/);
    status(() => hh('sup', cap), 403);
    status(() => hh('doc2', cap), 403);
    status(() => hh('doc', { ...cap, version: 9 }), 409);
    status(() => hh('doc', { ...cap, personId: 'K', version: Kid.version }), 422, /adults/);
    assert.equal(hh('doc', { ...cap, note: 'short' }), null);
    assert.equal(P.capacity, undefined);
  });
  const cap1 = hh('doc', { type: 'capacityRecord', personId: 'P', version: P.version, state: 'lacks-capacity', evidence: 'CAP-1', note: 'Assessed for the decision to share records' });
  check(() => { assert.equal(H.capacityOf(P), 'lacks-capacity'); assert.deepEqual(cap1.grantsEnded, []); assert.match(audits('capacityRecord').at(-1).detail, /lacks capacity to decide \(evidence CAP-1\)/); });
  check(() => {
    status(() => hh('asha', grantCmd({ version: P.version, proxyPersonId: 'K', relationship: 'child', authority: 'nominated', purposes: ['appointments'] })), 422, /cannot nominate/);
  });
  // The nominated grant made while the person had capacity stays in force; a capacity representative can now be recorded.
  const capRep = hh('asha', grantCmd({ version: P.version, proxyPersonId: 'Q', relationship: 'child', authority: 'capacity-representative', purposes: ['consent-decisions'] }));
  check(() => { assert.equal(H.grantState(P, P.proxies.find(x => x.id === capRep.grantId), now), 'in-force'); assert.equal(H.grantState(P, P.proxies.find(x => x.id === first.grantId), now), 'in-force'); });

  // 5. Consent decisions: the person, a representative, capacity, purpose and the audit of each use.
  check(() => {
    const give = over => ({ type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P.version, ...over });
    status(() => consent('asha', give()), 422, /lacking capacity/);
    status(() => consent('asha', give({ representative: { grantId: teenShare.grantId, proxyPersonId: 'T' } })), 422, /does not cover consent decisions/);
    status(() => consent('asha', give({ representative: { grantId: capRep.grantId, proxyPersonId: 'H' } })), 422, /different representative/);
    status(() => consent('asha', give({ representative: { grantId: renewal.grantId, proxyPersonId: 'H' } })), 422, /starts on/);
    status(() => consent('sup', give({ representative: { grantId: capRep.grantId, proxyPersonId: 'Q' } })), 403);
    assert.equal(P.consentHistory, undefined);
  });
  const given = consent('asha', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P.version, representative: { grantId: capRep.grantId, proxyPersonId: 'Q' } });
  check(() => {
    const e = P.consentHistory.at(-1);
    assert.equal(P.exchangeConsent, true); assert.equal(e.decidedBy, 'representative');
    assert.deepEqual(e.representative, { grantId: capRep.grantId, proxyPersonId: 'Q', relationship: 'child', authority: 'capacity-representative', from: now, expiresAt: at(60) });
    assert.equal(given.decidedBy, 'representative'); assert.equal(given.representative.grantId, capRep.grantId);
    const a = audits('setConsent').at(-1); assert.match(a.detail, /Decided by a representative \(record Q; the person's child; representative of an adult who lacks capacity; grant/);
    const u = audits('proxyUse').at(-1); assert.equal(u.subject, capRep.grantId); assert.equal(u.personId, 'P'); assert.match(u.detail, new RegExp(`consent decisions \\(setConsent ${e.id}\\)`)); assert.doesNotMatch(u.detail, /Other team Q/, 'no name in audit text');
  });
  // A withdrawal is always recorded, even as the person's own while they are recorded as lacking capacity.
  check(() => { const r = consent('asha', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: false, version: P.version }); assert.equal(r.decidedBy, 'person'); assert.equal(P.consentHistory.at(-1).decidedBy, 'person'); assert.equal(P.exchangeConsent, false); });
  // Regaining capacity ends the capacity representative's grant at once; the person decides again.
  const regained = hh('doc', { type: 'capacityRecord', personId: 'P', version: P.version, state: 'has-capacity', evidence: 'CAP-2', note: 'Reassessed after recovery; decides for herself' });
  check(() => {
    assert.deepEqual(regained.grantsEnded, [capRep.grantId]); assert.equal(P.capacity.length, 2, 'append-only');
    status(() => consent('asha', { type: 'setConsent', personId: 'P', purpose: 'ai', active: true, version: P.version, representative: { grantId: capRep.grantId, proxyPersonId: 'Q' } }), 422, /ended when a clinician recorded/);
    const own = consent('asha', { type: 'setConsent', personId: 'P', purpose: 'ai', active: true, version: P.version }); assert.equal(own.decidedBy, 'person');
  });
  // withdrawConsent by the nominated representative.
  const uses = audits('proxyUse').length;
  const w = consent('asha', { type: 'withdrawConsent', personId: 'P', version: P.version, purpose: 'ai', channel: 'in-person', reference: 'FORM-REP-1', reason: 'Sibling withdraws AI use on her behalf', representative: { grantId: first.grantId, proxyPersonId: 'H' } });
  check(() => { assert.equal(w.decidedBy, 'representative'); assert.equal(P.consentHistory.at(-1).representative.authority, 'nominated'); assert.equal(audits('proxyUse').length, uses + 1); assert.equal(P.aiConsent, false); });
  check(() => status(() => consent('asha', { type: 'withdrawConsent', personId: 'P', version: P.version, purpose: 'exchange', channel: 'in-person', reference: 'FORM-REP-2', reason: 'An unknown field on the representative is refused', representative: { grantId: first.grantId, proxyPersonId: 'H', extra: 1 } }), 422));

  // 6. A parent's authority ends at 18: consent for the child, then the same grant refused once the recorded age is 18.
  Kid.proxies = [g({ id: 'gk', purposes: ['consent-decisions', 'care-coordination'] })];
  check(() => { const r = consent('asha', { type: 'setConsent', personId: 'K', purpose: 'exchange', active: true, version: Kid.version, representative: { grantId: 'gk', proxyPersonId: 'H' } }); assert.equal(r.representative.authority, 'parent-of-minor'); });
  check(() => { Kid.age = 18; status(() => consent('asha', { type: 'setConsent', personId: 'K', purpose: 'ai', active: true, version: Kid.version, representative: { grantId: 'gk', proxyPersonId: 'H' } }), 422, /turns 18/); Kid.age = 12; });

  // 7. Rights requests by a representative.
  check(() => {
    const create = over => ({ type: 'rightsCreate', personId: 'P', kind: 'access', channel: 'in-person', requester: 'proxy', identityCheck: 'Sibling ID seen', detail: 'Asks for a copy of the records on her behalf', ...over });
    status(() => rights('asha', create({ proxyGrantId: teenShare.grantId })), 422, /does not cover rights requests/);
    status(() => rights('asha', create({ proxyGrantId: capRep.grantId })), 422, /ended/);
    status(() => rights('asha', create({ proxyGrantId: renewal.grantId })), 422, /starts on/);
    status(() => rights('asha', create({ proxyGrantId: first.grantId }), at(61)), 422, /expired/);
    status(() => rights('adm', create({ proxyGrantId: first.grantId })), 403);
    assert.equal((s.rightsRequests ?? []).length, 0);
    const before = audits('proxyUse').length, made = rights('asha', create({ proxyGrantId: first.grantId })), r = s.rightsRequests.at(-1);
    assert.equal(r.representative.grantId, first.grantId); assert.equal(r.representative.relationship, 'sibling'); assert.equal(made.representative.authority, 'nominated');
    assert.match(audits('rightsCreate').at(-1).detail, /made by a representative \(record H; the person's sibling; nominated by the person/);
    assert.equal(audits('proxyUse').length, before + 1); assert.match(audits('proxyUse').at(-1).detail, /rights requests \(rightsCreate /);
    const v = R.rightsView(s, as('asha'), 'P', now); assert.deepEqual(v.proxies.map(x => x.id), [first.grantId], 'only grants in force that cover rights requests'); assert.equal(v.proxies[0].name, 'Relative H');
    const v2 = R.rightsView(s, as('asha'), 'P', at(61)); assert.deepEqual(v2.proxies.map(x => x.id), [renewal.grantId], 'the renewal once it starts');
  });

  // 8. Household sharing honours the authority: no authority, a parent's authority after 18, and the out-of-scope rule.
  check(() => {
    const h = s.households[0], share = (who, purpose = 'care-coordination') => H.shareable(s, h, who, purpose, now).members.map(m => m.personId);
    assert.ok(share(Rep).includes('K'));
    Kid.proxies = [g({ id: 'gk', purposes: ['care-coordination'], authority: undefined })]; assert.equal(share(Rep).includes('K'), false, 'a grant without authority discloses nothing');
    Kid.proxies = [g({ id: 'gk', purposes: ['care-coordination'] })]; Kid.age = 18; assert.equal(share(Rep).includes('K'), false, 'a parent\'s authority ends at 18'); Kid.age = 12;
    assert.equal(share(Rep, 'appointments').includes('K'), false, 'purpose must match');
    assert.ok(share(Teen, 'appointments').includes('P'), 'a minor may receive appointment information under a nomination');
  });
  // 9. The household view states each grant's state and whether it can be revoked.
  check(() => {
    const v = H.householdView(s, as('asha'), P, null, 'appointments', now), mine = v.members.find(m => m.personId === 'P');
    const byId = Object.fromEntries(mine.proxies.map(x => [x.id, x]));
    assert.equal(mine.capacity, 'has-capacity');
    assert.equal(byId[first.grantId].state, 'in-force'); assert.equal(byId[renewal.grantId].state, 'not-started'); assert.equal(byId[renewal.grantId].revocable, true);
    assert.equal(byId[capRep.grantId].state, 'capacity-regained'); assert.equal(byId[capRep.grantId].proxyName, 'Person not shown in this household view', 'out-of-scope representative not named (slice 6r)');
  });
  // 10. Classification: capacity records are refused on a merged record and outside emergency-access care.
  check(() => { assert.ok(Mg.BLOCKED_WHEN_MERGED.has('capacityRecord')); });

  const result = { suite: 'proxy authority contract (slice 14b)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/proxy-authority-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
