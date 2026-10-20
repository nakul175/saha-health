// Slice 6b rights-request contract: intake, representative authority, destinations, closure and restriction.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.rights-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const file of readdirSync('lib/saha').filter(file => file.endsWith('.ts')))
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${file}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'rights.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', at = d => new Date(Date.parse(now) + d * 86400000).toISOString(), future = at(100);
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 40, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }, { id: 't2', name: 'Two', createdAt: now }], invitations: [],
    members: [member('doc', 'clinician', ['t1']), member('doc2', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('sup', 'supervisor', ['t1']), member('sup2', 'supervisor', ['t2']), member('adm', 'admin', [], { isOwner: true })],
    retention: { policies: [{ version: 1, rules: [{ recordClass: 'patient-record', years: 7 }], basis: 'Synthetic approved retention schedule', setBy: 'adm', setAt: now }], holds: [] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [],
      people: [
        { ...base, id: 'P', name: 'Patient P', teamId: 't1', assignedTo: 'asha', proxies: [{ id: 'g1', proxyPersonId: 'H', relationship: 'spouse', purposes: ['care-coordination'], classes: [], evidence: 'SYNTH-PROXY', from: now, expiresAt: future, grantedBy: 'asha', grantedAt: now }, { id: 'g2', proxyPersonId: 'H', relationship: 'spouse', purposes: ['care-coordination'], classes: [], evidence: 'SYNTH-REVOKED', from: now, expiresAt: future, grantedBy: 'asha', grantedAt: now, revokedAt: now }], ehr: { links: [], permissions: [], documents: [], operations: [{ id: 'op1', state: 'accepted', at: now }, { id: 'op2', state: 'blocked', at: now }] } },
        { ...base, id: 'H', name: 'Husband H', teamId: 't1', assignedTo: 'asha' },
        { ...base, id: 'Q', name: 'Patient Q', teamId: 't2', assignedTo: null },
      ],
      visits: [{ id: 'v1', personId: 'P' }],
      submissions: [{ id: 's1', personId: 'P', connectorName: 'Synthetic MIS', state: 'accepted', createdAt: now }, { id: 's2', personId: 'P', connectorName: 'Synthetic MIS', state: 'rejected', createdAt: now }] },
  };
  const M = id => s.members.find(m => m.userId === id), P = s.workspace.people[0];
  const as = userId => { const m = M(userId); for (const p of s.workspace.people) p.assigned = allowed(m, p); return m; };
  const run = (userId, cmd, when = now) => { const m = as(userId); return x.applyRights(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, m, when); };
  const policy = { type: 'rightsPolicySet', operationsVersion: 0, rules: [{kind:'access',dueDays:20},{kind:'correction',dueDays:25},{kind:'restriction',dueDays:5},{kind:'deletion',dueDays:30},{kind:'grievance',dueDays:10}], responsibleOrganisation: 'Synthetic accountable health organisation', grievanceEscalationOrganisation: 'Synthetic independent grievance office', grievanceEscalationDays: 7, identityMethods: ['in-person-document','known-care-relationship','verified-callback','signed-written-request','representative-grant'], basis: 'SYNTH-RIGHTS-POLICY-1 approved for contract testing' };
  const create = (over = {}) => ({ type: 'rightsCreate', personId: 'P', kind: 'access', channel: 'in-person', requester: 'self', identityMethod: 'in-person-document', identityEvidence: 'ANC-CARD-1', detail: 'Wants a copy of her visit records', ...over });
  const R = id => s.rightsRequests.find(r => r.id === id);
  check(() => { status(() => run('asha', create()), 409); status(() => run('doc', policy), 403); assert.equal(run('adm', policy).version, 1); status(()=>run('adm',{...policy,basis:'Stale policy update should be refused'}),409); assert.equal(s.operations.rightsPolicies.length, 1); });
  check(() => { status(() => run('adm', create()), 403); status(() => run('doc', create({ personId: 'Q' })), 403); status(() => run('asha', create({ proxyGrantId: 'g1' })), 422); status(() => run('asha', create({ requester: 'proxy' })), 422); status(() => run('asha', create({ requester: 'proxy', proxyGrantId: 'g2' })), 422); });
  check(() => assert.equal(run('asha', create({ detail: 'short' })), null, 'schema requires detail'));
  const a1 = run('asha', create());
  check(() => { const r = R(a1.requestId); assert.equal(r.ownerId, 'asha'); assert.equal(r.dueAt, at(20)); assert.equal(r.policy.version, 1); assert.equal(r.items.length, 0, 'access requests notify no destination'); assert.equal(s.workspace.audit.at(-1).personId, 'P'); });
  const viaProxy = run('asha', create({ requester: 'proxy', proxyGrantId: 'g1', identityMethod: 'representative-grant', kind: 'grievance', detail: 'Husband complains about a missed visit' }));
  check(() => assert.equal(R(viaProxy.requestId).proxyGrantId, 'g1'));
  check(() => { for (const kind of ['access','correction','restriction','deletion']) status(() => run('asha', create({ requester: 'proxy', proxyGrantId: 'g1', identityMethod: 'representative-grant', kind, detail: `Representative asks for ${kind} of confidential history` })), 403); });
  const grievance=R(viaProxy.requestId);
  check(() => { status(() => run('doc2',{type:'rightsEscalate',requestId:grievance.id,version:1,ownerId:'doc2',reason:'Needs independent accountable review',evidence:'ESC-1'}),403); const e=run('asha',{type:'rightsEscalate',requestId:grievance.id,version:1,ownerId:'doc2',reason:'Needs independent accountable review',evidence:'ESC-1'}); assert.equal(e.dueAt,at(7)); status(() => run('asha',{type:'rightsEscalate',requestId:grievance.id,version:1,ownerId:'doc2',reason:'Stale duplicate escalation attempt',evidence:'ESC-2'}),409); });
  run('asha',{type:'rightsEvidenceAdd',requestId:grievance.id,version:2,kind:'grievance-outcome',reference:'GRV-OUT-1',note:'Independent office outcome will be retained'});
  check(() => status(() => run('asha',{type:'rightsClose',requestId:grievance.id,version:3,outcome:'fulfilled',response:'Complaint investigated and answered',evidence:'RESP-G1'}),409));
  run('asha',{type:'rightsEscalationResolve',requestId:grievance.id,version:3,escalationId:grievance.escalations[0].id,outcome:'Independent office upheld the response',evidence:'ESC-OUT-1'});
  run('asha',{type:'rightsClose',requestId:grievance.id,version:4,outcome:'fulfilled',response:'Complaint investigated and answered',evidence:'RESP-G1'});
  const corr = run('asha', create({ kind: 'correction', detail: 'Age recorded wrongly in programme record' }));
  const cr = R(corr.requestId);
  check(() => { assert.equal(corr.items, 2); assert.deepEqual(cr.items.map(i => i.ref).sort(), ['op1', 's1']); });
  // Assignment and closure.
  check(() => { status(() => run('asha', { type: 'rightsAssign', requestId: cr.id, version: 1, ownerId: 'doc2', note: 'Clinician to correct it' }), 403); status(() => run('sup2', { type: 'rightsAssign', requestId: cr.id, version: 1, ownerId: 'doc2', note: 'Clinician to correct it' }), 403); status(() => run('sup', { type: 'rightsAssign', requestId: cr.id, version: 1, ownerId: 'adm', note: 'Admin cannot own' }), 422); status(() => run('sup', { type: 'rightsAssign', requestId: cr.id, version: 1, ownerId: 'sup2', note: 'Other team cannot own' }), 422); });
  run('sup', { type: 'rightsAssign', requestId: cr.id, version: 1, ownerId: 'doc2', note: 'Clinician to correct it' });
  check(() => { assert.equal(cr.ownerId, 'doc2'); assert.equal(cr.version, 2); assert.equal(cr.history.at(-1).action, 'assigned'); });
  check(() => { status(() => run('doc2', { type: 'rightsClose', requestId: cr.id, version: 2, outcome: 'fulfilled', response: 'Age corrected in Saha', evidence: 'REV-12' }), 409); status(() => run('doc', { type: 'rightsClose', requestId: cr.id, version: 2, outcome: 'fulfilled', response: 'Age corrected in Saha', evidence: 'REV-12' }), 403); status(() => run('asha', { type: 'rightsItemResolve', requestId: cr.id, version: 2, itemId: cr.items[0].id, state: 'notified', note: 'Called them' }), 403); });
  run('doc2', { type: 'rightsItemResolve', requestId: cr.id, version: 2, itemId: cr.items[0].id, state: 'notified', note: 'Correction sent through the destination form' });
  run('doc2', { type: 'rightsItemResolve', requestId: cr.id, version: 3, itemId: cr.items[1].id, state: 'not-required', note: 'Destination does not hold age' });
  check(() => status(() => run('doc2', { type: 'rightsItemResolve', requestId: cr.id, version: 4, itemId: cr.items[1].id, state: 'notified', note: 'Second time' }), 409));
  run('doc2', { type: 'rightsEvidenceAdd', requestId: cr.id, version: 4, kind: 'correction-record', reference: 'REV-12', note: 'Append-only correction revision was inspected' });
  const closed = run('doc2', { type: 'rightsClose', requestId: cr.id, version: 5, outcome: 'fulfilled', response: 'Age corrected in Saha and destinations told', evidence: 'RESP-12' }, at(10));
  check(() => { assert.equal(cr.state, 'closed'); assert.equal(closed.late, false); assert.equal(cr.closed.outcome, 'fulfilled'); status(() => run('doc2', { type: 'rightsClose', requestId: cr.id, version: 5, outcome: 'withdrawn', response: 'Closing again for test', evidence: 'X-1' }), 409); });
  // Deletion can be refused with destinations still open; lateness is recorded.
  const del = run('asha', create({ kind: 'deletion', detail: 'Wants all records removed' }));
  run('sup', { type: 'rightsDeletionReview', requestId: del.requestId, version: 1, disposition: 'retain-required', reference: 'RET-REVIEW-3', note: 'Approved retention schedule requires the clinical record' }, at(31));
  const late = run('sup', { type: 'rightsClose', requestId: del.requestId, version: 2, outcome: 'refused', response: 'Clinical records must be retained; explained in person', evidence: 'LETTER-3' }, at(31));
  check(() => { assert.equal(late.late, true); assert.match(s.workspace.audit.at(-1).detail, /after the policy due date/); });
  // Restriction pauses sharing and optional AI until lifted.
  const res = run('asha', create({ kind: 'restriction', detail: 'Does not want records shared with programmes' }));
  const rr = R(res.requestId);
  for (const i of rr.items) run('asha', { type: 'rightsItemResolve', requestId: rr.id, version: rr.version, itemId: i.id, state: 'notified', note: 'Destination informed of restriction' });
  run('asha', { type: 'rightsEvidenceAdd', requestId: rr.id, version: rr.version, kind: 'restriction-outcome', reference: 'FORM-7', note: 'Restriction notice reviewed with the requester' });
  run('asha', { type: 'rightsClose', requestId: rr.id, version: rr.version, outcome: 'fulfilled', response: 'Sharing paused as requested', evidence: 'FORM-7' });
  check(() => { assert.equal(x.activeRestriction(P).requestId, rr.id); s.outreach={messages:[{id:'m1',personId:'P'}]}; for (const c of [{ type: 'executePlan', visitId: 'v1' }, { type: 'sendSubmission', submissionId: 's1' }, { type: 'runAI', visitId: 'v1' }, { type: 'messageCreate', personId: 'P' }, { type: 'messageAcknowledge', messageId: 'm1' }]) status(() => x.ensureNotRestricted(s, c), 409); x.ensureNotRestricted(s, { type: 'startVisit', personId: 'P' }); x.ensureNotRestricted(s, { type: 'executePlan', visitId: 'other' }); });
  check(() => { status(() => run('doc', { type: 'rightsRestrictionLift', requestId: rr.id, version: rr.version, reason: 'Patient changed her mind' }), 403); status(() => run('asha', { type: 'rightsRestrictionLift', requestId: a1.requestId, version: 1, reason: 'Wrong request for lifting' }), 409); });
  run('asha', { type: 'rightsRestrictionLift', requestId: rr.id, version: rr.version, reason: 'Patient asked to resume programme reporting' });
  check(() => { assert.equal(x.activeRestriction(P), undefined); x.ensureNotRestricted(s, { type: 'sendSubmission', submissionId: 's1' }); status(() => run('asha', { type: 'rightsRestrictionLift', requestId: rr.id, version: rr.version, reason: 'Lifting a second time' }), 409); });
  const legacy={...R(a1.requestId),id:'legacy-rights-row',version:1,policy:undefined,identity:undefined,evidence:[]};s.rightsRequests.push(legacy);
  check(() => { status(() => run('asha',{type:'rightsEvidenceAdd',requestId:legacy.id,version:1,kind:'record-copy',reference:'LEGACY-1',note:'Legacy row must not gain modern evidence'}),409); status(() => run('asha',{type:'rightsClose',requestId:legacy.id,version:1,outcome:'fulfilled',response:'Legacy row must not close',evidence:'LEGACY-1'}),409); });
  s.rightsRequests.pop();
  // Views.
  check(() => { const v = x.rightsView(s, as('asha'), 'P', at(31)); assert.deepEqual(v.owners.map(o => o.userId).sort(), ['asha', 'doc', 'doc2', 'sup']); assert.deepEqual(v.proxies.map(g => g.id), ['g1']); assert.equal(v.requests.length, 5); assert.equal(v.requests.find(r => r.id === a1.requestId).overdue, true); assert.equal(v.restricted, false); assert.equal(v.policy.version,1); });
  check(() => { const v = x.rightsView(s, as('sup'), null, at(31)); assert.equal(v.open.length, 1); assert.equal(v.overdue, 1); assert.ok(v.open.every(r => r.canAssign)); assert.deepEqual(x.rightsView(s, as('sup2'), null, at(31)).open, []); });
  check(() => { for (let n = 0; n < 9; n++) run('asha', create({ detail: 'Synthetic repeated access request ' + n })); status(() => run('asha', create()), 422); });
  const result = { suite: 'rights request contract (slice 6b)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/rights-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
