import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Slice 6t: material reads are chained audit events over HTTP and local D1, and nothing proceeds when the
// audit store cannot be written (fault injected with a trigger on the local D1 database, for a separate
// organisation so no other suite is affected; always removed afterwards).
export async function accessAuditSmoke({get,post,check,accounts,org,sql,base}){
 // A separate synthetic account and its own home organisation (the shared owner is at its organisation limit).
 const {owner:outsider}=accounts,o={headers:{'oai-authenticated-user-id':`access-audit-${crypto.randomUUID().slice(0,8)}`,'oai-authenticated-user-email':'access-audit@example.invalid'},state:null};
 await get(o);const mine=o.state.organisation.id;
 const name=`Access Synthetic ${crypto.randomUUID().slice(0,6)}`;
 const pid=(await post(o,{type:'createPerson',name,age:41,sex:'Female',village:'Access locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid},200,undefined,mine)).result.visitId;
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'121',diastolic:'79',weight:'58',temperature:'',weeks:'',coughDays:'',notes:'SECRET-ACCESS-NOTE synthetic',source:'measured'};
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts},200,undefined,mine);await get(o,'/api/workspace',200,mine);
 // Media is attached while the visit is a draft.
 const png=new Uint8Array(2048);png.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);for(let i=8;i<png.length;i++)png[i]=i%251;
 const up=await fetch(`${base}/api/media?visitId=${encodeURIComponent(vid)}&purpose=wound-or-skin`,{method:'POST',headers:{...o.headers,'Content-Type':'image/png','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':mine},body:png}),media=await up.json();
 check(()=>assert.equal(up.status,200,JSON.stringify(media).slice(0,200)));await get(o,'/api/workspace',200,mine);
 await post(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version},200,undefined,mine);
 const events=action=>sql.prepare('SELECT * FROM audit_events WHERE org_id=? AND action=? ORDER BY seq').all(mine,action);
 const revision=()=>sql.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(mine);
 const raw=async(who,path,status)=>{const r=await fetch(base+path,{headers:{...who.headers,'x-saha-organisation':mine}});const text=await r.text();check(()=>assert.equal(r.status,status,path+' '+text.slice(0,300)));return {r,text};};
 // Each material read appends one chained event without moving the organisation or patient revision.
 const rev0=revision();
 await raw(o,`/api/history?personId=${encodeURIComponent(pid)}`,200);
 await raw(o,`/api/fhir/${vid}?organisationId=${encodeURIComponent(mine)}&format=document`,200);
 await raw(o,`/api/patients/detail?personId=${encodeURIComponent(pid)}`,200);
 await raw(o,`/api/media/${media.mediaId}?organisationId=${encodeURIComponent(mine)}`,200);
 check(()=>{for(const action of ['viewRecordHistory','downloadFhir','viewPatientRecord','viewMedia']){const e=events(action);assert.equal(e.length,1,action);assert.equal(e[0].person_id,pid);assert.ok(Number.isInteger(e[0].seq)&&e[0].seq>0,action);assert.equal(JSON.stringify(e[0]).includes('SECRET-ACCESS-NOTE'),false,action);assert.equal(JSON.stringify(e[0]).includes(name),false,action);}});
 check(()=>assert.deepEqual(revision(),rev0,'reads move neither the organisation nor the patient revision'));
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND key LIKE 'access_%'").get(mine).n,0,'no receipts for reads'));
 // The Activity log shows the access events to the owner in the patient's team.
 const log=await get(o,'/api/audit',200,mine);
 check(()=>{const names=log.events.map(e=>e.action);for(const action of ['viewRecordHistory','downloadFhir','viewPatientRecord','viewMedia'])assert.ok(names.includes(action),action);});
 // The chain verifies with the access events in it.
 let chain=JSON.parse((await raw(o,'/api/audit/chain',200)).text);
 check(()=>assert.equal(chain.status,'intact'));
 // A chain-head checkpoint for external anchoring: the head of the intact chain, its digest recomputes
 // offline, issuing it is chained, and checking it later matches; a wrong hash differs, a later sequence is not reached.
 const point=JSON.parse((await raw(o,'/api/audit/chain?format=checkpoint',200)).text);
 const sha=t=>createHash('sha256').update(t).digest('hex');
 check(()=>{assert.equal(point.format,'saha-audit-checkpoint-v1');assert.equal(point.organisationId,mine);assert.equal(point.head.seq,chain.head.seq);assert.equal(point.head.hash,chain.head.hash);assert.equal(point.checkpointSha256,sha(JSON.stringify(['saha-audit-checkpoint-v1',mine,point.head.seq,point.head.hash,point.head.at,point.issuedAt])));});
 check(()=>{const e=events('auditChainCheckpoint');assert.equal(e.length,1);assert.equal(e[0].id,point.recordedAs);assert.equal(e[0].seq,point.head.seq+1);assert.ok(e[0].detail.includes(point.checkpointSha256));});
 const checked=async ref=>JSON.parse((await raw(o,`/api/audit/chain?checkpoint=${encodeURIComponent(ref)}`,200)).text);
 let c=await checked(`${point.head.seq}:${point.head.hash}`);check(()=>{assert.equal(c.status,'intact');assert.equal(c.checkpoint.result,'matches');});
 c=await checked(`${point.head.seq}:${'0'.repeat(64)}`);check(()=>assert.equal(c.checkpoint.result,'differs'));
 c=await checked(`${point.head.seq+100000}:${point.head.hash}`);check(()=>assert.equal(c.checkpoint.result,'not-reached'));
 await raw(o,'/api/audit/chain?checkpoint=abc',422);
 await raw(outsider,'/api/audit/chain?format=checkpoint',403);
 // A person outside the organisation is refused and nothing is recorded for them.
 const n=sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(mine).n;
 await raw(outsider,`/api/history?personId=${encodeURIComponent(pid)}`,403);
 check(()=>assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(mine).n,n));
 // Fault injection: the audit store refuses inserts for this organisation only.
 const auditCount=()=>sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(mine).n;
 const n0=auditCount(),patients0=sql.prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').get(mine).n;
 sql.exec(`CREATE TRIGGER IF NOT EXISTS audit_fault_smoke BEFORE INSERT ON audit_events WHEN NEW.org_id='${mine}' BEGIN SELECT RAISE(ABORT, 'Synthetic audit store failure'); END;`);
 try{
  const refused=async(path,pattern)=>{const {text}=await raw(o,path,503);check(()=>assert.match(JSON.parse(text).error,pattern));check(()=>assert.equal(text.includes('SECRET-ACCESS-NOTE'),false,path));};
  await refused(`/api/history?personId=${encodeURIComponent(pid)}`,/could not record this access in the audit log/);
  await refused(`/api/fhir/${vid}?organisationId=${encodeURIComponent(mine)}`,/could not record this access in the audit log/);
  await refused(`/api/patients/detail?personId=${encodeURIComponent(pid)}`,/could not record this access in the audit log/);
  await refused('/api/audit/chain?format=jsonl',/could not record this export in the audit log/);
  await refused('/api/audit/chain?format=checkpoint',/could not record this export in the audit log/);
  // A command is not saved without its audit event.
  const r=await fetch(base+'/api/commands',{method:'POST',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':mine},body:JSON.stringify({type:'createPerson',name:`Blocked ${name}`,age:30,sex:'Male',village:'Access locality',programme:'General care',teamId:'default'})});
  check(()=>assert.equal(r.status,503));
  check(()=>{assert.equal(auditCount(),n0);assert.equal(sql.prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').get(mine).n,patients0);});
 }finally{sql.exec('DROP TRIGGER IF EXISTS audit_fault_smoke;');}
 // After recovery reads work again and the chain is intact.
 await raw(o,`/api/history?personId=${encodeURIComponent(pid)}`,200);
 chain=JSON.parse((await raw(o,'/api/audit/chain',200)).text);
 check(()=>{assert.equal(chain.status,'intact');assert.equal(events('viewRecordHistory').length,2);});
}
