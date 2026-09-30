export async function misSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,admin:a}=accounts;
 await get(o,'/api/workspace',200,org);
 const before=new Set(o.state.integrations.map(i=>i.id));
 await post(o,{type:'registerIntegration',name:'Synthetic programme API',kind:'mis',endpoint:'https://programme.example/v1/visits',credentialBinding:'SAHA_MIS_TEST',description:'Contract fixture; no live destination'});
 let i=o.state.integrations.find(i=>!before.has(i.id));const mapping=[{source:'personId',target:'person_ref',required:true},{source:'weight',target:'weight_kg',required:true},{source:'notes',target:'notes',required:false}];
 const config={type:'configureMis',integrationId:i.id,version:i.version,programmes:['General care'],mapping,corrections:true};
 await post(w,config,403,crypto.randomUUID(),org);await post(a,config,403,crypto.randomUUID(),org);
 await post(o,{...config,mapping:[{source:'notes',target:'constructor',required:false}]},422);
 const replayKey=crypto.randomUUID();await post(o,config,200,replayKey);await post(o,config,200,replayKey);i=o.state.integrations.find(x=>x.id===i.id);
 check(()=>{if(i.version!==2||i.status!=='suspended'||i.mis.mapping.length!==3)throw Error('Mapping not persisted');});
 await post(o,config,409);await post(o,{type:'activateMis',integrationId:i.id,version:i.version},409);await post(o,{type:'toggleIntegration',integrationId:i.id,version:i.version},409);await post(o,{type:'testMis',integrationId:i.id,version:i.version},409);
 // Simulate a previously onboarded profile in local D1 only. Transport stays disabled.
 i.status='active';i.mis.test={at:new Date().toISOString(),version:i.version,ok:true,message:'Fixture only'};sql.prepare('UPDATE integrations SET status=?,data=? WHERE org_id=? AND id=?').run(i.status,JSON.stringify(i),org,i.id);
 await post(o,{type:'createPerson',name:'MIS synthetic person',age:31,sex:'Unknown',village:'Test village',programme:'General care',teamId:'default'});let p=o.state.people.at(-1);p=o.state.people.find(x=>x.name==='MIS synthetic person');
 let r=await post(o,{type:'startVisit',personId:p.id});const visitId=r.result.visitId;let v=o.state.visits.find(x=>x.id===visitId);
 await post(o,{type:'saveVisit',visitId,version:v.version,facts:{date:new Date().toISOString().slice(0,16),weight:'55',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic programme integration test',source:'measured'}});v=o.state.visits.find(x=>x.id===visitId);await post(o,{type:'confirmVisit',visitId,version:v.version});
 await post(o,{type:'preparePlan',visitId,recipients:[i.id]},409);
 p=o.state.people.find(x=>x.id===p.id);await post(o,{type:'setConsent',personId:p.id,purpose:'exchange',active:true,version:p.version});
 await post(o,{type:'preparePlan',visitId,recipients:[i.id]});v=o.state.visits.find(x=>x.id===visitId);check(()=>{if(v.plan.payloads[i.id].fields.weight_kg!=='55'||v.plan.payloads[i.id].fields.name)throw Error('Mapped payload incorrect');});
 await post(o,{type:'approvePlan',visitId,planId:v.plan.id,payloadHash:v.plan.payloadHash});const key=crypto.randomUUID();await post(o,{type:'executePlan',visitId,planId:v.plan.id},200,key);await post(o,{type:'executePlan',visitId,planId:v.plan.id},200,key);
 await get(o,'/api/workspace',200,org);let sub=o.state.submissions.find(x=>x.visitId===visitId);check(()=>{if(sub.state!=='queued'||sub.attempts!==0||o.state.submissions.filter(x=>x.visitId===visitId).length!==1)throw Error('Durable queue duplicate');});
 await post(o,{type:'preparePlan',visitId,recipients:[i.id]},409);await post(w,{type:'sendSubmission',submissionId:sub.id},403,crypto.randomUUID(),org);await post(o,{type:'sendSubmission',submissionId:sub.id},409);await post(o,{type:'lookupSubmission',submissionId:sub.id},409);
 p=o.state.people.find(x=>x.id===p.id);await post(o,{type:'setConsent',personId:p.id,purpose:'exchange',active:false,version:p.version});
 // Slice 6o: withdrawing sharing permission cancels the unsent delivery itself; a send attempt reports it and sends nothing.
 const held=await post(o,{type:'sendSubmission',submissionId:sub.id});check(()=>{if(held.result.state!=='cancelled')throw Error('Withdrawal must cancel the unsent delivery');});await post(o,{type:'cancelSubmission',submissionId:sub.id},409);await get(o,'/api/workspace',200,org);sub=o.state.submissions.find(x=>x.id===sub.id);check(()=>{if(sub.state!=='cancelled'||sub.attempts!==0)throw Error('Cancelled queue state');});
 await post(o,{type:'cancelSubmission',submissionId:sub.id},409);
}
