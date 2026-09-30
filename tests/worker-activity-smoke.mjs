import assert from 'node:assert/strict';
// Slice 4c: worker activity evidence for supervisors through the built Worker and local D1.
export async function workerActivitySmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c,stranger:x}=accounts;
 const read=async(who,q='?days=30',status=200)=>{const r=await fetch(`${base}/api/worker-activity${q}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const as=(who,body,status=200)=>post(who,body,status,crypto.randomUUID(),org);
 await get(o,'/api/workspace',200,org);
 const tag=crypto.randomUUID().slice(0,6),village=`Activity locality ${tag}`;
 const pid=(await post(o,{type:'createPerson',name:`Activity Synthetic ${tag}`,age:26,sex:'Female',village,programme:'Maternal care',teamId:'default'})).result.personId;
 await post(o,{type:'assignPatient',personId:pid,version:o.state.people.find(p=>p.id===pid).version,teamId:'default',assignedTo:w.id,reason:'Assign for the activity evidence exercise'});
 // An outreach round planned by the supervisor before the visits.
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const planId=(await as(s,{type:'outreachCreate',title:`Activity round ${tag}`,date,teamId:'default',ownerId:w.id,personIds:[pid],criteria:'Synthetic case for the worker activity exercise.'})).result.planId;
 await as(s,{type:'outreachTransition',planId,version:1,state:'scheduled',reason:'Schedule the activity evidence round'});
 // Three visits confirmed by the ASHA.
 const facts=n=>({date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:String(50+n),temperature:'',weeks:'18',coughDays:'',notes:`Synthetic activity visit ${n}`,source:'measured'});
 const visit=id=>w.state.visits.find(v=>v.id===id);
 const confirmed=async n=>{await get(w,'/api/workspace',200,org);const id=(await as(w,{type:'startVisit',personId:pid})).result.visitId;await as(w,{type:'saveVisit',visitId:id,version:visit(id).version,facts:facts(n)});await as(w,{type:'confirmVisit',visitId:id,version:visit(id).version});return id;};
 const va=await confirmed(1),vb=await confirmed(2),vc=await confirmed(3);
 await as(w,{type:'preparePlan',visitId:va,recipients:['mis_maternal']});const plan=visit(va).plan;
 await as(w,{type:'approvePlan',visitId:va,planId:plan.id,payloadHash:plan.payloadHash});await as(w,{type:'executePlan',visitId:va,planId:plan.id});
 // Corrections by the owner (a clinician): one wrong-patient mark and one amendment.
 const record=async id=>{await get(o,'/api/workspace',200,org);return o.state.visits.find(v=>v.id===id).recordVersion;};
 await post(o,{type:'voidVisit',visitId:vb,version:await record(vb),reason:'Recorded against the wrong person in the household'});
 await post(o,{type:'amendVisit',visitId:vc,version:await record(vc),reason:'Weight entered in the wrong field'});
 // The ASHA records the outreach item completed with the first visit as evidence.
 let report=await get(s,'/api/outreach',200,org);const item=report.plans.find(p=>p.id===planId).items[0];
 await as(w,{type:'outreachRecord',planId,itemId:item.id,version:report.plans.find(p=>p.id===planId).version,state:'completed',note:'Visit completed in the household',reference:`ACT-${tag}`,visitId:va});
 // Who may review.
 await read(w,'?days=30',403);await read(a,'?days=30',403);await read(c,'?days=30',403);await read(x,'?days=30',403);await read(s,'?days=14',422);
 let v=await read(s),mine=()=>v.workers.find(r=>r.userId===w.id),items=()=>mine().items.filter(i=>i.personId===pid);
 check(()=>{assert.match(v.notice,/not a payment claim/);assert.deepEqual(v.teams.map(t=>t.id),['default']);assert.ok(mine());assert.equal(mine().role,'asha');});
 check(()=>{const i=items().find(i=>i.ref===va);assert.equal(i.status,'performed');assert.equal(i.submission,'accepted');assert.match(i.receipt,/^SIM-/);});
 check(()=>{const i=items().find(i=>i.ref===vb);assert.equal(i.status,'wrong-patient');assert.match(i.trace,new RegExp(`by ${o.state.user.displayName} on \\d{4}-\\d{2}-\\d{2}: Recorded against the wrong person in the household`));});
 check(()=>{const i=items().find(i=>i.ref===vc);assert.equal(i.status,'corrected');assert.match(i.trace,/Weight entered in the wrong field\. The correction is still a draft/);});
 check(()=>{const i=items().find(i=>i.kind==='outreach');assert.equal(i.status,'verified');assert.match(i.trace,new RegExp(`reference ACT-${tag}`));});
 check(()=>{assert.equal(JSON.stringify(v).includes(village),false,'no location in the evidence');assert.ok(mine().counts.performed>=1);assert.ok(mine().counts.submitted>=1);assert.ok(mine().counts.verified>=1);});
 const owner=await read(o);check(()=>assert.ok(owner.workers.some(r=>r.userId===w.id)));
 // Acceptance: marking the evidenced visit wrong-patient updates the derived claim and keeps the trace.
 const before=mine().counts;
 await post(o,{type:'voidVisit',visitId:va,version:await record(va),reason:'Late wrong-patient finding for the first visit'});
 v=await read(s);
 check(()=>{const i=items().find(i=>i.ref===va),claim=items().find(i=>i.kind==='outreach');assert.equal(i.status,'wrong-patient');assert.match(i.trace,/Late wrong-patient finding/);assert.equal(claim.status,'unverified');assert.equal(mine().counts.performed,before.performed-1);assert.equal(mine().counts.submitted,before.submitted-1);assert.equal(mine().counts.verified,before.verified-1);});
}
