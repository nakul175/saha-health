// Slice 6ae (tenth independent review, finding 1): a scheduled caseload transfer that is refused part-way through
// automatic application must leave every assignment unchanged and be held; nothing is half-applied.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.tenth-review-fixes-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const c = await import(pathToFileURL(join(dir, 'caseload.js')));
  const { allowed } = await import(pathToFileURL(join(dir, 'access.js')));
  const now = '2026-09-30T06:00:00.000Z', day = 86400000, at = ms => new Date(Date.parse(now) + ms).toISOString();
  const member = (userId, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const base = { age: 30, sex: 'Unknown', village: 'S', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: false, createdAt: now, version: 1 };
  const org = () => {
    const s = { organisation: { id: 'org', name: 'S', revision: 1, createdAt: now }, teams: [{ id: 't1', name: 'One', createdAt: now }], invitations: [],
      members: [member('sup', 'supervisor', ['t1']), member('a1', 'asha', ['t1']), member('a2', 'asha', ['t1'])],
      workspace: { schemaVersion: 1, revision: 1, role: 'supervisor', integrations: [], submissions: [], receipts: {}, audit: [], referrals: [], visits: [],
        people: ['p1', 'p2'].map(id => ({ ...base, id, name: id, teamId: 't1', assignedTo: 'a1', followUps: [{ id: 'f' + id, enrolmentId: 'e', packId: 'm', title: 'C', due: '2026-11-01', ownerId: 'a1', state: 'open' }] })) }, caseloads: [] };
    for (const p of s.workspace.people) p.assigned = allowed(s.members[0], p);
    return s;
  };
  const schedule = s => c.applyCaseload(s, { type: 'caseloadTransfer', teamId: 't1', fromUserId: 'a1', toUserId: 'a2', personIds: ['p1', 'p2'], effectiveAt: at(day), reason: 'Synthetic leave cover' }, { userId: 'sup', displayName: 'SUP', email: '' }, s.members[0], now);

  // The reviewer's case: p2 cannot take another assignment entry, so the transfer fails after p1 would have moved.
  const s = org(); schedule(s);
  s.workspace.people[1].assignmentHistory = Array.from({ length: 100 }, (_, i) => ({ id: 'h' + i, at: now, by: 'x', fromTeam: 't1', fromOwner: 'a1', teamId: 't1', ownerId: 'a1', reason: 'r', openWork: 0 }));
  const before = JSON.stringify(s.workspace.people);
  const out = c.applyDueTransfers(s, at(day));
  check(() => assert.equal(out[0].state, 'held'));
  check(() => assert.equal(s.caseloads[0].state, 'held'));
  check(() => assert.equal(JSON.stringify(s.workspace.people), before, 'no patient, follow-up or history entry changed'));
  check(() => assert.equal(s.workspace.people[0].assignedTo, 'a1'));
  check(() => assert.equal(s.workspace.people[0].followUps[0].ownerId, 'a1'));
  check(() => assert.ok(s.workspace.audit.some(a => a.action === 'caseloadHold' && a.subject === s.caseloads[0].id)));
  check(() => assert.ok(!s.workspace.audit.some(a => a.action === 'caseloadAutoApply')));

  // A transfer that can be applied is still applied whole, and its audit event is in the committed state.
  const s2 = org(); schedule(s2);
  const out2 = c.applyDueTransfers(s2, at(day));
  check(() => assert.equal(out2[0].state, 'applied'));
  check(() => assert.deepEqual(s2.workspace.people.map(p => p.assignedTo), ['a2', 'a2']));
  check(() => assert.equal(s2.caseloads[0].state, 'applied'));
  check(() => assert.equal(s2.caseloads[0].applied.automatic, true));
  check(() => assert.ok(s2.workspace.audit.some(a => a.action === 'caseloadAutoApply' && a.subject === s2.caseloads[0].id)));

  const result = { suite: 'Tenth independent review fixes contract (slice 6ae)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/tenth-review-fixes-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
