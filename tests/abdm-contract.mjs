// Slice 7a ABDM mock contract: module approvals, ABHA link/decline/unlink, consent artefacts and enforcement.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.abdm-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'abdm.js')));
  const now = '2026-09-30T06:00:00.000Z', later = '2026-11-15T00:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: true, consentVersion: 1, createdAt: now, version: 1, teamId: 't1', assignedTo: 'asha', assigned: true };
  const s = { organisation: { id: 'org' }, teams: [], invitations: [], members: [member('own', 'clinician', { isOwner: true }), member('doc', 'clinician'), member('asha', 'asha'), member('sup', 'supervisor')],
    workspace: { role: 'clinician', audit: [], visits: [], submissions: [], referrals: [], integrations: [], people: [{ ...base, id: 'p1', name: 'P1' }, { ...base, id: 'p2', name: 'P2' }] } };
  const M = id => s.members.find(m => m.userId === id), P = id => s.workspace.people.find(p => p.id === id);
  const run = (userId, cmd, at = now) => { s.workspace.role = M(userId).role; return x.applyAbdm(s, cmd, { userId, displayName: userId, email: 'x' }, M(userId), at); };
  const cfg = (over = {}) => ({ type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip: false, hiu: true }, facilityId: 'SYN-FACILITY-1', approvals: [{ module: 'abha', reference: 'APPROVAL-ABHA-1' }, { module: 'hiu', reference: 'APPROVAL-HIU-1' }], reason: 'Synthetic mock configuration', ...over });
  const link = (personId, over = {}) => ({ type: 'abhaLink', personId, version: P(personId).version, abhaNumber: '91-1234-5678-9012', demographicMatch:'matched',confirmed:true,otp: x.MOCK_OTP, ...over });
  check(() => { status(() => run('doc', cfg()), 403); status(() => run('own', cfg({ environment: 'sandbox' })), 409); status(() => run('own', cfg({ approvals: [] })), 422); status(() => run('asha', link('p1')), 409); });
  check(() => { assert.equal(run('own', cfg()).version, 1); const i = s.workspace.integrations.find(i => i.kind === 'abdm'); assert.equal(i.abdm.environment, 'mock'); assert.match(s.workspace.audit.at(-1).detail, /No ABDM service is contacted/); });
  check(() => { status(() => run('sup', link('p1')), 403); status(() => run('asha', link('p1', { otp: '000000' })), 422); assert.equal(run('asha', { ...link('p1'), abhaNumber: '123' }), null); });
  // SAHA-084: the verified identity must have a positive demographic result and an explicit human confirmation.
  check(() => { const before = structuredClone(P('p1')), audits = s.workspace.audit.length; assert.equal(run('asha', { ...link('p1'), confirmed: undefined }), null); assert.deepEqual(P('p1'), before); assert.equal(s.workspace.audit.length, audits); });
  check(() => { for (const demographicMatch of ['mismatch', 'ambiguous']) { const before = structuredClone(P('p1')), audits = s.workspace.audit.length; const e = status(() => run('asha', link('p1', { demographicMatch })), 422); assert.match(e.message, demographicMatch === 'mismatch' ? /do not match/ : /ambiguous/); assert.deepEqual(P('p1'), before); assert.equal(s.workspace.audit.length, audits); } });
  const linked = run('asha', link('p1', { abhaNumber: '91123456789012', abhaAddress: 'synthetic.one@sbx' }));
  check(() => { assert.equal(linked.abha, '91-XXXX-XXXX-9012'); assert.equal(P('p1').abha.number, '91-1234-5678-9012', 'normalised'); assert.equal(P('p1').abha.verification, 'mock-otp'); assert.match(s.workspace.audit.at(-1).detail, /matched demographic result and explicit user confirmation/); assert.doesNotMatch(s.workspace.audit.at(-1).detail, /1234-5678/); });
  check(() => { const stale = { ...link('p2'), version: P('p2').version + 1 }; const before = structuredClone(P('p2')); status(() => run('asha', stale), 409); assert.deepEqual(P('p2'), before); });
  check(() => { status(() => run('asha', link('p2')), 409); status(() => run('asha', link('p1', { abhaNumber: '11-1111-1111-1111' })), 409); status(() => run('asha', { type: 'abhaDecline', personId: 'p1', version: P('p1').version, reason: 'Declines synthetic ABHA' }), 409); });
  // Consent artefacts.
  const req = (over = {}) => ({ type: 'abdmConsentRequest', personId: 'p1', version: P('p1').version, purpose: 'CAREMGT', hiTypes: ['OPConsultation', 'DiagnosticReport'], from: '2026-01-01', to: '2026-09-30', expiresAt: '2026-11-01T00:00:00.000Z', ...over });
  check(() => { status(() => run('asha', req()), 403); status(() => run('doc', req({ from: '2026-10-01' })), 422); status(() => run('doc', req({ expiresAt: '2026-09-01T00:00:00.000Z' })), 422); status(() => run('doc', req({ personId: 'p2', version: P('p2').version })), 409); assert.equal(run('doc', req({ purpose: 'MARKETING' })), null); });
  const { consentId } = run('doc', req());
  check(() => { const consent=P('p1').abdmConsents[0];assert.equal(consent.status, 'REQUESTED');assert.equal(consent.requesterFacilityId,'SYN-FACILITY-1');assert.equal(consent.providerFacilityId,'SYN-FACILITY-1');assert.equal(consent.configVersion,1); assert.equal(x.consentAllows(P('p1'), consentId, { hiType: 'OPConsultation', date: '2026-05-01' }, now).allowed, false, 'not granted yet'); status(() => run('doc', { type: 'abdmConsentDecide', personId: 'p1', consentId, decision: 'GRANTED' }), 403); });
  run('own', { type: 'abdmConsentDecide', personId: 'p1', consentId, decision: 'GRANTED' });
  const allows = (q, at = now) => x.consentAllows(P('p1'), consentId, q, at);
  check(() => { assert.equal(allows({ hiType: 'OPConsultation', date: '2026-05-01' }).allowed, true);assert.equal(allows({hiType:'OPConsultation',date:'2026-05-01',requesterFacilityId:'SYN-FACILITY-1',providerFacilityId:'SYN-FACILITY-1',configVersion:1}).allowed,true);assert.match(allows({hiType:'OPConsultation',date:'2026-05-01',requesterFacilityId:'OTHER-HIU'}).reason,/HIU requester/);assert.match(allows({hiType:'OPConsultation',date:'2026-05-01',providerFacilityId:'OTHER-HIP'}).reason,/HIP provider/);assert.match(allows({hiType:'OPConsultation',date:'2026-05-01',configVersion:2}).reason,/configuration changed/); assert.match(allows({ hiType: 'Prescription', date: '2026-05-01' }).reason, /does not cover Prescription/); assert.match(allows({ hiType: 'OPConsultation', date: '2025-12-31' }).reason, /2026-01-01 to 2026-09-30/); assert.match(allows({ hiType: 'OPConsultation', date: '2026-05-01', purpose: 'BTG' }).reason, /CAREMGT only/); assert.match(allows({ hiType: 'OPConsultation', date: '2026-05-01' }, later).reason, /EXPIRED/); });
  check(() => { status(() => run('own', { type: 'abdmConsentDecide', personId: 'p1', consentId, decision: 'DENIED' }), 409); assert.equal(x.effective(P('p1').abdmConsents[0], later), 'EXPIRED'); status(() => run('asha', { type: 'abdmConsentRevoke', personId: 'p1', consentId, reason: 'Revoking an expired consent' }, later), 409); });
  // A second grant, then unlink: open artefacts are revoked and fetches refused.
  const second = run('doc', req({ hiTypes: ['ImmunizationRecord'] })).consentId;
  run('own', { type: 'abdmConsentDecide', personId: 'p1', consentId: second, decision: 'GRANTED' });
  run('asha', { type: 'abhaUnlink', personId: 'p1', version: P('p1').version, reason: 'Wrong ABHA recorded at registration' });
  check(() => { assert.equal(P('p1').abha.state, 'none'); assert.equal(P('p1').abha.history.length, 2); assert.equal(P('p1').abdmConsents.find(c => c.id === second).status, 'REVOKED'); assert.equal(x.consentAllows(P('p1'), second, { hiType: 'ImmunizationRecord', date: '2026-05-01' }, now).allowed, false); });
  run('asha', link('p1', { abhaNumber: '22-2222-2222-2222' }));
  const third = run('doc', req()).consentId; run('own', { type: 'abdmConsentDecide', personId: 'p1', consentId: third, decision: 'GRANTED' });
  check(() => { assert.equal(x.consentAllows(P('p1'), third, { hiType: 'OPConsultation', date: '2026-05-01' }, now).allowed, true); P('p1').abha.number = '33-3333-3333-3333'; assert.match(x.consentAllows(P('p1'), third, { hiType: 'OPConsultation', date: '2026-05-01' }, now).reason, /ABHA link changed/); P('p1').abha.number = '22-2222-2222-2222'; });
  run('asha', { type: 'abdmConsentRevoke', personId: 'p1', consentId: third, reason: 'Patient withdrew permission' });
  check(() => { assert.equal(P('p1').abdmConsents.find(c => c.id === third).status, 'REVOKED'); status(() => run('asha', { type: 'abdmConsentRevoke', personId: 'p1', consentId: third, reason: 'Patient withdrew permission' }), 409); });
  check(() => { run('asha', { type: 'abhaDecline', personId: 'p2', version: P('p2').version, reason: 'Prefers not to create an ABHA' }); assert.equal(P('p2').abha.state, 'declined'); });
  check(() => { const r = x.redactAbha(P('p1')); assert.equal(r.abha.number, '22-XXXX-XXXX-2222'); assert.ok(r.abha.history.every(h => !h.number || h.number.includes('XXXX'))); assert.ok(r.abdmConsents.every(c => c.abhaNumber.includes('XXXX'))); assert.equal(P('p1').abha.number, '22-2222-2222-2222', 'stored record unchanged'); });
  const result = { suite: 'ABDM mock contract (slice 7a)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/abdm-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
