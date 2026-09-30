import assert from 'node:assert/strict';
// Slice 6b: rights and grievance requests through the built Worker and local D1.
export async function rightsSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c}=accounts;
 const view=async(who,personId,status=200)=>{const r=await fetch(`${base}/api/rights${personId?`?personId=${encodeURIComponent(personId)}`:''}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j)));return j;};
 await get(o,'/api/workspace',200,org);
 const person=id=>o.state.people.find(p=>p.id===id);
 const tag=crypto.randomUUID().slice(0,6);
 const make=async(name,age)=>(await post(o,{type:'createPerson',name:`${name} ${tag}`,age,sex:'Female',village:'Rights synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const R=await make('Rights Requester',34),H=await make('Rights Relative',38);
 const hh=await post(o,{type:'householdCreate',personId:R,version:person(R).version,label:'Rights synthetic household',relationship:'head'});
 await post(o,{type:'householdAddMember',householdId:hh.result.householdId,version:1,personId:H,personVersion:person(H).version,relationship:'spouse'});
 const grant=await post(o,{type:'proxyGrant',personId:R,version:person(R).version,proxyPersonId:H,relationship:'spouse',purposes:['care-coordination'],classes:[],evidence:'SYNTH-PROXY-R',expiresAt:new Date(Date.now()+30*86400000).toISOString()});
 const create=(over={})=>({type:'rightsCreate',personId:R,kind:'access',channel:'in-person',requester:'self',identityCheck:'Synthetic ID card seen',detail:'Asks for a copy of her records',...over});
 await post(a,create(),403);await post(w,create(),403);
 await post(o,create({requester:'proxy'}),422);
 await post(o,create({requester:'proxy',proxyGrantId:'not-a-grant'}),422);
 await post(o,create({detail:'short'}),422);
 const access=await post(o,create());
 check(()=>{assert.ok(access.result.requestId);assert.equal(access.result.items,0);assert.ok(access.result.dueAt>new Date(Date.now()+29*86400000).toISOString());});
 const grievance=await post(o,create({kind:'grievance',requester:'proxy',proxyGrantId:grant.result.grantId,channel:'phone',detail:'Spouse complains that a home visit was missed'}));
 let v=await view(o,R);
 check(()=>{assert.equal(v.requests.length,2);assert.equal(v.proxies.length,1);assert.ok(v.owners.some(x=>x.userId===c.id));assert.equal(v.requests.find(r=>r.id===grievance.result.requestId).requester,'proxy');});
 await view(a,R,403);await view(w,R,403);
 // Assignment and closure.
 const req=v.requests.find(r=>r.id===access.result.requestId);
 await post(c,{type:'rightsAssign',requestId:req.id,version:req.version,ownerId:c.id,note:'Self assignment attempt'},403);
 await post(s,{type:'rightsAssign',requestId:req.id,version:req.version,ownerId:a.id,note:'Admin cannot own requests'},422);
 await post(s,{type:'rightsAssign',requestId:req.id,version:req.version,ownerId:c.id,note:'Clinician to prepare the copy'});
 await post(w,{type:'rightsClose',requestId:req.id,version:2,outcome:'fulfilled',response:'Copy handed over',evidence:'COPY-1'},403);
 await post(c,{type:'rightsClose',requestId:req.id,version:1,outcome:'fulfilled',response:'Copy handed over',evidence:'COPY-1'},409);
 const done=await post(c,{type:'rightsClose',requestId:req.id,version:2,outcome:'fulfilled',response:'Printed visit summary handed over in person',evidence:'COPY-1'});
 check(()=>assert.equal(done.result.late,false));
 await post(c,{type:'rightsClose',requestId:req.id,version:3,outcome:'withdrawn',response:'Closing twice attempt',evidence:'COPY-2'},409);
 // Restriction pauses sharing and optional AI, then lifts.
 const restriction=await post(o,create({kind:'restriction',detail:'Asks that nothing is shared with programmes for now'}));
 await post(o,{type:'rightsClose',requestId:restriction.result.requestId,version:1,outcome:'fulfilled',response:'Sharing paused until she asks otherwise',evidence:'FORM-R1'});
 await get(o,'/api/workspace',200,org);check(()=>assert.equal(person(R).restrictions.filter(x=>!x.liftedAt).length,1));
 const visit=(await post(o,{type:'startVisit',personId:R})).result.visitId;
 const blocked=await post(o,{type:'preparePlan',visitId:visit,recipients:['mis_maternal']},409);
 check(()=>assert.match(blocked.error,/restricted/));
 await post(o,{type:'runAI',visitId:visit,providerId:'ai_summary',version:1,consentVersion:1,approved:true},409);
 v=await view(o,R);const rv=v.requests.find(r=>r.id===restriction.result.requestId);check(()=>{assert.equal(v.restricted,true);assert.equal(rv.canLift,true);});
 await post(w,{type:'rightsRestrictionLift',requestId:rv.id,version:rv.version,reason:'Worker attempt to lift'},403);
 await post(o,{type:'rightsRestrictionLift',requestId:rv.id,version:rv.version,reason:'She asked to resume programme reporting'});
 await get(o,'/api/workspace',200,org);check(()=>assert.equal(person(R).restrictions.filter(x=>!x.liftedAt).length,0));
 const after=await fetch(`${base}/api/commands`,{method:'POST',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify({type:'preparePlan',visitId:visit,recipients:['mis_maternal']})}).then(r=>r.json());
 check(()=>assert.ok(!/restricted/.test(after.error??''),'restriction no longer applies'));
 // Queue across scope.
 const q=await view(s);check(()=>{assert.ok(q.open.some(r=>r.id===grievance.result.requestId));assert.equal(q.open.some(r=>r.id===access.result.requestId),false);});
 await view(a,null,403);
 check(()=>{const rows=Object.fromEntries(sql.prepare('SELECT state,count(*) AS n FROM rights_requests WHERE org_id=? AND person_id=? GROUP BY state').all(org,R).map(x=>[x.state,x.n]));assert.equal(rows.open,1);assert.equal(rows.closed,2);});
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action LIKE 'rights%'").get(org,R).n,7));
}
