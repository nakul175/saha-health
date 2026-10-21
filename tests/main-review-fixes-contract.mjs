// Slice 6r main-review-fixes contract: regressions for defects a third independent review found in
// slices already merged into main (reproductions in /tmp/claude-0/review3/*.mjs, 30 September 2026).
// Each block fails on the code before 6r (run with SAHA_LIB pointing at an export of the base tree).
//  1. Household sharing view names only members inside the worker's care scope.
//  2. Emergency-access restriction covers every patient a command names (merge, case, hold references).
//  3. Patient history is redacted on read (ABHA numbers masked, received FHIR bundles withheld).
//  4. Reminder dispatch and care-context linking pause under a processing restriction.
//  5. Emergency-access review needs a reviewer normally allowed to see the patient.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const lib = process.env.SAHA_LIB ?? 'lib/saha';
const dir = mkdtempSync(join(process.cwd(), '.main-review-fixes-contract-'));
let passed = 0;
// REPORT_ALL=1 lists every failing check instead of stopping at the first (used to show the base fails).
const failed = [];
const check = (name, fn) => { try { fn(); passed++; } catch (e) { if (process.env.REPORT_ALL) { failed.push(name); return; } e.message = `${name}: ${e.message}`; throw e; } };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`${lib}/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const imp = f => import(pathToFileURL(join(dir, f + '.js')));
  const [H, E, M, R, B] = await Promise.all(['household', 'exceptional', 'merge', 'rights', 'abdm'].map(imp));
  const now = new Date().toISOString(), later = new Date(Date.now() + 30 * 86400000).toISOString(), until = new Date(Date.now() + 3600e3).toISOString();
  const member = x => ({ status: 'active', version: 1, isOwner: false, displayName: x.userId, ...x });
  const P = (id, x) => ({ id, name: 'Synthetic ' + id, age: 30, sex: 'Female', village: 'V', programmes: ['General care'], version: 1, teamId: 't1', status: 'due', due: 'Today', assignedTo: null, ...x });

  // 1. Household: mother (ashaA) receives; daughter (ashaB, TB) has granted the mother a TB-class proxy.
  {
    const ashaA = member({ userId: 'ashaA', role: 'asha', teamIds: ['t1'] }), ashaB = member({ userId: 'ashaB', role: 'asha', teamIds: ['t1'] });
    const mother = P('mother', { assignedTo: 'ashaA', householdId: 'h1' });
    const daughter = P('daughter', { assignedTo: 'ashaB', householdId: 'h1', age: 25, programmes: ['TB screening'], followUps: [{ id: 'f1', state: 'open', title: 'TB sputum re-test', due: '2026-10-02', packId: 'tb' }], proxies: [{ id: 'g1', proxyPersonId: 'mother', relationship: 'parent', purposes: ['care-coordination'], classes: ['tb'], evidence: 'SYNTH', from: '2026-01-01T00:00:00.000Z', expiresAt: later, grantedBy: 'ashaB', grantedAt: now }] });
    const s = { members: [ashaA, ashaB], households: [{ id: 'h1', version: 2, label: 'Home', teamId: 't1', createdAt: now, createdBy: 'ashaA', members: [{ personId: 'mother', relationship: 'self', from: '2026-01-01' }, { personId: 'daughter', relationship: 'child', from: '2026-01-01' }] }], workspace: { people: [mother, daughter], visits: [], referrals: [], submissions: [], audit: [] } };
    const v = H.householdView(s, ashaA, mother, 'mother', 'care-coordination');
    check('household view names only visible members', () => assert.deepEqual(v.members.map(x => x.personId), ['mother']));
    check('household sharing omits out-of-scope members even with a grant', () => { assert.deepEqual(v.shareable.members.map(x => x.personId), ['mother']); assert.ok(!JSON.stringify(v.shareable).includes('TB sputum'), 'out-of-scope item title leaked'); assert.equal(v.shareable.omittedOutsideScope, 1); });
    const vb = H.householdView(s, ashaB, daughter, null, 'care-coordination');
    check('the grant still works for a worker who may see both', () => { const both = member({ userId: 'sup', role: 'supervisor', teamIds: ['t1'] }); const w = H.householdView(s, both, mother, 'mother', 'care-coordination'); assert.deepEqual(w.shareable.members.map(x => x.personId).sort(), ['daughter', 'mother']); assert.equal(w.shareable.omittedOutsideScope, 0); assert.equal(vb.shareable, null); });
  }

  // 2. Emergency access: doc reaches x only through a grant; own is in doc's team.
  {
    const doc = member({ userId: 'doc', role: 'clinician', teamIds: ['t1'] }), doc2 = member({ userId: 'doc2', role: 'clinician', teamIds: ['t1'] });
    const own = P('own', {}), x = P('x', { teamId: 't2', exceptionalAccess: [{ id: 'g', userId: 'doc', reason: 'r'.repeat(20), from: now, until }] });
    const s = { members: [doc, doc2], identityCases: [{ id: 'k1', version: 1, survivorId: 'own', duplicateId: 'x', state: 'proposed' }], retention: { policies: [], holds: [{ id: 'hold1', scope: 'person', personId: 'x' }] }, governance: { entries: [], evaluations: [], safety: [{ id: 'sc1', personId: 'x' }] }, workspace: { people: [own, x], visits: [{ id: 'v1', personId: 'x' }], referrals: [], submissions: [], audit: [] } };
    check('merge proposal naming a grant-only duplicate is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'identityMergePropose', survivorId: 'own', duplicateId: 'x', evidence: 'same card', reason: 'looks like the same person' }), 403));
    check('merge proposal naming a grant-only survivor is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'identityMergePropose', survivorId: 'x', duplicateId: 'own', evidence: 'same card', reason: 'looks like the same person' }), 403));
    for (const type of ['identityMergeDecide', 'identityUnmerge', 'identityImpactResolve']) check(`${type} through a case naming a grant-only patient is refused`, () => status(() => E.ensureExceptionalScope(s, doc, { type, caseId: 'k1', version: 1 }), 403));
    check('safety case naming a grant-only patient is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'assignSafety', caseId: 'sc1', version: 1 }), 403));
    check('hold release naming a grant-only patient is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'retentionHoldRelease', holdId: 'hold1', reason: 'r' }), 403));
    check('care-context link naming a grant-only visit is refused', () => status(() => E.ensureExceptionalScope(s, doc, { type: 'abdmCareContextLink', personId: 'own', visitIds: ['v1'] }), 403));
    check('permitted urgent care still passes', () => E.ensureExceptionalScope(s, doc, { type: 'saveVisit', visitId: 'v1' }));
    check('a clinician without the grant is not blocked by this check', () => E.ensureExceptionalScope(s, doc2, { type: 'identityMergeDecide', caseId: 'k1', version: 1 }));
    check('merge authorisation still needs normal access for others', () => status(() => M.authorizeMerge(s, doc2, { type: 'identityMergeDecide', caseId: 'k1', version: 1, decision: 'approve', reason: 'x'.repeat(20) }), 403));
  }

  // 3. History redaction on read; the stored revision object is not changed.
  {
    const bundle = { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Condition', note: 'SYNTH secret' } }] };
    const data = { ...P('p', {}), abha: { state: 'verified', number: '12345678901234', history: [{ number: '12345678901234', at: now }] }, abdmConsents: [{ id: 'c', abhaNumber: '12345678901234' }], careContexts: [{ id: 'cc', abhaNumber: '12345678901234' }], abdmReceived: [{ id: 'r', bundle }] };
    const rev = { id: 'rv', entityType: 'person', data, changes: [{ field: 'abha.number', before: '—', after: '12345678901234' }, { field: 'abha.state', before: 'none', after: 'verified' }, { field: 'name', before: 'A', after: 'B' }] };
    // The base had no read-side redaction: history served the stored revision as is.
    const out = B.redactRevision ? B.redactRevision(rev) : rev, text = JSON.stringify(out);
    check('history masks the ABHA number everywhere', () => { assert.ok(!text.includes('12345678901234'), 'unmasked ABHA number in history'); assert.equal(out.data.abha.number, '12-XXXX-XXXX-1234'); assert.equal(out.changes[0].after, '12-XXXX-XXXX-1234'); });
    check('history withholds received bundles', () => { assert.ok(!text.includes('SYNTH secret')); assert.equal(out.data.abdmReceived[0].bundle, undefined); });
    check('history keeps other changes and the stored revision', () => { assert.deepEqual(out.changes.slice(1), rev.changes.slice(1)); assert.equal(rev.data.abha.number, '12345678901234'); assert.equal(rev.changes[0].after, '12345678901234'); });
  }

  // 4. Restriction pauses reminder dispatch and care-context linking.
  {
    const p = P('p', { restrictions: [{ id: 'rs', requestId: 'rq', at: now }] });
    const s = { outreach: { messages: [{ id: 'm1', personId: 'p' }], plans: [] }, workspace: { people: [p], visits: [], referrals: [], submissions: [], audit: [] } };
    check('approved reminder cannot be sent under a restriction', () => status(() => R.ensureNotRestricted(s, { type: 'messageSimulate', messageId: 'm1', version: 1, outcome: 'simulated' }), 409));
    check('care-context link is paused under a restriction', () => status(() => R.ensureNotRestricted(s, { type: 'abdmCareContextLink', personId: 'p', version: 1, visitIds: ['v'] }), 409));
    check('lifted restriction allows the send', () => { p.restrictions[0].liftedAt = now; R.ensureNotRestricted(s, { type: 'messageSimulate', messageId: 'm1', version: 1, outcome: 'simulated' }); });
  }

  {
    const sup = member({ userId: 'sup', role: 'supervisor', teamIds: ['t1'] }), p = P('p', { assigned: true });
    const msg = (id, state) => ({ id, version: 1, personId: 'p', state, attempts: [] });
    const s = { members: [sup], rightsRequests: [{ id: 'rq', version: 1, personId: 'p', kind: 'restriction', state: 'open', items: [], history: [], dueAt: later, ownerId: 'sup' }], outreach: { messages: [msg('m1', 'approved'), msg('m2', 'draft'), msg('m3', 'simulated'), { ...msg('m4', 'approved'), personId: 'other' }], plans: [] }, workspace: { people: [p, P('other', {})], visits: [], referrals: [], submissions: [], audit: [] } };
    let out;
    check('restriction takes effect', () => { out = R.applyRights(s, { type: 'rightsClose', requestId: 'rq', version: 1, outcome: 'fulfilled', response: 'Restricted as the patient asked in person.', evidence: 'SYNTH-REF-1' }, { userId: 'sup', displayName: 'Sup' }, sup, now); assert.ok(R.activeRestriction(p)); });
    check('unsent reminders for that patient are cancelled with a reason, sent and other patients untouched', () => { const by = id => s.outreach.messages.find(m => m.id === id); assert.equal(by('m1').state, 'cancelled'); assert.match(by('m1').cancelReason, /restricted/i); assert.equal(by('m2').state, 'cancelled'); assert.equal(by('m3').state, 'simulated'); assert.equal(by('m4').state, 'approved'); assert.equal(s.outreach.messages.length, 4); assert.equal(out?.cancelledMessages, 2); assert.match(s.workspace.audit.at(-1).detail, /2 unsent reminders cancelled/); });
  }

  // 5. Review of emergency access: an owner in the team but with an ASHA role and no assignment is not a reviewer.
  {
    const doc = member({ userId: 'doc', role: 'clinician', teamIds: ['t9'] });
    const ownerAsha = member({ userId: 'oa', role: 'asha', teamIds: ['t1'], isOwner: true }), sup = member({ userId: 'sup', role: 'supervisor', teamIds: ['t1'] });
    const x = P('x', { assignedTo: 'someone-else', exceptionalAccess: [{ id: 'g', userId: 'doc', reason: 'r'.repeat(20), from: '2026-01-01T00:00:00.000Z', until: '2026-01-01T01:00:00.000Z' }] });
    const s = { members: [doc, ownerAsha, sup], workspace: { people: [x], visits: [], referrals: [], submissions: [], audit: [] } };
    check('owner outside patient scope cannot review', () => status(() => E.authorizeExceptional(s, ownerAsha, { type: 'exceptionalReview', personId: 'x', grantId: 'g', outcome: 'appropriate', note: 'fine.' }), 403));
    check('review queue hides patients outside the viewer scope', () => { const v = E.exceptionalView(s, ownerAsha); assert.equal(v.reviews.length, 0); assert.ok(!JSON.stringify(v).includes('Synthetic x')); });
    check('supervisor of the team still reviews', () => { E.authorizeExceptional(s, sup, { type: 'exceptionalReview', personId: 'x', grantId: 'g', outcome: 'appropriate', note: 'fine.' }); assert.equal(E.exceptionalView(s, sup).reviews.length, 1); });
  }
  if (failed.length) { console.log(`Main review fixes contract: ${failed.length} FAILED: ${failed.join('; ')}`); process.exitCode = 1; }
  if (!failed.length && !process.env.SAHA_LIB) {
    const result = { suite: 'main review fixes contract (slice 6r)', passed, completedAt: new Date().toISOString() };
    writeFileSync('tests/main-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  }
  console.log(`Main review fixes contract: ${passed} checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
