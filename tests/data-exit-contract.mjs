// Slice 6m data exit contract: the organisation export archive, its manifest and checksums, the
// owner's patient scope, excluded secrets, the hand-over list, FHIR documents, the offline verifier
// (scripts/verify-export.mjs) against deliberate tampering, and a 1000-person export re-imported into
// a fresh validation database. Runs the real migrations in SQLite through the D1 shim of the storage contract.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readTar, verifyFiles } from '../scripts/verify-export.mjs';

const dir = mkdtempSync(join(process.cwd(), '.data-exit-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); passed++; };
const sha = b => createHash('sha256').update(b).digest('hex');

class Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  exec() { const s = this.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: s.all(...this.args), meta: { changes: 0 } }; const r = s.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db, sql); }
  async batch(statements) { this.db.exec('BEGIN'); try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
}
const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const migrated = () => { const d = new D1(); for (const file of migrations) for (const stmt of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) d.db.exec(stmt); return d; };
// Rebuilds the manifest entry and SHA256SUMS after an edit, as a forger with the archive alone could.
function reseal(files, path, bytes, rows) {
  const out = new Map(files); out.set(path, Buffer.from(bytes));
  const manifest = JSON.parse(out.get('manifest.json').toString('utf8')), f = manifest.files.find(x => x.path === path);
  if (f) { if (rows !== undefined) { manifest.totals.rows += rows - f.rows; f.rows = rows; } f.bytes = out.get(path).length; f.sha256 = sha(out.get(path)); }
  out.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  out.set('SHA256SUMS', Buffer.from([...out.keys()].filter(p => p !== 'SHA256SUMS').map(p => `${sha(out.get(p))}  ${p}`).join('\n') + '\n'));
  return out;
}
const jsonl = b => b.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'data-exit', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const chain = await import(pathToFileURL(join(dir, 'audit-chain.js')));
  const exit = await import(pathToFileURL(join(dir, 'data-exit.js')));
  const { seedWorkspace } = await import(pathToFileURL(join(dir, 'seed.js')));
  const d1 = migrated();
  const now = '2026-09-30T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner-secret@example.invalid' };
  d1.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run('owner', 'CODE0000000000000000000A', 'Synthetic owner', 'owner-secret@example.invalid', now);
  const member = { userId: 'owner', accountCode: 'CODE0000000000000000000A', displayName: 'Synthetic owner', role: 'clinician', isOwner: true, status: 'active', version: 1, teamIds: ['default'], createdAt: now };
  const exporter = { userId: 'owner', name: 'Synthetic owner', accountCode: 'CODE0000000000000000000A' };
  const facts = (weight = '') => ({ date: '2026-09-29T08:00', systolic: '118', diastolic: '76', weight, temperature: '', weeks: '', coughDays: '', notes: 'Synthetic visit.', source: 'measured' });
  const load = async orgId => { const s = await store.readState(d1, orgId); store.scope(s, 'owner'); return s; };
  const commit = (before, after, type) => store.persist(d1, before, after, actor, { type }, crypto.randomUUID(), 'hash', { ok: true });
  const build = (orgId, extra = {}) => exit.buildExport(d1, { orgId, member, exporter, exportId: `export-${orgId}`, now: '2026-09-30T06:00:00.000Z', includeFhir: true, environment: 'synthetic', ...extra });

  // Organisation A: two care teams; the owner belongs only to the default team, so Kamla (north team) is outside scope.
  const A = 'org_exit_a', w = seedWorkspace(now);
  for (const p of w.people) { p.assignedTo = 'owner'; }
  const kamla = w.people.find(p => p.id === 'p_kamla'); kamla.teamId = 'north';
  const meena = w.people.find(p => p.id === 'p_meena');
  meena.followUps = [{ id: 'fu-owned', enrolmentId: 'en-1', packId: 'anc', title: 'Antenatal follow-up', due: '2026-10-02', ownerId: 'owner', state: 'open' }, { id: 'fu-orphan', enrolmentId: 'en-1', packId: 'anc', title: 'Second follow-up', due: '2026-10-09', ownerId: 'departed-user', state: 'open' }, { id: 'fu-done', enrolmentId: 'en-1', packId: 'anc', title: 'Done', due: '2026-09-01', ownerId: 'owner', state: 'completed' }];
  w.visits = [
    { id: 'v-meena-1', personId: 'p_meena', version: 1, state: 'draft', facts: facts('57.5'), createdAt: now, aiResults: [], recordVersion: 1 },
    { id: 'v-meena-2', personId: 'p_meena', version: 1, state: 'draft', facts: facts(), createdAt: now, aiResults: [], recordVersion: 1 },
    { id: 'v-kamla-1', personId: 'p_kamla', version: 1, state: 'confirmed', confirmedAt: now, facts: facts('49'), createdAt: now, aiResults: [], recordVersion: 1 },
  ];
  w.submissions = [{ id: 'sub-uncertain', visitId: 'v-meena-1', personId: 'p_meena', connectorId: 'mis_community', connectorName: 'Community health MIS', state: 'uncertain', mode: 'demo', payloadHash: 'h', attempts: 1, message: 'No confirmed response', createdAt: now, updatedAt: now }, { id: 'sub-accepted', visitId: 'v-meena-1', personId: 'p_meena', connectorId: 'mis_maternal', connectorName: 'Maternal & child register', state: 'accepted', mode: 'demo', payloadHash: 'h', attempts: 1, message: '', createdAt: now, updatedAt: now }];
  w.referrals = [{ id: 'ref-open', personId: 'p_meena', visitId: 'v-meena-1', facility: 'PHC Rampur', reason: 'Synthetic referral', state: 'sent', createdAt: now, ownerId: 'owner', due: '2026-10-05' }, { id: 'ref-closed', personId: 'p_meena', visitId: 'v-meena-1', facility: 'PHC Rampur', reason: 'Closed', state: 'completed', createdAt: now }];
  const TOKEN_HASH = 'f'.repeat(64);
  const stateA = { organisation: { id: A, name: 'Data exit organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'north', name: 'North team', createdAt: now }], members: [member], invitations: [{ id: 'inv-1', accountCode: 'CODE0000000000000000000B', label: 'Synthetic invitee', role: 'asha', teamIds: ['default'], status: 'pending', expiresAt: '2026-10-03T00:00:00.000Z', createdBy: 'owner', createdAt: now, tokenHash: TOKEN_HASH }], workspace: w };
  await store.createState(d1, stateA, actor, 'createOrganisation');
  d1.db.prepare('INSERT INTO command_receipts (actor_id,key,org_id,hash,result,person_id,created_at) VALUES (?,?,?,?,?,?,?)').run('owner', 'receipt-invite-1', A, 'h', JSON.stringify({ token: 'SYNTHETIC-INVITE-TOKEN-0001' }), null, now);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, 7)]);
  d1.db.prepare('INSERT INTO media (org_id,id,person_id,visit_id,mime,size,sha256,purpose,created_at,deleted_at,data) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(A, 'media-1', 'p_meena', 'v-meena-2', 'image/png', png.length, createHash('sha256').update(png).digest('base64'), 'wound-or-skin', now, null, png.toString('base64'));
  d1.db.prepare('INSERT INTO media (org_id,id,person_id,visit_id,mime,size,sha256,purpose,created_at,deleted_at,data) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(A, 'media-removed', 'p_meena', 'v-meena-2', 'image/png', 0, createHash('sha256').update(png).digest('base64'), 'other-clinical', now, now, '');
  // Confirm Meena's first visit (the confirming member becomes the FHIR author) and edit Kamla's record.
  let s = await load(A), after = structuredClone(s), v = after.workspace.visits.find(x => x.id === 'v-meena-1');
  v.state = 'confirmed'; v.confirmedAt = now; v.version++;
  after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'confirmVisit', subject: 'v-meena-1', personId: 'p_meena', detail: 'Visit confirmed.' });
  await commit(s, after, 'confirmVisit');
  s = await load(A); after = structuredClone(s); after.workspace.people.find(p => p.id === 'p_kamla').village = 'Kheda North';
  after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'updatePerson', subject: 'p_kamla', personId: 'p_kamla', detail: 'Kamla Devi moved to Kheda North.' });
  await commit(s, after, 'updatePerson');

  for(const [lease,person] of [['device-visible','p_meena'],['device-hidden','p_kamla']]) d1.db.prepare('INSERT INTO device_work_grants VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(A,'owner',lease,'a'.repeat(64),person,person==='p_meena'?'v-meena-1':'v-kamla-1',1,1,'b'.repeat(64),now,'clinician',1,new Date(Date.parse(now)+86400000).toISOString());
  for(const [id,who] of [['device-own','owner'],['device-other','other-user']]) d1.db.prepare('INSERT INTO device_work_events VALUES (?,?,?,?,?,?,?,?,?)').run(A,who,id,'report',null,null,'c'.repeat(64),JSON.stringify({code:'storage-write',draftCount:1,pendingCount:0}),now);
  for(const [id,person] of [['registration-visible','p_meena'],['registration-hidden','p_kamla']]){d1.db.prepare('INSERT INTO device_registration_grants VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(A,'owner',id,person,'key-'+id,'d'.repeat(64),1,1,'e'.repeat(64),'clinician',1,now,0);d1.db.prepare('INSERT INTO device_registration_receipts VALUES (?,?,?,?,?,?)').run(A,'owner','key-'+id,id,'d'.repeat(64),person);}
  for(const [id,who,person] of [['match-visible','owner','p_meena'],['match-hidden','owner','p_kamla'],['match-other','other-user','p_meena']])d1.db.prepare('INSERT INTO device_match_copies VALUES (?,?,?,?,?,?,?,?)').run(A,who,id,1,'9'.repeat(64),'clinician',JSON.stringify([{id:person,version:1}]),now);
  for(const [entry,person] of [['work-visible','p_meena'],['work-hidden','p_kamla']]){
    const visit=person==='p_meena'?'v-meena-1':'v-kamla-1';
    d1.db.prepare('INSERT INTO work_burden_samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(A,'owner',entry,person,visit,entry+'-receipt',entry+'-session','capture','segment',12,0,'fixed-input-hash',1,'client-active-v1',JSON.stringify({source:'online',lineage:[visit],programmes:[]}),now);
    d1.db.prepare('INSERT INTO work_support_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(A,'owner',entry,entry,person,visit,'request','capture','owner',null,1,'fixed-input-hash',1,now);
  }
  for(const [id,who] of [['open-own','owner'],['open-other','other-user']])d1.db.prepare('INSERT INTO offline_open_reports VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(A,who,id,'a'.repeat(64),'local-registration',JSON.stringify({kind:'local-registration',localId:'opaque-form',contentHash:'b'.repeat(64),status:'unknown'}),'field','registration-entry',1,now,now,JSON.stringify({originalRole:null,source:'client reported only'}));
  for(const [id,person] of [['open-visible','p_meena'],['open-hidden','p_kamla']])d1.db.prepare('INSERT INTO offline_open_subjects VALUES (?,?,?,?,?,?)').run(A,'owner',id,person,null,JSON.stringify({personVersion:1,originalRole:'clinician'}));
  const built = await build(A);
  const files = readTar(Buffer.from(built.archive)), paths = [...files.keys()];
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  const table = name => jsonl(files.get(`tables/${name}.jsonl`));

  // 1. Archive layout: README, manifest, SHA256SUMS, every table, media content, hand-over list, FHIR documents.
  check(() => { for (const t of exit.TABLES) assert.ok(paths.includes(`tables/${t.table}.jsonl`), t.table); for (const p of ['README.txt', 'manifest.json', 'SHA256SUMS', 'tables/accounts.jsonl', 'handover/open-items.jsonl', 'media/media-1.png', 'fhir/v-meena-1.json']) assert.ok(paths.includes(p), p); assert.equal(paths.at(-1), 'SHA256SUMS'); });
  check(() => assert.equal(exit.TABLES.length + 1, 49, 'every organisation table except the legacy per-account workspaces, plus member accounts'));
  // 2. The archive opens with standard tools and the receiver recipe `sha256sum -c SHA256SUMS` passes.
  const out = join(dir, 'extract'); mkdirSync(out); writeFileSync(join(dir, 'a.tar'), built.archive);
  check(() => { const listed = execFileSync('tar', ['-tf', join(dir, 'a.tar')], { encoding: 'utf8' }).trim().split('\n'); assert.deepEqual(listed, paths); });
  check(() => { execFileSync('tar', ['-xf', join(dir, 'a.tar'), '-C', out]); const r = execFileSync('sha256sum', ['-c', 'SHA256SUMS'], { cwd: out, encoding: 'utf8' }); assert.equal(r.trim().split('\n').length, paths.length - 1); assert.ok(r.trim().split('\n').every(l => l.endsWith(': OK'))); });
  // 3. Manifest: identification, schema version tied to the last migration, per-file rows and SHA-256.
  check(() => { assert.equal(manifest.format, 'saha-organisation-export-v1'); assert.equal(manifest.exportId, `export-${A}`); assert.equal(manifest.exporter.name, 'Synthetic owner'); assert.equal(manifest.exporter.owner, true); assert.equal(manifest.environment, 'synthetic'); assert.equal(manifest.organisation.id, A); });
  check(() => assert.equal(manifest.schema.migration, migrations.at(-1).replace(/\.sql$/, ''), 'SCHEMA_MIGRATION names the last migration file'));
  check(() => { for (const f of manifest.files) { assert.equal(sha(files.get(f.path)), f.sha256, f.path); assert.equal(files.get(f.path).length, f.bytes); if (f.rows !== undefined) assert.equal(jsonl(files.get(f.path)).length, f.rows, f.path); } });
  check(() => { assert.equal(built.manifestSha256, sha(files.get('manifest.json'))); assert.equal(built.archiveSha256, sha(Buffer.from(built.archive))); });
  // 4. Owner authority does not override patient scope: Kamla's rows are withheld and counted.
  const whole = Buffer.from(built.archive).toString('latin1');
  check(()=>{assert.deepEqual(table('offline_open_reports').map(r=>r.id),['open-own']);assert.deepEqual(table('offline_open_subjects').map(r=>r.report_id),['open-visible']);assert.ok(table('offline_open_reports').every(r=>!('person_id' in r)));});
  check(()=>{assert.throws(()=>d1.db.exec("UPDATE offline_open_reports SET count=0"),/immutable/);assert.throws(()=>d1.db.exec("DELETE FROM offline_open_subjects"),/immutable/);});
  check(() => { assert.equal(manifest.scope.patients, 6); assert.equal(manifest.scope.patientsExported, 5); assert.equal(manifest.scope.patientsWithheld, 1); assert.equal(manifest.scope.complete, false); assert.ok(!table('patients').some(p => p.id === 'p_kamla')); assert.ok(!table('visits').some(x => x.person_id === 'p_kamla')); });
  check(() => { assert.equal(whole.includes('Kamla Devi'), false, 'the withheld patient\'s name appears nowhere in the archive'); assert.equal(manifest.files.find(f => f.table === 'patients').withheld, 1); assert.ok(manifest.files.find(f => f.table === 'record_revisions').withheld >= 2); });
  const withheldAudit = table('audit_events').filter(e => e.withheld);
  check(() => { assert.ok(withheldAudit.length >= 1); assert.ok(withheldAudit.every(e => !('detail' in e) && !('person_id' in e) && /^[0-9a-f]{64}$/.test(e.content))); assert.equal(manifest.files.find(f => f.table === 'audit_events').withheld, withheldAudit.length); });
  // 5. Secrets and sign-in data are left out.
  check(() => { assert.ok(table('invitations').every(i => !('token_hash' in i))); assert.equal(whole.includes(TOKEN_HASH), false); assert.equal(whole.includes('SYNTHETIC-INVITE-TOKEN-0001'), false); assert.ok(table('command_receipts').every(r => !('result' in r))); assert.ok(table('command_receipts').some(r => r.key === 'receipt-invite-1')); assert.ok(manifest.files.find(f => f.table === 'command_receipts').withheld >= 1, 'the receipt of a command on the withheld patient is withheld'); });
  check(() => { assert.deepEqual(Object.keys(table('accounts')[0]), ['user_id', 'account_code', 'display_name', 'created_at']); assert.equal(whole.includes('owner-secret@example.invalid'), false); assert.ok(manifest.excluded.some(x => x.what === 'workspaces')); });
  // 6. Media: content as a file matching the row; the removed item keeps its row but no content.
  check(() => { const rows = table('media'); assert.ok(rows.every(r => !('data' in r))); assert.equal(createHash('sha256').update(files.get('media/media-1.png')).digest('base64'), rows.find(r => r.id === 'media-1').sha256); assert.equal(manifest.files.find(f => f.path === 'media/media-1.png').sha256, sha(png)); assert.ok(rows.some(r => r.id === 'media-removed')); assert.ok(!paths.some(p => p.startsWith('media/media-removed'))); });
  // 7. FHIR: a document for the current confirmed visit in scope only, authored by the confirming member.
  const doc = JSON.parse(files.get('fhir/v-meena-1.json').toString('utf8'));
  check(() => { assert.equal(doc.resourceType, 'Bundle'); assert.equal(doc.type, 'document'); assert.ok(doc.entry.some(e => e.resource.resourceType === 'Patient' && e.resource.name[0].text === 'Meena Devi')); assert.ok(doc.entry.some(e => e.resource.resourceType === 'Practitioner' && e.resource.name[0].text === 'Synthetic owner')); assert.equal(paths.filter(p => p.startsWith('fhir/')).length, 1); assert.equal(manifest.fhir.documents, 1); });
  // 8. Hand-over: unresolved external action and open patient tasks with a named owner, flagged when none is active.
  const handover = jsonl(files.get('handover/open-items.jsonl'));
  check(() => { const ext = handover.filter(h => h.kind === 'external-action'); assert.deepEqual(ext.map(h => h.id), ['sub-uncertain']); assert.match(ext[0].disposition, /never resend blindly/); });
  check(() => { const tasks = handover.filter(h => h.kind === 'patient-task'); assert.deepEqual(tasks.map(t => t.id).sort(), ['fu-orphan', 'fu-owned', 'ref-open']); const owned = tasks.find(t => t.id === 'fu-owned'); assert.equal(owned.ownerName, 'Synthetic owner'); assert.equal(owned.ownerStatus, 'active'); assert.equal(tasks.find(t => t.id === 'fu-orphan').ownerStatus, 'not-a-member'); assert.deepEqual(manifest.handover, { externalActions: 1, patientTasks: 3, withoutActiveOwner: 1 }); });
  // 9. The offline verifier passes every check, including the audit chain against the recorded head.
  const report = verifyFiles(files);
  check(() => { assert.equal(report.ok, true, JSON.stringify(report.failures)); assert.deepEqual(report.checks.map(c => c.name), ['format', 'sha256sums', 'manifest-files', 'totals', 'organisation', 'relationships', 'protection-state', 'figure-portability', 'media', 'fhir', 'audit-chain', 'genesis-seal']); });
  const live = await chain.verifyChain(d1, A);
  check(() => { assert.equal(manifest.auditChain.verification.status, 'intact'); assert.deepEqual(manifest.auditChain.verification.head, live.head); assert.ok(report.checks.find(c => c.name === 'relationships').detail.match(/^\d+ references resolve$/)); });
  check(() => { const cli = execFileSync('node', ['scripts/verify-export.mjs', join(dir, 'a.tar')], { encoding: 'utf8' }); assert.equal(JSON.parse(cli).ok, true); const cliDir = execFileSync('node', ['scripts/verify-export.mjs', out], { encoding: 'utf8' }); assert.equal(JSON.parse(cliDir).ok, true); });
  // 10. Tampering is detected: a changed byte, a resealed audit edit, a resealed dropped patient, and a truncated archive.
  const failing = (f, name) => { const r = verifyFiles(f); assert.equal(r.ok, false); assert.ok(r.checks.some(c => c.name === name && !c.ok), JSON.stringify(r.checks)); return r; };
  check(() => { const t = new Map(files), b = Buffer.from(t.get('tables/patients.jsonl')); b[10] = b[10] === 0x61 ? 0x62 : 0x61; t.set('tables/patients.jsonl', b); failing(t, 'sha256sums'); failing(t, 'manifest-files'); });
  check(() => { const events = table('audit_events'), i = events.findIndex(e => e.action === 'confirmVisit'); events[i].detail = 'Visit confirmed later.'; const r = failing(reseal(files, 'tables/audit_events.jsonl', events.map(e => JSON.stringify(e) + '\n').join('')), 'audit-chain'); assert.match(r.failures.join(), new RegExp(`event ${events[i].seq}: content or hash altered`)); assert.equal(r.checks.find(c => c.name === 'sha256sums').ok, true, 'the forger resealed the checksums'); });
  check(() => { const rows = table('patients').filter(p => p.id !== 'p_meena'); const r = failing(reseal(files, 'tables/patients.jsonl', rows.map(p => JSON.stringify(p) + '\n').join(''), rows.length), 'relationships'); assert.match(r.failures.join(), /visits\.person_id=p_meena/); });
  check(() => { const r = verifyFiles(reseal(files, 'tables/visits.jsonl', table('visits').map(x => JSON.stringify(x) + '\n').join('') + '{"org_id":"org_other","id":"x","person_id":"p_meena"}\n', table('visits').length + 1)); assert.equal(r.checks.find(c => c.name === 'organisation').ok, false); });
  check(() => { const b = Buffer.from(files.get('media/media-1.png')); b[100] ^= 0xff; const r = failing(reseal(files, 'media/media-1.png', b), 'media'); assert.match(r.failures.join(), /media-1 content differs from its row/); });
  check(() => { writeFileSync(join(dir, 'cut.tar'), Buffer.from(built.archive).subarray(0, 1024 + 100)); let code = 0; try { execFileSync('node', ['scripts/verify-export.mjs', join(dir, 'cut.tar')], { encoding: 'utf8' }); } catch (e) { code = e.status; } assert.equal(code, 1); });
  check(() => {assert.deepEqual(table('work_burden_samples').map(x=>x.id),['work-visible']);assert.deepEqual(table('work_support_events').map(x=>x.id),['work-visible']);assert.equal(manifest.files.find(f=>f.table==='work_burden_samples').withheld,1);assert.equal(manifest.files.find(f=>f.table==='work_support_events').withheld,1);});
  check(() => {assert.deepEqual(table('device_work_grants').map(x=>x.lease_id),['device-visible']);assert.deepEqual(table('device_work_events').map(x=>x.id),['device-own']);assert.equal(manifest.files.find(f=>f.table==='device_work_events').otherMembersRows,1);});
  check(()=>{assert.deepEqual(table('device_registration_grants').map(x=>x.registration_id),['registration-visible']);assert.deepEqual(table('device_registration_receipts').map(x=>x.registration_id),['registration-visible']);assert.deepEqual(table('device_match_copies').map(x=>x.id),['match-visible']);assert.equal(manifest.files.find(f=>f.table==='device_match_copies').otherMembersRows,1);assert.equal(manifest.files.find(f=>f.table==='device_match_copies').withheld,1);});
  // 11. Nothing is written by building an export; the server records the export event separately.
  check(() => assert.equal(d1.db.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(A).n, live.events));
  // 12. An owner whose role has no patient scope (administrator) exports configuration and digests only; the chain still verifies.
  const adminBuilt = await build(A, { member: { ...member, role: 'admin', teamIds: [] } });
  const adminFiles = readTar(Buffer.from(adminBuilt.archive)), adminManifest = JSON.parse(adminFiles.get('manifest.json').toString('utf8'));
  check(() => { assert.equal(adminManifest.scope.patientsExported, 0); assert.equal(jsonl(adminFiles.get('tables/visits.jsonl')).length, 0); assert.equal([...adminFiles.keys()].some(p => p.startsWith('fhir/') || p.startsWith('media/')), false); assert.equal(verifyFiles(adminFiles).ok, true); assert.ok(jsonl(adminFiles.get('tables/audit_events.jsonl')).some(e => e.withheld)); });
  check(() => { const r = verifyFiles(adminFiles); assert.match(r.checks.find(c => c.name === 'genesis-seal').detail, /0 earlier events reproduce/); });
  // 13. Without FHIR, no documents; the manifest says so.
  const plain = readTar(Buffer.from((await build(A, { includeFhir: false })).archive));
  check(() => { assert.equal([...plain.keys()].some(p => p.startsWith('fhir/')), false); assert.equal(JSON.parse(plain.get('manifest.json')).fhir.included, false); });

  // 13b. A command committed while the export reads its tables: audit events chained after the head read
  // first are left out, the manifest records that head, and the archive still verifies.
  let injected = false;
  const racing = { prepare: sql => { const st = d1.prepare(sql); if (injected || !/FROM organisations WHERE id=\? ORDER BY id LIMIT/.test(sql)) return st; return { bind: (...a) => ({ all: async () => { injected = true; const x = await load(A), y = structuredClone(x); y.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'renameOrganisation', subject: A, detail: 'Committed during the export' }); y.organisation.name = 'Renamed during export'; await commit(x, y, 'renameOrganisation'); return st.bind(...a).all(); } }) }; }, batch: s => d1.batch(s) };
  const raced = await exit.buildExport(racing, { orgId: A, member, exporter, exportId: 'export-raced', now: '2026-09-30T06:30:00.000Z', includeFhir: false, environment: 'synthetic' });
  const racedFiles = readTar(Buffer.from(raced.archive)), racedManifest = JSON.parse(racedFiles.get('manifest.json').toString('utf8')), racedEvents = jsonl(racedFiles.get('tables/audit_events.jsonl'));
  const dbHead = await chain.chainHead(d1, A);
  check(() => { assert.equal(injected, true); assert.equal(dbHead.seq, racedManifest.auditChain.exportedHead.seq + 1, 'one event was chained during the export'); assert.equal(Math.max(...racedEvents.map(e => e.seq ?? -1)), racedManifest.auditChain.exportedHead.seq); assert.equal(racedEvents.some(e => e.detail === 'Committed during the export'), false); assert.equal(verifyFiles(racedFiles).ok, true, JSON.stringify(verifyFiles(racedFiles).failures)); });
  check(() => { const m = JSON.parse(racedFiles.get('manifest.json').toString('utf8')); m.auditChain.exportedHead = dbHead; const r = verifyFiles(reseal(new Map([...racedFiles, ['manifest.json', Buffer.from(JSON.stringify(m, null, 2) + '\n')]]), 'manifest.json', Buffer.from(JSON.stringify(m, null, 2) + '\n'))); assert.equal(r.checks.find(c => c.name === 'audit-chain').ok, false, 'a manifest claiming a later head than the archive holds is caught'); });
  // 14. Organisation B: 1,203 events from before the chain are listed and reproduce the genesis seal offline.
  const B = 'org_exit_b';
  d1.db.prepare("INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,'legacy',?)").run(B, 'Pre-chain organisation', now);
  d1.db.prepare("INSERT INTO teams (org_id,id,name,created_at) VALUES (?,?,?,?)").run(B, 'default', 'Care team', now);
  d1.db.prepare("INSERT INTO memberships (org_id,user_id,role,is_owner,status,version,created_at) VALUES (?,?,'clinician',1,'active',1,?)").run(B, 'owner', now);
  d1.db.prepare("INSERT INTO team_members (org_id,team_id,user_id) VALUES (?,?,?)").run(B, 'default', 'owner');
  for (let i = 0; i < 1203; i++) d1.db.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(B, `pre-${String(i).padStart(5, '0')}`, null, 'owner', 'Synthetic owner', 'clinician', 'legacyAction', B, 'Before the chain', new Date(Date.parse('2026-01-01T00:00:00Z') + i * 1000).toISOString());
  s = await load(B); after = structuredClone(s); after.organisation.name = 'Renamed pre-chain organisation'; after.workspace.audit.push({ id: crypto.randomUUID(), at: now, actor: 'Synthetic owner', actorId: 'owner', role: 'clinician', action: 'renameOrganisation', subject: B, detail: 'First chained event' }); await commit(s, after, 'renameOrganisation');
  const bFiles = readTar(Buffer.from((await build(B)).archive)), bReport = verifyFiles(bFiles);
  check(() => { assert.equal(bReport.ok, true, JSON.stringify(bReport.failures)); assert.match(bReport.checks.find(c => c.name === 'genesis-seal').detail, /^1203 earlier events reproduce the genesis digest$/); assert.equal(jsonl(bFiles.get('tables/audit_events.jsonl')).length, 1205); });
  check(() => { const ev = jsonl(bFiles.get('tables/audit_events.jsonl')); ev.find(e => e.id === 'pre-00600').detail = 'Rewritten before the chain'; const r = failing(reseal(bFiles, 'tables/audit_events.jsonl', ev.map(e => JSON.stringify(e) + '\n').join('')), 'genesis-seal'); assert.match(r.failures.join(), /sealed by the genesis marker differs/); assert.equal(r.checks.find(c => c.name === 'audit-chain').ok, true, 'the chained events are untouched'); });

  // 15. NFR-22 step: a 1000-person organisation exports completely and re-imports into a fresh validation
  // database with identical row counts, loadable state and an intact audit chain.
  const C = 'org_exit_c', wc = seedWorkspace(now), template = wc.people[0];
  wc.people = Array.from({ length: 1000 }, (_, i) => ({ ...structuredClone(template), id: `p_${String(i).padStart(4, '0')}`, name: `Synthetic Person ${i}`, assignedTo: 'owner', teamId: i % 2 ? 'default' : 'south' }));
  wc.visits = wc.people.map((p, i) => ({ id: `v_${String(i).padStart(4, '0')}`, personId: p.id, version: 1, state: 'confirmed', confirmedAt: now, facts: facts(String(40 + (i % 30))), createdAt: now, aiResults: [], recordVersion: 1 }));
  wc.referrals = wc.people.filter((_, i) => i % 10 === 0).map(p => ({ id: `r_${p.id}`, personId: p.id, visitId: `v_${p.id.slice(2)}`, facility: 'CHC', reason: 'Synthetic', state: 'sent', createdAt: now, ownerId: 'owner' }));
  const started = Date.now();
  await store.createState(d1, { organisation: { id: C, name: '1000-person organisation', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care team', createdAt: now }, { id: 'south', name: 'South team', createdAt: now }], members: [{ ...member, teamIds: ['default', 'south'] }], invitations: [], workspace: wc }, actor, 'createOrganisation');
  d1.db.prepare('INSERT INTO work_burden_samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(C,'owner','restore-work','p_0000','v_0000','restore-receipt','restore-session','capture','segment',12,0,'fixed-input-hash',1,'client-active-v1',JSON.stringify({source:'online',lineage:['v_0000'],programmes:[]}),now);
  d1.db.prepare('INSERT INTO work_support_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(C,'owner','restore-support','restore-support','p_0000','v_0000','request','capture','owner',null,1,'fixed-input-hash',1,now);
  d1.db.prepare('INSERT INTO command_receipts (actor_id,key,org_id,hash,result,person_id,created_at,command_type,mutation_subject_id,mutation_event_id,mutation_context) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('owner','restore-receipt',C,'fixed-hash','{}','p_0000',now,'closeCorrectionTask','v_0000','fixture-provenance',JSON.stringify({taskId:'fixed-task',parentId:'v_0000',kind:'correction'}));
  const cBuilt = await build(C, { member: { ...member, teamIds: ['default', 'south'] }, includeFhir: false }), exportMs = Date.now() - started;
  const cFiles = readTar(Buffer.from(cBuilt.archive)), cManifest = JSON.parse(cFiles.get('manifest.json').toString('utf8')), cReport = verifyFiles(cFiles);
  check(() => { assert.equal(cReport.ok, true, JSON.stringify(cReport.failures)); assert.equal(cManifest.scope.complete, true); assert.equal(cManifest.totals.withheld, 0); assert.equal(cManifest.files.find(f => f.table === 'patients').rows, 1000); assert.equal(cManifest.files.find(f => f.table === 'visits').rows, 1000); assert.equal(cManifest.files.find(f => f.table === 'record_revisions').rows, 2000); assert.equal(cManifest.handover.patientTasks, 100); });
  const d2 = migrated();
  const placeholders = { accounts: { email: 'reimported@example.invalid' }, invitations: { token_hash: null }, command_receipts: { result: '{}' } };
  for (const f of cManifest.files.filter(x => x.table)) {
    for (const r of jsonl(cFiles.get(f.path))) {
      const values = { ...r, ...(placeholders[f.table] ?? {}) };
      if (f.table === 'invitations') values.token_hash = `reimported-${r.id}`;
      if (f.table === 'media') { const p = [...cFiles.keys()].find(k => k.startsWith(`media/${r.id}.`)); values.data = p ? cFiles.get(p).toString('base64') : ''; }
      const cols = Object.keys(values);
      d2.db.prepare(`INSERT INTO ${f.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(c => values[c]));
    }
  }
  const counts = (db, table) => db.db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${table === 'organisations' ? 'id' : 'org_id'}=?`).get(C).n;
  check(() => { for (const t of exit.TABLES) assert.equal(counts(d2, t.table), counts(d1, t.table), t.table); });
  const reloaded = await store.readState(d2, C), original = await store.readState(d1, C);
  check(() => { assert.equal(reloaded.workspace.people.length, 1000); assert.equal(reloaded.workspace.visits.length, 1000); assert.deepEqual(reloaded.workspace.visits.map(x => [x.id, x.personId, x.facts.weight]), original.workspace.visits.map(x => [x.id, x.personId, x.facts.weight])); assert.deepEqual(reloaded.workspace.people.map(p => [p.id, p.teamId, p.version]), original.workspace.people.map(p => [p.id, p.teamId, p.version])); });
  const reVerify = await chain.verifyChain(d2, C);
  check(() => { assert.equal(reVerify.status, 'intact'); assert.deepEqual(reVerify.head, cManifest.auditChain.verification.head); });
  // 16. Size guard: an export over the row limit is refused rather than truncated.
  await rejects(() => exit.buildExport({ prepare: sql => ({ bind: () => ({ first: async () => null, all: async () => ({ results: /FROM organisations/.test(sql) ? [{ id: C }] : Array.from({ length: exit.PAGE }, (_, i) => ({ org_id: C, id: String(i) })) }) }) }) }, { orgId: C, member, exporter, exportId: 'x', now, includeFhir: false, environment: 'synthetic' }), /larger than a single export/);

  const result = { suite: 'data exit contract (slice 6m)', passed, thousandPersonExport: { patients: 1000, visits: 1000, rows: cManifest.totals.rows, archiveBytes: cBuilt.archive.byteLength, createAndExportMs: exportMs, reimportedTablesMatched: exit.TABLES.length, reimportedChain: reVerify.status }, completedAt: new Date().toISOString() };
  writeFileSync('tests/data-exit-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
