import assert from 'node:assert/strict';
// Slice 5d: capability lifecycle stages, replacement, use by version and in-progress work, over HTTP and local D1.
export async function capabilityLifecycleSmoke({get,post,check,accounts,org}){
 const {owner:o,clinician:c}=accounts,main=org;
 org=(await post(o,{type:'createOrganisation',name:'Capability lifecycle organisation'})).result.organisationId;
 const inv=(await post(o,{type:'createInvite',accountCode:c.state.user.accountCode,label:'Lifecycle reviewer',role:'clinician',teamIds:['default']},200,undefined,org)).result;await post(c,{type:'joinOrganisation',token:inv.token});
 let g=await get(o,'/api/governance',200,org);const local=g.providers.find(p=>p.id==='local'),today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const spec=(extra={})=>({kind:'capability',key:'lifecycle-capability',title:'Synthetic lifecycle capability',ownerId:o.id,teamIds:['default'],effectiveFrom:today,reviewBy:later,changeSummary:'First synthetic lifecycle revision.',providerId:'local',model:local.model,agentVersion:g.agentVersion,purpose:'documentary-evidence',ageMin:18,ageMax:80,roles:['asha','clinician'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],excludedUses:'No diagnosis, prescribing or autonomous clinical action.',supportContact:'SYNTHETIC-OWNER',hostingRegion:'Local workspace',retentionTerms:'Synthetic workspace evidence retained for this test only.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-LOCAL',dailyCallLimit:20,dailyTokenBudget:60000,...extra});
 const read=async()=>{g=await get(o,'/api/governance',200,org);return g;},entry=id=>g.entries.find(e=>e.id===id);
 const evaluate=async id=>{await read();const prepared=(await post(o,{type:'prepareEvaluation',entryId:id,version:entry(id).version},200,undefined,org)).result;for(const caseId of prepared.caseIds)await post(o,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId},200,undefined,org);return prepared.evaluationId;};
 const review=async(id,evaluationId)=>{await read();await post(c,{type:'reviewGovernance',entryId:id,version:entry(id).version,reference:'SYNTH-REVIEW',findings:'Independent synthetic lifecycle review.',evaluationId},200,undefined,org);};
 const activate=async(id,who=o,status=200)=>{await read();return post(who,{type:'transitionGovernance',entryId:id,version:entry(id).version,state:'active',reason:'Owner activation after independent review.'},status,undefined,org);};
 // Registered -> technically verified -> approved for its scope -> active; only an owner activates.
 const first=(await post(o,{type:'createGovernance',spec:spec()},200,undefined,org)).result.entryId;
 await read();check(()=>{assert.equal(entry(first).lifecycle.stage,'registered');assert.equal(entry(first).usage.total,0)});
 const firstEval=await evaluate(first);await read();check(()=>assert.equal(entry(first).lifecycle.stage,'technically-verified'));
 await review(first,firstEval);await read();check(()=>assert.equal(entry(first).lifecycle.stage,'approved-for-scope'));
 await activate(first,c,403);await activate(first);await read();check(()=>{assert.equal(entry(first).lifecycle.stage,'active');assert.equal(entry(first).usable,true)});
 // Two assistant requests under the first revision: one sent and awaiting review, one unsent.
 const personId=(await post(o,{type:'createPerson',name:`Lifecycle Synthetic ${crypto.randomUUID().slice(0,6)}`,age:40,sex:'Female',village:'Lifecycle locality',programme:'General care',teamId:'default'},200,undefined,org)).result.personId;
 const p=()=>o.state.people.find(x=>x.id===personId);await post(o,{type:'setConsent',personId,version:p().version,purpose:'ai',active:true},200,undefined,org);
 const visitId=(await post(o,{type:'startVisit',personId},200,undefined,org)).result.visitId,v=()=>o.state.visits.find(x=>x.id===visitId),run=id=>v().agentRuns.find(x=>x.id===id);
 const prepare=(status=200)=>post(o,{type:'prepareAgent',visitId,version:v().version,providerId:'local',task:'extract',input:'Weight 58 kg',context:{language:'en',setting:'community',device:'browser'}},status,undefined,org);
 const sent=(await prepare()).result.runId;await post(o,{type:'executeAgent',visitId,runId:sent,inputHash:run(sent).inputHash},200,undefined,org);const unsent=(await prepare()).result.runId;
 await read();check(()=>{assert.equal(run(sent).governance.id,first);assert.equal(entry(first).usage.total,2);assert.deepEqual(entry(first).usage.byStatus,{review:1,pending:1});assert.equal(entry(first).impact,undefined,'no impact while usable')});
 // A second revision replaces the first when it is activated; the first revision's work is identified.
 const second=(await post(o,{type:'createGovernance',spec:spec({changeSummary:'Second synthetic lifecycle revision.'}),replacesId:first},200,undefined,org)).result.entryId;
 await review(second,await evaluate(second));await activate(second);await read();
 check(()=>{const e=entry(first);assert.equal(e.state,'retired');assert.equal(e.replacedBy,second);assert.equal(e.replacedByRevision,2);assert.equal(e.lifecycle.stage,'replaced');assert.deepEqual(e.impact,{cancel:1,'await-outcome':0,review:1,'check-applied':0})});
 check(()=>{const rows=g.affected.filter(a=>a.entryId===first&&a.kind==='agent');assert.deepEqual(rows.map(a=>[a.runId,a.action]).sort(),[[sent,'review'],[unsent,'cancel']].sort())});
 await post(o,{type:'executeAgent',visitId,runId:unsent,inputHash:run(unsent).inputHash},409,undefined,org);
 await post(o,{type:'applyAgent',visitId,runId:sent,version:v().version,fields:['weight'],source:'measured',date:new Date(Date.now()-60000).toISOString().slice(0,16)},409,undefined,org);
 await post(o,{type:'cancelAgent',visitId,runId:unsent},200,undefined,org);await read();check(()=>assert.equal(entry(first).impact.cancel,0));
 // Suspending the active revision blocks new requests and reports its in-progress work.
 const onSecond=(await prepare()).result.runId;await read();check(()=>assert.equal(run(onSecond).governance.id,second));
 const suspended=await post(o,{type:'transitionGovernance',entryId:second,version:entry(second).version,state:'suspended',reason:'Synthetic suspension for the lifecycle smoke.'},200,undefined,org);
 check(()=>assert.deepEqual(suspended.result.impact,{cancel:1,'await-outcome':0,review:0,'check-applied':0}));
 await prepare(409);await post(o,{type:'executeAgent',visitId,runId:onSecond,inputHash:run(onSecond).inputHash},409,undefined,org);
 await read();check(()=>{assert.equal(entry(second).lifecycle.stage,'suspended');assert.equal(entry(second).impact.cancel,1);assert.equal(g.affected.find(a=>a.runId===onSecond).action,'cancel')});
 const events=await get(o,'/api/audit',200,org);check(()=>assert.ok(events.events.some(e=>e.action==='transitionGovernance'&&/In-progress work: 1 unsent request to cancel\./.test(e.detail))));
 // Slice 5g: provider and model history per capability key, for governance managers.
 check(()=>{const h=g.capabilityHistory.find(x=>x.key==='lifecycle-capability');assert.equal(h.providers,1);assert.deepEqual(h.revisions.map(r=>[r.revision,r.providerId,r.stage,r.requests,r.changes.length]),[[1,'local','replaced',2,0],[2,'local','suspended',1,0]]);assert.ok(h.revisions[0].activatedAt&&h.revisions[0].endedAt&&h.revisions[1].endedAt)});
 g=await get(c,'/api/governance',200,org);check(()=>assert.equal(g.capabilityHistory.find(x=>x.key==='lifecycle-capability').revisions.length,2,'a clinician governance manager in scope sees it'));
 await post(o,{type:'switchOrganisation',organisationId:main});await post(c,{type:'switchOrganisation',organisationId:main});
}
