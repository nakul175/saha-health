import assert from 'node:assert/strict';
// Slice 1b: workforce lifecycle and bulk caseload transfer through the built Worker and local D1.
export async function caseloadSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c}=accounts;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${label}@example.invalid`},state:null};};
 const r=synthetic('asha-receiver'),q=synthetic('asha-leaver');
 const view=async(who,query={},status=200)=>{const res=await fetch(`${base}/api/caseload?${new URLSearchParams(query)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await res.json();check(()=>assert.equal(res.status,status,JSON.stringify(j)));return j;};
 for(const who of [r,q]){await get(who);const i=await post(o,{type:'createInvite',accountCode:who.state.user.accountCode,label:'Synthetic ASHA',role:'asha',teamIds:['default']});await post(who,{type:'joinOrganisation',token:i.result.token});}
 await get(o,'/api/workspace',200,org);
 const person=id=>o.state.people.find(p=>p.id===id);
 const make=async name=>(await post(o,{type:'createPerson',name:`${name} ${crypto.randomUUID().slice(0,6)}`,age:40,sex:'Unknown',village:'Caseload synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const ids=[await make('Caseload A'),await make('Caseload B'),await make('Caseload C')];
 // An urgent follow-up on A, owned by the owner before assignment moves it to the worker.
 await post(o,{type:'enrolProgramme',personId:ids[0],version:person(ids[0]).version,packId:'maternal',episodeLabel:'Synthetic caseload episode',startDate:null});
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 await post(o,{type:'scheduleFollowUp',personId:ids[0],version:person(ids[0]).version,enrolmentId:person(ids[0]).enrolments.find(e=>e.state==='active').id,title:'Urgent synthetic check',due:tomorrow,ownerId:o.id});
 await get(s,'/api/workspace',200,org);
 for(const id of ids){const p=s.state.people.find(p=>p.id===id);await post(s,{type:'assignPatient',personId:id,version:p.version,teamId:'default',assignedTo:q.id,reason:'Synthetic caseload for the leaver'});}
 // Views.
 let v=await view(s);
 check(()=>{assert.equal(v.steward,true);const leaver=v.workers.find(x=>x.userId===q.id);assert.equal(leaver.patients,3);assert.ok(leaver.urgent>=1);assert.ok(v.rules.includes('Urgent'));});
 const pv=(await view(s,{teamId:'default',fromUserId:q.id})).preview;
 check(()=>{assert.deepEqual(pv.patients.map(p=>p.id).sort(),[...ids].sort());assert.ok(pv.patients.some(p=>p.urgent>0));assert.ok(pv.recipients.some(x=>x.userId===r.id));assert.equal(pv.recipients.some(x=>x.userId===q.id),false);assert.equal(pv.recipients.some(x=>x.userId===s.id),false);});
 await view(a,{},403);
 await view(w,{teamId:'default',fromUserId:q.id},403);
 const wv=await view(w);check(()=>{assert.equal(wv.steward,false);assert.equal(wv.workers,undefined);});
 await view(s,{teamId:'default'},422);
 // Validation and authority.
 const body=(over={})=>({type:'caseloadTransfer',teamId:'default',fromUserId:q.id,toUserId:r.id,personIds:ids.slice(0,2),effectiveAt:null,reason:'Synthetic leave cover transfer',...over});
 await post(w,body(),403);await post(a,body(),403);await post(c,body(),403);
 await post(s,body({toUserId:a.id}),422);await post(s,body({toUserId:q.id}),422);await post(s,body({toUserId:s.id}),422);
 await post(s,body({personIds:[ids[0],ids[0]]}),422);
 await post(s,body({personIds:[ids[0],'p_meena']}),409);
 await post(s,body({effectiveAt:new Date(Date.now()-60000).toISOString()}),422);
 // Immediate transfer of A and B.
 const t1=await post(s,body());
 check(()=>{assert.equal(t1.result.state,'applied');assert.equal(t1.result.moved,2);});
 await get(r,'/api/workspace',200,org);await get(q,'/api/workspace',200,org);
 check(()=>{assert.deepEqual(r.state.people.map(p=>p.id).sort(),ids.slice(0,2).sort());assert.deepEqual(q.state.people.map(p=>p.id),[ids[2]]);const a0=r.state.people.find(p=>p.id===ids[0]);assert.ok(a0.followUps.every(f=>f.state!=='open'||f.ownerId===r.id));assert.equal(a0.assignmentHistory.at(-1).transferId,t1.result.transferId);});
 await post(q,{type:'startVisit',personId:ids[0]},403);
 // Receiving worker acknowledges; nobody else can.
 v=await view(r);const incoming=v.incoming.find(t=>t.id===t1.result.transferId);
 check(()=>{assert.ok(incoming);assert.equal(incoming.acknowledged,null);assert.equal(incoming.moved,2);});
 await post(s,{type:'caseloadAcknowledge',transferId:incoming.id,version:incoming.version,reference:'SYNTH-HANDOVER'},403);
 const ack=await post(r,{type:'caseloadAcknowledge',transferId:incoming.id,version:incoming.version,reference:'SYNTH-HANDOVER'});
 check(()=>assert.deepEqual(ack.result,{acknowledged:2,notAcknowledged:0}));
 await post(r,{type:'caseloadAcknowledge',transferId:incoming.id,version:incoming.version+1,reference:'SYNTH-AGAIN'},409);
 await get(r,'/api/workspace',200,org);check(()=>assert.equal(r.state.people.find(p=>p.id===ids[1]).assignmentHistory.at(-1).acknowledgement.reference,'SYNTH-HANDOVER'));
 // Scheduled transfer of C; overlapping schedule, early apply and cancel.
 const soon=new Date(Date.now()+6000).toISOString();
 const t2=await post(s,body({personIds:[ids[2]],effectiveAt:soon}));
 check(()=>assert.equal(t2.result.state,'scheduled'));
 await post(s,body({personIds:[ids[2]],effectiveAt:new Date(Date.now()+86400000).toISOString()}),409);
 await post(s,{type:'caseloadApply',transferId:t2.result.transferId,version:1},409);
 await post(o,{type:'removeMember',userId:q.id,version:o.state.members.find(m=>m.userId===q.id).version,reason:'Synthetic departure attempt'},409);
 await new Promise(done=>setTimeout(done,Math.max(0,Date.parse(soon)-Date.now())+500));
 // Slice 1f: the first use after the effective time applies the transfer automatically, so a manual apply is too late.
 await post(s,{type:'caseloadApply',transferId:t2.result.transferId,version:1},409);
 const applied=JSON.parse(sql.prepare('SELECT data FROM caseload_transfers WHERE org_id=? AND id=?').get(org,t2.result.transferId).data);
 check(()=>{assert.equal(applied.state,'applied');assert.deepEqual(applied.applied.moved,[ids[2]]);assert.deepEqual(applied.applied.skipped,[]);assert.equal(applied.applied.automatic,true);assert.equal(applied.version,2);});
 await post(s,{type:'caseloadCancel',transferId:t2.result.transferId,version:2,reason:'Too late to cancel synthetic'},409);
 const t3=await post(s,{...body({fromUserId:r.id,toUserId:q.id,personIds:[ids[2]],effectiveAt:new Date(Date.now()+86400000).toISOString()})});
 await post(s,{type:'caseloadCancel',transferId:t3.result.transferId,version:1,reason:'Synthetic change of plan'});
 v=await view(s);check(()=>{const x=v.transfers.find(t=>t.id===t3.result.transferId);assert.equal(x.state,'cancelled');assert.equal(v.transfers.find(t=>t.id===t2.result.transferId).state,'applied');});
 // Suspension leaves a visible gap; removal needs the caseload moved first.
 await get(o,'/api/workspace',200,org);
 let rm=o.state.members.find(m=>m.userId===r.id);
 await post(o,{type:'updateMember',userId:r.id,version:rm.version,role:'asha',teamIds:['default'],isOwner:false,status:'suspended',reason:'Synthetic suspension for gap check'});
 v=await view(s);check(()=>assert.ok(v.gaps.some(g=>ids.includes(g.personId)&&g.kind==='inactive-assignee')));
 await get(o,'/api/workspace',200,org);rm=o.state.members.find(m=>m.userId===r.id);
 const blocked=await post(o,{type:'removeMember',userId:r.id,version:rm.version,reason:'Synthetic departure'},409);
 check(()=>assert.match(blocked.error,/3 assigned patients/));
 await post(s,{type:'removeMember',userId:q.id,version:1,reason:'Supervisor attempt'},403);
 await post(o,{type:'removeMember',userId:o.id,version:o.state.members.find(m=>m.userId===o.id).version,reason:'Self removal attempt'},422);
 // A steward may move a suspended worker's caseload.
 const out=await post(s,body({fromUserId:r.id,toUserId:q.id,personIds:ids}));check(()=>assert.equal(out.result.moved,3));
 await post(o,{type:'removeMember',userId:r.id,version:rm.version,reason:'Synthetic departure'});
 await get(o,'/api/workspace',200,org);rm=o.state.members.find(m=>m.userId===r.id);
 check(()=>{assert.equal(rm.status,'removed');assert.deepEqual(rm.teamIds,[]);});
 await get(r,'/api/workspace',403,org);
 await post(o,{type:'updateMember',userId:r.id,version:rm.version,role:'asha',teamIds:['default'],isOwner:false,status:'active',reason:'Reactivate removed attempt'},409);
 // Return needs a new invitation.
 const back=await post(o,{type:'createInvite',accountCode:r.state.user.accountCode,label:'Returning synthetic ASHA',role:'asha',teamIds:['default']});
 await post(r,{type:'joinOrganisation',token:back.result.token});
 await get(r,'/api/workspace',200,org);check(()=>{assert.equal(r.state.membership.status,'active');assert.equal(r.state.people.length,0,'returning member gets no prior caseload');});
 check(()=>{const rows=sql.prepare('SELECT state,count(*) AS n FROM caseload_transfers WHERE org_id=? GROUP BY state').all(org);const by=Object.fromEntries(rows.map(x=>[x.state,x.n]));assert.equal(by.applied,3);assert.equal(by.cancelled,1);});
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action IN ('caseloadTransfer','caseloadApply','caseloadCancel','caseloadAcknowledge','removeMember')").get(org).n>=6));
 check(()=>assert.equal(sql.prepare("SELECT status FROM memberships WHERE org_id=? AND user_id=?").get(org,r.id).status,'active'));
}
