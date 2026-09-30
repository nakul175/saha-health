import assert from 'node:assert/strict';
// Slice 2e: per-measurement author and clinician verification through the built Worker and local D1: authors from the
// server identity, verification and dispute by another clinician, role, scope, state, version and self refusals,
// replay rechecked after a role change, revisions, audit and the FHIR example notes.
export async function factVerificationSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts;await get(o,'/api/workspace',200,org);await get(c,'/api/workspace',200,org);
 check(()=>{const m=o.state.members.find(x=>x.userId===c.id);assert.equal(m.role,'clinician');assert.ok(m.teamIds.includes('default'));});
 const minute=t=>new Date(t).toISOString().slice(0,16),visitAt=minute(Date.now()-2*3600000);
 const blank={date:visitAt,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic verification visit.',source:'measured'};
 const pid=(await post(o,{type:'createPerson',name:`Verification Synthetic ${crypto.randomUUID().slice(0,6)}`,age:41,sex:'Female',village:'Verification synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;const vis=who=>who.state.visits.find(v=>v.id===vid);
 // A client cannot send an author: the facts object is strict and a command-level author is dropped.
 await post(o,{type:'saveVisit',visitId:vid,version:vis(o).version,facts:{...blank,weight:'58',factAuthors:{weight:{userId:'someone-else'}}}},422);
 await post(o,{type:'saveVisit',visitId:vid,version:vis(o).version,facts:{...blank,weight:'58',systolic:'128',diastolic:'84',provenance:{temperature:{source:'declined'}}},factAuthors:{weight:{userId:'someone-else'}}});
 check(()=>{const au=vis(o).factAuthors;assert.deepEqual(Object.keys(au).sort(),['bloodPressure','temperature','weight']);assert.equal(au.weight.userId,o.id);assert.equal(au.weight.role,'clinician');assert.equal(au.weight.accountCode,o.state.user.accountCode);});
 // Verification needs a confirmed visit.
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:vis(o).recordVersion,measure:'weight',decision:'verified'},409);
 await post(o,{type:'confirmVisit',visitId:vid,version:vis(o).version});await get(c,'/api/workspace',200,org);
 const rv=()=>vis(c).recordVersion;
 // Role, self, measurement, reason and version refusals.
 await get(w,'/api/workspace',200,org);await get(s,'/api/workspace',200,org);
 await post(w,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'verified'},403);
 await post(s,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'verified'},403);
 await post(a,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'verified'},403,undefined,org);
 await post(o,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'verified'},403);
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'coughDays',decision:'verified'},422);
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'bloodPressure',decision:'disputed'},422);
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv()+1,measure:'weight',decision:'verified'},409);
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'pulse',decision:'verified'},422);
 // Verify weight, dispute blood pressure; repeating a decision is refused; history appends.
 const key=crypto.randomUUID(),body={type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'verified'};
 const done=await post(c,body,200,key);
 check(()=>{const r=vis(c).factReviews;assert.equal(r.length,1);assert.equal(r[0].state,'verified');assert.equal(r[0].by,c.id);assert.equal(done.result.state,'verified');assert.equal(vis(c).state,'confirmed');assert.equal(vis(c).facts.weight,'58');});
 await post(c,{...body,recordVersion:rv()},409);
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'bloodPressure',decision:'disputed',reason:'Cuff size was not recorded for this synthetic reading.'});
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'weight',decision:'disputed',reason:'Scale calibration unknown for this synthetic visit.'});
 check(()=>{const r=vis(c).factReviews;assert.deepEqual(r.map(x=>[x.measure,x.state]),[['weight','verified'],['bloodPressure','disputed'],['weight','disputed']]);});
 check(()=>{const n=sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND action='verifyFact'").get(org,vid).n;assert.equal(n,3);const e=sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='verifyFact' AND person_id=?").get(org,vid,pid).n;assert.equal(e,3);});
 // Replay rechecks the current role: after the clinician becomes a supervisor, the saved receipt is not returned.
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,c.id);
 await post(c,body,403,key);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,c.id);
 const again=await post(c,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.reviewId,done.result.reviewId);});
 // The FHIR example names the recorder and the current verification state of each observation.
 const fhir=await get(c,`/api/fhir/${vid}?organisationId=${org}`),obs=fhir.entry.map(e=>e.resource);
 check(()=>{const wt=obs.find(r=>r.id===`${vid}-weight`);assert.match(wt.note[0].text,/Recorded by: .*\(Clinician\)/);assert.match(wt.note[0].text,/Verification: disputed by .*Scale calibration unknown/);const bp=obs.find(r=>r.id===`${vid}-bp`);assert.match(bp.note[0].text,/Verification: disputed/);});
 // A correction draft keeps the recorded authors of copied facts and starts unverified.
 const amended=await post(c,{type:'amendVisit',visitId:vid,version:rv(),reason:'Synthetic correction of the disputed weight'});
 const nv=()=>c.state.visits.find(v=>v.id===amended.result.visitId);
 check(()=>{assert.equal(nv().factAuthors.weight.userId,o.id);assert.equal(nv().factReviews,undefined);});
 await post(c,{type:'saveVisit',visitId:nv().id,version:nv().version,facts:{...nv().facts,weight:'57.5'}});
 check(()=>{assert.equal(nv().factAuthors.weight.userId,c.id);assert.equal(nv().factAuthors.bloodPressure.userId,o.id);});
 await post(c,{type:'verifyFact',visitId:vid,recordVersion:rv(),measure:'temperature',decision:'verified'},409);
}
