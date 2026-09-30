import assert from 'node:assert/strict';
// Slice 5c: unable-to-assess outcomes and conflicting assistant values, over HTTP and local D1 with the local rules provider.
export async function agentQualitySmoke({get,post,check,accounts,org,base}){
 const {owner:o,clinician:c}=accounts,main=org;
 // A fresh organisation: the shared one registers a capability for the local provider in the governance suite.
 org=(await post(o,{type:'createOrganisation',name:'Assistant quality organisation'})).result.organisationId;
 const inv=(await post(o,{type:'createInvite',accountCode:c.state.user.accountCode,label:'Quality clinician',role:'clinician',teamIds:['default']},200,undefined,org)).result;await post(c,{type:'joinOrganisation',token:inv.token});
 const personId=(await post(o,{type:'createPerson',name:`Quality Synthetic ${crypto.randomUUID().slice(0,6)}`,age:36,sex:'Female',village:'Quality locality',programme:'General care',teamId:'default'},200,undefined,org)).result.personId;
 const p=()=>o.state.people.find(x=>x.id===personId);await post(o,{type:'setConsent',personId,version:p().version,purpose:'ai',active:true},200,undefined,org);
 const visitId=(await post(o,{type:'startVisit',personId},200,undefined,org)).result.visitId,v=()=>o.state.visits.find(x=>x.id===visitId),run=id=>v().agentRuns.find(x=>x.id===id);
 const ask=async input=>{const id=(await post(o,{type:'prepareAgent',visitId,version:v().version,providerId:'local',task:'extract',input},200,undefined,org)).result.runId;await post(o,{type:'executeAgent',visitId,runId:id,inputHash:run(id).inputHash},200,undefined,org);return id;};
 const date=new Date(Date.now()-60000).toISOString().slice(0,16),apply=(id,extra={},status=200)=>post(o,{type:'applyAgent',visitId,runId:id,version:v().version,fields:['weight'],source:'measured',date,...extra},status,undefined,org);
 // Unable to assess: noisy, unsupported and insufficient input each produce an explicit outcome and no value.
 for(const [input,reason] of [['weight 58 kg; BP 120/? mmHg','noisy_input'],['Weight 130 pounds','unsupported_case'],['Comfortable today, no complaints','insufficient_input']]){
  const id=await ask(input);
  check(()=>{const r=run(id);assert.equal(r.status,'review');assert.equal(r.assessment.status,'unable_to_assess');assert.equal(r.assessment.reason,reason);assert.deepEqual(r.output.proposals,[]);assert.match(r.message,/^Unable to assess: .*not a normal or negative result/);assert.equal(r.conflicts,undefined)});
  await apply(id,{},409);
 }
 check(()=>assert.equal(v().facts.weight,'','nothing was applied from an unassessed result'));
 // A recorded weight, then two open results that disagree with it and with each other.
 await post(o,{type:'saveVisit',visitId,version:v().version,facts:{...v().facts,weight:'60',date}},200,undefined,org);
 const a=await ask('Weight 58 kg'),b=await ask('Weight 64 kg');
 check(()=>{assert.deepEqual(run(a).conflicts.map(x=>[x.kind,x.proposed,x.other]),[['recorded','58','60'],['other-run','58','64']]);assert.deepEqual(run(b).conflicts.map(x=>[x.kind,x.proposed,x.other]),[['recorded','64','60'],['other-run','64','58']]);assert.match(run(b).warnings.join(' '),/Conflicting values: .*explicit choice and a reason/)});
 const plan=async()=>{const r=await fetch(`${base}/api/action-plan?${new URLSearchParams({personId})}`,{headers:{...o.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j).slice(0,300)));return j.items.filter(i=>i.kind==='ai-disagreement');};
 let tasks=await plan();
 check(()=>{assert.equal(tasks.length,1);assert.deepEqual(tasks[0].sources.map(x=>x.id).sort(),[a,b].sort());assert.match(tasks[0].reason,/weight: 58 \(Local record assistant\) vs 64 \(Local record assistant\)/);assert.doesNotMatch(tasks[0].reason,/\b61\b/);assert.equal(tasks[0].owner.userId,o.id)});
 // Nothing is applied without an explicit choice and a reason; another worker cannot apply.
 await apply(a,{},409);await apply(a,{resolve:['weight']},422);await apply(a,{resolve:['temperature']},422);
 await post(c,{type:'applyAgent',visitId,runId:a,version:v().version,fields:['weight'],source:'measured',date,resolve:['weight'],conflictReason:'Another clinician choosing.'},403,undefined,org);
 await get(o,'/api/workspace',200,org);check(()=>{assert.equal(v().facts.weight,'60');assert.equal(run(a).status,'review')});
 await apply(a,{resolve:['weight'],conflictReason:'Re-weighed on the calibrated scale: 58 kg.'});
 check(()=>{assert.equal(v().facts.weight,'58');assert.equal(run(a).status,'applied');assert.deepEqual(run(a).resolutions[0].replaced,['recorded 60','Local record assistant 64']);assert.equal(run(b).output.proposals[0].value,'64','the other original output is kept')});
 await apply(b,{resolve:['weight'],conflictReason:'Applying the stale competing value.'},409);
 tasks=await plan();check(()=>assert.equal(tasks.length,0));
 const history=await get(o,`/api/history?personId=${personId}`,200,org);check(()=>assert.ok(history.revisions.some(r=>r.action==='applyAgent'&&r.changes.some(x=>x.field==='facts.weight'&&x.before==='60'&&x.after==='58')),'the replaced recorded value stays in the revision history'));
 await post(o,{type:'switchOrganisation',organisationId:main});await post(c,{type:'switchOrganisation',organisationId:main});
}
