// Shared access helper membership snapshot contract. Real SQLite and unchanged migrations;
// no Worker, hosted identity, full patient scope or formal acceptance claim.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.access-membership-contract-'));
const started = performance.now(), checks = [], databases = [];
class Statement {
  constructor(d, sql, args = []) { this.d = d; this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.d, this.sql, args); }
  exec() { this.d.queries.push({kind:'exec',sql:this.sql}); const q = this.d.db.prepare(this.sql); if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: q.all(...this.args), meta: { changes: 0 } }; const a=this.d.db.prepare('SELECT total_changes() AS n').get().n; const r=q.run(...this.args); const z=this.d.db.prepare('SELECT total_changes() AS n').get().n; return {results:[],meta:{changes:this.d.nativeChanges?Number(z-a):Number(r.changes)}}; }
  async first() { this.d.queries.push({kind:'first',sql:this.sql}); if (this.d.beforeFirst) await this.d.beforeFirst(this); return this.d.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { this.d.queries.push({kind:'all',sql:this.sql}); const out={results:this.d.db.prepare(this.sql).all(...this.args)};return this.d.witness&&this.sql.startsWith('SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash FROM audit_events WHERE org_id=? AND id IN')?this.d.witness(out):out; }
  async run() { return this.exec(); }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.beforeBatch = null; this.afterFailure = null; this.beforeFirst = null; this.batches = []; this.failures = []; this.queries = []; this.mapResults=null;this.nativeChanges=false;this.witness=null; databases.push(this); }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    if (this.beforeBatch) await this.beforeBatch(statements);
    this.batches.push(statements.map(s => ({ sql: s.sql, args: s.args })));
    this.db.exec('BEGIN');
    try { const out = statements.map(s => s.exec()); this.db.exec('COMMIT'); return this.mapResults?this.mapResults(out):out; }
    catch (e) { this.db.exec('ROLLBACK'); this.failures.push({ message: e.message, errcode: e.errcode }); if (this.afterFailure) await this.afterFailure(e); throw e; }
  }
}
const check = async (name, run) => { try { const detail = await run(); checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); } catch (e) { checks.push({ name, passed: false, error: e.message, stack: e.stack }); } };
let store, access, chain, seedWorkspace;
try {
  for (const f of readdirSync('lib/saha').filter(f => f.endsWith('.ts')))
    writeFileSync(join(dir, f.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(`lib/saha/${f}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const load = n => import(pathToFileURL(join(dir, n + '.js')));
  store = await load('store'); access = await load('access-audit'); chain = await load('audit-chain'); ({ seedWorkspace } = await load('seed'));
  const migrations = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  const now = '2026-10-10T00:00:00.000Z', actor = { userId: 'owner', displayName: 'Synthetic owner', email: 'owner@example.invalid' };
  const entry = f => ({ action: 'viewPatientRecord', subject: f.pid, personId: f.pid, detail: 'Synthetic clinical record disclosed only after its access gate.' });
  let serial = 0;
  const make = async () => {
    const d = new D1(); for (const f of migrations) for (const q of readFileSync(join('drizzle', f), 'utf8').split('--> statement-breakpoint')) if (q.trim()) d.db.exec(q);
    d.db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?)').run(actor.userId, 'CODE0000000000000000000A', actor.displayName, actor.email, now);
    const member = { userId: actor.userId, displayName: actor.displayName, accountCode: 'CODE0000000000000000000A', role: 'clinician', status: 'active', isOwner: true, version: 1, teamIds: ['default'], createdAt: now };
    const id = `org_membership_${++serial}`, w = seedWorkspace(now); for (const p of w.people) { p.teamId = 'default'; p.assignedTo = actor.userId; p.version = 1; }
    await store.createState(d, { organisation: { id, name: 'Synthetic membership fixture', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Synthetic care team', createdAt: now }], members: [member], invitations: [], workspace: w }, actor, 'createOrganisation');
    const pid = w.people[0].id, state = await store.readState(d, id, [pid]); store.scope(state, actor.userId); d.batches = []; d.failures = []; d.queries=[];
    return { d, id, pid, state, member: store.scope(state, actor.userId) };
  };
  const rows = (f, q, ...args) => f.d.db.prepare(q).all(...args);
  const history = f => rows(f, 'SELECT * FROM audit_events WHERE org_id=? ORDER BY id', f.id);
  const unchangedHistory = (f, prior) => { const current = new Map(history(f).map(e => [e.id, e])); for (const e of prior) assert.deepEqual(current.get(e.id), e); };
  const clinical = f => ({ org: rows(f, 'SELECT id,name,revision,patient_revision FROM organisations WHERE id=?', f.id), patients: rows(f, 'SELECT * FROM patients WHERE org_id=? ORDER BY id', f.id), visits: rows(f, 'SELECT * FROM visits WHERE org_id=? ORDER BY id', f.id), revisions: rows(f, 'SELECT * FROM record_revisions WHERE org_id=? ORDER BY id', f.id), receipts: rows(f, 'SELECT * FROM command_receipts WHERE org_id=? ORDER BY actor_id,key', f.id) });
  const write = (f, overrides = {}) => access.recordAccess(f.d, f.state, overrides.actor ?? actor, overrides.member ?? f.member, entry(f), now);
  const refuse = (p, status = 403) => assert.rejects(p, e => e.status === status && (status === 403 ? e instanceof store.AccessMembershipRefused && !/nothing was saved|not applied|unapplied/i.test(e.message) : e.message === access.ACCESS_REFUSED));
  const intact = async f => { const v = await chain.verifyChain(f.d, f.id); assert.equal(v.status, 'intact'); return v.events; };
  const mutate = (f, sql, ...args) => f.d.db.prepare(sql).run(...args, f.id, actor.userId);
  const update = (f, set, ...args) => mutate(f, `UPDATE memberships SET ${set} WHERE org_id=? AND user_id=?`, ...args);

  const witnessCount=f=>f.d.queries.filter(q=>q.kind==='all'&&q.sql.startsWith('SELECT org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at,seq,prev_hash,hash FROM audit_events WHERE org_id=? AND id IN')).length;
  const extra=f=>{f.d.mapResults=o=>o.map(r=>({...r,meta:{...r.meta,changes:r.meta.changes+1}}));};
  const home=f=>{f.d.nativeChanges=true;f.d.db.exec(`CREATE TRIGGER home_side AFTER INSERT ON audit_events WHEN NEW.org_id='${f.id}' BEGIN UPDATE accounts SET active_org_id='${f.id}' WHERE user_id=NEW.actor_id;END`);};
  const many=(f,n=13)=>access.recordAccesses(f.d,f.state,actor,f.member,Array.from({length:n},(_,i)=>({action:'viewWorkspace',subject:f.id,detail:`Synthetic chunk ${i}.`})),now);
  await check('ordinary exact metadata keeps three executed statements and zero witness reads',async()=>{const f=await make();await write(f);assert.equal(f.d.queries.length,3);assert.equal(witnessCount(f),0);await intact(f);});
  await check('genuine account-home AFTER INSERT side write succeeds with native-style changes2 and exact audit verification',async()=>{const f=await make(),prior=history(f),saved=clinical(f);home(f);await write(f);assert.equal(rows(f,'SELECT active_org_id FROM accounts WHERE user_id=?',actor.userId)[0].active_org_id,f.id);assert.equal(history(f).length,prior.length+1);assert.equal(witnessCount(f),1);assert.equal(f.d.queries.length,4);assert.deepEqual(clinical(f),saved);unchangedHistory(f,prior);await intact(f);return {triggerFired:true,nativeStyleChanges:2};});
  await check('thirteen events across three excess-count chunks all receive exact witnesses',async()=>{const f=await make(),prior=history(f),saved=clinical(f);home(f);const out=await many(f);assert.equal(out.length,13);assert.equal(f.d.batches[0].length,3);assert.equal(witnessCount(f),1);assert.equal(history(f).length,prior.length+13);assert.deepEqual(clinical(f),saved);unchangedHistory(f,prior);await intact(f);});
  await check('eighty-nine excess-count intended rows use two bounded witness queries',async()=>{const f=await make(),prior=history(f);home(f);const out=await many(f,89);assert.equal(out.length,89);assert.equal(witnessCount(f),2);assert.equal(history(f).length,prior.length+89);for(const q of f.d.batches[0])assert.ok(q.args.length<=100);unchangedHistory(f,prior);await intact(f);});
  await check('cold genesis plus thirteen events are verified under actual trigger side writes',async()=>{const f=await make(),cold=f.id+'_cold';f.d.db.prepare('INSERT INTO organisations(id,name,revision,created_at,last_command) VALUES(?,?,?,?,?)').run(cold,'Synthetic cold',1,now,'cold');f.d.db.prepare('INSERT INTO memberships(org_id,user_id,role,is_owner,status,version,created_at) VALUES(?,?,?,?,?,?,?)').run(cold,actor.userId,'clinician',1,'active',1,now);f.d.nativeChanges=true;f.d.db.exec(`CREATE TRIGGER cold_side AFTER INSERT ON audit_events WHEN NEW.org_id='${cold}' BEGIN UPDATE accounts SET active_org_id='${cold}' WHERE user_id=NEW.actor_id;END`);const state={organisation:{id:cold,name:'Synthetic cold',revision:1,createdAt:now},teams:[],members:[f.member],invitations:[],workspace:{schemaVersion:1,revision:1,role:'clinician',people:[],visits:[],integrations:[],submissions:[],referrals:[],audit:[],receipts:{}}};await many({...f,id:cold,state});const a=rows(f,'SELECT id,seq FROM audit_events WHERE org_id=? ORDER BY seq',cold);assert.equal(a.length,14);assert.equal(a[0].id,chain.GENESIS_ID);assert.equal((await chain.verifyChain(f.d,cold)).status,'intact');assert.equal(witnessCount(f),1);});
  await check('genuine membership revocation with extra2 remains403 and retains committed audit',async()=>{const f=await make(),prior=history(f),saved=clinical(f);f.d.nativeChanges=true;f.d.db.exec(`CREATE TRIGGER extra_revoke AFTER INSERT ON audit_events WHEN NEW.org_id='${f.id}' BEGIN UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=NEW.org_id AND user_id=NEW.actor_id;END`);await refuse(write(f));assert.equal(history(f).length,prior.length+1);assert.equal(witnessCount(f),1);assert.deepEqual(clinical(f),saved);unchangedHistory(f,prior);await intact(f);});
  await check('first chunk extra7 never compensates later zero chunks after genuine revocation',async()=>{const f=await make(),prior=history(f),saved=clinical(f);f.d.nativeChanges=true;f.d.db.exec(`CREATE TRIGGER first_revoke AFTER INSERT ON audit_events WHEN NEW.org_id='${f.id}' AND NEW.detail LIKE 'Synthetic chunk 0.%' BEGIN UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=NEW.org_id AND user_id=NEW.actor_id;END`);await refuse(many(f));assert.equal(history(f).length,prior.length+6);assert.equal(witnessCount(f),0);assert.deepEqual(clinical(f),saved);unchangedHistory(f,prior);await intact(f);});
  await check('two genuine side writes plus omitted intended INSERT cannot pass on extra count alone',async()=>{const f=await make(),prior=history(f);f.d.nativeChanges=true;f.d.db.exec(`CREATE TRIGGER omit_side BEFORE INSERT ON audit_events WHEN NEW.org_id='${f.id}' BEGIN UPDATE accounts SET active_org_id='${f.id}' WHERE user_id=NEW.actor_id;UPDATE accounts SET display_name=display_name WHERE user_id=NEW.actor_id;SELECT RAISE(IGNORE);END`);await refuse(write(f),503);assert.deepEqual(history(f),prior);assert.equal(witnessCount(f),1);await intact(f);});
  await check('fabricated positive excess still requires real exact immutable row readback',async()=>{const f=await make(),prior=history(f);extra(f);await write(f);assert.equal(witnessCount(f),1);assert.equal(history(f).length,prior.length+1);unchangedHistory(f,prior);await intact(f);});
  await check('missing duplicate and each changed org ID sequence predecessor hash or detail witness fail503',async()=>{for(const kind of ['missing','duplicate','org_id','id','person_id','actor_id','actor_name','role','action','subject','detail','at','seq','prev_hash','hash']){const f=await make(),prior=history(f),saved=clinical(f);extra(f);f.d.witness=o=>kind==='missing'?{results:[]}:kind==='duplicate'?{results:[...o.results,...o.results]}:{results:o.results.map(r=>({...r,[kind]:kind==='seq'?r.seq+1:kind==='hash'||kind==='prev_hash'?'f'.repeat(64):'synthetic-changed'}))};await refuse(write(f),503);f.d.witness=null;assert.equal(history(f).length,prior.length+1);assert.deepEqual(clinical(f),saved);unchangedHistory(f,prior);await intact(f);}});
  await check('unknown witness failure503 preserves earlier actual clinical receipt and committed audit evidence',async()=>{const f=await make(),before=structuredClone(f.state),after=structuredClone(f.state),key='already-committed';after.organisation.name='Synthetic earlier save';after.workspace.audit.push({id:crypto.randomUUID(),at:now,actor:actor.displayName,actorId:actor.userId,role:f.member.role,action:'syntheticMutation',subject:f.id,detail:'Synthetic earlier saved mutation.'});await store.persist(f.d,before,after,actor,{type:'syntheticMutation'},key,'saved-hash',{saved:true});const saved=clinical(f),prior=history(f);extra(f);f.d.witness=()=>{throw Error('Synthetic witness storage fault')};await refuse(write(f),503);f.d.witness=null;assert.deepEqual(clinical(f),saved);assert.equal(rows(f,'SELECT count(*) AS n FROM command_receipts WHERE actor_id=? AND key=?',actor.userId,key)[0].n,1);assert.equal(history(f).length,prior.length+1);unchangedHistory(f,prior);await intact(f);});
  await check('malformed result metadata and excess versus deficit refuse before any witness approval',async()=>{for(const kind of ['short','negative','fraction','missing','deficit','compensated']){const f=await make(),prior=history(f);f.d.mapResults=o=>kind==='short'?[]:o.map((r,i)=>({...r,meta:kind==='missing'?{}:{...r.meta,changes:kind==='negative'?-1:kind==='fraction'?1.5:kind==='deficit'?0:kind==='compensated'?(i===0?100:0):r.meta.changes}}));await refuse(kind==='compensated'?many(f):write(f),503);assert.equal(witnessCount(f),0);assert.ok(history(f).length>prior.length);unchangedHistory(f,prior);await intact(f);}});
  await check('membership mutation after successful excess witness is caught by the final checkpoint',async()=>{const f=await make(),prior=history(f);home(f);f.d.witness=o=>{update(f,"status='suspended',version=version+1");return o;};await refuse(write(f));f.d.witness=null;assert.equal(history(f).length,prior.length+1);unchangedHistory(f,prior);await intact(f);});
  const result = { suite: 'access-audit-excess-metadata-contract', node: process.version, migrations: migrations.length, passed: checks.filter(x => x.passed).length, failed: checks.filter(x => !x.passed).length, checks, elapsedMs: performance.now() - started, recordedAtUtc: new Date().toISOString(), scope: 'Shared helper membership snapshot only; no Worker, hosted identity, full patient/team/purpose/delegation authority or formal acceptance claim' };
  writeFileSync(process.env.SAHA_ACCESS_EXCESS_RESULT ?? 'tests/access-audit-excess-metadata-contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); process.exitCode = result.failed ? 1 : 0;
} finally { for (const d of databases) d.db.close(); rmSync(dir, { recursive: true, force: true }); }
