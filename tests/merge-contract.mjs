// Slice 1c merge contract: two-person merge, blocked writes, impact queue and unmerge on in-memory state.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.merge-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const file of readdirSync('lib/saha').filter(file => file.endsWith('.ts')))
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${file}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const g = await import(pathToFileURL(join(dir, 'merge.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', later = '2026-09-30T08:00:00.000Z', future = '2026-12-01T00:00:00.000Z';
  const member = (userId, role, teamIds) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now });
  const base = { sex: 'Female', village: 'Synthetic', programmes: ['Maternal care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: now, version: 1, teamId: 't1', assignedTo: 'a1' };
  const link = (externalId) => ({ id: 'l-' + externalId, integrationId: 'i1', externalId, externalName: 'Synthetic EHR ' + externalId, identityHash: 'h', status: 'active', at: now, verifiedBy: 'c1', method: 'worker-confirmed' });
  const fresh = () => ({
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }, { id: 't2', name: 'Two', createdAt: now }], invitations: [], identityCases: [],
    members: [member('c1', 'clinician', ['t1']), member('c2', 'clinician', ['t1']), member('sup', 'supervisor', ['t1']), member('a1', 'asha', ['t1']), member('adm', 'admin', []), member('c3', 'clinician', ['t2'])],
    outreach: { plans: [], templates: [], messages: [{ id: 'm1', version: 1, personId: 'D', state: 'draft' }, { id: 'm2', version: 1, personId: 'S', state: 'draft' }] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [],
      people: [
        { ...base, id: 'S', name: 'Asha Synthetic', age: 30 },
        { ...base, id: 'D', name: 'Aasha Synthetic', age: 30, householdId: 'h1', ehr: { links: [link('X1')], permissions: [], documents: [], operations: [] }, fieldLeases: [{ id: 'fl', status: 'active' }],
          followUps: [{ id: 'f1', title: 'Antenatal check', due: '2026-10-10', ownerId: 'a1', state: 'open' }], enrolments: [{ id: 'e1', packId: 'maternal', episodeLabel: 'Synthetic pregnancy', state: 'active' }],
          proxies: [{ id: 'g1', proxyPersonId: 'S', expiresAt: future }, { id: 'g2', proxyPersonId: 'S', expiresAt: future, revokedAt: now }] },
        { ...base, id: 'E', name: 'Other Synthetic', age: 31, ehr: { links: [link('X2')], permissions: [], documents: [], operations: [] } },
        { ...base, id: 'T', name: 'Team two', age: 40, teamId: 't2', assignedTo: null },
      ],
      visits: [{ id: 'v1', personId: 'D', state: 'confirmed', createdAt: now, plan: { id: 'pl1', state: 'proposed' } }, { id: 'v2', personId: 'D', state: 'confirmed', createdAt: now, plan: { id: 'pl2', state: 'completed' } }],
      submissions: [{ id: 'sub1', personId: 'D', visitId: 'v1', connectorName: 'Synthetic MIS', state: 'accepted', createdAt: now }, { id: 'sub2', personId: 'D', visitId: 'v1', connectorName: 'Synthetic MIS', state: 'cancelled', createdAt: now }],
      referrals: [{ id: 'r1', personId: 'D', visitId: 'v1', facility: 'Synthetic CHC', reason: 'x', state: 'sent', createdAt: now }, { id: 'r2', personId: 'D', visitId: 'v1', facility: 'Synthetic PHC', reason: 'x', state: 'completed', createdAt: now }] },
  });
  const as = (s, userId) => { const m = s.members.find(x => x.userId === userId); for (const p of s.workspace.people) p.assigned = allowed(m, p); s.workspace.role = m.role; return [{ userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, m]; };
  const run = (s, userId, cmd, when = now) => { const [u, m] = as(s, userId); return g.applyMerge(s, cmd, u, m, when); };
  const propose = (over = {}) => ({ type: 'identityMergePropose', survivorId: 'S', duplicateId: 'D', evidence: 'SYNTH-REGISTER-12', reason: 'Same person, spelling variant in register', ...over });
  const P = (s, id) => s.workspace.people.find(p => p.id === id);

  let s = fresh();
  check(() => { status(() => run(s, 'a1', propose()), 403); status(() => run(s, 'adm', propose()), 403); status(() => run(s, 'c3', propose()), 403); status(() => run(s, 'c1', propose({ duplicateId: 'S' })), 422); status(() => run(s, 'c1', propose({ duplicateId: 'T' })), 403); });
  check(() => status(() => run(s, 'c1', propose({ survivorId: 'E' })), 409), 'different external identities in the same system');
  check(() => assert.equal(run(s, 'c1', { ...propose(), reason: 'short' }), null, 'schema rejects a short reason'));
  const { caseId } = run(s, 'c1', propose());
  const k = s.identityCases[0];
  check(() => { assert.equal(k.state, 'proposed'); assert.equal(k.id, caseId); assert.equal(P(s, 'D').mergedInto, undefined, 'nothing merges on proposal'); assert.equal(s.workspace.audit.at(-1).action, 'identityMergePropose'); });
  check(() => { status(() => run(s, 'c2', propose({ survivorId: 'E', duplicateId: 'S' })), 409); });
  check(() => { status(() => run(s, 'c1', { type: 'identityMergeDecide', caseId, version: 1, decision: 'approve', reason: 'Checked the register entry' }), 403); status(() => run(s, 'a1', { type: 'identityMergeDecide', caseId, version: 1, decision: 'approve', reason: 'Checked the register entry' }), 403); });
  check(() => { P(s, 'D').age = 31; status(() => run(s, 'c2', { type: 'identityMergeDecide', caseId, version: 1, decision: 'approve', reason: 'Checked the register entry' }), 409); P(s, 'D').age = 30; });
  check(() => status(() => run(s, 'c2', { type: 'identityMergeDecide', caseId, version: 7, decision: 'approve', reason: 'Checked the register entry' }), 409));
  const approved = run(s, 'c2', { type: 'identityMergeDecide', caseId, version: 1, decision: 'approve', reason: 'Checked the register entry and ANC card' });
  const D = P(s, 'D'), S = P(s, 'S');
  check(() => { assert.equal(k.state, 'merged'); assert.equal(k.version, 2); assert.deepEqual(D.mergedInto, { personId: 'S', caseId, at: now }); assert.deepEqual(S.mergedFrom, [{ personId: 'D', caseId, at: now }]); });
  check(() => { assert.deepEqual(approved.invalidated, { plans: 1, leases: 1, messages: 1 }); assert.equal(s.workspace.visits[0].plan.state, 'blocked'); assert.equal(s.workspace.visits[1].plan.state, 'completed', 'completed work untouched'); assert.equal(D.fieldLeases[0].status, 'revoked'); assert.equal(s.outreach.messages[0].state, 'cancelled'); assert.equal(s.outreach.messages[1].state, 'draft', 'survivor reminders untouched'); });
  check(() => { assert.deepEqual(k.items.map(i => i.kind).sort(), ['ehr-link', 'enrolment', 'follow-up', 'household', 'programme-record', 'proxy', 'referral']); assert.equal(k.items.find(i => i.kind === 'programme-record').ref, 'sub1'); assert.equal(k.items.find(i => i.kind === 'referral').ref, 'r1'); assert.ok(k.items.every(i => i.state === 'open' && i.personId === 'D')); });
  check(() => { assert.equal(s.workspace.submissions[0].state, 'accepted', 'receipts are never rewritten'); assert.equal(s.workspace.visits.filter(v => v.personId === 'D').length, 2, 'visits stay on the original record'); });
  // Writes on the merged record.
  check(() => { status(() => g.ensureNotMerged(s, { type: 'startVisit', personId: 'D' }), 409); status(() => g.ensureNotMerged(s, { type: 'saveVisit', visitId: 'v1' }), 409); status(() => g.ensureNotMerged(s, { type: 'sendSubmission', submissionId: 'sub1' }), 409); status(() => g.ensureNotMerged(s, { type: 'assignPatient', personId: 'D' }), 409); });
  check(() => { g.ensureNotMerged(s, { type: 'reconcile', submissionId: 'sub1' }); g.ensureNotMerged(s, { type: 'resolveFollowUp', personId: 'D' }); g.ensureNotMerged(s, { type: 'revokeEhrLink', personId: 'D' }); g.ensureNotMerged(s, { type: 'startVisit', personId: 'S' }); });
  check(() => { status(() => run(s, 'c1', propose({ survivorId: 'E', duplicateId: 'D' })), 409); status(() => run(s, 'c1', propose({ survivorId: 'D', duplicateId: 'E' })), 409); });
  // Impact queue.
  const item = k.items.find(i => i.kind === 'referral');
  check(() => { status(() => run(s, 'a1', { type: 'identityImpactResolve', caseId, version: 2, itemId: item.id, note: 'Facility told' }), 403); status(() => run(s, 'c1', { type: 'identityImpactResolve', caseId, version: 2, itemId: 'nope', note: 'Facility told' }), 404); });
  run(s, 'sup', { type: 'identityImpactResolve', caseId, version: 2, itemId: item.id, note: 'Facility told to use surviving record' });
  check(() => { assert.equal(item.state, 'resolved'); assert.equal(item.resolved.by, 'sup'); assert.equal(k.version, 3); status(() => run(s, 'sup', { type: 'identityImpactResolve', caseId, version: 3, itemId: item.id, note: 'Again resolved' }), 409); });
  // View for an ASHA assigned only the duplicate.
  check(() => { P(s, 'S').assignedTo = 'c1'; const [, m] = as(s, 'a1'); const v = g.mergeView(s, m, 'D'); assert.equal(v.cases[0].survivor.name, 'A record outside your scope'); assert.equal(v.cases[0].canDecide, false); assert.equal(v.cases[0].canUnmerge, false); assert.equal(v.canPropose, false); assert.equal(v.mergedInto.survivor.id, null); P(s, 'S').assignedTo = 'a1'; });
  check(() => { const [, m] = as(s, 'c1'); const v = g.mergeView(s, m, 'S'); assert.equal(v.cases[0].role, 'survivor'); assert.equal(v.cases[0].canUnmerge, true); assert.equal(v.cases[0].openItems, 6); assert.equal(v.canPropose, true); });
  // A record that already absorbed another cannot itself be merged away.
  check(() => status(() => run(s, 'c1', propose({ survivorId: 'E', duplicateId: 'S' })), 409));
  // Unmerge: records created on the survivor while merged are queued for review.
  s.workspace.visits.push({ id: 'v3', personId: 'S', state: 'draft', createdAt: later });
  s.workspace.referrals.push({ id: 'r3', personId: 'S', visitId: 'v3', facility: 'Synthetic DH', reason: 'x', state: 'draft', createdAt: later });
  check(() => status(() => run(s, 'a1', { type: 'identityUnmerge', caseId, version: 3, reason: 'Different mothers, confirmed by ANM' }), 403));
  const un = run(s, 'c1', { type: 'identityUnmerge', caseId, version: 3, reason: 'Different mothers, confirmed by ANM visit' }, later);
  check(() => { assert.equal(un.added, 2); assert.equal(k.state, 'unmerged'); assert.equal(D.mergedInto, undefined); assert.equal(S.mergedFrom[0].unmergedAt, later); assert.deepEqual(k.items.filter(i => i.kind === 'post-merge-review').map(i => i.ref).sort(), ['r3', 'v3']); assert.equal(k.items.find(i => i.kind === 'referral').state, 'resolved', 'resolved items keep their resolution'); });
  check(() => { g.ensureNotMerged(s, { type: 'startVisit', personId: 'D' }); status(() => run(s, 'c1', { type: 'identityUnmerge', caseId, version: k.version, reason: 'Different mothers, confirmed again' }), 409); });
  check(() => { run(s, 'sup', { type: 'identityImpactResolve', caseId, version: k.version, itemId: k.items.find(i => i.ref === 'v3').id, note: 'Visit confirmed for this person' }); assert.equal(k.items.find(i => i.ref === 'v3').state, 'resolved'); });
  check(() => { assert.deepEqual(s.workspace.audit.map(a => a.action), ['identityMergePropose', 'identityMergeDecide', 'identityImpactResolve', 'identityUnmerge', 'identityImpactResolve']); });
  // Rejection keeps records separate and closes the proposal.
  s = fresh();
  const r = run(s, 'c1', propose());
  run(s, 'c2', { type: 'identityMergeDecide', caseId: r.caseId, version: 1, decision: 'reject', reason: 'Different dates of birth in ANC card' });
  check(() => { const kk = s.identityCases[0]; assert.equal(kk.state, 'rejected'); assert.equal(P(s, 'D').mergedInto, undefined); assert.equal(s.workspace.visits[0].plan.state, 'proposed'); status(() => run(s, 'c2', { type: 'identityMergeDecide', caseId: r.caseId, version: 2, decision: 'approve', reason: 'Changed my mind later' }), 409); status(() => run(s, 'c1', { type: 'identityUnmerge', caseId: r.caseId, version: 2, reason: 'Nothing to reverse here' }), 409); });
  check(() => { run(s, 'c2', propose()); assert.equal(s.identityCases.length, 2, 'a rejected pair can be proposed again'); });
  const result = { suite: 'merge contract (slice 1c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/merge-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
