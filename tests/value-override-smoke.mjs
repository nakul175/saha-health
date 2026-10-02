import assert from 'node:assert/strict';
// Slice 2i: units and unusual values through the built Worker and local D1: refusals storing nothing, conversion with the
// original kept, overrides recorded with who/when/why and audited, confirmVisit blocked until another clinician confirms,
// the confirmation command's role and self refusals, replay rechecked after a role change, the FHIR example notes, and a
// correction draft keeping the history while a changed value needs a new confirmation.
export async function valueOverrideSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,clinician:c,supervisor:s}=accounts;await get(o,'/api/workspace',200,org);await get(c,'/api/workspace',200,org);
 const minute=t=>new Date(t).toISOString().slice(0,16),visitAt=minute(Date.now()-2*3600000);
 const blank={date:visitAt,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic unusual value visit.',source:'measured'};
 const pid=(await post(o,{type:'createPerson',name:`Units Synthetic ${crypto.randomUUID().slice(0,6)}`,age:52,sex:'Male',village:'Units synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;const vis=who=>who.state.visits.find(v=>v.id===vid);
 const save=(facts,status=200,who=o)=>post(who,{type:'saveVisit',visitId:vid,version:vis(who).version,facts},status);
 // Refusals store nothing: an unusual value without a reason, a short reason, a reason for a usual value, an unstated or
 // unsupported unit, and a base value that disagrees with the entered one.
 await save({...blank,weight:'180'},422);await save({...blank,weight:'180',unusual:{weight:'short'}},422);await save({...blank,weight:'60',unusual:{weight:'Reason for a usual synthetic value'}},422);
 await save({...blank,entered:{weight:{value:'154',unit:'kg'}}},422);await save({...blank,entered:{systolic:{value:'16',unit:'kPa'}}},422);await save({...blank,weight:'70',entered:{weight:{value:'154',unit:'lb'}}},422);
 await get(o,'/api/workspace',200,org);check(()=>{assert.equal(vis(o).version,1);assert.equal(vis(o).facts.weight,'');assert.equal(vis(o).valueOverrides,undefined);});
 // Stated alternative units are converted on the server and the entered value is kept.
 await save({...blank,entered:{weight:{value:'154',unit:'lb'},temperature:{value:'98.6',unit:'degF'},coughDays:{value:'2',unit:'wk'}}});
 check(()=>{const f=vis(o).facts;assert.equal(f.weight,'69.85');assert.equal(f.temperature,'37');assert.equal(f.coughDays,'14');assert.deepEqual(f.entered,{weight:{value:'154',unit:'lb'},temperature:{value:'98.6',unit:'degF'},coughDays:{value:'2',unit:'wk'}});assert.equal(vis(o).valueOverrides,undefined);});
 // Unusual values with reasons: one needing only the reason, one beyond the confirmation range.
 await save({...blank,systolic:'210',diastolic:'90',entered:{weight:{value:'882',unit:'lb'}},unusual:{weight:'Synthetic scale reading repeated twice.',systolic:'Repeated after rest; same synthetic reading.'}});
 const ov=(who,f)=>vis(who).valueOverrides.find(x=>x.field===f);
 check(()=>{assert.equal(vis(o).valueOverrides.length,2);const wt=ov(o,'weight');assert.equal(wt.value,'400.07');assert.equal(wt.tier,'clinician');assert.deepEqual(wt.entered,{value:'882',unit:'lb'});assert.equal(wt.by.userId,o.id);assert.equal(wt.by.role,'clinician');assert.equal(wt.reason,'Synthetic scale reading repeated twice.');assert.equal(ov(o,'systolic').tier,'reason');});
 check(()=>{const e=sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='recordUnusualValue' AND person_id=?").get(org,vid,pid).n;assert.equal(e,1);});
 // The visit cannot be confirmed until a clinician who did not record the value confirms it.
 await post(o,{type:'confirmVisit',visitId:vid,version:vis(o).version},409);
 await get(c,'/api/workspace',200,org);await get(w,'/api/workspace',200,org);await get(s,'/api/workspace',200,org);
 const body={type:'confirmUnusualValue',visitId:vid,version:vis(c).version,field:'weight',overrideId:ov(c,'weight').id};
 await post(w,body,403);await post(s,body,403);await post(o,body,403);
 await post(c,{...body,field:'systolic',overrideId:ov(c,'systolic').id},409);await post(c,{...body,version:body.version+1},409);await post(c,{...body,overrideId:'not-current'},409);
 const key=crypto.randomUUID(),done=await post(c,body,200,key);
 check(()=>{const r=vis(c).overrideConfirmations;assert.equal(r.length,1);assert.equal(r[0].by,c.id);assert.equal(r[0].overrideId,body.overrideId);assert.equal(done.result.field,'weight');assert.equal(vis(c).version,body.version,'visit version unchanged');assert.equal(vis(c).facts.weight,'400.07');});
 await post(c,body,409);
 check(()=>{const n=sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND action='confirmUnusualValue'").get(org,vid).n;assert.equal(n,1);const e=sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='confirmUnusualValue' AND person_id=?").get(org,vid,pid).n;assert.equal(e,1);});
 // Replay rechecks the current role.
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,c.id);
 await post(c,body,403,key);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,c.id);
 const again=await post(c,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.confirmationId,done.result.confirmationId);});
 await get(o,'/api/workspace',200,org);await post(o,{type:'confirmVisit',visitId:vid,version:vis(o).version});check(()=>assert.equal(vis(o).state,'confirmed'));
 // The FHIR example notes carry the entered unit and the override.
 const fhir=await get(c,`/api/fhir/${vid}?organisationId=${org}`),obs=fhir.entry.map(e=>e.resource);
 check(()=>{const wt=obs.find(r=>r.id===`${vid}-weight`);assert.equal(wt.valueQuantity.value,400.07);assert.match(wt.note[0].text,/Entered as 882 lb; converted by Saha\. Unusual value \(saha-value-ranges-0\.1\.0, engineering placeholder — not clinically approved\): outside 2–150 kg; reason: Synthetic scale reading repeated twice\. Confirmed by /);assert.match(obs.find(r=>r.id===`${vid}-temperature`)?.note[0].text??'',/^$|Source/);assert.match(obs.find(r=>r.id===`${vid}-bp`).note[0].text,/outside 70–200 mmHg/);});
 // A correction draft keeps the history; a changed value is recorded again and needs a new confirmation.
 await get(c,'/api/workspace',200,org);
 const amended=await post(c,{type:'amendVisit',visitId:vid,version:vis(c).recordVersion,reason:'Synthetic correction of the unusual weight'});
 const nv=who=>who.state.visits.find(v=>v.id===amended.result.visitId);
 check(()=>{assert.equal(nv(c).valueOverrides.length,2);assert.equal(nv(c).overrideConfirmations.length,1);});
 await post(c,{type:'saveVisit',visitId:nv(c).id,version:nv(c).version,facts:{...nv(c).facts,weight:'',entered:{weight:{value:'880',unit:'lb'}}}});
 check(()=>{const v=nv(c);assert.equal(v.facts.weight,'399.16');assert.equal(v.valueOverrides.length,3);assert.equal(v.valueOverrides.at(-1).by.userId,c.id);assert.equal(v.valueOverrides[0].visitId,vid);});
 await post(c,{type:'confirmVisit',visitId:nv(c).id,version:nv(c).version},409);
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmUnusualValue',visitId:nv(o).id,version:nv(o).version,field:'weight',overrideId:nv(o).valueOverrides.at(-1).id});
 await post(c,{type:'confirmVisit',visitId:nv(c).id,version:nv(c).version});check(()=>assert.equal(nv(c).state,'confirmed'));
}
