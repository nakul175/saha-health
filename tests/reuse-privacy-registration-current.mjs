import assert from 'node:assert/strict';
import {coherentReportingFixture} from './lib/privacy-api-coherent-fixture.mjs';
// Slice 2a: reuse metering on a real two-pack visit through the built Worker and local D1.
export async function reuseSmoke({get,post,check,accounts,org,base}){
 const coherent=await coherentReportingFixture({get,post,check},'reuse',{defaultTeam:true});accounts=coherent.accounts;org=coherent.org;
 const {owner:o,supervisor:s}=accounts;
 // Slice 6w: indicator queries are POST only (a query records a differencing release).
 const read=async q=>{const r=await fetch(`${base}/api/indicators`,{method:'POST',headers:{...s.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(q)});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j).slice(0,300)));return j;};
 const ids='reuse-shared-answers,reuse-blocked,repeat-entry,corrections';
 const before=await read({ids,days:'30',group:'none'});
 const person=id=>o.state.people.find(p=>p.id===id);
 for(let coherentVisit=0;coherentVisit<5;coherentVisit++){
 const pid=(await post(o,{type:'createPerson',name:`Reuse Synthetic ${crypto.randomUUID().slice(0,6)}`,age:33,sex:'Female',village:'Reuse synthetic locality',programme:'Maternal care',teamId:'default'})).result.personId;
 for(const packId of ['maternal','hypertension'])await post(o,{type:'enrolProgramme',personId:pid,version:person(pid).version,packId,episodeLabel:`Synthetic ${packId} episode`,startDate:null});
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;
 await get(o,'/api/workspace',200,org);
 const v=()=>o.state.visits.find(x=>x.id===vid);
 check(()=>assert.equal(v().programmeCapture.packs.length,2,'two packs captured in one visit'));
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'59',temperature:'',weeks:'22',coughDays:'',notes:'Synthetic two-pack reuse visit.',source:'measured'};
 await post(o,{type:'saveVisit',visitId:vid,version:v().version,facts});await get(o,'/api/workspace',200,org);
 await post(o,{type:'saveProgrammeAnswers',visitId:vid,version:v().version,answers:{maternal_contact:'Yes',medication_access:'Available'},absence:{systolic:'Not measured',diastolic:'Not measured'}});await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmVisit',visitId:vid,version:v().version});
 }
 const after=await read({ids,days:'30',group:'none'});
 const r=(res,id)=>res.results.find(x=>x.id===id).rows[0];
 check(()=>{const a=r(after,'reuse-shared-answers'),b=r(before,'reuse-shared-answers');assert.ok(a.suppressed||(a.denominator>=(b.denominator??0)+3&&a.numerator>=(b.numerator??0)+1),'three opportunities; weight reused, blood pressure not measured');});
 check(()=>{const a=r(after,'reuse-blocked');assert.ok(a.suppressed||a.value>=1);});
 check(()=>assert.ok(after.results.every(x=>x.version===1)));
}
