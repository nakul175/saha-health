import assert from 'node:assert/strict';
// Slice 3h: a clinician acts on a field referral request (slice 3g) through the built Worker and local D1.
export async function referralRequestSmoke({get,post,check,accounts,org,sql}){
 const {worker:w,clinician:c}=accounts;await get(w,'/api/workspace',200,org);await get(c,'/api/workspace',200,org);
 check(()=>{assert.equal(w.state.role,'asha');assert.equal(c.state.role,'clinician');});
 const tag=crypto.randomUUID().slice(0,6),at=new Date(Date.now()-3600000),facts={date:at.toISOString().slice(0,16),systolic:'168',diastolic:'104',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic first visit with a referral request.',source:'measured'};
 const register=async name=>(await post(w,{type:'registerFieldPerson',registrationId:crypto.randomUUID(),capturedAt:at.toISOString(),name,age:52,sex:'Male',village:'Synthetic request locality '+tag,programme:'Chronic care',teamId:'default',facts,referralRequest:{facility:'Synthetic block hospital',reason:'Synthetic very high reading.'}})).result;
 const confirm=async vid=>{await get(w,'/api/workspace',200,org);await post(w,{type:'confirmVisit',visitId:vid,version:w.state.visits.find(v=>v.id===vid).version});};
 const one=await register(`Request Synthetic One ${tag}`);
 // Before confirmation nobody may act; afterwards only a clinician.
 await post(c,{type:'decideReferralRequest',visitId:one.visitId,decision:'refer',reason:'Refer for blood pressure review.'},409);
 await confirm(one.visitId);
 await post(w,{type:'decideReferralRequest',visitId:one.visitId,decision:'refer',reason:'Refer for blood pressure review.'},403);
 await post(c,{type:'decideReferralRequest',visitId:one.visitId,decision:'refer',reason:'bad'},422);
 await post(c,{type:'decideReferralRequest',visitId:one.visitId,decision:'decline',facility:'Synthetic block hospital',reason:'A facility is not used when declining.'},422);
 const key=crypto.randomUUID(),body={type:'decideReferralRequest',visitId:one.visitId,decision:'refer',facility:'Synthetic district hospital',reason:'Refer for blood pressure review within a week.'};
 const made=await post(c,body,200,key);
 check(()=>{const r=c.state.referrals.find(x=>x.id===made.result.referralId);assert.equal(r.visitId,one.visitId);assert.equal(r.personId,one.personId);assert.equal(r.facility,'Synthetic district hospital');assert.equal(r.reason,body.reason);assert.equal(r.state,'draft');});
 check(()=>{const v=c.state.visits.find(x=>x.id===one.visitId);assert.equal(v.referralRequest.decision.decision,'referred');assert.equal(v.referralRequest.decision.referralId,made.result.referralId);assert.equal(v.referralRequest.decision.by,c.id);assert.equal(v.referralRequest.facility,'Synthetic block hospital','the request itself is kept');});
 check(()=>{const rows=sql.prepare("SELECT action,actor_id,detail FROM audit_events WHERE org_id=? AND person_id=? AND action IN ('createReferral','decideReferralRequest') ORDER BY at").all(org,one.personId);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.actor_id===c.id));assert.match(rows.find(r=>r.action==='decideReferralRequest').detail,/created from the field referral request.*No facility was contacted/);});
 const replay=await post(c,body,200,key);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.result.referralId,made.result.referralId);assert.equal(sql.prepare('SELECT count(*) AS n FROM referrals WHERE org_id=? AND person_id=?').get(org,one.personId).n,1);});
 await post(c,{...body,reason:'A second decision must be refused.'},409);
 // A declined request records the reason and creates no referral.
 const two=await register(`Request Synthetic Two ${tag}`);await confirm(two.visitId);
 const declined=await post(c,{type:'decideReferralRequest',visitId:two.visitId,decision:'decline',reason:'Reading repeated at rest was normal; review at next visit.'});
 check(()=>{assert.equal(declined.result.referralId,null);const v=c.state.visits.find(x=>x.id===two.visitId);assert.equal(v.referralRequest.decision.decision,'declined');assert.equal(sql.prepare('SELECT count(*) AS n FROM referrals WHERE org_id=? AND person_id=?').get(org,two.personId).n,0);});
 // A visit without a request, and an unknown visit.
 const plain=w.state.visits.find(v=>v.state==='confirmed'&&!v.referralRequest&&w.state.people.some(p=>p.id===v.personId));if(plain)await post(c,{type:'decideReferralRequest',visitId:plain.id,decision:'decline',reason:'No request on this visit.'},404);
 await post(c,{type:'decideReferralRequest',visitId:'no-such-visit',decision:'decline',reason:'Unknown visit.'},404);
}
