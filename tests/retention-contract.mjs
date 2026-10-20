// Slice 6c retention contract: schedules, holds and eligibility counts on in-memory state. Nothing is deleted.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createBackup, createRetentionAuthority, restoreControlledBackup } from '../scripts/recovery.mjs';

const dir = mkdtempSync(join(process.cwd(), '.retention-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const file of readdirSync('lib/saha').filter(file => file.endsWith('.ts'))) {
    const source = readFileSync(join('lib/saha', file), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), output);
  }
  const x = await import(pathToFileURL(join(dir, 'retention.js')));
  const now = '2026-09-30T06:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const base = { age: 40, sex: 'Unknown', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, version: 1, teamId: 't1', assignedTo: null };
  const people = [
    { ...base, id: 'old', name: 'Old', createdAt: '2010-01-01T00:00:00.000Z', assigned: true, fieldLeases: [{ id: 'l1', createdAt: '2012-01-01T00:00:00.000Z', status: 'synced' }] },
    { ...base, id: 'oldButActive', name: 'Old but active', createdAt: '2010-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'held', name: 'Held', createdAt: '2010-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'new', name: 'New', createdAt: '2026-01-01T00:00:00.000Z', assigned: true },
    { ...base, id: 'hidden', name: 'Hidden', createdAt: '2010-01-01T00:00:00.000Z', assigned: false },
  ];
  const s = { organisation: { id: 'org', name: 'Synthetic', revision: 1, createdAt: now }, teams: [], invitations: [], members: [member('own', 'clinician', { isOwner: true }), member('sup', 'supervisor'), member('adm', 'admin', { isOwner: true })],
    workspace: { schemaVersion: 1, revision: 1, role: 'clinician', integrations: [], receipts: {}, audit: [], referrals: [], people,
      visits: [{ id: 'v1', personId: 'oldButActive', createdAt: '2010-02-01T00:00:00.000Z', confirmedAt: '2026-05-01T00:00:00.000Z' }, { id: 'v2', personId: 'old', createdAt: '2011-01-01T00:00:00.000Z' }],
      submissions: [{ id: 's1', personId: 'old', updatedAt: '2011-02-01T00:00:00.000Z' }, { id: 's2', personId: 'held', updatedAt: '2011-02-01T00:00:00.000Z' }, { id: 's3', personId: 'new', updatedAt: '2026-02-01T00:00:00.000Z' }] },
    outreach: { plans: [], templates: [], messages: [{ id: 'm1', personId: 'old', createdAt: '2012-01-01T00:00:00.000Z' }] },
    rightsRequests: [{ id: 'r1', personId: 'old', closed: { at: '2013-01-01T00:00:00.000Z' } }, { id: 'r2', personId: 'new', state: 'open' }] };
  const M = id => s.members.find(m => m.userId === id);
  const run = (userId, cmd) => (s.workspace.role = M(userId).role, x.applyRetention(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x@example.invalid' }, M(userId), now));
  const audit = { total: 40, pastSchedule: 7 };
  const meta = { purpose: 'synthetic care evidence', location: 'local test store', jurisdiction: 'synthetic jurisdiction' };
  const all = years => x.RECORD_CLASSES.map(recordClass => ({ recordClass, years, ...meta }));
  check(() => { status(() => run('sup', { type: 'retentionPolicySet', rules: all(10), basis: 'Synthetic records policy v1' }), 403); status(() => x.retentionReview(s, M('sup'), audit, now), 403); });
  check(() => { status(() => run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'audit-event', years: 0 }], basis: 'Synthetic records policy v1' }), 422); status(() => run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'audit-event', years: 5 }, { recordClass: 'audit-event', years: 6 }], basis: 'Synthetic records policy v1' }), 422); status(() => run('own', { type: 'retentionDisposalApply', artifacts: [], reason: 'Legacy command has no policy version' }), 422); });
  let v = x.retentionReview(s, M('own'), audit, now);
  check(() => { assert.equal(v.policy, null); assert.ok(v.review.every(r => r.years === null && r.eligible === 0)); assert.match(v.disposal, /tombstones/); });
  check(() => { const r = run('own', { type: 'retentionPolicySet', rules: all(10), basis: 'Synthetic records policy v1' }); assert.equal(r.version, 1); assert.match(s.workspace.audit.at(-1).detail, /separate current-version command/); });
  v = x.retentionReview(s, M('own'), audit, now);
  const row = c => v.review.find(r => r.recordClass === c);
  check(() => { assert.deepEqual([row('patient-record').total, row('patient-record').pastSchedule, row('patient-record').eligible], [5, 3, 0], 'patient age is visible but clinical-record disposal stays unavailable until chain-safe support exists'); assert.equal(row('programme-receipt').eligible, 2); assert.equal(row('outreach-message').eligible, 1); assert.equal(row('rights-request').total, 1, 'only closed requests are dated'); assert.equal(row('field-package').eligible, 0); assert.deepEqual([row('audit-event').total, row('audit-event').pastSchedule, row('audit-event').eligible], [40, 7, 0], 'audit age is reported but disposal stays unavailable until chain-safe support exists'); });
  // Holds.
  check(() => { status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 422); status(() => run('own', { type: 'retentionHoldPlace', scope: 'organisation', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 422); status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'hidden', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 403); status(() => run('adm', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' }), 403); });
  const hold = run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-1' });
  check(() => { status(() => run('own', { type: 'retentionHoldPlace', scope: 'person', personId: 'held', reason: 'Synthetic legal matter', reference: 'CASE-2' }), 409); v = x.retentionReview(s, M('own'), audit, now); assert.deepEqual([row('patient-record').held, row('patient-record').eligible], [1, 0]); assert.deepEqual([row('programme-receipt').held, row('programme-receipt').eligible], [1, 1]); assert.deepEqual([row('audit-event').pastSchedule,row('audit-event').eligible], [7,0], 'a patient hold does not alter audit age counts and audit disposal remains unsupported'); });
  const org = run('own', { type: 'retentionHoldPlace', scope: 'organisation', reason: 'Synthetic regulator inquiry', reference: 'REG-9' });
  check(() => { v = x.retentionReview(s, M('own'), audit, now); assert.ok(v.review.every(r => r.eligible === 0), 'an organisation hold makes nothing eligible'); assert.equal(row('audit-event').held, 7); });
  check(() => { status(() => run('own', { type: 'retentionHoldRelease', holdId: 'nope', reason: 'Matter closed in synthetic test' }), 404); run('own', { type: 'retentionHoldRelease', holdId: org.holdId, reason: 'Inquiry closed in synthetic test' }); status(() => run('own', { type: 'retentionHoldRelease', holdId: org.holdId, reason: 'Inquiry closed in synthetic test' }), 409); v = x.retentionReview(s, M('own'), audit, now); assert.equal(row('patient-record').eligible, 0, 'patient records remain review-only while the patient hold remains'); });
  check(() => { status(() => run('sup', { type: 'retentionArtifactRegister', recordClass: 'backup', recordId: 'backup-old', createdAt: '2010-01-01T00:00:00.000Z', ...meta }), 403); status(() => run('own', { type: 'retentionArtifactRegister', recordClass: 'backup', recordId: 'backup-future', createdAt: '2027-01-01T00:00:00.000Z', ...meta }), 422); status(() => run('own', { type: 'retentionArtifactRegister', recordClass: 'backup', recordId: 'backup-person', personId: 'old', createdAt: '2010-01-01T00:00:00.000Z', ...meta }), 422); });
  run('own', { type: 'retentionArtifactRegister', recordClass: 'backup', recordId: 'backup-old', createdAt: '2010-01-01T00:00:00.000Z', ...meta });
  run('own', { type: 'retentionArtifactRegister', recordClass: 'programme-receipt', recordId: 's2', personId: 'new', createdAt: '2026-01-01T00:00:00.000Z', ...meta });
  const bound=s.retention.artifacts.find(a=>a.recordClass==='programme-receipt'&&a.recordId==='s2');
  check(() => { assert.equal(bound.personId,'held','patient binding comes from the canonical receipt');assert.equal(bound.createdAt,'2011-02-01T00:00:00.000Z','retention age comes from the canonical receipt');status(() => run('own', { type: 'retentionDisposalApply', expectedPolicyVersion: 9, artifacts: [{ recordClass: 'programme-receipt', recordId: 's2' }], reason: 'Synthetic expiry disposal' }), 409);status(() => run('own', { type: 'retentionDisposalApply', expectedPolicyVersion: 1, artifacts: [{ recordClass: 'programme-receipt', recordId: 's2' }], reason: 'Synthetic expiry disposal' }), 409);status(() => run('own', { type: 'retentionDisposalApply', expectedPolicyVersion: 1, artifacts: [{ recordClass: 'backup', recordId: 'backup-old' }], reason: 'Synthetic expiry disposal' }), 422); });
  const auditId=s.workspace.audit[0].id;run('own',{type:'retentionArtifactRegister',recordClass:'audit-event',recordId:auditId,createdAt:'2010-01-01T00:00:00.000Z',...meta});
  check(() => { status(() => run('own',{type:'retentionDisposalApply',expectedPolicyVersion:1,artifacts:[{recordClass:'audit-event',recordId:auditId}],reason:'Synthetic expiry disposal'}),422); });
  run('own', { type: 'retentionArtifactRegister', recordClass: 'programme-receipt', recordId: 's1', personId: 'new', createdAt: '2026-01-01T00:00:00.000Z', ...meta });
  const disposed=run('own', { type: 'retentionDisposalApply', expectedPolicyVersion: 1, artifacts: [{ recordClass: 'programme-receipt', recordId: 's1' }], reason: 'Synthetic expiry disposal' });
  s.retention.artifacts.push({id:'outside-artifact',recordClass:'patient-record',recordId:'hidden',personId:'hidden',createdAt:'2010-01-01T00:00:00.000Z',...meta,registeredBy:'own',registeredAt:now});
  check(() => { assert.equal(disposed.disposed,1); assert.equal(s.retention.tombstones.length,1); status(() => run('own', { type: 'retentionDisposalApply', expectedPolicyVersion: 1, artifacts: [{ recordClass: 'programme-receipt', recordId: 's1' }], reason: 'Synthetic expiry disposal' }), 409); v=x.retentionReview(s,M('own'),audit,now); const outside=v.inventory.artifacts.find(a=>a.id==='outside-artifact');assert.equal(v.inventory.disposed,1);assert.deepEqual(outside,{id:'outside-artifact',outsideScope:true,eligible:false,held:false},'out-of-scope inventory details are fully redacted');assert.equal(v.inventory.artifacts.find(a=>a.recordId==='backup-old').eligible,false,'unbound backup inventory is never disposal eligible'); });
  check(() => { const restored=structuredClone(s); restored.workspace.visits[0].aiResults=[{id:'disposed-model',providerId:'x',providerName:'X',mode:'demo',status:'succeeded',text:'must not revive',createdAt:'2010-01-01T00:00:00.000Z',inputHash:'x',reviewed:false}]; restored.retention.tombstones.push({...restored.retention.tombstones[0],id:'t-model',recordClass:'model-output',recordId:'disposed-model'}); x.applyRetentionTombstones(restored); assert.equal(restored.workspace.visits[0].aiResults.length,0,'restored data is filtered before availability'); });
  check(() => { v = x.retentionReview(s, M('own'), audit, now); assert.equal(v.holds.find(h => h.id === hold.holdId).personName, 'Held'); run('own', { type: 'retentionPolicySet', rules: [{ recordClass: 'patient-record', years: 20, ...meta }], basis: 'Synthetic records policy v2' }); v = x.retentionReview(s, M('own'), audit, now); assert.equal(v.policy.version, 2); assert.equal(v.history.length, 2); assert.equal(row('patient-record').pastSchedule, 0); assert.equal(row('audit-event').years, null); });
  check(() => { assert.equal(s.workspace.people.length, 5); assert.equal(s.workspace.submissions.length, 3); assert.equal(s.outreach.messages.length, 1); });
  const recovery=join(dir,'recovery'),source=join(recovery,'source.sqlite'),backup=join(recovery,'old.sahabackup'),authority=join(recovery,'current.authority'),restored=join(recovery,'restored.sqlite'),pass='synthetic-retention-passphrase-32';mkdirSync(recovery);
  {const db=new DatabaseSync(source);db.exec('PRAGMA foreign_keys=ON; CREATE TABLE organisations (id text PRIMARY KEY NOT NULL); CREATE TABLE retention (org_id text PRIMARY KEY NOT NULL,data text NOT NULL,FOREIGN KEY(org_id) REFERENCES organisations(id));');db.prepare('INSERT INTO organisations (id) VALUES (?)').run('org');db.prepare('INSERT INTO retention (org_id,data) VALUES (?,?)').run('org',JSON.stringify({policies:[],holds:[],artifacts:[],tombstones:[]}));db.close();}
  await createBackup(source,backup,pass);
  {const db=new DatabaseSync(source);const data=JSON.parse(db.prepare('SELECT data FROM retention WHERE org_id=?').get('org').data);data.policies.push({version:1,rules:[{recordClass:'backup',years:10,...meta}],basis:'Synthetic current recovery policy',setBy:'own',setAt:now});data.holds.push({id:'hold-current',scope:'organisation',reason:'Synthetic current investigation',reference:'CASE-RESTORE',placedBy:'own',placedAt:now});data.tombstones.push({id:'t-later',recordClass:'backup',recordId:'expired-in-old-backup',policyVersion:1,triggerAt:'2010-01-01T00:00:00.000Z',purpose:meta.purpose,location:meta.location,jurisdiction:meta.jurisdiction,disposedBy:'own',disposedAt:now,reason:'Synthetic expiry disposal'});db.prepare('UPDATE retention SET data=? WHERE org_id=?').run(JSON.stringify(data),'org');db.close();}
  createRetentionAuthority(source,authority,pass);await restoreControlledBackup(backup,restored,authority,pass);
  check(() => { const db=new DatabaseSync(restored,{readOnly:true});const data=JSON.parse(db.prepare('SELECT data FROM retention WHERE org_id=?').get('org').data);db.close();assert.equal(data.tombstones[0].recordId,'expired-in-old-backup','current tombstone authority is merged before destination availability');assert.equal(data.holds[0].id,'hold-current','current holds are restored before availability');assert.equal(data.policies[0].version,1,'current policy is restored before availability'); });
  check(() => { const db=new DatabaseSync(source);const data=JSON.parse(db.prepare('SELECT data FROM retention WHERE org_id=?').get('org').data);data.tombstones=[{...data.tombstones[0],recordClass:'audit-event'}];db.prepare('UPDATE retention SET data=? WHERE org_id=?').run(JSON.stringify(data),'org');db.close();assert.throws(()=>createRetentionAuthority(source,join(recovery,'invalid.authority'),pass),/audit events/); });
  await assert.rejects(()=>restoreControlledBackup(backup,join(recovery,'unsafe.sqlite'),'',pass),/current retention authority/i);passed++;
  const result = { suite: 'retention contract (slice 6c)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/retention-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
