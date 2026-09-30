import assert from 'node:assert/strict';
// Slice 0b-3: paged patient list and on-demand patient detail for large team scopes,
// through the built Worker and local D1. A separate synthetic organisation is seeded with
// 560 people in team A and 40 in team B, so team-A viewers exceed the 500-person paging threshold.
export async function patientDirectorySmoke({get,post,check,sql,base}){
 const run=crypto.randomUUID().slice(0,8);
 const account=label=>({id:`pd-${run}-${label}`,headers:{'oai-authenticated-user-id':`pd-${run}-${label}`,'oai-authenticated-user-email':`${label}@example.invalid`},state:null});
 const o=account('owner'),sv=account('supervisor'),cl=account('clinician'),as=account('asha'),ad=account('admin'),x=account('stranger');
 await get(o);const org=(await post(o,{type:'createOrganisation',name:`Directory ${run}`})).result.organisationId;
 await get(o,'/api/workspace',200,org);
 const teamB=(await post(o,{type:'createTeam',name:'Directory team B'},200,crypto.randomUUID(),org)).result.teamId;
 for(const [who,role,teams] of [[sv,'supervisor',['default']],[cl,'clinician',['default']],[as,'asha',['default']],[ad,'admin',['default']]]){await get(who);const inv=(await post(o,{type:'createInvite',accountCode:who.state.user.accountCode,label:`Directory ${role}`,role,teamIds:teams},200,crypto.randomUUID(),org)).result;await post(who,{type:'joinOrganisation',token:inv.token});}
 await get(x);
 const tpl=(await post(o,{type:'createPerson',name:'Directory Template',age:30,sex:'Female',village:'Template village',programme:'Maternal care',teamId:'default'},200,crypto.randomUUID(),org)).result.personId;
 const {identityReview,assignmentHistory,fieldRegistration,...template}=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,tpl).data);
 const insP=sql.prepare('INSERT INTO patients (org_id,id,version,name,team_id,assigned_to,data) VALUES (?,?,?,?,?,?,?)');
 const person=(i,team)=>{const id=`pd_${run}_${team==='default'?'a':'b'}${String(i).padStart(4,'0')}`,name=`${team==='default'?'Aster':'Birch'} Synthetic ${String(i).padStart(4,'0')}`,assignedTo=team==='default'&&i<20?as.id:o.id;return {id,name,team,assignedTo,data:{...template,id,name,age:20+(i%50),village:`Directory village ${i%12}`,programmes:[i%3?'Maternal care':'Chronic care'],version:1,teamId:team,assignedTo,createdAt:'2026-09-20T08:00:00.000Z'}};};
 const seededA=Array.from({length:559},(_,i)=>person(i,'default')),seededB=Array.from({length:40},(_,i)=>person(i,teamB));
 sql.exec('BEGIN');for(const p of [...seededA,...seededB])insP.run(org,p.id,1,p.name,p.team,p.assignedTo,JSON.stringify(p.data));
 const vid=`pd_${run}_visit`,now='2026-09-20T08:00:00.000Z';
 sql.prepare('INSERT INTO visits (org_id,id,person_id,version,record_version,state,data) VALUES (?,?,?,?,?,?,?)').run(org,vid,seededA[5].id,2,1,'confirmed',JSON.stringify({id:vid,personId:seededA[5].id,version:2,state:'confirmed',facts:{date:'2026-09-20T08:00',systolic:'120',diastolic:'80',weight:'55',temperature:'',weeks:'',coughDays:'',notes:'Synthetic directory visit',source:'measured'},createdAt:now,confirmedAt:now,aiResults:[],recordVersion:1}));
 sql.exec('COMMIT');
 const inA=new Set([tpl,...seededA.map(p=>p.id)]),inB=new Set(seededB.map(p=>p.id));
 const paged={'x-saha-patients':'paged'};
 const ws=async(who,extra={},status=200)=>{const r=await fetch(`${base}/api/workspace`,{headers:{...who.headers,'x-saha-organisation':org,...extra}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const list=async(who,q='',status=200)=>{const r=await fetch(`${base}/api/patients${q}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const detail=async(who,id,status=200)=>{const r=await fetch(`${base}/api/patients/detail?personId=${encodeURIComponent(id)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};

 // Workspace: a paging supervisor with 560 people receives the paging marker and no patient records.
 const s1=await ws(sv,paged);
 check(()=>{assert.deepEqual(s1.patientPaging,{total:560,threshold:500,window:[]});assert.equal(s1.people.length,0);assert.equal(s1.visits.length,0);assert.equal(s1.referrals.length,0);});
 // Without the paging request the read is unchanged: the whole scoped team, never team B.
 const full=await ws(sv);
 check(()=>{assert.equal(full.patientPaging,undefined);assert.equal(full.people.length,560);assert.ok(full.people.every(p=>inA.has(p.id)));});
 // Owner authority does not widen scope: the owner belongs to team A only and is paged over team A.
 const so=await ws(o,paged);check(()=>{assert.equal(so.patientPaging.total,560);assert.equal(so.people.length,0);});
 // The ASHA keeps her whole caseload (20 assigned + the template she did not create is not hers).
 const sa=await ws(as,paged);check(()=>{assert.equal(sa.patientPaging,undefined);assert.equal(sa.people.length,20);assert.ok(sa.people.every(p=>p.assignedTo===as.id));});
 // A window re-reads only opened patients that are in scope; a team-B id is dropped silently.
 const sw=await ws(sv,{...paged,'x-saha-patient-window':`${seededA[5].id},${seededB[0].id},missing_${run}`});
 check(()=>{assert.deepEqual(sw.people.map(p=>p.id),[seededA[5].id]);assert.deepEqual(sw.visits.map(v=>v.id),[vid]);assert.deepEqual(sw.patientPaging.window,[seededA[5].id]);});
 await ws(sv,{...paged,'x-saha-patient-window':Array.from({length:51},(_,i)=>`id${i}`).join(',')},400);
 await ws(sv,{...paged,'x-saha-patient-window':'bad id!'},400);

 // Paged list: every page scope-checked, ordered by name, 560 unique team-A people in 12 pages.
 const first=await list(sv);check(()=>{assert.equal(first.total,560);assert.equal(first.rows.length,50);assert.ok(first.nextCursor);});
 const seen=[...first.rows];let cursor=first.nextCursor,pages=1;
 while(cursor){const next=await list(sv,`?cursor=${encodeURIComponent(cursor)}`);check(()=>assert.equal(next.total,null));seen.push(...next.rows);cursor=next.nextCursor;pages++;}
 check(()=>{assert.equal(pages,12);assert.equal(seen.length,560);assert.equal(new Set(seen.map(r=>r.id)).size,560);assert.ok(seen.every(r=>inA.has(r.id)&&!inB.has(r.id)));const names=seen.map(r=>r.name);assert.deepEqual(names,[...names].sort());});
 check(()=>{const r=seen.find(r=>r.id===seededA[5].id);assert.equal(r.village,'Directory village 5');assert.deepEqual(r.programmes,['Maternal care']);assert.equal(r.teamId,'default');assert.equal(r.exceptional,false);assert.equal(Object.hasOwn(r,'abha'),false);});
 // Search by name, village and id; out-of-scope names return nothing; programme filter.
 const byName=await list(sv,'?q=aster%20synthetic%200012');check(()=>assert.deepEqual(byName.rows.map(r=>r.id),[seededA[12].id]));
 const byVillage=await list(sv,`?q=${encodeURIComponent('directory village 11')}&limit=100`);check(()=>{assert.equal(byVillage.total,46);assert.ok(byVillage.rows.every(r=>r.village==='Directory village 11'));});
 const byId=await list(sv,`?q=${seededA[7].id}`);check(()=>assert.deepEqual(byId.rows.map(r=>r.id),[seededA[7].id]));
 const outside=await list(sv,'?q=birch');check(()=>{assert.equal(outside.total,0);assert.equal(outside.rows.length,0);});
 const chronic=await list(sv,`?programme=${encodeURIComponent('Chronic care')}&limit=100`);check(()=>{assert.equal(chronic.total,187);assert.ok(chronic.rows.every(r=>r.programmes.includes('Chronic care')));});
 // Other viewers: the ASHA lists her 20, admin none, a non-member is refused, bad input is rejected.
 const ashaList=await list(as,'?limit=100');check(()=>{assert.equal(ashaList.total,20);assert.ok(ashaList.rows.every(r=>r.assignedTo===as.id));});
 const adminList=await list(ad);check(()=>{assert.equal(adminList.total,0);assert.equal(adminList.rows.length,0);});
 await list(x,'',403);await list(sv,'?cursor=notjson',400);await list(sv,`?q=${'a'.repeat(81)}`,400);

 // Detail: one permitted patient in delta shape; out-of-scope and unknown ids look the same.
 const d=await detail(sv,seededA[5].id);
 check(()=>{assert.deepEqual(d.partition,[seededA[5].id]);assert.deepEqual(d.delta.people.map(p=>p.id),[seededA[5].id]);assert.deepEqual(d.delta.visits.map(v=>v.id),[vid]);assert.equal(d.delta.organisation.id,org);});
 const nb=await detail(sv,seededB[0].id,404),nx=await detail(sv,`missing_${run}`,404);check(()=>assert.equal(nb.error,nx.error));
 await detail(sv,'bad id!',400);await detail(ad,seededA[5].id,404);await detail(x,seededA[5].id,403);
 const ashaOther=await detail(as,seededA[30].id,404);check(()=>assert.ok(ashaOther.error));

 // A clinician emergency grant on a team-B patient adds exactly that patient to the clinician's list.
 const grantee=seededB[3];const until=new Date(Date.now()+3600000).toISOString();
 sql.prepare("UPDATE patients SET data=json_set(data,'$.exceptionalAccess',json(?)) WHERE org_id=? AND id=?").run(JSON.stringify([{id:`g_${run}`,userId:cl.id,reason:'Synthetic emergency',until,grantedAt:now,closedAt:null}]),org,grantee.id);
 const cList=await list(cl,'?q=birch');check(()=>{assert.equal(cList.total,1);assert.equal(cList.rows[0].id,grantee.id);assert.equal(cList.rows[0].exceptional,true);});
 const svStill=await list(sv,'?q=birch');check(()=>assert.equal(svStill.total,0));
 const cd=await detail(cl,grantee.id);check(()=>assert.deepEqual(cd.delta.people.map(p=>p.id),[grantee.id]));
 const cws=await ws(cl,paged);check(()=>assert.equal(cws.patientPaging.total,561));

 // Commands from a paging client: the returned snapshot is paged with the same window.
 const started=await post(cl,{type:'startVisit',personId:seededA[40].id},200,crypto.randomUUID(),org,{...paged,'x-saha-patient-window':seededA[40].id});
 check(()=>{assert.equal(started.snapshot.patientPaging.total,561);assert.deepEqual(started.snapshot.people.map(p=>p.id),[seededA[40].id]);assert.ok(started.snapshot.visits.some(v=>v.id===started.result.visitId));});
 // A malformed window on a command is refused before the command runs: no visit is started.
 const visitsBefore=sql.prepare('SELECT count(*) AS n FROM visits WHERE org_id=? AND person_id=?').get(org,seededA[42].id).n;
 const refused=await fetch(`${base}/api/commands`,{method:'POST',headers:{...cl.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org,...paged,'x-saha-patient-window':Array.from({length:51},(_,i)=>`id${i}`).join(',')},body:JSON.stringify({type:'startVisit',personId:seededA[42].id})});
 check(()=>{assert.equal(refused.status,400);assert.equal(sql.prepare('SELECT count(*) AS n FROM visits WHERE org_id=? AND person_id=?').get(org,seededA[42].id).n,visitsBefore);});
 const delta=await fetch(`${base}/api/commands`,{method:'POST',headers:{...cl.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org,'x-saha-response':'delta',...paged},body:JSON.stringify({type:'startVisit',personId:seededA[41].id})}).then(r=>r.json());
 check(()=>{assert.deepEqual(delta.partition,[seededA[41].id]);assert.deepEqual(delta.delta.people.map(p=>p.id),[seededA[41].id]);});
}
