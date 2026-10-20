import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.reporting-patient-access-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refused = (fn, message) => { try { fn(); assert.fail('expected refusal'); } catch (e) { assert.equal(e.status, 403); assert.match(e.message, message); passed++; } };

try {
  writeFileSync(join(dir, 'core.js'), `export class AppError extends Error { constructor(status,message){ super(message); this.status=status; } }\nexport function fail(status,message){ throw new AppError(status,message); }\nexport const uuid=()=>crypto.randomUUID();\n`);
  for (const file of ['access', 'delegation', 'facility-scope', 'purpose-scope', 'reporting-patient-access']) {
    const source = readFileSync(`lib/saha/${file}.ts`, 'utf8');
    writeFileSync(join(dir, `${file}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  }
  const { reportingPatientAccess } = await import(pathToFileURL(join(dir, 'reporting-patient-access.js')));
  const now = new Date().toISOString(), future = new Date(Date.now() + 86400000).toISOString();
  const owner = { userId: 'owner', displayName: 'Owner', role: 'clinician', status: 'active', isOwner: true, version: 1, teamIds: ['a'] };
  const supervisor = { userId: 'supervisor', displayName: 'Supervisor', role: 'supervisor', status: 'active', isOwner: false, version: 1, teamIds: ['a'] };
  const clinician = { userId: 'clinician', displayName: 'Clinician', role: 'clinician', status: 'active', isOwner: false, version: 1, teamIds: ['a'] };
  const outsider = { userId: 'outsider', displayName: 'Outsider', role: 'clinician', status: 'active', isOwner: false, version: 1, teamIds: ['b'] };
  const patient = { id: 'p1', name: 'Synthetic patient', teamId: 'a', assigned: true, assignedTo: null, programmes: ['General care'] };
  const base = { organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [{ id: 'a', name: 'A', createdAt: now }, { id: 'b', name: 'B', createdAt: now }], members: [owner, supervisor, clinician, outsider], invitations: [], workspace: { people: [patient], visits: [], submissions: [], referrals: [], integrations: [], receipts: {}, audit: [], schemaVersion: 1, revision: 1, role: 'supervisor' }, operations: { version: 1, maintenance: false, reason: '', updatedAt: now, incidents: [], rates: null } };

  check(() => assert.deepEqual(reportingPatientAccess(base, supervisor, patient), { teams: ['a'], delegated: [] }));
  refused(() => reportingPatientAccess({ ...base, operations: { ...base.operations, purposeGrants: [{ id: 'g', memberId: 'supervisor', programme: null, purposes: ['care-coordination'], version: 1, setBy: 'owner', setAt: now, reason: 'Synthetic purpose restriction' }] } }, supervisor, patient), /reporting and aggregate care reports/);
  refused(() => reportingPatientAccess(base, clinician, patient), /Supervisor or operations access required/);

  const delegated = { ...base, operations: { ...base.operations, delegations: [{ id: 'd1', version: 1, kind: 'reporting', grantorId: 'owner', delegateId: 'outsider', teamIds: ['a'], from: now, until: future, reason: 'Synthetic aggregate reporting', createdAt: now }, { id: 'd2', version: 1, kind: 'reporting', grantorId: 'owner', delegateId: 'clinician', teamIds: ['a'], from: now, until: future, reason: 'Synthetic aggregate reporting', createdAt: now }] } };
  // A reporting delegation never widens person access. In the live route the patient would not
  // be present in the outsider's viewer-scoped partition; the gate also refuses it directly.
  refused(() => reportingPatientAccess(delegated, outsider, patient), /separate patient access/);
  check(() => assert.deepEqual(reportingPatientAccess(delegated, clinician, patient), { teams: ['a'], delegated: ['d2'] }, 'reporting authority and independent team care scope are both present'));
} catch (error) {
  if (error?.code !== 'ERR_ASSERTION') throw error;
  throw error;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(JSON.stringify({ suite: 'SAHA-110 reporting patient access', passed }));
