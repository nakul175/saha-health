// Slice 10e contract: issuer-identifier search, ABHA number format checks and programme identity crosswalks (BR-ID-05,
// BR-ID-08, BR-INT-14). ABHA format (14 digits or hyphenated 2-4-4-4, no checksum) in one rule shared by the search and the
// ABHA link schema; exact, complete identifiers only; search matches only inside the searcher's care scope; the identifier
// ledger (link, correct and withdraw append, nothing is edited or removed); provenance on every entry; one live holder per
// identifier with conflicts sent to the slice 1c identity case path and never merged; the neutral refusal and bounded
// steward-review event for a holder outside the requester's scope; slice 2h matching and uniqueness follow current entries.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.identifier-crosswalk-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
const throwsAt = (fn, status, pattern) => { assert.throws(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['crosswalk', 'identifier-search', 'merge', 'record-import', 'import-rejections', 'operations', 'report-export', 'patient-import', 'adapter-operations', 'core','visit-import', 'access', 'continuity', 'delegation', 'environment', 'identity', 'referral-rules', 'fact-provenance', 'mis', 'programmes', 'types', 'abdm'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  // crosswalk-server is exercised with a recording stand-in for the audit writer and a small in-memory audit table.
  writeFileSync(join(dir, 'access-audit.js'), `export const recorded=[];export async function recordAccesses(db,s,u,m,list,now){for(const a of list){recorded.push({...a,actorId:u.userId});db.events.push({org_id:s.organisation.id,actor_id:u.userId,action:a.action,person_id:a.personId??null,subject:a.subject,at:now});}return [];}`);
  writeFileSync(join(dir, 'crosswalk-server.js'), ts.transpileModule(readFileSync('lib/saha/crosswalk-server.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const imp = n => import(pathToFileURL(join(dir, n + '.js')));
  const [C, S, R, AB, TY, MG, AU, CS, P] = await Promise.all(['crosswalk', 'identifier-search', 'record-import', 'abdm', 'types', 'merge', 'access-audit', 'crosswalk-server', 'patient-import'].map(imp));
  const now = '2026-10-02T09:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: `Name ${userId}`, accountCode: 'C'.repeat(24), role, isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now, ...extra });
  const owner = member('owner', 'clinician', { isOwner: true }), sup = member('sup', 'supervisor'), clin = member('clin', 'clinician'), asha = member('asha', 'asha'), admin = member('adm', 'admin', { isOwner: true, teamIds: [] }), provider = member('prov', 'provider');
  const person = (id, name, teamId = 'default', extra = {}) => ({ id, name, age: 40, sex: 'Female', village: 'Lakeside', programmes: ['General care'], task: '', due: '', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId, assignedTo: 'asha', ...extra });
  const imported = (issuer, value, row = 1) => ({ issuer, value, verified: false, recordedAt: now, recordedBy: 'owner', source: 'import', imported: { batchId: 'b0', row, planHash: '0'.repeat(64) } });
  const state = () => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner, sup, clin, asha], invitations: [], identityCases: [],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [
      person('p1', 'Synthetic Person One', 'default', { identifiers: [imported('rch', '111122223333')] }),
      person('p2', 'Synthetic Other Team', 'north', { identifiers: [imported('nikshay', '1234567')], abha: { state: 'linked', number: '91-1234-5678-9012', verification: 'mock-otp', at: now, by: 'owner', history: [] } }),
      person('p3', 'Synthetic Person Three', 'default', {}),
      person('p4', 'Synthetic Merged', 'default', { mergedInto: { personId: 'p1', caseId: 'c1', at: now }, identifiers: [imported('rch', '444455556666')] }),
      person('p5', 'Synthetic Person Five', 'default', { assignedTo: 'someone-else', identifiers: [imported('rch', '555566667777')] }),
      person('p6', 'Synthetic Person Six', 'default', { abha: { state: 'linked', number: '91-0000-1111-2222', verification: 'mock-otp', at: now, by: 'owner', history: [] } })], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  const actor = u => ({ userId: u.userId, displayName: u.displayName, email: 'x@example.invalid' });
  const link = (personId, over = {}) => ({ type: 'identifierLink', personId, version: 1, issuer: 'rch', identifier: '123456789012', origin: 'programme-card', verification: 'unverified', reason: 'Synthetic link for testing', ...over });
  const run = (s, m, c) => C.applyCrosswalk(s, c, actor(m), m, now);
  const P_ = (s, id) => s.workspace.people.find(p => p.id === id);

  // 1. ABHA number format: 14 digits or hyphenated 2-4-4-4, one rule shared by search and link; no checksum.
  const GOOD = ['91-1234-5678-9012', '91123456789012', '12-3456-7890-1234', '00-0000-0000-0000'], BAD = ['', '9112345678901', '911234567890123', '91-1234-5678-901', '91-12345678-9012', '9-11234-5678-9012', '91 1234 5678 9012', '91-1234-5678-90AB', '91-1234-5678-*', '91-1234-%', 'abc', '91_1234_5678_9012', '91-1234-5678-9012-', '٩١-١٢٣٤-٥٦٧٨-٩٠١٢'];
  check(() => { for (const g of GOOD) { const r = S.parseAbha(g); assert.equal(r.ok, true, g); assert.match(r.number, /^\d{2}-\d{4}-\d{4}-\d{4}$/); } assert.equal(S.parseAbha('91123456789012').number, '91-1234-5678-9012'); assert.equal(S.parseAbha('  91-1234-5678-9012 ').number, '91-1234-5678-9012'); });
  check(() => { for (const b of BAD) { const r = S.parseAbha(b); assert.equal(r.ok, false, JSON.stringify(b)); assert.match(r.reason, /14-digit ABHA number/); } });
  check(() => { const abdm = n => AB.abdmSchema.safeParse({ type: 'abhaLink', personId: 'p', version: 1, abhaNumber: n, otp: '123456' }); for (const g of GOOD) { const r = abdm(g); assert.equal(r.success, true, g); assert.equal(r.data.abhaNumber, S.parseAbha(g).number, 'the link schema normalises as the search does'); } for (const b of BAD) assert.equal(abdm(b).success, false, `the link schema refuses ${JSON.stringify(b)} like the search`); });
  check(() => { assert.equal(S.parseAbha('12345678901234').ok, true, 'no checksum: any 14 digits pass the format check'); const src = readFileSync('lib/saha/identifier-search.ts', 'utf8'); assert.match(src, /No checksum is applied/); assert.match(src, /random 14-digit/); assert.match(src, /no official ABDM or National[\s/]+Health Authority document found/); });

  // 2. Search input: exact and complete identifiers only.
  check(() => { assert.deepEqual(S.SEARCH_ISSUERS, ['abha', 'rch', 'nikshay']); assert.deepEqual(S.checkSearch('abha', '91123456789012'), { issuer: 'abha', value: '91-1234-5678-9012' }); assert.deepEqual(S.checkSearch('rch', '111122223333'), { issuer: 'rch', value: '111122223333' }); assert.deepEqual(S.checkSearch('nikshay', '1234567'), { issuer: 'nikshay', value: '1234567' }); });
  throwsAt(() => S.checkSearch('abha', '91-1234-'), 422, /partial number is not searched/);
  throwsAt(() => S.checkSearch('abha', '91-1234-5678-*'), 422, /partial number is not searched/);
  throwsAt(() => S.checkSearch('rch', '1111222233'), 422, /12 digits.*partial identifier is not searched/);
  throwsAt(() => S.checkSearch('rch', '1111222233%'), 422, /partial identifier is not searched/);
  throwsAt(() => S.checkSearch('nikshay', '12345'), 422, /6 to 10 digits/);
  throwsAt(() => S.checkSearch('nikshay', '1234567890123'), 422, /6 to 10 digits/);
  throwsAt(() => S.checkSearch('local_mrn', '123'), 422, /Search by one of: abha, rch, nikshay/);
  check(() => { assert.equal(S.searchInput.safeParse({ issuer: 'rch' }).success, false); assert.equal(S.searchInput.safeParse({ issuer: 'rch', identifier: '1', person: 'p1' }).success, false, 'strict'); assert.equal(S.searchInput.safeParse({ issuer: 'RCH', identifier: ' 111122223333 ' }).data.issuer, 'rch'); });

  // 3. Matching inside the searcher's care scope only.
  const ids = (list) => list.map(x => x.personId);
  { const s = state(), people = s.workspace.people, at = { ...owner, role: 'clinician' };
    check(() => { assert.deepEqual(ids(S.findMatches(people, owner, 'rch', '111122223333', now)), ['p1']); const [x] = S.findMatches(people, owner, 'rch', '111122223333', now); assert.equal(x.identifier, 'XXXXXXXX3333'); assert.equal(x.source, 'import'); assert.equal(x.verified, false); assert.equal(x.verification, 'unverified'); assert.equal(x.name, 'Synthetic Person One'); });
    check(() => { assert.deepEqual(S.findMatches(people, owner, 'nikshay', '1234567', now), [], 'a record in another team is neither returned nor counted'); assert.deepEqual(S.findMatches(people, owner, 'abha', '91-1234-5678-9012', now), [], 'an ABHA held outside the care scope is not found'); assert.deepEqual(S.findMatches(people, owner, 'rch', '999900001111', now), []); });
    check(() => { const north = member('n', 'clinician', { teamIds: ['north'] }); assert.deepEqual(ids(S.findMatches(people, north, 'nikshay', '1234567', now)), ['p2']); const [x] = S.findMatches(people, north, 'abha', '91-1234-5678-9012', now); assert.equal(x.personId, 'p2'); assert.equal(x.identifier, '91-XXXX-XXXX-9012'); assert.equal(x.source, 'abha-link'); assert.equal(x.verified, false); assert.match(x.verification, /not verified with ABDM/); });
    check(() => { assert.deepEqual(S.findMatches(people, asha, 'rch', '555566667777', now), [], 'an ASHA finds only records assigned to them'); assert.deepEqual(ids(S.findMatches(people, asha, 'rch', '111122223333', now)), ['p1']); assert.deepEqual(S.findMatches(people, admin, 'rch', '111122223333', now), [], 'an administrator has no patient scope'); assert.deepEqual(S.findMatches(people, provider, 'rch', '111122223333', now), []); assert.deepEqual(S.findMatches(people, member('sus', 'clinician', { status: 'suspended' }), 'rch', '111122223333', now), []); });
    check(() => { const grant = { id: 'g1', userId: 'north-c', from: now, until: '2026-10-03T00:00:00.000Z' }; people[1].exceptionalAccess = [grant]; const north = member('north-c', 'clinician', { teamIds: ['north'] }), outsider = member('north-c', 'clinician', { teamIds: ['other'] }); assert.deepEqual(ids(S.findMatches(people, outsider, 'nikshay', '1234567', now)), ['p2'], 'an emergency-access grant counts as scope (the read is audited with the grant id)'); delete people[1].exceptionalAccess; assert.deepEqual(S.findMatches(people, outsider, 'nikshay', '1234567', now), []); });
    check(() => { const m = S.findMatches(people, owner, 'rch', '444455556666', now); assert.deepEqual(ids(m), ['p4']); assert.deepEqual(m[0].merged, { survivorId: 'p1' }, 'a merged record points at its survivor when the searcher may see it'); const alone = S.findMatches([people[3]], owner, 'rch', '444455556666', now); assert.deepEqual(alone[0].merged, { survivorId: null }, 'a survivor that was not loaded or is outside scope is not named'); });
    check(() => { const dup = state(), ps = dup.workspace.people; ps[0].identifiers.push({ ...imported('rch', '444455556666', 2) }); assert.deepEqual(ids(S.findMatches(ps, owner, 'rch', '444455556666', now)), ['p1', 'p4'], 'live records come before merged ones'); });
    check(() => { const x = state(), ps = x.workspace.people; ps[5].abha.state = 'none'; assert.deepEqual(S.findMatches(ps, owner, 'abha', '91-0000-1111-2222', now), [], 'an unlinked ABHA does not match'); });
    check(() => { assert.equal(S.overLimit({ hour: 29, missHour: 7, missDay: 23 }), false); assert.equal(S.overLimit({ hour: 30, missHour: 0, missDay: 0 }), true); assert.equal(S.overLimit({ hour: 8, missHour: 8, missDay: 8 }), true); assert.equal(S.overLimit({ hour: 8, missHour: 1, missDay: 24 }), true); assert.deepEqual([S.SEARCH_LIMIT_HOUR, S.MISS_LIMIT_HOUR, S.MISS_LIMIT_DAY], [30, 8, 24]); assert.match(S.SEARCH_LIMITED, /Too many identifier searches/); assert.equal(S.NO_MATCH, 'No record in your care scope carries this identifier.'); });
  }

  // 4. Linking: authority, formats, evidence, one current identifier per issuer.
  check(() => { assert.equal(C.crosswalkSchema.safeParse(link('p3')).success, true); assert.equal(C.crosswalkSchema.safeParse({ ...link('p3'), extra: 1 }).success, false); assert.equal(C.crosswalkSchema.safeParse(link('p3', { origin: 'guess' })).success, false); assert.equal(C.crosswalkSchema.safeParse(link('p3', { verification: 'verified' })).success, false); assert.equal(C.crosswalkSchema.safeParse(link('p3', { reason: 'short' })).success, false); assert.equal(C.crosswalkSchema.safeParse({ type: 'identifierWithdraw', personId: 'p', version: 1, entryId: 'e', reason: 'short' }).success, false); assert.equal(run(state(), owner, { type: 'saveVisit' }), null, 'other commands are not handled here'); });
  for (const [who, text] of [[admin, /care role/], [provider, /care role/], [member('sus', 'supervisor', { status: 'suspended' }), /care role/]]) throwsAt(() => run(state(), who, link('p3')), 403, text);
  throwsAt(() => run(state(), asha, link('p3', { verification: 'issuer-checked', evidence: 'RCH portal lookup' })), 403, /clinician or supervisor records an identifier as checked/);
  throwsAt(() => run(state(), asha, { type: 'identifierWithdraw', personId: 'p1', version: 1, entryId: 'import:b0:1', reason: 'Wrongly entered earlier' }), 403, /clinician or supervisor withdraws/);
  throwsAt(() => run(state(), owner, link('p3', { issuer: 'abha', identifier: '91-1234-5678-9012' })), 422, /linked through ABHA verification/);
  throwsAt(() => run(state(), owner, link('p3', { issuer: 'rch', identifier: '91123456789012' })), 422, /linked through ABHA verification/);
  throwsAt(() => run(state(), owner, link('p3', { issuer: 'healthid', identifier: 'A1' })), 422, /linked through ABHA verification/);
  throwsAt(() => run(state(), owner, link('p3', { issuer: 'local_mrn', identifier: 'M-1' })), 422, /Issuer must be one of: rch, nikshay/);
  throwsAt(() => run(state(), owner, link('p3', { identifier: '12345' })), 422, /An RCH ID is 12 digits/);
  throwsAt(() => run(state(), owner, link('p3', { issuer: 'nikshay', identifier: '=SUM(A1)' })), 422, /Identifier must be 1 to 64 letters/);
  throwsAt(() => run(state(), owner, link('p3', { verification: 'document-seen' })), 422, /Describe the evidence/);
  throwsAt(() => run(state(), owner, link('p3', { version: 7 })), 409, /This record changed/);
  throwsAt(() => run(state(), owner, link('nosuch')), 404, /Patient not found/);
  throwsAt(() => run(state(), owner, link('p4', { identifier: '777788889999' })), 409, /merged into another record/);
  throwsAt(() => run(state(), owner, link('p1', { identifier: '999988887777' })), 409, /already has a RCH ID\. Record a correction that names it/);
  throwsAt(() => run(state(), owner, link('p1', { identifier: '111122223333' })), 409, /already recorded on this record\. To change how it was verified/);
  throwsAt(() => run(state(), owner, link('p1', { identifier: '999988887777', corrects: 'nosuch' })), 404, /No current RCH ID on this record has that reference/);
  throwsAt(() => run(state(), owner, link('p1', { issuer: 'nikshay', identifier: '7654321', corrects: 'import:b0:1' })), 404, /No current Ni-kshay ID/);
  { // A successful link records provenance and a masked audit line; nothing else changes.
    const s = state(), before = structuredClone(s), r = run(s, asha, link('p3', { origin: 'programme-system', verification: 'document-seen', evidence: 'RCH card sighted at the home visit' })), p3 = P_(s, 'p3'), [e] = p3.identifiers;
    check(() => { assert.deepEqual([r.linked, r.current], [true, 1]); assert.equal(r.entryId, e.id); assert.equal(JSON.stringify(r).includes('123456789012'), false, 'no identifier value in the command result'); });
    check(() => { assert.deepEqual(Object.keys(e).sort(), ['evidence', 'id', 'issuer', 'kind', 'origin', 'reason', 'recordedAt', 'recordedBy', 'source', 'value', 'verification', 'verified']); assert.deepEqual([e.kind, e.issuer, e.value, e.verified, e.recordedBy, e.recordedAt, e.source, e.origin, e.verification, e.evidence], ['link', 'rch', '123456789012', false, 'asha', now, 'crosswalk', 'programme-system', 'document-seen', 'RCH card sighted at the home visit']); });
    check(() => { assert.deepEqual(s.workspace.people.filter(p => p.id !== 'p3'), before.workspace.people.filter(p => p.id !== 'p3'), 'no other record changed'); assert.deepEqual(s.identityCases, [], 'no identity case'); assert.equal(s.workspace.audit.length, 1); const a = s.workspace.audit[0]; assert.deepEqual([a.action, a.personId, a.actorId, a.role], ['identifierLink', 'p3', 'asha', 'asha']); assert.match(a.detail, /RCH ID XXXXXXXX9012 linked \(looked up in the programme's own system; document seen\)\. Not verified by Saha\./); assert.equal(a.detail.includes('123456789012'), false); });
    check(() => { const t = run(s, sup, { type: 'identifierLink', personId: 'p3', version: 1, issuer: 'nikshay', identifier: '7654321', origin: 'person-reported', verification: 'unverified', reason: 'Told by the person at a visit' }); assert.equal(t.current, 2); assert.equal(P_(s, 'p3').identifiers.length, 2); });
    // An issuer-checked entry by a steward is attested, not checked by Saha.
    const t = state(); run(t, clin, link('p3', { verification: 'issuer-checked', evidence: 'RCH portal lookup, reference 8841' }));
    check(() => { const [x] = P_(t, 'p3').identifiers; assert.deepEqual([x.verified, x.verification, x.evidence], [true, 'issuer-checked', 'RCH portal lookup, reference 8841']); assert.match(t.workspace.audit[0].detail, /checked with the issuer by a clinician or supervisor\)\. Not verified by Saha/); });
  }

  // 5. Corrections and withdrawals append; nothing is edited or removed.
  { const s = state(), [first] = [run(s, owner, link('p3'))], p3 = () => P_(s, 'p3');
    const snap0 = structuredClone(p3().identifiers[0]);
    s.workspace.people[2].version = 2;
    const fix = run(s, owner, link('p3', { version: 2, identifier: '123456789013', corrects: first.entryId, reason: 'Corrected a mistyped digit' }));
    check(() => { assert.equal(p3().identifiers.length, 2); assert.deepEqual(p3().identifiers[0], snap0, 'the earlier entry is not edited'); const e = p3().identifiers[1]; assert.deepEqual([e.kind, e.corrects, e.value, e.id], ['correct', first.entryId, '123456789013', fix.entryId]); assert.deepEqual(TY.currentIdentifiers(p3()).map(x => x.value), ['123456789013']); assert.equal(fix.current, 1); });
    check(() => { const same = state(), a = run(same, owner, link('p3')); same.workspace.people[2].version = 2; run(same, clin, link('p3', { version: 2, verification: 'issuer-checked', evidence: 'Portal lookup', corrects: a.entryId, reason: 'Checked against the portal' })); const [x, y] = P_(same, 'p3').identifiers; assert.deepEqual([x.verified, y.verified, y.kind, y.value === x.value], [false, true, 'correct', true], 'a correction with the same value records a change of verification state'); assert.equal(TY.currentIdentifiers(P_(same, 'p3')).length, 1); });
    throwsAt(() => run(s, owner, link('p3', { version: 2, identifier: '123456789014', corrects: first.entryId })), 404, /No current RCH ID on this record has that reference/);
    // Withdrawal.
    const w = run(s, sup, { type: 'identifierWithdraw', personId: 'p3', version: 2, entryId: fix.entryId, reason: 'Entered on the wrong record' });
    check(() => { assert.deepEqual([w.withdrawn, w.current], [true, 0]); assert.equal(p3().identifiers.length, 3); const x = p3().identifiers[2]; assert.deepEqual([x.kind, x.corrects, x.value, x.source, x.reason], ['withdraw', fix.entryId, '123456789013', 'crosswalk', 'Entered on the wrong record']); assert.deepEqual(TY.currentIdentifiers(p3()), []); assert.match(s.workspace.audit.at(-1).detail, /RCH ID XXXXXXXX9013 withdrawn from this record; the earlier entry is kept in its history/); assert.equal(s.workspace.audit.at(-1).detail.includes('123456789013'), false); });
    throwsAt(() => run(s, sup, { type: 'identifierWithdraw', personId: 'p3', version: 2, entryId: fix.entryId, reason: 'Entered on the wrong record' }), 404, /No current identifier on this record has that reference/);
    check(() => { const again = run(s, owner, link('p3', { version: 2, identifier: '123456789015' })); assert.equal(again.linked, true); assert.equal(p3().identifiers.at(-1).kind, 'link', 'after a withdrawal the issuer is open again'); assert.equal(p3().identifiers.length, 4); });
    // A slice 2h imported entry is corrected or withdrawn by its import reference.
    const q = state();
    run(q, owner, link('p1', { identifier: '111122223334', corrects: 'import:b0:1', reason: 'Imported value was wrong' }));
    check(() => { const [imp, fixed] = P_(q, 'p1').identifiers; assert.deepEqual(imp, imported('rch', '111122223333'), 'the imported entry is kept as imported'); assert.deepEqual([fixed.kind, fixed.corrects], ['correct', 'import:b0:1']); assert.deepEqual(TY.currentIdentifiers(P_(q, 'p1')).map(x => x.value), ['111122223334']); });
    const q2 = state(); run(q2, sup, { type: 'identifierWithdraw', personId: 'p1', version: 1, entryId: 'import:b0:1', reason: 'Imported against the wrong person' });
    check(() => { assert.deepEqual(TY.currentIdentifiers(P_(q2, 'p1')), []); assert.equal(P_(q2, 'p1').identifiers.length, 2); });
    // The ledger is bounded.
    const big = state(); big.workspace.people[2].identifiers = Array.from({ length: C.MAX_ENTRIES }, (_, i) => ({ id: `e${i}`, kind: 'withdraw', corrects: `x${i}`, issuer: 'rch', value: '1', verified: false, recordedAt: now, recordedBy: 'owner', source: 'crosswalk' }));
    throwsAt(() => run(big, owner, link('p3')), 422, /already has 50 identifier entries/);
  }

  // 6. Conflicts: one live holder per identifier; never an automatic merge.
  { const s = state(), r = run(s, owner, link('p3', { identifier: '555566667777' }));
    check(() => { assert.deepEqual(r, { linked: false, conflict: { personId: 'p5', caseId: s.identityCases[0].id } }); assert.equal(P_(s, 'p3').identifiers, undefined, 'the identifier is not recorded on either record until stewards decide'); const k = s.identityCases[0]; assert.deepEqual([k.state, k.survivorId, k.duplicateId, k.proposedBy, k.evidence], ['proposed', 'p5', 'p3', 'owner', 'Same rch identifier']); assert.match(k.reason, /same RCH ID \(XXXXXXXX7777\) was entered on this record and is already recorded on the other/); assert.equal(k.reason.includes('555566667777'), false); });
    check(() => { assert.equal(P_(s, 'p3').mergedInto, undefined); assert.equal(P_(s, 'p5').mergedInto, undefined); assert.equal(P_(s, 'p5').mergedFrom, undefined, 'nothing was merged'); assert.equal(s.identityCases.length, 1); const actions = s.workspace.audit.map(a => a.action); assert.deepEqual(actions, ['identityMergePropose', 'identifierLink']); assert.match(s.workspace.audit[1].detail, /not recorded.*identity case was opened for two stewards to decide; nothing was merged/); });
    // The proposal then follows the slice 1c path: the same steward cannot decide it, a different one can, and approving it is the only way records merge.
    check(() => { throwsAt(() => MG.applyMerge(s, { type: 'identityMergeDecide', caseId: s.identityCases[0].id, version: 1, decision: 'approve', reason: 'Same person, confirmed with the family' }, actor(owner), owner, now), 403, /different identity steward must review/); MG.applyMerge(s, { type: 'identityMergeDecide', caseId: s.identityCases[0].id, version: 1, decision: 'reject', reason: 'Two different people with a typing slip' }, actor(sup), sup, now); assert.equal(s.identityCases[0].state, 'rejected'); assert.equal(P_(s, 'p3').mergedInto, undefined); });
    // A second attempt while a proposal is open explains why no case was opened.
    const s2 = state(); run(s2, owner, link('p3', { identifier: '555566667777' }));
    throwsAt(() => run(s2, sup, link('p3', { identifier: '555566667777' })), 409, /identity review could not be opened: One of these records already has an open merge proposal/);
    // Not a steward: refused without a case.
    const s3 = state(); s3.workspace.people[4].assignedTo = 'asha';
    throwsAt(() => run(s3, asha, link('p3', { identifier: '555566667777' })), 409, /already recorded on another record you can see\. A clinician or supervisor can open an identity review/);
    check(() => { assert.deepEqual(s3.identityCases, []); assert.equal(P_(s3, 'p3').identifiers, undefined); });
    // A merged record's identifiers are not held: the survivor may take the value.
    const s4 = state(); const t = run(s4, owner, link('p1', { issuer: 'rch', identifier: '444455556666', corrects: 'import:b0:1' }));
    check(() => { assert.equal(t.linked, true); assert.deepEqual(s4.identityCases, []); });
    // A withdrawn or corrected value is free again.
    const s5 = state(); run(s5, sup, { type: 'identifierWithdraw', personId: 'p5', version: 1, entryId: 'import:b0:1', reason: 'Imported against the wrong person' });
    check(() => { const x = run(s5, owner, link('p3', { identifier: '555566667777' })); assert.equal(x.linked, true); assert.deepEqual(s5.identityCases, []); });
    const s6 = state(); const fixed = run(s6, owner, link('p5', { identifier: '555566667778', corrects: 'import:b0:1', reason: 'Fixing the imported digit' }));
    check(() => { assert.equal(fixed.linked, true); assert.equal(run(s6, owner, link('p3', { identifier: '555566667777' })).linked, true, 'the superseded value is free'); });
    check(() => { assert.equal(run(s6, owner, link('p6', { identifier: '555566667778' })).linked, false, 'the corrected value is held by p5 now'); assert.equal(s6.identityCases.length, 1); });
  }
  // A holder outside the requester's care scope: refused as IdentifierHeldElsewhere with the ordinary refusal; the requester is not told.
  { const s = state(); let err;
    try { run(s, owner, link('p3', { issuer: 'nikshay', identifier: '1234567' })); } catch (e) { err = e; }
    check(() => { assert.ok(err instanceof C.IdentifierHeldElsewhere); assert.equal(err.status, 422); assert.equal(err.message, C.IDENTIFIER_REFUSED); assert.deepEqual([err.personId, err.heldBy], ['p3', 'p2']); for (const x of ['p2', 'North', 'Other Team', '1234567']) assert.equal(err.message.includes(x), false, x); assert.deepEqual(s.identityCases, [], 'no case names a record the requester cannot see'); assert.equal(P_(s, 'p3').identifiers, undefined); });
    // Reached only through an emergency grant: also outside scope for this purpose (slice 6r).
    const g = state(); g.workspace.people[1].exceptionalAccess = [{ id: 'g1', userId: 'owner', from: now, until: '2026-10-03T00:00:00.000Z' }]; let err2; try { run(g, owner, link('p3', { issuer: 'nikshay', identifier: '1234567' })); } catch (e) { err2 = e; }
    check(() => { assert.ok(err2 instanceof C.IdentifierHeldElsewhere, 'emergency access cannot open an identity case'); assert.deepEqual(g.identityCases, []); });
  }
  // The server wrapper: one review event per requester and holding record a day; the oracle is bounded.
  { const events = [], db = { events, prepare: sql => ({ bind: (...b) => ({ all: async () => ({ results: events.filter(e => e.org_id === b[0] && e.actor_id === b[1] && e.action === 'identifierConflictReview' && e.at >= b[2]).map(e => ({ person_id: e.person_id })).filter((x, i, a) => a.findIndex(y => y.person_id === x.person_id) === i) }) }) }) };
    const s = state(); for (const n of ['p7', 'p8', 'p9', 'p10']) s.workspace.people.push(person(n, `Held ${n}`, 'north', { identifiers: [imported('rch', n === 'p7' ? '700000000007' : n === 'p8' ? '800000000008' : n === 'p9' ? '900000000009' : '100000000010')] }));
    const go = (c, m = owner) => CS.crosswalkWithReview(db, s, c, actor(m), m, now);
    const refuse = async c => { try { await go(c); return null; } catch (e) { return e; } };
    const e1 = await refuse(link('p3', { identifier: '700000000007' })), e1b = await refuse(link('p3', { identifier: '700000000007' }));
    check(() => { assert.deepEqual([e1.status, e1.message], [422, C.IDENTIFIER_REFUSED]); assert.equal(e1b.message, C.IDENTIFIER_REFUSED); assert.equal(AU.recorded.length, 1, 'a repeat for the same holder and requester adds no second event'); const r = AU.recorded[0]; assert.deepEqual([r.action, r.personId, r.subject, r.actorId], ['identifierConflictReview', 'p7', 'p7', 'owner']); assert.match(r.detail, /An identifier link on record p3 was refused because this record holds the same identifier/); for (const x of ['700000000007', 'Held p7']) assert.equal(r.detail.includes(x), false, x); });
    await refuse(link('p3', { identifier: '800000000008' })); await refuse(link('p3', { identifier: '900000000009' }));
    check(() => { assert.equal(AU.recorded.length, 3); assert.equal(CS.IDENTIFIER_REVIEW_LIMIT, 3); });
    // After the limit every further link by that requester is refused the same way, a conflicting one or not; validation errors still show first.
    const e4 = await refuse(link('p3', { identifier: '100000000010' })), e5 = await refuse(link('p3', { identifier: '123456789012' }));
    check(() => { assert.deepEqual([e4.status, e4.message], [422, C.IDENTIFIER_REFUSED]); assert.deepEqual([e5.status, e5.message], [422, C.IDENTIFIER_REFUSED], 'a link that would have succeeded is refused alike'); assert.equal(AU.recorded.length, 3, 'no further event'); assert.equal(P_(s, 'p3').identifiers, undefined, 'nothing was recorded'); });
    const e6 = await refuse(link('p3', { identifier: '12345' })), e7 = await refuse(link('p3', { version: 9 }));
    check(() => { assert.match(e6.message, /An RCH ID is 12 digits/); assert.match(e7.message, /This record changed/); });
    // Another requester has their own count; non-link commands are untouched.
    const other = member('clin', 'clinician'), r8 = await go(link('p3', { identifier: '123456789012' }), other);
    check(() => { assert.equal(r8.linked, true); assert.equal(AU.recorded.length, 3); });
    assert.equal(await go({ type: 'saveVisit' }), null); passed++;
  }
  // The record import (slice 2h) follows current entries: a corrected or withdrawn value neither matches a record nor blocks the value elsewhere.
  { const s = state(), IH = 'person,issuer,identifier', plan = (st, csv) => R.planRecordImport(st, owner, 'identifiers', csv, 'synthetic', now);
    run(s, owner, link('p3', { identifier: '123456789012' }));
    s.workspace.people[2].version = 2; run(s, owner, link('p3', { version: 2, identifier: '123456789013', corrects: P_(s, 'p3').identifiers[0].id }));
    check(() => { assert.equal(R.resolvePerson(s, owner, 'rch:123456789013', now).person?.id, 'p3'); assert.equal(R.resolvePerson(s, owner, 'rch:123456789012', now).person, undefined, 'a superseded value does not resolve a record'); });
    const p = await plan(s, [IH, 'p6,rch,123456789012', 'p6,rch,123456789013'].join('\n'));
    check(() => { assert.equal(p.rows[0].status, 'accepted', 'a superseded value is free'); assert.match(p.rows[1].reasons[0], /already recorded on another record you can see/); assert.equal(p.rows[1].conflict.personId, 'p3'); });
    const w = state(); run(w, sup, { type: 'identifierWithdraw', personId: 'p1', version: 1, entryId: 'import:b0:1', reason: 'Imported against the wrong person' });
    const q = await plan(w, [IH, 'p3,rch,111122223333', 'p1,rch,999900001111'].join('\n'));
    check(() => { assert.equal(q.rows[0].status, 'accepted', 'a withdrawn value is free'); assert.equal(q.rows[1].status, 'accepted', 'a record with only a withdrawn issuer entry may take a new one'); });
  }
  // Snapshots and history mask every ledger entry's value like imported ones; the stored record keeps it.
  { const s = state(); run(s, owner, link('p3', { origin: 'programme-system' })); const p3 = P_(s, 'p3'), red = AB.redactAbha(p3);
    check(() => { assert.equal(red.identifiers[0].value, 'XXXXXXXX9012'); assert.equal(red.identifiers[0].id, p3.identifiers[0].id, 'the entry reference stays visible so it can be corrected'); assert.equal(red.identifiers[0].origin, 'programme-system'); assert.equal(p3.identifiers[0].value, '123456789012'); assert.equal(JSON.stringify(AB.redactRevision({ entityType: 'person', data: p3, changes: [] })).includes('123456789012'), false); });
  }
  // Wiring: routes, audit action names, merged-record rule, replay authority, and the order of audit and return.
  check(() => { for (const n of ['identifierSearch', 'identifierSearchMiss', 'identifierConflictReview']) { assert.ok(TY.ACCESS_ACTION_NAMES.includes(n), n); assert.match(readFileSync('lib/saha/access-audit.ts', 'utf8'), new RegExp(`\\n  ${n}:`)); } const AA = readFileSync('lib/saha/access-audit.ts', 'utf8'), names = [...AA.matchAll(/^  (\w+): '/gm)].map(x => x[1]); assert.deepEqual([...TY.ACCESS_ACTION_NAMES].sort(), names.sort(), 'one action list shared by server and screen'); });
  check(() => { const src = readFileSync('lib/saha/identifier-search-server.ts', 'utf8'), route = readFileSync('app/api/identifier-search/route.ts', 'utf8'); assert.match(route, /export async function POST/); assert.equal(/export async function (GET|PUT|PATCH|DELETE)/.test(route), false, 'POST only'); assert.equal(src.includes('searchParams'), false, 'the identifier never travels in a URL'); const audit = src.indexOf('await recordAccesses(db(),s,u,m,matches.map'), miss = src.indexOf("action:'identifierSearchMiss'"), ret = src.indexOf('return json({issuer'); assert.ok(audit > 0 && miss > audit && ret > miss, 'every search is recorded before its result is returned'); assert.ok(src.indexOf('fail(429,SEARCH_LIMITED)') > 0 && src.indexOf('fail(429,SEARCH_LIMITED)') < src.indexOf('SELECT p.id'), 'the rate limit is checked before any record is read'); assert.ok(src.indexOf("vs.sql==='0'") < src.indexOf('SELECT COUNT(DISTINCT subject)'), 'a searcher with no patient scope is refused before anything is counted or read'); assert.match(src, /\$\{vs\?`\$\{vs\.sql\} AND `:''\}/, 'candidates are selected with the viewer scope predicate'); });
  check(() => { const mg = readFileSync('lib/saha/merge.ts', 'utf8'); assert.match(mg, /BLOCKED_WHEN_MERGED=new Set\(\[[^\]]*'identifierLink'/); const srv = readFileSync('lib/saha/server.ts', 'utf8'); assert.match(srv, /authorizeCrosswalk\(state,m,c\)/, 'replay re-checks authority'); assert.match(srv, /crosswalkWithReview\(db\(\),state,c,u,m\)/); assert.match(readFileSync('lib/saha/monitoring.ts', 'utf8'), /'identifier-search'/); assert.match(readFileSync('lib/saha/platform.ts', 'utf8'), /crosswalkSchema\.options/); });
  check(() => { assert.throws(() => C.authorizeCrosswalk(state(), asha, { type: 'identifierWithdraw' }), e => e.status === 403); C.authorizeCrosswalk(state(), sup, { type: 'identifierWithdraw' }); C.authorizeCrosswalk(state(), asha, { type: 'identifierLink', verification: 'unverified' }); C.authorizeCrosswalk(state(), admin, { type: 'other' }); assert.throws(() => C.authorizeCrosswalk(state(), admin, { type: 'identifierLink' }), e => e.status === 403); });
  // The browser panels write out the issuers, origins and verification states (so the bundle carries no server module): they must match the server lists.
  check(() => { const ui = readFileSync('app/identifier-panels.tsx', 'utf8'), lit = (name) => { const m = ui.match(new RegExp(`const ${name}:Record<string,string>=\\{([^;]*)\\};`)); assert.ok(m, name); return m[1]; };
    const keys = body => [...body.matchAll(/(?:'([a-z-]+)'|\b([a-z]+)):'/g)].map(x => x[1] ?? x[2]);
    assert.deepEqual(keys(lit('ISSUERS')), S.SEARCH_ISSUERS, 'search issuers'); assert.deepEqual(keys(lit('ORIGINS')), [...C.ORIGINS], 'origins'); assert.deepEqual(keys(lit('VERIFICATIONS')), [...C.VERIFICATIONS], 'verification states');
    assert.match(ui, /const LINK_ISSUERS=\['rch','nikshay'\]/); assert.deepEqual(Object.keys(R.KNOWN_ISSUERS), ['rch', 'nikshay'], 'link issuers are the known issuers');
    for (const [k, v] of Object.entries(C.ORIGIN_LABEL)) assert.ok(ui.includes(`:'${v.replace(/'/g, "\\'")}'`), `origin label ${k}`); for (const [k, v] of Object.entries(C.VERIFICATION_LABEL)) assert.ok(ui.includes(`:'${v}'`), `verification label ${k}`);
    const ws = readFileSync('app/workspace.tsx', 'utf8'); assert.match(ws, /<IdentifiersPatient data=\{data\} p=\{person\}/); assert.match(ws, /<IdentifierSearch key=\{data\.organisation\.id\}/);
    assert.match(ui, /fetch\('\/api\/identifier-search',\{method:'POST'/, 'the search travels in a POST body, never in the URL'); });
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/identifier-crosswalk-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Issuer-identifier search, ABHA number format and programme identity crosswalks (slice 10e): ABHA format (14 digits or hyphenated 2-4-4-4, mixed grouping refused, no checksum) as one rule shared by the search and the ABHA link schema; exact complete identifiers only; matching inside the care scope only (other team, ASHA assignment, administrator, suspended, emergency grant, merged survivor, unlinked ABHA); search rate limits; the append-only identifier ledger (link, correct, withdraw, correction of a slice 2h imported entry, bounded size, provenance on every entry, masked audit lines and results); authority; one live holder per identifier with conflicts sent to the slice 1c identity case path (never merged, stewards decide), the neutral refusal and bounded steward-review event for a holder outside scope, emergency-only holders treated as outside scope; slice 2h matching and uniqueness following current entries; masking in snapshots and history; wiring checks.' }, null, 2) + '\n');
console.log(`${passed} identifier crosswalk contract checks passed`);
