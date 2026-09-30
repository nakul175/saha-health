import assert from 'node:assert/strict';
// Slice 4b: per-patient action plan and ownership command through the built Worker and local D1.
export async function actionPlanSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const plan=async(who,personId,status=200)=>{const r=await fetch(`${base}/api/action-plan?${new URLSearchParams(personId==null?{}:{personId})}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 // An earlier module leaves the administrator suspended; restore it so refusals below test the role, not a lapsed membership.
 await get(o,'/api/workspace',200,org);const adm=o.state.members.find(m=>m.userId===a.id);if(adm.status!=='active')await send(o,{type:'updateMember',userId:a.id,version:adm.version,role:'admin',teamIds:[],isOwner:false,status:'active',reason:'Restore synthetic administrator for action-plan scope checks'});
 const pid=(await send(o,{type:'createPerson',name:`Action Plan ${crypto.randomUUID().slice(0,6)}`,age:29,sex:'Female',village:'Action plan synthetic locality',programme:'Maternal care',teamId:'default'})).result.personId;
 const me=()=>o.state.people.find(p=>p.id===pid);
 await send(o,{type:'assignPatient',personId:pid,version:me().version,teamId:'default',assignedTo:w.id,reason:'Synthetic action plan patient assigned to the ASHA.'});
 // The visit is confirmed before enrolment so no programme questions apply to it.
 const vid=(await send(o,{type:'startVisit',personId:pid})).result.visitId;
 await send(o,{type:'saveVisit',visitId:vid,version:1,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'148',diastolic:'95',weight:'58',temperature:'',weeks:'20',coughDays:'',notes:'Synthetic action plan visit.',source:'measured'}});
 await get(o,'/api/workspace',200,org);
 await send(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version});
 const rid=(await send(o,{type:'createReferral',visitId:vid,facility:'Synthetic CHC',reason:'Synthetic raised blood pressure in pregnancy'})).result.referralId;
 const e1=(await send(o,{type:'enrolProgramme',personId:pid,version:me().version,packId:'maternal',episodeLabel:'Synthetic pregnancy episode',startDate:null})).result.enrolmentId;
 const e2=(await send(o,{type:'enrolProgramme',personId:pid,version:me().version,packId:'hypertension',episodeLabel:'Synthetic blood pressure episode',startDate:null})).result.enrolmentId;
 const due=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await send(o,{type:'scheduleFollowUp',personId:pid,version:me().version,enrolmentId:e1,title:'Home visit',due,ownerId:w.id});
 await send(o,{type:'scheduleFollowUp',personId:pid,version:me().version,enrolmentId:e2,title:'Home visit',due,ownerId:w.id});
 await send(o,{type:'scheduleFollowUp',personId:pid,version:me().version,enrolmentId:e2,title:'Medicine check',due,ownerId:w.id});
 // Reads and scope.
 let p=await plan(s,pid);
 const key=i=>i.key,merged=()=>p.items.find(i=>i.kind==='follow-up'&&i.sources.length===2),ref=()=>p.items.find(i=>i.key==='referral:'+rid);
 check(()=>{assert.equal(p.items.length,3,p.items.map(key).join());assert.equal(p.items[0].key,'referral:'+rid,'unowned referral first');assert.equal(ref().ownershipGap,'No named care worker');assert.match(ref().queue,/^Supervisors of /);assert.equal(p.unowned,1);assert.equal(p.canAssign,true);});
 check(()=>{assert.deepEqual(merged().sources.map(x=>x.programme).sort(),['Hypertension follow-up','Maternal care']);assert.equal(merged().targets.length,2);assert.ok(p.items.some(i=>i.title==='Medicine check'),'different work stays separate');});
 check(()=>{assert.ok(p.eligibleOwners.some(e=>e.userId===w.id)&&p.eligibleOwners.some(e=>e.userId===c.id));assert.equal(p.eligibleOwners.some(e=>e.userId===s.id),false,'supervisors are not care-task owners');});
 await plan(a,pid,403);await plan(x,pid,403);await plan(s,null,400);await plan(s,'p_missing_action_plan',404);
 const wp=await plan(w,pid);check(()=>{assert.equal(wp.canAssign,false);assert.deepEqual(wp.eligibleOwners.map(e=>e.userId),[w.id]);assert.equal(wp.items.find(i=>i.key==='referral:'+rid).canClaim,true);assert.equal(wp.items.find(i=>i.kind==='follow-up').canClaim,false);});
 // Ownership command.
 const assign=(over={})=>({type:'assignPlanItem',personId:pid,version:p.personVersion,targets:ref().targets,ownerId:w.id,reason:'Taking the unowned referral for follow-up.',...over});
 await send(w,assign({ownerId:c.id}),403);
 await send(a,assign(),403);
 await send(x,assign(),403);
 await send(w,assign({version:p.personVersion+5}),409);
 await send(w,assign({reason:'short'}),422);
 const claimKey=crypto.randomUUID();
 const claimed=await send(w,assign(),200,claimKey);check(()=>assert.deepEqual(claimed.result,{assigned:1,ownerId:w.id}));
 const replay=await send(w,assign(),200,claimKey);check(()=>assert.equal(replay.replayed,true));
 p=await plan(s,pid);check(()=>{assert.equal(ref().owner.userId,w.id);assert.equal(ref().ownershipGap,null);assert.equal(p.unowned,0);});
 await send(w,{...assign(),targets:merged().targets,ownerId:w.id},403);
 await send(s,{...assign(),targets:merged().targets,ownerId:c.id,reason:'Clinician takes the combined home visit.'});
 p=await plan(c,pid);check(()=>{assert.equal(merged().owner.userId,c.id);assert.equal(merged().sources.length,2);});
 await get(o,'/api/workspace',200,org);check(()=>{assert.ok(o.state.audit.some(e=>e.action==='assignPlanItem'&&/Ownership taken/.test(e.detail)));assert.ok(o.state.audit.some(e=>e.action==='assignPlanItem'&&/^Reassigned to /.test(e.detail)));});
}
