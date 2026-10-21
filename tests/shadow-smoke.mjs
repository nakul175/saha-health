import assert from 'node:assert/strict';
// Slice 5f: shadow operation of a reviewed capability revision, over HTTP and local D1.
export async function shadowSmoke({get,post,check,accounts,org}){
 // The clinician account creates this organisation (the owner account already owns the most organisations one account
 // may own) and the owner account joins it as the independent clinical reviewer and clinician governance manager.
 const {clinician:o,owner:c}=accounts,main=org;
 org=(await post(o,{type:'createOrganisation',name:'Shadow operation organisation'})).result.organisationId;
 const inv=(await post(o,{type:'createInvite',accountCode:c.state.user.accountCode,label:'Shadow reviewer',role:'clinician',teamIds:['default']},200,undefined,org)).result;await post(c,{type:'joinOrganisation',token:inv.token});
 let g=await get(o,'/api/governance',200,org);const local=g.providers.find(p=>p.id==='local'),today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10),until=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const spec={kind:'capability',key:'shadow-capability',title:'Synthetic shadow capability',ownerId:o.id,teamIds:['default'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic shadow revision.',providerId:'local',model:local.model,agentVersion:g.agentVersion,purpose:'documentary-evidence',ageMin:18,ageMax:90,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community','facility'],devices:['browser'],tasks:['extract'],inputQuality:'validated-text',excludedUses:'No diagnosis or autonomous clinical action.',supportContact:'Synthetic owner',hostingRegion:'Local workspace',retentionTerms:'Synthetic test input only, no real data.',trainingUse:'not-authorised',agreementReference:'SYNTH-SHADOW',dailyCallLimit:30,dailyTokenBudget:180000};
 const read=async(who=o)=>{g=await get(who,'/api/governance',200,org);return g;},entry=id=>g.entries.find(e=>e.id===id);
 const id=(await post(o,{type:'createGovernance',spec},200,undefined,org)).result.entryId;
 await read();const prepared=(await post(o,{type:'prepareEvaluation',entryId:id,version:entry(id).version},200,undefined,org)).result;for(const caseId of prepared.caseIds)await post(o,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId},200,undefined,org);
 await read();await post(c,{type:'reviewGovernance',entryId:id,version:entry(id).version,reference:'SYNTH-REVIEW',findings:'Independent synthetic review before shadow.',evaluationId:prepared.evaluationId},200,undefined,org);
 await read();check(()=>{assert.equal(entry(id).state,'reviewed');assert.equal(g.canShadow,true);assert.deepEqual(g.shadows,[]);assert.deepEqual(g.drift.rows,[])});
 // A clinician manager cannot shadow the whole organisation; the owner can.
 const start={type:'startShadow',entryId:id,version:entry(id).version,scope:'organisation',until,reason:'Compare the reviewed revision with confirmed visits.'};
 await post(c,start,403,undefined,org);
 const shadowId=(await post(o,start,200,undefined,org)).result.shadowId;
 // A confirmed visit with a note; the shadow output is compared but never reaches the visit.
 const personId=(await post(o,{type:'createPerson',name:`Shadow Synthetic ${crypto.randomUUID().slice(0,6)}`,age:40,sex:'Female',village:'Shadow locality',programme:'General care',teamId:'default'},200,undefined,org)).result.personId;
 const p=()=>o.state.people.find(x=>x.id===personId);await post(o,{type:'setConsent',personId,version:p().version,purpose:'ai',active:true},200,undefined,org);
 const visitId=(await post(o,{type:'startVisit',personId},200,undefined,org)).result.visitId,v=()=>o.state.visits.find(x=>x.id===visitId);
 await post(o,{type:'saveVisit',visitId,version:v().version,facts:{...v().facts,weight:'58',temperature:'37.2',notes:'Weight 58 kg; temperature 37.5 C'}},200,undefined,org);
 await post(o,{type:'confirmVisit',visitId,version:v().version},200,undefined,org);
 const before=JSON.stringify(v());
 await read();check(()=>assert.equal(g.shadows[0].pending,1));
 await post(c,{type:'runShadow',shadowId,version:g.shadows[0].version},200,undefined,org);
 await post(o,{type:'runShadow',shadowId,version:g.shadows[0].version},409,undefined,org);
 await read();
 check(()=>{const x=g.shadows[0];assert.equal(x.state,'active');assert.deepEqual(x.visits,{total:1,compared:1,unable:0,notRun:{},recomputed:0,excluded:0});assert.deepEqual(x.fields.map(f=>[f.field,f.agreement,f.disagreement]),[['weight',1,0],['temperature',0,1]]);assert.equal(x.pending,0)});
 check(()=>{const text=JSON.stringify(g.shadows);assert.ok(!text.includes(visitId)&&!text.includes(personId)&&!text.includes('Weight 58'),'counts only')});
 // Slice 5i: drift rows for the shadowed revision, counts only; one visit is too few rated fields to compare periods.
 check(()=>{const d=g.drift.rows.find(r=>r.entryId===g.shadows[0].entryId),last=d.periods.at(-1),text=JSON.stringify(g.drift);assert.equal(d.status,'insufficient');assert.deepEqual([last.visits,last.rated,last.agreement,last.disagreement,last.rate],[1,2,1,1,50]);assert.ok(!text.includes(visitId)&&!text.includes(personId)&&!text.includes('Weight 58'));assert.match(g.drift.notice,/Nothing is suspended automatically/)});
 await get(o,'/api/workspace',200,org);check(()=>{assert.equal(JSON.stringify(v()),before,'the visit and its assistant requests are unchanged');assert.equal(o.state.governance,undefined,'the workspace snapshot carries no governance or shadow data')});
 // Stopping ends it.
 await read();await post(o,{type:'stopShadow',shadowId,version:g.shadows[0].version,reason:'Synthetic shadow comparison complete.'},200,undefined,org);
 await read();check(()=>assert.equal(g.shadows[0].state,'stopped'));
 const events=await get(o,'/api/audit',200,org);check(()=>assert.ok(events.events.some(e=>e.action==='runShadow'&&/1 compared.*Nothing was shown to field workers or applied/.test(e.detail))));
 await post(o,{type:'switchOrganisation',organisationId:main});await post(c,{type:'switchOrganisation',organisationId:main});

}
