import assert from 'node:assert/strict';
// Slice 6y: trace from user commands to execution checkpoints, receipts and audit events, through the built
// Worker and local D1: linked steps, viewer scope, redaction for operations members, and query validation.
export async function traceSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 const trace=async(who,query,status=200,organisation=org)=>{const r=await fetch(`${base}/api/trace?${query}`,{headers:{...who.headers,'x-saha-organisation':organisation}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const name=`Trace synthetic ${crypto.randomUUID().slice(0,6)}`,notes='Synthetic trace visit note that must not appear in a trace.',input='BP 118/76 mmHg; weight 61 kg';
 const pid=(await send(o,{type:'createPerson',name,age:44,sex:'Female',village:'Trace synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const me=()=>o.state.people.find(p=>p.id===pid);
 const vid=(await send(o,{type:'startVisit',personId:pid})).result.visitId,v=()=>o.state.visits.find(y=>y.id===vid);
 await send(o,{type:'saveVisit',visitId:vid,version:v().version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'61',temperature:'',weeks:'',coughDays:'',notes,source:'measured'}});
 await get(o,'/api/workspace',200,org);await send(o,{type:'confirmVisit',visitId:vid,version:v().version});
 // A demo programme destination that loses its response: the submission stays uncertain.
 await send(o,{type:'setConsent',personId:pid,version:me().version,purpose:'exchange',active:true});
 await send(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']});
 await send(o,{type:'approvePlan',visitId:vid,planId:v().plan.id,payloadHash:v().plan.payloadHash});
 const planKey=crypto.randomUUID();await send(o,{type:'executePlan',visitId:vid,planId:v().plan.id},200,planKey);
 await get(o,'/api/workspace',200,org);const sub=o.state.submissions.find(y=>y.visitId===vid);check(()=>assert.equal(sub.state,'uncertain'));
 // A FHIR document download of this visit is a material read (slice 6t) and appears among the visit's events.
 const fhir=await fetch(`${base}/api/fhir/${vid}?organisationId=${encodeURIComponent(org)}&format=document`,{headers:o.headers});check(()=>assert.equal(fhir.status,200));
 const t=await trace(o,`visit=${encodeURIComponent(vid)}`);
 const subThread=t.threads.find(y=>y.id==='submission:'+sub.id);
 check(()=>{assert.equal(t.scope,'full');assert.deepEqual(t.visit,{id:vid,personId:pid,state:'confirmed',version:v().version});assert.equal(t.traceVersion,'1.3.0'/* merged SAHA-117 destination trace ids + SAHA-129 authority/retrieval traces */);assert.equal(t.truncated,false);assert.ok(subThread,'submission thread');});
 check(()=>{const [step]=subThread.steps;assert.equal(subThread.steps.length,1);assert.equal(step.linked,true);assert.equal(step.command,'executePlan');assert.equal(step.source,'command');assert.equal(step.receiptId,planKey);assert.equal(step.receiptFound,true);assert.ok(step.receiptAt);assert.equal(step.state,'uncertain');assert.ok(Number.isInteger(step.auditSeq),'audit sequence of the linked event');assert.equal(subThread.receipt,null);assert.equal(subThread.attempts.used,1);});
 check(()=>{const acts=t.events.map(e=>e.action);for(const want of ['preparePlan','approvePlan','executePlan','downloadFhir'])assert.ok(acts.includes(want),want);assert.equal(t.events.find(e=>e.action==='downloadFhir').kind,'record-access');assert.deepEqual(t.events.find(e=>e.action==='executePlan').steps,['submission:'+sub.id]);assert.equal(t.notLinked,0);});
 check(()=>{const raw=JSON.stringify(t);for(const secret of [name,notes,'detail'])assert.equal(raw.includes(secret),false,secret);});
 // Reading a trace is not a material read: no audit event, no receipt, no revision change.
 const count=()=>sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(org).n,rev=()=>sql.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(org);
 const n0=count(),r0=rev();await trace(o,`submission=${encodeURIComponent(sub.id)}`);check(()=>{assert.equal(count(),n0);assert.deepEqual(rev(),r0);});
 // Scope: the visit's care scope sees all of it; others get 404 as for a missing record.
 for(const who of [w,c,s]){await get(who,'/api/workspace',200,org);const sees=who.state.people.some(p=>p.id===pid);const r=await trace(who,`visit=${encodeURIComponent(vid)}`,sees?200:404);if(sees)check(()=>assert.equal(r.scope,'full'));else check(()=>assert.equal(JSON.stringify(r).includes(sub.id),false));}
 // Administrators: the submission only, redacted; never the visit.
 await trace(a,`visit=${encodeURIComponent(vid)}`,404);
 const ra=await trace(a,`submission=${encodeURIComponent(sub.id)}`);
 check(()=>{assert.equal(ra.scope,'redacted');assert.equal(ra.visit,null);assert.deepEqual(ra.threads.map(y=>y.id),['submission:'+sub.id]);assert.ok(ra.events.every(e=>e.kind==='execution'&&e.subject===null));const raw=JSON.stringify(ra);for(const hidden of [pid,vid,name,'downloadFhir'])assert.equal(raw.includes(hidden),false,hidden);assert.equal(ra.threads[0].steps[0].command,'executePlan');});
 await trace(x,`visit=${encodeURIComponent(vid)}`,403);
 // Only one record identifier; no free text.
 await trace(o,'',422);await trace(o,`visit=${encodeURIComponent(vid)}&submission=${encodeURIComponent(sub.id)}`,422);await trace(o,`visit=${encodeURIComponent('free text')}`,422);await trace(o,`visit=${encodeURIComponent(vid)}&note=x`,422);await trace(o,'visit=missing-visit',404);
 // The exception queue row for the uncertain submission names its trace.
 const q=await get(o,'/api/exceptions',200,org);check(()=>assert.deepEqual(q.items.find(i=>i.id==='submission:'+sub.id)?.trace,{query:'submission',id:sub.id}));
 const qa=await get(a,'/api/exceptions',200,org);check(()=>assert.deepEqual(qa.items.find(i=>i.id==='submission:'+sub.id)?.trace,{query:'submission',id:sub.id}));
 // An assistant request (prepared, sent to the local provider, result), in a new organisation whose local
 // assistant needs no capability review (the shared organisation's capabilities are changed by the governance suite).
 // A separate synthetic account: the owner account already owns the most organisations one account may own.
 const z={id:`trace-ai-${crypto.randomUUID()}`,headers:null,state:null};z.headers={'oai-authenticated-user-id':z.id,'oai-authenticated-user-email':'trace-ai@example.invalid'};
 await get(z,'/api/workspace',200);const mine=z.state.organisation.id,team=z.state.teams[0].id;
 const aid=(await post(z,{type:'createPerson',name:`Trace AI ${name}`,age:39,sex:'Female',village:'Trace locality',programme:'General care',teamId:team},200,undefined,mine)).result.personId;
 const ap=()=>z.state.people.find(y=>y.id===aid),av=()=>z.state.visits.find(y=>y.personId===aid);
 await post(z,{type:'setConsent',personId:aid,purpose:'ai',active:true,version:ap().version},200,undefined,mine);
 await post(z,{type:'startVisit',personId:aid},200,undefined,mine);
 const prepareKey=crypto.randomUUID(),runId=(await post(z,{type:'prepareAgent',visitId:av().id,version:av().version,providerId:'local',task:'extract',input},200,prepareKey,mine)).result.runId;
 const executeKey=crypto.randomUUID();await post(z,{type:'executeAgent',visitId:av().id,runId,inputHash:av().agentRuns.find(r=>r.id===runId).inputHash},200,executeKey,mine);
 const ta=await trace(z,`visit=${encodeURIComponent(av().id)}`,200,mine),run=ta.threads.find(y=>y.id==='assistant:'+runId);
 check(()=>{assert.ok(run,'assistant thread');const cmds=run.steps.map(y=>[y.state,y.command,y.source]);assert.deepEqual(cmds,[['pending','prepareAgent','command'],['running','executeAgent','command'],['review','agentResult','destination']]);assert.equal(run.steps[0].receiptId,prepareKey);assert.equal(run.steps[1].receiptId,executeKey);assert.equal(run.steps[2].receiptId,'agent_finish_'+runId);assert.ok(run.steps.every(y=>y.linked&&y.receiptFound&&y.auditId&&Number.isInteger(y.auditSeq)));assert.equal(run.taskAttempt,1);assert.equal(run.attempts.used,1);assert.equal(run.timedOut,false);});
 check(()=>{assert.deepEqual(ta.events.find(e=>e.action==='agentResult').steps,['assistant:'+runId]);const raw=JSON.stringify(ta);for(const secret of [input,'61 kg',`Trace AI ${name}`])assert.equal(raw.includes(secret),false,secret);});
}
