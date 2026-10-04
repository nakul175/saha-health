import assert from 'node:assert/strict';
// Slice 2j: correction propagation tasks through the built Worker and local D1.
export async function correctionTasksSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts;
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 const read=async(who,path,status=200)=>{const r=await fetch(`${base}${path}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 await get(o,'/api/workspace',200,org);
 const tag=crypto.randomUUID().slice(0,6);
 const pid=(await send(o,{type:'createPerson',name:`Correction Synthetic ${tag}`,age:31,sex:'Female',village:`Correction locality ${tag}`,programme:'Maternal care',teamId:'default'})).result.personId;
 await send(o,{type:'assignPatient',personId:pid,version:o.state.people.find(p=>p.id===pid).version,teamId:'default',assignedTo:w.id,reason:'Assign for the correction propagation exercise'});
 const visit=id=>o.state.visits.find(v=>v.id===id);
 const confirmed=async n=>{await get(o,'/api/workspace',200,org);const id=(await send(o,{type:'startVisit',personId:pid})).result.visitId;await send(o,{type:'saveVisit',visitId:id,version:visit(id).version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:String(55+n),temperature:'',weeks:'20',coughDays:'',notes:`Synthetic correction visit ${n}`,source:'measured'}});await send(o,{type:'confirmVisit',visitId:id,version:visit(id).version});return id;};
 // Visit A: accepted by the maternal register simulator, with a referral made from it.
 const va=await confirmed(1);
 await send(o,{type:'preparePlan',visitId:va,recipients:['mis_maternal']});
 await send(o,{type:'approvePlan',visitId:va,planId:visit(va).plan.id,payloadHash:visit(va).plan.payloadHash});await send(o,{type:'executePlan',visitId:va,planId:visit(va).plan.id});
 const accepted=o.state.submissions.find(y=>y.visitId===va&&y.connectorId==='mis_maternal');
 check(()=>{assert.equal(accepted.state,'accepted');assert.ok(accepted.receipt);});
 const rid=(await send(o,{type:'createReferral',visitId:va,facility:'Synthetic CHC',reason:'Synthetic referral before the correction'})).result.referralId;
 // Visit B: prepared but never approved, then marked as recorded against the wrong patient.
 const vb=await confirmed(2);await send(o,{type:'preparePlan',visitId:vb,recipients:['mis_maternal']});
 const record=async id=>{await get(o,'/api/workspace',200,org);return visit(id).recordVersion;};
 // The clinician amends visit A: every downstream output becomes a task; nothing is sent or recalled.
 await get(c,'/api/workspace',200,org);
 const amend=(await send(c,{type:'amendVisit',visitId:va,version:await record(va),reason:'Weight was entered in the wrong field'})).result.visitId;
 await get(o,'/api/workspace',200,org);
 const tasks=visit(va).correctionTasks,t=kind=>tasks.filter(y=>y.output.kind===kind);
 check(()=>{assert.ok(Array.isArray(tasks)&&tasks.length>=4,JSON.stringify(tasks?.map(y=>y.output.kind)));assert.ok(tasks.every(y=>y.cause==='amend'&&y.correctionVisitId===amend&&y.ownerId===c.id&&y.visitId===va));});
 check(()=>{const [sub]=t('programme-submission');assert.equal(sub.output.refId,accepted.id);assert.equal(sub.action,'manual-correction','the simulator has no correction path');assert.equal(sub.external,true);assert.equal(sub.state,'open');assert.equal(sub.output.receipt,accepted.receipt);});
 check(()=>{assert.equal(t('referral')[0].output.refId,rid);assert.equal(t('referral')[0].action,'review');assert.equal(t('worker-activity')[0].state,'done');assert.equal(t('indicator-releases').length,1);});
 check(()=>{const after=o.state.submissions.find(y=>y.id===accepted.id);assert.equal(after.state,'accepted');assert.equal(after.receipt,accepted.receipt,'the receipt is not rewritten');});
 check(()=>{const ev=o.state.audit.find(e=>e.action==='amendVisit'&&e.subject===va);assert.ok(ev,'amendment audited');assert.match(ev.detail,/downstream outputs? recorded as correction tasks \(\d+ open\)/);});
 // Void of visit B: the unapproved plan is invalidated, recorded as done.
 await send(c,{type:'voidVisit',visitId:vb,version:await record(vb),reason:'Recorded against the wrong person in the household'});
 await get(o,'/api/workspace',200,org);
 check(()=>{const bt=visit(vb).correctionTasks;assert.ok(bt.some(y=>y.output.kind==='plan'&&y.action==='invalidated'&&y.state==='done'));assert.ok(bt.every(y=>y.cause==='void'&&y.correctionVisitId===null));});
 const open=tasks.filter(y=>y.state==='open').length+visit(vb).correctionTasks.filter(y=>y.state==='open').length;
 // Action plan and exception queue show each open task with owner, age and link.
 let plan=await read(s,`/api/action-plan?personId=${encodeURIComponent(pid)}`);
 const items=()=>plan.items.filter(i=>i.kind==='correction');
 check(()=>{assert.equal(items().length,open);const sub=items().find(i=>i.correction.outputKind==='programme-submission');assert.ok(sub);assert.equal(sub.owner.userId,c.id);assert.equal(sub.correction.external,true);assert.equal(sub.correction.canClose,true);assert.equal(sub.correction.ageDays,0);assert.equal(sub.correction.href,`/?patient=${encodeURIComponent(pid)}&visit=${encodeURIComponent(va)}`);assert.equal(sub.urgency,'urgent');});
 let q=await read(s,'/api/exceptions');
 const rows=()=>q.items.filter(r=>r.kind==='correction-task'&&r.patient?.id===pid);
 check(()=>{assert.equal(q.rulesVersion,'1.4.0');assert.equal(rows().length,open);const r=rows().find(y=>y.severity==='high');assert.ok(r,'external task is high severity');assert.equal(r.link.visitId,va);assert.match(r.owner,/./);assert.equal(r.ageDays,0);assert.match(r.recovery,/Close it from the patient's action plan/);});
 const adminRows=await read(a,'/api/exceptions');check(()=>assert.equal(adminRows.items.some(r=>r.kind==='correction-task'),false,'administrators see no correction rows'));
 await read(w,'/api/exceptions',403);
 // Closing needs scope and evidence.
 const subTask=t('programme-submission')[0],refTask=t('referral')[0];
 const closing=(taskId,extra={})=>({type:'closeCorrectionTask',personId:pid,visitId:va,taskId,...extra});
 await send(a,closing(refTask.id,{reason:'Synthetic administrator attempt'}),403);
 await send(x,closing(refTask.id,{reason:'Synthetic stranger attempt'}),403);
 await send(c,closing(refTask.id),422);
 await send(c,closing(subTask.id,{receiptId:accepted.receipt}),422);
 await send(c,closing(refTask.id,{reason:'short'}),422);
 // Manual correction with the destination, recorded with a reference and a reason; replay returns the same result.
 const key=crypto.randomUUID();
 const first=await send(c,closing(subTask.id,{reference:`MIS-${tag}`,reason:'Register corrected by the programme office on request.'}),200,key);
 const again=await send(c,closing(subTask.id,{reference:`MIS-${tag}`,reason:'Register corrected by the programme office on request.'}),200,key);
 check(()=>{assert.deepEqual(first.result,{taskId:subTask.id,state:'closed',verified:false});assert.deepEqual(again.result,first.result);});
 await send(c,closing(subTask.id,{reason:'A second closing attempt for the same task.'}),409);
 // The assigned ASHA closes the referral review; the supervisor reads the shorter queue.
 await get(w,'/api/workspace',200,org);await send(w,closing(refTask.id,{reason:'Referral still applies after the corrected weight.'}));
 await get(o,'/api/workspace',200,org);
 check(()=>{const after=visit(va).correctionTasks;const st=after.find(y=>y.id===subTask.id);assert.equal(st.state,'closed');assert.equal(st.closed.by,c.id);assert.equal(st.closed.reference,`MIS-${tag}`);assert.equal(st.closed.verified,false);assert.equal(after.find(y=>y.id===refTask.id).closed.by,w.id);});
 check(()=>{const ev=o.state.audit.filter(e=>e.action==='closeCorrectionTask'&&e.personId===pid);assert.equal(ev.length,2,'one audit line per close, none for the replay');assert.match(ev.find(e=>/MIS-/.test(e.detail)).detail,/not changed/);});
 check(()=>{const after=o.state.submissions.find(y=>y.id===accepted.id);assert.equal(after.state,'accepted');assert.equal(after.receipt,accepted.receipt);});
 plan=await read(s,`/api/action-plan?personId=${encodeURIComponent(pid)}`);q=await read(s,'/api/exceptions');
 check(()=>{assert.equal(items().length,open-2);assert.equal(rows().length,open-2);});
 // Stored rows: the tasks live in the earlier visit's own record.
 const stored=sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,va);
 check(()=>{const d=JSON.parse(stored.data);assert.equal(d.correctionTasks.length,tasks.length);assert.equal(d.correctionTasks.filter(y=>y.state==='closed').length,2);});
}
