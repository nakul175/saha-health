import assert from 'node:assert/strict';
// Slice 7e: separate operation permissions for record adapters (BR-INT-02, BR-INT-09), through the built Worker
// and local D1: owner-only versioned setting, refusal before preparation, a withdrawal between approval and
// sending recorded as not sent, the refusal on the trace and the exception queue, aggregate-only destinations.
export async function adapterOperationsSmoke({get,post,check,accounts,org,base}){
 const {owner:o,clinician:c}=accounts;
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 const integration=id=>o.state.integrations.find(i=>i.id===id);
 const set=(id,allowed,aggregateOnly=false,status=200,who=o,key)=>send(who,{type:'setAdapterOperations',integrationId:id,version:integration(id)?.operations?.version??0,allowed,aggregateOnly,reason:'Synthetic operation setting check'},status,key);
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(integration('mis_community').operations,undefined,'no stored setting means the release default');});
 // Owners only; the setting is versioned and audited, with no secrets in the response.
 await send(c,{type:'setAdapterOperations',integrationId:'mis_community',version:0,allowed:['update','lookup'],aggregateOnly:false,reason:'Synthetic non-owner attempt'},403);
 const approvalVersion=integration('mis_community').version,key=crypto.randomUUID(),first=await set('mis_community',['update','lookup'],false,200,o,key);
 check(()=>{assert.deepEqual(first.result,{integrationId:'mis_community',version:1,allowed:['update','lookup'],aggregateOnly:false});const i=integration('mis_community');assert.equal(i.operations.version,1);assert.equal(i.version,approvalVersion,'approval version unchanged');assert.equal(JSON.stringify(i).includes('SAHA_MIS'),false);});
 const replay=await send(o,{type:'setAdapterOperations',integrationId:'mis_community',version:0,allowed:['update','lookup'],aggregateOnly:false,reason:'Synthetic operation setting check'},200,key);
 check(()=>{assert.equal(replay.replayed,true);assert.equal(integration('mis_community').operations.version,1);});
 await send(o,{type:'setAdapterOperations',integrationId:'mis_community',version:0,allowed:['lookup'],aggregateOnly:false,reason:'Stale synthetic version'},409);
 await send(o,{type:'setAdapterOperations',integrationId:'mis_community',version:1,allowed:['create','aggregate'],aggregateOnly:true,reason:'Invalid aggregate-only'},422);
 await send(o,{type:'setAdapterOperations',integrationId:'ai_summary',version:0,allowed:['lookup'],aggregateOnly:false,reason:'Not a record adapter'},422);
 // A confirmed general-care visit with sharing permission.
 const pid=(await send(o,{type:'createPerson',name:`Operations synthetic ${crypto.randomUUID().slice(0,6)}`,age:27,sex:'Female',village:'Operations synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const me=()=>o.state.people.find(p=>p.id===pid),vid=(await send(o,{type:'startVisit',personId:pid})).result.visitId,v=()=>o.state.visits.find(y=>y.id===vid);
 await send(o,{type:'saveVisit',visitId:vid,version:v().version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'58',temperature:'',weeks:'',coughDays:'',notes:'Synthetic operations visit',source:'measured'}});
 await get(o,'/api/workspace',200,org);await send(o,{type:'confirmVisit',visitId:vid,version:v().version});
 await send(o,{type:'setConsent',personId:pid,version:me().version,purpose:'exchange',active:true});
 // Refused before anything is prepared.
 const refused=await send(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']},409);
 check(()=>assert.match(refused.error??JSON.stringify(refused),/not permitted to create records/));
 // Permitted again, prepared and approved; then withdrawn before execution: recorded as not sent.
 await set('mis_community',['create','update','lookup']);
 await send(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']});
 await send(o,{type:'approvePlan',visitId:vid,planId:v().plan.id,payloadHash:v().plan.payloadHash});
 await set('mis_community',['update','lookup']);
 await send(o,{type:'executePlan',visitId:vid,planId:v().plan.id});
 await get(o,'/api/workspace',200,org);const sub=o.state.submissions.find(y=>y.visitId===vid);
 check(()=>{assert.equal(sub.state,'cancelled');assert.equal(sub.attempts,0);assert.equal(sub.receipt,undefined);assert.deepEqual([sub.refusal.operation,sub.refusal.settingVersion,sub.refusal.stage],['create',3,'before-send']);assert.match(sub.message,/^Not sent: Community health MIS is not permitted to create records/);});
 // The trace shows the refused step, linked to the command and its audit event.
 const r=await fetch(`${base}/api/trace?submission=${sub.id}`,{headers:{...o.headers,'x-saha-organisation':org}}),t=await r.json();
 check(()=>{assert.equal(r.status,200);const th=t.threads.find(x=>x.id==='submission:'+sub.id);assert.deepEqual([th.refusal.operation,th.refusal.stage],['create','before-send']);const step=th.steps.at(-1);assert.equal(step.state,'cancelled');assert.equal(step.command,'executePlan');assert.equal(step.linked,true);assert.ok(step.auditId);});
 // The exception queue raises it for operations members.
 const q=await get(o,'/api/exceptions',200,org);const row=(q.items??[]).find(x=>x.id==='operation-refused:submission:'+sub.id);
 check(()=>{assert.equal(q.rulesVersion,'1.3.0');assert.ok(q.counts['operation-refused']>=1);if(!row)assert.equal(q.truncated,true,'row missing from an untruncated queue');});
 if(row)check(()=>{assert.ok(row,'refused delivery in the exception queue');assert.equal(row.kind,'operation-refused');assert.deepEqual(row.trace,{query:'submission',id:sub.id});assert.match(row.what,/not sent, create not permitted \(setting version 3\)/);});
 // Aggregate-only: a destination that may receive aggregate reports only never gets a patient-level record.
 await set('mis_community',['lookup','aggregate'],true);
 const gid=(await send(o,{type:'createPerson',name:`Aggregate synthetic ${crypto.randomUUID().slice(0,6)}`,age:51,sex:'Male',village:'Operations synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const gv=(await send(o,{type:'startVisit',personId:gid})).result.visitId,gvv=()=>o.state.visits.find(y=>y.id===gv),gp=()=>o.state.people.find(p=>p.id===gid);
 await send(o,{type:'saveVisit',visitId:gv,version:gvv().version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'70',temperature:'',weeks:'',coughDays:'',notes:'Synthetic aggregate check',source:'measured'}});
 await get(o,'/api/workspace',200,org);await send(o,{type:'confirmVisit',visitId:gv,version:gvv().version});await send(o,{type:'setConsent',personId:gid,version:gp().version,purpose:'exchange',active:true});
 const agg=await send(o,{type:'preparePlan',visitId:gv,recipients:['mis_community']},409);
 check(()=>assert.match(agg.error??JSON.stringify(agg),/aggregate-only destination: it may receive aggregate reports only, never a patient-level record/));
 check(()=>{assert.equal(integration('mis_community').operations.aggregateOnly,true);});
 // Restore the release defaults for the shared synthetic organisation.
 await set('mis_community',['create','update','lookup']);
 check(()=>{const i=integration('mis_community');assert.deepEqual(i.operations.allowed,['create','update','lookup']);assert.equal(i.operations.aggregateOnly,false);assert.equal(i.operations.version,5);assert.deepEqual(i.operations.history.map(h=>h.version),[1,2,3,4]);});
}
