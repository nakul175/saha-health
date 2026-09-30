import assert from 'node:assert/strict';
// Slice 6i: item-level exception queue through the built Worker and local D1.
export async function exceptionsSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const queue=async(who,status=200)=>{const r=await fetch(`${base}/api/exceptions`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const send=(who,body,status=200)=>post(who,body,status,crypto.randomUUID(),org);
 const pid=(await send(o,{type:'createPerson',name:`Exception Queue ${crypto.randomUUID().slice(0,6)}`,age:52,sex:'Male',village:'Exception synthetic locality',programme:'TB screening',teamId:'default'})).result.personId;
 const me=()=>o.state.people.find(p=>p.id===pid);
 await send(o,{type:'assignPatient',personId:pid,version:me().version,teamId:'default',assignedTo:w.id,reason:'Synthetic exception patient assigned to the ASHA.'});
 const vid=(await send(o,{type:'startVisit',personId:pid})).result.visitId;
 await send(o,{type:'saveVisit',visitId:vid,version:1,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'51',temperature:'',weeks:'',coughDays:'21',notes:'Synthetic exception queue visit.',source:'reported'}});
 await get(o,'/api/workspace',200,org);
 await send(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version});
 const rid=(await send(o,{type:'createReferral',visitId:vid,facility:'Synthetic TB unit',reason:'Synthetic prolonged cough review'})).result.referralId;
 const ago=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10),ahead=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 await send(o,{type:'assignReferral',referralId:rid,version:1,ownerId:o.id,due:ago(6),urgency:'urgent',reason:'Synthetic overdue owner'});
 const eid=(await send(o,{type:'enrolProgramme',personId:pid,version:me().version,packId:'tb',episodeLabel:'Synthetic TB screening episode',startDate:null})).result.enrolmentId;
 await send(o,{type:'scheduleFollowUp',personId:pid,version:me().version,enrolmentId:eid,title:'Sputum sample check',due:ago(3),ownerId:w.id});
 const fid=me().followUps.find(f=>f.title==='Sputum sample check').id;
 // Supervisor: item rows for the team, with links to the patient and visit.
 let q=await queue(s);const row=id=>q.items.find(i=>i.id===id);
 check(()=>{const r=row('referral-overdue:'+rid);assert.ok(r,'overdue referral listed');assert.equal(r.severity,'high');assert.equal(r.patient.id,pid);assert.deepEqual(r.link,{personId:pid,visitId:vid,href:`/?patient=${encodeURIComponent(pid)}&visit=${encodeURIComponent(vid)}`});assert.match(r.what,/urgent referral overdue by 6 days/);assert.ok(r.ageDays>=6);assert.match(r.recovery,/reasoned delay/);});
 check(()=>{const f=row('follow-up-overdue:'+fid);assert.ok(f,'overdue follow-up listed');assert.equal(f.link.href,`/?patient=${encodeURIComponent(pid)}`);assert.match(f.what,/TB screening follow-up "Sputum sample check"/);assert.equal(f.owner.startsWith('Supervisors'),false,'named owner with access');});
 check(()=>{assert.equal(q.total,Object.values(q.counts).reduce((n,v)=>n+v,0));assert.ok(q.items.every(i=>i.patient&&i.link),'supervisor rows are all in scope');assert.equal(q.rulesVersion,'1.0.0');});
 // Scope: administrators get delivery rows without patient details; care roles and strangers are refused.
 const qa=await queue(a);check(()=>{assert.ok(qa.items.every(i=>['submission','ehr-publication'].includes(i.kind)&&i.patient===null&&i.link===null));assert.equal(JSON.stringify(qa).includes('Exception Queue'),false);});
 await queue(w,403);await queue(c,403);await queue(x,403);
 const qo=await queue(o);check(()=>assert.ok(qo.items.some(i=>i.id==='referral-overdue:'+rid)));
 // Recovery clears the row: a reasoned delay ends the escalation; completing the follow-up removes it.
 await send(o,{type:'referralDelay',referralId:rid,version:o.state.referrals.find(r=>r.id===rid).version,due:ahead(5),constraint:'awaiting-results',reason:'Waiting for the synthetic sputum result'});
 await send(o,{type:'resolveFollowUp',personId:pid,version:me().version,taskId:fid,state:'completed',resolution:'Synthetic sample collected'});
 q=await queue(s);check(()=>{assert.equal(row('referral-overdue:'+rid),undefined);assert.equal(row('follow-up-overdue:'+fid),undefined);});
}
