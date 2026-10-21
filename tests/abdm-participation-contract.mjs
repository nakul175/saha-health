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
  const config = (over = {}) => ({ type: 'abdmConfigure', environment: 'mock', configurationVersion: 0,
    modules: { abha: true, hip: false, hiu: true }, facilityId: 'SYN-FACILITY-83',
    approvals: [{ module: 'abha', reference: 'APPROVAL-ABHA-83' }, { module: 'hiu', reference: 'APPROVAL-HIU-83' }],
    roles: ['abha', 'hiu', 'consented-exchange'], approvedOperations: ['abha.link', 'abha.unlink', 'consent.request', 'consent.revoke'],
    clientCredentialBinding: 'vault-binding:test-only-no-secret', responsibleOwnerId: 'own', responsibleOwnerEvidence: 'Synthetic approval register APL-106',
    reason: 'Synthetic ABDM participation declaration', ...over });
  const link = () => ({ type:'abhaLink', demographicMatch:'matched', confirmed:true, personId: 'p1', version: P('p1').version, abhaNumber: '91-1234-5678-9012', demographicMatch:'matched', confirmed:true, otp: x.MOCK_OTP });
  check(() => status(() => run('doc', config()), 403));
  check(() => status(() => run('own', config({ environment: 'sandbox' })), 409));
  check(() => status(() => run('own', config({ roles: ['abha', 'hiu'], approvedOperations: ['consent.request'] })), 422));
  check(() => status(() => run('own', config({ responsibleOwnerId: 'doc' })), 422));
  check(() => status(() => run('own', config({ roles: ['abha', 'consented-exchange'], approvedOperations: ['abha.link', 'abha.unlink', 'consent.request', 'consent.revoke'] })), 422));
  check(() => { assert.equal(run('own', config()).version, 1); const c=x.abdmConfig(s); assert.deepEqual(c.roles,['abha','hiu','consented-exchange']); assert.equal(c.clientCredentialBinding,'vault-binding:test-only-no-secret'); assert.equal(c.responsibleOwnerId,'own'); assert.match(s.workspace.audit.at(-1).detail,/operations abha.link, abha.unlink, consent.request, consent.revoke/); });
  check(() => status(() => run('own', config({ configurationVersion: 0 })), 409));
  check(() => { run('asha', link()); assert.equal(P('p1').abha.state,'linked'); });
  const req=()=>({type:'abdmConsentRequest',personId:'p1',version:P('p1').version,purpose:'CAREMGT',hiTypes:['OPConsultation'],from:'2026-01-01',to:'2026-09-30',expiresAt:'2026-11-01T00:00:00.000Z'});
  check(() => { const id=run('doc',req()).consentId; assert.ok(id); });
  check(() => { const current=x.abdmConfig(s); run('own',config({configurationVersion:current.version,approvedOperations:['abha.link','abha.unlink'],roles:['abha','hiu','consented-exchange']})); status(()=>run('doc',req()),409); assert.equal(P('p1').abdmConsents.length,1,'refusal has no side effect'); });
  check(() => { const v=x.abdmView(s,P('p1'),{}).config; assert.equal(v.environment,'mock'); assert.deepEqual(v.approvedOperations,['abha.link','abha.unlink']); assert.equal(v.responsibleOwnerEvidence,'Synthetic approval register APL-106'); });
  const result={suite:'SAHA-083 ABDM participation scope',passed,completedAt:new Date().toISOString()};
  writeFileSync('tests/abdm-participation-contract-result.json',JSON.stringify(result,null,2)+'\\n'); console.log(JSON.stringify(result));
} finally { rmSync(dir,{recursive:true,force:true}); }
