import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
export async function operationsSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,supervisor:s,admin:a,worker:w,clinician:c,stranger:x}=accounts;
 await get(null,'/api/operations',401,org);await get(x,'/api/operations',403,org);await get(w,'/api/operations',403,org);await get(c,'/api/operations',403,org);
 let overview=await get(o,'/api/operations',200,org);check(()=>{assert.equal(overview.release,'11 / v1.3-readiness');assert.equal(overview.pilotReady,false);assert.equal(overview.gates.length,8);assert.ok(overview.report.patients>0);assert.equal(overview.operations.version,0);assert.ok(overview.report.activeWorkers>0)});
 const supervised=await get(s,'/api/operations?days=7',200,org);check(()=>{assert.equal(supervised.operations,null);assert.equal(supervised.telemetry,null);assert.ok(supervised.report.patients<overview.report.patients);assert.ok(!JSON.stringify(supervised).includes('Same test name'))});
 const admin=await get(a,'/api/operations',200,org);check(()=>{assert.equal(admin.report,null);assert.ok(admin.telemetry);assert.ok(!JSON.stringify(admin).includes('Meena'));assert.ok(admin.telemetry.count>0)});
 await get(o,'/api/operations?days=999',422,org);await get(o,'/api/operations?format=raw',422,org);await get(a,'/api/operations?format=csv',403,org);await get(s,'/api/operations?format=support',403,org);
 await post(s,{type:'opsIncident',version:0,title:'Forbidden incident',severity:'high',ownerId:o.id},403);await post(a,{type:'opsMaintenance',version:0,active:true,reason:'Forbidden pause'},403);
 const created=await post(a,{type:'opsIncident',version:0,title:'Synthetic delivery review',severity:'high',ownerId:o.id});const incidentId=created.result.incidentId;
 await post(a,{type:'opsIncident',version:0,title:'Stale incident rejected',severity:'normal',ownerId:o.id},409);
 await post(a,{type:'opsUpdateIncident',version:1,id:incidentId,state:'resolved',ownerId:o.id,resolution:'Confirmed recovery evidence',evidence:''},422);
 await post(a,{type:'opsUpdateIncident',version:1,id:incidentId,state:'investigating',ownerId:o.id,resolution:'Looking up existing receipt; no resend',evidence:''});
 await post(a,{type:'opsUpdateIncident',version:2,id:incidentId,state:'resolved',ownerId:o.id,resolution:'Matched the original independent receipt',evidence:'SYNTHETIC-INCIDENT-001'});
 await post(a,{type:'opsUpdateIncident',version:3,id:incidentId,state:'investigating',ownerId:o.id,resolution:'Attempt to reopen immutable incident',evidence:''},409);
 await post(a,{type:'opsRates',version:3,input:1,output:2},403);await post(o,{type:'opsRates',version:3,input:1,output:2});
 overview=await get(o,'/api/operations',200,org);check(()=>{assert.equal(overview.operations.version,4);assert.equal(overview.operations.incidents[0].state,'resolved');assert.equal(overview.report.usage.rates.input,1);assert.equal(overview.pilotReady,false)});
 const key=crypto.randomUUID();await post(o,{type:'opsMaintenance',version:4,active:true,reason:'Synthetic recovery drill; pause new work'},200,key);
 await post(o,{type:'opsMaintenance',version:4,active:true,reason:'Synthetic recovery drill; pause new work'},200,key);
 await post(o,{type:'createTeam',name:'Blocked during maintenance'},423);await post(o,{type:'startVisit',personId:'p_meena'},423);await post(o,{type:'executeAgent',visitId:'missing',runId:'missing',inputHash:'missing'},423);await post(o,{type:'sendSubmission',submissionId:'missing'},423);await post(o,{type:'syncFieldVisit',personId:'p_meena',leaseId:'missing',packageHash:'f'.repeat(64),facts:{date:new Date().toISOString().slice(0,16),systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'reported'},answers:{},absence:{}},423);
 await get(o,'/api/workspace',200,org);check(()=>assert.equal(o.state.maintenance.active,true));
 const p=o.state.people.find(p=>p.id==='p_meena');await post(o,{type:'setConsent',personId:p.id,purpose:'ai',active:false,version:p.version});
 // Receipt recovery remains routed to the actual handler rather than blocked.
 await post(o,{type:'lookupSubmission',submissionId:'missing'},404);
 await post(o,{type:'opsMaintenance',version:5,active:false,reason:'Recovery evidence inspected; resume synthetic testing'});
 await post(o,{type:'createTeam',name:'Resumed after drill'});
 const base=process.env.SAHA_TEST_ORIGIN??'http://127.0.0.1:8787';
 const response=await fetch(base+'/api/operations?format=csv',{headers:{...s.headers,'x-saha-organisation':org}}),csv=await response.text();check(()=>{assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/saha-report.csv/);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!csv.includes('Meena'));assert.ok(csv.includes('Visits confirmed in window'))});
 const support=await get(a,'/api/operations?format=support',200,org);check(()=>{const raw=JSON.stringify(support);assert.ok(!raw.includes('Synthetic delivery review'));assert.ok(!raw.includes(org));assert.ok(!raw.includes(o.id));assert.ok(!raw.includes('example.invalid'));assert.equal(support.pilotReady,false)});
 check(()=>{const cols=sql.prepare('PRAGMA table_info(request_metrics)').all().map(x=>x.name);assert.deepEqual(cols,['org_id','bucket','route','status','count','total_ms','max_ms']);assert.ok(sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action=?').get(org,'opsExport').n>=2)});
 const runs=[];for(let wave=0;wave<4;wave++){await Promise.all(Array.from({length:5},async()=>{const start=performance.now(),r=await fetch(base+'/api/operations',{headers:{...s.headers,'x-saha-organisation':org}});const body=await r.json();assert.equal(r.status,200);assert.equal(body.report.patients,supervised.report.patients);runs.push(performance.now()-start)}));}
 check(()=>assert.equal(runs.length,20));const sorted=runs.sort((a,b)=>a-b);writeFileSync('tests/operations-load-result.json',JSON.stringify({release:'11 / v1.3-readiness',environment:'local Worker and synthetic D1',requests:20,concurrency:5,errors:0,p50Ms:Math.round(sorted[9]),p95Ms:Math.round(sorted[18]),maxMs:Math.round(sorted[19]),limit:'Bounded local reporting smoke; not a production load or capacity claim.',completedAt:new Date().toISOString()},null,2)+'\n');
 // Suspension denies access even if the user previously downloaded diagnostics.
 await get(o,'/api/workspace',200,org);const member=o.state.members.find(m=>m.userId===a.id);await post(o,{type:'updateMember',userId:a.id,version:member.version,role:'admin',teamIds:[],isOwner:false,status:'suspended',reason:'Operations access revocation test'});await get(a,'/api/operations',403,org);await post(a,{type:'opsIncident',version:6,title:'Suspended cannot write',severity:'normal',ownerId:o.id},403);
}
