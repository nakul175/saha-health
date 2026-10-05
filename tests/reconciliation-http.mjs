import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startWorker, identity, client } from './lib/worker.mjs';

const state=resolve('.wrangler/reconciliation-http-state');
const worker=await startWorker({port:'8947',name:'reconciliation-http',state,vars:{SAHA_ENVIRONMENT:'synthetic'}});
const C=client(worker.base),o=identity('owner'),c=identity('clinician'),w=identity('asha'),a=identity('admin');
const checks=[];let org,sql;
const check=async(name,fn)=>{await fn();checks.push(name);};
const command=async(who,body,status=200,key)=>{const r=await C.call(who,'/api/commands',{method:'POST',body,org,headers:key?{'Idempotency-Key':key}:{}});assert.equal(r.status,status,r.text.slice(0,500));return r.json;};
const snapshot=async who=>{const r=await C.get(who,'/api/workspace',org);assert.equal(r.status,200,r.text);return r.json;};
const queue=async(who,body={},status=200)=>{const r=await C.call(who,'/api/reconciliation',{method:'POST',body,org});assert.equal(r.status,status,r.text.slice(0,500));return r.json;};
try{
 const home=await snapshot(o);org=home.organisation.id;
 for(const [who,role] of [[c,'clinician'],[w,'asha'],[a,'admin']]){const h=await C.get(who,'/api/workspace');assert.equal(h.status,200);const inv=await command(o,{type:'createInvite',accountCode:h.json.user.accountCode,label:role,role,teamIds:['default']});await command(who,{type:'joinOrganisation',token:inv.result.token});}
 const d=join(state,'v3/d1/miniflare-D1DatabaseObject'),f=readdirSync(d).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');sql=new DatabaseSync(join(d,f));sql.exec('PRAGMA busy_timeout=5000');
 const make=async(name)=>(await command(o,{type:'createPerson',name,age:30,sex:'Female',village:'Synthetic reconciliation locality',programme:'General care',teamId:'default'})).result.personId;
 const p=await make('Synthetic correction patient'),dup=await make('Synthetic duplicate'),surv=await make('Synthetic survivor');
 const visit=async(pid)=>{const id=(await command(o,{type:'startVisit',personId:pid})).result.visitId;let s=await snapshot(o);let v=s.visits.find(x=>x.id===id);await command(o,{type:'saveVisit',visitId:id,version:v.version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'55',temperature:'',weeks:'',coughDays:'',notes:'Synthetic reconciliation evidence',source:'measured'}});s=await snapshot(o);v=s.visits.find(x=>x.id===id);await command(o,{type:'confirmVisit',visitId:id,version:v.version,patientCheck:{personId:pid,personVersion:s.people.find(p=>p.id===pid).version,confirmed:true}});return id;};
 const v=await visit(p);await command(o,{type:'createReferral',visitId:v,facility:'Synthetic CHC',reason:'Synthetic downstream review obligation'});
 let snap=await snapshot(o);await command(o,{type:'amendVisit',visitId:v,version:snap.visits.find(x=>x.id===v).recordVersion,reason:'Synthetic historical correction needs downstream review'});
 const dv=await visit(dup);await command(o,{type:'createReferral',visitId:dv,facility:'Synthetic facility',reason:'Synthetic identity reconciliation obligation'});
 const proposed=await command(o,{type:'identityMergePropose',survivorId:surv,duplicateId:dup,evidence:'Synthetic evidence',reason:'Synthetic duplicate identity confirmed by two stewards'});
 await command(c,{type:'identityMergeDecide',caseId:proposed.result.caseId,version:1,decision:'approve',reason:'Independent synthetic steward reviewed both records'});
 let q=await queue(o);const task=q.rows.find(x=>x.kind==='correction'&&x.personId===p),merge=q.rows.find(x=>x.kind==='identity-merge');assert.ok(task&&merge);
 await check('unified queue contains correction and merge tasks and read audit precedes return',async()=>{
  assert.ok(q.rows.some(x=>x.kind==='correction')&&q.rows.some(x=>x.kind==='identity-merge'));
  for(const pid of [p,dup,surv])assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action='viewRecordHistory' AND detail LIKE 'Scoped reconciliation%'").get(org,pid).n>0);
 });
 await check('administrators and ASHAs without assignment cannot read patient tasks',async()=>{await queue(a,{},403);assert.equal((await queue(w)).total,0);await queue(w,{personId:p},403);});
 await check('a merge counterpart outside care scope hides its task and counts',async()=>{
  sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(w.id,org,dup);
  const q=await queue(w,{personId:dup});assert.equal(q.total,0);assert.equal(q.rows.length,0);
 });
 await check('stale hashed cursors restart the queue without skipping work',async()=>{
  const reset=await queue(o,{cursor:'0'.repeat(64)+':50'});assert.equal(reset.reset,true);assert.equal(reset.rows[0].taskId,q.rows[0].taskId);
 });
 const assign={type:'assignReconciliationTask',personId:p,kind:'correction',parentId:task.parentId,taskId:task.taskId,ownerId:c.id,reason:'Clinical responsibility assigned for correction review',expectedHistory:0,expectedOwnerId:task.ownerId};
 await check('assignment commits once and creates scoped in-app notice',async()=>{const key=crypto.randomUUID();await command(o,assign,200,key);await command(o,assign,200,key);const row=(await queue(c,{mine:true})).rows.find(x=>x.taskId===task.taskId);assert.equal(row.assignmentHistory.length,1);assert.equal(row.newAssignment,true);});
 await check('out-of-scope assignee and stale assignment history are rejected',async()=>{await command(o,{...assign,ownerId:w.id,expectedHistory:1,expectedOwnerId:c.id},403);await command(o,{...assign,expectedHistory:0},409);});
 await check('only the current recipient acknowledges a notice',async()=>{const ack={type:'acknowledgeReconciliationTask',personId:p,kind:'correction',parentId:task.parentId,taskId:task.taskId};await command(o,ack,403);await command(c,ack);assert.equal((await queue(c,{mine:true})).rows.find(x=>x.taskId===task.taskId).newAssignment,false);});
 await check('merge assignment requires an eligible steward with access to both records',async()=>{await command(o,{...assign,personId:merge.personId,kind:'identity-merge',parentId:merge.parentId,taskId:merge.taskId,ownerId:w.id,expectedHistory:0,expectedOwnerId:merge.ownerId},403);await command(o,{...assign,personId:merge.personId,kind:'identity-merge',parentId:merge.parentId,taskId:merge.taskId,ownerId:c.id,expectedHistory:0,expectedOwnerId:merge.ownerId});});
 await check('cross-site reads are refused',async()=>{const r=await C.call(o,'/api/reconciliation',{method:'POST',body:{},org,headers:{Origin:'https://untrusted.example.invalid'}});assert.equal(r.status,403);});
 await check('assigning a task does not close it or modify downstream evidence',async()=>{const data=JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,v).data);assert.equal(data.correctionTasks.find(x=>x.id===task.taskId).state,'open');await command(o,{type:'closeCorrectionTask',personId:p,visitId:v,taskId:task.taskId},422);});
 // Model a historical pre-2j record in this isolated synthetic fixture. No historical audit/receipt is removed.
 sql.prepare("UPDATE visits SET data=json_remove(data,'$.correctionTasks') WHERE org_id=? AND id=?").run(org,v);
 let preview=(await command(o,{type:'previewReconciliationBackfill',personId:p})).result;
 await check('historical preview is read-only and identifies missing obligations',async()=>{assert.equal(preview.visits.length,1);assert.equal(preview.externalSends,0);assert.equal(JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,v).data).correctionTasks,undefined);});
 await check('stale reviewed backfill plans are refused',async()=>{sql.prepare('UPDATE visits SET version=version+1 WHERE org_id=? AND id=?').run(org,v);await command(o,{type:'applyReconciliationBackfill',personId:p,planHash:preview.planHash,reason:'Reviewed synthetic historical obligations before apply'},409);});
 preview=(await command(o,{type:'previewReconciliationBackfill',personId:p})).result;
 await check('reviewed historical apply and new-key retry append one set of tasks without external action',async()=>{const apply={type:'applyReconciliationBackfill',personId:p,planHash:preview.planHash,reason:'Reviewed synthetic historical obligations before apply'};const first=await command(o,apply);assert.equal(first.result.applied,1);const data=JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,v).data);assert.ok(data.correctionTasks.some(t=>t.state==='open'));const ids=data.correctionTasks.map(t=>t.id);const replay=await command(o,apply);assert.equal(replay.result.replayed,true);assert.deepEqual(JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,v).data).correctionTasks.map(t=>t.id),ids);});
 await check('existing task records are never overwritten by historical backfill',async()=>{const again=(await command(o,{type:'previewReconciliationBackfill',personId:p})).result;assert.equal(again.visits.length,0);const q=await queue(o);assert.ok(q.rows.some(x=>x.kind==='identity-merge'&&x.assignmentHistory.length===1));});
 await check('assignment notices disappear immediately when the recipient loses current patient scope',async()=>{
  sql.prepare('DELETE FROM team_members WHERE org_id=? AND user_id=?').run(org,c.id);
  assert.equal((await queue(c,{mine:true})).total,0);
  await command(o,{...assign,personId:merge.personId,kind:'identity-merge',parentId:merge.parentId,taskId:merge.taskId,expectedHistory:1,expectedOwnerId:c.id},403);
 });
 await check('a failed read audit refuses the whole queue without returning task details',async()=>{
  sql.exec("CREATE TRIGGER reconciliation_read_refusal BEFORE INSERT ON audit_events WHEN NEW.action='viewRecordHistory' BEGIN SELECT RAISE(ABORT,'Synthetic read audit failure'); END;");
  try{const r=await queue(o,{},503);assert.equal(r.rows,undefined);}finally{sql.exec('DROP TRIGGER reconciliation_read_refusal');}
 });
 const result={suite:'reconciliation-http',passed:checks.length,checks,completedAt:new Date().toISOString(),limits:'Built local Worker and D1; synthetic fixtures, no hosted or real clinical acceptance.'};mkdirSync('tests/evidence/reconciliation',{recursive:true});writeFileSync('tests/evidence/reconciliation/http.json',JSON.stringify(result,null,2)+'\n');console.log(`Reconciliation HTTP/D1: ${checks.length} checks passed`);
}finally{sql?.close();await worker.stop();}
