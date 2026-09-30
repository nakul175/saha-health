import assert from 'node:assert/strict';
// Slice 4d: action dependencies and referrals with several sources through the built Worker and local D1.
export async function planDependenciesSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const plan=async(who,personId,status=200)=>{const r=await fetch(`${base}/api/action-plan?${new URLSearchParams({personId})}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 const pid=(await send(o,{type:'createPerson',name:`Dependency ${crypto.randomUUID().slice(0,6)}`,age:31,sex:'Female',village:'Dependency synthetic locality',programme:'Maternal care',teamId:'default'})).result.personId;
 const me=()=>o.state.people.find(p=>p.id===pid);
 await send(o,{type:'assignPatient',personId:pid,version:me().version,teamId:'default',assignedTo:w.id,reason:'Synthetic dependency patient assigned to the ASHA.'});
 const confirmed=async()=>{const vid=(await send(o,{type:'startVisit',personId:pid})).result.visitId;
  await send(o,{type:'saveVisit',visitId:vid,version:1,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'146',diastolic:'94',weight:'57',temperature:'',weeks:'22',coughDays:'',notes:'Synthetic dependency visit.',source:'measured'}});
  await get(o,'/api/workspace',200,org);await send(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version});return vid;};
 const v1=await confirmed(),v2=await confirmed();
 const rid=(await send(o,{type:'createReferral',visitId:v1,facility:'Synthetic CHC',reason:'Synthetic raised blood pressure for specialist review'})).result.referralId;
 const e1=(await send(o,{type:'enrolProgramme',personId:pid,version:me().version,packId:'maternal',episodeLabel:'Synthetic dependency episode',startDate:null})).result.enrolmentId;
 const due=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 await send(o,{type:'scheduleFollowUp',personId:pid,version:me().version,enrolmentId:e1,title:'Home visit after referral',due,ownerId:w.id});
 let p=await plan(s,pid);const fu=()=>p.items.find(i=>i.kind==='follow-up'),ref=()=>p.items.find(i=>i.key==='referral:'+rid);
 check(()=>{assert.equal(fu().attention,'upcoming');assert.equal(p.canLink,true);assert.deepEqual(p.dependencies,[]);assert.equal(ref().sources.length,1,'single-source referral unchanged');});
 const link=(over={})=>({type:'linkPlanItems',personId:pid,version:p.personVersion,dependent:fu().refs[0],blocker:ref().refs[0],reason:'Home visit only after the CHC review.',...over});
 // Authority and input refusals.
 await send(w,link(),403);await send(a,link(),403);await send(x,link(),403);
 await send(c,link({version:p.personVersion+7}),409);
 await send(c,link({blocker:fu().refs[0]}),422);
 await send(c,link({reason:'short'}),422);
 const key=crypto.randomUUID(),made=await send(c,link(),200,key);check(()=>assert.ok(made.result.dependencyId));
 const again=await send(c,link(),200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.dependencyId,made.result.dependencyId);});
 p=await plan(s,pid);
 check(()=>{assert.equal(fu().attention,'waiting');assert.equal(fu().waitingOn[0].key,'referral:'+rid);assert.deepEqual(ref().blocks.map(b=>b.key),[fu().key]);assert.equal(p.waiting,1);assert.equal(p.dependencies[0].state,'waiting');});
 await send(s,link({dependent:ref().refs[0],blocker:fu().refs[0],reason:'Referral waits on the home visit.'}),422);
 const wp=await plan(w,pid);check(()=>{assert.equal(wp.canLink,false);assert.equal(wp.items.find(i=>i.kind==='follow-up').attention,'waiting','the ASHA sees the wait');});
 // Several sources on one referral.
 const version=()=>o.state.referrals.find(r=>r.id===rid).version??1;await get(o,'/api/workspace',200,org);
 const source=(over={})=>({type:'linkReferralSource',referralId:rid,version:version(),kind:'visit',sourceId:v2,note:'Second reading confirms the referral',...over});
 await send(w,source(),403);await send(a,source(),403);await send(x,source(),403);
 await send(c,source({sourceId:v1}),409);
 await send(c,source());await get(o,'/api/workspace',200,org);
 await send(s,source({kind:'programme-episode',sourceId:e1,note:'Maternal episode also needs this review'}));await get(o,'/api/workspace',200,org);
 await send(s,source({kind:'programme-episode',sourceId:e1,note:'Maternal episode also needs this review'}),409);
 check(()=>{const r=o.state.referrals.find(r=>r.id===rid);assert.deepEqual(r.sources.map(z=>[z.kind,z.refId]),[['visit',v2],['programme-episode',e1]]);assert.equal(r.version,3);});
 p=await plan(c,pid);check(()=>{assert.deepEqual(ref().sources.map(z=>z.link),['visit','visit','programme-episode']);assert.equal(fu().waitingOn[0].key,'referral:'+rid);});
 // Removal needs a reason and keeps the record.
 const unlink=(over={})=>({type:'unlinkPlanItems',personId:pid,version:p.personVersion,dependencyId:made.result.dependencyId,reason:'Home visit can go ahead before the review.',...over});
 await send(s,unlink({reason:'short'}),422);await send(w,unlink(),403);
 await send(s,unlink());
 p=await plan(s,pid);check(()=>{assert.equal(fu().attention,'upcoming');assert.equal(p.dependencies[0].state,'removed');assert.match(p.dependencies[0].removed.reason,/go ahead/);});
 await get(o,'/api/workspace',200,org);check(()=>{for(const action of ['linkPlanItems','unlinkPlanItems','linkReferralSource'])assert.ok(o.state.audit.some(e=>e.action===action&&e.personId===pid),action);});
}
