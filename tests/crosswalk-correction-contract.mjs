// Slice r17 contract: correction of imported identifiers and destination-specific identifier correction through the
// approval path (BR-ID-08, BR-DATA-11). Imported (slice 2h) identifier entries are corrected or withdrawn with full
// provenance (who, when, origin, verification state, evidence) as an append-only ledger entry; a correction that must
// reach a programme destination is routed through the existing prepare -> approve -> send -> lookup pattern (slice 7g),
// never sent automatically. `identifierLink` and `identifierWithdraw` (slice 10e) are unchanged.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.crosswalk-correction-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
// Dependency sources are read from the committed baseline (HEAD) so this slice's contract does not depend on
// other agents' uncommitted edits to shared modules; the slice's own module is read from the working tree.
const src = f => f === 'crosswalk-correction' ? readFileSync(`lib/saha/${f}.ts`, 'utf8') : execFileSync('git', ['show', `HEAD:lib/saha/${f}.ts`], { encoding: 'utf8' });
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'crosswalk', 'crosswalk-correction', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identifier-search', 'identity', 'import-rejections', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'patient-import', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'record-import', 'referral-needs', 'referral-request', 'referral-rules', 'report-export', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'visit-import'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(src(f), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const imp = n => import(pathToFileURL(join(dir, n + '.js')));
  const [CC, C, TY, AD] = await Promise.all(['crosswalk-correction', 'crosswalk', 'types', 'adapter-operations'].map(imp));
  const now = '2026-10-03T09:00:00.000Z';
  const member = (userId, role, extra = {}) => ({ userId, displayName: `Name ${userId}`, accountCode: 'C'.repeat(24), role, isOwner: false, status: 'active', version: 1, teamIds: ['default'], createdAt: now, ...extra });
  const owner = member('owner', 'clinician', { isOwner: true }), sup = member('sup', 'supervisor'), clin = member('clin', 'clinician'), asha = member('asha', 'asha'), admin = member('adm', 'admin', { isOwner: true, teamIds: [] }), provider = member('prov', 'provider');
  const person = (id, name, teamId = 'default', extra = {}) => ({ id, name, age: 40, sex: 'Female', village: 'Lakeside', programmes: ['General care'], task: '', due: '', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId, assignedTo: 'asha', ...extra });
  const imported = (issuer, value, row = 1) => ({ issuer, value, verified: false, recordedAt: now, recordedBy: 'owner', source: 'import', imported: { batchId: 'b0', row, planHash: '0'.repeat(64) } });
  const dest = (id = 'dest', extra = {}) => ({ id, name: 'Demo programme', kind: 'mis', mode: 'demo', status: 'active', version: 1, description: '', programmes: ['General care'], mis: { contract: 'saha-mis-v1', mapping: [{ source: 'personId', target: 'external_id', required: true }], corrections: true }, ...extra });
  const state = () => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [owner, sup, clin, asha], invitations: [], identityCases: [],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [
      person('p1', 'Synthetic Person One', 'default', { identifiers: [imported('rch', '111122223333')] }),
      person('p2', 'Synthetic Other Team', 'north', { identifiers: [imported('nikshay', '1234567')] }),
      person('p3', 'Synthetic Person Three', 'default', {}),
      person('p4', 'Synthetic Merged', 'default', { mergedInto: { personId: 'p1', caseId: 'c1', at: now }, identifiers: [imported('rch', '444455556666')] })], visits: [], integrations: [dest()], submissions: [], referrals: [], audit: [], receipts: {} } });
  const actor = u => ({ userId: u.userId, displayName: u.displayName, email: 'x@example.invalid' });
  const prep = (personId, over = {}) => ({ type: 'prepareIdentifierCorrection', personId, version: 1, issuer: 'rch', corrects: 'import:b0:1', identifier: '111122223334', origin: 'programme-card', verification: 'unverified', destinationId: 'dest', reason: 'Imported value was wrong', ...over });
  const run = (s, m, c) => CC.applyCrosswalkCorrection(s, c, actor(m), m, now);
  const P_ = (s, id) => s.workspace.people.find(p => p.id === id);
  const find = (s, id) => CC.correctionsOf(s).find(c => c.id === id);

  // 1. Schema: the four commands, strict, with the required provenance fields.
  check(() => { assert.equal(CC.crosswalkCorrectionSchema.safeParse(prep('p1')).success, true); assert.equal(CC.crosswalkCorrectionSchema.safeParse({ ...prep('p1'), extra: 1 }).success, false); assert.equal(CC.crosswalkCorrectionSchema.safeParse({ ...prep('p1'), origin: 'guess' }).success, false); assert.equal(CC.crosswalkCorrectionSchema.safeParse({ ...prep('p1'), verification: 'verified' }).success, false); assert.equal(CC.crosswalkCorrectionSchema.safeParse({ ...prep('p1'), reason: 'short' }).success, false); assert.equal(CC.crosswalkCorrectionSchema.safeParse({ type: 'approveIdentifierCorrection', correctionId: 'c', payloadSha256: 'z' }).success, false); assert.deepEqual([...CC.CORRECTION_TYPES], ['prepareIdentifierCorrection', 'approveIdentifierCorrection', 'sendIdentifierCorrection', 'lookupIdentifierCorrection']); assert.equal(CC.CROSSWALK_CORRECTION_CONTRACT, 'saha-crosswalk-correction-v1'); assert.equal(CC.IDENTIFIER_APPROVAL_HOURS, 24); assert.equal(CC.CORRECTION_LIMIT, 20); });
  assert.equal(await run(state(), owner, { type: 'saveVisit' }), null); passed++;

  // 2. Authority.
  for (const [who, text] of [[admin, /care role/], [provider, /care role/], [member('sus', 'supervisor', { status: 'suspended' }), /care role/]]) await rejects(() => run(state(), who, prep('p1')), 403, text);
  await rejects(() => run(state(), asha, { ...prep('p1'), withdraw: true }), 403, /clinician or supervisor withdraws/);
  await rejects(() => run(state(), asha, { ...prep('p1'), verification: 'issuer-checked', evidence: 'Portal lookup' }), 403, /clinician or supervisor records an identifier as checked/);
  await rejects(() => run(state(), owner, prep('p2')), 403, /normal access/);

  // 3. Correction of an imported identifier with provenance (the local ledger is extended; nothing else changes).
  { const s = state(), before = structuredClone(s), r = await run(s, owner, prep('p1', { origin: 'programme-system', verification: 'document-seen', evidence: 'RCH card sighted at the home visit' })), p1 = P_(s, 'p1');
    check(() => { assert.deepEqual([r.state, r.current], ['prepared', 1]); assert.equal(r.entryId, p1.identifiers[1].id); assert.equal(r.destination, 'Demo programme'); assert.equal(JSON.stringify(r).includes('111122223334'), false, 'no identifier value in the result'); });
    check(() => { assert.equal(p1.identifiers.length, 2); assert.deepEqual(p1.identifiers[0], imported('rch', '111122223333'), 'the imported entry is kept'); const e = p1.identifiers[1]; assert.deepEqual([e.kind, e.corrects, e.value, e.source, e.origin, e.verification, e.evidence, e.recordedBy, e.recordedAt], ['correct', 'import:b0:1', '111122223334', 'crosswalk', 'programme-system', 'document-seen', 'RCH card sighted at the home visit', 'owner', now]); assert.deepEqual(TY.currentIdentifiers(p1).map(x => x.value), ['111122223334']); });
    check(() => { const a = s.workspace.audit[0]; assert.deepEqual([a.action, a.personId, a.actorId], ['prepareIdentifierCorrection', 'p1', 'owner']); assert.match(a.detail, /RCH ID XXXXXXXX3334 recorded as a correction at Demo programme/); assert.equal(a.detail.includes('111122223334'), false); });
    check(() => { assert.deepEqual(s.workspace.people.filter(p => p.id !== 'p1'), before.workspace.people.filter(p => p.id !== 'p1')); assert.deepEqual(s.identityCases, []); });
    check(() => { const c = find(s, r.correctionId); assert.equal(c.state, 'prepared'); assert.equal(c.personId, 'p1'); assert.equal(c.destinationId, 'dest'); assert.equal(c.corrects, 'import:b0:1'); assert.equal(c.withdrawn, false); assert.ok(c.payload); assert.equal(c.payload.identifier, '111122223334'); assert.match(c.payloadSha256, /^[a-f0-9]{64}$/); assert.equal(c.payloadSha256 === r.payloadSha256, true); });
  }
  // Withdrawal of an imported entry.
  { const s = state(), r = await run(s, sup, prep('p1', { withdraw: true, identifier: undefined })), p1 = P_(s, 'p1');
    check(() => { assert.deepEqual([r.state, r.current], ['prepared', 0]); const e = p1.identifiers[1]; assert.deepEqual([e.kind, e.corrects, e.value, e.source], ['withdraw', 'import:b0:1', '111122223333', 'crosswalk']); assert.deepEqual(TY.currentIdentifiers(p1), []); assert.equal(find(s, r.correctionId).withdrawn, true); assert.equal(find(s, r.correctionId).payload.operation, 'withdraw'); });
    // The withdrawn value is free again (slice 10e behaviour, unchanged).
    check(() => { const res = C.applyCrosswalk(s, { type: 'identifierLink', personId: 'p3', version: 1, issuer: 'rch', identifier: '111122223333', origin: 'programme-card', verification: 'unverified', reason: 'Freed by the earlier withdrawal' }, actor(owner), owner, now); assert.equal(res.linked, true); });
  }
  // A merged record cannot be corrected (but a steward can withdraw from it).
  await rejects(() => run(state(), owner, prep('p4', { corrects: 'import:b0:1' })), 409, /merged into another record/);
  { const s = state(); const r = await run(s, sup, prep('p4', { corrects: 'import:b0:1', withdraw: true, identifier: undefined })); assert.equal(r.state, 'prepared'); assert.deepEqual(TY.currentIdentifiers(P_(s, 'p4')), []); passed++; }

  // 4. Destination checks.
  check(() => { const s = state(); s.workspace.integrations = [dest('ehr', { kind: 'ehr' })]; assert.throws(() => CC.correctionDestination(s, 'ehr'), e => e.status === 422 && /programme destination/.test(e.message)); });
  check(() => { const s = state(); s.workspace.integrations = [dest('http', { mode: 'http', endpoint: 'https://x.example.invalid', credentialBinding: 'SAHA_MIS_X' })]; assert.throws(() => CC.correctionDestination(s, 'http'), e => e.status === 409 && /demonstration programme destinations/.test(e.message)); });
  check(() => { const s = state(); s.workspace.integrations = [dest('off', { status: 'suspended' })]; assert.throws(() => CC.correctionDestination(s, 'off'), e => e.status === 409 && /not active/.test(e.message)); });
  check(() => { const s = state(); s.workspace.integrations = [dest('nocorr', { mis: { contract: 'saha-mis-v1', mapping: [], corrections: false } })]; assert.throws(() => CC.correctionDestination(s, 'nocorr'), e => e.status === 409 && /correction support/.test(e.message)); });
  check(() => { const s = state(); s.workspace.integrations = [dest('noupd', { operations: { version: 1, allowed: ['create', 'lookup'], aggregateOnly: false, setBy: 'owner', setAt: now, reason: 'read only', history: [] } })]; assert.throws(() => CC.correctionDestination(s, 'noupd'), e => e.status === 409 && /not permitted to update/.test(e.message)); });
  await rejects(() => run(state(), owner, prep('p1', { destinationId: 'nosuch' })), 422, /programme destination/);

  // 5. The approval path: a different authorised person must approve, then the preparer or approver sends.
  { const s = state(), r = await run(s, owner, prep('p1')), id = r.correctionId;
    check(() => { assert.equal(CC.identifierRepairs(s, 'p1').length, 1); assert.equal(CC.identifierRepairs(s, 'p3').length, 0); });
    await rejects(() => run(s, owner, { type: 'approveIdentifierCorrection', correctionId: id, payloadSha256: r.payloadSha256 }), 403, /different authorised person/);
    await rejects(() => run(s, clin, { type: 'approveIdentifierCorrection', correctionId: id, payloadSha256: '0'.repeat(64) }), 409, /not the one you reviewed/);
    const ap = await run(s, clin, { type: 'approveIdentifierCorrection', correctionId: id, payloadSha256: r.payloadSha256 });
    check(() => { assert.deepEqual([ap.state, ap.expiresAt ? 'set' : 'unset'], ['approved', 'set']); const c = find(s, id); assert.deepEqual([c.state, c.approvedBy, c.approvedByName], ['approved', 'clin', 'Name clin']); });
    await rejects(() => run(s, asha, { type: 'sendIdentifierCorrection', correctionId: id }), 403, /preparer or the approver/);
    // A second approval is refused (already approved).
    await rejects(() => run(s, sup, { type: 'approveIdentifierCorrection', correctionId: id, payloadSha256: r.payloadSha256 }), 409, /Only a prepared correction can be approved/);
    // Send by the approver.
    const sd = await run(s, clin, { type: 'sendIdentifierCorrection', correctionId: id });
    check(() => { assert.deepEqual([sd.state, /^IDC-/.test(sd.receipt)], ['accepted', true]); const c = find(s, id); assert.deepEqual([c.state, c.attempts], ['accepted', 1]); assert.equal(c.payload, undefined, 'the payload is dropped once closed'); assert.equal(CC.correctionView(c).value, null); });
    // The downstream repair list is now empty for this person.
    check(() => assert.deepEqual(CC.identifierRepairs(s, 'p1'), []));
    // A second send of an accepted correction is idempotent (nothing is resent).
    const again = await run(s, clin, { type: 'sendIdentifierCorrection', correctionId: id });
    check(() => { assert.equal(again.state, 'accepted'); assert.equal(find(s, id).attempts, 1); });
  }
  // Send before approval is refused; a lookup resolves an uncertain first send.
  { const s = state(); s.workspace.integrations = [dest('dest', { behavior: 'uncertain' })];
    const r = await run(s, owner, prep('p1')); await rejects(() => run(s, owner, { type: 'sendIdentifierCorrection', correctionId: r.correctionId }), 409, /current approval is required/);
    await run(s, clin, { type: 'approveIdentifierCorrection', correctionId: r.correctionId, payloadSha256: r.payloadSha256 });
    const sd = await run(s, owner, { type: 'sendIdentifierCorrection', correctionId: r.correctionId });
    check(() => { assert.equal(sd.state, 'uncertain', 'a lost response leaves the outcome unknown'); assert.equal(find(s, r.correctionId).receipt, undefined); });
    const lk = await run(s, owner, { type: 'lookupIdentifierCorrection', correctionId: r.correctionId });
    check(() => { assert.deepEqual([lk.state, /^IDC-/.test(lk.receipt)], ['accepted', true], 'a lookup finds the receipt without a resend'); assert.match(s.workspace.audit.at(-1).detail, /Nothing was resent/); });
  }
  // Expiry and the limit.
  { const s = state(), r = await run(s, owner, prep('p1')), later = new Date(Date.parse(now) + 25 * 3600000).toISOString();
    CC.compactCorrections(s, later);
    check(() => assert.equal(find(s, r.correctionId).state, 'cancelled', 'an unapproved correction expires'));
    const big = state(); big.operations = { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, crosswalkCorrections: Array.from({ length: CC.CORRECTION_LIMIT }, (_, i) => ({ id: `c${i}`, personId: 'p3', destinationId: 'dest', destinationName: 'Demo programme', issuer: 'rch', corrects: `x${i}`, entryId: `e${i}`, withdrawn: false, state: 'prepared', preparedBy: 'owner', preparedByName: 'Name owner', preparedAt: now, payloadSha256: 'a'.repeat(64), attempts: 0, events: [], message: '', updatedAt: now })) };
    await rejects(() => run(big, owner, prep('p3', { identifier: '777777777777' })), 422, /open identifier corrections/);
  }
  // Receipt contract: a mismatched key or hash, and a not_found only on lookup.
  { const c = { id: 'c1', personId: 'p1', destinationId: 'dest', destinationName: 'Demo programme', issuer: 'rch', corrects: 'import:b0:1', entryId: 'e1', withdrawn: false, state: 'sending', preparedBy: 'owner', preparedByName: 'Name owner', preparedAt: now, payloadSha256: 'a'.repeat(64), attempts: 1, events: [], message: '', updatedAt: now };
    check(() => assert.throws(() => CC.applyReceipt(c, { contract: CC.CROSSWALK_CORRECTION_CONTRACT, key: 'other', payloadHash: 'a'.repeat(64), status: 'accepted', receipt: 'r' }, false, now), e => e.status === 502 && /different correction/.test(e.message)));
    check(() => assert.throws(() => CC.applyReceipt(c, { contract: CC.CROSSWALK_CORRECTION_CONTRACT, key: 'c1', payloadHash: 'a'.repeat(64), status: 'not_found' }, false, now), e => e.status === 502 && /lookup/.test(e.message)));
  }
  // Correction view masks the value but keeps the reference; the local ledger masking is unchanged (slice 10e).
  { const s = state(); const r = await run(s, owner, prep('p1')); const view = CC.correctionView(find(s, r.correctionId));
    check(() => { assert.equal(view.value, 'XXXXXXXX3334'); assert.equal(view.corrects, 'import:b0:1'); assert.equal(view.payload, undefined); assert.equal(JSON.stringify(view).includes('111122223334'), false); });
  }
  // identifierLink / identifierWithdraw semantics are unchanged: the slice 10e module is untouched by this slice.
  check(() => { const src = readFileSync('lib/saha/crosswalk.ts', 'utf8'); assert.match(src, /identifierLink/); assert.match(src, /identifierWithdraw/); assert.equal(src.includes('prepareIdentifierCorrection'), false, 'the crosswalk module itself is not extended'); });
  check(() => { const a = CC.authorizeCrosswalkCorrection(state(), asha, { type: 'prepareIdentifierCorrection', verification: 'unverified' }); assert.equal(a, undefined); assert.throws(() => CC.authorizeCrosswalkCorrection(state(), admin, { type: 'prepareIdentifierCorrection' }), e => e.status === 403); CC.authorizeCrosswalkCorrection(state(), owner, { type: 'other' }); });
  // Integration of #144 (review findings): approving, sending and looking up need the patient in the actor's care scope, and only
  // a send whose outcome is uncertain can be looked up (a lookup of a prepared or approved correction recorded a receipt).
  { const s = state(), r = await run(s, owner, prep('p1')), north = member('north-clin', 'clinician', { teamIds: ['north'] });
    await rejects(() => run(s, north, { type: 'approveIdentifierCorrection', correctionId: r.correctionId, payloadSha256: r.payloadSha256 }), 403, /outside your care scope/);
    await rejects(() => run(s, clin, { type: 'lookupIdentifierCorrection', correctionId: r.correctionId }), 409, /uncertain/);
    check(() => { const c = find(s, r.correctionId); assert.equal(c.state, 'prepared', 'a refused lookup changes nothing'); assert.equal(c.receipt, undefined); });
    await run(s, clin, { type: 'approveIdentifierCorrection', correctionId: r.correctionId, payloadSha256: r.payloadSha256 });
    await rejects(() => run(s, clin, { type: 'lookupIdentifierCorrection', correctionId: r.correctionId }), 409, /uncertain/);
    await rejects(() => run(s, north, { type: 'sendIdentifierCorrection', correctionId: r.correctionId }), 403, /outside your care scope/);
    check(() => assert.equal(find(s, r.correctionId).state, 'approved'));
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/crosswalk-correction-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Correction of imported identifiers and destination-specific identifier correction through the approval path (slice r17): schema and authority; imported (slice 2h) identifier correction and withdrawal with provenance (who, when, origin, verification, evidence) as an append-only ledger entry that leaves the imported entry untouched and is followed by currentIdentifiers; destination checks (programme, demonstration-only, active, correction support, update operation); the prepare -> approve -> send -> lookup approval path (a different authorised person approves, the preparer or approver sends inside the window, a lost response stays uncertain and a lookup resolves it without a resend); masking of the identifier value in results, views and audit lines; the downstream repair list; the open-correction limit and expiry; the receipt contract; and that identifierLink/identifierWithdraw are unchanged.' }, null, 2) + '\n');
console.log(`${passed} crosswalk correction contract checks passed`);
