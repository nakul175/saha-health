// Slice 6o consent withdrawal contract: authority, each downstream kind, history, the switch path and bounds.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.consent-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['consent', 'abdm', 'access', 'core', 'fact-provenance', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'consent.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', later = '2026-10-30T06:00:00.000Z', past = '2026-09-01T00:00:00.000Z';
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 40, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: true, exchangeConsent: true, consentVersion: 3, assigned: false, createdAt: now, version: 5 };
  const sub = (id, personId, state, over = {}) => ({ id, visitId: 'v1', personId, connectorId: 'mis', connectorName: 'Synthetic MIS', state, mode: 'http', payloadHash: 'h', attempts: state === 'queued' ? 0 : 1, message: '', createdAt: past, updatedAt: past, delivery: { events: [] }, ...over });
  const run = (id, status, over = {}) => ({ id, status, provider: { id: 'local', name: 'Local record assistant', mode: 'local' }, actorId: 'asha', createdAt: past, startedAt: past, finishedAt: status === 'review' ? past : undefined, message: '', steps: [{ name: 'a', state: 'done' }, { name: 'b', state: 'pending' }, { name: 'c', state: 'pending' }], ...over });
  const msg = (id, personId, state) => ({ id, version: 1, planId: 'op', itemId: 'oi', personId, templateId: 't', templateVersion: 1, body: 'x', scheduledAt: later, createdAt: past, createdBy: 'asha', authorVersion: 1, state, attempts: state === 'simulated' ? [{ at: past, by: 'asha', result: 'simulated', receipt: 'SIM' }] : [] });
  const abdm = (id, status, expiresAt = later) => ({ id, purpose: 'CAREMGT', hiTypes: ['OPConsultation'], from: '2026-01-01', to: '2026-09-30', expiresAt, status, requestedBy: 'doc', requestedAt: past, abhaNumber: '91-0000-0000-0001' });
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }, { id: 't2', name: 'Two', createdAt: now }], invitations: [],
    members: [member('doc', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('sup', 'supervisor', ['t1']), member('doc2', 'clinician', ['t2']), member('adm', 'admin', [], { isOwner: true })],
    outreach: { plans: [], templates: [], messages: [msg('m1', 'P', 'draft'), msg('m2', 'P', 'approved'), msg('m3', 'P', 'failed'), msg('m4', 'P', 'simulated'), msg('m5', 'P', 'cancelled'), msg('m6', 'Q', 'draft')] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [],
      people: [
        { ...base, id: 'P', name: 'Patient P', teamId: 't1', assignedTo: 'asha',
          contactPreferences: { version: 2, method: 'sms', destination: 'TEST-1', ownership: 'personal', language: 'en', timezone: 'UTC', from: '08:00', to: '18:00', permission: true, privateContact: false, reference: 'REF', updatedAt: past, by: 'asha' },
          ehr: { links: [{ id: 'l1', status: 'active' }], permissions: [{ id: 'g1', direction: 'write', status: 'active', expiresAt: later }, { id: 'g2', direction: 'read', status: 'active', expiresAt: past }, { id: 'g3', direction: 'read', status: 'revoked', expiresAt: later }], documents: [],
            operations: [{ id: 'o1', state: 'prepared', at: past, message: '' }, { id: 'o2', state: 'running', at: past }, { id: 'o3', state: 'accepted', at: past, receipt: 'EHR-1' }, { id: 'o4', state: 'uncertain', at: past }, { id: 'o5', state: 'blocked', at: past }] },
          abdmConsents: [abdm('a1', 'GRANTED'), abdm('a2', 'REQUESTED'), abdm('a3', 'GRANTED', past), abdm('a4', 'DENIED')],
          careContexts: [{ id: 'cc1', visitId: 'v1', display: 'Visit on 1 Sep', hiType: 'OPConsultation', recordDate: past, linkedAt: past, linkedBy: 'doc', abhaNumber: 'x' }],
          abdmReceived: [{ id: 'rr1', hiType: 'OPConsultation', receivedAt: past, state: 'accepted' }] },
        { ...base, id: 'Q', name: 'Patient Q', teamId: 't1', assignedTo: 'asha' },
        { ...base, id: 'R', name: 'Patient R', teamId: 't2', assignedTo: null },
      ],
      visits: [
        { id: 'v1', personId: 'P', plan: { id: 'pl1', state: 'approved', createdAt: past }, aiResults: [{ id: 'ai1', providerName: 'Demo summary', mode: 'demo', createdAt: past, reviewed: true }],
          agentRuns: [run('r1', 'pending'), run('r2', 'review'), run('r3', 'running'), run('r4', 'applied'), run('r5', 'cancelled')] },
        { id: 'v2', personId: 'P', plan: { id: 'pl2', state: 'completed', createdAt: past }, aiResults: [] },
        { id: 'v3', personId: 'Q', plan: { id: 'pl3', state: 'proposed', createdAt: past }, aiResults: [], agentRuns: [run('r6', 'pending')] },
      ],
      submissions: [sub('s1', 'P', 'queued'), sub('s2', 'P', 'retryable'), sub('s3', 'P', 'sending'), sub('s4', 'P', 'uncertain'), sub('s5', 'P', 'accepted', { receipt: 'SIM-1' }), sub('s6', 'P', 'rejected'), sub('s7', 'P', 'cancelled'), sub('s8', 'Q', 'queued')] },
  };
  const M = id => s.members.find(m => m.userId === id), P = s.workspace.people[0], Q = s.workspace.people[1];
  const as = userId => { const m = M(userId); s.workspace.role = m.role; for (const p of s.workspace.people) p.assigned = allowed(m, p); return m; };
  const apply = (userId, cmd, when = now) => { const m = as(userId); return x.applyConsent(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, m, when); };
  const withdraw = (over = {}) => ({ type: 'withdrawConsent', personId: 'P', version: P.version, purpose: 'exchange', channel: 'in-person', reference: 'FORM-W1', reason: 'Patient no longer wants records shared', ...over });
  const S = id => s.workspace.submissions.find(v => v.id === id);
  const kinds = (e, kind) => Object.fromEntries(e.items.filter(i => i.kind === kind).map(i => [i.ref, i.disposition]));

  // Authority, schema, version and state checks.
  check(() => { status(() => apply('adm', withdraw()), 403); status(() => apply('sup', withdraw()), 403); status(() => apply('doc2', withdraw()), 403); status(() => apply('asha', withdraw({ personId: 'R' })), 403); });
  check(() => { status(() => apply('asha', withdraw({ reason: 'short' })), 422); status(() => apply('asha', withdraw({ reference: 'x' })), 422); status(() => apply('asha', withdraw({ purpose: 'marketing' })), 422); status(() => apply('asha', withdraw({ extra: 1 })), 422); });
  check(() => { status(() => apply('asha', withdraw({ version: 4 })), 409); assert.equal(apply('asha', { type: 'rightsCreate' }), null); x.authorizeConsent(s, M('sup'), { type: 'rightsCreate' }); });
  check(() => { assert.equal(P.consentHistory, undefined, 'refused commands record nothing'); assert.equal(S('s1').state, 'queued'); assert.equal(s.workspace.audit.length, 0); });

  // Exchange withdrawal: each downstream kind.
  const ex = apply('asha', withdraw());
  const e1 = P.consentHistory.at(-1);
  check(() => { assert.equal(P.exchangeConsent, false); assert.equal(P.consentVersion, 4); assert.equal(e1.purpose, 'exchange'); assert.equal(e1.action, 'withdrawn'); assert.equal(e1.by, 'asha'); assert.equal(e1.byName, 'ASHA'); assert.equal(e1.role, 'asha'); assert.equal(e1.channel, 'in-person'); assert.equal(e1.reference, 'FORM-W1'); assert.equal(e1.fromVersion, 3); assert.equal(e1.toVersion, 4); assert.equal(e1.at, now); assert.equal(ex.eventId, e1.id); });
  check(() => { assert.deepEqual(kinds(e1, 'programme-submission'), { s1: 'stopped', s2: 'stopped', s3: 'in-flight', s4: 'in-flight', s5: 'already-sent' }); assert.equal(S('s1').state, 'cancelled'); assert.equal(S('s2').state, 'cancelled'); assert.equal(S('s3').state, 'sending'); assert.equal(S('s4').state, 'uncertain'); assert.equal(S('s5').state, 'accepted'); assert.equal(S('s1').delivery.events.at(-1).state, 'cancelled'); assert.match(S('s1').message, /withdrawn/); });
  check(() => { assert.equal(S('s8').state, 'queued', 'another patient is untouched'); assert.equal(s.workspace.visits[2].plan.state, 'proposed'); assert.equal(s.workspace.visits[2].agentRuns[0].status, 'pending'); assert.equal(Q.exchangeConsent, true); });
  check(() => { assert.deepEqual(kinds(e1, 'programme-plan'), { pl1: 'stopped' }); assert.equal(s.workspace.visits[0].plan.state, 'blocked'); assert.equal(s.workspace.visits[1].plan.state, 'completed'); });
  check(() => { assert.deepEqual(kinds(e1, 'ehr-permission'), { g1: 'stopped', g2: 'stopped' }); assert.deepEqual(P.ehr.permissions.map(g => g.status), ['revoked', 'revoked', 'revoked']); assert.equal(e1.items.find(i => i.ref === 'g2').before, 'expired'); assert.equal(P.ehr.links[0].status, 'active', 'identity links are not consent'); });
  check(() => { assert.deepEqual(kinds(e1, 'ehr-publication'), { o1: 'stopped', o2: 'in-flight', o3: 'already-sent', o4: 'in-flight' }); assert.deepEqual(P.ehr.operations.map(o => o.state), ['blocked', 'running', 'accepted', 'uncertain', 'blocked']); assert.match(e1.items.find(i => i.ref === 'o3').detail, /EHR-1/); });
  check(() => { assert.deepEqual(kinds(e1, 'abdm-consent'), { a1: 'stopped', a2: 'stopped' }); assert.deepEqual(P.abdmConsents.map(a => a.status), ['REVOKED', 'REVOKED', 'GRANTED', 'DENIED']); assert.equal(P.abdmConsents[0].revokedAt, now); assert.deepEqual(kinds(e1, 'abdm-care-context'), { cc1: 'kept' }); assert.deepEqual(kinds(e1, 'abdm-received'), { rr1: 'kept' }); });
  check(() => { assert.equal(ex.items, e1.items.length); assert.equal(ex.stopped, 8); assert.equal(ex.inFlight, 4); assert.equal(ex.alreadySent, 2); assert.equal(kinds(e1, 'ai-request').r1, undefined, 'AI work is not affected by a sharing withdrawal'); assert.equal(s.outreach.messages[0].state, 'draft'); });
  check(() => { const a = s.workspace.audit.at(-1); assert.equal(a.action, 'withdrawConsent'); assert.equal(a.personId, 'P'); assert.equal(a.actorId, 'asha'); assert.match(a.detail, /External record sharing permission withdrawn \(version 3 to 4, in-person, reference FORM-W1\)\. 8 stopped, 4 awaiting a receipt, 2 already sent/); });
  check(() => { status(() => apply('asha', withdraw()), 409); assert.equal(P.consentHistory.length, 1, 'nothing to withdraw twice'); });

  // AI withdrawal: pending stopped, returned output withdrawn from review, running withheld on return, results kept.
  const aiResult = apply('doc', withdraw({ purpose: 'ai', channel: 'phone', reference: 'CALL-2', reason: 'Does not want AI used on her records' }));
  const e2 = P.consentHistory.at(-1), runs = s.workspace.visits[0].agentRuns;
  check(() => { assert.equal(P.aiConsent, false); assert.equal(P.consentVersion, 5); assert.equal(e2.fromVersion, 4); assert.equal(e2.toVersion, 5); assert.equal(e2.role, 'clinician'); assert.deepEqual(kinds(e2, 'ai-request'), { r1: 'stopped', r2: 'already-sent', r3: 'in-flight' }); assert.deepEqual(runs.map(r => r.status), ['cancelled', 'cancelled', 'running', 'applied', 'cancelled']); });
  check(() => { assert.match(runs[0].message, /Nothing was sent/); assert.equal(runs[0].steps[1].state, 'blocked'); assert.match(e2.items.find(i => i.ref === 'r2').detail, /no data left Saha/); assert.deepEqual(kinds(e2, 'ai-result'), { ai1: 'kept' }); assert.equal(aiResult.stopped, 1); assert.equal(s.workspace.visits[2].agentRuns[0].status, 'pending'); });

  // Contact withdrawal: pending reminders cancelled, simulated listed, preferences versioned.
  apply('asha', withdraw({ purpose: 'contact', channel: 'written', reference: 'LETTER-3', reason: 'No more text reminders please' }));
  const e3 = P.consentHistory.at(-1), out = s.outreach.messages;
  check(() => { assert.equal(P.contactPreferences.permission, false); assert.equal(P.contactPreferences.version, 3); assert.equal(e3.fromVersion, 2); assert.equal(e3.toVersion, 3); assert.equal(P.consentVersion, 5, 'contact has its own version'); assert.deepEqual(kinds(e3, 'outreach-message'), { m1: 'stopped', m2: 'stopped', m3: 'stopped', m4: 'already-sent' }); assert.deepEqual(out.map(v => v.state), ['cancelled', 'cancelled', 'cancelled', 'simulated', 'cancelled', 'draft']); assert.equal(out[0].cancelReason, 'Contact permission withdrawn.'); assert.equal(out[0].version, 2); });
  check(() => { status(() => apply('asha', withdraw({ personId: 'Q', version: Q.version, purpose: 'contact' })), 409); });

  // The permission switch records grants and withdrawals the same way.
  const g = apply('asha', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: true, version: P.version });
  const e4 = P.consentHistory.at(-1);
  check(() => { assert.equal(g.action, 'granted'); assert.equal(P.exchangeConsent, true); assert.equal(e4.channel, 'switch'); assert.equal(e4.fromVersion, 5); assert.equal(e4.toVersion, 6); assert.equal(e4.items.length, 0); assert.match(s.workspace.audit.at(-1).detail, /permission recorded \(version 5 to 6\)/); assert.equal(s.workspace.audit.at(-1).action, 'setConsent'); });
  P.ehr.permissions.push({ id: 'g9', direction: 'read', status: 'active', expiresAt: later }); s.workspace.submissions.push(sub('s9', 'P', 'queued'));
  check(() => { status(() => apply('sup', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: false, version: P.version }), 403); status(() => apply('asha', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: false, version: 1 }), 409); });
  apply('asha', { type: 'setConsent', personId: 'P', purpose: 'exchange', active: false, version: P.version });
  const e5 = P.consentHistory.at(-1);
  check(() => { assert.equal(e5.action, 'withdrawn'); assert.equal(e5.channel, 'switch'); assert.equal(e5.reason, 'Recorded with the permission switch.'); assert.deepEqual(kinds(e5, 'programme-submission'), { s3: 'in-flight', s4: 'in-flight', s5: 'already-sent', s9: 'stopped' }); assert.equal(S('s9').state, 'cancelled'); assert.equal(P.ehr.permissions.at(-1).status, 'revoked'); });
  check(() => { assert.equal(apply('asha', { type: 'setConsent', personId: 'P', purpose: 'contact', active: false, version: P.version }), null, 'the switch has no contact purpose'); });

  // History bounds and what stays traceable.
  check(() => { for (let n = 0; n < 150; n++) s.workspace.submissions.push(sub('bulk' + n, 'Q', 'queued')); const r = apply('asha', withdraw({ personId: 'Q', version: Q.version })); const e = Q.consentHistory.at(-1); assert.equal(r.items, x.MAX_ITEMS); assert.equal(e.items.length, x.MAX_ITEMS); assert.equal(e.omitted, 52); assert.ok(s.workspace.submissions.filter(v => v.personId === 'Q').every(v => v.state === 'cancelled'), 'every item is stopped even when the stored list is bounded'); });
  check(() => { for (let n = 0; n < x.MAX_HISTORY + 5; n++) x.recordConsent(Q, { purpose: 'ai', action: 'granted', at: now, by: 'asha', byName: 'ASHA', role: 'asha', channel: 'switch', reference: '', reason: '', fromVersion: n, toVersion: n + 1, items: [] }); assert.equal(Q.consentHistory.length, x.MAX_HISTORY); assert.equal(Q.consentHistory.at(-1).toVersion, x.MAX_HISTORY + 5); });
  check(() => { assert.equal(x.granted(P, 'contact'), false); assert.equal(x.granted(P, 'ai'), false); assert.equal(x.granted(Q, 'ai'), true); assert.equal(x.PURPOSE_LABEL.contact, 'Automated contact'); });

  const result = { suite: 'consent withdrawal contract (slice 6o)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/consent-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
