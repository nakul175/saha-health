import assert from 'node:assert/strict';
// Slice 3g: offline registration synced as one command (registerFieldPerson) through the built Worker and local D1.
export async function fieldRegistrationSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const tag=crypto.randomUUID().slice(0,6),count=(table,where,...binds)=>sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=? AND ${where}`).get(org,...binds).n;
 const people=name=>count('patients','name=?',name);
 const matches=async(who,body)=>{const r=await fetch(base+'/api/patient-matches',{method:'POST',headers:{...who.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(body)});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j)));return j;};
 await get(w,'/api/workspace',200,org);check(()=>{assert.equal(w.state.role,'asha');assert.ok(w.state.membership.teamIds.includes('default'));});
 const capturedAt=new Date(Date.now()-3600000).toISOString(),date=new Date(Date.now()-3600000).toISOString().slice(0,16);
 const person=(name,extra={})=>({type:'registerFieldPerson',registrationId:crypto.randomUUID(),capturedAt,name,age:34,sex:'Female',village:'Synthetic field locality '+tag,programme:'Maternal care',teamId:'default',...extra});
 const facts={date,systolic:'124',diastolic:'80',weight:'58',temperature:'',weeks:'20',coughDays:'',notes:'Synthetic first visit captured offline.',source:'measured'};
 // 1. A registration without a visit creates one person assigned to the worker, with the registration id stored.
 const alpha=person(`Field Alpha ${tag}`),first=await post(w,alpha);
 check(()=>{assert.equal(first.result.alreadyRegistered,false);assert.equal(first.result.visitId,null);assert.equal(first.result.identity,'local');});
 check(()=>{const p=w.state.people.find(p=>p.id===first.result.personId);assert.equal(p.assignedTo,w.id);assert.equal(p.teamId,'default');assert.equal(p.fieldRegistration.id,alpha.registrationId);assert.equal(p.fieldRegistration.by,w.id);assert.equal(p.fieldRegistration.capturedAt,capturedAt);assert.deepEqual(p.programmes,['Maternal care','General care']);assert.equal(p.status,'due');});
 // 2. With a first visit and a referral request: person, draft visit and request are created together.
 const beta=person(`Field Beta ${tag}`,{facts,referralRequest:{facility:'Synthetic block hospital',reason:'Synthetic high reading reported by the worker.'}}),key=crypto.randomUUID();
 const second=await post(w,beta,200,key);
 check(()=>{const v=w.state.visits.find(v=>v.id===second.result.visitId);assert.equal(v.personId,second.result.personId);assert.equal(v.state,'draft');assert.deepEqual(v.facts,facts);assert.equal(v.fieldRegistrationId,beta.registrationId);assert.equal(v.referralRequest.facility,'Synthetic block hospital');assert.equal(v.referralRequest.requestedBy,w.id);assert.equal(v.referralRequest.capturedAt,capturedAt);});
 check(()=>{assert.equal(w.state.people.find(p=>p.id===second.result.personId).status,'in_progress');assert.equal(count('referrals','person_id=?',second.result.personId),0,'a request is not a referral');});
 check(()=>assert.match(sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND person_id=? AND action='registerFieldPerson'").get(org,second.result.personId).detail,/first visit draft and a referral request.*Nothing was confirmed, referred or sent/));
 // 3. The same key replays; a new key with the same registration id returns the same person and visit.
 const replay=await post(w,beta,200,key);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.result.personId,second.result.personId);});
 const resent=await post(w,beta);check(()=>{assert.equal(resent.result.alreadyRegistered,true);assert.equal(resent.result.personId,second.result.personId);assert.equal(resent.result.visitId,second.result.visitId);assert.equal(people(beta.name),1);assert.equal(count('visits','person_id=?',second.result.personId),1);});
 const edited=await post(w,{...beta,age:35});check(()=>{assert.equal(edited.result.personId,second.result.personId,'the registration id decides, not the details');assert.equal(people(beta.name),1);});
 // 4. Another worker cannot reuse the registration id.
 await get(c,'/api/workspace',200,org);await post(c,{...beta},409);check(()=>assert.equal(people(beta.name),1));
 // 5. Possible matches refuse until reviewed; a stale or wrong review is refused; distinct and provisional are recorded.
 const dup=person(alpha.name);await post(w,dup,409);check(()=>assert.equal(people(alpha.name),1));
 let found=await matches(w,{name:dup.name,age:dup.age,sex:dup.sex,village:dup.village,teamId:dup.teamId});check(()=>assert.deepEqual(found.candidates.map(c=>c.id),[first.result.personId]));
 await post(w,{...dup,registrationReview:{hash:'b'.repeat(64),decision:'distinct',reason:'Synthetic wrong hash must be refused.'}},409);
 await post(w,{...dup,registrationReview:{hash:found.hash,decision:'distinct',reason:'short'}},422);
 const distinct=await post(w,{...dup,registrationReview:{hash:found.hash,decision:'distinct',reason:'Synthetic different person: different household and husband name.'}});
 check(()=>{const p=w.state.people.find(p=>p.id===distinct.result.personId);assert.notEqual(p.id,first.result.personId);assert.equal(p.identityReview.state,'local');assert.equal(p.identityReview.candidateCount,1);assert.equal(p.identityReview.reviewHash,found.hash);assert.equal(people(alpha.name),2);});
 const unsure=person(alpha.name,{facts});await post(w,{...unsure,registrationReview:{hash:found.hash,decision:'provisional',reason:'Synthetic stale candidate list after another registration.'}},409);
 found=await matches(w,{name:unsure.name,age:unsure.age,sex:unsure.sex,village:unsure.village,teamId:unsure.teamId});check(()=>assert.equal(found.candidates.length,2));
 const provisional=await post(w,{...unsure,registrationReview:{hash:found.hash,decision:'provisional',reason:'Synthetic worker could not tell; clinician review requested.'}});
 check(()=>{assert.equal(provisional.result.identity,'provisional');const v=w.state.visits.find(v=>v.id===provisional.result.visitId);assert.equal(v.state,'draft');});
 await post(w,{type:'confirmVisit',visitId:provisional.result.visitId,version:1},409);
 // 6. Role, team and validation refusals create nothing.
 const refused=person(`Field Refused ${tag}`);
 // The administrator and supervisor may be inactive or reassigned by earlier modules; each is refused either way.
 for(const who of [a,s,x])await post(who,refused,403,crypto.randomUUID(),org);
 const other=o.state.teams.find(t=>!w.state.membership.teamIds.includes(t.id));if(other)await post(w,{...refused,teamId:other.id},403);await post(w,{...refused,teamId:'no-such-team'},403);
 await post(w,{...refused,referralRequest:{facility:'Synthetic block hospital',reason:'Needs a visit first.'}},422);
 await post(w,{...refused,capturedAt:new Date(Date.now()+3600000).toISOString()},422);
 await post(w,{...refused,facts:{...facts,date:new Date(Date.now()+3600000).toISOString().slice(0,16)}},422);
 await post(w,{...refused,facts:{...facts,diastolic:''}},422);
 await post(w,{...refused,registrationId:'not-a-uuid'},422);
 check(()=>assert.equal(people(refused.name),0));
 // 7. A replay after the worker loses the team is refused; the receipt is not returned.
 const gammaKey=crypto.randomUUID(),gamma=person(`Field Gamma ${tag}`);await post(w,gamma,200,gammaKey);
 await get(o,'/api/workspace',200,org);let member=o.state.members.find(m=>m.userId===w.id);const teams=member.teamIds;
 await post(o,{type:'updateMember',userId:w.id,version:member.version,role:'supervisor',teamIds:teams,isOwner:false,status:'active',reason:'Synthetic role change before a replay.'});
 await post(w,gamma,403,gammaKey);await post(w,person(`Field Supervisor ${tag}`),403);
 member=o.state.members.find(m=>m.userId===w.id);await post(o,{type:'updateMember',userId:w.id,version:member.version,role:'asha',teamIds:teams,isOwner:false,status:'active',reason:'Restore the synthetic worker role.'});
 await get(w,'/api/workspace',200,org);check(()=>assert.equal(people(gamma.name),1));
}
