import assert from 'node:assert/strict';
// Slice 1f: scheduled caseload transfers that apply at their effective time, and household transfer, through the built
// Worker and local D1.
export async function caseloadScheduleSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s}=accounts;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${label}@example.invalid`},state:null};};
 const q=synthetic('asha-sender-1f'),r=synthetic('asha-receiver-1f'),r2=synthetic('asha-held-1f');
 const view=async(who,query={},status=200)=>{const res=await fetch(`${base}/api/caseload?${new URLSearchParams(query)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await res.json();check(()=>assert.equal(res.status,status,JSON.stringify(j)));return j;};
 for(const who of [q,r,r2]){await get(who);const i=await post(o,{type:'createInvite',accountCode:who.state.user.accountCode,label:'Synthetic ASHA 1f',role:'asha',teamIds:['default']});await post(who,{type:'joinOrganisation',token:i.result.token});}
 await get(o,'/api/workspace',200,org);
 const make=async name=>(await post(o,{type:'createPerson',name:`${name} ${crypto.randomUUID().slice(0,6)}`,age:35,sex:'Unknown',village:'Scheduled transfer synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const [A,B,C,D]=[await make('Household head 1f'),await make('Household spouse 1f'),await make('Individual 1f'),await make('Household child 1f')];
 await get(s,'/api/workspace',200,org);
 for(const [id,to] of [[A,q.id],[B,q.id],[C,q.id],[D,w.id]]){const p=s.state.people.find(p=>p.id===id);await post(s,{type:'assignPatient',personId:id,version:p.version,teamId:'default',assignedTo:to,reason:'Synthetic caseload for slice 1f'});}
 // A household of A, B (held by the sender) and D (held by another worker).
 await get(o,'/api/workspace',200,org);const pv=id=>o.state.people.find(p=>p.id===id).version;
 const h=(await post(o,{type:'householdCreate',personId:A,version:pv(A),label:'Synthetic 1f household',relationship:'head'})).result.householdId;
 const hv=()=>sql.prepare('SELECT version FROM households WHERE org_id=? AND id=?').get(org,h).version;
 await post(o,{type:'householdAddMember',householdId:h,version:hv(),personId:B,personVersion:pv(B),relationship:'spouse'});
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'householdAddMember',householdId:h,version:hv(),personId:D,personVersion:pv(D),relationship:'child'});
 // The preview names the household for patients that belong to one.
 const preview=(await view(s,{teamId:'default',fromUserId:q.id})).preview;
 check(()=>{assert.equal(preview.patients.find(p=>p.id===A).household.id,h);assert.equal(preview.patients.find(p=>p.id===C).household,null);});
 const hbody=(over={})=>({type:'caseloadHouseholdTransfer',teamId:'default',fromUserId:q.id,toUserId:r.id,householdId:h,householdVersion:hv(),effectiveAt:null,reason:'Synthetic household handover for leave',...over});
 await post(w,hbody(),403);
 await post(s,hbody({householdId:'unknown-household'}),404);
 await post(s,hbody({householdVersion:hv()+5}),409);
 await post(s,hbody({fromUserId:r.id,toUserId:q.id}),409);
 await post(s,{...hbody(),personIds:[A]},422);
 // A household transfer and an individual transfer, both scheduled a few seconds ahead.
 const soon=new Date(Date.now()+8000).toISOString();
 const key=crypto.randomUUID(),hb=hbody({effectiveAt:soon});
 const t1=await post(s,hb,200,key);
 check(()=>{assert.equal(t1.result.state,'scheduled');assert.equal(t1.result.householdId,h);assert.deepEqual(t1.result.notIncluded.map(x=>x.personId),[D]);});
 const again=await post(s,hb,200,key);
 check(()=>assert.equal(again.result.transferId,t1.result.transferId,'an idempotent replay returns the same transfer'));
 await post(s,{type:'caseloadTransfer',teamId:'default',fromUserId:q.id,toUserId:r.id,personIds:[A],effectiveAt:null,reason:'Overlapping synthetic transfer'},409);
 const t2=await post(s,{type:'caseloadTransfer',teamId:'default',fromUserId:q.id,toUserId:r2.id,personIds:[C],effectiveAt:soon,reason:'Synthetic transfer to be held'});
 // The receiver of the second transfer is suspended before it is due, so its re-check fails.
 await get(o,'/api/workspace',200,org);let m2=o.state.members.find(m=>m.userId===r2.id);
 await post(o,{type:'updateMember',userId:r2.id,version:m2.version,role:'asha',teamIds:['default'],isOwner:false,status:'suspended',reason:'Synthetic suspension before effect'});
 let v=await view(s);check(()=>{const x=v.transfers.find(t=>t.id===t1.result.transferId);assert.equal(x.state,'scheduled');assert.equal(x.household,true);assert.equal(x.due,false);});
 await new Promise(done=>setTimeout(done,Math.max(0,Date.parse(soon)-Date.now())+600));
 // Several concurrent reads after the effective time: each transfer is applied or held exactly once.
 const reads=await Promise.all([s,r,s,r,o].map(who=>fetch(`${base}/api/caseload`,{headers:{...who.headers,'x-saha-organisation':org}}).then(x=>x.status)));
 check(()=>assert.ok(reads.every(x=>x===200),JSON.stringify(reads)));
 const row=id=>{const x=sql.prepare('SELECT state,version,data FROM caseload_transfers WHERE org_id=? AND id=?').get(org,id);return {...x,data:JSON.parse(x.data)};};
 const count=(action,subject)=>sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action=? AND subject=?').get(org,action,subject).n;
 const settle=()=>{const a=row(t1.result.transferId),b=row(t2.result.transferId);return {a,b};};
 let {a,b}=settle();
 check(()=>{assert.equal(a.state,'applied');assert.equal(a.data.applied.automatic,true);assert.equal(a.data.applied.by,'system');assert.deepEqual(a.data.applied.moved.sort(),[A,B].sort());assert.equal(a.version,2);});
 check(()=>{assert.equal(b.state,'held');assert.match(b.data.held.reason,/receiving worker/);assert.equal(b.version,2);});
 check(()=>{assert.equal(count('caseloadAutoApply',t1.result.transferId),1);assert.equal(count('caseloadHold',t2.result.transferId),1);});
 check(()=>{const n=sql.prepare("SELECT person_id,count(*) AS n FROM record_revisions WHERE org_id=? AND action='caseloadAutoApply' AND person_id IN (?,?,?,?) GROUP BY person_id").all(org,A,B,C,D);assert.deepEqual(n.map(x=>x.person_id).sort(),[A,B].sort());assert.ok(n.every(x=>x.n===1));});
 check(()=>assert.equal(sql.prepare("SELECT assigned_to FROM patients WHERE org_id=? AND id=?").get(org,D).assigned_to,w.id,'the member held by another worker stays'));
 // Further reads and commands change nothing.
 await view(s);await get(r,'/api/workspace',200,org);
 check(()=>{assert.equal(count('caseloadAutoApply',t1.result.transferId),1);assert.equal(count('caseloadHold',t2.result.transferId),1);assert.equal(row(t1.result.transferId).version,2);assert.equal(row(t2.result.transferId).version,2);});
 check(()=>{const people=r.state.people.map(p=>p.id);assert.ok(people.includes(A)&&people.includes(B));assert.ok(!people.includes(C));});
 // The receiving worker sees and acknowledges the automatically applied household transfer.
 v=await view(r);const incoming=v.incoming.find(t=>t.id===t1.result.transferId);
 check(()=>{assert.ok(incoming);assert.equal(incoming.automatic,true);assert.equal(incoming.household,true);});
 const ack=await post(r,{type:'caseloadAcknowledge',transferId:incoming.id,version:incoming.version,reference:'SYNTH-1F-HANDOVER'});
 check(()=>assert.deepEqual(ack.result,{acknowledged:2,notAcknowledged:0}));
 // The held transfer waits for a steward: applying while the receiver is still suspended is refused; after
 // reactivation a steward applies it with the same re-checks.
 v=await view(s);const held=v.transfers.find(t=>t.id===t2.result.transferId);
 check(()=>{assert.equal(held.state,'held');assert.ok(held.held.reason.length>10);});
 await post(w,{type:'caseloadApply',transferId:held.id,version:held.version},403);
 await post(s,{type:'caseloadApply',transferId:held.id,version:held.version},422);
 await get(o,'/api/workspace',200,org);m2=o.state.members.find(m=>m.userId===r2.id);
 await post(o,{type:'updateMember',userId:r2.id,version:m2.version,role:'asha',teamIds:['default'],isOwner:false,status:'active',reason:'Synthetic reactivation after hold'});
 const manual=await post(s,{type:'caseloadApply',transferId:held.id,version:held.version});
 check(()=>{assert.equal(manual.result.moved,1);const x=row(held.id);assert.equal(x.state,'applied');assert.equal(x.data.applied.automatic,undefined);assert.equal(x.data.applied.by,s.id);});
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND actor_id='system' AND key LIKE 'caseload-auto-%'").get(org).n>=1));
}
