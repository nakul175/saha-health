import assert from 'node:assert/strict';
// Slice 10f: household visit slots and cross-pack referral consolidation through the built Worker and local D1.
export async function householdVisitSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,stranger:x}=accounts;
 const send=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 const view=async(who,personId,status=200)=>{const r=await fetch(`${base}/api/household?${new URLSearchParams({personId})}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const plan=async(who,personId)=>{const r=await fetch(`${base}/api/action-plan?${new URLSearchParams({personId})}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j).slice(0,300)));return j;};
 const tag=crypto.randomUUID().slice(0,6),person=id=>o.state.people.find(p=>p.id===id),day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const make=async(name,age,programme)=>(await send(o,{type:'createPerson',name:`${name} ${tag}`,age,sex:'Unknown',village:'Household visit synthetic locality',programme,teamId:'default'})).result.personId;
 const A=await make('Visit Alpha',29,'Maternal care'),B=await make('Visit Bravo',6,'Child health'),C=await make('Visit Charlie SECRETNAME',52,'General care');
 const hid=(await send(o,{type:'householdCreate',personId:A,version:person(A).version,label:'Synthetic visit household',relationship:'head'})).result.householdId;
 await send(o,{type:'householdAddMember',householdId:hid,version:1,personId:B,personVersion:person(B).version,relationship:'child'});
 await send(o,{type:'householdAddMember',householdId:hid,version:2,personId:C,personVersion:person(C).version,relationship:'other'});
 // The ASHA is assigned A and B only; C stays with the clinician, so C is outside the ASHA's scope.
 for(const id of [A,B])await send(o,{type:'assignPatient',personId:id,version:person(id).version,teamId:'default',assignedTo:w.id,reason:'Household visit synthetic assignment'});
 const enrol=async(id,packId,label)=>(await send(o,{type:'enrolProgramme',personId:id,version:person(id).version,packId,episodeLabel:label,startDate:null})).result.enrolmentId;
 const e1=await enrol(A,'maternal','Synthetic visit pregnancy'),e2=await enrol(A,'tb','Synthetic visit TB screening'),e3=await enrol(A,'hypertension','Synthetic visit hypertension'),eB=await enrol(B,'tb','Synthetic child contact screening'),eC=await enrol(C,'hypertension','Synthetic Charlie hypertension');
 const follow=async(id,enrolmentId,title,due,ownerId)=>(await send(o,{type:'scheduleFollowUp',personId:id,version:person(id).version,enrolmentId,title,due,ownerId})).result.taskId;
 const fA1=await follow(A,e1,'Weigh and blood pressure',day(-2),w.id),fA2=await follow(A,e2,'Sputum test follow-up',day(3),w.id),fB=await follow(B,eB,'Child contact check',day(1),w.id),fC=await follow(C,eC,'Charlie private follow-up',day(2),o.id);
 await get(w,'/api/workspace',200,org);
 // ---- The household visit plan, as the ASHA: A and B in one place, C counted and never named.
 let hw=await view(w,A);
 check(()=>{const p=hw.visitPlan;assert.deepEqual(p.members.map(m=>m.personId).sort(),[A,B].sort());assert.equal(p.outsideScope,1);assert.ok(!/SECRETNAME|Charlie private/.test(JSON.stringify(hw)),'the out-of-scope member is not named or itemised');
  const ma=p.members.find(m=>m.personId===A);assert.equal(ma.items.filter(i=>i.key.startsWith('follow-up')).length,2);assert.ok(ma.items.some(i=>i.key==='home-visit:'+A));
  const overdue=ma.items.find(i=>i.key==='follow-up:'+fA1);assert.equal(overdue.attention,'overdue');assert.deepEqual(overdue.programmes,['Maternal care']);assert.equal(p.canSchedule,true);assert.deepEqual(p.visits,[]);});
 const cover=(personId,...items)=>({personId,items});
 const sched=(over={})=>({type:'householdVisitSchedule',householdId:hid,version:hw.visitPlan.householdVersion,date:day(2),window:'morning',covers:[cover(A,{kind:'follow-up',id:fA1},{kind:'follow-up',id:fA2}),cover(B,{kind:'follow-up',id:fB})],...over});
 // Refusals: authority, scope, stale version, bad input; each wrote nothing.
 await send(a,sched(),403);await send(s,sched(),403);await send(x,sched(),403);
 await send(w,sched({covers:[cover(C,{kind:'follow-up',id:fC})]}),422);
 await send(w,sched({covers:[cover('not-a-member',{kind:'follow-up',id:fC})]}),422);
 await send(w,sched({covers:[cover(A,{kind:'follow-up',id:fB})]}),422);
 await send(w,sched({version:hw.visitPlan.householdVersion+9}),409);
 await send(w,sched({date:day(-1)}),422);await send(w,sched({date:day(120)}),422);
 await send(w,{...sched(),note:'Bring the card for the pregnant member'},422);
 await send(w,sched({covers:[]}),422);
 hw=await view(w,A);check(()=>assert.deepEqual(hw.visitPlan.visits,[]));
 // One slot covering both members; due dates, owners and states are unchanged.
 const key=crypto.randomUUID(),made=await send(w,sched(),200,key);check(()=>{assert.equal(made.result.members,2);assert.equal(made.result.items,3);});
 const again=await send(w,sched(),200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.visitId,made.result.visitId);});
 await get(o,'/api/workspace',200,org);
 check(()=>{const pa=person(A),f=id=>pa.followUps.find(t=>t.id===id);assert.equal(f(fA1).due,day(-2));assert.equal(f(fA1).state,'open');assert.equal(f(fA2).ownerId,w.id);assert.equal(person(B).followUps.find(t=>t.id===fB).state,'open');});
 hw=await view(w,A);
 check(()=>{const p=hw.visitPlan,slot=p.visits[0];assert.equal(p.visits.length,1);assert.equal(slot.date,day(2));assert.equal(slot.window,'morning');assert.equal(slot.state,'planned');assert.equal(slot.canCancel,true);assert.equal(slot.outsideScopeCovered,0);
  const ca=slot.covers.find(c=>c.personId===A),late=ca.items.find(i=>i.id===fA1);assert.equal(late.lateByDays,4,'due 2 days ago, slot in 2 days: late by 4 days');assert.equal(ca.items.find(i=>i.id===fA2).lateByDays,0);assert.equal(ca.stillOpen,2);
  assert.equal(p.members.find(m=>m.personId===A).items.find(i=>i.key==='follow-up:'+fA1).covered.visitId,made.result.visitId);assert.equal(p.members.find(m=>m.personId===A).items.find(i=>i.key==='home-visit:'+A).covered,null);});
 // An item in a planned slot cannot be planned again; a stale or foreign slot cannot be cancelled by the wrong person.
 await send(w,sched({date:day(4),covers:[cover(A,{kind:'follow-up',id:fA1})],version:hw.visitPlan.householdVersion}),409);
 // A clinician plans a second slot covering A's routine visit and C (outside the ASHA's scope).
 hw=await view(o,A);check(()=>{assert.deepEqual(hw.visitPlan.members.map(m=>m.personId).sort(),[A,B,C].sort());assert.equal(hw.visitPlan.outsideScope,0);});
 const second=await send(o,{type:'householdVisitSchedule',householdId:hid,version:hw.visitPlan.householdVersion,date:day(5),window:'afternoon',covers:[cover(A,{kind:'home-visit',id:A}),cover(C,{kind:'follow-up',id:fC})]});
 hw=await view(w,A);
 check(()=>{const slot=hw.visitPlan.visits.find(v=>v.id===second.result.visitId);assert.ok(slot);assert.deepEqual(slot.covers.map(c=>c.personId),[A]);assert.equal(slot.outsideScopeCovered,1);assert.equal(slot.canCancel,false);assert.ok(!/SECRETNAME|Charlie private/.test(JSON.stringify(hw)),'still not named');});
 // Authority to cancel: the ASHA did not plan the clinician's slot and is not a steward; a supervisor of the team may.
 const cancel=(visitId,reason='rescheduled',over={})=>({type:'householdVisitCancel',householdId:hid,version:hw.visitPlan.householdVersion,visitId,reason,...over});
 await send(w,cancel(second.result.visitId),403);await send(x,cancel(second.result.visitId),403);await send(a,cancel(second.result.visitId),403);
 await send(w,cancel(made.result.visitId,'because I said so'),422);await send(w,cancel(made.result.visitId,'rescheduled',{version:hw.visitPlan.householdVersion+5}),409);
 await send(w,cancel(made.result.visitId,'household-unavailable'));
 hw=await view(w,A);check(()=>{const slot=hw.visitPlan.visits.find(v=>v.id===made.result.visitId);assert.equal(slot.state,'cancelled');assert.equal(slot.cancelReason,'household-unavailable');assert.equal(hw.visitPlan.members.find(m=>m.personId===A).items.find(i=>i.key==='follow-up:'+fA1).covered,null);});
 hw=await view(w,A);await send(w,cancel(made.result.visitId),409);
 const redo=await send(w,sched({version:hw.visitPlan.householdVersion,covers:[cover(A,{kind:'follow-up',id:fA1})]}));check(()=>assert.equal(redo.result.items,1));
 hw=await view(w,A);await send(s,cancel(second.result.visitId,'no-longer-needed'));
 // Each member's audit line names only that member's own items.
 const lines=id=>sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='householdVisitSchedule' AND person_id=?").all(org,id).map(r=>r.detail);
 check(()=>{assert.ok(lines(A).length>=2);assert.ok(lines(A).some(d=>d.includes('Weigh and blood pressure')&&d.includes('Sputum test follow-up')));assert.ok(lines(A).every(d=>!/Child contact|Charlie/.test(d)));assert.ok(lines(B).every(d=>d.includes('Child contact check')&&!/Weigh|Sputum|Charlie/.test(d)));assert.ok(lines(C).every(d=>d.includes('Charlie private follow-up')&&!/Weigh|Child contact/.test(d)));
  assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='householdVisitCancel' AND person_id=?").get(org,A).n>=2);});

 // ---- Cross-pack referral consolidation: one confirmed visit, three programme episodes.
 await get(o,'/api/workspace',200,org);
 const vid=(await send(o,{type:'startVisit',personId:A})).result.visitId,v=()=>o.state.visits.find(z=>z.id===vid);
 check(()=>assert.equal(v().programmeCapture.packs.length,3));
 await send(o,{type:'saveVisit',visitId:vid,version:v().version,facts:{...v().facts,notes:'Synthetic multi-programme household visit',weight:'58',systolic:'148',diastolic:'96'}});
 await send(o,{type:'saveProgrammeAnswers',visitId:vid,version:v().version,answers:{maternal_contact:'Yes',cough:'No',testing:'No',medication_access:'Available'},absence:{weeks:'Unknown'}});
 const ask=(enrolmentId,over={})=>({enrolmentId,need:'blood-pressure-review',facility:'Synthetic CHC',reason:'Raised blood pressure at the household visit',...over});
 const consolidate=(requests,visitId=vid)=>({type:'createProgrammeReferrals',visitId,requests});
 await send(o,consolidate([ask(e1)]),409);// a draft visit cannot raise referrals
 await send(o,{type:'confirmVisit',visitId:vid,version:v().version});
 await send(a,consolidate([ask(e1)]),403);await send(s,consolidate([ask(e1)]),403);await send(x,consolidate([ask(e1)]),403);
 await send(o,consolidate([ask(eB)]),422);await send(o,consolidate([ask('unknown-episode')]),422);
 await send(o,consolidate([ask(e1,{need:'other'})]),422);await send(o,consolidate([ask(e1,{reason:'no'})]),422);
 const countBefore=(await get(o,'/api/workspace',200,org)).referrals.length;
 const first=await send(w,consolidate([ask(e1),ask(e2,{facility:'  synthetic   chc ',reason:'The TB programme found the same raised blood pressure'})]));
 check(()=>{assert.equal(first.result.created,1);assert.equal(first.result.consolidated,0);assert.deepEqual(first.result.referrals[0].packs,['Maternal care v1','TB screening v1']);});
 let ws=await get(o,'/api/workspace',200,org);
 check(()=>assert.equal(ws.referrals.length,countBefore+1,'two packs, one referral'));
 const rid=first.result.referrals[0].referralId;
 const joined=await send(o,consolidate([ask(e3,{facility:'SYNTHETIC CHC'}),ask(e3,{need:'nutrition-review',reason:'Weight loss reported at the same visit'})]));
 check(()=>{assert.equal(joined.result.created,1);assert.equal(joined.result.consolidated,1);assert.equal(joined.result.referrals.find(r=>r.outcome==='consolidated').referralId,rid);});
 await send(o,consolidate([ask(e3)]),409);
 ws=await get(o,'/api/workspace',200,org);
 check(()=>{const mine=ws.referrals.filter(r=>r.visitId===vid&&r.need),bp=mine.find(r=>r.id===rid);assert.equal(mine.length,2,'distinct needs stay distinct referrals');assert.equal(ws.referrals.length,countBefore+2);
  assert.deepEqual(bp.need,{code:'blood-pressure-review',label:'Blood pressure review'});assert.equal(bp.version,2);assert.equal(bp.state,'draft');assert.deepEqual(bp.packRequests.map(r=>r.packId).sort(),['hypertension','maternal','tb']);
  assert.deepEqual(bp.sources.map(z=>z.refId).sort(),[e1,e2,e3].sort());assert.ok(bp.sources.every(z=>z.kind==='programme-episode'));assert.ok(bp.packRequests.every(r=>bp.sources.some(z=>z.id===r.sourceId)));
  assert.equal(mine.find(r=>r.id!==rid).need.code,'nutrition-review');});
 const p=await plan(s,A);
 check(()=>{const item=p.items.find(i=>i.key==='referral:'+rid);assert.deepEqual(item.sources.map(z=>z.label.replace(/ · .*/,'')),['Referral','Asked by Maternal care v1','Asked by TB screening v1','Asked by Hypertension follow-up v1']);});
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='createProgrammeReferrals' AND person_id=?").get(org,A).n,3));
}
