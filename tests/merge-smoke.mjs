import assert from 'node:assert/strict';
// Slice 1c: controlled identity merge and unmerge through the built Worker and local D1.
export async function mergeSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c}=accounts;
 const cases=async(who,personId,status=200)=>{const r=await fetch(`${base}/api/identity-cases?personId=${encodeURIComponent(personId)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j)));return j;};
 const matches=async(who,body)=>{const r=await fetch(`${base}/api/patient-matches`,{method:'POST',headers:{...who.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(body)});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j)));return j;};
 await get(o,'/api/workspace',200,org);
 const person=id=>o.state.people.find(p=>p.id===id);
 const tag=crypto.randomUUID().slice(0,6),village='Merge synthetic locality';
 const make=async name=>(await post(o,{type:'createPerson',name,age:30,sex:'Female',village,programme:'Maternal care',teamId:'default'})).result.personId;
 const X=await make(`Merge Survivor ${tag}`),Y=await make(`Merge Duplicate ${tag}`);
 await post(o,{type:'enrolProgramme',personId:Y,version:person(Y).version,packId:'maternal',episodeLabel:'Synthetic duplicate episode',startDate:null});
 await post(o,{type:'scheduleFollowUp',personId:Y,version:person(Y).version,enrolmentId:person(Y).enrolments.find(e=>e.state==='active').id,title:'Duplicate antenatal check',due:'2026-11-01',ownerId:o.id});
 // Proposal: steward roles only, two different records, one open proposal per record.
 const propose={type:'identityMergePropose',survivorId:X,duplicateId:Y,evidence:'SYNTH-ANC-REGISTER',reason:'Same woman registered twice with a spelling variant'};
 await post(w,propose,403);await post(a,propose,403);
 await post(o,{...propose,duplicateId:X},422);
 await post(o,{...propose,reason:'short'},422);
 const proposed=await post(o,propose);const caseId=proposed.result.caseId;
 await post(c,{...propose,survivorId:Y,duplicateId:X},409);
 let v=await cases(o,Y);
 check(()=>{assert.equal(v.cases.length,1);assert.equal(v.cases[0].state,'proposed');assert.equal(v.cases[0].canDecide,false);assert.equal(v.cases[0].role,'duplicate');assert.equal(person(Y).mergedInto,undefined);});
 v=await cases(c,X);check(()=>{assert.equal(v.cases[0].canDecide,true);assert.equal(v.cases[0].role,'survivor');});
 await cases(a,X,403);await cases(w,X,403);
 // Review: a different steward; the proposer cannot approve their own proposal.
 await post(o,{type:'identityMergeDecide',caseId,version:1,decision:'approve',reason:'Self approval attempt'},403);
 await post(c,{type:'identityMergeDecide',caseId,version:5,decision:'approve',reason:'Stale version attempt'},409);
 const key=crypto.randomUUID(),decide={type:'identityMergeDecide',caseId,version:1,decision:'approve',reason:'Compared ANC card and register entry'};
 const approved=await post(c,decide,200,key);
 check(()=>{assert.equal(approved.result.items,2);assert.deepEqual(approved.result.invalidated,{plans:0,leases:0,messages:0});});
 const replay=await post(c,decide,200,key);check(()=>assert.equal(replay.replayed,true));
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(person(Y).mergedInto.personId,X);assert.equal(person(Y).mergedInto.caseId,caseId);assert.equal(person(X).mergedFrom.length,1);assert.equal(person(Y).enrolments.length,1,'nothing moved or deleted');});
 // The merged record accepts no new care; the survivor does.
 await post(o,{type:'startVisit',personId:Y},409);
 await post(o,{type:'scheduleFollowUp',personId:Y,version:person(Y).version,enrolmentId:person(Y).enrolments[0].id,title:'Another check',due:'2026-11-02',ownerId:o.id},409);
 await post(o,{type:'correctIdentity',personId:Y,version:person(Y).version,name:`Merge Renamed ${tag}`,age:30,sex:'Female',village,reason:'Should be refused on merged record'},409);
 const started=await post(o,{type:'startVisit',personId:X});check(()=>assert.ok(started.result.visitId));
 const found=await matches(o,{name:`Merge Duplicate ${tag}`,age:30,sex:'Female',village,teamId:'default'});
 check(()=>assert.equal(found.candidates.some(x=>x.id===Y),false,'merged records are not offered as matches'));
 // Impact queue.
 v=await cases(s,Y);const items=v.cases[0].items;
 check(()=>{assert.deepEqual(items.map(i=>i.kind).sort(),['enrolment','follow-up']);assert.equal(v.cases[0].canUnmerge,true);assert.equal(v.mergedInto.survivor.id,X);});
 await post(w,{type:'identityImpactResolve',caseId,version:2,itemId:items[0].id,note:'Worker attempt'},403);
 await post(s,{type:'identityImpactResolve',caseId,version:2,itemId:items[0].id,note:'Recreated on the surviving record'});
 await post(s,{type:'identityImpactResolve',caseId,version:3,itemId:items[0].id,note:'Resolved twice attempt'},409);
 // Unmerge: both records active again; work created on the survivor while merged is queued.
 await post(w,{type:'identityUnmerge',caseId,version:3,reason:'Worker attempt to reverse'},403);
 const un=await post(c,{type:'identityUnmerge',caseId,version:3,reason:'Different women, confirmed by the ANM visit'});
 check(()=>assert.equal(un.result.added,1));
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(person(Y).mergedInto,undefined);assert.ok(person(X).mergedFrom[0].unmergedAt);});
 const again=await post(o,{type:'startVisit',personId:Y});check(()=>assert.ok(again.result.visitId));
 v=await cases(o,X);check(()=>{assert.equal(v.cases[0].state,'unmerged');assert.ok(v.cases[0].items.some(i=>i.kind==='post-merge-review'&&i.ref===started.result.visitId));assert.equal(v.cases[0].items.filter(i=>i.state==='resolved').length,1);});
 await post(c,{type:'identityUnmerge',caseId,version:4,reason:'Second reversal attempt'},409);
 // Rejection keeps records separate.
 const second=await post(c,{...propose,reason:'Proposed again for rejection check'});
 await post(o,{type:'identityMergeDecide',caseId:second.result.caseId,version:1,decision:'reject',reason:'Different dates of birth on the cards'});
 await get(o,'/api/workspace',200,org);check(()=>assert.equal(person(Y).mergedInto,undefined));
 check(()=>{const rows=sql.prepare('SELECT state FROM identity_cases WHERE org_id=? AND duplicate_id=? ORDER BY created_at').all(org,Y).map(r=>r.state);assert.deepEqual(rows,['unmerged','rejected']);});
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action IN ('identityMergePropose','identityMergeDecide','identityUnmerge','identityImpactResolve')").get(org).n,6));
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND data LIKE '%mergedInto%'").get(org,Y).n>=1,'the merged state is kept in revisions after unmerge'));
}
