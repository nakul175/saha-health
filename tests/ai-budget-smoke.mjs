import assert from 'node:assert/strict';
// Slice 5a: monthly cost budgets per AI capability and stopping a teammate's unsent request, over HTTP and local D1.
export async function aiBudgetSmoke({get,post,check,accounts,org}){
 const {owner:o,supervisor:sv}=accounts,month=new Date().toISOString().slice(0,7);
 // Budget use is shown to operators only.
 const sup=await get(sv,'/api/operations',200,org);check(()=>assert.equal(sup.budgets,null));
 const main=await get(o,'/api/operations',200,org);check(()=>{assert.match(main.budgets.notice,/not an invoice/);assert.ok(Array.isArray(main.budgets.rows));assert.equal(main.budgets.month,month)});
 // A fresh organisation with a supervisor and one (draft) external capability.
 const mine=(await post(o,{type:'createOrganisation',name:'AI budget organisation'})).result.organisationId;
 await get(sv,'/api/workspace');const inv=(await post(o,{type:'createInvite',accountCode:sv.state.user.accountCode,label:'Budget supervisor',role:'supervisor',teamIds:['default']},200,undefined,mine)).result;await post(sv,{type:'joinOrganisation',token:inv.token});
 const g=await get(o,'/api/governance',200,mine),openai=g.providers.find(p=>p.id==='openai'),today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const spec={kind:'capability',key:'budget-capability',title:'Synthetic budgeted capability',ownerId:o.id,teamIds:['default'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic budget exercise only.',providerId:'openai',model:openai.model,agentVersion:g.agentVersion,purpose:'documentary-evidence',ageMin:18,ageMax:80,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],inputQuality:'validated-text',excludedUses:'No diagnosis, prescribing or autonomous clinical action.',supportContact:'SYNTHETIC-OWNER',hostingRegion:'Not activated',retentionTerms:'Synthetic workspace evidence retained for this test only.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-NO-EXTERNAL-DATA',dailyCallLimit:10,dailyTokenBudget:60000};
 await post(o,{type:'createGovernance',spec},200,undefined,mine);
 let view=await get(o,'/api/operations',200,mine);const row=()=>view.budgets.rows.find(r=>r.capabilityKey==='budget-capability');
 check(()=>{assert.equal(row().state,'no-budget');assert.equal(row().monthlyUsd,null);assert.equal(row().providerId,'openai')});
 const version=()=>view.operations.version,set=(extra={})=>({type:'opsBudget',version:version(),capabilityKey:'budget-capability',monthlyUsd:25,reason:'Synthetic contract cap',...extra});
 await post(sv,set(),403,undefined,mine);
 await post(o,set({capabilityKey:'missing-capability'}),404,undefined,mine);
 await post(o,set({monthlyUsd:0}),422,undefined,mine);
 await post(o,set({reason:'x'}),422,undefined,mine);
 const key=crypto.randomUUID(),body=set();await post(o,body,200,key,mine);const replay=await post(o,body,200,key,mine);check(()=>assert.equal(replay.replayed,true));
 view=await get(o,'/api/operations',200,mine);
 check(()=>{assert.equal(row().monthlyUsd,25);assert.equal(row().setBy,o.id);assert.equal(row().state,'no-rates','a budget without cost rates refuses requests')});
 await post(o,{type:'opsRates',version:version(),input:100,output:200},200,undefined,mine);
 view=await get(o,'/api/operations',200,mine);
 check(()=>{assert.equal(row().state,'within');assert.equal(row().spentUsd,0);assert.equal(row().reservedUsd,0);assert.equal(row().remainingUsd,25)});
 await post(o,set({monthlyUsd:null,reason:'Budget withdrawn'}),200,undefined,mine);
 view=await get(o,'/api/operations',200,mine);check(()=>assert.equal(row().state,'no-budget'));
 await post(o,set({monthlyUsd:null,reason:'Budget withdrawn again'}),409,undefined,mine);

 // A supervisor caring for the patient stops the owner's request before it is sent; a sent one is not recalled.
 const pid=(await post(o,{type:'createPerson',name:`Budget Synthetic ${crypto.randomUUID().slice(0,6)}`,age:41,sex:'Female',village:'Budget locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid},200,undefined,mine)).result.visitId,v=()=>o.state.visits.find(x=>x.id===vid),p=()=>o.state.people.find(x=>x.id===pid);
 await post(o,{type:'setConsent',personId:pid,version:p().version,purpose:'ai',active:true},200,undefined,mine);
 const prepare=()=>({type:'prepareAgent',visitId:vid,version:v().version,providerId:'local',task:'extract',input:'Weight 58 kg'});
 const first=(await post(o,prepare(),200,undefined,mine)).result.runId;
 await post(sv,{type:'cancelAgent',visitId:vid,runId:first},200,undefined,mine);await get(o,'/api/workspace',200,mine);
 check(()=>{const r=v().agentRuns.find(x=>x.id===first);assert.equal(r.status,'cancelled');assert.equal(r.callCount,0);assert.match(r.message,/before it was sent/)});
 await post(sv,{type:'cancelAgent',visitId:vid,runId:first},409,undefined,mine);
 const second=(await post(o,prepare(),200,undefined,mine)).result.runId;
 await post(o,{type:'executeAgent',visitId:vid,runId:second,inputHash:v().agentRuns.find(x=>x.id===second).inputHash},200,undefined,mine);
 await post(sv,{type:'cancelAgent',visitId:vid,runId:second},409,undefined,mine);
 await post(o,{type:'cancelAgent',visitId:vid,runId:second},200,undefined,mine);check(()=>assert.equal(v().agentRuns.find(x=>x.id===second).status,'cancelled'));
 // Slice 5e: only a sent request past its time limit takes the timed-out decision; this one is closed.
 await post(sv,{type:'closeTimedOutAgent',visitId:vid,runId:second,reason:'Checking an uncertain synthetic request.'},409,undefined,mine);
 await post(sv,{type:'switchOrganisation',organisationId:org});await post(o,{type:'switchOrganisation',organisationId:org});
}
