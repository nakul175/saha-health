import assert from 'node:assert/strict';
// Slice 4a: referral lifecycle, reasoned delay and escalation queue through the built Worker and local D1.
export async function referralSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,supervisor:s,admin:a}=accounts;
 const queue=async(who,status=200)=>{const r=await fetch(`${base}/api/referral-escalations`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const person=id=>o.state.people.find(p=>p.id===id);
 const pid=(await post(o,{type:'createPerson',name:`Referral Lifecycle ${crypto.randomUUID().slice(0,6)}`,age:41,sex:'Female',village:'Referral synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'150',diastolic:'96',weight:'60',temperature:'',weeks:'',coughDays:'',notes:'Synthetic raised blood pressure for referral lifecycle.',source:'measured'};
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts});
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version});
 const make=async facility=>(await post(o,{type:'createReferral',visitId:vid,facility,reason:'Synthetic raised blood pressure review'})).result.referralId;
 const rid=await make('Synthetic CHC'),r2=await make('Synthetic district hospital');
 const ref=id=>o.state.referrals.find(x=>x.id===id);
 const today=new Date().toISOString().slice(0,10),ago=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10),ahead=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 await post(o,{type:'assignReferral',referralId:rid,version:1,ownerId:o.id,due:ago(10),urgency:'urgent',reason:'Synthetic urgent review owner'});
 await post(o,{type:'assignReferral',referralId:rid,version:2,ownerId:o.id,due:ago(10),urgency:'critical',reason:'Invalid urgency attempt'},422);
 const ev=(event,over={})=>({type:'recordReferralEvent',referralId:rid,version:ref(rid).version,event,note:`Synthetic ${event} evidence`,source:'facility-reported',evidenceReference:`SYN-${event}`,occurredAt:new Date().toISOString(),confirmed:true,...over});
 await post(o,ev('attended'),409);
 await post(o,ev('sent'));
 // Escalation: urgent and ten days overdue.
 let q=await queue(s);let item=q.items.find(i=>i.referralId===rid);
 check(()=>{assert.equal(item.level,'escalated');assert.equal(item.urgency,'urgent');assert.ok(item.daysOverdue>=10);assert.match(item.reasons.join(),/overdue/);});
 q=await queue(w);check(()=>assert.equal(q.items.some(i=>i.referralId===rid),false,'an ASHA who does not own it does not see it'));
 await queue(a,403);
 await post(w,{type:'referralDelay',referralId:rid,version:ref(rid).version,due:ahead(7),constraint:'facility-capacity',reason:'Worker attempt to delay'},403);
 await post(o,{type:'referralDelay',referralId:rid,version:ref(rid).version,due:ago(20),constraint:'facility-capacity',reason:'Earlier date attempt'},422);
 await post(o,{type:'referralDelay',referralId:rid,version:ref(rid).version,due:ahead(7),constraint:'facility-capacity',reason:'Facility asked to rebook next week'});
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(ref(rid).due,ahead(7));assert.equal(ref(rid).delays.length,1);assert.equal(ref(rid).urgency,'urgent');});
 q=await queue(s);check(()=>assert.equal(q.items.some(i=>i.referralId===rid),false,'no longer escalated after a reasoned delay'));
 // Lifecycle: received, scheduled (appointment required), missed, rescheduled, attended, completed.
 await post(o,ev('received'));await get(o,'/api/workspace',200,org);
 await post(o,ev('scheduled'),422);
 await post(o,ev('attended',{appointmentAt:new Date().toISOString()}),422);
 await post(o,ev('scheduled',{appointmentAt:new Date(Date.now()+86400000).toISOString()}));await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(ref(rid).state,'scheduled');assert.ok(ref(rid).appointmentAt);});
 await post(o,ev('not-attended'));await get(o,'/api/workspace',200,org);
 await post(o,ev('scheduled',{appointmentAt:new Date(Date.now()+3*86400000).toISOString()}));await get(o,'/api/workspace',200,org);
 await post(o,ev('attended'));await get(o,'/api/workspace',200,org);
 await post(o,ev('completed'));await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(ref(rid).state,'completed');assert.deepEqual(ref(rid).events.map(e=>e.state),['sent','received','scheduled','not-attended','scheduled','attended','completed']);});
 await post(o,{type:'referralDelay',referralId:rid,version:ref(rid).version,due:ahead(30),constraint:'other',reason:'Delay after completion attempt'},409);
 await post(o,ev('unknown'),409);
 // Declined closes the referral and removes it from open work.
 await post(o,{type:'assignReferral',referralId:r2,version:1,ownerId:o.id,due:today,urgency:'emergency',reason:'Synthetic emergency owner'});
 const ev2=(event)=>({type:'recordReferralEvent',referralId:r2,version:ref(r2).version,event,note:`Synthetic ${event} evidence`,source:'facility-reported',evidenceReference:`SYN2-${event}`,occurredAt:new Date().toISOString(),confirmed:true});
 await get(o,'/api/workspace',200,org);
 q=await queue(s);check(()=>assert.match(q.items.find(i=>i.referralId===r2)?.reasons.join()??'',/not yet accepted/));
 await post(o,ev2('sent'));await get(o,'/api/workspace',200,org);
 await post(o,ev2('declined'));await get(o,'/api/workspace',200,org);
 check(()=>assert.equal(ref(r2).state,'declined'));
 q=await queue(s);check(()=>assert.equal(q.items.some(i=>i.referralId===r2),false));
 const cv=await fetch(`${base}/api/caseload?teamId=default&fromUserId=${encodeURIComponent(o.id)}`,{headers:{...s.headers,'x-saha-organisation':org}}).then(r=>r.json());
 check(()=>{const row=cv.preview.patients.find(p=>p.id===pid);assert.ok(row,'patient listed in the owner caseload');assert.equal(row.openWork,0,'completed and declined referrals are not open work');});
}
