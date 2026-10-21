import assert from 'node:assert/strict';
// Slice 6a: exceptional (break-glass) access through the built Worker and local D1.
export async function exceptionalSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c}=accounts;
 const view=async(who,status=200)=>{const r=await fetch(`${base}/api/exceptional`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j)));return j;};
 await get(o,'/api/workspace',200,org);
 const north=o.state.teams.find(t=>t.name==='North team').id;
 const pid=(await post(o,{type:'createPerson',name:`Emergency Synthetic ${crypto.randomUUID().slice(0,6)}`,age:52,sex:'Male',village:'North synthetic locality',programme:'General care',teamId:north})).result.personId;
 const ref=pid.slice(0,8).toUpperCase();
 await get(c,'/api/workspace',200,org);check(()=>assert.equal(c.state.people.some(p=>p.id===pid),false));
 await post(c,{type:'startVisit',personId:pid},403);
 const open={type:'exceptionalOpen',recordRef:ref,minutes:30,reason:'Synthetic patient collapsed at the south clinic'};
 await post(w,open,403);await post(s,open,403);await post(a,open,403);
 await post(o,open,409);
 await post(c,{...open,recordRef:'not-a-record'},404);
 await post(c,{...open,reason:'Too short'},422);
 await post(c,{...open,minutes:600},422);
 // Two fresh attempts racing for the same patient create one grant only. This is different from an idempotent
 // replay: one request wins the patient revision and the other is refused after the current state is re-read.
 const raced=await Promise.all([fetch(`${base}/api/commands`,{method:'POST',headers:{...c.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify(open)}),fetch(`${base}/api/commands`,{method:'POST',headers:{...c.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify(open)})]);
 check(()=>assert.deepEqual(raced.map(x=>x.status).sort(),[200,409]));const replies=await Promise.all(raced.map(x=>x.json())),granted=replies.find(x=>x.result);
 check(()=>{assert.equal(granted.result.personId,pid);assert.ok(granted.result.until>new Date().toISOString());});
 await post(c,open,409);
 await get(c,'/api/workspace',200,org);check(()=>assert.ok(c.state.people.some(p=>p.id===pid)));
 // Urgent care is permitted; sharing, consent, identity and assignment are not.
 const visit=await post(c,{type:'startVisit',personId:pid});check(()=>assert.ok(visit.result.visitId));
 await get(c,`/api/history?personId=${pid}`,200,org);
 const p=()=>c.state.people.find(x=>x.id===pid);
 await post(c,{type:'setConsent',personId:pid,version:p().version,purpose:'exchange',active:true},403);
 await post(c,{type:'assignPatient',personId:pid,version:p().version,teamId:north,assignedTo:c.id,reason:'Emergency self assignment'},403);
 await post(c,{type:'correctIdentity',personId:pid,version:p().version,name:'Renamed in emergency',age:52,sex:'Male',village:'North synthetic locality',reason:'Emergency identity change attempt'},403);
 await post(c,{type:'householdCreate',personId:pid,version:p().version,label:'Emergency household',relationship:'head'},403);
 const fhir=await fetch(`${base}/api/fhir/${visit.result.visitId}?organisationId=${org}`,{headers:c.headers});check(()=>assert.equal(fhir.status,403));
 // Views and review.
 let v=await view(c);const g=v.mine.find(x=>x.personId===pid);
 check(()=>{assert.ok(g);assert.equal(g.active,true);assert.equal(v.canOpen,true);assert.equal(v.canReview,false);});
 check(()=>{const rows=sql.prepare("SELECT action,subject,detail FROM audit_events WHERE org_id=? AND person_id=? AND actor_id=? AND action='viewRecordHistory' AND detail LIKE 'Emergency-access register read:%'").all(org,pid,c.id);assert.equal(rows.length,1);assert.equal(rows[0].subject,g.grantId);assert.match(rows[0].detail,/own grant; status active/);assert.match(rows[0].detail,new RegExp(`Through emergency access grant ${g.grantId}`));});
 await view(a,403);
 v=await view(s);check(()=>{assert.equal(v.reviews.some(x=>x.personId===pid),false,'a supervisor outside the patient team does not review');assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewRecordHistory' AND person_id IS NULL AND detail LIKE 'Emergency-access register read:%'").get(org,s.id).n,1,'an empty review queue is still audited');});
 v=await view(o);check(()=>{const x=v.reviews.find(x=>x.personId===pid);assert.ok(x);assert.equal(x.active,true);assert.equal(x.userId,c.id);});
 check(()=>{const row=sql.prepare("SELECT subject,detail FROM audit_events WHERE org_id=? AND person_id=? AND actor_id=? AND action='viewRecordHistory' AND detail LIKE 'Emergency-access register read:%'").get(org,pid,o.id);assert.equal(row.subject,g.grantId);assert.match(row.detail,/pending review; status active/);assert.doesNotMatch(row.detail,/collapsed|south clinic/,'the access audit never repeats the typed emergency reason');});
 await post(o,{type:'exceptionalReview',personId:pid,grantId:g.grantId,outcome:'appropriate',note:'Reviewed while still open'},409);
 await post(s,{type:'exceptionalReview',personId:pid,grantId:g.grantId,outcome:'appropriate',note:'Wrong team review'},403);
 await post(w,{type:'exceptionalClose',personId:pid,grantId:g.grantId},403);
 await post(c,{type:'exceptionalClose',personId:pid,grantId:g.grantId});
 await post(c,{type:'startVisit',personId:pid},403);
 await get(c,`/api/history?personId=${pid}`,403,org);
 await get(c,'/api/workspace',200,org);check(()=>assert.equal(c.state.people.some(p=>p.id===pid),false));
 await post(c,{type:'exceptionalReview',personId:pid,grantId:g.grantId,outcome:'appropriate',note:'Self review attempt'},403);
 await post(o,{type:'exceptionalReview',personId:pid,grantId:g.grantId,outcome:'appropriate',note:'Collapse recorded; access proportionate'});
 await post(o,{type:'exceptionalReview',personId:pid,grantId:g.grantId,outcome:'inappropriate',note:'Second review attempt'},409);
 v=await view(c);check(()=>assert.equal(v.mine.find(x=>x.grantId===g.grantId).review.outcome,'appropriate'));
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action='viewRecordHistory' AND detail LIKE 'Emergency-access register read:%'").get(org,pid).n,3,'each material register disclosure is patient-linked'));
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action IN ('exceptionalOpen','exceptionalClose','exceptionalReview')").get(org,pid).n,3));
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM visits WHERE org_id=? AND person_id=?").get(org,pid).n,1,'the emergency visit draft is kept on the record'));
}
