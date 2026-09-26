import assert from 'node:assert/strict';
export async function programmeSmoke({o,w,s,a,post,get,check,org}){
 const created=await post(o,{type:'createPerson',name:'Programme test person',age:31,sex:'Female',village:'Synthetic village',programme:'General care',teamId:'default'});const personId=created.result.personId;
 const p=()=>o.state.people.find(p=>p.id===personId);
 const enrol=packId=>({type:'enrolProgramme',personId,version:p().version,packId,episodeLabel:'Synthetic confirmed episode',startDate:null});
 await post(a,enrol('maternal'),403);await post(s,enrol('maternal'),403);await post(w,enrol('maternal'),403);
 const before=p().version;const maternal=(await post(o,enrol('maternal'))).result.enrolmentId;await post(o,{...enrol('tb'),version:before},409);await post(o,enrol('maternal'),409);await post(o,{...enrol('tb'),startDate:'2026-02-30'},422);const tb=(await post(o,enrol('tb'))).result.enrolmentId;await post(o,enrol('hypertension'));
 check(()=>{assert.equal(p().enrolments.length,3);assert.equal(p().enrolments[0].registration,'not_submitted');assert.equal(p().enrolments[0].startDate,null)});
 const visitId=(await post(o,{type:'startVisit',personId})).result.visitId;const v=()=>o.state.visits.find(v=>v.id===visitId);
 check(()=>{assert.equal(v().programmeCapture.packs.length,3);assert.ok(v().programmeCapture.packs.every(x=>x.pack.version===1));assert.equal(v().facts.weight,'')});
 await post(o,{type:'closeEnrolment',personId,version:p().version,enrolmentId:maternal,outcome:'Synthetic closed episode'},409);
 await post(o,{type:'saveVisit',visitId,version:v().version,facts:{...v().facts,notes:'Synthetic multi-programme review',weight:'58',systolic:'110',diastolic:'70'}});
 await post(o,{type:'confirmVisit',visitId,version:v().version},422);
 const answer=()=>({type:'saveProgrammeAnswers',visitId,version:v().version,answers:{maternal_contact:'Yes',cough:'No',testing:'No',medication_access:'Available'},absence:{weeks:'Unknown'}});
 await post(o,{...answer(),answers:{...answer().answers,cough:'invalid'}},422);await post(o,{...answer(),absence:{weight:'Unknown'}},422);await post(o,{...answer(),absence:{coughDays:'Unknown'}},422);
 await post(o,answer());const old=v().version;await post(o,{...answer(),version:old-1},409);
 await post(o,{type:'confirmVisit',visitId,version:v().version});await post(o,answer(),409);
 check(()=>{assert.equal(v().programmeCapture.answers.cough,'No');assert.equal(v().programmeCapture.absence.weeks,'Unknown');assert.equal(v().programmeCapture.savedBy,o.id)});
 const task=()=>({type:'scheduleFollowUp',personId,version:p().version,enrolmentId:maternal,title:'Confirm appointment',due:'2026-09-25',ownerId:o.id});
 await post(o,{...task(),ownerId:a.id},422);const taskId=(await post(o,task())).result.taskId;await post(o,task(),409);
 const independent=(await post(o,{...task(),enrolmentId:tb,title:'Discuss testing arrangements'})).result.taskId;
 await post(o,{type:'closeEnrolment',personId,version:p().version,enrolmentId:maternal,outcome:'Synthetic pregnancy outcome recorded'});
 check(()=>{assert.equal(p().followUps.find(t=>t.id===taskId).state,'cancelled');assert.equal(p().followUps.find(t=>t.id===independent).state,'open');assert.equal(v().programmeCapture.packs.length,3)});
 await post(o,task(),409);await post(o,{type:'resolveFollowUp',personId,version:p().version,taskId:independent,state:'completed',resolution:'Discussed with care worker'});await post(o,{type:'resolveFollowUp',personId,version:p().version,taskId:independent,state:'completed',resolution:'Second completion rejected'},409);
 const next=(await post(o,{type:'startVisit',personId})).result.visitId;check(()=>{const n=o.state.visits.find(v=>v.id===next);assert.equal(n.programmeCapture.packs.length,2);assert.equal(n.facts.weight,'');assert.equal(n.programmeCapture.answers.cough,undefined)});
 await get(a,'/api/workspace',200,org);check(()=>assert.equal(a.state.people.length,0));const history=await get(o,'/api/history?personId='+personId,200,org);check(()=>assert.ok(history.revisions.some(r=>r.data.followUps?.some(t=>t.state==='cancelled'))));
}
