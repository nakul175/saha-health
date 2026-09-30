import assert from 'node:assert/strict';
// Slice 3i: the open field referral request queue through the built Worker and local D1.
export async function referralRequestQueueSmoke({get,post,check,accounts,org,sql,base}){
 const {worker:w,clinician:c,supervisor:s,admin:a,owner:o,stranger:x}=accounts;
 const read=async(who,path='/api/referral-requests',status=200)=>{const r=await fetch(`${base}${path}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 await get(w,'/api/workspace',200,org);
 const tag=crypto.randomUUID().slice(0,6),at=new Date(Date.now()-3600000),facts={date:at.toISOString().slice(0,16),systolic:'170',diastolic:'106',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic first visit with a referral request.',source:'measured'};
 const register=async(name,facility)=>(await post(w,{type:'registerFieldPerson',registrationId:crypto.randomUUID(),capturedAt:at.toISOString(),name,age:48,sex:'Female',village:'Synthetic queue locality '+tag,programme:'Chronic care',teamId:'default',facts,referralRequest:{facility,reason:'Synthetic very high reading.'}},200,crypto.randomUUID(),org)).result;
 const old=await register(`Queue Synthetic Old ${tag}`,'Synthetic CHC '+tag),fresh=await register(`Queue Synthetic New ${tag}`,'Synthetic PHC '+tag),draft=await register(`Queue Synthetic Draft ${tag}`,'Synthetic DH '+tag);
 for(const v of [old.visitId,fresh.visitId]){await get(w,'/api/workspace',200,org);await post(w,{type:'confirmVisit',visitId:v,version:w.state.visits.find(x=>x.id===v).version},200,crypto.randomUUID(),org);}
 // The first request has waited three days (synthetic backdating of the stored request time).
 sql.prepare("UPDATE visits SET data=json_set(data,'$.referralRequest.requestedAt',?) WHERE org_id=? AND id=?").run(new Date(Date.now()-72*3600000).toISOString(),org,old.visitId);
 const mine=q=>q.items.filter(i=>[old.visitId,fresh.visitId,draft.visitId].includes(i.visitId));
 const cq=await read(c);
 check(()=>{const m=mine(cq);assert.equal(m.length,3);assert.equal(m[0].visitId,old.visitId,'oldest first');assert.deepEqual(new Set(m.map(i=>i.visitId)),new Set([old.visitId,fresh.visitId,draft.visitId]));});
 check(()=>{const i=cq.items.find(i=>i.visitId===old.visitId);assert.equal(i.longWaiting,true);assert.ok(i.ageHours>=71);assert.equal(i.canDecide,true);assert.equal(i.facility,'Synthetic CHC '+tag);assert.equal(i.requestedBy,w.state.user.displayName);assert.equal(i.link.href,`/?patient=${encodeURIComponent(old.personId)}&visit=${encodeURIComponent(old.visitId)}`);});
 check(()=>{const d=cq.items.find(i=>i.visitId===draft.visitId);assert.equal(d.canDecide,false);assert.match(d.blocker,/not confirmed/);const f=cq.items.find(i=>i.visitId===fresh.visitId);assert.equal(f.longWaiting,false);assert.equal(f.canDecide,true);});
 check(()=>{assert.equal(cq.canDecide,true);assert.equal(cq.total,cq.items.length);assert.equal(cq.waitHours,48);});
 // Supervisors and owners with a care role watch the same scope but do not decide.
 const sq=await read(s),oq=await read(o);
 check(()=>{assert.equal(mine(sq).length,3);assert.ok(mine(sq).every(i=>!i.canDecide));assert.equal(sq.canDecide,false);assert.equal(mine(oq).length,3);});
 // ASHAs, administrators and non-members are refused.
 await read(w,undefined,403);await read(a,undefined,403);await read(x,undefined,403);
 // The long-waiting request is also an exception-queue row for the supervisor, with a link to the visit.
 const ex=await read(s,'/api/exceptions');
 check(()=>{assert.equal(ex.rulesVersion,'1.1.0');const r=ex.items.find(i=>i.id==='referral-request-waiting:'+old.visitId);assert.ok(r);assert.match(r.owner,/^Clinicians of /);assert.equal(r.link.visitId,old.visitId);assert.equal(ex.items.some(i=>i.id==='referral-request-waiting:'+fresh.visitId),false);});
 // Deciding removes the request from both queues.
 await get(c,'/api/workspace',200,org);
 await post(c,{type:'decideReferralRequest',visitId:old.visitId,decision:'decline',reason:'Reviewed by phone; follow up in the village.'},200,crypto.randomUUID(),org);
 const after=await read(c),exAfter=await read(s,'/api/exceptions');
 check(()=>{assert.equal(after.items.some(i=>i.visitId===old.visitId),false);assert.equal(mine(after).length,2);assert.equal(exAfter.items.some(i=>i.id==='referral-request-waiting:'+old.visitId),false);});
}
