// Slice 4c worker activity contract: scope, the four activity states, corrections and traceability.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.worker-activity-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'worker-activity'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'worker-activity.js')));
  const now = new Date('2026-09-30T06:00:00.000Z'), ago = d => new Date(now.getTime() - d * 86400000).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: ago(100), ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: true, consentVersion: 1, assigned: false, createdAt: ago(100), version: 1 };
  const visit = (id, personId, by, days, over = {}) => ({ id, personId, version: 3, recordVersion: 1, state: 'confirmed', facts: {}, aiResults: [], createdAt: ago(days), confirmedAt: ago(days), patientCheck: { personId, personVersion: 1, by, at: ago(days) }, ...over });
  const sub = (id, visitId, personId, state, receipt) => ({ id, visitId, personId, connectorId: 'mis', connectorName: 'MIS', state, mode: 'demo', payloadHash: 'h', attempts: 1, message: '', createdAt: ago(1), updatedAt: ago(1), ...(receipt ? { receipt } : {}) });
  const event = (by, days, state, visitId, reference = 'REF-1') => ({ at: ago(days), by, state, note: 'Synthetic outcome note', reference, ...(visitId ? { visitId } : {}) });
  const s = {
    organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: ago(100) }, teams: [{ id: 't1', name: 'One', createdAt: ago(100) }, { id: 't2', name: 'Two', createdAt: ago(100) }], invitations: [],
    operations: { version: 1, maintenance: false, reason: '', updatedAt: ago(1), incidents: [], rates: null, delegations: [{ id: 'dg', version: 1, kind: 'team-supervision', grantorId: 'sup', delegateId: 'doc2', teamIds: ['t1'], from: ago(1), until: ago(-5), reason: 'Cover', createdAt: ago(1) }] },
    members: [member('sup', 'supervisor', ['t1']), member('own', 'clinician', ['t1', 't2'], { isOwner: true }), member('doc', 'clinician', ['t1']), member('doc2', 'clinician', ['t1']), member('asha', 'asha', ['t1']), member('asha2', 'asha', ['t2']), member('adm', 'admin', [], { isOwner: true }), member('gone', 'asha', ['t1'], { status: 'removed' })],
    outreach: { templates: [], messages: [], plans: [{ id: 'op', version: 3, title: 'September round', date: ago(2).slice(0, 10), teamId: 't1', criteria: 'x', createdAt: ago(5), createdBy: 'sup', state: 'scheduled', history: [], items: [
      { id: 'i1', personId: 'P', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 2, 'attempted'), event('asha', 2, 'completed', 'v1')] },
      { id: 'i2', personId: 'P', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 3, 'completed', 'v2')] },
      { id: 'i3', personId: 'P', ownerId: 'asha', reason: 'x', state: 'completed', events: [event('asha', 1, 'completed')] },
      { id: 'i4', personId: 'Q', ownerId: 'asha2', reason: 'x', state: 'completed', events: [event('asha2', 1, 'completed', 'v6')] }] }] },
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [],
      people: [{ ...base, id: 'P', name: 'Patient P', teamId: 't1', assignedTo: 'asha' }, { ...base, id: 'Q', name: 'Patient Q', teamId: 't2', assignedTo: 'asha2' }],
      visits: [visit('v1', 'P', 'asha', 2), visit('v2', 'P', 'asha', 3, { voidedAt: ago(1), voidReason: 'Recorded against the wrong person' }), visit('v3', 'P', 'asha', 4, { supersededBy: 'v4' }), visit('v4', 'P', 'doc', 1, { amendsVisitId: 'v3' }), visit('v5', 'P', 'asha', 40), visit('v6', 'Q', 'asha2', 1), visit('v7', 'P', 'asha', 1, { state: 'draft', confirmedAt: undefined }), visit('v8', 'P', 'asha', 5), visit('v9', 'P', 'asha', 6), visit('v10', 'P', 'gone', 7)],
      submissions: [sub('s1', 'v1', 'P', 'accepted', 'SIM-1'), sub('s1b', 'v1', 'P', 'rejected'), sub('s8', 'v8', 'P', 'queued'), sub('s9', 'v9', 'P', 'rejected'), sub('s2', 'v2', 'P', 'accepted', 'SIM-2')] },
  };
  const M = id => s.members.find(m => m.userId === id);
  const corrections = [{ visitId: 'v2', action: 'voidVisit', actorName: 'SUP', reason: 'Recorded against the wrong person', at: ago(1) }, { visitId: 'v3', action: 'amendVisit', actorName: 'DOC', reason: 'Weight entered in the wrong field', at: ago(2) }];
  const view = (who, days = 30, fixes = corrections) => x.workerActivity(s, M(who), days, fixes, now);
  const W = (v, id) => v.workers.find(w => w.userId === id);

  // Who may review, and for which teams.
  check(() => { status(() => view('asha'), 403); status(() => view('adm'), 403); status(() => view('doc'), 403); status(() => view('sup', 14), 422); status(() => x.workerActivity(s, { ...M('sup'), status: 'suspended' }, 30, [], now), 403); });
  check(() => { assert.deepEqual(view('sup').teams.map(t => t.id), ['t1']); assert.deepEqual(view('own').teams.map(t => t.id), ['t1', 't2']); assert.deepEqual(view('doc2').teams.map(t => t.id), ['t1'], 'a supervision delegate reviews the delegated team'); assert.deepEqual(x.reviewTeams(s, M('doc2'), ago(-6)), [], 'not after the delegation ends'); });
  const v = view('sup'), a = W(v, 'asha');
  check(() => { assert.equal(W(v, 'asha2'), undefined, 'another team\'s workers are not shown'); assert.ok(!JSON.stringify(v).includes('Patient Q')); assert.equal(W(view('own'), 'asha2').counts.performed, 1); });
  // The four states and their counts.
  check(() => { assert.deepEqual(a.counts, { performed: 3, claimed: 3, verified: 1, unverified: 2, submitted: 1, submissionPending: 1, notSubmitted: 1, corrected: 1, wrongPatient: 1 }); assert.equal(W(v, 'doc').counts.performed, 1); assert.equal(W(v, 'gone').displayName, 'GONE'); assert.equal(W(v, 'gone').status, 'removed'); });
  check(() => { const i = a.items.find(i => i.ref === 'v1'); assert.equal(i.status, 'performed'); assert.equal(i.submission, 'accepted'); assert.equal(i.receipt, 'SIM-1'); assert.equal(a.items.find(i => i.ref === 'v8').submission, 'pending'); assert.equal(a.items.find(i => i.ref === 'v9').submission, 'rejected'); assert.equal(a.items.some(i => i.ref === 'v7'), false, 'drafts are not activity'); assert.equal(a.items.some(i => i.ref === 'v5'), false, 'outside the period'); });
  check(() => { const o = a.items.filter(i => i.kind === 'outreach'); assert.deepEqual(o.map(i => [i.ref, i.status]).sort(), [['i1', 'verified'], ['i2', 'unverified'], ['i3', 'unverified']]); assert.match(o.find(i => i.ref === 'i1').trace, /Matched to the confirmed visit/); assert.match(o.find(i => i.ref === 'i2').trace, /no longer backed by a current visit/); assert.match(o.find(i => i.ref === 'i3').trace, /No linked visit/); });
  // Corrections leave the original evidence and who changed it.
  check(() => { const w = a.items.find(i => i.ref === 'v2'), c = a.items.find(i => i.ref === 'v3'); assert.equal(w.status, 'wrong-patient'); assert.match(w.trace, /wrong patient by SUP on 2026-09-29: Recorded against the wrong person\. Not counted; the original record is kept/); assert.equal(c.status, 'corrected'); assert.match(c.trace, /corrected by DOC on 2026-09-28: Weight entered in the wrong field\. The correction was confirmed on 2026-09-29 and counts in its place/); assert.match(W(v, 'doc').items[0].trace, /corrects an earlier visit/); });
  check(() => { const w = view('sup', 30, []); assert.match(W(w, 'asha').items.find(i => i.ref === 'v2').trace, /on 2026-09-29: Recorded against the wrong person/, 'without a revision the visit\'s own reason is shown'); });
  check(() => { assert.equal(W(view('sup', 90), 'asha').counts.performed, 4); assert.equal(W(view('sup', 7), 'asha').counts.performed, 3); assert.equal(W(view('sup', 7), 'gone'), undefined, 'seven days ago at 06:00 is before the 7-day period'); });
  // Acceptance: correcting an activity updates the derived counts and claims, and keeps the trace.
  s.workspace.visits[0].voidedAt = ago(0.5); s.workspace.visits[0].voidReason = 'Late wrong-patient finding';
  check(() => { const w = W(view('sup'), 'asha'); assert.equal(w.counts.performed, 2); assert.equal(w.counts.submitted, 0); assert.equal(w.counts.wrongPatient, 2); assert.equal(w.counts.verified, 0); assert.equal(w.items.find(i => i.ref === 'i1').status, 'unverified'); assert.match(w.items.find(i => i.ref === 'v1').trace, /Late wrong-patient finding/); });
  // Bounds, notice and definitions.
  check(() => { for (let n = 0; n < 120; n++) s.workspace.visits.push(visit('bulk' + n, 'P', 'doc', 1)); const d = W(view('sup'), 'doc'); assert.equal(d.items.length, x.MAX_ITEMS); assert.equal(d.omitted, 21); assert.equal(d.counts.performed, 121); });
  check(() => { assert.match(v.notice, /not a payment claim, incentive calculation or performance rating/); assert.deepEqual(Object.keys(v.definitions), ['performed', 'claimed', 'verified', 'submitted']); assert.match(v.scope, /No location data/); assert.ok(!/village|Synthetic"/.test(JSON.stringify(v.workers)), 'no location fields in the rows'); });

  const result = { suite: 'worker activity contract (slice 4c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/worker-activity-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
